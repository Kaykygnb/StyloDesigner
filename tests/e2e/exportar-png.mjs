// Exportar PNG: a imagem é um SVG com <foreignObject> (XHTML), que exige XML bem formado. Camadas de "Código HTML"
// com <br>, <hr>, <img>, <input>, entidades (&copy;) e CSS com < & > precisam renderizar em vez de falhar.
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failures = 0;
const ok = (name, value, detail = '') => { if (!value) failures++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}${!value && detail ? ` — ${detail}` : ''}`); };

try {
  await page.goto(new URL('?editor', process.env.APP_URL || 'http://localhost:5173/').href);
  await page.waitForFunction(() => window.designer?.store);
  const results = await page.evaluate(async () => {
    const m = await import('/src/model.js');
    const ex = await import('/src/export.js');
    const html = (h, extra = {}) => m.createNode('html', { name: 'cod', w: 240, h: 90, html: h, ...extra });
    const cases = {
      'texto com & < >': m.createNode('text', { name: 't', text: 'A & B < C > D', w: 200, h: 40 }),
      'br e entidades (&copy; &nbsp;)': html('<p>linha<br>outra &copy; 2026 &nbsp; fim</p>'),
      'img sem fechar e hr': html('<img src="data:image/png;base64,iVBORw0KGgo=" alt="x"><hr>'),
      'input e botão': html('<input type="text" value="oi" disabled><button>Ok</button><p>ok</p>'),
      'tabela e lista': html('<table><tr><td>a</td><td>b &amp; c</td></tr></table><ul><li>um<li>dois</ul>'),
      'CSS da camada com aspas e &': html('<p class="x">oi</p>', { customCss: 'font-family: "A & B", sans-serif; content: "<>";' }),
    };
    const out = {};
    for (const [name, node] of Object.entries(cases)) {
      try {
        const blob = await ex.renderPng(node, {}, 1, null);
        const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 4);
        out[name] = { ok: blob.size > 100 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47, size: blob.size };
      } catch (e) { out[name] = { ok: false, erro: e.message }; }
    }
    return out;
  });
  for (const [name, r] of Object.entries(results)) ok(`PNG: ${name}`, r.ok, r.erro || `tamanho ${r.size}`);
  ok('sem erros no navegador', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
