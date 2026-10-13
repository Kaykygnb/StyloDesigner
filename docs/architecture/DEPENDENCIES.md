# Dependências e adapters

## Runtime

- Node.js >= 22.
- Hono para HTTP.
- React/Vite no Studio.
- Prisma + PGlite/PostgreSQL no banco.
- Playwright/Chromium para renderização e medidas quando configurado.
- Zod para schemas de ferramentas.

## Adapters observados

`createRunner` recebe store, commands, approval, saving, renderImage, auditLayout, inspectLayout, fetchImage, imageOps e vendor. Essa injeção é a principal seam de teste e implantação.

## Riscos

- PGlite é o caminho local mais exercitado; PostgreSQL externo permanece sem evidência nesta revisão.
- Providers externos variam por chave, licença e disponibilidade de rede.
- Renderer introduz custo, timeout e diferenças entre browser e exportação.
