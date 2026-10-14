# DOC-ADMIN-001 — Deliberar arquitetura de administração self-hosted

Responsável: [Codex]
Estado: Concluída
Início: 2026-10-14 02:39 UTC
Última atualização: 2026-10-14 02:39 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Codex], [authority_audit], [operations_audit], [admin_ui_audit], [architecture_review]

## Problema e evidências

- Problema: Auditar e propor domínio administrativo sem mudanças estruturais.
- Evidências observadas: docs/architecture/instance-administration/CURRENT-STATE.md; referências de código/testes e níveis de evidência preservados.

## Objetivo

Entregar o escopo com evidências e gates proporcionais; aprovação de mudança de autoridade antes da implementação, não inferida de DOC-SERVER-005.

## Escopo

- Incluído: Inventário, arquitetura, matriz, ADR, roadmap, aprovação beta SERVER005, revisão independente e índices.
- Fora do escopo: Nenhuma implementação funcional, tenancy ou alteração de autorização.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: administration; prioridade P1.
- Módulos relacionados: servidor, Studio, banco e agentes, por contratos atuais.
- Contratos/interfaces: identidade/autoridade contextual; sem mudanças nesta proposta.
- Testes relacionados: config-autorizacao, contas, MCP-contas, workspace, E2E accounts; validador documental. Só rodar os pertinentes ao escopo implementado.

## Dependências, riscos e bloqueios

- Dependências: DOC-SERVER-005; ADR 0001; DOC-DB-001 e DOC-STUDIO-003/005 relacionados.
- Riscos: confundir risco estático com exploração; ampliar autoridade ou perder dados; duplicar sistema existente.
- Bloqueios: decisões humanas indicadas para mudar contrato; investigação sintética/documentação pode preceder aprovação.

## Critérios de aceitação

- [x] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação.
- [x] Entregáveis documentais/revisão/validador/links completos; arquitetura explicitamente proposta e handoff de decisões humanas. Não exigir aprovação arquitetural para concluir sua preparação documental.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: investigação delegada, recomendação e documentação; aprovação beta registrada. Escopo exclusivamente documental.
- Arquivos alterados: docs/architecture/instance-administration, ADR 0002, planejamento e índices.
- Evidências: snapshot 7055b65, relatórios dos três investigadores; referências código/testes; guard sintético 403/403/allowed.
- Testes executados: config-autorizacao 1/1; inspeção sem GUI; revisão independente em andamento.
- Problemas encontrados: poderes sobre OWNER, canais persistentes e bootstrap/origem/backup/auditoria exigem deliberação, não implantação antecipada.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: investigação delegada, recomendação e documentação; aprovação beta registrada. Escopo exclusivamente documental.
- Arquivos alterados: docs/architecture/instance-administration, ADR 0002, planejamento e índices.
- Evidências: snapshot 7055b65, relatórios dos três investigadores; referências código/testes; guard sintético 403/403/allowed.
- Testes executados: config-autorizacao 1/1; inspeção sem GUI; revisão independente em andamento.
- Problemas encontrados: poderes sobre OWNER, canais persistentes e bootstrap/origem/backup/auditoria exigem deliberação, não implantação antecipada.

### #3 — Preparação documental

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: investigação delegada, recomendação e documentação; aprovação beta registrada. Escopo exclusivamente documental.
- Arquivos alterados: docs/architecture/instance-administration, ADR 0002, planejamento e índices.
- Evidências: snapshot 7055b65, relatórios dos três investigadores; referências código/testes; guard sintético 403/403/allowed.
- Testes executados: config-autorizacao 1/1; inspeção sem GUI; revisão independente em andamento.
- Problemas encontrados: poderes sobre OWNER, canais persistentes e bootstrap/origem/backup/auditoria exigem deliberação, não implantação antecipada.

### #4 — Revisão independente e testes documentais

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: revisão independente architecture_review; corrigir link WorkspacePanel, incluir SSE/política accounts e critérios específicos das propostas; validar referências e formato. Conclusão documental não aprova a arquitetura nem altera contratos.
- Arquivos alterados: pacote administrativo, ADR 0002, tarefas/índices/handoff.
- Evidências: review independente sem bloqueios após critérios verificáveis; snapshot 7055b65; guard sintético 403/403/allowed.
- Testes executados: config-autorizacao 1/1 nesta rodada; validador 25 tarefas; links locais e git diff --check. Suíte 622/622 é evidência anterior, não rerodada nesta entrega documental.
- Problemas encontrados: decisões ADM-DEC-01..09 permanecem pendentes; somente ADM-DEC-00 foi aprovada. Nenhuma exploração visual ou vulnerabilidade nova reproduzida.

### #5 — Validação final da preparação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: revisão independente architecture_review; corrigir link WorkspacePanel, incluir SSE/política accounts e critérios específicos das propostas; validar referências e formato. Conclusão documental não aprova a arquitetura nem altera contratos.
- Arquivos alterados: pacote administrativo, ADR 0002, tarefas/índices/handoff.
- Evidências: review independente sem bloqueios após critérios verificáveis; snapshot 7055b65; guard sintético 403/403/allowed.
- Testes executados: config-autorizacao 1/1 nesta rodada; validador 25 tarefas; links locais e git diff --check. Suíte 622/622 é evidência anterior, não rerodada nesta entrega documental.
- Problemas encontrados: decisões ADM-DEC-01..09 permanecem pendentes; somente ADM-DEC-00 foi aprovada. Nenhuma exploração visual ou vulnerabilidade nova reproduzida.

## Histórico de trabalho

### 2026-10-14 02:39 UTC — [Codex] — proposta após investigação e deduplicação

- Investigado: backlog e inventário administrativo, investigações independentes e ADR 0002.
- Alterado: nenhum código.
- Arquivos: este documento.
- Testes: ainda não executados.
- Resultado: Proposta registrada; nenhuma autorização estrutural inferida.
- Próximo passo: consultar decisões pendentes e assumir conforme protocolo; reproduzir em ambiente descartável antes de implementar.

### 2026-10-14 02:46 UTC — [Codex] — preparação validada e review independente

- Investigado: três auditorias delegadas e revisão architecture_review do pacote/autoridade/links/deduplicação.
- Alterado: corrigir links, risco SSE e policy local/accounts; critérios específicos por proposta; index/handoff. Somente Markdown nesta entrega.
- Arquivos: docs/architecture/instance-administration/{README,CURRENT-STATE,ARCHITECTURE,PERMISSIONS,ROADMAP}.md; ADR 0002; planejamento/índices/módulo server.
- Testes: autorização 1/1; guard sintético 403/403/allowed; validador/links/diff aprovados. Nenhum QA visual ou teste de produção.
- Resultado: 5/5 da preparação documental; recomendação estrutural permanece proposta. Propostas SERVER006/007/008 e ADMIN002 não assumidas; DB001/Studio existentes reaproveitadas.
- Próximo passo: publicar docs na beta e apresentar ADM-DEC-01..09 ao humano; não implementar estruturas por inferência. Aprovação SERVER005 registrada separadamente com ressalvas.

### 2026-10-14 03:34 UTC — [Codex] — registro humano complementar sem reabrir arquitetura integral

- Investigado: 21 HD, estado beta50a8d00 e tarefas/handoffs; delegada investigação de conflitos/SMTP e prova restore.
- Alterado: ADR reconciliada, matriz/plano de transição/onboarding/recuperação e propostas específicas; recomendações não promovidas a decisões humanas.
- Arquivos: arquitetura/planejamento administrativos e índices.
- Testes: achado OWNER reproduzido sintético sem projetos/rede; restore real específico 5/5; gates globais em execução. Sem código funcional alterado.
- Resultado: aprovação/diretriz humana registrada; tarefa documental original continua concluída. Requisitos não equivalem implementação aprovada.
- Próximo passo: review independente, publicar; engenharia prossegue DB001 sem definir estratégia final de produção.

### 2026-10-14 03:42 UTC — [Codex] — registro HD revisado e engenharia validada

- Investigado: review independente identity_conflicts comparou21HD com instrução humana e checou limites; arquitetura_review revisou restore real.
- Alterado: reconciliados trechos antigos local/tenancy/estado/riscos, mantendo21IDs; reforçada prova de grant. Registro documental não implementa novos poderes/SMTP/principal.
- Arquivos: ADR/plano/matriz/inventário/contratos/planejamento e tests/restore-pglite.test.ts.
- Testes: reprodução OWNER emmemória observada; suíte624/624 sem falhas/skips; combinado final5/5 após asserção; typecheck, inventário, validador28, links147 e diff aprovados.
- Resultado: visão humana formalizada; SERVER006 investigação1/5 e DB0014/5 retomadas. Não fingir decisão futura aprovada ou PostgreSQL restore concluído.
- Próximo passo: publicar na beta e continuar planejamentoprincipal/provaPG conforme handoffs, sem aguardar deliberação genérica.

## Handoff atual

Preparado por: [Codex]
Destinatário: [architecture_review / proprietário humano]
Estado: Preparação concluída; aguardando deliberação humana da arquitetura
Marco atual: #5 — Validação final da preparação
Última atualização: 2026-10-14 02:39 UTC
Commit de referência: `7055b65f83db15f4aac3ea8a783bc8a9d4665b1e`

### Estado atual

Documentos preparados e revisados independentemente, gates aprovados. Somente preparação concluída; arquitetura/decisões pendentes e nenhuma implementação funcional.

### Decisões tomadas

Recomendar organização única e domínio administrativo sobre serviços atuais. Somente adminOf dos PUT beta foi aprovado pelo humano, na DOC-SERVER-005.

### Arquivos envolvidos

Inventário, arquitetura, matriz, roadmap, ADR 0002, tarefas/índices/handoff.

### Evidências e testes

Investigações independentes; referência snapshot; teste autorização 1/1 e guard sintético. Sem exploração visual ou vulnerabilidade nova reproduzida.

### Pendências

ADM-DEC-01..09 aguardam deliberação humana, distinta da conclusão documental; ADM-DEC-00 beta aprovada e registrada em SERVER005.

### Próximas ações recomendadas

Revisar documentos, executar gates, registrar propostas deduplicadas e apresentar decisões humanas; não implementar estruturas.

### Riscos e cuidados

Preservar autoria Kimi, aprovação beta com ressalvas e contratos atuais; não dar capacidades superiores ao agente por inferência.

### Condições para conclusão

Critérios documentais atendidos, revisão/gates aprovados; publicação na beta nesta entrega. Decisões de arquitetura permanecem explicitamente propostas.

## Rollback

Descreva como desfazer a mudança sem apagar evidências.
