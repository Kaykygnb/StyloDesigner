/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  scripts/gerar-listas-google.mjs — GERA AS LISTAS DE FONTES E ÍCONES DO GOOGLE (src/data/*.js)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O app NÃO baixa o catálogo do Google a cada uso: as listas (só os nomes) ficam embutidas em src/data/,
 *  pequenas e funcionando até sem servidor. Os ARQUIVOS (a fonte em si, o desenho do ícone) é que são baixados
 *  na hora, direto do Google (fonts.googleapis.com / fonts.gstatic.com).
 *
 *  Rode de vez em quando para pegar fontes/ícones novos:
 *    1. Lista de fontes: o arquivo data/api-response.json do pacote npm "google-font-metadata"
 *         npm pack google-font-metadata && tar xzf google-font-metadata-*.tgz
 *    2. Lista de ícones: o arquivo .codepoints do repositório oficial google/material-design-icons
 *         https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL,GRAD,opsz,wght%5D.codepoints
 *    3. node scripts/gerar-listas-google.mjs <caminho/api-response.json> <caminho/arquivo.codepoints>
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [fontsJson, codepoints] = process.argv.slice(2);
if (!fontsJson || !codepoints) {
  console.error('uso: node scripts/gerar-listas-google.mjs <api-response.json> <arquivo.codepoints>');
  process.exit(1);
}
const out = (name) => fileURLToPath(new URL(`../src/data/${name}`, import.meta.url));

// ---------------------------------------------------------------- fontes
// As mais usadas primeiro (a lista do Google vem em ordem alfabética); o resto em ordem alfabética.
const POPULAR = ['Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Noto Sans', 'Raleway', 'Nunito',
  'Work Sans', 'DM Sans', 'Rubik', 'Outfit', 'Manrope', 'Plus Jakarta Sans', 'Space Grotesk', 'Figtree', 'Sora',
  'Playfair Display', 'Merriweather', 'Lora', 'Roboto Slab', 'Bebas Neue', 'Oswald', 'Anton', 'Lobster', 'Pacifico',
  'Dancing Script', 'Caveat', 'JetBrains Mono', 'Fira Code', 'Roboto Mono', 'Source Code Pro', 'IBM Plex Sans', 'Quicksand',
  'Mulish', 'Barlow', 'Kanit', 'Archivo', 'Josefin Sans', 'Libre Baskerville', 'Crimson Text', 'EB Garamond', 'Cormorant Garamond'];
// categoria do Google → rótulo curto em português
const CAT = { 'sans-serif': 'sans', serif: 'serif', display: 'display', handwriting: 'manuscrita', monospace: 'mono' };
const all = JSON.parse(readFileSync(fontsJson, 'utf8'));
/** Pesos disponíveis ("regular" = 400; "700italic" conta como 700). */
const weights = (variants) => [...new Set(variants.map((v) => (v === 'regular' || v === 'italic' ? 400 : parseInt(v, 10))).filter(Boolean))].sort((a, b) => a - b);
const fonts = all.map((f) => [f.family, CAT[f.category] || f.category, weights(f.variants).join(',')]);
const rank = (name) => { const i = POPULAR.indexOf(name); return i < 0 ? 1e9 : i; };
fonts.sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
writeFileSync(out('google-fonts.js'), `// GERADO por scripts/gerar-listas-google.mjs — não edite à mão.
// Fontes do Google Fonts: [nome, categoria, pesos disponíveis]. As mais usadas primeiro.
// ${fonts.length} fontes. Fonte: pacote npm google-font-metadata (data/api-response.json).
export const GOOGLE_FONTS = ${JSON.stringify(fonts)};
`);

// ---------------------------------------------------------------- ícones
const icons = [...new Set(readFileSync(codepoints, 'utf8').split('\n').map((l) => l.trim().split(' ')[0]).filter(Boolean))].sort();
writeFileSync(out('material-icons.js'), `// GERADO por scripts/gerar-listas-google.mjs — não edite à mão.
// Nomes dos Material Symbols (ícones do Google, licença Apache 2.0). O desenho de cada um é baixado na hora de
// fonts.gstatic.com. ${icons.length} ícones. Fonte: repositório google/material-design-icons (arquivo .codepoints).
export const MATERIAL_ICONS = ${JSON.stringify(icons.join(' '))}.split(' ');
`);
console.log(`✓ ${fonts.length} fontes e ${icons.length} ícones gerados em src/data/`);
