/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/assets.js — ABA "RECURSOS" (COMPONENTES E ESTILOS)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton } from './dom.js';
import { ask, askText } from './menus.js';
import { rgba } from '../css.js';
import { walk, defaultFill } from '../model.js';

/**
 * Cria a aba RECURSOS (painel esquerdo): três listas do documento —
 *  - Componentes: clicar insere uma instância no centro da tela
 *  - Cores: estilos de cor; clicar aplica à seleção; +, renomear e excluir
 *  - Tipografia: estilos de texto; idem
 * Mudar um estilo muda todas as camadas ligadas a ele (ver components.js → syncStyles).
 */
export function createAssetsPanel({ store, commands, canvas, container }) {
  const ui = store.ui;
  const el = h('div.assets');
  container.append(el);

  /** Seção da lista: título, botão "+" opcional e linhas. */
  const section = (title, add, body) =>
    h('section.panel-section', h('header.section-head', h('span', title), add || null), h('div.section-body.list', body));

  /** Todos os componentes principais do documento (de qualquer página), com a página de cada um. */
  function components() {
    const list = [];
    for (const page of store.state.doc.pages) walk(page.children, (n) => { if (n.component) list.push({ n, page }); });
    return list;
  }

  /** Reconstrói as três listas a partir do documento (só roda com a aba aberta). */
  function render() {
    const doc = store.state.doc;
    const comps = components();
    const sel = () => store.selected();

    const compRows = comps.length
      ? comps.map(({ n, page }) => h('div.asset-row', {
        title: 'Clique para inserir uma instância no centro da tela',
        onclick: () => {
          const r = canvas.vpRect();
          commands.insertInstance(n.id, canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2));
        },
      }, h('span.asset-ico.comp', ico('component', 14)), h('span.asset-name', n.name), h('span.muted', page.name)))
      : [h('p.hint', 'Selecione um frame e aperte Ctrl+Alt+K para criar um componente reutilizável.')];

    const colorRows = doc.styles.colors.map((c) => h('div.asset-row', {
      title: 'Clique para aplicar à seleção',
      onclick: () => {
        const nodes = sel().filter((n) => n.type !== 'group');
        if (!nodes.length) return;
        store.update(() => nodes.forEach((n) => {
          if (n.fill.type !== 'solid') n.fill = defaultFill(c.color);
          n.fill.styleId = c.id;
        }), { commit: true });
      },
    }, h('span.asset-swatch', { style: { background: rgba(c.color, c.opacity) } }),
    h('span.asset-name', c.name), h('span.muted.mono', c.color),
    h('span.row-actions.show',
      iconButton('more', 'Renomear', async (e) => {
        e.stopPropagation();
        const name = await askText({ title: 'Nome do estilo', label: 'Nome do estilo', value: c.name, confirm: 'Salvar' });
        if (name) { c.name = name; store.commit(); }
      }, 'small'),
      iconButton('x', 'Excluir estilo', (e) => { e.stopPropagation(); commands.removeStyle('colors', c.id); }, 'small'))));

    const textRows = doc.styles.texts.map((t) => h('div.asset-row', {
      title: 'Clique para aplicar ao texto selecionado',
      onclick: () => {
        const nodes = sel().filter((n) => n.type === 'text');
        if (!nodes.length) return;
        store.update(() => nodes.forEach((n) => { n.textStyleId = t.id; }), { commit: true });
      },
    }, h('span.asset-ico', { style: { fontFamily: t.fontFamily, fontWeight: t.fontWeight, fontSize: '15px' } }, 'Aa'),
    h('span.asset-name', t.name), h('span.muted.mono', `${t.fontSize}/${t.fontWeight}`),
    h('span.row-actions.show',
      iconButton('more', 'Renomear', async (e) => {
        e.stopPropagation();
        const name = await askText({ title: 'Nome do estilo', label: 'Nome do estilo', value: t.name, confirm: 'Salvar' });
        if (name) { t.name = name; store.commit(); }
      }, 'small'),
      iconButton('x', 'Excluir estilo', (e) => { e.stopPropagation(); commands.removeStyle('texts', t.id); }, 'small'))));

    const addColor = iconButton('plus', 'Criar estilo de cor da seleção', async () => {
      const n = sel().find((x) => x.fill?.type === 'solid');
      if (!n) return ask({ title: 'Nada selecionado', message: 'Selecione uma camada com preenchimento de cor sólida.', buttons: [{ label: 'OK', value: true, primary: true }] });
      const name = await askText({ title: 'Nome do estilo de cor', label: 'Nome do estilo de cor', value: `Cor ${doc.styles.colors.length + 1}`, confirm: 'Salvar' });
      if (name) commands.addColorStyle(n, name);
    }, 'small');
    const addText = iconButton('plus', 'Criar estilo de texto da seleção', async () => {
      const n = sel().find((x) => x.type === 'text');
      if (!n) return ask({ title: 'Nada selecionado', message: 'Selecione uma camada de texto.', buttons: [{ label: 'OK', value: true, primary: true }] });
      const name = await askText({ title: 'Nome do estilo de texto', label: 'Nome do estilo de texto', value: `Texto ${doc.styles.texts.length + 1}`, confirm: 'Salvar' });
      if (name) commands.addTextStyle(n, name);
    }, 'small');

    el.replaceChildren(
      section('Componentes', null, compRows),
      section('Cores', addColor, colorRows.length ? colorRows : [h('p.hint', 'Crie estilos de cor: mudou aqui, muda em todas as camadas.')]),
      section('Tipografia', addText, textRows.length ? textRows : [h('p.hint', 'Crie estilos de texto a partir de uma camada de texto.')]),
    );
  }

  store.subscribe((reasons) => {
    if (ui.leftTab === 'assets' && ['doc', 'history', 'ui'].some((r) => reasons.has(r))) render();
  });
  return { el, render };
}
