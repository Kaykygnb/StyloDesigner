# DOC-STUDIO-001 — Paridade das operações críticas

Responsável: [Muse Spark]
Estado: Em andamento
Início: 2026-10-14 01:15 -03:00
Última atualização: 2026-10-14 01:15 -03:00
Progresso: 0/5 marcos (0%)
Participantes: [Muse Spark]

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
- Estado: em andamento
- Responsável: [Muse Spark]
- Atividades executadas: assunção §2 após 002 concluída; leitura de BACKLOG, DOC-CORE-001 (registros reutilizáveis), `studio-calls.ts` (ponte do painel), `mcp/agent-calls.ts` (caller MCP), `studio-api.test.js` (ponte + regressão de convivência), `workspace.test.ts` (harness PGlite + casos de escopo/export); verificação de duplicação (003 = revisão visual/UX; MCP-001 = clientes externos; esta = equivalência funcional painel×MCP).
- Arquivos alterados: este documento e BACKLOG.md (assunção).
- Evidências: ambos os callers terminam em `workspace.call(tool, args, {sid, actor, signal})` com mesmas validações/travas; diferenças: ator (`USER` vs `AGENT` com scopes), chave de sessão (`web:user:tab` vs id MCP), log de presença (`log` vs `touchAgent/done`), `pageId` restabelecido no Studio, `BLOCKED` vazio.
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

### 2026-10-14 01:15 -03:00 — [Muse Spark] — assunção
- Investigado: protocolo §1; BACKLOG (P1 livre, dependência 001 concluída); callers Studio×MCP e testes de ponte/workspace; sem duplicata com 003/MCP-001/QA-001.
- Alterado: responsável [Muse Spark], Estado Em andamento, #1 em andamento. Sem runtime.
- Arquivos: esta tarefa, `docs/planning/BACKLOG.md`.
- Testes: ainda não executados.
- Resultado: tarefa assumida; paridade testável sem Chromium (harness PGlite + callers reais).
- Próximo passo: concluir #1 (famílias de operações e pontos de comparação) e #2 (plano da matriz + teste novo).

## Handoff atual

Preparado por: [Muse Spark]
Destinatário: [Próximo agente / revisor humano]
Estado: Assumida; investigação em curso
Marco atual: #1 — Investigação
Última atualização: 2026-10-14 01:15 -03:00
Commit de referência: `9e2ed01` na branch `v0.1.0-beta`

### Estado atual

Tarefa assumida por [Muse Spark]. #1 em andamento, #2-#5 pendentes. Nenhum código alterado além deste documento e BACKLOG.

### Decisões tomadas

Matriz por equivalência funcional via teste novo (`tests/studio-parity.test.js`, só teste, sem runtime); e2e com Chromium fica fora (risco conhecido, coberto por `studio-ui`); sem redesign visual (fora do escopo, respeita 003).

### Arquivos envolvidos

Esta tarefa, `docs/planning/BACKLOG.md`; lidos: `apps/server/src/studio/studio-calls.ts`, `apps/server/src/mcp/agent-calls.ts`, `tests/studio-api.test.js`, `tests/workspace.test.ts`.

### Evidências e testes

Ainda sem evidências executadas nesta assunção. Base: `workspace.call` único para os dois caminhos.

### Pendências

Concluir #1 (famílias × pontos de comparação) e #2 (plano do teste de paridade).

### Próximas ações recomendadas

1. Mapear famílias: criação, update, batch, layout, undo, export, auditoria + falhas de autorização.
2. Desenhar teste de paridade com harness PGlite e callers reais.
3. Executar e registrar matriz.

### Riscos e cuidados

Não duplicar testes de ponte existentes; não certificar fluxo visual do painel (é da 003); e2e Chromium lento — fora deste escopo.

### Condições para conclusão

Matriz com casos equivalentes, comparação de documento/atividade/undo e falhas de autorização; integração HTTP + MCP SDK + fluxo Studio por família (via harness, sem Chromium); suíte e build verdes.
