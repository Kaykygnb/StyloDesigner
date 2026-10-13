# DOC-STUDIO-001 — Paridade das operações críticas

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
