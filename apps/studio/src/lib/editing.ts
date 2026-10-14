// Ações de edição do dia a dia (botão direito e atalhos): copiar/colar, ordem, espelhar, envolver, máscara, componente,
// travar/ocultar, nota e comentário. Cada uma é uma chamada de ferramenta do MCP (arrange_layers, paste_layers, paste_style…).
import { tl } from './i18n';
import { canEdit } from './actions';
import * as api from './api';
import { app, run, select, toast } from './app';
import { getClip, getStyleSource, setClip, setStyleSource } from './clipboard';
import { findNode, flatten, isAncestor, pageOf, parentOf, topLevel } from './doc';
import { askText } from '../ui/Dialog';
import type { LayerNode } from './types';

const state = () => app.get();
const page = () => { const s = state(); return s.doc ? pageOf(s.doc, s.pageId) : null; };
const selectedTop = () => topLevel(page()?.children ?? [], state().selection);

// ---------------------------------------------------------------- copiar, colar, aparência
export function copySelection(cut = false): void {
  const ids = selectedTop();
  if (!ids.length) return;
  setClip({ ids, pageId: state().pageId, cut: cut && canEdit() });
  toast('ok', cut ? tl('editing.cutDone') : tl('editing.copied'));
}

export async function pasteClipboard(): Promise<void> {
  const clip = getClip();
  const p = page();
  if (!clip || !p || !canEdit()) return;
  const alive = clip.ids.filter((id) => findNode(p.children, id));
  if (!alive.length) { toast('error', tl('editing.copiedGone')); return; }
  // cola dentro do frame selecionado (se houver um e não for uma das copiadas)
  const sel = state().selection;
  const target = sel.length === 1 ? findNode(p.children, sel[0]) : null;
  const into = target && target.type === 'frame' && !alive.includes(target.id) && !alive.some((id) => isAncestor(p.children, id, target.id)) ? target : null;
  if (clip.cut) {
    if (!into) { toast('error', tl('editing.selectFrameToPaste')); return; }
    await run('move_layers', { moves: alive.map((id) => ({ id, parent_id: into.id })) }); // um único Ctrl+Z para o lote todo
    setClip(null);
    select(alive);
    return;
  }
  const out = await run<{ created?: string[] }>('paste_layers', { ids: alive, ...(into ? { parent_id: into.id } : {}) });
  if (out?.created?.length) select(out.created);
}

export function copyStyle(): void {
  const id = state().selection[0];
  if (!id) return;
  setStyleSource(id);
  toast('ok', tl('editing.propsCopied'));
}

export async function pasteStyle(): Promise<void> {
  const src = getStyleSource();
  const ids = selectedTop();
  if (!src || !ids.length || !canEdit()) return;
  if (!findNode(page()?.children ?? [], src)) { toast('error', tl('editing.sourceGone')); return; }
  await run('paste_style', { source_id: src, ids });
}

export async function copyCss(): Promise<void> {
  const ids = selectedTop();
  if (!ids.length) return;
  try {
    const parts: string[] = [];
    for (const id of ids.slice(0, 20)) parts.push((await api.tool<{ css: string }>('get_code', { id }, state().pageId ?? undefined)).css);
    await navigator.clipboard.writeText(parts.join('\n\n'));
    toast('ok', tl('editing.cssCopied'));
  } catch (e) { toast('error', e instanceof Error ? e.message : tl('editing.cssCopyFailed')); }
}

// ---------------------------------------------------------------- arranjo
export type ArrangeAction = 'front' | 'forward' | 'backward' | 'back' | 'flip_h' | 'flip_v' | 'wrap_in_frame' | 'toggle_auto_layout' | 'create_component' | 'detach_instance' | 'toggle_mask' | 'boolean_union' | 'boolean_subtract' | 'boolean_intersect' | 'boolean_exclude';

export async function arrange(action: ArrangeAction): Promise<void> {
  const ids = selectedTop();
  if (!ids.length || !canEdit()) return;
  const out = await run<{ selected?: string[] }>('arrange_layers', { ids, action });
  if (out?.selected?.length && ['wrap_in_frame', 'create_component', 'toggle_mask', 'boolean_union', 'boolean_subtract', 'boolean_intersect', 'boolean_exclude'].includes(action)) select(out.selected);
}

/** Trava/destrava ou mostra/oculta: se alguma camada ainda não está assim, todas ficam; senão todas voltam. */
export async function toggleFlag(flag: 'locked' | 'visible'): Promise<void> {
  const p = page();
  const ids = state().selection;
  if (!p || !ids.length || !canEdit()) return;
  const nodes = ids.map((id) => findNode(p.children, id)).filter((n): n is LayerNode => !!n);
  const on = flag === 'locked' ? nodes.some((n) => !n.locked) : nodes.some((n) => n.visible !== false);
  const value = flag === 'locked' ? on : !on;
  await run('update_layers', { updates: nodes.map((n) => ({ id: n.id, props: { [flag]: value } })) });
}

export const startRename = (id: string) => app.set({ renaming: id });

/** Abre o painel Comentários com um rascunho preso à camada (e ao ponto dado, ou ao canto superior direito). */
export function commentOn(id: string, at: { rx: number; ry: number } = { rx: 1, ry: 0 }): void {
  app.set({ commentDraft: { nodeId: id, ...at }, panel: 'comments', panelsHidden: false });
}

export async function noteOn(id: string): Promise<void> {
  const node = findNode(page()?.children ?? [], id);
  const text = await askText(node?.note ? tl('editing.editNote') : tl('editing.addNote'), String(node?.note ?? ''), { multiline: true, okLabel: tl('editing.keep'), message: tl('editing.noteHint') });
  if (text !== null) await run('update_layer', { id, props: { note: text.trim() } });
}

// ---------------------------------------------------------------- navegar pela seleção
/** Seleciona todas as camadas do mesmo nível da primeira selecionada (Ctrl+A). */
export function selectAllSiblings(): void {
  const p = page();
  if (!p) return;
  const first = state().selection[0];
  const parent = first ? parentOf(p.children, first) : null;
  const list = first ? (parent ? parent.children ?? [] : p.children) : p.children;
  select(list.filter((n) => n.visible !== false && !n.locked).map((n) => n.id));
}

/** Enter entra no grupo/frame (seleciona os filhos); Shift+Enter sobe para o pai. */
export function enterSelection(up: boolean): void {
  const p = page();
  const ids = state().selection;
  if (!p || !ids.length) return;
  if (up) {
    const parent = parentOf(p.children, ids[0]);
    if (parent) select([parent.id]);
    return;
  }
  const kids = ids.flatMap((id) => (findNode(p.children, id)?.children ?? []).filter((c) => c.visible !== false));
  if (kids.length) select(kids.map((k) => k.id));
}

/** Tab / Shift+Tab: próxima ou anterior camada irmã. */
export function stepSelection(back: boolean): void {
  const p = page();
  const first = state().selection[0];
  if (!p) return;
  const parent = first ? parentOf(p.children, first) : null;
  const list = (first ? (parent ? parent.children ?? [] : p.children) : p.children).filter((n) => n.visible !== false);
  if (!list.length) return;
  const i = list.findIndex((n) => n.id === first);
  select([list[(i + (back ? -1 : 1) + list.length) % list.length].id]);
}

/** Ir ao componente principal de uma instância. */
export function selectMainOf(id: string): void {
  const p = page();
  const node = p && findNode(p.children, id);
  const main = node?.instanceOf ? flatten(p!.children).find((n) => n.id === node.instanceOf) : null;
  if (main) select([main.id]); else toast('error', tl('editing.mainMissing'));
}
