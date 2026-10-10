import { chromium } from 'playwright';

const APP = process.env.APP_URL || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ev = (fn, arg) => page.evaluate(fn, arg);
let failures = 0;
const ok = (name, value, detail = '') => { if (!value) failures++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}${value ? '' : ` — ${detail}`}`); };

await page.goto(new URL('?editor', APP).href);
await page.waitForFunction(() => window.designer?.store);
const ids = await ev(() => {
  const { createNode, defaultFill, uid } = window.__styloModel || {};
  // Vite modules are imported explicitly so the fixture uses the real document model.
  return Promise.resolve().then(async () => {
    const m = await import('/src/model.js');
    const s = designer.store;
    s.newDoc();
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 16;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#7655ff'; ctx.fillRect(0, 0, 32, 16);
    const assetId = m.uid(); s.addAsset(assetId, canvas.toDataURL('image/png'));
    const image = m.createNode('rect', { name: 'Marca do projeto', w: 120, h: 60, fill: { ...m.defaultFill(), type: 'image', assetId, fit: 'cover', natW: 32, natH: 16 } });
    const shape = m.createNode('rect', { name: 'Forma para testar', x: 150, w: 80, h: 48, fill: m.defaultFill('#eee') });
    s.update((p) => p.children.push(image, shape), { commit: true });
    s.setSelection([shape.id]);
    designer.canvas.fit([image.id, shape.id], { padding: 80, maxZoom: 1 });
    return { assetId, image: image.id, shape: shape.id };
  });
});
await page.getByRole('tab', { name: /Recursos/ }).click();
const card = page.locator('.image-asset-card');
await card.waitFor();
const initial = await ev(({ assetId, shape }) => ({
  count: Object.keys(designer.store.state.doc.assets).length,
  fill: designer.store.get(shape).fill,
  src: designer.store.state.doc.assets[assetId],
}), ids);
ok('biblioteca mostra uma prévia da imagem do projeto', await card.count() === 1 && await card.locator('img').evaluate((img) => img.complete && img.naturalWidth === 32));
ok('nome e uso da camada aparecem no cartão', (await card.innerText()).includes('Marca do projeto') && (await card.innerText()).includes('1 uso'));
await card.click();
await page.waitForFunction(({ shape, assetId }) => designer.store.get(shape)?.fill?.assetId === assetId, ids);
ok('clique aplica o asset à camada selecionada', await ev(({ shape, assetId }) => designer.store.get(shape).fill.assetId === assetId, ids));
await ev(() => designer.store.setSelection([]));
await card.click();
await page.waitForFunction(({ assetId, count }) => Object.keys(designer.store.state.doc.assets).length === count && designer.store.page().children.some((n) => n.fill?.assetId === assetId && n.name === 'Marca do projeto'), { assetId: ids.assetId, count: initial.count });
ok('sem seleção, clique insere uma camada e reaproveita o mesmo arquivo', await ev(({ assetId, count }) => Object.keys(designer.store.state.doc.assets).length === count && designer.store.page().children.filter((n) => n.fill?.assetId === assetId).length === 3, { assetId: ids.assetId, count: initial.count }));

const mcpInit = await fetch(new URL('mcp', APP), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Stylo-Agent': 'Teste biblioteca de imagens' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'asset-test', version: '1' } } }) });
const sid = mcpInit.headers.get('mcp-session-id');
let seq = 1;
const call = async (name, args) => {
  const r = await fetch(new URL('mcp', APP), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sid }, body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: 'tools/call', params: { name, arguments: args } }) });
  const j = await r.json(); const c = j.result?.content?.find((x) => x.type === 'text');
  return { error: !!j.result?.isError, data: c ? JSON.parse(c.text) : j };
};
const list = await call('list_assets', { query: 'marca' });
ok('MCP lista metadados sem expor data URL', !list.error && list.data.count === 1 && list.data.assets[0].id === ids.assetId && !JSON.stringify(list.data).includes('data:image'));
const pending = call('insert_asset', { id: ids.assetId, name: 'Marca inserida via MCP' });
await page.waitForSelector('.ask-modal');
const permission = page.locator('.ask-modal .ask-buttons button').filter({ hasText: 'Permitir' }).last();
await permission.click();
const inserted = await pending;
ok('MCP pede permissão antes de inserir a imagem', !inserted.error && inserted.data.assetId === ids.assetId && inserted.data.created.name === 'Marca inserida via MCP');
ok('camada do MCP reutiliza o asset e não duplica o arquivo', await ev(({ assetId }) => Object.keys(designer.store.state.doc.assets).length === 1 && designer.store.get(designer.store.ui.selection[0])?.fill?.assetId === assetId, ids));
await fetch(new URL('mcp', APP), { method: 'DELETE', headers: { 'Mcp-Session-Id': sid } });
ok('sem erros de JavaScript no editor', errors.length === 0, errors.join('; '));
await browser.close();
if (failures) process.exitCode = 1;
