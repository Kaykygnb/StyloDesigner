# HANDOFF — continuidade entre sessões

Resumo geral do estado do projeto para quem continuar o trabalho (humano ou agente). É curto e só referencia as tarefas — o detalhe fica no documento individual e no histórico delas. Regras de produção e uso em [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `cc9bec8` (matriz de compatibilidade MCP e teste de cliente externo)
- Última atualização deste resumo: 2026-10-14 00:35 UTC — [Kimi]
- Entrega anterior de [Codex]: DOC-SERVER-004, DOC-CORE-001 e DOC-QA-001 concluídas (commits até `80818cd`).

## Estado geral

[Kimi] sincronizou a branch (7 commits de [Codex]) e assumiu a DOC-MCP-001, última P0 aberta. Gates locais: typecheck limpo, build ok, MCP + inventário 8/8. Suíte completa com uma falha pré-existente e ambiental (`studio-ui.test.js:155`, etapa "Conferir" — registrada em DOC-STUDIO-004, reproduzida na árvore limpa; CI de [Codex] aprovou 613/613).

## Em andamento

- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) — [Kimi], #5 validação: matriz de compatibilidade publicada (cliente HTTP cru novo, 2 testes; lacunas GUI/hosted e imagem explícitas); mudanças locais a publicar.
- [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], #1 investigação: revisão visual/usabilidade (P1); próxima execução de jornadas.

## Aguardando revisão

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) — gates de autorização em `PUT /api/config` e `PUT /api/agent/config` (anônimo 401, MEMBER 403, OWNER/ADMIN ok). Revisor: humano.

## Bloqueios importantes

- Nenhum.

## Alterações recentes relevantes

- [Kimi] `tests/mcp-compatibilidade.test.js` (novo) + `docs/mcp/COMPATIBILIDADE.md` (novo) + inventário de ferramentas regenerado (drift check do DOC-CORE-001 exige `npm run docs:inventario` ao adicionar testes que citam ferramentas).
- [Codex] `80818cd` inventário de ferramentas e gate de drift; `7ccd005` revalidação de workspace ativo (DOC-SERVER-004); QA exploratório preparado (DOC-QA-001, guia em `docs/qa/WORK-GUIDE.md`).
- Proposta nova: [DOC-STUDIO-004](tasks/studio/DOC-STUDIO-004.md) — investigar falha do E2E de painel web na etapa "Conferir" (P1, não atribuída).

## Próximas prioridades

1. Publicar a entrega da [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) e revisar as lacunas declaradas na matriz.
2. Revisar e concluir [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) (decisão humana pendente: `adminOf` vs `ownerOf`).
3. P1 abertas sem responsável: [DOC-SERVER-001](tasks/server/DOC-SERVER-001.md), [DOC-CORE-002](tasks/core/DOC-CORE-002.md), [DOC-STUDIO-001](tasks/studio/DOC-STUDIO-001.md), [DOC-DB-001](tasks/database/DOC-DB-001.md), [DOC-STUDIO-004](tasks/studio/DOC-STUDIO-004.md).

## Decisões humanas pendentes

- Aprovar ou pedir ajustes na política `adminOf` para os PUTs de configuração (DOC-SERVER-005).
- Aceitar como "explicitamente não verificadas" as lacunas da matriz MCP: clientes GUI/hosted (Claude Desktop, Cursor, Windsurf, ChatGPT Work) e conteúdo de imagem (`get_image` exige renderer).
