# HANDOFF — continuidade entre sessões

Resumo geral do estado do projeto para quem continuar o trabalho (humano ou agente). É curto e só referencia as tarefas — o detalhe fica no documento individual e no histórico delas. Regras de produção e uso em [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `48b914a` (protocolo de handoff incorporado; base da assunção Codex)
- Última atualização deste resumo: 2026-10-13 22:42 UTC — [Codex]
- Entrega anterior de [Kimi]: DOC-SERVER-005; evidências e referência preservadas no handoff da tarefa.

## Estado geral

Gates reportados na entrega Kimi: typecheck limpo, `npm test` 608/608, build ok; não reexecutados na assunção Codex. Última entrega fechou um buraco de autorização nos endpoints de configuração (DOC-SERVER-005), aguardando revisão humana para concluir.

## Em andamento

- [DOC-SERVER-004](tasks/server/DOC-SERVER-004.md) — [Codex], #1 investigação: revalidar compartilhamento em workspace ativo (P0); reprodução ainda pendente.
- [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], #1 investigação: revisão visual/usabilidade (P1), execução de jornadas após a prioridade P0.

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
2. [DOC-SERVER-004](tasks/server/DOC-SERVER-004.md) (P0) — assumida por [Codex]; reproduzir downgrade/revogação e definir correção.
3. [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) (P1) — assumida por [Codex]; revisar jornadas visuais e funcionais após a P0.
4. [DOC-SERVER-003](tasks/server/DOC-SERVER-003.md) está concluída e é dependência das P0 de autorização restantes.

## Decisões humanas pendentes

- Aprovar ou pedir ajustes na política `adminOf` para os PUTs de configuração (DOC-SERVER-005): a alternativa considerada foi `ownerOf`, rejeitada por inconsistência com o padrão de `routes/plugins.ts`.
