# DOC-SERVER-006 — Validar autoridade contextual e proteção de OWNER

Responsável: [Grok]
Estado: Em andamento
Início: 2026-10-14 03:37 UTC
Última atualização: 2026-10-14 08:39 UTC
Progresso: 5/6 marcos (83%)
Participantes: [Codex], [identity_conflicts], [Grok]

## Problema e evidências

- Problema: ADM-RISK-01 reproduzido em PGlite memória/Hono: ADMIN resetou/suspendeu/rebaixou/apagou primeira OWNER sem projetos, zero OWNERs humanos; risco05 write/share permanece comportamento amplo. Ver script/evidência no inventário.
- Evidências observadas: docs/architecture/instance-administration/CURRENT-STATE.md; referências de código/testes e níveis de evidência preservados.

## Objetivo

Entregar o escopo com evidências e gates proporcionais; aprovação de mudança de autoridade antes da implementação, não inferida de DOC-SERVER-005.

## Escopo

- Incluído: Reproduzir alvos OWNER/ADMIN/último OWNER e delegação por fixtures; definir/aplicar apenas política aprovada com regressões de negativa sem mutação e compatibilidade de scopes.
- Fora do escopo: Não presumir aprovação da arquitetura definitiva, singleton OWNER ou mudança automática de write/share.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P0.
- Módulos relacionados: servidor, Studio, banco e agentes, por contratos atuais.
- Contratos/interfaces: ponteiro `Installation.principalUserId`; setup designa a primeira conta humana. Só essa conta nomeia, suspende, reativa, rebaixa, remove ou redefine senha de um OWNER, depois de reconfirmar a própria senha. Sem ponteiro, ninguém faz isso. Reset de OWNER recebe a senha nova no pedido e não a devolve. Convite e reset de quem não é OWNER ainda devolvem senha temporária uma vez. Revogação de sessão, transferência, códigos offline, write/share e acesso a projeto privado não mudaram.
- Testes relacionados: config-autorizacao, contas, MCP-contas, workspace, E2E accounts; validador documental. Só rodar os pertinentes ao escopo implementado.

## Dependências, riscos e bloqueios

- Dependências: DOC-ADMIN-001, DOC-SERVER-005; decisões ADM-DEC-02/03/04/07. DOC-SERVER-004 não cobre hierarquia. Em 2026-10-14 o proprietário aprovou o texto de ADM-DEC-03 e HD-OWNERSHIP-05 registrado abaixo. ADM-DEC-02 continua pendente.
- Riscos: confundir risco estático com exploração; ampliar autoridade ou perder dados; duplicar sistema existente. Tratar a hierarquia como nota numérica de papel também foge do texto aprovado.
- Bloqueios: ADM-DEC-02 pendente. O procedimento de emergência e os códigos offline de uso único continuam por projetar, em ticket próprio. A transferência do principal também não entrou neste runtime.

## Decisões humanas aprovadas em 2026-10-14

Texto do proprietário, copiado sem reinterpretar. Outro agente grava o mesmo conteúdo na ADR 0002, no backlog e na visão de produto. Este arquivo não edita esses documentos.

(a) ADM-DEC-03 e HD-OWNERSHIP-05, aprovadas: o OWNER principal pode nomear, suspender, rebaixar e remover OWNERs secundários. Operações sensíveis exigem autenticação reforçada e auditoria. ADMINs não administram contas OWNER como comuns. Senhas nunca reveladas.

(b) Hierarquia aprovada: OWNER principal > OWNER secundário > ADMIN > MEMBER > VIEWER. OWNERs secundários têm acesso amplo aos projetos organizacionais, mas não podem substituir, suspender, remover ou rebaixar o principal. ADMINs não têm acesso implícito a projetos privados. Projeto privado não bloqueia OWNERs da organização. A autorização considera recurso, operação e escopo, não uma comparação numérica de papéis.

(c) Recuperação do principal aprovada por códigos offline de uso único. O procedimento de emergência ainda está por projetar.

(d) Transferência do principal aprovada com autenticação reforçada, sucessor explícito que aceita e confirma identidade, operação atômica, auditoria e tratamento das sessões administrativas. Nunca por antiguidade, troca informal de papel ou remoção do titular.

O runtime agora aplica de (a) a parte de nomear, suspender, rebaixar e remover OWNER secundário, com autenticação reforçada e auditoria. ADMIN e OWNER secundário não rebaixam, suspendem, removem nem redefinem senha de nenhum OWNER. O secundário não age sobre o principal. A senha já gravada não é lida de volta. No reset de um OWNER secundário, a senha temporária gerada e devolvida foi recusada: o principal informa a senha nova e a resposta não a repete. O reset do principal fica recusado aqui; a recuperação por códigos offline não cabe neste recorte e fica para um ticket próprio.

Mecanismo escolhido pelos engenheiros, substituível: `POST /api/me/reconfirm` confere a senha atual e abre uma janela de 5 minutos só na memória do processo (`STEP_UP_MS` em `services/auth.ts`). A regra de quem pode administrar um OWNER não mora nessa janela. Quem não é o principal recebe a recusa de autoridade, sem pedido de reconfirmação.

De (b), o runtime usa o ponteiro, não uma nota numérica de papel. O acesso amplo do secundário aos projetos da organização, a ausência de acesso implícito do ADMIN a projeto privado e a regra de que projeto privado não bloqueia OWNER da organização não foram implementados. (c) e (d) não foram implementados. ADM-DEC-02 não foi implementada. A revogação de sessão de um OWNER continua no caminho antigo, porque a decisão não a listou.

## Critérios de aceitação

- [x] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação. Limite explícito: códigos offline, procedimento de emergência, transferência, acesso a projeto privado, revogação de sessão de OWNER e ADM-DEC-02.
- [x] Política necessária aprovada antes de implementação; testes/gates e handoff coerentes com resultados reais. A administração de OWNER secundário usa o texto de 2026-10-14. O mecanismo da janela de senha foi escolha de engenharia, documentada e substituível.

- [x] Matriz ator/alvo cobre principal, OWNER secundário, ADMIN, conta comum e o caso sem ponteiro para nomear, suspender, reativar, rebaixar, remover e redefinir senha. Revogação de sessão de OWNER não entrou na matriz nova. ADM-DEC-02 segue pendente. Projeto privado e transferência não têm expectativa aplicada aqui.
- [x] Negativas não mutam papel/senha/status/sessões. O reset de OWNER secundário muda a senha só quando o principal reconfirma e envia a senha nova; a resposta não a contém. Convite e reset de quem não é OWNER continuam devolvendo senha temporária uma vez. Modo local e administração comum de membro seguem.
- [x] Delegação de compartilhamento por agente respeita teto aprovado; comportamento write/share atual não muda antes do aceite/plano compatível. Nenhuma alteração nesse caminho. O catálogo MCP não ganhou ferramenta de conta. Token de agente nas rotas de usuário responde 401.

- [x] Principal distinguido e protegido conforme HD-OWNERSHIP-02, sem confundir OWNER adicional; concessão OWNER exclusiva do principal conforme HD-OWNERSHIP-03. Sem ponteiro, a concessão também fica recusada. Banco antigo não é designado por heurística. A revisão humana do conjunto que ainda falta (códigos, emergência, transferência, projeto privado) continua aberta.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: handoff/docs/backlog lidos; investigação delegada identity_conflicts confirmou alvos OWNER; reprodução Hono/PGlite memória, sem rede ou dados externos. Nenhum principal persistido atual.
- Arquivos alterados: esta tarefa, CURRENT-STATE e ADR/plano de identidade; sem runtime.
- Evidências: script/stdout/limites no inventário; ADMIN reset200/suspend200/demote200/delete200; zero OWNER humanos no caso sem projetos. HD-OWNERSHIP-02/03 definidos, modelo/migração precisa projeto.
- Testes executados: reprodução sintética com close finally, exit0; não gate que celebra falha. Referências de linha verificadas, não estimadas.
- Problemas encontrados: proteger principal exige distingui-lo; não corrigir por heurística primeirotimestamp/UUID nem bloquear todo OWNER em nome de decisão humana diferente. Reset/transferência/matriz completa não decididos.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: invariantes do ponteiro único; migração que nasce nula; separação entre principal e OWNER adicional; lista do que a decisão humana ainda não autoriza (reset, sessões, e-mail, transferência, designação de banco antigo, write/share). Conferida a PR #17: ela mexe em exportação/paridade do Studio e nos mesmos índices documentais, não em auth nem no schema.
- Arquivos alterados: esta tarefa, plano de identidade, ADR 0002, matriz, estado atual, roadmap.
- Evidências: desenho registrado no plano de identidade; a migração `0015` não contém `UPDATE` em `User` nem ordenação por data/id.
- Testes executados: nenhum neste marco; a prova ficou no marco de testes.
- Problemas encontrados: não há como descobrir o principal de um banco já usado sem uma decisão humana, porque a conta original pode ter sido rebaixada.

### #3 — Implementação

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: tabela `Installation`, setup transacional, recusa de suspender/rebaixar/excluir o principal designado, concessão de OWNER só por essa conta. Ponteiro vazio preserva o comportamento anterior. Reset, revogação de sessão, write/share e usuário técnico não foram alterados.
- Arquivos alterados: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/0015_autoridade_principal/migration.sql`, `apps/server/src/services/auth.ts`, `apps/server/src/routes/auth.ts`.
- Evidências: recusas 403 antes da gravação; OWNER adicional continua rebaixável; modo local não preenche o ponteiro.
- Testes executados: ver marco #4.
- Problemas encontrados: o painel ainda não mostra quem é o principal. ADMIN ainda altera nome e e-mail do principal se o papel enviado continuar OWNER.

### #4 — Testes

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: teste focal em PGlite memória, sem rede e sem URL herdada; gates do projeto.
- Arquivos alterados: `tests/principal-autoridade.test.ts` e documentos de regressão.
- Evidências: migração reaplicada sobre contas sintéticas deixa o ponteiro nulo e os hashes iguais; corrida de setup deixa uma conta humana; negativas do principal não mudam papel, senha, suspensão nem sessões; principal cria outro OWNER e esse outro não cria um terceiro.
- Testes executados: `tests/principal-autoridade.test.ts` 3/3; suíte `npm test` 627/627, zero falhas e zero skips; `npm run typecheck`, `npm run build`, `npm run docs:inventario -- --check` e `node docs/planning/validate-tasks.mjs` aprovados.
- Problemas encontrados: reset e revogação de sessão do principal continuam com sucesso HTTP 200. Isso foi observado e não virou teste que aprove a falha.

### #5 — Validação da administração de OWNER

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: o principal, depois de reconfirmar a senha, nomeia, suspende, reativa, rebaixa, remove e redefine a senha de um OWNER secundário. Cada uma dessas gravações leva um evento de auditoria na mesma transação. ADMIN e secundário recebem 403 sem mutação e sem serem mandados a reconfirmar. O principal não é suspenso, rebaixado, removido nem tem a senha redefinida por esta rota. A resposta do reset de OWNER não contém senha. O Studio chama as mesmas rotas e só mostra essas ações quando o servidor marca `principal`. O MCP não recebeu ferramenta nova.
- Arquivos alterados: `services/auth.ts`, `routes/auth.ts`, `WorkspacePanel.tsx`, `api.ts`, `types.ts`, `Dialog.tsx`, `i18n.ts`, `tests/principal-autoridade.test.ts` e esta tarefa.
- Evidências: `tests/principal-autoridade.test.ts` cobre a matriz, a janela de 5 minutos, o limite de tentativas, o 409 quando o secundário ainda tem projeto, o 401 do token de agente e a ausência das ferramentas de conta no catálogo.
- Testes executados: `npm run typecheck`; `npm run build`; `npm test` 629/629, zero falhas e zero skips; `npm run docs:inventario -- --check` (120 ferramentas, 97 núcleo, 23 plugins); `node docs/planning/validate-tasks.mjs` (28 tarefas); `npm run test:e2e` com 19 fluxos aprovados. O navegador cria um OWNER secundário, reconfirma a senha do principal e redefine a senha desse OWNER sem exibir senha.
- Problemas encontrados: revogar sessões de um OWNER continua disponível para ADMIN, porque essa ação não estava na lista aprovada. Códigos offline, emergência, transferência, projeto privado e ADM-DEC-02 ficaram de fora de propósito.

### #6 — O que a decisão ainda não colocou no runtime

- Estado: bloqueado
- Responsável: [Grok]
- Atividades executadas: nenhuma implementação. O tamanho da recuperação do principal justifica ticket próprio: códigos offline de uso único e o procedimento de emergência. A transferência com sucessor que aceita também fica fora. O acesso do OWNER secundário aos projetos da organização e a regra do projeto privado não foram desenhados aqui. ADM-DEC-02 continua pendente.
- Arquivos alterados: somente esta tarefa, para registrar o limite.
- Evidências: a seção de decisões diz o que o runtime faz e o que não faz.
- Testes executados: nenhum para esses itens, porque não há código deles.
- Problemas encontrados: sem o ticket de códigos offline, o principal não tem recuperação por esta aplicação. A revogação de sessão de OWNER segue o comportamento anterior.

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
- Alterado: escopo esclarecido por HD: HD-OWNERSHIP-01..05, HD-ADMIN-01..04: principal protegido e somente principal concede OWNER; múltiplos OWNERs aprovados. Modelo/transferência/reset/matriz sensível e compartilhamento concretos abertos. Não inferir autorização de implementação integral.
- Arquivos: esta tarefa e documentos administrativos relacionados.
- Testes: investigação/provas em recurso sintético conforme CURRENT-STATE; nenhum gate estrutural inventado.
- Resultado: investigação/desenho autorizados podem prosseguir, sem esperar deliberação geral. Autor/responsável e histórico preservados.
- Próximo passo: assumir etapa específica conforme protocolo; registrar bloqueio apenas de mudança que precisa decisão ainda aberta.

### 2026-10-14 03:37 UTC — [Codex] — assunção e marco #1 retomados por criticidade

- Investigado: histórico/handoff, HD e achado reproduzido pelo agente em fixture própria; remoto base50a8d00 sem avanço na consulta.
- Alterado: responsável Codex, 1/5 investigação concluída. Janela: taskSERVER006 e docs autoridade; nenhuma alteração runtime. Requisitos principal definidos não autorizam migrar banco real.
- Arquivos: esta tarefa, inventário, ADR/plano e índice.
- Testes: ADMIN reset/suspensão/rebaixamento/exclusão da primeira OWNER sem projetos reproduzidos; sem rede/URL herdada. Segurança produção/concorrência não testadas.
- Resultado: investigação técnica P0 retomada; próxima etapa modelo/invariantes/migração. DB001 segue independente em paralelo.
- Próximo passo: planejar representação principal/upgrade seguro e regressões antes de implementar; separar questões abertas de poderes adicionais e compartilhar por agentes.

### 2026-10-14 08:18 UTC — [Grok] — transferência e recorte do principal

- Investigado: handoff, HD-OWNERSHIP-02/03, HD-ONBOARDING-03, schema, rotas de conta e a PR #17. A PR altera exportação e paridade do Studio; não altera auth nem o schema. O conflito previsto é só de documentação compartilhada (backlog, handoff, permissões, servidor e matriz de regressão).
- Alterado: responsável de [Codex] para [Grok], com o histórico de [Codex] preservado. Marco #2 planejado; #3 e #4 entregam só o recorte já decidido. #5 bloqueado para revisão humana.
- Arquivos: `schema.prisma`, migração `0015_autoridade_principal`, `services/auth.ts`, `routes/auth.ts`, `tests/principal-autoridade.test.ts`, plano de identidade, estado atual, permissões, ADR 0002, backlog e handoff.
- Testes: suíte 627/627, zero falhas e zero skips, em 2026-10-14. Typecheck, build do Studio, inventário (`120 ferramentas`) e validador (`28 tarefas`) aprovados. E2E de navegador não rodou. Reset do principal por ADMIN observado à parte: HTTP 200, senha temporária e sessões zeradas; não entrou como teste de comportamento desejado.
- Resultado: instalação nova distingue e protege o principal. Banco antigo sobe com ponteiro vazio. Write/share, usuário técnico, reset e revogação de sessão não mudaram de regra.
- Próximo passo: o proprietário revisa o modelo na PR e decide reset, sessões, transferência e quem designa o principal num banco que já tem contas.

### 2026-10-14 08:22 UTC — [Grok] — registro das decisões humanas, sem reinterpretar

- Investigado: mensagem do proprietário de 2026-10-14 sobre ADM-DEC-03, HD-OWNERSHIP-05, hierarquia, códigos offline e transferência. ADM-DEC-02 permanece pendente.
- Alterado: só esta tarefa. ADR 0002, backlog e visão de produto ficam com o outro agente. Edições anteriores deste trabalho nesses arquivos foram desfeitas para não cruzar com ele.
- Arquivos: `docs/planning/tasks/server/DOC-SERVER-006.md`.
- Testes: nenhum. O runtime não mudou nesta entrada.
- Resultado: o texto aprovado está copiado na seção de decisões. (a), (b), (c) e (d) não foram implementados. O procedimento de emergência segue por projetar.
- Próximo passo: aplicar o texto só quando autenticação reforçada, auditoria e o procedimento ainda em aberto tiverem desenho próprio, sem comparar papéis por número e sem escolher principal por antiguidade.

### 2026-10-14 08:39 UTC — [Grok] — administração de OWNER no runtime

- Investigado: rotas de conta, painel, catálogo MCP e a CI. O job `navegador` exige `npm run test:e2e` para mudança de contas.
- Alterado: só o principal administra outro OWNER, com reconfirmação da senha atual por 5 minutos e evento de auditoria. Reset de OWNER não devolve senha. O principal não é redefinido por aqui.
- Arquivos: `services/auth.ts`, `routes/auth.ts`, painel do Studio (`WorkspacePanel.tsx`, `api.ts`, `Dialog.tsx`, `i18n.ts`, `types.ts`), `tests/principal-autoridade.test.ts` e esta tarefa. ADR 0002, backlog e visão de produto não foram editados.
- Testes: typecheck, build, suíte 629/629, inventário, validador e E2E 19/19. O navegador reconfirma a senha e cria/redefine um OWNER secundário sem mostrar a senha.
- Resultado: (a) está no runtime para nomear, suspender, rebaixar, remover e redefinir senha de secundário. (b) no que é papel de conta, sem nota numérica e sem a parte de projeto. (c) e (d) continuam de fora. ADM-DEC-02 continua pendente.
- Próximo passo: ticket próprio para códigos offline e o procedimento de emergência. Não escolher titular por antiguidade.

### 2026-10-14 09:40 UTC — integração com DOC-SERVER-007

- Investigado: o índice ainda dizia 1/5 e [Codex]. O documento já estava em 5/6, [Grok], com o marco #6 bloqueado.
- Alterado: `BACKLOG.md` alinhado a este documento. `setSuspended` continua com a trava do principal, a reconfirmação e a auditoria, e também revoga agentes ACTIVE e fecha canais quando a suspensão é permitida.
- Arquivos: backlog, `services/auth.ts` e os testes da suspensão.
- Testes: a suíte desta integração.
- Resultado: o principal segue protegido. OWNER secundário suspenso perde a credencial ACTIVE. Códigos, emergência e transferência continuam fora.
- Próximo passo: ticket próprio para o marco #6. ADM-DEC-02 está aprovada na ADR e a aplicação segue na DOC-SERVER-013.

## Handoff atual

Preparado por: [Grok]
Destinatário: [Revisor humano]
Estado: Administração de OWNER secundário no runtime; códigos, emergência, transferência e ADM-DEC-02 ainda fora
Marco atual: #6 — O que a decisão ainda não colocou no runtime
Última atualização: 2026-10-14 08:39 UTC
Commit de referência: `a5f46701bb2baa5533757377b5733243a1a48439`

### Estado atual

5/6, em andamento. O principal designado é quem nomeia, suspende, reativa, rebaixa, remove e redefine a senha de outro OWNER. Isso exige reconfirmar a senha atual, com validade de 5 minutos neste processo, e grava auditoria. Sem principal designado, essas ações ficam recusadas.

### Decisões tomadas

Pelo proprietário, em 2026-10-14: o texto da seção de decisões. ADM-DEC-02 segue pendente.

Pelos engenheiros, nesta entrada: a autenticação reforçada é reconfirmar a senha atual. A janela é curta, em memória, e pode ser trocada depois sem mover a regra de quem é o principal. No reset de OWNER, devolver senha temporária revelaria um segredo novo no mesmo fluxo que a política quer fechado; o principal envia a senha nova e o servidor não a repete. A recuperação do principal por códigos offline ficou para outro ticket.

### Arquivos envolvidos

`services/auth.ts`, `routes/auth.ts`, painel em `WorkspacePanel.tsx`, `api.ts`, `types.ts`, `Dialog.tsx`, `i18n.ts`, `tests/principal-autoridade.test.ts` e esta tarefa. Schema e migração `0015` permanecem os do recorte anterior. ADR 0002, backlog e visão de produto não foram editados.

### Evidências e testes

Typecheck, build do Studio, `npm test` 629/629 com zero falhas e zero skips, inventário (120 ferramentas) e validador (28 tarefas) em 2026-10-14 08:39 UTC. `npm run test:e2e`: 19 fluxos aprovados. O navegador, com a conta principal, reconfirma a senha, cria um OWNER secundário e redefine a senha dele; a tela não mostra essas senhas. Criação de usuário comum ainda mostra a senha temporária uma vez. Suspensão de editor no fluxo de login continua passando. Não cliquei suspender nem apagar o secundário no navegador; isso ficou no teste HTTP.

### Pendências

Códigos offline e procedimento de emergência, em ticket próprio. Transferência do principal. Acesso do OWNER secundário aos projetos da organização e a regra de projeto privado. ADM-DEC-02. Revogação de sessão de um OWNER ainda segue a rota antiga. O backlog deste branch pode continuar apontando o progresso antigo, porque esse arquivo não foi editado aqui para não cruzar com o outro agente. A fonte do progresso é esta tarefa. PR #17 segue aberta e não altera auth.

### Próximas ações recomendadas

1. Abrir o ticket dos códigos offline e do procedimento de emergência, sem improvisar os códigos nesta PR.
2. Deixar a transferência para quando o sucessor que aceita estiver desenhado.
3. Não tratar ADM-DEC-02 como decidida.

### Riscos e cuidados

Não ler a ordem principal > secundário > ADMIN > MEMBER > VIEWER como nota numérica. Não escolher titular por antiguidade. Não devolver senha temporária de um OWNER. Não apagar o usuário técnico. A janela de 5 minutos some se o processo reinicia; isso é limite conhecido do mecanismo substituível.

### Condições para conclusão

O texto aprovado aplicado no runtime, com o procedimento de emergência projetado e ADM-DEC-02 resolvida ou explicitamente fora do aceite. A aprovação beta dos PUT de configuração não fecha esta tarefa.

## Rollback

Reverter os commits desta PR que mexem em `services/auth.ts`, nas rotas de conta e no painel. A migração `0015` não escolhe conta e pode permanecer. A janela de reconfirmação não está no banco. Eventos `owner.*` e `step-up` já gravados ficam como evidência.
