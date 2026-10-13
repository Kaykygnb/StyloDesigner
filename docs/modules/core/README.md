# Core

O core contém o modelo do documento, comandos, store, serialização CSS/HTML/SVG, geometria, auditoria, exportação e ferramentas.

## Controla

Invariantes estruturais, mutações, undo, validação de propriedades, orçamento de respostas e registro de ferramentas.

## Não deve fazer

Não deve conhecer React, Hono, Prisma, rede ou filesystem. Efeitos entram por `RunnerDependencies`.

## Verificação

Use testes de modelo, CSS, exportação, geometria, auditoria, runner e segurança. Gate: `npm run typecheck` e `npm test`.
