# DOC-SERVER-007 — Validar identidade e revogação dos canais persistentes

Responsável: [Grok]
Estado: Em validação
Início: 2026-10-14 00:52 -03:00
Última atualização: 2026-10-14 09:02 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Muse Spark], [Grok]

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

- [x] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação.
- [x] Política necessária aprovada antes de implementação; testes/gates e handoff coerentes com resultados reais.

- [x] Testes descartáveis de SID com bearer omitido/trocado, token rotacionado/revogado, scopes alterados e dono suspenso; identidade da sessão não migra silenciosamente.
- [x] SSE exercita anônimo, identidade/projeto forjados por query, notificações de projeto alheio e sessão revogada; expectativas de audiência aprovadas.
- [x] Protocolos/limites e HTTP local preservados; efeito de revogação em operações já iniciadas explicitado sem prometer cancelamento não implementado.

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

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: sessão MCP presa ao agente; POST/GET/DELETE revalidam a credencial; bearer de outro agente não troca a sessão; suspensão apaga sessões web, marca agentes ACTIVE como REVOKED e fecha canais; reativar a conta não devolve o token; SSE exige sessão, ignora identidade da query e filtra projeto (membro, dono ou OWNER da instalação; ADMIN sem membership não recebe); health e presença exigem sessão; `/api/status` continua público.
- Arquivos alterados: `apps/server/src/mcp/gateway.ts`, `agent-calls.ts`, `events.ts`, `routes/system.ts`, `services/auth.ts`, `services/agents.ts`, `main.ts`; testes e docs listados no histórico.
- Evidências: `tests/canais-persistentes.test.js` e `tests/servicos.test.ts` (suspensão).
- Testes executados: específicos aprovados antes da suíte; ver #5.
- Problemas encontrados: fechar a sessão na hora fazia o teste antigo de revogação ver 404. Sessão encerrada por credencial passa a responder 401. Transporte MCP e SSE não foi redesenhado.

### #4 — Testes

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: fixture HTTP de contas para SID e SSE; teste de serviço da suspensão; ajuste de `mcp-contas` preservado (401); `contas-http` confere que a query não define a pessoa; health do PostgreSQL usa a sessão.
- Arquivos alterados: `tests/canais-persistentes.test.js`, `tests/servicos.test.ts`, `tests/contas-http.test.js`, `tests/postgres-integracao.test.js`.
- Evidências: canais e serviços aprovados; suíte completa em #5.
- Testes executados: `node --import tsx --import ./tests/_setup.mjs --test --test-timeout=90000 tests/servicos.test.ts tests/canais-persistentes.test.js tests/mcp-contas.test.js tests/mcp-compatibilidade.test.js`.
- Problemas encontrados: nenhum depois do 401 da sessão encerrada.

### #5 — Validação final

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: typecheck, suíte, inventário, build, e2e e validador. PR draft para `v0.1.0-beta`, sem merge.
- Arquivos alterados: os desta entrega; inventário regenerado só com as menções do teste novo.
- Evidências: `npm run typecheck` aprovado. `npm test` 626/626, zero falhas e zero skips, em 2026-10-14 09:02 UTC. A primeira suíte, sem Chromium, teve 2 falhas de renderer e 19 skips; depois de `npx playwright install chromium`, a suíte repetida ficou limpa. `npm run build` aprovado. `npm run test:e2e` aprovado, incluindo suspensão e reativação de login. `npm run docs:inventario -- --check` válido (120 ferramentas). `node docs/planning/validate-tasks.mjs` 28 tarefas. `git diff --check` sem erro.
- Testes executados: `npm run typecheck`; `npm test`; `npm run build`; `npm run test:e2e`; `npm run docs:inventario -- --check`; `node docs/planning/validate-tasks.mjs`; `git diff --check`.
- Problemas encontrados: abrir ou gravar documento privado só por ser OWNER da instalação não foi feito aqui. A audiência do canal segue a decisão; o acesso ao documento fica para a tarefa que o PR #19 chama de DOC-SERVER-014. Transferência de responsabilidade não ganhou API nova: o compartilhamento existente continua. Uma ferramenta que já passou da checagem do sinal pode concluir o passo atual.

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

### 2026-10-14 09:02 UTC — [Grok] — transferência e #3 a #5

- Investigado: handoff de [Muse Spark], gateway, events, agents, auth, PRs abertos #17, #18 e #19. ADM-DEC-05/07/09 aprovadas pelo proprietário. #18 altera `auth.ts` na proteção do principal; #19 registra as decisões e aponta acesso de documento privado para outra tarefa; #17 mexe em Studio e inventário.
- Alterado: responsável de [Muse Spark] para [Grok]. Motivo: política desbloqueada e implementação pedida nesta sessão. Histórico anterior preservado.
- Arquivos: gateway, events, system, auth, agents, main, testes `canais-persistentes`, `servicos`, `contas-http`, `postgres-integracao`, README do servidor, CURRENT-STATE, PERMISSIONS, matriz de regressão, inventário, esta tarefa, backlog e handoff.
- Testes: `npm test` 626/626, zero falhas e zero skips. Typecheck, build, e2e, inventário `--check` e validador aprovados.
- Resultado: canais persistentes revalidam identidade. Suspensão invalida sessão e credencial de agente sem apagar histórico. Reativação não devolve o token.
- Próximo passo: revisão do PR draft. Não mergear.

### 2026-10-14 09:40 UTC — integração com a proteção do principal

- Investigado: a PR #18 reescreve `setSuspended`. A regra do principal e a revogação dos canais precisavam ficar juntas.
- Alterado: a suspensão permitida ainda apaga sessões, revoga agentes ACTIVE e fecha SSE e MCP. O principal não é suspenso. Outro OWNER só é suspenso pelo principal, com reconfirmação e auditoria. Reativar não devolve o token.
- Arquivos: `services/auth.ts`, `tests/servicos.test.ts`, `tests/canais-persistentes.test.js`, `tests/principal-autoridade.test.ts`.
- Testes: a suíte desta integração.
- Resultado: as duas regras convivem. O estado continua Em validação até o aceite humano. Documento privado de OWNER da instalação segue na DOC-SERVER-014.
- Próximo passo: revisão humana do comportamento integrado.

## Handoff atual

Preparado por: [Grok]
Destinatário: [Revisor humano]
Estado: Integrada em `v0.1.0-beta` com a trava do principal; aguardando aceite humano
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 09:40 UTC
Commit de referência: integração da PR #20 sobre a PR #18

### Estado atual

5/5. Runtime dos canais alterado. A suspensão permitida revoga agentes ACTIVE e fecha canais. A conta principal continua protegida pela DOC-SERVER-006.

### Decisões tomadas

ADM-DEC-05: suspensão revoga agentes ACTIVE e sessões; reativar a conta não reativa o token; o registro permanece. Credencial presa à sessão MCP; bearer alheio não migra a identidade. O sinal aborta chamada que ainda observa o sinal. Passo que já passou dessa checagem pode terminar.

ADM-DEC-07, só na audiência do canal: OWNER da instalação recebe evento de projeto privado; ADMIN sem membership não recebe e não há exceção. Abrir ou gravar o documento por esse papel não mudou. O PR #19 reserva isso a outra tarefa.

ADM-DEC-09: sem sessão, o canal de eventos recusa. Health e presença exigem sessão. Status continua o mínimo público. Modo local segue com o usuário técnico.

### Arquivos envolvidos

`apps/server/src/mcp/gateway.ts`, `apps/server/src/mcp/agent-calls.ts`, `apps/server/src/events.ts`, `apps/server/src/routes/system.ts`, `apps/server/src/services/auth.ts`, `apps/server/src/services/agents.ts`, `apps/server/src/main.ts`, `tests/canais-persistentes.test.js`, `tests/servicos.test.ts`.

### Evidências e testes

`npm test` 626/626, zero falhas e zero skips, 2026-10-14 09:02 UTC. Typecheck, build, e2e, inventário `--check` (120) e validador (28) aprovados. Sem dados reais e sem `DATABASE_URL` herdado.

### Pendências

Revisão humana do PR. Acesso de OWNER ao documento privado, fora do canal. API nova de transferência de responsabilidade. Cancelamento do passo que já entrou na ferramenta.

### Próximas ações recomendadas

1. Revisar o PR sem mergear.
2. Ao integrar com #18, manter dentro de `setSuspended` a revogação dos agentes ACTIVE e o hook que fecha os canais.
3. Não tratar este PR como a abertura de documento privado para todo OWNER.

### Riscos e cuidados

#18 reescreve `setSuspended` e `auth.ts`. #17 e #19 também editam backlog, handoff, PERMISSIONS e inventário. O slug na presença filtrada pode coincidir entre donos. Modo local não pede login.

### Condições para conclusão

Revisão do PR aceita. Critérios desta tarefa já têm evidência de execução.

## Rollback

Descreva como desfazer a mudança sem apagar evidências.
