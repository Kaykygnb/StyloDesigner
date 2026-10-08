/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/props.js — PAINEL "DESIGN" (PROPRIEDADES DA SELEÇÃO)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Os campos usam os nomes do CSS (gap, padding, justify-content, align-items, opacity, mix-blend-mode...) de propósito:
 *  quem usa o painel aprende CSS sem perceber, e o código gerado bate com o que está escrito aqui.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton, numField, selectField, segmented, colorRow, tip } from './dom.js';
import { askText } from './menus.js';
import { fontField } from './fontpicker.js';
import { ensureFonts, nearestWeight, weightsOf } from '../fonts.js';
import {
  BLEND_MODES, FONT_WEIGHTS, applyLimits, defaultFill, defaultShadow, defaultStroke, hasLayout, hasSizeLimits, isFlow, resizeNode,
  constraintsOf, round,
} from '../model.js';
import { fillCss, nodeStyle } from '../css.js';
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
  // margem do item: mostrar os 4 lados separados (senão horizontal/vertical)
  let marginExpanded = false;
  // grid: espaço entre colunas e linhas separados (senão um campo só vale para os dois)
  let gapSplit = false;
  // caixa "CSS ao vivo" do auto layout: começa FECHADA (é uma curiosidade, não faz parte do trabalho); lembra a escolha
  let liveCssOpen = false;
  try { liveCssOpen = localStorage.getItem('pd.liveCss') === '1'; } catch { /* sem armazenamento: fica fechada */ }
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

  /** Grupo "legenda pequena em cima + controle embaixo" (visual do Figma: "Posição", "Dimensões", "Opacidade"...). */
  const cap = (label, ...c) => h('div.cap-group', h('div.cap', label), ...c);

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
  /** Linha de alinhar (esquerda/centro/direita, topo/meio/base) e distribuir (precisa de 3+ camadas). Fica dentro da seção Posição. */
  function alignRow() {
    const many = ids().length >= 3;
    const btn = (name, title, fn, disabled) =>
      h('button.icon-btn', { type: 'button', title, disabled, onclick: fn }, ico(name));
    return h('div.align-row',
      h('div.seg-group', btn('alignL', 'Alinhar à esquerda', () => commands.align('left')),
        btn('alignCH', 'Centralizar na horizontal', () => commands.align('hcenter')),
        btn('alignR', 'Alinhar à direita', () => commands.align('right'))),
      h('div.seg-group', btn('alignT', 'Alinhar ao topo', () => commands.align('top')),
        btn('alignCV', 'Centralizar na vertical', () => commands.align('vcenter')),
        btn('alignB', 'Alinhar embaixo', () => commands.align('bottom'))),
      h('div.seg-group', btn('distH', 'Distribuir na horizontal', () => commands.distribute('h'), !many),
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
    const body = [cap('Alinhamento', alignRow())];
    if (!single) {
      // várias camadas: X/Y da caixa que envolve todas
      const box = () => canvas.unionAabb(commands.topSelection().map((n) => n.id)) || { x: 0, y: 0, w: 0, h: 0 };
      body.push(cap(`Posição · ${ids().length} camadas`,
        row(num('X', () => box().x, (v) => commands.setSelectionBox({ x: v }), { decimals: 1 }),
          num('Y', () => box().y, (v) => commands.setSelectionBox({ y: v }), { decimals: 1 }))));
    } else {
      const posRow = row(
        num('X', () => P().x, (v) => each((n) => { n.x = v; }), { decimals: 1, title: 'left' }),
        num('Y', () => P().y, (v) => each((n) => { n.y = v; }), { decimals: 1, title: 'top' }));
      if (inFlow) {
        posRow.classList.add('disabled');
        posRow.title = 'Posição controlada pelo auto layout do pai';
      }
      body.push(cap('Posição', posRow));
      if (parent?.type === 'frame' && !hasLayout(parent) && !n0.absolute) {
        body.push(cap('Restrições', row(
          select(H_CONS, () => constraintsOf(P()).h, (v) => each((n) => { n.constraints = { ...constraintsOf(n), h: v }; }), 'Constraint horizontal: como reage quando o frame muda de largura', '↔'),
          select(V_CONS, () => constraintsOf(P()).v, (v) => each((n) => { n.constraints = { ...constraintsOf(n), v: v }; }), 'Constraint vertical: como reage quando o frame muda de altura', '↕'))));
      }
    }
    body.push(cap('Rotação', row(
      num('↻', () => P().rotation, (v) => each((n) => { n.rotation = v; }), { title: 'rotação (transform: rotate)', decimals: 1, min: -360, max: 360, unit: '°' }),
      h('div.btn-group',
        h('button.icon-btn.small' + (n0.flipX ? '.on' : ''), { type: 'button', title: 'Espelhar na horizontal (Shift+H)', onclick: () => commands.flip('x') }, ico('flipH', 14)),
        h('button.icon-btn.small' + (n0.flipY ? '.on' : ''), { type: 'button', title: 'Espelhar na vertical (Shift+V)', onclick: () => commands.flip('y') }, ico('flipV', 14))))));
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
      body.push(cap('Dimensões', row(num('W', () => box().w, (v) => commands.setSelectionBox({ w: v }), { min: 1, decimals: 1 }),
        num('H', () => box().h, (v) => commands.setSelectionBox({ h: v }), { min: 1, decimals: 1 }))));
      return section('Tamanho', body);
    }
    body.push(cap('Dimensões', row(
      num('W', () => P().w, (v) => each((n) => resizeNode(n, v, n.h, 'w')), { min: 1, title: 'width', decimals: 1 }),
      num('H', () => P().h, (v) => each((n) => resizeNode(n, n.w, v, 'h')), { min: 1, title: 'height', decimals: 1, disabled: n0.type === 'line' }),
      h('button.icon-btn.small' + (n0.lockRatio ? '.on' : ''), {
        type: 'button', title: 'Travar proporção',
        onclick: () => { each((n) => { n.lockRatio = !n.lockRatio; }); commit(); },
      }, ico('link', 14)))));
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
    if (hasSizeLimits(n0)) body.push(limitsBlock(n0));
    return section('Tamanho', body);
  }

  /** Proporções prontas do select (valor = largura/altura; 'atual' usa o tamanho de agora). */
  const ASPECTS = [
    ['', 'Livre'], ['1', '1 : 1 (quadrado)'], ['1.3333', '4 : 3'], ['1.7778', '16 : 9'], ['1.5', '3 : 2'], ['2', '2 : 1'],
    ['0.75', '3 : 4 (retrato)'], ['0.5625', '9 : 16 (story)'], ['atual', 'Usar o tamanho atual'],
  ];
  /**
   * "Limites e proporção": min/max de largura e altura (CSS min-width, max-width, min-height, max-height) e
   * aspect-ratio. Fica recolhido (abre sozinho se algum já está em uso). Campo vazio = sem limite. Em medidas FIXAS o
   * valor é limitado na hora; em Hug/Fill quem obedece é o navegador (o canvas mede de volta).
   */
  function limitsBlock(n0) {
    const used = !!(n0.minW || n0.maxW || n0.minH || n0.maxH || n0.aspect);
    const limit = (label, cssKey, key) => capK(label, cssKey, num('px', () => P()[key] ?? null, (v) => each((n) => {
      if (v == null || !(v > 0)) delete n[key]; else n[key] = Math.round(v);
      applyLimits(n);
    }), { min: 0, decimals: 0, nullable: true, placeholder: 'sem limite' }));
    const hasRatio = n0.type !== 'text';
    const aspectVal = () => {
      const a = P().aspect;
      if (!(a > 0)) return '';
      const hit = ASPECTS.find(([v]) => v && v !== 'atual' && Math.abs(Number(v) - a) < 0.002);
      return hit ? hit[0] : 'custom';
    };
    const body = [
      row(limit('Largura mín.', 'min-width', 'minW'), limit('Largura máx.', 'max-width', 'maxW')),
      row(limit('Altura mín.', 'min-height', 'minH'), limit('Altura máx.', 'max-height', 'maxH')),
    ];
    if (hasRatio) {
      body.push(capK('Proporção', 'aspect-ratio', select([...ASPECTS, ['custom', 'Personalizada']], aspectVal, (v) => each((n) => {
        if (v === 'custom') return;
        if (!v) delete n.aspect;
        else n.aspect = v === 'atual' ? round(n.w / n.h, 4) : Number(v);
        if (n.aspect && n.sizeX === 'fixed' && n.sizeY === 'fixed') resizeNode(n, n.w, n.h, 'w'); // ajusta a altura à proporção
        else applyLimits(n);
      }), 'aspect-ratio')));
      if (n0.aspect > 0 && n0.sizeX === 'fixed' && n0.sizeY === 'fixed') {
        body.push(h('p.hint', 'Largura e altura estão fixas: o editor mantém a proporção ao redimensionar. Para o CSS aspect-ratio valer no código, deixe uma das medidas em Hug ou Fill.'));
      }
    }
    return h('details.size-limits', { open: used },
      h('summary', ico('chevron', 11), ' Limites e proporção', used ? h('span.dot-on') : null), h('div.section-body', body));
  }

  /**
   * Seção "Aparência": opacidade, mistura (mix-blend-mode), cantos arredondados (border-radius, juntos ou um por
   * canto), cortar conteúdo (overflow: hidden) e máscara.
   */
  function appearanceSection() {
    const n0 = P();
    const parent = store.parentOf(n0.id);
    const body = [row(
      cap('Opacidade', num('%', () => P().opacity * 100, (v) => each((n) => { n.opacity = v / 100; }), { min: 0, max: 100, decimals: 0, title: 'opacity' })),
      cap('Mesclagem', select(BLEND_MODES.map((m) => [m, m]), () => P().blend, (v) => each((n) => { n.blend = v; }), 'mix-blend-mode (mistura com o que está atrás)', '◐')))];
    const canRound = !NO_RADIUS.includes(n0.type);
    if (canRound) {
      body.push(cap('Raio dos cantos', row(
        num('◜', () => P().radius[0], (v) => each((n) => { n.radius = [v, v, v, v].map((x) => Math.max(0, x)); }),
          { title: 'border-radius (cantos arredondados)', min: 0, decimals: 1 }),
        h('button.icon-btn.small' + (radiusExpanded ? '.on' : ''), {
          type: 'button', title: 'Cantos independentes',
          onclick: () => { radiusExpanded = !radiusExpanded; lastSig = null; render(); },
        }, ico('corners', 14)))));
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

  /** Explicações (em português) das propriedades CSS do auto layout: alimentam as dicas e a caixa "CSS ao vivo". */
  const CSS_DOC = {
    display: ['display', 'display: flex;', 'Diz como o container organiza os filhos. "flex" coloca em fila (linha ou coluna); "grid" monta uma tabela de colunas e linhas.'],
    'flex-direction': ['flex-direction', 'flex-direction: row;', 'A direção da fila: "row" = lado a lado, "column" = um embaixo do outro. É o chamado eixo principal.'],
    'flex-wrap': ['flex-wrap', 'flex-wrap: wrap;', 'Quando os itens não cabem em uma fila, eles descem para a próxima em vez de ficarem apertados.'],
    gap: ['gap', 'gap: 8px;', 'O espaço ENTRE os itens. Não é margem de ninguém: o próprio container distribui, e por isso nunca sobra espaço nas pontas.'],
    padding: ['padding', 'padding: 16px 24px;', 'O respiro entre a borda do container e o que tem dentro. Com dois valores: o primeiro é cima/baixo, o segundo é esquerda/direita.'],
    'justify-content': ['justify-content', 'justify-content: space-between;', 'Como os itens se distribuem ao longo do eixo principal (a direção da fila): começo, centro, fim ou espalhados.'],
    'align-items': ['align-items', 'align-items: center;', 'Como os itens se alinham no eixo cruzado (o contrário da fila): no topo, no meio, embaixo ou esticados.'],
    'justify-items': ['justify-items', 'justify-items: center;', 'No grid: a posição HORIZONTAL de cada item dentro da sua célula.'],
    'background-size': ['background-size', 'background-size: cover;', 'Como a imagem se ajusta à caixa. cover = preenche cortando as sobras; contain = aparece inteira; 100% 100% = estica; tamanho próprio = uma largura em % da caixa (altura proporcional).'],
    'background-position': ['background-position', 'background-position: 50% 50%;', 'Qual parte da imagem fica visível quando ela é maior que a caixa (ou onde ela fica quando é menor). 0% = começo, 50% = centro, 100% = fim.'],
    'background-repeat': ['background-repeat', 'background-repeat: repeat;', 'Se a imagem se repete como ladrilho quando não cobre a caixa toda: nos dois sentidos, só na horizontal ou só na vertical.'],
    margin: ['margin', 'margin: 8px 16px;', 'Espaço FORA da caixa, em volta do item, somado ao gap do pai. Só vale para itens dentro de um auto layout (flex ou grid). Com dois valores: cima/baixo e esquerda/direita.'],
    brightness: ['brightness', 'filter: brightness(120%);', 'Clareia (acima de 100%) ou escurece (abaixo de 100%) a camada inteira. 100% = sem mudança.'],
    contrast: ['contrast', 'filter: contrast(130%);', 'Aumenta ou diminui a diferença entre claros e escuros. 100% = sem mudança.'],
    saturate: ['saturate', 'filter: saturate(150%);', 'Intensifica (acima de 100%) ou apaga (abaixo) as cores. 0% fica em preto e branco.'],
    grayscale: ['grayscale', 'filter: grayscale(100%);', 'Converte em tons de cinza. 100% = totalmente cinza; 0% = sem mudança.'],
    'hue-rotate': ['hue-rotate', 'filter: hue-rotate(90deg);', 'Gira as cores pela roda de matizes (graus). 180° troca cada cor pela complementar.'],
    'word-spacing': ['word-spacing', 'word-spacing: 4px;', 'Espaço extra entre as PALAVRAS (diferente do espaçamento entre letras). Valores negativos aproximam as palavras.'],
    'text-overflow': ['text-overflow', 'white-space: nowrap;\noverflow: hidden;\ntext-overflow: ellipsis;', 'O texto fica em UMA linha e o que não cabe vira "…". Precisa de uma largura fixa ou máxima para saber onde cortar. O alinhamento vertical não vale com isto.'],
    'line-clamp': ['line-clamp', 'display: -webkit-box;\n-webkit-line-clamp: 3;\noverflow: hidden;', 'Mostra no máximo N linhas e termina com "…". Ótimo para títulos e descrições de cards. Precisa de uma largura fixa ou máxima.'],
    'min-width': ['min-width', 'min-width: 120px;', 'A largura nunca fica MENOR que isto, mesmo que o conteúdo ou o espaço do pai peçam menos. Vazio = sem limite.'],
    'max-width': ['max-width', 'max-width: 480px;', 'A largura nunca passa disto. Em texto com largura "hug", o texto passa a QUEBRAR LINHA ao chegar no limite. Vazio = sem limite.'],
    'min-height': ['min-height', 'min-height: 48px;', 'A altura nunca fica MENOR que isto. Útil em cards que crescem com o conteúdo mas não devem ficar baixos demais.'],
    'max-height': ['max-height', 'max-height: 320px;', 'A altura nunca passa disto. Combine com "cortar conteúdo" (overflow) para esconder o que sobra.'],
    'aspect-ratio': ['aspect-ratio', 'aspect-ratio: 16 / 9;', 'Mantém a proporção entre largura e altura. Vale no CSS quando UMA das medidas é flexível (Hug ou Fill); com as duas fixas, o editor mantém a proporção ao redimensionar.'],
    'grid-template-columns': ['grid-template-columns', 'grid-template-columns: repeat(3, 1fr);', 'Quantas colunas a grade tem. "repeat(3, 1fr)" = 3 colunas de larguras iguais; "fr" é uma fração do espaço livre.'],
    'grid-template-rows': ['grid-template-rows', 'grid-template-rows: repeat(2, 1fr);', 'Quantas linhas a grade tem. Sem este valor (automático), o navegador cria linhas conforme os itens chegam.'],
  };
  /** Monta o objeto de dica de uma propriedade do CSS_DOC. */
  const cssTip = (key) => ({ title: CSS_DOC[key][0], css: CSS_DOC[key][1], text: CSS_DOC[key][2] });
  /** Grupo com legenda em português + nome da propriedade CSS (mono) e dica rica ao passar o mouse na legenda e no controle. */
  const capK = (label, key, ...children) => {
    const g = h('div.cap-group', h('div.cap.has-tip', label, h('span.cap-css', key)), ...children);
    return tip(g, cssTip(key));
  };

  /**
   * Seção "Auto layout": modo em 4 cartões (livre / linha / coluna / grade), uma caixa "CSS ao vivo" com o CSS REAL que o
   * frame está gerando agora e os controles agrupados por assunto. Cada coisa tem uma dica ao passar o mouse (título,
   * CSS e explicação), para quem usa perceber: "isso aqui é CSS puro".
   *  - FLEX: gap, flex-wrap, padding, justify-content (eixo principal) e align-items (eixo cruzado);
   *  - GRID: colunas/linhas, gap, padding e justify-items/align-items (onde o item fica DENTRO da célula).
   */
  function autoLayoutSection() {
    const n0 = P();
    const L = () => P().layout;
    const mode = n0.layout.mode;

    // ---- modo: 4 cartões ----
    const MODES = [
      ['none', 'none', 'Livre', 'absolute', { title: 'Livre (sem layout)', css: 'position: absolute;\nleft: 20px;\ntop: 20px;', text: 'Cada camada fica exatamente onde você a coloca. Nada se reorganiza sozinho: é o modo "desenho livre".' }],
      ['row', 'row', 'Linha', 'flex · row', { title: 'Linha (flexbox)', css: 'display: flex;\nflex-direction: row;', text: 'Os itens se enfileiram lado a lado. O navegador distribui o espaço e alinha tudo: você só escolhe as regras.' }],
      ['column', 'column', 'Coluna', 'flex · column', { title: 'Coluna (flexbox)', css: 'display: flex;\nflex-direction: column;', text: 'A mesma ideia da linha, mas empilhando de cima para baixo.' }],
      ['grid', 'grid', 'Grade', 'grid', { title: 'Grade (CSS Grid)', css: 'display: grid;\ngrid-template-columns: repeat(3, 1fr);', text: 'Uma tabela invisível de colunas e linhas. Cada item cai numa célula: ótimo para cards, galerias e painéis.' }],
    ];
    const cards = MODES.map(([v, icon, name, css, doc]) => {
      const b = h('button.al-mode', { type: 'button', onclick: () => { store.update(() => commands.setLayoutMode(nodes(), v)); commit(); } },
        ico(icon, 20), h('span.al-mode-name', name), h('span.al-mode-css', css));
      updaters.push(() => b.classList.toggle('on', L().mode === v));
      return tip(b, doc);
    });
    const body = [h('div.al-modes', cards)];

    if (mode === 'none') {
      body.push(h('p.hint', 'Sem layout: cada camada fica onde você a coloca (position: absolute). Escolha Linha, Coluna ou Grade para o navegador organizar os filhos.'));
      return autoSection(body);
    }

    // ---- "CSS ao vivo": as declarações reais do frame, relidas a cada mudança ----
    const LIVE_KEYS = ['display', 'flex-direction', 'flex-wrap', 'grid-template-columns', 'grid-template-rows', 'gap', 'justify-content', 'justify-items', 'align-items', 'padding'];
    const code = h('div.al-code-body');
    const fillCode = () => {
      const s = nodeStyle(P(), store.parentOf(P().id), store.state.doc.assets);
      code.replaceChildren(
        h('div.al-brace', '.frame {'),
        ...LIVE_KEYS.filter((k) => s[k] != null).map((k) => tip(h('div.al-line', h('span.al-prop', k), ':', h('span.al-val', ` ${s[k]}`), ';'), cssTip(k))),
        h('div.al-brace', '}'));
    };
    // fechada = nem calcula (poupa trabalho a cada arrasto); ao abrir, preenche na hora
    updaters.push(() => { if (liveCssOpen) fillCode(); });
    const wrap = h('div.al-code' + (liveCssOpen ? '.open' : ''));
    const head = h('button.al-code-head', {
      type: 'button', 'aria-expanded': String(liveCssOpen),
      onclick: () => {
        liveCssOpen = !liveCssOpen;
        try { localStorage.setItem('pd.liveCss', liveCssOpen ? '1' : '0'); } catch { /* ignora */ }
        wrap.classList.toggle('open', liveCssOpen);
        head.setAttribute('aria-expanded', String(liveCssOpen));
        if (liveCssOpen) fillCode();
      },
    }, h('span.al-dot'), 'CSS ao vivo', h('span.al-chev', ico('chevron', 12)));
    tip(head, { title: 'Ver o CSS gerado', text: 'Clique para abrir ou fechar. Mostra exatamente o que este frame escreve no código exportado, e muda junto com os controles. É só uma curiosidade: não é editável.' });
    wrap.append(head, code);
    body.push(wrap);

    /** Campos de padding de vários lados (T/R/B/L = topo/direita/baixo/esquerda, mesma ordem do CSS). */
    const pad = (labels) => labels.map(([i, l, t]) =>
      num(l, () => L().padding[i], (v) => each((n) => { n.layout.padding[i] = Math.max(0, v); }), { title: t, min: 0, decimals: 0 }));
    // padding assimétrico (topo≠base ou esquerda≠direita) obriga a mostrar os 4 lados; senão mostra só horizontal/vertical
    const asym = n0.layout.padding[0] !== n0.layout.padding[2] || n0.layout.padding[1] !== n0.layout.padding[3];
    const showAll = paddingExpanded || asym;
    /** padding: ou 2 campos (horizontal/vertical) ou os 4 lados, alternável pelo botão. */
    const paddingBlock = () => {
      const g = capK('Respiro interno', 'padding',
        ...(showAll
          ? [row(...pad([[0, 'T', 'padding-top'], [1, 'R', 'padding-right']])), row(...pad([[3, 'L', 'padding-left'], [2, 'B', 'padding-bottom']]))]
          : [row(
            num('↔', () => L().padding[3], (v) => each((n) => { n.layout.padding[1] = n.layout.padding[3] = Math.max(0, v); }), { title: 'padding horizontal (esquerda e direita)', min: 0, decimals: 0 }),
            num('↕', () => L().padding[0], (v) => each((n) => { n.layout.padding[0] = n.layout.padding[2] = Math.max(0, v); }), { title: 'padding vertical (topo e base)', min: 0, decimals: 0 }),
            asym ? null : h('button.icon-btn.small' + (showAll ? '.on' : ''), {
              type: 'button', title: 'Padding por lado',
              onclick: () => { paddingExpanded = !paddingExpanded; lastSig = null; render(); },
            }, ico('corners', 14)))]));
      return g;
    };
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
          const btn = h('button.al-cell', {
            type: 'button',
            onclick: () => { each((n) => { n.layout.justify = j; n.layout.align = a; }); commit(); },
          }, h('i'));
          updaters.push(() => btn.classList.toggle('on', L().justify === j && L().align === a));
          cells.push(btn);
        }
      }
      return tip(h('div.al-matrix', cells), {
        title: 'Alinhamento rápido', css: `${jName}: …;\n${aName}: …;`,
        text: 'Um clique define os dois alinhamentos de uma vez: onde os itens ficam dentro do container (cantos, bordas ou centro).',
      });
    };
    /** Opções de um <select> mostrando o valor CSS de verdade (ex.: "flex-start", "space-between"). */
    const opts = (list, grid) => list.map(([v, css]) => [v, grid ? css : v]);
    /** Legenda mono pequena com dica (usada acima dos selects de alinhamento). */
    const subTip = (text, key) => tip(h('div.sub-label', text), cssTip(key));

    /**
     * Seletor visual de grade 6×6 (como o de tabela de um editor de texto): passar o mouse destaca "colunas × linhas",
     * clicar aplica as duas contagens de uma vez. A grade atual (se couber em 6×6) fica marcada.
     */
    const gridPicker = () => {
      const N = 6;
      const cells = [];
      const label = h('div.gp-label');
      const paint = (c, r, cls) => cells.forEach((el, i) => el.classList.toggle(cls, i % N < c && Math.floor(i / N) < r));
      const showCur = () => {
        const c = L().cols ?? 2, r = L().rows || Math.ceil((P().children?.filter((k) => !k.absolute).length || 1) / c);
        paint(c, r, 'on');
        label.textContent = `${c} × ${L().rows ? L().rows : 'auto'}`;
      };
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const cell = h('button.gp-cell', { type: 'button', 'aria-label': `${c + 1} colunas × ${r + 1} linhas` });
          cell.addEventListener('mouseenter', () => { paint(c + 1, r + 1, 'hover'); label.textContent = `${c + 1} × ${r + 1}`; });
          cell.addEventListener('click', () => { each((n) => { n.layout.cols = c + 1; n.layout.rows = r + 1; }); commit(); });
          cells.push(cell);
        }
      }
      const box = h('div.grid-picker', h('div.gp-cells', cells), label);
      box.addEventListener('mouseleave', () => { paint(0, 0, 'hover'); showCur(); });
      updaters.push(showCur);
      return box;
    };

    if (mode === 'grid') {
      const gridAligns = [A_START, A_CENTER, A_END, A_STRETCH];
      // O espaço só aparece "junto" quando colunas e linhas têm o mesmo valor (senão mostra os dois)
      const split = gapSplit || (L().colGap ?? 8) !== (L().rowGap ?? 8);
      const gapRow = split
        ? row(
          num('↔', () => L().colGap ?? 8, (v) => each((n) => { n.layout.colGap = Math.max(0, v); }), { title: 'column-gap (espaço entre colunas)', min: 0, decimals: 0 }),
          num('↕', () => L().rowGap ?? 8, (v) => each((n) => { n.layout.rowGap = Math.max(0, v); }), { title: 'row-gap (espaço entre linhas)', min: 0, decimals: 0 }),
          h('button.icon-btn.small', { type: 'button', title: 'Unir', onclick: () => {
            each((n) => { n.layout.rowGap = n.layout.colGap; }); commit(); gapSplit = false; lastSig = null; render();
          } }, ico('link', 14)))
        : row(
          num('⇔', () => L().colGap ?? 8, (v) => each((n) => { n.layout.colGap = n.layout.rowGap = Math.max(0, v); }), { title: 'gap', min: 0, decimals: 0 }),
          h('button.icon-btn.small', { type: 'button', title: 'Separar', onclick: () => { gapSplit = true; lastSig = null; render(); } }, ico('corners', 14)));
      body.push(
        tip(h('div.cap-group', h('div.cap', 'Grade rápida'), gridPicker()), {
          title: 'Colunas × linhas', css: 'grid-template-columns: repeat(N, 1fr);\ngrid-template-rows: repeat(M, 1fr);',
          text: 'Passe o mouse para ver o tamanho da grade e clique para aplicar. Para algo diferente, use os campos logo abaixo.',
        }),
        row(
          capK('Colunas', 'grid-template-columns', num('col', () => L().cols ?? 2, (v) => each((n) => { n.layout.cols = Math.max(1, Math.round(v)); }), { min: 1, decimals: 0 })),
          capK('Linhas', 'grid-template-rows', num('lin', () => L().rows ?? 0, (v) => each((n) => { n.layout.rows = Math.max(0, Math.round(v)); }), { min: 0, decimals: 0 }))),
        capK('Espaço entre células', 'gap', gapRow),
        paddingBlock(),
        capK('Posição na célula', 'justify-items',
          row(matrix('justify-items', 'align-items'), h('div.col',
            subTip('justify-items ↔', 'justify-items'),
            select(opts(gridAligns, true), () => L().justify, (v) => each((n) => { n.layout.justify = v; }), 'justify-items'),
            subTip('align-items ↕', 'align-items'),
            select(opts(gridAligns, true), () => L().align, (v) => each((n) => { n.layout.align = v; }), 'align-items')))),
        tip(h('button.btn', {
          type: 'button',
          onclick: () => {
            each((f) => f.children.forEach((c) => { if (!c.absolute) { c.sizeX = 'fill'; c.sizeY = 'fill'; } }));
            commit();
          },
        }, ico('grid', 13), ' Itens preenchem as células'), {
          title: 'Esticar os itens', css: 'justify-self: stretch;\nalign-self: stretch;',
          text: 'Os itens passam a ocupar a célula inteira (largura e altura "Preencher").',
        }));
    } else {
      const flexJustify = [A_START, A_CENTER, A_END, ['space-between', 'space-between'], ['space-around', 'space-around'], ['space-evenly', 'space-evenly']];
      const flexAlign = [A_START, A_CENTER, A_END, A_STRETCH, ['baseline', 'baseline']];
      const mainArrow = mode === 'row' ? '↔' : '↕', crossArrow = mode === 'row' ? '↕' : '↔';
      body.push(
        row(
          capK('Espaço entre itens', 'gap', num(mainArrow, () => L().gap, (v) => each((n) => { n.layout.gap = Math.max(0, v); }), { min: 0, decimals: 0 })),
          capK('Quebra de linha', 'flex-wrap', h('div.al-check', check('wrap', () => L().wrap, (v) => each((n) => { n.layout.wrap = v; }))))),
        paddingBlock(),
        capK('Alinhamento', 'justify-content',
          row(matrix('justify-content', 'align-items'), h('div.col',
            subTip(`justify-content ${mainArrow}`, 'justify-content'),
            select(opts(flexJustify), () => L().justify, (v) => each((n) => { n.layout.justify = v; }), 'justify-content'),
            subTip(`align-items ${crossArrow}`, 'align-items'),
            select(opts(flexAlign), () => L().align, (v) => each((n) => { n.layout.align = v; }), 'align-items')))));
    }
    return autoSection(body);
  }

  /** Casca da seção Auto layout: título + selo "CSS puro" (com dica) à direita. */
  const autoSection = (body) => section('Auto layout', body, tip(h('span.al-badge', 'CSS puro'), {
    title: 'Auto layout é CSS de verdade', css: 'display: flex;\ndisplay: grid;',
    text: 'Nada aqui é imitação: o que você configura vira flexbox e grid no navegador, e o mesmo código sai na exportação.',
  }));

  /**
   * "Margem" do item (CSS margin): horizontal/vertical, ou os 4 lados (botão) — igual ao padding do container. Valores
   * zerados somem do documento (e do CSS). Só aparece para itens em fluxo e não absolutos.
   */
  function marginBlock() {
    const mg = () => P().margin || [0, 0, 0, 0];
    const setSides = (idxs) => (v) => each((n) => {
      const m = [...(n.margin || [0, 0, 0, 0])];
      for (const i of idxs) m[i] = Math.max(0, v);
      if (m.every((x) => !x)) delete n.margin; else n.margin = m;
    });
    const asym = mg()[0] !== mg()[2] || mg()[1] !== mg()[3];
    const showAll = marginExpanded || asym;
    const f = (i, label, t) => num(label, () => mg()[i], setSides([i]), { title: t, min: 0, decimals: 0 });
    return capK('Margem', 'margin', ...(showAll
      ? [row(f(0, 'T', 'margin-top'), f(1, 'R', 'margin-right')), row(f(3, 'L', 'margin-left'), f(2, 'B', 'margin-bottom'))]
      : [row(
        num('↔', () => mg()[1], setSides([1, 3]), { title: 'margin horizontal (esquerda e direita)', min: 0, decimals: 0 }),
        num('↕', () => mg()[0], setSides([0, 2]), { title: 'margin vertical (topo e base)', min: 0, decimals: 0 }),
        h('button.icon-btn.small', { type: 'button', title: 'Margem por lado', onclick: () => { marginExpanded = !marginExpanded; lastSig = null; render(); } }, ico('corners', 14)))]));
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
      body.push(marginBlock());
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
          reg(colorRow({ groups: colorGroups, get: () => g().color || '#FF3D3D', set: set('color'), commit, opacity: () => g().opacity ?? 0.12, setOpacity: set('opacity') })),
          iconButton('minus', 'Remover grade', () => { each((n) => n.grids.splice(i, 1)); commit(); }, 'small'))));
    });
    return section('Grades de layout', body, add);
  }

  /**
   * Seção "Vetor": editar pontos, o ponto selecionado (tipo canto/suave e posição X/Y), caminho fechado, inverter
   * direção e o código SVG (`d`) do desenho — para copiar, ou colar o `d` de outro SVG e trocar a forma.
   */
  function vectorSection() {
    const pen = tools.pen;
    const editing = ui.editPathId === P().id;
    const body = [];
    body.push(editing
      ? h('button.btn.primary', { type: 'button', onclick: () => pen.exitEdit() }, ico('check', 13), ' Concluir edição (Enter)')
      : h('button.btn', { type: 'button', onclick: () => pen.startEdit(P().id) }, ico('pen', 13), ' Editar pontos (Enter)'));

    // ---- ponto selecionado (só durante a edição de pontos) ----
    const count = editing ? pen.selectedCount() : 0;
    if (editing && !count) {
      body.push(h('p.hint', 'Clique num ponto para selecioná-lo, ou arraste uma caixa no vazio para pegar vários (Shift soma; Ctrl+A seleciona todos).'));
    }
    if (editing && count) {
      const typeBtn = (v, label, doc) => {
        const b = h('button.seg-btn.wide', { type: 'button', onclick: () => pen.setPointType(v) }, label);
        updaters.push(() => b.classList.toggle('on', pen.pointType() === v));
        return tip(b, doc);
      };
      body.push(
        cap(count > 1 ? `${count} pontos selecionados` : `Ponto ${ui.editPt + 1} de ${P().points.length}`, h('div.segmented.wide',
          typeBtn('corner', 'Canto', { title: 'Ponto de canto', css: 'L x y', text: 'Sem alças: o traço chega e sai em linha reta, formando uma quina.' }),
          typeBtn('smooth', 'Suave', { title: 'Ponto suave', css: 'C x1 y1, x2 y2, x y', text: 'Duas alças iguais e opostas: a curva passa sem quebra pelo ponto. Arraste uma alça para curvar (Alt quebra o espelho).' }))),
        count === 1 ? row(
          num('X', () => pen.pointPos()?.x ?? 0, (v) => pen.setPointPos('x', v), { decimals: 1, title: 'Posição X do ponto (relativa ao pai)' }),
          num('Y', () => pen.pointPos()?.y ?? 0, (v) => pen.setPointPos('y', v), { decimals: 1, title: 'Posição Y do ponto (relativa ao pai)' })) : null,
        h('div.row',
          h('button.btn', { type: 'button', disabled: P().points.length - count < 2, onclick: () => pen.deletePoint() }, ico('trash', 13), count > 1 ? ' Excluir pontos' : ' Excluir ponto'),
          count === 1 && P().closed
            ? tip(h('button.btn', { type: 'button', onclick: () => pen.openAfter() }, ico('x', 13), ' Abrir aqui'),
              { title: 'Abrir o caminho aqui', text: 'Corta o segmento logo depois deste ponto: o caminho fechado vira aberto e o ponto seguinte passa a ser o início.' })
            : null));
    }

    // ---- caminho ----
    body.push(
      h('div.row',
        check('Caminho fechado', () => P().closed, (v) => each((n) => { n.closed = v; if (v && n.fill.type === 'none') n.fill = defaultFill('#D9D9D9'); })),
        tip(h('button.btn.small', { type: 'button', onclick: () => pen.reverse(P().id) }, ico('flipH', 13), ' Inverter'),
          { title: 'Inverter direção', text: 'O primeiro ponto vira o último. O desenho fica igual; muda o sentido em que o traço é percorrido.' })));

    // ---- código SVG do caminho ----
    const ta = h('textarea.svg-d', { spellcheck: false, rows: 4, placeholder: 'M 0 0 L 10 10 …' });
    updaters.push(() => { if (document.activeElement !== ta) ta.value = pen.pathD(P().id); });
    body.push(h('details.svg-code', { open: false },
      h('summary', ico('code', 13), ' Código SVG (path d)'),
      h('p.hint', `O desenho como atributo \`d\` do SVG, no espaço 0 0 ${P().vw} ${P().vh}. Cole aqui o \`d\` de outro SVG e aplique para trocar a forma (cor, contorno e nome ficam).`),
      ta,
      h('div.row',
        h('button.btn', { type: 'button', onclick: async () => {
          try { await navigator.clipboard.writeText(ta.value); toast('Path copiado.'); } catch { ta.select(); toast('Selecione e copie (Ctrl+C).'); }
        } }, ico('copy', 13), ' Copiar'),
        h('button.btn.primary', { type: 'button', onclick: () => { if (pen.applyPathD(P().id, ta.value)) toast('Forma aplicada.'); else toast('Não achei um caminho nesse texto.'); } }, ico('check', 13), ' Aplicar'))));

    body.push(h('p.hint', 'Arraste pontos e alças (Shift trava em 45°). Alt+clique no traço adiciona ponto; Alt+clique num ponto alterna canto/suave. Com a caneta (P), clique na ponta de um caminho aberto para continuar desenhando. Setas movem os pontos.'));
    return section('Vetor', body);
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
      cap('Fonte', reg(fontField({
        get: () => P().fontFamily,
        // ao trocar a fonte: começa a baixar (Google Fonts) e ajusta o peso para o mais próximo que ela tem
        set: (v) => { ensureFonts([v]); each((n) => { n.fontFamily = v; n.fontWeight = nearestWeight(v, n.fontWeight); delete n.textStyleId; }); commit(); },
      }))),
      row(
        cap('Peso', select((weights.length ? weights : FONT_WEIGHTS).map(([w, l]) => [w, `${l} (${w})`]), () => P().fontWeight, (v) => each((n) => { n.fontWeight = Number(v); delete n.textStyleId; }), 'font-weight')),
        cap('Tamanho', num('Aa', () => P().fontSize, (v) => each((n) => { n.fontSize = Math.max(1, v); delete n.textStyleId; }), { title: 'font-size', min: 1, decimals: 1 }))),
      row(
        cap('Altura da linha', num('↕', () => P().lineHeight, (v) => each((n) => { n.lineHeight = v; delete n.textStyleId; }), { title: 'line-height (multiplicador)', min: 0, step: 0.05, decimals: 2 })),
        cap('Espaçamento', num('↔', () => P().letterSpacing, (v) => each((n) => { n.letterSpacing = v; delete n.textStyleId; }), { title: 'letter-spacing (px)', step: 0.1, decimals: 2 }))),
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
      row(
        capK('Espaço entre palavras', 'word-spacing', num('␣', () => P().wordSpacing ?? 0, (v) => each((n) => { if (v) n.wordSpacing = v; else delete n.wordSpacing; delete n.textStyleId; }), { step: 0.5, decimals: 1, title: 'word-spacing (px)' })),
        capK('Quando não cabe', P().truncate === 'clamp' ? 'line-clamp' : 'text-overflow', select([['', 'Quebrar linha'], ['ellipsis', 'Uma linha com …'], ['clamp', 'Limitar linhas']],
          () => P().truncate || '', (v) => each((n) => { if (v) n.truncate = v; else { delete n.truncate; delete n.lines; } }), 'Quando o texto não cabe'))),
      P().truncate === 'clamp'
        ? row(capK('Máximo de linhas', 'line-clamp', num('#', () => P().lines ?? 2, (v) => each((n) => { n.lines = Math.max(1, Math.round(v)); }), { min: 1, decimals: 0, title: 'Número máximo de linhas' })))
        : null,
      P().truncate && P().sizeX === 'hug' && !(P().maxW > 0)
        ? h('p.hint', 'Para cortar o texto, defina uma largura fixa ou uma largura máxima (em Tamanho → Limites). Com a largura "hug" sem limite, o texto nunca passa da própria largura.')
        : null,
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

  /** As cores mais usadas no projeto (até `max`), da mais usada para a menos. */
  function docTopColors(max = 14) {
    const count = new Map();
    const bump = (c) => c && count.set(c.toUpperCase(), (count.get(c.toUpperCase()) || 0) + 1);
    const walk = (list) => list.forEach((n) => {
      if (n.fill?.type === 'solid') bump(n.fill.color);
      if (n.stroke) bump(n.stroke.color);
      if (n.children) walk(n.children);
    });
    store.state.doc.pages.forEach((pg) => walk(pg.children));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c);
  }
  /** Grupos de cores que o seletor de cor mostra: as do projeto e os estilos de cor (as paletas prontas vêm do próprio seletor). */
  const colorGroups = () => [
    { title: 'Neste projeto', colors: docTopColors(16) },
    { title: 'Estilos de cor', colors: store.state.doc.styles.colors.map((c) => c.color).filter(Boolean) },
  ];

  /** Quadradinhos com as cores mais usadas no projeto (até 14): clicar aplica. Só aparece se houver 2+ cores. */
  function docColorChips(apply) {
    const top = docTopColors(14);
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
      cap('Tipo', select([['none', 'Nenhum'], ['solid', 'Cor sólida'], ['linear', 'Gradiente linear'], ['radial', 'Gradiente radial'], ['image', 'Imagem']],
        () => fill().type, (v) => {
          each((n) => { n.fill.type = v; });
          if (v === 'image' && !fill().assetId) {
            pickImage(({ assetId, w, h }) => { each((n) => { n.fill.assetId = assetId; n.fill.natW = w; n.fill.natH = h; }); commit(); });
          }
        }, 'Tipo de preenchimento')),
    ];
    const t = n0.fill.type;
    if (t === 'solid') {
      const styles = store.state.doc.styles.colors;
      body.push(reg(colorRow({ groups: colorGroups,
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
          reg(colorRow({ groups: colorGroups,
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
      const fitVal = () => fill().fit || 'cover';
      body.push(
        h('button.btn.wide', { type: 'button', onclick: () => pickImage(({ assetId, w, h }) => { each((n) => { n.fill.assetId = assetId; n.fill.natW = w; n.fill.natH = h; }); commit(); }) }, ico('image', 14), ' Trocar imagem'),
        capK('Ajuste da imagem', 'background-size', select([['cover', 'Cobrir (cover)'], ['contain', 'Conter (contain)'], ['fill', 'Esticar (100% 100%)'], ['size', 'Tamanho próprio (%)']], fitVal, (v) => each((n) => { n.fill.fit = v; }), 'background-size')));
      if (fitVal() === 'size') {
        body.push(capK('Largura', 'background-size', num('%', () => fill().size ?? 100, (v) => each((n) => { n.fill.size = Math.max(1, v); }), { min: 1, decimals: 0, title: 'Largura da imagem em % da camada' })));
      }
      // posição: matriz 3×3 (cantos, bordas, centro) + X/Y em % para ajuste fino
      const POS = [0, 50, 100];
      const posCells = [];
      for (const py of POS) {
        for (const pxv of POS) {
          const b = h('button.al-cell', { type: 'button', 'aria-label': `Posição ${pxv}% ${py}%`, onclick: () => { each((n) => { n.fill.posX = pxv; n.fill.posY = py; }); commit(); } }, h('i'));
          updaters.push(() => b.classList.toggle('on', (fill().posX ?? 50) === pxv && (fill().posY ?? 50) === py));
          posCells.push(b);
        }
      }
      body.push(capK('Posição', 'background-position', row(
        h('div.al-matrix', posCells),
        h('div.col',
          num('X', () => fill().posX ?? 50, (v) => each((n) => { n.fill.posX = Math.max(0, Math.min(100, v)); }), { min: 0, max: 100, decimals: 0, title: 'Posição horizontal em %' }),
          num('Y', () => fill().posY ?? 50, (v) => each((n) => { n.fill.posY = Math.max(0, Math.min(100, v)); }), { min: 0, max: 100, decimals: 0, title: 'Posição vertical em %' })))));
      if (fitVal() === 'contain' || fitVal() === 'size') {
        body.push(capK('Repetição', 'background-repeat', select([['no-repeat', 'Não repetir'], ['repeat', 'Repetir (ladrilho)'], ['repeat-x', 'Repetir na horizontal'], ['repeat-y', 'Repetir na vertical']], () => fill().repeat || 'no-repeat', (v) => each((n) => { n.fill.repeat = v; }), 'background-repeat')));
      }
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
        reg(colorRow({ groups: colorGroups,
          get: () => st().color, set: (v) => each((n) => { if (n.stroke) n.stroke.color = v; }), commit,
          opacity: () => st().opacity, setOpacity: (v) => each((n) => { if (n.stroke) n.stroke.opacity = v; }),
        })),
        row(cap('Espessura', num('▭', () => st().width, (v) => each((n) => {
          if (!n.stroke) return;
          n.stroke.width = Math.max(0, v);
          // com lados ativos, a espessura vale para todos os lados ligados
          if (n.stroke.sides) n.stroke.sides = n.stroke.sides.map((x) => (x > 0 ? n.stroke.width : 0));
        }), { title: 'espessura', min: 0, step: 0.5, decimals: 1 })),
          n0.type === 'text'
            ? null
            : cap('Estilo', select([['solid', 'Sólido'], ['dashed', 'Tracejado'], ['dotted', 'Pontilhado']], () => st().style, (v) => each((n) => { if (n.stroke) n.stroke.style = v; }), 'outline-style'))),
        n0.type === 'text' || sidesOn()
          ? null
          : cap('Posição', select([['inside', 'Dentro'], ['center', 'Centro'], ['outside', 'Fora']], () => st().position, (v) => each((n) => { if (n.stroke) n.stroke.position = v; }), 'Posição do contorno')));
      // vetores: extremidade (stroke-linecap) e quina (stroke-linejoin) do traço, essenciais para desenhar ícones
      if (n0.type === 'path') {
        body.push(row(
          cap('Extremidade', select([['round', 'Redonda'], ['butt', 'Reta'], ['square', 'Quadrada']], () => st().cap || 'round', (v) => each((n) => { if (n.stroke) n.stroke.cap = v; }), 'stroke-linecap')),
          cap('Quina', select([['round', 'Redonda'], ['miter', 'Pontuda'], ['bevel', 'Chanfrada']], () => st().join || 'round', (v) => each((n) => { if (n.stroke) n.stroke.join = v; }), 'stroke-linejoin'))));
      }
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
    // ---- seletor em ÍCONES: Todos · Cima · Direita · Baixo · Esquerda · Por lado. Os 4 lados ligam/desligam sozinhos
    // (o contorno vira "border-top/right/bottom/left" só nos lados ligados); "Todos" volta ao contorno completo.
    const SIDE = [['top', 0, 'sideTop', 'Cima', 'border-top'], ['right', 1, 'sideRight', 'Direita', 'border-right'], ['bottom', 2, 'sideBottom', 'Baixo', 'border-bottom'], ['left', 3, 'sideLeft', 'Esquerda', 'border-left']];
    const litSides = () => { const sd = st().sides; return sd ? sd.map((v) => v > 0) : [true, true, true, true]; };
    /** Liga/desliga um lado: de "todos", o clique escolhe SÓ aquele lado; depois soma/tira; os 4 ligados voltam a "todos". */
    const toggleSide = (i) => each((n) => {
      if (!n.stroke) return;
      const w = n.stroke.width || 1;
      const sd = n.stroke.sides ? [...n.stroke.sides] : null;
      if (!sd) { n.stroke.sides = [0, 0, 0, 0].map((_, k) => (k === i ? w : 0)); n.stroke.position = 'inside'; return; }
      sd[i] = sd[i] > 0 ? 0 : w;
      if (sd.every((v) => v > 0) && !n.stroke.sidesCustom) delete n.stroke.sides;
      else if (sd.every((v) => v === 0)) delete n.stroke.sides; // nenhum lado = sem lado nenhum não faz sentido: volta a "todos"
      else { n.stroke.sides = sd; n.stroke.position = 'inside'; }
    });
    const sideBtn = (ic, label, doc, onclick, isOn) => {
      const b = h('button.seg-btn.side', { type: 'button', 'aria-label': label, onclick: () => { onclick(); commit(); } }, ico(ic, 18));
      updaters.push(() => b.classList.toggle('on', isOn()));
      return tip(b, doc);
    };
    const sideIcons = h('div.segmented.sides',
      sideBtn('sideAll', 'Todos os lados', { title: 'Todos os lados', css: 'outline: 1px solid;', text: 'O contorno completo em volta da camada.' },
        () => each((n) => { if (n.stroke) { delete n.stroke.sides; delete n.stroke.sidesCustom; } }), () => !sidesOn()),
      ...SIDE.map(([, i, ic, label, css]) => sideBtn(ic, label, { title: `Lado: ${label.toLowerCase()}`, css: `${css}: 1px solid;`, text: 'Clique para ligar ou desligar este lado. Dá para combinar vários (ex.: cima e baixo).' },
        () => toggleSide(i), () => sidesOn() && litSides()[i])),
      sideBtn('sideCustom', 'Espessura por lado', { title: 'Espessura por lado', css: 'border-top-width: 1px;\nborder-right-width: 3px;', text: 'Dá uma espessura diferente a cada lado.' },
        () => apply(current() === 'custom' ? 'all' : 'custom'), () => current() === 'custom'));
    const rows = [cap('Lados do contorno', sideIcons)];
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
          reg(colorRow({ groups: colorGroups, get: () => sh().color, set: set('color'), commit, opacity: () => sh().opacity, setOpacity: set('opacity') })),
          isText ? null : check('Interna', () => sh().inset, set('inset')),
          iconButton('minus', 'Remover sombra', () => { each((n) => n.shadows.splice(i, 1)); commit(); }, 'small'))));
    });
    // desfoques com o nome da propriedade CSS ao lado (antes eram só os símbolos ◌ e ▨, difíceis de entender)
    body.push(prop('filter: blur', num('◌', () => P().blur, (v) => each((n) => { n.blur = Math.max(0, v); }), { title: 'filter: blur() — desfoca a própria camada', min: 0, decimals: 0 })));
    if (!isText) {
      body.push(prop('backdrop-filter', num('▨', () => P().bgBlur, (v) => each((n) => { n.bgBlur = Math.max(0, v); }), { title: 'backdrop-filter: blur() — desfoca o que está ATRÁS (efeito vidro)', min: 0, decimals: 0 }),
        'Efeito vidro: desfoca o que está atrás (use com um preenchimento semitransparente)'));
    }
    body.push(colorFiltersBlock());
    return section('Efeitos', body, add);
  }

  /** Filtros de COR (brightness, contrast, saturate, grayscale, hue-rotate): recolhido, abre sozinho se algum está em uso. */
  function colorFiltersBlock() {
    const used = !!(P().fx && Object.keys(P().fx).length);
    const fx = (label, cssKey, key, def, unit, opts = {}) => capK(label, cssKey, num(unit, () => P().fx?.[key] ?? def, (v) => each((n) => {
      n.fx ||= {};
      if (v == null || v === def) delete n.fx[key]; else n.fx[key] = v;
      if (!Object.keys(n.fx).length) delete n.fx;
    }), { decimals: 0, ...opts }));
    return h('details.size-limits', { open: used },
      h('summary', ico('chevron', 11), ' Filtros de cor', used ? h('span.dot-on') : null),
      h('div.section-body',
        row(fx('Brilho', 'brightness', 'brightness', 100, '%', { min: 0, max: 300 }), fx('Contraste', 'contrast', 'contrast', 100, '%', { min: 0, max: 300 })),
        row(fx('Saturação', 'saturate', 'saturate', 100, '%', { min: 0, max: 300 }), fx('Tons de cinza', 'grayscale', 'grayscale', 0, '%', { min: 0, max: 100 })),
        row(fx('Matiz', 'hue-rotate', 'hue', 0, '°', { min: -360, max: 360 }),
          used ? h('button.btn', { type: 'button', onclick: () => { each((n) => { delete n.fx; }); commit(); } }, ico('x', 13), ' Limpar') : null)));
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
      n.fill.type === 'image' ? n.fill.fit : '',
      n.type === 'text' ? `${n.truncate || ''}|${n.sizeX}|${n.maxW > 0}` : '',
      marginExpanded, n.margin && (n.margin[0] !== n.margin[2] || n.margin[1] !== n.margin[3]), n.fx && Object.keys(n.fx).length,
      !!(n.minW || n.maxW || n.minH || n.maxH), n.aspect > 0, n.aspect > 0 && n.sizeX === 'fixed' && n.sizeY === 'fixed',
      n.flipX, n.flipY, n.isMask, n.grids?.length, n.grids?.map((g) => g.type).join(), n.closed,
      // vetor: se está em edição de pontos, qual ponto e de que tipo (mudam os campos mostrados)
      n.type === 'path' ? `${ui.editPathId === n.id}|${ui.editPt}|${(ui.editPts || []).join('.')}|${ui.editPathId === n.id ? tools.pen.pointType() : ''}` : '',
      store.state.doc.styles.colors.length, store.state.doc.styles.texts.length, n.fill.styleId, n.textStyleId, n.type,
      n.type === 'text' ? n.fontFamily : '', // a lista de pesos depende da fonte
      n.constraints?.h, !!store.parentOf(n.id) && !hasLayout(store.parentOf(n.id)), paddingExpanded, gapSplit, n.layout ? n.layout.colGap !== n.layout.rowGap : '', n.layout ? n.layout.padding[0] !== n.layout.padding[2] || n.layout.padding[1] !== n.layout.padding[3] : '',
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
        const parts = [];
        if (canComp && isComp) parts.push(componentSection());
        parts.push(positionSection(), sizeSection());
        if (one && hasLayout(parent)) parts.push(flowItemSection());
        if (one && n.type === 'frame') parts.push(autoLayoutSection(), layoutGridsSection());
        if (n.type === 'text') parts.push(textSection());
        if (n.type === 'path') parts.push(vectorSection());
        // Seção é só organização do canvas: sem contorno, cantos, mesclagem nem efeitos (só cor de fundo)
        if (n.type !== 'section') parts.push(appearanceSection());
        if (n.type !== 'group' && n.type !== 'line') parts.push(fillSection());
        if (n.type !== 'group' && n.type !== 'section') parts.push(strokeSection());
        if (n.type !== 'section') parts.push(effectsSection());
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
