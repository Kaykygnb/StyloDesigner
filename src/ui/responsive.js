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
import { BREAKPOINTS, BREAKPOINT_PRESETS, bpIcon, editBp, hasBps, setBreakpoints, uid, walk } from '../model.js';
import { modesOf } from '../modes.js';
import { showMenu, askText, ask } from './menus.js';

/**
 * Cria os controles. `topEl` vai para a barra superior; a faixa de resumo é pendurada no palco.
 * @param {{store, canvas, commands, toast: (m: string) => void, stage: HTMLElement}} deps
 * @returns {{topEl: HTMLElement, render: () => void}}
 */
export function createResponsiveBar({ store, canvas, commands, toast, stage }) {
  const ui = store.ui;
  const DESKTOP = { id: null, name: 'Desktop', icon: 'desktop', css: 'Sem @media: este é o desenho base.', text: 'O desenho base, na largura em que você desenhou. Os outros breakpoints herdam dele e só guardam o que for diferente.' };
  /** Botão de um modo (Desktop ou breakpoint). Só o ativo mostra o nome; todos mostram a largura no balão. */
  const modeButton = (m, i) => tip(h('button.bp-btn', {
    type: 'button', dataset: { bp: m.id || 'desktop' }, 'aria-label': m.name, onclick: () => store.setBp(m.id),
  }, ico(m.icon, 15), h('span', m.name)), {
    title: m.id ? `${m.name} · até ${m.max}px` : 'Desktop · desenho base', css: m.css || `@media (max-width: ${m.max}px) { … }`,
    text: m.text || `Como fica em janelas de até ${m.max}px. Tudo que você mudar no painel Design neste modo vale só aqui${i > 0 ? ' (e herda dos breakpoints maiores o que não mexer)' : ''}.`,
  });
  const seg = h('div.bp-seg', { role: 'group', 'aria-label': 'Largura da tela' });
  const more = h('button.bp-more', { type: 'button', 'aria-haspopup': 'menu', 'aria-label': 'Breakpoints: adicionar, renomear ou remover', title: 'Breakpoints', onclick: (e) => bpMenu(e) }, ico('chevron', 12));
  const width = h('span.bp-width', { 'aria-live': 'polite' });
  let segKey = '';
  /** Refaz os botões quando a lista de breakpoints muda. */
  function buildSeg() {
    const key = BREAKPOINTS.map((b) => `${b.id}:${b.name}:${b.max}`).join('|');
    if (key === segKey) return;
    segKey = key;
    seg.replaceChildren(modeButton(DESKTOP, -1), ...BREAKPOINTS.map((b, i) => modeButton({ ...b, icon: bpIcon(b) }, i)));
  }

  /** Grava a lista de breakpoints no documento (com desfazer). `drop`: id cujos ajustes são apagados das camadas. */
  function saveBps(list, drop) {
    store.update(() => {
      const doc = store.state.doc;
      if (drop) for (const page of doc.pages) walk(page.children, (n) => { if (n.bps?.[drop]) { delete n.bps[drop]; if (!Object.keys(n.bps).length) delete n.bps; } });
      doc.breakpoints = setBreakpoints(list).map((b) => ({ ...b }));
    }, { commit: true });
    if (drop && ui.bp === drop) store.setBp(null);
  }
  const askWidth = async (title, value) => {
    const v = await askText({ title, label: 'Até quantos px de largura de janela (max-width)', value: String(value), confirm: 'Salvar' });
    const n = Math.round(Number(String(v ?? '').replace(/px/i, '')));
    if (v == null) return null;
    if (!(n >= 200 && n <= 4000)) { toast('Use uma largura entre 200 e 4000 px.'); return null; }
    if (BREAKPOINTS.some((b) => b.max === n)) { toast(`Já existe um breakpoint em ${n}px.`); return null; }
    return n;
  };
  async function addCustom() {
    const name = await askText({ title: 'Novo breakpoint', label: 'Nome (ex.: Dobra do iPad, TV)', value: 'Personalizado', confirm: 'Continuar' });
    if (!name) return;
    const max = await askWidth(`Largura de "${name}"`, 900);
    if (!max) return;
    const id = `bp-${uid().slice(-6)}`;
    saveBps([...BREAKPOINTS, { id, name, max, preview: max }]);
    store.setBp(id);
    toast(`Breakpoint "${name}" criado: @media (max-width: ${max}px)`);
  }
  /** Menu de breakpoints: adicionar presets ou um personalizado; renomear, mudar a largura ou remover os do projeto. */
  function bpMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const items = [{ heading: true, label: 'Breakpoints do projeto' }];
    for (const b of BREAKPOINTS) items.push({ label: `${b.name} · até ${b.max}px`, icon: bpIcon(b), checked: ui.bp === b.id, onClick: () => editMenu(b, r) });
    const missing = BREAKPOINT_PRESETS.filter((p) => !BREAKPOINTS.some((b) => b.id === p.id || b.max === p.max));
    items.push('sep', { heading: true, label: 'Adicionar' });
    for (const p of missing) items.push({ label: `${p.name} · até ${p.max}px`, icon: 'plus', onClick: () => { saveBps([...BREAKPOINTS, p]); store.setBp(p.id); } });
    items.push({ label: 'Personalizado…', icon: 'plus', onClick: addCustom });
    showMenu(r.left, r.bottom + 6, items);
  }
  function editMenu(b, r) {
    const count = countOverrides(b.id, true);
    showMenu(r.left, r.bottom + 6, [
      { heading: true, label: `${b.name} · @media (max-width: ${b.max}px)` },
      { label: 'Ver e editar neste breakpoint', onClick: () => store.setBp(b.id) },
      { label: 'Renomear…', onClick: async () => { const n = await askText({ title: 'Nome do breakpoint', label: 'Nome', value: b.name, confirm: 'Salvar' }); if (n) saveBps(BREAKPOINTS.map((x) => (x.id === b.id ? { ...x, name: n } : x))); } },
      { label: 'Mudar largura…', onClick: async () => { const n = await askWidth(`Largura de "${b.name}"`, b.max); if (n) saveBps(BREAKPOINTS.map((x) => (x.id === b.id ? { ...x, max: n, preview: Math.min(x.preview, n) } : x))); } },
      'sep',
      { label: `Remover${count ? ` (apaga ${count} ${count === 1 ? 'ajuste' : 'ajustes'})` : ''}`, icon: 'trash', danger: true, onClick: async () => {
        if (count && !(await ask({ title: `Remover "${b.name}"?`, message: `${count} ${count === 1 ? 'camada perde' : 'camadas perdem'} os ajustes deste breakpoint. Dá para desfazer com Ctrl+Z.`, buttons: [{ label: 'Cancelar', value: null }, { label: 'Remover', value: true, primary: true, danger: true }] }))) return;
        saveBps(BREAKPOINTS.filter((x) => x.id !== b.id), b.id);
      } },
    ]);
  }
  // ---- modo de cor (claro/escuro...): um botão só, com menu
  const modeBtn = h('button.bp-btn.mode-btn', { type: 'button', 'aria-haspopup': 'menu', 'aria-label': 'Modo de cor', onclick: (e) => modeMenu(e) });
  const topEl = h('div.bp-top', seg, more, width, h('span.bp-sep'), modeBtn);
  // ---- faixa de resumo (só em Tablet/Celular)
  const strip = h('div.bp-strip', { hidden: true });
  stage.append(strip);

  /** Quantas camadas da página têm sobrescritas neste breakpoint. */
  function countOverrides(bp, all = false) {
    let n = 0;
    for (const page of all ? store.state.doc.pages : [store.page()]) walk(page.children, (x) => { if (hasBps(x, bp)) n++; });
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
    buildSeg();
    const cur = BREAKPOINTS.find((x) => x.id === ui.bp);
    width.textContent = cur ? `≤ ${cur.max}` : '';
    width.hidden = !cur;
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
  buildSeg();
  render();
  return { topEl, render };
}
