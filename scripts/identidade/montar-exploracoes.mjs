// Explorações da identidade, desenhadas NO Stylo pelo MCP: ícones e logos com a caneta (tipo path), página inicial em duas
// versões, proposta de conversa com o agente e o brief. Cada peça leva NOTA (por quê) e, onde há dúvida, COMENTÁRIO (a
// pessoa responde no próprio editor; o agente lê com get_comments).
// Uso: node scripts/identidade/montar-exploracoes.mjs <icones|logos|home1|home2|conversa|brief|tudo>
// Pré-requisitos: servidor isolado, UM editor selecionado (select_editor), projeto "Identidade Stylo" aberto com a paleta.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sid = readFileSync(join(tmpdir(), 'stylo-mcp-sid.txt'), 'utf8').trim();
const call = async (name, args) => {
  const res = await fetch('http://localhost:5173/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Mcp-Session-Id': sid, 'X-Stylo-Agent': 'Claude' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }) });
  const j = await res.json();
  const text = (j.result?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (j.error || j.result?.isError) throw new Error(`${name}: ${JSON.stringify(j.error || text).slice(0, 700)}`);
  try { return JSON.parse(text); } catch { return text; }
};

// ---- cores do projeto
const doc = await call('get_document', {});
const S = Object.fromEntries(doc.colorStyles.map((s) => [s.name, { styleId: s.id }]));
const HEX = Object.fromEntries(doc.colorStyles.map((s) => [s.name, s.color]));
const C = (n) => { if (!S[n]) throw new Error('cor inexistente: ' + n); return S[n]; };

// ---- peças de texto e estrutura (mesmo vocabulário do guia)
const SANS = 'IBM Plex Sans', MONO = 'JetBrains Mono';
const t = (text, size, weight, color, extra = {}) => ({ type: 'text', props: { text, fontFamily: SANS, fontSize: size, fontWeight: weight, lineHeight: size >= 28 ? 1.15 : 1.5, fill: C(color), sizeX: 'hug', ...extra } });
const m = (text, size, color, extra = {}) => ({ type: 'text', props: { text, fontFamily: MONO, fontSize: size, fontWeight: 400, lineHeight: 1.5, fill: C(color), sizeX: 'hug', ...extra } });
const col = (children, props = {}) => ({ type: 'frame', props: { layout: { mode: 'column', gap: 12 }, fill: 'none', ...props }, children });
const row = (children, props = {}) => ({ type: 'frame', props: { layout: { mode: 'row', gap: 12, align: 'center' }, fill: 'none', ...props }, children });
const box = (children, props = {}) => ({ type: 'frame', props: { fill: C('Grafite 900'), radius: 6, stroke: { color: HEX['Linha'], width: 1 }, ...props }, children });
const heading = (text) => t(text, 28, 600, 'Texto claro', { tag: 'h2', letterSpacing: -0.4 });
const lead = (text, extra = {}) => t(text, 15, 400, 'Texto suave claro', { lineHeight: 1.6, sizeX: 'fill', maxW: 680, ...extra });
const pagina = (nome, filhos, extra = {}) => ({ type: 'frame', props: { name: nome, w: 1280, sizeX: 'fixed', sizeY: 'hug', fill: C('Grafite 950'), layout: { mode: 'column', gap: 0, padding: [72, 80, 72, 80] }, ...extra }, children: filhos });
const botao = (rotulo, primario = true, nome) => ({ type: 'frame', props: { name: nome || (primario ? 'Botão primário' : 'Botão secundário'), tag: 'button', cursor: 'pointer', sizeX: 'hug', sizeY: 'hug', fill: primario ? C('Âmbar') : 'none', stroke: primario ? null : { color: HEX['Linha'], width: 1 }, radius: 4, layout: { mode: 'row', gap: 8, padding: [8, 14, 8, 14], justify: 'center', align: 'center' } }, children: [t(rotulo, 13, primario ? 600 : 500, primario ? 'Sobre âmbar' : 'Texto claro', { name: 'Rótulo' })] });
const icone = (nome, size = 20, cor = '#ECE9E4') => ({ type: 'frame', props: { name: `Ícone ${nome}`, w: size + 4, h: size + 4, sizeX: 'fixed', sizeY: 'fixed', fill: 'none', layout: { mode: 'row', justify: 'center', align: 'center' } }, children: [{ type: 'icon', props: { name: nome, size, color: cor } }] });

// ---- vetores (a caneta): coordenadas num espaço de 24 (ou 32), desenhados à mão
const pt = (x, y, hin, hout) => ({ x, y, ...(hin ? { hin: { x: hin[0], y: hin[1] } } : {}), ...(hout ? { hout: { x: hout[0], y: hout[1] } } : {}) });
const caminho = (nome, points, { size, vb = 24, closed = false, cor = '#ECE9E4', largura = 1.75, fill = 'none' }) => ({ type: 'path', props: { name: nome, x: 0, y: 0, w: size, h: size, vw: vb, vh: vb, closed, points, fill, stroke: { color: cor, width: Math.max(1, largura * (size / vb)), cap: 'round', join: 'round' } } });
const moldura = (nome, size, filhos) => ({ type: 'frame', props: { name: nome, w: size, h: size, sizeX: 'fixed', sizeY: 'fixed', fill: 'none', layout: { mode: 'none' } }, children: filhos });

/** Os 8 ícones próprios (grade de 24). Cada um é uma lista de caminhos {nome, pts, closed?}. */
const ICONES = {
  camadas: { nota: 'Três camadas empilhadas: o losango de cima é fechado, as de baixo são só o "V". Mesmo desenho do painel Camadas do Stylo.', path: [
    { nome: 'Topo', closed: true, pts: [pt(12, 3), pt(21, 8), pt(12, 13), pt(3, 8)] }, { nome: 'Meio', pts: [pt(3, 12), pt(12, 17), pt(21, 12)] }, { nome: 'Base', pts: [pt(3, 16), pt(12, 21), pt(21, 16)] }] },
  'regra-css': { nota: 'O símbolo da marca em miniatura: colchete + três linhas de larguras diferentes. Significa "regra CSS" e "auto layout".', path: [
    { nome: 'Colchete', pts: [pt(9, 4), pt(5, 4), pt(5, 20), pt(9, 20)] }, { nome: 'Linha 1', pts: [pt(12, 8), pt(20, 8)] }, { nome: 'Linha 2', pts: [pt(12, 12), pt(17, 12)] }, { nome: 'Linha 3', pts: [pt(12, 16), pt(19, 16)] }] },
  breakpoints: { nota: 'Monitor e celular lado a lado: a ideia de breakpoints (Desktop, Tablet, Celular) do projeto.', path: [
    { nome: 'Monitor', closed: true, pts: [pt(2.5, 5), pt(16.5, 5), pt(16.5, 15), pt(2.5, 15)] }, { nome: 'Haste', pts: [pt(9.5, 15), pt(9.5, 18.5)] }, { nome: 'Base', pts: [pt(6.5, 18.5), pt(12.5, 18.5)] }, { nome: 'Celular', closed: true, pts: [pt(18.5, 9), pt(22, 9), pt(22, 17), pt(18.5, 17)] }] },
  componente: { nota: 'Losango dentro de losango: o componente principal e suas instâncias (mesmo vocabulário do Figma, sem copiar o desenho).', path: [
    { nome: 'Externo', closed: true, pts: [pt(12, 3), pt(21, 12), pt(12, 21), pt(3, 12)] }, { nome: 'Interno', closed: true, pts: [pt(12, 8), pt(16, 12), pt(12, 16), pt(8, 12)] }] },
  exportar: { nota: 'Bandeja aberta e seta para cima: exportar o site (HTML, ZIP, PNG).', path: [
    { nome: 'Bandeja', pts: [pt(4, 14), pt(4, 20), pt(20, 20), pt(20, 14)] }, { nome: 'Haste', pts: [pt(12, 15), pt(12, 4)] }, { nome: 'Ponta', pts: [pt(8, 8), pt(12, 4), pt(16, 8)] }] },
  agente: { nota: 'Balão de fala com uma faísca: o agente. O balão usa curvas de Bézier (cantos arredondados por alças) e o rabo é um canto reto: bom teste da caneta.', path: [
    { nome: 'Balão', closed: true, pts: [pt(6, 4, null, [4.4, 4]), pt(18, 4, [16, 4], [19.66, 4]), pt(21, 7, [21, 5.34], null), pt(21, 13, null, [21, 14.66]), pt(18, 16, [19.66, 16], null), pt(13, 16), pt(9, 20.5), pt(9, 16), pt(6, 16, null, [4.34, 16]), pt(3, 13, [3, 14.66], null), pt(3, 7, null, [3, 5.34]), pt(6, 4, [4.34, 4], null)].slice(0, 11) },
    { nome: 'Faísca', closed: true, pts: [pt(12, 6.5), pt(13.1, 9), pt(15.5, 10), pt(13.1, 11), pt(12, 13.5), pt(10.9, 11), pt(8.5, 10), pt(10.9, 9)] }] },
  nota: { nota: 'Post-it com canto dobrado e duas linhas: a "nota" da camada (documenta para que serve e vira comentário no código).', path: [
    { nome: 'Folha', closed: true, pts: [pt(5, 4), pt(19, 4), pt(19, 14), pt(14, 19), pt(5, 19)] }, { nome: 'Dobra', pts: [pt(19, 14), pt(14, 14), pt(14, 19)] }, { nome: 'Linha 1', pts: [pt(8, 8), pt(16, 8)] }, { nome: 'Linha 2', pts: [pt(8, 11.5), pt(12, 11.5)] }] },
  comentario: { nota: 'Alfinete com furo: o comentário preso a uma camada (pino no canvas). A gota é uma curva fechada de quatro alças.', path: [
    { nome: 'Gota', closed: true, pts: [pt(12, 21, [17, 15.5], [7, 15.5]), pt(5, 10, [5, 13.2], [5, 6.1]), pt(12, 3, [8.1, 3], [15.9, 3]), pt(19, 10, [19, 6.1], [19, 13.2])] }, { nome: 'Furo', closed: true, pts: [pt(12, 7.8, [10.8, 7.8], [13.2, 7.8]), pt(14.2, 10, [14.2, 8.8], [14.2, 11.2]), pt(12, 12.2, [13.2, 12.2], [10.8, 12.2]), pt(9.8, 10, [9.8, 11.2], [9.8, 8.8])] }] },
};
const ROTULO = { 'regra-css': 'regra CSS', comentario: 'comentário' };
const iconeVetor = (chave, size, cor) => moldura(`Ícone ${chave} ${size}px`, size, ICONES[chave].path.map((p) => caminho(p.nome, p.pts, { size, closed: !!p.closed, cor })));

/** Quatro conceitos de símbolo, na grade de 32. `cor` = acento; `tinta` = linhas. */
const CONCEITOS = {
  A: { nome: 'Camadas', nota: 'Dois blocos deslocados, o de trás só contorno. Fácil de ler, mas lembra qualquer app de camadas (e o Figma/Notion). Funciona em 16 px.', fazer: (s, cor, tinta) => [
    caminho('Bloco de trás', [pt(5, 5), pt(21, 5), pt(21, 21), pt(5, 21)], { size: s, vb: 32, closed: true, cor, largura: 2.4 }),
    caminho('Bloco da frente', [pt(11, 11), pt(27, 11), pt(27, 27), pt(11, 27)], { size: s, vb: 32, closed: true, cor: tinta, largura: 2.2, fill: tinta })] },
  B: { nota: 'Colchete e três linhas de larguras diferentes: uma regra CSS e um auto layout. Desenhado com traços de ponta redonda (cap round): por isso fica nítido de 16 a 160 px e não precisa de quadrado de aplicativo. É a minha recomendação.', nome: 'Colchete e linhas', fazer: (s, cor, tinta) => [
    caminho('Colchete', [pt(10.8, 5), pt(6.5, 5), pt(6.5, 27), pt(10.8, 27)], { size: s, vb: 32, cor, largura: 2.6 }),
    caminho('Linha longa', [pt(14.8, 10.8), pt(25.2, 10.8)], { size: s, vb: 32, cor: tinta, largura: 3.6 }),
    caminho('Linha curta', [pt(14.8, 16), pt(21.2, 16)], { size: s, vb: 32, cor, largura: 3.6 }),
    caminho('Linha média', [pt(14.8, 21.2), pt(23.6, 21.2)], { size: s, vb: 32, cor: tinta, largura: 3.6 })] },
  C: { nome: 'S de blocos', nota: 'O "S" feito de dois blocos encaixados (como caixas do box model). É o símbolo atual sem o quadrado escuro. Marcante, mas o S de bloco perde a forma abaixo de 20 px.', fazer: (s, cor, tinta) => [
    caminho('Bloco de cima', [pt(7, 6), pt(25, 6), pt(25, 11.5), pt(13, 11.5), pt(13, 14.2), pt(22.5, 14.2), pt(22.5, 19.6), pt(7, 19.6)], { size: s, vb: 32, closed: true, cor, largura: 1.2, fill: cor }),
    caminho('Bloco de baixo', [pt(19, 13.8), pt(25, 13.8), pt(25, 26), pt(7, 26), pt(7, 20.6), pt(19, 20.6)], { size: s, vb: 32, closed: true, cor: tinta, largura: 1.2, fill: tinta })] },
  D: { nome: 'Fio (S contínuo)', nota: 'Um único traço de Bézier desenhando um S, com ponta redonda: a caneta é o próprio símbolo. Mais orgânico e menos "ferramenta de CSS"; arrisca parecer genérico e pede um peso de traço maior em tamanho pequeno.', fazer: (s, cor) => [
    caminho('Fio', [pt(23, 9, null, [22, 6]), pt(16, 5, [19.5, 5], [12.5, 5]), pt(9, 10.5, [9, 7.5], [9, 13.5]), pt(16, 16, [11.5, 15.2], [20.5, 16.8]), pt(23, 21.5, [23, 18.5], [23, 24.5]), pt(16, 27, [19.5, 27], [12.5, 27]), pt(9, 23, [10.5, 26], null)], { size: s, vb: 32, cor, largura: 3.4 })] },
};

// ------------------------------------------------------------------------------------------------------- páginas
/** Reutiliza a página se já existir (passos podem ser repetidos sem duplicar); senão cria. */
async function novaPagina(nome) {
  const d = await call('get_document', {});
  const existe = d.pages.find((p) => p.name === nome);
  if (existe) { await call('switch_page', { id: existe.id }); return existe.id; }
  const r = await call('create_page', { name: nome });
  return r.page?.id;
}
async function construir(tree) { const r = await call('build_layout', { tree }); return r.created; }
const comentar = (id, texto) => call('add_comment', { id, text: texto });
const achar = async (nome) => { const f = await call('find_layers', { query: nome }); const lista = f.layers || f.results || f.matches || []; const hit = lista.find((x) => x.name === nome); if (!hit) throw new Error('não achei: ' + nome); return hit.id; };

const PASSOS = {
  async icones() {
    await novaPagina('Ícones (caneta)');
    const celula = (chave) => box([
      moldura(`Ícone ${chave}`, 96, ICONES[chave].path.map((p) => caminho(p.nome, p.pts, { size: 96, closed: !!p.closed, cor: '#ECE9E4' }))),
      t(ROTULO[chave] ?? chave, 13, 600, 'Texto claro'),
      row([iconeVetor(chave, 24, '#ECE9E4'), iconeVetor(chave, 16, '#ECE9E4'), iconeVetor(chave, 24, '#E9A23B')], { name: 'Tamanhos', layout: { mode: 'row', gap: 16, align: 'center' }, sizeX: 'hug' }),
    ], { name: `Célula ${chave}`, note: ICONES[chave].nota, sizeX: 'fill', layout: { mode: 'column', gap: 12, padding: 20, align: 'flex-start' } });
    const chaves = Object.keys(ICONES);
    const tela = await construir(pagina('Ícones — desenhados com a caneta', [
      col([
        heading('Ícones desenhados com a caneta'),
        lead('Oito ícones próprios na grade de 24, traço de 1,75 px com ponta e junção redondas, um único peso. São caminhos vetoriais (tipo path): editáveis com a caneta do Stylo. Cada célula tem uma nota explicando o desenho e três tamanhos de teste (24, 16 e 24 em âmbar para o estado ativo).'),
        { type: 'frame', props: { name: 'Grade de ícones', sizeX: 'fill', fill: 'none', layout: { mode: 'grid', cols: 4, colGap: 16, rowGap: 16 } }, children: chaves.map(celula) },
      ], { name: 'Conteúdo', sizeX: 'fill', layout: { mode: 'column', gap: 24 } }),
    ], { note: 'Página de exploração. Notas nas células explicam cada desenho. Os ícones atuais do app são desenhados à mão no código (src/ui/icons.js); estes podem substituí-los.' }));
    await comentar(tela.id, 'Os ícones de hoje do Stylo ficam em src/ui/icons.js, desenhados à mão no código. Quer que eu troque pelos seus novos, um painel por vez (começando por Camadas)? Responda neste comentário. Se preferir manter o conjunto atual, digo quais destes valem só para a identidade/marketing.');
    return tela;
  },

  async logos() {
    await novaPagina('Logo — exploração');
    const cel = (id, c) => box([
      row([
        moldura(`Símbolo ${id} grande`, 128, c.fazer(128, '#E9A23B', '#ECE9E4')),
        col([
          t(`${id} · ${c.nome}`, 15, 600, 'Texto claro'),
          row([moldura(`${id} 48`, 48, c.fazer(48, '#E9A23B', '#ECE9E4')), moldura(`${id} 24`, 24, c.fazer(24, '#E9A23B', '#ECE9E4')), moldura(`${id} 16`, 16, c.fazer(16, '#E9A23B', '#ECE9E4'))], { name: 'Tamanhos', layout: { mode: 'row', gap: 20, align: 'flex-end' }, sizeX: 'hug' }),
          t(c.nota, 12, 400, 'Texto suave claro', { sizeX: 'fill', lineHeight: 1.55, maxW: 300 }),
        ], { name: 'Detalhes', sizeX: 'fill', layout: { mode: 'column', gap: 12 } }),
      ], { name: `Conceito ${id}`, layout: { mode: 'row', gap: 28, align: 'flex-start' }, sizeX: 'fill' }),
    ], { name: `Cartão ${id}`, note: `Conceito ${id} (${c.nome}): ${c.nota}`, sizeX: 'fill', layout: { mode: 'column', gap: 0, padding: 28 } });
    const tela = await construir(pagina('Logo — exploração', [col([
      heading('Quatro ideias de símbolo'),
      lead('Todas desenhadas com a caneta (tipo path), em 32 unidades, sobre grafite, com o âmbar como acento. Cada cartão tem o símbolo em 128, 48, 24 e 16 px (o teste que mais elimina ideia ruim) e uma nota com o raciocínio. Pergunta de design: o símbolo precisa dizer "CSS/regra" (B), "camadas" (A), "blocos" (C) ou só ser uma marca (D)?'),
      { type: 'frame', props: { name: 'Conceitos', sizeX: 'fill', fill: 'none', layout: { mode: 'grid', cols: 2, colGap: 16, rowGap: 16 } }, children: Object.entries(CONCEITOS).map(([id, c]) => cel(id, c)) },
    ], { name: 'Conteúdo', sizeX: 'fill', layout: { mode: 'column', gap: 24 } })], { note: 'Exploração de logo. A recomendação é o B; a decisão é da pessoa.' }));
    const idB = await achar('Cartão B');
    await comentar(idB, 'Minha recomendação é o B (colchete e linhas): diz o que o produto é, aguenta 16 px e não precisa de quadrado de app. Mas a escolha é sua. Responda aqui com a letra (A, B, C ou D) e, se quiser, o motivo; eu aplico no app.');
    const idD = await achar('Cartão D');
    await comentar(idD, 'O D é o mais "marca" e menos "ferramenta". Se você quer algo mais humano e menos técnico, ele é o caminho; peço um traço mais grosso em 16 px. Quer que eu desenhe 2 variações dele?');
    return tela;
  },
};


// ---------------------------------------------------------------------------------------------- Home (as telas do app)
const PROJETOS = [
  ['Lumen — Landing responsiva', '3 páginas', 'há 12 min', 'pasta'], ['Portfólio — Ana Souza', '5 páginas', 'ontem', 'pasta'], ['Loja Cerâmica Aurora', '4 páginas', 'há 2 dias', 'pasta'],
  ['App Finanças — onboarding', '6 telas', 'há 5 dias', 'pasta'], ['Docs do Stylo', '12 páginas', 'há 1 semana', 'pasta'], ['Teste MCP — auditoria', '4 páginas', 'há 1 semana', 'navegador'],
  ['Cardápio digital — Trattoria', '2 páginas', 'há 2 semanas', 'pasta'], ['Rascunho sem título', '1 página', 'há 3 semanas', 'navegador'],
];
const miniatura = (nome, w, h, extra = {}) => ({ type: 'frame', props: { name: nome, ...(extra.sizeX === 'fill' ? {} : { w }), h, sizeX: 'fixed', sizeY: 'fixed', fill: C('Grafite 800'), radius: 4, stroke: { color: HEX['Linha'], width: 1 }, layout: { mode: 'column', justify: 'center', align: 'center' }, ...extra }, children: [m('miniatura', 11, 'Texto suave claro', { name: 'Legenda do placeholder' })] });
const simbolo = (s = 24) => moldura(`Símbolo ${s}`, s, CONCEITOS.B.fazer(s, '#E9A23B', '#ECE9E4'));
const marca = (s = 24) => row([simbolo(s), t('Stylo', Math.round(s * 0.7), 600, 'Texto claro', { letterSpacing: -0.3 })], { name: 'Marca', layout: { mode: 'row', gap: 8, align: 'center' }, sizeX: 'hug' });
const chipLocal = (local) => ({ type: 'frame', props: { name: `Local: ${local}`, sizeX: 'hug', sizeY: 'hug', fill: C('Grafite 700'), radius: 2, layout: { mode: 'row', padding: [2, 6, 2, 6], gap: 6, align: 'center' } }, children: [{ type: 'ellipse', props: { name: 'Ponto', w: 6, h: 6, fill: local === 'pasta' ? C('Sucesso') : C('Âmbar') } }, t(local === 'pasta' ? 'na pasta' : 'só no navegador', 11, 500, 'Texto claro')] });
const campoBusca = (w, nome = 'Busca') => row([{ type: 'icon', props: { name: 'search', size: 16, color: '#A39E96' } }, t('Buscar projeto', 13, 400, 'Texto suave claro'), m('/', 11, 'Texto suave claro', { name: 'Atalho' })], { name: nome, w, sizeX: w ? 'fixed' : 'fill', sizeY: 'hug', fill: C('Grafite 800'), radius: 4, layout: { mode: 'row', gap: 8, padding: [7, 10, 7, 10], align: 'center', justify: 'flex-start' } });
const itemNav = (rotulo, ico, ativo) => row([ico, t(rotulo, 13, ativo ? 600 : 400, ativo ? 'Texto claro' : 'Texto suave claro')], { name: `Navegação: ${rotulo}`, sizeX: 'fill', fill: ativo ? C('Grafite 700') : 'none', radius: 4, layout: { mode: 'row', gap: 10, padding: [7, 10, 7, 10], align: 'center' } });
const iv = (chave, cor) => iconeVetor(chave, 20, cor || '#A39E96');
const achaTodos = async (nome) => { const f = await call('find_layers', { query: nome }); return (f.layers || f.results || f.matches || []).filter((x) => x.name === nome); };

const PASSOS2 = {
  async home1() {
    await novaPagina('Home — versão 1 (lista)');
    const linha = ([nome, pags, quando, local]) => row([
      row([iv('camadas', '#A39E96'), t(nome, 13, 500, 'Texto claro')], { name: 'Nome', sizeX: 'fill', layout: { mode: 'row', gap: 10, align: 'center' } }),
      m(pags, 11, 'Texto suave claro', { w: 110, sizeX: 'fixed' }), t(quando, 12, 400, 'Texto suave claro', { w: 130, sizeX: 'fixed' }),
      { type: 'frame', props: { name: 'Local', w: 150, sizeX: 'fixed', sizeY: 'hug', fill: 'none', layout: { mode: 'row' } }, children: [chipLocal(local)] },
    ], { name: 'Linha de projeto', sizeX: 'fill', radius: 4, layout: { mode: 'row', gap: 16, padding: [10, 12, 10, 12], align: 'center' } });
    const cab = row([t('Nome', 11, 500, 'Texto suave claro', { sizeX: 'fill' }), t('Páginas', 11, 500, 'Texto suave claro', { w: 110, sizeX: 'fixed' }), t('Modificado', 11, 500, 'Texto suave claro', { w: 130, sizeX: 'fixed' }), t('Local', 11, 500, 'Texto suave claro', { w: 150, sizeX: 'fixed' })], { name: 'Cabeçalho da tabela', sizeX: 'fill', stroke: { color: HEX['Linha'], width: 1, sides: [0, 0, 1, 0] }, layout: { mode: 'row', gap: 16, padding: [8, 12, 8, 12], align: 'center' } });
    const lateral = (ativo) => col([
      marca(26),
      col([itemNav('Projetos', iv('camadas', ativo ? '#E9A23B' : undefined), true), itemNav('Modelos', iv('componente'), false), itemNav('Aprender', iv('nota'), false), itemNav('Agentes', iv('agente'), false), itemNav('Configurações', { type: 'icon', props: { name: 'settings', size: 20, color: '#A39E96' } }, false)], { name: 'Navegação', sizeX: 'fill', layout: { mode: 'column', gap: 2 } }),
      { type: 'frame', props: { name: 'Espaço', sizeX: 'fill', sizeY: 'fill', fill: 'none' } },
      col([
        row([{ type: 'ellipse', props: { name: 'Ponto verde', w: 8, h: 8, fill: C('Sucesso') } }, t('Claude conectado (MCP)', 12, 400, 'Texto claro')], { name: 'Agente conectado', layout: { mode: 'row', gap: 8, align: 'center' }, sizeX: 'fill' }),
        m('projetos/ · trocar pasta', 11, 'Texto suave claro', { name: 'Pasta de projetos' }),
      ], { name: 'Rodapé da lateral', sizeX: 'fill', layout: { mode: 'column', gap: 8 } }),
    ], { name: 'Lateral', w: 232, sizeX: 'fixed', sizeY: 'fill', fill: C('Grafite 900'), stroke: { color: HEX['Linha'], width: 1, sides: [0, 1, 0, 0] }, layout: { mode: 'column', gap: 24, padding: 16 } });

    const lista = {
      type: 'frame', props: { name: 'Home — V1 Lista', w: 1440, h: 900, sizeX: 'fixed', sizeY: 'fixed', fill: C('Grafite 950'), clip: true, layout: { mode: 'row', gap: 0 },
        note: 'V1 · Lista densa. Prioriza velocidade: o último projeto em uma faixa com um botão, e uma tabela que escala para 100+ projetos. A lateral guarda navegação, a pasta de projetos e o estado do agente (MCP).' }, children: [
        lateral(true),
        col([
          row([t('Seus projetos', 28, 600, 'Texto claro', { tag: 'h1', letterSpacing: -0.4, sizeX: 'fill' }), campoBusca(280), botao('Importar .json', false), botao('Novo projeto', true)], { name: 'Cabeçalho', sizeX: 'fill', layout: { mode: 'row', gap: 12, align: 'center' } }),
          box([miniatura('Miniatura do último projeto', 168, 104), col([
            t('Continuar de onde parou', 11, 500, 'Texto suave claro'),
            t(PROJETOS[0][0], 20, 600, 'Texto claro', { letterSpacing: -0.2 }),
            m('3 páginas · 186 camadas · salvo na pasta · aberto há 12 min', 11, 'Texto suave claro'),
          ], { name: 'Dados', sizeX: 'fill', layout: { mode: 'column', gap: 6 } }), botao('Continuar editando', true)], { name: 'Continuar editando', sizeX: 'fill', note: 'O caminho mais curto do app: abrir o último projeto em um clique. É a ação principal da tela; o "Novo projeto" é a segunda.', layout: { mode: 'row', gap: 20, padding: 16, align: 'center' } }),
          col([cab, ...PROJETOS.map(linha)], { name: 'Tabela de projetos', sizeX: 'fill', layout: { mode: 'column', gap: 0 }, note: 'Tabela com 8 linhas de exemplo. Passar o mouse destaca a linha (estado :hover real). "Local" distingue o que está na pasta do que vive só no navegador (e pode se perder).' }),
          m('8 projetos · salvos em Documentos/Stylo/projetos', 11, 'Texto suave claro', { name: 'Rodapé' }),
        ], { name: 'Conteúdo', sizeX: 'fill', sizeY: 'fill', layout: { mode: 'column', gap: 24, padding: [40, 56, 40, 56] } }),
      ],
    };
    const vazio = {
      type: 'frame', props: { name: 'Home — V1 primeiro uso', w: 1440, h: 900, sizeX: 'fixed', sizeY: 'fixed', fill: C('Grafite 950'), clip: true, layout: { mode: 'row', gap: 0 },
        note: 'Estado vazio que ENSINA: sem projetos, a tela oferece o caminho mais curto para aprender (abrir o exemplo) e o de quem já sabe (em branco).' }, children: [
        lateral(false),
        col([
          col([
            t('Comece por um exemplo', 28, 600, 'Texto claro', { tag: 'h1', letterSpacing: -0.4 }),
            t('O projeto base é uma landing page responsiva inteira, feita no Stylo. Abra, mexa e veja o CSS que cada campo gera.', 15, 400, 'Texto suave claro', { lineHeight: 1.6, sizeX: 'fill', maxW: 520 }),
            row([botao('Abrir o projeto base', true), botao('Projeto em branco', false)], { name: 'Ações', layout: { mode: 'row', gap: 12 }, sizeX: 'hug' }),
            m('Nenhum projeto na pasta ainda. Ctrl+S dentro do editor salva aqui.', 11, 'Texto suave claro'),
          ], { name: 'Primeiro uso', sizeX: 'fill', maxW: 560, layout: { mode: 'column', gap: 16 } }),
        ], { name: 'Conteúdo', sizeX: 'fill', sizeY: 'fill', layout: { mode: 'column', gap: 24, padding: [40, 56, 40, 56], justify: 'center', align: 'flex-start' } }),
      ],
    };
    const a = await construir(lista);
    const b = await construir(vazio);
    // o segundo quadro entra ao lado do primeiro (a tela raiz nova já vai para a direita do que existe)
    for (const hit of await achaTodos('Linha de projeto')) await call('set_state', { id: hit.id, state: 'hover', props: { fill: C('Grafite 800') } });
    await comentar(a.id, 'Pergunta de produto: lista ou galeria como padrão da Home? A lista (V1) escala melhor e é mais rápida de escanear; a galeria (V2) mostra miniaturas e ensina mais. Responda neste comentário (ou diga "V1", "V2" ou "as duas, com um alternador").');
    await comentar(b.id, 'No primeiro uso o padrão sugerido é "abrir o projeto base". Concorda, ou prefere abrir direto um projeto em branco?');
    return a;
  },

  async home2() {
    await novaPagina('Home — versão 2 (galeria)');
    const cartao = ([nome, pags, quando, local]) => col([
      miniatura(`Miniatura ${nome}`, 100, 150, { sizeX: 'fill' }),
      col([t(nome, 13, 600, 'Texto claro', { sizeX: 'fill' }), m(`${pags} · ${quando}`, 11, 'Texto suave claro'), chipLocal(local)], { name: 'Dados', sizeX: 'fill', layout: { mode: 'column', gap: 6, padding: [0, 2, 0, 2] } }),
    ], { name: 'Cartão de projeto', sizeX: 'fill', fill: C('Grafite 900'), radius: 6, stroke: { color: HEX['Linha'], width: 1 }, layout: { mode: 'column', gap: 10, padding: 10 } });
    const topo = row([marca(26), row([t('Projetos', 13, 600, 'Texto claro'), t('Modelos', 13, 400, 'Texto suave claro'), t('Aprender', 13, 400, 'Texto suave claro')], { name: 'Navegação da barra', layout: { mode: 'row', gap: 24, align: 'center' }, sizeX: 'hug' }), row([campoBusca(240, 'Busca da barra'), { type: 'ellipse', props: { name: 'Avatar', w: 28, h: 28, fill: C('Grafite 700') } }], { name: 'Ações da barra', layout: { mode: 'row', gap: 12, align: 'center' }, sizeX: 'hug' })], { name: 'Barra superior', sizeX: 'fill', stroke: { color: HEX['Linha'], width: 1, sides: [0, 0, 1, 0] }, layout: { mode: 'row', gap: 24, padding: [12, 80, 12, 80], align: 'center', justify: 'space-between' } });
    const filtros = ['Todos', 'Recentes', 'Com agente', 'Só no navegador'].map((r, i) => ({ type: 'frame', props: { name: `Filtro ${r}`, sizeX: 'hug', sizeY: 'hug', fill: i === 0 ? C('Grafite 700') : 'none', radius: 4, layout: { mode: 'row', padding: [5, 10, 5, 10] } }, children: [t(r, 12, i === 0 ? 600 : 400, i === 0 ? 'Texto claro' : 'Texto suave claro')] }));
    const raiz = { type: 'frame', props: { name: 'Home — V2 Galeria', w: 1440, fluid: true, sizeX: 'fixed', sizeY: 'hug', fill: C('Grafite 950'), layout: { mode: 'column', gap: 0 },
      note: 'V2 · Galeria. Mostra o trabalho (miniaturas), destaca o último projeto e a atividade do agente. Responsiva: 4 colunas, 2 no tablet, 1 no celular.' }, children: [
      topo,
      col([
        row([miniatura('Miniatura grande do último projeto', 100, 380, { sizeX: 'fill' }), col([
          t('Continuar de onde parou', 11, 500, 'Texto suave claro'),
          t(PROJETOS[0][0], 32, 600, 'Texto claro', { letterSpacing: -0.6, lineHeight: 1.1, sizeX: 'fill' }),
          m('3 páginas · 186 camadas · salvo na pasta', 11, 'Texto suave claro'),
          row([botao('Continuar editando', true), botao('Duplicar', false)], { name: 'Ações', layout: { mode: 'row', gap: 12 }, sizeX: 'hug' }),
          box([row([iv('agente', '#E9A23B'), t('Claude editou "Hero" há 3 min', 13, 500, 'Texto claro')], { layout: { mode: 'row', gap: 8, align: 'center' }, sizeX: 'fill' }), t('2 alterações pendentes de revisão', 12, 400, 'Texto suave claro'), botao('Ver o que mudou', false)], { name: 'Atividade do agente', sizeX: 'fill', note: 'IDEIA de produto: a Home mostra o que um agente MCP fez e leva a uma tela de revisão (hoje só existe o Ctrl+Z global). Depende de um registro persistente por agente.', layout: { mode: 'column', gap: 8, padding: 14 } }),
        ], { name: 'Detalhes do último', w: 360, sizeX: 'fixed', layout: { mode: 'column', gap: 14 } })], { name: 'Continuar', sizeX: 'fill', layout: { mode: 'row', gap: 32, align: 'flex-start' } }),
        row([t('Todos os projetos', 22, 600, 'Texto claro', { tag: 'h2', sizeX: 'fill' }), row(filtros, { name: 'Filtros', layout: { mode: 'row', gap: 4 }, sizeX: 'hug' })], { name: 'Cabeçalho da grade', sizeX: 'fill', layout: { mode: 'row', gap: 16, align: 'center' } }),
        { type: 'frame', props: { name: 'Grade de projetos', sizeX: 'fill', fill: 'none', layout: { mode: 'grid', cols: 4, colGap: 16, rowGap: 16 }, note: 'Grade fluida: 4 colunas no desktop, 2 no tablet (≤1024) e 1 no celular (≤640), definido com set_responsive.' }, children: PROJETOS.map(cartao) },
        box([col([t('Aprender fazendo', 15, 600, 'Texto claro'), t('Abra a Vitrine completa e veja cada campo do painel virar CSS de verdade.', 13, 400, 'Texto suave claro', { sizeX: 'fill' })], { sizeX: 'fill', layout: { mode: 'column', gap: 4 } }), botao('Abrir o projeto base', false)], { name: 'Projeto base', sizeX: 'fill', layout: { mode: 'row', gap: 24, padding: 20, align: 'center' } }),
      ], { name: 'Conteúdo da galeria', sizeX: 'fill', layout: { mode: 'column', gap: 32, padding: [40, 80, 56, 80] } }),
    ] };
    const a = await construir(raiz);
    for (const hit of await achaTodos('Cartão de projeto')) await call('set_state', { id: hit.id, state: 'hover', props: { stroke: { color: '#E9A23B', width: 1 } } });
    const [grade] = await achaTodos('Grade de projetos');
    await call('set_responsive', { id: grade.id, breakpoint: 'tablet', props: { layout: { cols: 2 } } });
    await call('set_responsive', { id: grade.id, breakpoint: 'mobile', props: { layout: { cols: 1 } } });
    const [conteudo] = await achaTodos('Conteúdo da galeria');
    await call('set_responsive', { id: conteudo.id, breakpoint: 'mobile', props: { layout: { padding: [24, 16, 32, 16] } } });
    const [cont] = await achaTodos('Continuar');
    await call('set_responsive', { id: cont.id, breakpoint: 'tablet', props: { layout: { mode: 'column' } } });
    // tablet e celular: a barra, os blocos de largura fixa e a miniatura grande se adaptam (sem rolagem horizontal)
    const um = async (nome) => (await achaTodos(nome))[0].id;
    const barra = await um('Barra superior');
    await call('set_responsive', { id: barra, breakpoint: 'mobile', props: { layout: { padding: [12, 16, 12, 16], gap: 12 } } });
    await call('set_responsive', { id: await um('Navegação da barra'), breakpoint: 'mobile', props: { visible: false } });
    await call('set_responsive', { id: await um('Busca da barra'), breakpoint: 'mobile', props: { w: 132 } });
    await call('set_responsive', { id: conteudo.id, breakpoint: 'tablet', props: { layout: { padding: [32, 32, 48, 32] } } });
    const det = await um('Detalhes do último');
    await call('set_responsive', { id: det, breakpoint: 'tablet', props: { sizeX: 'fill' } });
    await call('set_responsive', { id: await um('Miniatura grande do último projeto'), breakpoint: 'mobile', props: { h: 220 } });
    await call('set_responsive', { id: await um('Cabeçalho da grade'), breakpoint: 'mobile', props: { layout: { mode: 'column', align: 'flex-start', gap: 12 } } });
    await call('set_responsive', { id: await um('Projeto base'), breakpoint: 'mobile', props: { layout: { mode: 'column', align: 'flex-start' } } });
    await comentar(a.id, 'Esta versão traz uma ideia nova que precisa da sua opinião: mostrar na Home o que um agente (Claude, Codex) alterou e levar a uma tela de revisão. Hoje só existe o Ctrl+Z global. Vale construir? Responda aqui.');
    return a;
  },
};
Object.assign(PASSOS, PASSOS2);


// ---------------------------------------------------------------------------------- Conversa com o agente e Brief
const chip = (rotulo, destaque) => ({ type: 'frame', props: { name: `Resposta rápida: ${rotulo}`, sizeX: 'hug', sizeY: 'hug', fill: 'none', radius: 4, stroke: { color: destaque ? '#E9A23B' : HEX['Linha'], width: 1 }, layout: { mode: 'row', padding: [4, 8, 4, 8] } }, children: [t(rotulo, 12, 500, destaque ? 'Âmbar' : 'Texto claro')] });
const bolha = (autor, filhos, props = {}) => col(filhos, { name: `Mensagem de ${autor}`, sizeX: 'fill', fill: autor === 'você' ? C('Grafite 700') : C('Grafite 800'), radius: 6, layout: { mode: 'column', gap: 8, padding: 12, align: 'flex-start' }, ...props });
const autorLinha = (nome, hora) => row([t(nome, 11, 600, 'Texto claro'), m(hora, 11, 'Texto suave claro')], { layout: { mode: 'row', gap: 8, align: 'center' }, sizeX: 'hug', name: 'Autor' });

const PASSOS3 = {
  async conversa() {
    await novaPagina('Conversa com o agente');
    const abas = row(['Design', 'Protótipo', 'Código', 'Comentários', 'Conversa'].map((r, i) => ({ type: 'frame', props: { name: `Aba ${r}`, sizeX: 'hug', sizeY: 'hug', fill: 'none', stroke: { color: i === 4 ? '#E9A23B' : HEX['Linha'], width: i === 4 ? 2 : 1, sides: [0, 0, i === 4 ? 2 : 1, 0] }, layout: { mode: 'row', gap: 6, padding: [10, 10, 10, 10], align: 'center' } }, children: [t(r, 12, i === 4 ? 600 : 400, i === 4 ? 'Texto claro' : 'Texto suave claro'), ...(i === 4 ? [{ type: 'ellipse', props: { name: 'Mensagem nova', w: 6, h: 6, fill: C('Âmbar') } }] : [])] })), { name: 'Abas', sizeX: 'fill', layout: { mode: 'row', gap: 0 } });
    const painel = {
      type: 'frame', props: { name: 'Painel Conversa', w: 420, h: 820, sizeX: 'fixed', sizeY: 'fixed', fill: C('Grafite 900'), radius: 6, stroke: { color: HEX['Linha'], width: 1 }, clip: true, layout: { mode: 'column', gap: 0 },
        note: 'Proposta: uma aba "Conversa" no painel direito, ao lado de Comentários. O fio de mensagens fica salvo no projeto (como os comentários) e qualquer agente MCP lê e escreve nele.' }, children: [
        abas,
        row([{ type: 'ellipse', props: { name: 'Presença', w: 8, h: 8, fill: C('Sucesso') } }, col([t('Claude · conectado via MCP', 12, 600, 'Texto claro'), m('editando "Home — V2 Galeria"', 11, 'Texto suave claro')], { layout: { mode: 'column', gap: 2 }, sizeX: 'fill' })], { name: 'Presença do agente', sizeX: 'fill', stroke: { color: HEX['Linha'], width: 1, sides: [0, 0, 1, 0] }, layout: { mode: 'row', gap: 10, padding: [10, 14, 10, 14], align: 'center' } }),
        col([
          bolha('Claude', [autorLinha('Claude', '14:02'), t('Terminei as duas versões da Home. Qual você prefere como padrão?', 13, 400, 'Texto claro', { sizeX: 'fill' }), row([chip('V1 lista'), chip('V2 galeria', true), chip('As duas, com alternador')], { name: 'Respostas rápidas', layout: { mode: 'row', gap: 6, wrap: true }, sizeX: 'fill' })]),
          bolha('você', [autorLinha('Você', '14:05'), t('V2, mas quero a lista como opção na barra de filtros.', 13, 400, 'Texto claro', { sizeX: 'fill' })]),
          box([row([iv('agente', '#E9A23B'), t('Claude quer alterar 2 camadas', 13, 600, 'Texto claro')], { layout: { mode: 'row', gap: 8, align: 'center' }, sizeX: 'fill' }), t('"Filtros" e "Grade de projetos" em Home — V2 Galeria', 12, 400, 'Texto suave claro', { sizeX: 'fill' }), row([botao('Permitir', true), botao('Recusar', false), botao('Ver o que muda', false)], { name: 'Aprovação', layout: { mode: 'row', gap: 8, wrap: true }, sizeX: 'fill' })], { name: 'Pedido de permissão', sizeX: 'fill', note: 'Hoje a permissão do MCP abre uma janela modal. Aqui ela vira um cartão dentro da conversa: não interrompe e fica registrada no histórico.', layout: { mode: 'column', gap: 10, padding: 12 } }),
          bolha('Claude', [autorLinha('Claude', '14:06'), t('Feito. Criei o alternador Lista/Galeria e a lista usa a mesma tabela da V1.', 13, 400, 'Texto claro', { sizeX: 'fill' }), row([chip('@Filtros'), chip('Desfazer')], { layout: { mode: 'row', gap: 6 }, sizeX: 'hug' })]),
        ], { name: 'Mensagens', sizeX: 'fill', sizeY: 'fill', layout: { mode: 'column', gap: 12, padding: 14 } }),
        col([
          row([chip('@Home — V2 Galeria'), t('citando esta camada', 11, 400, 'Texto suave claro')], { layout: { mode: 'row', gap: 8, align: 'center' }, sizeX: 'fill' }),
          row([t('Mensagem para o Claude… (@ cita uma camada)', 13, 400, 'Texto suave claro', { sizeX: 'fill' }), { type: 'icon', props: { name: 'send', size: 18, color: '#E9A23B' } }], { name: 'Campo de mensagem', sizeX: 'fill', fill: C('Grafite 800'), radius: 4, stroke: { color: HEX['Linha'], width: 1 }, layout: { mode: 'row', gap: 8, padding: [10, 12, 10, 12], align: 'center' } }),
          m('Conversa salva no projeto, como os comentários.', 11, 'Texto suave claro'),
        ], { name: 'Compositor', sizeX: 'fill', stroke: { color: HEX['Linha'], width: 1, sides: [1, 0, 0, 0] }, layout: { mode: 'column', gap: 8, padding: 14 } }),
      ],
    };
    const bloco = (titulo, itens) => col([t(titulo, 15, 600, 'Texto claro'), ...itens.map((i) => row([m('›', 13, 'Âmbar', { w: 12, sizeX: 'fixed' }), t(i, 13, 400, 'Texto suave claro', { sizeX: 'fill', lineHeight: 1.55 })], { layout: { mode: 'row', gap: 8, align: 'flex-start' }, sizeX: 'fill' }))], { name: titulo, sizeX: 'fill', layout: { mode: 'column', gap: 8 } });
    const tela = await construir(pagina('Conversa com o agente (proposta)', [col([
      heading('Conversa com o agente, dentro do editor'),
      lead('Quando um agente entra pelo MCP, hoje a conversa acontece fora do Stylo (neste terminal) e o editor só mostra o resultado. A proposta é uma aba "Conversa" no painel direito: você fala com o agente sem sair do projeto, ele pergunta com respostas rápidas, pede permissão ali mesmo e cita camadas com @.'),
      row([painel, col([
        bloco('Como funcionaria', ['Um fio de mensagens por projeto, salvo no arquivo (como os comentários). O agente interno e qualquer cliente MCP usam o mesmo fio.', 'Duas ferramentas novas no MCP: get_messages e send_message.', 'Respostas rápidas (chips) para decisões de escolha; texto livre para o resto.', '@ cita uma camada: o agente recebe o id e o que está selecionado.', 'O pedido de permissão vira um cartão na conversa, com "Ver o que muda".']),
        bloco('O que já existe hoje', ['Comentários com respostas e "resolver" (add_comment e get_comments): dá para conversar já, uma camada por vez.', 'Presença do agente (nome, cor, última ação) e a janela de permissão.']),
        bloco('O que falta construir', ['Guardar mensagens no documento e abrir a aba Conversa.', 'get_messages e send_message no MCP e no assistente interno.', 'Aviso de mensagem nova (o pontinho na aba).', 'Registro de alterações por agente, para o "Ver o que muda".']),
      ], { name: 'Explicação', sizeX: 'fill', layout: { mode: 'column', gap: 28 } })], { name: 'Proposta', sizeX: 'fill', layout: { mode: 'row', gap: 56, align: 'flex-start' } }),
    ], { name: 'Conteúdo da conversa', sizeX: 'fill', layout: { mode: 'column', gap: 28 } })], { note: 'Página de proposta (UI da conversa). O primeiro passo seguro é usar o armazenamento de comentários que já existe.' }));
    await comentar(tela.id, 'Você pediu um "chatzinho" via MCP. Este é o desenho. Primeiro passo pequeno e seguro: criar get_messages e send_message sobre os comentários que já existem (sem mudar o formato do projeto) e depois a aba. Quer que eu comece por aí? Enquanto isso, pode me responder pelos comentários: eu leio com get_comments.');
    return tela;
  },

  async brief() {
    await novaPagina('Brief e crítica da Home');
    const item = (rot, texto, extra = {}) => row([t(rot, 13, 600, 'Texto claro', { w: 200, sizeX: 'fixed' }), t(texto, 14, 400, 'Texto suave claro', { sizeX: 'fill', lineHeight: 1.6 })], { name: `Brief: ${rot}`, sizeX: 'fill', stroke: { color: HEX['Linha'], width: 1, sides: [0, 0, 1, 0] }, layout: { mode: 'row', gap: 32, padding: [16, 0, 16, 0], align: 'flex-start' }, ...extra });
    const suposicao = (id, texto) => row([m('SUPOSIÇÃO', 11, 'Âmbar', { w: 90, sizeX: 'fixed' }), t(texto, 14, 400, 'Texto claro', { sizeX: 'fill', lineHeight: 1.55 })], { name: `Decisão (${id})`, sizeX: 'fill', layout: { mode: 'row', gap: 16, align: 'flex-start', padding: [10, 0, 10, 0] } });
    const tela = await construir(pagina('Brief da página inicial', [col([
      heading('Brief da página inicial'),
      lead('Escrito no formato da skill de design (comando shape). Onde faltou resposta sua, a decisão é uma SUPOSIÇÃO marcada, com um comentário no projeto para você corrigir.'),
      col([
        item('Trabalho e público', 'Quem abre o Stylo é web designer ou dev (principal) e quem valida o que um agente construiu (secundário), em sessões longas, quase sempre com um projeto em andamento. Modo de design: Operate (a ferramenta some, o trabalho aparece).'),
        item('Resultado e prova', 'Ação principal: voltar ao último projeto em um clique. Segunda: começar um projeto novo. Terceira: aprender com o projeto base. Sucesso: abrir o último projeto em 1 clique e nunca perder trabalho (aviso claro quando algo só está no navegador).'),
        item('Direção escolhida', 'Identidade A (Âmbar) com símbolo B (colchete e linhas): sóbria e densa. O âmbar marca ação primária, seleção e estado, nunca decora. Sem hero de marketing, sem rótulo sobre o título, sem três cards iguais em fileira.'),
        item('Escopo', 'Duas versões de alta fidelidade da Home: V1 lista (com o estado de primeiro uso) e V2 galeria (responsiva). Estados reais: :hover, vazio, responsivo. Fora do escopo: o editor, as configurações e as páginas internas.'),
        item('Estados e faixas', '0 projetos (primeiro uso); 1 a 12 (típico); 100 ou mais (máximo: tabela com busca e ordenação). Nomes de 3 a 60 caracteres (truncam). Pasta indisponível ou servidor desligado ("só no navegador"). Conflito entre abas.'),
        item('Interação e layout', 'Lista: tabela, busca com a tecla /, setas e Enter para abrir. Galeria: grade de 4, 2 e 1 colunas. Foco visível, alvos de pelo menos 28 px, movimento reduzido respeitado.'),
        item('Restrições', 'Português do Brasil. Funciona sem rede e sem nuvem. As miniaturas reais dependem de gerar a imagem da primeira página do projeto (o código já tem thumbnail.js).'),
      ], { name: 'Itens do brief', sizeX: 'fill', layout: { mode: 'column', gap: 0 } }),
      col([t('Decisões em aberto', 15, 600, 'Texto claro'),
        suposicao('a', 'A lista (V1) é o padrão, com a galeria (V2) como alternador na barra de filtros.'),
        suposicao('b', 'A Home mostra a atividade de um agente conectado e leva a uma revisão do que ele alterou.'),
        suposicao('c', 'No primeiro uso, o botão principal abre o projeto base (o exemplo), e "em branco" é a segunda opção.'),
      ], { name: 'Decisões em aberto', sizeX: 'fill', layout: { mode: 'column', gap: 4 } }),
      box([t('Crítica das duas versões (resumo da skill critique)', 15, 600, 'Texto claro'),
        t('V1 · Lista. Acerta na hierarquia (um botão âmbar, tabela escaneável), na densidade e na escala para 100+ projetos. Falha em: a faixa "Continuar" repete a primeira linha da tabela; o mesmo ícone em todas as linhas não ajuda a reconhecer o projeto; sem miniatura, o reconhecimento é só pelo nome.', 13, 400, 'Texto suave claro', { sizeX: 'fill', lineHeight: 1.6 }),
        t('V2 · Galeria. Acerta no reconhecimento visual e mostra a atividade do agente. Falha em: escala pior com muitos projetos (mais rolagem), depende de miniaturas reais e a grade ocupa espaço de uma lista que o usuário avançado prefere.', 13, 400, 'Texto suave claro', { sizeX: 'fill', lineHeight: 1.6 }),
        t('Recomendação: V1 como padrão, com alternador para a galeria; tirar da tabela o projeto que já está na faixa "Continuar"; usar miniatura pequena no lugar do ícone repetido (quando existir); levar a atividade do agente da V2 para a lateral da V1.', 13, 600, 'Texto claro', { sizeX: 'fill', lineHeight: 1.6 }),
      ], { name: 'Crítica', sizeX: 'fill', layout: { mode: 'column', gap: 12, padding: 20 } }),
      box([t('Como conversar comigo por aqui', 15, 600, 'Texto claro'), t('Responda os comentários (aba Comentários, ou o pino na camada). Eu leio com get_comments e respondo na mesma conversa. Notas (a aba Notas de cada camada) explicam o porquê de cada peça e não precisam de resposta.', 13, 400, 'Texto suave claro', { sizeX: 'fill', lineHeight: 1.6 })], { name: 'Como responder', sizeX: 'fill', layout: { mode: 'column', gap: 8, padding: 20 } }),
    ], { name: 'Conteúdo do brief', sizeX: 'fill', layout: { mode: 'column', gap: 32 } })], { note: 'Brief no formato da skill shape. Decisões marcadas como SUPOSIÇÃO esperam confirmação nos comentários.' }));
    for (const id of ['a', 'b', 'c']) {
      const [alvo] = await achaTodos(`Decisão (${id})`);
      await comentar(alvo.id, { a: 'Concorda que a lista é o padrão (com a galeria como alternador)? Ou prefere a galeria como padrão?', b: 'Quer que a Home mostre a atividade do agente e leve a uma revisão? Isso exige registrar as alterações por agente, que ainda não existe.', c: 'No primeiro uso, abrir o projeto base ou um projeto em branco?' }[id]);
    }
    return tela;
  },
};
Object.assign(PASSOS, PASSOS3);

const quais = process.argv[2] === 'tudo' ? Object.keys(PASSOS) : [process.argv[2]];
for (const q of quais) {
  if (!PASSOS[q]) throw new Error('passo desconhecido: ' + q + ' (use: ' + Object.keys(PASSOS).join(', ') + ')');
  const r = await PASSOS[q]();
  console.log(`${q}: criado ${r?.id ?? ''} (${r?.name ?? ''}, ${r?.w ?? '?'}×${r?.h ?? '?'})`);
}
