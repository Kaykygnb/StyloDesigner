# Stylo — contexto

Este é o documento que explica **o que a ferramenta é e como o código está organizado**. Para saber **o que fazer a seguir**
e **o que depende de decisão do dono do projeto**, leia `PASSAGEM.md`. O **porquê** de cada escolha está em `decisoes.md`
(diário: só se acrescenta no fim, nunca se reescreve uma entrada antiga).

## 1. O que é

Um "Figma" para **agentes de IA e pessoas** prototiparem e construírem sites e aplicativos juntos. O canvas é CSS de
verdade: cada camada vira HTML/CSS. Um **servidor fica ligado**; qualquer agente (Claude Code, Codex, Cursor...) conecta pelo
**MCP**, cria um projeto, trabalha nele, **vê** o que fez (imagem), **audita** (acessibilidade, responsivo) e **exporta**: um
zip de HTML estruturado, um projeto React (Vite), tokens do design (CSS/JSON/Tailwind), ou puxa o código para construir o resto.
Pessoas usam um editor visual no navegador, no mesmo projeto, ao mesmo tempo (hoje um editor legado; será refeito).
Vai rodar localmente e também **hospedado e cobrado** — por isso Postgres, contas, tokens de agente, cotas.

**Foco atual: as ferramentas e o MCP, não o editor.** O editor (`apps/web`) é legado e será reconstruído depois.

## 2. Vocabulário (use estes nomes)

| Termo | Significa |
|---|---|
| **projeto** | um documento salvo no banco (tabela `Project`, coluna `doc` em JSONB), com revisão e versões |
| **documento / doc** | a árvore do projeto em memória: `pages[] → camadas`, mais `assets`, `styles`, `fonts`, `credits`, `brief`... (`core/types.ts`, `core/model.ts`) |
| **página** | uma aba do projeto (`doc.pages[]`); contém camadas na raiz |
| **tela / prancheta (board)** | um `frame` na raiz da página (ou dentro de uma `section`); vira **uma página HTML** na exportação |
| **camada (node/layer)** | um elemento: `frame`, `rect`, `ellipse`, `text`, `group`, `line`, `path`, `section`, `html`, `media`. Posição relativa ao pai, em px |
| **fixed / hug / fill** | modos de tamanho (`sizeX`/`sizeY`): medida fixa · do tamanho do conteúdo · preenche o pai. Hug/fill só o navegador sabe: o servidor **mede** com o Chromium |
| **estilo** | cor, texto, sombra ou gradiente compartilhado (`doc.styles`); camadas ligadas seguem o estilo e viram `var(--x)` no CSS |
| **variável** | número em px reutilizável (espaçamento, raio, fonte) |
| **modo** | claro/escuro de um estilo de cor |
| **breakpoint** | largura-alvo responsiva (padrão: `tablet` ≤1024, `mobile` ≤640); `set_responsive` cria as regras `@media` |
| **ferramenta (tool)** | operação MCP com nome, entrada validada por Zod e um `run` |
| **core tool / plugin tool** | ferramenta do núcleo (`core/tools`) ou de um plugin (`packages/plugins`) |
| **workspace** | no servidor, os projetos abertos em memória, com executor e papel por sessão (`apps/server/src/workspace`) |
| **runner** | o executor das ferramentas sobre o `store` (`core/tools/runner.ts` e módulos em `core/tools/runner/`) |
| **ator** | quem chama: pessoa ou agente (com **escopos** `read`/`comment`/`write`/`export`) |
| **conta mestre** | o dono do servidor (primeira conta): aprova pessoas e agentes |
| **biblioteca** | assets pessoais da conta (arquivos por sha256); usar num projeto **copia** o conteúdo |

## 3. Arquitetura

```
packages/core     @stylo/core     documento puro (sem DOM, roda em Node e navegador): modelo, store, comandos, CSS/HTML/SVG,
                                  exportações, auditoria, tokens, ferramentas MCP (Zod) e o executor
packages/plugins  @stylo/plugins  plugins embutidos: identidade (cor, tipografia, brief) e assets (provedores, biblioteca, fontes)
packages/db       @stylo/db       Postgres + Prisma: esquema, migrações SQL, cliente. PGlite = Postgres embutido (local/testes)
apps/server       @stylo/server   servidor Node (Hono): API, MCP, workspace, contas, renderizador (Chromium), ponte stdio
apps/web          @stylo/web      editor legado (JS, Vite). SERÁ REFEITO. Não gaste esforço aqui
tests/                            unitários e de API (importam os pacotes por @stylo/*); tests/e2e/ está desatualizado
scripts/                          utilitários soltos (veja "Scripts")
```
**Regra de dependência:** `web → core`, `server → core`, `plugins → core`, **`core → nada`** (não importa `web`, `server`, `db`,
nem Node/DOM exclusivos). Imports entre pacotes usam o nome (`@stylo/core/model.ts`); dentro do pacote, caminho relativo.
**Quem precisa de algo do servidor (navegador, rede, disco) recebe por injeção**: ex. `renderImage`, `auditLayout`, `vendor`,
`fetchImage` entram no `createRunner`/`exportSite` como funções; o core nunca chama o mundo de fora.

Stack: Node ≥ 22 (ESM), TypeScript (parcial, ver `PASSAGEM.md`), Hono + `@hono/node-server`, SDK oficial do MCP (Streamable HTTP),
Zod 4, Prisma 7.10 (fixo) com PGlite/Postgres, Playwright-core (Chromium para desenhar/medir e codec de edição local de fotos), linkedom, undici, Vite 8 (editor).

## 4. Rodar

```bash
npm install            # roda sozinho o `prisma generate` (cliente em packages/db/src/generated, no .gitignore)
npx playwright install chromium   # necessário para get_image, check_design (vazamento) e a medida de layout
npm start              # http://localhost:5173 — sobe servidor + editor legado (Vite) na mesma porta; banco PGlite local; sem login
npm run typecheck      # tsc em db, core, plugins, server (arquivos .js não são checados)
npm test               # ~440 testes, ~2–3 min (cada teste de servidor sobe um PGlite em memória)
npm run build          # vite build do editor legado (apps/web/dist)
```
Um arquivo de teste: `node --import tsx --import ./tests/_setup.mjs --test tests/<arquivo>`.
Conectar um agente: `claude mcp add --transport http stylo http://localhost:5173/mcp` (Claude Code); Codex/Claude Desktop (só stdio):
`node apps/server/bin/mcp.mjs`, que repassa para o `/mcp` (aceita `STYLO_TOKEN` e `--agente`).

**Variáveis de ambiente:** `PORT` · `DESIGNER_CONFIG` (arquivo de configuração; padrão `designer.config.json`) · `DATABASE_URL`
(Postgres; sem ela, PGlite em `designer.db/`) · `DESIGNER_DB_DIR` (`memory` nos testes) · `STYLO_AUTH=accounts` (login com contas;
padrão = modo local sem login) · `STYLO_DEV=1` (força o Vite) · `STYLO_BLOB_DIR` (arquivos grandes; `memory` nos testes) ·
`STYLO_SECRET_KEY` (32 bytes base64 para criptografar chaves de provedores; sem ela cria `*.secret`, que **não vai para o git**) ·
`STYLO_CHROMIUM_PATH` (caminho de um Chromium já instalado, em vez do baixado pelo Playwright; útil na nuvem) · `STYLO_LIBRARY_QUOTA_MB` (padrão 2048) · `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `POLYPIZZA_API_KEY` (chaves de provedores).

## 5. Mapa do código

### `packages/core/src`
| Arquivo | Faz |
|---|---|
| `types.ts`, `model.ts` | tipos e formato do documento; `createNode`, `makeDoc`, árvore, breakpoints, slugify |
| `store.js` | estado único, histórico (undo/redo), quando salvar. `loadDoc(..., {clean:true})` |
| `commands.js` | operações sobre a árvore (agrupar, duplicar, alinhar, auto layout, componentes...). Pede geometria a um "canvas" injetado |
| `components.ts`, `modes.ts`, `palettes.ts`, `color.ts`, `comments.ts` | componentes e `syncStyles` · modos de cor e variáveis · paletas · cores/contraste · comentários no documento |
| `css.js`, `html.js`, `cssedit.ts`, `codeassist.js` | camada → CSS/HTML (`exportHtml`, `generateCode`), HTML limpo, CSS livre |
| `svg.js`, `svgimport.js`, `geom.js`, `imagefx.js`, `image-assets.ts`, `image-size.ts`, `asset-kinds.ts` | SVG, geometria, efeitos de imagem, detecção de tipo/tamanho de arquivo por bytes |
| `image-edit.ts` | contrato do adaptador de edição de foto e escrita pura no documento: arquivo novo, primeira original preservada, restauração com dimensões |
| `fonts.ts`, `icons.ts`, `data/*` | Google Fonts e Material Symbols (listas geradas por `scripts/gerar-listas-google.mjs`) |
| `site-export.ts`, `zip.ts` | `exportSite` (zip HTML: páginas, `assets/`, `fonts/`, `CREDITS.txt`, players) · zip sem dependência |
| `export-react.ts`, `html-to-jsx.ts` | projeto **React/Vite** a partir do site exportado; conversor HTML→JSX |
| `tokens.ts`, `media-runtime.ts` | tokens (CSS/JSON/Tailwind) · players de 3D/Lottie para o zip |
| `audit.ts` | regras do `check_design` (contraste, texto pequeno, alt, títulos, alvo clicável, vazamento) |
| `plugin.ts` | contrato de plugin (`definePlugin`, `PluginTool`, `registerPluginTools`) |
| `tools/schema.ts` | **as 61 ferramentas do núcleo** (nome, descrição, entrada Zod) + `AGENT_INSTRUCTIONS` + validação (`validateToolArgs`: recusa argumento desconhecido) |
| `tools/runner.ts`, `tools/runner.js` | executor central: validação, aprovação, cancelamento, commit e restauração sem apagar alterações concorrentes; `.js` só reexporta para compatibilidade |
| `tools/runner/*` | módulos TypeScript por responsabilidade: `read`, `inspection`, `export`, `layout`, `layers`, `styles`, `projects`, `images`; helpers em `context`, `properties`, `presentation` e contratos em `types`. Renderizador, auditoria, download, edição de imagem e players continuam injetados |
| `tools/content.ts` | divide conteúdo grande em trechos UTF-8 |
| `sample-vitrine.js`, `version.ts`, `validate.ts` | projeto de exemplo · versão · validação do JSON |

### `packages/plugins/src`
`index.ts` (lista `builtinPlugins`) · `identidade/` (`cor.ts` OKLCH/WCAG, `tipografia.ts` escalas, `fontes.ts` pares de fontes, `index.ts`: 8 ferramentas) ·
`assets/` (`index.ts`: 10 ferramentas; `registry.ts`; `custom.ts` fontes cadastradas; `types.ts`; `providers/*`: openverse, pexels, pixabay, polypizza, fontsource, material).

### `apps/server/src`
| Arquivo | Faz |
|---|---|
| `main.ts` | liga tudo (config, banco, serviços, app HTTP, MCP, renderizador, plugins) e desliga limpo |
| `app.ts`, `context.ts`, `config.ts` | aplicação Hono · objeto `Services` · configuração (versões guardadas, política de agentes, chaves) |
| `http/guards.ts`, `http/identity.ts` | Host/Origin locais, limites de corpo, erros · quem fez o pedido, conta mestre, política de agentes |
| `routes/*` | `auth` (contas/agentes) · `projects` (projetos, `site.zip`, `react.zip`, atividade) · `library` · `system` (status/presença/SSE) · `legacy` (fotos e IA de imagem do editor antigo) |
| `mcp/gateway.ts`, `mcp/agent-calls.ts` | servidor MCP (SDK oficial, sessões, identidade do agente) · uma chamada: presença, travas por camada |
| `workspace/index.ts` | **onde o MCP trabalha**: projetos abertos, papel/escopos, grava sozinho (400 ms), recarrega se outro autor gravar, **medida de layout** preguiçosa |
| `workspace/measure.ts`, `workspace/model-canvas.js` | aplica as medidas do navegador em `node.w/h` · geometria sem DOM (aproximada) |
| `services/*` | `projects` (revisão, versões) · `auth`, `agents`, `operations` (log), `notes`, `sharing` · `assets` (imagens por sha256), `blobs`, `library`, `secrets` (AES-GCM), `asset-services`, `remote-image` (SSRF) · `renderer` (Chromium: `render`, `measure`, `overflow`) · `vendor` (players de mídia) |
| `services/image-operations.ts`, `services/image-codec.ts` | edição local de fotos: fila limitada, validação por bytes, codec na página Chromium vazia e isolada; filtros/ajustes/fundo usam `core/imagefx.js`. `main.ts` injeta o adaptador no workspace |
| `plugins.ts`, `events.ts`, `db.ts`, `dom-polyfill.ts` | liga plugins · SSE ao editor · abre o banco · DOMParser (linkedom) para `insert_icon` sem navegador |
| `instrucoes-agente.txt` | **o manual que cada agente recebe no `initialize`**. Edite com cuidado: é o "prompt" do produto |
| `presence.js`, `account.js`, `atomic.js`, `http-error.js`, `photos.js`, `imageai.js`, `providers.js`, `web.js` | legados em JS (presença/travas, perfil local, gravação atômica, fotos livres, IA de imagem, entrega do editor) |

### `packages/db`
`prisma/schema.prisma` (User, Agent, Project[doc JSONB, revision, docHash], ProjectMember, ProjectVersion, Operation, Note, Session, Asset, LibraryAsset, ProviderSecret, AssetSource) ·
`prisma/migrations/0001…0004` · `src/client.ts` (`createDb({url}|{pglite})`, aplica as migrações no PGlite).

### Scripts (`scripts/`)
`importar.ts` (traz `.json` antigos para o banco; funciona) · `gerar-listas-google.mjs` (atualiza listas de fontes/ícones; funciona) ·
`benchmark-site-load.mjs` (mede o HTML exportado no Chromium; funciona) · `auditar-colaboracao.mjs` e `gerar-miniatura-vitrine.mjs` (**legados do editor antigo; provavelmente quebrados**).

## 6. Como as coisas funcionam

**Uma chamada MCP:** agente → `/mcp` (Bearer token, ou nome do programa em modo local) → `workspace.call(ferramenta, args, ator)`:
confere escopo/papel → valida args (Zod; argumento desconhecido é erro) → [se for leitura que mostra tamanhos, **mede o layout real**] →
`runner.run` sobre o `store` → registra no log de atividade → em 400 ms `projects.write` grava no banco **com revisão** (conflito = 409,
nunca apaga trabalho alheio; conteúdo idêntico é ignorado por `docHash`) → avisa editores por SSE.

**Geometria sem navegador:** o servidor não tem DOM. `model-canvas.js` estima posições; para hug/fill o `renderer.measure` lê o layout real
no Chromium (JavaScript da página DESLIGADO, sem rede) e `measure.ts` grava em `node.w/h` com a regra da "medida de volta" do editor.
Fica "sujo" após escrita e só mede antes de leituras (`get_document`, `get_layer`, `find_layers`, `get_selection`, `get_image`, `check_design`) e após `build_layout`.

**Imagens, fontes e áudio saem do JSON:** viram linhas na tabela `Asset` por sha256 (`asset:<hash>` no JSON) e voltam como data URL ao carregar.
Mídia grande (vídeo/3D) dentro do projeto tem limite de 25 MB por isso. Exportar escreve arquivos reais (`assets/`, `fonts/`) e `CREDITS.txt`.

**Exportação:** `exportSite` é a base (HTML + CSS + arquivos). `export_site {format:"react"}` reaproveita essa saída e a reorganiza em componentes.
`export_tokens` sai direto do documento. Nada disso toca disco: devolve listas de arquivos; o servidor monta os zips.

**Plugins:** `definePlugin({id, name, description, tools:[{def, needsProject?, run}]})`. `def` vem de `defineTool` (Zod). O servidor registra as
definições no núcleo (aparecem em `tools/list` e passam pela mesma validação, escopos, travas e log) e guarda o `run`. `ctx` = `{actor, project:{store,commands,...}, services}`.

**Editar foto:** `edit_image` usa `imageOps` injetado pelo servidor. `renderer.withImagePage` abre uma página vazia, sem rede nem scripts da imagem;
só nosso código confiável roda em `evaluate`. O codec decodifica/gira/recorta/codifica, e a matemática pura de `imagefx.js` aplica efeitos aos pixels.
O executor confere documento, camada, fill e origem antes de aplicar o resultado. `origAssetId` guarda a primeira original e `editedAssetId` identifica
a edição atual. `restore_original` decodifica a original, reconfere o alvo e restaura referência/dimensões. Um passo de desfazer por chamada.
Limites e propostas por grupo em `FERRAMENTAS.md`; geração externa não foi ligada.

**Segurança (não negociável):** o HTML/CSS que entra vem de agentes e pessoas e **nunca** é confiável: sem `<script>`, sem JS no servidor, Chromium
isolado sem rede, downloads por endereço só com a proteção SSRF de `services/remote-image.ts`, Host/Origin locais, limites de corpo, CSP + sandbox em arquivos servidos.

## 7. Receitas

**Nova ferramenta do núcleo**
1. `tools/schema.ts`: `defineTool({ name, write, description, input: z.object({...}) })`. Descrição em português, com o que fazer em caso comum e o que a ferramenta NÃO faz.
2. `tools/runner/<área>.ts`: um método com o mesmo nome no módulo responsável. `tools/runner.ts` junta os módulos em `READ` (leitura) e `WRITE` (escrita). Erros: `throw new Error('mensagem com o conserto')`. A validação e o commit ficam no executor central.
3. `apps/server/src/instrucoes-agente.txt`: uma linha na tabela de ferramentas.
4. Testes: contar ferramentas em `tests/agente.test.js` e `tests/mcp-sdk.test.js`; teste da ferramenta (padrão: `tests/tokens.test.ts` usa o workspace como um agente).
5. Se mudou o comportamento percebido: entrada em `decisoes.md`.

**Nova ferramenta de plugin:** adicione `{def, needsProject, run}` em `packages/plugins/src/<plugin>/index.ts`; o resto (registro, validação, escopos) é automático. Contagem nos mesmos dois testes.

**Novo provedor de assets:** `packages/plugins/src/assets/providers/<nome>.ts` seguindo `types.ts`, registrar em `registry.ts`; teste em `tests/biblioteca.test.ts` com resposta simulada. Conferir a documentação oficial e a licença antes.

**Novo formato de exportação:** função pura em `core` que recebe o `doc` e devolve `{files, warnings}` (modelo: `export-react.ts`, que parte de `exportSite`); `format` no `export_site`, rota `…/<formato>.zip` em `routes/projects.ts`, `<formato>_zip_url` no `export_zip` (`workspace/index.ts`). Teste: estrutura dos arquivos + (uma vez, à mão) instalar e compilar de verdade.

**Migração do banco:** edite `schema.prisma`; gere o SQL com `npx prisma migrate diff --from-schema <antigo> --to-schema packages/db/prisma/schema.prisma --script` para `packages/db/prisma/migrations/000N_nome/migration.sql` (não há Postgres de verdade aqui para `migrate dev`); `npm run db:generate`; o PGlite aplica sozinho.

**"Usar a ferramenta como um agente" (o melhor teste de qualidade):** escreva um roteiro descartável que sobe `createWorkspace` com `createRenderer` (veja `tests/workspace.test.ts` e `tests/audit.test.ts`), monte uma página só com `workspace.call(...)`, olhe o `get_image` e rode `check_design`. Foi assim que se acharam os 6 atritos de `decisoes.md` (2026-10-11, "Uso a ferramenta como um agente").

## 8. Convenções

- **Mensagens para o agente em português, dizendo o conserto** ("Use sizeX:\"fill\" no texto..."), nunca só o sintoma. Erro técnico cru ("Cannot read properties of undefined") é bug.
- **Módulos pequenos, uma responsabilidade por arquivo.** O executor já foi dividido em TypeScript. Restam `css.js` (~1150 linhas) e `commands.js` (~1250): divida **sob a cobertura dos testes**, sem mudar comportamento.
- **TypeScript gradual:** arquivo novo em `.ts`; converta um `.js` só quando for mexer nele. `noImplicitAny` está desligado de propósito.
- **Core puro:** sem DOM, sem disco, sem rede; o que vier de fora entra por injeção.
- **Argumentos das ferramentas são estritos** (desconhecido = erro); o conteúdo livre (`props`) é conferido pelo executor (`applyProps`).
- **Decisão que muda comportamento ou arquitetura → `decisoes.md`** (só acrescentar). Pendência/atalho → tabela de "pulados" em `PASSAGEM.md`.
- **Antes de dizer que funciona, teste de verdade** (suíte + uma checagem real). Diga com franqueza o que **não** foi verificado.
- Sem `push` nem PR sem o dono pedir.

## 9. Testes

`tests/*.test.js|ts` rodam com `node --test` (+`tsx`); `tests/_setup.mjs` põe o banco e os blobs em memória. Servidores de teste esperam até 60 s subir (carga).
Testes que dependem do Chromium se **pulam** se ele não estiver instalado (`npx playwright install chromium`). Há CI em `.github/workflows/ci.yml` (Node 22 e 24, sem Chromium).
`tests/e2e/*.mjs` são do editor antigo (usam o chat removido): **não rodam**; serão refeitos com o editor novo.
`tests/runner-seguranca.test.ts` cobre recusa/ausência de aprovação, administrador externo, cancelamento durante aprovação,
restauração de falha parcial e preservação de edição concorrente. `tools/runner.js` permanece como import compatível usado pelos testes.
`tests/image-operations.test.ts` confere pixels, transparência, formatos, bloqueio de rede, limites, fila, original, histórico e concorrência.

## 10. Estado e limites que pegam de surpresa

- `edit_image` funciona pelo servidor com Chromium. `generate_image_edit` continua indisponível pelo MCP; não confundir edição local com geração por IA.
- Colaboração: se duas pessoas gravam o mesmo projeto, a gravação de fora vence e o workspace recarrega (não há edição simultânea de verdade ainda).
- Seleção e histórico (`undo`) são do projeto, não da sessão.
- O servidor só aceita Host/Origin locais e escuta em 127.0.0.1: **ainda não está pronto para a internet** (ver `PASSAGEM.md`).
- Os tamanhos medidos valem para o desktop (e para o breakpoint pedido em `get_image`/`check_design`); `get_layer` mostra o do desktop.
- Veja `PASSAGEM.md §5b` para a lista completa do que foi pulado de propósito.
