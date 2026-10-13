# Estado atual

Verificação complementar em 2026-10-13: checkout da beta baseado em `aa2582c9522143718a7a2fcec790c3c44877c38f`, com as alterações de `feat/beta-quality-gates` (DOC-ENG-001 e DOC-SERVER-002). Os resultados abaixo são locais; CI e revisão remotas continuam pendentes.

## Verificado

- Monorepo npm com `apps/server`, `apps/studio`, `packages/core`, `packages/db` e `packages/plugins`.
- Servidor local Hono/Node com Studio servido em `/studio/`, API HTTP e gateway MCP.
- Documento com páginas, camadas, estilos, variáveis, breakpoints, comentários, assets e metadados.
- Runner único no núcleo para ferramentas de leitura e escrita.
- Persistência local via PGlite/Prisma; adapter PostgreSQL existe no código, mas não foi validado contra um PostgreSQL externo nesta revisão.
- Studio e MCP usam adaptadores diferentes para autorização, presença e locks, mas chamam a mesma implementação de ferramentas.
- Suíte atual: 606 testes aprovados, 0 falhas, 0 cancelados e 0 ignorados no último `npm test` executado em Node 24.19.0, com Chromium instalado.
- Typecheck dos cinco workspaces e build de produção do Studio aprovados em Node 22.23.3 e 24.19.0.
- Snapshots de arquivos: datas UTC, ordem da lista, cópia de segurança e restauração pendente validadas por `tests/backups.test.ts` (CHECKPOINT simulado).

## Implementado, mas não verificado nesta revisão

- Integridade de restore de banco real: os testes de backup desta mudança validam arquivos, sem banco real.
- Provedores externos que exigem chaves reais.
- Uso em navegadores diferentes de Chromium/Playwright.
- Execução com PostgreSQL externo e rede multiusuário prolongada.

## Parcial ou condicionado

- Medição, screenshots e edição de imagem dependem de renderer/Chromium.
- Edição generativa é anunciada no contrato para adapters futuros, mas é recusada quando não há implementação generativa.
- Colaboração possui presença e locks, mas a topologia atual é de servidor único.
