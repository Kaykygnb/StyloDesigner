// Menus flutuantes: contexto (botão direito), arquivo, zoom e ajuda de atalhos.
import { h, ico } from './dom.js';
import { hasLayout } from '../model.js';

let openMenu = null;
export function closeMenus() {
  openMenu?.remove();
  openMenu = null;
}

/** items: [{ label, hint, icon, onClick, disabled, danger }] ou 'sep' */
export function showMenu(x, y, items, { anchorRight = false } = {}) {
  closeMenus();
  const menu = h('div.menu', { role: 'menu' },
    items.map((it) => {
      if (it === 'sep') return h('div.menu-sep');
      return h('button.menu-item' + (it.danger ? '.danger' : '') + (it.checked ? '.checked' : ''), {
        type: 'button', disabled: it.disabled,
        onclick: () => { closeMenus(); it.onClick?.(); },
      }, it.icon ? ico(it.icon, 15) : h('span.ico-pad'), h('span.menu-label', it.label), it.hint ? h('kbd', it.hint) : null,
      it.checked ? ico('check', 13) : null);
    }));
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  const left = anchorRight ? x - r.width : x;
  menu.style.left = `${Math.max(8, Math.min(left, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  openMenu = menu;
  setTimeout(() => {
    const off = (e) => {
      if (menu.contains(e.target)) return;
      closeMenus();
      window.removeEventListener('pointerdown', off, true);
    };
    window.addEventListener('pointerdown', off, true);
    window.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { closeMenus(); window.removeEventListener('keydown', esc); }
    });
  });
  return menu;
}

export function contextMenuItems({ store, commands, tools }) {
  const sel = store.selected();
  const n = sel[0];
  const has = sel.length > 0;
  const mod = /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl';
  return [
    { label: 'Copiar', hint: `${mod}+C`, icon: 'copy', disabled: !has, onClick: () => commands.copy() },
    { label: 'Colar', hint: `${mod}+V`, disabled: !store.ui.clipboard, onClick: () => commands.paste() },
    { label: 'Duplicar', hint: `${mod}+D`, disabled: !has, onClick: () => commands.duplicate() },
    { label: 'Copiar propriedades', hint: `${mod}+Alt+C`, disabled: !has, onClick: () => commands.copyStyle() },
    { label: 'Colar propriedades', hint: `${mod}+Alt+V`, disabled: !store.ui.styleClipboard || !has, onClick: () => commands.pasteStyle() },
    { label: 'Copiar CSS', hint: `${mod}+⇧+C`, icon: 'code', disabled: !has, onClick: () => tools.copyCss() },
    'sep',
    { label: 'Agrupar', hint: `${mod}+G`, icon: 'group', disabled: !has, onClick: () => commands.group() },
    { label: 'Desagrupar', hint: `${mod}+⇧+G`, disabled: !sel.some((s) => s.type === 'group'), onClick: () => commands.ungroup() },
    {
      label: n && hasLayout(n) ? 'Remover auto layout' : 'Adicionar auto layout', hint: '⇧+A', icon: 'row',
      disabled: !has, onClick: () => commands.toggleAutoLayout(),
    },
    { label: 'Envolver em frame', hint: `${mod}+Alt+G`, icon: 'frame', disabled: !has, onClick: () => commands.frameSelection() },
    { label: 'Criar componente', hint: `${mod}+Alt+K`, icon: 'component', disabled: !has, onClick: () => commands.createComponent() },
    { label: 'Desanexar instância', hint: `${mod}+Alt+B`, disabled: !sel.some((s) => s.instanceOf), onClick: () => commands.detach() },
    { label: 'Usar como máscara', hint: `${mod}+Alt+M`, disabled: !has, onClick: () => commands.toggleMask() },
    { label: 'Espelhar na horizontal', hint: '⇧+H', icon: 'flipH', disabled: !has, onClick: () => commands.flip('x') },
    { label: 'Espelhar na vertical', hint: '⇧+V', icon: 'flipV', disabled: !has, onClick: () => commands.flip('y') },
    'sep',
    { label: 'Trazer para frente', hint: `${mod}+⇧+]`, icon: 'front', disabled: !has, onClick: () => commands.reorder('front') },
    { label: 'Avançar', hint: `${mod}+]`, disabled: !has, onClick: () => commands.reorder('forward') },
    { label: 'Recuar', hint: `${mod}+[`, disabled: !has, onClick: () => commands.reorder('backward') },
    { label: 'Enviar para trás', hint: `${mod}+⇧+[`, icon: 'back', disabled: !has, onClick: () => commands.reorder('back') },
    'sep',
    { label: 'Renomear', hint: 'F2', disabled: sel.length !== 1, onClick: () => { store.ui.renamingId = n.id; store.emit('doc'); } },
    { label: n?.locked ? 'Destravar' : 'Travar', hint: `${mod}+⇧+L`, icon: 'lock', disabled: !has, onClick: () => tools.toggleProp('locked') },
    { label: n && !n.visible ? 'Mostrar' : 'Ocultar', hint: `${mod}+⇧+H`, icon: 'eyeOff', disabled: !has, onClick: () => tools.toggleProp('visible') },
    'sep',
    { label: 'Excluir', hint: '⌫', icon: 'trash', danger: true, disabled: !has, onClick: () => commands.deleteSelection() },
  ];
}

const SHORTCUTS = [
  ['Ferramentas', [['V', 'Mover'], ['F / B', 'Frame'], ['R', 'Retângulo'], ['E', 'Elipse'], ['L', 'Linha'], ['P', 'Caneta (vetor)'], ['T', 'Texto'], ['H', 'Mão (ou segure Espaço)']]],
  ['Edição', [['Ctrl Z / Ctrl ⇧ Z', 'Desfazer / Refazer'], ['Ctrl D', 'Duplicar'], ['Alt + arrastar', 'Duplicar arrastando'], ['Ctrl C / X / V', 'Copiar / Recortar / Colar'],
    ['Ctrl G / Ctrl ⇧ G', 'Agrupar / Desagrupar'], ['Ctrl Alt K / B', 'Criar componente / Desanexar'], ['Ctrl Alt M', 'Máscara'], ['⇧ H / ⇧ V', 'Espelhar'], ['0–9', 'Opacidade (1=10% … 0=100%)'], ['⇧ A', 'Auto layout (flexbox)'], ['Delete', 'Excluir'], ['Setas (⇧ = 10px)', 'Mover']]],
  ['Camadas', [['Ctrl ] / [', 'Avançar / Recuar'], ['Ctrl ⇧ ] / [', 'Frente / Fundo'], ['Ctrl ⇧ L', 'Travar'], ['Ctrl ⇧ H', 'Ocultar'], ['F2', 'Renomear'], ['Enter / ⇧ Enter', 'Entrar / sair do grupo']]],
  ['Vista', [['⇧ R', 'Réguas (arraste delas para criar guias)'], ['Ctrl + roda', 'Zoom'], ['Roda / ⇧ roda', 'Rolar'], ['Espaço + arrastar', 'Pan'], ['⇧ 1', 'Ajustar tudo'], ['⇧ 2', 'Ajustar seleção'], ['⇧ 0', 'Zoom 100%']]],
  ['Ao redimensionar / mover', [['⇧', 'Mantém proporção / trava eixo'], ['Alt', 'A partir do centro'], ['Ctrl', 'Sem snap']]],
  ['Seleção', [['Ctrl + clique', 'Seleciona através de grupos'], ['Tab / ⇧ Tab', 'Próxima / anterior camada'], ['Alt + mouse', 'Mostra distâncias até outra camada'], ['Ctrl Alt C / V', 'Copiar / colar propriedades'], ['Ctrl B / I / U', 'Negrito / itálico / sublinhado (editando texto)'], ['Ctrl \\', 'Esconder/mostrar painéis']]],
  ['Outros', [['Ctrl ⇧ C', 'Copiar CSS'], ['Ctrl S', 'Salvar projeto'], ['Ctrl V', 'Colar imagem ou texto do sistema']]],
];

export function showHelp() {
  closeMenus();
  const close = () => dlg.remove();
  const dlg = h('div.modal-backdrop', { onpointerdown: (e) => e.target === dlg && close() },
    h('div.modal',
      h('header.modal-head', h('h2', 'Atalhos de teclado'), h('button.icon-btn', { type: 'button', onclick: close }, ico('x'))),
      h('div.modal-body.shortcuts', SHORTCUTS.map(([title, rows]) =>
        h('section', h('h4', title), rows.map(([k, d]) => h('div.sc-row', h('span', d), h('kbd', k))))))));
  document.body.append(dlg);
  window.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); window.removeEventListener('keydown', esc); }
  });
}
