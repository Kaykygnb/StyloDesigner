# DOC-SERVER-006 — Validar autoridade contextual e proteção de OWNER

Responsável: [Grok]
Estado: Em andamento
Início: 2026-10-14 03:37 UTC
Última atualização: 2026-10-14 08:22 UTC
Progresso: 4/5 marcos (80%)
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
- Contratos/interfaces: recorte aplicado — ponteiro `Installation.principalUserId`, setup designa a primeira conta humana, proteção e concessão de OWNER só com ponteiro preenchido. Sem designação, o contrato antigo permanece. Reset, sessões, transferência e write/share não mudaram.
- Testes relacionados: config-autorizacao, contas, MCP-contas, workspace, E2E accounts; validador documental. Só rodar os pertinentes ao escopo implementado.

## Dependências, riscos e bloqueios

- Dependências: DOC-ADMIN-001, DOC-SERVER-005; decisões ADM-DEC-02/03/04/07. DOC-SERVER-004 não cobre hierarquia. Em 2026-10-14 o proprietário aprovou o texto de ADM-DEC-03 e HD-OWNERSHIP-05 registrado abaixo. ADM-DEC-02 continua pendente.
- Riscos: confundir risco estático com exploração; ampliar autoridade ou perder dados; duplicar sistema existente. Tratar a hierarquia como nota numérica de papel também foge do texto aprovado.
- Bloqueios: ADM-DEC-02 pendente. O procedimento de emergência da recuperação do principal ainda está por projetar. Autenticação reforçada e auditoria foram exigidas, sem mecanismo escolhido nesta tarefa.

## Decisões humanas aprovadas em 2026-10-14

Texto do proprietário, registrado aqui sem completar mecanismo e sem mudar o runtime nesta entrada. Outro agente grava o mesmo conteúdo na ADR 0002, no backlog e na visão de produto. Este arquivo não edita esses documentos.

(a) ADM-DEC-03 e HD-OWNERSHIP-05, aprovadas: o OWNER principal pode nomear, suspender, rebaixar e remover OWNERs secundários. Operações sensíveis exigem autenticação reforçada e auditoria. ADMINs não administram contas OWNER como comuns. Senhas nunca reveladas.

(b) Hierarquia aprovada: OWNER principal > OWNER secundário > ADMIN > MEMBER > VIEWER. OWNERs secundários têm acesso amplo aos projetos organizacionais, mas não podem substituir, suspender, remover ou rebaixar o principal. ADMINs não têm acesso implícito a projetos privados. Projeto privado não bloqueia OWNERs da organização. A autorização considera recurso, operação e escopo, não uma comparação numérica de papéis.

(c) Recuperação do principal aprovada por códigos offline de uso único. O procedimento de emergência ainda está por projetar.

(d) Transferência do principal aprovada com autenticação reforçada, sucessor explícito que aceita e confirma identidade, operação atômica, auditoria e tratamento das sessões administrativas. Nunca por antiguidade, troca informal de papel ou remoção do titular.

O recorte de código já escrito nesta tarefa não aplica (a), (b), (c) nem (d). Ele ainda deixa um ADMIN rebaixar um OWNER que não é o principal, ainda recusa excluir qualquer papel OWNER e o reset ainda devolve senha temporária. Isso não é a política acima. Não foi alterado nesta entrada, para não inventar autenticação reforçada, auditoria, códigos offline nem o procedimento de emergência.

## Critérios de aceitação

- [x] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação. Limite explícito: reset, sessões, transferência e banco antigo sem designação.
- [x] Política necessária aprovada antes de implementação; testes/gates e handoff coerentes com resultados reais. O recorte usa só HD-OWNERSHIP-02/03 e HD-ONBOARDING-03. O que não tinha decisão não entrou no runtime.

- [ ] Matriz ator/alvo inclui OWNER, ADMIN, conta comum, múltiplos OWNER e último OWNER ativo; reset/suspensão/rebaixamento/revogação têm expectativas aprovadas. O proprietário aprovou em 2026-10-14 o texto de hierarquia, de OWNERs secundários e de senhas nunca reveladas. Esse texto está registrado acima e ainda não virou matriz aplicada no runtime. ADM-DEC-02 segue pendente.
- [x] Negativas não mutam papel/senha/status/sessões; regressões positivas mantêm administração comum e modo local. Vale para suspender, rebaixar e excluir o principal designado no recorte anterior. O reset ainda muda a senha e a revela; a decisão de 2026-10-14 diz que senhas nunca são reveladas, e isso não foi aplicado.
- [x] Delegação de compartilhamento por agente respeita teto aprovado; comportamento write/share atual não muda antes do aceite/plano compatível. Nenhuma alteração nesse caminho.

- [ ] Principal distinguido e protegido conforme HD-OWNERSHIP-02, sem confundir OWNER adicional; concessão OWNER exclusiva do principal conforme HD-OWNERSHIP-03. O recorte faz isso quando o ponteiro está preenchido. A revisão humana do modelo, antes de considerar o runtime aceito na beta, ainda não aconteceu. Banco antigo não é designado por heurística.

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

### #5 — Validação final

- Estado: bloqueado
- Responsável: [Grok]
- Atividades executadas: critérios relidos. Em 2026-10-14 o proprietário aprovou ADM-DEC-03, HD-OWNERSHIP-05, a hierarquia, os códigos offline de uso único e as exigências da transferência. O procedimento de emergência continua por projetar. ADM-DEC-02 continua pendente. Nada disso entrou no runtime nesta entrada.
- Arquivos alterados: somente esta tarefa, para não cruzar com o agente que registra as mesmas decisões na ADR 0002, no backlog e na visão de produto.
- Evidências: o texto aprovado está na seção de decisões deste arquivo. Os gates do recorte anterior continuam os do histórico de 08:18 UTC.
- Testes executados: nenhum teste novo depois do registro. A suíte 627/627 citada no marco #4 não cobre (a)–(d).
- Problemas encontrados: o recorte anterior não cumpre o texto novo. ADMIN ainda rebaixa OWNER secundário, exclusão de papel OWNER continua recusada para todos, e o reset ainda revela senha temporária. Autenticação reforçada, auditoria, códigos e transferência não foram desenhados aqui.

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

## Handoff atual

Preparado por: [Grok]
Destinatário: [Revisor humano]
Estado: Decisões de 2026-10-14 registradas no ticket; runtime ainda não as aplica
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 08:22 UTC
Commit de referência: `2cd5408553cad3158d96578410c2642c7ab3306b`

### Estado atual

4/5, em andamento. O recorte anterior distingue o principal no setup e impede suspender, rebaixar ou excluir essa conta quando o ponteiro existe. As decisões novas do proprietário estão só nesta tarefa e não foram codificadas.

### Decisões tomadas

Pelo proprietário, em 2026-10-14, no texto da seção de decisões: principal administra OWNERs secundários; operações sensíveis pedem autenticação reforçada e auditoria; ADMIN não administra conta OWNER como conta comum; senhas nunca são reveladas; hierarquia principal, secundário, ADMIN, MEMBER, VIEWER, sem comparação numérica de papéis; secundário não substitui nem suspende, remove ou rebaixa o principal e tem acesso amplo aos projetos da organização; ADMIN não lê projeto privado por ser ADMIN; projeto privado não bloqueia OWNER da organização; recuperação do principal por códigos offline de uso único, com procedimento de emergência ainda por projetar; transferência com autenticação reforçada, sucessor que aceita e confirma identidade, operação atômica, auditoria e tratamento das sessões administrativas, nunca por antiguidade, troca informal de papel ou remoção do titular. ADM-DEC-02 segue pendente.

Pelo recorte técnico anterior, ainda no código: ponteiro único que nasce vazio, setup da primeira conta humana, proteção só do principal designado. Isso não executa o parágrafo anterior.

### Arquivos envolvidos

Esta tarefa. O código do recorte anterior permanece em `schema.prisma`, migração `0015_autoridade_principal`, `services/auth.ts`, `routes/auth.ts` e `tests/principal-autoridade.test.ts`. ADR 0002, backlog e visão de produto não foram editados nesta entrada.

### Evidências e testes

Gates do recorte, no histórico de 08:18 UTC: suíte 627/627, zero falhas e zero skips; typecheck, build, inventário e validador naquela hora. Nenhum teste novo depois do registro das decisões. E2E de navegador não rodou.

### Pendências

Aplicar (a)–(d) sem inventar o procedimento de emergência e sem fechar ADM-DEC-02. O código ainda deixa ADMIN rebaixar OWNER secundário, recusa excluir qualquer OWNER e revela senha temporária no reset. PR #17 segue aberta e não altera este ticket.

### Próximas ações recomendadas

1. Deixar o outro agente concluir o registro na ADR 0002, no backlog e na visão de produto.
2. Não promover o recorte atual a política fechada: ele não cumpre o texto de 2026-10-14.
3. Projetar autenticação reforçada, auditoria, códigos de uso único e a transferência com sucessor que aceita, em tarefa ou marco próprio, antes de mudar o runtime de novo.

### Riscos e cuidados

Não ler a ordem principal > secundário > ADMIN > MEMBER > VIEWER como nota numérica. Não escolher titular por antiguidade. Não tratar senha temporária devolvida ao ADMIN como compatível com “senhas nunca reveladas”. Não apagar o usuário técnico.

### Condições para conclusão

O texto aprovado aplicado no runtime, com o procedimento de emergência projetado e ADM-DEC-02 resolvida ou explicitamente fora do aceite. A aprovação beta dos PUT de configuração não fecha esta tarefa.

## Rollback

Descreva como desfazer a mudança sem apagar evidências.
