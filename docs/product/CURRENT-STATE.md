# Estado atual

Verificação complementar em 2026-10-13: checkout da beta baseado em `cb22f9685b278206b114c12077f99f82bed9a766`, com as alterações de DOC-ENG-002, DOC-STUDIO-002 e DOC-SERVER-003. Os jobs principais do PR #16 passaram em Node 22/24 e o PR foi incorporado à beta; o job E2E antigo falhou sem servidor preparado. A rodada humana foi publicada na beta no commit `669df6e2811244589ba87130e854bbf028282d45`; CI `38471114507` aprovada em tipos/testes Node 22/24, build/documentação e login/administração Chromium/accounts.

## Verificado

- Monorepo npm com `apps/server`, `apps/studio`, `packages/core`, `packages/db` e `packages/plugins`.
- Servidor local Hono/Node com Studio servido em `/studio/`, API HTTP e gateway MCP.
- Documento com páginas, camadas, estilos, variáveis, breakpoints, comentários, assets e metadados.
- Runner único no núcleo para ferramentas de leitura e escrita.
- Persistência local via PGlite/Prisma; adapter PostgreSQL existe no código, mas não foi validado contra um PostgreSQL externo nesta revisão.
- Studio e MCP usam adaptadores diferentes para autorização, presença e locks, mas chamam a mesma implementação de ferramentas.
- Suíte atual: 607 testes aprovados, 0 falhas, 0 cancelados e 0 ignorados no último `npm test` executado em Node 24.19.0, com Chromium instalado.
- Typecheck dos cinco workspaces, build de produção do Studio e testes aprovados localmente em Node 24.19.0; CI da implementação também aprovada em Node 22/24, build/documentação e E2E accounts.
- Entrada humana/administração accounts aprovadas em Chromium localmente e na CI: senha incorreta, senha temporária/reload/troca/saída, persistência de sessão, revogação, suspensão/reativação, projetos e menus por papel da conta.
- Workspace humano vinculado à conta: reutilizar sid em outra conta não devolve nem altera o documento; nomes de arquivos iguais continuam isolados.
- Navegação inicial e saída conferidas em 390 px, com screenshot sem overflow horizontal.
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
