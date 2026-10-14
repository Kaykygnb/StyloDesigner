# DOC-SERVER-009 — Planejar migração do modo local para contas obrigatórias

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 10:10 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: Bypass local permanece e identity técnica é dona de projetos/agentes/segredos.
- Evidências observadas: ADR 0002 e IDENTITY-ONBOARDING-RECOVERY.md; conflitos factuais preservados.

## Objetivo

Entregar plano técnico revisado, com critérios/ensaios isolados e limites de autorização; sem implementar integralmente o requisito por inferência.

## Escopo

- Incluído: Inventário dependências/dados; modelo principal em SERVER006; plano/rehearsal migration e rollback em cópias descartáveis; HTTP/local fixtures compatíveis durante transição.
- Fora do escopo: Não remover STYLO_AUTH=local/apagar conta técnica, migrar produção ou reescrever auth neste planejamento.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P1.
- Módulos relacionados: identity/server/Studio/banco/agentes existentes.
- Contratos/interfaces: HD: HD-IDENTITY-01..04; HD-ONBOARDING-03; manter origem humana; contratos runtime ainda não alterados.
- Testes relacionados: contas/login, workspace, fixture de migração/restore; ensaios de ownership/grants/colisões/rollback em cópias descartáveis.

## Dependências, riscos e bloqueios

- Dependências: DOC-SERVER-006/008; DOC-DB-001 para restore; projeto administrativo existente. O contrato de login por nome de usuário é DOC-SERVER-011; esta tarefa não o redefine. Investigação pode preceder implementação das dependências.
- Riscos: Perda de dados/autoridade/chaves; retirar identidade técnica sem preservar cascades; inventar decisão humana.
- Bloqueios: Implementação estrutural requer projeto/review específico; planejamento autorizado e não bloqueia engenharia independente.

## Critérios de aceitação

- [ ] Cada requisito HD rastreado a cenário/contrato e evidência; estado atual separado de intenção.
- [ ] Plano seguro revisado e ensaios descartáveis definidos/executados conforme escopo; decisões abertas e autorização de implementação explícitas.

- [ ] Inventariar ownership/slug/cascade, grants/tokens/autoria/blobs/chaves; provar migração/rollback sem reset ou perda em fixture.
- [ ] Conta/senha final em todo uso humano; fixture legado não cria exceção de produto permanente.

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

### 2026-10-14 10:10 UTC — [Grok 4.7] — retirada pedida dentro da DOC-SERVER-011

- Investigado: o proprietário pediu, na DOC-SERVER-011, a retirada de `STYLO_AUTH=local` com migração que preserva projetos. Esta tarefa continua só o plano.
- Alterado: nenhum código por esta tarefa. O runtime mudou na 011.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: continua Proposta. Não marcar concluída: o critério daqui é um plano revisado, não a retirada.
- Próximo passo: revisar o plano contra o que a 011 já fez, sem reabrir o formato do login.

### 2026-10-14 08:40 UTC — [Grok 4.7] — nota

- Investigado: login por nome de usuário ficou em DOC-SERVER-011.
- Alterado: dependência. Esta tarefa não redefine esse contrato.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: continua Proposta.
- Próximo passo: o mesmo de antes, sem reabrir o formato do login.

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
