// IA DE FOTO (ui/imageai.js + server/imageai.js): abre o editor de imagem pelo painel Design, ajusta, aplica filtro,
// desfaz/refaz dentro do editor, recorta, remove o fundo (automático + pincel), faz a edição GENERATIVA (preencher
// área e expandir) contra uma API de imagens FALSA criada aqui (não gasta crédito nem precisa de chave), redimensiona,
// aplica (Ctrl+Z do documento desfaz), restaura a original, mostra os erros (chave recusada, provedor sem API de
// imagem) e usa as ferramentas do agente edit_image e generate_image_edit. Devolve a configuração de imagem no fim.
// Capturas (1440×900) em capturas/ quando a pasta existir ou CAPTURAS=1.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.APP_URL || 'http://localhost:5173/';
const SHOTS = fileURLToPath(new URL('../../capturas/', import.meta.url));
if (process.env.CAPTURAS === '1') mkdirSync(SHOTS, { recursive: true });
const shoot = existsSync(SHOTS);
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
const url = (path) => new URL(path, BASE).href;
const putImageCfg = (body) => fetch(url('/api/imageai/config'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

// ---------------------------------------------------------------- PNG de cor sólida (sem dependências)
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function solidPng(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b, 255], y * (w * 4 + 1) + 1 + x * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const MAGENTA = solidPng(1024, 1024, [255, 0, 255]).toString('base64');

// ---------------------------------------------------------------- API de imagens FALSA (formato da OpenAI)
const calls = [];
let fakeMode = 'ok';
let holdNextImageResponse = false;
let releaseImageResponse = null;
let imageRequestStarted = null;
const fake = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const text = body.toString('latin1');
  const field = (name) => (new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(text) || [])[1];
  calls.push({
    path: req.url, auth: req.headers.authorization || '', type: req.headers['content-type'] || '',
    model: field('model') ?? (req.url.endsWith('generations') ? JSON.parse(text).model : undefined),
    prompt: field('prompt') ?? (req.url.endsWith('generations') ? JSON.parse(text).prompt : undefined),
    hasImage: text.includes('name="image"; filename='), hasMask: text.includes('name="mask"; filename='), size: field('size'),
  });
  if (holdNextImageResponse) {
    holdNextImageResponse = false;
    await new Promise((resolve) => { releaseImageResponse = resolve; imageRequestStarted?.(); });
  }
  if (fakeMode === '401') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } })); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ created: 1, data: [{ b64_json: MAGENTA }] }));
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const FAKE = `http://127.0.0.1:${fake.address().port}/v1`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on('dialog', (d) => { errors.push('diálogo nativo: ' + d.message()); d.dismiss(); });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (name) => { if (shoot) await page.waitForTimeout(300); if (shoot) await page.screenshot({ path: `${SHOTS}foto-ia-${name}.png` }); };
/** Cor (r,g,b,a) de um ponto (fração 0..1) da imagem atual de uma camada. */
const pixel = (id, fx, fy) => ev(async ({ id, fx, fy }) => {
  const n = designer.store.get(id);
  const img = new Image();
  img.src = designer.store.state.doc.assets[n.fill.assetId];
  await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return [...x.getImageData(Math.floor(fx * (c.width - 1)), Math.floor(fy * (c.height - 1)), 1, 1).data];
}, { id, fx, fy });
const fill = (id) => ev((id) => ({ ...designer.store.get(id).fill }), id);

try {
  await page.goto(url('?editor'));
  await page.getByRole('tab', { name: 'Design', exact: true }).waitFor();
  // projeto novo com UMA foto: fundo cinza-claro liso (com um pouco de ruído) e uma laranja no meio
  const id = await ev(async () => {
    const { createNode, defaultFill, uid } = await import('/src/model.js');
    const s = designer.store;
    s.newDoc();
    const c = document.createElement('canvas'); c.width = 600; c.height = 400;
    const x = c.getContext('2d');
    x.fillStyle = '#e9ecef'; x.fillRect(0, 0, 600, 400);
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(0,0,0,${(i % 7) / 300})`; x.fillRect((i * 97) % 600, (i * 53) % 400, 2, 2); }
    const g = x.createRadialGradient(280, 180, 10, 300, 200, 130);
    g.addColorStop(0, '#ffb347'); g.addColorStop(1, '#e8590c');
    x.fillStyle = g; x.beginPath(); x.arc(300, 200, 120, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2b8a3e'; x.beginPath(); x.ellipse(318, 72, 30, 13, -0.5, 0, Math.PI * 2); x.fill();
    const asset = uid();
    s.addAsset(asset, c.toDataURL('image/png'));
    const n = createNode('rect', { name: 'Foto da laranja', x: 80, y: 80, w: 480, h: 320, fill: { ...defaultFill(), type: 'image', assetId: asset, fit: 'cover', natW: 600, natH: 400 } });
    s.update((p) => p.children.push(n));
    s.setSelection([n.id]);
    s.commit();
    designer.canvas.fit([n.id], { padding: 120, maxZoom: 1 });
    return n.id;
  });
  const orig = (await fill(id)).assetId;
  await putImageCfg({ baseUrl: FAKE, model: 'falso-imagem' });

  // ---------------------------------------------------------------- 1. abrir pelo painel Design
  const editBtn = page.getByRole('button', { name: 'Editar imagem' });
  await editBtn.scrollIntoViewIfNeeded();
  await editBtn.click();
  await page.locator('.ia-editor').waitFor();
  ok('botão "Editar imagem" abre o editor em painel grande', await ev(() => { const r = document.querySelector('.ia-editor').getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight; }));
  ok('o editor por trás fica inerte', await ev(() => document.getElementById('app').inert === true));
  // estado do editor (o editor publica um resumo em data-state: ferramenta, tamanho, ajustes, % removido...)
  const st = () => ev(() => JSON.parse(document.querySelector('.ia-editor').dataset.state || '{}'));

  // ---------------------------------------------------------------- 2. ajustes
  await page.getByRole('slider', { name: 'Brilho' }).fill('30');
  await page.getByRole('slider', { name: 'Contraste' }).fill('20');
  let s = await st();
  ok('ajustes: brilho e contraste mudam ao vivo', s.adj?.brightness === 30 && s.adj?.contrast === 20, JSON.stringify(s));
  await shot('01-ajustes');

  // ---------------------------------------------------------------- 3. filtros + desfazer do editor
  await page.locator('.ia-tool', { hasText: 'Filtros' }).click();
  ok('filtros: miniatura de cada filtro', await page.locator('.ia-filter canvas').count() >= 8);
  await page.getByRole('button', { name: 'Filtro Vivo' }).click();
  ok('filtro aplicado', (await st()).filter === 'vivo');
  await shot('02-filtros');
  await page.keyboard.press('Control+z');
  ok('Ctrl+Z dentro do editor desfaz o filtro', (await st()).filter === 'none');
  await page.keyboard.press('Control+Shift+z');
  ok('Ctrl+Shift+Z refaz', (await st()).filter === 'vivo');

  // ---------------------------------------------------------------- 4. recortar
  await page.locator('.ia-tool', { hasText: 'Recortar' }).click();
  await page.getByRole('button', { name: 'Girar 90° à direita' }).click();
  s = await st();
  ok('girar 90°: 600 × 400 vira 400 × 600', s.w === 400 && s.h === 600, JSON.stringify(s));
  await page.getByRole('button', { name: 'Girar 90° à esquerda' }).click();
  const hFlip = (await st()).history;
  await page.getByRole('button', { name: 'Espelhar na horizontal' }).click();
  s = await st();
  ok('girar de volta e espelhar (cada um é um passo do desfazer)', s.w === 600 && s.h === 400 && s.history === hFlip + 1, JSON.stringify(s));
  await page.getByRole('button', { name: '1:1', exact: true }).click();
  ok('recorte 1:1 aparece sobre a foto', await page.locator('.ia-crop').isVisible());
  await shot('03-recortar');
  await page.getByRole('button', { name: 'Aplicar recorte' }).click();
  s = await st();
  ok('recorte aplicado: 400 × 400', s.w === 400 && s.h === 400, JSON.stringify(s));

  // ---------------------------------------------------------------- 5. remover fundo
  await page.locator('.ia-tool', { hasText: 'Remover fundo' }).click();
  await page.getByRole('button', { name: 'Remover fundo automaticamente' }).click();
  s = await st();
  ok('remover fundo automático tira o fundo liso (~70%)', s.removed > 0.5 && s.removed < 0.8, String(s.removed));
  await shot('04-remover-fundo');
  await page.getByRole('radio', { name: 'Pincel: restaurar' }).click();
  const box = await page.locator('.ia-view').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + 12, { steps: 8 });
  await page.mouse.up();
  const after = (await st()).removed;
  ok('pincel "restaurar" devolve parte do fundo', after < s.removed - 0.005, `${after} vs ${s.removed}`);
  await page.keyboard.press('Control+z');
  ok('Ctrl+Z desfaz a pincelada', Math.abs((await st()).removed - s.removed) < 1e-6);

  // ---------------------------------------------------------------- 6. IA generativa: preencher área
  await page.locator('.ia-tool', { hasText: 'IA generativa' }).click();
  await page.locator('.ia-status.ok').waitFor();
  ok('modelo de imagem configurado aparece', /falso-imagem/.test(await page.locator('.ia-status').innerText()));
  const vb = await page.locator('.ia-view').boundingBox();
  await page.mouse.move(vb.x + vb.width * 0.4, vb.y + vb.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(vb.x + vb.width * 0.6, vb.y + vb.height * 0.5, { steps: 6 });
  await page.mouse.up();
  ok('pincel marca a área a mudar', (await st()).painted === true);
  await page.getByRole('textbox', { name: 'Pedido para a IA' }).fill('troque o centro por um adesivo magenta');
  await shot('05-ia-pintar');
  const hist0 = (await st()).history;
  await page.getByRole('button', { name: 'Gerar' }).click();
  await page.waitForFunction((h) => JSON.parse(document.querySelector('.ia-editor').dataset.state).history > h, hist0, { timeout: 20000 });
  const call = calls.at(-1);
  ok('servidor chamou /images/edits com multipart (imagem, máscara, modelo, pedido)',
    call?.path === '/v1/images/edits' && /^multipart\/form-data; boundary=/.test(call.type) && call.hasImage && call.hasMask && call.model === 'falso-imagem' && /adesivo magenta/.test(call.prompt) && call.size === '1024x1024',
    JSON.stringify(call));
  ok('nenhuma chave vai para um endereço local sem chave', call.auth === '');
  await shot('06-ia-resultado');

  // ---------------------------------------------------------------- 7. expandir
  await page.getByRole('radio', { name: 'Expandir' }).click();
  await page.getByRole('button', { name: '+25% nos lados' }).click();
  await page.getByRole('button', { name: 'Gerar' }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('.ia-editor').dataset.state).w === 600, null, { timeout: 20000 });
  s = await st();
  ok('expandir: 400 → 600 px de largura, altura igual', s.w === 600 && s.h === 400, JSON.stringify(s));
  ok('expandir também usa /images/edits', calls.at(-1).path === '/v1/images/edits' && calls.at(-1).hasMask);

  // ---------------------------------------------------------------- 8. tamanho e formato
  await page.locator('.ia-tool', { hasText: 'Tamanho' }).click();
  await page.getByRole('button', { name: '400px' }).click();
  await page.getByRole('radio', { name: 'WebP' }).click();
  await page.waitForFunction(() => /KB/.test(document.querySelector('.ia-size-out strong')?.textContent || ''), null, { timeout: 10000 });
  const sizeText = await page.locator('.ia-size-out').innerText();
  ok('tamanho final mostrado (400 × 267 px · KB)', /400 × 267 px · \d+ KB/.test(sizeText), sizeText);
  await shot('07-tamanho');

  // ---------------------------------------------------------------- 9. aplicar + Ctrl+Z do documento
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await page.locator('.ia-editor').waitFor({ state: 'detached' });
  let f = await fill(id);
  ok('aplicar grava imagem NOVA e guarda a original', f.assetId !== orig && f.origAssetId === orig && f.natW === 400 && f.natH === 267, JSON.stringify({ ...f, stops: 0 }));
  ok('formato WebP', await ev((a) => designer.store.state.doc.assets[a].startsWith('data:image/webp'), f.assetId));
  ok('original continua em doc.assets', await ev((a) => !!designer.store.state.doc.assets[a], orig));
  const mid = await pixel(id, 0.5, 0.5);
  ok('centro veio da IA (magenta)', mid[0] > 200 && mid[1] < 90 && mid[2] > 200 && mid[3] > 200, String(mid));
  const keptCorner = await pixel(id, 0.2, 0.03);
  ok('canto da área original continua sem fundo (transparente)', keptCorner[3] < 40, String(keptCorner));
  const side = await pixel(id, 0.05, 0.5);
  ok('lateral expandida veio da IA', side[0] > 200 && side[2] > 200 && side[3] > 200, String(side));
  ok('o editor por trás volta a funcionar', await ev(() => document.getElementById('app').inert === false));
  await ev((id) => designer.store.setSelection([id]), id);
  await ev(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  ok('Ctrl+Z do documento volta para a imagem anterior', (await fill(id)).assetId === orig);
  await page.keyboard.press('Control+Shift+z');
  ok('Ctrl+Shift+Z refaz a edição', (await fill(id)).assetId === f.assetId);

  // ---------------------------------------------------------------- 10. restaurar original
  await editBtn.scrollIntoViewIfNeeded();
  await editBtn.click();
  await page.locator('.ia-editor').waitFor();
  await page.getByRole('button', { name: 'Restaurar original' }).click();
  await page.waitForFunction(({ id, o }) => designer.store.get(id)?.fill.assetId === o, { id, o: orig });
  f = await fill(id);
  ok('restaurar original volta a imagem e o tamanho', f.assetId === orig && !f.origAssetId && f.natW === 600, JSON.stringify({ a: f.assetId, o: f.origAssetId, w: f.natW }));
  await page.locator('.ia-editor').waitFor();
  ok('editor reabre com a original (600 × 400)', (await st()).w === 600);

  // ---------------------------------------------------------------- 11. erros claros
  fakeMode = '401';
  await page.locator('.ia-tool', { hasText: 'IA generativa' }).click();
  await page.locator('.ia-status.ok').waitFor();
  await page.getByRole('radio', { name: 'Trocar objeto' }).click();
  await page.getByRole('textbox', { name: 'Pedido para a IA' }).fill('uma variação da foto');
  await page.getByRole('button', { name: 'Gerar' }).click();
  await page.locator('.ia-error').waitFor({ timeout: 15000 });
  ok('chave recusada: mensagem clara', /recusou a chave/.test(await page.locator('.ia-error').innerText()));
  await shot('08-erro-chave');
  fakeMode = 'ok';
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('.ia-editor').waitFor({ state: 'detached' });
  ok('cancelar sem mudanças fecha sem perguntar', true);

  await putImageCfg({ baseUrl: 'https://integrate.api.nvidia.com/v1', model: '' });
  await editBtn.click();
  await page.locator('.ia-editor').waitFor();
  await page.locator('.ia-tool', { hasText: 'IA generativa' }).click();
  await page.locator('.ia-status.warn').waitFor();
  ok('provedor sem API de imagem: aviso com caminho das Configurações', /não tem API de imagem.*Modelo de imagem/s.test(await page.locator('.ia-status.warn').innerText()));
  ok('botão Gerar fica desligado', await page.getByRole('button', { name: 'Gerar' }).isDisabled());
  await shot('09-sem-modelo');
  await page.getByRole('button', { name: 'Abrir Configurações' }).click();
  await page.locator('.settings-page').waitFor();
  await page.getByText('Modelo de imagem', { exact: true }).first().scrollIntoViewIfNeeded();
  ok('Configurações → Agente de IA e modelos tem o cartão "Modelo de imagem"', await page.locator('.sp-card', { hasText: 'Modelo de imagem' }).count() === 1);
  await page.getByRole('textbox', { name: 'Endereço da API de imagem' }).fill(FAKE);
  await page.getByRole('textbox', { name: 'Modelo de imagem' }).fill('falso-imagem');
  await page.locator('.sp-card', { hasText: 'Modelo de imagem' }).getByRole('button', { name: 'Salvar' }).click();
  await page.locator('.sp-card', { hasText: 'Modelo de imagem' }).getByText(/Disponível: falso-imagem/).waitFor();
  ok('salvar endereço/modelo de imagem pelas Configurações', (await (await fetch(url('/api/imageai/config'))).json()).model === 'falso-imagem');
  await shot('10-configuracoes');
  await page.keyboard.press('Escape');
  await page.locator('.settings-page').waitFor({ state: 'detached' });

  // ---------------------------------------------------------------- 12. ferramentas do agente
  const run = (tool, args) => ev(({ tool, args }) => designer.agent.runner.run(tool, args, 'Teste', { admin: true }), { tool, args });
  const before = (await fill(id)).assetId;
  let r = await run('edit_image', { id, adjust: { brightness: 20 }, filter: 'pb', ratio: '1:1', max_width: 300, format: 'png' });
  f = await fill(id);
  ok('edit_image: recorta, filtra, ajusta e reduz (300 × 300 PNG)', r.ok && r.image.w === 300 && r.image.h === 300 && r.image.format === 'png' && f.origAssetId === before, JSON.stringify(r));
  const gray = await pixel(id, 0.5, 0.5);
  ok('edit_image: filtro P&B deixa cinza', Math.abs(gray[0] - gray[1]) < 4 && Math.abs(gray[1] - gray[2]) < 4, String(gray));
  r = await run('edit_image', { id, remove_background: true });
  ok('edit_image: remove o fundo', r.ok && r.background_removed_pct > 40, JSON.stringify(r));
  r = await run('edit_image', { id, restore_original: true });
  ok('edit_image: restore_original', r.ok && (await fill(id)).assetId === before, JSON.stringify(r));
  r = await run('edit_image', { id });
  ok('edit_image sem nada a fazer: erro claro', /Diga o que mudar/.test(r.error || ''), JSON.stringify(r));
  r = await run('generate_image_edit', { id, mode: 'fill', prompt: 'um adesivo', area: { x: 40, y: 40, w: 20, h: 20 } });
  ok('generate_image_edit usa o modelo de imagem e grava a imagem', r.ok && calls.at(-1).prompt === 'um adesivo' && (await fill(id)).assetId !== before, JSON.stringify(r));
  const center = await pixel(id, 0.5, 0.5), corner = await pixel(id, 0.05, 0.05);
  ok('generate_image_edit muda só a área pedida', center[0] > 200 && center[1] < 90 && !(corner[0] > 200 && corner[1] < 90), `${center} / ${corner}`);
  await page.keyboard.press('Control+z');
  ok('Ctrl+Z desfaz a edição do agente', (await fill(id)).assetId === before);

  // Uma resposta generativa atrasada não deve substituir uma imagem que a pessoa trocou enquanto aguardava.
  const requestStarted = new Promise((resolve) => { imageRequestStarted = resolve; });
  holdNextImageResponse = true;
  await editBtn.click();
  await page.locator('.ia-editor').waitFor();
  const pendingImageEdit = page.evaluate(({ id }) => designer.agent.runner.run('generate_image_edit', {
    id, mode: 'fill', prompt: 'resultado atrasado', area: { x: 40, y: 40, w: 20, h: 20 },
  }, 'Teste concorrência humana', { admin: true }), { id });
  await requestStarted;
  await page.getByRole('slider', { name: 'Brilho' }).fill('25');
  await page.locator('.ia-head-actions').getByRole('button', { name: 'Aplicar' }).click();
  await page.locator('.ia-editor').waitFor({ state: 'detached' });
  const humanAssetId = (await fill(id)).assetId;
  releaseImageResponse();
  const staleImageResult = await pendingImageEdit;
  ok('imagem editada pela pessoa durante a geração não é substituída por resposta antiga',
    /imagem desta camada mudou/.test(staleImageResult.error || '') && (await fill(id)).assetId === humanAssetId,
    JSON.stringify({ error: staleImageResult.error, current: (await fill(id)).assetId, humanAssetId }));
  await page.keyboard.press('Control+z');
  imageRequestStarted = null;

  await putImageCfg({ baseUrl: 'https://integrate.api.nvidia.com/v1', model: '' });
  r = await run('generate_image_edit', { id, mode: 'fill', prompt: 'x', area: { x: 0, y: 0, w: 10, h: 10 } });
  ok('generate_image_edit sem modelo de imagem: erro claro', /não tem API de imagem/.test(r.error || ''), JSON.stringify(r));
  r = await run('edit_image', { id: 'nao-existe', filter: 'pb' });
  ok('edit_image em camada inexistente: erro claro', /não existe/.test(r.error || ''));

  ok('nenhum erro no console', errors.length === 0, errors.join(' | '));
} catch (err) {
  fails++;
  console.log('FAIL exceção: ' + (err.stack || err.message));
  if (errors.length) console.log('  erros da página: ' + errors.join(' | '));
  console.log('  janela: ' + (await page.locator('.modal-backdrop').evaluateAll((els) => els.map((e) => e.outerHTML.slice(0, 400)).join(' | ')).catch(() => '')));
  console.log('  avisos: ' + (await page.locator('.toast').allInnerTexts().catch(() => [])).join(' | '));
  await shot('erro').catch(() => {});
} finally {
  await putImageCfg({ baseUrl: '', model: '' }).catch(() => {});
  await browser.close();
  fake.close();
}
console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo.');
process.exitCode = fails ? 1 : 0;
