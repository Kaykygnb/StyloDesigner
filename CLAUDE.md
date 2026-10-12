# Stylo — notas para agentes de código

Leia o `README.md` (visão geral, arquitetura, o que falta). Regras firmes:

- Fale em português do Brasil, simples e direto; diga o que foi e o que **não** foi verificado.
- O painel (`apps/studio`) **nunca altera o documento direto**: toda ação é uma ferramenta do MCP (`lib/api.ts` → `tool()`). Faltou uma capacidade? Primeiro a ferramenta em `packages/core`, depois o botão.
- Nunca ponha `allow-scripts` no `iframe` do canvas. Entre iframes não use `instanceof Element`.
- Teste com `npm run typecheck` e `npm test`. Não enfraqueça um teste para ele passar.
- Não altere `LICENSE`. Não commite segredos (`*.secret`, `designer.config.json`, `designer.db*/`, `designer.blobs/`).
