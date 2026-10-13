# DOC-ENG-001 — Aplicar gates de engenharia na CI da beta

Responsável: [Codex]
Estado: Em validação
Início: 2026-10-13 20:20 UTC
Última atualização: 2026-10-13 20:42 UTC
Progresso: 4/5 marcos (80%)
Participantes: [Codex]

## Problema e evidências

A CI atual executa npm test em Node 22/24, mas não verifica tipos nem compila o Studio. Push em v0.1.0-beta não dispara o workflow. QUALITY-GATES.md exige typecheck e testes; mudanças no Studio exigem build. Nenhuma tarefa existente cobre a automação desses gates.

## Objetivo

Detectar erros de tipos, build e formato das tarefas automaticamente em PRs e pushes na beta.

## Escopo

- Incluído: gatilho da beta, typecheck e instalação do Chromium na matriz Node 22/24, build do Studio e validador documental em Node 22; documentação e evidências locais.
- Fora do escopo: alterações de runtime, schemas, dependências, políticas de revisão e reparo do fluxo E2E administrativo.

## Módulo e contratos afetados

- Responsabilidade principal: engenharia/CI.
- Contratos públicos, persistência, autorização, ferramentas e exportação: sem alteração.
- Testes relacionados: suíte completa, typecheck, build e docs/planning/validate-tasks.mjs.

## Dependências, riscos e bloqueios

- Dependências: npm ci, Node 22/24 e GitHub Actions.
- Riscos: os novos gates podem revelar falhas existentes; execução remota precisa ser confirmada após publicação.
- Concorrência: checkout local exclusivo na branch feat/beta-quality-gates; nenhuma escrita remota nesta janela.

## Critérios de aceitação

- [x] Push da beta e PR acionam a CI.
- [x] Erros de tipos reprovam a matriz Node 22/24.
- [x] Falhas de build ou formato documental reprovam o job de qualidade.
- [x] Comandos locais e limites de verificação registrados.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: leitura do protocolo, backlog, workflow e gates; busca por tarefas duplicadas.
- Arquivos alterados: esta tarefa e backlog.
- Evidências: .github/workflows/ci.yml contém apenas npm test no job obrigatório, sem instalar Chromium; beta ausente dos gatilhos.
- Testes executados: npm ci aprovado.
- Problemas encontrados: E2E depende de servidor externo e permanece opcional na CI atual.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: priorizada automação dos gates existentes, sem alterar contratos de produto.
- Arquivos alterados: esta tarefa.
- Evidências: docs/engineering/QUALITY-GATES.md e package.json.
- Testes executados: verificações de base iniciadas.
- Problemas encontrados: execução do Actions não pode ser provada localmente.

### #3 — Implementação
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: gatilho beta, typecheck e instalação Chromium Node 22/24, build e validador documental no workflow; roadmap atualizado.
- Arquivos alterados: .github/workflows/ci.yml, QUALITY-GATES.md, ROADMAP.md, REGRESSION-MATRIX.md.
- Evidências: diff local na branch feat/beta-quality-gates.
- Testes executados: typecheck aprovado em Node 22/24; build aprovado em Node 22/24; backup 2/2 aprovado em ambas versões; inspeção/renderer 10/10 aprovado em Node 24.
- Problemas encontrados: suíte inicial parcial reproduziu falha de backup e duas falhas de renderer com Chromium ausente no começo; foi interrompida para liberar recursos para a execução final completa com Chromium instalado.

### #4 — Testes
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: execução padrão npm test sozinha, com Chromium instalado; tipos, build, testes focais e formato documental conferidos.
- Arquivos alterados: tarefas, backlog, estado atual e roadmap (evidências).
- Evidências: npm test em Node 24.19.0 teve 606/606 aprovados, 0 falhas/cancelados/ignorados (476979,8 ms); log /tmp/stylo-beta-validation.log.
- Testes executados: npm ci; npm run typecheck; npm run build; npm test; typecheck dos cinco workspaces e build Vite em Node 22.23.3; backup 2/2 em Node 22/24; renderer/inspeção 10/10; YAML, node docs/planning/validate-tasks.mjs e git diff --check.
- Problemas encontrados: rodada com concorrência 4 falhou em startup/config e edição de texto do Studio; ambas passaram no comando padrão sem alteração de asserções. Build avisa sobre import dinâmico ineficaz e chunk de 857,06 kB.

### #5 — Validação final
- Estado: em andamento
- Responsável: [Codex]
- Atividades executadas: revisão local do diff, escopo e contratos; preparando branch de revisão e PR em rascunho para v0.1.0-beta.
- Arquivos alterados: documentação de tarefas, backlog, módulos, contratos, gates, estado atual e regressões.
- Evidências: checkout baseado em aa2582c9522143718a7a2fcec790c3c44877c38f; branch feat/beta-quality-gates; gates locais aprovados.
- Testes executados: validação local concluída; GitHub Actions remoto pendente.
- Problemas encontrados: revisão e CI remotas pendentes; restore de banco real, PostgreSQL e E2E administrativo dedicado não validados nesta mudança.

## Histórico de trabalho

### 2026-10-13 20:20 UTC — [Codex] — #1 Investigação e #2 Planejamento

- Investigado: gates obrigatórios, pipeline, backlog e requisitos E2E.
- Alterado: registro de tarefa autorizada pelo pedido “Planeje e siga”.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: npm ci aprovado; typecheck, npm test e build iniciados.
- Resultado: lacuna de CI identificada; escopo definido.
- Próximo passo: implementar gates e registrar resultados.

### 2026-10-13 20:27 UTC — [Codex] — #3 Implementação e #4 Testes

- Investigado: resultados locais e limitações de ambiente.
- Alterado: gatilho beta, typecheck e instalação Chromium Node 22/24, build e validador documental no workflow; roadmap atualizado.
- Arquivos: .github/workflows/ci.yml, QUALITY-GATES.md, ROADMAP.md, REGRESSION-MATRIX.md.
- Testes: typecheck/build Node 22/24 aprovados; backup 2/2 em ambas versões; renderer/inspeção 10/10; YAML e validador documental aprovados.
- Resultado: implementação pronta; suíte completa final em andamento.
- Próximo passo: registrar totais da suíte e conferir diff final.

### 2026-10-13 20:34 UTC — [Codex] — #4 Testes

- Investigado: pressão de memória durante execuções concorrentes; diagnóstico da subida do servidor com configuração corrompida.
- Alterado: nenhuma implementação ou asserção para acomodar as falhas.
- Arquivos: esta tarefa (evidência).
- Testes: rodada completa com test-concurrency=4 teve 606 testes, 604 aprovados, 2 falhas, 0 ignorados; falhas na espera de startup com config corrompida e no texto editado do Studio. Diagnóstico com a mesma config confirmou subida em 8,9 s e preservação do arquivo corrompido.
- Resultado: suíte paralela não aprovada; comando padrão npm test iniciado sozinho, com Chromium instalado.
- Próximo passo: aguardar execução padrão e registrar resultados; não declarar gate aprovado antes disso.

### 2026-10-13 20:42 UTC — [Codex] — #4 Testes e #5 Validação final

- Investigado: resultados da execução padrão, após a rodada paralela com falhas.
- Alterado: estado Em validação e progresso 4/5; evidências atuais registradas sem substituir o histórico.
- Arquivos: documentação de tarefas, backlog, estado atual e roadmap.
- Testes: npm test (606 aprovados, 0 falhas, 0 ignorados), typecheck/build Node 24, tipos/build Node 22, backup 2/2 Node 22/24, renderer 10/10, formato documental e YAML aprovados.
- Resultado: correção e gates prontos localmente; o fluxo real do editor passou no comando padrão.
- Próximo passo: publicar branch e PR em rascunho, conferir CI remota e revisão antes de marcar Concluída.

## Rollback

Reverter a mudança em .github/workflows/ci.yml e a documentação associada, preservando o histórico da tarefa.
