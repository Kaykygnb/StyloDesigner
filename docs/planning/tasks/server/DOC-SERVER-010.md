# DOC-SERVER-010 — Projetar recuperação de contas e envio configurável pela GUI

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:50 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: Reset administrativo existe, mas não SMTP/recuperação e-mail/offline; credenciais/provedores precisam projeto.
- Evidências observadas: ADR 0002 e IDENTITY-ONBOARDING-RECOVERY.md; conflitos factuais preservados.
- Atualização 2026-10-14: o proprietário escolheu códigos offline de uso único para o OWNER principal e listou os requisitos da transferência. O procedimento de emergência continua a projetar. Não implementar a partir só desta nota.
- Atualização seguinte: ADM-DEC-02 está aprovada. Recuperação privilegiada e credencial mestra ficam com o OWNER. Credencial de integração comum, como o envio de e-mail, pode ser cadastrada ou substituída por ADMIN autorizado, sem mostrar o segredo depois. Esta tarefa continua só o projeto.

## Objetivo

Entregar plano técnico revisado, com critérios/ensaios isolados e limites de autorização; sem implementar integralmente o requisito por inferência.

## Escopo

- Incluído: Projetar token hash/TTL/uso único, GUI SMTP/assistentes provider/testes/diagnóstico/cofre, offlinealternativas e compatibilidade institucional, envio opcional; fontes oficiais e revisão.
- Fora do escopo: Não enviar mensagens ou implementar SMTP integral/federação. Códigos offline foram escolhidos pelo proprietário em 2026-10-14; o desenho ainda é esta tarefa, não uma implementação já autorizada. Não inventar regra nova de emergência (quantos códigos, quem reemite) sem voltar ao proprietário se a regra não estiver na ADR.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P1.
- Módulos relacionados: identity/server/Studio/banco/agentes existentes.
- Contratos/interfaces: HD: HD-RECOVERY-01..05; HD-OWNERSHIP-05; manter origem humana; contratos runtime ainda não alterados.
- Testes relacionados: contas/login, workspace, fixture de migração/restore; testes de SMTP simulados só no projeto aprovado.

## Dependências, riscos e bloqueios

- Dependências: DOC-SERVER-006/008; DOC-DB-001 para restore; projeto administrativo existente. Investigação pode preceder implementação das dependências.
- Riscos: Perda de dados/autoridade/chaves; recomendar provider auth sem verificação; inventar decisão humana.
- Bloqueios: Implementação estrutural requer projeto/review específico; planejamento autorizado e não bloqueia engenharia independente.

## Critérios de aceitação

- [ ] Cada requisito HD rastreado a cenário/contrato e evidência; estado atual separado de intenção.
- [ ] Plano seguro revisado e ensaios descartáveis definidos/executados conforme escopo; decisões abertas e autorização de implementação explícitas.

- [ ] SMTP custom/Gmail/Workspace/Outlook auth pesquisados com fonte/data; aceitação SMTP não declarada entrega.
- [ ] Tokens hash/TTL/uso único/abuso/URLtrusted e GUI cofre/diagnóstico definidos; offline/federação não escolhidos automaticamente.

## Marcos

### #1 — Investigação

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #2 — Planejamento

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

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

### 2026-10-14 08:50 UTC — [Grok 4.7] — ADM-DEC-02 aprovada

- Investigado: seção 4 da ADR 0002. Código offline é recuperação privilegiada. SMTP de envio é integração comum.
- Alterado: a nota do problema. Tarefa continua Proposta.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: o desenho separa credencial mestra de credencial de integração. Não implementa SMTP.
- Próximo passo: assumir quando for projetar.

### 2026-10-14 08:45 UTC — [Grok 4.7] — nota de decisão

- Investigado: códigos offline e requisitos de transferência aprovados na ADR 0002.
- Alterado: problema e fora de escopo. Tarefa continua Proposta.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: o mecanismo de código deixou de ser alternativa em aberto. O desenho continua esta tarefa.
- Próximo passo: assumir quando for projetar, sem implementar SMTP.

### 2026-10-14 03:34 UTC — [Codex] — proposta por diretriz humana

- Investigado: HD da ADR, backlog e escopos existentes; não há tarefa equivalente para este recorte.
- Alterado: nenhum código.
- Arquivos: este documento.
- Testes: ainda não executados.
- Resultado: proposta de planejamento, não autorização integral de nova funcionalidade.
- Próximo passo: consultar duplicações e assumir explicitamente.

## Handoff atual

<!-- Opcional enquanto a tarefa estiver Proposta/Pronta. Obrigatório ao transferir,
encerrar sessão com pendências, entregar para revisão ou ficar Bloqueada/Em validação.
Veja TASK-PROTOCOL.md §10. -->

Preparado por: [Ninguém]
Destinatário: —
Estado: —
Marco atual: —
Última atualização: —
Commit de referência: —

### Estado atual

### Decisões tomadas

### Arquivos envolvidos

### Evidências e testes

### Pendências

### Próximas ações recomendadas

### Riscos e cuidados

### Condições para conclusão

## Rollback

Descreva como desfazer a mudança sem apagar evidências.
