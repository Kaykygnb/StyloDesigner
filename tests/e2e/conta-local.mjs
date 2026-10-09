// Conta local: migra o nome antigo (prefs.author) para a conta do servidor, salva o perfil sozinho na página de
// Configurações, mantém prefs.author/authorColor em dia (comentários e presença) e mostra logo + avatar no topo.
import { chromium } from 'playwright';
const APP = process.env.APP_URL || 'http://localhost:5173/';
const api = (body) => fetch(new URL('/api/account', APP), body ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined).then((r) => r.json());
const original = await api();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };
try {
  await api({ name: '', email: '', role: '', avatar: '', color: '#4c8dff' });
  // navegador "antigo": só tinha o nome nas preferências
  // (grava as preferências numa página do mesmo endereço que NÃO é o app, para o app não sobrescrevê-las)
  await page.goto(new URL('assets/logo-mark.svg', APP).href);
  await page.evaluate(() => { const k = 'projeto-designer:prefs'; const v = JSON.parse(localStorage.getItem(k) || '{}'); v.author = 'Ana Lima'; v.authorColor = '#5cc98f'; localStorage.setItem(k, JSON.stringify(v)); });
  await page.goto(new URL('?editor', APP).href);
  await page.waitForTimeout(900);
  const acc = await api();
  ok('nome antigo do navegador migra para a conta do servidor', acc.name === 'Ana Lima' && acc.color === '#5cc98f' && !!acc.createdAt, JSON.stringify(acc));
  ok('topo mostra a logo, o nome Stylo e o nome do projeto', (await page.locator('.topbar .brand img.logo-img').count()) === 1 && (await page.locator('.topbar .brand-name').innerText()) === 'Stylo' && (await page.locator('.topbar .doc-name').count()) === 1);
  ok('avatar do topo usa as iniciais da conta', (await page.locator('.topbar .acc-btn .acc-avatar').innerText()) === 'AL');
  await page.click('.acc-btn');
  const items = await page.locator('.menu .menu-item').allInnerTexts();
  ok('menu da conta: Minha conta, Configurações, Central de ajuda', ['Minha conta', 'Configurações', 'Central de ajuda'].every((t) => items.some((i) => i.includes(t))), items.join('|'));
  await page.locator('.menu .menu-item', { hasText: 'Minha conta' }).click();
  await page.waitForSelector('#settings-account:not([hidden]) input[aria-label="Nome"]');
  ok('"Minha conta" abre a página na seção Conta', (await page.inputValue('#settings-account input[aria-label="Nome"]')) === 'Ana Lima');
  await page.fill('#settings-account input[aria-label="Nome"]', 'Ana Souza');
  await page.fill('#settings-account input[aria-label="Cargo ou função"]', 'Designer');
  await page.fill('#settings-account input[aria-label="E-mail"]', 'ana@exemplo.com');
  await page.waitForSelector('.sp-saved[data-state="saved"]');
  const saved = await api();
  ok('perfil é salvo sozinho (indicador "Salvo")', saved.name === 'Ana Souza' && saved.role === 'Designer' && saved.email === 'ana@exemplo.com', JSON.stringify(saved));
  await page.fill('#settings-account input[aria-label="E-mail"]', 'invalido');
  await page.waitForSelector('.sp-saved[data-state="error"]');
  ok('e-mail inválido mostra o erro e não grava', (await page.locator('.sp-saved').innerText()).includes('E-mail') && (await api()).email === 'ana@exemplo.com');
  await page.fill('#settings-account input[aria-label="E-mail"]', '');
  await page.click('.sp-color[aria-label="Cor #ff7a90"]');
  await page.waitForTimeout(300);
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('projeto-designer:prefs') || '{}'));
  ok('prefs.author/authorColor acompanham a conta (comentários e presença)', prefs.author === 'Ana Souza' && prefs.authorColor === '#ff7a90', JSON.stringify(prefs));
  await page.keyboard.press('Escape');
  ok('Esc volta ao editor e o avatar mostra as novas iniciais', (await page.locator('.settings-page').count()) === 0 && (await page.locator('.topbar .acc-avatar').innerText()) === 'AS');
  ok('favicon é a logo', (await page.getAttribute('link[rel=icon]', 'href')) === 'assets/logo-mark.svg');
  ok('sem erros no console', errors.length === 0, errors.join(' | '));
} catch (err) {
  ok('cenário terminou sem exceção', false, err.stack);
} finally {
  await api({ name: original.name, email: original.email, role: original.role, avatar: original.avatar, color: original.color, language: original.language });
  await browser.close();
}
console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
process.exit(fails ? 1 : 0);
