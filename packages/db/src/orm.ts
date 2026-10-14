/**
 * orm.ts — MOTOR DE CONSULTAS MÍNIMO SOBRE node:sqlite
 *
 * Fala o subconjunto da API do Prisma que o servidor usa (findMany/findFirst/findUnique, create, update, upsert, delete,
 * count, aggregate, include/select, where com AND/OR/NOT/some/contains/in/has...), de forma que os serviços não precisam
 * saber qual banco existe por baixo. Sem dependências: o SQLite vem dentro do Node (node:sqlite).
 *
 * Regras de segurança: NOMES (tabelas, campos) só vêm de schema.ts — um campo desconhecido é erro, nunca vira SQL —
 * e VALORES sempre vão como parâmetros.
 * Concorrência: há uma única conexão, e o SQLite é síncrono. Cada operação roda inteira, sem ser interrompida; uma
 * transação ($transaction) segura a fila até terminar, para que ninguém escreva "no meio" dela.
 */

import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { MODELS, delegateName, type FieldDef, type ModelDef } from './schema.ts';

// linhas sem tipo: o motor não sabe o formato de cada tabela em tempo de compilação
type Row = any;
type Args = Record<string, any>;

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;
const isPlainObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof Uint8Array);

export class DbError extends Error {
  code: string;
  constructor(message: string, code: string) { super(message); this.name = 'DbError'; this.code = code; }
}

function encode(field: FieldDef, value: unknown): SQLInputValue {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case 'bool': return value ? 1 : 0;
    case 'date': return value instanceof Date ? value.toISOString() : new Date(value as string | number).toISOString();
    case 'json': case 'list': return JSON.stringify(value);
    case 'bytes': return value instanceof Uint8Array ? value : Buffer.from(value as ArrayLike<number>);
    case 'bigint': return typeof value === 'bigint' ? value : BigInt(value as number);
    default: return value as SQLInputValue;
  }
}

function decode(field: FieldDef, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case 'bool': return value !== 0 && value !== 0n;
    case 'date': return new Date(value as string);
    case 'json': case 'list': return JSON.parse(value as string);
    case 'bigint': return BigInt(value as number);
    case 'int': case 'float': return Number(value);
    default: return value;
  }
}

class Compile {
  params: SQLInputValue[] = [];
  private n = 0;
  alias() { return `t${this.n++}`; }
}

const model = (name: string): ModelDef => {
  const m = MODELS[name];
  if (!m) throw new DbError(`Modelo desconhecido: ${name}`, 'DB_UNKNOWN_MODEL');
  return m;
};
const fieldOf = (m: ModelDef, name: string): FieldDef => {
  const f = m.fields[name];
  if (!f) throw new DbError(`Campo desconhecido: ${m.table}.${name}`, 'DB_UNKNOWN_FIELD');
  return f;
};

/** Nome composto de unicidade (ex.: ownerId_slug) → lista de campos. */
function compoundKeys(m: ModelDef): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (m.pk.length > 1) out.set(m.pk.join('_'), m.pk);
  for (const u of m.uniques) if (u.length > 1) out.set(u.join('_'), u);
  return out;
}

function compileWhere(m: ModelDef, where: Args | undefined, a: string, c: Compile): string {
  if (!where) return '1';
  const parts: string[] = [];
  const compound = compoundKeys(m);
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === 'AND') {
      const list = (Array.isArray(value) ? value : [value]).map((w) => compileWhere(m, w, a, c));
      parts.push(list.length ? `(${list.join(' AND ')})` : '1');
    } else if (key === 'OR') {
      const list = (Array.isArray(value) ? value : [value]).map((w) => compileWhere(m, w, a, c));
      parts.push(list.length ? `(${list.join(' OR ')})` : '0');
    } else if (key === 'NOT') {
      const list = (Array.isArray(value) ? value : [value]).map((w) => compileWhere(m, w, a, c));
      parts.push(list.length ? `NOT (${list.join(' AND ')})` : '1');
    } else if (compound.has(key)) {
      parts.push(compileWhere(m, value as Args, a, c));
    } else if (m.fields[key]) {
      parts.push(compileField(m.fields[key], `${a}.${q(key)}`, value, c));
    } else if (m.relations[key]) {
      parts.push(compileRelation(m, key, value as Args | null, a, c));
    } else {
      throw new DbError(`Campo desconhecido no filtro: ${m.table}.${key}`, 'DB_UNKNOWN_FIELD');
    }
  }
  return parts.length ? `(${parts.join(' AND ')})` : '1';
}

function compileRelation(m: ModelDef, name: string, value: Args | null, a: string, c: Compile): string {
  const rel = m.relations[name];
  const target = model(rel.model);
  const b = c.alias();
  const from = `${q(target.table)} ${b}`;
  if (rel.kind === 'many') {
    const link = `${b}.${q(rel.by!)} = ${a}.${q(m.pk[0])}`;
    const v = value ?? {};
    const out: string[] = [];
    if (v.some) out.push(`EXISTS (SELECT 1 FROM ${from} WHERE ${link} AND ${compileWhere(target, v.some, b, c)})`);
    if (v.none) out.push(`NOT EXISTS (SELECT 1 FROM ${from} WHERE ${link} AND ${compileWhere(target, v.none, b, c)})`);
    if (v.every) out.push(`NOT EXISTS (SELECT 1 FROM ${from} WHERE ${link} AND NOT ${compileWhere(target, v.every, b, c)})`);
    return out.length ? `(${out.join(' AND ')})` : '1';
  }
  const link = `${b}.${q(rel.ref ?? 'id')} = ${a}.${q(rel.fk!)}`;
  if (value === null) return `${a}.${q(rel.fk!)} IS NULL`;
  const v = value as Args;
  const isShape = 'is' in v || 'isNot' in v;
  const inner = isShape ? v.is : v;
  const out: string[] = [];
  if (isShape ? v.is !== undefined : true) {
    out.push(inner === null ? `${a}.${q(rel.fk!)} IS NULL` : `EXISTS (SELECT 1 FROM ${from} WHERE ${link} AND ${compileWhere(target, inner, b, c)})`);
  }
  if (v.isNot !== undefined) {
    out.push(v.isNot === null ? `${a}.${q(rel.fk!)} IS NOT NULL` : `NOT EXISTS (SELECT 1 FROM ${from} WHERE ${link} AND ${compileWhere(target, v.isNot, b, c)})`);
  }
  return out.length ? `(${out.join(' AND ')})` : '1';
}

/** Em minúsculas, também para letras fora do ASCII (função registrada em client.ts). */
const LOWER = 'ulower';

function compileField(f: FieldDef, col: string, value: unknown, c: Compile): string {
  if (value === null) return `${col} IS NULL`;
  if (!isPlainObject(value)) {
    c.params.push(encode(f, value));
    return `${col} = ?`;
  }
  const parts: string[] = [];
  const insensitive = value.mode === 'insensitive';
  const text = (v: unknown) => String(v);
  for (const [op, v] of Object.entries(value)) {
    if (v === undefined || op === 'mode') continue;
    switch (op) {
      case 'equals':
        if (v === null) parts.push(`${col} IS NULL`);
        else { c.params.push(encode(f, v)); parts.push(`${col} = ?`); }
        break;
      case 'not':
        if (v === null) parts.push(`${col} IS NOT NULL`);
        else if (isPlainObject(v)) parts.push(`NOT (${compileField(f, col, v, c)})`);
        else { c.params.push(encode(f, v)); parts.push(`${col} <> ?`); }
        break;
      case 'in': {
        const list = (v as unknown[]);
        if (!list.length) { parts.push('0'); break; }
        for (const item of list) c.params.push(encode(f, item));
        parts.push(`${col} IN (${list.map(() => '?').join(',')})`);
        break;
      }
      case 'notIn': {
        const list = (v as unknown[]);
        if (!list.length) { parts.push('1'); break; }
        for (const item of list) c.params.push(encode(f, item));
        parts.push(`${col} NOT IN (${list.map(() => '?').join(',')})`);
        break;
      }
      case 'lt': case 'lte': case 'gt': case 'gte': {
        c.params.push(encode(f, v));
        parts.push(`${col} ${{ lt: '<', lte: '<=', gt: '>', gte: '>=' }[op]} ?`);
        break;
      }
      case 'contains':
        if (insensitive) { c.params.push(text(v)); parts.push(`instr(${LOWER}(${col}), ${LOWER}(?)) > 0`); }
        else { c.params.push(text(v)); parts.push(`instr(${col}, ?) > 0`); }
        break;
      case 'startsWith': {
        const s = text(v);
        c.params.push([...s].length, s);
        parts.push(insensitive ? `${LOWER}(substr(${col}, 1, ?)) = ${LOWER}(?)` : `substr(${col}, 1, ?) = ?`);
        break;
      }
      case 'endsWith': {
        const s = text(v);
        if (!s) { parts.push('1'); break; }
        c.params.push([...s].length, s);
        parts.push(insensitive ? `${LOWER}(substr(${col}, -?)) = ${LOWER}(?)` : `substr(${col}, -?) = ?`);
        break;
      }
      case 'has':
        c.params.push(v as SQLInputValue);
        parts.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE value = ?)`);
        break;
      case 'hasSome': {
        const list = v as SQLInputValue[];
        if (!list.length) { parts.push('0'); break; }
        for (const item of list) c.params.push(item);
        parts.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE value IN (${list.map(() => '?').join(',')}))`);
        break;
      }
      case 'hasEvery': {
        for (const item of v as SQLInputValue[]) {
          c.params.push(item);
          parts.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE value = ?)`);
        }
        break;
      }
      case 'isEmpty':
        parts.push(v ? `json_array_length(${col}) = 0` : `json_array_length(${col}) > 0`);
        break;
      default:
        throw new DbError(`Operador desconhecido no filtro: ${op}`, 'DB_UNKNOWN_OPERATOR');
    }
  }
  return parts.length ? `(${parts.join(' AND ')})` : '1';
}

function compileOrder(m: ModelDef, orderBy: Args | Args[] | undefined, a: string): string {
  const list = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  const terms: string[] = [];
  let first: 'ASC' | 'DESC' | null = null;
  for (const item of list) {
    for (const [field, dir] of Object.entries(item)) {
      fieldOf(m, field);
      const d = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      first ??= d;
      terms.push(`${a}.${q(field)} ${d}`);
    }
  }
  // desempate estável: ordem de inserção, na mesma direção do primeiro critério
  if (first) terms.push(`${a}.rowid ${first}`);
  return terms.length ? ` ORDER BY ${terms.join(', ')}` : '';
}

function relationSpecs(m: ModelDef, args: Args): Array<[string, Args]> {
  const out: Array<[string, Args]> = [];
  for (const src of [args.select, args.include]) {
    if (!src) continue;
    for (const [k, v] of Object.entries<any>(src)) {
      if (!v) continue;
      if (m.relations[k]) out.push([k, v === true ? {} : v]);
      else if (!m.fields[k]) throw new DbError(`Campo desconhecido: ${m.table}.${k}`, 'DB_UNKNOWN_FIELD');
    }
  }
  return out;
}

export type Executor = {
  /** Roda uma operação síncrona no banco, respeitando a fila (e a transação em andamento). */
  run<T>(fn: () => T): Promise<T>;
};

export function createEngine(sqlite: DatabaseSync) {
  const cache = new Map<string, ReturnType<DatabaseSync['prepare']>>();
  const stmt = (sql: string) => {
    let s = cache.get(sql);
    if (!s) {
      s = sqlite.prepare(sql);
      if (cache.size > 400) cache.clear();
      cache.set(sql, s);
    }
    return s;
  };
  const exec = (sql: string, params: SQLInputValue[]) => {
    try { return stmt(sql).run(...params); } catch (err) { throw wrap(err); }
  };
  const all = (sql: string, params: SQLInputValue[]) => {
    try { return stmt(sql).all(...params) as Row[]; } catch (err) { throw wrap(err); }
  };

  function wrap(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed|PRIMARY KEY/i.test(message)) return new DbError(message, 'P2002');
    if (/FOREIGN KEY constraint failed/i.test(message)) return new DbError(message, 'P2003');
    return err;
  }

  // ------------------------------------------------------------------ leitura
  /** `extra`: campos que o chamador precisa receber mesmo sem estarem no select (ex.: chave para ligar relações). */
  function findRows(name: string, args: Args = {}, extra: string[] = []): Row[] {
    const m = model(name);
    const specs = relationSpecs(m, args);
    const scalar = args.select
      ? Object.keys(args.select).filter((k) => args.select[k] && m.fields[k])
      : Object.keys(m.fields);
    const needed = new Set<string>([...scalar, ...extra]);
    for (const [k] of specs) {
      const rel = m.relations[k];
      needed.add(rel.kind === 'one' ? rel.fk! : m.pk[0]);
    }
    const keep = new Set<string>([...scalar, ...extra]);
    const c = new Compile();
    const a = c.alias();
    const cols = [...needed].map((f) => `${a}.${q(f)} AS ${q(f)}`).join(', ');
    // a ordem das partes importa: os parâmetros seguem a ordem do texto SQL (where → limit/offset)
    const whereSql = compileWhere(m, args.where, a, c);
    const orderSql = compileOrder(m, args.orderBy, a);
    let limitSql = '';
    if (args.take !== undefined && args.take !== null) { limitSql = ' LIMIT ?'; c.params.push(Math.max(0, Number(args.take))); }
    if (args.skip) { limitSql += `${limitSql ? '' : ' LIMIT -1'} OFFSET ?`; c.params.push(Number(args.skip)); }
    const sql = `SELECT ${cols} FROM ${q(m.table)} ${a} WHERE ${whereSql}${orderSql}${limitSql}`;
    const raw = all(sql, c.params);
    const rows: Row[] = raw.map((r) => {
      const out: Row = {};
      for (const f of needed) out[f] = decode(m.fields[f], r[f]);
      return out;
    });
    for (const [k, spec] of specs) attachRelation(m, rows, k, spec);
    // tira o que só foi lido para ligar as relações
    const drop = [...needed].filter((f) => !keep.has(f));
    if (drop.length) for (const r of rows) for (const f of drop) delete r[f];
    return rows;
  }

  function attachRelation(m: ModelDef, rows: Row[], key: string, spec: Args) {
    const rel = m.relations[key];
    const targetName = rel.model;
    if (!rows.length) return;
    if (rel.kind === 'one') {
      const refField = rel.ref ?? 'id';
      const keys = [...new Set(rows.map((r) => r[rel.fk!]).filter((v) => v !== null && v !== undefined))];
      const found = keys.length
        ? findRows(targetName, { ...spec, where: spec.where ? { AND: [spec.where, { [refField]: { in: keys } }] } : { [refField]: { in: keys } } }, [refField])
        : [];
      const byKey = new Map(found.map((t) => [t[refField], t]));
      const dropRef = spec.select && !spec.select[refField];
      for (const r of rows) {
        const t = r[rel.fk!] == null ? null : byKey.get(r[rel.fk!]) ?? null;
        r[key] = t && dropRef ? (() => { const { [refField]: _omit, ...rest } = t; return rest; })() : t;
      }
      return;
    }
    const ids = rows.map((r) => r[m.pk[0]]);
    const where = { AND: [...(spec.where ? [spec.where] : []), { [rel.by!]: { in: ids } }] };
    const { take, skip, ...rest } = spec;
    const found = findRows(targetName, { ...rest, where }, [rel.by!]);
    const dropBy = spec.select && !spec.select[rel.by!];
    const groups = new Map<unknown, Row[]>();
    for (const t of found) {
      const g = groups.get(t[rel.by!]) ?? [];
      g.push(t);
      groups.set(t[rel.by!], g);
    }
    for (const r of rows) {
      let list = groups.get(r[m.pk[0]]) ?? [];
      if (skip || take !== undefined) list = list.slice(skip ?? 0, take !== undefined ? (skip ?? 0) + take : undefined);
      r[key] = dropBy ? list.map((t) => { const { [rel.by!]: _omit, ...others } = t; return others; }) : list;
    }
  }

  const notFound = (name: string, action: string) => new DbError(`${action}: registro de ${name} não encontrado.`, 'P2025');

  function count(name: string, args: Args = {}): number {
    const m = model(name);
    const c = new Compile();
    const a = c.alias();
    const where = compileWhere(m, args.where, a, c);
    return Number(all(`SELECT COUNT(*) AS n FROM ${q(m.table)} ${a} WHERE ${where}`, c.params)[0].n);
  }

  function aggregate(name: string, args: Args = {}): Row {
    const m = model(name);
    const c = new Compile();
    const a = c.alias();
    const selects: string[] = [];
    const plan: Array<[string, string | null, string]> = [];
    for (const [fn, sqlFn] of [['_sum', 'SUM'], ['_avg', 'AVG'], ['_min', 'MIN'], ['_max', 'MAX']] as const) {
      for (const [field, on] of Object.entries<any>(args[fn] ?? {})) {
        if (!on) continue;
        fieldOf(m, field);
        const alias = `${fn}_${field}`;
        selects.push(`${sqlFn}(${a}.${q(field)}) AS ${q(alias)}`);
        plan.push([fn, field, alias]);
      }
    }
    if (args._count) {
      if (args._count === true) { selects.push('COUNT(*) AS "_count"'); plan.push(['_count', null, '_count']); }
      else for (const [field, on] of Object.entries<any>(args._count)) if (on) {
        fieldOf(m, field);
        selects.push(`COUNT(${a}.${q(field)}) AS ${q(`_count_${field}`)}`);
        plan.push(['_count', field, `_count_${field}`]);
      }
    }
    if (!selects.length) selects.push('COUNT(*) AS "_unused"');
    const where = compileWhere(m, args.where, a, c);
    const row = all(`SELECT ${selects.join(', ')} FROM ${q(m.table)} ${a} WHERE ${where}`, c.params)[0];
    const out: Row = {};
    for (const [fn, field, alias] of plan) {
      const value = row[alias] === null || row[alias] === undefined ? null : Number(row[alias]);
      if (field === null) out[fn] = value ?? 0;
      else (out[fn] ??= {})[field] = fn === '_count' ? (value ?? 0) : value;
    }
    return out;
  }

  // ------------------------------------------------------------------ escrita
  function pkWhere(m: ModelDef, row: Row): Args {
    return Object.fromEntries(m.pk.map((f) => [f, row[f]]));
  }

  function insert(name: string, data: Args, orIgnore = false): { changes: number; row: Row } {
    const m = model(name);
    for (const key of Object.keys(data)) if (data[key] !== undefined) fieldOf(m, key);
    const cols: string[] = [];
    const values: SQLInputValue[] = [];
    const used: Row = {};
    for (const [fname, f] of Object.entries(m.fields)) {
      let v = data[fname];
      if (v === undefined) {
        if (f.updatedAt || f.default === 'now') v = new Date();
        else if (f.default === 'uuid') v = randomUUID();
        else if (f.default === 'autoincrement') continue;
        else if (f.default !== undefined) v = structuredClone(f.default);
        else if (f.optional) continue;
        else throw new DbError(`Falta o campo obrigatório ${m.table}.${fname}.`, 'P2011');
      }
      cols.push(q(fname));
      values.push(encode(f, v));
      used[fname] = v;
    }
    const sql = `INSERT ${orIgnore ? 'OR IGNORE ' : ''}INTO ${q(m.table)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    const result = exec(sql, values);
    const auto = Object.entries(m.fields).find(([, f]) => f.default === 'autoincrement');
    if (auto && result.changes) used[auto[0]] = BigInt(result.lastInsertRowid as number | bigint);
    return { changes: Number(result.changes), row: used };
  }

  function setClause(m: ModelDef, data: Args): { sql: string; params: SQLInputValue[] } {
    const sets: string[] = [];
    const params: SQLInputValue[] = [];
    for (const [key, raw] of Object.entries(data)) {
      if (raw === undefined) continue;
      const f = fieldOf(m, key);
      const value = isPlainObject(raw) && 'set' in raw && f.type !== 'json' ? raw.set : raw;
      sets.push(`${q(key)} = ?`);
      params.push(encode(f, value));
    }
    for (const [fname, f] of Object.entries(m.fields)) {
      if (f.updatedAt && data[fname] === undefined) { sets.push(`${q(fname)} = ?`); params.push(encode(f, new Date())); }
    }
    return { sql: sets.join(', '), params };
  }

  function updateRows(name: string, args: Args, limit?: number): { count: number; rows: Row[] } {
    const m = model(name);
    const found = findRows(name, { where: args.where, select: Object.fromEntries(m.pk.map((f) => [f, true])), take: limit });
    if (!found.length) return { count: 0, rows: [] };
    const { sql, params } = setClause(m, args.data ?? {});
    if (sql) {
      for (const r of found) {
        const w = m.pk.map((f) => `${q(f)} = ?`).join(' AND ');
        exec(`UPDATE ${q(m.table)} SET ${sql} WHERE ${w}`, [...params, ...m.pk.map((f) => encode(m.fields[f], r[f]))]);
      }
    }
    return { count: found.length, rows: found };
  }

  function deleteRows(name: string, where: Args | undefined, limit?: number): number {
    const m = model(name);
    const found = findRows(name, { where, select: Object.fromEntries(m.pk.map((f) => [f, true])), take: limit });
    for (const r of found) {
      exec(`DELETE FROM ${q(m.table)} WHERE ${m.pk.map((f) => `${q(f)} = ?`).join(' AND ')}`, m.pk.map((f) => encode(m.fields[f], r[f])));
    }
    return found.length;
  }

  // ------------------------------------------------------------------ delegate (a API pública por modelo)
  function delegate(name: string, run: Executor['run']) {
    const m = model(name);
    const view = (row: Row, args: Args) => findRows(name, { where: pkWhere(m, row), select: args.select, include: args.include }, [])[0] ?? null;
    return {
      findMany: (args: Args = {}) => run(() => findRows(name, args)),
      findFirst: (args: Args = {}) => run(() => findRows(name, { ...args, take: 1 })[0] ?? null),
      findFirstOrThrow: (args: Args = {}) => run(() => findRows(name, { ...args, take: 1 })[0] ?? (() => { throw notFound(name, 'findFirstOrThrow'); })()),
      findUnique: (args: Args = {}) => run(() => findRows(name, { ...args, take: 1 })[0] ?? null),
      findUniqueOrThrow: (args: Args = {}) => run(() => findRows(name, { ...args, take: 1 })[0] ?? (() => { throw notFound(name, 'findUniqueOrThrow'); })()),
      count: (args: Args = {}) => run(() => count(name, args)),
      aggregate: (args: Args = {}) => run(() => aggregate(name, args)),
      create: (args: Args) => run(() => view(insert(name, args.data).row, args)),
      createMany: (args: Args) => run(() => {
        let n = 0;
        for (const data of args.data as Args[]) n += insert(name, data, !!args.skipDuplicates).changes;
        return { count: n };
      }),
      update: (args: Args) => run(() => {
        const { rows } = updateRows(name, args, 1);
        if (!rows.length) throw notFound(name, 'update');
        return view(rows[0], args);
      }),
      updateMany: (args: Args) => run(() => ({ count: updateRows(name, args).count })),
      upsert: (args: Args) => run(() => {
        const existing = findRows(name, { where: args.where, select: Object.fromEntries(m.pk.map((f) => [f, true])), take: 1 })[0];
        if (existing) {
          updateRows(name, { where: pkWhere(m, existing), data: args.update ?? {} }, 1);
          return view(existing, args);
        }
        return view(insert(name, { ...args.create }).row, args);
      }),
      delete: (args: Args) => run(() => {
        const row = findRows(name, { where: args.where, select: args.select, include: args.include, take: 1 }, m.pk)[0];
        if (!row) throw notFound(name, 'delete');
        deleteRows(name, pkWhere(m, row), 1);
        if (!args.select || m.pk.every((f) => args.select[f])) return row;
        for (const f of m.pk) if (!args.select[f]) delete row[f];
        return row;
      }),
      deleteMany: (args: Args = {}) => run(() => ({ count: deleteRows(name, args.where) })),
    };
  }

  return { delegate, exec, all };
}

export type Delegate = ReturnType<ReturnType<typeof createEngine>['delegate']>;
export const modelNames = Object.keys(MODELS);
export { delegateName };
