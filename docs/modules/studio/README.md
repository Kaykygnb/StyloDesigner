# Studio

O Studio é o editor React/Vite: canvas, seleção, camadas, toolbar, inspector, exportação, comentários e preferências.

## Controla

Apresentação e estado de sessão: página, seleção, ferramenta, zoom, painéis, idioma, tema e comunicação com o servidor.

No modo accounts, a entrada com senha temporária mostra somente troca de senha/saída, inclusive após reload; projetos, snapshot e presença são carregados após a troca. Sair encerra a presença, remove callbacks de navegação/refresh e limpa contexto de projeto. Administração e conexões MCP usam o papel da conta (`user.role`), nunca o papel no projeto. O modo local mantém seu fluxo sem login.

## Não deve fazer

Não deve aplicar mutações persistentes diretamente. Ações passam por `apps/studio/src/lib/api.ts` e pelo caller de Studio.

## Verificação

`tests/studio-ui.test.js`, `tests/studio-parity.test.js` (paridade observável com o caller MCP, sem Chromium), testes de geometria/API e `npm run build`.

`npm run test:e2e` verifica entrada humana e administração em produção, com cookies e contextos separados, além da navegação mobile (DOC-STUDIO-002 e DOC-ENG-002).
