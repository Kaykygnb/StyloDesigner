# Core

O core contém o modelo do documento, comandos, store, serialização CSS/HTML/SVG, geometria, auditoria, exportação e ferramentas.

## Controla

Invariantes estruturais, mutações, undo, validação de propriedades, orçamento de respostas e registro de ferramentas.

## Não deve fazer

Não deve conhecer React, Hono, Prisma, rede ou filesystem. Efeitos entram por `RunnerDependencies`.

## Verificação

Use testes de modelo, CSS, exportação, geometria, auditoria, runner e segurança. Gate: `npm run typecheck` e `npm test`.

## Inventário de ferramentas

[TOOL-INVENTORY.md](../../testing/TOOL-INVENTORY.md) e JSON são gerados por `npm run docs:inventario`; `-- --check` recusa drift na CI. O gerador lê catálogo/AST sem executar handlers e respeita a composição do runner e o dispatch de projeto no workspace. Distingue teste de contrato estrutural de menções textuais candidatas e não afirma cobertura comportamental completa. Parser Babel é dependência de desenvolvimento; não integra o runtime do produto.
