# Stylo — contexto

**O que é:** um "Figma" local, em JavaScript puro (módulos ES, sem build, sem dependências de runtime), em que o
canvas é DOM + CSS de verdade. A ideia central: **um servidor ligado, onde humanos e agentes de IA (via MCP)
trabalham no mesmo projeto**, criando, editando e exportando sites.

**Objetivo do produto**
- O servidor fica ligado; qualquer agente (Claude Code, Codex, Cursor...) conecta em `http://localhost:5173/mcp`.
- O agente cria um arquivo (projeto), trabalha nele e: exporta um **zip de HTML estruturado** (`export_site`), ou
  **puxa o código** (`export_html`, `get_css`...) para construir o resto por conta própria.
- Humanos usam o editor visual no navegador; humanos e agentes podem estar no mesmo projeto ao mesmo tempo
  (presença, travas por camada, comentários). Isso pede contas e banco de dados (hoje: arquivos JSON numa pasta).

**Estado desta cópia:** limpeza em andamento. O chat de IA embutido (OpenAI/NIM/Ollama, Jev, subagentes) já foi removido: agentes entram só pelo MCP. Tudo que era documentação, plano, captura de tela e identidade visual
foi removido (está no histórico do GitHub). Este é o único `.md`.

## Rodar
```
npm start        # http://localhost:5173  (PORT e DESIGNER_CONFIG mudam porta e arquivo de configuração)
npm test         # testes unitários e de API (node --test, ~3 s)
npm run test:e2e # testes de navegador (precisa de playwright)
```
Conectar um agente: Claude Code `claude mcp add --transport http projeto-designer http://localhost:5173/mcp`;
Codex/Claude Desktop (só stdio): `node scripts/mcp.mjs`, que repassa para o `/mcp`.

## Mapa do código (o quê, onde, por quê)

### Núcleo do documento — puro, roda no Node, tem teste unitário
| Arquivo | Faz |
|---|---|
| `src/model.js` | formato do documento (páginas → camadas), `createNode`, árvore, grupos, constraints |
| `src/store.js` | estado único, histórico (undo/redo), eventos, quando salvar |
| `src/components.js` | componentes/instâncias, estilos compartilhados |
| `src/modes.js`, `src/palettes.js`, `src/color.js` | variáveis por modo (claro/escuro), paletas, cores |
| `src/comments.js` | notas e comentários |
| `src/validate.js` | validação do JSON de um projeto |
| `src/geom.js`, `src/imagefx.js`, `src/image-assets.js` | geometria e imagens |

### Exportação — puro
| Arquivo | Faz |
|---|---|
| `src/css.js` | camada → CSS, `generateCode` (HTML+CSS), vetores, máscaras |
| `src/html.js`, `src/cssedit.js`, `src/codeassist.js` | HTML/CSS gerado, edição de CSS livre, ajudas de código |
| `src/svg.js`, `src/svgimport.js` | exportar e importar SVG |
| `src/site-export.js`, `src/zip.js` | site multipágina em **zip** (sem dependência) |
| `src/fonts.js`, `src/data/*` | Google Fonts / ícones (listas geradas por `scripts/gerar-listas-google.mjs`) |

### Servidor (Node, sem framework) — `server.js` + `server/`
| Arquivo | Faz |
|---|---|
| `server.js` (~700 linhas, **a fatiar**) | HTTP cru: estáticos, API `/api` (conta, config, rotas de projeto), rota `/mcp`, sessões MCP, presença |
| `server/projects.js` | **único** que sabe como projetos ficam no disco: listar/ler/gravar atômico, versões, miniaturas, renomear, detecção de conflito |
| `server/workspace/index.js` | **onde o MCP trabalha**: projetos abertos em memória (store + comandos + executor), um "projeto atual" por sessão, grava sozinho, recarrega se outro autor gravar |
| `server/workspace/model-canvas.js` | geometria calculada do modelo (substitui o DOM nos comandos) |
| `server/mcp.js` | protocolo MCP (JSON-RPC: initialize, tools/list, tools/call, ping) |
| `server/presence.js` | quem está no projeto (pessoas/agentes) e travas por camada, em memória |
| `server/account.js`, `server/atomic.js`, `server/http-error.js` | conta local, gravação atômica de JSON, erro HTTP |
| `server/photos.js`, `server/imageai.js` | busca de fotos e edição generativa de imagem |
| `server/instrucoes-agente.txt` | instruções que o MCP entrega a cada agente |
| `scripts/mcp.mjs` | ponte stdio → `/mcp` |

### Ferramentas MCP — `src/agent/`
| Arquivo | Faz |
|---|---|
| `schema.js` | as 41 ferramentas (nome, descrição, JSON Schema), compartilhada por servidor e navegador |
| `runner.js` | **executa** cada ferramenta usando store + commands. Roda no servidor (workspace); sem navegador, `get_image`, `edit_image` e `generate_image_edit` ficam indisponíveis |
| `content.js` | divide conteúdo grande em trechos UTF-8 |
| `providers.js` | endereços de provedores de imagem (usado só por `server/imageai.js`) |

### Editor visual (navegador) — só interface; fora do escopo desta limpeza
`src/main.js`, `canvas.js`, `overlay.js`, `tools.js`, `commands.js`, `pen.js`, `rulers.js`, `present.js`,
`saving.js`, `storage.js`, `export.js`, `thumbnail.js`, `sample-vitrine.js`, `styles/app.css`, `ui/*`, `index.html`.

## Como o MCP funciona agora
```
agente ──HTTP /mcp──▶ sessão MCP ──▶ workspace.call(tool) ──▶ runner.run ──▶ store ──(400 ms)──▶ projects.write
                                                                                                      │
editor (navegador) ◀──── SSE "project" (recarrega se não tem alteração pendente) ◀────────────────────┘
```
- Sem editor aberto o agente cria projeto (`new_project`), edita e exporta (`export_zip`, `export_site`, `export_html`).
- `src/live.js` é a única ligação do editor com o servidor para MCP/presença (eventos `presence` e `project`).
- **Limites conhecidos:** (1) se duas pessoas gravam o mesmo arquivo, a gravação de fora vence e o workspace recarrega
  (colaboração em tempo real de verdade — CRDT ou operações — é trabalho futuro); (2) `get_image` precisa de um
  renderizador (plugin com Chromium/Playwright, ainda não feito); (3) seleção e histórico (`undo`) são do projeto, não da sessão;
  (4) sem contas/tokens: o `/mcp` só aceita pedidos desta máquina.

## Decisões tomadas (com a pessoa dona do projeto)
1. **Sem agente embutido.** Toda IA entra por MCP. O MCP é um *core plugin*, não um detalhe do servidor.
2. **Modularização é a regra:** nenhum arquivo faz mil coisas. Cada parte tem uma pasta e um motivo.
3. **Core plugins:** documento, exportação, MCP, fotos, imagem, (futuro) identidade visual. Cada plugin registra
   suas ferramentas MCP, sua lógica e seus testes. Formato proposto: `{ nome, ferramentas, executar }`.
4. **Execução headless:** documento e operações rodam no servidor; o navegador é só mais um cliente.
5. **Dependências são bem-vindas** se encolherem o código (Hono/Fastify no servidor, SDK oficial do MCP).
6. **Hospedagem pessoal / multiusuário:** a pessoa roda num servidor próprio e acessa de vários lugares, com amigos
   editando junto. Banco de verdade (SQLite primeiro; Postgres/Redis só se precisar). JSON fica como formato de
   **exportar/importar** projeto, não como armazenamento.
7. **Contas locais:** uma conta mestre que autoriza (ou não) pessoas e agentes.
8. **Agentes cadastrados:** cada agente MCP tem identidade, aparece na presença ("bolinha") com o que está fazendo e
   o que fez (log de atividade).
9. **Comentários e notas de decisão** por camada/projeto (por que se fez algo), visíveis a pessoas e agentes.

## Ordem de trabalho
1. ✅ Limpar docs/capturas/identidade e remover o chat embutido.
2. ✅ MCP headless: `runner` e `commands` rodam no servidor (workspace); editor vira cliente ao vivo; `export_zip`.
3. Estrutura de plugins + fatiar `server.js` (framework + SDK do MCP).
4. SQLite, contas, cadastro de agentes, log de atividade, notas.

## Testes
`tests/*.test.js` (unitários e API, `node --test`, incluindo `workspace.test.js`) e `tests/e2e/*.mjs` (Playwright).
Estado: 352 unitários passam. Os e2e **estão desatualizados** (ainda usam o chat e `window.designer.agent`); serão refeitos junto com a nova interface.
