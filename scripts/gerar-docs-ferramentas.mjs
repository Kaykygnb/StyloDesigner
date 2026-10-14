// Gera docs/FERRAMENTAS-MCP.md a partir do catálogo real (núcleo + plugins). Rode: npm run docs:ferramentas
import { writeFileSync } from 'node:fs';
import { AGENT_TOOLS } from '@stylo/core/tools/schema.ts';
import { builtinPlugins } from '@stylo/plugins/index.ts';

const first = (text) => String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0].slice(0, 260);
const args = (def) => Object.keys(def.input?.shape ?? {}).join(', ') || '—';
const row = (def, origem) => `| \`${def.name}\` | ${def.write ? 'escreve' : 'lê'} | ${first(def.description).replace(/\|/g, '\|')} | ${args(def)} |`;
const head = '| Ferramenta | Tipo | O que faz | Argumentos |\n|---|---|---|---|';

const groups = new Map();
for (const def of AGENT_TOOLS) {
  const g = /vector|svg|path/.test(def.name) ? 'Vetores e SVG'
    : /^(get_image|inspect_layout|check_design|get_code|find_layers|get_layer|get_document|get_selection|select_layers)$/.test(def.name) ? 'Ver, medir e conferir'
    : /project|page|note|comment|activity|undo|redo|who_is|members|share|switch/.test(def.name) ? 'Projeto, páginas, notas e colaboração'
    : /style|variable|mode|resource|token|component|instance|design_resource/.test(def.name) ? 'Identidade, estilos e tokens'
    : /export|zip|html/.test(def.name) ? 'Exportar'
    : /image|asset|font|icon/.test(def.name) ? 'Imagens, assets, fontes e ícones'
    : 'Camadas, layout e propriedades';
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(def);
}
let md = `# Ferramentas MCP\n\n> Gerado automaticamente por \`npm run docs:ferramentas\` a partir do código. Não edite à mão.\n\n`;
md += `O Stylo anuncia **${AGENT_TOOLS.length + builtinPlugins.reduce((n, p) => n + (p.tools || []).length, 0)} ferramentas**: ${AGENT_TOOLS.length} do núcleo e ${builtinPlugins.reduce((n, p) => n + (p.tools || []).length, 0)} de plugins. O painel web usa as mesmas ferramentas: o que uma pessoa faz no editor é uma chamada destas.\n\n`;
md += `Convenções: erros vêm em português dizendo o conserto; argumentos desconhecidos são recusados com a lista dos aceitos; ferramentas que escrevem entram num passo de desfazer; alterações respeitam bloqueios por camada quando duas pessoas/agentes trabalham juntos.\n\n## Núcleo\n`;
for (const [g, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0], 'pt'))) md += `\n### ${g} (${list.length})\n\n${head}\n${list.map((d) => row(d)).join('\n')}\n`;
md += `\n## Plugins\n`;
for (const p of builtinPlugins) md += `\n### ${p.name} (\`${p.id}\`)\n\n${p.description || ''}\n\nCategoria: ${p.category || '—'} · permissões: ${(p.permissions || []).join(', ') || '—'}\n\n${head}\n${(p.tools || []).map((t) => row(t.def)).join('\n')}\n`;
writeFileSync(new URL('../docs/FERRAMENTAS-MCP.md', import.meta.url), md);
console.log('ok');
