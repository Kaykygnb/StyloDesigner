/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/assets.js — ABA "RECURSOS" (COMPONENTES E ESTILOS)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton } from './dom.js';
import { ask, askText, showMenu } from './menus.js';
import { getPalettes, onPalettes, changePalette, createPalette, deletePalette, addColor as addToPalette, removeColor, parseColors, docColors, paletteCss } from '../palettes.js';
import { rgba } from '../css.js';
import { walk, defaultFill, defaultStroke } from '../model.js';

/**
 * Cria a aba RECURSOS (painel esquerdo): três listas do documento —
 *  - Componentes: clicar insere uma instância no centro da tela
 *  - Cores: estilos de cor; clicar aplica à seleção; +, renomear e excluir
 *  - Tipografia: estilos de texto; idem
 * Mudar um estilo muda todas as camadas ligadas a ele (ver components.js → syncStyles).
 */
export function createAssetsPanel({ store, commands, canvas, container, toast }) {
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

    // ---- paletas próprias (salvas no navegador, valem em todos os projetos)
    const colorsOfSelection = () => docColors({ pages: [{ children: sel() }] });
    /** Aplica uma cor da paleta à seleção: preenchimento (ou contorno, com Shift). */
    const applyColor = (hex, asStroke) => {
      const nodes = sel().filter((n) => n.type !== 'group');
      if (!nodes.length) { toast?.('Selecione uma camada para pintar com esta cor.'); return; }
      store.update(() => nodes.forEach((n) => {
        if (asStroke && n.type !== 'text') { n.stroke ||= defaultStroke(); n.stroke.color = hex; return; }
        if (n.fill.type !== 'solid') n.fill = defaultFill(hex);
        n.fill.color = hex;
        delete n.fill.styleId;
      }), { commit: true });
    };
    const copyText = async (text, okMsg) => {
      try { await navigator.clipboard.writeText(text); toast?.(okMsg); } catch { toast?.('Não consegui copiar.'); }
    };
    /** Pede uma lista de cores escrita/colada e devolve as válidas (ou null se cancelou). */
    const askColors = async (title) => {
      const text = await askText({ title, label: 'Cole as cores (#7C5CFF, 00C7BE, rgb(255,0,0)...)', value: '', confirm: 'Adicionar' });
      if (text == null) return null;
      const found = parseColors(text);
      if (!found.length) { toast?.('Não encontrei nenhuma cor nesse texto.'); return null; }
      return found;
    };
    const paletteCards = getPalettes().map((p) => h('div.pal-card', { dataset: { pal: p.id } },
      h('div.pal-head',
        h('span.pal-name', p.name), h('span.pal-count', String(p.colors.length)),
        iconButton('more', 'Mais ações da paleta', (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          showMenu(r.left, r.bottom + 4, [
            { label: 'Renomear', onClick: async () => { const n = await askText({ title: 'Nome da paleta', label: 'Nome da paleta', value: p.name, confirm: 'Salvar' }); if (n?.trim()) changePalette(p.id, (x) => { x.name = n.trim(); }); } },
            { label: 'Duplicar', onClick: () => createPalette(`${p.name} (cópia)`, p.colors) },
            { label: 'Copiar como variáveis CSS', icon: 'code', disabled: !p.colors.length, onClick: () => copyText(paletteCss(p), 'Variáveis CSS copiadas') },
            { label: 'Adicionar ao projeto como estilos de cor', disabled: !p.colors.length, onClick: () => { commands.addColorStyles(p.colors.map((c, i) => ({ name: `${p.name} ${i + 1}`, color: c }))); toast?.(`${p.colors.length} estilos de cor criados no projeto`); } },
            'sep',
            { label: 'Excluir paleta', danger: true, icon: 'trash', onClick: async () => { if (await ask({ title: 'Excluir paleta?', message: `A paleta "${p.name}" será apagada deste navegador.`, buttons: [{ label: 'Cancelar', value: false }, { label: 'Excluir', value: true, danger: true, primary: true }] })) deletePalette(p.id); } },
          ], { anchorRight: true });
        }, 'small')),
      h('div.pal-chips',
        p.colors.map((c) => h('button.pal-chip', {
          type: 'button', style: { background: c }, title: `${c} — clique: preenchimento · Shift+clique: contorno`, 'aria-label': `Aplicar ${c}`,
          onclick: (e) => applyColor(c, e.shiftKey),
        }, h('span.pal-x', {
          role: 'button', 'aria-label': `Tirar ${c} da paleta`, title: 'Tirar da paleta',
          onclick: (e) => { e.stopPropagation(); changePalette(p.id, (x) => removeColor(x, c)); },
        }, '×'))),
        h('button.pal-add-chip', {
          type: 'button', title: 'Adicionar cores a esta paleta', 'aria-label': 'Adicionar cores',
          onclick: (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const fromSel = colorsOfSelection();
            showMenu(r.left, r.bottom + 4, [
              { label: `Cores da seleção (${fromSel.length})`, disabled: !fromSel.length, onClick: () => changePalette(p.id, (x) => fromSel.forEach((c) => addToPalette(x, c))) },
              { label: 'Escrever ou colar cores…', onClick: async () => { const found = await askColors('Adicionar cores'); if (found) changePalette(p.id, (x) => found.forEach((c) => addToPalette(x, c))); } },
            ]);
          },
        }, ico('plus', 12)))));
    const newPalette = iconButton('plus', 'Nova paleta', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const fromSel = colorsOfSelection(), fromDoc = docColors(doc, 12);
      const make = async (colors) => {
        const name = await askText({ title: 'Nova paleta', label: 'Nome da paleta', value: `Paleta ${getPalettes().length + 1}`, confirm: 'Criar' });
        if (name == null) return;
        if (!createPalette(name, colors)) toast?.('Limite de paletas atingido.');
      };
      showMenu(r.left, r.bottom + 4, [
        { label: 'Paleta vazia', onClick: () => make([]) },
        { label: `Com as cores da seleção (${fromSel.length})`, disabled: !fromSel.length, onClick: () => make(fromSel) },
        { label: `Com as cores do projeto (${fromDoc.length})`, disabled: !fromDoc.length, onClick: () => make(fromDoc) },
        { label: 'Escrever ou colar cores…', onClick: async () => { const found = await askColors('Nova paleta'); if (found) make(found); } },
      ], { anchorRight: true });
    }, 'small');

    el.replaceChildren(
      section('Componentes', null, compRows),
      section('Cores', addColor, colorRows.length ? colorRows : [h('p.hint', 'Crie estilos de cor: mudou aqui, muda em todas as camadas.')]),
      section('Paletas', newPalette, paletteCards.length ? paletteCards : [h('p.hint', 'Suas paletas ficam salvas neste navegador e aparecem no seletor de cor de qualquer projeto. Crie uma com o +.')]),
      section('Tipografia', addText, textRows.length ? textRows : [h('p.hint', 'Crie estilos de texto a partir de uma camada de texto.')]),
    );
  }

  store.subscribe((reasons) => {
    if (ui.leftTab === 'assets' && ['doc', 'history', 'ui'].some((r) => reasons.has(r))) render();
  });
  onPalettes(() => { if (ui.leftTab === 'assets') render(); });
  return { el, render };
}
