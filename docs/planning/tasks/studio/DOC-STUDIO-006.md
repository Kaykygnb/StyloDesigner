# DOC-STUDIO-006 — Planejar onboarding guiado e administração progressiva

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 03:34 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: Login/setup já existe, sem perfis sugeridos ou crescimento guiado; não há contato institucional distinto.
- Evidências observadas: ADR 0002 e IDENTITY-ONBOARDING-RECOVERY.md; conflitos factuais preservados.

## Objetivo

Entregar plano técnico revisado, com critérios/ensaios isolados e limites de autorização; sem implementar integralmente o requisito por inferência.

## Escopo

- Incluído: Desenhar jornadas pessoal/equipe/empresa sobre Login/Home/WorkspacePanel, conta/senha idênticas, campos institucionais opcionais, prova instalador em SERVER008 e evolução sem recriação.
- Fora do escopo: Não redesign paralelo, departamentos obrigatórios ou onboarding com auth automática; DOC-STUDIO005 estética,003 QA mantidos.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: studio; prioridade P1.
- Módulos relacionados: identity/server/Studio/banco/agentes existentes.
- Contratos/interfaces: HD: HD-ONBOARDING-01..03; HD-ADMIN-01/02/04; HD-OWNERSHIP-04; manter origem humana; contratos runtime ainda não alterados.
- Testes relacionados: contas/login, workspace, fixture de migração/restore; jornadas GUI em fixture após autorização da implementação de onboarding.

## Dependências, riscos e bloqueios

- Dependências: DOC-SERVER-006/008; DOC-DB-001 para restore; projeto administrativo existente. Investigação pode preceder implementação das dependências.
- Riscos: Perda de dados/autoridade/chaves; impor departamentos/edições de identidade distintos; inventar decisão humana.
- Bloqueios: Implementação estrutural requer projeto/review específico; planejamento autorizado e não bloqueia engenharia independente.

## Critérios de aceitação

- [ ] Cada requisito HD rastreado a cenário/contrato e evidência; estado atual separado de intenção.
- [ ] Plano seguro revisado e ensaios descartáveis definidos/executados conforme escopo; decisões abertas e autorização de implementação explícitas.

- [ ] Jornadas pessoal→empresa preservam contas/projetos e mostram administração conforme necessidade, sem setor obrigatório.
- [ ] Primeira conta principal só em provisionamento autorizado; onboarding e perfil institucional não conferem autoridade por e-mail.

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
