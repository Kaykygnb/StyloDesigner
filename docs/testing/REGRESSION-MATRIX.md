# Matriz de regressão

| Capacidade | Operação | Código | Testes atuais | Risco | Tarefa |
|---|---|---|---|---|---|
| Documento | criar/abrir/versão | `model.ts`, `workspace`, `projects` | `versao`, `project-identity`, `db` | migração/perda | DOC-DB-001 |
| Camadas | update/batch/layout | `runner/layers.ts`, `batch.ts`, `layout.ts` | `update-layers*`, `arrange*` | mutação parcial | DOC-CORE-001 |
| MCP | list/call/session | `schema.ts`, `gateway.ts`, `agent-calls.ts` | `mcp-*`, `agent-*` | contrato/escopo | DOC-MCP-001 |
| Studio | editar/exportar | `apps/studio`, `studio-calls.ts` | `studio-ui`, `studio-api`, `studio-parity` | divergência UI/MCP | DOC-STUDIO-001 |
| Exportação | HTML/React/ZIP | `site-export.ts`, `export-react.ts` | `export*`, `site-export` | saída inválida | DOC-CORE-002 |
| Assets | biblioteca/providers | `library.ts`, `blobs.ts`, plugins | `biblioteca*`, `assets*` | rede/licença | DOC-PLUGIN-001 |
| Auth | login/agent scopes | `auth.ts`, `identity.ts`, `agents.ts` | `conta*`, `api-seguranca` | acesso indevido | DOC-SERVER-001 |
| Engenharia | CI da beta/PR | `.github/workflows/ci.yml` | `typecheck`, suíte completa, `build`, `validate-tasks` | regressão de tipos/build não detectada | DOC-ENG-001 |
| Backups locais | snapshot/lista/restore pendente | `services/backups.ts` | `backups.test.ts` (arquivos; CHECKPOINT simulado) | data/ordem incorreta, restauração de arquivos | DOC-SERVER-002 |
| Entrada humana | login/senha temporária/logout/menus | `lib/app.ts`, `Login.tsx`, `Home.tsx` | `studio-login-fluxo.mjs`, suíte completa | chamadas antes da troca, contexto anterior, confusão de papéis, overflow mobile | DOC-STUDIO-002 |
| Administração accounts | ambiente E2E e CI obrigatória | `tests/e2e/run.mjs`, `ci.yml` | `studio-admin-fluxo.mjs`, `studio-login-fluxo.mjs` | dados compartilhados, servidor ausente, falha ignorada | DOC-ENG-002 |
| Workspace humano | conta + sid | `studio-calls.ts`, `routes/studio.ts` | `studio-api` (accounts), `studio-login-fluxo.mjs` | acesso a documento alheio por reutilização de sid | DOC-SERVER-003 |
| Compartilhamento ativo | downgrade/revogação/grant | `projects.access`, `workspace`, `routes/studio` | `studio-api` (accounts), `workspace` (MCP), `plugins` | papel/grant antigo permitir leitura ou mutação indevida | DOC-SERVER-004 |
| Fixtures de QA automatizado | env herdado/encerramento/remoção | `tests/helpers/fixture-lifecycle.mjs`, fixtures MCP/PG | `fixture-lifecycle`, `mcp-compatibilidade`, `postgres-integracao` | banco real herdado, PANIC por remoção prematura, erro de startup mascarado | DOC-ENG-003 |

## Isolamento dos fixtures legados (DOC-ENG-004)

- `tests/test-env.test.js`: subprocesso com setup e sentinelas inválidas verifica limpeza de DATABASE_URL, banco/blobs em memória e credenciais novas; helper exige configuração própria e preserva overrides explícitos. Nenhuma conexão externa nessa regressão.
- Fixtures API, assets, biblioteca, configuração, contas, gravação atômica, ZIP, MCP SDK/contas, servidor e Studio API/UI usam `isolatedServerEnv` e um hook `cleanupFixture`, com clientes antes dos filhos e remoção após saída confirmada. `server.test.js` agora tem configuração temporária própria.
- Execução direta sem setup global, env hostil: `DATABASE_URL=sentinela-invalida STYLO_BLOB_DIR=/nao-usar-blobs STYLO_SECRET_KEY=herdado node --import tsx --test --test-timeout=90000 tests/test-env.test.js tests/fixture-lifecycle.test.js tests/api.test.js tests/config-autorizacao.test.js tests/mcp-sdk.test.js`.
- PostgreSQL real continua exclusivamente provisionado por `tests/postgres-integracao.test.js`, com URL própria; não passar env humano como overrides do helper. Cleanup não encerra processos alheios. A regressão de SIGKILL POSIX permanece explicitamente ignorada em Windows.

## Restore PGlite real retomado (DOC-DB-001)

`tests/restore-pglite.test.ts` prova snapshot/preparação de restore, banco ativo intacto até fechamento, restauração/migração0014 real, projeto/PNG/versão/membership/grant com hashes/contagens, cópia de segurança posterior reaberta e falha de fonte ausente com original intacto. Fixture pré0014 reconstituída por SQL em banco sintético, não backup histórico real. Combinado restore/backups/db5/5; não comprova pg_dump/pg_restore, biblioteca de blobs externos, gestão de chaves ou escrita concorrente. Sem alteração de runtime.

## Paridade Studio × MCP (DOC-STUDIO-001)

`tests/studio-parity.test.js` executa o mesmo roteiro pelos callers reais (`createStudioCaller` e `createToolCaller`) em projetos PGlite equivalentes: criação, update unitário, lote, arranjo, `build_layout`, undo/redo, seleção, metadados de `export_site` e trilha `get_activity` por ator (`USER` × `AGENT`). A comparação ignora ids gerados. Agente com escopo `read` e pessoa `VIEWER` recusam as mesmas famílias de escrita sem alterar documento nem auditoria. `export_zip` de VIEWER no painel e o agente desse membro com scope `export` recebem a mesma recusa das escritas e não devolvem URL; o agente só de leitura do dono continua na mensagem de scope. COMMENTER no painel ainda recebe o endereço. O download HTTP do zip recusa VIEWER em `tests/export-zip-http.test.ts`. A matriz nova não abre Chromium nem o transporte HTTP/SDK.
