# DOC-ENG-003 — Isolar banco e ordenar limpeza dos fixtures MCP/PostgreSQL

Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-14 01:43 UTC
Última atualização: 2026-10-14 01:52 UTC
Progresso: 3/5 marcos (60%)
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

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Confirmar precedência de DATABASE_URL e hooks FIFO; reproduzir PANIC em PG real antes da correção.
- Arquivos alterados: fixtures/helper, teste de lifecycle, inventário, estratégia/regressões e planejamento.
- Evidências: Log anterior /tmp/stylo-kimi-review-tests.log com PANIC/WAL ausente; teste mínimo confirmou ordem dos hooks.
- Testes executados: Revisão e reprodução 3/3 anteriores; risco de env constatado estaticamente.
- Problemas encontrados: sem bloqueio conhecido; gates finais pendentes.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Cleanup único com recursos registrados antes de connect/start; clientes → filhos aguardados → PG → diretório; env MCP limpo e falhas não mascaradas.
- Arquivos alterados: fixtures/helper, teste de lifecycle, inventário, estratégia/regressões e planejamento.
- Evidências: Helper restrito a testes; preservar pasta se parada/startup em execução falhar, sem alterar runtime.
- Testes executados: Revisão do contrato e critérios.
- Problemas encontrados: sem bloqueio conhecido; gates finais pendentes.

### #3 — Implementação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Helper lifecycle, env descartável, segredo aleatório, prazo real startup, restart aguardado e PG log guard; opt-out explícito do teste PG.
- Arquivos alterados: fixtures/helper, teste de lifecycle, inventário, estratégia/regressões e planejamento.
- Evidências: tests/helpers/fixture-lifecycle.mjs, dois fixtures e fixture-lifecycle.test.js; inventário regenerado e estratégia/regressões atualizadas.
- Testes executados: Execução específica final 9/9; typecheck e inventário/check aprovados.
- Problemas encontrados: sem bloqueio conhecido; gates finais pendentes.

### #4 — Testes

- Estado: em andamento
- Responsável: [Codex]
- Atividades executadas: Rodar suíte completa, revisar logs de cleanup e validar documentos.
- Arquivos alterados: fixtures/helper, teste de lifecycle, inventário, estratégia/regressões e planejamento.
- Evidências: Log /tmp/stylo-fixture-full.log em andamento; targeted-final 9/9 sem skips/PANIC.
- Testes executados: Resultado completo ainda pendente.
- Problemas encontrados: sem bloqueio conhecido; gates finais pendentes.

### #5 — Validação final

- Estado: pendente
- Responsável: [Codex]
- Atividades executadas: Revisar critérios, consultar remoto e publicar fechamento.
- Arquivos alterados: fixtures/helper, teste de lifecycle, inventário, estratégia/regressões e planejamento.
- Evidências: Publicação em preparação.
- Testes executados: Pendente.
- Problemas encontrados: sem bloqueio conhecido; gates finais pendentes.

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

### 2026-10-14 01:52 UTC — [Codex] — #1–#3 correção e regressões

- Investigado: encerramento antes da remoção, env herdado inválido e startup parcial; precedência de DATABASE_URL também existe em fixtures legados (seguimento separado).
- Alterado: cleanup único aguardado, recursos registrados cedo, contexto MCP limpo, reinício sem sleep de encerramento e skip PG somente com opt-out explícito.
- Arquivos: fixtures MCP/PG, helper, fixture-lifecycle.test.js, inventário, estratégia/regressões e esta tarefa.
- Testes: targeted final 9/9, sem skips/PANIC; typecheck e geração/check aprovados; suíte completa em andamento.
- Resultado: antes PG passava com PANIC; agora o hook exige ausência de PANIC/encerramento anormal e ausência do diretório após parada. Falha de parada/startup pendente preserva arquivos e falha visivelmente.
- Próximo passo: terminar suíte, registrar publicação e concluir conforme aceite.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante após transferência]
Estado: Em execução
Marco atual: #4 — Testes
Última atualização: 2026-10-14 01:52 UTC
Commit de referência: `fb324741e8535fb61d80b6f9ba3fd8c3e89c2fdc`

### Estado atual

Implementação pronta; testes específicos aprovados e suíte completa pendente. Nenhuma transferência de trabalho Kimi.

### Decisões tomadas

Helper de testes para aguardar saída e cleanup com erros visíveis; nenhum handler do produto será modificado. Diretório só removido após recursos encerrarem. PostgreSQL indisponível não deve mascarar erros inesperados com skip genérico.

### Arquivos envolvidos

Dois fixtures MCP/PG, helper/regressões de lifecycle, inventário regenerado, estratégia/regressões e planejamento.

### Evidências e testes

Log anterior confirma PANIC; log final específico /tmp/stylo-fixture-targeted-final.log: 9/9; typecheck/check aprovados; suíte completa pendente.

### Pendências

Suíte completa, commit e fechamento documental.

### Próximas ações recomendadas

Conferir suíte e logs; publicar e atualizar evidências. Windows não valida simulação POSIX de SIGTERM ignorado; PG exige opt-out manual caso não possa ser executado.

### Riscos e cuidados

Somente processos/dados próprios; não executar contra URL real herdada; manter responsáveis Kimi e QA humano sem exploração.

### Condições para conclusão

Critérios desta tarefa atendidos, evidências e gates publicados.

## Rollback

Reverter somente correções futuras de fixture se houver regressão; preservar reprodução/histórico e manter isolamento de dados. Esta proposta não altera execução do produto.
