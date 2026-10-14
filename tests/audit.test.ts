// check_design: auditoria do design (contraste, texto pequeno, alt, vazamento da tela) e o get_image por breakpoint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditReport, auditStatic, overflowIssues } from '@stylo/core/audit.ts';
import { createNode, defaultFill, makeDoc } from '@stylo/core/model.js';
import { createRenderer } from '../apps/server/src/services/renderer.ts';

const solid = (hex: string, opacity = 1) => ({ ...defaultFill(hex), opacity });
const text = (name: string, color: string, fontSize = 16, extra: any = {}) => { const n: any = createNode('text', { name, text: 'x', fontSize, ...extra }); n.fill = solid(color); return n; };
const png = (b64: string) => Buffer.from(b64, 'base64');
const size = (buf: Buffer) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

test('auditStatic: contraste (normal e grande), texto pequeno, imagem sem alt; fundo vem do pai e translúcido/gradiente/imagem não geram falso alarme', () => {
  const board: any = createNode('frame', { name: 'Tela' });
  board.fill = solid('#1A1A1A');
  const claro = text('Claro sobre escuro', '#EEEEEE');                  // bom contraste
  const fraco = text('Cinza sobre escuro', '#333333');                  // ruim
  const grandeOk = text('Título grande', '#777777', 32);                 // 3:1 vale para texto grande
  const pequeno = text('Nota', '#FFFFFF', 10);
  const foto: any = createNode('rect', { name: 'Foto' }); foto.fill = { ...defaultFill(), type: 'image', assetId: 'a' };
  const fotoOk: any = createNode('rect', { name: 'Foto ok', alt: 'Plantas na janela' }); fotoOk.fill = { ...defaultFill(), type: 'image', assetId: 'a' };
  const sobreImagem: any = createNode('frame', { name: 'Hero' }); sobreImagem.fill = { ...defaultFill(), type: 'image', assetId: 'a' };
  sobreImagem.children.push(text('Texto sobre imagem', '#222222'));
  const oculto = text('Oculto', '#1A1A1A'); oculto.visible = false;
  board.children.push(claro, fraco, grandeOk, pequeno, foto, fotoOk, sobreImagem, oculto);
  const issues = auditStatic([board]);
  const by = (type: string) => issues.filter((i) => i.type === type).map((i) => i.layerName);
  assert.deepEqual(by('contraste'), ['Cinza sobre escuro'], 'só o cinza escuro falha; 3:1 basta para texto grande');
  assert.deepEqual(by('texto-pequeno'), ['Nota']);
  assert.deepEqual(by('sem-alt'), ['Foto']);
  assert.ok(!issues.some((i) => i.layerName === 'Oculto' || i.layerName === 'Texto sobre imagem'), 'oculto e texto sobre imagem não entram');
  const contrast = issues.find((i) => i.type === 'contraste')!;
  assert.match(contrast.message, /mínimo para texto normal é 4\.5:1/);
  assert.ok(contrast.fix.length > 10);
  // sem fundo definido, vale o branco do body exportado
  const solto: any = createNode('frame', { name: 'Sem fundo' }); solto.fill = { ...defaultFill(), type: 'none' };
  solto.children.push(text('Branco no branco', '#FEFEFE'));
  assert.deepEqual(auditStatic([solto]).map((i) => i.layerName), ['Branco no branco']);
});

test('overflowIssues: mensagem e conserto conforme o tipo da camada; auditReport põe erros primeiro e limita', () => {
  const t = createNode('text', { name: 'Título' }) as any;
  const f = createNode('frame', { name: 'Faixa', w: 1200 }) as any;
  const nodes = new Map([[t.id, t], [f.id, f]]);
  const items = [
    { nodeId: f.id, label: 'celular (390px)', width: 390, right: 1200, left: 0 },
    { nodeId: t.id, label: 'celular (390px)', width: 390, right: 520, left: 8 },
    { nodeId: 'sumiu', label: 'celular (390px)', width: 390, right: 999, left: 0 },
  ];
  const issues = overflowIssues(items, (id) => nodes.get(id));
  assert.equal(issues.length, 2, 'camada que não existe mais é ignorada');
  assert.match(issues[0].message, /“Faixa” tem largura fixa \(1200px\) e passa 810px/);
  assert.match(issues[0].fix, /sizeX:"fill"/);
  assert.match(issues[1].message, /“Título” passa 130px da tela pela direita .*não quebra linha/);
  const mixed = [{ ...issues[0], severity: 'aviso' as const }, issues[1]];
  assert.equal(auditReport(mixed).issues[0].severity, 'erro');
  const many = Array.from({ length: 80 }, () => issues[1]);
  assert.deepEqual([auditReport(many).issues.length, auditReport(many).truncated], [60, true]);
});

test('renderer.overflow: acha o texto que não quebra linha só na largura em que ele vaza, e devolve só o de cima da cadeia', async (t) => {
  const renderer = createRenderer();
  t.after(() => renderer.close());
  const doc = makeDoc();
  const board: any = createNode('frame', { name: 'Tela', w: 800, h: 100 }); board.sizeY = 'hug'; board.sizeX = 'fill'; board.fluid = true; board.layout.mode = 'column';
  const longo: any = createNode('text', { name: 'Longo', text: 'uma frase bem comprida que não quebra de jeito nenhum aqui', fontSize: 20 }); longo.sizeX = 'hug';
  board.children.push(longo);
  let found: any[];
  try { found = await renderer.overflow([board], doc, [{ rootId: board.id, label: 'desktop', width: 800 }, { rootId: board.id, label: 'celular', width: 300 }]); } catch (err: any) {
    if (/n[ãa]o est[áa] dispon[íi]vel/.test(err.message)) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
  assert.deepEqual(found.map((f) => [f.nodeId, f.label]), [[longo.id, 'celular']], 'a tela fluida cabe; só o texto vaza, e só no celular');
  assert.ok(found[0].right > 300);
  assert.deepEqual(await renderer.overflow([board], doc, []), []);
});

test('renderer.render com width (breakpoint): usa as regras @media e a altura que o navegador calculou', async (t) => {
  const renderer = createRenderer();
  t.after(() => renderer.close());
  const doc = makeDoc();
  const board: any = createNode('frame', { name: 'Tela', w: 800, h: 100 }); board.sizeY = 'hug'; board.sizeX = 'fill'; board.fluid = true;
  board.layout.mode = 'column';
  board.children.push(createNode('frame', { name: 'A', w: 100, h: 120 }));
  let out: string;
  try { out = await renderer.render(board, doc, 1, { width: 400 }); } catch (err: any) {
    if (/n[ãa]o est[áa] dispon[íi]vel/.test(err.message)) { t.skip('Chromium do Playwright não instalado'); return; }
    throw err;
  }
  const dims = size(png(out));
  assert.equal(dims.w, 400, 'a tela fluida ocupa a largura da janela do breakpoint');
  assert.equal(dims.h, 120, 'altura = a do conteúdo');
});

test('auditStatic: um h1 por tela, sem pular nível de título; alvos clicáveis < 24px; alt "" é decorativo (não é aviso)', () => {
  const board: any = createNode('frame', { name: 'Tela' });
  const h = (name: string, tag: string) => { const n: any = text(name, '#111111', 32, { tag }); return n; };
  board.children.push(h('Principal', 'h1'), h('Seção', 'h3'), h('Outro principal', 'h1'));
  const link: any = createNode('frame', { name: 'Link miúdo', tag: 'a', w: 20, h: 18 });
  const botao: any = createNode('frame', { name: 'Botão ok', tag: 'button', w: 120, h: 40 });
  const deco: any = createNode('rect', { name: 'Enfeite', alt: '' }); deco.fill = { ...defaultFill(), type: 'image', assetId: 'a' };
  board.children.push(link, botao, deco);
  const issues = auditStatic([board]);
  const by = (type: string) => issues.filter((i) => i.type === type);
  assert.equal(by('titulos').length, 2, 'um aviso de 2º h1 e um de nível pulado');
  assert.ok(by('titulos').some((i) => /2 títulos h1/.test(i.message)));
  assert.ok(by('titulos').some((i) => /é h3 logo depois de h1/.test(i.message)));
  assert.deepEqual(by('alvo-pequeno').map((i) => i.layerName), ['Link miúdo']);
  assert.deepEqual(by('sem-alt'), [], 'alt vazio = imagem decorativa declarada');
});

test('serviço de assets ausente: a ferramenta explica em vez de "Cannot read properties of undefined"', async () => {
  const { createPlugins } = await import('../apps/server/src/plugins.ts');
  const { builtinPlugins } = await import('@stylo/plugins/index.ts');
  const plugins = createPlugins({ plugins: builtinPlugins });
  const lib = plugins.get('library_list')!;
  await assert.rejects(async () => lib.run({}, { actor: { userId: 'u' } as any, project: null, services: plugins.services } as any), /serviço de assets não está ligado/);
});
