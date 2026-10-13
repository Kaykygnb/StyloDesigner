# Matriz de regressão

| Capacidade | Operação | Código | Testes atuais | Risco | Tarefa |
|---|---|---|---|---|---|
| Documento | criar/abrir/versão | `model.ts`, `workspace`, `projects` | `versao`, `project-identity`, `db` | migração/perda | DOC-DB-001 |
| Camadas | update/batch/layout | `runner/layers.ts`, `batch.ts`, `layout.ts` | `update-layers*`, `arrange*` | mutação parcial | DOC-CORE-001 |
| MCP | list/call/session | `schema.ts`, `gateway.ts`, `agent-calls.ts` | `mcp-*`, `agent-*` | contrato/escopo | DOC-MCP-001 |
| Studio | editar/exportar | `apps/studio`, `studio-calls.ts` | `studio-ui`, `studio-api` | divergência UI/MCP | DOC-STUDIO-001 |
| Exportação | HTML/React/ZIP | `site-export.ts`, `export-react.ts` | `export*`, `site-export` | saída inválida | DOC-CORE-002 |
| Assets | biblioteca/providers | `library.ts`, `blobs.ts`, plugins | `biblioteca*`, `assets*` | rede/licença | DOC-PLUGIN-001 |
| Auth | login/agent scopes | `auth.ts`, `identity.ts`, `agents.ts` | `conta*`, `api-seguranca` | acesso indevido | DOC-SERVER-001 |
| Engenharia | CI da beta/PR | `.github/workflows/ci.yml` | `typecheck`, suíte completa, `build`, `validate-tasks` | regressão de tipos/build não detectada | DOC-ENG-001 |
| Backups locais | snapshot/lista/restore pendente | `services/backups.ts` | `backups.test.ts` (arquivos; CHECKPOINT simulado) | data/ordem incorreta, restauração de arquivos | DOC-SERVER-002 |
| Entrada humana | login/senha temporária/logout/menus | `lib/app.ts`, `Login.tsx`, `Home.tsx` | `studio-login-fluxo.mjs`, suíte completa | chamadas antes da troca, contexto anterior, confusão de papéis, overflow mobile | DOC-STUDIO-002 |
| Administração accounts | ambiente E2E e CI obrigatória | `tests/e2e/run.mjs`, `ci.yml` | `studio-admin-fluxo.mjs`, `studio-login-fluxo.mjs` | dados compartilhados, servidor ausente, falha ignorada | DOC-ENG-002 |
| Workspace humano | conta + sid | `studio-calls.ts`, `routes/studio.ts` | `studio-api` (accounts), `studio-login-fluxo.mjs` | acesso a documento alheio por reutilização de sid | DOC-SERVER-003 |
| Compartilhamento ativo | downgrade/revogação/grant | `projects.access`, `workspace`, `routes/studio` | `studio-api` (accounts), `workspace` (MCP), `plugins` | papel/grant antigo permitir leitura ou mutação indevida | DOC-SERVER-004 |
