// Painel direito (aba Design): propriedades da seleção, nomeadas como no CSS.
import { h, ico, iconButton, numField, selectField, segmented, colorRow } from './dom.js';
import {
  BLEND_MODES, FONT_FAMILIES, FONT_WEIGHTS, defaultFill, defaultShadow, defaultStroke, hasLayout, isFlow, resizeNode,
  constraintsOf,
} from '../model.js';
import { fillCss } from '../css.js';
import { exportHtmlFile, exportPng, exportSvgFile } from '../export.js';

export function createDesignPanel({ store, canvas, commands, tools, toast }) {
  const ui = store.ui;
  const el = h('div.design-panel');
  let updaters = [];
  let lastSig = null;
  let radiusExpanded = false;
  let exportScale = 2;

  // ------------------------------------------------------------------ helpers
  const ids = () => ui.selection.filter((id) => store.get(id));
  const nodes = () => ids().map((id) => store.get(id));
  const P = () => store.get(ids()[0]);
  const each = (fn) => store.update(() => nodes().forEach(fn));
  const commit = () => store.commit();
  const reg = (ctl) => { updaters.push(ctl.update); return ctl.el; };
  const row = (...c) => h('div.row', ...c);
  const section = (title, body, actions) =>
    h('section.panel-section', h('header.section-head', h('span', title), actions || null), h('div.section-body', body));

  const num = (label, get, set, opts = {}) =>
    reg(numField({ label, get, set, commit, ...opts }));
  const select = (options, get, set, title) => reg(selectField({ options, get, set, commit, title }));

  const check = (label, get, set) => {
    const input = h('input', { type: 'checkbox' });
    input.addEventListener('change', () => { set(input.checked); commit(); });
    updaters.push(() => { input.checked = !!get(); });
    return h('label.check', input, h('span.box', ico('check', 10)), h('span', label));
  };

  const pickImage = (cb) => {
    const input = h('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', async () => {
      if (!input.files[0]) return;
      try { cb(await commands.importAsset(input.files[0])); } catch { toast('Não consegui abrir a imagem.'); }
    });
    input.click();
  };

  // ------------------------------------------------------------------ seções
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

  const PRESETS = [
    ['', 'Tamanhos predefinidos…'], ['393x852', 'iPhone 15 — 393×852'], ['360x800', 'Android — 360×800'],
    ['820x1180', 'iPad — 820×1180'], ['1440x1024', 'Desktop — 1440×1024'], ['1280x800', 'Notebook — 1280×800'],
    ['1920x1080', 'Full HD / Slide — 1920×1080'], ['595x842', 'A4 — 595×842'],
    ['1080x1080', 'Post quadrado — 1080×1080'], ['1080x1920', 'Story — 1080×1920'],
  ];
  const H_CONS = [['left', 'Esquerda'], ['right', 'Direita'], ['leftright', 'Esquerda e direita'], ['center', 'Centro'], ['scale', 'Escala']];
  const V_CONS = [['top', 'Topo'], ['bottom', 'Base'], ['topbottom', 'Topo e base'], ['center', 'Centro'], ['scale', 'Escala']];
  const NO_RADIUS = ['text', 'ellipse', 'group', 'line', 'path'];

  function layerSection() {
    const single = ids().length === 1;
    const n0 = P();
    const parent = store.parentOf(n0.id);
    const inFlow = isFlow(n0, parent);
    const body = [];

    if (single) {
      const posRow = row(
        num('X', () => P().x, (v) => each((n) => { n.x = v; }), { decimals: 1 }),
        num('Y', () => P().y, (v) => each((n) => { n.y = v; }), { decimals: 1 }));
      if (inFlow) {
        posRow.classList.add('disabled');
        posRow.title = 'Posição controlada pelo auto layout do pai';
      }
      body.push(posRow);

      body.push(row(
        num('W', () => P().w, (v) => each((n) => resizeNode(n, v, n.h, 'w')), { min: 1, title: 'width', decimals: 1 }),
        num('H', () => P().h, (v) => each((n) => resizeNode(n, n.w, v, 'h')), { min: 1, title: 'height', decimals: 1, disabled: n0.type === 'line' }),
        h('button.icon-btn.small' + (n0.lockRatio ? '.on' : ''), {
          type: 'button', title: 'Travar proporção',
          onclick: () => { each((n) => { n.lockRatio = !n.lockRatio; }); commit(); },
        }, ico('link', 14))));

      const sizeOpts = () => {
        const o = [['fixed', 'Fixo']];
        if (n0.type === 'text' || hasLayout(n0)) o.push(['hug', 'Ajustar ao conteúdo (hug)']);
        if (inFlow) o.push(['fill', 'Preencher (fill)']);
        return o;
      };
      if (sizeOpts().length > 1) {
        body.push(row(
          select(sizeOpts(), () => P().sizeX, (v) => each((n) => { n.sizeX = v; }), 'Largura'),
          select(sizeOpts(), () => P().sizeY, (v) => each((n) => { n.sizeY = v; }), 'Altura')));
      }
      if (n0.type === 'frame' && !parent) {
        body.push(select(PRESETS, () => '', (v) => {
          if (!v) return;
          const [w, hh] = v.split('x').map(Number);
          each((n) => { resizeNode(n, w, hh, 'w'); n.h = hh; n.sizeY = 'fixed'; });
        }, 'Predefinições de tamanho'));
      }
      if (parent?.type === 'frame' && !hasLayout(parent) && !n0.absolute) {
        body.push(h('div.sub-label', 'constraints'),
          row(
            select(H_CONS, () => constraintsOf(P()).h, (v) => each((n) => { n.constraints = { ...constraintsOf(n), h: v }; }), 'Constraint horizontal'),
            select(V_CONS, () => constraintsOf(P()).v, (v) => each((n) => { n.constraints = { ...constraintsOf(n), v: v }; }), 'Constraint vertical')));
      }
    }

    const rotRow = [num('°', () => P().rotation, (v) => each((n) => { n.rotation = v; }), { title: 'rotate', decimals: 1, min: -360, max: 360 })];
    const canRound = !NO_RADIUS.includes(n0.type);
    if (canRound) {
      rotRow.push(num('◜', () => P().radius[0], (v) => each((n) => { n.radius = [v, v, v, v].map((x) => Math.max(0, x)); }),
        { title: 'border-radius', min: 0, decimals: 1 }));
      rotRow.push(h('button.icon-btn.small' + (radiusExpanded ? '.on' : ''), {
        type: 'button', title: 'Cantos independentes',
        onclick: () => { radiusExpanded = !radiusExpanded; lastSig = null; render(); },
      }, ico('corners', 14)));
    }
    rotRow.push(
      h('button.icon-btn.small' + (n0.flipX ? '.on' : ''), { type: 'button', title: 'Espelhar na horizontal (Shift+H)', onclick: () => commands.flip('x') }, ico('flipH', 14)),
      h('button.icon-btn.small' + (n0.flipY ? '.on' : ''), { type: 'button', title: 'Espelhar na vertical (Shift+V)', onclick: () => commands.flip('y') }, ico('flipV', 14)));
    body.push(row(...rotRow));
    if (radiusExpanded && canRound) {
      const corner = (i, label, title) => num(label, () => P().radius[i], (v) => each((n) => { n.radius[i] = Math.max(0, v); }), { title, min: 0, decimals: 1 });
      body.push(row(corner(0, '↖', 'top-left'), corner(1, '↗', 'top-right')));
      body.push(row(corner(3, '↙', 'bottom-left'), corner(2, '↘', 'bottom-right')));
    }

    body.push(row(
      num('%', () => P().opacity * 100, (v) => each((n) => { n.opacity = v / 100; }), { min: 0, max: 100, decimals: 0, title: 'opacity' }),
      select(BLEND_MODES.map((m) => [m, m]), () => P().blend, (v) => each((n) => { n.blend = v; }), 'mix-blend-mode')));

    if (n0.type === 'frame') body.push(check('Cortar conteúdo (overflow: hidden)', () => P().clip, (v) => each((n) => { n.clip = v; })));
    if (n0.isMask || parent?.type === 'group') {
      body.push(check('Usar como máscara (clip-path)', () => !!P().isMask, (v) => each((n) => { n.isMask = v; })));
    }
    return section('Camada', body);
  }

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

  function autoLayoutSection() {
    const n0 = P();
    const L = () => P().layout;
    const modeSeg = segmented({
      options: [
        ['none', 'none', 'Sem layout (posição absoluta)'],
        ['row', 'row', 'Flex em linha (flex-direction: row)'],
        ['column', 'column', 'Flex em coluna (flex-direction: column)'],
        ['grid', 'grid', 'CSS Grid (display: grid)'],
      ],
      get: () => L().mode,
      set: (v) => store.update(() => commands.setLayoutMode(nodes(), v)),
      commit,
    });
    updaters.push(modeSeg.update);
    const body = [row(modeSeg.el)];
    const pad = (labels) => labels.map(([i, l, t]) =>
      num(l, () => L().padding[i], (v) => each((n) => { n.layout.padding[i] = Math.max(0, v); }), { title: t, min: 0, decimals: 0 }));
    const aligns = [['flex-start', 'Início'], ['center', 'Centro'], ['flex-end', 'Fim']];
    if (n0.layout.mode === 'grid') {
      body.push(
        row(num('C', () => L().cols ?? 2, (v) => each((n) => { n.layout.cols = Math.max(1, Math.round(v)); }), { title: 'colunas (grid-template-columns)', min: 1, decimals: 0 }),
          num('L', () => L().rows ?? 0, (v) => each((n) => { n.layout.rows = Math.max(0, Math.round(v)); }), { title: 'linhas (0 = automático)', min: 0, decimals: 0 })),
        row(num('↔', () => L().colGap ?? 8, (v) => each((n) => { n.layout.colGap = Math.max(0, v); }), { title: 'column-gap', min: 0, decimals: 0 }),
          num('↕', () => L().rowGap ?? 8, (v) => each((n) => { n.layout.rowGap = Math.max(0, v); }), { title: 'row-gap', min: 0, decimals: 0 })),
        h('div.sub-label', 'padding'),
        row(...pad([[0, 'T', 'padding-top'], [1, 'R', 'padding-right']])),
        row(...pad([[3, 'L', 'padding-left'], [2, 'B', 'padding-bottom']])),
        h('div.sub-label', 'justify-items'),
        select(aligns, () => L().justify, (v) => each((n) => { n.layout.justify = v; }), 'justify-items'),
        h('div.sub-label', 'align-items'),
        select(aligns, () => L().align, (v) => each((n) => { n.layout.align = v; }), 'align-items'));
    } else if (hasLayout(n0)) {
      body.push(
        row(num('↔', () => L().gap, (v) => each((n) => { n.layout.gap = Math.max(0, v); }), { title: 'gap', min: 0, decimals: 0 }),
          h('button.icon-btn' + (L().wrap ? '.on' : ''), {
            type: 'button', title: 'Quebrar linha (flex-wrap: wrap)',
            onclick: () => { each((n) => { n.layout.wrap = !n.layout.wrap; }); commit(); },
          }, ico('wrap'))),
        h('div.sub-label', 'padding'),
        row(...pad([[0, 'T', 'padding-top'], [1, 'R', 'padding-right']])),
        row(...pad([[3, 'L', 'padding-left'], [2, 'B', 'padding-bottom']])),
        h('div.sub-label', 'justify-content'),
        select([...aligns.map(([v, l]) => [v, `${l} (${v})`]),
          ['space-between', 'Espaço entre (space-between)'], ['space-around', 'Espaço ao redor (space-around)'], ['space-evenly', 'Espaço igual (space-evenly)']],
        () => L().justify, (v) => each((n) => { n.layout.justify = v; }), 'justify-content'),
        h('div.sub-label', 'align-items'),
        select(aligns.map(([v, l]) => [v, `${l} (${v})`]), () => L().align, (v) => each((n) => { n.layout.align = v; }), 'align-items'));
    }
    return section('Auto layout (CSS)', body);
  }

  function flowItemSection() {
    const parent = store.parentOf(P().id);
    const grid = parent.layout.mode === 'grid';
    const body = [
      check('Posição absoluta (ignora o layout do pai)', () => P().absolute, (v) => each((n) => {
        if (v) {
          const o = commandsOrigin(n);
          n.x = o.x; n.y = o.y;
        }
        n.absolute = v;
      })),
    ];
    if (!P().absolute) {
      if (grid) {
        body.push(row(
          num('↔', () => P().colSpan ?? 1, (v) => each((n) => { n.colSpan = Math.max(1, Math.round(v)); }), { title: 'grid-column: span N', min: 1, decimals: 0 }),
          num('↕', () => P().rowSpan ?? 1, (v) => each((n) => { n.rowSpan = Math.max(1, Math.round(v)); }), { title: 'grid-row: span N', min: 1, decimals: 0 })));
      }
      body.push(h('div.sub-label', 'align-self'),
        select([['auto', 'Automático (auto)'], ['flex-start', 'Início'], ['center', 'Centro'], ['flex-end', 'Fim']],
          () => P().alignSelf, (v) => each((n) => { n.alignSelf = v; }), 'align-self'));
    }
    return section('Item do layout', body);
  }

  const commandsOrigin = (n) => {
    const parent = store.parentOf(n.id);
    const o = canvas.originOf(n.id);
    const po = parent ? canvas.originOf(parent.id) : { x: 0, y: 0 };
    return { x: Math.round(o.x - po.x), y: Math.round(o.y - po.y) };
  };

  const GRID_KINDS = [['columns', 'Colunas'], ['rows', 'Linhas'], ['grid', 'Quadrícula']];
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

  function vectorSection() {
    return section('Vetor', [
      check('Caminho fechado', () => P().closed, (v) => each((n) => { n.closed = v; if (v && n.fill.type === 'none') n.fill = defaultFill('#D9D9D9'); })),
      h('button.btn', { type: 'button', onclick: () => tools.pen.startEdit(P().id) }, ico('pen', 13), ' Editar pontos (Enter)'),
      h('p.hint', 'Arraste pontos e alças. Alt+clique no traço adiciona um ponto. Duplo clique num ponto alterna canto/suave. Delete remove.'),
    ]);
  }

  function textSection() {
    const fonts = FONT_FAMILIES.map((f) => [f, f]);
    const cur = P().fontFamily;
    if (cur && !FONT_FAMILIES.includes(cur)) fonts.unshift([cur, cur]);
    const styles = store.state.doc.styles.texts;
    return section('Texto', [
      row(
        select([['', 'Sem estilo'], ...styles.map((t) => [t.id, t.name])], () => P().textStyleId || '',
          (v) => each((n) => { if (v) n.textStyleId = v; else delete n.textStyleId; }), 'Estilo de texto'),
        iconButton('plus', 'Criar estilo de texto a partir desta camada', () => {
          const name = prompt('Nome do estilo de texto:', `Texto ${styles.length + 1}`);
          if (name) commands.addTextStyle(P(), name);
        }, 'small')),
      select(fonts, () => P().fontFamily, (v) => each((n) => { n.fontFamily = v; delete n.textStyleId; }), 'font-family'),
      row(
        select(FONT_WEIGHTS.map(([w, l]) => [w, `${l} (${w})`]), () => P().fontWeight, (v) => each((n) => { n.fontWeight = Number(v); delete n.textStyleId; }), 'font-weight'),
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
    ]);
  }

  function gradientBar() {
    const bar = h('div.grad-bar');
    updaters.push(() => {
      const f = P().fill;
      bar.style.backgroundImage = fillCss({ ...f, type: 'linear', angle: 90 })['background-image'] || '';
    });
    return bar;
  }

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
      body.push(row(
        select([['', 'Sem estilo de cor'], ...styles.map((c) => [c.id, c.name])], () => fill().styleId || '',
          (v) => each((n) => { if (v) n.fill.styleId = v; else delete n.fill.styleId; }), 'Estilo de cor'),
        iconButton('plus', 'Criar estilo de cor a partir desta cor', () => {
          const name = prompt('Nome do estilo de cor:', `Cor ${styles.length + 1}`);
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
        row(num('▭', () => st().width, (v) => each((n) => { if (n.stroke) n.stroke.width = Math.max(0, v); }), { title: 'espessura', min: 0, step: 0.5, decimals: 1 }),
          n0.type === 'text'
            ? null
            : select([['solid', 'Sólido'], ['dashed', 'Tracejado'], ['dotted', 'Pontilhado']], () => st().style, (v) => each((n) => { if (n.stroke) n.stroke.style = v; }), 'outline-style')),
        n0.type === 'text'
          ? null
          : select([['inside', 'Dentro'], ['center', 'Centro'], ['outside', 'Fora']], () => st().position, (v) => each((n) => { if (n.stroke) n.stroke.position = v; }), 'Posição do contorno'));
    }
    return section('Contorno', body, has ? rem : add);
  }

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
    body.push(row(
      num('◌', () => P().blur, (v) => each((n) => { n.blur = Math.max(0, v); }), { title: 'filter: blur()', min: 0, decimals: 0 }),
      isText ? null : num('▨', () => P().bgBlur, (v) => each((n) => { n.bgBlur = Math.max(0, v); }), { title: 'backdrop-filter: blur()  (efeito vidro)', min: 0, decimals: 0 })));
    return section('Efeitos', body, add);
  }

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
  function signature() {
    const ns = nodes();
    if (!ns.length) return 'empty';
    const n = ns[0];
    const parent = store.parentOf(n.id);
    return [
      ns.map((x) => x.id + x.type).join(','), n.fill.type, n.fill.stops.length, !!n.stroke, n.shadows.length,
      n.layout?.mode, n.layout?.wrap, hasLayout(parent), n.absolute, n.sizeX, n.sizeY, radiusExpanded,
      n.visible, store.state.doc.pages.length, n.layout?.mode === 'grid', n.component, n.instanceOf, n.lockRatio,
      n.flipX, n.flipY, n.isMask, n.grids?.length, n.grids?.map((g) => g.type).join(), n.closed,
      store.state.doc.styles.colors.length, store.state.doc.styles.texts.length, n.fill.styleId, n.textStyleId, n.type,
      n.constraints?.h, !!store.parentOf(n.id) && !hasLayout(store.parentOf(n.id)),
    ].join('|');
  }

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
        const parts = [alignSection(), layerSection()];
        const one = ids().length === 1;
        if (one && ['frame', 'group', 'rect', 'ellipse'].includes(n.type)) parts.push(componentSection());
        if (one && n.type === 'frame') parts.push(autoLayoutSection(), layoutGridsSection());
        if (one && hasLayout(parent)) parts.push(flowItemSection());
        if (n.type === 'text') parts.push(textSection());
        if (n.type === 'path') parts.push(vectorSection());
        if (n.type !== 'group' && n.type !== 'line') parts.push(fillSection());
        if (n.type !== 'group') parts.push(strokeSection());
        parts.push(effectsSection(), exportSection());
        el.replaceChildren(...parts);
      }
    }
    updaters.forEach((u) => u());
  }

  store.subscribe((reasons) => {
    if (['doc', 'selection', 'history'].some((r) => reasons.has(r))) render();
  });
  render();

  return { el, render };
}
