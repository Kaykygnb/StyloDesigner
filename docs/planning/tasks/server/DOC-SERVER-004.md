# DOC-SERVER-004 — Revalidar acesso em workspaces com compartilhamento alterado

Responsável: [Codex]
Estado: Concluída
Início: 2026-10-13 22:42 UTC
Última atualização: 2026-10-13 22:54 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Codex]

## Problema e evidências

Reproduzido em servidor HTTP accounts: após EDITOR → VIEWER, snapshot ainda informava EDITOR e update_layer era aceito (sem error). A permissão guardada ao abrir não acompanhava mudanças de compartilhamento; persistência do workspace ocorre como dono do projeto, portanto o gate precisa recusar antes da mutação.

## Objetivo

Reproduzir mudanças de compartilhamento e validar que leitura/escrita respeitam as permissões atuais, inclusive em workspace ativo.

## Escopo

workspace/index.ts, services/projects.ts, sharing, snapshots, testes HTTP/MCP; preservar nomes e formatos públicos. Fora do escopo: redesenho da autenticação, mudança de schema e dados reais.

## Módulo e contratos afetados

- Módulo: server/autorização.
- Contratos: identidade, permissões atuais e formato de respostas; avaliar documentação antes da implementação.
- Testes: integração HTTP accounts e regressões relevantes, typecheck, npm test; E2E se tocar fluxo humano.
- Duplicações: DOC-SERVER-003 trata vínculo entre conta e sid; esta proposta trata mudança de permissão/gates após autenticação, com cenário distinto.

## Dependências, riscos e bloqueios

- Dependência: contexto de DOC-SERVER-003 e infraestrutura accounts de DOC-ENG-002.
- Reprodução executada nesta rodada. A consulta de acesso seleciona somente ownerId/papel do membro por ID do projeto; não hidrata documento/assets nem resolve arquivo por slug. Revalidação ocorre no início da chamada: não cancela operações já autorizadas e em execução quando o compartilhamento muda.

## Critérios de aceitação

- [x] Cenário reproduzido e política confirmada com contratos existentes.
- [x] Comportamento autorizado permitido e acesso indevido recusado, sem mutação parcial.
- [x] Testes, regressões e documentação atualizados com evidências.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Reproduzir downgrade no workspace ativo; revisar caminhos de núcleo, projeto, plugin e grants de agentes.
- Arquivos alterados: documentação desta tarefa e evidências dos testes relacionados.
- Evidências: Testes antes da correção falharam: snapshot EDITOR em vez de VIEWER e escrita sem error após downgrade.
- Testes executados: Duas execuções HTTP accounts antes da correção; logs locais /tmp/stylo-sharing-before.log e /tmp/stylo-sharing-write-before.log.
- Problemas encontrados: Consulta inicial de papel era estática; reproduções registradas.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Revalidar papel por ID sem ler documento; conferir grant do agente; proteger snapshot exposto via rota; permitir abrir/criar/listar projetos após revogação.
- Arquivos alterados: documentação desta tarefa e evidências dos testes relacionados.
- Evidências: Contratos existentes exigem dono/editor para escrever e membro para ler; esquema e nomes públicos preservados.
- Testes executados: Leitura de services/projects.ts, sharing.ts, agents.ts e schema.ts.
- Problemas encontrados: Sem bloqueio conhecido; validação final pendente.

### #3 — Implementação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Adicionar projects.access e revalidate; consultar gates antes de ferramentas dependentes do projeto, incluindo plugins; impedir save_project de viewer/commenter ou agente sem write; snapshotForActor na rota Studio.
- Arquivos alterados: `services/projects.ts`, `workspace/index.ts`, `routes/studio.ts`, `tests/studio-api.test.js`, `tests/workspace.test.ts`.
- Evidências: Diff nos arquivos de runtime; snapshot interno síncrono preservado para presença/log, sem uso como autorização pública.
- Testes executados: Typecheck aprovado; cenários específicos e suíte completa em execução.
- Problemas encontrados: Sem bloqueio conhecido; validação final pendente.

### #4 — Testes

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: regressões HTTP accounts e workspace MCP, suíte completa e fluxos humanos no navegador.
- Arquivos alterados: tests/studio-api.test.js e tests/workspace.test.ts; documentação de regressão.
- Evidências: `npm test`: 610/610, zero falhas/cancelamentos/skips; targeted workspace/Studio/plugins/config: 45/45; typecheck, build e E2E administrativo/login aprovados. Logs locais /tmp/stylo-sharing-full.log, /tmp/stylo-sharing-targeted.log, /tmp/stylo-sharing-types.log, /tmp/stylo-sharing-build.log e /tmp/stylo-sharing-e2e.log.
- Testes executados: npm run typecheck; npm test; npm run build; npm run test:e2e; execução específica das quatro suítes (45 testes).
- Problemas encontrados: o preparo inicial do caso de slug foi ajustado conforme contrato existente; nenhuma falha nos resultados finais. Avisos de tamanho/import dinâmico do build são preexistentes.

### #5 — Validação final

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: revisar critérios, diff, documentação e estado remoto; publicar implementação diretamente na beta sem modificar a tarefa Kimi.
- Arquivos alterados: esta tarefa, BACKLOG.md e HANDOFF.md.
- Evidências: implementação [7ccd005](https://github.com/Kaykygnb/StyloDesigner/commit/7ccd0057b7a30c79d7ecf18cbd4f731fce4ae100); [CI da implementação](https://github.com/Kaykygnb/StyloDesigner/actions/runs/38480360349). CI 38480360349 aprovada: Node 22, Node 24, build/documentação e login/administração Chromium/accounts.
- Testes executados: `npm test`: 610/610, zero falhas/cancelamentos/skips; targeted workspace/Studio/plugins/config: 45/45; typecheck, build e E2E administrativo/login aprovados. node docs/planning/validate-tasks.mjs e git diff --check exigidos antes desta publicação documental.
- Problemas encontrados: nenhuma pendência de aceitação; não cancela operações previamente autorizadas/em execução, conforme limite registrado.

## Histórico de trabalho

### 2026-10-13 21:24 UTC — [Codex] — proposta

- Investigado: leitura limitada durante revisão do fluxo accounts; sem reprodução deste cenário.
- Alterado: proposta registrada para próxima rodada, sem mudança de runtime.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: pendentes nesta proposta.
- Resultado: hipótese/escopo de validação marcado explicitamente como Proposto.
- Próximo passo: descobrir duplicações novamente, assumir e reproduzir antes de implementar.

### 2026-10-13 22:42 UTC — [Codex] — assunção e #1 Investigação

- Investigado: protocolo atualizado, handoff geral, backlog e código em `48b914a`; Leitura inicial confirmou papel armazenado em current/need e snapshot síncrono sem consulta de acesso atual. Isso sustenta a hipótese, mas downgrade/revogação ainda precisam ser reproduzidos em HTTP/MCP.
- Alterado: responsável, estado e marco #1; janela de trabalho declarada nesta tarefa.
- Arquivos: este documento, BACKLOG.md e HANDOFF.md; nenhum código alterado nesta assunção.
- Testes: validador documental antes da publicação; gates de runtime da sessão Kimi não foram reexecutados nesta etapa.
- Resultado: tarefa assumida após atualização por fast-forward; DOC-SERVER-005 permanece com [Kimi] em validação humana.
- Próximo passo: Reproduzir downgrade e revogação com workspace aberto; examinar também gates de agentes, plugins e snapshot antes de definir a correção.

### 2026-10-13 22:47 UTC — [Codex] — #1–#3 reprodução e correção

- Investigado: hipótese confirmada em HTTP accounts; rebaixamento mantinha papel antigo e permitia update_layer.
- Alterado: consulta leve por ID, revalidação de membro/grant, snapshot autorizado e gate save_project; dois testes de regressão adicionados.
- Arquivos: `services/projects.ts`, `workspace/index.ts`, `routes/studio.ts`, `tests/studio-api.test.js`, `tests/workspace.test.ts`, documentação do servidor e matriz de regressão.
- Testes: reproduções antes da correção falharam conforme esperado; typecheck aprovado; gates finais em execução. O primeiro teste após correção chegou ao caso final de slug, cujo preparo foi ajustado: new_project recusa arquivo compartilhado existente por contrato, então criar o próprio exige primeiro retirar esse compartilhamento.
- Resultado: marcos #1–#3 concluídos; #4 em andamento, sem alegar suíte final aprovada.
- Próximo passo: concluir testes, revisar resultados e publicar com evidências.

### 2026-10-13 22:54 UTC — [Codex] — #4–#5 validação e entrega

- Investigado: resultados finais, critérios e coerência entre gate de ferramentas e snapshot HTTP.
- Alterado: estado Concluída, critérios atendidos, marcos 5/5 e handoff final; implementação já publicada em 7ccd005.
- Arquivos: esta tarefa, BACKLOG.md e HANDOFF.md.
- Testes: `npm test`: 610/610, zero falhas/cancelamentos/skips; targeted workspace/Studio/plugins/config: 45/45; typecheck, build e E2E administrativo/login aprovados. Documentação validada antes da publicação final.
- Resultado: downgrade/revogação e grant de agente respeitados em chamadas novas; dono e membros autorizados continuam funcionando, sem mutação nas recusas.
- Próximo passo: DOC-STUDIO-003 para revisão visual; DOC-SERVER-005 permanece com Kimi aguardando revisão humana.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Próximo participante]
Estado: Concluída — entrega validada localmente e na CI
Marco atual: #5 — Validação final concluída
Última atualização: 2026-10-13 22:54 UTC
Commit de referência: `7ccd0057b7a30c79d7ecf18cbd4f731fce4ae100`

### Estado atual

Correção publicada na beta. Papel atual de membro e grant de agente revalidados antes das ferramentas dependentes do projeto; snapshot HTTP também protegido. Critérios atendidos.

### Decisões tomadas

Consulta leve por ID, sem documento/assets, preservando schema e APIs públicas. Snapshot interno continua síncrono para logging; rotas de dados devem usar snapshotForActor. Não invalidar a sessão inteira: recompartilhamento pode permitir continuar e ferramentas de abrir/criar/listar mantêm a recuperação.

### Arquivos envolvidos

services/projects.ts, workspace/index.ts, routes/studio.ts; testes studio-api/workspace; documentação do servidor, matriz, backlog e handoff.

### Evidências e testes

`npm test`: 610/610, zero falhas/cancelamentos/skips; targeted workspace/Studio/plugins/config: 45/45; typecheck, build e E2E administrativo/login aprovados. Implementação 7ccd005; CI 38480360349 aprovada nos quatro jobs. Reprodução anterior e resultados referenciados no histórico e marcos.

### Pendências

Nenhuma desta tarefa. DOC-STUDIO-003 segue com Codex para revisão visual; revisão humana de DOC-SERVER-005 permanece separada.

### Próximas ações recomendadas

Revisar jornadas humanas da DOC-STUDIO-003; preservar os gates e consultar os quatro jobs aprovados da CI 38480360349 como referência.

### Riscos e cuidados

Revalidação no início da chamada não cancela operações já autorizadas/em execução. SSE não foi redesenhado. Preservar gates e testes ao alterar plugins/ferramentas.

### Condições para conclusão

Critérios atendidos e gates locais aprovados; marcos 5/5 com evidências, implementação publicada.

## Rollback

Reverter o diff desta tarefa somente se houver regressão e preservar histórico/evidências; não retirar a revalidação sem um gate equivalente, pois restauraria a falha de autorização.
