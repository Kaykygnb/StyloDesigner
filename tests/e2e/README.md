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
| `vetores-componentes-grid.mjs` | Linha, caneta (curvas, fechar), edição de pontos, estrela, réguas e guias, constraints, CSS Grid e grade rápida acessível por setas, componentes e instâncias, máscara, espelhar, estilos |
| `prototipo.mjs` | Criar interação, seta de fluxo, modo Apresentar (navegar, voltar, `Esc`) |
| `extras.mjs` | Envolver em frame, exportar SVG, busca de camadas |
| `camadas-paineis-salvar.mjs` | Camadas recolhidas, seleção em intervalo, indicador de salvo, duplicar página, redimensionar painel, modo foco, canvas vazio, aviso de erro |
| `selecao-teclado-medidas.mjs` | `Ctrl`+clique, `Tab`, copiar/colar propriedades, colar dentro do frame, desagrupar frame, `Ctrl+B/I/U`, medidas com `Alt`, grade de pixels |
| `propriedades-layout-texto.mjs` | X/Y/W/H de várias camadas, matriz 3×3, padding horizontal/vertical, MAIÚSCULAS e alinhamento vertical, cores do projeto, exportar todos os frames |
| `salvar-pasta.mjs` | Migração do `localStorage` antigo, projeto de 8 MB no IndexedDB, Configurações (pasta), `Ctrl+S` com nome, auto-salvar na pasta, recarregar sem conflito falso, conflito com arquivo mudado por fora, Salvar como, abrir da pasta, versões, servidor fora do ar, teclado (menus, janelas, abas, `aria-*`). Usa uma pasta temporária. |
| `pagina-inicial.mjs` | Página inicial: abre ao iniciar, editor `inert` e atalhos bloqueados, miniatura ao vivo e do servidor, busca, renomear, duplicar, abrir sem pergunta quando nada se perde e com pergunta quando se perderia, lembrete "só no navegador", Recentes, renomear página sem `prompt()`, barra × zoom sem sobreposição, preferência "ir direto ao editor". |
| `layout-polido.mjs` | Página inicial de 320 a 1440 px sem rolagem horizontal, prévias válidas e contidas nos cards, busca e Escape pelo teclado, temas e ferramentas dentro do palco sem sobreposição com o zoom de 900 a 1440 px. |
| `editor-compacto.mjs` | Topo de 40 px, estado de salvamento acessível, informações pelo i e teclado sem deslocar campos, Escape/foco/clique fora, atalhos protegidos, Nota sob demanda e as quatro abas sem alterar o documento. |
| `svg-icones-fontes.mjs` | Importar SVG (classes, gradiente, `transform`, furo `evenodd`, texto), desfazer, contornos sobrevivem a recarregar e voltam no SVG exportado, `.svg` pelo botão de imagem e SVG colado como texto viram vetor, painel Ícones (busca em português, cor, tamanho, dentro do frame), seletor de fontes (combobox acessível, opção ativa, lista limpa, busca, Enter, peso ajustado, fonte baixada, `<link>` no HTML, filtro Mono, Esc). **Precisa de internet.** |
| `auto-layout-intencao.mjs` | Casos relatados por usuário: desenhar/clicar texto ENTRE itens de um auto layout (entra naquela posição), retângulo de fundo + item em cima → `Shift+A` transforma o fundo no frame (item não pula); grupo vira frame; retângulo sozinho vira frame (mesmo id, Ctrl+Z volta); camadas soltas ganham frame que abraça; formas não nascem da mesma cor do que está embaixo. |
| `css-polimento.mjs` | Snap ao redimensionar (gruda nas bordas do frame pai, linha rosa, Ctrl desliga), contorno por lado (`border-*` no canvas, no painel Código e no SVG) e CSS Grid (alinhamento do grid vale nos itens, `stretch`, `justify-self` do item, flex → grid troca valores inválidos). |
| `secao.mjs` | Seção (`Shift+S`): desenhar, adotar telas totalmente dentro, mover pelo nome e pelo corpo, regras de aninhamento (seção só na raiz, só frames dentro), `<section>` no código e desagrupar |
| `agente-mcp.mjs` | **IA no editor**: inspetor (tecla I, etiqueta/classe/box model, clique seleciona o elemento exato), MCP por HTTP (initialize, tools/list, ler, alterar) e por stdio (`scripts/mcp.mjs`), janela de permissão (recusar, permitir, permitir tudo), Ctrl+Z, a chave da API nunca sai do servidor e o Assistente conversando com uma OpenAI falsa (sem gastar crédito). |
| `exportacao-fiel.mjs` | **O HTML exportado é igual ao editor**: exporta cada tela da Vitrine (e um projeto com etiquetas erradas de propósito: `<li>` dentro de `<li>`, link dentro de link, botões), abre como site e compara posição e tamanho de cada camada no Desktop, Tablet e Celular (±1,5 px); o painel avisa quando uma etiqueta não vale ali. |
| `codigo-editavel.mjs` | **Código à mão**: editar o CSS da camada (vira propriedade do painel ou CSS livre; `Ctrl+Z` desfaz tudo), autocompletar e avisos por linha, CSS da página (vale no canvas sem vazar para a interface e vai para a exportação), id/classes extras, camada "Código HTML" (`Shift+E`) sanitizada no canvas e no arquivo, painel do Inspecionar (box model, regras) e distâncias com `Alt`. Com `CAPTURAS=<pasta>` salva capturas. |
| `css-util.mjs` | CSS ampliado pelo painel de verdade: limites (max-width) e proporção, peso no flex (1 e 3 = 1/4 e 3/4), modelos e trilhas editáveis do grid (e limpeza de `;{}`), gradiente cônico |
| `configuracoes-abas.mjs` | Navegação das abas por teclado, vínculo com o painel, seções das configurações, preservação de rascunhos e janela em 390 px |
| `design-polimento.mjs` | Mão na barra, posições e conjuntos de guias, trava e desfazer, cancelamento de arrasto, validação de trilhas CSS, quebra de código e ferramentas sem sobreposição |
| `layout-limpo.mjs` | Réguas escondidas e Ctrl+R/Shift+R (sem recarregar, lembrado), largura da tela e modo de cor no topo, listas sem contorno lateral, seções pouco usadas recolhidas |
| `vitrine.mjs` | Exemplo "Vitrine completa": abrir pela página inicial (miniatura), renderizar ~180 camadas, grade 3 → 2 → 1 colunas e menu que some, "Telas em 390px", modo escuro, código gerado, Apresentar e comentários |
| `responsivo.mjs` | Barra Desktop/Tablet/Celular: edição só por diferença (`bps`), cascata tablet → celular, pré-visualização no canvas, canvas só seleciona, ocultar por largura, "Telas em 390px", `@media` no código, restaurar, desfazer, largura fluida, recarregar |
| `modos-variaveis.mjs` | Modos de cor (criar escuro, ver no canvas, editar o valor por modo na amostra e no painel, CSS com `data-theme`, excluir/desfazer) e variáveis de tamanho (criar, ligar, mudar o valor, editar à mão solta, `var()` no CSS, excluir) |
| `seletor-de-cor.mjs` | Seletor de cor: HEX/RGB/HSL, controles de matiz/saturação/brilho/opacidade acessíveis por teclado, contraste, sugestões, recentes e o gerenciador de paletas (nova, renomear, guardar/tirar cor, abas, duplicar, excluir com confirmação) |
| `notas-paletas-painel.mjs` | Painel Design compacto (cabeçalho, seções recolhíveis, informação pelo i, dicas ricas, empilhamento), Nota sob demanda (ícone, menu, selo, comentário no código), seção HTML (etiqueta/link) e paletas (criar, aplicar, Shift+clique, remover cor, estilos de cor, seletor de cor, recarregar, excluir) |
| `comentarios.mjs` | Comentários: painel e `Ctrl+Enter`, ferramenta Comentar (`C`) com ponto exato, pinos no canvas, responder/resolver/reabrir, desfazer, apagar a camada (e desfazer), menu de contexto, nome do autor e recarregar |
| `caneta-icones.mjs` | Novo ícone 24×24 (grade, encaixe de 1px), pontos inteiros ao desenhar, continuar caminho pela ponta, vários pontos (Shift, Ctrl+A), canto/suave, excluir e abrir caminho, extremidade/quina no SVG e colar `d` |
| `caneta-completa.mjs` | Caneta com mouse e teclado de verdade: canto/curva, Alt quebra a simetria, Shift 45°, Backspace, fechar, continuar; edição (clicar no traço, arrastar ponto/alça, modos espelhada/assimétrica/livre, duplo clique, Shift+clique, caixa, setas, Delete, fechar/abrir, inverter, desfazer); lápis com suavização; contorno (tracejado, dentro/fora) no SVG/HTML; booleanas (`CAPTURAS=pasta` salva capturas) |
| `desempenho.mjs` | Tempo por movimento do mouse com N camadas (`node tests/e2e/desempenho.mjs 1000`) |
