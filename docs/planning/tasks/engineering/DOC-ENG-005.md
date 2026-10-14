# DOC-ENG-005 — Registrar visão, decisões e horizontes do produto

Responsável: [Grok 4.7]
Estado: Concluída
Início: 2026-10-14 08:19 UTC
Última atualização: 2026-10-14 08:45 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Grok 4.7]

## Problema e evidências

- Problema: as diretrizes do proprietário de 2026-10-14 (seções 2, 3 e 17, mais ADM-DEC-09) precisavam entrar nos registros existentes, com inventário do código e horizontes A/B/C, sem reescrita.
- Evidências observadas: ADR 0002 e planos de identidade ainda tratavam ADM-DEC-03/05/09 e códigos offline como abertos; o código em `31f16bf` já contém editor vetorial, 120 ferramentas e canais anônimos.

## Objetivo

Deixar decisão aprovada, conflito e plano no lugar certo da documentação, com a alpha descrita e sem mudança de runtime.

## Escopo

- Incluído: texto fiel das decisões 2.1–2.7, ADM-DEC-05 e ADM-DEC-09; prazo de retenção como detalhe técnico; visão, horizontes, inventário vetorial, bibliotecas e alpha.
- Fora do escopo: não editar DOC-SERVER-006; não implementar conta, canal, vetor ou alpha; não mergear as PRs #17 e #18.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: documentação de produto e ADR 0002.
- Módulos relacionados: identidade, permissões, backlog, roadmap.
- Contratos/interfaces: nenhum contrato de runtime alterado. Conflitos com o código foram marcados, não resolvidos.
- Testes relacionados: `docs:inventario --check` e `node docs/planning/validate-tasks.mjs`.

## Dependências, riscos e bloqueios

- Dependências: PRs #17 e #18 abertas. Esta entrega não rebaseia nelas.
- Riscos: duas redações da mesma decisão (ticket da PR #18 e ADR). A ADR é o registro canônico.
- Bloqueios: nenhum para este registro. Implementação estrutural continua sem autorização genérica.

## Critérios de aceitação

- [x] Decisões aprovadas copiadas sem reinterpretar; ADM-DEC-02 segue pendente; prazo da ADM-DEC-09 é detalhe técnico.
- [x] Inventário vetorial cita o código, inclusive limites que o código declara.
- [x] Horizontes e alpha estão na roadmap e no backlog existentes.
- [x] Validador de tarefas e inventário `--check` aprovados. Nenhum runtime alterado.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Grok 4.7]
- Atividades executadas: leitura das diretrizes, ADR 0002, permissões, identidade, inventário de ferramentas, runner vetorial, `geom.js`, `svg.js`, `svgimport.js`, Studio (caneta, nós, contorno) e rotas públicas.
- Arquivos alterados: nenhum nesta etapa.
- Evidências: ferramentas e arquivos citados em `docs/product/EVOLUTION.md`.
- Testes executados: não nesta etapa.
- Problemas encontrados: canal de eventos, health, presença e config de agente respondem sem identidade; e-mail é login obrigatório; modo local existe.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Grok 4.7]
- Atividades executadas: conferência das PRs #17 e #18 para não editar os mesmos trechos. A #18 não altera a ADR. A #17 altera uma linha do backlog (DOC-STUDIO-001) e o handoff.
- Arquivos alterados: nenhum nesta etapa.
- Evidências: `gh pr view` 17 e 18.
- Testes executados: não nesta etapa.
- Problemas encontrados: o ticket da #18 resume parte das decisões e deixa a ADR de fora de propósito. O texto integral fica aqui.

### #3 — Implementação

- Estado: concluído
- Responsável: [Grok 4.7]
- Atividades executadas: registro documental. Sem patch de servidor, schema ou Studio.
- Arquivos alterados: ADR 0002, visão, evolução, capacidades, roadmap, backlog, handoff, permissões, identidade, README de administração, tarefas DOC-ENG-005 e DOC-ENG-006, notas em DOC-ADMIN-002 e DOC-SERVER-010.
- Evidências: diff só de Markdown e da tarefa nova.
- Testes executados: não nesta etapa.
- Problemas encontrados: conflitos com código e com HD anteriores marcados na ADR, não “corrigidos” no texto antigo.

### #4 — Testes

- Estado: concluído
- Responsável: [Grok 4.7]
- Atividades executadas: validador de tarefas e inventário em modo check.
- Arquivos alterados: este marco, depois da execução.
- Evidências: validador 30 tarefas; inventário 120 ferramentas (97 núcleo, 23 plugins).
- Testes executados: `node docs/planning/validate-tasks.mjs`; `npm run docs:inventario -- --check`.
- Problemas encontrados: nenhum.

### #5 — Validação final

- Estado: concluído
- Responsável: [Grok 4.7]
- Atividades executadas: releitura dos critérios. Typecheck e suíte não rodam regra de Markdown; não foram executados.
- Arquivos alterados: nenhum além da documentação.
- Evidências: critérios acima marcados; runtime intocado.
- Testes executados: os do marco #4.
- Problemas encontrados: nenhum bloqueio documental.

## Histórico de trabalho

### 2026-10-14 08:50 UTC — [Grok 4.7] — nota posterior

- Investigado: aprovação da ADM-DEC-02 depois do fechamento desta tarefa.
- Alterado: o handoff aponta para a ADR. O critério marcado no fechamento não foi desmarcado: ele descreve o estado daquela hora.
- Arquivos: este documento. O registro canônico está na ADR 0002.
- Testes: não executados aqui.
- Resultado: esta tarefa continua Concluída.
- Próximo passo: a aplicação da ADM-DEC-02 é a DOC-SERVER-013.

### 2026-10-14 08:45 UTC — [Grok 4.7] — #1 a #5

- Investigado: diretrizes do proprietário, ADR, código vetorial e superfície HTTP anônima. PRs #17 e #18 abertas.
- Alterado: só documentação. ADM-DEC-02 permanece pendente. Retenção da ADM-DEC-09 virou padrão técnico (365 / 30 / 7 dias).
- Arquivos: `docs/architecture/adr/0002-self-hosted-administration.md`, `docs/product/EVOLUTION.md`, `docs/product/VISION.md`, `docs/product/CAPABILITIES.md`, `docs/planning/ROADMAP.md`, `docs/planning/BACKLOG.md`, `docs/planning/HANDOFF.md`, `docs/architecture/instance-administration/PERMISSIONS.md`, `docs/architecture/instance-administration/IDENTITY-ONBOARDING-RECOVERY.md`, `docs/architecture/instance-administration/README.md`, `docs/README.md`, `docs/planning/tasks/engineering/DOC-ENG-005.md`, `docs/planning/tasks/engineering/DOC-ENG-006.md`, `docs/planning/tasks/administration/DOC-ADMIN-002.md`, `docs/planning/tasks/server/DOC-SERVER-010.md`.
- Testes: `node docs/planning/validate-tasks.mjs` → 30 tarefas válidas. `npm run docs:inventario -- --check` → 120 ferramentas, 97 núcleo, 23 plugins. Typecheck e `npm test` não executados.
- Resultado: registro canônico na ADR e plano de alpha local. Sem runtime.
- Próximo passo: DOC-ENG-006 só depois do merge das PRs #17 e #18.

## Handoff atual

Preparado por: [Grok 4.7]
Destinatário: [Próximo agente]
Estado: Registro documental concluído
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 08:45 UTC
Commit de referência: a preencher no push

### Estado atual

Decisões 2.1–2.7, ADM-DEC-05 e ADM-DEC-09 estão na ADR 0002. No fechamento desta tarefa, ADM-DEC-02 ainda estava pendente. Ela foi aprovada depois; o texto vigente está na ADR 0002, seção 4. O editor vetorial foi inventariado a partir do código. A alpha proposta é local e está na roadmap e na DOC-ENG-006.

### Decisões tomadas

O prazo de retenção foi delegado aos engenheiros e registrado como detalhe técnico, não como nova decisão humana. Não se adotou VectorCraft nem uma cena externa como núcleo.

### Arquivos envolvidos

Lista no histórico. DOC-SERVER-006 e DOC-SERVER-007 não foram editados.

### Evidências e testes

Validador de tarefas e inventário `--check`. Typecheck e `npm test` não executados: nenhum arquivo de código mudou.

### Pendências

Merge das PRs #17 e #18 antes da alpha. Conflitos de conta, canal anônimo e papéis globais continuam abertos para implementação, não para reinterpretação.

### Próximas ações recomendadas

1. Não reabrir o texto da ADR ao implementar a PR #18.
2. Assumir DOC-ENG-006 só com a beta já contendo #17 e #18.
3. DOC-SERVER-007 pode tratar a identidade do canal: ADM-DEC-09 e ADM-DEC-05 estão aprovadas. ADM-DEC-07 continua pendente. O arquivo da 007 não foi atualizado aqui para não cruzar com quem a assumiu.

### Riscos e cuidados

A PR #17 muda uma linha do backlog e reescreve o handoff. A PR #18 muda código de auth e o ticket 006. Esta branch não contém esse código.

### Condições para conclusão

Atendidas para o registro. A alpha em si não está concluída.

## Rollback

Reverter o commit desta documentação. Não há migração nem dado de usuário.
