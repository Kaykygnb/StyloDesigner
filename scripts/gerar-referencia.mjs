/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  scripts/gerar-referencia.mjs — GERA docs/REFERENCIA.md A PARTIR DOS COMENTÁRIOS DO CÓDIGO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Lê cada arquivo de src/ (e o server.js), pega o comentário de cabeçalho do arquivo e os comentários
 *  `/** ... *\/` que ficam logo ACIMA de cada função ou constante, e monta uma referência em Markdown:
 *  arquivo por arquivo, o que cada função faz, seus parâmetros e o link para a linha no código.
 *
 *  Por que gerar em vez de escrever à mão? Porque documentação escrita à mão envelhece: alguém muda a
 *  função e esquece o .md. Aqui a fonte da verdade é o próprio comentário no código.
 *
 *  Uso:
 *    npm run docs                          # (re)gera docs/REFERENCIA.md
 *    node scripts/gerar-referencia.mjs --check   # só confere se está atualizado (usado nos testes)
 *
 *  Sem dependências: só Node. O "parser" é simples (por linhas), suficiente para o estilo deste projeto:
 *    function nome(...)            export function nome(...)          async function nome(...)
 *    const nome = (...) => ...     export const NOME = ...            (dentro ou fora de uma fábrica createX)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'REFERENCIA.md');
/** Pastas/arquivos fora da referência: dados gerados (listas enormes do Google), não código. */
const SKIP = ['src/data'];

/** Lista os .js de uma pasta, recursivamente, em ordem alfabética (pastas depois dos arquivos). */
function listJs(dir) {
  const entries = readdirSync(dir).sort();
  const files = entries.filter((e) => e.endsWith('.js')).map((e) => join(dir, e));
  const dirs = entries.map((e) => join(dir, e)).filter((p) => statSync(p).isDirectory());
  return [...files, ...dirs.filter((d) => !SKIP.includes(rel(d))).flatMap(listJs)];
}
const rel = (p) => relative(ROOT, p).split('\\').join('/');

/** Tira os " * " do começo das linhas de um bloco de comentário e as linhas decorativas (═══). */
function cleanBlock(lines) {
  return lines
    .map((l) => l.replace(/^\s*\/\*\*\s?/, '').replace(/\s*\*\/\s*$/, '').replace(/^\s*\*\s?/, ''))
    .filter((l) => !/^[═─=\-\s]{6,}$/.test(l));
}

/** Separa um JSDoc em { desc, params[], returns }. A descrição é o texto antes da primeira @tag. */
function parseDoc(lines) {
  const desc = [], params = [];
  let returns = '', cur = null;
  for (const raw of lines) {
    const l = raw.trimEnd();
    const pm = l.match(/^\s*@param\s+(\{[^}]*\})?\s*(\[[^\]]*\]|[\w.$]+)\s*(.*)$/);
    const rm = l.match(/^\s*@returns?\s+(\{[^}]*\})?\s*(.*)$/);
    if (pm) { cur = { type: (pm[1] || '').slice(1, -1), name: pm[2], text: pm[3] }; params.push(cur); continue; }
    if (rm) { returns = [rm[1] ? '`' + rm[1].slice(1, -1) + '`' : '', rm[2]].filter(Boolean).join(' '); cur = 'ret'; continue; }
    if (/^\s*@\w+/.test(l)) { cur = 'skip'; continue; }
    if (cur && cur !== 'ret' && cur !== 'skip') { if (l.trim()) cur.text += ' ' + l.trim(); continue; }
    if (cur === 'ret') { if (l.trim()) returns += ' ' + l.trim(); continue; }
    if (cur === 'skip') continue;
    desc.push(l);
  }
  return { desc: desc.join('\n').trim(), params, returns: returns.trim() };
}

/** Reconhece a linha de declaração que vem depois de um comentário. Devolve { kind, name, sig, exported } ou null. */
function parseDecl(line, rest = line) {
  let m = line.match(/^(\s*)(export\s+)?(default\s+)?(async\s+)?function\s*\*?\s*(\w+)\s*\(/);
  if (m) return { kind: 'fn', name: m[5], sig: `${m[5]}(${tidy(argsAt(rest, rest.indexOf('(', m[0].length - 1)))})`, exported: !!m[2], indent: m[1].length };
  m = line.match(/^(\s*)(export\s+)?(?:const|let)\s+(\w+)\s*=\s*(async\s+)?(\(|\w+\s*=>)/);
  if (m && (m[5] !== '(' || /^\s*=>/.test(rest.slice(closeAt(rest, m[0].length - 1) + 1)))) {
    const args = m[5] === '(' ? argsAt(rest, m[0].length - 1) : m[5].replace(/\s*=>$/, '');
    return { kind: 'fn', name: m[3], sig: `${m[3]}(${tidy(args)})`, exported: !!m[2], indent: m[1].length };
  }
  m = line.match(/^(\s*)(export\s+)?(?:const|let)\s+(\w+)\s*=/);
  if (m) return { kind: 'const', name: m[3], sig: m[3], exported: !!m[2], indent: m[1].length };
  return null;
}
/** Posição do ")" que fecha o "(" em `open` (conta parênteses aninhados, ex.: valores padrão `() => {}`). */
function closeAt(text, open) {
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === '(') depth++;
    else if (text[k] === ')' && --depth === 0) return k;
  }
  return text.length;
}
/** Texto entre o "(" em `open` e o ")" que o fecha. */
const argsAt = (text, open) => text.slice(open + 1, closeAt(text, open));
/** Encurta parâmetros longos (objetos com padrão) para caber numa linha. */
const tidy = (s) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 70 ? t.slice(0, 67) + '…' : t;
};

/** Lê um arquivo e devolve { title, about, items[] }. */
function parseFile(path) {
  // \r\n → \n: no Windows o Git pode entregar os arquivos com CRLF; a referência tem que sair igual nos dois sistemas
  const lines = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').split('\n');
  let title = '', about = '', i = 0;
  // cabeçalho do arquivo: o primeiro bloco /** no topo (antes de qualquer import/código)
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim().startsWith('/**')) {
    const start = i;
    while (i < lines.length && !lines[i].includes('*/')) i++;
    const block = cleanBlock(lines.slice(start, i + 1));
    // a 1ª linha com "arquivo — TÍTULO" vira o título
    const ti = block.findIndex((l) => /—/.test(l));
    title = ti >= 0 ? block[ti].split('—').slice(1).join('—').trim() : '';
    about = block.filter((_, k) => k !== ti).join('\n').replace(/^\n+|\n+$/g, '');
    // se o cabeçalho for o JSDoc da primeira função (sem "—"), não é cabeçalho de arquivo
    if (ti < 0) { title = ''; about = ''; i = start - 1; }
    i++;
  }
  const items = [];
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!/^\s*\/\*\*/.test(l)) continue;
    const start = i;
    while (i < lines.length && !lines[i].includes('*/')) i++;
    const block = cleanBlock(lines.slice(start, i + 1));
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const decl = parseDecl(lines[j] || '', lines.slice(j, j + 12).join('\n'));
    if (!decl) continue;
    items.push({ ...decl, line: j + 1, ...parseDoc(block) });
  }
  // exportadas SEM comentário também entram (para ninguém achar que a função não existe)
  lines.forEach((l, k) => {
    const d = /^export\s/.test(l) && parseDecl(l);
    if (d && !items.some((it) => it.line === k + 1)) items.push({ ...d, line: k + 1, desc: '', params: [], returns: '' });
  });
  items.sort((a, b) => a.line - b.line);
  return { title, about, items };
}

/** Uma linha de Markdown por item: assinatura, link e o 1º parágrafo da descrição (o resto vai indentado). */
function renderItem(it, file) {
  const link = `[L${it.line}](../${file}#L${it.line})`;
  const tag = it.exported ? '' : it.indent > 0 ? ' <sub>interna</sub>' : ' <sub>do módulo</sub>';
  const paras = it.desc ? it.desc.split(/\n\s*\n/) : [];
  // o 1º parágrafo vira uma linha só, MAS para antes de uma lista ("- ...") ou de linhas recuadas (diagramas),
  // que seguem abaixo com as quebras originais
  if (paras.length) {
    const ls = paras[0].split('\n');
    const cut = ls.findIndex((x, k) => k > 0 && /^(\s*[-•]\s|\s{2,}\S)/.test(x));
    if (cut > 0) paras.splice(0, 1, ls.slice(0, cut).join('\n'), ls.slice(cut).join('\n'));
  }
  const first = paras.length ? paras[0].replace(/\s*\n\s*/g, ' ') : '_(sem comentário)_';
  const out = [`- **\`${it.sig}\`**${tag} · ${link} — ${first}`];
  // parágrafos seguintes da descrição (ex.: listas, exemplos) mantêm as quebras, indentados sob o item
  for (const p of paras.slice(1)) out.push('', ...p.split('\n').map((x) => '  ' + (x.trim() ? x : '')).map((x) => x.replace(/\s+$/, '')));
  for (const p of it.params) out.push(`  - \`${p.name}\`${p.type ? ` <sub>${p.type.replace(/\|/g, '\\|')}</sub>` : ''} — ${p.text.trim().replace(/\|/g, '\\|')}`);
  if (it.returns) out.push(`  - ↩︎ ${it.returns.replace(/\|/g, '\\|')}`);
  return out.join('\n');
}

/** Títulos dos cabeçalhos vêm EM MAIÚSCULAS; no índice viram frase normal, mantendo as siglas (CSS, SVG...). */
const ACRONYMS = ['HTML', 'CSS', 'SVG', 'PNG', 'JSON', 'DOM', 'API', 'IndexedDB', 'Google', 'Material Symbols', 'Fonts'];
function sentence(t) {
  if (!t) return '';
  let s = (t.charAt(0) + t.slice(1).toLowerCase()).replace(/\s{2,}/g, ' ');
  for (const a of ACRONYMS) s = s.replace(new RegExp(`(?<!\\.)\\b${a}\\b`, 'gi'), a);
  return s;
}

/** Monta o Markdown inteiro. */
function build() {
  const files = [...listJs(join(ROOT, 'src')), join(ROOT, 'server.js')];
  const parsed = files.map((p) => ({ file: rel(p), ...parseFile(p) }));
  // mesma regra do GitHub para âncoras de título: minúsculas, sem pontuação ("src/ui/dom.js" → "srcuidomjs")
  const anchor = (f) => f.toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/ /g, '-');
  const total = parsed.reduce((n, f) => n + f.items.length, 0);
  const md = [
    '# Referência do código',
    '',
    '> **Arquivo gerado** por `scripts/gerar-referencia.mjs` a partir dos comentários do código. **Não edite à mão**:',
    '> mude o comentário no `.js` e rode `npm run docs`. (Os testes avisam se esta página ficou desatualizada.)',
    '>',
    '> Para entender o projeto antes de mergulhar aqui, leia o [Guia do código](GUIA-DO-CODIGO.md) e a [Arquitetura](ARQUITETURA.md).',
    '',
    `${parsed.length} arquivos · ${total} funções e constantes documentadas.`,
    '',
    'Legenda: sem marca = **exportada** (outros arquivos podem importar) · <sub>do módulo</sub> = só usada dentro do arquivo · <sub>interna</sub> = definida dentro de uma fábrica (`createStore`, `createTools`…) e acessível pelo objeto que ela devolve, se estiver na lista de retorno.',
    '',
    '## Índice',
    '',
    '| Arquivo | O que é |',
    '|---|---|',
    ...parsed.map((f) => `| [\`${f.file}\`](#${anchor(f.file)}) | ${sentence(f.title)} |`),
    '',
  ];
  for (const f of parsed) {
    md.push('---', '', `## ${f.file}`, '');
    if (f.title) md.push(`**${f.title}** · [abrir o código](../${f.file})`, '');
    if (f.about) md.push('```text', f.about, '```', '');
    if (!f.items.length) { md.push('_Nenhuma função documentada._', ''); continue; }
    md.push(...f.items.map((it) => renderItem(it, f.file)), '');
  }
  return md.join('\n').replace(/\n{3,}/g, '\n\n');
}

const content = build();
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n'); } catch { /* não existe ainda */ }
  if (current !== content) {
    console.error('docs/REFERENCIA.md está desatualizado. Rode: npm run docs');
    process.exitCode = 1;
  } else console.log('docs/REFERENCIA.md em dia.');
} else {
  writeFileSync(OUT, content);
  console.log(`docs/REFERENCIA.md gerado (${content.split('\n').length} linhas).`);
}
