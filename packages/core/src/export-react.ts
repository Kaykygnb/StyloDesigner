// EXPORTAÇÃO PARA REACT: transforma o site (uma prancheta = uma página) num projeto Vite + React pronto para rodar.
// Parte do MESMO site que exportSite gera (HTML, CSS, imagens, fontes, créditos) e o reorganiza em componentes:
//   - cada página vira um componente (src/pages/Nome.jsx) com seu CSS Module (Nome.module.css: as classes de uma
//     página nunca colidem com as de outra);
//   - o reset, as fontes hospedadas e os tokens do design ficam em src/styles/;
//   - imagens e fontes vão para public/ ; 3D (model-viewer) e Lottie entram como dependências do npm (nada de CDN);
//   - o App tem uma navegação mínima por # (sem biblioteca de rotas), para os links entre páginas funcionarem.
// Pura (sem DOM, sem disco): devolve a lista de arquivos, como exportSite.
import { exportSite, type SiteFile } from './site-export.ts';
import { EXPORT_RESET } from './css.js';
import { exportTokens } from './tokens.ts';
import { cssClasses, htmlToJsx } from './html-to-jsx.ts';
import { slugify } from './model.js';

const pascal = (s: string) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Pagina';

/** url(assets/x.png) → url(/assets/x.png): o Vite serve public/ na raiz. */
const rootUrls = (css: string) => css.replace(/url\((["']?)(assets|fonts)\//g, 'url($1/$2/');

const LOTTIE_EFFECT = `  const root = useRef(null);
  useEffect(() => {
    const animations = [...root.current.querySelectorAll('[data-lottie-src]')].map((el) => lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      path: el.getAttribute('data-lottie-src'),
      loop: el.hasAttribute('data-loop'),
      autoplay: el.hasAttribute('data-autoplay'),
    }));
    return () => animations.forEach((a) => a.destroy());
  }, []);
`;

interface Page { stem: string; route: string; name: string; file: SiteFile; html: string }

export function exportReact(doc: any): { files: SiteFile[]; warnings: string[] } {
  const site = exportSite(doc, { mediaRuntime: false });
  const warnings = [...site.warnings];
  const htmlFiles = site.files.filter((f) => f.path.endsWith('.html') && typeof f.content === 'string');
  const rest = site.files.filter((f) => !htmlFiles.includes(f));

  // páginas: rota e nome de componente únicos
  const taken = new Set<string>();
  const pages: Page[] = htmlFiles.map((file) => {
    const stem = file.path.replace(/\.html$/, '');
    let name = stem === 'index' ? 'Home' : pascal(stem);
    while (taken.has(name)) name += '2';
    taken.add(name);
    return { stem, route: stem === 'index' ? '/' : `/${stem}`, name, file, html: file.content as string };
  });
  const routeOf = new Map(pages.map((p) => [p.stem.toLowerCase(), p.route]));

  const rewriteUrl = (name: string, value: string) => {
    if (['src', 'poster', 'href', 'data-lottie-src'].includes(name) && /^(assets|fonts)\//.test(value)) return `/${value}`;
    if (name === 'href') {
      const m = /^([^:/#?]+)\.html([?#].*)?$/i.exec(value);
      const route = m && routeOf.get(m[1].toLowerCase());
      if (route) return `#${route}`;
    }
    return value;
  };

  const out: SiteFile[] = [];
  const headLinks = new Set<string>();
  let fontsCss = '';
  let usesLottie = false, usesModel = false;

  for (const page of pages) {
    const blocks = [...page.html.matchAll(/<style(?: id="([^"]*)")?>\n?([\s\S]*?)\n?<\/style>/g)];
    const fonts = blocks.find((b) => b[1] === 'fontes-do-projeto');
    if (fonts && !fontsCss) fontsCss = rootUrls(fonts[2]);
    const css = rootUrls(blocks.filter((b) => b !== fonts).map((b) => b[2]).join('\n\n').replace(EXPORT_RESET, '').trim());
    for (const l of page.html.matchAll(/<link [^>]*>/g)) headLinks.add(l[0]);
    const bodyMatch = /<body[^>]*>\n?([\s\S]*?)\n?<\/body>/.exec(page.html);
    const body = (bodyMatch?.[1] ?? '').trim();
    const lottie = body.includes('data-lottie-src');
    const model = body.includes('<model-viewer');
    usesLottie ||= lottie; usesModel ||= model;

    let jsx: string;
    let modular = true;
    try {
      jsx = htmlToJsx(body, { moduleClasses: cssClasses(css), rootAttr: lottie ? 'ref={root}' : undefined, rewriteUrl }, 2);
    } catch (error) {
      modular = false; // sem conversão: o HTML entra como está e o CSS fica global (as classes continuam valendo)
      warnings.push(`A página “${page.stem}” tem HTML que não consegui converter para JSX (${(error as Error).message}); ela entra como HTML bruto em ${page.name}.jsx.`);
      jsx = `      <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(body.replace(/(src|poster|href)="(assets|fonts)\//g, '$1="/$2/'))} }} />`;
    }
    const imports = [
      lottie ? "import { useEffect, useRef } from 'react';" : null,
      lottie ? "import lottie from 'lottie-web';" : null,
      model ? "import '@google/model-viewer';" : null,
      modular ? `import styles from './${page.name}.module.css';` : `import './${page.name}.css';`,
    ].filter(Boolean);
    out.push({
      path: `src/pages/${page.name}.jsx`,
      content: `${imports.join('\n')}\n\nexport default function ${page.name}() {\n${lottie ? LOTTIE_EFFECT + '\n' : ''}  return (\n${jsx}\n  );\n}\n`,
    });
    out.push({ path: modular ? `src/pages/${page.name}.module.css` : `src/pages/${page.name}.css`, content: css + '\n' });
  }

  // estilos globais
  const tokens = exportTokens(doc, 'css')[0]?.content ?? '';
  out.push({ path: 'src/styles/reset.css', content: `${EXPORT_RESET}\nbody { min-height: 100vh; background: #fff; }\n` });
  if (fontsCss) out.push({ path: 'src/styles/fonts.css', content: fontsCss + '\n' });
  if (tokens.trim()) out.push({ path: 'src/styles/tokens.css', content: tokens });

  // aplicação
  const first = pages.find((p) => p.route === '/') ?? pages[0];
  out.push({
    path: 'src/App.jsx',
    content: `import { useEffect, useState } from 'react';
${pages.map((p) => `import ${p.name} from './pages/${p.name}.jsx';`).join('\n')}

// Navegação mínima por # (ex.: /#/sobre). Troque por React Router quando precisar de mais.
const routes = {
${pages.map((p) => `  '${p.route}': ${p.name},`).join('\n')}
};

const current = () => window.location.hash.replace(/^#/, '') || '/';

export default function App() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const onChange = () => setPath(current());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const Page = routes[path] ?? ${first ? first.name : '(() => null)'};
  return <Page />;
}
`,
  });
  out.push({
    path: 'src/main.jsx',
    content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/reset.css';
${fontsCss ? "import './styles/fonts.css';\n" : ''}${tokens.trim() ? "import './styles/tokens.css';\n" : ''}import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  });

  const metadata = doc.site || {};
  const safe = (value: unknown) => String(value ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c));
  const title = safe(metadata.title || doc.name || 'Projeto');
  const description = safe(metadata.description || '');
  const lang = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(String(metadata.lang || 'pt-BR')) ? String(metadata.lang || 'pt-BR') : 'pt-BR';
  const canonical = /^https:\/\//.test(String(metadata.canonical || '')) ? safe(metadata.canonical) : '';
  const image = /^(https:\/\/|data:image\/)/.test(String(metadata.image || '')) ? safe(metadata.image) : '';
  const favicon = /^(https:\/\/|data:image\/)/.test(String(metadata.favicon || '')) ? safe(metadata.favicon) : '';
  const meta = [
    `    <meta name="description" content="${description}" />` ,
    `    <meta property="og:description" content="${description}" />`,
    `    <meta property="og:title" content="${title}" />`,
    image ? `    <meta property="og:image" content="${image}" />` : '',
    canonical ? `    <link rel="canonical" href="${canonical}" />` : '',
    favicon ? `    <link rel="icon" href="${favicon}" />` : '',
  ].filter(Boolean).join('\n');
  out.push({
    path: 'index.html',
    content: `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
${meta}${meta ? '\n' : ''}${[...headLinks].map((l) => `    ${l}`).join('\n')}${headLinks.size ? '\n' : ''}  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  });
  const dependencies: Record<string, string> = { react: '^18.3.1', 'react-dom': '^18.3.1' };
  if (usesLottie) dependencies['lottie-web'] = '^5.13.0';
  if (usesModel) dependencies['@google/model-viewer'] = '^4.0.0';
  out.push({
    path: 'package.json',
    content: JSON.stringify({
      name: slugify(doc.name || 'projeto') || 'projeto', private: true, version: '0.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies,
      devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^5.4.11' },
    }, null, 2) + '\n',
  });
  out.push({ path: 'vite.config.js', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n" });
  out.push({ path: '.gitignore', content: 'node_modules\ndist\n' });
  out.push({
    path: 'README.md',
    content: `# ${title}

Projeto React (Vite) gerado pelo Stylo.

\`\`\`bash
npm install
npm run dev     # desenvolvimento
npm run build   # versão final em dist/
\`\`\`

- Páginas: ${pages.map((p) => `\`src/pages/${p.name}.jsx\` (${p.route === '/' ? 'inicial' : `#${p.route}`})`).join(', ') || '—'}.
- Cada página tem seu CSS Module (\`*.module.css\`): as classes não colidem entre páginas.
- \`src/styles/\`: reset, fontes hospedadas e tokens do design (cores, textos, tamanhos${tokens.trim() ? '' : ' — este projeto ainda não tem'}).
- \`public/\`: imagens (\`assets/\`) e fontes (\`fonts/\`), servidas na raiz do site.
- Os créditos dos assets estão em \`CREDITS.txt\`, \`CREDITS.md\` e \`THIRD-PARTY-NOTICES\` (se houver): mantenha-os no site publicado.
`,
  });

  // arquivos do site que continuam: imagens/mídia/fontes vão para public/, créditos na raiz
  for (const f of rest) {
    if (/^(assets|fonts)\//.test(f.path)) out.push({ path: `public/${f.path}`, content: f.content });
    else if (f.path === 'CREDITS.txt' || f.path === 'CREDITS.md' || f.path === 'THIRD-PARTY-NOTICES') out.push(f);
  }
  return { files: out, warnings: [...new Set(warnings)] };
}
