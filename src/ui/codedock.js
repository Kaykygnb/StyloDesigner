/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/codedock.js — EDITOR DE CÓDIGO GRANDE (acoplado embaixo do canvas, ou em tela cheia)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  A aba Código do painel direito é estreita demais para escrever. "Editar" (ou Ctrl+Shift+E) abre este painel:
 *   - fica EMBAIXO do canvas; arrastar a borda de cima muda a altura (lembrada nas preferências);
 *   - maximizar (botão ou F11 dentro do editor) ocupa a janela toda; Esc volta;
 *   - abas: "CSS da camada" (declarações da camada selecionada, ver cssedit.js), "CSS da página"
 *     (doc.styles.pageCss) e "HTML" (camada "Código HTML", limpo por html.js → sanitizeHtml);
 *   - AO VIVO: enquanto digita, o canvas mostra o resultado (com atraso curto), sem entrar no histórico.
 *     Aplicar (Ctrl+S / Ctrl+Enter) grava com 1 passo de desfazer; Descartar volta ao que era.
 *  Cada aba tem a sua "sessão" (texto, camada-alvo, mudanças pendentes). Com mudança pendente, a aba fica PRESA
 *  à camada que estava sendo editada, mesmo se a seleção mudar.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { icon, nodeIcon } from './icons.js';
import { lintCss, sanitizeHtml, cleanClasses, cleanId } from '../html.js';
import { applyLayerCss, lintLayerCss, layerCssText } from '../cssedit.js';
import { classNamesOf, docCssVars } from '../css.js';
import { BREAKPOINTS, walk } from '../model.js';
import { createCodeEditor } from './codeeditor.js';

/** CSS.supports do navegador (quando existe) para conferir propriedades e valores. */
const supports = (p, v) => {
  try { return typeof CSS === 'undefined' || !CSS.supports ? true : CSS.supports(p, v); } catch { return true; }
};

/** As três abas do editor grande. */
const TABS = [
  { id: 'css', label: 'CSS da camada', lang: 'decls', title: 'Declarações CSS da camada selecionada' },
  { id: 'page', label: 'CSS da página', lang: 'css', title: 'CSS global: seletores, @media, :hover, @keyframes' },
  { id: 'html', label: 'HTML', lang: 'html', title: 'HTML escrito à mão (camada "Código HTML")' },
];
const MIN_H = 160;

/**
 * Cria o editor grande. Devolve { el, open(tab?), close(), toggle(), isOpen(), sync() }.
 * @param {{ store, commands, toast, prefs: object, savePrefs: ()=>void }} deps
 */
export function createCodeDock({ store, commands, toast, prefs, savePrefs }) {
  const ui = store.ui;
  let tab = 'css';
  let open = false;
  let max = false;
  let live = prefs.codeLive !== false;
  // sessões por aba: editor, camada-alvo, mudança pendente e a "foto" de antes da pré-visualização ao vivo
  const sessions = Object.fromEntries(TABS.map((t) => [t.id, { editor: null, targetId: null, dirty: false, orig: null, diags: [], linted: null }]));

  // ---------------------------------------------------------------- estrutura
  const tabBtns = TABS.map((t) => h('button.cd-tab', {
    type: 'button', role: 'tab', title: t.title, dataset: { dockTab: t.id },
    onclick: () => setTab(t.id),
  }, h('span.cd-tab-ico', { html: icon(t.id === 'html' ? 'code' : t.id === 'page' ? 'page' : 'sliders', 13) }), h('span', t.label), h('i.cd-dot', { 'aria-hidden': 'true' })));
  const target = h('span.cd-target');
  const liveBox = h('input', { type: 'checkbox', checked: live });
  liveBox.addEventListener('change', () => {
    live = liveBox.checked;
    prefs.codeLive = live;
    savePrefs();
    if (live) preview(); else revertPreview(tab);
  });
  const discardBtn = h('button.btn.cd-discard', { type: 'button', title: 'Voltar ao código atual da camada', onclick: () => discard() }, 'Descartar');
  const applyBtn = h('button.btn.primary.cd-apply', { type: 'button', title: 'Aplicar (Ctrl+S ou Ctrl+Enter)', onclick: () => apply() }, ico('check', 13), h('span', ' Aplicar'));
  const maxBtn = h('button.icon-btn.cd-max', { type: 'button', onclick: () => setMax(!max) });
  const closeBtn = h('button.icon-btn.cd-close', { type: 'button', title: 'Fechar o editor (Ctrl+Shift+E)', 'aria-label': 'Fechar o editor', onclick: () => close() }, ico('x', 15));
  const head = h('header.cd-head',
    h('div.cd-tabs', { role: 'tablist', 'aria-label': 'O que editar' }, ...tabBtns),
    target,
    h('span.grow'),
    h('label.check.inline.cd-live', { title: 'Mostrar no canvas enquanto digita (sem entrar no histórico)' }, liveBox, h('span.box', ico('check', 10)), h('span', 'Ao vivo')),
    discardBtn, applyBtn, h('span.cd-sep'), maxBtn, closeBtn);
  const grip = h('div.cd-grip', { title: 'Arraste para mudar a altura (duplo clique: altura padrão)', role: 'separator', 'aria-orientation': 'horizontal', 'aria-label': 'Altura do editor' });
  const edHost = h('div.cd-editor');
  const empty = h('div.cd-empty');
  const problems = h('ul.cd-problems', { hidden: true, 'aria-label': 'Problemas no código' });
  const body = h('div.cd-body', edHost, empty, problems);
  // status no rodapé: com erros/avisos, vira botão que mostra a lista de problemas
  let problemsOpen = false;
  const status = h('button.cd-state', { type: 'button', onclick: () => { if (!sessions[tab].diags.length) return; problemsOpen = !problemsOpen; problems.hidden = !problemsOpen; } });
  const cursor = h('span.cd-cursor');
  const langLabel = h('span.cd-lang');
  const foot = h('footer.cd-foot', status, h('span.cd-hint', h('kbd', 'Ctrl+Espaço'), ' sugestões · ', h('kbd', 'Ctrl+F'), ' procurar · ', h('kbd', 'Ctrl+/'), ' comentar · ', h('kbd', 'Ctrl+S'), ' aplicar'), h('span.grow'), cursor, langLabel);
  const el = h('section.code-dock', { hidden: true, role: 'region', 'aria-label': 'Editor de código' }, grip, head, body, foot);
  el.style.setProperty('--dock-h', `${Math.max(MIN_H, prefs.codeDockH || 320)}px`);

  // ---------------------------------------------------------------- dados do documento para o autocompletar
  const assistContext = () => {
    const styles = store.state.doc.styles || {};
    const vars = docCssVars(styles);
    const classes = new Set();
    const ids = new Set();
    const page = store.page();
    const roots = page.children.flatMap((n) => (n.type === 'section' ? [n, ...n.children] : [n]));
    for (const c of classNamesOf(roots).values()) classes.add(c);
    walk(page.children, (n) => {
      cleanClasses(n.classes).forEach((c) => classes.add(c));
      const id = cleanId(n.htmlId);
      if (id) ids.add(id);
    });
    return {
      vars, classes: [...classes], ids: [...ids],
      breakpoints: BREAKPOINTS.map((b) => ({ name: b.name, max: b.max })),
      colors: vars.filter((v) => v.kind === 'color').map((v) => ({ name: v.label, value: v.hex })),
    };
  };

  /** Editor (criado na primeira vez) da aba pedida. */
  const editorOf = (id) => {
    const s = sessions[id];
    if (s.editor) return s.editor;
    const lang = TABS.find((t) => t.id === id).lang;
    s.editor = createCodeEditor({
      language: lang,
      label: id === 'html' ? 'Editor de HTML' : id === 'page' ? 'Editor do CSS da página' : 'Editor do CSS da camada',
      placeholder: id === 'page' ? '.minha-classe:hover {\n  transform: translateY(-2px);\n}\n\n@media (max-width: 640px) {\n  .titulo { font-size: 28px; }\n}'
        : id === 'html' ? '<div class="cartao">\n  <h2>Título</h2>\n  <p>Texto</p>\n</div>\n\n(dica: digite div.cartao>h2+p e aperte Tab)' : 'display: flex;\ngap: 16px;',
      onInput: () => { s.dirty = true; lintSoon(); previewSoon(); syncChrome(); },
      onApply: () => apply(),
      onCursor: ({ line, col }) => { if (id === tab) cursor.textContent = `Ln ${line}, Col ${col}`; },
      context: assistContext,
    });
    return s.editor;
  };

  // ---------------------------------------------------------------- alvo e texto
  const blocked = () => !!(ui.bp || ui.editState);
  /** Camada que a aba edita agora (presa à anterior enquanto houver mudança pendente). */
  function targetOf(id) {
    const s = sessions[id];
    if (id === 'page') return null;
    if (s.dirty && s.targetId) {
      const n = store.get(s.targetId);
      if (n) return n;
      s.dirty = false; s.orig = null; // a camada sumiu: a sessão recomeça
    }
    const sel = commands.topSelection();
    const one = sel.length === 1 ? sel[0] : null;
    if (!one) return null;
    if (id === 'html') return one.type === 'html' ? one : null;
    return blocked() ? null : one;
  }
  /** Texto atual (no documento) que a aba deve mostrar. */
  function sourceText(id, node) {
    if (id === 'page') return store.state.doc.styles?.pageCss || '';
    if (!node) return '';
    if (id === 'css') return layerCssText(node, store.parentOf(node.id), store.state.doc.assets);
    return node.html || '';
  }
  /** Motivo para a aba não ter o que editar (ou '' se tem). */
  function emptyReason(id, node) {
    if (id === 'page' || node) return '';
    const sel = commands.topSelection();
    if (id === 'css') {
      if (sel.length === 1 && blocked()) return 'Para editar o CSS à mão, volte ao desenho base (Desktop, estado Normal).';
      return sel.length > 1 ? 'Selecione UMA camada para editar o CSS dela.' : 'Selecione uma camada no canvas para editar o CSS dela.';
    }
    return 'Selecione uma camada "Código HTML" para escrever o HTML dela. Shift+E cria uma nova.';
  }

  // ---------------------------------------------------------------- conferir (lint)
  function lintFor(id, v, sup = supports) {
    if (id === 'page') return lintCss(v, sup);
    if (id === 'css') return lintLayerCss(v, sup);
    const { removed } = sanitizeHtml(v);
    return removed.length ? [{ line: 0, level: 'warn', msg: `será removido por segurança: ${removed.join(', ')}` }] : [];
  }
  let lintTimer = 0;
  // espera a pessoa parar de digitar (meia linha escrita não é erro)
  const lintSoon = () => { clearTimeout(lintTimer); lintTimer = setTimeout(lintNow, 500); };
  function lintNow() {
    clearTimeout(lintTimer);
    const s = sessions[tab];
    if (!s.editor) return;
    s.linted = s.editor.getValue();
    s.diags = lintFor(tab, s.linted);
    s.editor.setDiagnostics(s.diags.filter((d) => d.line > 0));
    problems.replaceChildren(...s.diags.slice(0, 30).map((d) => h(`li.${d.level}`, {
      onclick: () => d.line > 0 && goToLine(d.line),
      title: d.line > 0 ? 'Ir para a linha' : '',
    }, h('span.cd-pico', d.level === 'error' ? '✕' : '!'), d.line > 0 ? h('b', `Ln ${d.line}`) : null, h('span', d.msg))));
    if (!s.diags.length) problemsOpen = false;
    problems.hidden = !problemsOpen;
    syncChrome();
  }
  /** Leva o cursor para o começo da linha (1-based). */
  function goToLine(n) {
    const ed = sessions[tab].editor;
    const v = ed.getValue();
    let p = 0;
    for (let i = 1; i < n && p >= 0; i++) p = v.indexOf('\n', p) + 1;
    ed.focus();
    ed.textarea.setSelectionRange(p, p);
    ed.textarea.blur(); ed.textarea.focus(); // o navegador rola até o cursor
  }

  // ---------------------------------------------------------------- pré-visualização ao vivo
  /** Guarda os campos da camada (menos os filhos) para poder voltar. */
  const snapNode = (n) => { const { children, ...own } = n; return JSON.parse(JSON.stringify(own)); };
  const restoreNode = (n, orig) => {
    for (const k of Object.keys(n)) if (k !== 'children' && !(k in orig)) delete n[k];
    for (const [k, v] of Object.entries(orig)) n[k] = JSON.parse(JSON.stringify(v));
  };
  let previewTimer = 0;
  const previewSoon = () => { clearTimeout(previewTimer); if (live) previewTimer = setTimeout(preview, 260); };
  /** Mostra no canvas o que está no editor (sem histórico). Com erro de sintaxe, mantém a última prévia boa. */
  function preview() {
    clearTimeout(previewTimer);
    const id = tab;
    const s = sessions[id];
    if (!open || !live || !s.dirty || !s.editor) return;
    const v = s.editor.getValue();
    if (lintFor(id, v, null).some((d) => d.level === 'error')) return;
    if (id === 'page') {
      if (!s.orig) s.orig = { pageCss: store.state.doc.styles?.pageCss };
      store.update(() => { const st = store.state.doc.styles; if (v.trim()) st.pageCss = v; else delete st.pageCss; }, { structural: false });
      return;
    }
    const node = targetOf(id);
    if (!node) return;
    s.targetId = node.id;
    if (!s.orig) s.orig = id === 'css' ? snapNode(node) : { html: node.html };
    store.update(() => {
      const n = store.get(node.id);
      if (id === 'css') { restoreNode(n, s.orig); applyLayerCss(n, store.parentOf(n.id), store.state.doc.assets, v); }
      else n.html = v;
    }, { structural: false });
  }
  /** Desfaz a pré-visualização ao vivo da aba (o documento volta ao que estava antes de digitar). */
  function revertPreview(id) {
    const s = sessions[id];
    if (!s.orig) return;
    const orig = s.orig;
    s.orig = null;
    if (id === 'page') { store.update(() => { const st = store.state.doc.styles; if (orig.pageCss) st.pageCss = orig.pageCss; else delete st.pageCss; }, { structural: false }); return; }
    const n = s.targetId && store.get(s.targetId);
    if (!n) return;
    store.update(() => { if (id === 'css') restoreNode(n, orig); else n.html = orig.html; }, { structural: false });
  }

  // ---------------------------------------------------------------- aplicar / descartar
  /** Aplica o que está no editor (CSS da camada, CSS da página ou HTML) com 1 passo de desfazer. */
  function apply() {
    const id = tab;
    const s = sessions[id];
    if (!s.editor) return;
    clearTimeout(previewTimer);
    const v = s.editor.getValue();
    lintNow();
    const errs = lintFor(id, v, null).filter((d) => d.level === 'error');
    if (errs.length) { toast(`Corrija antes de aplicar: linha ${errs[0].line} — ${errs[0].msg}`); return; }
    if (id === 'page') {
      store.update(() => { const st = store.state.doc.styles; if (v.trim()) st.pageCss = v; else delete st.pageCss; }, { commit: true });
      toast(v.trim() ? 'CSS da página aplicado (Ctrl+Z desfaz)' : 'CSS da página removido');
    } else {
      const node = targetOf(id);
      if (!node) { toast(emptyReason(id, null)); return; }
      if (id === 'css') {
        let rep = null;
        store.update(() => {
          const n = store.get(node.id);
          if (s.orig) restoreNode(n, s.orig);
          rep = applyLayerCss(n, store.parentOf(n.id), store.state.doc.assets, v);
        }, { commit: true });
        const parts = [];
        if (rep.mapped.length) parts.push(`no painel: ${rep.mapped.join(', ')}`);
        if (rep.custom.length) parts.push(`CSS livre: ${rep.custom.join(', ')}`);
        if (rep.unset.length) parts.push(`removido (unset): ${rep.unset.join(', ')}`);
        if (rep.ignored.length) parts.push(`ignorado: ${rep.ignored.join(', ')}`);
        toast(parts.length ? `CSS aplicado — ${parts.join(' · ')}` : 'Nada mudou.');
      } else {
        const { removed } = sanitizeHtml(v);
        store.update(() => { store.get(node.id).html = v; }, { commit: true });
        toast(removed.length ? `HTML aplicado. Removido por segurança: ${removed.join(', ')}` : 'HTML aplicado (Ctrl+Z desfaz)');
      }
    }
    s.orig = null;
    s.dirty = false;
    sync(true);
  }
  /** Joga fora as mudanças da aba atual (e a prévia no canvas). */
  function discard(id = tab) {
    const s = sessions[id];
    clearTimeout(previewTimer);
    revertPreview(id);
    s.dirty = false;
    s.targetId = null;
    sync(true);
  }

  // ---------------------------------------------------------------- abrir / fechar / tela cheia
  function setTab(id) {
    if (tab === id) return;
    clearTimeout(previewTimer);
    problemsOpen = false;
    tab = id;
    sync(true);
    sessions[id].editor?.focus();
  }
  function setMax(on) {
    max = on;
    el.classList.toggle('max', max);
    maxBtn.replaceChildren(ico(max ? 'minimize' : 'maximize', 14));
    maxBtn.title = max ? 'Restaurar (F11 ou Esc)' : 'Tela cheia (F11)';
    maxBtn.setAttribute('aria-label', max ? 'Restaurar o tamanho' : 'Tela cheia');
    maxBtn.setAttribute('aria-pressed', String(max));
    sessions[tab].editor?.refresh();
    window.dispatchEvent(new Event('resize'));
  }
  /** Abre o editor grande (na aba pedida, ou na que faz sentido para a seleção) e põe o foco no código. */
  function openDock(which) {
    if (!which) {
      const one = commands.topSelection().length === 1 ? commands.topSelection()[0] : null;
      which = open ? tab : one?.type === 'html' ? 'html' : one ? 'css' : 'page';
    }
    tab = which;
    if (!open) {
      open = true;
      el.hidden = false;
      document.getElementById('app')?.classList.add('dock-open');
      window.dispatchEvent(new Event('resize'));
      store.emit('ui');
    }
    sync(true);
    requestAnimationFrame(() => sessions[tab].editor?.focus());
  }
  /** Fecha (pergunta antes se há mudança não aplicada). */
  function close() {
    const pending = TABS.filter((t) => sessions[t.id].dirty);
    if (pending.length && !confirm(`Descartar as mudanças não aplicadas (${pending.map((t) => t.label).join(', ')})?`)) return false;
    pending.forEach((t) => discard(t.id));
    open = false;
    if (max) setMax(false);
    el.hidden = true;
    document.getElementById('app')?.classList.remove('dock-open');
    window.dispatchEvent(new Event('resize'));
    store.emit('ui');
    return true;
  }

  // teclas do editor grande: F11 tela cheia, Esc sai da tela cheia (as do código ficam no codeeditor.js)
  el.addEventListener('keydown', (e) => {
    if (e.key === 'F11') { e.preventDefault(); e.stopPropagation(); setMax(!max); return; }
    if (e.key === 'Escape' && max && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); setMax(false); }
  });

  // ---------------------------------------------------------------- arrastar a borda (altura)
  grip.addEventListener('pointerdown', (e) => {
    if (max) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    grip.classList.add('active');
    const startY = e.clientY;
    const startH = el.offsetHeight;
    let raf = 0;
    const move = (ev) => {
      const limit = Math.max(MIN_H, window.innerHeight - 180);
      const hgt = Math.round(Math.max(MIN_H, Math.min(limit, startH + (startY - ev.clientY))));
      el.style.setProperty('--dock-h', `${hgt}px`);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    };
    const up = () => {
      grip.classList.remove('active');
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      prefs.codeDockH = el.offsetHeight;
      savePrefs();
      window.dispatchEvent(new Event('resize'));
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('dblclick', () => { el.style.setProperty('--dock-h', '320px'); delete prefs.codeDockH; savePrefs(); window.dispatchEvent(new Event('resize')); });

  // ---------------------------------------------------------------- redesenho
  /** Cabeçalho, status e botões conforme a aba atual. */
  function syncChrome() {
    const s = sessions[tab];
    tabBtns.forEach((b, i) => {
      const id = TABS[i].id;
      b.classList.toggle('on', id === tab);
      b.setAttribute('aria-selected', String(id === tab));
      b.classList.toggle('dirty', sessions[id].dirty);
    });
    const errs = s.diags.filter((d) => d.level === 'error').length;
    const warns = s.diags.length - errs;
    status.className = `cd-state${errs ? ' err' : s.dirty ? ' dirty' : ''}${s.diags.length ? ' has' : ''}`;
    status.title = s.diags.length ? 'Ver os problemas' : '';
    status.textContent = errs ? `${errs} erro${errs > 1 ? 's' : ''}` : s.dirty ? (live ? 'Pré-visualizando · não aplicado' : 'Mudanças não aplicadas') : 'Em dia';
    if (!errs && warns) status.textContent += ` · ${warns} aviso${warns > 1 ? 's' : ''}`;
    applyBtn.disabled = !s.dirty;
    discardBtn.disabled = !s.dirty;
    langLabel.textContent = tab === 'html' ? 'HTML' : 'CSS';
  }
  /** Atualiza o painel: aba, alvo e texto (sem apagar o que está sendo digitado). `force` recarrega o texto. */
  function sync(force = false) {
    if (!open) return;
    const s = sessions[tab];
    const node = targetOf(tab);
    const reason = emptyReason(tab, node);
    if (reason) {
      empty.replaceChildren(h('div.cd-empty-ico', { html: icon('code', 22) }), h('p', reason));
      empty.hidden = false;
      edHost.hidden = true;
      problems.hidden = true;
      target.replaceChildren();
      s.diags = [];
      cursor.textContent = '';
      syncChrome();
      return;
    }
    empty.hidden = true;
    edHost.hidden = false;
    const ed = editorOf(tab);
    if (edHost.firstChild !== ed.el) edHost.replaceChildren(ed.el);
    const key = node?.id || null;
    if (!s.dirty && (force || s.targetId !== key || ed.getValue() !== sourceText(tab, node))) {
      const changedTarget = s.targetId !== key;
      ed.setValue(sourceText(tab, node));
      if (changedTarget) ed.textarea.scrollTo(0, 0);
    }
    s.targetId = key;
    target.replaceChildren(...(node ? [h('span.cd-target-ico', { html: icon(nodeIcon(node.type), 13) }), h('b', node.name), s.dirty ? h('span.cd-pin', { title: 'A edição continua nesta camada até aplicar ou descartar' }, 'editando') : null]
      : [h('span.cd-target-ico', { html: icon('page', 13) }), h('b', 'Projeto todo')]).filter(Boolean));
    target.title = node ? `Editando: ${node.name}` : 'CSS da página: vale no canvas, no HTML exportado e na apresentação';
    // (o documento muda a cada passo de um arrasto: só confere de novo se o texto mudou)
    if (force || s.linted !== ed.getValue()) lintNow(); else syncChrome();
  }

  // acompanha o documento e a seleção; desfazer/refazer troca o documento inteiro (a prévia some junto)
  store.subscribe((reasons) => {
    if (!open) return;
    if (reasons.has('history')) for (const t of TABS) sessions[t.id].orig = null;
    if (['doc', 'selection', 'history', 'bp'].some((r) => reasons.has(r))) sync();
  });

  setMax(false);
  return {
    el,
    open: openDock,
    close,
    toggle: () => (open ? close() : openDock()),
    isOpen: () => open,
    sync,
  };
}
