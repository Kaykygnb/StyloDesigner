# DOC-STUDIO-001 — Paridade das operações críticas

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-13 00:00 -03:00
Progresso: 0/5 marcos (0%)
Participantes: —

- **Módulo:** studio
- **Prioridade:** P1
- **Estado:** Proposto
- **Problema/evidência:** Studio chama `/api/studio/call` e MCP chama `agent-calls.ts`, ambos alcançam o runner, mas não existe matriz automatizada de resultado, undo, seleção e atividade.
- **Objetivo:** provar que operações críticas equivalentes produzem o mesmo documento observável.
- **Escopo:** criação, update, batch, layout, undo, export e auditoria.
- **Fora do escopo:** redesign visual.
- **Arquivos potenciais:** `apps/server/src/studio/studio-calls.ts`, `apps/server/src/mcp/agent-calls.ts`, `apps/studio/src/lib/api.ts`, testes Studio/MCP.
- **Dependências:** DOC-CORE-001.
- **Riscos:** testes e2e lentos e dependentes de Chromium.
- **Aceitação:** matriz com casos equivalentes, comparação de documento/atividade/undo e falhas de autorização.
- **Testes obrigatórios:** integração HTTP, MCP SDK e fluxo Studio para cada família.
- **Regressão:** suíte completa e `npm run build`.
- **Rollback:** remover somente testes/matriz novos.

## Marcos

### #1 — Investigação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #2 — Planejamento
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #3 — Implementação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #4 — Testes
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #5 — Validação final
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

## Histórico de trabalho

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.
