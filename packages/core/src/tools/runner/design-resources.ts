/** Manutenção dos recursos do documento; leitura limitada e remoção explícita de vínculos. */
import { syncStyles, textStyleFrom } from '../../components.js';
import { bindVar, removeMode, setStyleColor } from '../../modes.js';
import { RESOURCE_KINDS, resourceChangesSchemas } from '../design-resources-schema.ts';
import type { ResourceKind } from '../design-resources-schema.ts';
import type { RunnerContext, ToolArgs, ToolHandlers } from './types.ts';
import { hex } from './properties.ts';
import { responseBytes, shortName } from './response-budget.ts';

const KEYS = { color: 'colors', text: 'texts', effect: 'effects', gradient: 'gradients', variable: 'vars', mode: 'modes' };
const copy = (value: any) => structuredClone(value);
const list = (doc: any, kind: ResourceKind): any[] => doc.styles?.[KEYS[kind]] || [];

/** Inclui fotos de componentes para a sincronização não ressuscitar vínculos removidos. */
function views(doc: any): any[] {
  const out: any[] = [];
  function visitView(view: any) {
    if (!view || typeof view !== 'object') return;
    out.push(view);
    for (const key of ['bps', 'states']) for (const variant of Object.values(view[key] || {})) visitView(variant);
  }
  function visitNode(node: any) {
    visitView(node);
    for (const baseline of Object.values(node.base || {})) visitView(baseline);
    for (const child of node.children || []) visitNode(child);
  }
  for (const page of doc.pages || []) for (const node of page.children || []) visitNode(node);
  return out;
}

function linked(view: any, kind: ResourceKind, id: string): number {
  if (kind === 'color') return Number(view.fill?.styleId === id);
  if (kind === 'gradient') return Number(view.fill?.gradientId === id);
  if (kind === 'text') return Number(view.textStyleId === id);
  if (kind === 'effect') return Number(view.effectStyleId === id);
  if (kind === 'variable') return Object.values(view.vars || {}).filter(value => value === id).length;
  return 0;
}
function references(doc: any, kind: ResourceKind, id: string, all = views(doc)): number {
  return kind === 'mode' ? list(doc, 'color').filter(style => Object.hasOwn(style.modes || {}, id)).length : all.reduce((sum, view) => sum + linked(view, kind, id), 0);
}
function find(doc: any, kind: ResourceKind, id: string) {
  if (!RESOURCE_KINDS.includes(kind)) throw new Error('kind: use color, text, effect, gradient, variable ou mode.');
  const resource = list(doc, kind).find(item => item.id === id);
  if (!resource) throw new Error(kind === 'mode' && ['default', 'base', ''].includes(id) ? 'O modo padrão é implícito e não pode ser alterado ou removido por ID. Use kind:"color" para mudar suas cores.' : `Recurso ${kind} "${id}" não existe. Use list_design_resources para localizar o ID.`);
  return resource;
}
function summary(kind: ResourceKind, item: any, refs: number) {
  const out: ToolArgs = { kind, id: item.id, name: shortName(item.name, 80), references: refs };
  if (kind === 'color') Object.assign(out, { color: item.color, opacity: item.opacity, modeValues: Object.keys(item.modes || {}).length });
  if (kind === 'text') { Object.assign(out, textStyleFrom(item)); if (out.fontFamily) out.fontFamily = shortName(out.fontFamily, 200); }
  if (kind === 'effect') out.shadows = (item.shadows || []).length;
  if (kind === 'gradient') Object.assign(out, { type: item.type, angle: item.angle, stops: (item.stops || []).length });
  if (kind === 'variable') out.value = item.value;
  if (kind === 'mode') out.scheme = item.scheme ?? null;
  return out;
}

/** Confere antes da permissão; a execução confere de novo contra o documento atual. */
export function prepareDesignResourceUpdate(ctx: RunnerContext, args: ToolArgs, action: 'update' | 'delete') {
  const { kind, id } = args as { kind: ResourceKind; id: string };
  const doc = ctx.store.state.doc;
  const resource = find(doc, kind, id);
  if (action === 'delete') {
    const count = references(doc, kind, id);
    if (count && !args.detach) throw new Error(`O recurso tem ${count} vínculo(s). Use detach:true para removê-lo desligando os vínculos e mantendo os valores padrão/locais; cores perdem variações por modo.`);
    return { kind, resource, count, changes: {} as ToolArgs };
  }
  const parsed = resourceChangesSchemas[kind].safeParse(args.changes);
  if (!parsed.success) throw new Error(`changes inválido para ${kind}: ${parsed.error.issues.map(issue => `${issue.path.join('.') || 'changes'}: ${issue.message}`).join('; ')}`);
  const changes: ToolArgs = parsed.data;
  if (!Object.keys(changes).length) throw new Error('changes precisa conter pelo menos um campo do recurso.');
  if (changes.name && list(doc, kind).some(item => item.id !== id && String(item.name).trim().toLocaleLowerCase() === changes.name.toLocaleLowerCase())) throw new Error(`Já existe um recurso ${kind} chamado "${changes.name}". Escolha outro nome.`);
  if (kind === 'color' && changes.mode_id) {
    find(doc, 'mode', changes.mode_id);
    if (changes.color === undefined && changes.opacity === undefined) throw new Error('Com mode_id, mande color ou opacity para alterar o valor daquele modo.');
  }
  return { kind, resource, count: references(doc, kind, id), changes };
}

function propagate(view: any, kind: ResourceKind, resource: any) {
  if (!linked(view, kind, resource.id)) return;
  if (kind === 'color' && view.fill.type === 'solid') Object.assign(view.fill, { color: resource.color, opacity: resource.opacity });
  if (kind === 'gradient' && ['linear', 'radial', 'conic'].includes(view.fill.type)) Object.assign(view.fill, { type: resource.type, angle: resource.angle, stops: copy(resource.stops) });
  if (kind === 'text') Object.assign(view, textStyleFrom(resource));
  if (kind === 'effect') view.shadows = copy(resource.shadows || []);
  if (kind === 'variable') for (const [prop, id] of Object.entries(view.vars || {})) if (id === resource.id) bindVar(view, prop, resource);
}
function detach(view: any, kind: ResourceKind, id: string) {
  if (kind === 'color' && view.fill?.styleId === id) delete view.fill.styleId;
  if (kind === 'gradient' && view.fill?.gradientId === id) delete view.fill.gradientId;
  if (kind === 'text' && view.textStyleId === id) delete view.textStyleId;
  if (kind === 'effect' && view.effectStyleId === id) delete view.effectStyleId;
  if (kind === 'variable' && view.vars) {
    for (const [prop, target] of Object.entries(view.vars)) if (target === id) delete view.vars[prop];
    if (!Object.keys(view.vars).length) delete view.vars;
  }
}

export function createDesignResourceTools(ctx: RunnerContext): ToolHandlers {
  const { store } = ctx;
  return {
    list_design_resources({ kind, query = '', limit = 20, offset = 0, maxBytes = 8192 }) {
      const doc = store.state.doc, all = views(doc);
      const q = String(query).trim().toLocaleLowerCase();
      const entries = (kind ? [kind] : RESOURCE_KINDS).flatMap((k: ResourceKind) => list(doc, k).map(item => ({ kind: k, item }))).filter(({ item }) => !q || `${item.id} ${item.name}`.toLocaleLowerCase().includes(q));
      const resources = entries.slice(offset, offset + limit).map(({ kind, item }) => summary(kind, item, references(doc, kind, item.id, all)));
      const requestedCount = resources.length;
      const out: ToolArgs = { count: resources.length, total: entries.length, offset, nextOffset: offset + resources.length < entries.length ? offset + resources.length : null, hasMore: offset + resources.length < entries.length, resources };
      while (responseBytes(out) > maxBytes && out.resources.length) {
        out.resources.pop(); out.count = out.resources.length;
        out.hasMore = offset + out.count < out.total; out.nextOffset = out.hasMore ? offset + out.count : null;
      }
      if (responseBytes(out) > maxBytes || (!out.count && requestedCount)) throw new Error('Um recurso não cabe no limite de resposta. Aumente maxBytes até 65536.');
      return out;
    },
    update_design_resource(args) {
      const { kind, resource, changes } = prepareDesignResourceUpdate(ctx, args, 'update');
      store.update(() => {
        if (kind === 'color') {
          if (changes.name !== undefined) resource.name = changes.name;
          if (changes.color !== undefined || changes.opacity !== undefined) {
            const current = changes.mode_id ? resource.modes?.[changes.mode_id] || resource : resource;
            setStyleColor(resource, changes.mode_id || null, changes.color === undefined ? current.color : hex(changes.color), changes.opacity);
          }
        } else {
          Object.assign(resource, copy(changes));
          if (kind === 'effect' && changes.shadows) resource.shadows = changes.shadows.map((s: any) => ({ x: 0, y: 4, blur: 16, spread: 0, opacity: 0.25, inset: false, ...s, color: hex(s.color || '#000000') }));
          if (kind === 'gradient' && changes.stops) resource.stops = changes.stops.map((s: any, i: number) => ({ color: hex(s.color), opacity: s.opacity ?? 1, pos: s.pos ?? Math.round(i / (changes.stops.length - 1) * 100) }));
        }
        const changesValue = Object.keys(changes).some(key => !['name', 'mode_id'].includes(key));
        if (changesValue && !(kind === 'color' && changes.mode_id)) for (const view of views(store.state.doc)) propagate(view, kind, resource);
        syncStyles(store.state.doc);
      });
      return { updated: summary(kind, resource, references(store.state.doc, kind, resource.id)), ...(changes.name && store.state.doc.styles.pageCss ? { note: 'CSS escrito à mão não foi reescrito; confira referências a variáveis/modos em get_project_css.' } : {}) };
    },
    delete_design_resource(args) {
      const { kind, resource, count } = prepareDesignResourceUpdate(ctx, args, 'delete');
      store.update(() => {
        // Mantém literais das sobrescritas e fotos; não os substitui por valores globais.
        for (const view of views(store.state.doc)) detach(view, kind, resource.id);
        if (kind === 'mode') removeMode(store.state.doc.styles, resource.id);
        else {
          const values = list(store.state.doc, kind);
          values.splice(values.indexOf(resource), 1);
        }
      });
      return { deleted: { kind, id: resource.id, name: shortName(resource.name, 80) }, detached: count, ...(store.state.doc.styles.pageCss ? { note: 'CSS escrito à mão não foi reescrito; confira referências a variáveis/modos em get_project_css.' } : {}), ...(kind === 'color' && Object.keys(resource.modes || {}).length ? { note: 'Valores padrão/locais mantidos; variações da cor por modo deixaram de existir. CSS escrito à mão não foi reescrito.' } : {}) };
    },
  };
}
