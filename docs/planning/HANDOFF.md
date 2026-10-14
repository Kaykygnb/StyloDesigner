# HANDOFF — continuidade entre sessões

Resumo geral do estado do projeto para quem continuar o trabalho (humano ou agente). É curto e só referencia as tarefas — o detalhe fica no documento individual e no histórico delas. Regras de produção e uso em [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `1c39a54` (correção do E2E de painel web, DOC-STUDIO-004)
- Última atualização deste resumo: 2026-10-14 01:10 UTC — [Kimi]
- Entregas anteriores: [Codex] DOC-SERVER-004, DOC-CORE-001 e DOC-QA-001 (commits até `80818cd`).

## Estado geral

Quality gates verdes nesta máquina: typecheck limpo, `npm test` 615/615, build ok. A falha que restava do E2E "Conferir" era do teste (sleep fixo curto; `check_design` leva ~6–9 s aqui), corrigida em `1c39a54` — sem regressão de produto. Observação não investigada: duas chamadas `check_design` idênticas por clique no botão Conferir.

## Em andamento

- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) — [Kimi], #5 validação: matriz de compatibilidade publicada (`cc9bec8`); aguardando revisão das lacunas declaradas.
- [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], #1 investigação: revisão visual/usabilidade (P1); próxima execução de jornadas.

## Aguardando revisão

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) — gates de autorização em `PUT /api/config` e `PUT /api/agent/config` (anônimo 401, MEMBER 403, OWNER/ADMIN ok). Revisor: humano.

## Bloqueios importantes

- Nenhum.

## Alterações recentes relevantes

- `1c39a54` test(studio): espera condicional no passo Conferir do E2E (DOC-STUDIO-004 concluída por [Kimi], 5/5).
- `cc9bec8` test(mcp): cliente externo sem SDK + matriz de compatibilidade (DOC-MCP-001, [Kimi]).
- `80818cd` inventário de ferramentas e gate de drift; `7ccd005` revalidação de workspace ativo (DOC-SERVER-004, [Codex]).

## Próximas prioridades

1. Revisar e concluir [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) (decisão humana: `adminOf` vs `ownerOf`).
2. Revisar as lacunas declaradas na matriz MCP de [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md).
3. P1 abertas sem responsável: [DOC-SERVER-001](tasks/server/DOC-SERVER-001.md), [DOC-CORE-002](tasks/core/DOC-CORE-002.md), [DOC-STUDIO-001](tasks/studio/DOC-STUDIO-001.md), [DOC-DB-001](tasks/database/DOC-DB-001.md).

## Decisões humanas pendentes

- Aprovar ou pedir ajustes na política `adminOf` para os PUTs de configuração (DOC-SERVER-005).
- Aceitar como "explicitamente não verificadas" as lacunas da matriz MCP: clientes GUI/hosted (Claude Desktop, Cursor, Windsurf, ChatGPT Work) e conteúdo de imagem (`get_image` exige renderer).
