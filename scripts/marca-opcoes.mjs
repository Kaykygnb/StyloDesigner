/**
 * Gera as 3 direções de marca do Stylo para a pessoa escolher: capturas do EDITOR REAL com cada acento aplicado por
 * sobreposição de variáveis (nada é gravado no projeto), uma prancha com os símbolos e a tabela de contraste WCAG.
 *
 * Uso: APP_URL=http://localhost:5190/ node scripts/marca-opcoes.mjs   (servidor isolado). Saída: docs/screenshots/identidade/marca-*.png
 * e docs/estado/MARCA.md (tabela de contraste).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildSampleShowcase } from '../src/sample-vitrine.js';

const OUT = 'docs/screenshots/identidade';
mkdirSync(OUT, { recursive: true });

// ---- contraste WCAG 2.x
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const OPTIONS = {
  A: {
    nome: 'Âmbar', ideia: 'Grafite quente com um único âmbar: ferramenta de oficina, sem azul de software genérico.',
    dark: { bg: '#131211', panel: '#1a1917', 'panel-2': '#23211f', 'panel-3': '#2d2a27', border: '#2c2a27', text: '#ece9e4', muted: '#a39e96', canvas: '#0f0e0d', accent: '#e9a23b', 'on-accent': '#1a1206' },
    light: { bg: '#f5f3ef', panel: '#ffffff', 'panel-2': '#f1eee9', 'panel-3': '#e6e1da', border: '#e4dfd7', text: '#1d1b18', muted: '#625d55', canvas: '#ebe7e0', accent: '#9a5b00', 'on-accent': '#ffffff' },
    mark: (c, c2) => `<rect x="5" y="5" width="17" height="17" rx="3.5" fill="none" stroke="${c}" stroke-width="2.6"/><rect x="10.5" y="10.5" width="17" height="17" rx="3.5" fill="${c2}"/>`,
    markNome: 'Camadas: dois blocos deslocados (o de trás só contorno)',
  },
  B: {
    nome: 'Mar', ideia: 'Grafite frio com verde-azulado: calmo, técnico, longe do roxo e do azul-padrão.',
    dark: { bg: '#111517', panel: '#171c1f', 'panel-2': '#1f2529', 'panel-3': '#293136', border: '#263035', text: '#e6edf0', muted: '#93a1a8', canvas: '#0d1113', accent: '#3cc2ae', 'on-accent': '#04201b' },
    light: { bg: '#f2f6f7', panel: '#ffffff', 'panel-2': '#eef3f4', 'panel-3': '#e0e8ea', border: '#dbe4e6', text: '#14201f', muted: '#52646a', canvas: '#e7eeef', accent: '#0b7a6b', 'on-accent': '#ffffff' },
    mark: (c, c2) => `<path d="M10 5H6.5v22H10" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="9" width="14" height="3.6" rx="1.8" fill="${c2}"/><rect x="13" y="14.2" width="9" height="3.6" rx="1.8" fill="${c}"/><rect x="13" y="19.4" width="12" height="3.6" rx="1.8" fill="${c2}"/>`,
    markNome: 'Regra: colchete e três linhas de larguras diferentes (auto layout)',
  },
  C: {
    nome: 'Lima', ideia: 'Neutro puro com lima ácida: marcante, de ferramenta de design, nada de gradiente.',
    dark: { bg: '#121212', panel: '#181818', 'panel-2': '#212121', 'panel-3': '#2b2b2b', border: '#2a2a2a', text: '#ececec', muted: '#9d9d9d', canvas: '#0e0e0e', accent: '#c3e84b', 'on-accent': '#121700' },
    light: { bg: '#f4f4f1', panel: '#ffffff', 'panel-2': '#efefeb', 'panel-3': '#e3e3de', border: '#e0e0da', text: '#1a1a17', muted: '#5c5c55', canvas: '#eaeae5', accent: '#4d6b00', 'on-accent': '#ffffff' },
    mark: (c, c2) => `<path d="M7 6h18v5.5H13v2.7h9.5v5.4H7z" fill="${c}"/><path d="M19 13.8h6V26H7v-5.4h12z" fill="${c2}"/>`,
    markNome: 'S de blocos encaixados, sem o quadrado de aplicativo',
  },
};

const pairs = (t) => [
  ['texto sobre o painel', t.text, t.panel, 4.5],
  ['texto secundário sobre o painel', t.muted, t.panel, 4.5],
  ['texto secundário sobre o campo (panel-2)', t.muted, t['panel-2'], 4.5],
  ['acento como texto/ícone sobre o painel', t.accent, t.panel, 4.5],
  ['texto do botão primário sobre o acento', t['on-accent'], t.accent, 4.5],
  ['acento sobre o fundo (componente, mínimo 3)', t.accent, t.bg, 3],
];

let md = '# Direções de marca (geradas por `scripts/marca-opcoes.mjs`)\n\nContraste WCAG 2.x medido com os valores reais. Meta: ≥ 4,5 para texto e ≥ 3 para componentes.\n';
for (const [id, o] of Object.entries(OPTIONS)) {
  md += `\n## Opção ${id} — ${o.nome}\n${o.ideia}\n\nSímbolo: ${o.markNome}.\n\n`;
  for (const theme of ['dark', 'light']) {
    md += `**Tema ${theme === 'dark' ? 'escuro' : 'claro'}** (acento \`${o[theme].accent}\`, texto do botão \`${o[theme]['on-accent']}\`)\n\n| Par | Razão | Meta | Resultado |\n|---|---|---|---|\n`;
    for (const [nome, fg, bg, meta] of pairs(o[theme])) { const r = ratio(fg, bg); md += `| ${nome} | ${r.toFixed(2)} | ${meta} | ${r >= meta ? 'passa' : '**falha**'} |\n`; }
    md += '\n';
  }
}
md += `
## Minha recomendação (opinião do engenheiro, a decisão é sua)

**Paleta A (Âmbar) com o símbolo B (colchete e três linhas).** Motivos: (1) o âmbar não é azul nem roxo, que são as cores padrão de software e de "IA"; (2) o grafite quente reduz a fadiga em sessões longas e deixa o design do usuário (frio, colorido) se destacar na tela; (3) o colchete com linhas de larguras diferentes diz o que o produto é, CSS real e auto layout, sem clichê de raio, pincel ou varinha; (4) funciona em 16 px (aba do navegador) e sem o quadrado escuro de aplicativo. A **C (Lima)** é a mais ousada, mas o verde-oliva escuro do tema claro fica pesado; a **B (Mar)** é a mais neutra e segura. Qualquer combinação entre paleta e símbolo é possível (os símbolos são independentes).

Para aplicar: dizer a letra da paleta e a letra do símbolo (por exemplo, "A + B"). Aplicação = trocar os valores do :root em src/styles/app.css, assets/logo-mark.svg, assets/logo.svg e o ícone da aba.
`;
writeFileSync('docs/estado/MARCA.md', md);
console.log('docs/estado/MARCA.md escrito');

// ---- capturas do editor real com a sobreposição
const base = process.env.APP_URL || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(new URL('?editor', base).href);
await page.waitForFunction(() => window.designer?.store);
const wait = (ms = 450) => page.waitForTimeout(ms);

const css = (o) => ['dark', 'light'].map((theme) => {
  const t = o[theme];
  const sel = `html:root[data-theme="${theme}"]`;
  const vars = Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(' ');
  return `${sel} { ${vars} --primary: ${t.accent}; --glass: ${t.panel}f7; --code-bg: ${t.canvas}; }`;
}).join('\n');
const svg = (o, theme) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${o.mark(o[theme].accent, theme === 'dark' ? o.dark.text : o.light.text)}</svg>`;

for (const [id, o] of Object.entries(OPTIONS)) {
  for (const theme of ['dark', 'light']) {
    await page.evaluate(async ({ doc, theme, css, logo }) => {
      document.getElementById('marca-opcao')?.remove();
      const st = document.createElement('style'); st.id = 'marca-opcao'; st.textContent = css; document.head.appendChild(st);
      const s = designer.store; s.setTheme(theme); s.setBp(null); s.setMode(null);
      s.loadDoc(doc, { pristine: true }); s.ui.showNotes = false; s.ui.showGrids = false; s.setSelection([]);
      document.querySelectorAll('img.logo-img').forEach((i) => { i.src = 'data:image/svg+xml,' + encodeURIComponent(logo); });
      const site = s.page().children[0].children[0];
      const b = designer.canvas.aabb(site.id); const r = designer.canvas.vpRect();
      designer.canvas.setView({ zoom: 0.6, x: (r.width - b.w * 0.6) / 2 - b.x * 0.6, y: 60 - b.y * 0.6 });
      let hero; (function w(l) { l.forEach((x) => { if (x.name === 'Hero' && !hero) hero = x.id; if (x.children) w(x.children); }); })(s.page().children);
      s.setSelection([hero]);
    }, { doc: buildSampleShowcase(), theme, css: css(o), logo: svg(o, theme) });
    await wait(700);
    await page.screenshot({ path: `${OUT}/marca-${id}-${o.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}-${theme}.png` });
    console.log(`marca-${id}-${o.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}-${theme}.png`);
  }
}

// ---- prancha dos símbolos (grande e pequeno, claro e escuro)
const board = `<body style="margin:0;font:13px system-ui;background:#fff">${['dark', 'light'].map((theme) => {
  const bg = theme === 'dark' ? '#131313' : '#f6f6f3'; const fg = theme === 'dark' ? '#ddd' : '#222';
  return `<div style="background:${bg};color:${fg};padding:28px 32px;display:flex;gap:56px;align-items:flex-end">${Object.entries(OPTIONS).map(([id, o]) => `<div style="text-align:center"><div style="width:120px;height:120px">${svg(o, theme).replace('<svg ', '<svg width="120" height="120" ')}</div><div style="margin-top:10px;font-weight:600">${id} · ${o.nome}</div><div style="display:flex;gap:14px;justify-content:center;margin-top:10px;align-items:center">${[48, 24, 16].map((n) => svg(o, theme).replace('<svg ', `<svg width="${n}" height="${n}" `)).join('')}</div></div>`).join('')}</div>`;
}).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 760, height: 540 } });
await p2.setContent(board);
await p2.screenshot({ path: `${OUT}/marca-simbolos.png` });
console.log('marca-simbolos.png');
await browser.close();
