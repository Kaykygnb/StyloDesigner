/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/code.js — ABA "CÓDIGO" (CSS E HTML DA SELEÇÃO)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { generateCode } from '../css.js';

/** Escapa & < > para exibir código dentro de <pre> sem o navegador interpretar como HTML. */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Colore o CSS (só visual): seletor `.classe`, nome da propriedade, números/unidades e cores #hex.
 * Cada etapa escapa o HTML antes de inserir os <span> de cor, então o texto do usuário nunca vira marcação.
 */
function highlightCss(code) {
  return esc(code)
    .replace(/^(\.[\w-]+)( \{)/gm, '<span class="tk-sel">$1</span>$2')
    .replace(/^(\s+)([\w-]+)(:)/gm, '$1<span class="tk-prop">$2</span>$3')
    .replace(/(-?\d+\.?\d*)(px|deg|%|ms|s)?(?=[\s;,)]|$)/g, '<span class="tk-num">$1$2</span>')
    .replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span class="tk-num">$1</span>');
}

/** Colore o HTML (só visual): nomes de tag e atributos/valores. */
function highlightHtml(code) {
  return esc(code)
    .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tk-sel">$2</span>')
    .replace(/([\w-]+)=(&quot;|")(.*?)(&quot;|")/g, '<span class="tk-prop">$1</span>=<span class="tk-str">"$3"</span>');
}

/**
 * Cria o painel CÓDIGO: mostra o CSS ou o HTML REAIS da seleção (ou da página inteira, se nada está selecionado).
 * É a mesma saída de `generateCode` usada na exportação, então o que você copia aqui é o que o navegador está usando.
 * Opção "Incluir filhos" liga/desliga as camadas internas; "Copiar" manda para a área de transferência.
 */
export function createCodePanel({ store, commands, toast }) {
  const ui = store.ui;
  // tab: 'css' | 'html' · children: incluir camadas filhas?
  let tab = 'css';
  let children = true;

  const pre = h('pre.code-view');
  const cssBtn = h('button.tab-chip', { type: 'button', onclick: () => { tab = 'css'; render(); } }, 'CSS');
  const htmlBtn = h('button.tab-chip', { type: 'button', onclick: () => { tab = 'html'; render(); } }, 'HTML');
  const kids = h('input', { type: 'checkbox', checked: true });
  kids.addEventListener('change', () => { children = kids.checked; render(); });
  // último código gerado (é o que o botão Copiar copia)
  let current = '';
  const copy = h('button.btn', {
    type: 'button',
    onclick: async () => {
      try { await navigator.clipboard.writeText(current); toast('Código copiado!'); } catch { toast('O navegador bloqueou a cópia.'); }
    },
  }, ico('copy', 14), ' Copiar');
  const title = h('span.code-title');
  const el = h('div.code-panel',
    h('div.code-head', h('div.tab-chips', cssBtn, htmlBtn), copy),
    h('div.code-sub', title, h('label.check.inline', kids, h('span.box', ico('check', 10)), h('span', 'Incluir filhos'))),
    pre);

  /** Gera o código das camadas-alvo e mostra colorido. Só roda com a aba Código aberta (ver subscribe abaixo). */
  function render() {
    cssBtn.classList.toggle('on', tab === 'css');
    htmlBtn.classList.toggle('on', tab === 'html');
    const sel = commands.topSelection();
    const targets = sel.length ? sel : store.page().children;
    title.textContent = sel.length ? (sel.length === 1 ? sel[0].name : `${sel.length} camadas`) : `${store.page().name} (tudo)`;
    const assets = store.state.doc.assets;
    const parts = targets.map((n) => {
      const node = children ? n : { ...n, children: n.children ? [] : undefined };
      return generateCode([node], store.parentOf(n.id), assets);
    });
    const code = parts.map((p) => (tab === 'css' ? p.css : p.html)).filter(Boolean).join(tab === 'css' ? '\n\n' : '\n');
    current = code;
    pre.innerHTML = code ? (tab === 'css' ? highlightCss(code) : highlightHtml(code)) : '<span class="muted">Nada para mostrar.</span>';
  }

  // atualiza ao vivo quando a aba está aberta e algo muda
  store.subscribe((reasons) => {
    if (ui.rightTab === 'code' && ['doc', 'selection', 'history'].some((r) => reasons.has(r))) render();
  });
  return { el, render };
}
