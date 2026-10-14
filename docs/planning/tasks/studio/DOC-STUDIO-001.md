# DOC-STUDIO-001 — Paridade das operações críticas

Responsável: [Grok]
Estado: Concluída
Início: 2026-10-14 01:15 -03:00
Última atualização: 2026-10-14 07:34 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Muse Spark], [Grok]

- **Módulo:** studio
- **Prioridade:** P1
- **Estado:** Concluída
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
- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: assunção §2 após 002 concluída; leitura de BACKLOG, DOC-CORE-001 (registros reutilizáveis), `studio-calls.ts` (ponte do painel), `mcp/agent-calls.ts` (caller MCP), `studio-api.test.js` (ponte + regressão de convivência), `workspace.test.ts` (harness PGlite + casos de escopo/export); verificação de duplicação (003 = revisão visual/UX; MCP-001 = clientes externos; esta = equivalência funcional painel×MCP); conferidos `createPresence` (`presence.js:66`), `createEvents` (`events.ts:18`), ferramentas `update_layers/create_layer/undo/redo/get_activity` (`schema.ts:196,208,748,871,909`), workspace aceita callers externos (`workspace/index.ts:76`).
- Arquivos alterados: este documento e BACKLOG.md (assunção).
- Evidências: ambos os callers terminam em `workspace.call(tool, args, {sid, actor, signal})` com mesmas validações/travas; diferenças: ator (`USER` vs `AGENT` com scopes), chave de sessão (`web:user:tab` vs id MCP), log de presença (`log` vs `touchAgent/done`), `pageId` restabelecido no Studio, `BLOCKED` vazio. Harness viável: PGlite + serviços + `createPresence`/`createEvents` reais + os dois callers; sem Chromium.
- Testes executados: —
- Problemas encontrados: ids de camada são gerados por execução — paridade compara forma/propriedades, não JSON bruto; teste novo citará ferramentas → rodar `npm run docs:inventario` na #4 (regra da 001).
### #2 — Planejamento
- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: plano do teste novo `tests/studio-parity.test.js` (só teste, sem runtime): mesmo roteiro pelos dois callers em projetos equivalentes — criação, update unitário, batch, arrange/layout, undo/redo, `export_site` (metadados), atividade (atores USER×AGENT) e recusa de autorização (scope só-leitura); comparação por forma observável (contagens, nomes, props, paths/bytes) + undo efetivo + log por ator; e2e Chromium fora (risco conhecido).
- Arquivos alterados: este documento.
- Evidências: 7 famílias × pontos de comparação definidos; sem mudar comportamento.
- Testes executados: —
- Problemas encontrados: nenhum bloqueio.
### #3 — Implementação
- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: transferência de [Muse Spark] para [Grok] após #1/#2; escrito `tests/studio-parity.test.js` (só teste). Mesmo roteiro pelos dois callers em projetos PGlite de donos distintos: `create_layer`, `update_layer`, `update_layers`, `arrange_layers`, `build_layout`, `undo`/`redo`, `get_selection`, `export_site` e `get_activity`. Recusa de escrita do agente `read` e da pessoa `VIEWER`, com documento e auditoria intactos. Sem runtime.
- Arquivos alterados: `tests/studio-parity.test.js`.
- Evidências: comparação por forma (nomes, props, ordem, paths/bytes), seleção após criar/arranjar/layout, undo efetivo de lote/arranjo/layout, trilha com as mesmas ferramentas e ator `USER`×`AGENT`.
- Testes executados: o arquivo novo, ainda isolado, 2/2.
- Problemas encontrados: ids não são comparáveis entre execuções (já previsto); o retrato de presença devolve só 20 eventos, então os resumos foram lidos antes de misturar os dois roteiros; a janela de trava de 10 s do agente completo mascarava o gate de escopo — o teste avança o relógio injetado.
### #4 — Testes
- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: `npm run docs:inventario`; typecheck; build do Studio; suíte completa com Chromium do Playwright (o mesmo exigido pela CI).
- Arquivos alterados: `docs/testing/TOOL-INVENTORY.md`, `docs/testing/TOOL-INVENTORY.json`, `docs/testing/REGRESSION-MATRIX.md`, `docs/modules/studio/README.md`, `docs/modules/mcp/README.md`.
- Evidências: inventário 120 ferramentas, menções do teste novo como candidatas; `npm run docs:inventario -- --check` aprovado.
- Testes executados: `npm run typecheck`; `npm run build`; `npm test` — 626/626, zero falhas e zero skips.
- Problemas encontrados: a primeira suíte, sem Chromium, falhou 2 testes de renderer e pulou 19; com `npx playwright install --with-deps chromium` a suíte fechou 626/626. Não é regressão do teste novo.
### #5 — Validação final
- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: critérios relidos contra o teste e a matriz de regressão; confirmado que não houve mudança de runtime, contrato ou autorização; validador documental.
- Arquivos alterados: esta tarefa, `docs/planning/BACKLOG.md`, `docs/planning/HANDOFF.md`.
- Evidências: matriz equivalente cobre documento, seleção, undo/redo, metadados de `export_site`, atividade por ator e recusa de escrita. HTTP, SDK MCP e UI do Studio permanecem nos testes já existentes e rodaram verdes dentro da suíte; o plano da #2 manteve o e2e Chromium fora da matriz nova.
- Testes executados: `node docs/planning/validate-tasks.mjs`; `git diff --check`.
- Problemas encontrados: `export_zip` chamado por pessoa `VIEWER` no caller do painel hoje sucede (o ator `USER` não tem scopes e o handler não consulta o papel). Lacuna registrada, sem patch de autorização.

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

### 2026-10-14 01:15 -03:00 — [Muse Spark] — #1 concluída e #2 planejada

- Investigado: callers, presença/eventos reais, ferramentas das 7 famílias, harness PGlite existente.
- Alterado: #1 e #2 concluídas; sem runtime.
- Arquivos: este documento.
- Testes: ainda não executados.
- Resultado: paridade testável sem Chromium; comparação por forma observável (ids variam por execução).
- Próximo passo: #3 escrever `tests/studio-parity.test.js`; #4 gates + `docs:inventario`.

### 2026-10-14 06:39 UTC — [Grok] — transferência e #3/#4/#5

- Investigado: handoff geral, tarefa e histórico; #1/#2 de [Muse Spark] conferidos no commit `31f16bf`; callers, harness PGlite e ausência de matriz. DOC-SERVER-007 segue bloqueada em política humana, sem sobreposição.
- Alterado: transferência de responsável anterior [Muse Spark] para [Grok], aceita porque a investigação/planejamento já estava entregue e esta sessão é o único agente no branch. Estado passou a Em andamento na implementação e a Concluída após os gates. Histórico de [Muse Spark] preservado.
- Arquivos: `tests/studio-parity.test.js`, inventário, matriz de regressão, README de Studio e MCP, esta tarefa, `BACKLOG.md`, `HANDOFF.md`.
- Testes: arquivo novo 2/2; `npm run typecheck`; `npm run build`; `npm test` 626/626 sem falhas nem skips (Chromium do Playwright instalado); `docs:inventario --check`; validador 28 tarefas.
- Resultado: paridade observável provada sem mudar runtime, commit `aabece8`. `export_zip` de VIEWER no painel continua permitido; não foi alterado.
- Próximo passo: nenhum nesta tarefa. Próxima do backlog: DOC-SERVER-006 (P0, investigação de principal; sem patch estrutural genérico).

### 2026-10-14 07:34 UTC — [Grok] — decisão do proprietário sobre o zip de VIEWER

- Investigado: a pendência registrada na #5. `export_zip` não lia o papel; o ator `USER` não tem scopes, então VIEWER recebia as URLs. Os GET `site.zip` e `react.zip` também entregavam o pacote. Publicação já recusava VIEWER e COMMENTER pelo gate de escrita. `export_site`, `export_html` e `export_tokens` são leitura e não entregam o arquivo do projeto.
- Alterado: o proprietário decidiu em 2026-10-14 que VIEWER não baixa nem exporta o zip. A recusa usa `Você só pode ler ou comentar este projeto.`, a mesma das escritas, e acontece antes de gravar. O papel vem antes do scope `export`, então o agente de um membro VIEWER também é recusado mesmo com scope de exportação. O agente só de leitura do dono continua em `Este agente não tem permissão de exportar.` COMMENTER não foi incluído e segue podendo baixar. O painel pede `export_zip` antes de abrir o zip e não oferece o JSON local a VIEWER. Sem ADR: o gate reutiliza a mensagem e o papel que já existiam; não cria papel, scope nem contrato novo. A recomendação anterior de abrir outra tarefa foi substituída por este pedido, na mesma entrega e na PR #17.
- Arquivos: `apps/server/src/workspace/index.ts`, `apps/server/src/routes/projects.ts`, `apps/studio/src/editor/Panels.tsx`, `tests/studio-parity.test.js`, `tests/workspace.test.ts`, `tests/export-zip-http.test.ts`, matriz de exportação, permissões, regressão, READMEs, inventário, esta tarefa e o handoff geral.
- Testes: foco em `studio-parity`, `workspace` e `export-zip-http`; `npm run typecheck`; `npm run build`; `npm test` 626/626, zero falhas e zero skips; `docs:inventario --check`; validador 28 tarefas.
- Resultado: VIEWER não recebe URL nem o zip HTTP. Dono, EDITOR e COMMENTER continuam recebendo o pacote quando o restante da autorização permite.
- Próximo passo: nenhum nesta tarefa. Próxima do backlog: DOC-SERVER-006.

## Handoff atual

Preparado por: [Grok]
Destinatário: [Próximo agente]
Estado: Concluída; decisão de zip de VIEWER implementada nesta entrega
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 07:34 UTC
Commit de referência: `aabece8` e o commit desta decisão, na branch `cursor/studio-mcp-parity-950d` (base de planejamento `31f16bf` em `v0.1.0-beta`)

### Estado atual

5/5 (100%), Concluída. A matriz é `tests/studio-parity.test.js`. #1 e #2 continuam de [Muse Spark]. Depois da conclusão, o proprietário decidiu que VIEWER não baixa o zip; isso já está no runtime e nos testes.

### Decisões tomadas

Seguir o plano da #2: callers reais e PGlite, sem Chromium na matriz nova. Comparação por forma observável, não por JSON com ids. Recusa de escrita comparada nos dois gates (escopo `read` do agente e papel `VIEWER` da pessoa); as mensagens diferem de propósito.

Decisão do proprietário em 2026-10-14: pessoa VIEWER não exporta nem baixa o zip. `export_zip` e os GET `site.zip`/`react.zip` recusam com `Você só pode ler ou comentar este projeto.` O papel é consultado antes do scope e antes de gravar. COMMENTER continua podendo baixar. `export_site`, `export_html` e `export_tokens` continuam leitura. O canvas ainda carrega o documento para visualizar. Sem ADR nova.

### Arquivos envolvidos

`tests/studio-parity.test.js`, `tests/workspace.test.ts`, `tests/export-zip-http.test.ts`, `apps/server/src/workspace/index.ts`, `apps/server/src/routes/projects.ts`, `apps/studio/src/editor/Panels.tsx`, inventário, matrizes de exportação e regressão, permissões, READMEs, esta tarefa e o handoff geral.

### Evidências e testes

`npm test` 626/626, zero falhas e zero skips, com Chromium do Playwright, já com o gate de zip. `npm run typecheck` e `npm run build` aprovados. `npm run docs:inventario -- --check` aprovado. Validador: 28 tarefas. A matriz não abre navegador; o zip HTTP tem teste próprio.

### Pendências

Nenhuma. A questão do zip de VIEWER foi decidida pelo proprietário e implementada. COMMENTER não entrou nessa recusa.

### Próximas ações recomendadas

1. Revisar a PR #17. Não há merge pedido.
2. Seguir DOC-SERVER-006 sem inferir patch estrutural.

### Riscos e cuidados

Não tratar menção no inventário como certificação de cada ferramenta. Não duplicar a revisão visual da DOC-STUDIO-003. Não usar banco externo. Não estender a recusa de zip a COMMENTER sem nova decisão.

### Condições para conclusão

Atendidas na matriz original. O gate de zip de VIEWER ficou coberto pelos testes de paridade, workspace e HTTP.
