/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/code.js — ABA "CÓDIGO" (CSS E HTML DA SELEÇÃO, CSS DA PÁGINA, HTML À MÃO)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Três abas:
 *   - CSS: o CSS REAL da seleção (o mesmo da exportação). "Editar" abre o editor com as declarações da camada;
 *     ao aplicar, o que dá vira campo do modelo e o resto vai para o CSS livre (ver cssedit.js). Ctrl+Z desfaz;
 *   - HTML: o HTML da seleção + os ATRIBUTOS da camada (id, classes, title, role, aria-label, link...). Numa camada
 *     "Código HTML", "Editar" abre o HTML escrito à mão (limpo por html.js → sanitizeHtml);
 *   - Página: o CSS GLOBAL do projeto (doc.styles.pageCss) com seletores, @media, :hover e @keyframes. Vale no canvas,
 *     no HTML exportado e na apresentação.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { generateCode, joinCss } from '../css.js';
import { tagOf, TEXT_TAGS, BOX_TAGS } from '../model.js';
import { lintCss, sanitizeHtml, cleanId, cleanClasses, LINK_TARGETS, BUTTON_TYPES } from '../html.js';
import { applyLayerCss, lintLayerCss, layerCssText } from '../cssedit.js';
import { createCodeEditor, highlightCss, highlightHtml } from './codeeditor.js';

/** Troca os filhos só se mudaram (mover o editor no DOM tiraria o foco de quem está digitando). */
const setKids = (parent, list) => {
  const same = parent.children.length === list.length && list.every((c, i) => parent.children[i] === c);
  if (!same) parent.replaceChildren(...list);
};

/** CSS.supports do navegador (quando existe) para conferir propriedades e valores. */
const supports = (p, v) => {
  try { return typeof CSS === 'undefined' || !CSS.supports ? true : CSS.supports(p, v); } catch { return true; }
};

/**
 * Cria o painel CÓDIGO. Mostra o código REAL (a mesma saída de `generateCode` usada na exportação) e permite editar.
 */
export function createCodePanel({ store, commands, toast }) {
  const ui = store.ui;
  // tab: 'css' | 'html' | 'page' · children: incluir camadas filhas? · editing: modo Editar ligado?
  let tab = 'css';
  let children = true;
  let editing = false;
  // editor aberto: para qual camada/aba ele foi preenchido e se tem mudança ainda não aplicada
  let edit = { key: '', dirty: false };

  const pre = h('pre.code-view', { tabindex: 0, 'aria-label': 'Código gerado' });
  const chip = (id, label, title) => h('button.tab-chip', { type: 'button', title, dataset: { codeTab: id }, onclick: () => { if (tab !== id) { tab = id; editing = id === 'page'; edit = { key: '', dirty: false }; render(); } } }, label);
  const cssBtn = chip('css', 'CSS', 'CSS da seleção');
  const htmlBtn = chip('html', 'HTML', 'HTML e atributos da seleção');
  const pageBtn = chip('page', 'Página', 'CSS da página: regras com seletores, @media, :hover e @keyframes para o projeto todo');
  const kids = h('input', { type: 'checkbox', checked: true });
  const wrapLines = h('input', { type: 'checkbox', checked: false });
  wrapLines.addEventListener('change', () => pre.classList.toggle('wrap-lines', wrapLines.checked));
  kids.addEventListener('change', () => { children = kids.checked; render(); });
  // último código gerado (é o que o botão Copiar copia)
  let current = '';
  const copy = h('button.btn', {
    type: 'button', title: 'Copiar o código',
    onclick: async () => {
      const text = editing ? editor.getValue() : current;
      try { await navigator.clipboard.writeText(text); toast('Código copiado!'); } catch { toast('O navegador bloqueou a cópia.'); }
    },
  }, ico('copy', 14));
  copy.setAttribute('aria-label', 'Copiar o código');
  const editBtn = h('button.btn.code-edit-btn', {
    type: 'button', 'aria-pressed': 'false',
    onclick: () => {
      if (editing && edit.dirty && !confirm('Descartar as mudanças que ainda não foram aplicadas?')) return;
      editing = !editing; edit = { key: '', dirty: false }; render();
      if (editing) editor.focus();
    },
  }, ico('pen', 13), h('span', ' Editar'));
  const title = h('span.code-title');
  const viewOpts = h('div.code-sub', title, h('label.check.inline', kids, h('span.box', ico('check', 10)), h('span', 'Incluir filhos')));
  const viewOpts2 = h('div.code-options', h('label.check.inline', wrapLines, h('span.box', ico('check', 10)), h('span', 'Quebrar linhas')));

  // ---- editor (um só, reaproveitado entre as abas; a linguagem é trocada recriando)
  let editor = null;
  let editorLang = '';
  const hint = h('p.code-hint');
  const diagList = h('ul.code-diags', { 'aria-live': 'polite' });
  const status = h('span.code-status');
  const applyBtn = h('button.btn.primary', { type: 'button', title: 'Aplicar (Ctrl+Enter)', onclick: () => apply() }, ico('check', 13), ' Aplicar');
  const discardBtn = h('button.btn', { type: 'button', title: 'Voltar ao código atual', onclick: () => { edit = { key: '', dirty: false }; render(); } }, 'Descartar');
  const editBar = h('div.code-editbar', status, h('span.grow'), discardBtn, applyBtn);
  const editWrap = h('div.code-edit');
  const attrs = h('div.code-attrs');
  const body = h('div.code-body');
  const el = h('div.code-panel',
    h('div.code-head', h('div.tab-chips', cssBtn, htmlBtn, pageBtn), h('div.code-actions', editBtn, copy)),
    body);

  /** Garante um editor da linguagem pedida. */
  const ensureEditor = (lang) => {
    if (editor && editorLang === lang) return editor;
    editorLang = lang;
    editor = createCodeEditor({
      language: lang,
      label: lang === 'html' ? 'Editor de HTML' : 'Editor de CSS',
      placeholder: lang === 'css' ? '.minha-classe:hover {\n  transform: translateY(-2px);\n}\n\n@media (max-width: 600px) {\n  .titulo { font-size: 28px; }\n}' : '',
      onInput: () => { edit.dirty = true; lint(); },
      onApply: () => apply(),
    });
    return editor;
  };

  /** Confere o texto do editor e mostra os problemas (com o número da linha). */
  let lintTimer = 0;
  function lint(now = false) {
    clearTimeout(lintTimer);
    const run = () => {
      if (!editor) return;
      const v = editor.getValue();
      let list = [];
      if (tab === 'page') list = lintCss(v, supports);
      else if (tab === 'css') list = lintLayerCss(v, supports);
      else if (tab === 'html') {
        const { removed } = sanitizeHtml(v);
        if (removed.length) list = [{ line: 0, level: 'warn', msg: `será removido por segurança: ${removed.join(', ')}` }];
      }
      editor.setDiagnostics(list.filter((d) => d.line > 0));
      diagList.replaceChildren(...list.slice(0, 12).map((d) => h(`li.${d.level}`, d.line > 0 ? h('b', `Linha ${d.line}`) : null, ` ${d.msg}`)));
      const errs = list.filter((d) => d.level === 'error').length;
      status.textContent = errs ? `${errs} erro${errs > 1 ? 's' : ''}` : edit.dirty ? 'Mudanças não aplicadas' : 'Em dia';
      status.className = `code-status${errs ? ' err' : edit.dirty ? ' dirty' : ''}`;
    };
    if (now) run(); else lintTimer = setTimeout(run, 180);
  }

  /** Aplica o que está no editor (CSS da camada, HTML da camada ou CSS da página) com 1 passo de desfazer. */
  function apply() {
    if (!editor || !editing) return;
    const v = editor.getValue();
    lint(true);
    const target = commands.topSelection()[0];
    if (tab === 'page') {
      const errs = lintCss(v, null).filter((d) => d.level === 'error');
      if (errs.length) { toast(`Corrija antes de aplicar: linha ${errs[0].line} — ${errs[0].msg}`); return; }
      store.update(() => { const st = store.state.doc.styles; if (v.trim()) st.pageCss = v; else delete st.pageCss; }, { commit: true });
      toast(v.trim() ? 'CSS da página aplicado (Ctrl+Z desfaz)' : 'CSS da página removido');
    } else if (tab === 'css' && target) {
      const errs = lintLayerCss(v, null).filter((d) => d.level === 'error');
      if (errs.length) { toast(`Corrija antes de aplicar: linha ${errs[0].line} — ${errs[0].msg}`); return; }
      let rep = null;
      store.update(() => { rep = applyLayerCss(store.get(target.id), store.parentOf(target.id), store.state.doc.assets, v); }, { commit: true });
      const parts = [];
      if (rep.mapped.length) parts.push(`no painel: ${rep.mapped.join(', ')}`);
      if (rep.custom.length) parts.push(`CSS livre: ${rep.custom.join(', ')}`);
      if (rep.unset.length) parts.push(`removido (unset): ${rep.unset.join(', ')}`);
      if (rep.ignored.length) parts.push(`ignorado: ${rep.ignored.join(', ')}`);
      toast(parts.length ? `CSS aplicado — ${parts.join(' · ')}` : 'Nada mudou.');
    } else if (tab === 'html' && target?.type === 'html') {
      const { removed } = sanitizeHtml(v);
      store.update(() => { store.get(target.id).html = v; }, { commit: true });
      toast(removed.length ? `HTML aplicado. Removido por segurança: ${removed.join(', ')}` : 'HTML aplicado (Ctrl+Z desfaz)');
    }
    edit = { key: '', dirty: false };
    render();
  }

  /** Texto que o editor deve mostrar para a aba/seleção atuais. */
  function sourceText(target) {
    if (tab === 'page') return store.state.doc.styles?.pageCss || '';
    if (tab === 'css') return layerCssText(target, store.parentOf(target.id), store.state.doc.assets);
    return target.html || '';
  }

  /** Gera o código das camadas-alvo e mostra colorido; no modo Editar, monta o editor. */
  function render() {
    if (ui.codeOpen) { tab = ui.codeOpen.tab || tab; editing = !!ui.codeOpen.edit; edit = { key: '', dirty: false }; delete ui.codeOpen; }
    for (const [b, id] of [[cssBtn, 'css'], [htmlBtn, 'html'], [pageBtn, 'page']]) {
      b.classList.toggle('on', tab === id);
      b.setAttribute('aria-pressed', String(tab === id));
    }
    const sel = commands.topSelection();
    const one = sel.length === 1 ? sel[0] : null;
    // quando dá para editar: CSS de UMA camada (no desenho base), HTML de uma camada "Código HTML", e sempre a Página
    const blocked = ui.bp || ui.editState;
    const canEdit = tab === 'page' || (one && !blocked && (tab === 'css' || one.type === 'html'));
    if (!canEdit && tab !== 'page') editing = false;
    if (tab === 'page') editing = true;
    editBtn.hidden = tab === 'page' || !canEdit;
    editBtn.classList.toggle('on', editing);
    editBtn.setAttribute('aria-pressed', String(editing));
    editBtn.lastChild.textContent = editing ? ' Ver' : ' Editar';
    editBtn.title = editing ? 'Voltar a ver o código gerado' : 'Editar o código à mão';

    if (editing) {
      const lang = tab === 'page' ? 'css' : tab === 'css' ? 'decls' : 'html';
      const ed = ensureEditor(lang);
      const key = `${tab}:${one?.id || ''}`;
      // preenche quando muda o alvo; com o alvo igual, atualiza só se não houver mudança pendente
      if (edit.key !== key) { edit = { key, dirty: false }; ed.setValue(sourceText(one)); ed.textarea.scrollTo(0, 0); }
      else if (!edit.dirty) ed.setValue(sourceText(one));
      hint.replaceChildren(...editHint(one));
      setKids(editWrap, [hint, ed.el, editBar, diagList]);
      setKids(body, [editWrap, ...(tab === 'html' && one ? [attrsSection(one)] : [])]);
      title.textContent = one ? one.name : '';
      lint(true);
      current = ed.getValue();
      copy.disabled = false;
      return;
    }

    // ---- modo VER (como antes)
    const targets = sel.length ? sel : store.page().children;
    title.textContent = sel.length ? (sel.length === 1 ? sel[0].name : `${sel.length} camadas`) : `${store.page().name} (tudo)`;
    const assets = store.state.doc.assets;
    const parts = targets.map((n) => {
      const node = children ? n : { ...n, children: n.children ? [] : undefined };
      return generateCode([node], store.parentOf(n.id), assets, { styles: store.state.doc.styles });
    });
    // CSS: um só bloco :root com as variáveis (estilos de cor) de todas as partes; HTML: só junta
    const code = tab === 'css' ? joinCss(parts) : parts.map((p) => p.html).filter(Boolean).join('\n');
    current = code;
    copy.disabled = !code;
    pre.innerHTML = code ? (tab === 'css' ? highlightCss(code) : highlightHtml(code)) : '<span class="muted">Nada para mostrar.</span>';
    const note = blocked && tab === 'css' && one ? h('p.code-hint', 'Para editar o CSS à mão, volte ao desenho base (Desktop, estado Normal).') : null;
    setKids(body, [viewOpts, viewOpts2, ...(note ? [note] : []), pre, ...(tab === 'html' && one ? [attrsSection(one)] : [])]);
  }

  /** Explicação curta acima do editor. */
  function editHint(one) {
    if (tab === 'page') {
      return [h('b', 'CSS da página. '), 'Use as classes do HTML exportado (aba HTML), as suas classes extras e ids. Vale no canvas, no HTML exportado e na apresentação.'];
    }
    if (tab === 'css') {
      return [h('b', one.name), ' — declarações da camada. O que dá vira propriedade do painel; o resto vai para o CSS livre. Apagar uma linha a remove (unset). Ctrl+Enter aplica, Ctrl+Z desfaz.'];
    }
    return [h('b', one.name), ' — HTML escrito à mão. Scripts, on* e links javascript: são removidos. Estilize pela aba Página.'];
  }

  // ---- ATRIBUTOS HTML da camada
  // a seção é reaproveitada enquanto a pessoa digita nela (recriar tiraria o foco do campo)
  let attrsCache = { key: '', el: null };
  function attrsSection(n) {
    const tag = tagOf(n);
    const key = `${n.id}:${tag}:${n.type}`;
    if (attrsCache.key === key && attrsCache.el?.contains(document.activeElement)) return attrsCache.el;
    attrsCache = { key, el: buildAttrs(n, tag) };
    return attrsCache.el;
  }
  function buildAttrs(n, tag) {
    const set = (fn) => store.update(() => fn(store.get(n.id)), { commit: true });
    const text = (labelText, key, { placeholder = '', clean = (v) => v.trim(), invalid = '' } = {}) => {
      const input = h('input.code-attr-input', { value: n[key] || '', placeholder, spellcheck: false, 'aria-label': labelText, dataset: { attr: key } });
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        const v = clean(raw);
        if (raw && !v) { toast(invalid || `Valor inválido em ${labelText}.`); input.value = n[key] || ''; return; }
        set((m) => { if (v) m[key] = v; else delete m[key]; });
      });
      return h('label.code-attr', h('span', labelText), input);
    };
    const choose = (labelText, key, options, def) => {
      const s = h('select.code-attr-input', { 'aria-label': labelText, dataset: { attr: key } }, ...options.map(([v, l]) => h('option', { value: v, selected: (n[key] || def) === v }, l)));
      s.addEventListener('change', () => set((m) => { if (s.value && s.value !== def) m[key] = s.value; else delete m[key]; }));
      return h('label.code-attr', h('span', labelText), s);
    };
    const tags = (n.type === 'text' ? TEXT_TAGS : BOX_TAGS).map((t) => [t, `<${t}>`]);
    const rows = [
      n.type !== 'line' ? choose('Etiqueta', 'tag', tags, tagOf({ type: n.type })) : null,
      text('id', 'htmlId', { placeholder: 'ex.: topo', clean: cleanId, invalid: 'O id começa com letra e usa só letras, números, - e _.' }),
      text('Classes extras', 'classes', { placeholder: 'ex.: destaque cartao', clean: (v) => cleanClasses(v).join(' '), invalid: 'Classes: letras, números, - e _, separadas por espaço.' }),
      text('title (dica)', 'title', { placeholder: 'Texto ao passar o mouse' }),
      text('aria-label', 'alt', { placeholder: 'Descrição para leitor de tela' }),
      text('role', 'role', { placeholder: 'ex.: banner, img, list', clean: (v) => (/^[a-z]+( [a-z]+)*$/.test(v) ? v : '') }),
      text('lang', 'lang', { placeholder: 'ex.: en', clean: (v) => (/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(v) ? v : '') }),
    ];
    if (tag === 'a') {
      rows.push(text('href', 'href', { placeholder: 'https://… ou #secao' }),
        choose('target', 'target', LINK_TARGETS.map((t) => [t, t === '_blank' ? '_blank (nova aba)' : t]), '_self'),
        text('rel', 'rel', { placeholder: 'ex.: nofollow', clean: (v) => v.split(/\s+/).filter((r) => /^[a-z-]+$/.test(r)).join(' ') }));
    }
    if (tag === 'button') rows.push(choose('type', 'buttonType', BUTTON_TYPES.map((t) => [t, t]), 'button'));
    if (tag === 'time') rows.push(text('datetime', 'dateTime', { placeholder: 'ex.: 2026-10-08' }));
    if (tag === 'blockquote') rows.push(text('cite (URL)', 'cite', { placeholder: 'https://…' }));
    return h('section.code-attrs', h('h4', 'Atributos HTML'), h('div.code-attr-grid', ...rows.filter(Boolean)));
  }

  // atualiza ao vivo quando a aba está aberta e algo muda (no modo Editar, sem apagar o que está sendo digitado)
  store.subscribe((reasons) => {
    if (ui.rightTab === 'code' && ['doc', 'selection', 'history', 'bp', 'ui'].some((r) => reasons.has(r))) {
      render();
    }
  });
  return { el, render };
}
