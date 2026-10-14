# DOC-SERVER-005 — Verificar gates de autorização da configuração do servidor

Responsável: [Kimi]
Estado: Concluída
Início: 2026-10-13 22:22 UTC
Última atualização: 2026-10-14 02:39 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Kimi], [Codex]

## Problema e evidências

Problema original: PUT /config sem gate explícito de conta. Kimi implementou adminOf; testes agora distinguem proteção global de origem/JSON de autorização. Revisão técnica e aprovação humana beta registradas, com ressalva explícita sobre configurações sensíveis futuras.

## Objetivo

Reproduzir acesso anônimo e de membro em accounts; definir/assertar a política já existente de administração e corrigir os gates que não a cumprirem.

## Escopo

routes/system.ts, identidade e testes HTTP; modo local e casos OWNER/ADMIN/MEMBER; configuração pública e persistência sem exposição de chaves. Fora do escopo: redesenho da autenticação, mudança de schema e dados reais.

## Módulo e contratos afetados

- Módulo: server/autorização.
- Contratos: identidade, permissões atuais e formato de respostas; avaliar documentação antes da implementação.
- Testes: integração HTTP accounts e regressões relevantes, typecheck, npm test; E2E se tocar fluxo humano.
- Duplicações: DOC-SERVER-003 trata vínculo entre conta e sid; esta proposta trata mudança de permissão/gates após autenticação, com cenário distinto.

## Dependências, riscos e bloqueios

- Dependência: contexto de DOC-SERVER-003 e infraestrutura accounts de DOC-ENG-002.
- Gates reproduzidos por teste isolado e regressão. Aprovação beta recebida; arquitetura definitiva de poderes sensíveis continua em deliberação, sem mudar contratos ou imprimir credenciais.

## Critérios de aceitação

- [x] Cenário reproduzido e política confirmada com contratos existentes.
- [x] Comportamento autorizado permitido e acesso indevido recusado, sem mutação parcial.
- [x] Testes, regressões e documentação atualizados com evidências.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: leitura de `routes/system.ts`, `http/identity.ts`, `http/guards.ts`, `app.ts`, `services/auth.ts` (papel do usuário local), padrão de gates em `routes/plugins.ts` e `routes/auth.ts`, consumidores no Studio (`WorkspacePanel.tsx`, `lib/api.ts`) e testes existentes (`api-seguranca.test.js`, `contas-http.test.js`).
- Arquivos alterados: —
- Evidências: `PUT /api/config` (system.ts:83) e `PUT /api/agent/config` (system.ts:122) não chamam `identity.userOf/adminOf/ownerOf`; a proteção global (`localOnly` em app.ts:39-41) cobre Host/Origin/JSON, não autorização de conta. Usuário local tem papel `OWNER` (services/auth.ts:98-102), então gates `adminOf` não afetam o modo local. Testes de segurança existentes rodam em `STYLO_AUTH: local` e continuam válidos com gate de admin.
- Testes executados: leitura de `tests/api-seguranca.test.js` (linhas 55-103) e `tests/contas-http.test.js` (infra de servidor real por spawn).
- Problemas encontrados: hipótese confirmada — em modo contas, anônimo (ou qualquer papel) pode alterar `keepVersions`, injetar chave Pexels e mudar `agentPolicy` (postura de segurança de entrada de agentes) nos dois PUT de configuração.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: definição da política a partir dos contratos existentes — configuração de servidor segue o padrão `adminOf` (mesmo de `PUT /api/plugins/:id`, rotas `/api/sessions`, `/api/users`, backups). Leituras públicas (`GET /status`, `GET /agent/config`, `GET /presence`) permanecem como estão: não expõem chaves nem dados de conta.
- Arquivos alterados: —
- Evidências: política = `PUT /api/config` e `PUT /api/agent/config` exigem `identity.adminOf(c)` (OWNER/ADMIN). Modo local inalterado (usuário local é OWNER). Sem mudança de contrato de resposta nem de schema.
- Testes executados: —
- Problemas encontrados: —

### #3 — Implementação
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: `await identity.adminOf(c)` adicionado como primeira linha de `PUT /api/config` e de `PUT /api/agent/config` em `routes/system.ts`; cabeçalho do arquivo atualizado para registrar o requisito de administrador nos dois PUT.
- Arquivos alterados: `apps/server/src/routes/system.ts`
- Evidências: política = OWNER/ADMIN (mesmo padrão de `routes/plugins.ts` e rotas admin de `routes/auth.ts`); modo local inalterado porque o usuário técnico local é OWNER.
- Testes executados: typecheck sem erros.
- Problemas encontrados: —

### #4 — Testes
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: novo `tests/config-autorizacao.test.js` sobe o servidor real em modo contas e cobre: anônimo → 401 nos dois PUT; MEMBER → 403 nos dois PUT; recusas não mudam `keepVersions` nem `agentPolicy` (verificação de ausência de mutação parcial); OWNER e ADMIN alteram e persistem; chave Pexels nunca aparece em resposta.
- Arquivos alterados: `tests/config-autorizacao.test.js`
- Evidências: teste isolado passou (1/1); suíte completa 608/608; typecheck limpo; build de produção ok (apenas avisos pré-existentes de chunk > 500 kB).
- Testes executados: `node --import tsx --import ./tests/_setup.mjs --test tests/config-autorizacao.test.js`; `npm run typecheck`; `npm test`; `npm run build`.
- Problemas encontrados: —

### #5 — Validação final
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: preparação original [Kimi], revisão técnica [Codex]; aprovação explícita do proprietário humano para beta registrada com ressalvas. Implementação dos marcos #1–#4 e histórico Kimi preservados.
- Arquivos alterados: esta tarefa, backlog, handoff e documentação arquitetural.
- Evidências: código existente e f8f8141/7055b65; autorização humana nesta sessão. Aprovação não é certificação geral de segurança.
- Testes executados: config-autorizacao reexecutado 1/1 nesta rodada; suíte anterior 622/622 sem falhas/skips, typecheck/inventário aprovados; validador documental desta entrega.
- Problemas encontrados: política definitiva de segurança/privilégios/credenciais críticas separada da aprovação beta; não ampliar adminOf por inferência.

## Histórico de trabalho

### 2026-10-13 23:15 UTC — [Kimi] — handoff da tarefa

- Investigado: nada de código; fechamento da sessão com a tarefa em `Em validação`.
- Alterado: seção `## Handoff atual` criada com o estado real (gates implementados, testes 608/608, revisão humana pendente); criado `docs/planning/HANDOFF.md` geral e protocolo §10 em `TASK-PROTOCOL.md` (handoff passa a fazer parte do padrão do projeto).
- Arquivos: esta tarefa, `HANDOFF.md`, `TASK-PROTOCOL.md`, `_TEMPLATE.md`, `validate-tasks.mjs` (handoff obrigatório para tarefas em voo).
- Testes: `node docs/planning/validate-tasks.mjs` — 15 tarefas válidas.
- Resultado: continuidade garantida para o revisor humano ou próximo agente.
- Próximo passo: revisão humana; ver HANDOFF.md "Aguardando revisão".

### 2026-10-13 23:10 UTC — [Kimi] — #3 Implementação, #4 Testes e #5 Validação

- Investigado: confirmação de que nenhum consumidor do Studio além do painel admin usa `PUT /api/agent/config` e de que `PUT /api/config` não tem consumidor na UI; testes de segurança existentes rodam em modo local e cobrem apenas origem/tamanho, não papéis.
- Alterado: gates `identity.adminOf(c)` nos dois PUT de `routes/system.ts`; novo `tests/config-autorizacao.test.js` (reprodução anônimo/member/owner/admin + ausência de mutação parcial + não exposição da chave Pexels); política registrada em `docs/modules/server/README.md`; marcos #3 e #4 concluídos, estado `Em validação` (revisão humana pendente para marcar `Concluída`).
- Arquivos: `apps/server/src/routes/system.ts`, `tests/config-autorizacao.test.js`, `docs/modules/server/README.md`, esta tarefa e BACKLOG.md.
- Testes: novo teste isolado 1/1; `npm run typecheck` limpo; `npm test` 608/608; `npm run build` ok.
- Resultado: anônimo leva 401, MEMBER leva 403 e nada é mutado nas recusas; OWNER/ADMIN alteram e persistem; modo local inalterado (usuário técnico é OWNER).
- Próximo passo: revisão humana da evidência e, se aprovada, estado `Concluída`.

### 2026-10-13 22:45 UTC — [Kimi] — #1 Investigação e #2 Planejamento

- Investigado: `routes/system.ts` (PUT /config na linha 83 e PUT /agent/config na linha 122, ambos sem gate de identidade), `http/identity.ts` (userOf/ownerOf/adminOf), `http/guards.ts` (localOnly cobre Host/Origin/JSON, não conta), `services/auth.ts` (usuário local é OWNER, linha 101), padrão adminOf em `routes/plugins.ts:29` e `routes/auth.ts`, consumidores no Studio (`WorkspacePanel.tsx` — seletor de agentPolicy fica no painel admin) e testes existentes (`api-seguranca.test.js` em modo local, `contas-http.test.js` com spawn de servidor real).
- Alterado: marcos #1 e #2 concluídos com política definida: os dois PUT de configuração passam a exigir `identity.adminOf(c)`; leituras públicas inalteradas.
- Arquivos: apenas este documento.
- Testes: nenhum executado nesta entrada (investigação estática).
- Resultado: hipótese confirmada — anônimo/membro consegue hoje alterar keepVersions, injetar chave Pexels e mudar agentPolicy em modo contas. Sem mutação parcial a corrigir além dos gates.
- Próximo passo: implementar os gates (marco #3) e criar teste HTTP em modo contas reproduzindo anônimo/membro/owner (marco #4).

### 2026-10-13 22:22 UTC — [Kimi] — #1 Investigação (assunção)

- Investigado: protocolo, BACKLOG e duplicação com DOC-SERVER-004 (cenários distintos: esta tarefa trata dos gates de autorização da config; a 004, da revalidação de acesso pós-mudança de compartilhamento).
- Alterado: responsável registrado como [Kimi], estado `Em andamento`, marco #1 em andamento.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: nenhum nesta entrada.
- Resultado: tarefa assumida conforme protocolo §2, após `git pull` confirmar que a branch está sincronizada.
- Próximo passo: ler `routes/system.ts`, identidade e testes HTTP de accounts para reproduzir o acesso anônimo/membro em PUT /config.

### 2026-10-13 21:24 UTC — [Codex] — proposta

- Investigado: leitura limitada durante revisão do fluxo accounts; sem reprodução deste cenário.
- Alterado: proposta registrada para próxima rodada, sem mudança de runtime.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: pendentes nesta proposta.
- Resultado: hipótese/escopo de validação marcado explicitamente como Proposto.
- Próximo passo: descobrir duplicações novamente, assumir e reproduzir antes de implementar.

### 2026-10-14 02:22 UTC — [Codex] — revisão técnica independente por criticidade

- Investigado: implementação dos gates e regressão config-autorizacao; handoff exige revisão humana da escolha adminOf vs ownerOf, distinta do teste técnico.
- Alterado: registro da revisão; responsável implementador [Kimi] e pendência humana preservados. Nenhuma política alterada nem aprovação humana inferida.
- Arquivos: este documento.
- Testes: config-autorizacao aprovado na execução sem setup global com env hostil; typecheck aprovado; suíte final 622/622 sem falhas/skips, incluindo configuração. Revisão publicada em f8f8141.
- Resultado: rejeições anônimo/member e sucesso owner/admin exercitados; revisão técnica pode ser feita por outro agente sem esperar nova implementação de Kimi.
- Próximo passo: registrar suíte atual; proprietário avaliar política já implementada: OWNER e ADMIN alteram configurações, MEMBER e anônimo não.

### 2026-10-14 02:39 UTC — [Codex] — registro de aprovação humana e conclusão

- Investigado: deliberação explícita do proprietário humano, critérios/gates e histórico existente.
- Alterado: registrada aprovação beta: OWNER e ADMIN podem modificar configurações globais atualmente protegidas por identity.adminOf; MEMBER e anônimos não podem. Preservar autorização, ausência de mutação parcial e proteção de credenciais. Marco #5 concluído, mantendo autoria da implementação [Kimi]. Corrigida duplicação acidental de bloco Codex dentro da citação histórica de handoff, sem apagar o registro original.
- Arquivos: esta tarefa, BACKLOG.md, HANDOFF.md; ressalvas na ADR 0002.
- Testes: config-autorizacao 1/1 nesta sessão; evidência anterior da suíte 622/622 preservada; sem alteração funcional.
- Resultado: Concluída 5/5. Ressalva humana: aprovação não significa acesso de todo ADMIN a toda configuração global indefinidamente; políticas de segurança, privilégios e credenciais críticas devem ser avaliadas separadamente. Não é certificação geral de segurança.
- Próximo passo: DOC-ADMIN-001 propõe administração self-hosted e decisões pendentes, sem implementar poderes adicionais.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Próximo participante]
Estado: Concluído
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 02:39 UTC
Commit de referência: `7055b65f83db15f4aac3ea8a783bc8a9d4665b1e`

### Estado atual

Implementação Kimi concluída; aprovação humana beta registrada nesta sessão, 5/5. Os dois PUT permanecem adminOf, sem mudança de runtime nesta entrega.

### Decisões tomadas

OWNER/ADMIN autorizados nos PUT atuais; MEMBER/anônimo recusados. Aprovação beta com ressalva: segurança, privilégios e credenciais críticas serão avaliados separadamente. Não é aprovação universal de ADMIN nem certificação de segurança.

### Arquivos envolvidos

routes/system.ts, tests/config-autorizacao.test.js e docs/modules/server/README.md já existentes; registro nesta tarefa/planejamento e ADR 0002.

### Evidências e testes

Teste autorização reexecutado 1/1 nesta rodada; suíte anterior 622/622 e gates preservados. Aprovação humana explícita no histórico; deliberação estrutural não implementada.

### Pendências

Nenhuma para DOC-SERVER-005. Decisões de autoridade definitiva na ADR 0002 continuam propostas; DOC-MCP-001 não foi aprovado por esta decisão.

### Próximas ações recomendadas

Consultar DOC-ADMIN-001, inventário/matriz e decisões pendentes antes de assumir novas propostas; preservar os testes negativos, ausência de mutação e mascaramento de credenciais.

### Riscos e cuidados

Não estender aprovação a reset/suspensão de OWNER, delegação de privilégios ou credenciais críticas. Não remover gates nem substituir testes por mera inspeção.

### Condições para conclusão

Aprovação humana e gates registrados; critérios atendidos.

## Rollback

Reverter apenas com gate equivalente e decisão registrada; nunca restaurar configuração accounts aberta a anônimo/membro.
