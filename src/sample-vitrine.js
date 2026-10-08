/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  sample-vitrine.js — EXEMPLO "VITRINE": um site inteiro que usa TUDO que o editor faz
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Uma landing page responsiva (a fictícia "Lumen") feita só com o que o app oferece. Abra, mexa e exporte o HTML:
 *
 *   • AUTO LAYOUT: flexbox em linha e coluna, `fill`/`hug`, `wrap`, e uma GRADE de 3 colunas (CSS Grid);
 *   • RESPONSIVO: a grade vai de 3 → 2 → 1 colunas, o hero vira coluna, o menu some e as fontes diminuem
 *     (barra Desktop/Tablet/Celular no topo) e a tela raiz tem largura FLUIDA (width: 100%);
 *   • MODOS DE COR: estilos de cor com valor claro e ESCURO (botão de sol/lua no topo);
 *   • VARIÁVEIS: espaçamentos e raio ligados a variáveis (`var(--espaco-m)`) + estilos de texto;
 *   • ESTADOS: hover, pressionado e foco nos botões e nos cards, com transição e cursor;
 *   • COMPONENTES: botão, card de recurso e card de plano (um principal, várias instâncias com texto próprio);
 *   • VETORES: ícones desenhados com a caneta; gradientes linear, radial e cônico; sombras, blur e VIDRO;
 *   • HTML SEMÂNTICO: header, nav, section, h1/h2/h3, a (com href), button, footer; descrição de acessibilidade;
 *   • TEXTO: limite de linhas com "…" (line-clamp), tamanhos máximos, e uma faixa que ROLA na horizontal;
 *   • PROTÓTIPO: o botão do topo leva à tela "Obrigado" (e ela volta);
 *   • NOTAS e COMENTÁRIOS nas camadas, grades de layout na tela, seção do canvas e uma 2ª página "Guia de estilo".
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createNode, makeDoc, makePage, defaultFill, defaultShadow, defaultStroke, editBp, editState } from './model.js';
import { createInstance, makeComponent, syncInstances, syncStyles } from './components.js';
import { addMode, addVar, bindVar, setStyleColor, syncVars } from './modes.js';
import { addComment, addReply, setResolved } from './comments.js';

// ---------------------------------------------------------------- paleta do exemplo (cada cor: padrão e escuro)
const COLORS = [
  ['st-fundo', 'Fundo', '#F7F6FC', '#0F0D1A'],
  ['st-superficie', 'Superfície', '#FFFFFF', '#1B1833'],
  ['st-texto', 'Texto', '#1B1340', '#F2F0FF'],
  ['st-suave', 'Texto suave', '#5E5A78', '#A9A5C6'],
  ['st-marca', 'Marca', '#7C5CFF', '#9B84FF'],
  ['st-destaque', 'Destaque', '#FF5CA8', '#FF7DBB'],
];
const COLOR = Object.fromEntries(COLORS.map(([id, , c]) => [id, c]));

/** Atalhos de criação: texto, cor sólida, cor ligada a um estilo, flex e vetor (ícone de 24×24). */
const text = (t, props = {}) => createNode('text', { name: t.slice(0, 24), text: t, ...props });
const solid = (color, opacity = 1) => ({ ...defaultFill(color), opacity });
const bound = (id, opacity = 1) => ({ ...defaultFill(COLOR[id]), opacity, styleId: id });
const none = () => ({ ...defaultFill(), type: 'none' });
const flex = (mode, extra = {}) => ({ mode, gap: 12, padding: [0, 0, 0, 0], justify: 'flex-start', align: 'flex-start', wrap: false, ...extra });
const frame = (name, props = {}) => createNode('frame', { name, fill: none(), clip: false, sizeX: 'fill', sizeY: 'hug', ...props });
const gradient = (angle, ...stops) => ({ ...defaultFill(), type: 'linear', angle, stops: stops.map(([color, pos]) => ({ color, opacity: 1, pos })) });
const icon = (name, pts, { closed = false, color = '#7C5CFF', fill = null, size = 22 } = {}) => createNode('path', {
  name, w: size, h: size, vw: 24, vh: 24, closed,
  points: pts.map(([x, y]) => ({ x, y, hin: null, hout: null })),
  fill: fill || none(), stroke: fill ? null : { ...defaultStroke(), color, width: 2, cap: 'round', join: 'round' },
});
/** Estrela de 5 pontas em 24×24 (para o logo e um ícone). */
const star = (cx = 12, cy = 12, ro = 10.5, ri = 4.6) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
  return [Math.round((cx + r * Math.cos(a)) * 100) / 100, Math.round((cy + r * Math.sin(a)) * 100) / 100];
});
const ICONS = {
  raio: { pts: [[13, 2], [4, 14], [11, 14], [10, 22], [20, 9], [13, 9]], closed: true },
  celular: { pts: [[7, 2.5], [17, 2.5], [17, 21.5], [7, 21.5]], closed: true },
  estrela: { pts: star(), closed: true },
  losango: { pts: [[12, 3], [21, 12], [12, 21], [3, 12]], closed: true },
  seta: { pts: [[8, 5], [15, 12], [8, 19]], closed: false },
  check: { pts: [[4, 12.5], [10, 18], [20, 6.5]], closed: false },
};
const setIcon = (path, key) => { const i = ICONS[key]; path.points = i.pts.map(([x, y]) => ({ x, y, hin: null, hout: null })); path.closed = i.closed; path.name = `Ícone ${key}`; };

/**
 * Monta o projeto "Vitrine" (documento completo, pronto para abrir).
 * @returns {object} documento (ver model.js → makeDoc)
 */
export function buildSampleShowcase() {
  const doc = makeDoc();
  doc.name = 'Exemplo — Vitrine completa (site responsivo)';
  const page = doc.pages[0];
  page.name = 'Site';
  const styles = doc.styles;

  // ------------------------------------------------------------ estilos de cor + modo escuro, estilos de texto e variáveis
  styles.colors = COLORS.map(([id, name, color]) => ({ id, name, color, opacity: 1 }));
  const dark = addMode(styles, { name: 'Escuro', scheme: 'dark', auto: false });
  for (const [id, , , d] of COLORS) setStyleColor(styles.colors.find((c) => c.id === id), dark.id, d, 1);
  const T = (id, name, fontSize, fontWeight, lineHeight, letterSpacing = 0) => ({ id, name, fontFamily: 'Inter', fontSize, fontWeight, fontStyle: 'normal', lineHeight, letterSpacing });
  styles.texts = [
    T('tx-h1', 'Título 1', 56, 800, 1.05, -1.5), T('tx-h2', 'Título 2', 36, 800, 1.15, -0.8),
    T('tx-h3', 'Título 3', 20, 700, 1.3, -0.2), T('tx-corpo', 'Corpo', 17, 400, 1.6), T('tx-legenda', 'Legenda', 13, 600, 1.4, 0.2),
  ];
  const vS = addVar(styles, 'Espaço S', 8), vM = addVar(styles, 'Espaço M', 16), vL = addVar(styles, 'Espaço L', 32), vR = addVar(styles, 'Raio card', 20);
  const ts = (n, id, color = 'st-texto') => { n.textStyleId = id; n.fill = bound(color); return n; };
  const H1 = (t, color) => ts(text(t, { name: 'Título 1', tag: 'h1', sizeX: 'fill' }), 'tx-h1', color);
  const H2 = (t, props = {}) => ts(text(t, { name: 'Título 2', tag: 'h2', sizeX: 'fill', textAlign: 'center', ...props }), 'tx-h2');
  const H3 = (t, color) => ts(text(t, { name: 'Título 3', tag: 'h3', sizeX: 'fill' }), 'tx-h3', color);
  const P = (t, props = {}, color = 'st-suave') => ts(text(t, { name: 'Parágrafo', tag: 'p', sizeX: 'fill', ...props }), 'tx-corpo', color);
  const shadow = (y, blur, color, opacity) => ({ ...defaultShadow(), y, blur, color, opacity });

  // ============================================================ COMPONENTES (principais, na prancha "Componentes")
  // ---- botão primário (button, estados, transição, cursor)
  const btn = createNode('frame', {
    name: 'Botão primário', tag: 'button', alt: 'Começar a usar o Lumen', x: 24, y: 24, sizeX: 'hug', sizeY: 'hug', clip: false,
    radius: [12, 12, 12, 12], fill: bound('st-marca'), shadows: [shadow(8, 20, '#7C5CFF', 0.35)],
    layout: flex('row', { gap: 8, padding: [14, 22, 14, 22], justify: 'center', align: 'center' }),
    cursor: 'pointer', transition: { duration: 160, easing: 'ease' },
  });
  btn.children.push(text('Começar grátis', { name: 'Rótulo', fontSize: 15, fontWeight: 700, fill: solid('#FFFFFF') }));
  editState(btn, 'hover', (d) => { d.scale = 1.03; d.fx = { brightness: 110 }; d.shadows = [shadow(12, 28, '#7C5CFF', 0.5)]; });
  editState(btn, 'active', (d) => { d.scale = 0.97; d.shadows = [shadow(2, 6, '#7C5CFF', 0.4)]; });
  editState(btn, 'focus', (d) => { d.stroke = { ...defaultStroke(), color: '#FF5CA8', width: 3, position: 'outside' }; });
  makeComponent(btn);

  // ---- card de recurso (ícone vetorial + título + descrição com limite de linhas)
  const card = createNode('frame', {
    name: 'Card de recurso', x: 24, y: 120, w: 320, sizeX: 'fixed', sizeY: 'hug', clip: false,
    fill: bound('st-superficie'), shadows: [shadow(6, 20, '#2B1B8F', 0.08)], stroke: { ...defaultStroke(), color: '#7C5CFF', opacity: 0.12, width: 1 },
    layout: flex('column', { gap: 12, padding: [24, 24, 24, 24] }), cursor: 'pointer', transition: { duration: 200, easing: 'ease' },
  });
  const cardIcon = frame('Caixa do ícone', { w: 46, h: 46, sizeX: 'fixed', sizeY: 'fixed', radius: [14, 14, 14, 14], fill: solid('#7C5CFF', 0.14), layout: flex('row', { justify: 'center', align: 'center' }) });
  cardIcon.children.push(icon('Ícone', ICONS.raio.pts, { closed: true }));
  card.children.push(cardIcon, H3('Título do recurso'), P('Descrição do recurso. Passou de três linhas, o texto termina com reticências.', { name: 'Descrição', fontSize: 15, truncate: 'clamp', lines: 3 }));
  bindVar(card, 'gap', vM); bindVar(card, 'radius', vR);
  editState(card, 'hover', (d) => { d.scale = 1.02; d.shadows = [shadow(18, 40, '#7C5CFF', 0.22)]; d.stroke = { ...defaultStroke(), color: '#7C5CFF', opacity: 0.55, width: 1 }; });
  editState(card, 'active', (d) => { d.scale = 0.99; });
  makeComponent(card);

  // ---- card de plano (preço, lista e botão)
  const planMain = createNode('frame', {
    name: 'Card de plano', x: 24, y: 360, w: 320, sizeX: 'fixed', sizeY: 'hug', clip: false,
    fill: bound('st-superficie'), shadows: [shadow(6, 20, '#2B1B8F', 0.08)], stroke: { ...defaultStroke(), color: '#7C5CFF', opacity: 0.12, width: 1 },
    layout: flex('column', { gap: 14, padding: [28, 28, 28, 28] }), transition: { duration: 200, easing: 'ease' },
  });
  planMain.children.push(
    text('Plano', { name: 'Nome do plano', fontSize: 15, fontWeight: 700, fill: bound('st-marca'), sizeX: 'fill' }),
    text('R$ 0', { name: 'Preço', fontSize: 44, fontWeight: 800, letterSpacing: -1.5, fill: bound('st-texto'), sizeX: 'fill' }),
    P('O que está incluso neste plano.', { name: 'Resumo', fontSize: 15 }),
  );
  for (let i = 0; i < 3; i++) {
    const li = frame('Item da lista', { tag: 'li', layout: flex('row', { gap: 10, align: 'center' }) });
    li.children.push(icon('Check', ICONS.check.pts, { color: '#10B981', size: 18 }), text('Item incluído', { name: 'Texto do item', fontSize: 15, fill: bound('st-texto'), sizeX: 'fill' }));
    planMain.children.push(li);
  }
  makeComponent(planMain);

  const library = createNode('frame', {
    name: 'Componentes', x: 1760, y: 60, w: 400, h: 760, radius: [24, 24, 24, 24], fill: bound('st-fundo'),
    note: 'Aqui moram os componentes PRINCIPAIS: botão, card de recurso e card de plano. Mude um deles e todas as cópias (instâncias) mudam junto.',
  });
  library.children.push(btn, card, planMain);

  // ============================================================ A PÁGINA (tela raiz, largura fluida)
  const site = createNode('frame', {
    name: 'Página', x: 40, y: 60, w: 1200, h: 2200, sizeX: 'fixed', sizeY: 'hug', clip: true, fluid: true,
    fill: bound('st-fundo'), layout: flex('column', { gap: 0 }),
    grids: [{ type: 'columns', count: 12, gutter: 24, margin: 48, size: 8, color: '#7C5CFF', opacity: 0.06 }],
    note: 'Tela raiz com largura FLUIDA: no HTML exportado ela ocupa a janela até 1200px. A grade de 12 colunas é só guia (não sai no código).',
  });

  // ---------------------------------------------------------------- cabeçalho
  const header = frame('Cabeçalho', {
    tag: 'header', fill: bound('st-superficie'), stroke: { ...defaultStroke(), color: '#7C5CFF', opacity: 0.1, width: 1, sides: [0, 0, 1, 0], position: 'inside' },
    layout: flex('row', { gap: 24, padding: [20, 48, 20, 48], justify: 'space-between', align: 'center' }),
    note: 'No site de verdade o cabeçalho costuma ser fixo no topo (position: sticky). Aqui ele só ocupa a largura toda.',
  });
  const brand = frame('Marca', { sizeX: 'hug', layout: flex('row', { gap: 10, align: 'center' }) });
  brand.children.push(
    icon('Logo', star(), { fill: gradient(135, ['#7C5CFF', 0], ['#FF5CA8', 100]), size: 30 }),
    text('Lumen', { name: 'Nome', fontSize: 22, fontWeight: 800, letterSpacing: -0.5, fill: bound('st-texto') }),
  );
  const nav = frame('Menu', { tag: 'nav', sizeX: 'hug', layout: flex('row', { gap: 28, align: 'center' }) });
  [['Recursos', '#recursos'], ['Planos', '#planos'], ['Clientes', '#clientes']].forEach(([t, href]) => {
    nav.children.push(text(t, { name: `Link ${t}`, tag: 'a', href, fontSize: 15, fontWeight: 600, fill: bound('st-suave'), cursor: 'pointer', transition: { duration: 150, easing: 'ease' } }));
    editState(nav.children.at(-1), 'hover', (d) => { d.fill = bound('st-marca'); });
  });
  const cta = createInstance(btn, [{ children: [btn] }]);
  cta.name = 'Botão do topo'; cta.x = 0; cta.y = 0;
  header.children.push(brand, nav, cta);
  editBp(header, 'tablet', (d) => { d.layout.padding = [16, 28, 16, 28]; });
  editBp(header, 'mobile', (d) => { d.layout.padding = [14, 16, 14, 16]; });
  editBp(nav, 'mobile', (d) => { d.visible = false; });

  // ---------------------------------------------------------------- hero
  const hero = frame('Hero', { tag: 'section', layout: flex('row', { gap: 48, padding: [72, 48, 72, 48], align: 'center' }) });
  const heroText = frame('Texto do hero', { layout: flex('column', { gap: 20 }) });
  const badge = frame('Selo', {
    sizeX: 'hug', radius: [99, 99, 99, 99], fill: solid('#7C5CFF', 0.12),
    layout: flex('row', { gap: 8, padding: [6, 14, 6, 14], align: 'center' }),
  });
  badge.children.push(createNode('ellipse', { name: 'Ponto', w: 8, h: 8, fill: solid('#10B981') }), text('Novo • modos de cor e responsivo', { name: 'Texto do selo', fontSize: 13, fontWeight: 700, fill: bound('st-marca') }));
  const h1 = H1('Desenhe interfaces com CSS de verdade');
  h1.note = 'Título principal da página (h1): uma frase só, até 8 palavras. Só pode haver UM h1 por página (SEO).';
  const lead = P('Auto layout é flexbox, sombras são box-shadow e tudo vira HTML e CSS limpos. Arraste, ajuste e exporte.', { maxW: 520, fontSize: 18 });
  const ctaRow = frame('Botões', { layout: flex('row', { gap: 12, wrap: true, align: 'center' }) });
  const cta2 = createInstance(btn, [{ children: [btn] }]);
  cta2.name = 'Botão do hero'; cta2.x = 0; cta2.y = 0; cta2.sizeX = 'hug';
  const ghost = createNode('frame', {
    name: 'Botão secundário', tag: 'a', href: '#recursos', sizeX: 'hug', sizeY: 'hug', clip: false, radius: [12, 12, 12, 12],
    fill: none(), stroke: { ...defaultStroke(), color: '#7C5CFF', opacity: 0.5, width: 1.5 }, cursor: 'pointer', transition: { duration: 160, easing: 'ease' },
    layout: flex('row', { gap: 8, padding: [13, 20, 13, 20], justify: 'center', align: 'center' }),
  });
  ghost.children.push(text('Ver recursos', { name: 'Rótulo', fontSize: 15, fontWeight: 700, fill: bound('st-marca') }));
  editState(ghost, 'hover', (d) => { d.fill = solid('#7C5CFF', 0.1); });
  editState(ghost, 'focus', (d) => { d.stroke = { ...defaultStroke(), color: '#FF5CA8', width: 3, position: 'outside' }; });
  ctaRow.children.push(cta2, ghost);
  heroText.children.push(badge, h1, lead, ctaRow);

  // visual: gradiente, orbe cônico, círculo desfocado e cartão de vidro (backdrop-filter)
  const visual = frame('Visual do hero', {
    sizeX: 'fill', sizeY: 'fixed', h: 360, clip: true, radius: [28, 28, 28, 28], alt: 'Ilustração abstrata com um orbe colorido e um cartão de vidro',
    fill: gradient(145, ['#1B1340', 0], ['#5B3DF5', 100]), shadows: [shadow(24, 60, '#5B3DF5', 0.35)], layout: flex('row'),
  });
  const orb = createNode('ellipse', {
    name: 'Orbe cônico', x: 150, y: 50, w: 170, h: 170, absolute: true,
    fill: { ...defaultFill(), type: 'conic', angle: 0, stops: [{ color: '#FF5CA8', opacity: 1, pos: 0 }, { color: '#7C5CFF', opacity: 1, pos: 40 }, { color: '#22D3EE', opacity: 1, pos: 75 }, { color: '#FF5CA8', opacity: 1, pos: 100 }] },
    shadows: [shadow(12, 40, '#FF5CA8', 0.45)],
  });
  const glow = createNode('ellipse', { name: 'Brilho', x: 20, y: 200, w: 140, h: 140, absolute: true, fill: solid('#22D3EE', 0.55), blur: 40 });
  const glass = createNode('frame', {
    name: 'Cartão de vidro', x: 70, y: 220, sizeX: 'hug', sizeY: 'hug', absolute: true, radius: [18, 18, 18, 18], clip: false,
    fill: solid('#FFFFFF', 0.14), stroke: { ...defaultStroke(), color: '#FFFFFF', opacity: 0.3, width: 1 }, bgBlur: 18,
    layout: flex('column', { gap: 2, padding: [14, 18, 14, 18] }),
  });
  glass.children.push(text('+38% conversão', { name: 'Número', fontSize: 22, fontWeight: 800, fill: solid('#FFFFFF') }), text('depois do redesenho', { name: 'Legenda', fontSize: 12, fill: solid('#FFFFFF', 0.75) }));
  visual.children.push(glow, orb, glass);
  hero.children.push(heroText, visual);
  editBp(hero, 'tablet', (d) => { d.layout.padding = [48, 28, 48, 28]; d.layout.gap = 32; });
  editBp(hero, 'mobile', (d) => { d.layout.mode = 'column'; d.layout.padding = [32, 16, 32, 16]; d.layout.gap = 28; d.layout.align = 'stretch'; });
  editBp(h1, 'tablet', (d) => { d.fontSize = 44; });
  editBp(h1, 'mobile', (d) => { d.fontSize = 34; });
  editBp(visual, 'mobile', (d) => { d.h = 250; });
  editBp(orb, 'mobile', (d) => { d.x = 110; d.y = 30; d.w = 130; d.h = 130; });
  editBp(glass, 'mobile', (d) => { d.x = 40; d.y = 150; });
  editBp(glow, 'mobile', (d) => { d.y = 130; });

  // ---------------------------------------------------------------- recursos (grade 3 → 2 → 1)
  const recursos = frame('Recursos', { tag: 'section', alt: 'Recursos do Lumen', layout: flex('column', { gap: 32, padding: [64, 48, 64, 48], align: 'center' }) });
  const recHead = frame('Cabeçalho da seção', { layout: flex('column', { gap: 12, align: 'center' }) });
  recHead.children.push(H2('Tudo que você precisa, sem plugin'), P('Cada controle do painel tem o nome do CSS que ele gera.', { textAlign: 'center', maxW: 520 }));
  const grid = frame('Grade de recursos', {
    layout: { ...flex('grid', { gap: 20, justify: 'flex-start', align: 'stretch' }), cols: 3, rows: 0, colGap: 20, rowGap: 20 },
    note: 'Grid de 3 colunas no desktop. Troque para Tablet e Celular na barra do topo: vira 2 e depois 1 coluna (@media no CSS exportado).',
  });
  const RECURSOS = [
    ['raio', 'Auto layout é flexbox', 'Linha, coluna ou grade, com a matriz de alinhamento. Cada campo mostra a propriedade do CSS que ele escreve, e o código gerado é o mesmo que você vê.'],
    ['celular', 'Responsivo de verdade', 'Desktop, Tablet e Celular na barra do topo. Só o que muda fica guardado, e o CSS sai com @media na cascata certa.'],
    ['estrela', 'Modos de cor', 'Crie o modo escuro e dê a cada estilo de cor um valor por modo. O CSS troca tudo com data-theme ou pela preferência do sistema.'],
    ['losango', 'Variáveis e estilos', 'Espaçamentos, raios e tamanhos ligados a variáveis (var(--espaco-m)), estilos de cor e de texto compartilhados por todo o projeto.'],
    ['seta', 'Estados e transições', 'Hover, pressionado e foco com transição suave e cursor. Funciona no modo Apresentar e no HTML exportado.'],
    ['check', 'HTML que presta', 'Escolha a etiqueta certa (header, nav, h1, button, a), o link e a descrição para leitores de tela. Notas viram comentários no código.'],
  ];
  RECURSOS.forEach(([key, title, desc]) => {
    const inst = createInstance(card, [{ children: [card] }]);
    inst.name = `Card ${title}`; inst.x = 0; inst.y = 0; inst.sizeX = 'fill';
    setIcon(inst.children[0].children[0], key);
    inst.children[1].text = title; inst.children[1].name = title;
    inst.children[2].text = desc;
    grid.children.push(inst);
  });
  recursos.children.push(recHead, grid);
  editBp(recursos, 'mobile', (d) => { d.layout.padding = [40, 16, 40, 16]; });
  editBp(grid, 'tablet', (d) => { d.layout.cols = 2; });
  editBp(grid, 'mobile', (d) => { d.layout.cols = 1; });

  // ---------------------------------------------------------------- números (variáveis de espaço ligadas)
  const nums = frame('Números', {
    radius: [28, 28, 28, 28], fill: gradient(120, ['#1B1340', 0], ['#5B3DF5', 100]),
    layout: flex('row', { gap: 32, padding: [40, 32, 40, 32], justify: 'space-around', align: 'center', wrap: true }),
    note: 'O espaço entre os números e o respiro interno estão ligados às variáveis "Espaço L" e "Espaço M" (aba Recursos → Variáveis).',
  });
  [['12 mil', 'projetos exportados'], ['38%', 'mais conversão em média'], ['4,9/5', 'nota dos designers']].forEach(([n, l]) => {
    const s = frame('Número', { sizeX: 'hug', layout: flex('column', { gap: 4, align: 'center' }) });
    s.children.push(text(n, { name: 'Valor', fontSize: 44, fontWeight: 800, letterSpacing: -1.5, fill: solid('#FFFFFF') }), text(l, { name: 'Legenda', fontSize: 14, fill: solid('#FFFFFF', 0.75) }));
    nums.children.push(s);
  });
  bindVar(nums, 'gap', vL); bindVar(nums, 'padding', vL);
  const numsWrap = frame('Faixa de números', { layout: flex('column', { padding: [0, 48, 32, 48] }) });
  numsWrap.children.push(nums);
  editBp(numsWrap, 'mobile', (d) => { d.layout.padding = [0, 16, 24, 16]; });
  editBp(nums, 'mobile', (d) => { d.layout.mode = 'column'; d.layout.gap = 20; d.layout.padding = [28, 20, 28, 20]; });

  // ---------------------------------------------------------------- planos
  const planos = frame('Planos', { tag: 'section', alt: 'Planos e preços', layout: flex('column', { gap: 32, padding: [48, 48, 64, 48], align: 'center' }) });
  const planRow = frame('Lista de planos', { tag: 'ul', layout: flex('row', { gap: 20, align: 'stretch', justify: 'center', wrap: true }) });
  const PLANOS = [
    ['Básico', 'R$ 0', 'Para testar e estudar CSS.', ['3 projetos', 'Exportar HTML e CSS', 'Modo claro']],
    ['Pro', 'R$ 29', 'Para quem entrega sites.', ['Projetos ilimitados', 'Responsivo e modos de cor', 'Variáveis e estilos']],
    ['Equipe', 'R$ 79', 'Para trabalhar em time.', ['Tudo do Pro', 'Comentários e notas', 'Pasta compartilhada']],
  ];
  PLANOS.forEach(([nome, preco, resumo, itens], i) => {
    const inst = createInstance(planMain, [{ children: [planMain] }]);
    inst.name = `Plano ${nome}`; inst.tag = 'li'; inst.x = 0; inst.y = 0; inst.sizeX = 'fixed';
    inst.children[0].text = nome; inst.children[1].text = preco; inst.children[2].text = resumo;
    itens.forEach((t, k) => { inst.children[3 + k].children[1].text = t; });
    if (i === 1) {
      inst.fill = gradient(145, ['#1B1340', 0], ['#5B3DF5', 100]); inst.stroke = null; inst.shadows = [shadow(24, 50, '#5B3DF5', 0.4)];
      inst.children[0].fill = solid('#FFB3DA'); inst.children[1].fill = solid('#FFFFFF'); inst.children[2].fill = solid('#FFFFFF', 0.75);
      for (let k = 3; k < 6; k++) { inst.children[k].children[1].fill = solid('#FFFFFF'); }
      inst.note = 'Plano recomendado: destacado com gradiente e sombra. É uma instância com cores próprias (as sobrescritas não se perdem se o principal mudar).';
    }
    planRow.children.push(inst);
  });
  planos.children.push(H2('Planos simples'), planRow);
  planos.children[0].name = 'Título dos planos';
  editBp(planos, 'mobile', (d) => { d.layout.padding = [32, 16, 40, 16]; });
  editBp(planRow, 'mobile', (d) => { d.layout.mode = 'column'; d.layout.align = 'stretch'; });

  // ---------------------------------------------------------------- clientes (faixa que rola na horizontal)
  const clientes = frame('Clientes', { tag: 'section', alt: 'O que os clientes dizem', layout: flex('column', { gap: 28, padding: [24, 0, 64, 0], align: 'center' }) });
  const strip = frame('Faixa de depoimentos', {
    overflow: 'scroll-x', clip: true, layout: flex('row', { gap: 20, padding: [8, 48, 24, 48], align: 'stretch' }),
    note: 'Esta faixa ROLA na horizontal (overflow-x: auto). A rolagem funciona no modo Apresentar e no HTML exportado; no editor o conteúdo aparece cortado.',
  });
  [['Ana Souza', 'Designer de produto', 'Finalmente uma ferramenta em que o que eu desenho é exatamente o CSS que vai pro ar. Acabou o "no Figma estava diferente".'],
    ['Bruno Lima', 'Dev front-end', 'Exporto o HTML e só ajusto o que é lógica. As classes saem com nomes legíveis e o responsivo já vem com @media.'],
    ['Carla Dias', 'Fundadora', 'Montei a landing do meu produto em uma tarde, com modo escuro e tudo. Meu dev nem precisou refazer.'],
    ['Diego Rocha', 'Professor', 'Uso para ensinar CSS: cada campo mostra a propriedade. Os alunos entendem flexbox sem decorar nada.']].forEach(([nome, cargo, fala], i) => {
    const c = createNode('frame', {
      name: `Depoimento ${nome}`, w: 340, sizeX: 'fixed', sizeY: 'hug', clip: false, radius: [20, 20, 20, 20], fill: bound('st-superficie'),
      shadows: [shadow(6, 20, '#2B1B8F', 0.08)], layout: flex('column', { gap: 16, padding: [24, 24, 24, 24] }),
    });
    const who = frame('Pessoa', { layout: flex('row', { gap: 12, align: 'center' }) });
    const av = createNode('ellipse', { name: 'Avatar', w: 42, h: 42, fill: gradient(135, [['#FF8A5B', '#7C5CFF', '#22D3EE', '#10B981'][i], 0], [['#FF3D81', '#FF5CA8', '#7C5CFF', '#22D3EE'][i], 100]) });
    const info = frame('Nome e cargo', { layout: flex('column', { gap: 2 }) });
    info.children.push(text(nome, { name: 'Nome', fontSize: 15, fontWeight: 700, fill: bound('st-texto'), sizeX: 'fill' }), text(cargo, { name: 'Cargo', fontSize: 13, fill: bound('st-suave'), sizeX: 'fill' }));
    who.children.push(av, info);
    c.children.push(P(`“${fala}”`, { name: 'Fala', fontSize: 15, truncate: 'clamp', lines: 4 }, 'st-texto'), who);
    strip.children.push(c);
  });
  clientes.children.push(H2('Quem usa, recomenda'), strip);
  clientes.children[0].name = 'Título dos clientes';
  editBp(clientes, 'mobile', (d) => { d.layout.padding = [16, 0, 40, 0]; });
  editBp(strip, 'mobile', (d) => { d.layout.padding = [8, 16, 20, 16]; });

  // ---------------------------------------------------------------- rodapé
  const footer = frame('Rodapé', {
    tag: 'footer', fill: bound('st-superficie'), stroke: { ...defaultStroke(), color: '#7C5CFF', opacity: 0.1, width: 1, sides: [1, 0, 0, 0], position: 'inside' },
    layout: flex('row', { gap: 24, padding: [28, 48, 28, 48], justify: 'space-between', align: 'center', wrap: true }),
  });
  footer.children.push(text('© 2026 Lumen. Feito com o Projeto Designer.', { name: 'Direitos', tag: 'p', fontSize: 13, fill: bound('st-suave'), sizeX: 'hug' }));
  const links = frame('Links do rodapé', { sizeX: 'hug', layout: flex('row', { gap: 20 }) });
  ['Termos', 'Privacidade', 'Contato'].forEach((t) => links.children.push(text(t, { name: `Link ${t}`, tag: 'a', href: '#', fontSize: 13, fill: bound('st-suave'), cursor: 'pointer' })));
  footer.children.push(links);
  editBp(footer, 'mobile', (d) => { d.layout.padding = [20, 16, 20, 16]; d.layout.mode = 'column'; d.layout.align = 'flex-start'; });

  site.children.push(header, hero, recursos, numsWrap, planos, clientes, footer);

  // ============================================================ tela "Obrigado" (protótipo)
  const thanks = createNode('frame', {
    name: 'Obrigado', x: 1340, y: 60, w: 380, h: 640, clip: true, radius: [28, 28, 28, 28], fill: gradient(160, ['#1B1340', 0], ['#5B3DF5', 100]),
    layout: flex('column', { gap: 16, padding: [40, 28, 40, 28], justify: 'center', align: 'center' }),
  });
  const seal = createNode('ellipse', { name: 'Selo', w: 96, h: 96, fill: { ...defaultFill(), type: 'radial', stops: [{ color: '#7CFFC4', opacity: 1, pos: 0 }, { color: '#10B981', opacity: 1, pos: 100 }] }, shadows: [shadow(14, 40, '#10B981', 0.5)] });
  const back = createNode('frame', {
    name: 'Botão voltar', tag: 'button', sizeX: 'fill', sizeY: 'hug', clip: false, radius: [14, 14, 14, 14], fill: solid('#FFFFFF'), cursor: 'pointer',
    layout: flex('row', { padding: [14, 20, 14, 20], justify: 'center' }), interactions: [{ trigger: 'click', action: 'navigate', target: site.id, transition: 'slide-right' }],
  });
  back.children.push(text('Voltar ao site', { name: 'Rótulo', fontSize: 15, fontWeight: 700, fill: solid('#2B1B8F') }));
  thanks.children.push(seal, text('Bem-vindo!', { name: 'Título', fontSize: 32, fontWeight: 800, letterSpacing: -1, fill: solid('#FFFFFF') }), text('Seu teste grátis já começou.', { name: 'Descrição', fontSize: 15, fill: solid('#FFFFFF', 0.78), textAlign: 'center' }), back);
  // o botão do topo e o do hero levam à tela Obrigado
  cta.interactions = [{ trigger: 'click', action: 'navigate', target: thanks.id, transition: 'slide-left' }];
  cta2.interactions = [{ trigger: 'click', action: 'navigate', target: thanks.id, transition: 'slide-left' }];

  // seção do canvas que agrupa as telas
  const secao = createNode('section', { name: 'Telas do site', x: 0, y: 0, w: 1780, h: 2420 });
  secao.children.push(site, thanks);
  page.children.push(secao, library);

  // ============================================================ página 2: guia de estilo
  const guide = makePage('Guia de estilo');
  const gs = createNode('frame', {
    name: 'Guia de estilo', x: 0, y: 0, w: 900, h: 900, sizeX: 'fixed', sizeY: 'hug', clip: true, radius: [24, 24, 24, 24], fill: bound('st-fundo'),
    layout: flex('column', { gap: 32, padding: [40, 40, 40, 40] }),
    note: 'Página de referência do projeto: as cores (com o modo escuro), os estilos de texto e as variáveis. Troque o modo de cor no topo para ver os swatches mudarem.',
  });
  gs.children.push(ts(text('Guia de estilo — Lumen', { name: 'Título', tag: 'h1', sizeX: 'fill' }), 'tx-h2'));
  const sw = frame('Cores', { layout: flex('row', { gap: 16, wrap: true }) });
  COLORS.forEach(([id, name, c]) => {
    const item = frame(`Cor ${name}`, { sizeX: 'hug', layout: flex('column', { gap: 8 }) });
    item.children.push(
      createNode('rect', { name: 'Amostra', w: 120, h: 80, radius: [16, 16, 16, 16], fill: bound(id), stroke: { ...defaultStroke(), color: '#7C5CFF', opacity: 0.2, width: 1 } }),
      text(name, { name: 'Nome', fontSize: 13, fontWeight: 700, fill: bound('st-texto') }), text(c, { name: 'Valor', fontSize: 12, fill: bound('st-suave') }));
    sw.children.push(item);
  });
  const tipos = frame('Tipografia', { layout: flex('column', { gap: 12 }) });
  styles.texts.forEach((t) => tipos.children.push(ts(text(`${t.name} — ${t.fontSize}px / ${t.fontWeight}`, { name: t.name, sizeX: 'fill' }), t.id)));
  const espacos = frame('Espaçamentos', { layout: flex('column', { gap: 10 }) });
  [vS, vM, vL].forEach((v) => {
    const r = frame(`Espaço ${v.value}`, { layout: flex('row', { gap: 12, align: 'center' }) });
    const bar = createNode('rect', { name: 'Barra', w: v.value * 4, h: 14, radius: [4, 4, 4, 4], fill: bound('st-marca') });
    r.children.push(bar, text(`${v.name} = ${v.value}px  →  var(--${v.name.toLowerCase().replace('ç', 'c').replace(/\s+/g, '-')})`, { name: 'Legenda', fontSize: 13, fill: bound('st-suave'), sizeX: 'hug' }));
    espacos.children.push(r);
  });
  gs.children.push(ts(text('Cores', { name: 'Título cores', tag: 'h2', sizeX: 'fill' }), 'tx-h3'), sw, ts(text('Tipografia', { name: 'Título tipografia', tag: 'h2', sizeX: 'fill' }), 'tx-h3'), tipos, ts(text('Espaçamentos (variáveis)', { name: 'Título espaços', tag: 'h2', sizeX: 'fill' }), 'tx-h3'), espacos);
  guide.children.push(gs);
  doc.pages.push(guide);

  // ============================================================ comentários (conversa entre pessoas)
  const c1 = addComment(doc, { nodeId: cta.id, rx: 1, ry: 0, text: 'O branco sobre o roxo no modo escuro passa no contraste? Vale conferir no seletor de cor.', author: 'Ana' });
  addReply(c1, { text: 'Conferi: 4,6 (AA). Ficou bom.', author: 'Kayky' });
  addComment(doc, { nodeId: visual.id, rx: 0.9, ry: 0.15, text: 'Dá para trocar este visual por uma imagem de verdade? Pode ser a captura do produto.', author: 'Bruno' });
  const c3 = addComment(doc, { nodeId: planRow.id, rx: 1, ry: 0, text: 'Confirmar os preços com o financeiro antes de publicar.', author: 'Carla' });
  setResolved(c3, true);

  // ============================================================ consistência: estilos → camadas, variáveis, instâncias
  syncStyles(doc);
  syncVars(doc, true);
  syncInstances(doc.pages);
  return doc;
}
