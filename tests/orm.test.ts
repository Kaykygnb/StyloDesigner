// Motor de consultas do banco local (SQLite): filtros, relações, transações, cascatas e a "planta" (schema.ts) em dia com o SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '@stylo/db/client.ts';
import { MODELS, delegateName } from '@stylo/db/schema.ts';

const withDb = async (fn: (db: Awaited<ReturnType<typeof createDb>>['db']) => Promise<void>) => {
  const { db, close } = await createDb();
  try { await fn(db); } finally { await close(); }
};

test('schema.ts descreve exatamente as colunas e chaves do SQL', async () => {
  const { db, close } = await createDb();
  try {
    for (const [name, model] of Object.entries(MODELS)) {
      const cols = await db.$queryRawUnsafe<Array<{ name: string; notnull: number; pk: number; type: string }>>(`PRAGMA table_info("${model.table}")`);
      assert.deepEqual(cols.map((c) => c.name).sort(), Object.keys(model.fields).sort(), `colunas de ${name}`);
      assert.deepEqual(cols.filter((c) => c.pk).map((c) => c.name).sort(), [...model.pk].sort(), `chave de ${name}`);
      for (const c of cols) {
        const f = model.fields[c.name];
        // obrigatório no SQL ⇔ não opcional na planta (as chaves primárias contam como obrigatórias)
        assert.equal(!!c.notnull || !!c.pk, !f.optional, `${name}.${c.name}: obrigatório`);
      }
      assert.ok(delegateName(name) in db, `delegate ${delegateName(name)}`);
    }
    // toda relação aponta para modelo e campos que existem
    for (const [name, model] of Object.entries(MODELS)) {
      for (const [key, rel] of Object.entries(model.relations)) {
        const target = MODELS[rel.model];
        assert.ok(target, `${name}.${key} → ${rel.model}`);
        if (rel.kind === 'one') { assert.ok(model.fields[rel.fk!], `${name}.${key}.fk`); assert.ok(target.fields[rel.ref ?? 'id']); } else assert.ok(target.fields[rel.by!], `${name}.${key}.by`);
      }
    }
  } finally { await close(); }
});

test('filtros: igualdade, in/notIn, not, gt/lt, contains sem diferenciar maiúsculas (inclui acentos), has em listas, OR/AND/NOT', async () => {
  await withDb(async (db) => {
    const owner = await db.user.create({ data: { email: 'o@x.invalid', name: 'Dono', passwordHash: 'x', role: 'OWNER' } });
    const names = ['Árvore de Natal', 'arvore', 'Casa', 'ÓCULOS'];
    for (const [i, name] of names.entries()) {
      await db.libraryAsset.create({ data: { userId: owner.id, kind: 'IMAGE', name, mime: 'image/png', size: (i + 1) * 100, hash: `h${i}`, tags: i % 2 ? ['azul', 'mar'] : ['verde'] } });
    }
    const list = async (where: object) => (await db.libraryAsset.findMany({ where, orderBy: { size: 'asc' } })).map((a: any) => a.name);
    assert.deepEqual(await list({ name: { contains: 'árvore', mode: 'insensitive' } }), ['Árvore de Natal']);
    assert.deepEqual(await list({ name: { contains: 'ÓCULOS', mode: 'insensitive' } }), ['ÓCULOS']);
    assert.deepEqual(await list({ name: { contains: 'ca', mode: 'insensitive' } }), ['Casa']);
    assert.deepEqual(await list({ name: { contains: 'Ca' } }), ['Casa']);
    assert.deepEqual(await list({ name: { contains: 'ca' } }), [], 'sem mode, diferencia maiúsculas');
    assert.deepEqual(await list({ name: { startsWith: 'arv' } }), ['arvore']);
    assert.deepEqual(await list({ tags: { has: 'mar' } }), ['arvore', 'ÓCULOS']);
    assert.deepEqual(await list({ size: { in: [100, 300] } }), ['Árvore de Natal', 'Casa']);
    assert.deepEqual(await list({ size: { notIn: [100, 300] } }), ['arvore', 'ÓCULOS']);
    assert.deepEqual(await list({ size: { gt: 100, lte: 300 } }), ['arvore', 'Casa']);
    assert.deepEqual(await list({ hash: { not: 'h0' }, size: { lt: 300 } }), ['arvore']);
    assert.deepEqual(await list({ OR: [{ name: 'Casa' }, { tags: { has: 'verde' } }] }), ['Árvore de Natal', 'Casa']);
    assert.deepEqual(await list({ NOT: { name: 'Casa' }, AND: [{ size: { lt: 400 } }] }), ['Árvore de Natal', 'arvore']);
    assert.deepEqual(await list({ OR: [] }), [], 'OR vazio não casa com nada');
    assert.deepEqual(await list({ capturedAt: null, name: undefined }), names.map((n) => n).sort((a, b) => names.indexOf(a) - names.indexOf(b)));
    await assert.rejects(list({ nomeInventado: 1 } as any), /Campo desconhecido/);
    await assert.rejects(db.user.findMany({ where: { email: { fazAlgo: 1 } } }), /Operador desconhecido/);
  });
});

test('nomes de campo nunca viram SQL: injeção por chave é recusada e por valor é inofensiva', async () => {
  await withDb(async (db) => {
    await db.user.create({ data: { email: 'a@x.invalid', name: 'A', passwordHash: 'x' } });
    await assert.rejects(db.user.findMany({ where: { 'email" OR 1=1 --': 'x' } as any }), /Campo desconhecido/);
    await assert.rejects(db.user.findMany({ orderBy: { 'name; DROP TABLE "User"': 'asc' } as any }), /Campo desconhecido/);
    assert.equal((await db.user.findMany({ where: { email: "x' OR '1'='1" } })).length, 0);
    assert.equal(await db.user.count(), 1);
  });
});

test('relações: include/select aninhados, some/none/every e is/isNot', async () => {
  await withDb(async (db) => {
    const a = await db.user.create({ data: { email: 'a@x.invalid', name: 'Ana', passwordHash: 'x' } });
    const b = await db.user.create({ data: { email: 'b@x.invalid', name: 'Beto', passwordHash: 'x' } });
    const p1 = await db.project.create({ data: { slug: 'um.json', name: 'Um', ownerId: a.id, doc: { pages: [] } } });
    const p2 = await db.project.create({ data: { slug: 'dois.json', name: 'Dois', ownerId: a.id, doc: { pages: [] } } });
    await db.project.create({ data: { slug: 'tres.json', name: 'Três', ownerId: b.id, doc: { pages: [] } } });
    await db.projectMember.create({ data: { projectId: p1.id, userId: b.id, role: 'VIEWER' } });
    await db.note.create({ data: { projectId: p1.id, kind: 'COMMENT', body: 'oi', authorType: 'USER', userId: a.id } });

    const visibleToB = await db.project.findMany({ where: { OR: [{ ownerId: b.id }, { members: { some: { userId: b.id } } }] }, orderBy: { name: 'asc' }, select: { slug: true, name: true } });
    assert.deepEqual(visibleToB, [{ slug: 'tres.json', name: 'Três' }, { slug: 'um.json', name: 'Um' }]);
    assert.deepEqual((await db.project.findMany({ where: { members: { none: {} } }, orderBy: { name: 'asc' }, select: { name: true } })).map((p: any) => p.name), ['Dois', 'Três']);
    assert.deepEqual((await db.user.findMany({ where: { projects: { every: { name: { not: 'Dois' } } } }, select: { name: true }, orderBy: { name: 'asc' } })).map((u: any) => u.name), ['Beto']);
    assert.deepEqual((await db.note.findMany({ where: { user: { name: 'Ana' } }, select: { body: true } })).map((n: any) => n.body), ['oi']);
    assert.deepEqual((await db.note.findMany({ where: { user: { is: { name: 'Beto' } } } })).length, 0);
    assert.equal((await db.note.findMany({ where: { agent: null } })).length, 1);

    const full = await db.project.findUniqueOrThrow({
      where: { ownerId_slug: { ownerId: a.id, slug: 'um.json' } },
      include: { owner: { select: { name: true } }, members: { where: { userId: b.id }, include: { user: { select: { email: true } } } }, notes: true },
    });
    assert.equal(full.owner.name, 'Ana');
    assert.deepEqual(full.members.map((m: any) => ({ role: m.role, email: m.user.email })), [{ role: 'VIEWER', email: 'b@x.invalid' }]);
    assert.equal(full.notes.length, 1);
    assert.equal('ownerId' in (await db.project.findFirstOrThrow({ where: { id: p2.id }, select: { name: true, owner: { select: { name: true } } } })), false, 'select não devolve o que não pediu');
    assert.equal((await db.project.findFirstOrThrow({ where: { id: p2.id }, select: { name: true, owner: { select: { name: true } } } })).owner.name, 'Ana');
  });
});

test('escrita: create com padrões, update, upsert, updateMany, deleteMany, aggregate e contagem', async () => {
  await withDb(async (db) => {
    const u = await db.user.create({ data: { email: 'a@x.invalid', name: 'Ana', passwordHash: 'x' } });
    assert.equal(u.role, 'MEMBER');
    assert.deepEqual(u.preferences, {});
    assert.equal(u.suspended, false);
    assert.ok(u.createdAt instanceof Date);
    assert.match(u.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    await assert.rejects(db.user.create({ data: { email: 'a@x.invalid', name: 'Outra', passwordHash: 'x' } }), (e: any) => e.code === 'P2002');
    await assert.rejects(db.user.create({ data: { name: 'sem email', passwordHash: 'x' } }), /obrigatório/);
    await assert.rejects(db.user.update({ where: { id: 'nao-existe' }, data: { name: 'x' } }), (e: any) => e.code === 'P2025');
    assert.equal(await db.user.update({ where: { id: u.id }, data: { name: 'Ana Maria', preferences: { theme: 'dark' } } }).then((r: any) => r.preferences.theme), 'dark');

    const first = await db.session.upsert({ where: { tokenHash: 't1' }, create: { userId: u.id, tokenHash: 't1', expiresAt: new Date(Date.now() + 1000) }, update: {} });
    const again = await db.session.upsert({ where: { tokenHash: 't1' }, create: { userId: u.id, tokenHash: 't1', expiresAt: new Date() }, update: { expiresAt: new Date(2030, 0, 1) } });
    assert.equal(first.id, again.id);
    assert.equal(again.expiresAt.getFullYear(), 2030);
    assert.equal(await db.session.count(), 1);
    assert.equal((await db.session.findMany({ where: { expiresAt: { gt: new Date() } } })).length, 1);
    assert.equal((await db.session.findMany({ where: { expiresAt: { lt: new Date(2000, 0, 1) } } })).length, 0);

    for (let i = 0; i < 5; i++) await db.libraryAsset.create({ data: { userId: u.id, kind: 'IMAGE', name: `n${i}`, mime: 'image/png', size: 10 * (i + 1), hash: `h${i}` } });
    assert.deepEqual(await db.libraryAsset.aggregate({ where: { userId: u.id }, _sum: { size: true }, _count: true }), { _sum: { size: 150 }, _count: 5 });
    assert.deepEqual(await db.libraryAsset.aggregate({ where: { userId: 'ninguem' }, _sum: { size: true }, _count: true }), { _sum: { size: null }, _count: 0 });
    assert.equal((await db.libraryAsset.updateMany({ where: { size: { gte: 30 } }, data: { source: 'mudou' } })).count, 3);
    assert.equal(await db.libraryAsset.count({ where: { source: 'mudou' } }), 3);
    assert.equal((await db.libraryAsset.findMany({ orderBy: { size: 'desc' }, skip: 1, take: 2 })).map((a: any) => a.size).join(), '40,30');
    assert.equal((await db.libraryAsset.deleteMany({ where: { source: 'mudou' } })).count, 3);
    assert.equal(await db.libraryAsset.count(), 2);
    assert.equal((await db.libraryAsset.createMany({ data: [{ userId: u.id, kind: 'IMAGE', name: 'dup', mime: 'image/png', size: 1, hash: 'h0' }, { userId: u.id, kind: 'IMAGE', name: 'novo', mime: 'image/png', size: 1, hash: 'h9' }], skipDuplicates: true })).count, 1);
  });
});

test('tipos: bytes, JSON aninhado, listas, bigint autoincrement, booleanos e datas voltam como foram gravados', async () => {
  await withDb(async (db) => {
    const u = await db.user.create({ data: { email: 'a@x.invalid', name: 'Ana', passwordHash: 'x' } });
    const p = await db.project.create({ data: { slug: 'a.json', name: 'A', ownerId: u.id, doc: { a: [1, { b: 'ç' }], c: null } } });
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    await db.asset.create({ data: { projectId: p.id, hash: 'x', mime: 'application/octet-stream', size: 256, data: Buffer.from(bytes) } });
    const row = await db.asset.findFirstOrThrow({});
    assert.deepEqual(Array.from(row.data as Uint8Array), Array.from(bytes));
    assert.deepEqual((await db.project.findUniqueOrThrow({ where: { id: p.id } })).doc, { a: [1, { b: 'ç' }], c: null });
    const o1 = await db.operation.create({ data: { projectId: p.id, actorType: 'USER', tool: 't', layerIds: ['a', 'b'], summary: 's' } });
    const o2 = await db.operation.create({ data: { projectId: p.id, actorType: 'USER', tool: 't', ok: false } });
    assert.equal(typeof o1.id, 'bigint');
    assert.equal(o2.id, o1.id + 1n);
    assert.deepEqual(o1.layerIds, ['a', 'b']);
    assert.equal(o2.ok, false);
    assert.deepEqual(o2.layerIds, []);
    assert.deepEqual((await db.operation.findMany({ orderBy: { id: 'desc' } })).map((o: any) => o.id), [o2.id, o1.id]);
    const when = new Date('2024-02-29T23:59:59.123Z');
    const s = await db.session.create({ data: { userId: u.id, tokenHash: 'z', expiresAt: when } });
    assert.equal(s.expiresAt.toISOString(), when.toISOString());
    const before = (await db.project.findUniqueOrThrow({ where: { id: p.id } })).updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const after = (await db.project.update({ where: { id: p.id }, data: { name: 'B' } })).updatedAt;
    assert.ok(after > before, '@updatedAt acompanha cada update');
  });
});

test('ordem estável: mesma data, vale a ordem de inserção na direção pedida', async () => {
  await withDb(async (db) => {
    const u = await db.user.create({ data: { email: 'a@x.invalid', name: 'Ana', passwordHash: 'x' } });
    const same = new Date('2025-01-01T00:00:00Z');
    for (let i = 0; i < 4; i++) await db.session.create({ data: { userId: u.id, tokenHash: `t${i}`, createdAt: same, expiresAt: same } });
    assert.deepEqual((await db.session.findMany({ orderBy: { createdAt: 'asc' } })).map((s: any) => s.tokenHash), ['t0', 't1', 't2', 't3']);
    assert.deepEqual((await db.session.findMany({ orderBy: { createdAt: 'desc' } })).map((s: any) => s.tokenHash), ['t3', 't2', 't1', 't0']);
  });
});

test('cascata: apagar o projeto leva tudo dele; apagar agente/usuário preserva operações; dono com projeto não é apagado', async () => {
  await withDb(async (db) => {
    const owner = await db.user.create({ data: { email: 'o@x.invalid', name: 'Dono', passwordHash: 'x', role: 'OWNER' } });
    const other = await db.user.create({ data: { email: 'p@x.invalid', name: 'Outra', passwordHash: 'x' } });
    const agent = await db.agent.create({ data: { name: 'Bot', ownerId: owner.id, tokenHash: 'h', scopes: ['read'] } });
    const p = await db.project.create({ data: { slug: 'a.json', name: 'A', ownerId: owner.id, doc: {} } });
    await db.projectMember.create({ data: { projectId: p.id, userId: other.id } });
    await db.agentProject.create({ data: { agentId: agent.id, projectId: p.id } });
    await db.asset.create({ data: { projectId: p.id, hash: 'x', mime: 'a/b', size: 1, data: Buffer.from([1]) } });
    await db.projectVersion.create({ data: { projectId: p.id, revision: 1, doc: {} } });
    const parent = await db.note.create({ data: { projectId: p.id, kind: 'COMMENT', body: 'pai', authorType: 'AGENT', agentId: agent.id } });
    await db.note.create({ data: { projectId: p.id, kind: 'COMMENT', body: 'filha', authorType: 'USER', userId: other.id, parentId: parent.id } });
    const op = await db.operation.create({ data: { projectId: p.id, actorType: 'AGENT', agentId: agent.id, userId: null, tool: 't' } });

    await assert.rejects(db.user.delete({ where: { id: owner.id } }), (e: any) => e.code === 'P2003', 'dono com projeto: restrito');
    await db.agent.delete({ where: { id: agent.id } });
    assert.equal((await db.operation.findFirstOrThrow({ where: { id: op.id } })).agentId, null, 'SetNull');
    assert.equal((await db.note.findFirstOrThrow({ where: { id: parent.id } })).agentId, null);
    await db.note.delete({ where: { id: parent.id } });
    assert.equal(await db.note.count(), 0, 'respostas saem junto com a nota');
    await db.user.delete({ where: { id: other.id } });
    assert.equal(await db.projectMember.count(), 0);
    await db.project.delete({ where: { id: p.id } });
    for (const model of ['asset', 'projectVersion', 'operation', 'agentProject', 'note'] as const) assert.equal(await (db as any)[model].count(), 0, model);
    await db.user.delete({ where: { id: owner.id } });
    assert.equal(await db.user.count(), 0);
  });
});

test('transação: confirma tudo ou nada, e ninguém escreve no meio dela', async () => {
  await withDb(async (db) => {
    await assert.rejects(db.$transaction(async (tx) => {
      await tx.user.create({ data: { email: 'a@x.invalid', name: 'A', passwordHash: 'x' } });
      throw new Error('falhou no meio');
    }), /falhou no meio/);
    assert.equal(await db.user.count(), 0, 'rollback');

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const slow = db.$transaction(async (tx) => {
      await tx.user.create({ data: { email: 'b@x.invalid', name: 'B', passwordHash: 'x' } });
      await gate; // a transação fica aberta enquanto outras chamadas esperam
      return (await tx.user.count());
    });
    let outsideRan = false;
    const outside = db.user.create({ data: { email: 'c@x.invalid', name: 'C', passwordHash: 'x' } }).then(() => { outsideRan = true; });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(outsideRan, false, 'a escrita de fora espera a transação terminar');
    release();
    assert.equal(await slow, 1, 'dentro da transação só existe o que ela mesma criou');
    await outside;
    assert.equal(await db.user.count(), 2);
    // depois de um erro a fila continua funcionando
    await assert.rejects(db.user.create({ data: { email: 'b@x.invalid', name: 'dup', passwordHash: 'x' } }));
    assert.equal(await db.user.count(), 2);
  });
});

test('chamadas em paralelo não se atropelam (cada uma vê um estado consistente)', async () => {
  await withDb(async (db) => {
    const u = await db.user.create({ data: { email: 'a@x.invalid', name: 'A', passwordHash: 'x' } });
    const p = await db.project.create({ data: { slug: 'a.json', name: 'A', ownerId: u.id, doc: {}, revision: 1 } });
    // 20 gravações otimistas disputando a mesma revisão: só uma vence
    const results = await Promise.all(Array.from({ length: 20 }, () => db.project.updateMany({ where: { id: p.id, revision: 1 }, data: { revision: 2 } })));
    assert.equal(results.filter((r: any) => r.count === 1).length, 1);
  });
});
