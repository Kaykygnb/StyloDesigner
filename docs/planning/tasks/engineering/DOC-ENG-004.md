# DOC-ENG-004 — Auditar isolamento e cleanup dos fixtures legados

Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-14 02:09 UTC
Última atualização: 2026-10-14 02:09 UTC
Progresso: 0/5 marcos (0%)
Participantes: [Codex]

## Problema e evidências

Durante DOC-ENG-003, leitura de tests/studio-api.test.js:20, api-seguranca.test.js:30 e mcp-sdk.test.js:21 mostrou env com ...process.env sem limpar DATABASE_URL. tests/_setup.mjs só define DESIGNER_DB_DIR=memory; apps/server/src/db.ts prioriza DATABASE_URL. Esses fixtures não foram executados contra URL externa real nesta revisão. A hipótese de isolamento insuficiente é sustentada pelo caminho do código; cleanup do conjunto legado ainda precisa de auditoria por fixture.

## Objetivo

Garantir que a suíte padrão não reutilize banco/configuração/blobs sensíveis herdados e que fixtures legados encerrem recursos antes da limpeza, preservando testes que provisionam PostgreSQL explicitamente.

## Escopo

- Incluído: inventário dos subprocessos/ambientes de teste, setup compartilhado e fixtures legados; usar helper existente quando adequado; regressões com sentinelas descartáveis.
- Fora do escopo: reimplementar os dois fixtures novos já tratados em DOC-ENG-003, alterar runtime, acessar banco real configurado pelo humano ou realizar QA visual.

## Módulo e contratos afetados

- Responsabilidade principal: engenharia/testes; prioridade P1.
- Relacionadas: DOC-ENG-003 cobre somente fixtures novos MCP/PG e oferece helper; DOC-ENG-002 já isola runner E2E.
- Testes: casos de env hostil/startup/cleanup com dados próprios; suíte completa e inventário/check após alterações de referências.

## Dependências, riscos e bloqueios

- Dependência: helper DOC-ENG-003; proposta não altera código nesta entrada.
- Riscos: mudar testes PostgreSQL legítimos que usam URL própria; mascarar falha com skip; cleanup encerrar processo alheio.
- Bloqueios: nenhum conhecido; reproduzir somente com sentinela inofensiva e recursos descartáveis.

## Critérios de aceitação

- [ ] Inventário de fixtures e env/lifecycle atual; problemas confirmados por reprodução segura, não contra dados externos reais.
- [ ] Suíte padrão/fixtures ignoram URLs herdadas; fixtures PostgreSQL usam apenas URL própria; configuração/blobs/segredos testados conforme risco.
- [ ] Cleanup legado auditado; corrigir problemas comprovados com saída confirmada antes de remoção; limites de plataforma registrados.
- [ ] Regressões/gates apropriados aprovados; histórico/handoff/índice atualizados e sem duplicar ENG-003.

## Marcos

### #1 — Investigação

- Estado: em andamento
- Responsável: [Codex]
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

### 2026-10-14 01:52 UTC — [Codex] — proposta

- Investigado: três fixtures legados e setup compartilhado durante a correção dos fixtures novos; problema estático distinto em escopo maior.
- Alterado: proposta registrada, sem implementar/reproduzir a rodada legada; tarefa atual ENG-003 preservada.
- Arquivos: este documento e BACKLOG.md.
- Testes: leitura de código; reprodução legada pendente. Suíte normal desta sessão não usa URL externa real.
- Resultado: hipótese e alcance registrados explicitamente, sem afirmar que todos os fixtures legados falham.
- Próximo passo: assumir, inventariar e reproduzir por sentinela antes de decidir mudança de setup global ou helper.

### 2026-10-14 02:09 UTC — [Codex] — assunção por criticidade

- Investigado: backlog/remoto atual 7265835, handoff e fixtures; P0 abertas com Kimi aguardam revisão humana. Entre P1 livres, isolamento de dados tem precedência sobre restauração/paridade/exportação/redesign.
- Alterado: responsável e início; janela de edição tests/setup/helpers/fixtures e documentação de regressão, sem assumir trabalho Kimi.
- Arquivos: esta tarefa, BACKLOG.md e HANDOFF.md.
- Testes: auditoria estática inicial encontrou 13 fixtures de servidor legados e ponte stdio separada; reprodução segura e gates pendentes.
- Resultado: DOC-ENG-004 assumida; não reservar simultaneamente demais tarefas livres. Visual continua sob direção/QA humanos.
- Próximo passo: validar setup com env sentinela, aplicar helper de ambiente/cleanup aos fixtures e preservar PostgreSQL explicitamente provisionado.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante após transferência]
Estado: Em execução
Marco atual: #1 — Investigação
Última atualização: 2026-10-14 02:09 UTC
Commit de referência: `726583500178eb39fa07e72106f5355d2d1a776f`

### Estado atual

Auditoria inicial identificou env herdado e cleanup fora de ordem em fixtures legados; implementação e reprodução pendentes.

### Decisões tomadas

P0 Kimi preservadas; próxima P1 por risco de atingir banco/configuração real. Depois restore/migração, paridade Studio/MCP e exportação; redesign depende da direção visual humana.

### Arquivos envolvidos

Fixtures legados, tests/_setup.mjs, helper de lifecycle/ambiente, inventário de fixtures e regressões.

### Evidências e testes

Leitura dos fixtures e precedência em openDb; gates pendentes.

### Pendências

Reprodução sentinela, implementação, suíte e publicação final.

### Próximas ações recomendadas

Isolar env sem afetar URL própria PostgreSQL; aguardar processos antes da remoção; validar documentação/artefatos e suíte.

### Riscos e cuidados

Só dados/processos próprios; não reproduzir contra URL externa real. Preservar decisões e responsáveis Kimi, não iniciar QA visual por esta assunção.

### Condições para conclusão

Critérios existentes atendidos e evidências/gates publicados.

## Rollback

Nenhuma implementação nesta proposta. Reverter alterações futuras de fixture apenas com isolamento equivalente e preservar evidências.
