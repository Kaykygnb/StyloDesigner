# DOC-ENG-003 — Isolar banco e ordenar limpeza dos fixtures MCP/PostgreSQL

Responsável: [Codex]
Estado: Concluída
Início: 2026-10-14 01:43 UTC
Última atualização: 2026-10-14 01:57 UTC
Progresso: 5/5 marcos (100%)
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
- Bloqueios: nenhum conhecido; reprodução somente em dados e processos próprios. Preparação PG agora falha em erro inesperado; somente STYLO_SKIP_POSTGRES_TEST=1 produz opt-out explícito. Diretório é preservado se recursos não puderem ser encerrados ou inicialização continuar em execução.

## Critérios de aceitação

- [x] Fixture MCP ignora DATABASE_URL herdada e usa banco/blobs/segredos descartáveis; reprodução não toca bancos reais.
- [x] Cleanup fecha cliente/servidores/banco antes de remover diretório e aguarda saída com timeout; tratamento de startup parcial incluído.
- [x] Repetir teste PostgreSQL sem PANIC/encerramento anormal provocado pela remoção da pasta; sem processos/dados próprios remanescentes.
- [x] Testes e inventário/check/typecheck/regressões necessários aprovados; resultados e limites registrados; tarefas Kimi preservadas.

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

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: repetir regressões específicas/PG real, suíte completa, check de artefatos e validação documental.
- Arquivos alterados: fixtures/helper/regressão, inventário, estratégia/matriz; evidências nesta tarefa.
- Evidências: específicos 9/9; npm test 620/620, zero falhas/cancelamentos/skips; typecheck aprovado; inventário/check 120 registros e validador 19 tarefas aprovados; diff --check limpo.
- Testes executados: npm run typecheck; npm test; fixture-lifecycle/mcp-compatibilidade/postgres-integracao/tool-inventory específicos; npm run docs:inventario e -- --check; node docs/planning/validate-tasks.mjs.
- Problemas encontrados: nenhum PANIC/encerramento anormal após a correção; ausência da pasta verificada no hook PG e saída real/timeout/preservação em regressões de lifecycle. Esta execução POSIX não verifica comportamento Windows da escalada de sinais.

### #5 — Validação final

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: critérios revisados e implementação publicada na beta; registrar seguimento legado separado e preservar responsáveis Kimi.
- Arquivos alterados: esta tarefa, BACKLOG.md, HANDOFF.md e inventário de testes para contagem factual.
- Evidências: [a502ba7](https://github.com/Kaykygnb/StyloDesigner/commit/a502ba7704b43e9ac686f3465f15a7ab62c96d3b); [CI da implementação](https://github.com/Kaykygnb/StyloDesigner/actions/runs/38498065722), ainda em andamento na última consulta. Gates locais aprovados; não afirmar CI final verde antes de terminar.
- Testes executados: gates do #4 e revisão final do diff/links; nenhuma auditoria visual ou alteração funcional de produto.
- Problemas encontrados: fixtures legados têm escopo próprio em DOC-ENG-004 (Proposta); correção destes dois fixtures não certifica isolamento global da suíte em todo ambiente.

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

### 2026-10-14 01:57 UTC — [Codex] — #4–#5 entrega

- Investigado: logs finais, critérios, origem do commit e limites de plataforma/legados.
- Alterado: tarefa concluída 5/5; backlog/handoff e contagem de execução atualizados; histórico preservado.
- Arquivos: esta tarefa, BACKLOG.md, HANDOFF.md e docs/testing/INVENTORY.md.
- Testes: 620/620 sem falhas/cancelamentos/skips; específicos 9/9, typecheck, inventário/check, validador e diff aprovados.
- Resultado: duas falhas de fixture corrigidas e publicadas em a502ba7; PG agora confirma ausência de PANIC/diretório após parada. CI em andamento na consulta final, não alegada como aprovada.
- Próximo passo: assumir DOC-ENG-004 para investigar legados; revisões humanas Kimi e QA Work mantidas independentes.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Próximo participante]
Estado: Concluída — fixtures entregues
Marco atual: #5 — Validação final concluída
Última atualização: 2026-10-14 01:57 UTC
Commit de referência: `a502ba7704b43e9ac686f3465f15a7ab62c96d3b`

### Estado atual

MCP ignora URL/blobs/segredo herdados; PostgreSQL fecha cliente/servidores/banco antes da remoção. Gates locais aprovados, publicação na beta.

### Decisões tomadas

Helper restrito a testes; timeout e saída confirmada; um hook por fixture. Recursos registrados antes de conectar/iniciar; se parada falhar ou inicialização permanecer em execução, preservar diretório e falhar visivelmente. Erros PG não geram mais skip automático; opt-out explícito não comprova esse adapter.

### Arquivos envolvidos

Fixtures MCP/PG, tests/helpers/fixture-lifecycle.mjs, fixture-lifecycle.test.js, inventário, estratégia/matriz e planejamento.

### Evidências e testes

Antes: /tmp/stylo-kimi-review-tests.log com PANIC por pasta removida. Depois: /tmp/stylo-fixture-targeted-final.log 9/9; full.log 620/620 sem falhas/skips; types.log aprovado. Inventário 120/validador 19 aprovados. Commit a502ba7; CI 38498065722 em andamento na última consulta.

### Pendências

Nenhuma desta correção local. DOC-ENG-004 propõe investigar legados; monitorar CI remota sem afirmar resultado futuro. Windows não executado nesta rodada.

### Próximas ações recomendadas

Assumir DOC-ENG-004 pelo protocolo e reproduzir com sentinelas; preservar PostgreSQL explicitamente provisionado e as tarefas/revisões Kimi. QA visual continua sob orientação humana.

### Riscos e cuidados

Não restaurar env herdado/skip genérico nem remover pasta antes de saída. Opt-out PG e simulação POSIX não substituem evidência em outras plataformas. Nenhuma conexão com dados reais usada na reprodução hostil.

### Condições para conclusão

Critérios desta tarefa atendidos com regressões/publicação; conclusão restrita aos dois fixtures e helper, não ao conjunto legado.

## Rollback

Reverter somente correções futuras de fixture se houver regressão; preservar reprodução/histórico e manter isolamento de dados. Esta proposta não altera execução do produto.
