# Versão estável e profissional — visão geral

Base: branch `feat/auditoria-organizada` (290/290 unitários, 41/41 E2E). Trabalho em `feat/versao-estavel`.

Três planos independentes, executados nesta ordem. Cada um fecha com `npm test` e `npm run test:e2e` verdes e um commit próprio por tema.

| Plano | Objetivo | Risco | Arquivo |
|---|---|---|---|
| A | Estabilidade: bugs abertos e riscos da auditoria | médio (lógica) | [A-estabilidade.md](A-estabilidade.md) |
| B | Identidade visual do editor (sóbria, densa, própria) | baixo (CSS/UI) | [B-identidade-editor.md](B-identidade-editor.md) |
| C | Projeto-exemplo e primeiro contato | baixo (dados) | [C-projeto-exemplo.md](C-projeto-exemplo.md) |

Regras: sem dependências novas; sem build; módulos ES puros; uma mudança visual por vez com captura antes/depois; nada de commit de teste instável sem registrar.
