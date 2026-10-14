# HANDOFF — continuidade entre sessões

Resumo geral; tarefa individual e histórico são a fonte de verdade. Protocolo: [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §6 e §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `f8f8141cc7c674045d2039f2d18dd9625bc193d9`
- Última atualização: 2026-10-14 02:46 UTC — [Codex]

## Entrega atual

[DOC-ENG-004](tasks/engineering/DOC-ENG-004.md) concluída, 5/5: 13 fixtures legados com ambiente isolado e cleanup ordenado; teste de servidor usa configuração temporária. Específicos hostis sem setup 10/10; suíte 622/622, zero falhas/skips, incluindo PostgreSQL real e Studio UI automatizado. Typecheck, inventário e validador (20 tarefas) aprovados. Sem mudança funcional ou QA exploratório. Implementação publicada em f8f8141; CI remota ainda não consultada.

## Continuidade e deliberação administrativa

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) concluída 5/5 após aprovação explícita humana beta: OWNER/ADMIN nos PUT atuais, MEMBER/anônimo recusados. Implementação Kimi preservada; ressalvas de políticas/privilégios/credenciais críticas registradas. Não é certificação geral de segurança.
- [DOC-ADMIN-001](tasks/administration/DOC-ADMIN-001.md) concluída 5/5 de preparação documental, com revisão independente, propõe [arquitetura self-hosted](../architecture/instance-administration/README.md) e [ADR 0002](../architecture/adr/0002-self-hosted-administration.md), propostas sem mudança funcional. Referência de código 7055b65. Config autorização 1/1 nesta rodada; bloqueio Host público/Origin HTTPS reproduzido em guard sintético. Demais riscos de OWNER/MCP/SSE/bootstrap/auditoria são estáticos, não exploração reproduzida.
- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) continua Em validação 4/5 com Codex: aceite humano de lacunas GUI/hosted/imagem/stdio feliz não foi concedido pela aprovação administrativa.

## Em andamento

[DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], preparação/insumos; execução exploratória guiada pelo proprietário conforme [WORK-GUIDE.md](../qa/WORK-GUIDE.md). Não ocorreu auditoria visual nesta entrega.

## Próximas prioridades e decisões

1. Deliberar ADM-DEC-01..09 da ADR 0002; arquitetura recomendada é organização única e domínio administrativo sobre serviços atuais. Só ADM-DEC-00 (gates beta) foi aprovada.
2. Propostas P0 [DOC-SERVER-006](tasks/server/DOC-SERVER-006.md) autoridade contextual/OWNER/delegação e [DOC-SERVER-007](tasks/server/DOC-SERVER-007.md) identidade/revogação MCP/SSE; investigação descartável antes de correção, sem alterar contratos por inferência.
3. [DOC-SERVER-008](tasks/server/DOC-SERVER-008.md) origem pública/bootstrap e [DOC-ADMIN-002](tasks/administration/DOC-ADMIN-002.md) auditoria sensível. Gate para piloto VPS, não implantação autorizada agora.
4. Continuar [DOC-DB-001](tasks/database/DOC-DB-001.md) para restore/migração real; não duplicar. Depois paridade/exportação e UX pelos documentos existentes; redesign depende de direção humana.

## Cuidados

Não testar contra bancos/dados externos herdados. Novos fixtures usam configuração própria; PostgreSQL usa URL provisionada explicitamente. Conferir remoto e aceitar handoff antes de continuar; não duplicar tarefas nem apagar autores anteriores.
