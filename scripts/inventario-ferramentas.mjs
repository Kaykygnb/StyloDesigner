// Inventário de contrato, sem iniciar servidor, browser ou executar handlers.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, posix } from 'node:path';
import { parse } from '@babel/parser';
import { AGENT_TOOLS } from '@stylo/core/tools/schema.ts';
import { builtinPlugins } from '@stylo/plugins/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
const ast = (path) => parse(read(path), { sourceType: 'module', plugins: ['typescript'] });
function files(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}
function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') fn(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => visit(child, fn));
    else if (value && typeof value === 'object') visit(value, fn);
  }
}
function namedStrings(path, name) {
  const found = [];
  visit(ast(path), (node) => {
    if (node.type === 'VariableDeclarator' && node.id.name === name && node.init) {
      visit(node.init, (n) => { if (n.type === 'StringLiteral') found.push(n.value); });
    }
  });
  if (!found.length) throw new Error(`Declaração não encontrada: ${path}:${name}`);
  return new Set(found);
}
function handlers(paths, names) {
  const result = new Map();
  for (const path of paths) {
    const source = ast(path);
    visit(source, (node) => {
      if (!['ObjectMethod', 'ObjectProperty'].includes(node.type)) return;
      const name = node.key?.name ?? node.key?.value;
      if (!names.has(name)) return;
      if (node.type === 'ObjectProperty' && !['ArrowFunctionExpression', 'FunctionExpression'].includes(node.value?.type)) return;
      const line = node.loc.start.line;
      const list = result.get(name) ?? [];
      const body = node.body ?? node.value.body;
      list.push({ path, line, bodyStart: body.start, bodyEnd: body.end }); result.set(name, list);
    });
  }
  return result;
}
const projectPath = 'apps/server/src/workspace/index.ts';
const projectTools = namedStrings(projectPath, 'PROJECT_TOOLS');
const documentWide = namedStrings('apps/server/src/presence.js', 'DOCUMENT_WIDE_TOOLS');
const pluginNames = new Set(builtinPlugins.flatMap((p) => (p.tools ?? []).map((t) => t.def.name)));
const coreNames = new Set(AGENT_TOOLS.map((d) => d.name));
const coreHandlers = handlers(files('packages/core/src/tools/runner').filter((p) => p.endsWith('.ts')), coreNames);
const workspaceHandlers = handlers([projectPath], coreNames);
// Segue a ordem real de spreads/aliases do runner: a última definição vence.
function runnerBindings() {
  const path = 'packages/core/src/tools/runner.ts', source = ast(path);
  const imports = new Map(), variables = new Map(), effective = new Map();
  visit(source, (node) => {
    if (node.type === 'ImportDeclaration' && node.source.value.startsWith('./')) {
      const target = posix.normalize(`${dirname(path)}/${node.source.value}`).replace(/\.js$/, '.ts');
      for (const spec of node.specifiers) imports.set(spec.local.name, target);
    }
  });
  const origin = (node) => node?.type === 'CallExpression' ? imports.get(node.callee.name) : node?.type === 'Identifier' ? variables.get(node.name) : node?.type === 'MemberExpression' ? variables.get(node.object.name) : null;
  visit(source, (node) => {
    if (node.type !== 'VariableDeclarator') return;
    const file = origin(node.init);
    if (file && node.id.type === 'Identifier') variables.set(node.id.name, file);
    if (file && node.id.type === 'ObjectPattern') for (const prop of node.id.properties) variables.set(prop.value.name, file);
    if (!['READ', 'WRITE'].includes(node.id.name) || node.init?.type !== 'ObjectExpression') return;
    for (const prop of node.init.properties) {
      const file = origin(prop.type === 'SpreadElement' ? prop.argument : prop.value);
      if (!file) throw new Error(`Composição de handler não resolvida no runner: ${prop.start}`);
      if (prop.type === 'SpreadElement') {
        for (const [name, candidates] of coreHandlers) if (candidates.some((c) => c.path === file)) effective.set(name, file);
      } else effective.set(prop.key.name ?? prop.key.value, file);
    }
  });
  visit(source, (node) => {
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && ['READ', 'WRITE'].includes(node.left.object.name)) {
      effective.set(node.left.property.name, origin(node.right));
    }
  });
  return effective;
}
const effectiveHandlers = runnerBindings();
const testPaths = files('tests').filter((p) => /\.test\.(js|ts)$/.test(p));
const testTexts = testPaths.map((path) => ({ path, text: read(path) }));
const pluginSources = files('packages/plugins/src').filter((p) => p.endsWith('.ts'));

export function buildInventory() {
  const rows = [];
  for (const [plugin, defs] of [[null, AGENT_TOOLS.map((def) => ({ def }))], ...builtinPlugins.map((p) => [p, p.tools ?? []])]) {
    for (const entry of defs) {
      const def = entry.def;
      let handler;
      if (plugin) {
        if (typeof entry.run !== 'function') throw new Error(`Plugin sem handler: ${def.name}`);
        const candidates = pluginSources.filter((path) => read(path).includes(`'${def.name}'`) || read(path).includes(`"${def.name}"`));
        if (candidates.length !== 1) throw new Error(`Origem ambígua do plugin ${def.name}: ${candidates}`);
        const source = ast(candidates[0]);
        const runs = [];
        visit(source, (node) => {
          if (node.type !== 'ObjectExpression') return;
          const defNode = node.properties.find((p) => p.key?.name === 'def');
          const toolName = defNode?.value?.arguments?.[0]?.properties?.find((p) => p.key?.name === 'name')?.value?.value;
          if (toolName !== def.name) return;
          const run = node.properties.find((p) => p.key?.name === 'run');
          const body = run?.body ?? run?.value?.body;
          if (body) runs.push({ path: candidates[0], line: run.loc.start.line, bodyStart: body.start, bodyEnd: body.end });
        });
        if (runs.length !== 1) throw new Error(`Função run não resolvida: ${def.name}`);
        handler = runs[0];
      } else {
        const candidates = projectTools.has(def.name) ? (workspaceHandlers.get(def.name) ?? []) : (coreHandlers.get(def.name) ?? []).filter((c) => c.path === effectiveHandlers.get(def.name));
        if (candidates.length !== 1) throw new Error(`Handler ausente/ambíguo: ${def.name}: ${JSON.stringify(candidates)}`);
        handler = candidates[0];
      }
      const text = read(handler.path).slice(handler.bodyStart, handler.bodyEnd);
      const dependencyCandidates = ['renderImage', 'measureLayout', 'auditLayout', 'inspectLayout', 'fetchImage', 'imageOps', 'vendor', 'folder', 'saving', 'fetch'].filter((name) => new RegExp(`\\b${name}\\b`).test(text));
      const testReferences = testTexts.flatMap(({ path, text }) => text.split('\n').flatMap((line, index) => line.includes(`'${def.name}'`) || line.includes(`"${def.name}"`) ? [{ path, line: index + 1 }] : []));
      const dispatch = plugin ? `plugin:${plugin.id}` : projectTools.has(def.name) ? 'workspace.PROJECT' : 'runner';
      const lock = !def.write || def.noLock ? 'sem lock por chamada' : documentWide.has(def.name) ? 'documento' : 'alvos de argumentos; fallback documento; update_layers pode exigir documento';
      let scope = def.needs ?? (def.write ? 'write' : 'read');
      if (dispatch === 'workspace.PROJECT') scope = def.needs ?? ({ new_project: 'write', save_project: 'write', export_zip: 'export' }[def.name] ?? 'sem gate explícito de escopo nesta ferramenta; acesso ao projeto é separado');
      rows.push({ name: def.name, origin: plugin?.id ?? 'core', description: def.description, inputSchema: def.inputSchema, write: def.write, declaredNeeds: def.needs ?? null, dispatch, handler: { path: handler.path, line: handler.line }, scope, lock,
        undo: !def.write ? 'não altera documento por contrato' : dispatch === 'workspace.PROJECT' ? 'operação de projeto/colaboração; não presumir undo de documento' : ['undo', 'redo'].includes(def.name) ? 'navega histórico' : 'histórico de documento; rollback/atomicidade exigem testes comportamentais',
        inventoryContractTest: { path: 'tests/tool-inventory.test.js', scope: 'igualdade dos artefatos com catálogo/ligação estrutural; não prova comportamento individual' }, dependencyCandidates, dependencyStatus: 'referências diretas no corpo do handler; dependências transitivas não auditadas', testReferences, testStatus: testReferences.length ? 'menções textuais; cobertura comportamental não auditada' : 'sem menção literal encontrada; cobertura não determinada' });
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  if (new Set(rows.map((r) => r.name)).size !== rows.length || coreNames.size !== AGENT_TOOLS.length || pluginNames.size !== builtinPlugins.reduce((n, p) => n + (p.tools ?? []).length, 0)) throw new Error('Ferramenta duplicada');
  return { formatVersion: 1, counts: { core: AGENT_TOOLS.length, plugins: rows.length - AGENT_TOOLS.length, total: rows.length }, tools: rows };
}
export function renderInventory(data) {
  const escape = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const link = (p, line) => `[${p}${line ? `:${line}` : ''}](../../${p}${line ? `#L${line}` : ''})`;
  const lines = data.tools.map((r) => `| \`${r.name}\` | ${r.origin} / ${r.dispatch} | ${link(r.handler.path, r.handler.line)} | ${r.write ? 'escrita' : 'leitura'} / ${escape(r.scope)} | ${escape(r.lock)} | ${escape(r.undo)} | ${r.testReferences.length ? r.testReferences.slice(0, 3).map((t) => link(t.path, t.line)).join(', ') : 'não determinada'} |`);
  return `# Inventário verificável de ferramentas\n\nGerado por \`npm run docs:inventario\`; conferir sem escrever com \`npm run docs:inventario -- --check\`. Não editar registros manualmente. Catálogo: ${data.counts.total} ferramentas (${data.counts.core} núcleo, ${data.counts.plugins} plugins embutidos). Plugins só estão disponíveis quando habilitados.\n\n[JSON completo](TOOL-INVENTORY.json) contém descrições/schemas reais, limites declarados no schema, origem, linhas e todas as referências. Fontes: catálogo, handlers, workspace e callers MCP/Studio. Não altera runtime.\n\n## Limites da evidência\n\nO gerador exige um handler estrutural por ferramenta e função run nos plugins. Isso verifica registro/ligação documental, não executa o handler nem prova resultado, autorização, undo ou atomicidade. Menções em testes são candidatas, nunca cobertura comprovada. Dependências listadas no JSON são referências diretas no corpo do handler; dependências transitivas/ambientais exigem revisão adicional. Limites imperativos/respostas exigem auditoria do handler e não estão todos no schema. Não transformar ausência de menção literal em ausência de testes.\n\nLocks são políticas dos callers (não uma garantia para toda API); update_layers tem condição adicional de documento para resize/layout. Gate de acesso por conta/membro/grant é separado do escopo do agente. Workspace.PROJECT não passa pelo histórico normal do runner; export_zip requer escopo export e, antes disso, recusa o papel de projeto VIEWER sem gravar. Select/leituras podem mudar estado transitório sem gravar documento.\n\nA matriz é a base de DOC-CORE-001, DOC-MCP-001 e DOC-STUDIO-001. Cada registro é conferido pelo teste de contrato tests/tool-inventory.test.js; isso não substitui testes comportamentais das famílias nem a futura matriz MCP/paridade. Cobertura comportamental por ferramenta não é certificada nesta entrega; consulte [a tarefa](../planning/tasks/core/DOC-CORE-001.md) e [regressões](REGRESSION-MATRIX.md).\n\n| Ferramenta | Origem / dispatch servidor | Handler | Modo / escopo no workspace | Lock caller | Undo | Referências candidatas (até 3) |\n|---|---|---|---|---|---|---|\n${lines.join('\n')}\n`;
}
