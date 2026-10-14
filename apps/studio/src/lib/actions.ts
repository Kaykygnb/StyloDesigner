// As ações do editor: cada uma é UMA ferramenta do MCP (ou um pequeno conjunto), nunca uma alteração direta do documento.
import { tl } from './i18n';
import { app, run, select, toast } from './app';
import { findNode, pageOf, parentOf } from './doc';
import { shapePoints } from './shapes';
import type { LayerNode } from './types';

const state = () => app.get();
const page = () => { const s = state(); return s.doc ? pageOf(s.doc, s.pageId) : null; };

/** Camadas que o painel pode mudar: pessoas com papel de leitura só olham. */
export const canEdit = () => state().role !== 'VIEWER';

export type InsertKind = 'frame' | 'section' | 'text' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'html' | 'screen';

const DEFAULTS: Record<Exclude<InsertKind, 'screen'>, Record<string, unknown>> = {
  frame: { w: 320, h: 200, fill: '#FFFFFF', radius: 12 },
  text: { fontSize: 24, fill: '#111111' },
  rect: { w: 160, h: 100, fill: '#D9D9D9' },
  ellipse: { w: 120, h: 120, fill: '#D9D9D9' },
  line: { w: 160, h: 2 },
  section: { w: 800, h: 600 },
  polygon: { w: 120, h: 120, fill: '#D9D9D9' },
  star: { w: 120, h: 120, fill: '#D9D9D9' },
  html: { w: 320, h: 160 },
};

const isContainer = (n: LayerNode) => n.type === 'frame' || n.type === 'group' || n.type === 'section';

/** Onde uma camada nova entra: dentro da caixa selecionada; ao lado de uma camada selecionada; ou na página. */
function insertionParent(): LayerNode | null {
  const s = state();
  const p = page();
  if (!p || s.selection.length !== 1) return null;
  const node = findNode(p.children, s.selection[0]);
  if (!node) return null;
  if (isContainer(node)) return node;
  const parent = parentOf(p.children, node.id);
  return parent && isContainer(parent) ? parent : null;
}

export async function insert(kind: InsertKind): Promise<void> {
  if (!canEdit()) return;
  if (kind === 'screen') {
    const n = (page()?.children.length ?? 0) + 1;
    const out = await run<{ created?: { id: string } }>('build_layout', {
      // layout livre: camadas soltas, posicionadas por X e Y (o layout automático é uma opção no painel de propriedades)
      tree: { type: 'frame', props: { name: tl('layerName.screen', { n }), w: 1440, h: 900, fill: '#FFFFFF' } },
    });
    if (out?.created?.id) select([out.created.id]);
    return;
  }
  // Seção é sempre uma organização da raiz; se o usuário estiver com uma tela
  // selecionada, nunca tente colocá-la dentro do frame (o servidor recusa isso).
  const parent = kind === 'section' ? null : insertionParent();
  const props: Record<string, unknown> = { name: tl(`layerName.${kind}`), ...(kind === 'text' ? { text: tl('layerName.text') } : {}), ...DEFAULTS[kind] };
  const free = !parent || (parent.layout?.mode ?? 'none') === 'none';
  if (free) { props.x = parent ? 40 : 80; props.y = parent ? 40 : 80; }
  const type = kind === 'polygon' || kind === 'star' ? 'path' : kind;
  if (kind === 'polygon' || kind === 'star') {
    const w = Number(props.w) || 120;
    const h = Number(props.h) || 120;
    Object.assign(props, { points: shapePoints(kind, w, h), closed: true, vw: w, vh: h, shape: { kind, sides: 5, innerRatio: kind === 'star' ? 0.45 : 1 } });
  }
  const out = await run<{ created?: { id: string } }>('create_layer', { type, ...(parent ? { parent_id: parent.id } : {}), props });
  if (out?.created?.id) select([out.created.id]);
}

/** Muda propriedades das camadas. Em tablet/celular a mudança vale só naquele breakpoint (set_responsive). */
export async function setProps(ids: string[], props: Record<string, unknown>): Promise<void> {
  if (!ids.length || !canEdit()) return;
  const { device, editState } = state();
  if (editState && device === 'desktop') {
    await run('set_state', { ids, state: editState, props }); // todas juntas: um único Ctrl+Z
    return;
  }
  if (device !== 'desktop') {
    await run('set_responsive', { ids, breakpoint: device, props });
    return;
  }
  if (ids.length === 1) await run('update_layer', { id: ids[0], props });
  else await run('update_layers', { updates: ids.map((id) => ({ id, props })) });
}

export const rename = (id: string, name: string) => run('update_layer', { id, props: { name: name.trim() || tl('ui.layers.defaultName') } });

export async function removeSelection(): Promise<void> {
  const ids = state().selection;
  if (!ids.length || !canEdit()) return;
  await run('delete_layers', { ids });
  select([]);
}

export async function duplicateSelection(): Promise<void> {
  const ids = state().selection;
  if (!ids.length || !canEdit()) return;
  const out = await run<{ created?: { id: string }[]; ids?: string[] }>('duplicate_layers', { ids });
  const created = out?.ids ?? out?.created?.map((c) => c.id);
  if (created?.length) select(created);
}

export async function groupSelection(): Promise<void> {
  const ids = state().selection;
  if (ids.length < 2 || !canEdit()) { toast('error', tl('msg.groupNeeds2')); return; }
  const out = await run<{ group?: { id: string }; created?: { id: string } }>('group_layers', { ids });
  const id = out?.group?.id ?? out?.created?.id;
  if (id) select([id]);
}

export async function ungroupSelection(): Promise<void> {
  const ids = state().selection;
  if (ids.length && canEdit()) { await run('ungroup_layers', { ids }); select([]); }
}

export const align = (alignment: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => run('align_layers', { ids: state().selection, alignment });
export const distribute = (axis: 'h' | 'v') => run('distribute_layers', { ids: state().selection, axis });
export const undo = () => run('undo');
export const redo = () => run('redo');
export const reorder = (id: string, index: number) => run('reorder_layer', { id, index });

export async function addPage(): Promise<void> {
  const s = state();
  const name = tl('layerName.page', { n: (s.doc?.pages.length ?? 0) + 1 });
  const before = new Set((s.doc?.pages ?? []).map((p) => p.id));
  await run('create_page', { name });
  const doc = state().doc;
  const created = doc?.pages.find((p) => !before.has(p.id)); // pelo id: o nome pode já existir em outra página
  if (created) app.set({ pageId: created.id, selection: [] });
}

export async function removePage(id: string): Promise<void> {
  await run('delete_page', { id });
  const doc = state().doc;
  if (doc && !doc.pages.some((p) => p.id === state().pageId)) app.set({ pageId: doc.pages[0].id, selection: [] });
}

export const renamePage = (id: string, name: string) => run('rename_page', { id, name: name.trim() || tl('layerName.pageDefault') });

/** Envia uma imagem do computador para o projeto e a coloca na tela. */
export async function uploadImage(file: File): Promise<void> {
  if (!canEdit()) return;
  if (file.size > 16 * 1024 * 1024) { toast('error', tl('msg.imageTooBig')); return; }
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '')) {
    try {
      const svg = await file.text();
      const parent = insertionParent();
      const out = await run<{ created?: { id: string }; ignored?: string[] }>('import_svg', {
        svg,
        name: file.name.replace(/\.svg$/i, '') || tl('layerName.svg'),
        ...(parent ? { parent_id: parent.id } : {}),
      });
      if (out?.created?.id) select([out.created.id]);
      if (out?.ignored?.length) toast('ok', tl('msg.svgImportedIgnored', { list: out.ignored.join(', ') }));
      return;
    } catch (error) { toast('error', tl('msg.svgImportFailed', { error: error instanceof Error ? error.message : String(error) })); return; }
  }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(tl('msg.readFailed')));
    reader.readAsDataURL(file);
  });
  const parent = insertionParent();
  const out = await run<{ created?: { id: string } }>('add_asset', { name: file.name.replace(/\.[^.]+$/, ''), data_url: dataUrl, insert: true, ...(parent ? { parent_id: parent.id } : {}) });
  if (out?.created?.id) select([out.created.id]);
}
