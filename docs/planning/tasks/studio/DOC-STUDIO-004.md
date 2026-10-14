# DOC-STUDIO-004 — Investigar falha do E2E de painel web na etapa "Conferir"

Responsável: [Kimi]
Estado: Concluída
Início: 2026-10-14 00:40 UTC
Última atualização: 2026-10-14 01:05 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Kimi]

- **Módulo:** studio/UX
- **Prioridade:** P1
- **Problema/evidência:** `tests/studio-ui.test.js` ("painel web") falha deterministicamente neste ambiente (Windows local, Chromium do Playwright) na linha 155: após clicar em "Conferir" e aguardar `.side-panel h4`, nenhum `.issues li` ou `.notice.ok` aparece ("a conferência mostra o resultado"). Falha idêntica na árvore limpa do commit `28a7c42`, sem relação com as mudanças em andamento (DOC-MCP-001). O handoff de [Codex] registra 613/613 aprovados em CI (Node 22/24 + Chromium), então a suspeita inicial é especificidade de ambiente local, não regressão de produto.
- **Objetivo:** determinar se a falha é ambiental (renderer/check_design nesta máquina) ou regressão real; restaurar o teste a verde em ambos os cenários.
- **Escopo:** `tests/studio-ui.test.js` (etapa Conferir), fluxo de `check_design` no Studio; diagnóstico do ambiente local.
- **Fora do escopo:** redesenho do recurso Conferir, mudança de contrato de `check_design`.
- **Dependências:** nenhuma.
- **Riscos:** "corrigir" o teste enfraquecendo a asserção e escondendo regressão real; assumir que é flake sem evidência (duas execuções isoladas falharam igual).
- **Aceitação:** causa-raiz registrada; se ambiental, teste documentado/pulado com justificativa neste ambiente; se regressão, correção com evidência em CI e local.
- **Testes obrigatórios:** `tests/studio-ui.test.js` isolado; suíte completa; typecheck.
- **Regressão:** E2E de painel web (`npm run test:e2e` usa outros fluxos; este roda no `npm test`).
- **Rollback:** reverter o ajuste no teste; nenhuma mudança de produto esperada.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: reprodução via script de diagnóstico temporário (`scripts/debug-studio-ui.mjs`, removido ao final): painel abre (`h4` visível), mas `check_design` demora ~6–9 s nesta máquina (PGlite + medição de vazamento em 3 larguras) e o teste só aguardava 2,5 s fixos — `issues` ainda `null` na asserção. Na CI Linux o mesmo passo cabia em 2,5 s.
- Arquivos alterados: —
- Evidências: estado capturado 2,7 s após o clique: `{ issues: null, issuesRunning: true }`; a ~9 s: `{ issues: [], issuesRunning: false }` com resposta `ok` do `check_design`.
- Testes executados: `tests/studio-ui.test.js` isolado (falha antes), diagnóstico com dump de estado.
- Problemas encontrados: causa-raiz = sleep fixo curto no teste; sem regressão de produto. Observação: duas chamadas idênticas de `check_design` por clique foram observadas no log — não impede o teste; não investigado (fora do escopo).

### #2 — Planejamento
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: correção decidida no TESTE, sem tocar em produto: clicar no botão pelo seletor inequívoco `button[title="Conferir o design"]` (o seletor por nome acessível `/Conferir/` também casa com o título do projeto quando ele contém "Conferir") e substituir o sleep fixo por `waitForSelector('.issues li, .notice.ok', { timeout: 30000 })` — a asserção passa a esperar o trabalho assíncrono real em vez de um tempo mágico.
- Arquivos alterados: —
- Evidências: diff mínimo em `tests/studio-ui.test.js` (3 linhas).
- Testes executados: —
- Problemas encontrados: —

### #3 — Implementação
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: ajuste de 3 linhas em `tests/studio-ui.test.js` (seletor do clique + espera condicional). Script de diagnóstico removido.
- Arquivos alterados: `tests/studio-ui.test.js`
- Evidências: sem mudança de produto — só o teste.
- Testes executados: E2E isolado passando (1/1).
- Problemas encontrados: —

### #4 — Testes
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: `tests/studio-ui.test.js` isolado 1/1; typecheck limpo; `npm test` 615/615 (falha zero pela primeira vez nesta máquina); build ok.
- Arquivos alterados: —
- Evidências: suíte completa verde.
- Testes executados: os listados.
- Problemas encontrados: —

### #5 — Validação final
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: critérios de aceitação atendidos (causa-raiz registrada; teste corrigido sem enfraquecer a asserção; evidências locais completas; revisão humana não exigida — mudança de teste apenas). Estado `Concluída`.
- Arquivos alterados: —
- Evidências: commits a publicar.
- Testes executados: `npm run typecheck`, `npm test`, `npm run build`.
- Problemas encontrados: —

## Histórico de trabalho

### 2026-10-14 01:05 UTC — [Kimi] — #1–#5 conclusão

- Investigado: reprodução com dump de estado (`scripts/debug-studio-ui.mjs`, temporário e removido): a 2,7 s do clique `{ issues: null, issuesRunning: true }`; a ~9 s `{ issues: [], issuesRunning: false }` com `ok` do `check_design`. Sleep fixo de 2,5 s era curto nesta máquina (CI Linux cabia no tempo).
- Alterado: `tests/studio-ui.test.js` — clique pelo seletor `button[title="Conferir o design"]` (o nome acessível `/Conferir/` casa com o título do projeto se ele contiver "Conferir") e `waitForSelector('.issues li, .notice.ok', { timeout: 30000 })` no lugar do sleep; asserção mantida.
- Arquivos: `tests/studio-ui.test.js` (3 linhas).
- Testes: E2E isolado 1/1; `npm run typecheck` limpo; `npm test` 615/615; `npm run build` ok.
- Resultado: causa-raiz = teste com espera fixa; sem regressão de produto; observação registrada de duas chamadas `check_design` idênticas por clique (não investigado, não bloqueia).
- Próximo passo: nenhum; tarefa `Concluída`.

### 2026-10-14 00:40 UTC — [Kimi] — #1 Investigação (assunção)

- Investigado: proposta registrada por [Kimi] durante a DOC-MCP-001; falha reproduzida na árvore limpa do commit `28a7c42` (dois runs isolados iguais).
- Alterado: responsável registrado como [Kimi], estado `Em andamento`, marco #1 em andamento.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: `tests/studio-ui.test.js` isolado — falha na linha 155.
- Resultado: tarefa assumida conforme protocolo §2, após autorização do proprietário.
- Próximo passo: mapear o fluxo "Conferir" no Studio (botão → chamada de API → painel) e capturar o que o painel realmente renderiza na falha.

### 2026-10-14 00:25 UTC — [Kimi] — proposta

- Investigado: falha isolada do `tests/studio-ui.test.js` durante a regressão da DOC-MCP-001; reproduzida na árvore limpa (stash) — pré-existente e ambiental na suspeita inicial.
- Alterado: proposta registrada; sem mudança de código.
- Arquivos: este documento e BACKLOG.md.
- Testes: `tests/studio-ui.test.js` isolado — falha na linha 155 nas duas execuções.
- Resultado: problema fora do escopo da DOC-MCP-001, mas registrado para não se perder.
- Próximo passo: quem assumir deve primeiro comparar o comportamento em CI vs. este ambiente antes de tocar no teste.

## Rollback

Reverter o commit do ajuste em `tests/studio-ui.test.js` (3 linhas). Nenhuma mudança de produto foi feita; o script de diagnóstico já foi removido.
