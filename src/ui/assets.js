// Aba "Recursos": componentes e estilos compartilhados do documento (cores e tipografia).
import { h, ico, iconButton } from './dom.js';
import { rgba } from '../css.js';
import { walk, defaultFill } from '../model.js';

export function createAssetsPanel({ store, commands, canvas, container }) {
  const ui = store.ui;
  const el = h('div.assets');
  container.append(el);

  const section = (title, add, body) =>
    h('section.panel-section', h('header.section-head', h('span', title), add || null), h('div.section-body.list', body));

  function components() {
    const list = [];
    for (const page of store.state.doc.pages) walk(page.children, (n) => { if (n.component) list.push({ n, page }); });
    return list;
  }

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
      iconButton('more', 'Renomear', (e) => {
        e.stopPropagation();
        const name = prompt('Nome do estilo:', c.name);
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
      iconButton('more', 'Renomear', (e) => {
        e.stopPropagation();
        const name = prompt('Nome do estilo:', t.name);
        if (name) { t.name = name; store.commit(); }
      }, 'small'),
      iconButton('x', 'Excluir estilo', (e) => { e.stopPropagation(); commands.removeStyle('texts', t.id); }, 'small'))));

    const addColor = iconButton('plus', 'Criar estilo de cor da seleção', () => {
      const n = sel().find((x) => x.fill?.type === 'solid');
      if (!n) return alert('Selecione uma camada com preenchimento de cor sólida.');
      const name = prompt('Nome do estilo de cor:', `Cor ${doc.styles.colors.length + 1}`);
      if (name) commands.addColorStyle(n, name);
    }, 'small');
    const addText = iconButton('plus', 'Criar estilo de texto da seleção', () => {
      const n = sel().find((x) => x.type === 'text');
      if (!n) return alert('Selecione uma camada de texto.');
      const name = prompt('Nome do estilo de texto:', `Texto ${doc.styles.texts.length + 1}`);
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
