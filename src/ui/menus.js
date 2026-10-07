/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/menus.js — MENUS FLUTUANTES, JANELAS MODAIS E AJUDA DE ATALHOS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { hasLayout } from '../model.js';

// menu aberto no momento (só um por vez)
let openMenu = null;
// elemento que tinha o foco antes de o menu abrir: ao fechar com Esc, o foco volta para ele (navegação por teclado)
let menuReturnFocus = null;
/** Fecha o menu aberto, se houver. */
export function closeMenus() {
  openMenu?.remove();
  openMenu = null;
}

/**
 * Mostra um menu flutuante em (x, y), mantendo-o dentro da janela. Fecha ao clicar fora ou apertar Esc.
 * @param {number} x
 * @param {number} y
 * @param {(object|'sep')[]} items  { label, hint (atalho), icon, onClick, disabled, danger, checked, heading } ou 'sep'
 *        (separador). `heading: true` = título de seção, só texto.
 * @param {{anchorRight?: boolean}} [opts]  true = o menu cresce para a ESQUERDA de x (menus ancorados na borda direita)
 */
export function showMenu(x, y, items, { anchorRight = false } = {}) {
  closeMenus();
  menuReturnFocus = document.activeElement;
  const menu = h('div.menu', { role: 'menu' },
    items.map((it) => {
      if (it === 'sep') return h('div.menu-sep', { role: 'separator' });
      // título de seção (ex.: "Recentes"): só texto, não é clicável nem recebe foco
      if (it.heading) return h('div.menu-heading', { role: 'presentation' }, it.label);
      return h('button.menu-item' + (it.danger ? '.danger' : '') + (it.checked ? '.checked' : ''), {
        type: 'button', disabled: it.disabled,
        role: it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem',
        'aria-checked': it.checked !== undefined ? String(!!it.checked) : null,
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
      if (e.key === 'Escape') { closeMenus(); window.removeEventListener('keydown', esc); menuReturnFocus?.focus?.(); }
    });
  });
  // TECLADO: ↑/↓ andam entre os itens habilitados, Home/End vão ao primeiro/último. O 1º item já recebe o foco,
  // então dá para abrir o menu com Enter/Espaço e escolher sem tocar no mouse.
  const enabled = () => [...menu.querySelectorAll('.menu-item:not(:disabled)')];
  menu.addEventListener('keydown', (e) => {
    const list = enabled();
    const i = list.indexOf(document.activeElement);
    // Esc aqui também (além do ouvinte da janela): o foco está no menu, então tratamos na hora, sem depender de timers
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenus();
      menuReturnFocus?.focus?.();
      return;
    }
    const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 }[e.key];
    if (go === undefined || !list.length) return;
    e.preventDefault();
    e.stopPropagation();
    list[(go + list.length) % list.length].focus();
  });
  enabled()[0]?.focus({ preventScroll: true });
  return menu;
}

/**
 * Itens do menu de botão direito, calculados para a seleção ATUAL (itens que não se aplicam ficam desabilitados).
 * Os mesmos comandos existem como atalhos; o hint mostra a tecla (⌘ no Mac, Ctrl nos demais).
 */
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

/** Texto da janela "Atalhos de teclado": [seção, [[tecla, descrição], ...]]. Mantenha em sincronia com tools.js e o README. */
const SHORTCUTS = [
  ['Ferramentas', [['V', 'Mover'], ['F / B', 'Frame'], ['⇧ S', 'Seção'], ['R', 'Retângulo'], ['E', 'Elipse'], ['L', 'Linha'], ['P', 'Caneta (vetor)'], ['T', 'Texto'], ['H', 'Mão (ou segure Espaço)']]],
  ['Edição', [['Ctrl Z / Ctrl ⇧ Z', 'Desfazer / Refazer'], ['Ctrl D', 'Duplicar'], ['Alt + arrastar', 'Duplicar arrastando'], ['Ctrl C / X / V', 'Copiar / Recortar / Colar'],
    ['Ctrl A', 'Selecionar tudo no mesmo nível'], ['Ctrl G / Ctrl ⇧ G', 'Agrupar / Desagrupar'], ['Ctrl Alt G', 'Envolver em frame'], ['Ctrl Alt K / B', 'Criar componente / Desanexar'], ['Ctrl Alt M', 'Máscara'], ['⇧ H / ⇧ V', 'Espelhar'], ['0–9', 'Opacidade (1=10% … 0=100%)'], ['⇧ A', 'Auto layout (flexbox)'], ['Delete', 'Excluir'], ['Setas (⇧ = 10px)', 'Mover']]],
  ['Camadas', [['Ctrl ] / [', 'Avançar / Recuar'], ['Ctrl ⇧ ] / [', 'Frente / Fundo'], ['Ctrl ⇧ L', 'Travar'], ['Ctrl ⇧ H', 'Ocultar'], ['F2', 'Renomear'], ['Enter / ⇧ Enter', 'Entrar / sair do grupo']]],
  ['Vista', [['⇧ R', 'Réguas (arraste delas para criar guias)'], ['Ctrl + roda', 'Zoom'], ['Ctrl + / − / 0', 'Aproximar / afastar / 100%'], ['Roda / ⇧ roda', 'Rolar'], ['Espaço + arrastar', 'Pan'], ['⇧ 1', 'Ajustar tudo'], ['⇧ 2', 'Ajustar seleção'], ['⇧ 0', 'Zoom 100%']]],
  ['Ao redimensionar / mover', [['⇧', 'Mantém proporção / trava eixo'], ['Alt', 'A partir do centro'], ['Ctrl', 'Sem snap']]],
  ['Seleção', [['Ctrl + clique', 'Seleciona através de grupos'], ['Tab / ⇧ Tab', 'Próxima / anterior camada'], ['Alt + mouse', 'Mostra distâncias até outra camada'], ['Ctrl Alt C / V', 'Copiar / colar propriedades'], ['Ctrl B / I / U', 'Negrito / itálico / sublinhado (editando texto)'], ['Ctrl \\', 'Esconder/mostrar painéis']]],
  ['Outros', [['Ctrl ⇧ C', 'Copiar CSS'], ['Ctrl S', 'Salvar na pasta (escolhe o nome na 1ª vez)'], ['Ctrl ⇧ S', 'Salvar como… (novo nome na pasta)'], ['Ctrl O', 'Abrir projeto da pasta'], ['Ctrl ,', 'Configurações (onde salvar, tema...)'], ['Ctrl Alt Enter', 'Apresentar o protótipo'], ['?', 'Esta lista de atalhos'], ['Ctrl V', 'Colar imagem ou texto do sistema']]],
];

/** Contador para dar um id único ao título de cada janela (aria-labelledby). */
let modalSeq = 0;

/**
 * JANELA MODAL acessível, usada pela ajuda, Configurações e Projetos:
 *  - role="dialog" + aria-modal + título ligado por aria-labelledby (leitores de tela anunciam o nome);
 *  - o foco vai para o primeiro campo/botão e fica PRESO dentro (Tab/Shift+Tab dão a volta);
 *  - fecha com Esc, no X ou clicando fora; ao fechar, o foco volta para quem abriu.
 * @param {object} o
 * @param {string} o.title        título (h2)
 * @param {Node|Node[]} o.body     conteúdo
 * @param {string} [o.cls]         classe extra para o .modal (ex.: 'narrow')
 * @param {() => void} [o.onClose]
 * @returns {{ el: HTMLElement, close: () => void }}
 */
export function openModal({ title, body, cls = '', onClose }) {
  closeMenus();
  const returnFocus = document.activeElement;
  const titleId = `modal-title-${++modalSeq}`;
  const close = () => {
    dlg.remove();
    window.removeEventListener('keydown', onKey, true);
    onClose?.();
    returnFocus?.focus?.();
  };
  const modal = h('div.modal' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('header.modal-head', h('h2', { id: titleId }, title), h('button.icon-btn', { type: 'button', title: 'Fechar (Esc)', 'aria-label': 'Fechar', onclick: () => close() }, ico('x'))),
    body);
  const dlg = h('div.modal-backdrop', { onpointerdown: (e) => e.target === dlg && close() }, modal);
  const focusables = () => [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.offsetParent !== null);
  // captura (true): o Esc da janela não chega aos atalhos do canvas; Tab dá a volta dentro da janela
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
  window.addEventListener('keydown', onKey, true);
  document.body.append(dlg);
  // foca o 1º campo de texto (se houver) ou o 1º botão depois do X
  const list = focusables();
  (list.find((el) => el.matches('input[type=text], input:not([type])')) || list[1] || list[0])?.focus();
  return { el: modal, close };
}

/**
 * PERGUNTA no visual do app (substitui o `confirm()` do navegador, que é cinza, feio e não dá para ter 3 botões).
 * Devolve uma Promise com o `value` do botão escolhido, ou null se a pessoa fechou (Esc, X, clique fora).
 *
 *   const r = await ask({ title: 'Substituir?', message: 'Texto...', buttons: [
 *     { label: 'Cancelar', value: null }, { label: 'Substituir', value: 'ok', primary: true } ] });
 *
 * O botão `primary` recebe o foco (Enter confirma); `danger` pinta de vermelho (ações que apagam algo).
 * @param {{title: string, message: string|Node|Node[], buttons: {label: string, value: any, primary?: boolean, danger?: boolean}[]}} o
 * @returns {Promise<any>}
 */
export function ask({ title, message, buttons }) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => { if (answered) return; answered = true; resolve(v); };
    const btns = buttons.map((b) => h('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : ''), {
      type: 'button', onclick: () => { done(b.value); modal.close(); },
    }, b.label));
    const body = h('div.modal-body.ask',
      (Array.isArray(message) ? message : [message]).map((m) => (typeof m === 'string' ? h('p', m) : m)),
      h('div.ask-buttons', btns));
    const modal = openModal({ title, body, cls: 'ask-modal', onClose: () => done(null) });
    // foco no botão principal (o openModal foca o 1º botão; aqui preferimos o que confirma)
    btns[buttons.findIndex((b) => b.primary)]?.focus();
  });
}

/**
 * Pede UM TEXTO numa janela do app (substitui o `prompt()` do navegador). Enter confirma, Esc cancela.
 * @param {{title: string, label: string, value?: string, confirm?: string}} o
 * @returns {Promise<string|null>} o texto digitado, ou null se cancelou
 */
export function askText({ title, label, value = '', confirm = 'OK' }) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => { if (answered) return; answered = true; resolve(v); };
    const input = h('input.text', { type: 'text', value, 'aria-label': label, spellcheck: false });
    const ok = () => { done(input.value); modal.close(); };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), ok()));
    const body = h('div.modal-body.ask',
      h('label.set-label', label),
      h('div.field', input),
      h('div.ask-buttons',
        h('button.btn', { type: 'button', onclick: () => modal.close() }, 'Cancelar'),
        h('button.btn.primary', { type: 'button', onclick: ok }, confirm)));
    const modal = openModal({ title, body, cls: 'ask-modal', onClose: () => done(null) });
    input.focus();
    input.select();
  });
}

/** Abre a janela de ajuda com todos os atalhos. Fecha com Esc, no X ou clicando fora. */
export function showHelp() {
  openModal({
    title: 'Atalhos de teclado',
    body: h('div.modal-body.shortcuts', SHORTCUTS.map(([title, rows]) =>
      h('section', h('h4', title), rows.map(([k, d]) => h('div.sc-row', h('span', d), h('kbd', k)))))),
  });
}
