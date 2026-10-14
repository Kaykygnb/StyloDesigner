# HANDOFF — continuidade entre sessões

Resumo geral do estado do projeto para quem continuar o trabalho (humano ou agente). É curto e só referencia as tarefas — o detalhe fica no documento individual e no histórico delas. Regras de produção e uso em [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `a502ba7` (isolamento e cleanup dos fixtures MCP/PG)
- Última atualização deste resumo: 2026-10-14 01:57 UTC — [Codex]

## Estado geral

[DOC-ENG-003](tasks/engineering/DOC-ENG-003.md) concluída, a502ba7: env MCP isolado e cleanup PG aguardado sem PANIC; typecheck, específicos 9/9, suíte 620/620 sem falhas/skips, inventário e validador 19 aprovados. CI 38498065722 ainda em andamento na consulta final. [DOC-ENG-004](tasks/engineering/DOC-ENG-004.md) permanece Proposta para fixtures legados; não altera responsáveis Kimi.

Revisão Codex em 41b0fb3: CI 38495659427 aprovada; testes novos MCP/PG 3/3 e typecheck/validador/inventário locais aprovados. Cleanup PostgreSQL reproduziu PANIC durante remoção prematura de dados; fixture MCP herda DATABASE_URL (risco constatado por código). [DOC-ENG-003](tasks/engineering/DOC-ENG-003.md) registrou as correções agora entregues em a502ba7; não confundir testes verdes com ausência desses problemas. Responsáveis/estados Kimi preservados.

Quality gates verdes: typecheck limpo, `npm test` 616/616, build ok. [Kimi] concluiu a DOC-SERVER-001: PostgreSQL externo agora é verificado de forma descartável e reproduzível (`tests/postgres-integracao.test.js` sobe um PostgreSQL real, aplica migrações, roda fluxo auth/projeto/agente, reinício e falha de conexão). Docs de produto atualizadas ("implementado não verificado" → verificado). Restam duas tarefas [Kimi] aguardando revisão humana (DOC-SERVER-005, DOC-MCP-001).

## Em andamento

- [DOC-ENG-004](tasks/engineering/DOC-ENG-004.md) — [Codex], assumida por risco de dados; #1 concluído (setup com URL sentinela herdada e 13 fixtures mapeados), planejamento/implementação pendentes.


- [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], #1 investigação: revisão visual/usabilidade (P1); próxima execução de jornadas.

## Aguardando revisão

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) — gates `adminOf` nos PUTs de configuração. Revisor: humano (decisão `adminOf` vs `ownerOf`).
- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) — matriz de compatibilidade MCP; revisar lacunas declaradas (GUI/hosted e imagem).

## Bloqueios importantes

- Nenhum.

## Alterações recentes relevantes

- [Kimi] `tests/postgres-integracao.test.js` (novo) + devDependency `embedded-postgres` + docs de produto (DOC-SERVER-001 concluída, 5/5).
- [Kimi] `1c39a54` correção do E2E Conferir (DOC-STUDIO-004 concluída); `cc9bec8` matriz MCP + cliente externo sem SDK.
- [Codex] `80818cd` inventário de ferramentas e gate de drift; `7ccd005` revalidação de workspace ativo (DOC-SERVER-004).

## Próximas prioridades

1. Revisões humanas pendentes (DOC-SERVER-005 e DOC-MCP-001) — desbloqueiam o fim das P0/P0-MCP.
2. [DOC-ENG-004](tasks/engineering/DOC-ENG-004.md) (P1) — isolamento/cleanup, assumida por Codex; primeiro por risco a dados externos.
3. [DOC-DB-001](tasks/database/DOC-DB-001.md) (P1) — restore/migração descartável: **desbloqueada** pela DOC-SERVER-001 (base de PostgreSQL descartável pronta).
4. P1 sem responsável: [DOC-CORE-002](tasks/core/DOC-CORE-002.md) (matriz de exportação), [DOC-STUDIO-001](tasks/studio/DOC-STUDIO-001.md) (paridade de operações críticas).

## Decisões humanas pendentes

- Aprovar ou pedir ajustes na política `adminOf` para os PUTs de configuração (DOC-SERVER-005).
- Aceitar como "explicitamente não verificadas" as lacunas da matriz MCP: clientes GUI/hosted e conteúdo de imagem.
