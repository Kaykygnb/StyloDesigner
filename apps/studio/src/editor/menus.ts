// Os itens do menu de botão direito, calculados para a seleção atual (o que não se aplica fica desabilitado) — os mesmos do editor antigo.
import { tl } from '../lib/i18n';
import { canEdit, duplicateSelection, groupSelection, insert, removeSelection, ungroupSelection } from '../lib/actions';
import { getClip, getStyleSource } from '../lib/clipboard';
import { arrange, commentOn, copyCss, copySelection, copyStyle, noteOn, pasteClipboard, pasteStyle, selectAllSiblings, selectMainOf, startRename, toggleFlag } from '../lib/editing';
import { app, select } from '../lib/app';
import { findNode, pageOf } from '../lib/doc';
import type { LayerNode } from '../lib/types';
import type { MenuItem } from '../ui/ContextMenu';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
export const MOD = MAC ? '⌘' : 'Ctrl';

export function layerMenuItems(): MenuItem[] {
  const s = app.get();
  const page = s.doc ? pageOf(s.doc, s.pageId) : null;
  const sel = s.selection.map((id) => (page ? findNode(page.children, id) : null)).filter((n): n is LayerNode => !!n);
  const n = sel[0];
  const has = sel.length > 0;
  const edit = canEdit() && has;
  const hasLayout = !!n && n.type === 'frame' && (n.layout?.mode ?? 'none') !== 'none';
  return [
    { label: tl('menu.copy'), hint: `${MOD}+C`, icon: 'copy', disabled: !has, onClick: () => copySelection() },
    { label: tl('menu.cut'), hint: `${MOD}+X`, icon: 'cut', disabled: !edit, onClick: () => copySelection(true) },
    { label: tl('menu.paste'), hint: `${MOD}+V`, icon: 'paste', disabled: !getClip() || !canEdit(), onClick: () => void pasteClipboard() },
    { label: tl('menu.duplicate'), hint: `${MOD}+D`, icon: 'duplicate', disabled: !edit, onClick: () => void duplicateSelection() },
    { label: tl('menu.copyProps'), hint: `${MOD}+Alt+C`, disabled: !has, onClick: () => copyStyle() },
    { label: tl('menu.pasteProps'), hint: `${MOD}+Alt+V`, disabled: !getStyleSource() || !edit, onClick: () => void pasteStyle() },
    { label: tl('menu.copyCss'), hint: `${MOD}+⇧+C`, icon: 'code', disabled: !has, onClick: () => void copyCss() },
    { label: tl('menu.comment'), hint: 'C', icon: 'comment', disabled: sel.length !== 1, onClick: () => commentOn(n.id) },
    { label: n?.note ? tl('menu.editNote') : tl('menu.addNote'), icon: 'note', disabled: sel.length !== 1 || !canEdit(), onClick: () => void noteOn(n.id) },
    'sep',
    { label: tl('menu.group'), hint: `${MOD}+G`, icon: 'group', disabled: sel.length < 2 || !canEdit(), onClick: () => void groupSelection() },
    { label: tl('menu.ungroup'), hint: `${MOD}+⇧+G`, disabled: !edit || !sel.some((x) => x.type === 'group' || x.type === 'section'), onClick: () => void ungroupSelection() },
    { label: hasLayout ? tl('menu.removeAutoLayout') : tl('menu.addAutoLayout'), hint: '⇧+A', icon: 'autolayout', disabled: !edit, onClick: () => void arrange('toggle_auto_layout') },
    { label: tl('menu.wrapFrame'), hint: `${MOD}+Alt+G`, icon: 'frame', disabled: !edit, onClick: () => void arrange('wrap_in_frame') },
    { label: tl('menu.createComponent'), hint: `${MOD}+Alt+K`, icon: 'component', disabled: !edit, onClick: () => void arrange('create_component') },
    { label: tl('menu.detach'), hint: `${MOD}+Alt+B`, disabled: !edit || !sel.some((x) => x.instanceOf), onClick: () => void arrange('detach_instance') },
    ...(n?.instanceOf ? [{ label: tl('menu.goMain'), onClick: () => selectMainOf(n.id) } as MenuItem] : []),
    { label: tl('menu.useMask'), hint: `${MOD}+Alt+M`, icon: 'mask', disabled: !edit, onClick: () => void arrange('toggle_mask') },
    { label: tl('menu.flipH'), hint: '⇧+H', icon: 'flipH', disabled: !edit, onClick: () => void arrange('flip_h') },
    { label: tl('menu.flipV'), hint: '⇧+V', icon: 'flipV', disabled: !edit, onClick: () => void arrange('flip_v') },
    'sep',
    { label: tl('menu.front'), hint: `${MOD}+⇧+]`, icon: 'front', disabled: !edit, onClick: () => void arrange('front') },
    { label: tl('menu.forward'), hint: `${MOD}+]`, disabled: !edit, onClick: () => void arrange('forward') },
    { label: tl('menu.backward'), hint: `${MOD}+[`, disabled: !edit, onClick: () => void arrange('backward') },
    { label: tl('menu.back'), hint: `${MOD}+⇧+[`, icon: 'back', disabled: !edit, onClick: () => void arrange('back') },
    'sep',
    { label: tl('menu.rename'), hint: 'F2', disabled: sel.length !== 1 || !canEdit(), onClick: () => startRename(n.id) },
    { label: n?.locked ? tl('menu.unlock') : tl('menu.lock'), hint: `${MOD}+⇧+L`, icon: 'lock', disabled: !edit, onClick: () => void toggleFlag('locked') },
    { label: n && n.visible === false ? tl('menu.show') : tl('menu.hide'), hint: `${MOD}+⇧+H`, icon: 'eyeoff', disabled: !edit, onClick: () => void toggleFlag('visible') },
    'sep',
    { label: tl('menu.delete'), hint: '⌫', icon: 'trash', danger: true, disabled: !edit, onClick: () => void removeSelection() },
  ];
}

/** Menu do vazio do canvas: sem camada sob o ponteiro. */
export function canvasMenuItems(): MenuItem[] {
  return [
    { label: tl('menu.paste'), hint: `${MOD}+V`, icon: 'paste', disabled: !getClip() || !canEdit(), onClick: () => void pasteClipboard() },
    { label: tl('menu.selectAll'), hint: `${MOD}+A`, onClick: () => selectAllSiblings() },
    'sep',
    { label: tl('menu.newScreen'), icon: 'monitor', disabled: !canEdit(), onClick: () => void insert('screen') },
    { label: tl('menu.fit'), hint: '⇧+1', icon: 'fit', onClick: () => window.dispatchEvent(new Event('stylo:fit')) },
    { label: tl('menu.deselect'), hint: 'Esc', disabled: !app.get().selection.length, onClick: () => select([]) },
  ];
}
