// Monta o guia de estilo da identidade pelo MCP: primeiro `node scripts/identidade/cliente-mcp.mjs call new_project ...` e `create_color_styles` (paleta), depois `node scripts/identidade/montar-guia.mjs tudo`.
// Monta o "Guia de estilo" da identidade do Stylo DENTRO do próprio Stylo, pelo MCP (build_layout).
// Uso: node identidade.mjs <secao>   (capa | principios | logo | cores | tipografia | formas | componentes | tudo)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_MCP = 'http://localhost:5173/mcp';
const SID_FILE = join(tmpdir(), 'stylo-mcp-sid.txt');
const post = async (body, sid) => {
  const res = await fetch(URL_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-Stylo-Agent': 'Claude', ...(sid ? { 'Mcp-Session-Id': sid } : {}) }, body: JSON.stringify(body) });
  return { res, json: await res.json().catch(() => null) };
};
const sid = readFileSync(SID_FILE, 'utf8').trim();
const call = async (name, args) => {
  const r = await post({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }, sid);
  const text = (r.json?.result?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (r.json?.error || r.json?.result?.isError) throw new Error(`${name}: ${JSON.stringify(r.json?.error || text).slice(0, 600)}`);
  try { return JSON.parse(text); } catch { return text; }
};

// ---- cores do projeto (estilos) → { nome: {styleId} }
const doc = await call('get_document', {});
const styles = Object.fromEntries((doc.colorStyles || []).map((s) => [s.name, { styleId: s.id }]));
const hexOf = Object.fromEntries((doc.colorStyles || []).map((s) => [s.name, s.color]));
const C = (n) => { if (!styles[n]) throw new Error('cor inexistente: ' + n); return styles[n]; };

// ---- contraste WCAG
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(1); };

// ---- peças
const SANS = 'IBM Plex Sans';
const MONO = 'JetBrains Mono';
const t = (text, size, weight, color, extra = {}) => ({ type: 'text', props: { text, fontFamily: SANS, fontSize: size, fontWeight: weight, lineHeight: size >= 28 ? 1.15 : 1.5, fill: C(color), sizeX: 'hug', ...extra } });
const m = (text, size, color, extra = {}) => ({ type: 'text', props: { text, fontFamily: MONO, fontSize: size, fontWeight: 400, lineHeight: 1.5, fill: C(color), sizeX: 'hug', ...extra } });
const col = (children, props = {}) => ({ type: 'frame', props: { layout: { mode: 'column', gap: 12 }, fill: 'none', ...props }, children });
const row = (children, props = {}) => ({ type: 'frame', props: { layout: { mode: 'row', gap: 12, align: 'center' }, fill: 'none', ...props }, children });
const section = (name, children, props = {}) => col(children, { name, tag: 'section', sizeX: 'fill', layout: { mode: 'column', gap: 32, padding: [72, 80, 72, 80] }, ...props });
const heading = (text, color = 'Texto claro') => t(text, 28, 600, color, { tag: 'h2', letterSpacing: -0.4 });
const lead = (text, color = 'Texto suave claro', extra = {}) => t(text, 15, 400, color, { lineHeight: 1.6, sizeX: 'fill', maxW: 640, ...extra });
const rule = () => ({ type: 'frame', props: { name: 'Linha', sizeX: 'fill', h: 1, sizeY: 'fixed', fill: C('Linha') } });

/** O símbolo: colchete + três linhas de larguras diferentes (regra CSS / auto layout). Feito de retângulos editáveis. */
function mark(k, accent, ink, name = 'Símbolo') {
  const bar = (x, y, w, h, fill, nm) => ({ type: 'rect', props: { name: nm, x: x * k, y: y * k, w: w * k, h: h * k, radius: (Math.min(w, h) / 2) * k, fill: C(fill) } });
  return { type: 'frame', props: { name, w: 32 * k, h: 32 * k, sizeX: 'fixed', sizeY: 'fixed', fill: 'none', layout: { mode: 'none' } }, children: [
    bar(5.2, 3.7, 2.6, 24.6, accent, 'Colchete'),
    bar(5.2, 3.7, 5.6, 2.6, accent, 'Colchete (topo)'),
    bar(5.2, 25.7, 5.6, 2.6, accent, 'Colchete (base)'),
    bar(13, 9, 14, 3.6, ink, 'Linha longa'),
    bar(13, 14.2, 9, 3.6, accent, 'Linha curta'),
    bar(13, 19.4, 12, 3.6, ink, 'Linha média'),
  ] };
}
const wordmark = (size, color) => t('Stylo', size, 600, color, { letterSpacing: -size * 0.02 });
const lockup = (k, accent, ink, wordColor, name) => row([mark(k, accent, ink), wordmark(32 * k * 0.9, wordColor)], { name, layout: { mode: 'row', gap: 10 * k, align: 'center' }, sizeX: 'hug', sizeY: 'hug' });

const SECOES = {
  capa: () => ({ type: 'frame', props: { name: 'Capa', tag: 'header', sizeX: 'fill', sizeY: 'hug', fill: C('Grafite 950'), layout: { mode: 'row', gap: 48, padding: [96, 80, 96, 80], align: 'center', justify: 'space-between' } }, children: [
    col([
      t('Identidade visual · versão 1', 13, 500, 'Âmbar', { letterSpacing: 0.2, name: 'Rótulo da versão' }),
      t('Stylo', 72, 600, 'Texto claro', { tag: 'h1', letterSpacing: -2.2, lineHeight: 1.05 }),
      t('O canvas é CSS de verdade. Uma ferramenta de trabalho, sóbria e densa, que some para o design aparecer.', 20, 400, 'Texto suave claro', { lineHeight: 1.5, sizeX: 'fill', maxW: 560 }),
    ], { name: 'Título', layout: { mode: 'column', gap: 20 }, sizeX: 'fill', sizeY: 'hug' }),
    mark(7, 'Âmbar', 'Texto claro', 'Símbolo grande'),
  ] }),

  principios: () => section('Propósito e princípios', [
    heading('Propósito e princípios'),
    { type: 'frame', props: { name: 'Propósito e lista', sizeX: 'fill', fill: 'none', layout: { mode: 'row', gap: 80, align: 'flex-start' } }, children: [
      col([
        t('Propósito', 13, 500, 'Texto suave claro'),
        lead('Desenhar páginas como no Figma, mas cada camada é um elemento HTML estilizado pelo próprio navegador. A identidade existe para servir a esse trabalho, não para aparecer: quem usa o Stylo olha para o design, não para a ferramenta.', 'Texto claro', { maxW: 440 }),
      ], { name: 'Propósito', sizeX: 'fill', layout: { mode: 'column', gap: 12 } }),
      col([
        ...[['1', 'CSS de verdade', 'O que se vê é o que sai. Nomes do painel são nomes do CSS.'],
          ['2', 'Sóbrio e denso', 'Neutros quentes, bordas de 1 px, cantos de 2, 4 e 6 px. Sem brilho, sem vidro, sem gradiente decorativo.'],
          ['3', 'Um único acento', 'O âmbar marca ação, seleção e estado. Nunca decora.'],
          ['4', 'Local e honesto', 'Sem conta, sem nuvem. O arquivo é seu e o código exportado também.']].flatMap(([n, titulo, texto], i) => [
          ...(i ? [rule()] : []),
          row([m(n, 13, 'Âmbar', { w: 20, sizeX: 'fixed' }), col([t(titulo, 15, 600, 'Texto claro'), t(texto, 13, 400, 'Texto suave claro', { sizeX: 'fill', lineHeight: 1.55 })], { layout: { mode: 'column', gap: 4 }, sizeX: 'fill' })], { layout: { mode: 'row', gap: 16, align: 'flex-start' }, sizeX: 'fill', name: `Princípio ${n}` }),
        ]),
      ], { name: 'Princípios', sizeX: 'fill', layout: { mode: 'column', gap: 16 } }),
    ] },
  ]),

  logo: () => section('Logotipo', [
    heading('Logotipo'),
    lead('O símbolo é um colchete e três linhas de larguras diferentes: uma regra CSS e um auto layout. Sem quadrado de aplicativo, sem raio, pincel ou varinha. Funciona de 16 px (aba do navegador) a 160 px.'),
    { type: 'frame', props: { name: 'Versões', sizeX: 'fill', fill: 'none', layout: { mode: 'row', gap: 24 } }, children: [
      { type: 'frame', props: { name: 'Sobre grafite', sizeX: 'fill', h: 220, sizeY: 'fixed', fill: C('Grafite 900'), radius: 6, stroke: { color: '#2C2A27', width: 1 }, layout: { mode: 'column', gap: 20, padding: 32, justify: 'center', align: 'center' } }, children: [lockup(1.5, 'Âmbar', 'Texto claro', 'Texto claro', 'Logotipo sobre grafite'), m('âmbar #E9A23B · linhas #ECE9E4', 11, 'Texto suave claro')] },
      { type: 'frame', props: { name: 'Sobre papel', sizeX: 'fill', h: 220, sizeY: 'fixed', fill: C('Papel'), radius: 6, layout: { mode: 'column', gap: 20, padding: 32, justify: 'center', align: 'center' } }, children: [lockup(1.5, 'Âmbar escuro', 'Tinta', 'Tinta', 'Logotipo sobre papel'), m('âmbar escuro #9A5B00 · linhas #1D1B18', 11, 'Tinta suave')] },
    ] },
    { type: 'frame', props: { name: 'Tamanhos e regras', sizeX: 'fill', fill: 'none', layout: { mode: 'row', gap: 64, align: 'flex-end' } }, children: [
      row([[3, '96 px'], [1.5, '48 px'], [0.75, '24 px'], [0.5, '16 px']].map(([k, rotulo]) => col([mark(k, 'Âmbar', 'Texto claro', rotulo), m(rotulo, 11, 'Texto suave claro')], { name: `Símbolo ${rotulo}`, layout: { mode: 'column', gap: 10, align: 'center' }, sizeX: 'hug' })), { name: 'Escala do símbolo', layout: { mode: 'row', gap: 32, align: 'flex-end' }, sizeX: 'hug' }),
      col([
        t('Área de respiro', 13, 600, 'Texto claro'),
        t('Margem mínima igual à altura de uma linha do símbolo (3,6 de 32 unidades) em todos os lados.', 13, 400, 'Texto suave claro', { sizeX: 'fill', maxW: 340 }),
        t('Não fazer', 13, 600, 'Texto claro', { }),
        t('Não esticar, girar, aplicar sombra ou brilho, trocar as proporções das linhas, usar o âmbar fora do acento ou colocar sobre fundo de baixo contraste.', 13, 400, 'Texto suave claro', { sizeX: 'fill', maxW: 340 }),
      ], { name: 'Regras', sizeX: 'fill', layout: { mode: 'column', gap: 8 } }),
    ] },
  ]),

  cores: () => {
    const sw = (nome, par, onde) => col([
      { type: 'rect', props: { name: `Amostra ${nome}`, sizeX: 'fill', h: 64, sizeY: 'fixed', radius: 4, fill: C(nome), stroke: { color: onde === 'claro' ? '#E4DFD7' : '#2C2A27', width: 1 } } },
      t(nome, 13, 500, onde === 'claro' ? 'Tinta' : 'Texto claro'),
      m(hexOf[nome], 11, onde === 'claro' ? 'Tinta suave' : 'Texto suave claro'),
      ...(par ? [m(par, 11, onde === 'claro' ? 'Tinta suave' : 'Texto suave claro')] : []),
    ], { name: nome, sizeX: 'fill', layout: { mode: 'column', gap: 6 } });
    const grade = (cols) => ({ layout: { mode: 'grid', cols, colGap: 16, rowGap: 24 }, sizeX: 'fill', fill: 'none' });
    return section('Cores', [
      heading('Cores'),
      lead('Um acento só. Neutros quentes para a interface, para o design do usuário se destacar. As razões de contraste foram medidas (WCAG 2.x): todas passam AA.'),
      { type: 'frame', props: { name: 'Tema escuro', ...grade(6) }, children: [
        sw('Grafite 950', 'fundo', 'escuro'), sw('Grafite 900', 'painel', 'escuro'), sw('Grafite 800', 'campo', 'escuro'), sw('Grafite 700', 'item ativo', 'escuro'),
        sw('Texto claro', `texto ${ratio(hexOf['Texto claro'], hexOf['Grafite 900'])}:1`, 'escuro'), sw('Texto suave claro', `secundário ${ratio(hexOf['Texto suave claro'], hexOf['Grafite 900'])}:1`, 'escuro'),
        sw('Âmbar', `acento ${ratio(hexOf['Âmbar'], hexOf['Grafite 900'])}:1`, 'escuro'), sw('Sobre âmbar', `no botão ${ratio(hexOf['Sobre âmbar'], hexOf['Âmbar'])}:1`, 'escuro'), sw('Linha', 'bordas', 'escuro'),
        sw('Perigo', `erro ${ratio(hexOf['Perigo'], hexOf['Grafite 900'])}:1`, 'escuro'), sw('Sucesso', `confirmação ${ratio(hexOf['Sucesso'], hexOf['Grafite 900'])}:1`, 'escuro'),
      ] },
      { type: 'frame', props: { name: 'Tema claro', fill: C('Papel'), radius: 6, layout: { mode: 'column', gap: 20, padding: 28 }, sizeX: 'fill' }, children: [
        t('Tema claro', 13, 600, 'Tinta'),
        { type: 'frame', props: { name: 'Amostras claras', ...grade(6) }, children: [
          sw('Papel', 'fundo', 'claro'), sw('Branco', 'painel', 'claro'), sw('Papel 2', 'campo', 'claro'), sw('Papel 3', 'item ativo', 'claro'),
          sw('Tinta', `texto ${ratio(hexOf['Tinta'], hexOf['Branco'])}:1`, 'claro'), sw('Tinta suave', `secundário ${ratio(hexOf['Tinta suave'], hexOf['Branco'])}:1`, 'claro'),
          sw('Âmbar escuro', `acento ${ratio(hexOf['Âmbar escuro'], hexOf['Branco'])}:1`, 'claro'), sw('Perigo escuro', `erro ${ratio(hexOf['Perigo escuro'], hexOf['Branco'])}:1`, 'claro'), sw('Sucesso escuro', `confirmação ${ratio(hexOf['Sucesso escuro'], hexOf['Branco'])}:1`, 'claro'),
        ] },
      ] },
    ]);
  },

  tipografia: () => section('Tipografia', [
    heading('Tipografia'),
    lead('Uma família para a interface (IBM Plex Sans) e uma para código e medidas (JetBrains Mono, só onde há código, dado ou medida). Escala fixa, sem tamanhos fluidos. Texto de interface nunca abaixo de 11 px.'),
    { type: 'frame', props: { name: 'Amostras', sizeX: 'fill', fill: 'none', layout: { mode: 'row', gap: 64, align: 'flex-start' } }, children: [
      col([
        t('Aa', 96, 600, 'Texto claro', { letterSpacing: -3, lineHeight: 1 }),
        t('IBM Plex Sans', 20, 600, 'Texto claro'),
        t('Pesos 400 · 500 · 600 · 700', 13, 400, 'Texto suave claro'),
        t('O canvas é CSS de verdade.', 20, 400, 'Texto claro'),
        t('O canvas é CSS de verdade.', 20, 500, 'Texto claro'),
        t('O canvas é CSS de verdade.', 20, 600, 'Texto claro'),
        t('O canvas é CSS de verdade.', 20, 700, 'Texto claro'),
      ], { name: 'IBM Plex Sans', sizeX: 'fill', layout: { mode: 'column', gap: 8 } }),
      col([
        { type: 'text', props: { text: '{ }', fontFamily: MONO, fontSize: 96, fontWeight: 400, lineHeight: 1, letterSpacing: -4, fill: C('Âmbar'), sizeX: 'hug' } },
        { type: 'text', props: { text: 'JetBrains Mono', fontFamily: SANS, fontSize: 20, fontWeight: 600, fill: C('Texto claro'), sizeX: 'hug' } },
        t('Código, valores e medidas', 13, 400, 'Texto suave claro'),
        m('display: flex; gap: 16px;', 15, 'Texto claro'),
        m('padding: 8px 16px 8px 16px;', 15, 'Texto claro'),
        m('width · height  1200 × 514', 15, 'Texto claro'),
      ], { name: 'JetBrains Mono', sizeX: 'fill', layout: { mode: 'column', gap: 8 } }),
    ] },
    rule(),
    col([
      t('Escala', 13, 600, 'Texto claro'),
      ...[[11, 400, 'xs · legendas e rótulos densos', '--fs-xs'], [12, 400, 'sm · texto de interface', '--fs-sm'], [13, 400, 'md · campos e leitura corrente', '--fs-md'], [15, 600, 'lg · títulos de seção do painel', '--fs-lg'], [28, 600, 'título de documento', ''], [72, 600, 'exibição', '']].map(([s, w, nome, v]) =>
        row([m(`${s} px`, 11, 'Âmbar', { w: 56, sizeX: 'fixed' }), t(`${nome}`, s, w, 'Texto claro', { sizeX: 'hug', ...(s >= 28 ? { letterSpacing: -s * 0.015 } : {}) }), ...(v ? [m(v, 11, 'Texto suave claro')] : [])], { name: `Escala ${s}`, layout: { mode: 'row', gap: 20, align: 'baseline' } })),
    ], { name: 'Escala', sizeX: 'fill', layout: { mode: 'column', gap: 12 } }),
  ]),

  formas: () => section('Formas, espaço e profundidade', [
    heading('Formas, espaço e profundidade'),
    lead('Poucos valores, sempre os mesmos. Bordas de 1 px fazem a separação; sombra só em quem flutua (menus, janelas), curta e neutra.'),
    { type: 'frame', props: { name: 'Raios e espaços', sizeX: 'fill', fill: 'none', layout: { mode: 'row', gap: 56, align: 'flex-start' } }, children: [
      col([
        t('Raios', 13, 600, 'Texto claro'),
        row([2, 4, 6].map((r, i) => col([{ type: 'rect', props: { name: `Raio ${r}`, w: 112, h: 80, sizeX: 'fixed', sizeY: 'fixed', radius: r, fill: C('Grafite 700'), stroke: { color: '#E9A23B', width: 1 } } }, m(`${r} px`, 11, 'Âmbar'), t(['chips e marcas', 'controles', 'superfícies'][i], 12, 400, 'Texto suave claro')], { layout: { mode: 'column', gap: 6 }, sizeX: 'hug', name: `Amostra de raio ${r}` })), { layout: { mode: 'row', gap: 20, align: 'flex-start' }, sizeX: 'hug', name: 'Raios' }),
      ], { name: 'Raios', sizeX: 'hug', layout: { mode: 'column', gap: 14 } }),
      col([
        t('Espaço (múltiplos de 4)', 13, 600, 'Texto claro'),
        row([4, 8, 12, 16, 24, 32].map((s) => col([{ type: 'rect', props: { name: `Espaço ${s}`, w: s, h: s, sizeX: 'fixed', sizeY: 'fixed', radius: 1, fill: C('Âmbar') } }, m(`${s}`, 11, 'Texto suave claro')], { layout: { mode: 'column', gap: 8, align: 'center' }, sizeX: 'hug', name: `Passo ${s}` })), { layout: { mode: 'row', gap: 20, align: 'flex-end' }, sizeX: 'hug', name: 'Espaços' }),
      ], { name: 'Espaço', sizeX: 'hug', layout: { mode: 'column', gap: 14 } }),
      col([
        t('Profundidade', 13, 600, 'Texto claro'),
        { type: 'frame', props: { name: 'Menu flutuante', w: 190, sizeX: 'fixed', fill: C('Grafite 900'), radius: 6, stroke: { color: '#2C2A27', width: 1 }, shadows: [{ x: 0, y: 8, blur: 24, spread: 0, color: '#000000', opacity: 0.4 }], layout: { mode: 'column', gap: 2, padding: 6 } }, children: [
          row([t('Duplicar', 13, 400, 'Texto claro'), m('Ctrl D', 11, 'Texto suave claro')], { layout: { mode: 'row', gap: 8, padding: [6, 8, 6, 8], justify: 'space-between', align: 'center' }, sizeX: 'fill', fill: C('Grafite 700'), radius: 4, name: 'Item ativo' }),
          row([t('Renomear', 13, 400, 'Texto claro'), m('F2', 11, 'Texto suave claro')], { layout: { mode: 'row', gap: 8, padding: [6, 8, 6, 8], justify: 'space-between', align: 'center' }, sizeX: 'fill', name: 'Item' }),
          row([t('Excluir', 13, 400, 'Perigo'), m('Del', 11, 'Texto suave claro')], { layout: { mode: 'row', gap: 8, padding: [6, 8, 6, 8], justify: 'space-between', align: 'center' }, sizeX: 'fill', name: 'Item perigoso' }),
        ] },
      ], { name: 'Profundidade', sizeX: 'hug', layout: { mode: 'column', gap: 14 } }),
    ] },
  ]),
  icones: () => section('Ícones e imagens', [
    heading('Ícones e imagens'),
    lead('Um conjunto só: Material Symbols, contorno (outlined), 24 px em moldura de 28 px, cor herdada do texto; o acento só no ícone ativo. Imagens entram como placeholders nomeados que dizem o que vai ali.'),
    row(['layers', 'view_quilt', 'code', 'palette', 'tune', 'grid_view', 'text_fields', 'download'].map((nome, i) => col([
      { type: 'frame', props: { name: `Moldura ${nome}`, w: 28, h: 28, sizeX: 'fixed', sizeY: 'fixed', fill: 'none', layout: { mode: 'row', justify: 'center', align: 'center' } }, children: [{ type: 'icon', props: { name: nome, size: 24, color: i === 0 ? '#E9A23B' : '#ECE9E4' } }] }, m(nome, 11, i === 0 ? 'Âmbar' : 'Texto suave claro'),
    ], { name: `Ícone ${nome}`, layout: { mode: 'column', gap: 8, align: 'center' }, sizeX: 'hug' })), { name: 'Ícones', layout: { mode: 'row', gap: 40, align: 'flex-start' }, sizeX: 'fill' }),
  ]),
};

const quais = process.argv[2] === 'tudo' ? Object.keys(SECOES) : [process.argv[2]];
const rootFile = join(tmpdir(), 'stylo-guia-root.txt');
let root = existsSync(rootFile) ? readFileSync(rootFile, 'utf8').trim() : null;
for (const q of quais) {
  if (!SECOES[q]) throw new Error('seção desconhecida: ' + q);
  if (!root) {
    const r = await call('build_layout', { tree: { type: 'frame', props: { name: 'Guia de estilo — Stylo', w: 1280, sizeX: 'fixed', sizeY: 'hug', fill: C('Grafite 950'), layout: { mode: 'column', gap: 0 } }, children: [] } });
    root = r.id || r.created?.id || r.root_id || (r.ids && r.ids[0]) || JSON.stringify(r);
    writeFileSync(rootFile, String(root));
    console.log('raiz criada:', root);
  }
  const r = await call('build_layout', { parent_id: root, tree: SECOES[q]() });
  console.log(`${q}:`, typeof r === 'string' ? r.slice(0, 200) : JSON.stringify(r).slice(0, 200));
}
