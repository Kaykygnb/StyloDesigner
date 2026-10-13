# DOC-STUDIO-002 — Entrada humana com senha temporária e retorno após reload

Responsável: [Codex]
Estado: Em validação
Início: 2026-10-13 20:55 UTC
Última atualização: 2026-10-13 21:28 UTC
Progresso: 4/5 marcos (80%)
Participantes: [Codex]

## Problema e evidências

boot chama afterLogin, que conecta SSE e carrega projetos mesmo com mustChangePassword. Reprodução em navegador mostrou o formulário após reload, mas seis chamadas protegidas antes da troca (backend recusa o acesso). A inspeção também confirmou que Home usava role de projeto (inicialmente OWNER) para mostrar administração da conta, e o screenshot de viewport 390 px tinha 491 px de largura por overflow do cabeçalho.

## Objetivo

Permitir trocar a senha ou sair, inclusive após reload; acessar projetos e live apenas depois da troca; validar login, senha incorreta, sessão, suspensão e permissões em navegador.

## Escopo

Estado de boot/afterLogin e saída; formulário de troca obrigatória; menus conforme papel da conta (separado do papel no projeto); orientação MCP autenticada para administradores; cabeçalho mobile e E2E de pessoas. Sem redesenho de autenticação, alteração de schema ou de permissões do backend.

## Módulo e contratos afetados

- Módulo: studio.
- Arquivos potenciais: apps/studio/src/lib/app.ts, screens/Login.tsx, screens/Home.tsx, styles/app.css, lib/i18n.ts, tests/e2e/studio-login-fluxo.mjs.
- Contratos: endpoints e credenciais existentes preservados; autorização accounts permanece obrigatória; somente fluxo do cliente e infraestrutura de teste.
- Duplicações: DOC-STUDIO-001 cobre paridade Studio/MCP; DOC-SERVER-001 cobre adapters. Esta tarefa trata a entrada humana e a reprodução browser do fluxo accounts, não inventário/paridade.

## Dependências, riscos e bloqueios

- Não enfraquecer autorização do backend; preservar modo local; isolar contextos OWNER/EDITOR e não imprimir senhas/tokens.
- Janela de edição: checkout exclusivo local da beta; consulta de branch/PR concluída; sem alteração da main.
- Decisão de fluxo: autorização do usuário para trabalhar diretamente na beta; PR #16 incorporado antes desta rodada.

## Critérios de aceitação

- [x] Cenário reproduzido e resultado antes/depois registrado.
- [x] Fluxo accounts testado com contextos separados; erro de senha, senha temporária/reload/troca, logout, sessões e permissões verificados.
- [x] E2E inicia ambiente isolado por padrão, encerra processos e limpa seus dados.
- [x] Editor dono de projeto não vê administração/conexões MCP; contas recebem orientação MCP com token e guia; cabeçalho cabe em 390 px.
- [x] Gates obrigatórios e build executados; documentação e regressões atualizadas.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: boot chama afterLogin, que conecta SSE e carrega projetos mesmo com mustChangePassword. Reprodução em navegador mostrou o formulário após reload, mas seis chamadas protegidas antes da troca (backend recusa o acesso). A inspeção também confirmou que Home usava role de projeto (inicialmente OWNER) para mostrar administração da conta, e o screenshot de viewport 390 px tinha 491 px de largura por overflow do cabeçalho.
- Arquivos alterados: esta tarefa e backlog; implementação pendente.
- Evidências: boot chama afterLogin, que conecta SSE e carrega projetos mesmo com mustChangePassword. Reprodução em navegador mostrou o formulário após reload, mas seis chamadas protegidas antes da troca (backend recusa o acesso). A inspeção também confirmou que Home usava role de projeto (inicialmente OWNER) para mostrar administração da conta, e o screenshot de viewport 390 px tinha 491 px de largura por overflow do cabeçalho.
- Testes executados: revisão da CI anterior; reprodução browser pendente.
- Problemas encontrados: registrados no escopo; sem bloqueio para iniciar.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: escopo e critérios acima; etapas runner → reprodução → correção → E2E → gates → publicação beta.
- Arquivos alterados: esta tarefa e backlog; implementação pendente.
- Evidências: escopo e critérios acima; etapas runner → reprodução → correção → E2E → gates → publicação beta.
- Testes executados: revisão da CI anterior; reprodução browser pendente.
- Problemas encontrados: registrados no escopo; sem bloqueio para iniciar.

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

### 2026-10-13 20:55 UTC — [Codex] — #1 Investigação e #2 Planejamento

- Investigado: backlog, protocolo, boot/login, identidade accounts e CI do PR anterior.
- Alterado: registro da tarefa autorizada; sem mudança de contratos públicos.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: checks anteriores Node 22/24 e build aprovados; E2E antigo falhou sem servidor.
- Resultado: defeito de fluxo identificado; reprodução e correção planejadas.
- Próximo passo: preparar runner, executar fluxo humano antes/depois e conferir gates.

### 2026-10-13 21:03 UTC — [Codex] — #3 Implementação e reprodução

- Investigado: E2E com servidor accounts isolado; resultado antes/depois; screenshots no celular.
- Alterado: runner inicia servidor/banco/config/assets próprios, impõe prazos e limpa recursos; entrada com senha temporária evita workspace/SSE; formulário permite sair; menus usam papel da conta; orientação MCP accounts leva ao guia autenticado; cabeçalho mobile se reorganiza em duas linhas.
- Arquivos: run.mjs, studio-login-fluxo.mjs, package.json, app.ts, Login.tsx, Home.tsx, i18n.ts, app.css, ci.yml.
- Testes: antes da correção o fluxo humano falhou com 6 chamadas protegidas; após guardas, fluxos admin/login passaram. Screenshot de Home antes do ajuste responsivo tinha 491 px para viewport 390 px. Ajustes de cabeçalho e guia estão em validação E2E final.
- Resultado: diagnóstico inicial de boot refinado pela execução (formulário funcionava, mas fazia chamadas indevidas); defeitos de menus e mobile tratados sem mudar autorização do backend.
- Próximo passo: E2E final, typecheck/suíte e evidências antes da publicação direta na beta.

### 2026-10-13 21:28 UTC — [Codex] — #4 Testes e #5 Validação final

- Investigado: resultado completo após reinício do ambiente; critérios e diffs finais.
- Alterado: estado Em validação, progresso 4/5, critérios locais atendidos.
- Arquivos: documentação de tarefas, backlog, contratos, módulos, capacidades, regressões e estado atual.
- Testes: npm test 607/607, 0 ignorados; typecheck e build aprovados; suítes de administração e entrada humana aprovadas em Chromium com servidor/banco accounts isolados; YAML/sintaxe/formato e diff conferidos.
- Resultado: seis chamadas protegidas antes da troca eliminadas; menus separados do papel de projeto; mobile 390 px; leitura/escrita de workspace alheio por sid recusadas com documento do dono intacto; regressão local completa aprovada.
- Próximo passo: publicar diretamente na beta e conferir CI, sem nova branch de revisão.

## Rollback

Reverter alterações desta tarefa, preservando histórico e evidências; nenhuma migração de banco prevista.
