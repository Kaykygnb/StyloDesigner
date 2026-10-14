# DOC-ENG-004 — Auditar isolamento e cleanup dos fixtures legados

Responsável: [Codex]
Estado: Concluída
Início: 2026-10-14 02:09 UTC
Última atualização: 2026-10-14 02:28 UTC
Progresso: 5/5 marcos (100%)
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

- Dependência: helper DOC-ENG-003 reutilizado; sem alteração de runtime.
- Riscos: mudar testes PostgreSQL legítimos que usam URL própria; mascarar falha com skip; cleanup encerrar processo alheio.
- Bloqueios: nenhum conhecido; reproduzir somente com sentinela inofensiva e recursos descartáveis.

## Critérios de aceitação

- [x] Inventário de fixtures e env/lifecycle atual; problemas confirmados por reprodução segura, não contra dados externos reais.
- [x] Suíte padrão/fixtures ignoram URLs herdadas; fixtures PostgreSQL usam apenas URL própria; configuração/blobs/segredos testados conforme risco.
- [x] Cleanup legado auditado; corrigir problemas comprovados com saída confirmada antes de remoção; limites de plataforma registrados.
- [x] Regressões/gates apropriados aprovados; histórico/handoff/índice atualizados e sem duplicar ENG-003.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: auditar subprocessos; comparar setup/preferência de openDb; reproduzir herança com variável sentinela sem abrir banco.
- Arquivos alterados: esta tarefa/backlog/handoff; código de fixtures ainda intacto.
- Evidências: DATABASE_URL=sentinela-invalida node --import ./tests/_setup.mjs mantém valor herdado; asserção falhou conforme esperado. 13 fixtures legados de servidor identificados: api-seguranca, api, assets-http, biblioteca-http, config-autorizacao, contas-http, gravacao-atomica, export-zip-http, mcp-contas, mcp-sdk, server, studio-api e studio-ui. A ponte mcp-stdio usa servidor HTTP stub próprio e não abre banco; fixtures MCP cru/PG já pertencem à ENG-003.
- Testes executados: reprodução segura do setup em subprocesso Node 24; leitura estática dos env/hooks. Nenhuma conexão externa ou implementação nova nesta investigação.
- Problemas encontrados: cleanup rm registrado antes de child.kill em fixtures legados; server.test.js também não fornece DESIGNER_CONFIG temporário. Corrigir setup global sozinho não cobre execução isolada dos arquivos sem --import setup; revisar ambos os caminhos.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Helper isolatedServerEnv exige configuração própria, limpa URL/blobs/chaves herdados e permite overrides explícitos; cleanupFixture único fecha clientes, aguarda filhos e só então remove diretório. Preservar PG provisionado e modos accounts/dev dos cenários.
- Arquivos alterados: tests/_setup.mjs, tests/helpers/test-env.mjs, tests/test-env.test.js e 13 fixtures; inventário regenerado.
- Evidências: execução direta sem setup, DATABASE_URL sentinela inválida e segredo/blobs hostis; API/autorização/MCP funcionam com recursos próprios.
- Testes executados: regressões específicas 10/10; typecheck aprovado. Suíte completa em execução.
- Problemas encontrados: nenhum nas regressões específicas; não usar valores herdados como overrides.

### #3 — Implementação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Aplicado helper de ambiente e cleanup aos 13 fixtures mapeados; server.test usa configuração temporária; clientes MCP fecham antes do servidor. Setup padrão também limpa URL/blobs/chaves. Dois testes novos cobrem ambiente hostil, configuração obrigatória e override explícito de URL própria.
- Arquivos alterados: tests/_setup.mjs, tests/helpers/test-env.mjs, tests/test-env.test.js e 13 fixtures; inventário regenerado.
- Evidências: execução direta sem setup, DATABASE_URL sentinela inválida e segredo/blobs hostis; API/autorização/MCP funcionam com recursos próprios.
- Testes executados: regressões específicas 10/10; typecheck aprovado. Suíte completa em execução.
- Problemas encontrados: nenhum nas regressões específicas; não usar valores herdados como overrides.

### #4 — Testes

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: validar isolamento/lifecycle e gates; publicação da implementação na beta com lease, sem alteração funcional no produto.
- Arquivos alterados: fixtures/helper/setup, regressões/inventário; tarefa, backlog e handoff.
- Evidências: commit f8f8141cc7c674045d2039f2d18dd9625bc193d9 publicado em v0.1.0-beta; suíte inclui PostgreSQL real e Studio UI automatizado.
- Testes executados: específicos hostis sem setup 10/10; npm test 622/622, 0 falhas/skips; npm run typecheck; docs:inventario -- --check; validador 20 tarefas; git diff --check aprovados.
- Problemas encontrados: nenhum nos gates desta rodada. Escalada SIGKILL é POSIX; cobertura Windows não executada aqui. CI remota deste commit ainda não consultada.

### #5 — Validação final

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: validar isolamento/lifecycle e gates; publicação da implementação na beta com lease, sem alteração funcional no produto.
- Arquivos alterados: fixtures/helper/setup, regressões/inventário; tarefa, backlog e handoff.
- Evidências: commit f8f8141cc7c674045d2039f2d18dd9625bc193d9 publicado em v0.1.0-beta; suíte inclui PostgreSQL real e Studio UI automatizado.
- Testes executados: específicos hostis sem setup 10/10; npm test 622/622, 0 falhas/skips; npm run typecheck; docs:inventario -- --check; validador 20 tarefas; git diff --check aprovados.
- Problemas encontrados: nenhum nos gates desta rodada. Escalada SIGKILL é POSIX; cobertura Windows não executada aqui. CI remota deste commit ainda não consultada.

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

### 2026-10-14 02:11 UTC — [Codex] — #1 reprodução e inventário inicial

- Investigado: 13 fixtures de servidor e ponte stdio distinta; env DATABASE_URL e configuração/ordem de cleanup.
- Alterado: marco #1 concluído, progresso 1/5 e evidência preservada; nenhuma correção funcional/fixture aplicada ainda.
- Arquivos: esta tarefa, BACKLOG.md e HANDOFF.md.
- Testes: setup com sentinela inválida falhou na asserção de isolamento, confirmando herança; sem chamar openDb ou conectar banco.
- Resultado: problema do setup reproduzido com segurança; riscos de configuração padrão e cleanup corroborados por leitura, com lista de alcance.
- Próximo passo: detalhar helper de env/cleanup, testar execução padrão e isolada, preservar PG com URL própria; só concluir após regressões.

### 2026-10-14 02:20 UTC — [Codex] — #2/#3 implementação e testes específicos

- Investigado: ambientes e ordem de encerramento dos 13 fixtures legados; PostgreSQL explícito preservado.
- Alterado: helper de env, setup padrão, configurações temporárias e lifecycle compartilhado; clientes fecham antes dos filhos. Sem código funcional do produto.
- Arquivos: tests/_setup.mjs, tests/helpers/test-env.mjs, tests/test-env.test.js, 13 fixtures, inventário e documentação de testes.
- Testes: execução sem setup com env hostil, 10/10 aprovados; typecheck aprovado; inventário regenerado. Suíte completa em execução.
- Resultado: marcos #2/#3 concluídos com proteção exercitada sem dados externos.
- Próximo passo: registrar suíte/validator/drift, publicar e concluir apenas com gates verdes.

### 2026-10-14 02:28 UTC — [Codex] — #4/#5 entrega validada

- Investigado: resultados finais e publicação com lease do HEAD conhecido.
- Alterado: marcos #4/#5 e critérios concluídos; handoff/backlog atualizados. Implementação publicada em f8f8141.
- Arquivos: esta tarefa, BACKLOG.md e HANDOFF.md.
- Testes: específicos 10/10 sem setup global; suíte 622/622, zero falhas/skips; typecheck, inventário, validador 20 tarefas e diff aprovados.
- Resultado: isolamento e cleanup dos 13 fixtures corrigidos; PG próprio preservado. Sem auditoria visual ou mudança funcional do Stylo.
- Próximo passo: próxima prioridade livre é DOC-DB-001, restore/migração descartáveis. Decisões humanas P0 continuam nos respectivos handoffs; não duplicar tarefas.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Próximo participante]
Estado: Concluído
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 02:28 UTC
Commit de referência: `f8f8141cc7c674045d2039f2d18dd9625bc193d9`

### Estado atual

Concluída 5/5; 13 fixtures legados isolados, cleanup confirmado antes de remoção e configuração própria no teste do servidor. Código funcional intacto.

### Decisões tomadas

Ambiente herdado não fornece banco/blobs/chaves; overrides são explícitos e próprios do teste. PG descartável continua separado. Reusar helper de lifecycle, não criar outro protocolo de cleanup.

### Arquivos envolvidos

tests/_setup.mjs, tests/helpers/test-env.mjs, tests/test-env.test.js, 13 fixtures listados no marco #1 e docs/testing/REGRESSION-MATRIX.md; inventário regenerado.

### Evidências e testes

Específicos hostis 10/10; suíte 622/622 sem falhas/skips; typecheck, inventário, validador e diff aprovados. Publicação f8f8141 na beta. CI remota ainda não consultada nesta entrada.

### Pendências

Nenhuma local para ENG-004. Acompanhar CI remota; revisão humana P0 em tarefas distintas.

### Próximas ações recomendadas

Priorizar DOC-DB-001 (restore/migração), depois paridade crítica e exportação. Novos fixtures devem usar recursos próprios e cleanup ordenado.

### Riscos e cuidados

Não passar process.env humano como overrides; SIGKILL POSIX não comprova Windows. Falha de encerramento preserva diretório e reprova o teste.

### Condições para conclusão

Critérios e gates atendidos, implementação publicada.

## Rollback

Reverter f8f8141 apenas mantendo isolamento equivalente; não voltar a herdar banco/configuração externa.
