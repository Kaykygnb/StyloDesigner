# Testes de navegador

Testam o app **de verdade**, num navegador: desenhar, arrastar entre frames, redimensionar com rotação, caneta, componentes, protótipo, atalhos, painéis e desempenho. Os testes *unitários* (`npm test`) cobrem a lógica pura; estes cobrem a interação.

O Playwright é uma dependência de desenvolvimento; o app continua sem dependências em tempo de execução.

```bash
npm install
npx playwright install chromium
npm start                 # em outro terminal (porta 5173)
npm run test:e2e          # todos os fluxos no navegador
npm run test:all          # unitários + navegador
```

Variáveis de ambiente: `APP_URL` (padrão `http://localhost:5173/`) e `CHROMIUM_PATH` (se você já tem um Chromium instalado).

## O que cada arquivo cobre

| Arquivo | Cobre |
|---|---|
| `basico.mjs` | Desenhar frame/retângulo/texto, mover, redimensionar, rotacionar, desfazer/refazer, auto layout (`Shift+A`), reordenar no flex, agrupar, duplicar, aba Código, autosave |
| `arrastar-e-paineis.mjs` | Trocar de pai arrastando entre frames, `Alt`+arrastar, marquee, redimensionar grupo, zoom/pan, arrastar na lista de camadas, campo numérico (contas e arrastar rótulo), menu de contexto, imagem, páginas |
| `vetores-componentes-grid.mjs` | Linha, caneta (curvas, fechar), edição de pontos, estrela, réguas e guias, constraints, CSS Grid, componentes e instâncias, máscara, espelhar, estilos |
| `prototipo.mjs` | Criar interação, seta de fluxo, modo Apresentar (navegar, voltar, `Esc`) |
| `extras.mjs` | Envolver em frame, exportar SVG, busca de camadas |
| `camadas-paineis-salvar.mjs` | Camadas recolhidas, seleção em intervalo, indicador de salvo, duplicar página, redimensionar painel, modo foco, canvas vazio, aviso de erro |
| `selecao-teclado-medidas.mjs` | `Ctrl`+clique, `Tab`, copiar/colar propriedades, colar dentro do frame, desagrupar frame, `Ctrl+B/I/U`, medidas com `Alt`, grade de pixels |
| `propriedades-layout-texto.mjs` | X/Y/W/H de várias camadas, matriz 3×3, padding horizontal/vertical, MAIÚSCULAS e alinhamento vertical, cores do projeto, exportar todos os frames |
| `salvar-pasta.mjs` | Migração do `localStorage` antigo, projeto de 8 MB no IndexedDB, Configurações (pasta), `Ctrl+S` com nome, auto-salvar na pasta, recarregar sem conflito falso, conflito com arquivo mudado por fora, Salvar como, abrir da pasta, versões, servidor fora do ar, teclado (menus, janelas, abas, `aria-*`). Usa uma pasta temporária. |
| `pagina-inicial.mjs` | Página inicial: abre ao iniciar, editor `inert` e atalhos bloqueados, miniatura ao vivo e do servidor, busca, renomear, duplicar, abrir sem pergunta quando nada se perde e com pergunta quando se perderia, lembrete "só no navegador", Recentes, renomear página sem `prompt()`, barra × zoom sem sobreposição, preferência "ir direto ao editor". |
| `svg-icones-fontes.mjs` | Importar SVG (classes, gradiente, `transform`, furo `evenodd`, texto), desfazer, contornos sobrevivem a recarregar e voltam no SVG exportado, `.svg` pelo botão de imagem e SVG colado como texto viram vetor, painel Ícones (busca em português, cor, tamanho, dentro do frame), seletor de fontes (busca, Enter, peso ajustado, fonte baixada, `<link>` no HTML, filtro Mono, Esc). **Precisa de internet.** |
| `desempenho.mjs` | Tempo por movimento do mouse com N camadas (`node tests/e2e/desempenho.mjs 1000`) |
