# HANDOFF — continuidade entre sessões

Resumo geral do estado do projeto para quem continuar o trabalho (humano ou agente). É curto e só referencia as tarefas — o detalhe fica no documento individual e no histórico delas. Regras de produção e uso em [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `7ccd005` (revalidação de compartilhamento/grant em workspace ativo)
- Última atualização deste resumo: 2026-10-13 23:07 UTC — [Codex]
- Entrega anterior de [Kimi]: DOC-SERVER-005; evidências e referência preservadas no handoff da tarefa.

## Estado geral

Preparação documental de QA com Work pronta em [DOC-QA-001](tasks/qa/DOC-QA-001.md), aguardando registro da publicação. Guia: [docs/qa/WORK-GUIDE.md](../qa/WORK-GUIDE.md). Nenhuma exploração visual executada; DOC-STUDIO-003 mantém responsável/estado e aguardará escopo/evidências futuras conforme orientação do proprietário.

DOC-SERVER-004 concluída por [Codex], correção publicada em 7ccd005. `npm test`: 610/610, zero falhas/cancelamentos/skips; targeted workspace/Studio/plugins/config: 45/45; typecheck, build e E2E administrativo/login aprovados. CI da implementação 38480360349 aprovada em Node 22/24, build/documentação e Chromium/accounts. DOC-SERVER-005 permanece em validação humana com [Kimi].

## Em andamento

- [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], #1 investigação: revisão visual/usabilidade (P1), próxima execução de jornadas; DOC-SERVER-004 concluída.

## Aguardando revisão

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) — gates de autorização em `PUT /api/config` e `PUT /api/agent/config` (anônimo 401, MEMBER 403, OWNER/ADMIN ok). Revisor: humano. Evidências no documento da tarefa.

## Bloqueios importantes

- Nenhum.

## Alterações recentes relevantes

- `7ccd005` fix(server): consulta de permissão por ID, revalidação de membro/grant e snapshot HTTP autorizado (DOC-SERVER-004).

- `9b39789` fix(server): `identity.adminOf` nos dois PUT de configuração; novo `tests/config-autorizacao.test.js`.
- `21b2f60` docs(server): marcos #3–#5 da DOC-SERVER-005 e política registrada em `docs/modules/server/README.md`.
- Protocolo de handoff (TASK-PROTOCOL.md §10, este arquivo, seção `## Handoff atual` no template e no validador).

## Próximas prioridades

O proprietário pode iniciar uma sessão Work com URL/permissões e o guia acima, selecionar jornadas e revisar relatos antes de encaminhar tarefas. Nesta entrega não iniciar QA automaticamente; preparo não conclui DOC-STUDIO-003.

1. Revisar e concluir [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md).
2. [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) (P1) — assumida por [Codex]; revisar jornadas visuais e funcionais; P0 DOC-SERVER-004 concluída.
3. [DOC-SERVER-003](tasks/server/DOC-SERVER-003.md) está concluída e é dependência das P0 de autorização restantes.

## Decisões humanas pendentes

- Aprovar ou pedir ajustes na política `adminOf` para os PUTs de configuração (DOC-SERVER-005): a alternativa considerada foi `ownerOf`, rejeitada por inconsistência com o padrão de `routes/plugins.ts`.
