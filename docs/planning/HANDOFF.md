# HANDOFF — continuidade entre sessões

Resumo geral; tarefa individual e histórico são a fonte de verdade. Protocolo: [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §6 e §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `f8f8141cc7c674045d2039f2d18dd9625bc193d9`
- Última atualização: 2026-10-14 02:28 UTC — [Codex]

## Entrega atual

[DOC-ENG-004](tasks/engineering/DOC-ENG-004.md) concluída, 5/5: 13 fixtures legados com ambiente isolado e cleanup ordenado; teste de servidor usa configuração temporária. Específicos hostis sem setup 10/10; suíte 622/622, zero falhas/skips, incluindo PostgreSQL real e Studio UI automatizado. Typecheck, inventário e validador (20 tarefas) aprovados. Sem mudança funcional ou QA exploratório. Implementação publicada em f8f8141; CI remota ainda não consultada.

## Continuidade e revisões P0

- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md): handoff Kimi → Codex aceito no histórico; implementação original Kimi preservada, revisão técnica Codex entregue em f8f8141, 4/5 Em validação. Matriz limita conclusões à cobertura real. Falta aceite humano das lacunas GUI/hosted/imagem/stdio feliz, não nova implementação automática. Work QA GUI não exige MCP.
- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md): implementação [Kimi], revisão técnica [Codex] registrada; teste configuração aprovado. Falta decisão humana: manter OWNER e ADMIN autorizados a alterar configuração (adminOf), ou restringir a OWNER (ownerOf). Nenhuma aprovação inferida.

## Em andamento

[DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], preparação/insumos; execução exploratória guiada pelo proprietário conforme [WORK-GUIDE.md](../qa/WORK-GUIDE.md). Não ocorreu auditoria visual nesta entrega.

## Próximas prioridades

1. Decisões humanas das P0 acima; revisão técnica já feita por sucessor, não exigir retorno do implementador.
2. [DOC-DB-001](tasks/database/DOC-DB-001.md) — restore/migração com dados descartáveis; desbloqueada por DOC-SERVER-001. Próxima prioridade livre por risco de recuperação de dados.
3. [DOC-STUDIO-001](tasks/studio/DOC-STUDIO-001.md) — paridade das operações críticas; [DOC-CORE-002](tasks/core/DOC-CORE-002.md) — exportação/warnings.
4. [DOC-STUDIO-005](tasks/studio/DOC-STUDIO-005.md) — redesign após direção humana e evidências QA. Providers/licenças seguem dependentes de credenciais de teste.

## Cuidados

Não testar contra bancos/dados externos herdados. Novos fixtures usam configuração própria; PostgreSQL usa URL provisionada explicitamente. Conferir remoto e aceitar handoff antes de continuar; não duplicar tarefas nem apagar autores anteriores.
