# Studio

O Studio é o editor React/Vite: canvas, seleção, camadas, toolbar, inspector, exportação, comentários e preferências.

## Controla

Apresentação e estado de sessão: página, seleção, ferramenta, zoom, painéis, idioma, tema e comunicação com o servidor.

## Não deve fazer

Não deve aplicar mutações persistentes diretamente. Ações passam por `apps/studio/src/lib/api.ts` e pelo caller de Studio.

## Verificação

`tests/studio-ui.test.js`, testes de geometria/API e `npm run build`.
