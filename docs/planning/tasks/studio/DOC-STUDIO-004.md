# DOC-STUDIO-004 — Investigar falha do E2E de painel web na etapa "Conferir"

Responsável: [Kimi]
Estado: Em andamento
Início: 2026-10-14 00:40 UTC
Última atualização: 2026-10-14 00:40 UTC
Progresso: 0/5 marcos (0%)
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
- Estado: em andamento
- Responsável: [Kimi]
- Atividades executadas: assumida após reprodução prévia na árvore limpa durante a regressão da DOC-MCP-001.
- Arquivos alterados: —
- Evidências: falha em `tests/studio-ui.test.js:155` ("a conferência mostra o resultado"): após clicar em "Conferir" e aguardar `.side-panel h4`, nenhum `.issues li` nem `.notice.ok` aparece.
- Testes executados: `tests/studio-ui.test.js` isolado — falha repetida (2×).
- Problemas encontrados: —

### #2 — Planejamento
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #3 — Implementação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #4 — Testes
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #5 — Validação final
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

## Histórico de trabalho

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

Proposta sem implementação; remover a linha do BACKLOG e este documento se invalidada.
