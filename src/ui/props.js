/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/props.js — PAINEL "DESIGN" (PROPRIEDADES DA SELEÇÃO)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Os campos usam os nomes do CSS (gap, padding, justify-content, align-items, opacity, mix-blend-mode...) de propósito:
 *  quem usa o painel aprende CSS sem perceber, e o código gerado bate com o que está escrito aqui.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, iconButton, numField, selectField, segmented, colorRow, tip, textField } from './dom.js';
import { askText, showMenu } from './menus.js';
import { informationButton } from './info.js';
import { styleValue, setStyleColor, varsOf, modesOf } from '../modes.js';
import { syncStyles } from '../components.js';
import { fontField } from './fontpicker.js';
import { nodeIcon } from './icons.js';
import { ensureFonts, nearestWeight, weightsOf } from '../fonts.js';
import {
  BLEND_MODES, FONT_WEIGHTS, OVERFLOWS, overflowOf, applyLimits, defaultFill, defaultShadow, defaultStroke, hasLayout, hasSizeLimits, isFlow, resizeNode,
  constraintsOf, round, cleanTrackList, STATE_LIST, canHaveStates, editState, hasStates, stateView, TEXT_TAGS, BOX_TAGS, tagOf, htmlTagIn, TYPE_LABEL,
  BREAKPOINTS, bpView, editBp, hasBps,
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
  // Em modo ESTADO (hover...), P() lê a "visão" do estado e each() escreve no estado (só o que difere do normal fica guardado)
  // Em modo RESPONSIVO (Tablet/Celular) o painel mostra a visão daquela largura e escreve só a diferença em node.bps
  const P = () => {
    const n = store.get(ids()[0]);
    if (!n) return n;
    return ui.editState ? stateView(n, ui.editState) : ui.bp ? bpView(n, ui.bp) : n;
  };
  const each = (fn) => store.update(() => nodes().forEach((n) => (ui.editState ? editState(n, ui.editState, fn) : ui.bp ? editBp(n, ui.bp, fn) : fn(n))), { structural: false });
  /** Pai da camada, na visão do breakpoint atual (o layout do pai pode ser outro no Celular). */
  const parentOf = (id) => { const p = store.parentOf(id); return p && ui.bp ? bpView(p, ui.bp) : p; };
  /** Fecha a edição (grava no histórico). Passado aos campos para chamarem ao terminar. */
  const commit = () => store.commit();
  /** Registra o `update` de um campo e devolve o elemento dele (para usar direto como filho). */
  const reg = (ctl) => { updaters.push(ctl.update); return ctl.el; };
  /** Linha horizontal de campos. */
  const row = (...c) => h('div.row', ...c);
  /**
   * Para cada seção: ícone e uma explicação curta, em português simples, de PARA QUE ELA SERVE e qual é a propriedade do
   * CSS por trás. A explicação abre pelo ícone de informação ao lado do título.
   */
  const SECTION_INFO = {
    'Posição': ['move', 'Onde a camada fica. X e Y são a distância da borda esquerda e do topo do pai (em CSS: left e top).'],
    'Tamanho': ['fit', 'O tamanho da caixa (width e height). Fixo = um valor em pixels; Hug = encolhe até caber o conteúdo; Fill = ocupa o espaço que sobrar.'],
    'Aparência': ['sun', 'Como a camada se mistura com o fundo e como ela termina: transparência (opacity), mistura de cores e cantos arredondados (border-radius).'],
    'Preenchimento': ['rect', 'O que enche a caixa por dentro: uma cor, um degradê ou uma imagem (CSS: background).'],
    'Cor do texto': ['text', 'A cor das letras (CSS: color).'],
    'Contorno': ['frame', 'A linha em volta da caixa (CSS: border). Dá para escolher só alguns lados.'],
    'Efeitos': ['shadow', 'Sombras (box-shadow) e desfoques (filter e backdrop-filter) que dão profundidade.'],
    'Texto': ['text', 'Fonte, tamanho, espaçamentos e alinhamento — as mesmas propriedades font-* e text-* do CSS.'],
    'Auto layout': ['row', 'Faz a caixa organizar os filhos sozinha, em fila ou em grade (CSS flexbox e grid), sem você posicionar cada um na mão.'],
    'Item do layout': ['layers', 'Como ESTA camada se comporta dentro do auto layout do pai: quanto espaço ocupa, sua margem e seu alinhamento.'],
    'Grades de layout': ['grid', 'Colunas e linhas de guia desenhadas por cima do frame, só para alinhar. Não saem no código.'],
    'Estados': ['play', 'Como a camada muda quando o mouse passa por cima, quando é clicada ou recebe foco (CSS: :hover, :active, :focus-visible).'],
    'Transformação': ['rotate', 'Aumenta ou diminui a camada neste estado (CSS: transform: scale).'],
    'Vetor': ['pen', 'Os pontos e as curvas do desenho. Edite com a caneta ou com duplo clique na forma.'],
    'Componente': ['component', 'Um modelo reutilizável: mudou o principal, mudam todas as cópias (instâncias).'],
    'Nota': ['file', 'Uma anotação sua sobre esta camada: para que ela serve. Não aparece no design; vai como comentário no código gerado.'],
    'HTML': ['code', 'A etiqueta (tag) que esta camada vira no código exportado. Escolher a certa ajuda a acessibilidade e o Google.'],
    'Exportar': ['download', 'Baixa esta camada como imagem (PNG), vetor (SVG) ou página (HTML).'],
  };
  // seções recolhidas: lembradas entre sessões; a nota só ocupa espaço quando pedida
  const loadSet = (key) => { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } };
  const saveSet = (key, set) => { try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* sem armazenamento */ } };
  const collapsed = loadSet('pd.collapsed');
  let noteOpen = false;
  /**
   * Seção do painel: cabeçalho (título, informação e ações opcionais) e controles.
   * Clicar no cabeçalho recolhe/abre a seção (lembrado).
   */
  // seções que quase nunca se usam começam recolhidas (a pessoa abre quando precisa; a escolha fica lembrada)
  const CLOSED_BY_DEFAULT = new Set(['Exportar', 'HTML']);
  const section = (title, body, actions, { closedByDefault = CLOSED_BY_DEFAULT.has(title) } = {}) => {
    const info = SECTION_INFO[title];
    // seções "fechadas por padrão" (Nota vazia) guardam o 'aberto' sob a chave "+Título"
    const key = closedByDefault ? '+' + title : title;
    const closed = closedByDefault ? !collapsed.has(key) : collapsed.has(key);
    const sec = h('section.panel-section' + (closed ? '.collapsed' : ''),
      h('header.section-head',
        h('span.sh-title', info ? h('span.sh-ico', ico(info[0], 14)) : null, h('span', title)),
        h('span.sh-right', info ? informationButton(title, info[1]) : null, actions || null, h('span.sh-chev', ico('chevron', 11)))),
      h('div.section-body', body));
    sec.firstChild.addEventListener('click', (e) => {
      if (e.target.closest('button, select, input')) return; // os botões do cabeçalho têm a própria ação
      sec.classList.toggle('collapsed');
      const nowClosed = sec.classList.contains('collapsed');
      if (nowClosed !== closedByDefault) collapsed.add(key); else collapsed.delete(key);
      saveSet('pd.collapsed', collapsed);
    });
    return sec;
  };

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
    const parent = parentOf(n0.id);
    const inFlow = isFlow(n0, parent);
    const body = ui.bp ? [] : [cap('Alinhamento', alignRow())];
    if (!single && ui.bp) return section('Posição', [h('p.hint', 'No modo Tablet/Celular, ajuste uma camada por vez.')]);
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
      body.push(capK('Posição', 'left-top', posRow));
      if (parent?.type === 'frame' && !hasLayout(parent) && !n0.absolute && !ui.bp) {
        body.push(capK('Restrições', 'constraints', row(
          select(H_CONS, () => constraintsOf(P()).h, (v) => each((n) => { n.constraints = { ...constraintsOf(n), h: v }; }), 'Constraint horizontal: como reage quando o frame muda de largura', '↔'),
          select(V_CONS, () => constraintsOf(P()).v, (v) => each((n) => { n.constraints = { ...constraintsOf(n), v: v }; }), 'Constraint vertical: como reage quando o frame muda de altura', '↕'))));
      }
    }
    body.push(capK('Rotação', 'rotate', row(
      num('↻', () => P().rotation, (v) => each((n) => { n.rotation = v; }), { title: 'rotação (transform: rotate)', decimals: 1, min: -360, max: 360, unit: '°' }),
      ui.bp ? null : h('div.btn-group',
        h('button.icon-btn.small' + (n0.flipX ? '.on' : ''), { type: 'button', title: 'Espelhar na horizontal (Shift+H)', onclick: () => commands.flip('x') }, ico('flipH', 14)),
        h('button.icon-btn.small' + (n0.flipY ? '.on' : ''), { type: 'button', title: 'Espelhar na vertical (Shift+V)', onclick: () => commands.flip('y') }, ico('flipV', 14))))));
    body.push(capK('Inclinação', 'skew', row(
      num('X', () => P().skewX ?? 0, (v) => each((n) => { if (v) n.skewX = v; else delete n.skewX; }), { title: 'inclinar na horizontal (transform: skew)', decimals: 1, min: -80, max: 80, unit: '°' }),
      num('Y', () => P().skewY ?? 0, (v) => each((n) => { if (v) n.skewY = v; else delete n.skewY; }), { title: 'inclinar na vertical (transform: skew)', decimals: 1, min: -80, max: 80, unit: '°' }))));
    // ordem de empilhamento (z-index): quem fica na frente de quem
    if (!ui.editState && !ui.bp) {
      const stack = (icon, title, mode) => h('button.icon-btn.small', { type: 'button', title, onclick: () => commands.reorder(mode) }, ico(icon, 14));
      body.push(capK('Empilhamento', 'z-index', h('div.btn-group',
        stack('front', 'Trazer para frente (Ctrl+Shift+])', 'front'), stack('front', 'Avançar um nível (Ctrl+])', 'forward'),
        stack('back', 'Recuar um nível (Ctrl+[)', 'backward'), stack('back', 'Enviar para trás (Ctrl+Shift+[)', 'back'))));
    }
    return section('Posição', body);
  }

  /**
   * Cabeçalho do painel: ícone, nome e tipo da camada (com a etiqueta HTML que ela vira),
   * mostrar/ocultar, travar e Nota sob demanda.
   */
  function headerBlock() {
    const ns = nodes();
    const n = ui.bp ? bpView(ns[0], ui.bp) : ns[0];
    const one = ns.length === 1;
    const flip = (key) => { store.update(() => ns.forEach((x) => { if (ui.bp && key === 'visible') editBp(x, ui.bp, (d) => { d.visible = !d.visible; }); else x[key] = !x[key]; }), { commit: true }); };
    const eyeBtn = h('button.icon-btn.small' + (!n.visible ? '.on' : ''), { type: 'button', title: ui.bp ? (n.visible ? 'Ocultar só nesta largura (display: none)' : 'Mostrar nesta largura') : (n.visible ? 'Ocultar (display: none)' : 'Mostrar'), onclick: () => flip('visible') }, ico(n.visible ? 'eye' : 'eyeOff', 14));
    const lockBtn = h('button.icon-btn.small' + (n.locked ? '.on' : ''), { type: 'button', title: n.locked ? 'Destravar' : 'Travar: não dá para clicar nela no canvas', onclick: () => flip('locked') }, ico(n.locked ? 'lock' : 'unlock', 14));
    const note = one && !ui.bp ? h('button.icon-btn.small.note-toggle' + (n.note ? '.has-note' : ''), {
      type: 'button', 'aria-label': 'Nota da camada', 'aria-expanded': String(noteOpen), title: 'Nota da camada',
      onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); },
      onclick: () => {
        noteOpen = !noteOpen; lastSig = null; render();
        if (noteOpen) noteInput?.focus();
        else el.querySelector('.note-toggle')?.focus();
      },
    }, ico('file', 14)) : null;
    if (note) updaters.push(() => note.classList.toggle('has-note', !!P()?.note));
    const sub = one
      ? [TYPE_LABEL[n.type] || n.type, ' · ', tip(h('code.sel-tag', `<${tagOf(n)}>`), { title: 'Etiqueta HTML', text: 'É assim que esta camada aparece no código exportado. Para mudar, use a seção "HTML" mais abaixo.' })]
      : ['Edição em grupo: valores da 1ª camada'];
    return h('div.sel-head',
      h('div.sel-top',
        h('span.sel-ico', ico(one ? nodeIcon(n.type) : 'layers', 18)),
        h('div.sel-info', h('div.sel-name', one ? n.name : `${ns.length} camadas`), h('div.sel-sub', ...sub)),
        h('div.sel-actions', eyeBtn, ui.bp ? null : lockBtn, note)),
      ui.bp ? bpBanner(ns) : null);
  }

  /** Aviso do modo responsivo: em que largura se está editando e o botão para voltar uma camada ao Desktop. */
  function bpBanner(ns) {
    const b = BREAKPOINTS.find((x) => x.id === ui.bp);
    const touched = ns.filter((x) => hasBps(x, ui.bp));
    const kids = [h('span', 'Editando o ', h('b', b.name), ` (janela até ${b.max}px). Só o que for diferente do Desktop é guardado; o resto continua herdando.`)];
    if (touched.length) {
      kids.push(h('button.btn.small', {
        type: 'button', title: `Apaga os ajustes do ${b.name} desta camada e volta a herdar do Desktop`,
        onclick: () => store.update(() => touched.forEach((x) => { delete x.bps[ui.bp]; if (!Object.keys(x.bps).length) delete x.bps; }), { commit: true }),
      }, ico('undo', 12), ' Restaurar ao Desktop'));
    }
    return h('div.bp-banner', ...kids);
  }

  // campo de texto da Nota (guardado para o foco pedido pelo menu "Adicionar nota")
  let noteInput = null;
  /**
   * Seção "Nota": uma anotação sobre PARA QUE SERVE a camada ("Botão principal: leva ao checkout"). Fica no projeto,
   * aparece como selo na lista de camadas e vira comentário no HTML/CSS gerado (dá para desligar).
   */
  function noteSection() {
    if (ids().length !== 1 || ui.editState || ui.bp) return null;
    const ta = h('textarea.note-input', { rows: 3, spellcheck: true, 'aria-label': 'Nota da camada', placeholder: 'Para que serve esta camada?\nEx.: Botão principal da tela inicial. Leva ao checkout.' });
    noteInput = ta;
    const dot = h('span.dot-on', { title: 'Esta camada tem nota' });
    const nd = () => store.get(ids()[0]);
    updaters.push(() => {
      if (document.activeElement !== ta) ta.value = nd()?.note || '';
      dot.style.display = nd()?.note ? '' : 'none';
    });
    ta.addEventListener('input', () => {
      const v = ta.value;
      store.update(() => { const n = nd(); if (!n) return; if (v.trim()) n.note = v; else delete n.note; }, { structural: false });
    });
    ta.addEventListener('change', commit); // grava no histórico ao sair do campo
    ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') ta.blur(); e.stopPropagation(); });
    const sec = section('Nota', [
      ta,
      check('Incluir no código (como comentário)', () => nd()?.noteInCode !== false, (v) => store.update(() => { const n = nd(); if (!n) return; if (v) delete n.noteInCode; else n.noteInCode = false; }, { structural: false })),
    ], dot);
    sec.classList.add('note-section');
    sec.hidden = !noteOpen;
    sec.classList.remove('collapsed');
    return sec;
  }

  /**
   * Seção "HTML": a etiqueta (tag) que a camada vira no código exportado, o endereço (para link) e a descrição para
   * leitores de tela e buscadores (aria-label). Só afeta o código gerado; o canvas continua igual.
   */
  function htmlSection() {
    if (ids().length !== 1 || ui.editState || ui.bp) return null;
    const n0 = P();
    if (n0.type === 'line') return null;
    const isText = n0.type === 'text';
    const names = { p: 'p — parágrafo', h1: 'h1 — título principal', h2: 'h2 — título', h3: 'h3 — subtítulo', h4: 'h4', h5: 'h5', h6: 'h6', span: 'span — trecho de texto', a: 'a — link', label: 'label — rótulo de campo', li: 'li — item de lista', button: 'button — botão',
      div: 'div — caixa genérica', section: 'section — seção', header: 'header — cabeçalho', footer: 'footer — rodapé', nav: 'nav — navegação', main: 'main — conteúdo principal', aside: 'aside — lateral', article: 'article — artigo', ul: 'ul — lista', ol: 'ol — lista numerada', form: 'form — formulário' };
    const tags = (isText ? TEXT_TAGS : BOX_TAGS).map((t) => [t, names[t] || t]);
    const body = [
      capK('Etiqueta', 'html-tag', select(tags, () => tagOf(P()), (v) => each((n) => { delete n.tag; if (v !== tagOf(n)) n.tag = v; }), 'Etiqueta HTML')),
    ];
    // etiqueta que não vale onde a camada está (ex.: <li> fora de uma lista): o HTML exportado usa a padrão; avisa o porquê
    const chain = [];
    for (let a = store.parentOf(n0.id); a; a = store.parentOf(a.id)) chain.unshift(a);
    const anc = [];
    for (const a of chain) anc.push(htmlTagIn(a, anc).tag); // como o gerador: a etiqueta EFETIVA de cada pai
    const tagCheck = htmlTagIn(n0, anc);
    if (tagCheck.reason) body.push(h('p.hint.warn', `No código vira <${tagCheck.tag}>: ${tagCheck.reason}.`));
    if (tagOf(n0) === 'a') {
      body.push(capK('Endereço do link', 'href', reg(textField({ get: () => P().href || '', set: (v) => each((n) => { if (v.trim()) n.href = v.trim(); else delete n.href; }), commit, placeholder: 'https://… ou #secao' }))));
    }
    body.push(capK(isText ? 'Descrição (opcional)' : 'Descrição / texto alternativo', 'aria-label', reg(textField({ get: () => P().alt || '', set: (v) => each((n) => { if (v.trim()) n.alt = v; else delete n.alt; }), commit, placeholder: isText ? 'Só se o texto não bastar' : 'Ex.: Foto da equipe sorrindo' }))));
    return section('HTML', body);
  }

  /**
   * Seção "Tamanho": W/H (+ travar proporção), modo de largura/altura (fixo / hug = do tamanho do conteúdo /
   * fill = preenche o espaço do auto layout) e, em frames da raiz, os tamanhos prontos (celular, desktop...).
   */
  function sizeSection() {
    const single = ids().length === 1;
    const n0 = P();
    const parent = parentOf(n0.id);
    const inFlow = isFlow(n0, parent);
    const body = [];
    if (!single && ui.bp) return section('Tamanho', [h('p.hint', 'No modo Tablet/Celular, ajuste uma camada por vez.')]);
    if (!single) {
      const box = () => canvas.unionAabb(commands.topSelection().map((n) => n.id)) || { x: 0, y: 0, w: 0, h: 0 };
      body.push(capK('Dimensões', 'width-height', row(num('W', () => box().w, (v) => commands.setSelectionBox({ w: v }), { min: 1, decimals: 1 }),
        num('H', () => box().h, (v) => commands.setSelectionBox({ h: v }), { min: 1, decimals: 1 }))));
      return section('Tamanho', body);
    }
    body.push(capK('Dimensões', 'width-height', row(
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
        capK('Largura', 'width-mode', select(sizeOpts(), () => P().sizeX, (v) => each((n) => { n.sizeX = v; }), 'Largura', 'W')),
        capK('Altura', 'height-mode', select(sizeOpts(), () => P().sizeY, (v) => each((n) => { n.sizeY = v; }), 'Altura', 'H'))));
    }
    if (n0.type === 'frame' && !parent) {
      body.push(select(PRESETS, () => '', (v) => {
        if (!v) return;
        const [w, hh] = v.split('x').map(Number);
        each((n) => { resizeNode(n, w, hh, 'w'); n.h = hh; n.sizeY = 'fixed'; });
      }, 'Predefinições de tamanho'));
      body.push(tip(check('Largura fluida no site exportado', () => !!P().fluid, (v) => each((n) => { if (v) n.fluid = true; else delete n.fluid; })), {
        title: 'Largura fluida', css: 'width: 100%;\nmax-width: 1200px;\nmin-height: 800px;\nmargin: 0 auto;',
        text: 'Na página exportada, esta tela ocupa 100% da janela até a largura que você desenhou (max-width), centralizada. A altura vira mínima. Sem isso, a tela tem sempre a largura fixa. Combine com Tablet/Celular para um site responsivo de verdade.',
      }));
    }
    if (hasSizeLimits(n0)) body.push(limitsBlock(n0));
    return section('Tamanho', body);
  }

  // Blocos recolhíveis (<details>) lembram se estavam abertos: sem isso fechariam sozinhos quando o último valor é apagado,
  // com a pessoa ainda no meio da edição.
  const openFolds = new Set();
  const fold = (key, used, title, ...body) => {
    const d = h('details.size-limits', { open: used || openFolds.has(key) },
      h('summary', ico('chevron', 11), ` ${title}`, used ? h('span.dot-on') : null), ...body);
    d.addEventListener('toggle', () => { if (d.open) openFolds.add(key); else openFolds.delete(key); });
    return d;
  };

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
    return fold('limits', used, 'Limites e proporção', h('div.section-body', body));
  }

  /**
   * Seção "Aparência": opacidade, mistura (mix-blend-mode), cantos arredondados (border-radius, juntos ou um por
   * canto), cortar conteúdo (overflow: hidden) e máscara.
   */
  function appearanceSection() {
    const n0 = P();
    const parent = parentOf(n0.id);
    const body = [row(
      capK('Opacidade', 'opacity', num('%', () => P().opacity * 100, (v) => each((n) => { n.opacity = v / 100; }), { min: 0, max: 100, decimals: 0, title: 'opacity' })),
      capK('Mesclagem', 'mix-blend-mode', select(BLEND_MODES.map((m) => [m, m]), () => P().blend, (v) => each((n) => { n.blend = v; }), 'mix-blend-mode (mistura com o que está atrás)', '◐')))];
    const canRound = !NO_RADIUS.includes(n0.type);
    if (canRound) {
      body.push(capK('Raio dos cantos', 'border-radius', row(
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
    if (n0.type === 'frame' && !ui.editState) {
      body.push(capK('Conteúdo que sai', 'overflow', select(OVERFLOWS, () => overflowOf(P()), (v) => each((n) => {
        n.clip = v !== 'visible'; // clip continua valendo para o SVG exportado e para projetos antigos
        if (v === 'hidden' || v === 'visible') delete n.overflow; else n.overflow = v;
      }), 'overflow')));
      if (overflowOf(n0).startsWith('scroll')) body.push(h('p.hint', 'A rolagem funciona na apresentação e no HTML exportado. No editor o conteúdo aparece cortado.'));
    }
    if (!ui.editState && !ui.bp && (n0.isMask || parent?.type === 'group')) {
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
    blur: ['filter: blur()', 'filter: blur(8px);', 'Desfoca a PRÓPRIA camada (e tudo que há nela). Quanto maior o valor, mais borrado.'],
    'backdrop-filter': ['backdrop-filter', 'backdrop-filter: blur(16px);', 'Efeito VIDRO: desfoca o que está ATRÁS da camada. Use junto com um preenchimento semitransparente para aparecer.'],
    transition: ['transition', 'transition: all 200ms ease;', 'Faz a camada MUDAR SUAVEMENTE entre o estado normal e hover/pressionado/foco, em vez de pular. Duração em milissegundos (0 = sem transição).'],
    sticky: ['position: sticky', 'position: sticky;\ntop: 0;', 'O item continua no layout, mas GRUDA a essa distância do topo quando a página rola. Ideal para cabeçalhos e menus laterais. Funciona na apresentação e no HTML exportado.'],
    'pointer-events': ['pointer-events', 'pointer-events: none;', '"Ignora o mouse" deixa os cliques atravessarem a camada até o que está embaixo. Útil para enfeites e sobreposições decorativas.'],
    cursor: ['cursor', 'cursor: pointer;', 'O formato do mouse quando passa por cima. "pointer" (mãozinha) diz que a camada é clicável. Aparece no código exportado e na apresentação, não no editor.'],
    transform: ['transform', 'transform: scale(1.05);', 'Aumenta (acima de 1) ou diminui (abaixo de 1) a camada, a partir do centro. Num :hover costuma ser 1.02 a 1.08; num :active, 0.97.'],
    'flex-grow': ['flex-grow', 'flex: 2 1 0%;', 'O PESO deste item na divisão do espaço sobrando (só para itens "Preencher" no eixo principal). Com pesos 1 e 2, um item fica com 1/3 e o outro com 2/3.'],
    overflow: ['overflow', 'overflow-y: auto;', 'O que acontece com o que passa da borda: cortar, mostrar por cima ou criar uma ROLAGEM (barra). A rolagem só funciona na apresentação e no HTML exportado; no editor o conteúdo aparece cortado.'],
    position: ['position', 'position: absolute;\nleft: 12px;\ntop: 8px;', 'Marcado, o item SAI do fluxo do layout e fica onde você o coloca (left/top), por cima dos outros. Bom para selos, badges e enfeites.'],
    'grid-column': ['grid-column', 'grid-column: span 2;', 'Quantas COLUNAS da grade este item ocupa. "span 2" = duas colunas de largura.'],
    'grid-row': ['grid-row', 'grid-row: span 2;', 'Quantas LINHAS da grade este item ocupa.'],
    'justify-self': ['justify-self', 'justify-self: center;', 'Posição HORIZONTAL só deste item dentro da célula (ou "stretch" para esticar). Vence o justify-items do container.'],
    'align-self': ['align-self', 'align-self: center;', 'Alinhamento só deste item no eixo cruzado (ou "stretch" para esticar). Vence o align-items do container.'],
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
    // ---- posição, tamanho e aparência
    'left-top': ['Posição (X e Y)', 'position: absolute;\nleft: 100px;\ntop: 100px;', 'A distância da camada até a borda ESQUERDA (X) e até o TOPO (Y) do pai. Dentro de um auto layout quem posiciona é o navegador, por isso os campos ficam apagados.', 'left · top'],
    constraints: ['Restrições', 'left: 16px;\nright: 16px;', 'Como a camada reage quando o frame do pai muda de tamanho: gruda numa borda, nas duas (e estica), fica no centro ou escala junto. É o que mantém um layout bom em telas de tamanhos diferentes.', 'left · right · top · bottom'],
    rotate: ['Rotação', 'transform: rotate(15deg);', 'Gira a camada em torno do próprio centro, em graus. Positivo gira para a direita (horário).', 'transform'],
    'width-height': ['Largura e altura', 'width: 200px;\nheight: 100px;', 'O tamanho da caixa em pixels. O cadeado trava a proporção: mudar uma medida muda a outra junto.', 'width · height'],
    'width-mode': ['Modo da largura', 'width: 200px;     /* fixo */\nwidth: fit-content; /* hug */\nflex: 1 1 0%;      /* fill */', 'FIXO = um valor em pixels. HUG = encolhe até caber o conteúdo. FILL = ocupa o espaço que sobrar no pai (só dentro de um auto layout).', 'width'],
    'height-mode': ['Modo da altura', 'height: 100px;     /* fixo */\nheight: fit-content; /* hug */\nflex: 1 1 0%;      /* fill */', 'FIXO = um valor em pixels. HUG = encolhe até caber o conteúdo. FILL = ocupa o espaço que sobrar no pai (só dentro de um auto layout).', 'height'],
    'z-index': ['Ordem de empilhamento', 'z-index: 2;', 'Quem fica por cima de quem quando duas camadas se sobrepõem. No design é a ordem da lista de camadas: a de cima da lista fica na frente.'],
    opacity: ['Opacidade', 'opacity: 0.8;', 'Deixa a camada inteira (com tudo que há dentro) mais transparente. 100% = sólida; 0% = invisível.'],
    'mix-blend-mode': ['Mesclagem', 'mix-blend-mode: multiply;', 'Como as cores desta camada se misturam com o que está ATRÁS dela. "multiply" escurece, "screen" clareia, "overlay" aumenta o contraste. "normal" = sem mistura.'],
    'border-radius': ['Cantos arredondados', 'border-radius: 12px;', 'Arredonda os cantos da caixa. Um valor grande demais vira uma pílula (ou um círculo, se a caixa for quadrada). O botão ao lado deixa cada canto diferente.'],
    // ---- texto
    'font-family': ['Fonte', "font-family: 'Inter', sans-serif;", 'O desenho das letras. As fontes do Google são baixadas sozinhas e já saem no código exportado.'],
    'font-weight': ['Peso da fonte', 'font-weight: 600;', 'A espessura das letras: 400 = normal, 700 = negrito. Só aparecem os pesos que a fonte escolhida realmente tem.'],
    'font-size': ['Tamanho da fonte', 'font-size: 16px;', 'A altura das letras, em pixels. 16px é o tamanho padrão de texto de leitura na web.'],
    'line-height': ['Altura da linha', 'line-height: 1.5;', 'O espaço vertical de cada linha, como MULTIPLICADOR do tamanho da fonte. 1.5 = respiro confortável para parágrafos; 1.1 a 1.2 = títulos.'],
    'text-align': ['Alinhamento e estilo do texto', 'text-align: center;\nfont-style: italic;\ntext-decoration: underline;', 'Alinha as linhas do texto (esquerda, centro, direita) e liga itálico, sublinhado ou riscado.', 'text-align · font-style'],
    'white-space': ['white-space', 'white-space: nowrap;', 'Como o texto trata espaços e quebras: "nowrap" deixa tudo numa linha, "pre-line" respeita as quebras que você digitou, "pre" respeita também os espaços. Padrão: quebra ao chegar na borda.'],
    'word-break': ['word-break', 'word-break: break-word;', 'O que fazer com palavras ou links muito longos que não cabem: "break-all" quebra em qualquer letra, "keep-all" nunca quebra dentro da palavra.'],
    'text-wrap': ['text-wrap', 'text-wrap: balance;', '"balance" equilibra o tamanho das linhas (ótimo para títulos: nada de uma palavra sozinha na última linha). "pretty" evita linhas curtas no fim de parágrafos.'],
    order: ['order', 'order: -1;', 'Muda a POSIÇÃO VISUAL do item dentro do flex/grid sem mexer na lista de camadas. Menor vem antes. Útil no responsivo: no Celular, a imagem pode vir antes do texto (order: -1).'],
    'flex-shrink': ['flex-shrink', 'flex: 0 1 auto;', 'Se falta espaço, o item pode ficar menor que o tamanho dele? "Sim" deixa o navegador encolher (bom para textos e imagens em linhas apertadas).'],
    skew: ['transform: skew', 'transform: skew(-8deg, 0deg);', 'Inclina a camada (como itálico para caixas). Bom para faixas e selos diagonais. Funciona junto com a rotação.'],
    'custom-css': ['CSS livre', 'scroll-margin-top: 80px;\naccent-color: #2f6ae0;', 'Qualquer propriedade de CSS que o painel ainda não tem, uma por linha ("propriedade: valor;"). Vale no canvas, na apresentação e no código exportado, e pode ser diferente por breakpoint. Vem por último, então vence o resto do painel.'],
    'text-transform': ['Caixa das letras', 'text-transform: uppercase;', 'Muda as letras para MAIÚSCULAS, minúsculas ou Cada Palavra Com Inicial Grande, sem reescrever o texto.'],
    'vertical-align': ['Alinhamento vertical', 'display: flex;\nalign-content: center;', 'Onde o texto fica dentro da caixa quando ela é mais alta que ele: no topo, no meio ou embaixo. Só vale com altura fixa.', 'align-content'],
    'letter-spacing': ['Espaço entre letras', 'letter-spacing: 0.5px;', 'Abre (positivo) ou fecha (negativo) o espaço entre as LETRAS. Um pouquinho de espaço fica elegante em textos MAIÚSCULOS.'],
    // ---- preenchimento, contorno, sombras
    background: ['Tipo de preenchimento', 'background-color: #7c5cff;\nbackground-image: linear-gradient(...);', 'O que enche a caixa: nada, uma cor sólida, um degradê (linear, radial ou cônico) ou uma imagem.'],
    'border-width': ['Espessura do contorno', 'border: 2px solid #000;', 'A grossura da linha, em pixels. Com 0 a linha some.', 'border-width'],
    'border-style': ['Estilo da linha', 'border-style: dashed;', 'Sólida (contínua), tracejada (traços) ou pontilhada (bolinhas).'],
    'stroke-position': ['Onde fica o contorno', 'box-sizing: border-box;\noutline-offset: -2px;', 'DENTRO: a linha fica por dentro da caixa (o tamanho não muda). CENTRO: metade dentro, metade fora. FORA: toda por fora, como um halo.', 'outline-offset'],
    'stroke-linecap': ['Ponta do traço', 'stroke-linecap: round;', 'O formato das PONTAS de uma linha aberta: redondas, retas ou quadradas (que passam um pouco do fim).'],
    'stroke-linejoin': ['Quina do traço', 'stroke-linejoin: round;', 'O formato das CURVAS e QUINAS onde o traço muda de direção: arredondada, pontuda ou chanfrada.'],
    'border-sides': ['Lados do contorno', 'border-top: 1px solid;\nborder-bottom: 1px solid;', 'Escolha quais lados da caixa têm linha: só embaixo (como um sublinhado de campo), só em cima, nas laterais... Clique nos lados para ligar e desligar.', 'border-top · right · bottom · left'],
    'html-tag': ['Etiqueta HTML', '<button class="botao">Comprar</button>', 'A etiqueta diz ao navegador, ao leitor de tela e ao Google O QUE a camada é: botão, título, link, cabeçalho... Escolher a certa não muda o visual, mas muda a acessibilidade e o SEO.', 'tag'],
    href: ['Endereço do link', '<a href="https://exemplo.com">', 'Para onde o clique leva. Pode ser um site (https://…), uma âncora dentro da página (#contato) ou um e-mail (mailto:oi@exemplo.com).', 'href'],
    'aria-label': ['Descrição (texto alternativo)', '<div role="img" aria-label="Foto da equipe">', 'Uma frase que descreve a camada para quem não a enxerga (leitor de tela) e para o Google. Para imagens e ícones, é o "alt".', 'aria-label'],
    'shadow-x': ['Sombra: deslocamento horizontal', 'box-shadow: 4px 0 8px rgba(0,0,0,.25);', 'Quanto a sombra se desloca para a direita (positivo) ou para a esquerda (negativo).', 'box-shadow'],
    'shadow-y': ['Sombra: deslocamento vertical', 'box-shadow: 0 4px 8px rgba(0,0,0,.25);', 'Quanto a sombra desce (positivo) ou sobe (negativo). Sombras suaves de card costumam ter Y maior que X.', 'box-shadow'],
    'shadow-blur': ['Sombra: desfoque', 'box-shadow: 0 4px 16px rgba(0,0,0,.25);', 'O quanto a borda da sombra é esfumada. 0 = borda dura; valores altos = sombra suave e espalhada.', 'box-shadow'],
    'shadow-spread': ['Sombra: espalhar', 'box-shadow: 0 0 0 4px rgba(0,0,0,.25);', 'Aumenta (positivo) ou diminui (negativo) o TAMANHO da sombra antes do desfoque. Com blur 0 vira um contorno grosso.', 'box-shadow'],
  };
  /** Monta o objeto de dica de uma propriedade do CSS_DOC. */
  const cssTip = (key) => ({ title: CSS_DOC[key][0], css: CSS_DOC[key][1], text: CSS_DOC[key][2] });
  /** Grupo com legenda em português + nome da propriedade CSS (mono) e dica rica ao passar o mouse na legenda e no controle. */
  // campos que podem ser ligados a uma VARIÁVEL de tamanho: chave do CSS → campo da camada
  const VAR_FOR = { gap: 'gap', padding: 'padding', 'border-radius': 'radius', 'font-size': 'fontSize' };
  const VAR_CSS = { gap: 'gap', padding: 'padding', radius: 'border-radius', fontSize: 'font-size' };
  /** Botãozinho "variável" na legenda de um campo: liga/desliga o campo a uma variável do projeto (--espaco-md). */
  function varButton(prop) {
    if (ui.bp || ui.editState) return null;
    const b = h('button.var-btn', { type: 'button', 'aria-label': 'Ligar a uma variável' }, ico('component', 11));
    const current = (n) => (prop === 'gap' ? n.layout?.gap : prop === 'padding' ? n.layout?.padding?.[0] : prop === 'radius' ? n.radius?.[0] : n.fontSize) ?? 0;
    const refresh = () => {
      const n = store.get(ids()[0]);
      const v = varsOf(store.state.doc.styles).find((x) => x.id === n?.vars?.[prop]);
      b.classList.toggle('on', !!v);
      b.hidden = !n || ((prop === 'gap' || prop === 'padding') && (!hasLayout(n) || (prop === 'gap' && n.layout.mode === 'grid')));
      tip(b, v
        ? { title: `Variável: ${v.name}`, css: `${VAR_CSS[prop]}: var(--nome);`, text: 'Este campo está ligado a uma variável do projeto. Mudar o valor da variável (aba Recursos) muda todas as camadas ligadas. Editar o campo à mão desliga.' }
        : { title: 'Ligar a uma variável', text: 'Reaproveite um valor do projeto (ex.: espaço médio) em vez de um número solto. No CSS exportado vira var(--nome).' });
    };
    updaters.push(refresh);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const n = store.get(ids()[0]);
      if (!n) return;
      const vars = varsOf(store.state.doc.styles);
      const boundId = n.vars?.[prop];
      const r = b.getBoundingClientRect();
      const items = vars.length
        ? vars.map((v) => ({ label: `${v.name} · ${v.value}px`, checked: boundId === v.id, onClick: () => commands.bindSizeVar(nodes(), prop, v) }))
        : [{ label: 'Nenhuma variável ainda', disabled: true }];
      items.push('sep', {
        label: 'Nova variável com o valor atual…', icon: 'plus',
        onClick: async () => {
          const name = await askText({ title: 'Nova variável', label: 'Nome (ex.: Espaço médio, Raio dos cards)', value: `Variável ${vars.length + 1}`, confirm: 'Criar' });
          if (!name) return;
          commands.bindSizeVar(nodes(), prop, commands.addSizeVar(name, current(n)));
        },
      });
      if (boundId) items.push({ label: 'Desligar da variável', onClick: () => commands.bindSizeVar(nodes(), prop, null) });
      showMenu(r.left, r.bottom + 4, items, { anchorRight: true });
    });
    return b;
  }
  const capK = (label, key, ...children) => {
    const g = h('div.cap-group', h('div.cap.has-tip', label, h('span.cap-right', h('span.cap-css', CSS_DOC[key][3] || key), VAR_FOR[key] ? varButton(VAR_FOR[key]) : null)), ...children);
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
      const b = h('button.al-mode', { type: 'button', dataset: { v }, onclick: () => { if (ui.bp) each((n) => { n.layout = { ...n.layout, mode: v }; }); else store.update(() => commands.setLayoutMode(nodes(), v)); commit(); } },
        ico(icon, 20), h('span.al-mode-name', name), h('span.al-mode-css', css));
      updaters.push(() => { b.classList.toggle('on', L().mode === v); b.setAttribute('aria-pressed', String(L().mode === v)); });
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
      const s = nodeStyle(P(), parentOf(P().id), store.state.doc.assets);
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
    tip(head, { title: 'CSS gerado em tempo real', text: 'Mostra o CSS exato que este frame exporta. Edite pelos controles de layout abaixo; no modo Grade, Trilhas personalizadas permite digitar grid-template-columns e grid-template-rows diretamente.' });
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
            'aria-label': `${jName}: ${j}; ${aName}: ${a}`,
            onclick: () => { each((n) => { n.layout.justify = j; n.layout.align = a; }); commit(); },
          }, h('i'));
          updaters.push(() => { const active = L().justify === j && L().align === a; btn.classList.toggle('on', active); btn.setAttribute('aria-pressed', String(active)); });
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
     * Seletor visual de grade 6×6: passar o mouse ou mover o foco destaca "colunas × linhas"; clique/Enter aplica.
     * A navegação usa foco roving e setas, para a pessoa não precisar atravessar 36 paradas de Tab.
     */
    const gridPicker = () => {
      const N = 6;
      const cells = [];
      let activeCell = 0;
      const label = h('div.gp-label', { 'aria-live': 'polite' });
      const paint = (c, r, cls) => cells.forEach((el, i) => el.classList.toggle(cls, i % N < c && Math.floor(i / N) < r));
      const showCur = () => {
        const selected = P();
        if (!selected?.layout) return; // a seleção pode sumir enquanto o painel ainda está redesenhando
        if (selected.layout.colsTemplate || selected.layout.rowsTemplate) {
          paint(0, 0, 'on');
          label.textContent = 'Trilhas CSS personalizadas';
          return;
        }
        const c = selected.layout.cols ?? 2, r = selected.layout.rows || Math.ceil((selected.children?.filter((k) => !k.absolute).length || 1) / c);
        paint(c, r, 'on');
        label.textContent = `${c} × ${L().rows ? L().rows : 'auto'}`;
      };
      const grid = h('div.gp-cells', { role: 'grid', 'aria-label': 'Escolher colunas e linhas', 'aria-rowcount': N, 'aria-colcount': N });
      for (let r = 0; r < N; r++) {
        const row = h('div.gp-row', { role: 'row' });
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          const cell = h('button.gp-cell', { type: 'button', 'aria-label': `${c + 1} colunas × ${r + 1} linhas`, tabindex: i === activeCell ? 0 : -1 });
          const preview = () => { paint(c + 1, r + 1, 'hover'); label.textContent = `${c + 1} × ${r + 1}`; };
          cell.addEventListener('mouseenter', preview);
          cell.addEventListener('focus', () => {
            activeCell = i;
            cells.forEach((el, index) => { el.tabIndex = index === activeCell ? 0 : -1; });
            preview();
          });
          cell.addEventListener('click', () => { each((n) => { n.layout.cols = c + 1; n.layout.rows = r + 1; delete n.layout.colsTemplate; delete n.layout.rowsTemplate; }); commit(); });
          cells.push(cell);
          row.append(h('div', { role: 'gridcell' }, cell));
        }
        grid.append(row);
      }
      grid.addEventListener('keydown', (e) => {
        const index = cells.indexOf(document.activeElement);
        if (index < 0) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          cells[index].click();
          return;
        }
        const row = Math.floor(index / N), col = index % N;
        let next = index;
        if (e.key === 'ArrowLeft') next = row * N + Math.max(0, col - 1);
        else if (e.key === 'ArrowRight') next = row * N + Math.min(N - 1, col + 1);
        else if (e.key === 'ArrowUp') next = Math.max(0, row - 1) * N + col;
        else if (e.key === 'ArrowDown') next = Math.min(N - 1, row + 1) * N + col;
        else if (e.key === 'Home') next = e.ctrlKey ? 0 : row * N;
        else if (e.key === 'End') next = e.ctrlKey ? N * N - 1 : row * N + N - 1;
        else return;
        e.preventDefault();
        e.stopPropagation();
        cells[next].focus();
      });
      const box = h('div.grid-picker', grid, label);
      box.addEventListener('mouseleave', () => { paint(0, 0, 'hover'); showCur(); });
      grid.addEventListener('focusout', (e) => {
        if (!grid.contains(e.relatedTarget)) { paint(0, 0, 'hover'); showCur(); }
      });
      updaters.push(showCur);
      return box;
    };

    if (mode === 'grid') {
      const gridAligns = [A_START, A_CENTER, A_END, A_STRETCH];
      // O CSS só chega ao documento quando o navegador reconhece a sintaxe. Um rascunho inválido continua editável.
      const trackField = (key, property, placeholder) => {
        let invalid = false;
        let modelValue = L()[key] || '';
        const message = h('p.track-error', { id: `track-error-${n0.id}-${key}`, role: 'status', hidden: true });
        const field = textField({ mono: true, placeholder, get: () => L()[key] || '',
          set: (value) => {
            const cleaned = cleanTrackList(value);
            invalid = !!value.trim() && (!cleaned || !CSS.supports(property, cleaned));
            field.input.setAttribute('aria-invalid', String(invalid));
            message.hidden = !invalid;
            message.textContent = invalid ? 'CSS inválido. O último layout válido foi mantido. Esc cancela a edição.' : '';
            if (!invalid) { modelValue = cleaned; each((n) => { if (cleaned) n.layout[key] = cleaned; else delete n.layout[key]; }); }
          }, commit: () => { if (!invalid) commit(); },
        });
        field.input.setAttribute('aria-label', property);
        field.input.setAttribute('aria-describedby', message.id);
        field.input.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          invalid = false;
          message.hidden = true;
          field.input.setAttribute('aria-invalid', 'false');
          field.input.value = L()[key] || '';
          field.input.blur();
          commit();
        });
        return reg({ el: h('div.track-field', field.el, message), update: () => {
          const current = L()[key] || '';
          if (invalid && current !== modelValue) {
            invalid = false;
            message.hidden = true;
            field.input.setAttribute('aria-invalid', 'false');
          }
          modelValue = current;
          if (!invalid) field.update();
        } });
      };
      const TRACK_PRESETS = [
        ['', 'Escolher um modelo…'],
        ['repeat(2, minmax(0, 1fr))', '2 colunas iguais'],
        ['repeat(3, minmax(0, 1fr))', '3 colunas iguais'],
        ['repeat(4, minmax(0, 1fr))', '4 colunas iguais'],
        ['repeat(auto-fit, minmax(180px, 1fr))', 'Cards responsivos (mín. 180 px)'],
        ['240px minmax(0, 1fr)', 'Lateral + conteúdo'],
      ];
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
          text: 'Passe o mouse ou use as setas para escolher colunas × linhas; clique ou Enter aplica. Para algo diferente, use os campos logo abaixo.',
        }),
        row(
          capK('Colunas', 'grid-template-columns', num('col', () => L().cols ?? 2, (v) => each((n) => { n.layout.cols = Math.max(1, Math.round(v)); delete n.layout.colsTemplate; }), { min: 1, decimals: 0 })),
          capK('Linhas', 'grid-template-rows', num('lin', () => L().rows ?? 0, (v) => each((n) => { n.layout.rows = Math.max(0, Math.round(v)); delete n.layout.rowsTemplate; }), { min: 0, decimals: 0 }))),
        // trilhas personalizadas em CSS (ex.: "200px 1fr 2fr"): vazio = usa os números acima
        fold('tracks', !!(L().colsTemplate || L().rowsTemplate), 'Trilhas personalizadas (CSS)',
          h('div.section-body',
            capK('Modelos de coluna', 'grid-template-columns', select(TRACK_PRESETS, () => '', (v) => {
              if (!v) return;
              each((n) => { n.layout.colsTemplate = cleanTrackList(v); });
            }, 'Aplicar um modelo de colunas CSS')),
            capK('Colunas', 'grid-template-columns', trackField('colsTemplate', 'grid-template-columns', '200px 1fr 2fr')),
            capK('Linhas', 'grid-template-rows', trackField('rowsTemplate', 'grid-template-rows', 'auto 1fr auto')),
            h('p.hint', 'Escolha um modelo e depois edite o CSS nos campos. Aceita px, %, fr, auto, minmax() e repeat(). As trilhas personalizadas substituem Colunas/Linhas; apague o campo para voltar aos controles numéricos.'))),
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

  /** Dicas dos estados. */
  const STATE_DOC = {
    '': { title: 'Normal', text: 'A camada como ela é, sem o mouse em cima. Seus controles de sempre.' },
    hover: { title: ':hover', css: '.botao:hover { … }', text: 'Quando o mouse está em cima. Mude cor, sombra, escala… só o que mudar aqui vira regra :hover no CSS.' },
    active: { title: ':active', css: '.botao:active { … }', text: 'Enquanto o botão do mouse está apertado em cima da camada (o efeito de "apertar").' },
    focus: { title: ':focus-visible', css: '.botao:focus-visible { … }', text: 'Quando a camada recebe foco pelo teclado (Tab). Importante para acessibilidade.' },
  };
  const EASINGS = [['ease', 'Suave (ease)'], ['ease-in-out', 'Entra e sai (ease-in-out)'], ['ease-out', 'Desacelera (ease-out)'], ['ease-in', 'Acelera (ease-in)'], ['linear', 'Constante (linear)']];
  const CURSORS = [['', 'Padrão'], ['pointer', 'Mãozinha (pointer)'], ['text', 'Texto (text)'], ['grab', 'Mão aberta (grab)'], ['not-allowed', 'Bloqueado (not-allowed)'], ['default', 'Seta (default)']];
  const WHITE_SPACES = [['', 'Normal (quebra na borda)'], ['nowrap', 'Uma linha (nowrap)'], ['pre-line', 'Respeita Enter (pre-line)'], ['pre', 'Exato (pre)']];
  const WORD_BREAKS = [['', 'Normal'], ['break-word', 'Quebra se precisar'], ['break-all', 'Quebra em qualquer letra'], ['keep-all', 'Nunca dentro da palavra']];
  const TEXT_WRAPS = [['', 'Normal'], ['balance', 'Equilibrado (balance)'], ['pretty', 'Sem sobras (pretty)']];
  const STICKY = [['', 'Não'], ['0', 'No topo (0px)'], ['16', '16px do topo'], ['64', '64px do topo']];
  const POINTER_EVENTS = [['', 'Normal'], ['none', 'Ignora (none)']];

  /**
   * Seção "Estados": alterna entre Normal, Hover, Pressionado e Foco. Num estado, o painel passa a editar SÓ as
   * sobrescritas dele (cor, contorno, sombra, filtros, opacidade, cantos, escala): o canvas mostra a camada naquele
   * estado e o CSS ganha `.camada:hover { … }`. No Normal ficam a transição (`transition`) e o cursor.
   */
  function statesSection() {
    const base = store.get(ids()[0]);
    const cur = ui.editState || '';
    const tabs = [['', 'Normal', ''], ...STATE_LIST];
    const seg = h('div.segmented.wide.states', tabs.map(([k, label]) => tip(
      h('button.seg-btn.wide' + (cur === k ? '.on' : ''), {
        type: 'button',
        onclick: () => { ui.editState = k || null; lastSig = null; store.emit('doc'); },
      }, label, k && hasStates(base, k) ? h('span.dot-on') : null), STATE_DOC[k])));
    const body = [seg];
    if (cur) {
      const [, label, pseudo] = STATE_LIST.find(([k]) => k === cur);
      body.push(h('p.hint', `Editando "${label}": só o que você mudar aqui vira regra ${pseudo} no CSS. Tamanho, posição e layout não mudam com o mouse.`));
      if (hasStates(base, cur)) {
        body.push(h('button.btn', { type: 'button', onclick: () => {
          store.update(() => nodes().forEach((n) => {
            if (!n.states) return;
            const s = { ...n.states }; delete s[cur];
            if (Object.keys(s).length) n.states = s; else delete n.states;
          }), { structural: false });
          commit();
        } }, ico('x', 13), ' Limpar este estado'));
      }
    } else {
      body.push(row(
        capK('Duração', 'transition', num('ms', () => P().transition?.duration ?? 0, (v) => each((n) => {
          if (v > 0) n.transition = { duration: Math.round(v), easing: n.transition?.easing || 'ease' }; else delete n.transition;
        }), { min: 0, max: 5000, step: 50, decimals: 0 })),
        capK('Curva', 'transition', select(EASINGS, () => P().transition?.easing || 'ease', (v) => each((n) => {
          if (n.transition) n.transition = { ...n.transition, easing: v };
        }), 'transition-timing-function'))),
      capK('Cursor', 'cursor', select(CURSORS, () => P().cursor || '', (v) => each((n) => { if (v) n.cursor = v; else delete n.cursor; }), 'cursor')),
      row(
        capK('Fixar ao rolar', 'sticky', select(STICKY, () => P().sticky == null ? '' : String(P().sticky), (v) => each((n) => { if (v === '') delete n.sticky; else n.sticky = Number(v); }), 'position: sticky')),
        capK('Mouse', 'pointer-events', select(POINTER_EVENTS, () => P().pointerEvents || '', (v) => each((n) => { if (v) n.pointerEvents = v; else delete n.pointerEvents; }), 'pointer-events'))));
    }
    return section('Estados', body, null, { closedByDefault: !ui.editState && !hasStates(base) });
  }

  /** Escala do estado (`transform: scale()`): só existe dentro de um estado. */
  function stateScaleBlock() {
    return section('Transformação', [capK('Escala', 'transform', num('×', () => P().scale ?? 1, (v) => each((n) => { n.scale = v; }), { min: 0.1, max: 3, step: 0.01, decimals: 2 }))]);
  }

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
    const parent = parentOf(P().id);
    const grid = parent.layout.mode === 'grid';
    const body = [
      tip(h('div.al-check', check('Fora do fluxo (absolute)', () => P().absolute, (v) => each((n) => {
        if (v) {
          const o = commandsOrigin(n);
          n.x = o.x; n.y = o.y;
        }
        n.absolute = v;
      }))), cssTip('position')),
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
          row(
            capK('Colunas ocupadas', 'grid-column', num('span', () => P().colSpan ?? 1, (v) => each((n) => { n.colSpan = Math.max(1, Math.round(v)); }), { min: 1, decimals: 0 })),
            capK('Linhas ocupadas', 'grid-row', num('span', () => P().rowSpan ?? 1, (v) => each((n) => { n.rowSpan = Math.max(1, Math.round(v)); }), { min: 1, decimals: 0 }))),
          row(
            capK('Horizontal na célula', 'justify-self', selfSelect('justifySelf', 'sizeX', selfOpts, 'justify-self')),
            capK('Vertical na célula', 'align-self', selfSelect('alignSelf', 'sizeY', selfOpts, 'align-self'))));
      } else {
        body.push(capK('Alinhamento deste item', 'align-self', selfSelect('alignSelf', cross, selfOpts, 'align-self')));
        // "Preencher" no eixo principal: peso na divisão do espaço (flex-grow)
        if (P()[parent.layout.mode === 'row' ? 'sizeX' : 'sizeY'] === 'fill') {
          body.push(capK('Peso do espaço', 'flex-grow', num('×', () => P().grow ?? 1, (v) => each((n) => { if (v > 0 && v !== 1) n.grow = v; else delete n.grow; }), { min: 0.1, step: 0.5, decimals: 1, title: 'flex-grow' })));
        }
      }
    }
    if (!P().absolute) {
      body.push(row(
        capK('Ordem', 'order', num('#', () => P().order ?? 0, (v) => each((n) => { if (Math.round(v)) n.order = Math.round(v); else delete n.order; }), { decimals: 0, min: -99, max: 99, title: 'order: posição visual sem mudar a lista de camadas' })),
        grid ? null : capK('Pode encolher', 'flex-shrink', select([['', 'Não (0)'], ['1', 'Sim (1)']], () => (P().shrink ? '1' : ''), (v) => each((n) => { if (v) n.shrink = true; else delete n.shrink; }), 'flex-shrink'))));
    }
    return section('Item do layout', body);
  }

  /** Posição atual da camada relativa ao pai (lida do DOM): usada ao marcar "absoluta" para ela não pular de lugar. */
  const commandsOrigin = (n) => {
    const parent = parentOf(n.id);
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
    return section('Grades de layout', body, add, { closedByDefault: !n0.grids?.length });
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
      ui.bp ? null : row(
        select([['', 'Sem estilo'], ...styles.map((t) => [t.id, t.name])], () => P().textStyleId || '',
          (v) => each((n) => { if (v) n.textStyleId = v; else delete n.textStyleId; }), 'Estilo de texto'),
        iconButton('plus', 'Criar estilo de texto a partir desta camada', async () => {
          const name = await askText({ title: 'Nome do estilo de texto', label: 'Nome do estilo de texto', value: `Texto ${styles.length + 1}`, confirm: 'Salvar' });
          if (name) commands.addTextStyle(P(), name);
        }, 'small')),
      ui.bp ? null : capK('Fonte', 'font-family', reg(fontField({
        get: () => P().fontFamily,
        // ao trocar a fonte: começa a baixar (Google Fonts) e ajusta o peso para o mais próximo que ela tem
        set: (v) => { ensureFonts([v]); each((n) => { n.fontFamily = v; n.fontWeight = nearestWeight(v, n.fontWeight); delete n.textStyleId; }); commit(); },
      }))),
      row(
        capK('Peso', 'font-weight', select((weights.length ? weights : FONT_WEIGHTS).map(([w, l]) => [w, `${l} (${w})`]), () => P().fontWeight, (v) => each((n) => { n.fontWeight = Number(v); delete n.textStyleId; }), 'font-weight')),
        capK('Tamanho', 'font-size', num('Aa', () => P().fontSize, (v) => each((n) => { n.fontSize = Math.max(1, v); delete n.textStyleId; }), { title: 'font-size', min: 1, decimals: 1 }))),
      row(
        capK('Altura da linha', 'line-height', num('↕', () => P().lineHeight, (v) => each((n) => { n.lineHeight = v; delete n.textStyleId; }), { title: 'line-height (multiplicador)', min: 0, step: 0.05, decimals: 2 })),
        capK('Espaçamento', 'letter-spacing', num('↔', () => P().letterSpacing, (v) => each((n) => { n.letterSpacing = v; delete n.textStyleId; }), { title: 'letter-spacing (px)', step: 0.1, decimals: 2 }))),
      capK('Alinhamento e estilo', 'text-align', row(
        reg(segmented({
          options: [['left', 'alignTextL', 'Esquerda'], ['center', 'alignTextC', 'Centro'], ['right', 'alignTextR', 'Direita']],
          get: () => P().textAlign, set: (v) => each((n) => { n.textAlign = v; }), commit,
        })),
        ui.bp ? null : reg(segmented({
          options: [['italic', 'italic', 'Itálico']],
          get: () => (P().fontStyle === 'italic' ? 'italic' : ''),
          set: () => each((n) => { n.fontStyle = n.fontStyle === 'italic' ? 'normal' : 'italic'; }), commit,
        })),
        ui.bp ? null : reg(segmented({
          options: [['underline', 'underline', 'Sublinhado'], ['line-through', 'strike', 'Riscado']],
          get: () => P().textDecoration,
          set: (v) => each((n) => { n.textDecoration = n.textDecoration === v ? 'none' : v; }), commit,
        })))),
      row(
        capK('Caixa das letras', 'text-transform', select([['none', 'Normal'], ['uppercase', 'MAIÚSCULAS'], ['lowercase', 'minúsculas'], ['capitalize', 'Cada Palavra']],
          () => P().textTransform || 'none', (v) => each((n) => { n.textTransform = v; }), 'text-transform')),
        P().sizeY === 'fixed' && !ui.bp
          ? capK('Alinhamento vertical', 'vertical-align', reg(segmented({
            options: [['top', 'alignT', 'Alinhar ao topo da caixa'], ['center', 'alignCV', 'Centralizar na vertical'], ['bottom', 'alignB', 'Alinhar embaixo']],
            get: () => P().textVAlign || 'top', set: (v) => each((n) => { n.textVAlign = v; }), commit,
          })))
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
      row(
        capK('Espaços e quebras', 'white-space', select(WHITE_SPACES, () => P().whiteSpace || '', (v) => each((n) => { if (v) n.whiteSpace = v; else delete n.whiteSpace; }), 'white-space')),
        capK('Palavras longas', 'word-break', select(WORD_BREAKS, () => P().wordBreak || '', (v) => each((n) => { if (v) n.wordBreak = v; else delete n.wordBreak; }), 'word-break'))),
      capK('Equilíbrio das linhas', 'text-wrap', select(TEXT_WRAPS, () => P().textWrap || '', (v) => each((n) => { if (v) n.textWrap = v; else delete n.textWrap; }), 'text-wrap')),
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
    { title: 'Cores do documento', colors: docTopColors(16) },
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
   * Seletor de ESTILO DE COR (visual do Figma): um botão com a amostra e o nome do estilo ligado (ou "Sem estilo de cor").
   * Abre um menu com as amostras dos estilos do documento, "Criar estilo a partir desta cor" e "Desvincular". Ao lado,
   * um atalho: + cria estilo (sem estilo ligado) ou desvincula (com estilo ligado).
   */
  function colorStylePicker(styles, styleOf) {
    const swatchOf = (c) => (ui.mode ? styleValue(c, ui.mode).color : c.color) || c.color;
    const createStyle = async () => {
      const name = await askText({ title: 'Nome do estilo de cor', label: 'Nome do estilo de cor', value: `Cor ${styles.length + 1}`, confirm: 'Salvar' });
      if (name) commands.addColorStyle(P(), name);
    };
    const link = (id) => { each((n) => { if (id) n.fill.styleId = id; else delete n.fill.styleId; }); commit(); };
    const dot = h('span.style-dot');
    const name = h('span.style-name');
    const btn = h('button.style-pick', {
      type: 'button', 'aria-haspopup': 'menu', 'aria-label': 'Estilo de cor',
      onclick: () => {
        const r = btn.getBoundingClientRect();
        const cur = styleOf()?.id;
        const items = styles.length
          ? [{ heading: true, label: 'Estilos de cor do projeto' }, ...styles.map((c) => ({ label: c.name, swatch: swatchOf(c), checked: c.id === cur, onClick: () => link(c.id) }))]
          : [{ label: 'Nenhum estilo de cor ainda', disabled: true }];
        items.push('sep', { label: 'Criar estilo a partir desta cor…', icon: 'plus', onClick: createStyle });
        if (cur) items.push({ label: 'Desvincular do estilo', icon: 'x', onClick: () => link(null) });
        showMenu(r.left, r.bottom + 4, items);
      },
    }, dot, name, ico('chevron', 11));
    updaters.push(() => {
      const c = styleOf();
      btn.classList.toggle('linked', !!c);
      dot.style.background = c ? swatchOf(c) : '';
      name.textContent = c ? c.name : 'Sem estilo de cor';
    });
    const side = styleOf()
      ? iconButton('x', 'Desvincular do estilo de cor', () => link(null), 'small')
      : iconButton('plus', 'Criar estilo de cor a partir desta cor', createStyle, 'small');
    return h('div.row.style-row', btn, side);
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
      capK('Tipo', 'background', select([['none', 'Nenhum'], ['solid', 'Cor sólida'], ['linear', 'Gradiente linear'], ['radial', 'Gradiente radial'], ['conic', 'Gradiente cônico'], ['image', 'Imagem']],
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
      // com um MODO de cor ativo (escuro...) e a cor ligada a um estilo, o campo edita o valor do estilo NAQUELE modo
      const styleOf = () => styles.find((c) => c.id === fill().styleId);
      const inMode = () => !!(ui.mode && !ui.editState && styleOf());
      const editStyle = (color, opacity) => store.update(() => { setStyleColor(styleOf(), ui.mode, color ?? styleValue(styleOf(), ui.mode).color, opacity); syncStyles(store.state.doc); }, { structural: false });
      body.push(reg(colorRow({ groups: colorGroups,
        get: () => (inMode() ? styleValue(styleOf(), ui.mode).color : fill().color),
        set: (v) => (inMode() ? editStyle(v) : each((n) => { n.fill.color = v; delete n.fill.styleId; })), commit,
        opacity: () => (inMode() ? styleValue(styleOf(), ui.mode).opacity : fill().opacity),
        setOpacity: (v) => (inMode() ? editStyle(undefined, v) : each((n) => { n.fill.opacity = v; delete n.fill.styleId; })),
      })));
      if (ui.mode && !ui.editState) {
        const mname = modesOf(store.state.doc.styles).find((m) => m.id === ui.mode)?.name || 'este modo';
        body.push(h('p.hint', fill().styleId ? `Modo ${mname}: a cor que você muda aqui vale só neste modo (é o valor do estilo de cor).` : `Modo ${mname} ativo: esta cor não está ligada a um estilo, então vale igual em todos os modos. Crie um estilo de cor (botão +) para ter um valor por modo.`));
      }
      body.push(docColorChips((hex) => { each((n) => { n.fill.color = hex; n.fill.opacity = 1; delete n.fill.styleId; }); commit(); }));
      body.push(colorStylePicker(styles, styleOf));
    } else if (t === 'linear' || t === 'radial' || t === 'conic') {
      body.push(gradientBar());
      if (t === 'linear' || t === 'conic') body.push(row(num('°', () => fill().angle, (v) => each((n) => { n.fill.angle = v; }), { title: t === 'conic' ? 'onde o giro começa (graus)' : 'ângulo', decimals: 0, min: -360, max: 360 })));
      if (t === 'conic' && !isText) body.push(h('p.hint', 'Cônico: as cores giram em volta do centro. Em vetores e no SVG exportado vale só a cor da 1ª parada (o SVG não tem gradiente cônico).'));
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
        row(capK('Espessura', 'border-width', num('▭', () => st().width, (v) => each((n) => {
          if (!n.stroke) return;
          n.stroke.width = Math.max(0, v);
          // com lados ativos, a espessura vale para todos os lados ligados
          if (n.stroke.sides) n.stroke.sides = n.stroke.sides.map((x) => (x > 0 ? n.stroke.width : 0));
        }), { title: 'espessura', min: 0, step: 0.5, decimals: 1 })),
          n0.type === 'text'
            ? null
            : capK('Estilo', 'border-style', select([['solid', 'Sólido'], ['dashed', 'Tracejado'], ['dotted', 'Pontilhado']], () => st().style, (v) => each((n) => { if (n.stroke) n.stroke.style = v; }), 'outline-style'))),
        n0.type === 'text' || sidesOn()
          ? null
          : capK('Posição', 'stroke-position', select([['inside', 'Dentro'], ['center', 'Centro'], ['outside', 'Fora']], () => st().position, (v) => each((n) => { if (n.stroke) n.stroke.position = v; }), 'Posição do contorno')));
      // vetores: extremidade (stroke-linecap) e quina (stroke-linejoin) do traço, essenciais para desenhar ícones
      if (n0.type === 'path') {
        body.push(row(
          capK('Extremidade', 'stroke-linecap', select([['round', 'Redonda'], ['butt', 'Reta'], ['square', 'Quadrada']], () => st().cap || 'round', (v) => each((n) => { if (n.stroke) n.stroke.cap = v; }), 'stroke-linecap')),
          capK('Quina', 'stroke-linejoin', select([['round', 'Redonda'], ['miter', 'Pontuda'], ['bevel', 'Chanfrada']], () => st().join || 'round', (v) => each((n) => { if (n.stroke) n.stroke.join = v; }), 'stroke-linejoin'))));
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
    const rows = [capK('Lados do contorno', 'border-sides', sideIcons)];
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
        row(capK('Horizontal', 'shadow-x', num('X', () => sh().x, set('x'), { decimals: 0 })), capK('Vertical', 'shadow-y', num('Y', () => sh().y, set('y'), { decimals: 0 }))),
        row(capK('Desfoque', 'shadow-blur', num('B', () => sh().blur, (v) => set('blur')(Math.max(0, v)), { min: 0, decimals: 0 })),
          isText ? null : capK('Espalhar', 'shadow-spread', num('S', () => sh().spread, set('spread'), { decimals: 0 }))),
        h('div.effect-foot',
          reg(colorRow({ groups: colorGroups, get: () => sh().color, set: set('color'), commit, opacity: () => sh().opacity, setOpacity: set('opacity') })),
          isText ? null : check('Interna', () => sh().inset, set('inset')),
          iconButton('minus', 'Remover sombra', () => { each((n) => n.shadows.splice(i, 1)); commit(); }, 'small'))));
    });
    // desfoques com o nome da propriedade CSS ao lado (antes eram só os símbolos ◌ e ▨, difíceis de entender)
    body.push(row(
      capK('Desfoque', 'blur', num('◌', () => P().blur, (v) => each((n) => { n.blur = Math.max(0, v); }), { min: 0, decimals: 0 })),
      isText ? null : capK('Vidro (fundo)', 'backdrop-filter', num('▨', () => P().bgBlur, (v) => each((n) => { n.bgBlur = Math.max(0, v); }), { min: 0, decimals: 0 }))));
    body.push(colorFiltersBlock());
    return section('Efeitos', body, add, { closedByDefault: !(n0.shadows.length || n0.blur > 0 || n0.bgBlur > 0 || (n0.fx && Object.keys(n0.fx).length)) });
  }

  /** Filtros de COR (brightness, contrast, saturate, grayscale, hue-rotate): recolhido, abre sozinho se algum está em uso. */
  function colorFiltersBlock() {
    const used = !!(P().fx && Object.keys(P().fx).length);
    const fx = (label, cssKey, key, def, unit, opts = {}) => capK(label, cssKey, num(unit, () => P().fx?.[key] ?? def, (v) => each((n) => {
      n.fx ||= {};
      if (v == null || v === def) delete n.fx[key]; else n.fx[key] = v;
      if (!Object.keys(n.fx).length) delete n.fx;
    }), { decimals: 0, ...opts }));
    return fold('filters', used, 'Filtros de cor',
      h('div.section-body',
        row(fx('Brilho', 'brightness', 'brightness', 100, '%', { min: 0, max: 300 }), fx('Contraste', 'contrast', 'contrast', 100, '%', { min: 0, max: 300 })),
        row(fx('Saturação', 'saturate', 'saturate', 100, '%', { min: 0, max: 300 }), fx('Tons de cinza', 'grayscale', 'grayscale', 0, '%', { min: 0, max: 100 })),
        row(fx('Matiz', 'hue-rotate', 'hue', 0, '°', { min: -360, max: 360 }),
          used ? h('button.btn', { type: 'button', onclick: () => { each((n) => { delete n.fx; }); commit(); } }, ico('x', 13), ' Limpar') : null)));
  }

  /**
   * CSS LIVRE: qualquer declaração que o painel ainda não tem ("propriedade: valor;" por linha). Vale por breakpoint;
   * linhas que o navegador não entende ficam marcadas em amarelo (o navegador as ignora).
   */
  function customCssSection() {
    const n0 = P();
    const area = h('textarea.custom-css', {
      rows: 4, spellcheck: false, 'aria-label': 'CSS livre desta camada', placeholder: 'scroll-margin-top: 80px;\naccent-color: #2f6ae0;',
      onkeydown: (e) => e.stopPropagation(),
    });
    area.value = n0.customCss || '';
    const status = h('p.hint.custom-css-status');
    const check = () => {
      const bad = area.value.split(/;|\n/).map((l) => l.trim()).filter(Boolean)
        .filter((l) => {
          const i = l.indexOf(':');
          if (i < 0) return true;
          const prop = l.slice(0, i).trim();
          return typeof CSS !== 'undefined' && CSS.supports && !prop.startsWith('--') && !CSS.supports(prop, l.slice(i + 1).trim().replace(/!important$/, ''));
        });
      status.textContent = bad.length ? `O navegador não entendeu: ${bad.slice(0, 3).join(' · ')}` : area.value.trim() ? 'Tudo certo: vale no canvas e no código exportado.' : '';
      status.classList.toggle('bad', !!bad.length);
    };
    area.addEventListener('input', check);
    area.addEventListener('change', () => { const v = area.value.trim(); each((n) => { if (v) n.customCss = v; else delete n.customCss; }); commit(); });
    check();
    return section('CSS livre', [capK('Declarações', 'custom-css', area), status], null, { closedByDefault: !n0.customCss });
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
              for (const n of commands.topSelection()) await exportPng(n, store.state.doc.assets, exportScale, store.state.doc.styles);
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
          onclick: () => commands.topSelection().forEach((n) => exportHtmlFile(n, store.state.doc.assets, store.state.doc.styles)),
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
    const n = ui.bp ? bpView(ns[0], ui.bp) : ns[0];
    const parent = parentOf(n.id);
    return [
      ns.map((x) => x.id + x.type).join(','), n.fill.type, n.fill.stops.length, !!n.stroke, n.shadows.length,
      // contorno por lado: quais lados e se é "personalizado" mudam os campos mostrados
      n.stroke?.sides ? n.stroke.sides.map((v) => (v > 0 ? 1 : 0)).join('') + (n.stroke.sidesCustom ? 'c' : '') : '',
      n.layout?.mode, n.layout?.wrap, hasLayout(parent), parent?.layout?.mode, n.absolute, n.sizeX, n.sizeY, radiusExpanded,
      ui.bp, ui.mode, hasBps(ns[0], ui.bp), n.visible, n.locked, tagOf(n), n.fluid, store.state.doc.pages.length, n.layout?.mode === 'grid', n.component, n.instanceOf, n.lockRatio,
      n.fill.type === 'image' ? n.fill.fit : '',
      n.type === 'frame' ? overflowOf(n) : '',
      n.type === 'text' ? `${n.truncate || ''}|${n.sizeX}|${n.maxW > 0}` : '',
      ui.editState, n.states ? Object.keys(n.states).join() : '', n.transition?.duration > 0,
      marginExpanded, n.margin && (n.margin[0] !== n.margin[2] || n.margin[1] !== n.margin[3]), n.fx && Object.keys(n.fx).length,
      !!(n.minW || n.maxW || n.minH || n.maxH), n.aspect > 0, n.aspect > 0 && n.sizeX === 'fixed' && n.sizeY === 'fixed',
      n.flipX, n.flipY, n.isMask, n.grids?.length, n.grids?.map((g) => g.type).join(), n.closed,
      // vetor: se está em edição de pontos, qual ponto e de que tipo (mudam os campos mostrados)
      n.type === 'path' ? `${ui.editPathId === n.id}|${ui.editPt}|${(ui.editPts || []).join('.')}|${ui.editPathId === n.id ? tools.pen.pointType() : ''}` : '',
      store.state.doc.styles.colors.length, store.state.doc.styles.texts.length, n.fill.styleId, n.textStyleId, n.type,
      n.type === 'text' ? n.fontFamily : '', // a lista de pesos depende da fonte
      n.constraints?.h, !!parentOf(n.id) && !hasLayout(parentOf(n.id)), paddingExpanded, gapSplit, n.layout ? n.layout.colGap !== n.layout.rowGap : '', n.layout ? n.layout.padding[0] !== n.layout.padding[2] || n.layout.padding[1] !== n.layout.padding[3] : '',
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
        const parent = parentOf(n.id);
        // Ordem (parecida com a do Figma): onde está → que tamanho tem → como se organiza (layout) → como parece.
        // Componente principal/instância aparece no topo (é informação importante); "Criar componente" vai para o fim.
        const one = ids().length === 1;
        const canComp = one && ['frame', 'group', 'rect', 'ellipse'].includes(n.type);
        const isComp = !!(n.component || n.instanceOf);
        const parts = [];
        if (ui.editState && canHaveStates(n)) {
          // modo ESTADO: só o que um estado pode mudar (aparência, escala, preenchimento, contorno, efeitos)
          parts.push(statesSection(), appearanceSection(), stateScaleBlock(), fillSection(), strokeSection(), effectsSection());
          el.replaceChildren(...parts);
          updaters.forEach((u) => { try { u(); } catch (err) { console.error('[painel Design]', err); } });
          return;
        }
        parts.push(headerBlock(), noteSection());
        if (ui.bp) {
          // modo RESPONSIVO: só o que pode mudar com a largura da tela
          parts.length = 0;
          parts.push(headerBlock(), positionSection(), sizeSection());
          if (one && hasLayout(parent)) parts.push(flowItemSection());
          if (one && n.type === 'frame') parts.push(autoLayoutSection());
          if (n.type === 'text') parts.push(textSection());
          if (n.type !== 'section') parts.push(appearanceSection());
          if (n.type !== 'group' && n.type !== 'line') parts.push(fillSection());
          if (n.type !== 'group' && n.type !== 'section') parts.push(strokeSection());
          if (n.type !== 'section' && n.type !== 'path') parts.push(effectsSection());
          if (one) parts.push(customCssSection());
          el.replaceChildren(...parts.filter(Boolean));
          updaters.forEach((u) => { try { u(); } catch (err) { console.error('[painel Design]', err); } });
          return;
        }
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
        if (canHaveStates(n)) parts.push(statesSection());
        if (canComp && !isComp) parts.push(componentSection());
        parts.push(customCssSection(), htmlSection(), exportSection());
        el.replaceChildren(...parts.filter(Boolean));
      }
    }
    // Um campo com problema (valor ausente num documento antigo ou estranho) não pode impedir os outros de atualizar:
    // cada atualização roda isolada e o erro vai para o console em vez de derrubar o painel inteiro.
    for (const u of updaters) {
      try { u(); } catch (err) { console.error('[painel Design]', err); }
    }
    // pedido do menu "Adicionar nota": abre a seção Nota e coloca o cursor no campo
    if (ui.focusNote && noteInput?.isConnected) {
      ui.focusNote = false;
      noteOpen = true;
      const sec = noteInput.closest('.panel-section');
      if (sec) sec.hidden = false;
      el.querySelector('.note-toggle')?.setAttribute('aria-expanded', 'true');
      sec?.classList.remove('collapsed');
      collapsed.delete('Nota');
      collapsed.add('+Nota');
      saveSet('pd.collapsed', collapsed);
      noteInput.focus();
      noteInput.scrollIntoView({ block: 'center' });
    }
  }

  // trocar de seleção SAI do modo estado (o estado em edição pertence à camada que estava selecionada)
  let lastSelKey = '';
  store.subscribe((reasons) => {
    if (!reasons.has('selection')) return;
    const key = ui.selection.join(',');
    if (key === lastSelKey) return;
    lastSelKey = key;
    noteOpen = false;
    if (ui.editState) { ui.editState = null; lastSig = null; store.emit('doc'); }
  });

  // atualiza quando o documento, a seleção ou o histórico (desfazer) mudam
  store.subscribe((reasons) => {
    if (['doc', 'selection', 'history', 'bp'].some((r) => reasons.has(r))) render();
  });
  render();

  return { el, render };
}
