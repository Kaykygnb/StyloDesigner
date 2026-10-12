// Os itens do menu de botão direito, calculados para a seleção atual (o que não se aplica fica desabilitado) — os mesmos do editor antigo.
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
    { label: 'Copiar', hint: `${MOD}+C`, icon: 'copy', disabled: !has, onClick: () => copySelection() },
    { label: 'Recortar', hint: `${MOD}+X`, icon: 'cut', disabled: !edit, onClick: () => copySelection(true) },
    { label: 'Colar', hint: `${MOD}+V`, icon: 'paste', disabled: !getClip() || !canEdit(), onClick: () => void pasteClipboard() },
    { label: 'Duplicar', hint: `${MOD}+D`, icon: 'duplicate', disabled: !edit, onClick: () => void duplicateSelection() },
    { label: 'Copiar propriedades', hint: `${MOD}+Alt+C`, disabled: !has, onClick: () => copyStyle() },
    { label: 'Colar propriedades', hint: `${MOD}+Alt+V`, disabled: !getStyleSource() || !edit, onClick: () => void pasteStyle() },
    { label: 'Copiar CSS', hint: `${MOD}+⇧+C`, icon: 'code', disabled: !has, onClick: () => void copyCss() },
    { label: 'Comentar', hint: 'C', icon: 'comment', disabled: sel.length !== 1, onClick: () => void commentOn(n.id) },
    { label: n?.note ? 'Editar nota' : 'Adicionar nota', icon: 'note', disabled: sel.length !== 1 || !canEdit(), onClick: () => void noteOn(n.id) },
    'sep',
    { label: 'Agrupar', hint: `${MOD}+G`, icon: 'group', disabled: sel.length < 2 || !canEdit(), onClick: () => void groupSelection() },
    { label: 'Desagrupar', hint: `${MOD}+⇧+G`, disabled: !edit || !sel.some((x) => x.type === 'group' || x.type === 'section'), onClick: () => void ungroupSelection() },
    { label: hasLayout ? 'Remover auto layout' : 'Adicionar auto layout', hint: '⇧+A', icon: 'autolayout', disabled: !edit, onClick: () => void arrange('toggle_auto_layout') },
    { label: 'Envolver em frame', hint: `${MOD}+Alt+G`, icon: 'frame', disabled: !edit, onClick: () => void arrange('wrap_in_frame') },
    { label: 'Criar componente', hint: `${MOD}+Alt+K`, icon: 'component', disabled: !edit, onClick: () => void arrange('create_component') },
    { label: 'Desanexar instância', hint: `${MOD}+Alt+B`, disabled: !edit || !sel.some((x) => x.instanceOf), onClick: () => void arrange('detach_instance') },
    ...(n?.instanceOf ? [{ label: 'Ir ao componente principal', onClick: () => selectMainOf(n.id) } as MenuItem] : []),
    { label: 'Usar como máscara', hint: `${MOD}+Alt+M`, icon: 'mask', disabled: !edit, onClick: () => void arrange('toggle_mask') },
    { label: 'Espelhar na horizontal', hint: '⇧+H', icon: 'flipH', disabled: !edit, onClick: () => void arrange('flip_h') },
    { label: 'Espelhar na vertical', hint: '⇧+V', icon: 'flipV', disabled: !edit, onClick: () => void arrange('flip_v') },
    'sep',
    { label: 'Trazer para frente', hint: `${MOD}+⇧+]`, icon: 'front', disabled: !edit, onClick: () => void arrange('front') },
    { label: 'Avançar', hint: `${MOD}+]`, disabled: !edit, onClick: () => void arrange('forward') },
    { label: 'Recuar', hint: `${MOD}+[`, disabled: !edit, onClick: () => void arrange('backward') },
    { label: 'Enviar para trás', hint: `${MOD}+⇧+[`, icon: 'back', disabled: !edit, onClick: () => void arrange('back') },
    'sep',
    { label: 'Renomear', hint: 'F2', disabled: sel.length !== 1 || !canEdit(), onClick: () => startRename(n.id) },
    { label: n?.locked ? 'Destravar' : 'Travar', hint: `${MOD}+⇧+L`, icon: 'lock', disabled: !edit, onClick: () => void toggleFlag('locked') },
    { label: n && n.visible === false ? 'Mostrar' : 'Ocultar', hint: `${MOD}+⇧+H`, icon: 'eyeoff', disabled: !edit, onClick: () => void toggleFlag('visible') },
    'sep',
    { label: 'Excluir', hint: '⌫', icon: 'trash', danger: true, disabled: !edit, onClick: () => void removeSelection() },
  ];
}

/** Menu do vazio do canvas: sem camada sob o ponteiro. */
export function canvasMenuItems(): MenuItem[] {
  return [
    { label: 'Colar', hint: `${MOD}+V`, icon: 'paste', disabled: !getClip() || !canEdit(), onClick: () => void pasteClipboard() },
    { label: 'Selecionar tudo', hint: `${MOD}+A`, onClick: () => selectAllSiblings() },
    'sep',
    { label: 'Nova tela', icon: 'monitor', disabled: !canEdit(), onClick: () => void insert('screen') },
    { label: 'Ajustar à tela', hint: '⇧+1', icon: 'fit', onClick: () => window.dispatchEvent(new Event('stylo:fit')) },
    { label: 'Tirar a seleção', hint: 'Esc', disabled: !app.get().selection.length, onClick: () => select([]) },
  ];
}
