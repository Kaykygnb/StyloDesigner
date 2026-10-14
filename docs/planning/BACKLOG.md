# Backlog central

O backlog é um índice. O documento individual, ligado na última coluna, é a fonte de verdade do estado, progresso, marcos e histórico. Consulte [TASK-PROTOCOL.md](TASK-PROTOCOL.md) antes de criar ou assumir uma tarefa.

| ID | Título | Módulo | Prioridade | Estado | Responsável | Progresso | Dependências | Documento |
|---|---|---|---:|---|---|---:|---|---|
| DOC-CORE-001 | Inventário verificável de ferramentas | core | P0 | Concluída | [Codex] | 5/5 (100%) | — | [tarefa](tasks/core/DOC-CORE-001.md) |
| DOC-CORE-002 | Matriz de exportação e warnings | core | P1 | Proposta | [Não atribuído] | 0/5 (0%) | DOC-CORE-001 | [tarefa](tasks/core/DOC-CORE-002.md) |
| DOC-MCP-001 | Matriz de compatibilidade MCP | mcp | P0 | Em validação | [Codex] | 4/5 (80%) | DOC-CORE-001 | [tarefa](tasks/mcp/DOC-MCP-001.md) |
| DOC-STUDIO-001 | Paridade das operações críticas | studio | P1 | Proposta | [Não atribuído] | 0/5 (0%) | DOC-CORE-001 | [tarefa](tasks/studio/DOC-STUDIO-001.md) |
| DOC-SERVER-001 | Validar adapters de persistência e rede | server/database | P1 | Concluída | [Kimi] | 5/5 (100%) | — | [tarefa](tasks/server/DOC-SERVER-001.md) |
| DOC-DB-001 | Restore e migração descartáveis | database | P1 | Proposta | [Não atribuído] | 0/5 (0%) | DOC-SERVER-001 | [tarefa](tasks/database/DOC-DB-001.md) |
| DOC-PLUGIN-001 | Matriz de providers e licenças | plugins | P2 | Proposta | [Não atribuído] | 0/5 (0%) | credenciais de teste | [tarefa](tasks/plugins/DOC-PLUGIN-001.md) |
| DOC-ENG-001 | Aplicar gates de engenharia na CI da beta | engenharia/CI | P1 | Concluída | [Codex] | 5/5 (100%) | — | [tarefa](tasks/engineering/DOC-ENG-001.md) |
| DOC-SERVER-002 | Corrigir datas e validar snapshots de backup | server | P1 | Concluída | [Codex] | 5/5 (100%) | — | [tarefa](tasks/server/DOC-SERVER-002.md) |
| DOC-ENG-002 | E2E administrativo isolado e obrigatório | engenharia/CI | P0 | Concluída | [Codex] | 5/5 (100%) | — | [tarefa](tasks/engineering/DOC-ENG-002.md) |
| DOC-STUDIO-002 | Entrada humana com senha temporária e retorno após reload | studio | P0 | Concluída | [Codex] | 5/5 (100%) | — | [tarefa](tasks/studio/DOC-STUDIO-002.md) |
| DOC-SERVER-003 | Vincular workspace do Studio à conta autenticada | server/Studio | P0 | Concluída | [Codex] | 5/5 (100%) | DOC-ENG-002 | [tarefa](tasks/server/DOC-SERVER-003.md) |
| DOC-SERVER-004 | Revalidar acesso em workspaces com compartilhamento alterado | server/autorização | P0 | Concluída | [Codex] | 5/5 (100%) | DOC-SERVER-003 | [tarefa](tasks/server/DOC-SERVER-004.md) |
| DOC-SERVER-005 | Verificar gates de autorização da configuração do servidor | server/autorização | P0 | Em validação | [Kimi] | 4/5 (80%) | DOC-SERVER-003 | [tarefa](tasks/server/DOC-SERVER-005.md) |
| DOC-STUDIO-003 | Revisão visual e usabilidade do Studio para pessoas | studio/UX | P1 | Em andamento | [Codex] | 0/5 (0%) | DOC-STUDIO-002, DOC-ENG-002 | [tarefa](tasks/studio/DOC-STUDIO-003.md) |
| DOC-STUDIO-004 | Investigar falha do E2E de painel web na etapa "Conferir" | studio/UX | P1 | Concluída | [Kimi] | 5/5 (100%) | — | [tarefa](tasks/studio/DOC-STUDIO-004.md) |
| DOC-QA-001 | Preparar QA exploratório com ChatGPT Work | QA/documentação | P1 | Concluída | [Codex] | 5/5 (100%) | DOC-STUDIO-003 (relação de evidências) | [tarefa](tasks/qa/DOC-QA-001.md) |
| DOC-ENG-003 | Isolar banco e ordenar limpeza dos fixtures MCP/PostgreSQL | engenharia/testes | P1 | Concluída | [Codex] | 5/5 (100%) | DOC-MCP-001, DOC-SERVER-001 (infraestrutura) | [tarefa](tasks/engineering/DOC-ENG-003.md) |
| DOC-ENG-004 | Auditar isolamento e cleanup dos fixtures legados | engenharia/testes | P1 | Concluída | [Codex] | 5/5 (100%) | DOC-ENG-003 | [tarefa](tasks/engineering/DOC-ENG-004.md) |
| DOC-STUDIO-005 | Redesign visual e identidade do Studio | studio/design | P1 | Proposta | [Não atribuído] | 0/5 (0%) | direção visual humana; DOC-STUDIO-003 e DOC-QA-001 (insumos) | [tarefa](tasks/studio/DOC-STUDIO-005.md) |
