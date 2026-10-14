# Stylo

O Stylo é um editor de design em que o canvas é CSS de verdade. A pessoa desenha no Studio. Um agente de IA desenha pelo MCP. Esses são os dois núcleos do produto, e os dois passam pelas mesmas ferramentas: o painel não grava o documento por fora delas.

Há **120 ferramentas** (97 no núcleo, 23 em plugins embutidos). O catálogo foi conferido nesta revisão com `npm run docs:inventario -- --check` e com `tools/list` no MCP.

A documentação de engenharia está em [docs/README.md](docs/README.md). O que o código faz hoje está em [docs/product/CAPABILITIES.md](docs/product/CAPABILITIES.md) e [docs/product/EVOLUTION.md](docs/product/EVOLUTION.md). O plano da alpha local e o índice de tarefas estão em [docs/planning/ROADMAP.md](docs/planning/ROADMAP.md) e [docs/planning/BACKLOG.md](docs/planning/BACKLOG.md).

## Estado desta branch

A branch se chama `v0.1.0-beta` e o pacote é `0.1.0`. Isso não é uma release estável. Trate este checkout como **pré-alpha**: dados, formato do banco e APIs podem mudar. Não use para trabalho que você não possa perder.

A alpha local pública — instalar, criar a conta e desenhar na própria máquina — ainda é uma proposta, [DOC-ENG-006](docs/planning/tasks/engineering/DOC-ENG-006.md). Ela está bloqueada, inclusive pelo login por nome de usuário ([DOC-SERVER-011](docs/planning/tasks/server/DOC-SERVER-011.md)). Essa tarefa segue em aberto no backlog, e outro trabalho está mexendo no login. Este texto não descreve os campos da tela de entrada.

## O que funciona hoje

Conferido no commit `c5e6eba` desta branch, com o código e com os comandos da seção [Como esta página foi conferida](#como-esta-página-foi-conferida).

- Documento com páginas, camadas, layout, estilos, variáveis, componentes e instâncias, estados visuais, interações de protótipo, comentários e assets. O núcleo (`packages/core`) é quem valida e aplica a mudança. O Studio chama ferramenta pela API (`apps/studio/src/lib/api.ts`). O MCP chama a mesma implementação por outro adaptador.
- Editor vetorial no núcleo, no Studio e nas ferramentas. O inventário curto está abaixo; a tabela longa está em [EVOLUTION.md](docs/product/EVOLUTION.md).
- Exportação de HTML, site estático, projeto React, design tokens e zip. A matriz, com avisos e limites, está em [docs/modules/core/EXPORT-MATRIX.md](docs/modules/core/EXPORT-MATRIX.md).
- Contas, agentes, presença e locks, num único processo. Colaboração aqui é esse processo, não vários servidores.
- Banco local em PGlite, ou Postgres se `DATABASE_URL` estiver definida. Os dois caminhos subiram nesta revisão.
- MCP por HTTP em `/mcp` (SDK oficial no servidor) e ponte stdio em `apps/server/bin/mcp.mjs`.

Plugins embutidos: identidade, assets, acessibilidade, Tailwind, SEO e QR. Sem uma lista em `designer.config.json`, eles ficam ligados. Uma lista em `plugins.enabled` restringe quais rodam. As 23 ferramentas de plugin só respondem quando o plugin está ligado; o catálogo de 120 conta as que estão registradas.

Medição de layout, captura de imagem e edição local de imagem usam Chromium no servidor. Sem o navegador, essas chamadas falham com uma mensagem que aponta `npx playwright install chromium` ou `STYLO_CHROMIUM_PATH`. Edição generativa de imagem é recusada: o servidor não tem essa implementação.

## Editor vetorial

Isto já está no código. Não é plano.

- Caminho com pontos e alças Bézier cúbicas (`hin` / `hout`), vários contornos, aberto ou fechado.
- Caneta e lápis no canvas; edição de nós (mover, alça, vários nós, setas). Outro contorno se edita pela ferramenta `edit_vector_node`, com `contour_index`. O overlay de nós desenha o contorno principal.
- Polígono e estrela paramétricos, rede de vetor (`vectorNetwork`), booleanas (união, subtração, interseção, exclusão) e shape builder (2 a 6 formas, modo add ou subtract).
- Contorno: cor, opacidade, espessura, sólido/tracejado/pontilhado, ponta, junção, marcadores e alinhamento center/inside/outside.
- Operações de caminho: contorno vira preenchimento, deslocar, simplificar, dividir, unir, inverter, interpolar e cantos arredondados.
- Importar SVG como vetor editável e exportar SVG pelo mesmo desenho de caminho que o canvas usa (`toSvg` / `pathSvg`). Não existe uma ferramenta chamada `export_svg`.

Limites que o próprio código declara:

- `stroke_to_path` recusa tracejado fechado e posição inside/outside.
- `offset_path` recusa caminho aberto e distância zero.
- `interpolate_vectors` exige a mesma quantidade de contornos, nós, fechamento e viewBox.
- A booleana achata as curvas em polígonos e reajusta. O resultado pode ter mais pontos. As fontes ficam guardadas e podem ser editadas; o contorno visível é o resultado achatado.
- A exportação SVG omite sombra interna e `backdrop-filter`. Contorno inside/outside é aproximado. Gradiente cônico usa a primeira parada.
- A importação SVG avisa e não traz: máscara de luminância, imagem embutida, texto em curva, `<use>` externo, animação e filtro que não seja sombra. Gradiente linear/radial entra aproximado. Clip simples vira máscara.

## O que ainda não está

Ausência no código, distinta dos limites acima. O plano que cita estes itens é o horizonte da [EVOLUTION.md](docs/product/EVOLUTION.md) e a alpha em [ROADMAP.md](docs/planning/ROADMAP.md). Nada disso entra “de brinde” nesta branch.

| Tema | Situação |
|---|---|
| PDF, PPTX, modelo 3D / glTF, React Native | Não há ferramenta nem tipo de camada para isso |
| JavaScript livre no documento | O protótipo é declarativo. O site exportado avisa que a interação não roda |
| Alpha pública local | Proposta [DOC-ENG-006](docs/planning/tasks/engineering/DOC-ENG-006.md), ainda bloqueada |
| Login por nome de usuário | Tarefa em aberto, [DOC-SERVER-011](docs/planning/tasks/server/DOC-SERVER-011.md). Outro trabalho está alterando essa entrada. A tela não é documentada aqui |
| Modo sem conta (`STYLO_AUTH=local`) | Existe e sobe, para teste explícito. A instalação normal pede conta. A retirada está proposta em [DOC-SERVER-009](docs/planning/tasks/server/DOC-SERVER-009.md) |
| Dump e restore de Postgres | O teste de integração sobe um Postgres descartável. `pg_dump` / `pg_restore` continuam pendentes em [DOC-DB-001](docs/planning/tasks/database/DOC-DB-001.md) |
| Hospedar para a internet | Fora desta branch. [DOC-SERVER-008](docs/planning/tasks/server/DOC-SERVER-008.md) |
| Remake visual do Studio | Proposta [DOC-STUDIO-005](docs/planning/tasks/studio/DOC-STUDIO-005.md) |
| Clientes MCP de interface | Claude Desktop, Cursor, Windsurf e clientes hospedados não foram abertos nesta revisão. A matriz e as lacunas estão em [docs/mcp/COMPATIBILIDADE.md](docs/mcp/COMPATIBILIDADE.md) |

O processo escuta em `0.0.0.0` se `STYLO_HOST` não for `127.0.0.1` nem `localhost`. Conta é obrigatória no modo padrão, e `GET /api/status` responde sem sessão. Não publique este processo numa rede aberta.

## Instalar e rodar

### Requisitos

O `package.json` da raiz declara só isto:

```json
"engines": { "node": ">=22" }
```

Não há `engines.npm`. O `package-lock.json` está em `lockfileVersion` 3. A CI (`.github/workflows/ci.yml`) roda em Node 22 e Node 24.

Nesta revisão, `npm install` em Node **v22.14.0** e npm **10.9.9** terminou e avisou que a dependência `undici@8.11.2` pede Node `>=22.19.0`. O servidor e os testes abaixo rodaram mesmo assim nessa versão.

### Clone

```bash
git clone -b v0.1.0-beta https://github.com/Kaykygnb/StyloDesigner.git
cd StyloDesigner
npm install
```

`npm install` também roda `prisma generate` (`npm run db:generate`). Não commite `designer.config.json`, `designer.db`, `*.secret` nem `*.blobs`: estão no `.gitignore`.

### Servidor

`npm start` e `npm run dev` executam o mesmo comando: `node --import tsx apps/server/src/main.ts`. Não há um servidor Vite separado.

```bash
npm start
```

Abra `http://localhost:5173/studio/`. A raiz `/` redireciona para `/studio/`. A porta padrão é 5173; `PORT` muda.

Sem a pasta `apps/studio/dist`, o mesmo processo entrega o Studio pelo Vite. Para o pacote de produção:

```bash
npm run build
npm start
```

`npm run build` gera o `dist` e avisa que o JavaScript passa de 500 kB (nesta revisão, 861,69 kB). Com `dist` presente, `npm start` serve esses arquivos. `STYLO_DEV=1` força o Vite mesmo assim.

Para escutar só nesta máquina:

```bash
STYLO_HOST=127.0.0.1 npm start
```

`STYLO_HOST=localhost` tem o mesmo efeito. Outro valor, ou a variável ausente, escuta em `0.0.0.0`.

### Banco

**PGlite, o padrão.** Sem `DATABASE_URL`, o servidor cria a pasta `designer.db` ao lado do caminho de configuração (`designer.config.json`, ou o arquivo em `DESIGNER_CONFIG`). As migrações SQL de `packages/db/prisma/migrations` rodam na subida. Também aparece um arquivo `designer.secret` (a chave local). `DESIGNER_DB_DIR` escolhe outra pasta. Se a pasta já estiver aberta por outro processo, o servidor recusa e pede para fechar ou apontar outro diretório.

**Postgres.** O servidor usa a URL e não aplica migração sozinho. Não existe script `db:migrate` no `package.json`. O comando que aplicou as 15 migrações nesta revisão foi:

```bash
DATABASE_URL='postgresql://USUARIO:SENHA@127.0.0.1:5432/stylo' npx prisma migrate deploy --config packages/db/prisma.config.ts
DATABASE_URL='postgresql://USUARIO:SENHA@127.0.0.1:5432/stylo' npm start
```

O log diz `Postgres (DATABASE_URL)`. Se `DATABASE_URL` faltar, o Prisma desse comando cai no endereço escrito em `packages/db/prisma.config.ts` (`postgresql://stylo:stylo@localhost:5432/stylo`). Defina a variável. Copiar a pasta do PGlite não restaura um Postgres; dump e restore continuam pendentes.

### Conta

No modo padrão o servidor pede conta. A primeira conta criada administra a instalação. O formato dessa tela está mudando; siga o que o Studio mostrar.

`STYLO_AUTH=local` sobe sem essa entrada. É um desvio explícito de teste, não o caminho desta instalação.

### Cliente MCP

Com o servidor no ar e uma conta, crie um agente no Studio. O painel mostra o endereço (`http://localhost:5173/mcp`, ou a porta que você usou) e um token `stylo_agt_...` uma vez. O cliente envia:

```http
Authorization: Bearer stylo_agt_...
```

O painel também copia um JSON neste formato e, para o Claude Code, um comando `claude mcp add`. Esta revisão não abriu Claude Desktop, Cursor nem Windsurf. O que foi chamado de verdade: `initialize` e `tools/list` em `POST /mcp` com o Bearer (120 ferramentas) e a ponte stdio abaixo. Sem token, no modo de contas, `/mcp` responde 401.

A ponte, com o servidor já rodando:

```bash
DESIGNER_URL=http://127.0.0.1:5173 STYLO_TOKEN='stylo_agt_...' node apps/server/bin/mcp.mjs
```

`DESIGNER_URL` padrão é `http://localhost:5173`. `STYLO_AGENT` ou `--agente "Nome"` só mudam o nome na presença. Mensagens para a pessoa saem no stderr; o stdout é o JSON do protocolo.

## Testes

Suíte do repositório, a que a CI chama de unitária:

```bash
npx playwright install chromium
npm test
```

`npm test` é `node --import tsx --import ./tests/_setup.mjs --test --test-timeout=90000 tests/*.test.js tests/*.test.ts`. Os testes de imagem e de layout pulam o caso se o Chromium não existir; com o navegador instalado, esta revisão ficou em **633 passaram, 0 falharam, 0 foram pulados** (Node v22.14.0, cerca de 118 s). A suíte zera `DATABASE_URL` e usa banco em memória. Um teste sobe um Postgres descartável; `STYLO_SKIP_POSTGRES_TEST=1` pula esse teste de propósito.

O fluxo de navegador (entrada e administração), o mesmo job da CI:

```bash
npm run test:e2e
```

Ele roda `npm run build` e depois `node tests/e2e/run.mjs`. Nesta revisão os casos impressos passaram. O roteiro cobre a entrada humana; os campos da tela continuam sujeitos à DOC-SERVER-011.

Tipos, nos cinco workspaces:

```bash
npm run typecheck
```

Conferência de documentação, também na CI:

```bash
npm run docs:inventario -- --check
node docs/planning/validate-tasks.mjs
```

Gates de mudança de código: [docs/engineering/QUALITY-GATES.md](docs/engineering/QUALITY-GATES.md).

## Como esta página foi conferida

Data: 2026-10-14. Código: `v0.1.0-beta` em `c5e6eba`. Clone limpo com `git clone -b v0.1.0-beta https://github.com/Kaykygnb/StyloDesigner.git`, mais um clone local do mesmo commit. Node v22.14.0, npm 10.9.9.

Rodados com sucesso: `npm install`, `npm start`, `npm run dev`, `npm run build` seguido de `npm start` (HTML de produção, sem Vite), `STYLO_DEV=1`, `STYLO_HOST=127.0.0.1`, PGlite sem `DATABASE_URL`, `npx prisma migrate deploy --config packages/db/prisma.config.ts` contra um Postgres descartável e `npm start` com `DATABASE_URL`, MCP HTTP com Bearer, `node apps/server/bin/mcp.mjs`, `STYLO_AUTH=local`, `npx playwright install chromium`, `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run docs:inventario -- --check` e `node docs/planning/validate-tasks.mjs`.

Não foi conferido aqui: abrir Cursor, Claude Desktop ou Windsurf; uso prolongado com várias pessoas; `pg_dump` / `pg_restore`; navegador que não seja o Chromium do Playwright.

## English

Stylo is a design editor whose canvas is real CSS. One core is the Studio. The other is MCP, for an AI agent. Both call the same tools. The panel does not write the document on its own. There are 120 tools: 97 in the core and 23 in built-in plugins.

Branch `v0.1.0-beta` (package `0.1.0`) is a pre-alpha. Data and APIs can change. The local public alpha is still a proposal ([DOC-ENG-006](docs/planning/tasks/engineering/DOC-ENG-006.md)) and is blocked, including by username login ([DOC-SERVER-011](docs/planning/tasks/server/DOC-SERVER-011.md)), which is still an open task and is being changed elsewhere. This file does not describe the login form.

What works: pages, layers, layout, styles, variables, components, states, prototype interactions, comments, assets, the vector editor summarized above, HTML / site / React / token / zip export, accounts, agents, presence, and locks on one process. PGlite is the default database. Postgres works when `DATABASE_URL` is set and migrations were applied. Image measurement and local image edits need Chromium. Generative image edit is refused.

Not in the code: PDF, PPTX, 3D, React Native, and free JavaScript in the document. Prototype interactions are not executed in the exported site. SVG import and export drop the cases listed above. Postgres dump/restore is still open. GUI MCP clients were not launched in this pass.

Requirements from `package.json`: Node.js `>=22`. No npm engine is declared. On Node v22.14.0 / npm 10.9.9, install warns that `undici` wants Node `>=22.19.0`; the server and tests still ran.

```bash
git clone -b v0.1.0-beta https://github.com/Kaykygnb/StyloDesigner.git
cd StyloDesigner
npm install
npm start
```

Open `http://localhost:5173/studio/`. `npm run dev` is the same process. `npm run build` then `npm start` serves the production bundle. `STYLO_DEV=1` forces Vite. `STYLO_HOST=127.0.0.1` binds localhost; otherwise the process listens on `0.0.0.0`.

PGlite needs no extra install. For Postgres, there is no `db:migrate` script:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/stylo' npx prisma migrate deploy --config packages/db/prisma.config.ts
DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/stylo' npm start
```

The default mode asks for an account. The first account administers the installation. `STYLO_AUTH=local` skips that screen and is a test switch.

MCP: create an agent in the Studio, then call `http://localhost:5173/mcp` with `Authorization: Bearer stylo_agt_...`. Or, with the server already running:

```bash
DESIGNER_URL=http://127.0.0.1:5173 STYLO_TOKEN='stylo_agt_...' node apps/server/bin/mcp.mjs
```

Tests:

```bash
npx playwright install chromium
npm test
npm run test:e2e
npm run typecheck
```

This review: 633 tests passed, 0 failed, 0 skipped, and the browser e2e cases passed.
