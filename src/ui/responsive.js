/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/responsive.js — BARRA "DESKTOP · TABLET · CELULAR" (modo responsivo)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Flutua no topo do canvas. Escolher Tablet ou Celular muda a VISÃO do documento inteiro para aquela largura: o que
 *  você editar no painel Design passa a valer só ali (vira uma regra `@media (max-width: …)` no CSS exportado) e o
 *  que não for mexido continua herdando do Desktop. Só o que é DIFERENTE do Desktop é guardado, em `node.bps`.
 *
 *  A parte de dados (bpView/editBp) mora em model.js; o CSS é gerado em css.js (generateCode).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, tip } from './dom.js';
import { BREAKPOINTS, editBp, hasBps, walk } from '../model.js';
import { modesOf } from '../modes.js';
import { showMenu, askText } from './menus.js';

/**
 * Cria a barra e a pendura no palco.
 * @param {{store, canvas, toast: (m: string) => void, stage: HTMLElement}} deps
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
    type: 'button', dataset: { bp: m.id || 'desktop' }, onclick: () => store.setBp(m.id),
  }, ico(m.icon, 15), h('span', m.name)), { title: `${m.name}${m.id ? ` · até ${BREAKPOINTS.find((b) => b.id === m.id).max}px` : ''}`, css: m.css, text: m.text })));
  // ---- modo de cor (claro/escuro...): troca as cores dos estilos que têm valor por modo
  const modeSeg = h('div.bp-seg.modes', { role: 'group', 'aria-label': 'Modo de cor' });
  const info = h('div.bp-info');
  const bar = h('div.bp-bar', h('div.bp-row', seg, modeSeg), info);
  stage.append(bar);

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

  /** Menu "+ modo": cria um modo de cor. */
  function addModeMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const make = async (opts) => {
      const name = opts.name || await askText({ title: 'Novo modo de cor', label: 'Nome do modo (ex.: Escuro, Alto contraste)', value: `Modo ${modesOf(store.state.doc.styles).length + 2}`, confirm: 'Criar' });
      if (name) commands.addColorMode({ ...opts, name });
    };
    showMenu(r.left, r.bottom + 6, [
      { label: 'Escuro automático (inverte as cores)', icon: 'moon', onClick: () => make({ name: 'Escuro', scheme: 'dark', auto: true }) },
      { label: 'Modo em branco (ajusto as cores)', icon: 'plus', onClick: () => make({}) },
    ]);
  }
  /** Menu do modo ativo: renomear, automático pelo sistema, excluir. */
  function modeMenu(e, m) {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.bottom + 6, [
      { label: 'Renomear', onClick: async () => { const n = await askText({ title: 'Nome do modo', label: 'Nome do modo', value: m.name, confirm: 'Salvar' }); if (n) commands.renameColorMode(m.id, n); } },
      { label: 'Vale sozinho pela preferência do sistema', checked: m.scheme === 'dark', onClick: () => commands.setModeScheme(m.id, m.scheme === 'dark' ? null : 'dark') },
      'sep',
      { label: 'Excluir modo', danger: true, icon: 'trash', onClick: () => commands.deleteColorMode(m.id) },
    ]);
  }

  function render() {
    // modos de cor
    const modes = modesOf(store.state.doc.styles);
    if (ui.mode && !modes.some((m) => m.id === ui.mode)) ui.mode = null; // o modo foi apagado (ou outro projeto aberto)
    modeSeg.replaceChildren(
      ...(modes.length ? [
        tip(h('button.bp-btn' + (!ui.mode ? '.on' : ''), { type: 'button', onclick: () => store.setMode(null) }, ico('sun', 15), h('span', 'Padrão')), { title: 'Modo padrão', text: 'As cores dos estilos como você as definiu (normalmente o modo claro).' }),
        ...modes.map((m) => tip(h('button.bp-btn' + (ui.mode === m.id ? '.on' : ''), {
          type: 'button', onclick: () => store.setMode(m.id), oncontextmenu: (e) => { e.preventDefault(); modeMenu(e, m); },
        }, ico('moon', 15), h('span', m.name)), { title: `Modo ${m.name}`, text: 'Mostra o design com as cores deste modo. Edite uma cor de estilo (aba Recursos) com este modo ativo para dar a ela um valor próprio. Clique com o botão direito para renomear ou excluir.' })),
      ] : []),
      tip(h('button.bp-btn.add', { type: 'button', 'aria-label': 'Adicionar modo de cor', onclick: addModeMenu }, ico('plus', 14), modes.length ? null : h('span', 'Modo de cor')), {
        title: 'Modos de cor (claro/escuro)', css: ':root[data-theme="escuro"] {\n  --cor-fundo: #111;\n}',
        text: 'Crie um modo Escuro: os estilos de cor ganham um valor por modo e o CSS exportado troca tudo com um atributo (ou sozinho, pela preferência do sistema).',
      }),
    );
    for (const btn of seg.querySelectorAll('.bp-btn')) btn.classList.toggle('on', btn.dataset.bp === (ui.bp || 'desktop'));
    document.body.classList.toggle('bp-active', !!ui.bp);
    document.body.dataset.bp = ui.bp || '';
    const b = BREAKPOINTS.find((x) => x.id === ui.bp);
    if (!b) { info.replaceChildren(h('span.bp-hint', 'Desenhe no Desktop; use Tablet e Celular para adaptar.')); return; }
    const count = countOverrides(b.id);
    info.replaceChildren(
      h('span.bp-hint', h('b', `${b.name} · até ${b.max}px`), ` — ${count ? `${count} ${count === 1 ? 'camada ajustada' : 'camadas ajustadas'}` : 'nada ajustado ainda'}. Edite pelo painel Design.`),
      h('button.btn.small', { type: 'button', onclick: fitScreens, title: `Muda a largura das telas para ${b.preview}px só neste modo` }, ico('fit', 12), ` Telas em ${b.preview}px`));
  }

  store.subscribe((reasons) => { if (['bp', 'doc', 'history', 'selection'].some((r) => reasons.has(r))) render(); });
  render();
  return { render };
}
