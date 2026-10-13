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
