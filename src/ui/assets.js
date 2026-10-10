/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/assets.js — ABA "RECURSOS" (COMPONENTES E ESTILOS)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton } from './dom.js';
import { openColorPicker, colorPickerAnchor } from './colorpicker.js';
import { syncStyles } from '../components.js';
import { styleValue, setStyleColor, modesOf, varsOf } from '../modes.js';
import { ask, askText, showMenu } from './menus.js';
import { getPalettes, onPalettes, changePalette, createPalette, deletePalette, addColor as addToPalette, removeColor, parseColors, docColors, paletteCss } from '../palettes.js';
import { rgba } from '../css.js';
import { walk, defaultFill, defaultStroke, slugify } from '../model.js';
import { toSvg } from '../svg.js';
import { createPhotosPanel } from './photos.js';
import { imageAssetCatalog } from '../image-assets.js';
/** Nome da variável de CSS (o mesmo do código gerado). */
const cssSlug = (s) => slugify(s || 'variavel');

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
  const photos = createPhotosPanel({ store, commands, canvas, toast });

  /** Seção da lista: título, botão "+" opcional e linhas. */
  const section = (title, add, body) =>
    h('section.panel-section', h('header.section-head', h('span', title), add || null), h('div.section-body.list', body));

  /** Todos os componentes principais do documento (de qualquer página), com a página de cada um. */
  function components() {
    const list = [];
    for (const page of store.state.doc.pages) walk(page.children, (n) => { if (n.component) list.push({ n, page }); });
    return list;
  }

  /** Busca da biblioteca de componentes (lembrada entre redesenhos). */
  let compQuery = '';
  let imageQuery = '';
  /** Quantas cópias (instâncias) de cada componente existem no documento. */
  function usage() {
    const count = new Map();
    for (const page of store.state.doc.pages) walk(page.children, (x) => { if (x.instanceOf) count.set(x.instanceOf, (count.get(x.instanceOf) || 0) + 1); });
    return count;
  }
  /** Miniatura do componente (SVG do próprio desenho). Só para os da página aberta, que estão medidos no canvas. */
  function thumb(n, page) {
    if (page.id !== store.ui.pageId) return null;
    try {
      const svg = toSvg(n, { assets: store.state.doc.assets, boxOf: (c) => (c === n ? { x: 0, y: 0, w: n.w, h: n.h } : commands.localBox(c)) });
      return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
    } catch { return null; }
  }
  /** Grade de cards: miniatura, nome e usos. Clique insere uma cópia no centro; arrastar para o canvas também. */
  function componentGrid(comps) {
    const used = usage();
    const insert = (n, at) => commands.insertInstance(n.id, at || (() => { const r = canvas.vpRect(); return canvas.toWorld(r.left + r.width / 2, r.top + r.height / 2); })());
    const search = h('input.comp-search', { type: 'search', placeholder: 'Buscar componente', 'aria-label': 'Buscar componente', value: compQuery,
      oninput: (e) => { compQuery = e.target.value; filter(); }, onkeydown: (e) => e.stopPropagation() });
    const cards = comps.map(({ n, page }) => {
      const src = thumb(n, page);
      const uses = used.get(n.id) || 0;
      const card = h('button.comp-card', {
        type: 'button', draggable: true, dataset: { name: n.name.toLowerCase() },
        title: `Inserir “${n.name}” no centro da tela (ou arraste para o canvas)`,
        onclick: () => insert(n),
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', n.name); e.dataTransfer.effectAllowed = 'copy'; card.dataset.dragging = '1'; },
        ondragend: (e) => {
          delete card.dataset.dragging;
          const vp = canvas.vpRect();
          if (e.clientX >= vp.left && e.clientX <= vp.right && e.clientY >= vp.top && e.clientY <= vp.bottom) insert(n, canvas.toWorld(e.clientX, e.clientY));
        },
      },
      h('span.comp-thumb', src ? h('img', { src, alt: '' }) : ico('component', 20)),
      h('span.comp-name', n.name),
      h('span.comp-meta', `${uses ? `${uses} ${uses === 1 ? 'uso' : 'usos'}` : 'sem usos'} · ${page.name}`));
      return card;
    });
    const grid = h('div.comp-grid', cards);
    const empty = h('p.hint', { hidden: true }, 'Nenhum componente com esse nome.');
    const filter = () => {
      const q = compQuery.trim().toLowerCase();
      let shown = 0;
      for (const c of cards) { const ok = !q || c.dataset.name.includes(q); c.hidden = !ok; if (ok) shown++; }
      empty.hidden = shown > 0;
    };
    filter();
    return h('div.comp-lib', comps.length > 4 ? search : null, grid, empty);
  }

  /** Biblioteca das imagens já embutidas no projeto; o asset original é reutilizado ao inserir. */
  function imageGrid(doc) {
    const items = imageAssetCatalog(doc);
    if (!items.length) return [h('p.hint', 'Importe uma imagem pelo canvas ou pela biblioteca de fotos; ela ficará disponível aqui para reutilizar.')];
    const search = h('input.comp-search', { type: 'search', placeholder: 'Buscar imagem', 'aria-label': 'Buscar imagem', value: imageQuery,
      oninput: (e) => { imageQuery = e.target.value; filter(); }, onkeydown: (e) => e.stopPropagation() });
    const cards = items.map((asset) => {
      const src = doc.assets[asset.id];
      const card = h('button.image-asset-card', {
        type: 'button', draggable: true, dataset: { name: `${asset.name} ${asset.id} ${asset.format} ${asset.usedBy.map((x) => x.page).join(' ')}`.toLowerCase() },
        title: store.selected().some((n) => n.type !== 'group' && n.type !== 'section')
          ? `Aplicar “${asset.name}” à seleção (ou arraste para inserir)`
          : `Inserir “${asset.name}” no centro da tela (ou arraste para o canvas)`,
        onclick: () => {
          const nodes = store.selected().filter((n) => n.type !== 'group' && n.type !== 'section');
          if (nodes.length) {
            store.update(() => nodes.forEach((n) => { n.fill = { ...defaultFill(), type: 'image', assetId: asset.id, fit: 'cover', ...(asset.width ? { natW: asset.width } : {}), ...(asset.height ? { natH: asset.height } : {}) }; }));
            store.commit();
            toast?.(`Imagem aplicada a ${nodes.length === 1 ? '1 camada' : `${nodes.length} camadas`}.`);
          } else commands.insertImageAsset(asset.id).catch((err) => toast?.(err.message || 'Não consegui inserir a imagem.'));
        },
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', asset.id); e.dataTransfer.effectAllowed = 'copy'; card.dataset.dragging = '1'; },
        ondragend: (e) => {
          delete card.dataset.dragging;
          const vp = canvas.vpRect();
          if (e.clientX >= vp.left && e.clientX <= vp.right && e.clientY >= vp.top && e.clientY <= vp.bottom) {
            commands.insertImageAsset(asset.id, canvas.toWorld(e.clientX, e.clientY)).catch((err) => toast?.(err.message || 'Não consegui inserir a imagem.'));
          }
        },
      },
      h('span.image-asset-thumb', h('img', { src, alt: '', loading: 'lazy' })),
      h('span.comp-name', asset.name),
      h('span.comp-meta', `${asset.width && asset.height ? `${asset.width} × ${asset.height} · ` : ''}${asset.usageCount} ${asset.usageCount === 1 ? 'uso' : 'usos'} · ${asset.kb} KB`));
      return card;
    });
    const grid = h('div.image-asset-grid', cards);
    const empty = h('p.hint', { hidden: true }, 'Nenhuma imagem encontrada.');
    const filter = () => {
      const q = imageQuery.trim().toLowerCase();
      let shown = 0;
      for (const c of cards) { const ok = !q || c.dataset.name.includes(q); c.hidden = !ok; if (ok) shown++; }
      empty.hidden = shown > 0;
    };
    filter();
    return [items.length > 4 ? search : null, grid, empty];
  }

  /** Reconstrói as três listas a partir do documento (só roda com a aba aberta). */
  function render() {
    // com o seletor de cor aberto a partir de uma amostra daqui, não reconstrói a lista (o seletor fecharia)
    const pa = colorPickerAnchor();
    if (pa && el.contains(pa)) return;
    const doc = store.state.doc;
    const comps = components();
    const images = imageGrid(doc);
    const sel = () => store.selected();

    const compRows = comps.length ? [componentGrid(comps)] : [h('p.hint', 'Selecione um frame e aperte Ctrl+Alt+K para criar um componente reutilizável.')];

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
    }, (() => {
      // a amostra EDITA o estilo (no modo de cor ativo): mudou aqui, muda em todas as camadas ligadas
      const mode = modesOf(doc.styles).find((m) => m.id === ui.mode);
      const cur = styleValue(c, ui.mode);
      const sw = h('button.asset-swatch', {
        type: 'button', style: { background: rgba(cur.color, cur.opacity) }, 'aria-label': `Editar a cor ${c.name}`,
        title: mode ? `Editar a cor no modo ${mode.name}` : 'Editar a cor (muda em todas as camadas ligadas)',
        onclick: (e) => {
          e.stopPropagation();
          const live = (fn) => { store.update(() => { fn(); syncStyles(store.state.doc); }, { structural: false }); const v = styleValue(c, ui.mode); sw.style.background = rgba(v.color, v.opacity); };
          openColorPicker({
            anchor: sw, get: () => styleValue(c, ui.mode).color, commit: () => store.commit(),
            set: (hex) => live(() => setStyleColor(c, ui.mode, hex)),
            opacity: () => styleValue(c, ui.mode).opacity, setOpacity: (o) => live(() => setStyleColor(c, ui.mode, styleValue(c, ui.mode).color, o)),
            onClose: () => render(),
          });
        },
      });
      return sw;
    })(),
    h('span.asset-name', c.name), h('span.muted.mono', styleValue(c, ui.mode).color),
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

    // ---- variáveis de tamanho (espaçamentos, raios, tamanhos de fonte)
    const varRows = varsOf(doc.styles).map((v) => {
      const input = h('input.text.mono.var-val', { type: 'text', inputmode: 'decimal', value: String(v.value), 'aria-label': `Valor de ${v.name}` });
      input.addEventListener('focus', () => input.select());
      input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
      input.addEventListener('change', () => { const n = Number(String(input.value).replace(',', '.')); if (Number.isFinite(n)) commands.setSizeVar(v.id, { value: n }); else input.value = String(v.value); });
      return h('div.asset-row.var-row',
        h('button.var-name', {
          type: 'button', title: 'Clique para renomear',
          onclick: async () => { const n = await askText({ title: 'Nome da variável', label: 'Nome da variável', value: v.name, confirm: 'Salvar' }); if (n) commands.setSizeVar(v.id, { name: n }); },
        }, h('span', v.name), h('code', `--${cssSlug(v.name)}`)),
        input, h('span.muted', 'px'),
        iconButton('x', 'Excluir variável (as camadas mantêm o valor)', () => commands.deleteSizeVar(v.id), 'small'));
    });
    const addVarBtn = iconButton('plus', 'Nova variável', async () => {
      const name = await askText({ title: 'Nova variável', label: 'Nome (ex.: Espaço médio, Raio dos cards)', value: `Variável ${varsOf(doc.styles).length + 1}`, confirm: 'Criar' });
      if (!name) return;
      const value = await askText({ title: 'Valor da variável', label: 'Valor em pixels', value: '16', confirm: 'Criar' });
      if (value == null) return;
      commands.addSizeVar(name, Number(String(value).replace(',', '.')) || 0);
    }, 'small');

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
      section('Fotos', null, [photos.el]),
      section('Imagens do projeto', null, images),
      section('Componentes', null, compRows),
      section('Cores', addColor, colorRows.length ? colorRows : [h('p.hint', 'Crie estilos de cor: mudou aqui, muda em todas as camadas.')]),
      section('Variáveis', addVarBtn, varRows.length ? varRows : [h('p.hint', 'Números reutilizáveis (espaçamento, raio, fonte). Ligue um campo do painel Design a uma variável: mudou aqui, muda em todas as camadas, e o CSS usa var(--nome).')]),
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
