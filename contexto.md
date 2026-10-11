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

## Organização do repositório (monorepo, npm workspaces)
```
packages/core/   @stylo/core    documento puro (sem DOM): model, store, commands, css/html/svg, exportação, zip, ferramentas MCP (src/tools)
packages/db/     @stylo/db      Postgres + Prisma: esquema (prisma/schema.prisma), migrações SQL e cliente (src/client.ts). PGlite = Postgres embutido para uso local e testes
apps/server/     @stylo/server  servidor Node: API, MCP, workspace, presença, contas (src/), ponte stdio (bin/mcp.mjs)
apps/web/        @stylo/web     editor no navegador (JS legado; a interface será refeita). Vite
tests/                          testes unitários e de API (importam os pacotes por @stylo/*) e e2e (desatualizados)
scripts/                        utilitários soltos (listas do Google, benchmark)
```
Regra de dependência: `web → core`, `server → core`, `core → nada`. O `core` não pode importar de `web` nem de `server`.
Imports entre pacotes usam o nome (`@stylo/core/model.js`); dentro do pacote, caminho relativo.

## Rodar
```
npm start        # http://localhost:5173 (sem build: o servidor sobe o Vite junto, na mesma porta; PORT e DESIGNER_CONFIG mudam porta e config)
npm run db:generate  # gera o cliente Prisma (roda sozinho no npm install)
npm run typecheck    # tsc nos pacotes já em TypeScript (hoje: packages/db)
npm run build    # gera apps/web/dist; com ele presente o servidor entrega os arquivos de lá (STYLO_DEV=1 força o Vite)
npm test         # testes unitários e de API (node --test, ~3 s)
npm run test:e2e # testes de navegador (precisa de playwright)
```
Conectar um agente: Claude Code `claude mcp add --transport http projeto-designer http://localhost:5173/mcp`;
Codex/Claude Desktop (só stdio): `node apps/server/bin/mcp.mjs`, que repassa para o `/mcp`.

## Mapa do código (o quê, onde, por quê)

### `packages/core/src` — documento, puro, roda no Node e no navegador
| Arquivo | Faz |
|---|---|
| `model.js` | formato do documento (páginas → camadas), `createNode`, árvore, grupos, constraints |
| `store.js` | estado único, histórico (undo/redo), eventos, quando salvar |
| `commands.js` | operações sobre a árvore (agrupar, duplicar, alinhar, auto layout, componentes...). Pede geometria a um "canvas" injetado |
| `components.js`, `modes.js`, `palettes.js`, `color.js`, `comments.js` | componentes, modos de cor/variáveis, paletas, cores, notas e comentários |
| `validate.js`, `geom.js`, `imagefx.js`, `image-assets.js` | validação do JSON, geometria, imagens |
| `css.js`, `html.js`, `cssedit.js`, `codeassist.js` | camada → CSS, HTML/CSS gerado, edição de CSS livre |
| `svg.js`, `svgimport.js` | exportar e importar SVG |
| `site-export.js`, `zip.js` | site multipágina em **zip** (sem dependência) |
| `fonts.js`, `icons.js`, `data/*` | Google Fonts e Material Symbols (listas geradas por `scripts/gerar-listas-google.mjs`) |
| `sample-vitrine.js`, `version.js` | projeto de exemplo, versão |
| `tools/schema.js` | as 42 ferramentas MCP (nome, descrição, JSON Schema) |
| `tools/runner.js` | **executa** cada ferramenta com store + commands. Roda no servidor; `get_image`, `edit_image` e `generate_image_edit` só existem se alguém injetar `renderImage`/`imageOps` |
| `tools/content.js` | divide conteúdo grande em trechos UTF-8 |

### `apps/server/src` — Node, sem framework (por enquanto)
| Arquivo | Faz |
|---|---|
| `server.js` (~560 linhas, **a fatiar**) | HTTP cru: API `/api` (conta, config, projetos), rota `/mcp`, sessões MCP, presença |
| `web.js` | entrega o editor: `apps/web/dist` em produção, Vite (middleware, mesma porta) em desenvolvimento |
| `projects.js` | **único** que sabe como projetos ficam no disco: listar/ler/gravar atômico, versões, miniaturas, renomear, conflito |
| `workspace/index.js` | **onde o MCP trabalha**: projetos abertos em memória (store + comandos + executor), "projeto atual" por sessão, grava sozinho, recarrega se outro autor gravar |
| `workspace/model-canvas.js` | geometria calculada do modelo (substitui o DOM nos comandos) |
| `mcp.js` | protocolo MCP (JSON-RPC: initialize, tools/list, tools/call, ping) |
| `presence.js` | quem está no projeto (pessoas/agentes) e travas por camada, em memória |
| `account.js`, `atomic.js`, `http-error.js` | conta local, gravação atômica de JSON, erro HTTP |
| `photos.js`, `imageai.js`, `providers.js` | busca de fotos, edição generativa de imagem, provedores de imagem |
| `instrucoes-agente.txt` | instruções que o MCP entrega a cada agente |
| `../bin/mcp.mjs` | ponte stdio → `/mcp` |

### `apps/web` — editor visual (interface será refeita; só o essencial aqui)
`src/main.js` monta tudo; `canvas.js`, `overlay.js`, `tools.js`, `pen.js`, `rulers.js`, `present.js` desenham e editam;
`saving.js`, `storage.js`, `export.js`, `thumbnail.js`, `account.js` salvam/exportam; `live.js` liga ao servidor
(presença e "o projeto mudou"); `ui/*` painéis; `styles/app.css`; `index.html`, `public/assets`.

## Como o MCP funciona agora
```
agente ──HTTP /mcp──▶ sessão MCP ──▶ workspace.call(tool) ──▶ runner.run ──▶ store ──(400 ms)──▶ projects.write
                                                                                                      │
editor (navegador) ◀──── SSE "project" (recarrega se não tem alteração pendente) ◀────────────────────┘
```
- Sem editor aberto o agente cria projeto (`new_project`), edita e exporta (`export_zip`, `export_site`, `export_html`).
- `apps/web/src/live.js` é a única ligação do editor com o servidor para MCP/presença (eventos `presence` e `project`).
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
5. **Dependências são bem-vindas** se encolherem o código. **TypeScript** no lugar de JS puro; Hono no servidor; SDK oficial do MCP; Vite no editor.
6. **Hospedagem pessoal e serviço pago:** a pessoa roda num servidor próprio e acessa de vários lugares, com amigos
   editando junto; o projeto também será oferecido como serviço cobrado. Banco: **Postgres + Prisma** (JSONB para a
   árvore do design). JSON fica como formato de **exportar/importar**. Redis só se houver várias instâncias.
   Licença: source-available (não vender a ferramenta como produto próprio; usar o resultado é livre) — **a definir**
   (FSL ou PolyForm Shield são os candidatos; o repositório ainda está em MIT).
7. **Contas locais:** uma conta mestre que autoriza (ou não) pessoas e agentes.
8. **Agentes cadastrados:** cada agente MCP tem identidade, aparece na presença ("bolinha") com o que está fazendo e
   o que fez (log de atividade).
9. **Comentários e notas de decisão** por camada/projeto (por que se fez algo), visíveis a pessoas e agentes.

## Ordem de trabalho
1. ✅ Limpar docs/capturas/identidade e remover o chat embutido.
2. ✅ MCP headless: `runner` e `commands` rodam no servidor (workspace); editor vira cliente ao vivo; `export_zip`.
3. ✅ Monorepo (`packages/core`, `apps/server`, `apps/web`) com Vite.
4. TypeScript (por módulo, começando pelo `core`), Hono + SDK oficial do MCP, fatiar `server.js`.
5. Postgres + Prisma. ✅ esquema e migração `0001_init` (User, Agent, Project, ProjectMember, ProjectVersion, Operation, Note) com teste em PGlite. Falta: ligar o servidor ao banco (projetos, contas, login, tokens de agente, log de operações) no lugar dos arquivos; JSON só para exportar/importar.
6. Plugins do núcleo (documento, exportação, MCP, fotos, imagem, identidade visual).
7. Edição simultânea de verdade (operações ou CRDT) e renderizador para `get_image`.

## Testes
`tests/*.test.js|ts` (unitários e API, `node --import tsx --test`, incluindo `workspace.test.js` e `db.test.ts`) e `tests/e2e/*.mjs` (Playwright).
Estado: 353 unitários passam. Os e2e **estão desatualizados** (ainda usam o chat e `window.designer.agent`); serão refeitos junto com a nova interface.
