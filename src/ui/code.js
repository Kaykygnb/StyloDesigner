/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/code.js — ABA "CÓDIGO" (CSS E HTML DA SELEÇÃO, CSS DA PÁGINA, ATRIBUTOS)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Três abas (só leitura; "Editar" abre o EDITOR GRANDE embaixo do canvas — ui/codedock.js):
 *   - CSS: o CSS REAL da seleção (o mesmo da exportação). Editar → declarações da camada; ao aplicar, o que dá vira
 *     campo do modelo e o resto vai para o CSS livre (ver cssedit.js). Ctrl+Z desfaz;
 *   - HTML: o HTML da seleção + os ATRIBUTOS da camada (id, classes, title, role, aria-label, link...). Numa camada
 *     "Código HTML", Editar → o HTML escrito à mão (limpo por html.js → sanitizeHtml);
 *   - Página: o CSS GLOBAL do projeto (doc.styles.pageCss) com seletores, @media, :hover e @keyframes. Vale no canvas,
 *     no HTML exportado e na apresentação.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { generateCode, joinCss } from '../css.js';
import { tagOf, TEXT_TAGS, BOX_TAGS } from '../model.js';
import { cleanId, cleanClasses, LINK_TARGETS, BUTTON_TYPES } from '../html.js';
import { highlightCss, highlightHtml } from './codeeditor.js';

/** Troca os filhos só se mudaram (mover o editor no DOM tiraria o foco de quem está digitando). */
const setKids = (parent, list) => {
  const same = parent.children.length === list.length && list.every((c, i) => parent.children[i] === c);
  if (!same) parent.replaceChildren(...list);
};

/**
 * Cria o painel CÓDIGO. Mostra o código REAL (a mesma saída de `generateCode` usada na exportação); "Editar" abre o
 * editor grande (ui/codedock.js) na aba correspondente.
 * @param {{ store, commands, toast, dock: { open: (tab?:string)=>void } }} deps
 */
export function createCodePanel({ store, commands, toast, dock }) {
  const ui = store.ui;
  // tab: 'css' | 'html' | 'page' · children: incluir camadas filhas?
  let tab = 'css';
  let children = true;

  const pre = h('pre.code-view', { tabindex: 0, 'aria-label': 'Código gerado' });
  const chip = (id, label, title) => h('button.tab-chip', { type: 'button', title, dataset: { codeTab: id }, onclick: () => { if (tab !== id) { tab = id; render(); } } }, label);
  const cssBtn = chip('css', 'CSS', 'CSS da seleção');
  const htmlBtn = chip('html', 'HTML', 'HTML e atributos da seleção');
  const pageBtn = chip('page', 'Página', 'CSS da página: regras com seletores, @media, :hover e @keyframes para o projeto todo');
  const kids = h('input', { type: 'checkbox', checked: true });
  const wrapLines = h('input', { type: 'checkbox', checked: false });
  wrapLines.addEventListener('change', () => pre.classList.toggle('wrap-lines', wrapLines.checked));
  kids.addEventListener('change', () => { children = kids.checked; render(); });
  // último código mostrado (é o que o botão Copiar copia)
  let current = '';
  const copy = h('button.btn', {
    type: 'button', title: 'Copiar o código',
    onclick: async () => {
      try { await navigator.clipboard.writeText(current); toast('Código copiado!'); } catch { toast('O navegador bloqueou a cópia.'); }
    },
  }, ico('copy', 14));
  copy.setAttribute('aria-label', 'Copiar o código');
  // "Editar" abre o editor grande embaixo do canvas, na aba certa (CSS da camada, CSS da página ou HTML)
  const editBtn = h('button.btn.code-edit-btn', {
    type: 'button', title: 'Editar no editor grande (Ctrl+Shift+E)',
    onclick: () => dock.open(tab),
  }, ico('pen', 13), h('span', ' Editar'));
  const title = h('span.code-title');
  const viewOpts = h('div.code-sub', title, h('label.check.inline', kids, h('span.box', ico('check', 10)), h('span', 'Incluir filhos')));
  const viewOpts2 = h('div.code-options', h('label.check.inline', wrapLines, h('span.box', ico('check', 10)), h('span', 'Quebrar linhas')));
  const pageHint = h('p.code-hint', h('b', 'CSS da página. '), 'Use as classes do HTML exportado (aba HTML), as suas classes extras e ids. Vale no canvas, no HTML exportado e na apresentação.');
  const body = h('div.code-body');
  const el = h('div.code-panel',
    h('div.code-head', h('div.tab-chips', cssBtn, htmlBtn, pageBtn), h('div.code-actions', editBtn, copy)),
    body);

  /** Gera o código das camadas-alvo e mostra colorido (na aba Página, o CSS escrito à mão). */
  function render() {
    // pedido de abrir direto no modo de edição (ex.: Shift+E cria uma camada "Código HTML")
    if (ui.codeOpen) {
      tab = ui.codeOpen.tab || tab;
      const wantEdit = !!ui.codeOpen.edit;
      delete ui.codeOpen;
      if (wantEdit) dock.open(tab);
    }
    for (const [b, id] of [[cssBtn, 'css'], [htmlBtn, 'html'], [pageBtn, 'page']]) {
      b.classList.toggle('on', tab === id);
      b.setAttribute('aria-pressed', String(tab === id));
    }
    const sel = commands.topSelection();
    const one = sel.length === 1 ? sel[0] : null;
    const blocked = ui.bp || ui.editState;
    // dá para editar: CSS de UMA camada (no desenho base), HTML de uma camada "Código HTML", e sempre a Página
    editBtn.hidden = !(tab === 'page' || (one && (tab === 'css' ? !blocked : one.type === 'html')));

    if (tab === 'page') {
      const code = store.state.doc.styles?.pageCss || '';
      current = code;
      copy.disabled = !code;
      pre.innerHTML = code ? highlightCss(code) : '<span class="muted">Nenhuma regra ainda. Clique em Editar para escrever seletores, @media, :hover e @keyframes que valem no projeto todo.</span>';
      setKids(body, [pageHint, pre]);
      return;
    }
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
