# DOC-SERVER-007 — Validar identidade e revogação dos canais persistentes

Responsável: [Muse Spark]
Estado: Em andamento
Início: 2026-10-14 00:52 -03:00
Última atualização: 2026-10-14 00:52 -03:00
Progresso: 2/5 marcos (40%)
Participantes: [Muse Spark]

## Problema e evidências

- Problema: Achados estáticos ADM-RISK-02/05/09: SID MCP sem reautenticação universal; SSE sem binding de identidade/ACL. Não explorados nesta auditoria.
- Evidências observadas: docs/architecture/instance-administration/CURRENT-STATE.md; referências de código/testes e níveis de evidência preservados.

## Objetivo

Entregar o escopo com evidências e gates proporcionais; aprovação de mudança de autoridade antes da implementação, não inferida de DOC-SERVER-005.

## Escopo

- Incluído: Fixtures sintéticos: SID sem bearer, bearer trocado, rotação/revogação/scopes/suspensão dono; SSE anônimo, query identidade, projeto e sessão revogada. Vinculação/filtragem após política aprovada, sem alterar transporte.
- Fora do escopo: Não redesenhar MCP nem duplicar matriz de compatibilidade DOC-MCP-001; não garantir cancelamento de operações em voo sem contrato.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P0.
- Módulos relacionados: servidor, Studio, banco e agentes, por contratos atuais.
- Contratos/interfaces: identidade/autoridade contextual; sem mudanças nesta proposta.
- Testes relacionados: config-autorizacao, contas, MCP-contas, workspace, E2E accounts; validador documental. Só rodar os pertinentes ao escopo implementado.

## Dependências, riscos e bloqueios

- Dependências: DOC-ADMIN-001; DOC-SERVER-003/004 existentes; ADM-DEC-05/07/09. DOC-MCP-001 relacionada, não dependência bloqueante para investigar.
- Riscos: confundir risco estático com exploração; ampliar autoridade ou perder dados; duplicar sistema existente.
- Bloqueios: decisões humanas indicadas para mudar contrato; investigação sintética/documentação pode preceder aprovação.

## Critérios de aceitação

- [ ] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação.
- [ ] Política necessária aprovada antes de implementação; testes/gates e handoff coerentes com resultados reais.

- [ ] Testes descartáveis de SID com bearer omitido/trocado, token rotacionado/revogado, scopes alterados e dono suspenso; identidade da sessão não migra silenciosamente.
- [ ] SSE exercita anônimo, identidade/projeto forjados por query, notificações de projeto alheio e sessão revogada; expectativas de audiência aprovadas.
- [ ] Protocolos/limites e HTTP local preservados; efeito de revogação em operações já iniciadas explicitado sem prometer cancelamento não implementado.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: assunção conforme §2; leitura de BACKLOG, HANDOFF geral, DOC-ADMIN-001, CURRENT-STATE (ADM-RISK-02/05/09), gateway.ts, events.ts, system.ts:105-108, identity.ts, agents.ts; verificação de duplicação contra DOC-SERVER-006 e DOC-MCP-001; reprodução sintética descartável em PGlite memória (revogar/rotacionar/scopes/suspensão do dono).
- Arquivos alterados: este documento e BACKLOG.md (assunção). Script descartável fora do repo, removido após execução.
- Evidências: `authenticateAntesRevogar:true`, `revogarErro:401`, `tokenAntigoAposRotacaoErro:401`, `tokenNovoAposRotacaoOk:true`, `scopesAposReducao:["read"]`, `agenteValeAposDonoSuspenso:true` — suspensão do dono NÃO revoga o agente (ADM-RISK-05 reproduzido). Estático: POST com SID só reautentica se bearer presente (`gateway.ts:137`); GET/DELETE nunca reautenticam (`gateway.ts:141-144`); SSE aceita `id/user/file/color` por query sem `userOf` e sem ACL (`events.ts:35-58`, `system.ts:108`).
- Testes executados: `tests/mcp-contas.test.js + mcp-sdk + mcp-compatibilidade + presenca + config-autorizacao` — 17/17 aprovados; `node docs/planning/validate-tasks.mjs` — 28 tarefas válidas; reprodução sintética com `close()` em `finally`, sem rede, sem DATABASE_URL herdado, sem segredos impressos.
- Problemas encontrados: bearer trocado substitui `entry.session.agent` sem vínculo com a sessão original; POST com SID e sem bearer mantém o agente antigo; revogação só vale no próximo POST com bearer/initialize; SSE não fecha ao revogar; nenhuma cobertura de cancelamento de operações em voo.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: plano sem mudança de autoridade: (a) fixtures de SID — sem bearer, bearer trocado, token rotacionado/revogado, scopes alterados, dono suspenso, identidade da sessão não migra silenciosamente; (b) fixtures SSE — anônimo, identidade/projeto forjados por query, notificação de projeto alheio, sessão revogada; (c) regressões — MCP-SDK/contas/compatibilidade, presença, config-autorização; HTTP local e protocolos preservados; efeito de revogação em operações já iniciadas explicitado sem prometer cancelamento.
- Arquivos alterados: este documento.
- Evidências: plano restrito a teste/documentação; nenhuma alteração de runtime proposta sem aprovação de política (ADM-DEC-05/07/09).
- Testes executados: nenhum novo nesta entrada; base 17/17 acima continua válida.
- Problemas encontrados: #3 exige política humana aprovada (binding de identidade, filtragem/audiência do SSE, revogação instantânea e fechamento de canais); sem ela, #3-#5 ficam bloqueados por decisão, não por engenharia.

### #3 — Implementação

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #4 — Testes

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #5 — Validação final

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

## Histórico de trabalho

### 2026-10-14 02:39 UTC — [Codex] — proposta após investigação e deduplicação

- Investigado: backlog e inventário administrativo, investigações independentes e ADR 0002.
- Alterado: nenhum código.
- Arquivos: este documento.
- Testes: ainda não executados.
- Resultado: Proposta registrada; nenhuma autorização estrutural inferida.
- Próximo passo: consultar decisões pendentes e assumir conforme protocolo; reproduzir em ambiente descartável antes de implementar.

### 2026-10-14 03:34 UTC — [Codex] — reconciliação com diretrizes humanas

- Investigado: novo registro humano na ADR 0002, handoffs e dependências.
- Alterado: escopo esclarecido por HD: Registro HD não definiu política completa de suspensão/revogação agentes/em voo; identidade de canais pode ser investigada sem aguardar essa política futura. Não inferir autorização de implementação integral.
- Arquivos: esta tarefa e documentos administrativos relacionados.
- Testes: investigação/provas em recurso sintético conforme CURRENT-STATE; nenhum gate estrutural inventado.
- Resultado: investigação/desenho autorizados podem prosseguir, sem esperar deliberação geral. Autor/responsável e histórico preservados.
- Próximo passo: assumir etapa específica conforme protocolo; registrar bloqueio apenas de mudança que precisa decisão ainda aberta.

### 2026-10-14 00:52 -03:00 — [Muse Spark] — assunção e início #1

- Investigado: protocolo §1-§2, BACKLOG (única P0 livre sem responsável), HANDOFF geral, DOC-ADMIN-001 concluída, CURRENT-STATE ADM-RISK-02/05/09, gateway.ts:122-145, events.ts:35-58, system.ts:105-108, identity.ts, agents.ts:34-41. Sem duplicata: 006 cobre autoridade OWNER, MCP-001 cobre compatibilidade de clientes, esta cobre identidade/revogação de canais persistentes.
- Alterado: responsável [Muse Spark], Estado Em andamento, #1 em andamento. Sem runtime.
- Arquivos: esta tarefa, `docs/planning/BACKLOG.md`.
- Testes: ainda não executados.
- Resultado: tarefa assumida; investigação sintética autorizada sem aguardar deliberação geral.
- Próximo passo: concluir #1 com reprodução sintética descartável (SID sem bearer / bearer trocado / revogado; SSE anônimo/query forjada) e planejar #2 sem implementar mudança de autoridade.

### 2026-10-14 00:52 -03:00 — [Muse Spark] — #1 concluída e #2 planejada

- Investigado: fluxos SID/SSE, `agents.authenticate` (401 revogado/pendente/inválido), `rotate`/`setScopes`/`setSuspended`; ausência de `userOf`/ACL no SSE; GET/DELETE MCP sem reautenticação.
- Alterado: #1 concluída, #2 concluída (plano sem runtime); sem código funcional.
- Arquivos: este documento; `BACKLOG.md` (progresso).
- Testes: pertinentes 17/17; validador 28 tarefas; reprodução sintética PGlite com saída acima; `npm install` executado para prover `tsx`/Prisma (artefato local, sem mudança de código).
- Resultado: ADM-RISK-02 confirmado em código + comportamento de revogação/escopos/ /suspensão reproduzido; ADM-RISK-05 reproduzido (dono suspenso não revoga agente); ADM-RISK-09 confirmado estático (SSE sem binding/ACL/revogação).
- Próximo passo: aguardar política humana ADM-DEC-05/07/09 antes de #3; avaliar então fixtures permanentes e regressões; nova tarefa só se o escopo se dividir (ex.: SSE × MCP) após aceite.

## Handoff atual

Preparado por: [Muse Spark]
Destinatário: [Revisor humano]
Estado: Aguardando política humana; investigação e plano concluídos
Marco atual: #3 — Implementação (bloqueada por decisão)
Última atualização: 2026-10-14 00:52 -03:00
Commit de referência: `a445f61` (mais `npm install` local não commitado)

### Estado atual

#1 e #2 concluídas (2/5, 40%). Nenhuma mudança de runtime. #3-#5 exigem aprovação de política antes de implementar, conforme critérios da tarefa.

### Decisões tomadas

Investigação sintética/documentação pode preceder aprovação de política; nenhuma autorização estrutural inferida de DOC-SERVER-005 ou do registro HD. Implementação de vinculação/filtragem só após política aprovada.

### Arquivos envolvidos

Esta tarefa, `docs/planning/BACKLOG.md`; leitura de `apps/server/src/mcp/gateway.ts`, `apps/server/src/events.ts`, `apps/server/src/routes/system.ts`, `apps/server/src/http/identity.ts`, `apps/server/src/services/agents.ts`, `docs/architecture/instance-administration/CURRENT-STATE.md`.

### Evidências e testes

Reprodução PGlite memória: `authenticateAntesRevogar:true`, `revogarErro:401`, `tokenAntigoAposRotacaoErro:401`, `tokenNovoAposRotacaoOk:true`, `scopes:["read"]`, `agenteValeAposDonoSuspenso:true`. Pertinentes 17/17 (mcp-contas, mcp-sdk, mcp-compatibilidade, presenca, config-autorizacao); validador 28 tarefas. Estático: gateway.ts:137 só reautentica com bearer; gateway.ts:141-144 GET/DELETE sem reautenticação; events.ts:35-58 + system.ts:108 SSE sem auth/ACL. Limites: sem dados reais; sem prova de corrida/rede; sem cancelamento de operações em voo.

### Pendências

Concluir #1 com fixtures descartáveis; planejar #2; aguardar decisão humana ADM-DEC-05/07/09 antes de qualquer #3.

### Próximas ações recomendadas

1. Reproduzir em processo descartável: SID sem bearer, bearer trocado, token rotacionado/revogado, scopes alterados, dono suspenso; SSE anônimo, query forjada, sessão revogada.
2. Registrar resultados/limites sem dados reais e sem prometer cancelamento de operações em voo.
3. Desenhar #2 com regressões e condições de aceite.

### Riscos e cuidados

Não confundir risco estático com exploração; não ampliar autoridade nem duplicar DOC-SERVER-006/DOC-MCP-001; não usar dados/bancos externos herdados; usar configuração própria e fechar recursos (close/finally).

### Condições para conclusão

Critérios de aceitação cumpridos com política aprovada antes de implementar, testes/gates proporcionais e handoff coerente com resultados reais.

## Rollback

Descreva como desfazer a mudança sem apagar evidências.
