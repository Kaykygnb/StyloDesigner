# Desenvolvimento

## Rotina

```bash
npm install
npm run typecheck          # tipos de db, core, plugins, server e studio
npm test                   # suíte completa (cerca de 600 testes, 2 a 4 min)
npm run test:e2e           # administração, contra um servidor em STYLO_AUTH=accounts (APP_URL)
npm run build              # compila o painel
npm run docs:ferramentas   # regenera docs/FERRAMENTAS-MCP.md
```

Um teste isolado: `node --import tsx --import ./tests/_setup.mjs --test tests/arrange.test.ts`.

> O `typecheck` **não cobre arquivos `.js`** (por exemplo `css.js`, `store.js`, `commands.js`). Um erro ali só aparece ao rodar: depois de mexer neles, rode ao menos `tests/agente.test.js`.

## Testes

- `tests/*.test.{js,ts}` com `node:test`; o ambiente de teste sobe o servidor real em memória (`DESIGNER_DB_DIR=memory`).
- `tests/studio-ui.test.js` usa Chromium (Playwright). Sem navegador instalado ele é **pulado**.
- Arrastos no canvas são simulados por **eventos enviados por script**: o mouse nativo sobre um `iframe` derruba o Chromium automatizado.
- Não enfraqueça um teste para ele passar. Se o teste está errado, explique por quê; se o código está errado, corrija o código.

## Receitas

### Nova ferramenta MCP (núcleo)

1. **Catálogo:** `defineTool({ name, write, needs, description, input: z.object({...}) })` em `packages/core/src/tools/schema.ts` (ou nos `*-schema.ts` do grupo) e inclua em `AGENT_TOOLS`.
2. **Execução:** o handler em `packages/core/src/tools/runner/*.ts` (`read.ts`, `layers.ts`, `organization.ts`, `vector.ts`, `code.ts`, `arrange.ts`…) e registre em `READ` ou `WRITE` no `runner.ts`.
3. **Mensagem de permissão e atividade:** `runner/presentation.ts` (`describeCall`) e, se mexe no documento todo, `DOCUMENT_WIDE_TOOLS` em `apps/server/src/presence.js`.
4. **Manual do agente:** `apps/server/src/instrucoes-agente.txt`.
5. **Testes:** um teste da ferramenta e a contagem total em `tests/mcp-sdk.test.js`.
6. **Painel:** só depois, o botão (que chama `run('sua_ferramenta', {...})`).
7. `npm run docs:ferramentas`.

Erros devem estar **em português e dizer o conserto** ("Use sizeX: fill no texto…"); argumento desconhecido é erro com a lista dos aceitos.

### Nova propriedade em `update_layer`

Adicione ao `SIMPLE` ou `SPECIAL` de `runner/properties.ts` com validação, ao texto `PROP_HELP` em `schema.ts` e um teste em `tests/arrange-props.test.ts`. **Se o painel envia uma propriedade que o servidor não conhece, a ação falha** (foi o que quebrava o arrasto de nós de vetor).

### Novo plugin

`packages/plugins/src/<id>/index.ts` com `definePlugin({ id, name, description, category, version, author, license, permissions, tools: [{ def: defineTool(...), run }] })` e inclusão em `builtinPlugins` (`packages/plugins/src/index.ts`). Plugins só **calculam e sugerem**; quem decide é o agente ou a pessoa. Teste em `tests/plugins.test.ts`.

### Novo provedor de assets

`packages/plugins/src/assets/providers/<nome>.ts`, registrado em `registry.ts`, com licença e crédito preenchidos em cada resultado.

### Migração do banco

1. Altere `packages/db/prisma/schema.prisma`.
2. Crie `packages/db/prisma/migrations/NNNN_nome/migration.sql` (próximo número).
3. `npm run db:generate`.
4. Ajuste `tests/db.test.ts` se preciso. O servidor aplica as migrações ao abrir o banco.

### Nova tela ou painel no estúdio

Componente em `apps/studio/src/editor/` ou `screens/`, estado em `lib/app.ts`, textos em `lib/i18n.ts` (pt-BR **e** en-US). Toda ação passa por `run()` ou `tool()`.

## Convenções

- Português do Brasil em textos, mensagens e comentários; nomes de código em inglês.
- Commits: `tipo(área): o que mudou` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`).
- Arquivos pequenos e com um propósito; não crie módulos que fazem mil coisas.
- Não commite segredos (`*.secret`, `designer.config.json`, `designer.db*/`, `designer.blobs/`).
- Fim de linha: o `.gitattributes` normaliza para LF.

## Segurança ao mexer

Veja [ARQUITETURA](ARQUITETURA.md#segurança-princípios). Em especial: nunca `allow-scripts` no `iframe` do canvas; nunca executar HTML ou CSS de agentes fora do modo Apresentar; nada de rede liberada no Chromium de desenho.
