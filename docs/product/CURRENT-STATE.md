# Estado atual

## Verificado

- Monorepo npm com `apps/server`, `apps/studio`, `packages/core`, `packages/db` e `packages/plugins`.
- Servidor local Hono/Node com Studio servido em `/studio/`, API HTTP e gateway MCP.
- Documento com páginas, camadas, estilos, variáveis, breakpoints, comentários, assets e metadados.
- Runner único no núcleo para ferramentas de leitura e escrita.
- Persistência local via PGlite/Prisma; adapter PostgreSQL existe no código, mas não foi validado contra um PostgreSQL externo nesta revisão.
- Studio e MCP usam adaptadores diferentes para autorização, presença e locks, mas chamam a mesma implementação de ferramentas.
- Suíte atual: 617 testes aprovados, 0 falhas, 0 cancelados e 0 ignorados no último `npm test` executado.

## Implementado, mas não verificado nesta revisão

- Build de produção do Studio nesta revisão.
- Provedores externos que exigem chaves reais.
- Uso em navegadores diferentes de Chromium/Playwright.
- Execução com PostgreSQL externo e rede multiusuário prolongada.

## Parcial ou condicionado

- Medição, screenshots e edição de imagem dependem de renderer/Chromium.
- Edição generativa é anunciada no contrato para adapters futuros, mas é recusada quando não há implementação generativa.
- Colaboração possui presença e locks, mas a topologia atual é de servidor único.
