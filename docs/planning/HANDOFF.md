# HANDOFF — continuidade entre sessões

Resumo geral do estado do projeto para quem continuar o trabalho (humano ou agente). É curto e só referencia as tarefas — o detalhe fica no documento individual e no histórico delas. Regras de produção e uso em [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `21b2f60` (docs/server: DOC-SERVER-005 marcos #3-#5 e politica de autorizacao)
- Última sessão: 2026-10-13 23:15 UTC — [Kimi]

## Estado geral

Quality gates verdes: typecheck limpo, `npm test` 608/608, build ok. Última entrega fechou um buraco de autorização nos endpoints de configuração (DOC-SERVER-005), aguardando revisão humana para concluir.

## Em andamento

- Nenhuma.

## Aguardando revisão

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) — gates de autorização em `PUT /api/config` e `PUT /api/agent/config` (anônimo 401, MEMBER 403, OWNER/ADMIN ok). Revisor: humano. Evidências no documento da tarefa.

## Bloqueios importantes

- Nenhum.

## Alterações recentes relevantes

- `9b39789` fix(server): `identity.adminOf` nos dois PUT de configuração; novo `tests/config-autorizacao.test.js`.
- `21b2f60` docs(server): marcos #3–#5 da DOC-SERVER-005 e política registrada em `docs/modules/server/README.md`.
- Protocolo de handoff (TASK-PROTOCOL.md §10, este arquivo, seção `## Handoff atual` no template e no validador).

## Próximas prioridades

1. Revisar e concluir [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md).
2. [DOC-SERVER-004](tasks/server/DOC-SERVER-004.md) (P0) — revalidar acesso em workspaces com compartilhamento alterado.
3. [DOC-SERVER-003](tasks/server/DOC-SERVER-003.md) está concluída e é dependência das P0 de autorização restantes.

## Decisões humanas pendentes

- Aprovar ou pedir ajustes na política `adminOf` para os PUTs de configuração (DOC-SERVER-005): a alternativa considerada foi `ownerOf`, rejeitada por inconsistência com o padrão de `routes/plugins.ts`.
