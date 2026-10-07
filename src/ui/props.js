/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/props.js — PAINEL "DESIGN" (PROPRIEDADES DA SELEÇÃO)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Os campos usam os nomes do CSS (gap, padding, justify-content, align-items, opacity, mix-blend-mode...) de propósito:
 *  quem usa o painel aprende CSS sem perceber, e o código gerado bate com o que está escrito aqui.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton, numField, selectField, segmented, colorRow } from './dom.js';
import { askText } from './menus.js';
import { fontField } from './fontpicker.js';
import { ensureFonts, nearestWeight, weightsOf } from '../fonts.js';
import {
  BLEND_MODES, FONT_WEIGHTS, defaultFill, defaultShadow, defaultStroke, hasLayout, isFlow, resizeNode,
  constraintsOf,
} from '../model.js';
import { fillCss } from '../css.js';
import { exportHtmlFile, exportPng, exportSvgFile } from '../export.js';

/**
 * Cria o painel DESIGN (aba direita): editor das propriedades da seleção, com nomes e valores do CSS.
 *
 * COMO FUNCIONA (importante para entender o arquivo):
 *  - Cada seção (alinhar, camada, auto layout, texto, preenchimento, contorno, efeitos, exportar) é uma função que
 *    CONSTRÓI os campos uma vez e registra, em `updaters`, como RELER o valor de cada campo do documento.
 *  - `render()` só reconstrói os campos quando a ESTRUTURA muda (outra seleção, outro tipo de preenchimento, +1 sombra...),
 *    detectado pela `signature()`. Em qualquer outra mudança só roda os `updaters` — assim digitar num campo nunca
 *    perde o foco por o painel ter sido refeito.
 *  - Campos usam `each(fn)` para aplicar a mudança a TODAS as camadas selecionadas (valores mostrados vêm da 1ª).
 *
 * @param {{store, canvas, commands, tools, toast}} deps
 */
export function createDesignPanel({ store, canvas, commands, tools, toast }) {
  // atalho para o estado de interface
  const ui = store.ui;
  // el: raiz do painel (main.js a coloca na aba)
  const el = h('div.design-panel');
  // updaters: funções que releem os valores dos campos atuais · lastSig: assinatura da última estrutura montada
  let updaters = [];
  let lastSig = null;
  // estados de interface locais: mostrar os 4 cantos / os 4 paddings separados · escala escolhida na exportação
  let radiusExpanded = false;
  let paddingExpanded = false;
  let exportScale = 2;

  // ------------------------------------------------------------------ helpers
  // ---- ajudantes: ids/camadas selecionadas, a 1ª (P) e `each` que aplica uma mudança a todas (sem invalidar o índice do store) ----
  const ids = () => ui.selection.filter((id) => store.get(id));
  const nodes = () => ids().map((id) => store.get(id));
  const P = () => store.get(ids()[0]);
  const each = (fn) => store.update(() => nodes().forEach(fn), { structural: false });
  /** Fecha a edição (grava no histórico). Passado aos campos para chamarem ao terminar. */
  const commit = () => store.commit();
  /** Registra o `update` de um campo e devolve o elemento dele (para usar direto como filho). */
  const reg = (ctl) => { updaters.push(ctl.update); return ctl.el; };
  /** Linha horizontal de campos. */
  const row = (...c) => h('div.row', ...c);
  /** Seção do painel: título + (ações opcionais à direita, ex.: botão +) + corpo. */
  const section = (title, body, actions) =>
    h('section.panel-section', h('header.section-head', h('span', title), actions || null), h('div.section-body', body));

  // atalhos que ligam os componentes de dom.js ao painel (já registram o update e passam o commit)
  const num = (label, get, set, opts = {}) =>
    reg(numField({ label, get, set, commit, ...opts }));
  const select = (options, get, set, title, label) => reg(selectField({ options, get, set, commit, title, label }));

  /** Caixa de seleção (checkbox) estilizada: `get` lê, `set` aplica; grava no histórico ao alternar. */
  const check = (label, get, set) => {
    const input = h('input', { type: 'checkbox' });
    input.addEventListener('change', () => { set(input.checked); commit(); });
    updaters.push(() => { input.checked = !!get(); });
    return h('label.check', input, h('span.box', ico('check', 10)), h('span', label));
  };

  /** Abre o seletor de arquivos, importa a imagem escolhida (reduzida) e entrega { assetId, w, h } ao callback. */
  const pickImage = (cb) => {
    const input = h('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', async () => {
      if (!input.files[0]) return;
      try { cb(await commands.importAsset(input.files[0])); } catch { toast('Não consegui abrir a imagem.'); }
    });
    input.click();
  };

  // ------------------------------------------------------------------ seções
  /** Barra fixa no topo: alinhar (esquerda/centro/direita, topo/meio/base) e distribuir (precisa de 3+ camadas). */
  function alignSection() {
    const many = ids().length >= 3;
    const btn = (name, title, fn, disabled) =>
      h('button.icon-btn', { type: 'button', title, disabled, onclick: fn }, ico(name));
    return h('section.panel-section.align-section',
      h('div.align-row',
        btn('alignL', 'Alinhar à esquerda', () => commands.align('left')),
        btn('alignCH', 'Centralizar na horizontal', () => commands.align('hcenter')),
        btn('alignR', 'Alinhar à direita', () => commands.align('right')),
        h('span.sep'),
        btn('alignT', 'Alinhar ao topo', () => commands.align('top')),
        btn('alignCV', 'Centralizar na vertical', () => commands.align('vcenter')),
        btn('alignB', 'Alinhar embaixo', () => commands.align('bottom')),
        h('span.sep'),
        btn('distH', 'Distribuir na horizontal', () => commands.distribute('h'), !many),
        btn('distV', 'Distribuir na vertical', () => commands.distribute('v'), !many)));
  }

  /** Tamanhos prontos para frames da raiz (telas e formatos comuns). Valor "LxA". */
  const PRESETS = [
    ['', 'Tamanhos predefinidos…'], ['393x852', 'iPhone 15 — 393×852'], ['360x800', 'Android — 360×800'],
    ['820x1180', 'iPad — 820×1180'], ['1440x1024', 'Desktop — 1440×1024'], ['1280x800', 'Notebook — 1280×800'],
    ['1920x1080', 'Full HD / Slide — 1920×1080'], ['595x842', 'A4 — 595×842'],
    ['1080x1080', 'Post quadrado — 1080×1080'], ['1080x1920', 'Story — 1080×1920'],
  ];
  /** Opções de constraint horizontal e vertical (ver model.js → applyConstraints). */
  const H_CONS = [['left', 'Esquerda'], ['right', 'Direita'], ['leftright', 'Esquerda e direita'], ['center', 'Centro'], ['scale', 'Escala']];
  const V_CONS = [['top', 'Topo'], ['bottom', 'Base'], ['topbottom', 'Topo e base'], ['center', 'Centro'], ['scale', 'Escala']];
  /** Tipos que não têm cantos arredondados no painel (elipse já é redonda; texto/linha/vetor/grupo não têm cantos). */
  const NO_RADIUS = ['text', 'ellipse', 'group', 'line', 'path'];

  /**
   * Seção "Posição": X/Y (ou a caixa do conjunto, com várias camadas), constraints (em frame sem auto layout),
   * rotação e espelhar. Dentro de um auto layout, X/Y ficam apagados: quem posiciona é o navegador (flex/grid).
   */
  function positionSection() {
    const single = ids().length === 1;
    const n0 = P();
    const parent = store.parentOf(n0.id);
    const inFlow = isFlow(n0, parent);
    const body = [];
    if (!single) {
      // várias camadas: X/Y da caixa que envolve todas
      const box = () => canvas.unionAabb(commands.topSelection().map((n) => n.id)) || { x: 0, y: 0, w: 0, h: 0 };
      body.push(h('div.sub-label', `${ids().length} camadas selecionadas`),
        row(num('X', () => box().x, (v) => commands.setSelectionBox({ x: v }), { decimals: 1 }),
          num('Y', () => box().y, (v) => commands.setSelectionBox({ y: v }), { decimals: 1 })));
    } else {
      const posRow = row(
        num('X', () => P().x, (v) => each((n) => { n.x = v; }), { decimals: 1, title: 'left' }),
        num('Y', () => P().y, (v) => each((n) => { n.y = v; }), { decimals: 1, title: 'top' }));
      if (inFlow) {
        posRow.classList.add('disabled');
        posRow.title = 'Posição controlada pelo auto layout do pai';
      }
      body.push(posRow);
      if (parent?.type === 'frame' && !hasLayout(parent) && !n0.absolute) {
        body.push(row(
          select(H_CONS, () => constraintsOf(P()).h, (v) => each((n) => { n.constraints = { ...constraintsOf(n), h: v }; }), 'Constraint horizontal: como reage quando o frame muda de largura', '↔'),
          select(V_CONS, () => constraintsOf(P()).v, (v) => each((n) => { n.constraints = { ...constraintsOf(n), v: v }; }), 'Constraint vertical: como reage quando o frame muda de altura', '↕')));
      }
    }
    body.push(row(
      num('↻', () => P().rotation, (v) => each((n) => { n.rotation = v; }), { title: 'rotação (transform: rotate)', decimals: 1, min: -360, max: 360, unit: '°' }),
      h('div.btn-group',
        h('button.icon-btn.small' + (n0.flipX ? '.on' : ''), { type: 'button', title: 'Espelhar na horizontal (Shift+H)', onclick: () => commands.flip('x') }, ico('flipH', 14)),
        h('button.icon-btn.small' + (n0.flipY ? '.on' : ''), { type: 'button', title: 'Espelhar na vertical (Shift+V)', onclick: () => commands.flip('y') }, ico('flipV', 14)))));
    return section('Posição', body);
  }

  /**
   * Seção "Tamanho": W/H (+ travar proporção), modo de largura/altura (fixo / hug = do tamanho do conteúdo /
   * fill = preenche o espaço do auto layout) e, em frames da raiz, os tamanhos prontos (celular, desktop...).
   */
  function sizeSection() {
    const single = ids().length === 1;
    const n0 = P();
    const parent = store.parentOf(n0.id);
    const inFlow = isFlow(n0, parent);
    const body = [];
    if (!single) {
      const box = () => canvas.unionAabb(commands.topSelection().map((n) => n.id)) || { x: 0, y: 0, w: 0, h: 0 };
      body.push(row(num('W', () => box().w, (v) => commands.setSelectionBox({ w: v }), { min: 1, decimals: 1 }),
        num('H', () => box().h, (v) => commands.setSelectionBox({ h: v }), { min: 1, decimals: 1 })));
      return section('Tamanho', body);
    }
    body.push(row(
      num('W', () => P().w, (v) => each((n) => resizeNode(n, v, n.h, 'w')), { min: 1, title: 'width', decimals: 1 }),
      num('H', () => P().h, (v) => each((n) => resizeNode(n, n.w, v, 'h')), { min: 1, title: 'height', decimals: 1, disabled: n0.type === 'line' }),
      h('button.icon-btn.small' + (n0.lockRatio ? '.on' : ''), {
        type: 'button', title: 'Travar proporção',
        onclick: () => { each((n) => { n.lockRatio = !n.lockRatio; }); commit(); },
      }, ico('link', 14))));
    // modos de tamanho possíveis: 'hug' só para texto/frames com layout; 'fill' só dentro de um auto layout
    const sizeOpts = () => {
      const o = [['fixed', 'Fixo']];
      if (n0.type === 'text' || hasLayout(n0)) o.push(['hug', 'Hug']);
      if (inFlow) o.push(['fill', 'Fill']);
      return o;
    };
    if (sizeOpts().length > 1) {
      body.push(row(
        select(sizeOpts(), () => P().sizeX, (v) => each((n) => { n.sizeX = v; }), 'Largura: fixo (px) · hug (do tamanho do conteúdo) · fill (preenche o espaço do pai)', 'W'),
        select(sizeOpts(), () => P().sizeY, (v) => each((n) => { n.sizeY = v; }), 'Altura: fixo (px) · hug (do tamanho do conteúdo) · fill (preenche o espaço do pai)', 'H')));
    }
    if (n0.type === 'frame' && !parent) {
      body.push(select(PRESETS, () => '', (v) => {
        if (!v) return;
        const [w, hh] = v.split('x').map(Number);
        each((n) => { resizeNode(n, w, hh, 'w'); n.h = hh; n.sizeY = 'fixed'; });
      }, 'Predefinições de tamanho'));
    }
    return section('Tamanho', body);
  }

  /**
   * Seção "Aparência": opacidade, mistura (mix-blend-mode), cantos arredondados (border-radius, juntos ou um por
   * canto), cortar conteúdo (overflow: hidden) e máscara.
   */
  function appearanceSection() {
    const n0 = P();
    const parent = store.parentOf(n0.id);
    const body = [row(
      num('%', () => P().opacity * 100, (v) => each((n) => { n.opacity = v / 100; }), { min: 0, max: 100, decimals: 0, title: 'opacity' }),
      select(BLEND_MODES.map((m) => [m, m]), () => P().blend, (v) => each((n) => { n.blend = v; }), 'mix-blend-mode (mistura com o que está atrás)', '◐'))];
    const canRound = !NO_RADIUS.includes(n0.type);
    if (canRound) {
      body.push(row(
        num('◜', () => P().radius[0], (v) => each((n) => { n.radius = [v, v, v, v].map((x) => Math.max(0, x)); }),
          { title: 'border-radius (cantos arredondados)', min: 0, decimals: 1 }),
        h('button.icon-btn.small' + (radiusExpanded ? '.on' : ''), {
          type: 'button', title: 'Cantos independentes',
          onclick: () => { radiusExpanded = !radiusExpanded; lastSig = null; render(); },
        }, ico('corners', 14))));
      if (radiusExpanded) {
        const corner = (i, label, title) => num(label, () => P().radius[i], (v) => each((n) => { n.radius[i] = Math.max(0, v); }), { title, min: 0, decimals: 1 });
        body.push(row(corner(0, '↖', 'border-top-left-radius'), corner(1, '↗', 'border-top-right-radius')));
        body.push(row(corner(3, '↙', 'border-bottom-left-radius'), corner(2, '↘', 'border-bottom-right-radius')));
      }
    }
    if (n0.type === 'frame') body.push(check('Cortar conteúdo (overflow: hidden)', () => P().clip, (v) => each((n) => { n.clip = v; })));
    if (n0.isMask || parent?.type === 'group') {
      body.push(check('Usar como máscara (clip-path)', () => !!P().isMask, (v) => each((n) => { n.isMask = v; })));
    }
    return section('Aparência', body);
  }

  /** Seção "Componente": criar componente / (no principal) criar instância / (na instância) ir ao principal e desanexar. */
  function componentSection() {
    const n = P();
    const body = [];
    if (n.component) {
      body.push(h('div.badge.purple', ico('component', 13), ' Componente principal'),
        h('p.hint', 'Mudanças aqui atualizam todas as instâncias.'),
        h('button.btn', { type: 'button', onclick: () => commands.insertInstance(n.id) }, ico('plus', 13), ' Criar instância'));
    } else if (n.instanceOf) {
      const main = store.get(n.instanceOf);
      body.push(h('div.badge.purple', ico('component', 13), ` Instância de ${main?.name ?? '?'}`),
        row(
          h('button.btn', { type: 'button', onclick: () => commands.goToMain(n.id) }, 'Ir ao principal'),
          h('button.btn', { type: 'button', onclick: () => commands.detach() }, 'Desanexar')));
    } else {
      body.push(h('button.btn', { type: 'button', onclick: () => commands.createComponent() }, ico('component', 13), ' Criar componente'));
    }
    return section('Componente', body);
  }

  /**
   * Linha "propriedade CSS → controle": o nome da propriedade à esquerda (em fonte mono, igual ao código gerado)
   * e o campo à direita. Assim o painel lê como CSS: quem sabe CSS reconhece; quem não sabe aprende o nome certo.
   */
  const prop = (name, ctl, title) => h('div.prop-row', { title: title || '' }, h('span.prop-name', name), ctl);
  /** Opções de alinhamento (valores do modelo = os do flexbox; no grid o css.js traduz flex-start → start). */
  const A_START = ['flex-start', 'start'], A_CENTER = ['center', 'center'], A_END = ['flex-end', 'end'], A_STRETCH = ['stretch', 'stretch'];

  /**
   * Seção "Auto layout (CSS)" de um frame, organizada como as propriedades CSS que ela gera:
   *  - display: none (posição absoluta) / flex em linha / flex em coluna / grid;
   *  - FLEX: gap, flex-wrap, padding, justify-content (eixo principal) e align-items (eixo cruzado);
   *  - GRID: grid-template-columns/rows (quantas colunas/linhas), column-gap/row-gap, padding,
   *    justify-items/align-items (onde cada item fica DENTRO da sua célula) e um atalho "itens preenchem as células".
   * A matriz 3×3 continua como atalho visual para escolher os dois alinhamentos de uma vez.
   */
  function autoLayoutSection() {
    const n0 = P();
    const L = () => P().layout;
    const modeSeg = segmented({
      options: [
        ['none', 'none', 'Sem layout — camadas livres (position: absolute)'],
        ['row', 'row', 'display: flex; flex-direction: row (em linha)'],
        ['column', 'column', 'display: flex; flex-direction: column (em coluna)'],
        ['grid', 'grid', 'display: grid (grade de células)'],
      ],
      get: () => L().mode,
      set: (v) => store.update(() => commands.setLayoutMode(nodes(), v)),
      commit,
    });
    updaters.push(modeSeg.update);
    const mode = n0.layout.mode;
    const modeName = { none: 'nenhum', row: 'flex · linha', column: 'flex · coluna', grid: 'grid' }[mode];
    const body = [h('div.prop-head', h('span.prop-name', 'display')), h('div.prop-inline', modeSeg.el, h('span.prop-note', modeName))];
    if (mode === 'none') {
      body.push(h('p.hint', 'Sem layout: cada camada fica onde você a coloca (position: absolute). Escolha flex ou grid para o navegador organizar os filhos.'));
      return section('Auto layout (CSS)', body);
    }
    /** Campos de padding de vários lados (T/R/B/L = topo/direita/baixo/esquerda, mesma ordem do CSS). */
    const pad = (labels) => labels.map(([i, l, t]) =>
      num(l, () => L().padding[i], (v) => each((n) => { n.layout.padding[i] = Math.max(0, v); }), { title: t, min: 0, decimals: 0 }));
    // padding assimétrico (topo≠base ou esquerda≠direita) obriga a mostrar os 4 lados; senão mostra só horizontal/vertical
    const asym = n0.layout.padding[0] !== n0.layout.padding[2] || n0.layout.padding[1] !== n0.layout.padding[3];
    const showAll = paddingExpanded || asym;
    /** padding: ou 2 campos (horizontal/vertical) ou os 4 lados, alternável pelo botão. */
    const paddingBlock = () => [
      h('div.prop-head', h('span.prop-name', 'padding'),
        asym ? null : h('button.icon-btn.small' + (showAll ? '.on' : ''), {
          type: 'button', title: showAll ? 'Simplificar (horizontal/vertical)' : 'Padding por lado (top/right/bottom/left)',
          onclick: () => { paddingExpanded = !paddingExpanded; lastSig = null; render(); },
        }, ico('corners', 14))),
      ...(showAll
        ? [row(...pad([[0, 'T', 'padding-top'], [1, 'R', 'padding-right']])), row(...pad([[3, 'L', 'padding-left'], [2, 'B', 'padding-bottom']]))]
        : [row(
          num('↔', () => L().padding[3], (v) => each((n) => { n.layout.padding[1] = n.layout.padding[3] = Math.max(0, v); }), { title: 'padding horizontal (esquerda e direita)', min: 0, decimals: 0 }),
          num('↕', () => L().padding[0], (v) => each((n) => { n.layout.padding[0] = n.layout.padding[2] = Math.max(0, v); }), { title: 'padding vertical (topo e base)', min: 0, decimals: 0 }))]),
    ];
    /**
     * Matriz 3×3 do alinhamento: um clique define os dois alinhamentos de uma vez. Em coluna, o eixo principal é o
     * vertical, então linhas e colunas da matriz trocam de papel. A célula ativa é marcada quando os valores coincidem.
     */
    const matrix = (jName, aName) => {
      const col = mode === 'column';
      const three = [A_START, A_CENTER, A_END];
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const [mainI, crossI] = col ? [r, c] : [c, r];
          const j = three[mainI][0], a = three[crossI][0];
          const btn = h('button.am-cell', {
            type: 'button', title: `${jName}: ${three[mainI][1]}; ${aName}: ${three[crossI][1]}`,
            onclick: () => { each((n) => { n.layout.justify = j; n.layout.align = a; }); commit(); },
          }, h('i'));
          updaters.push(() => btn.classList.toggle('on', L().justify === j && L().align === a));
          cells.push(btn);
        }
      }
      return h('div.align-matrix', cells);
    };
    /** Opções de um <select> mostrando o valor CSS de verdade (ex.: "flex-start", "space-between"). */
    const opts = (list, grid) => list.map(([v, css]) => [v, grid ? css : v]);

    if (mode === 'grid') {
      const gridAligns = [A_START, A_CENTER, A_END, A_STRETCH];
      body.push(
        prop('grid-template-columns', num('col', () => L().cols ?? 2, (v) => each((n) => { n.layout.cols = Math.max(1, Math.round(v)); }),
          { title: 'quantas colunas: repeat(N, 1fr)', min: 1, decimals: 0 }), 'repeat(N, 1fr): N colunas de larguras iguais'),
        prop('grid-template-rows', num('lin', () => L().rows ?? 0, (v) => each((n) => { n.layout.rows = Math.max(0, Math.round(v)); }),
          { title: 'quantas linhas (0 = automático: cria linhas conforme precisar)', min: 0, decimals: 0 }), '0 = automático'),
        prop('gap', row(
          num('↔', () => L().colGap ?? 8, (v) => each((n) => { n.layout.colGap = Math.max(0, v); }), { title: 'column-gap (espaço entre colunas)', min: 0, decimals: 0 }),
          num('↕', () => L().rowGap ?? 8, (v) => each((n) => { n.layout.rowGap = Math.max(0, v); }), { title: 'row-gap (espaço entre linhas)', min: 0, decimals: 0 })),
        'column-gap / row-gap'),
        ...paddingBlock(),
        h('div.prop-head', h('span.prop-name', 'alinhamento dentro da célula')),
        row(matrix('justify-items', 'align-items'), h('div.col',
          h('div.sub-label', 'justify-items ↔'),
          select(opts(gridAligns, true), () => L().justify, (v) => each((n) => { n.layout.justify = v; }), 'justify-items: posição horizontal de cada item na célula'),
          h('div.sub-label', 'align-items ↕'),
          select(opts(gridAligns, true), () => L().align, (v) => each((n) => { n.layout.align = v; }), 'align-items: posição vertical de cada item na célula'))),
        h('button.btn', {
          type: 'button', title: 'Os itens passam a ocupar a célula inteira (largura e altura "Preencher" = justify-self/align-self: stretch)',
          onclick: () => {
            each((f) => f.children.forEach((c) => { if (!c.absolute) { c.sizeX = 'fill'; c.sizeY = 'fill'; } }));
            commit();
          },
        }, ico('grid', 13), ' Itens preenchem as células'));
    } else {
      const flexJustify = [A_START, A_CENTER, A_END, ['space-between', 'space-between'], ['space-around', 'space-around'], ['space-evenly', 'space-evenly']];
      const flexAlign = [A_START, A_CENTER, A_END, A_STRETCH, ['baseline', 'baseline']];
      const mainArrow = mode === 'row' ? '↔' : '↕', crossArrow = mode === 'row' ? '↕' : '↔';
      body.push(
        prop('gap', num(mainArrow, () => L().gap, (v) => each((n) => { n.layout.gap = Math.max(0, v); }), { title: 'gap: espaço entre os itens', min: 0, decimals: 0 })),
        prop('flex-wrap', check('wrap (quebra linha)', () => L().wrap, (v) => each((n) => { n.layout.wrap = v; })),
          'Quando não cabe, os itens descem para a próxima linha'),
        ...paddingBlock(),
        h('div.prop-head', h('span.prop-name', 'alinhamento')),
        row(matrix('justify-content', 'align-items'), h('div.col',
          h('div.sub-label', `justify-content ${mainArrow}`),
          select(opts(flexJustify), () => L().justify, (v) => each((n) => { n.layout.justify = v; }), 'justify-content: distribui os itens no eixo principal'),
          h('div.sub-label', `align-items ${crossArrow}`),
          select(opts(flexAlign), () => L().align, (v) => each((n) => { n.layout.align = v; }), 'align-items: alinha os itens no eixo cruzado'))));
    }
    return section('Auto layout (CSS)', body);
  }

  /**
   * Seção "Item do layout": só para camadas dentro de auto layout. Mostra as propriedades CSS do FILHO:
   *  - position: absolute (ignora o layout do pai);
   *  - grid → grid-column / grid-row (span N), justify-self e align-self (sobrescrevem o justify-items/align-items do pai);
   *  - flex → align-self (sobrescreve o align-items do pai).
   * "stretch" é o mesmo que tamanho "Preencher" naquele eixo, então os dois ficam ligados.
   */
  function flowItemSection() {
    const parent = store.parentOf(P().id);
    const grid = parent.layout.mode === 'grid';
    const body = [
      check('position: absolute (ignora o layout do pai)', () => P().absolute, (v) => each((n) => {
        if (v) {
          const o = commandsOrigin(n);
          n.x = o.x; n.y = o.y;
        }
        n.absolute = v;
      })),
    ];
    if (!P().absolute) {
      /** Select de *-self ligado ao tamanho: stretch ⇔ 'fill' no eixo; outro valor tira o 'fill'. */
      const selfSelect = (key, axis, list, title) => select(list,
        () => (P()[axis] === 'fill' ? 'stretch' : P()[key] || 'auto'),
        (v) => each((n) => {
          if (v === 'stretch') { n[axis] = 'fill'; n[key] = 'auto'; return; }
          if (n[axis] === 'fill') n[axis] = 'fixed';
          n[key] = v;
        }), title);
      const selfOpts = [['auto', 'auto'], A_START, A_CENTER, A_END, A_STRETCH].map(([v, css]) => [v, v === 'auto' ? css : (grid ? css : v)]);
      const cross = parent.layout.mode === 'row' ? 'sizeY' : 'sizeX';
      if (grid) {
        body.push(
          prop('grid-column', num('span', () => P().colSpan ?? 1, (v) => each((n) => { n.colSpan = Math.max(1, Math.round(v)); }),
            { title: 'grid-column: span N — quantas colunas o item ocupa', min: 1, decimals: 0 })),
          prop('grid-row', num('span', () => P().rowSpan ?? 1, (v) => each((n) => { n.rowSpan = Math.max(1, Math.round(v)); }),
            { title: 'grid-row: span N — quantas linhas o item ocupa', min: 1, decimals: 0 })),
          prop('justify-self', selfSelect('justifySelf', 'sizeX', selfOpts, 'justify-self: posição horizontal deste item na célula')),
          prop('align-self', selfSelect('alignSelf', 'sizeY', selfOpts, 'align-self: posição vertical deste item na célula')));
      } else {
        body.push(prop('align-self', selfSelect('alignSelf', cross, selfOpts, 'align-self: alinhamento deste item no eixo cruzado')));
      }
    }
    return section('Item do layout', body);
  }

  /** Posição atual da camada relativa ao pai (lida do DOM): usada ao marcar "absoluta" para ela não pular de lugar. */
  const commandsOrigin = (n) => {
    const parent = store.parentOf(n.id);
    const o = canvas.originOf(n.id);
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    return { x: Math.round(o.x - po.x), y: Math.round(o.y - po.y) };
  };

  /** Tipos de grade de layout (só guia visual). */
  const GRID_KINDS = [['columns', 'Colunas'], ['rows', 'Linhas'], ['grid', 'Quadrícula']];
  /** Seção "Grades de layout" de um frame: lista de grades (colunas/linhas/quadrícula) com quantidade, gutter, margem e cor. */
  function layoutGridsSection() {
    const n0 = P();
    const add = iconButton('plus', 'Adicionar grade de layout', () => {
      each((n) => { (n.grids ||= []).push({ type: 'columns', count: 12, gutter: 16, margin: 24, size: 8, color: '#FF3D3D', opacity: 0.12 }); });
      commit();
    }, 'small');
    const body = [];
    (n0.grids || []).forEach((_, i) => {
      const g = () => P().grids[i] || {};
      const set = (k) => (v) => each((n) => { if (n.grids[i]) n.grids[i][k] = v; });
      body.push(h('div.effect-card',
        select(GRID_KINDS, () => g().type, set('type'), 'Tipo de grade'),
        g().type === 'grid'
          ? row(num('▦', () => g().size, (v) => set('size')(Math.max(2, v)), { title: 'tamanho da célula', min: 2, decimals: 0 }))
          : [row(num('#', () => g().count, (v) => set('count')(Math.max(1, Math.round(v))), { title: 'quantidade', min: 1, decimals: 0 }),
            num('↔', () => g().gutter, (v) => set('gutter')(Math.max(0, v)), { title: 'gutter (espaço entre)', min: 0, decimals: 0 })),
          row(num('▏', () => g().margin, (v) => set('margin')(Math.max(0, v)), { title: 'margem', min: 0, decimals: 0 }))],
        h('div.effect-foot',
          reg(colorRow({ get: () => g().color || '#FF3D3D', set: set('color'), commit, opacity: () => g().opacity ?? 0.12, setOpacity: set('opacity') })),
          iconButton('minus', 'Remover grade', () => { each((n) => n.grids.splice(i, 1)); commit(); }, 'small'))));
    });
    return section('Grades de layout', body, add);
  }

  /** Seção "Vetor": caminho fechado e botão para editar pontos. */
  function vectorSection() {
    return section('Vetor', [
      check('Caminho fechado', () => P().closed, (v) => each((n) => { n.closed = v; if (v && n.fill.type === 'none') n.fill = defaultFill('#D9D9D9'); })),
      h('button.btn', { type: 'button', onclick: () => tools.pen.startEdit(P().id) }, ico('pen', 13), ' Editar pontos (Enter)'),
      h('p.hint', 'Arraste pontos e alças. Alt+clique no traço adiciona um ponto. Duplo clique num ponto alterna canto/suave. Delete remove.'),
    ]);
  }

  /** Seção "Texto": estilo compartilhado, fonte, peso, tamanho, altura de linha, espaçamento, alinhamento, itálico, decoração, MAIÚSCULAS e alinhamento vertical. */
  function textSection() {
    // pesos que a fonte atual TEM (ex.: Lobster só tem 400); os demais nem aparecem na lista
    const avail = weightsOf(P().fontFamily);
    const weights = FONT_WEIGHTS.filter(([w]) => avail.includes(w));
    const styles = store.state.doc.styles.texts;
    return section('Texto', [
      row(
        select([['', 'Sem estilo'], ...styles.map((t) => [t.id, t.name])], () => P().textStyleId || '',
          (v) => each((n) => { if (v) n.textStyleId = v; else delete n.textStyleId; }), 'Estilo de texto'),
        iconButton('plus', 'Criar estilo de texto a partir desta camada', async () => {
          const name = await askText({ title: 'Nome do estilo de texto', label: 'Nome do estilo de texto', value: `Texto ${styles.length + 1}`, confirm: 'Salvar' });
          if (name) commands.addTextStyle(P(), name);
        }, 'small')),
      reg(fontField({
        get: () => P().fontFamily,
        // ao trocar a fonte: começa a baixar (Google Fonts) e ajusta o peso para o mais próximo que ela tem
        set: (v) => { ensureFonts([v]); each((n) => { n.fontFamily = v; n.fontWeight = nearestWeight(v, n.fontWeight); delete n.textStyleId; }); commit(); },
      })),
      row(
        select((weights.length ? weights : FONT_WEIGHTS).map(([w, l]) => [w, `${l} (${w})`]), () => P().fontWeight, (v) => each((n) => { n.fontWeight = Number(v); delete n.textStyleId; }), 'font-weight'),
        num('Aa', () => P().fontSize, (v) => each((n) => { n.fontSize = Math.max(1, v); delete n.textStyleId; }), { title: 'font-size', min: 1, decimals: 1 })),
      row(
        num('↕', () => P().lineHeight, (v) => each((n) => { n.lineHeight = v; delete n.textStyleId; }), { title: 'line-height (multiplicador)', min: 0, step: 0.05, decimals: 2 }),
        num('↔', () => P().letterSpacing, (v) => each((n) => { n.letterSpacing = v; delete n.textStyleId; }), { title: 'letter-spacing (px)', step: 0.1, decimals: 2 })),
      row(
        reg(segmented({
          options: [['left', 'alignTextL', 'Esquerda'], ['center', 'alignTextC', 'Centro'], ['right', 'alignTextR', 'Direita']],
          get: () => P().textAlign, set: (v) => each((n) => { n.textAlign = v; }), commit,
        })),
        reg(segmented({
          options: [['italic', 'italic', 'Itálico']],
          get: () => (P().fontStyle === 'italic' ? 'italic' : ''),
          set: () => each((n) => { n.fontStyle = n.fontStyle === 'italic' ? 'normal' : 'italic'; }), commit,
        })),
        reg(segmented({
          options: [['underline', 'underline', 'Sublinhado'], ['line-through', 'strike', 'Riscado']],
          get: () => P().textDecoration,
          set: (v) => each((n) => { n.textDecoration = n.textDecoration === v ? 'none' : v; }), commit,
        }))),
      row(
        select([['none', 'Normal'], ['uppercase', 'MAIÚSCULAS'], ['lowercase', 'minúsculas'], ['capitalize', 'Cada Palavra']],
          () => P().textTransform || 'none', (v) => each((n) => { n.textTransform = v; }), 'text-transform'),
        P().sizeY === 'fixed'
          ? reg(segmented({
            options: [['top', 'alignT', 'Alinhar ao topo da caixa'], ['center', 'alignCV', 'Centralizar na vertical'], ['bottom', 'alignB', 'Alinhar embaixo']],
            get: () => P().textVAlign || 'top', set: (v) => each((n) => { n.textVAlign = v; }), commit,
          }))
          : null),
    ]);
  }

  /** Faixa de pré-visualização do gradiente (sempre mostrada em 90° só para ver as cores/posições). */
  function gradientBar() {
    const bar = h('div.grad-bar');
    updaters.push(() => {
      const f = P().fill;
      bar.style.backgroundImage = fillCss({ ...f, type: 'linear', angle: 90 })['background-image'] || '';
    });
    return bar;
  }

  /** Quadradinhos com as cores mais usadas no projeto (até 14): clicar aplica. Só aparece se houver 2+ cores. */
  function docColorChips(apply) {
    const count = new Map();
    const bump = (c) => c && count.set(c.toUpperCase(), (count.get(c.toUpperCase()) || 0) + 1);
    const walk = (list) => list.forEach((n) => {
      if (n.fill?.type === 'solid') bump(n.fill.color);
      if (n.stroke) bump(n.stroke.color);
      if (n.children) walk(n.children);
    });
    store.state.doc.pages.forEach((pg) => walk(pg.children));
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c]) => c);
    if (top.length < 2) return null;
    return h('div.color-chips', { title: 'Cores usadas neste projeto' },
      top.map((c) => h('button.chip', { type: 'button', title: c, style: { background: c }, onclick: () => apply(c) })));
  }

  /**
   * Seção "Preenchimento" (ou "Cor do texto" em texto): tipo (nenhum/sólido/linear/radial/imagem) e os campos de cada tipo —
   * cor + estilo de cor; ângulo + paradas do gradiente; imagem + ajuste.
   */
  function fillSection() {
    const n0 = P();
    const isText = n0.type === 'text';
    const fill = () => P().fill;
    const body = [
      select([['none', 'Nenhum'], ['solid', 'Cor sólida'], ['linear', 'Gradiente linear'], ['radial', 'Gradiente radial'], ['image', 'Imagem']],
        () => fill().type, (v) => {
          each((n) => { n.fill.type = v; });
          if (v === 'image' && !fill().assetId) {
            pickImage(({ assetId }) => { each((n) => { n.fill.assetId = assetId; }); commit(); });
          }
        }, 'Tipo de preenchimento'),
    ];
    const t = n0.fill.type;
    if (t === 'solid') {
      const styles = store.state.doc.styles.colors;
      body.push(reg(colorRow({
        get: () => fill().color, set: (v) => each((n) => { n.fill.color = v; delete n.fill.styleId; }), commit,
        opacity: () => fill().opacity, setOpacity: (v) => each((n) => { n.fill.opacity = v; delete n.fill.styleId; }),
      })));
      body.push(docColorChips((hex) => { each((n) => { n.fill.color = hex; n.fill.opacity = 1; delete n.fill.styleId; }); commit(); }));
      body.push(row(
        select([['', 'Sem estilo de cor'], ...styles.map((c) => [c.id, c.name])], () => fill().styleId || '',
          (v) => each((n) => { if (v) n.fill.styleId = v; else delete n.fill.styleId; }), 'Estilo de cor'),
        iconButton('plus', 'Criar estilo de cor a partir desta cor', async () => {
          const name = await askText({ title: 'Nome do estilo de cor', label: 'Nome do estilo de cor', value: `Cor ${styles.length + 1}`, confirm: 'Salvar' });
          if (name) commands.addColorStyle(P(), name);
        }, 'small')));
    } else if (t === 'linear' || t === 'radial') {
      body.push(gradientBar());
      if (t === 'linear') body.push(row(num('°', () => fill().angle, (v) => each((n) => { n.fill.angle = v; }), { title: 'ângulo', decimals: 0, min: -360, max: 360 })));
      n0.fill.stops.forEach((_, i) => {
        body.push(h('div.stop-row',
          num('%', () => fill().stops[i]?.pos ?? 0, (v) => each((n) => { if (n.fill.stops[i]) n.fill.stops[i].pos = v; }), { min: 0, max: 100, decimals: 0, width: '70px', title: 'posição' }),
          reg(colorRow({
            get: () => fill().stops[i]?.color ?? '#000000',
            set: (v) => each((n) => { if (n.fill.stops[i]) n.fill.stops[i].color = v; }), commit,
            opacity: () => fill().stops[i]?.opacity ?? 1,
            setOpacity: (v) => each((n) => { if (n.fill.stops[i]) n.fill.stops[i].opacity = v; }),
          })),
          n0.fill.stops.length > 2
            ? iconButton('minus', 'Remover cor', () => { each((n) => n.fill.stops.splice(i, 1)); commit(); }, 'small')
            : null));
      });
      body.push(h('button.link-btn', {
        type: 'button',
        onclick: () => {
          each((n) => {
            const s = n.fill.stops;
            s.push({ color: s[s.length - 1].color, opacity: 1, pos: Math.min(100, s[s.length - 1].pos + 10) });
          });
          commit();
        },
      }, ico('plus', 12), ' Adicionar cor'));
    } else if (t === 'image') {
      body.push(row(
        h('button.btn.wide', { type: 'button', onclick: () => pickImage(({ assetId }) => { each((n) => { n.fill.assetId = assetId; }); commit(); }) }, ico('image', 14), ' Trocar imagem'),
        select([['cover', 'Cobrir (cover)'], ['contain', 'Conter (contain)'], ['fill', 'Esticar (100% 100%)']], () => fill().fit, (v) => each((n) => { n.fill.fit = v; }), 'background-size')));
    }
    return section(isText ? 'Cor do texto' : 'Preenchimento', body);
  }

  /** Seção "Contorno": cor, espessura, estilo (sólido/tracejado/pontilhado) e posição (dentro/centro/fora). O botão +/− liga e desliga. */
  function strokeSection() {
    const n0 = P();
    const has = !!n0.stroke;
    const add = iconButton('plus', 'Adicionar contorno', () => { each((n) => { n.stroke = defaultStroke(); }); commit(); }, 'small');
    const rem = iconButton('minus', 'Remover contorno', () => { each((n) => { n.stroke = null; }); commit(); }, 'small');
    const body = [];
    if (has) {
      const st = () => P().stroke || defaultStroke();
      body.push(
        reg(colorRow({
          get: () => st().color, set: (v) => each((n) => { if (n.stroke) n.stroke.color = v; }), commit,
          opacity: () => st().opacity, setOpacity: (v) => each((n) => { if (n.stroke) n.stroke.opacity = v; }),
        })),
        row(num('▭', () => st().width, (v) => each((n) => {
          if (!n.stroke) return;
          n.stroke.width = Math.max(0, v);
          // com lados ativos, a espessura vale para todos os lados ligados
          if (n.stroke.sides) n.stroke.sides = n.stroke.sides.map((x) => (x > 0 ? n.stroke.width : 0));
        }), { title: 'espessura', min: 0, step: 0.5, decimals: 1 }),
          n0.type === 'text'
            ? null
            : select([['solid', 'Sólido'], ['dashed', 'Tracejado'], ['dotted', 'Pontilhado']], () => st().style, (v) => each((n) => { if (n.stroke) n.stroke.style = v; }), 'outline-style')),
        n0.type === 'text' || sidesOn()
          ? null
          : select([['inside', 'Dentro'], ['center', 'Centro'], ['outside', 'Fora']], () => st().position, (v) => each((n) => { if (n.stroke) n.stroke.position = v; }), 'Posição do contorno'));
      // LADOS (só retângulo e frame): todos (outline) ou só alguns (border-top/right/bottom/left do CSS)
      if (['rect', 'frame'].includes(n0.type)) body.push(...strokeSidesRows(st));
    }
    return section('Contorno', body, has ? rem : add);
  }

  /** O contorno da camada selecionada está "por lado"? */
  function sidesOn() { return Array.isArray(P().stroke?.sides); }

  /**
   * Linhas "Lados" do contorno: atalhos (todos, só em cima, só embaixo, esquerda, direita, em cima e embaixo, nas
   * laterais) e "Personalizado", que mostra a espessura de cada lado. Gera o CSS `border-top`, `border-bottom`...
   */
  function strokeSidesRows(st) {
    const PRESETS = {
      all: null, top: [1, 0, 0, 0], bottom: [0, 0, 1, 0], left: [0, 0, 0, 1], right: [0, 1, 0, 0],
      tb: [1, 0, 1, 0], lr: [0, 1, 0, 1],
    };
    /** Qual atalho corresponde aos lados atuais (ou 'custom' se as espessuras forem diferentes entre si). */
    const current = () => {
      const sd = st().sides;
      if (!sd) return 'all';
      if (st().sidesCustom) return 'custom'; // escolhido explicitamente (mesmo com espessuras iguais)
      const on = sd.map((v) => (v > 0 ? 1 : 0));
      const widths = sd.filter((v) => v > 0);
      if (widths.some((v) => v !== widths[0])) return 'custom';
      const hit = Object.entries(PRESETS).find(([, v]) => v && v.join() === on.join());
      return hit ? hit[0] : 'custom';
    };
    const apply = (key) => each((n) => {
      if (!n.stroke) return;
      const w = n.stroke.width || 1;
      n.stroke.sidesCustom = key === 'custom' || undefined;
      if (key === 'all') delete n.stroke.sides;
      else if (key === 'custom') n.stroke.sides = n.stroke.sides || [w, w, w, w];
      else n.stroke.sides = PRESETS[key].map((v) => v * w);
      if (n.stroke.sides) n.stroke.position = 'inside'; // border-box: a borda é sempre por dentro
    });
    const rows = [
      h('div.sub-label', 'lados (border-top / right / bottom / left)'),
      row(select([
        ['all', 'Todos'], ['top', 'Só em cima'], ['bottom', 'Só embaixo'], ['left', 'Só à esquerda'], ['right', 'Só à direita'],
        ['tb', 'Em cima e embaixo'], ['lr', 'Nas laterais'], ['custom', 'Personalizado (por lado)'],
      ], current, apply, 'Em quais lados desenhar o contorno')),
    ];
    if (current() === 'custom') {
      const side = (i, label, title) => num(label, () => st().sides?.[i] ?? 0, (v) => each((n) => { if (n.stroke?.sides) n.stroke.sides[i] = Math.max(0, v); }), { title, min: 0, step: 0.5, decimals: 1 });
      rows.push(row(side(0, '↑', 'border-top (px)'), side(1, '→', 'border-right (px)')),
        row(side(2, '↓', 'border-bottom (px)'), side(3, '←', 'border-left (px)')));
    }
    return rows;
  }

  /** Seção "Efeitos": lista de sombras (x, y, blur, spread, cor, interna) + blur da camada + desfoque de fundo (vidro). */
  function effectsSection() {
    const n0 = P();
    const isText = n0.type === 'text';
    const add = iconButton('plus', 'Adicionar sombra', () => { each((n) => n.shadows.push(defaultShadow())); commit(); }, 'small');
    const body = [];
    n0.shadows.forEach((_, i) => {
      const sh = () => P().shadows[i] || defaultShadow();
      const set = (k) => (v) => each((n) => { if (n.shadows[i]) n.shadows[i][k] = v; });
      body.push(h('div.effect-card',
        row(num('X', () => sh().x, set('x'), { decimals: 0 }), num('Y', () => sh().y, set('y'), { decimals: 0 })),
        row(num('B', () => sh().blur, (v) => set('blur')(Math.max(0, v)), { title: 'blur', min: 0, decimals: 0 }),
          isText ? null : num('S', () => sh().spread, set('spread'), { title: 'spread', decimals: 0 })),
        h('div.effect-foot',
          reg(colorRow({ get: () => sh().color, set: set('color'), commit, opacity: () => sh().opacity, setOpacity: set('opacity') })),
          isText ? null : check('Interna', () => sh().inset, set('inset')),
          iconButton('minus', 'Remover sombra', () => { each((n) => n.shadows.splice(i, 1)); commit(); }, 'small'))));
    });
    // desfoques com o nome da propriedade CSS ao lado (antes eram só os símbolos ◌ e ▨, difíceis de entender)
    body.push(prop('filter: blur', num('◌', () => P().blur, (v) => each((n) => { n.blur = Math.max(0, v); }), { title: 'filter: blur() — desfoca a própria camada', min: 0, decimals: 0 })));
    if (!isText) {
      body.push(prop('backdrop-filter', num('▨', () => P().bgBlur, (v) => each((n) => { n.bgBlur = Math.max(0, v); }), { title: 'backdrop-filter: blur() — desfoca o que está ATRÁS (efeito vidro)', min: 0, decimals: 0 }),
        'Efeito vidro: desfoca o que está atrás (use com um preenchimento semitransparente)'));
    }
    return section('Efeitos', body, add);
  }

  /** Seção "Exportar": escala (1x–4x) e botões PNG, SVG e HTML da seleção. */
  function exportSection() {
    return section('Exportar', [
      row(
        select([['1', '1x'], ['2', '2x'], ['3', '3x'], ['4', '4x']], () => String(exportScale), (v) => { exportScale = Number(v); }, 'Escala'),
        h('button.btn', {
          type: 'button',
          onclick: async () => {
            try {
              for (const n of commands.topSelection()) await exportPng(n, store.state.doc.assets, exportScale);
            } catch (err) { toast(err.message); }
          },
        }, 'PNG'),
        h('button.btn', {
          type: 'button',
          title: 'Vetorial: formas, textos, gradientes e sombras',
          onclick: () => commands.topSelection().forEach((n) => exportSvgFile(n, store.state.doc.assets, (c) => commands.localBox(c))),
        }, 'SVG'),
        h('button.btn', {
          type: 'button',
          onclick: () => commands.topSelection().forEach((n) => exportHtmlFile(n, store.state.doc.assets)),
        }, 'HTML')),
      h('p.hint', 'PNG usa as fontes instaladas no seu computador.'),
    ]);
  }

  /** Painel quando nada está selecionado: resumo da página e dicas de atalhos. */
  function emptySection() {
    const page = store.page();
    const count = (list) => list.reduce((s, n) => s + 1 + count(n.children || []), 0);
    return h('div.empty-state',
      h('div.empty-art', ico('sliders', 28)),
      h('h3', 'Nada selecionado'),
      h('p', 'Clique em uma camada no canvas ou na lista para editar suas propriedades.'),
      h('p.muted', `${page.name} · ${count(page.children)} camadas`),
      h('div.tips',
        h('div', h('kbd', 'F'), ' frame'), h('div', h('kbd', 'R'), ' retângulo'),
        h('div', h('kbd', 'E'), ' elipse'), h('div', h('kbd', 'T'), ' texto'),
        h('div', h('kbd', 'Shift'), '+', h('kbd', 'A'), ' auto layout'), h('div', h('kbd', '?'), ' todos os atalhos')));
  }

  // ------------------------------------------------------------------ render
  /**
   * "Assinatura" da ESTRUTURA do painel: tudo que, se mudar, exige reconstruir os campos (outra seleção, outro tipo de
   * preenchimento, +1 sombra, layout ligado/desligado...). NÃO inclui valores como a espessura ou o padding — esses só
   * pedem para reler os campos, e reconstruir no meio da digitação faria o campo perder o foco.
   */
  function signature() {
    const ns = nodes();
    if (!ns.length) return 'empty';
    const n = ns[0];
    const parent = store.parentOf(n.id);
    return [
      ns.map((x) => x.id + x.type).join(','), n.fill.type, n.fill.stops.length, !!n.stroke, n.shadows.length,
      // contorno por lado: quais lados e se é "personalizado" mudam os campos mostrados
      n.stroke?.sides ? n.stroke.sides.map((v) => (v > 0 ? 1 : 0)).join('') + (n.stroke.sidesCustom ? 'c' : '') : '',
      n.layout?.mode, n.layout?.wrap, hasLayout(parent), parent?.layout?.mode, n.absolute, n.sizeX, n.sizeY, radiusExpanded,
      n.visible, store.state.doc.pages.length, n.layout?.mode === 'grid', n.component, n.instanceOf, n.lockRatio,
      n.flipX, n.flipY, n.isMask, n.grids?.length, n.grids?.map((g) => g.type).join(), n.closed,
      store.state.doc.styles.colors.length, store.state.doc.styles.texts.length, n.fill.styleId, n.textStyleId, n.type,
      n.type === 'text' ? n.fontFamily : '', // a lista de pesos depende da fonte
      n.constraints?.h, !!store.parentOf(n.id) && !hasLayout(store.parentOf(n.id)), paddingExpanded, n.layout ? n.layout.padding[0] !== n.layout.padding[2] || n.layout.padding[1] !== n.layout.padding[3] : '',
    ].join('|');
  }

  /** Reconstrói o painel se a estrutura mudou; em qualquer caso, atualiza os valores dos campos. */
  function render() {
    const sig = signature();
    if (sig !== lastSig) {
      lastSig = sig;
      updaters = [];
      if (sig === 'empty') {
        el.replaceChildren(emptySection());
      } else {
        const n = P();
        const parent = store.parentOf(n.id);
        // Ordem (parecida com a do Figma): onde está → que tamanho tem → como se organiza (layout) → como parece.
        // Componente principal/instância aparece no topo (é informação importante); "Criar componente" vai para o fim.
        const one = ids().length === 1;
        const canComp = one && ['frame', 'group', 'rect', 'ellipse'].includes(n.type);
        const isComp = !!(n.component || n.instanceOf);
        const parts = [alignSection()];
        if (canComp && isComp) parts.push(componentSection());
        parts.push(positionSection(), sizeSection());
        if (one && hasLayout(parent)) parts.push(flowItemSection());
        if (one && n.type === 'frame') parts.push(autoLayoutSection(), layoutGridsSection());
        if (n.type === 'text') parts.push(textSection());
        if (n.type === 'path') parts.push(vectorSection());
        parts.push(appearanceSection());
        if (n.type !== 'group' && n.type !== 'line') parts.push(fillSection());
        if (n.type !== 'group') parts.push(strokeSection());
        parts.push(effectsSection());
        if (canComp && !isComp) parts.push(componentSection());
        parts.push(exportSection());
        el.replaceChildren(...parts);
      }
    }
    updaters.forEach((u) => u());
  }

  // atualiza quando o documento, a seleção ou o histórico (desfazer) mudam
  store.subscribe((reasons) => {
    if (['doc', 'selection', 'history'].some((r) => reasons.has(r))) render();
  });
  render();

  return { el, render };
}
