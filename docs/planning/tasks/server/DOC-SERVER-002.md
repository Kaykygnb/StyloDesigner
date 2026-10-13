# DOC-SERVER-002 — Corrigir datas e validar snapshots de backup

Responsável: [Codex]
Estado: Em validação
Início: 2026-10-13 20:20 UTC
Última atualização: 2026-10-13 20:42 UTC
Progresso: 4/5 marcos (80%)
Participantes: [Codex]

## Problema e evidências

O teste de backup falha no Linux porque extrai o diretório pai usando uma barra de Windows; a limpeza pode alcançar backups de outros testes. O serviço interpreta o ID YYYYMMDD-HHMMSS com um formato que Date não reconhece e entrega createdAt em 1970, impedindo ordenação cronológica correta.

## Objetivo

Listar snapshots com data UTC correta e ordem decrescente, preservando o contrato de IDs e validando restauração em armazenamento isolado.

## Escopo

- Incluído: conversão da data na listagem e testes portáveis de snapshot, ordem e restauração.
- Fora do escopo: PostgreSQL, mudanças no formato de IDs, colisões de IDs no mesmo segundo e redesign do serviço de backup.

## Módulo e contratos afetados

- Módulo: server, serviço de backups.
- Contrato: BackupInfo.createdAt representa o timestamp UTC do ID; assinaturas e formato de IDs preservados.
- Testes: tests/backups.test.ts; suíte completa e typecheck.

## Dependências, riscos e bloqueios

- Dependências: nenhuma externa para os testes focais (adapter CHECKPOINT simulado).
- Risco: testes de arquivos não comprovam restore de um banco real; DOC-DB-001 mantém esse escopo.
- Concorrência: checkout local exclusivo feat/beta-quality-gates e pasta temporária exclusiva por teste.
- Duplicações: DOC-DB-001 cobre restore/migração de banco real; DOC-SERVER-001 cobre adapters amplos. Esta tarefa trata um defeito reproduzido e seu teste focal.

## Critérios de aceitação

- [x] Datas UTC de IDs conhecidas retornadas corretamente e snapshots listados do mais novo ao mais antigo.
- [x] Snapshot preserva conteúdo e restore guarda cópia de segurança, marcador e restaura arquivos no próximo boot.
- [x] Testes usam caminhos portáveis e removem somente sua própria pasta.
- [x] Gates e limitações registrados.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: reprodução isolada da falha Linux; inspeção do serviço e das tarefas de banco.
- Arquivos alterados: esta tarefa e backlog.
- Evidências: tests/backups.test.ts falha com ENOENT em scandir; parser de datas usa YYYYMMDDTHHMMSS:00Z, inválido.
- Testes executados: teste de backup reproduzido (1 falha).
- Problemas encontrados: limpeza e caminhos do teste não são portáveis.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: preservar IDs públicos e usar componentes do ID para gerar data ISO válida.
- Arquivos alterados: esta tarefa.
- Evidências: apps/server/src/services/backups.ts.
- Testes executados: verificações de base iniciadas.
- Problemas encontrados: banco real não é usado pelo teste focal.

### #3 — Implementação
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: conversão explícita de ID em ISO UTC e testes de snapshot/ordenação/restore isolados.
- Arquivos alterados: services/backups.ts, tests/backups.test.ts, CONTRACTS.md, modules/server/README.md, REGRESSION-MATRIX.md.
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

- Investigado: falha Linux do teste de backup e parser de timestamps.
- Alterado: tarefa focal registrada após conferir DOC-SERVER-001 e DOC-DB-001.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: node --import tsx --import ./tests/_setup.mjs --test tests/backups.test.ts (1 falha ENOENT).
- Resultado: defeito reproduzido; escopo preserva contrato de IDs e não substitui validação de banco real.
- Próximo passo: corrigir conversão e isolamento; testar snapshot, ordenação e restauração.

### 2026-10-13 20:27 UTC — [Codex] — #3 Implementação e #4 Testes

- Investigado: resultados locais e limitações de ambiente.
- Alterado: conversão explícita de ID em ISO UTC e testes de snapshot/ordenação/restore isolados.
- Arquivos: services/backups.ts, tests/backups.test.ts, CONTRACTS.md, modules/server/README.md, REGRESSION-MATRIX.md.
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

Reverter conversão de data e testes relacionados; preservar histórico da tarefa.
