/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/responsive.js — LARGURA DA TELA (Desktop · Tablet · Celular) E MODO DE COR
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Fica na barra do topo, em poucos ícones. Escolher Tablet ou Celular muda a VISÃO do documento inteiro para aquela
 *  largura: o que você editar no painel Design passa a valer só ali (vira uma regra `@media (max-width: …)` no CSS
 *  exportado) e o que não for mexido continua herdando do Desktop. Só o que é DIFERENTE do Desktop é guardado, em `node.bps`.
 *  No Desktop não aparece mais nada; em Tablet/Celular surge uma faixa fina no topo do canvas com o resumo e os atalhos.
 *
 *  O botão de lua/sol ao lado escolhe o MODO DE COR (claro/escuro...) visto no canvas e cria/renomeia/exclui modos.
 *
 *  A parte de dados (bpView/editBp) mora em model.js; o CSS é gerado em css.js (generateCode).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, tip } from './dom.js';
import { BREAKPOINTS, editBp, hasBps, walk } from '../model.js';
import { modesOf } from '../modes.js';
import { showMenu, askText } from './menus.js';

/**
 * Cria os controles. `topEl` vai para a barra superior; a faixa de resumo é pendurada no palco.
 * @param {{store, canvas, commands, toast: (m: string) => void, stage: HTMLElement}} deps
 * @returns {{topEl: HTMLElement, render: () => void}}
 */
export function createResponsiveBar({ store, canvas, commands, toast, stage }) {
  const ui = store.ui;
  const MODES = [
    { id: null, name: 'Desktop', icon: 'desktop', css: 'Sem @media: este é o desenho base.', text: 'O desenho base, na largura em que você desenhou. Tablet e Celular herdam dele e só guardam o que for diferente.' },
    ...BREAKPOINTS.map((b) => ({
      id: b.id, name: b.name, icon: b.id === 'tablet' ? 'tablet' : 'phone', css: `@media (max-width: ${b.max}px) { … }`,
      text: `Como fica em janelas de até ${b.max}px. Tudo que você mudar no painel Design neste modo vale só aqui${b.id === 'mobile' ? ' (e herda do Tablet o que não mexer)' : ''}.`,
    })),
  ];
  const seg = h('div.bp-seg', { role: 'group', 'aria-label': 'Largura da tela' }, MODES.map((m) => tip(h('button.bp-btn', {
    type: 'button', dataset: { bp: m.id || 'desktop' }, 'aria-label': m.name, onclick: () => store.setBp(m.id),
  }, ico(m.icon, 15), h('span', m.name)), { title: `${m.name}${m.id ? ` · até ${BREAKPOINTS.find((b) => b.id === m.id).max}px` : ''}`, css: m.css, text: m.text })));
  // ---- modo de cor (claro/escuro...): um botão só, com menu
  const modeBtn = h('button.bp-btn.mode-btn', { type: 'button', 'aria-haspopup': 'menu', 'aria-label': 'Modo de cor', onclick: (e) => modeMenu(e) });
  const topEl = h('div.bp-top', seg, h('span.bp-sep'), modeBtn);
  // ---- faixa de resumo (só em Tablet/Celular)
  const strip = h('div.bp-strip', { hidden: true });
  stage.append(strip);

  /** Quantas camadas da página têm sobrescritas neste breakpoint. */
  function countOverrides(bp) {
    let n = 0;
    walk(store.page().children, (x) => { if (hasBps(x, bp)) n++; });
    return n;
  }

  /** Ajusta a largura das telas (frames da raiz e dentro de seções) para a largura típica do modo. */
  function fitScreens() {
    const b = BREAKPOINTS.find((x) => x.id === ui.bp);
    if (!b) return;
    const frames = [];
    for (const n of store.page().children) {
      if (n.type === 'frame') frames.push(n);
      else if (n.type === 'section') frames.push(...n.children.filter((c) => c.type === 'frame'));
    }
    if (!frames.length) { toast('Não há telas (frames) nesta página.'); return; }
    store.update(() => frames.forEach((f) => editBp(f, b.id, (d) => { d.w = b.preview; d.sizeX = 'fixed'; })), { commit: true });
    canvas.fit(null);
    toast(`${frames.length} ${frames.length === 1 ? 'tela ajustada' : 'telas ajustadas'} para ${b.preview}px`);
  }

  /** Cria um modo de cor a partir de uma opção do menu. */
  async function makeMode(opts) {
    const name = opts.name || await askText({ title: 'Novo modo de cor', label: 'Nome do modo (ex.: Escuro, Alto contraste)', value: `Modo ${modesOf(store.state.doc.styles).length + 2}`, confirm: 'Criar' });
    if (name) commands.addColorMode({ ...opts, name });
  }

  /** Menu único do modo de cor: escolher o modo visto, criar um novo e, no modo ativo, renomear/excluir. */
  function modeMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const modes = modesOf(store.state.doc.styles);
    const active = modes.find((m) => m.id === ui.mode);
    const items = [{ heading: true, label: 'Modo de cor' }];
    if (modes.length) {
      items.push({ label: 'Padrão', checked: !ui.mode, onClick: () => store.setMode(null) });
      for (const m of modes) items.push({ label: m.name, checked: ui.mode === m.id, onClick: () => store.setMode(m.id) });
      items.push('sep');
    }
    items.push(
      { label: 'Novo modo escuro (inverte as cores)', icon: 'moon', onClick: () => makeMode({ name: 'Escuro', scheme: 'dark', auto: true }) },
      { label: 'Novo modo em branco…', icon: 'plus', onClick: () => makeMode({}) },
    );
    if (active) {
      items.push('sep',
        { label: `Renomear "${active.name}"`, onClick: async () => { const n = await askText({ title: 'Nome do modo', label: 'Nome do modo', value: active.name, confirm: 'Salvar' }); if (n) commands.renameColorMode(active.id, n); } },
        { label: 'Vale sozinho pela preferência do sistema', checked: active.scheme === 'dark', onClick: () => commands.setModeScheme(active.id, active.scheme === 'dark' ? null : 'dark') },
        { label: `Excluir "${active.name}"`, danger: true, icon: 'trash', onClick: () => commands.deleteColorMode(active.id) });
    }
    showMenu(r.left, r.bottom + 6, items);
  }

  function render() {
    // modos de cor
    const modes = modesOf(store.state.doc.styles);
    if (ui.mode && !modes.some((m) => m.id === ui.mode)) ui.mode = null; // o modo foi apagado (ou outro projeto aberto)
    const active = modes.find((m) => m.id === ui.mode);
    modeBtn.replaceChildren(ico(active ? 'moon' : 'sun', 15), ...(active ? [h('span', active.name)] : []));
    modeBtn.classList.toggle('on', !!active);
    tip(modeBtn, {
      title: active ? `Modo de cor: ${active.name}` : 'Modo de cor', css: ':root[data-theme="escuro"] {\n  --cor-fundo: #111;\n}',
      text: modes.length
        ? 'Escolha como o design é visto (cada estilo de cor pode ter um valor por modo), crie outro modo ou renomeie/exclua o ativo.'
        : 'Crie um modo Escuro: os estilos de cor ganham um valor por modo e o CSS exportado troca tudo com um atributo (ou sozinho, pela preferência do sistema).',
    });
    for (const btn of seg.querySelectorAll('.bp-btn')) btn.classList.toggle('on', btn.dataset.bp === (ui.bp || 'desktop'));
    document.body.classList.toggle('bp-active', !!ui.bp);
    document.body.dataset.bp = ui.bp || '';
    // faixa de resumo
    const b = BREAKPOINTS.find((x) => x.id === ui.bp);
    strip.hidden = !b;
    if (!b) { strip.replaceChildren(); return; }
    const count = countOverrides(b.id);
    strip.replaceChildren(
      h('span.bp-hint', h('b', b.name), ` · até ${b.max}px · ${count ? `${count} ${count === 1 ? 'camada ajustada' : 'camadas ajustadas'}` : 'nada ajustado ainda'}`),
      h('button.btn.small', { type: 'button', onclick: fitScreens, title: `Muda a largura das telas para ${b.preview}px só neste modo` }, ico('fit', 12), ` Telas em ${b.preview}px`));
  }

  store.subscribe((reasons) => { if (['bp', 'doc', 'history', 'selection'].some((r) => reasons.has(r))) render(); });
  render();
  return { topEl, render };
}
