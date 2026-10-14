# DOC-ENG-004 — Auditar isolamento e cleanup dos fixtures legados

Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-14 02:09 UTC
Última atualização: 2026-10-14 02:20 UTC
Progresso: 3/5 marcos (60%)
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

- [ ] Inventário de fixtures e env/lifecycle atual; problemas confirmados por reprodução segura, não contra dados externos reais.
- [ ] Suíte padrão/fixtures ignoram URLs herdadas; fixtures PostgreSQL usam apenas URL própria; configuração/blobs/segredos testados conforme risco.
- [ ] Cleanup legado auditado; corrigir problemas comprovados com saída confirmada antes de remoção; limites de plataforma registrados.
- [ ] Regressões/gates apropriados aprovados; histórico/handoff/índice atualizados e sem duplicar ENG-003.

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

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante após transferência]
Estado: Em execução
Marco atual: #4 — Testes
Última atualização: 2026-10-14 02:20 UTC
Commit de referência: `726583500178eb39fa07e72106f5355d2d1a776f`

### Estado atual

Marcos #1–#3 concluídos; isolamento e cleanup corrigidos nos 13 fixtures. Específicos 10/10 sem setup global e typecheck aprovados; suíte completa em execução.

### Decisões tomadas

P0 Kimi preservadas; próxima P1 por risco de atingir banco/configuração real. Depois restore/migração, paridade Studio/MCP e exportação; redesign depende da direção visual humana.

### Arquivos envolvidos

Fixtures legados, tests/_setup.mjs, helper de lifecycle/ambiente, inventário de fixtures e regressões.

### Evidências e testes

Reprodução Node 24 confirmou env herdado sem conectar banco; auditoria estática de 13 fixtures. Gates de implementação pendentes.

### Pendências

Suíte completa, gates documentais e publicação final.

### Próximas ações recomendadas

Isolar env sem afetar URL própria PostgreSQL; aguardar processos antes da remoção; validar documentação/artefatos e suíte.

### Riscos e cuidados

Só dados/processos próprios; não reproduzir contra URL externa real. Preservar decisões e responsáveis Kimi, não iniciar QA visual por esta assunção.

### Condições para conclusão

Critérios existentes atendidos e evidências/gates publicados.

## Rollback

Reverter alterações de fixture apenas com isolamento equivalente; preservar evidências e não voltar a herdar DATABASE_URL/configuração externa.
