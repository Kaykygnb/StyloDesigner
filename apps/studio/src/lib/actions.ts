// As ações do editor: cada uma é UMA ferramenta do MCP (ou um pequeno conjunto), nunca uma alteração direta do documento.
import { app, run, select, toast } from './app';
import { findNode, pageOf, parentOf } from './doc';
import type { LayerNode } from './types';

const state = () => app.get();
const page = () => { const s = state(); return s.doc ? pageOf(s.doc, s.pageId) : null; };

/** Camadas que o painel pode mudar: pessoas com papel de leitura só olham. */
export const canEdit = () => state().role !== 'VIEWER';

export type InsertKind = 'frame' | 'text' | 'rect' | 'ellipse' | 'line' | 'screen';

const DEFAULTS: Record<Exclude<InsertKind, 'screen'>, Record<string, unknown>> = {
  frame: { name: 'Caixa', w: 320, h: 200, fill: '#FFFFFF', radius: 12 },
  text: { name: 'Texto', text: 'Texto', fontSize: 24, fill: '#111111' },
  rect: { name: 'Retângulo', w: 160, h: 100, fill: '#D9D9D9' },
  ellipse: { name: 'Elipse', w: 120, h: 120, fill: '#D9D9D9' },
  line: { name: 'Linha', w: 160, h: 2 },
};

const isContainer = (n: LayerNode) => n.type === 'frame' || n.type === 'group';

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
      tree: { type: 'frame', props: { name: `Tela ${n}`, w: 1440, h: 900, fill: '#FFFFFF' } },
    });
    if (out?.created?.id) select([out.created.id]);
    return;
  }
  const parent = insertionParent();
  const props: Record<string, unknown> = { ...DEFAULTS[kind] };
  const free = !parent || (parent.layout?.mode ?? 'none') === 'none';
  if (free) { props.x = parent ? 40 : 80; props.y = parent ? 40 : 80; }
  const out = await run<{ created?: { id: string } }>('create_layer', { type: kind, ...(parent ? { parent_id: parent.id } : {}), props });
  if (out?.created?.id) select([out.created.id]);
}

/** Muda propriedades das camadas. Em tablet/celular a mudança vale só naquele breakpoint (set_responsive). */
export async function setProps(ids: string[], props: Record<string, unknown>): Promise<void> {
  if (!ids.length || !canEdit()) return;
  const { device } = state();
  if (device !== 'desktop') {
    for (const id of ids) await run('set_responsive', { id, breakpoint: device, props });
    return;
  }
  if (ids.length === 1) await run('update_layer', { id: ids[0], props });
  else await run('update_layers', { updates: ids.map((id) => ({ id, props })) });
}

export const rename = (id: string, name: string) => run('update_layer', { id, props: { name: name.trim() || 'Camada' } });

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
  if (ids.length < 2 || !canEdit()) { toast('error', 'Selecione pelo menos duas camadas para agrupar.'); return; }
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
  const name = `Página ${(s.doc?.pages.length ?? 0) + 1}`;
  await run('create_page', { name });
  const doc = state().doc;
  const created = doc?.pages.find((p) => p.name === name);
  if (created) app.set({ pageId: created.id, selection: [] });
}

export async function removePage(id: string): Promise<void> {
  await run('delete_page', { id });
  const doc = state().doc;
  if (doc && !doc.pages.some((p) => p.id === state().pageId)) app.set({ pageId: doc.pages[0].id, selection: [] });
}

export const renamePage = (id: string, name: string) => run('rename_page', { id, name: name.trim() || 'Página' });

/** Envia uma imagem do computador para o projeto e a coloca na tela. */
export async function uploadImage(file: File): Promise<void> {
  if (!canEdit()) return;
  if (file.size > 16 * 1024 * 1024) { toast('error', 'A imagem passa de 16 MB: use uma menor.'); return; }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    reader.readAsDataURL(file);
  });
  const parent = insertionParent();
  const out = await run<{ created?: { id: string } }>('add_asset', { name: file.name.replace(/\.[^.]+$/, ''), data_url: dataUrl, insert: true, ...(parent ? { parent_id: parent.id } : {}) });
  if (out?.created?.id) select([out.created.id]);
}
