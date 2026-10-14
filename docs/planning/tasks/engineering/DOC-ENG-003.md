# DOC-ENG-003 — Isolar banco e ordenar limpeza dos fixtures MCP/PostgreSQL

Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-14 01:43 UTC
Última atualização: 2026-10-14 01:43 UTC
Progresso: 0/5 marcos (0%)
Participantes: [Codex]

## Problema e evidências

Revisão da entrega Kimi na beta 41b0fb3 encontrou dois problemas na infraestrutura nova:

1. `tests/mcp-compatibilidade.test.js:23` copia process.env sem limpar DATABASE_URL. `apps/server/src/db.ts:14` prioriza essa variável sobre DESIGNER_DB_DIR=memory. Se uma URL válida estiver herdada, o fixture pode acessar/mutar esse banco ao criar projeto em modo local. Confirmado por fluxo estático; não foi testado contra banco externo real, para não expor dados.
2. `tests/postgres-integracao.test.js:61` registra remoção da pasta antes dos hooks de pg.stop e child.kill. node:test executa esses hooks em ordem de registro, confirmada com teste mínimo. Reprodução local do teste gerou `PANIC: could not create file "pg_wal/xlogtemp...": No such file or directory`, `could not open file "postmaster.pid"` e `abnormal database system shutdown` no encerramento, apesar de o teste passar. Banco e servidores ainda usam a pasta quando ela é apagada.

## Objetivo

Garantir fixtures descartáveis independentemente de variáveis herdadas e encerrar clientes/processos/banco antes de apagar seus dados, inclusive em falha de startup ou do teste.

## Escopo

- Incluído: fixtures de tests/mcp-compatibilidade.test.js e tests/postgres-integracao.test.js, isolamento do ambiente e cleanup aguardado; regressão reproduzível em dados descartáveis.
- Fora do escopo: alterar handlers/runtime, dados reais, resultado das tarefas Kimi ou executar QA exploratório.

## Módulo e contratos afetados

- Responsabilidade principal: engenharia/testes; prioridade P1.
- Relacionadas: DOC-ENG-002 já isola o runner E2E; DOC-MCP-001 e DOC-SERVER-001 introduziram estes fixtures, com cenários distintos.
- Contrato: teste não reutiliza banco/credenciais do ambiente; cleanup deve preservar a ordem cliente MCP → servidores Stylo (aguardar saída) → PostgreSQL → remoção da pasta.
- Arquivos potenciais: dois testes novos, helper descartável se necessário, inventário regenerado quando referências mudarem.
- Testes relacionados: mcp-compatibilidade, postgres-integracao, tool-inventory e regressões de banco/MCP.

## Dependências, riscos e bloqueios

- Dependência: infraestrutura da entrega 41b0fb3; sem transferência de responsável das tarefas Kimi.
- Riscos: atingir banco herdado; encerrar processos alheios; ocultar falha de parada com catch vazio; sleep não comprova saída.
- Bloqueios: nenhum conhecido; reprodução somente em dados e processos próprios. Preparação PG atualmente pula qualquer erro de initialise/start; revisar a distinção entre indisponibilidade de plataforma e defeito inesperado sem mascarar falhas novas.

## Critérios de aceitação

- [ ] Fixture MCP ignora DATABASE_URL herdada e usa banco/blobs/segredos descartáveis; reprodução não toca bancos reais.
- [ ] Cleanup fecha cliente/servidores/banco antes de remover diretório e aguarda saída com timeout; tratamento de startup parcial incluído.
- [ ] Repetir teste PostgreSQL sem PANIC/encerramento anormal provocado pela remoção da pasta; sem processos/dados próprios remanescentes.
- [ ] Testes e inventário/check/typecheck/regressões necessários aprovados; resultados e limites registrados; tarefas Kimi preservadas.

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

### 2026-10-14 01:40 UTC — [Codex] — proposta após revisão

- Investigado: diff 80818cd..41b0fb3, hooks de node:test, precedência de openDb e testes novos; CI 38495659427 concluída com sucesso.
- Alterado: somente esta proposta, backlog e handoff; nenhum código funcional/teste corrigido nesta revisão; responsáveis Kimi preservados.
- Arquivos: este documento, BACKLOG.md e HANDOFF.md.
- Testes: MCP cru + PostgreSQL 3/3, sem skips (log local /tmp/stylo-kimi-review-tests.log); typecheck; validador 17 tarefas antes da proposta; inventário 120 válido. Revisão executou testes com DATABASE_URL vazia, TMPDIR próprio e blobs em memória.
- Resultado: falha de cleanup reproduzida em logs embora teste passe; risco de banco herdado constatado estaticamente, sem executar contra dados externos. Nenhuma sessão Work/QA iniciada.
- Próximo passo: assumir pelo protocolo, corrigir fixtures e validar recusas/cleanup sem suprimir erro inesperado.

### 2026-10-14 01:43 UTC — [Codex] — assunção e plano

- Investigado: beta atual fb32474, protocolo/backlog/handoff, reprodução anterior PANIC e env herdado; tarefa livre e sem mudanças remotas novas.
- Alterado: responsável/estado e janela de edição exclusiva dos fixtures/helpers/regressões; tarefas Kimi preservadas.
- Arquivos: esta tarefa, BACKLOG.md, HANDOFF.md; implementação começará após publicar a assunção.
- Testes: evidência de revisão anterior; novos cenários de isolamento e lifecycle planejados.
- Resultado: assumida; plano é cleanup único com clientes → processos confirmados → banco → diretório, sem apagar dados se parada falhar; limpar env no MCP e exigir opt-out explícito de PostgreSQL em vez de skip por qualquer erro.
- Próximo passo: implementar, reproduzir env hostil em dados descartáveis e validar ausência de PANIC/processos/dados próprios.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante após transferência]
Estado: Em execução
Marco atual: #1 — Investigação
Última atualização: 2026-10-14 01:43 UTC
Commit de referência: `fb324741e8535fb61d80b6f9ba3fd8c3e89c2fdc`

### Estado atual

Assunção registrada; reprodução anterior confirma cleanup incorreto. Nenhuma transferência de trabalho Kimi.

### Decisões tomadas

Helper de testes para aguardar saída e cleanup com erros visíveis; nenhum handler do produto será modificado. Diretório só removido após recursos encerrarem. PostgreSQL indisponível não deve mascarar erros inesperados com skip genérico.

### Arquivos envolvidos

Dois fixtures MCP/PG, helper/regressões de lifecycle, inventário regenerado, estratégia/regressões e planejamento.

### Evidências e testes

Log da revisão em /tmp/stylo-kimi-review-tests.log; novos gates pendentes.

### Pendências

Implementação, testes específicos/completos, documentação e commit.

### Próximas ações recomendadas

Implementar e executar casos de env hostil, falha de encerramento/startup e PG real; publicar após gates.

### Riscos e cuidados

Somente processos/dados próprios; não executar contra URL real herdada; manter responsáveis Kimi e QA humano sem exploração.

### Condições para conclusão

Critérios desta tarefa atendidos, evidências e gates publicados.

## Rollback

Reverter somente correções futuras de fixture se houver regressão; preservar reprodução/histórico e manter isolamento de dados. Esta proposta não altera execução do produto.
