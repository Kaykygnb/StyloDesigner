# DOC-SERVER-003 — Vincular workspace do Studio à conta autenticada

Responsável: [Codex]
Estado: Em validação
Início: 2026-10-13 21:10 UTC
Última atualização: 2026-10-13 21:28 UTC
Progresso: 4/5 marcos (80%)
Participantes: [Codex]

## Problema e evidências

studio/doc valida o login e retorna workspace.snapshot(sid) sem vincular sid à identidade. StudioCaller também usa o sid fornecido como chave de workspace. Reutilização do sid de outra conta pode alcançar o documento e papel em cache, inclusive ao trocar contas na mesma aba.

## Objetivo

Vincular a chave interna de workspace humano à conta autenticada, mantendo o sid público e o contrato dos endpoints. Outra conta com o mesmo sid não lê nem altera o projeto da anterior.

## Escopo

- Incluído: chave interna do caller/rota snapshot; reprodução E2E com cookies OWNER/EDITOR e sid reutilizado; leitura/escrita e manutenção do workspace do proprietário.
- Fora: redesenho de sessão MCP, alteração de schema, recuperação de senha e governança de proprietários.
- Revisão posterior necessária: acesso compartilhado revogado enquanto workspace já está aberto; proposta DOC-SERVER-004, sem reprodução nesta tarefa.

## Módulo e contratos afetados

- Módulo: server/Studio.
- Arquivos: studio/studio-calls.ts, routes/studio.ts, tests/e2e/studio-login-fluxo.mjs, documentação de contratos/server/regressão.
- Contrato: sid identifica a aba, não concede autorização. Identidade continua vindo do cookie/Bearer; formatos públicos de pedidos/respostas preservados.
- Duplicações: DOC-STUDIO-002 cuida do estado/menu do cliente; esta tarefa fecha o vínculo servidor entre conta e workspace.

## Dependências, riscos e bloqueios

- Testes accounts isolados em DOC-ENG-002; mesmo responsável, edição sequencial na beta.
- Riscos: não romper restauração do projeto na mesma conta nem locks/presença/MCP; sem migração, workspace é transitório.

## Critérios de aceitação

- [x] Reprodução antes/depois com contas distintas usando o mesmo sid.
- [x] Snapshot alheio não é devolvido; chamada de leitura/escrita não alcança workspace alheio; documento do dono preservado.
- [x] Mesma conta continua usando seu sid; modo local, Studio e MCP passam na regressão.
- [x] Typecheck, suíte e E2E executados; documentação e evidências registradas.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: inspeção do caller, snapshot e identidade; namespace interno por user.id + sid planejado.
- Arquivos alterados: tarefa e backlog.
- Evidências: caller e rota usam sid bruto; usuário é conferido separadamente.
- Testes executados: reprodução E2E pendente.
- Problemas encontrados: vínculo de identidade ausente.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: inspeção do caller, snapshot e identidade; namespace interno por user.id + sid planejado.
- Arquivos alterados: tarefa e backlog.
- Evidências: caller e rota usam sid bruto; usuário é conferido separadamente.
- Testes executados: reprodução E2E pendente.
- Problemas encontrados: vínculo de identidade ausente.

### #3 — Implementação
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: correções e cenários implementados conforme escopo; job accounts obrigatório configurado.
- Arquivos alterados: arquivos listados no escopo e histórico.
- Evidências: E2E antes/depois, screenshots 390 px e diff local na beta.
- Testes executados: typecheck e build aprovados; ambas suítes E2E aprovadas com as fontes finais.
- Problemas encontrados: papel de projeto confundido com conta, overflow mobile e workspace sem vínculo de identidade tratados; avisos de bundle anteriores permanecem.

### #4 — Testes
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: typecheck, build, ambos E2E accounts em produção, regressão completa e validação documental.
- Arquivos alterados: tarefas, backlog, capacidades, contratos, módulos, regressões e estado atual (evidências).
- Evidências: npm test final em Node 24.19.0: 607 testes aprovados, 0 falhas/cancelados/ignorados, 379543,6 ms; /tmp/stylo-beta-accounts-final.log; /tmp/stylo-accounts-isolated.log; screenshots em capturas/e2e/ (390 px).
- Testes executados: npm run typecheck; npm run test:e2e (inclui npm run build); npm test; node --check nos novos scripts; node docs/planning/validate-tasks.mjs; git diff --check.
- Problemas encontrados: primeira rodada interrompida para incluir isolamento; outra interrompida pelo reinício do ambiente, sem totais declarados. Rodada final completa aprovada. Avisos de chunk/import dinâmico anteriores permanecem.

### #5 — Validação final
- Estado: em andamento
- Responsável: [Codex]
- Atividades executadas: revisão final de critérios/escopo e preparação de commit direto na beta, conforme preferência do usuário.
- Arquivos alterados: arquivos do escopo e documentação de evidências.
- Evidências: base cb22f9685b278206b114c12077f99f82bed9a766, PR anterior #16 incorporado; publicação desta rodada e CI remota pendentes.
- Testes executados: gates locais aprovados; CI remota desta rodada ainda não executada.
- Problemas encontrados: validação remota pendente; cenários de autorização adicionais registrados como Proposta em DOC-SERVER-004/005, sem afirmação de reprodução nesta rodada.

## Histórico de trabalho

### 2026-10-13 21:10 UTC — [Codex] — #1 Investigação e #2 Planejamento

- Investigado: snapshot/caller após revisão de logout e contexto entre contas.
- Alterado: nova tarefa P0 registrada antes da correção.
- Arquivos: esta tarefa e backlog.
- Testes: E2E com sid reutilizado preparado; suite geral em andamento.
- Resultado: lacuna de vínculo identificada no código.
- Próximo passo: reproduzir e vincular workspace à identidade, preservando API.

### 2026-10-13 21:15 UTC — [Codex] — #3 Implementação e #4 Testes

- Investigado: E2E antes da correção devolveu documento privado para uma segunda conta ao reutilizar o sid do proprietário (falha na expectativa null).
- Alterado: caller e snapshot usam namespace interno web:user.id:sid; identificador público/presença/MCP preservados; regressão HTTP adicional verifica contas diferentes com sid e slug iguais.
- Arquivos: studio-calls.ts, routes/studio.ts, studio-api.test.js, studio-login-fluxo.mjs, contratos, módulo server e regressões.
- Testes: typecheck aprovado; E2E completo admin/login aprovado após correção, incluindo leitura/escrita alheia recusadas e documento do dono intacto. A rodada parcial de npm test foi interrompida para iniciar gate completo com todos os arquivos finais, sem totais declarados dessa rodada.
- Resultado: defeito reproduzido e correção validada em navegador; suíte completa final em execução.
- Próximo passo: conferir regressão completa e publicar na beta.

### 2026-10-13 21:28 UTC — [Codex] — #4 Testes e #5 Validação final

- Investigado: resultado completo após reinício do ambiente; critérios e diffs finais.
- Alterado: estado Em validação, progresso 4/5, critérios locais atendidos.
- Arquivos: documentação de tarefas, backlog, contratos, módulos, capacidades, regressões e estado atual.
- Testes: npm test 607/607, 0 ignorados; typecheck e build aprovados; suítes de administração e entrada humana aprovadas em Chromium com servidor/banco accounts isolados; YAML/sintaxe/formato e diff conferidos.
- Resultado: seis chamadas protegidas antes da troca eliminadas; menus separados do papel de projeto; mobile 390 px; leitura/escrita de workspace alheio por sid recusadas com documento do dono intacto; regressão local completa aprovada.
- Próximo passo: publicar diretamente na beta e conferir CI, sem nova branch de revisão.

## Rollback

Reverter namespace interno e testes associados; não há alteração em schema ou documento persistido.
