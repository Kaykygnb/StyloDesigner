# DOC-ENG-004 — Auditar isolamento e cleanup dos fixtures legados

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 01:52 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

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

### 2026-10-14 01:52 UTC — [Codex] — proposta

- Investigado: três fixtures legados e setup compartilhado durante a correção dos fixtures novos; problema estático distinto em escopo maior.
- Alterado: proposta registrada, sem implementar/reproduzir a rodada legada; tarefa atual ENG-003 preservada.
- Arquivos: este documento e BACKLOG.md.
- Testes: leitura de código; reprodução legada pendente. Suíte normal desta sessão não usa URL externa real.
- Resultado: hipótese e alcance registrados explicitamente, sem afirmar que todos os fixtures legados falham.
- Próximo passo: assumir, inventariar e reproduzir por sentinela antes de decidir mudança de setup global ou helper.

## Rollback

Nenhuma implementação nesta proposta. Reverter alterações futuras de fixture apenas com isolamento equivalente e preservar evidências.
