# HANDOFF — continuidade entre sessões

Resumo geral; tarefa individual e histórico são a fonte de verdade. Protocolo: [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §6 e §10.

## Referência

- Branch de trabalho: `cursor/studio-mcp-parity-950d` (base `v0.1.0-beta`, planejamento em `31f16bf`)
- Commit da matriz: `aabece8`
- Última atualização: 2026-10-14 06:39 UTC — [Grok]

## Entrega atual

[DOC-STUDIO-001](tasks/studio/DOC-STUDIO-001.md) concluída, 5/5. Matriz em `tests/studio-parity.test.js`: callers reais do Studio e do MCP, projetos PGlite equivalentes, comparação por forma (documento, seleção, undo/redo, metadados de `export_site`, trilha `USER`×`AGENT`) e recusa de escrita (escopo `read` e papel `VIEWER`). Sem runtime. Suíte 626/626, zero falhas e zero skips, com Chromium do Playwright; typecheck, build, inventário e validador (28 tarefas) aprovados.

## Continuidade

- [DOC-SERVER-007](tasks/server/DOC-SERVER-007.md) permanece em 2/5: investigação e plano concluídos; #3 bloqueada por política humana (ADM-DEC-05/07/09). Não implementar vinculação de canal sem essa aprovação.
- [DOC-SERVER-006](tasks/server/DOC-SERVER-006.md) segue em 1/5 com [Codex]: principal protegido ainda não existe no runtime. Próximo passo é desenhar invariantes e migração; nenhum patch estrutural genérico.
- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) continua Em validação 4/5: aceite humano das lacunas GUI/hosted/imagem/stdio feliz.
- [DOC-DB-001](tasks/database/DOC-DB-001.md) continua Em validação 4/5: restore PGlite provado; pg_dump/pg_restore pendente.
- [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) continua com [Codex], execução exploratória guiada pelo proprietário. A 001 não cobre revisão visual.

## Próxima prioridade

DOC-SERVER-006, P0, investigação do principal. Não escolher o principal por heurística nem ampliar autoridade. A lacuna observada na 001 (`export_zip` de pessoa `VIEWER` no painel sucede) só vira implementação com tarefa e política próprias.

## Cuidados

Não testar contra bancos ou dados externos herdados. Não apagar autores anteriores. Conferir a PR antes de continuar em cima desta entrega.
