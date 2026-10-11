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

**Leia também `decisoes.md`** — o diário do que foi decidido e por quê (só se acrescenta no fim; nunca reescrever entradas antigas).

**Estado desta cópia:** limpeza em andamento. O chat de IA embutido (OpenAI/NIM/Ollama, Jev, subagentes) já foi removido: agentes entram só pelo MCP. Tudo que era documentação, plano, captura de tela e identidade visual
foi removido (está no histórico do GitHub). Este é o único `.md`.

## Organização do repositório (monorepo, npm workspaces)
```
packages/core/   @stylo/core    documento puro (sem DOM): model, store, commands, css/html/svg, exportação, zip, ferramentas MCP (src/tools)
packages/plugins/ @stylo/plugins  plugins embutidos (hoje: identidade visual). Cada plugin = ferramentas MCP com Zod + `run`; contrato em `core/src/plugin.ts`
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
| `tools/schema.js` | as 51 ferramentas MCP do núcleo (mais as dos plugins) (nome, descrição, JSON Schema) |
| `tools/runner.js` | **executa** cada ferramenta com store + commands. Roda no servidor; `get_image`, `edit_image` e `generate_image_edit` só existem se alguém injetar `renderImage`/`imageOps` |
| `tools/content.js` | divide conteúdo grande em trechos UTF-8 |

### `apps/server/src` — Hono + SDK oficial do MCP (em TypeScript, exceto arquivos antigos em .js)
| Arquivo | Faz |
|---|---|
| `main.ts` | liga tudo: configuração, banco, serviços, app HTTP, MCP, editor; desligamento limpo. Roda com `node --import tsx` |
| `app.ts` | a aplicação Hono: proteções, rotas `/api/*` e `/mcp` |
| `context.ts` | o objeto `Services` (serviços juntos, sem framework de injeção) |
| `config.ts` | arquivo de configuração (versões guardadas, chaves do Pexels/imagem, política de agentes) |
| `http/guards.ts` | Host/Origin locais, JSON obrigatório, limites de corpo por rota, tratamento de erros |
| `http/identity.ts` | quem fez o pedido (sessão ou usuário local), conta mestre, política de agentes |
| `routes/auth.ts` · `projects.ts` · `system.ts` · `legacy.ts` | contas/agentes · projetos · status/perfil/presença/avisos ao vivo · fotos e IA de imagem (ainda em req/res) |
| `plugins.ts` | liga os plugins: registra as ferramentas no núcleo (tools/list e validação) e guarda o `run` de cada uma |
| `mcp/gateway.ts` | servidor MCP: protocolo do **SDK oficial**, sessões (máx. 64), identidade do agente (Bearer ou nome do programa), lista de ferramentas |
| `mcp/agent-calls.ts` | executa uma chamada: presença, travas por camada, chamadas em voo |
| `events.ts` | avisos ao vivo aos editores (SSE: `presence`, `project`) |
| `services/assets.ts` · `remote-image.ts` | imagens fora do JSON (tabela `Asset`, uma por conteúdo/sha256; o JSON leva `asset:<hash>`; volta como data URL ao ler) · baixar imagem por endereço com proteção contra SSRF |
| `services/projects.ts` · `auth.ts` · `agents.ts` · `operations.ts` · `notes.ts` · `sharing.ts` | projetos com revisão e versões · contas e sessões · cadastro de agentes · log de atividade · notas · compartilhamento |
| `services/renderer.ts` | PNG do design num Chromium isolado (`get_image`) |
| `workspace/index.ts` · `model-canvas.ts`(.js) | **onde o MCP trabalha**: projetos abertos em memória, papel e escopos por sessão, grava sozinho, recarrega se outro autor gravar; geometria sem DOM |
| `db.ts` | abre o banco: `DATABASE_URL` = Postgres; senão PGlite embutido |
| `presence.js` · `account.js` · `atomic.js` · `http-error.js` | presença e travas · perfil local · gravação atômica · erro HTTP |
| `photos.js` · `imageai.js` · `providers.js` · `web.js` | fotos livres · edição generativa de imagem · provedores · entrega do editor (dist ou Vite) |
| `instrucoes-agente.txt` | instruções entregues a cada agente no `initialize` |
| `../bin/mcp.mjs` | ponte stdio → `/mcp` (aceita `STYLO_TOKEN` e `--agente`) |

### `apps/web` — editor visual (interface será refeita; só o essencial aqui)
`src/main.js` monta tudo; `canvas.js`, `overlay.js`, `tools.js`, `pen.js`, `rulers.js`, `present.js` desenham e editam;
`saving.js`, `storage.js`, `export.js`, `thumbnail.js`, `account.js` salvam/exportam; `live.js` liga ao servidor
(presença e "o projeto mudou"); `ui/*` painéis; `styles/app.css`; `index.html`, `public/assets`.

## Como o MCP funciona agora
```
agente ──HTTP /mcp (Bearer token)──▶ identidade do agente ──▶ workspace.call(tool, ator) ──▶ runner.run ──▶ store
                                                                                     │                    │ (400 ms)
                                              operations.record (log de atividade) ◀─┘                    ▼
editor (navegador) ◀── SSE "project" (recarrega se não tem alteração pendente) ◀── projects.write (banco, com revisão)
```
- Sem editor aberto o agente cria projeto (`new_project`), edita e exporta (`export_zip`, `export_site`, `export_html`).
- `apps/web/src/live.js` é a única ligação do editor com o servidor para MCP/presença (eventos `presence` e `project`).
- **Dois modos de acesso:** `local` (padrão: sem login, só esta máquina, agentes entram pelo nome e a política `open` os registra) e `accounts` (`STYLO_AUTH=accounts`: login com senha, conta mestre, agentes só com token). A conta mestre cria agentes em `POST /api/agents` (o token aparece uma vez) e aprova/revoga em `/api/agents/:id/approve|revoke`; o log sai em `GET /api/projects/<arquivo>/activity`.
- **Imagens:** o núcleo continua vendo `doc.assets` com data URLs; o banco as guarda à parte (`services/assets.ts`) e serve cada uma em `GET /api/projects/<arquivo>/assets/<sha256>`.
- **Falta para expor na internet:** ligar em `0.0.0.0`/domínio (hoje só 127.0.0.1 e Host/Origin locais), HTTPS, limite de requisições, filtrar eventos SSE por pessoa, e o editor ainda não tem tela de login.
- **Limites conhecidos:** (1) se duas pessoas gravam o mesmo projeto, a gravação de fora vence e o workspace recarrega
  (colaboração em tempo real de verdade — CRDT ou operações — é trabalho futuro); (2) `get_image` precisa de um
  renderizador (plugin com Chromium/Playwright, ainda não feito); (3) seleção e histórico (`undo`) são do projeto, não da sessão;
  (4) a pasta de projetos (.json) deixou de ser o armazenamento: os projetos moram no banco; o editor ainda mostra a configuração antiga de pasta, que não tem mais efeito.

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
3. ✅ Contrato de plugins + plugin de identidade visual (cores OKLCH, contraste WCAG, harmonias, escalas); exportação com imagens como arquivos. Próximo: provedores de assets, biblioteca da conta, fontes.
3. ✅ Monorepo (`packages/core`, `apps/server`, `apps/web`) com Vite.
4. ✅ Hono + SDK oficial do MCP; `server.js` fatiado em módulos. Falta: Zod nas ferramentas e TypeScript no `core`.
5. ✅ Postgres + Prisma ligados (migrações 0001–0003, inclusive imagens): projetos, versões, contas/sessões, agentes com token e escopos, log de operações, papéis por projeto (migrações 0001 e 0002). Importar .json antigos: `npm run importar`.
6. Plugins do núcleo (documento, exportação, MCP, fotos, imagem, identidade visual).
7. Edição simultânea de verdade (operações ou CRDT) e renderizador para `get_image`.

## Testes
`tests/*.test.js|ts` (unitários e API, `node --import tsx --test`, incluindo `workspace.test.js` e `db.test.ts`) e `tests/e2e/*.mjs` (Playwright).
Estado: 397 unitários passam (cada teste de servidor sobe um PGlite em memória, ~2 s; a suíte leva ~40 s). Os e2e **estão desatualizados** (ainda usam o chat e `window.designer.agent`); serão refeitos junto com a nova interface.
