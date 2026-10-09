/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/inspector.js — PAINEL DO INSPECIONAR (como a aba "Elements" do F12)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Com a ferramenta Inspecionar (I) e uma camada clicada, mostra num painel flutuante sobre o canvas:
 *   - etiqueta, classes e id do HTML exportado + tamanho;
 *   - o BOX MODEL desenhado (margem, borda, padding, conteúdo) com os números lidos do navegador;
 *   - propriedades CSS COMPUTADAS (getComputedStyle) agrupadas: layout, tipografia, aparência (cores com amostra);
 *   - as REGRAS que se aplicam: a da classe da camada, estados (:hover, :focus...), @media dos breakpoints e as
 *     regras do CSS da página cujo seletor pega este elemento;
 *   - botão para copiar o CSS da camada.
 *  Só LÊ: nada aqui altera o documento.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton } from './dom.js';
import { generateCode, joinCss, classNamesOf, nodeStyle } from '../css.js';
import { htmlTagIn } from '../model.js';
import { parseCssBlocks, parseDeclarations, scopeSelector, cleanClasses, cleanId } from '../html.js';
import { highlightCss } from './codeeditor.js';

/** Grupos de propriedades computadas: [título, propriedades]. Valores padrão (sem efeito) ficam de fora. */
const GROUPS = [
  ['Layout', ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'gap', 'grid-template-columns', 'grid-template-rows',
    'flex', 'align-self', 'justify-self', 'grid-column', 'grid-row', 'order', 'overflow', 'z-index', 'box-sizing', 'aspect-ratio']],
  ['Tipografia', ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'word-spacing', 'color', 'text-align',
    'text-transform', 'text-decoration-line', 'white-space', 'text-overflow', '-webkit-line-clamp']],
  ['Aparência', ['background-color', 'background-image', 'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left', 'outline',
    'outline-offset', 'box-shadow', 'opacity', 'filter', 'backdrop-filter', 'transform', 'mix-blend-mode', 'clip-path', 'cursor', 'transition']],
];
/** Valores que não dizem nada (o padrão do navegador): não aparecem. */
const BORING = new Set(['none', 'normal', 'auto', '0px', 'static', 'visible', 'rgba(0, 0, 0, 0)', 'nowrap normal', 'row', 'stretch', 'start',
  'flex-start', 'baseline', 'clip', 'content-box', '0px none rgb(0, 0, 0)', 'medium none', '1', 'ease 0s', 'all 0s ease 0s', 'auto / auto', 'span 1 / span 1', 'matrix(1, 0, 0, 1, 0, 0)']);
const KEEP = new Set(['display', 'position', 'width', 'height', 'font-family', 'font-size', 'font-weight', 'line-height', 'color']);
const COLOR = /(rgba?\([^)]*\)|#[0-9a-f]{3,8}\b)/gi;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Estados que o editor não "liga" sozinho: para testar se uma regra pega o elemento, tiramos esses pedaços. */
const STATE_PSEUDO = /::?(hover|active|focus|focus-visible|focus-within|visited|link|target|checked|disabled|enabled|placeholder|before|after|first-line|first-letter|selection|marker)\b/g;

export function createInspectorPanel({ store, canvas, commands, toast, stage }) {
  const ui = store.ui;
  const el = h('aside.insp-panel', { hidden: true, 'aria-label': 'Inspecionar: propriedades CSS' });
  stage.append(el);
  let lastKey = '';
  let mini = false; // painel recolhido (só o cabeçalho)
  const openGroups = new Set(['Layout', 'Tipografia', 'Aparência', 'Regras']);

  function render() {
    const id = ui.selection.length === 1 ? ui.selection[0] : null;
    const node = id && store.get(id);
    const nodeEl = id && canvas.els.get(id);
    if (ui.tool !== 'inspect' || !node || !nodeEl?.isConnected) { el.hidden = true; lastKey = ''; return; }
    el.hidden = false;
    el.classList.toggle('mini', mini);
    const cs = getComputedStyle(nodeEl);
    const key = `${id}:${store.state.doc === null ? 0 : JSON.stringify([node, store.state.doc.styles?.pageCss || ''])}:${ui.bp}`;
    if (key === lastKey) return;
    lastKey = key;

    // nome no código exportado (etiqueta efetiva, classe gerada + extras, id)
    const chain = [];
    for (let a = store.parentOf(id); a; a = store.parentOf(a.id)) chain.unshift(a);
    const anc = [];
    for (const a of chain) anc.push(htmlTagIn(a, anc).tag);
    const tag = htmlTagIn(node, anc).tag;
    let screen = node;
    for (let p = store.parentOf(screen.id); p && p.type !== 'section'; p = store.parentOf(p.id)) screen = p;
    const cls = classNamesOf([screen]).get(id) || '';
    const classes = [cls, ...cleanClasses(node.classes)].filter(Boolean);
    const hid = cleanId(node.htmlId);
    const z = canvas.getView().zoom;
    const r = nodeEl.getBoundingClientRect();

    // ---- box model
    const px = (v) => Math.round((parseFloat(v) || 0) * 10) / 10;
    const sides = (p, suf = '') => ['top', 'right', 'bottom', 'left'].map((s) => px(cs.getPropertyValue(`${p}-${s}${suf}`)));
    const m = sides('margin'), b = sides('border', '-width'), p = sides('padding');
    const w = px(nodeEl.offsetWidth), hh = px(nodeEl.offsetHeight);
    const cw = Math.max(0, Math.round((w - b[1] - b[3] - p[1] - p[3]) * 10) / 10), ch = Math.max(0, Math.round((hh - b[0] - b[2] - p[0] - p[2]) * 10) / 10);
    const v = (n) => (n ? String(n) : '–');
    const ring = (name, cl, vals, inner) => h(`div.bm.${cl}`,
      h('span.bm-label', name), h('span.bm-t', v(vals[0])), h('span.bm-r', v(vals[1])), h('span.bm-b', v(vals[2])), h('span.bm-l', v(vals[3])), inner);
    const boxModel = h('div.insp-boxmodel', { 'aria-label': `Box model: margem ${m.join(' ')}, borda ${b.join(' ')}, padding ${p.join(' ')}, conteúdo ${cw} × ${ch}` },
      ring('margin', 'bm-m', m, ring('border', 'bm-bd', b, ring('padding', 'bm-p', p, h('div.bm-c', `${cw} × ${ch}`)))));

    const pageRuleProps = [];
    // ---- regras que se aplicam
    const rules = [];
    const doc = store.state.doc;
    const gen = generateCode([screen], null, doc.assets, { root: true, styles: doc.styles });
    const clsRe = cls ? new RegExp(`\\.${cls.replace(/[-]/g, '\\-')}(?![\\w-])`) : null;
    const collect = (blocks, media, source) => {
      for (const bl of blocks) {
        if (bl.children) { collect(bl.children, bl.prelude, source); continue; }
        if (bl.kind !== 'rule') continue;
        let hit = false;
        if (source === 'layer') hit = !!clsRe && clsRe.test(bl.selector);
        else {
          try {
            const sel = scopeSelector(bl.selector.replace(STATE_PSEUDO, ''), '.world') || '';
            hit = sel && nodeEl.matches(sel);
          } catch { hit = false; }
        }
        if (!hit) continue;
        const decls = parseDeclarations(bl.body).filter((d) => d.prop && d.value);
        if (source === 'page') pageRuleProps.push(...decls.map((d) => d.prop));
        const text = `${bl.selector} {\n${decls.map((d) => `  ${d.prop}: ${d.value};`).join('\n')}\n}`;
        const state = (bl.selector.match(/:(hover|active|focus-visible|focus|focus-within)/) || [])[0];
        const mediaOn = media && /^@media/i.test(media) ? safeMatch(media.replace(/^@media\s*/i, '')) : null;
        rules.push({ text, media, state, source, mediaOn });
      }
    };
    collect(parseCssBlocks(joinCss([gen])).blocks, '', 'layer');
    if (doc.styles?.pageCss) collect(parseCssBlocks(doc.styles.pageCss).blocks, '', 'page');
    // ---- propriedades computadas: só as DECLARADAS (pela camada ou pelo CSS da página) + as essenciais. Sem isso
    // apareceriam valores herdados da interface do editor (fonte do app num frame) e lados calculados (right/bottom)
    const declared = new Set(Object.keys(nodeStyle(node, store.parentOf(id), store.state.doc.assets, { fluid: true })));
    const isTexty = node.type === 'text' || node.type === 'html';
    const isDeclared = (prop) => [...declared, ...pageRuleProps].some((d) => d === prop || prop.startsWith(`${d}-`) || d.startsWith(`${prop}-`));
    const groups = GROUPS.map(([title, props]) => {
      const rows = [];
      for (const prop of props) {
        const essential = KEEP.has(prop) && (title !== 'Tipografia' || isTexty);
        if (!essential && !isDeclared(prop)) continue;
        let val = cs.getPropertyValue(prop);
        if (!val) continue;
        val = val.trim();
        if (!KEEP.has(prop) && BORING.has(val)) continue;
        if (/^border-(top|right|bottom|left)$/.test(prop) && val.startsWith('0px')) continue;
        if (prop === 'outline-offset' && cs.outlineStyle === 'none') continue;
        if (prop === 'background-image' && val === 'none') continue;
        if (prop === 'font-family') val = val.split(',')[0].replace(/["']/g, '');
        if (prop === '-webkit-line-clamp' && val === 'none') continue;
        if (prop === 'z-index' && val === 'auto') continue;
        rows.push(h('div.insp-row', h('span.insp-k', prop), h('span.insp-v', { html: esc(val).replace(COLOR, (c) => `<i class="tk-sw" style="background:${c}"></i>${c}`), title: val })));
      }
      return group(title, rows);
    });

    const ruleEls = rules.map((rl) => h('div.insp-rule',
      h('div.insp-rule-head',
        h('span.insp-src', rl.source === 'page' ? 'CSS da página' : 'camada'),
        rl.state ? h('span.insp-badge.state', rl.state) : null,
        rl.media ? h('span.insp-badge' + (rl.mediaOn ? '.on' : ''), { title: rl.mediaOn ? 'Vale na largura atual da janela' : 'Não vale na largura atual' }, rl.media) : null),
      h('pre.insp-code', { html: highlightCss(rl.text) })));

    const copyCss = h('button.btn.small', {
      type: 'button', title: 'Copiar o CSS desta camada',
      onclick: async () => { try { await navigator.clipboard.writeText(commands.cssOf([node])); toast('CSS copiado!'); } catch { toast('O navegador bloqueou a cópia.'); } },
    }, ico('copy', 12), ' Copiar CSS');
    el.replaceChildren(
      h('header.insp-head',
        h('div.insp-name', h('b', tag), classes.length ? h('i', `.${classes.join('.')}`) : null, hid ? h('u', `#${hid}`) : null),
        h('span.insp-size', `${Math.round(r.width / z)} × ${Math.round(r.height / z)}`),
        iconButton(mini ? 'chevron' : 'minus', mini ? 'Mostrar o painel do inspetor' : 'Recolher o painel do inspetor', () => { mini = !mini; lastKey = ''; render(); }, 'small')),
      h('div.insp-actions', copyCss, h('span.insp-tip-text', 'Alt + mouse: distâncias')),
      boxModel,
      ...groups.filter(Boolean),
      group('Regras', ruleEls.length ? ruleEls : [h('p.muted', 'Nenhuma regra.')]),
    );
  }

  function group(title, rows) {
    if (!rows.length) return null;
    const d = h('details.insp-group', { open: openGroups.has(title) }, h('summary', title, h('span.insp-count', String(rows.length))), ...rows);
    d.addEventListener('toggle', () => { if (d.open) openGroups.add(title); else openGroups.delete(title); });
    return d;
  }

  store.subscribe((reasons) => {
    if (['doc', 'selection', 'tool', 'history', 'bp', 'view'].some((r) => reasons.has(r))) render();
  });
  return { el, render };
}

/** matchMedia sem quebrar com condições inválidas. */
function safeMatch(q) {
  try { return matchMedia(q).matches; } catch { return false; }
}
