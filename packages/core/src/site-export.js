/**
 * Exporta as pranchetas visíveis do documento como páginas HTML independentes.
 * Este módulo não toca no DOM nem inicia downloads: a UI e o MCP podem reutilizar o mesmo resultado.
 */
import { exportHtml } from './css.js';
import { DEFAULT_BREAKPOINTS, isBoard, slugify } from './model.js';

const boardsOf = (doc) => {
  const boards = [];
  const warnings = [];
  for (const page of doc.pages || []) {
    const found = [];
    const visitChildren = (layers, parent, ancestorsVisible) => {
      for (const layer of layers || []) {
        const visible = ancestorsVisible && layer.visible !== false;
        if (isBoard(layer, parent)) {
          if (visible) found.push(layer);
        } else if (layer.type === 'section') visitChildren(layer.children, layer, visible);
      }
    };
    visitChildren(page.children, null, true);
    if (!found.length) warnings.push(`A página “${page.name || 'Sem nome'}” não tem pranchetas visíveis para exportar.`);
    boards.push(...found);
  }
  if (!boards.length) throw new Error('O projeto não tem pranchetas visíveis para exportar.');
  return { boards, warnings };
};

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const safeBaseName = (name) => {
  let base = slugify(name || 'pagina').slice(0, 120).replace(/-+$/, '') || 'pagina';
  if (WINDOWS_RESERVED.test(base)) base += '-page';
  return base;
};

const uniqueHtmlPath = (name, used) => {
  const base = safeBaseName(name);
  let path = `${base}.html`;
  let suffix = 2;
  while (used.has(path.toLowerCase())) path = `${base}-${suffix++}.html`;
  used.add(path.toLowerCase());
  return path;
};

const visit = (node, fn) => {
  fn(node);
  for (const child of node.children || []) visit(child, fn);
};

/**
 * @returns {{files: {path: string, content: string}[], warnings: string[]}}
 */
export function exportSite(doc) {
  if (!doc || !Array.isArray(doc.pages)) throw new Error('Projeto inválido: páginas não encontradas.');
  const { boards, warnings } = boardsOf(doc);
  const used = new Set();
  const files = boards.map((board, index) => ({
    path: index === 0 ? (used.add('index.html'), 'index.html') : uniqueHtmlPath(board.name, used),
    content: exportHtml(board, doc.assets || {}, board.name || 'Página', doc.styles || null),
  }));
  const paths = new Map(files.map((file) => [file.path.toLowerCase(), file.path]));

  // Tela de largura FIXA maior que o menor aparelho do projeto vira rolagem horizontal no celular. Não mudamos o
  // padrão (alteraria exportações existentes): avisamos e dizemos onde ligar a largura fluida.
  const smallest = (doc.breakpoints?.length ? doc.breakpoints : DEFAULT_BREAKPOINTS).reduce((a, b) => (b.preview < a.preview ? b : a));
  for (const board of boards) {
    if (!board.fluid && board.sizeX !== 'hug' && board.w > smallest.preview) {
      warnings.push(`“${board.name || 'Página'}” tem largura fixa de ${Math.round(board.w)} px: em ${smallest.name.toLowerCase()} (${smallest.preview} px) ela vai rolar na horizontal. Ative “Largura fluida no site exportado” nas propriedades da tela.`);
    }
  }

  for (const board of boards) {
    const boardName = board.name || 'Página';
    visit(board, (node) => {
      if (node.interactions?.length) {
        warnings.push(`“${boardName}” contém interações de protótipo; elas não são executadas no site exportado.`);
      }
      if (node.tag === 'a' && typeof node.href === 'string') {
        const href = node.href.trim();
        const localHtml = /\.html(?:[?#].*)?$/i.test(href) && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
        if (localHtml) {
          const rawTarget = href.split(/[?#]/, 1)[0].replace(/^\.\//, '');
          const generatedPath = paths.get(rawTarget.toLowerCase());
          if (rawTarget.includes('/') || !generatedPath) warnings.push(`O link “${node.href}” em “${boardName}” não corresponde a um arquivo exportado.`);
          else if (rawTarget !== generatedPath) warnings.push(`O link “${node.href}” em “${boardName}” diferencia maiúsculas/minúsculas do arquivo “${generatedPath}”; ajuste o endereço.`);
        }
      }
    });
  }
  return { files, warnings: [...new Set(warnings)] };
}
