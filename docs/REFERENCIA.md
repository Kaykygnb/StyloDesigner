# Referência do código

> **Arquivo gerado** por `scripts/gerar-referencia.mjs` a partir dos comentários do código. **Não edite à mão**:
> mude o comentário no `.js` e rode `npm run docs`. (Os testes avisam se esta página ficou desatualizada.)
>
> Para entender o projeto antes de mergulhar aqui, leia o [Guia do código](GUIA-DO-CODIGO.md) e a [Arquitetura](ARQUITETURA.md).

34 arquivos · 564 funções e constantes documentadas.

Legenda: sem marca = **exportada** (outros arquivos podem importar) · <sub>do módulo</sub> = só usada dentro do arquivo · <sub>interna</sub> = definida dentro de uma fábrica (`createStore`, `createTools`…) e acessível pelo objeto que ela devolve, se estiver na lista de retorno.

## Índice

| Arquivo | O que é |
|---|---|
| [`src/canvas.js`](#srccanvasjs) | Desenha o documento em HTML/CSS + pan, zoom e geometria |
| [`src/commands.js`](#srccommandsjs) | Comandos de edição |
| [`src/components.js`](#srccomponentsjs) | Componentes (principal + instâncias) e estilos compartilhados (módulo puro) |
| [`src/css.js`](#srccssjs) | Camada → CSS / HTML / SVG (módulo puro: sem DOM) |
| [`src/export.js`](#srcexportjs) | Saídas: PNG, SVG, HTML e arquivo de projeto (.json) |
| [`src/fonts.js`](#srcfontsjs) | Fontes do Google Fonts (lista, carregamento sob demanda e prévia) |
| [`src/main.js`](#srcmainjs) | Ponto de entrada: monta o app |
| [`src/model.js`](#srcmodeljs) | Modelo de dados do documento |
| [`src/overlay.js`](#srcoverlayjs) | Interface por cima do canvas (seleção, alças, guias, medidas...) |
| [`src/pen.js`](#srcpenjs) | Ferramenta caneta (vetores) e edição de pontos |
| [`src/present.js`](#srcpresentjs) | Modo apresentar (protótipo em tela cheia) |
| [`src/rulers.js`](#srcrulersjs) | Réguas e criação de guias |
| [`src/sample.js`](#srcsamplejs) | Projeto de exemplo |
| [`src/saving.js`](#srcsavingjs) | Regras de salvamento (navegador + pasta do computador) |
| [`src/storage.js`](#srcstoragejs) | Onde o projeto é guardado: navegador (IndexedDB) e pasta do computador (servidor) |
| [`src/store.js`](#srcstorejs) | Estado central, histórico (desfazer) e salvamento |
| [`src/svg.js`](#srcsvgjs) | Exportação SVG vetorial (módulo puro: sem DOM) |
| [`src/svgimport.js`](#srcsvgimportjs) | Importa SVG como vetores editáveis |
| [`src/thumbnail.js`](#srcthumbnailjs) | Miniatura do projeto (SVG) para a página inicial |
| [`src/tools.js`](#srctoolsjs) | Interação: mouse e teclado no canvas |
| [`src/ui/assets.js`](#srcuiassetsjs) | Aba "recursos" (componentes e estilos) |
| [`src/ui/code.js`](#srcuicodejs) | Aba "código" (CSS e HTML da seleção) |
| [`src/ui/dom.js`](#srcuidomjs) | Criar elementos + componentes de formulário |
| [`src/ui/fontpicker.js`](#srcuifontpickerjs) | Seletor de fontes (Google Fonts + fontes do sistema) |
| [`src/ui/googleicons.js`](#srcuigoogleiconsjs) | Painel "ícones" (Material Symbols, os ícones do Google) |
| [`src/ui/home.js`](#srcuihomejs) | Página inicial (os seus projetos) |
| [`src/ui/icons.js`](#srcuiiconsjs) | Ícones SVG (inline, sem dependências) |
| [`src/ui/layers.js`](#srcuilayersjs) | Painel de páginas e camadas |
| [`src/ui/menus.js`](#srcuimenusjs) | Menus flutuantes, janelas modais e ajuda de atalhos |
| [`src/ui/projects.js`](#srcuiprojectsjs) | Janela "projetos na pasta" (salvar com nome, abrir, versões antigas) |
| [`src/ui/props.js`](#srcuipropsjs) | Painel "design" (propriedades da seleção) |
| [`src/ui/proto.js`](#srcuiprotojs) | Aba "protótipo" (interações entre telas) |
| [`src/ui/settings.js`](#srcuisettingsjs) | Janela "configurações" (onde salvar, versões, cópia no navegador, aparência) |
| [`server.js`](#serverjs) | Servidor local: entrega o app e salva os projetos numa pasta do seu computador |

---

## src/canvas.js

**DESENHA O DOCUMENTO EM HTML/CSS + PAN, ZOOM E GEOMETRIA** · [abrir o código](../src/canvas.js)

```text
 Cada camada vira um <div> real, estilizado pelo CSS que css.js gera. Por isso flexbox, grid, sombras,
 gradientes e blur funcionam "de graça": quem renderiza é o motor do navegador, não código nosso.

 Este módulo é a ÚNICA ponte entre o modelo (dados) e o DOM. Quando precisamos saber "onde a camada está
 de verdade" (ex.: dentro de um auto layout), lemos do DOM aqui, em vez de recalcular layout na mão.
```

- **`MIN_ZOOM`** <sub>do módulo</sub> · [L17](../src/canvas.js#L17) — Limites do zoom: 2% (para ver pranchas enormes) até 6400% (para conferir pixels).
- **`createCanvas(store, viewport)`** · [L35](../src/canvas.js#L35) — Cria o CANVAS: transforma as camadas do documento em elementos HTML reais dentro do `viewport`.

  Estrutura do DOM:
    .viewport  (a janela visível: recorta, recebe mouse/teclado, desenha o fundo pontilhado)
      ├─ .world   (um "mundo" gigante; recebe translate+scale para fazer pan e zoom)
      │    └─ .node  um <div> por camada, estilizado por css.js → nodeStyle (CSS de verdade!)
      └─ .overlay (seleção, alças, guias — criado por overlay.js, em pixels de TELA, fora do zoom)

  Também oferece a GEOMETRIA: onde cada camada está no mundo (lida do DOM, porque em auto layout quem decide a
  posição é o navegador, não o modelo), conversões tela↔mundo, zoom ancorado no cursor e "ajustar à tela".
  - `store` <sub>object</sub> — o store do app
  - `viewport` <sub>HTMLElement</sub> — elemento que vira a janela do canvas
- **`getView()`** <sub>interna</sub> · [L51](../src/canvas.js#L51) — Vista (pan/zoom) da página atual: { x, y, zoom }. x/y = deslocamento do mundo em px de tela. Cada página lembra a sua. `fresh: true` marca "nunca foi ajustada" — o app então faz "ajustar tudo" sozinho.
- **`applyView()`** <sub>interna</sub> · [L54](../src/canvas.js#L54) — Aplica a vista ao DOM: transforma o mundo e faz o fundo pontilhado acompanhar (some quando o zoom é muito baixo).
- **`setView(patch)`** <sub>interna</sub> · [L65](../src/canvas.js#L65) — Atualiza parte da vista ({x, y, zoom}), limitando o zoom ao intervalo permitido, e avisa o app ('view').
- **`zoomAt(newZoom, cx, cy)`** <sub>interna</sub> · [L81](../src/canvas.js#L81) — Muda o zoom MANTENDO O PONTO (cx, cy) parado na tela — é o que faz o zoom "ir para onde o mouse está". Matemática: queremos que o ponto do mundo sob o cursor continue sob o cursor, então deslocamos x/y na proporção da mudança.
  - `newZoom` <sub>number</sub> — zoom desejado (1 = 100%)
  - `cx` <sub>number</sub> — x do ponto fixo, em px relativos ao viewport
  - `cy` <sub>number</sub> — y do ponto fixo
- **`vpRect()`** <sub>interna</sub> · [L88](../src/canvas.js#L88) — Retângulo do viewport na tela (px da janela do navegador).
- **`toWorld(clientX, clientY)`** <sub>interna</sub> · [L90](../src/canvas.js#L90) — Converte um ponto da TELA (clientX/clientY de um evento) para coordenadas do MUNDO (as do documento).
- **`toScreen(wx, wy)`** <sub>interna</sub> · [L96](../src/canvas.js#L96) — Converte coordenadas do MUNDO para px relativos ao viewport (o oposto de toWorld).
- **`originOf(id)`** <sub>interna</sub> · [L107](../src/canvas.js#L107) — Origem (canto superior esquerdo, sem rotação) da camada em coordenadas do mundo. Soma offsetLeft/offsetTop subindo a cadeia de pais posicionados — esses valores ignoram transform, então não são afetados por rotação/zoom. É por LER o DOM (e não o modelo) que isso também funciona em flex/grid.
- **`ancestorRotated(id)`** <sub>interna</sub> · [L119](../src/canvas.js#L119) — Algum ancestral está rotacionado? (Nesse caso a soma de offsets deixa de valer e usamos o retângulo envolvente.)
- **`worldBox(id)`** <sub>interna</sub> · [L129](../src/canvas.js#L129) — Caixa da camada no mundo: { x, y, w, h, cx, cy, rot } — centro, tamanho e a rotação PRÓPRIA da camada. É o que o overlay usa para desenhar a seleção girada. Se um ancestral está girado, devolve o retângulo envolvente com rot=0 (simplificação aceita).
- **`aabb(id)`** <sub>interna</sub> · [L146](../src/canvas.js#L146) — AABB = retângulo envolvente alinhado aos eixos (considera rotação), em coordenadas do mundo. Calculado com getBoundingClientRect, que já inclui qualquer transform. Usado em snap, alinhar, marquee e medidas.
- **`unionAabb(ids)`** <sub>interna</sub> · [L156](../src/canvas.js#L156) — Menor retângulo que envolve as AABBs de várias camadas (ou null se nenhuma existir).
- **`ensureVisible(id)`** <sub>interna</sub> · [L168](../src/canvas.js#L168) — Rola a vista só o necessário para a camada ficar visível (com 60px de folga), sem mexer no zoom. Usado pelo Tab.
- **`fit(ids, { maxZoom = 2, padding = 80 } = {})`** <sub>interna</sub> · [L187](../src/canvas.js#L187) — "Ajustar à tela": enquadra as camadas dadas (ou todas, se vazio) no centro do viewport.
  - `[ids]` <sub>string[]</sub> — camadas a enquadrar; vazio/null = todas as da página
- **`syncNode(node, parent, parentEl, index)`** <sub>interna</sub> · [L213](../src/canvas.js#L213) — Sincroniza UMA camada (e, recursivamente, os filhos) com o DOM: cria o elemento se não existe, atualiza o estilo, o texto e a posição na lista de irmãos. É um "diff" simples: só toca no DOM quando algo mudou (comparamos o CSS novo com o último aplicado, guardado em `el._css` — ler `style.cssText` seria caro).
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai (decide se é item de flex/grid)
  - `parentEl` <sub>HTMLElement</sub> — elemento DOM do pai
  - `index` <sub>number</sub> — posição desejada entre os irmãos (a ordem do array é a ordem z)
- **`measureBack(list, parent)`** <sub>interna</sub> · [L265](../src/canvas.js#L265) — "Medida de volta": para camadas com tamanho 'hug'/'fill' (ou dentro de auto layout), o tamanho real só o navegador sabe. Lemos offsetWidth/Height e gravamos em node.w/h, para o painel, o SVG e o 'ajustar' mostrarem o tamanho verdadeiro. Não cria entrada no histórico (é dado derivado).
- **`render()`** <sub>interna</sub> · [L289](../src/canvas.js#L289) — Desenha a página atual: sincroniza todas as camadas, remove elementos órfãos (camada apagada ou de outra página), mede de volta os tamanhos e, se há texto em edição, dá foco e seleciona o conteúdo.

---

## src/commands.js

**COMANDOS DE EDIÇÃO** · [abrir o código](../src/commands.js)

```text
 Tudo o que o usuário "faz" com camadas e que vai além de arrastar: excluir, duplicar, copiar/colar,
 agrupar, auto layout, alinhar, distribuir, ordem z, componentes, máscara, guias, vetores, imagens.
 Atalhos (tools.js), menus (ui/menus.js) e painéis (ui/*.js) chamam estas funções — a lógica não se repete.
```

- **`createCommands(store, canvas)`** · [L28](../src/commands.js#L28) — Cria os COMANDOS de edição: operações que mudam a ÁRVORE de camadas ou várias camadas de uma vez (excluir, duplicar, copiar/colar, agrupar, ordem z, auto layout, alinhar, distribuir, componentes, máscara, guias, vetores, imagens). É chamado por atalhos de teclado (tools.js), menus (menus.js) e painéis (ui/*.js), então a lógica fica em UM lugar só.

  Padrão de todo comando: (1) descobre as camadas-alvo, (2) `store.update(...)` aplica a mudança, (3) ajusta a
  seleção, (4) `store.commit()` grava no histórico (um desfazer desfaz o comando inteiro).
  - `store` <sub>object</sub> — 
  - `canvas` <sub>object</sub> — precisa da geometria do DOM (posições reais em auto layout)
- **`topSelection()`** <sub>interna</sub> · [L36](../src/commands.js#L36) — Seleção "de topo": camadas selecionadas que NÃO têm um ancestral também selecionado. Se você seleciona um frame e um filho dele, mover/duplicar/excluir deve agir só no frame (o filho vai junto).
- **`parentOrigin(parent)`** <sub>interna</sub> · [L45](../src/commands.js#L45) — Origem (canto superior esquerdo, no mundo) do pai; (0,0) quando a camada está na raiz da página.
- **`freezePositions(nodes, parent)`** <sub>interna</sub> · [L52](../src/commands.js#L52) — "Congela" a posição VISUAL atual como x/y. Em auto layout x/y do modelo são ignorados (o navegador posiciona), então, antes de uma camada sair do fluxo (agrupar, desligar auto layout...), lemos onde ela está no DOM e gravamos em x/y — assim nada "pula" de lugar.
- **`deleteSelection()`** <sub>interna</sub> · [L63](../src/commands.js#L63) — Exclui as camadas selecionadas (e tudo dentro delas).
- **`duplicate()`** <sub>interna</sub> · [L78](../src/commands.js#L78) — Duplica a seleção logo acima do original, deslocada 20px (em auto layout entra no fluxo, sem deslocar).
- **`copy()`** <sub>interna</sub> · [L103](../src/commands.js#L103) — Copia a seleção para a área de transferência INTERNA do app (ui.clipboard). Guardamos uma cópia JSON, assim ela sobrevive mesmo que o original seja editado/apagado depois. Devolve false se não havia nada selecionado.
- **`cut()`** <sub>interna</sub> · [L115](../src/commands.js#L115) — Recortar = copiar + excluir.
- **`paste()`** <sub>interna</sub> · [L125](../src/commands.js#L125) — Cola o que está na área de transferência interna.

   - Com UM frame selecionado (que não seja o próprio copiado): cola DENTRO dele, mantendo a posição se couber
     ou centralizando se não couber.
   - Caso contrário: cola no mesmo pai de onde foi copiado, deslocando 16px a cada colagem seguida.
- **`setSelectionBox({ x, y, w, h })`** <sub>interna</sub> · [L168](../src/commands.js#L168) — Move e/ou redimensiona várias camadas como UM conjunto, pelos campos X/Y/W/H do painel. Cada campo é opcional. Mudar W/H escala cada camada e a distância dela até a borda do conjunto (como esticar a caixa de seleção). Camadas dentro de auto layout só mudam de tamanho (a posição é do navegador). `structural:false`: só números mudam, o índice do store continua válido (mais rápido).
- **`STYLE_KEYS`** <sub>interna</sub> · [L196](../src/commands.js#L196) — "Copiar propriedades" (Ctrl+Alt+C / Ctrl+Alt+V), como "copiar formato" do Word: leva só a APARÊNCIA (preenchimento, contorno, cantos, sombras, blur, opacidade, mesclagem) e, se a origem é texto, também a tipografia.
- **`copyStyle()`** <sub>interna</sub> · [L200](../src/commands.js#L200) — Guarda a aparência da 1ª camada selecionada em ui.styleClipboard.
- **`pasteStyle()`** <sub>interna</sub> · [L213](../src/commands.js#L213) — Aplica a aparência guardada a todas as camadas selecionadas, ignorando o que não faz sentido para o tipo do destino (ex.: tipografia em retângulo, cantos em elipse/texto, fill em grupo).
- **`group()`** <sub>interna</sub> · [L237](../src/commands.js#L237) — Agrupa as camadas selecionadas (Ctrl+G). Só agrupa irmãs do MESMO pai (a 1ª selecionada manda). O grupo entra na posição da camada mais alta e os filhos mantêm a ordem z. Antes, congela as posições (ver freezePositions). A caixa do grupo é calculada depois, no commit, por fitGroups.
- **`ungroup()`** <sub>interna</sub> · [L260](../src/commands.js#L260) — Desagrupa (Ctrl+Shift+G): os filhos sobem um nível, no lugar do grupo, mantendo a posição visual (somamos x/y do grupo). Funciona em grupos e em frames comuns; componentes/instâncias são ignorados.
- **`reorder(mode)`** <sub>interna</sub> · [L287](../src/commands.js#L287) — Muda a ordem z (quem fica na frente). A ordem do array É a ordem de desenho: o último é o que fica por cima.
  - `mode` <sub>'front'\|'back'\|'forward'\|'backward'</sub> — frente / fundo / um passo à frente / um passo atrás
- **`enableAutoLayout(frame)`** <sub>interna</sub> · [L321](../src/commands.js#L321) — Liga o auto layout num frame que tinha filhos livres, DEDUZINDO a configuração a partir de onde eles estão, para nada "pular" de lugar:

   - direção: filhos espalhados mais na horizontal → 'row'; senão 'column'. Um filho só: frame alto (ex.: uma
     sidebar) → 'column'; largo → 'row';
   - gap: média dos vãos entre filhos consecutivos;
   - padding: distância entre os filhos e as bordas. Mas se o conteúdo está encostado no início e sobra MUITO
     espaço no fim (ex.: um item no topo de uma sidebar), essa sobra é espaço livre, não margem: o padding do fim
     fica igual ao do início (senão um padding-bottom de 500px espremeria os próximos itens);
   - alinhamento: conteúdo centralizado no frame → 'center'; encostado no fim → 'flex-end'. No eixo cruzado, com
     vários filhos, olha se eles estavam alinhados pelo início, pelo centro ou pelo fim.
  Também reordena os filhos na ordem em que aparecem na tela, e tira o "absoluto" de todos.
- **`disableAutoLayout(frame)`** <sub>interna</sub> · [L369](../src/commands.js#L369) — Desliga o auto layout congelando as posições atuais (nada muda visualmente).
- **`setLayoutMode(frames, mode)`** <sub>interna</sub> · [L379](../src/commands.js#L379) — Troca o modo do layout (none | row | column | grid). Ao LIGAR numa frame livre, deduz a configuração (enableAutoLayout); ao DESLIGAR, congela as posições. Em grid, sugere um nº de colunas pela raiz da qtd de filhos. Chamado de dentro de `store.update`, por isso não faz commit.
- **`toggleAutoLayout()`** <sub>interna</sub> · [L409](../src/commands.js#L409) — Shift+A — "Adicionar auto layout", tentando entender a INTENÇÃO (como no Figma), em vez de só embrulhar:

   - FRAME selecionado → liga/desliga o auto layout dele;
   - um RETÂNGULO sozinho → ele VIRA um frame com auto layout (mesma cor, cantos, contorno, sombra e id), pronto
     para receber camadas. Embrulhar um retângulo num frame não serviria para nada: retângulo não tem filhos;
   - um GRUPO → o grupo vira o frame (os filhos dele são os itens do layout);
   - várias camadas → um frame novo envolve todas. Se a camada MAIS AO FUNDO for um retângulo que contém todas as
     outras (ex.: o fundo de uma sidebar com itens em cima), ele vira o FUNDO do frame em vez de mais um item —
     senão o auto layout colocaria o fundo e os itens lado a lado. Sem fundo, o frame abraça o conteúdo (hug).
- **`frameFrom(r, props)`** <sub>interna</sub> · [L422](../src/commands.js#L422) — Frame com a APARÊNCIA de um retângulo (para o retângulo "virar" o frame).
- **`shift(node, dx, dy)`** <sub>interna</sub> · [L482](../src/commands.js#L482) — Soma dx/dy à posição x/y da camada (arredondando).
- **`align(kind)`** <sub>interna</sub> · [L492](../src/commands.js#L492) — Alinha a seleção. Com UMA camada, alinha dentro do pai; com várias, alinha entre si (pela caixa do conjunto). Camadas em auto layout são ignoradas (o navegador decide a posição delas).
  - `kind` <sub>'left'\|'hcenter'\|'right'\|'top'\|'vcenter'\|'bottom'</sub> — 
- **`distribute(axis)`** <sub>interna</sub> · [L523](../src/commands.js#L523) — Distribui 3+ camadas com vãos IGUAIS entre elas, mantendo a primeira e a última no lugar.
  - `axis` <sub>'h'\|'v'</sub> — horizontal ou vertical
- **`reparent(nodes, newParent, index = null)`** <sub>interna</sub> · [L556](../src/commands.js#L556) — Move camadas para outro pai (ou para a raiz da página) MANTENDO a posição visual: lê a origem de cada uma no DOM antes e recalcula x/y relativo ao novo pai. Usado ao arrastar para dentro de frames e no arrastar da lista de camadas. Não deixa mover uma camada para dentro de si mesma/de um descendente.
  - `nodes` <sub>object[]</sub> — camadas a mover
  - `newParent` <sub>object\|null</sub> — novo pai (null = raiz)
  - `[index]` <sub>number\|null</sub> — posição na lista do novo pai (null = no topo)
- **`importAsset(file)`** <sub>interna</sub> · [L584](../src/commands.js#L584) — Lê o arquivo de imagem (reduzindo se for grande), guarda em doc.assets e devolve { assetId, w, h }.
- **`addImageFiles(files, at)`** <sub>interna</sub> · [L596](../src/commands.js#L596) — Cria uma camada-retângulo com preenchimento de imagem para cada arquivo (botão, arrastar, colar). A imagem é reduzida para caber em 520px de maior lado e fica centralizada na posição `at` (ou no centro da vista).
  - ↩︎ `Promise<boolean>` true se criou alguma camada
- **`notify(msg)`** <sub>interna</sub> · [L633](../src/commands.js#L633) — Mostra um aviso ao usuário (main.js liga em `commands.notify = toast`).
- **`placeNew(node, at)`** <sub>interna</sub> · [L639](../src/commands.js#L639) — Insere uma camada NOVA já pronta: dentro do frame selecionado (centralizada nele; se o frame tem auto layout, ela entra no fluxo) ou na raiz da página, centralizada em `at` (mundo) ou no meio da tela. Seleciona e grava.
- **`insertSvg(text, { at, name, currentColor, fill, size } = {})`** <sub>interna</sub> · [L666](../src/commands.js#L666) — Importa um SVG (texto) como vetores editáveis e insere (ver placeNew). Avisa O QUE do SVG ficou de fora (ex.: "sombra interna, máscara"). Lança erro se o texto não for um SVG com formas.
  - `text` <sub>string</sub> — 
- **`addText(textValue, at)`** <sub>interna</sub> · [L674](../src/commands.js#L674) — Cria uma camada de texto com o texto dado (usado ao colar texto do sistema no canvas).
- **`wrapInFrame(same, name)`** <sub>interna</sub> · [L690](../src/commands.js#L690) — Envolve camadas irmãs num frame novo (sem layout, sem preenchimento) do tamanho do conjunto. Base de "Envolver em frame", "Criar componente" de vários itens e "Auto layout" de vários itens. Deve ser chamada dentro de `store.update`.
- **`sameLevel(nodes)`** <sub>interna</sub> · [L706](../src/commands.js#L706) — Filtra a seleção para as camadas que estão na mesma lista que a primeira (irmãs), ordenadas pela ordem z.
- **`createComponent()`** <sub>interna</sub> · [L715](../src/commands.js#L715) — Ctrl+Alt+K: transforma a seleção em COMPONENTE PRINCIPAL. Várias camadas (ou texto/linha soltos) são primeiro envolvidas num frame, porque componente precisa de uma raiz.
- **`insertInstance(mainId, at)`** <sub>interna</sub> · [L736](../src/commands.js#L736) — Cria uma INSTÂNCIA de um componente. Sem posição dada, entra ao lado do principal; com `at`, centralizada ali (usado ao clicar no componente na aba Recursos).
  - `mainId` <sub>string</sub> — id do componente principal
- **`detach()`** <sub>interna</sub> · [L757](../src/commands.js#L757) — Ctrl+Alt+B: desanexa as instâncias selecionadas (viram camadas comuns).
- **`goToMain(id)`** <sub>interna</sub> · [L764](../src/commands.js#L764) — "Ir ao principal": abre a página do componente principal, seleciona e enquadra.
- **`toggleMask()`** <sub>interna</sub> · [L779](../src/commands.js#L779) — Ctrl+Alt+M: máscara. Com várias camadas: agrupa e usa a de baixo como máscara (recorta as outras, via clip-path). Com uma camada que já está num grupo: liga/desliga o papel de máscara dela.
- **`flip(axis)`** <sub>interna</sub> · [L794](../src/commands.js#L794) — Espelha as camadas selecionadas na horizontal ('x') ou vertical ('y').
- **`addColorStyle(node, name)`** <sub>interna</sub> · [L803](../src/commands.js#L803) — Cria um estilo de cor compartilhado a partir do preenchimento de uma camada e já liga a camada a ele.
- **`addTextStyle(node, name)`** <sub>interna</sub> · [L811](../src/commands.js#L811) — Cria um estilo de texto compartilhado a partir da tipografia de uma camada e já liga a camada a ele.
- **`removeStyle(kind, id)`** <sub>interna</sub> · [L819](../src/commands.js#L819) — Apaga um estilo ('colors' ou 'texts'); as camadas ligadas mantêm os valores que tinham.
- **`guides()`** <sub>interna</sub> · [L828](../src/commands.js#L828) — Lista de guias da página atual (cria se não existir, para páginas de projetos antigos).
- **`addGuide(axis, pos)`** <sub>interna</sub> · [L830](../src/commands.js#L830) — Cria uma guia de régua. axis 'x' = linha vertical na posição x; 'y' = linha horizontal na posição y.
- **`removeGuide(i)`** <sub>interna</sub> · [L834](../src/commands.js#L834) — Remove a guia de índice `i`.
- **`addPathFromWorld(pts, closed, parent)`** <sub>interna</sub> · [L846](../src/commands.js#L846) — Cria uma camada-vetor a partir de pontos em coordenadas do MUNDO (o que a caneta coleta). Calcula a caixa que envolve o desenho (incluindo as curvas) e converte os pontos para o espaço local do vetor.
  - `[]` <sub>{x,y,hin?,hout?</sub> — } pts  pontos com alças opcionais
  - `closed` <sub>boolean</sub> — caminho fechado (ganha preenchimento cinza)
  - `parent` <sub>object\|null</sub> — frame onde inserir (null = raiz)
- **`updatePathFromWorld(id, pts, closed)`** <sub>interna</sub> · [L867](../src/commands.js#L867) — Atualiza um vetor EXISTENTE com novos pontos (em coordenadas do mundo): usado ao CONTINUAR um caminho aberto com a caneta. Como addPathFromWorld, recalcula a caixa; nome, cor e contorno do vetor continuam.
- **`newIcon(size = 24)`** <sub>interna</sub> · [L890](../src/commands.js#L890) — Cria um frame de ÍCONE (24×24 por padrão, fundo branco, cortando o que sai) no centro da vista, com a grade de 1px ligada, enquadra com zoom grande, liga o encaixe de 1px e deixa a caneta pronta. É o começo de "desenhar o meu SVG".
- **`normalizePath(node)`** <sub>interna</sub> · [L914](../src/commands.js#L914) — Reajusta a caixa do vetor depois de editar pontos: recalcula o retângulo que envolve o desenho e desloca os pontos/posição para a caixa "colar" no desenho. Pula se o vetor está girado (a conta ficaria imprecisa).
- **`addShapePath(kind, box, parent, sides = 5)`** <sub>interna</sub> · [L939](../src/commands.js#L939) — Cria um polígono regular (`sides` lados) ou estrela (pontas alternando raio 100% e 45%) já como vetor editável.
  - `kind` <sub>'polygon'\|'star'</sub> — 
- **`localBox(node)`** <sub>interna</sub> · [L955](../src/commands.js#L955) — Caixa da camada relativa ao PAI, medida no DOM (respeita flexbox/grid). Usada pela exportação SVG.
- **`frameSelection()`** <sub>interna</sub> · [L964](../src/commands.js#L964) — Ctrl+Alt+G: envolve a seleção num frame novo, sem layout.
- **`cssOf(nodes)`** <sub>interna</sub> · [L975](../src/commands.js#L975) — CSS (só o CSS, sem HTML) das camadas dadas — usado por "Copiar CSS".
- **`readImage(file)`** <sub>do módulo</sub> · [L997](../src/commands.js#L997) — Lê um arquivo de imagem e devolve { dataUrl, w, h }. Imagens grandes (>1600px ou >400KB) são redesenhadas num <canvas> menor: o projeto inteiro é regravado a cada mudança (navegador e pasta), então imagem enorme deixaria o salvamento lento e o .json gigante. PNG continua PNG (preserva transparência); o resto vira JPEG 88%.
- **`pathBounds(pts, closed = false)`** · [L1030](../src/commands.js#L1030) — Retângulo { x0, y0, x1, y1 } que envolve TODOS os pontos e também as curvas de Bézier (amostradas a cada 5%), já que uma curva pode "sair" para fora dos pontos de ancoragem.
  - `[]` <sub>{x,y,hin?,hout?</sub> — } pts
  - `[closed]` <sub>boolean</sub> — considera o segmento de volta ao primeiro ponto

---

## src/components.js

**COMPONENTES (PRINCIPAL + INSTÂNCIAS) E ESTILOS COMPARTILHADOS   (módulo puro)** · [abrir o código](../src/components.js)

```text
 COMO FUNCIONA UM COMPONENTE
   - O "principal" é uma camada marcada com `component: true`.
   - Uma "instância" é uma cópia dele que guarda `instanceOf` (id do principal) e `base`, uma FOTO de como a
     instância estava na última sincronização.
   - A cada commit comparamos a instância atual com `base`: o que for diferente é uma SOBRESCRITA do usuário
     (ex.: ele trocou o texto do botão). Aí reconstruímos a instância a partir do principal e reaplicamos as
     sobrescritas por cima.
   RESULTADO: mexeu no principal → todas as instâncias atualizam; mas o texto/cor que você personalizou
   numa instância continua lá.

 ESTILOS COMPARTILHADOS
   Estilos de cor e de texto vivem em doc.styles. Camadas ligadas a um estilo copiam os valores dele a cada commit.

 Testado em tests/features.test.js (sem navegador).
```

- **`OVERRIDE_PROPS`** · [L28](../src/components.js#L28) — Quais propriedades de uma camada FILHA podem ser sobrescritas dentro de uma instância (texto, cor, tamanho, visibilidade...). Propriedades que não estão aqui (ex.: nome, id, constraints) sempre vêm do principal.
- **`ROOT_KEYS`** <sub>do módulo</sub> · [L38](../src/components.js#L38) — Propriedades da RAIZ da instância que vêm do principal. `x` e `y` ficam de fora: cada instância tem a sua própria posição no canvas. (O nome também é da instância.)
- **`pick(node, keys)`** <sub>do módulo</sub> · [L41](../src/components.js#L41) — Copia só as chaves pedidas (cópia profunda). Ex.: pick(no, ['fill','opacity']).
- **`diff(cur, base)`** <sub>do módulo</sub> · [L48](../src/components.js#L48) — Devolve só as chaves em que `cur` difere de `base`. É assim que detectamos o que o usuário SOBRESCREVEU.
- **`isEmpty(o)`** <sub>do módulo</sub> · [L57](../src/components.js#L57) — Objeto sem nenhuma chave?
- **`contains(root, id)`** <sub>do módulo</sub> · [L60](../src/components.js#L60) — `id` está dentro de `root` (em qualquer profundidade)? Usado para detectar ciclo (instância dentro do próprio principal).
- **`collectMains(pages)`** <sub>do módulo</sub> · [L67](../src/components.js#L67) — Mapa id → componente principal de todas as páginas (um componente pode ser usado em outra página).
- **`syncOne(inst, main)`** <sub>do módulo</sub> · [L82](../src/components.js#L82) — Atualiza UMA instância a partir do principal, preservando as sobrescritas do usuário. Passos:

    0. Descobre as sobrescritas: compara a instância atual com `inst.base` (a foto da última sincronização).
    1. Reconstrói os filhos como cópia do principal. Cada filho ganha id estável `<idDaInstancia>~<idOriginal>` e
       guarda `srcId` (o id no principal) — ids estáveis mantêm a seleção e o histórico funcionando.
    2. Reaplica as sobrescritas da raiz e as constraints se a instância foi redimensionada.
    3. Tira uma foto nova (`base`) do estado "puro do principal" e reaplica as sobrescritas dos filhos.
  Se o principal sumiu (ou há ciclo), a instância vira uma camada comum.
- **`syncInstances(pages)`** · [L143](../src/components.js#L143) — Sincroniza TODAS as instâncias de TODAS as páginas com seus principais. Chamada a cada commit do store, então editar o componente principal atualiza as instâncias na hora, sem ninguém pedir.
- **`makeComponent(node)`** · [L154](../src/components.js#L154) — Marca uma camada como COMPONENTE PRINCIPAL. Instâncias que estivessem dentro dela viram camadas comuns (não suportamos componente dentro de componente, para evitar ciclos).
- **`createInstance(main, pages)`** · [L169](../src/components.js#L169) — Cria uma instância de `main` já preenchida (filhos copiados). Os filhos são montados por syncInstances, por isso passamos uma "página falsa" contendo só a instância nova.
  - `main` <sub>object</sub> — componente principal
  - `pages` <sub>object[]</sub> — páginas do documento (para achar o principal)
- **`detachInstance(inst)`** · [L182](../src/components.js#L182) — "Desanexar": a instância vira uma camada comum, sem ligação com o principal (os filhos mantêm a aparência atual).
- **`TEXT_STYLE_KEYS`** <sub>do módulo</sub> · [L190](../src/components.js#L190) — Campos de tipografia que um ESTILO DE TEXTO controla.
- **`textStyleFrom(node)`** · [L193](../src/components.js#L193) — Extrai de uma camada de texto os campos de tipografia (para criar um estilo de texto a partir dela).
- **`syncStyles(doc)`** · [L199](../src/components.js#L199) — Propaga os estilos compartilhados: toda camada ligada a um estilo (fill.styleId / textStyleId) recebe os valores atuais dele. Se o estilo foi apagado, o vínculo é removido e a camada mantém os últimos valores.

---

## src/css.js

**CAMADA → CSS / HTML / SVG   (módulo puro: sem DOM)** · [abrir o código](../src/css.js)

```text
 O QUE É
   Converte as camadas do documento em CSS real. É a peça que faz o projeto cumprir a promessa
   "o canvas é CSS de verdade": o canvas, o painel Código e a exportação HTML/PNG usam EXATAMENTE
   as mesmas funções daqui, então não existe diferença entre o que você vê e o que é exportado.

 PRINCIPAIS FUNÇÕES
   nodeStyle(node, parent)      → objeto { propriedade-css: valor } de uma camada
   generateCode(nodes, parent)  → { html, css } com classes legíveis (aba "Código")
   exportHtml(node)             → documento HTML completo e standalone
   pathSvg / pathData           → markup SVG dos vetores (caneta)
   maskClip                     → clip-path das máscaras

 DECISÕES IMPORTANTES
   - Contorno usa `outline` (não border) para não alterar o layout.
   - Auto layout é flexbox/grid de verdade: o navegador calcula as posições; o editor só LÊ o
     resultado do DOM (ver canvas.js → measureBack).
   - Funções puras: dão para testar no Node (tests/css.test.js).
```

- **`px(v)`** <sub>do módulo</sub> · [L29](../src/css.js#L29) — Formata um número como pixels CSS, arredondado: px(10.004) → "10px".
- **`GRID_ALIGN`** <sub>do módulo</sub> · [L35](../src/css.js#L35) — Tradução dos valores de alinhamento do flexbox (usados no modelo, ex. 'flex-start') para os do CSS Grid ('start'). O grid não aceita 'flex-start' em justify-items/align-items. 'auto' (ou valor desconhecido) fica de fora: o item herda o alinhamento do grid pai.
- **`hexToRgb(hex)`** · [L41](../src/css.js#L41) — Converte uma cor hexadecimal ("#RGB" ou "#RRGGBB") em { r, g, b } (0..255). Entrada inválida vira preto em vez de lançar erro, para o app nunca travar por causa de uma cor ruim.
- **`rgba(hex, a = 1)`** · [L54](../src/css.js#L54) — Monta a cor CSS final. Opacidade total (>= 1) devolve o hex curto "#rrggbb"; menor que 1 devolve "rgba(r, g, b, a)". Assim o código gerado fica o mais limpo possível.
  - `hex` <sub>string</sub> — cor base
  - `[a=1]` <sub>number</sub> — opacidade 0..1
- **`stopsCss(stops)`** <sub>do módulo</sub> · [L61](../src/css.js#L61) — Lista de paradas de gradiente em CSS, ordenada por posição: "#7c5cff 0%, #2dd4ff 100%".
- **`fillCss(fill, assets = {})`** · [L77](../src/css.js#L77) — Propriedades CSS de um PREENCHIMENTO (fill). Devolve um objeto { propriedade: valor }.

   - solid  → background-color
   - linear → background-image: linear-gradient(...)
   - radial → background-image: radial-gradient(...)
   - image  → background-image: url(data:...) + size/position/repeat (se a imagem não existir mais, cinza neutro)
   - none   → nada
  - `fill` <sub>object</sub> — preenchimento (ver model.js → defaultFill)
  - `[assets]` <sub>Object<string,string></sub> — doc.assets: id → data URL das imagens
- **`fontStack(family)`** <sub>do módulo</sub> · [L106](../src/css.js#L106) — Monta a lista de fontes com alternativas: 'Inter', system-ui, sans-serif. Se o usuário já digitou uma lista (com vírgula), respeita.
- **`nodeStyle(node, parent, assets = {}, opts = {})`** · [L120](../src/css.js#L120) — ★ O CORAÇÃO DO PROJETO ★ — converte UMA camada em CSS. O mesmo resultado é usado em 3 lugares: (1) o canvas (cada camada é um elemento com este estilo), (2) o painel "Código" e (3) a exportação HTML/PNG. Por isso o que você vê no editor é o que o navegador renderiza de verdade.
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai (decide se a camada está em fluxo de flex/grid ou é absoluta)
  - `[assets]` <sub>Object<string,string></sub> — imagens do documento
  - ↩︎ `Object<string,string>` propriedades CSS em ordem de inserção (kebab-case)
- **`marginCss(node, s)`** <sub>do módulo</sub> · [L328](../src/css.js#L328) — Margem de um item EM FLUXO (flex/grid): atalho `margin` com 1 valor (todos iguais) ou 4 (topo direita baixo esquerda). Só aparece quando algum lado não é zero. Altera `s` diretamente. Camadas livres (position:absolute) não usam margem: a posição delas já é o left/top.
- **`COLOR_FILTERS`** <sub>do módulo</sub> · [L335](../src/css.js#L335) — Funções de filtro de COR da camada, na ordem do CSS, só as que fogem do padrão: brightness, contrast, saturate, grayscale, hue-rotate.
- **`colorFilters(node)`** · [L336](../src/css.js#L336) — _(sem comentário)_
- **`truncateCss(node, s)`** <sub>do módulo</sub> · [L352](../src/css.js#L352) — Truncar texto (campo `truncate`). Altera `s` diretamente; vale DEPOIS do alinhamento vertical e do white-space.

   - 'ellipsis': uma linha só, o que não cabe vira "…"  → white-space:nowrap + overflow:hidden + text-overflow:ellipsis
   - 'clamp': no máximo `lines` linhas, com "…" no fim → display:-webkit-box + -webkit-line-clamp (e line-clamp)
  Os dois precisam de uma LARGURA (fixa ou máxima) para saber onde cortar. O alinhamento vertical por grid
  (centro/fim) é desligado, porque o grid e o -webkit-box/ellipsis não funcionam juntos.
- **`sizeLimitsCss(node, s)`** <sub>do módulo</sub> · [L377](../src/css.js#L377) — Limites de tamanho e proporção da camada. Altera `s` diretamente. Ficam DEPOIS do tamanho, então `min-width` substitui o `min-width: 0` que o item "fill" de um flex escreve sozinho.

   - min-/max-width/height: só aparecem quando o usuário define (campos minW, maxW, minH, maxH).
   - aspect-ratio: só quando ALGUMA medida é flexível (hug/fill). A medida fixa vira `auto` no eixo oposto para a
     proporção valer (com as duas fixas o CSS ignoraria o aspect-ratio, e quem mantém a proporção é o editor).
- **`transformOf(node)`** · [L397](../src/css.js#L397) — Junta rotação e espelhamento numa única propriedade `transform`. Ordem: rotate primeiro, depois scale. Devolve '' quando não há nada a aplicar (assim o CSS gerado não ganha `transform` à toa).
- **`lineStyle(node, s, flow)`** <sub>do módulo</sub> · [L410](../src/css.js#L410) — Estilo da LINHA. Em vez de border ou SVG, a linha é uma caixa de ≥12px de altura com um `background` que desenha uma barra de `stroke.width` px no meio: sólida (linear-gradient), tracejada (gradiente repetido) ou pontilhada (radial-gradient repetido). Os 12px de altura só existem para facilitar clicar nela. Altera `s` diretamente.
- **`hasStrokeSides(node)`** · [L442](../src/css.js#L442) — A camada usa contorno POR LADO? (`stroke.sides` = [cima, direita, baixo, esquerda] em px). Só retângulos, frames e grupos de imagem — em elipse, texto e vetor "lado" não faz sentido.
- **`num(n)`** <sub>do módulo</sub> · [L447](../src/css.js#L447) — Arredonda para 2 casas (coordenadas de SVG).
- **`pathData(points, closed, tx = (x) => x, ty = (y) => y)`** · [L457](../src/css.js#L457) — Gera o atributo `d` de um <path> SVG a partir dos pontos do vetor. Segmento reto quando nenhum dos dois pontos tem alça (comando L); curva de Bézier cúbica quando algum tem (C).
  - `[]` <sub>{x:number,y:number,hin?:object,hout?:object</sub> — } points  pontos; hin/hout = alças de entrada/saída
  - `closed` <sub>boolean</sub> — fecha o caminho com Z (liga o último ao primeiro)
  - `[tx]` <sub>(x:number)=>number</sub> — transformação opcional de x (usada pelo clip-path e pelo SVG exportado)
  - `[ty]` <sub>(y:number)=>number</sub> — idem para y
- **`nodePathData(node, tx, ty)`** · [L479](../src/css.js#L479) — `d` COMPLETO de um vetor: o contorno principal (`points`) + os contornos extras (`contours`), se houver. Contornos extras existem em desenhos importados de SVG (ícones com "furos", letras como "o", várias formas num só vetor). A regra de preenchimento (`fillRule`: 'nonzero' | 'evenodd') decide o que vira furo.
  - `node` <sub>object</sub> — camada do tipo 'path'
  - `[tx]` <sub>(x:number)=>number</sub> — 
  - `[ty]` <sub>(y:number)=>number</sub> — 
- **`svgPaint(fill, id, assets)`** <sub>do módulo</sub> · [L493](../src/css.js#L493) — Preenchimento de um vetor em SVG. Gradientes precisam de uma definição (<linearGradient>) referenciada por url(#id); devolve { paint (valor do atributo fill), defs (markup das definições), opacity }. O ângulo CSS (0° = para cima) é convertido em x1,y1→x2,y2 do SVG (0..1).
- **`pathSvg(node, assets = {})`** · [L516](../src/css.js#L516) — Markup <svg> de um nó `path` (usado no canvas, no HTML exportado e no modo apresentar).

   - preserveAspectRatio="none": o desenho estica junto com a caixa da camada.
   - vector-effect="non-scaling-stroke": a espessura do traço NÃO muda ao esticar.
   - 2º <path> transparente e grosso (stroke-width 12): serve só de "área de clique" para linhas finas.
- **`maskClip(group)`** · [L539](../src/css.js#L539) — Converte a camada marcada como máscara (`isMask`) do grupo em um `clip-path` CSS: elipse → ellipse(), vetor → path(), retângulo → inset() (com cantos arredondados se houver). Devolve '' se o grupo não tem máscara.
- **`toCssText(style)`** · [L556](../src/css.js#L556) — Objeto de estilo → texto para `element.style.cssText` ("a:1;b:2").
- **`cssRule(selector, style, indent = '')`** · [L562](../src/css.js#L562) — Objeto de estilo → regra CSS legível com uma propriedade por linha (usada no painel Código e no HTML exportado).
- **`makeClassNamer()`** <sub>do módulo</sub> · [L573](../src/css.js#L573) — Cria um gerador de nomes de classe únicos a partir do nome da camada: "Botão" → "botao", e a segunda camada com o mesmo nome vira "botao-2". Um gerador novo por exportação garante nomes estáveis e sem colisão.
- **`escapeHtml(s)`** <sub>do módulo</sub> · [L584](../src/css.js#L584) — Escapa & < > " para que texto digitado pelo usuário nunca vire HTML/atributo no código exportado.
- **`generateCode(nodes, parent, assets = {}, { root = false } = {})`** · [L595](../src/css.js#L595) — Gera { html, css } legíveis para uma lista de camadas: uma <div> (ou <p> para texto) por camada, cada uma com uma classe própria, e uma regra CSS por classe. Camadas ocultas não entram.
  - `nodes` <sub>object[]</sub> — camadas irmãs a exportar
  - `parent` <sub>object\|null</sub> — pai delas (define se são itens de flex/grid)
  - `[assets]` <sub>object</sub> — imagens do documento
- **`exportHtml(node, assets, title = 'Design')`** · [L622](../src/css.js#L622) — Documento HTML COMPLETO e independente (um único arquivo, sem dependências) com a camada e seus filhos. Abre direto no navegador; o CSS fica num <style> no <head>.

---

## src/export.js

**SAÍDAS: PNG, SVG, HTML E ARQUIVO DE PROJETO (.json)** · [abrir o código](../src/export.js)

```text
 Formatos: PNG (imagem), SVG (vetor), HTML (página completa com CSS) e .designer.json (projeto inteiro, para
 salvar/abrir). Cada função "baixa" o arquivo pelo navegador, sem servidor.
```

- **`download(filename, data, type)`** · [L21](../src/export.js#L21) — Faz o navegador BAIXAR um arquivo gerado na memória: cria um Blob, uma URL temporária e clica num <a download> invisível. A URL é liberada depois de 2s para não vazar memória.
  - `filename` <sub>string</sub> — nome do arquivo
  - `data` <sub>string\|Blob</sub> — conteúdo
  - `[type]` <sub>string</sub> — tipo MIME (ignorado se `data` já for Blob)
- **`exportHtmlFile(node, assets)`** · [L34](../src/export.js#L34) — Baixa a camada como HTML completo e independente (um arquivo só). Nome: "<nome-da-camada>.html".
- **`saveProject(doc)`** · [L42](../src/export.js#L42) — Baixa o PROJETO inteiro como `.designer.json` (todas as páginas, imagens e estilos). É o backup de verdade: o salvamento automático fica só no navegador. Para abrir de novo: Arquivo → Abrir.
- **`openProjectFile(file)`** · [L51](../src/export.js#L51) — Lê um arquivo de projeto (.json) escolhido pelo usuário. Valida o mínimo (tem páginas) e completa campos que projetos antigos não tinham. Lança um erro com mensagem amigável se o arquivo não for um projeto.
  - `file` <sub>File</sub> — 
- **`exportPng(node, assets, scale = 2)`** · [L69](../src/export.js#L69) — Exporta a camada como PNG. Técnica: monta o HTML+CSS da camada (o MESMO do painel Código), embrulha num SVG com <foreignObject>, carrega como imagem e desenha num <canvas> na escala pedida (2x = dobro de pixels, nítido em telas HiDPI). Se a camada está girada, a imagem tem o tamanho da caixa rotacionada e a camada fica centralizada nela.

  LIMITAÇÕES: o navegador não carrega fontes da web dentro de uma imagem SVG, então só valem as fontes INSTALADAS no
  computador; e efeitos como backdrop-filter podem não aparecer. (O HTML/SVG exportados não têm essas limitações.)
  - `node` <sub>object</sub> — camada
  - `assets` <sub>object</sub> — imagens do documento
  - `[scale=2]` <sub>number</sub> — 1 a 4
- **`exportSvgFile(node, assets, boxOf)`** · [L96](../src/export.js#L96) — Baixa a camada como SVG vetorial (ver svg.js). `boxOf` mede cada filho no DOM para respeitar flexbox/grid.

---

## src/fonts.js

**FONTES DO GOOGLE FONTS (lista, carregamento sob demanda e prévia)** · [abrir o código](../src/fonts.js)

```text
 - A LISTA (1.908 fontes, com categoria e pesos) está embutida em src/data/google-fonts.js.
 - O ARQUIVO de cada fonte é baixado do Google só quando um texto do projeto usa aquela fonte
   (ensureFonts). O app olha as fontes usadas a cada mudança e ao abrir um projeto.
 - A PRÉVIA no seletor baixa só as letras do nome da fonte (parâmetro &text= do Google: poucos KB), com um
   nome "apelido" para não se misturar com a fonte de verdade.
 - O HTML exportado leva o <link> das fontes usadas (googleFontsUrl).

 Sem internet: o texto aparece na fonte de reserva (system-ui) até a fonte conseguir carregar.
```

- **`SYSTEM_FONTS`** · [L20](../src/fonts.js#L20) — Fontes do sistema (não precisam de download). system-ui = a fonte da interface do seu sistema.
- **`GOOGLE`** · [L23](../src/fonts.js#L23) — nome → { category, weights } de cada fonte do Google.
- **`weightsOf(family)`** · [L26](../src/fonts.js#L26) — Pesos disponíveis de uma fonte (fontes do sistema: todos os pesos comuns).
- **`nearestWeight(family, weight)`** · [L29](../src/fonts.js#L29) — Peso disponível mais próximo do pedido (ex.: 600 numa fonte que só tem 400 e 700 → 700).
- **`googleFontsUrl(families, { text } = {})`** · [L40](../src/fonts.js#L40) — URL do CSS do Google Fonts para várias fontes, com todos os pesos que cada uma tem. ex.: https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Lobster&display=swap
  - `families` <sub>string[]</sub> — só as que existem no Google entram
- **`usedFonts(docOrNodes)`** · [L51](../src/fonts.js#L51) — Todas as fontes usadas por textos e estilos de texto de um documento (ou de uma lista de camadas).
- **`ensureFonts(families)`** · [L63](../src/fonts.js#L63) — Garante que as fontes do Google da lista estão carregando (põe um <link> por fonte nova).
- **`previewFamily(family)`** · [L78](../src/fonts.js#L78) — Nome "apelido" da prévia de uma fonte (para não se misturar com a fonte de verdade, que tem todas as letras).
- **`loadPreview(family)`** · [L83](../src/fonts.js#L83) — Baixa a PRÉVIA de uma fonte: só as letras do próprio nome. Busca o CSS do Google, troca o nome da família pelo apelido e injeta numa <style>. Falhas são silenciosas (a prévia só fica na fonte padrão).

---

## src/main.js

**PONTO DE ENTRADA: MONTA O APP** · [abrir o código](../src/main.js)

```text
 Cria o store e liga todas as peças, nesta ordem:
   salvamento (lê o projeto guardado no navegador e pergunta se o servidor está aí) →
   store → canvas (desenha) → overlay (seleção) → commands/tools (editar) → painéis (camadas, recursos,
   propriedades, protótipo, código) → barra superior, barra de ferramentas, zoom, menus → preferências.
 Este arquivo só COLA os módulos; a lógica de cada coisa mora no módulo dela.
```

- **`toast(msg)`** <sub>do módulo</sub> · [L46](../src/main.js#L46) — Mostra um aviso curto (balão preto) na parte de baixo da tela por ~3s. Só um por vez: o novo substitui o antigo.
- **`savePrefs()`** <sub>do módulo</sub> · [L59](../src/main.js#L59) — Grava as preferências (falhas silenciosas: é só conveniência).
- **`openSettings()`** <sub>do módulo</sub> · [L84](../src/main.js#L84) — Janelas de Configurações e Projetos (ver ui/settings.js e ui/projects.js).
- **`quickSave()`** <sub>do módulo</sub> · [L87](../src/main.js#L87) — Ctrl+S: grava no arquivo ligado; se ainda não há arquivo, abre a janela para dar um nome.
- **`setLeftTab(tab)`** <sub>do módulo</sub> · [L118](../src/main.js#L118) — Troca a aba do painel esquerdo ('layers' | 'assets' | 'icons').
- **`setTab(tab)`** <sub>do módulo</sub> · [L146](../src/main.js#L146) — Troca a aba do painel direito ('design' | 'proto' | 'code') e já redesenha o painel escolhido.
- **`confirmReplace(question)`** <sub>do módulo</sub> · [L255](../src/main.js#L255) — Antes de TROCAR o projeto aberto (abrir outro, novo, exemplo, importar). Regras:

   - projeto gravado na pasta, ou exemplo/em branco não editado → troca sem perguntar (nada se perde);
   - projeto que só existe no navegador → pergunta, porque o navegador guarda UM projeto: ele seria substituído.
     Opções: salvar na pasta antes (abre "Salvar na pasta" e cancela a troca), trocar mesmo assim, ou cancelar.
  - ↩︎ `Promise<boolean>` true = pode trocar
- **`syncTopbar()`** <sub>do módulo</sub> · [L294](../src/main.js#L294) — Atualiza a barra superior conforme o estado: desfazer/refazer habilitados, ícone do tema, nome e indicador de salvo.
- **`saveStatus()`** <sub>do módulo</sub> · [L310](../src/main.js#L310) — O que o indicador do topo mostra: [estado (cor), texto, dica ao passar o mouse].

   - "Salvo na pasta"       → gravado no arquivo .json da pasta (e no navegador)
   - "Salvo no navegador"   → projeto ainda sem arquivo: só a cópia do navegador existe
   - "Só no navegador"      → tem arquivo, mas a pasta falhou (servidor desligado, conflito, permissão)
- **`TOOLS`** <sub>do módulo</sub> · [L322](../src/main.js#L322) — Ferramentas da barra flutuante: [id, ícone, dica com atalho]. A ordem é a ordem na tela.
- **`syncTools()`** <sub>do módulo</sub> · [L379](../src/main.js#L379) — Destaca o botão da ferramenta ativa (aria-pressed diz ao leitor de tela qual está ligada).
- **`syncZoom()`** <sub>do módulo</sub> · [L414](../src/main.js#L414) — Mostra o zoom atual em % no botão.
- **`setWidth(side, w)`** <sub>do módulo</sub> · [L526](../src/main.js#L526) — Define a largura de um painel (entre 200 e 520px), avisa quem depende do tamanho (réguas, canvas) e devolve o valor aplicado.
- **`syncEmpty()`** <sub>do módulo</sub> · [L580](../src/main.js#L580) — Mostra/esconde a dica conforme a página tem ou não camadas.
- **`onFail(msg)`** <sub>do módulo</sub> · [L588](../src/main.js#L588) — Trata uma falha inesperada: registra no console e avisa o usuário (com limite de frequência).

---

## src/model.js

**MODELO DE DADOS DO DOCUMENTO** · [abrir o código](../src/model.js)

```text
 O QUE É
   Define como um documento de design é guardado na memória (e, depois, no navegador e no
   arquivo .json da pasta): páginas → árvore de camadas ("nós"). Também tem as funções puras que mexem
   nessa árvore (clonar, percorrer, ajustar grupos, aplicar constraints...).

 POR QUE É ASSIM
   - Tudo é dado simples (objetos/arrays/strings/números): dá para salvar com JSON.stringify,
     comparar com === no histórico e testar no Node, sem navegador.
   - Os nomes dos campos imitam CSS (gap, padding, justify, align, opacity, blend...). Assim o
     editor, o painel e o gerador de código falam a mesma língua e não precisam "traduzir".
   - Este arquivo NÃO usa DOM nem `window`. Quem desenha na tela é o canvas.js.

 QUEM USA ESTE ARQUIVO
   css.js (gera CSS) · store.js (estado) · commands.js/tools.js (edição) · components.js · svg.js
```

- **`uid()`** · [L27](../src/model.js#L27) — Gera um id curto (8 caracteres) para camadas, páginas, estilos etc. Usa `crypto.randomUUID` quando existe (todo navegador moderno e Node 19+) e, se não, um fallback com Math.random + data. Colisão é praticamente impossível para o tamanho de um documento.
- **`round(n, d = 2)`** · [L37](../src/model.js#L37) — Arredonda `n` para `d` casas decimais (padrão 2). Usado em quase todo lugar onde um número vai para o documento ou para o CSS, para evitar valores como 10.000000000002 que aparecem depois de contas com ponto flutuante.
  - `n` <sub>number</sub> — número a arredondar
  - `[d=2]` <sub>number</sub> — casas decimais
- **`FONT_FAMILIES`** · [L47](../src/model.js#L47) — Fontes oferecidas no painel de texto. As 4 últimas (Poppins, DM Sans, Playfair, JetBrains Mono) são carregadas do Google Fonts pelo index.html; sem internet o navegador usa uma fonte do sistema no lugar. O usuário também pode usar qualquer família que esteja instalada no computador dele.
- **`FONT_WEIGHTS`** · [L53](../src/model.js#L53) — Pesos de fonte do CSS (`font-weight`) com o nome que o Figma/Penpot usam. Formato: [valor, rótulo].
- **`BLEND_MODES`** · [L59](../src/model.js#L59) — Modos de mesclagem aceitos em `mix-blend-mode` (mesma lista do CSS). 'normal' = sem mesclagem.
- **`TYPE_LABEL`** · [L69](../src/model.js#L69) — Nome padrão (em português) de cada tipo de camada. Usado para nomear camadas novas ("Retângulo 3") e como fallback na lista de camadas.
- **`defaultFill(color = '#D9D9D9')`** · [L90](../src/model.js#L90) — Cria um objeto de PREENCHIMENTO (fill) completo. Um fill guarda os dados de TODOS os tipos ao mesmo tempo, de propósito: assim, ao trocar de "cor sólida" para "gradiente" e voltar, o usuário não perde a cor que tinha escolhido. Só o campo `type` decide qual parte vale.

   - type:    'none' | 'solid' | 'linear' | 'radial' | 'image'
   - color/opacity: cor sólida (hex #RRGGBB) e opacidade 0..1
   - stops:   paradas do gradiente [{ color, opacity, pos(0..100) }]
   - angle:   ângulo do gradiente linear em graus (CSS: 0 = para cima, 90 = para a direita)
   - assetId/fit: imagem (id em doc.assets) e como encaixa ('cover' | 'contain' | 'fill' | 'size' = tamanho próprio)
   - campos OPCIONAIS da imagem (ausente = padrão): posX/posY (posição 0–100%, padrão 50 = centro), size (% da largura da
     camada, só no ajuste 'size', padrão 100), repeat ('no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y', só em
     'contain'/'size', padrão 'no-repeat') e natW/natH (tamanho original da imagem, para o SVG exportado calcular o ladrilho)
   - styleId (opcional): liga a um estilo de cor compartilhado (ver components.js → syncStyles)
  - `[color='#D9D9D9']` <sub>string</sub> — cor sólida inicial
- **`defaultStroke()`** · [L108](../src/model.js#L108) — Contorno (stroke). No CSS vira `outline` (não `border`) porque o outline NÃO altera o layout nem o tamanho da caixa — por isso trocar a espessura não "empurra" os vizinhos num auto layout. `position`: 'inside' | 'center' | 'outside' controla o `outline-offset`.
- **`defaultShadow()`** · [L111](../src/model.js#L111) — Sombra (vira `box-shadow`; em textos vira `text-shadow`). `inset` = sombra interna.
- **`defaultLayout()`** · [L123](../src/model.js#L123) — Configuração de auto layout de um FRAME. É literalmente CSS:

   - mode: 'none' (filhos livres, position:absolute) | 'row' | 'column' (display:flex) | 'grid' (display:grid)
   - gap / colGap / rowGap: espaço entre itens (flex usa `gap`; grid usa colGap e rowGap)
   - cols / rows: colunas e linhas do grid (rows 0 = linhas automáticas)
   - padding: [topo, direita, baixo, esquerda] — mesma ordem do atalho `padding` do CSS
   - justify: justify-content (flex) ou justify-items (grid)
   - align:   align-items
   - wrap:    flex-wrap: wrap
- **`createNode(type, props = {})`** · [L146](../src/model.js#L146) — Cria uma camada ("nó") nova, com todos os campos que qualquer camada tem + os do seu tipo.

  SISTEMA DE COORDENADAS: `x` e `y` são relativos ao canto superior esquerdo do PAI (ou ao mundo, se for
  uma camada na raiz da página) e SEM rotação. A rotação gira a caixa em torno do próprio centro.
  - `type` <sub>'frame'\|'rect'\|'ellipse'\|'text'\|'group'\|'line'\|'path'\|'section'</sub> — tipo da camada
  - `[props]` <sub>object</sub> — campos que sobrescrevem os padrões (ex.: { x: 10, name: 'Botão' })
  - ↩︎ `object` o nó, já pronto para entrar em `page.children` ou `node.children`
- **`isContainer(n)`** · [L267](../src/model.js#L267) — true para camadas que guardam filhos (frame, grupo e seção).
- **`isBoard(node, parent)`** · [L275](../src/model.js#L275) — "Prancheta" (board): frame no nível de cima, ou seja, na raiz da página OU direto dentro de uma seção. É o que ganha nome flutuante acima do canvas, vira tela no modo Apresentar e não entra em outros frames ao ser arrastado.
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai dela (null = raiz da página)
- **`constraintsOf(n)`** · [L278](../src/model.js#L278) — Constraints de uma camada, com padrão (esquerda/topo) para documentos salvos antes desse recurso existir.
- **`hasLayout(n)`** · [L281](../src/model.js#L281) — true se o nó é um frame com auto layout ligado (flex ou grid).
- **`isFlow(node, parent)`** · [L287](../src/model.js#L287) — A camada participa do fluxo do auto layout do pai? Se sim, ela é `position: relative` e quem decide a posição é o navegador (flex/grid); se não, é `position: absolute` e usa x/y.
- **`cloneDeep(v)`** · [L290](../src/model.js#L290) — Cópia profunda via JSON (suficiente: o documento só tem dados simples, sem funções nem datas).
- **`cloneNode(node)`** · [L293](../src/model.js#L293) — Clona uma camada e TODOS os descendentes, gerando ids novos (usado em duplicar, copiar/colar e Alt+arrastar).
- **`walk(list, fn, parent = null)`** · [L309](../src/model.js#L309) — Percorre a árvore de camadas em profundidade.
  - `list` <sub>object[]</sub> — lista de nós (ex.: page.children)
  - `fn` <sub>(node, parent, list, index) => (void\|false)</sub> — chamada para cada nó; retornar `false` NÃO desce nos filhos dele
  - `[parent]` <sub>object\|null</sub> — pai da lista (null na raiz)
- **`makePage(name = 'Página 1')`** · [L318](../src/model.js#L318) — Cria uma página vazia. `guides` guarda as guias de régua (posições em px do mundo).
- **`makeDoc()`** · [L329](../src/model.js#L329) — Documento vazio. Estrutura completa: { version, name,

     pages:  [{ id, name, children: [camadas], guides: [{axis:'x'|'y', pos}] }],
     assets: { [assetId]: 'data:image/...' }   // imagens ficam FORA das páginas para não pesarem no histórico
     styles: { colors: [...], texts: [...] } } // estilos compartilhados de cor e texto
- **`nextName(page, type)`** · [L334](../src/model.js#L334) — Gera o próximo nome livre para o tipo ("Retângulo 1", "Retângulo 2"...), contando as camadas do mesmo tipo na página.
- **`fitGroups(list)`** · [L355](../src/model.js#L355) — Ajusta cada GRUPO ao retângulo que envolve seus filhos e remove grupos vazios. Como um grupo não tem tamanho próprio, depois de mover/redimensionar um filho a caixa do grupo precisa ser recalculada. Roda no fim de cada gesto (em `store.commit`), não durante o arrasto, para não "mexer o chão" debaixo do ponteiro. As coordenadas dos filhos são relativas ao grupo, então ao mover a origem do grupo subtraímos o mesmo valor dos filhos (a posição visual não muda).
  - `list` <sub>object[]</sub> — lista de nós a processar (recursivo)
- **`applyConstraints(frame, ow, oh)`** · [L389](../src/model.js#L389) — Aplica as CONSTRAINTS dos filhos depois que o frame mudou de tamanho (de ow×oh para frame.w×frame.h). Por eixo, cada filho escolhe: colar no início (padrão), colar no fim (right/bottom), esticar entre as duas bordas (leftright/topbottom), manter o centro ou escalar proporcionalmente. Não faz nada em frames com auto layout (aí quem manda é o CSS). É recursivo: se um filho mudou de tamanho, os filhos dele reagem também.
  - `frame` <sub>object</sub> — frame JÁ com o tamanho novo
  - `ow` <sub>number</sub> — largura antiga
  - `oh` <sub>number</sub> — altura antiga
- **`hasSizeLimits(n)`** · [L416](../src/model.js#L416) — Tipos de camada que têm uma caixa CSS de verdade para receber limites de tamanho e proporção: grupos não têm tamanho próprio (a caixa é recalculada dos filhos) e a linha é só uma barra.
- **`hasAspect(n)`** · [L419](../src/model.js#L419) — A camada tem proporção (aspect-ratio) ligada? Texto, grupo e linha não usam.
- **`limitSize(n, w, h)`** · [L426](../src/model.js#L426) — Ajusta (w, h) aos LIMITES da camada: campos opcionais `minW`, `maxW`, `minH`, `maxH` em px (ausentes = sem limite). Como no CSS, o mínimo vence o máximo quando os dois se contradizem.
  - ↩︎ `[number, number]` largura e altura já limitadas
- **`applyLimits(n)`** · [L439](../src/model.js#L439) — Aplica os limites ao tamanho JÁ guardado, só nos eixos de tamanho FIXO (os eixos hug/fill quem decide é o navegador, e o canvas mede de volta). Se mudou, os filhos reagem como em qualquer redimensionamento (constraints).
- **`resizeNode(n, nw, nh, axis = 'w')`** · [L455](../src/model.js#L455) — Redimensiona UMA camada de forma "inteligente": respeita "travar proporção", marca o eixo como 'fixed' e propaga o efeito para dentro (escala os filhos de um grupo; aplica constraints nos filhos de um frame).
  - `n` <sub>object</sub> — camada
  - `nw` <sub>number</sub> — nova largura
  - `nh` <sub>number</sub> — nova altura
  - `[axis='w']` <sub>'w'\|'h'</sub> — qual campo o usuário editou (importa para a trava de proporção)
- **`scaleNode(node, sx, sy)`** · [L486](../src/model.js#L486) — Escala uma camada e (se for grupo) todos os filhos por (sx, sy), multiplicando posição e tamanho. Usado ao redimensionar grupos e seleções múltiplas. Textos viram 'fixed' na largura (senão voltariam ao tamanho natural no render).
- **`slugify(s)`** · [L503](../src/model.js#L503) — Transforma um nome em "slug" seguro para classe CSS e nome de arquivo: tira acentos, deixa minúsculo e troca qualquer coisa fora de a-z/0-9 por '-'. "Botão primário" → "botao-primario". Vazio vira 'item'.

---

## src/overlay.js

**INTERFACE POR CIMA DO CANVAS (seleção, alças, guias, medidas...)** · [abrir o código](../src/overlay.js)

```text
 Desenha, em pixels de tela, tudo o que acompanha o canvas mas não faz parte do design: caixa de seleção
 com alças de redimensionar/rotacionar, nomes dos frames, guias de snap e de régua, grades de layout,
 medidas com Alt, a caneta e as setas do protótipo.

 Importante: o overlay NÃO trata o mouse (quem trata é tools.js). Aqui só se desenha e se marca cada
 alça com data-handle / data-rotate / data-label / data-guide para o tools.js saber o que foi clicado.
```

- **`HANDLES`** <sub>do módulo</sub> · [L22](../src/overlay.js#L22) — As 8 alças de redimensionar. Valor = posição relativa dentro da caixa (0..1): [0,0] canto superior esquerdo, [1,0.5] meio da borda direita... Como as alças são FILHAS da caixa de seleção (que pode estar girada), elas giram junto sem nenhuma conta extra — só posicionamos por porcentagem.
- **`BASE_ANGLE`** <sub>do módulo</sub> · [L26](../src/overlay.js#L26) — Ângulo (graus) para o qual cada alça "aponta" com a caixa sem rotação. Base para escolher o cursor certo.
- **`CURSORS`** <sub>do módulo</sub> · [L28](../src/overlay.js#L28) — Cursores de redimensionar, indexados por múltiplos de 45° (módulo 180).
- **`handleCursor(handle, rot)`** · [L34](../src/overlay.js#L34) — Escolhe o cursor da alça levando a ROTAÇÃO da camada em conta: uma alça "leste" numa caixa girada 90° deve mostrar o cursor vertical. Soma o ângulo base da alça + rotação e arredonda para o múltiplo de 45° mais próximo.
- **`measures(A, B)`** · [L46](../src/overlay.js#L46) — Distâncias entre a seleção A e a camada B (retângulos {x,y,w,h} no mundo) — o "Alt" do Figma. Casos: (1) A dentro de B → as 4 margens internas; (2) separadas → o vão horizontal e/ou vertical, desenhado no meio da faixa onde os dois se sobrepõem; (3) sobrepostas parcialmente → nada. Função PURA (testada em tests/features.test.js).
  - ↩︎ `{x1:number,y1:number,x2:number,y2:number,len:number` []} segmentos a desenhar
- **`createOverlay(store, canvas, viewport, hooks = {})`** · [L83](../src/overlay.js#L83) — Cria o OVERLAY: tudo o que é desenhado POR CIMA do canvas e que não pode escalar com o zoom (alças sempre com 9px, bordas sempre finas): caixa de seleção, alças, zona de rotação, etiqueta de tamanho, nomes dos frames, guias de snap, réguas de guia, grades de layout, medidas, caneta e setas do protótipo.

  Tudo vive em PIXELS DE TELA (converte do mundo com canvas.toScreen) dentro de `.overlay`, que tem
  pointer-events:none — só alças, rótulos e guias reativam o mouse.
  - `store` <sub>object</sub> — 
  - `canvas` <sub>object</sub> — geometria (aabb, worldBox, toScreen...)
  - `viewport` <sub>HTMLElement</sub> — 
- **`get(key, cls, parent = root)`** <sub>interna</sub> · [L98](../src/overlay.js#L98) — Pega (ou cria) o elemento do overlay identificado por `key`, com a classe `cls`, dentro de `parent`. Marca a chave como usada neste render; as não usadas são removidas no final.
- **`place(el, x, y, w, h, rot = 0)`** <sub>interna</sub> · [L112](../src/overlay.js#L112) — Posiciona/dimensiona um elemento em px de tela, com rotação opcional.
- **`screenBox(id)`** <sub>interna</sub> · [L121](../src/overlay.js#L121) — Caixa da camada em px de TELA: { cx, cy, w, h, rot } (centro + tamanho + rotação própria).
- **`drawBox(key, box, cls, handles)`** <sub>interna</sub> · [L134](../src/overlay.js#L134) — Desenha uma caixa de seleção e, conforme `handles`, as alças:

    falsy → só a borda · 'plain' → 8 alças · 'full' → 8 alças + 4 zonas de rotação · 'line' → só as 2 pontas (linhas)
  Alças de borda somem quando a caixa é minúscula (<24px), para não cobrirem o objeto.
- **`render()`** <sub>interna</sub> · [L166](../src/overlay.js#L166) — Redesenha o overlay inteiro (barato graças ao pool). Camadas, de baixo para cima: nomes dos frames → hover → alvo de soltura → seleção → guias de snap → grades de layout → guias manuais → grade de pixels → medidas (Alt) → caneta → setas do protótipo → marquee.
- **`pill(aabb, text)`** <sub>interna</sub> · [L454](../src/overlay.js#L454) — Etiqueta azul "L × A" logo abaixo da seleção.

---

## src/pen.js

**FERRAMENTA CANETA (VETORES) E EDIÇÃO DE PONTOS** · [abrir o código](../src/pen.js)

```text
 Cria e edita vetores com curvas de Bézier cúbicas. Cada ponto é { x, y, hin, hout }: hin/hout são as
 "alças" (pontos de controle) de entrada/saída; null significa ponto de canto (segmento reto).
 Os pontos vivem no espaço próprio do vetor (vw×vh) e a camada só estica esse espaço (ver model.js).
```

- **`createPen({ store, canvas, commands, frameUnder })`** · [L30](../src/pen.js#L30) — Cria a CANETA. Dois modos, que não ficam ativos ao mesmo tempo:

   A) DESENHAR (ui.pen): cada clique adiciona um ponto. Clicar e ARRASTAR cria um ponto "suave": o arrasto define a
      alça de saída (hout) e a de entrada (hin) é o espelho dela — é isso que faz a curva de Bézier. Clicar no 1º
      ponto fecha o caminho; Enter/Esc/duplo clique termina deixando-o aberto.
   B) EDITAR PONTOS (ui.editPathId): depois de criado, duplo clique no vetor mostra os pontos. Arrastar ponto/alça
      altera a forma; Alt+clique no traço adiciona ponto (SEGUINDO a curva, sem deformá-la); duplo clique no ponto
      alterna canto↔suave; Delete remove; setas movem o ponto (Shift = 10); Shift ao arrastar/desenhar trava em 45°.
      O painel Design (seção Vetor) edita o ponto selecionado (tipo, X/Y) e mostra/aceita o `d` do SVG.

  Este módulo não desenha: `overlaySvg()` devolve o SVG (em px de tela) que o overlay.js exibe.
- **`dist(a, b)`** <sub>interna</sub> · [L37](../src/pen.js#L37) — Distância entre dois pontos (px).
- **`screenOf(p)`** <sub>interna</sub> · [L39](../src/pen.js#L39) — Ponto do mundo → px de tela (para medir distâncias na tela, independentes do zoom).
- **`selPts()`** <sub>interna</sub> · [L42](../src/pen.js#L42) — Índices dos pontos selecionados (sempre inclui o principal).
- **`setSel(arr, primary)`** <sub>interna</sub> · [L44](../src/pen.js#L44) — Define a seleção de pontos e o ponto principal (por padrão, o último da lista).
- **`gridOrigin(n)`** <sub>interna</sub> · [L50](../src/pen.js#L50) — Origem (mundo) do pai do vetor em edição, ou do caminho em desenho: é daqui que a grade de encaixe conta.
- **`snapW(w, o)`** <sub>interna</sub> · [L55](../src/pen.js#L55) — Arredonda um ponto do mundo para a grade de encaixe (sem encaixe ligado, devolve o próprio ponto).
- **`snap45(from, p)`** <sub>interna</sub> · [L60](../src/pen.js#L60) — Com Shift: trava `p` em múltiplos de 45° a partir de `from` (mantém a distância).
- **`cubicAt(a, c1, c2, b, t)`** <sub>interna</sub> · [L67](../src/pen.js#L67) — Ponto da curva de Bézier cúbica (a, c1, c2, b) no parâmetro t (0..1).
- **`nearestOnPath(n, l)`** <sub>interna</sub> · [L78](../src/pen.js#L78) — Ponto do traço MAIS PERTO de `l` (espaço do vetor), medindo na curva de verdade (não na corda reta). Amostra 48 pontos por segmento. Devolve { i: segmento, t, d: distância, pt: ponto } ou null.
- **`splitSegment(a, b, t)`** <sub>interna</sub> · [L97](../src/pen.js#L97) — Divide o segmento a→b em `t` (algoritmo de De Casteljau) e devolve o ponto novo JÁ com as alças certas; ajusta as alças de a e b. O desenho não muda: só ganha um ponto a mais no meio da curva.
- **`finish(close = false)`** <sub>interna</sub> · [L112](../src/pen.js#L112) — Termina o desenho: cria a camada-vetor se há 2+ pontos e volta para a ferramenta Mover.
  - `[close=false]` <sub>boolean</sub> — true fecha o caminho (liga o último ponto ao primeiro)
- **`down(e)`** <sub>interna</sub> · [L132](../src/pen.js#L132) — Clique da caneta. Clicar perto (<9px de tela) do 1º ponto, com 2+ pontos, FECHA o caminho. Senão adiciona um ponto de canto e começa um possível arrasto (que viraria alças de Bézier). O frame sob o primeiro clique vira o pai da camada final. Clicar na PONTA de um vetor aberto selecionado CONTINUA aquele caminho (como a caneta do Illustrator).
  - ↩︎ o gesto de arrasto, ou null se o caminho foi fechado
- **`move(e)`** <sub>interna</sub> · [L162](../src/pen.js#L162) — Movimento do mouse: atualiza o "elástico" até o cursor (preview do próximo segmento) e, se está arrastando após o clique, define as alças: hout segue o mouse e hin é o ESPELHO em torno do ponto (curva suave). Só vira arrasto após 3px (cliques tremidos continuam sendo pontos de canto).
- **`up()`** <sub>interna</sub> · [L182](../src/pen.js#L182) — Soltou o mouse: se estava editando um ponto/alça, ajusta a caixa do vetor e grava no histórico (1 desfazer).
- **`editNode()`** <sub>interna</sub> · [L193](../src/pen.js#L193) — Vetor em edição (ou null).
- **`toLocal(n, w)`** <sub>interna</sub> · [L199](../src/pen.js#L199) — Mundo → espaço do vetor (o "viewBox" vw×vh). Desfaz a rotação da camada (rotação inversa em torno do centro) e converte a posição na caixa para o sistema de coordenadas dos pontos.
- **`toWorld(n, p)`** <sub>interna</sub> · [L207](../src/pen.js#L207) — Espaço do vetor → mundo (o inverso de toLocal), considerando a rotação da camada. Usado para desenhar os pontos na tela.
- **`startEdit(id)`** <sub>interna</sub> · [L215](../src/pen.js#L215) — Entra no modo de edição de pontos de um vetor (duplo clique ou Enter).
- **`exitEdit()`** <sub>interna</sub> · [L225](../src/pen.js#L225) — Sai da edição de pontos.
- **`downEdit(e, kind, idx)`** <sub>interna</sub> · [L239](../src/pen.js#L239) — Clicou num ponto ou alça. `kind`: 'pt' (ponto), 'hin' ou 'hout' (alças).

   - Shift+clique num ponto: soma/tira o ponto da seleção (sem arrastar).
   - Alt+clique num ponto: converte canto ↔ suave (como a ferramenta "converter ponto" do Illustrator).
   - Clique/arrasto: seleciona o ponto (se já está num grupo selecionado, o grupo todo vai junto).
- **`moveEditHandle(world, e)`** <sub>interna</sub> · [L261](../src/pen.js#L261) — Arrasta ponto ou alça (converte o mouse para o espaço do vetor).

   - Ponto: leva as próprias alças junto.
   - Alça: a alça oposta é espelhada (curva suave) — segure Alt para quebrar o espelho e fazer um bico.
- **`togglePointType(idx)`** <sub>interna</sub> · [L292](../src/pen.js#L292) — Alterna o ponto entre CANTO (sem alças) e SUAVE. Ao suavizar, cria alças opostas e proporcionais à direção entre o ponto anterior e o próximo (quarto da distância), que dá uma curva natural.
- **`deletePoint()`** <sub>interna</sub> · [L309](../src/pen.js#L309) — Remove os pontos selecionados (o caminho mantém no mínimo 2 pontos).
- **`addPointAt(e)`** <sub>interna</sub> · [L325](../src/pen.js#L325) — Alt+clique no traço: insere um ponto no lugar do traço mais perto do clique, MEDINDO NA CURVA (nearestOnPath) e dividindo o segmento (splitSegment): num trecho curvo o ponto novo nasce com as alças certas e o desenho não muda.
- **`hover(e)`** <sub>interna</sub> · [L342](../src/pen.js#L342) — Com Alt pressionado, mostra um pontinho no traço onde o clique adicionaria um ponto (feedback antes de clicar).
- **`scaleOf(n)`** <sub>interna</sub> · [L358](../src/pen.js#L358) — Escala do espaço do vetor (vw×vh) para px da camada.
- **`pointType()`** <sub>interna</sub> · [L361](../src/pen.js#L361) — Tipo do ponto selecionado: 'corner' (sem alças), 'smooth' (alças alinhadas e iguais) ou 'free' (qualquer outra).
- **`setPointType(type)`** <sub>interna</sub> · [L374](../src/pen.js#L374) — Define o tipo dos pontos selecionados: 'corner' tira as alças; 'smooth' deixa as duas alças iguais e opostas.
- **`pointPos()`** <sub>interna</sub> · [L399](../src/pen.js#L399) — Posição do ponto selecionado em px, relativa ao PAI da camada (como o X/Y da camada): { x, y } ou null.
- **`setPointPos(axis, v)`** <sub>interna</sub> · [L411](../src/pen.js#L411) — Move o ponto selecionado para X ou Y (px relativos ao pai), levando as alças junto. NÃO grava no histórico: quem chama (o campo numérico do painel) faz o commit ao terminar.
- **`nudge(dx, dy)`** <sub>interna</sub> · [L426](../src/pen.js#L426) — Setas movem o ponto selecionado (px do pai; Shift = 10). Devolve true se tratou a tecla.
- **`reverse(id)`** <sub>interna</sub> · [L446](../src/pen.js#L446) — Inverte a direção do caminho (o primeiro ponto vira o último). O desenho não muda; setas de preenchimento e animações de traço sim.
- **`pathD(id)`** <sub>interna</sub> · [L462](../src/pen.js#L462) — O atributo `d` do SVG deste vetor (todos os contornos), no espaço próprio dele (viewBox 0 0 vw vh).
- **`applyPathD(id, d)`** <sub>interna</sub> · [L472](../src/pen.js#L472) — Substitui o desenho do vetor pelo `d` de um SVG (aceita M L H V C S Q T A Z, absolutos e relativos). Só mexe na geometria: cor, contorno, nome e posição continuam. A caixa passa a ter o tamanho do desenho colado.
  - ↩︎ `boolean` false se o texto não tem nenhum caminho
- **`continueAt(e)`** <sub>interna</sub> · [L505](../src/pen.js#L505) — Cliques da caneta na PONTA de um vetor aberto que está selecionado CONTINUAM aquele caminho: devolve um caminho em desenho (ui.pen) já com os pontos do vetor, com a ponta clicada no fim. Não vale para vetor girado ou com furos.
- **`marqueeStart(e, onBody)`** <sub>interna</sub> · [L522](../src/pen.js#L522) — Começa um retângulo de seleção de PONTOS (arrastar no vazio durante a edição). Shift soma à seleção atual.
- **`marqueeMove(e, d)`** <sub>interna</sub> · [L529](../src/pen.js#L529) — Atualiza o retângulo e seleciona os pontos que caem dentro dele.
- **`marqueeEnd(d)`** <sub>interna</sub> · [L547](../src/pen.js#L547) — Soltou: sem arrastar, clicar no vazio limpa os pontos (e, fora do vetor, sai da edição e desmarca).
- **`selectAll()`** <sub>interna</sub> · [L556](../src/pen.js#L556) — Seleciona todos os pontos do vetor em edição (Ctrl+A).
- **`selectedCount()`** <sub>interna</sub> · [L564](../src/pen.js#L564) — Quantos pontos estão selecionados.
- **`openAfter()`** <sub>interna</sub> · [L570](../src/pen.js#L570) — "Abrir aqui": num caminho FECHADO, corta o segmento logo DEPOIS do ponto selecionado e o caminho vira aberto (o ponto seguinte passa a ser o início). É a tesoura do Illustrator, em versão simples.
- **`overlaySvg()`** <sub>interna</sub> · [L591](../src/pen.js#L591) — Markup SVG (em px de tela) do que a caneta mostra: o caminho em construção com o "elástico" até o cursor, os pontos (o primeiro em rosa, indica onde fechar) e as alças; ou, na edição, os pontos do vetor (e as alças do ponto selecionado). Elementos com data-edit/data-idx são clicáveis (tools.js os reconhece).
- **`isDrawing()`** <sub>interna</sub> · [L627](../src/pen.js#L627) — Está desenhando um caminho novo?
- **`isEditing()`** <sub>interna</sub> · [L629](../src/pen.js#L629) — Está editando os pontos de um vetor?

---

## src/present.js

**MODO APRESENTAR (PROTÓTIPO EM TELA CHEIA)** · [abrir o código](../src/present.js)

```text
 Executa as interações definidas na aba Protótipo (clicar/passar o mouse → navegar, voltar, abrir link)
 com transições. Reaproveita css.js, então a apresentação tem exatamente a aparência do design.
```

- **`TRANSITIONS`** <sub>do módulo</sub> · [L18](../src/present.js#L18) — Transições entre telas no modo Apresentar. Cada uma tem `enter` (animação da tela que ENTRA) e `leave` (da que SAI), no formato de keyframes da Web Animations API. 'instant' = null (troca seca). Os transforms são combinados com o `scale` de encaixe na tela em show().
- **`TRANSITION_OPTIONS`** · [L27](../src/present.js#L27) — Lista [valor, rótulo] das transições, para o menu da aba Protótipo.
- **`buildDom(node, parent, assets, isRoot)`** <sub>do módulo</sub> · [L37](../src/present.js#L37) — Monta o DOM de um frame para apresentação a partir do MODELO (não copia o canvas do editor). Usa o MESMO `nodeStyle` do editor, então a apresentação é idêntica ao design. Camadas com interação ganham cursor de mão; `data-id` permite achar a camada (e suas interações) no clique.
- **`createPresent({ store, canvas })`** · [L55](../src/present.js#L55) — Cria o modo APRESENTAR (protótipo em tela cheia).

   - open(id): abre no frame da camada selecionada (ou no marcado como ponto de partida, ou no primeiro)
   - cliques/hover disparam as interações da camada (ou do ancestral mais próximo que tenha uma)
   - `stack` guarda o histórico de telas visitadas, para a ação "Voltar"
   - Esc fecha · R reinicia
- **`frames()`** <sub>interna</sub> · [L64](../src/present.js#L64) — Todos os frames do documento (de todas as páginas) — destinos possíveis das interações.
- **`findFrame(id)`** <sub>interna</sub> · [L70](../src/present.js#L70) — Frame pelo id.
- **`rootOf(id)`** <sub>interna</sub> · [L72](../src/present.js#L72) — Frame da raiz que contém a camada (sobe os pais).
- **`fit(board)`** <sub>interna</sub> · [L79](../src/present.js#L79) — Escala a tela para caber na janela (até 200%), centralizada. Devolve o fator usado.
- **`makeBoard(frame)`** <sub>interna</sub> · [L87](../src/present.js#L87) — Cria o "quadro" de uma tela: caixa do tamanho do frame + DOM + ouvintes de clique e hover.
- **`trigger(target, kind, related)`** <sub>interna</sub> · [L109](../src/present.js#L109) — Dispara a interação do tipo pedido ('click' | 'hover'). Sobe da camada clicada até um ancestral que tenha uma interação desse tipo (assim clicar no texto dentro de um botão aciona o botão). No hover, ignora movimentos dentro do mesmo elemento (só vale ao ENTRAR).
- **`run(it)`** <sub>interna</sub> · [L119](../src/present.js#L119) — Executa uma interação: abrir link, voltar para a tela anterior ou navegar para outro frame (com a transição escolhida).
- **`show(frameId, transition, isBack = false)`** <sub>interna</sub> · [L138](../src/present.js#L138) — Mostra uma tela, animando a troca. A tela antiga fica por baixo durante a transição e é removida ao final; `busy` bloqueia novos cliques nesse intervalo (330ms ≈ duração 320ms).
  - `frameId` <sub>string</sub> — frame a mostrar
  - `transition` <sub>string</sub> — chave de TRANSITIONS
  - `[isBack]` <sub>boolean</sub> — true quando vem de "Voltar" (não empilha no histórico)
- **`open(startId)`** <sub>interna</sub> · [L162](../src/present.js#L162) — Abre a apresentação. Devolve false se não há nenhum frame para apresentar.
- **`onKey(e)`** <sub>interna</sub> · [L188](../src/present.js#L188) — Teclas na apresentação (captura antes do editor): Esc fecha, R reinicia; as outras são engolidas para não mexer no editor por trás.
- **`onResize()`** <sub>interna</sub> · [L200](../src/present.js#L200) — Reencaixa as telas quando a janela muda de tamanho.
- **`close()`** <sub>interna</sub> · [L205](../src/present.js#L205) — Fecha a apresentação e remove os ouvintes globais.

---

## src/rulers.js

**RÉGUAS E CRIAÇÃO DE GUIAS** · [abrir o código](../src/rulers.js)

- **`RULER`** · [L8](../src/rulers.js#L8) — Espessura das réguas em px (a de cima tem 20px de altura; a da esquerda, 20px de largura).
- **`createRulers({ store, canvas, stage, commands })`** · [L16](../src/rulers.js#L16) — Cria as RÉGUAS (topo e esquerda) e a criação de GUIAS: arrastar a partir da régua cria uma linha-guia que o snap enxerga; arrastar a guia de volta para a régua a apaga. As réguas são <canvas> 2D desenhados com a vista atual (pan/zoom) e destacam a faixa da seleção em azul. Guias são dados da página (page.guides: [{axis, pos}]); quem as DESENHA é o overlay.js.
- **`css(name)`** <sub>interna</sub> · [L32](../src/rulers.js#L32) — Lê uma variável CSS do tema atual (as réguas usam as mesmas cores dos painéis, claro ou escuro).
- **`step(zoom)`** <sub>interna</sub> · [L38](../src/rulers.js#L38) — Escolhe o intervalo entre marcações (1, 2, 5, 10, 20, 50, 100…) para que fiquem a ≥60px uma da outra na tela, qualquer que seja o zoom — a régua nunca fica poluída nem vazia.
- **`draw()`** <sub>interna</sub> · [L49](../src/rulers.js#L49) — Redesenha as duas réguas: fundo, faixa translúcida da seleção, marcas e números. Rótulos da régua da esquerda ficam girados em −90°. Considera o devicePixelRatio para ficar nítida em telas HiDPI.
- **`bind(el, axis)`** <sub>interna</sub> · [L109](../src/rulers.js#L109) — Liga o arrasto numa régua: durante o arrasto mostra a guia + a posição; ao soltar, cria a guia — mas só se o mouse estiver DENTRO da área do canvas (soltar em cima da régua cancela).
  - `el` <sub>HTMLElement</sub> — régua
  - `axis` <sub>'x'\|'y'</sub> — eixo da guia criada: a régua de cima cria guias horizontais ('y'); a da esquerda, verticais ('x')

---

## src/sample.js

**PROJETO DE EXEMPLO** · [abrir o código](../src/sample.js)

```text
 Documento de demonstração carregado na primeira abertura. Mostra auto layout (flexbox), gradientes,
 sombras e blur. Também é a base das capturas de tela do README.
```

- **`text(t, props = {})`** <sub>do módulo</sub> · [L14](../src/sample.js#L14) — Atalho para criar uma camada de texto: o nome da camada é o início do próprio texto.
- **`solid(color, opacity = 1)`** <sub>do módulo</sub> · [L16](../src/sample.js#L16) — Preenchimento de cor sólida com opacidade opcional.
- **`flex(mode, extra = {})`** <sub>do módulo</sub> · [L18](../src/sample.js#L18) — Configuração de auto layout flex com valores-padrão do exemplo (cada chamada só diz o que muda).
- **`buildSample()`** · [L29](../src/sample.js#L29) — Monta o projeto de EXEMPLO que aparece na primeira vez que o app abre (e em Arquivo → Carregar exemplo). Serve de vitrine: 3 pranchas que usam auto layout em flexbox (linha e coluna), `fill`/`hug`, gradientes linear e radial, sombras, blur, contorno translúcido, camada absoluta (orb) dentro de auto layout e efeito vidro (backdrop-filter). Tudo é construído com createNode, o mesmo que o app usa.
  - ↩︎ `object` um documento completo (ver model.js → makeDoc)
- **`mk(emoji, name, desc, color)`** <sub>interna</sub> · [L98](../src/sample.js#L98) — Fábrica de cartão: ícone (emoji) + título + descrição, em coluna, com sombra azulada.
- **`buildSampleApp()`** · [L155](../src/sample.js#L155) — Segundo projeto de exemplo: um app de carteira digital (mobile). Demonstra o que o primeiro exemplo não mostra:

   - CSS GRID (as 4 "ações rápidas" estão numa grade de 4 colunas)
   - COMPONENTES: o botão "Ação" é um componente principal; as 4 ações são INSTÂNCIAS com texto/ícone sobrescritos
   - PROTÓTIPO: tocar em "Enviar" navega para a tela de sucesso, e o botão dela volta para o início
   - flexbox com `fill`/`hug`, gradientes, sombras e estilo de lista
  Três pranchas lado a lado: Home, Sucesso e a prancha "Componentes" (onde mora o principal).
  - ↩︎ `object` documento completo

---

## src/saving.js

**REGRAS DE SALVAMENTO (navegador + pasta do computador)** · [abrir o código](../src/saving.js)

```text
 storage.js sabe GRAVAR; este módulo decide O QUE fazer em cada situação:

  auto-salvar (a cada mudança, via store) →  1. se o projeto está LIGADO a um arquivo da pasta, grava lá
                                             2. SEMPRE grava a cópia no navegador (IndexedDB)
  Ctrl+S / "Salvar na pasta"              →  ligado: grava agora · não ligado: abre "Projetos" para dar um nome
  abrir da pasta / abrir versão antiga    →  salva o atual antes de trocar

 Situações difíceis, tratadas de propósito:
  - CONFLITO: o arquivo mudou fora do editor (outra aba, outro programa, sincronização do Drive). O servidor
    responde 409; paramos de gravar nele e avisamos. Nada é sobrescrito sem você confirmar.
  - SERVIDOR DESLIGADO no meio do trabalho: continua salvando no navegador e o topo mostra o aviso.
  - SEM SERVIDOR (app aberto por outro servidor estático): "Salvar na pasta" vira "Baixar .json".
```

- **`THUMB_EVERY_MS`** <sub>do módulo</sub> · [L25](../src/saving.js#L25) — Intervalo mínimo entre duas miniaturas do mesmo projeto: gerar SVG da página toda a cada tecla seria desperdício.
- **`createSaving({ prefs, toast, thumbnail = () => null })`** · [L36](../src/saving.js#L36) — Cria o SALVAMENTO: decide quando e onde gravar (navegador sempre; pasta do computador quando o projeto está ligado a um arquivo), reconcilia ao abrir (navegador × pasta, avisando conflito) e envia as miniaturas.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — o store (criado DEPOIS: use `attach(store)`)
  - `deps.prefs` <sub>object</sub> — preferências (prefs.autoFolder: auto-salvar na pasta; padrão ligado)
  - `deps.toast` <sub>(msg: string) => void</sub> — 
  - `[deps.thumbnail]` <sub>() => string\|null</sub> — gera a miniatura SVG da página aberta (ver thumbnail.js)
- **`server`** <sub>interna</sub> · [L41](../src/saving.js#L41) — Situação do servidor: { ok, folder, keepVersions } ou null (sem servidor). Atualizada por refresh().
- **`refresh()`** <sub>interna</sub> · [L49](../src/saving.js#L49) — Pergunta ao servidor se ele está aí e qual é a pasta. Guarda em store.ui.server para os painéis mostrarem. Se o servidor VOLTOU e a pasta tinha ficado para trás, agenda um salvamento para pô-la em dia.
- **`reconcile()`** <sub>interna</sub> · [L72](../src/saving.js#L72) — Ao ABRIR o app com um projeto ligado a um arquivo: a cópia do navegador e o arquivo da pasta podem divergir. Decidimos SEM comparar relógios, com duas perguntas:

    (a) o arquivo mudou desde a última vez que o vimos?  (data do disco ≠ link.modified)
    (b) o navegador tem mudanças que ainda não foram para a pasta?  (link.synced === false)

               | (b) não                          | (b) sim
    (a) não    | tudo em dia                      | grava na pasta agora (seguro: o arquivo é o que conhecemos)
    (a) sim    | abre o do disco (é o mais novo)  | CONFLITO: mantém o do navegador, não grava; Ctrl+S decide

  Caso real do (a)-sim/(b)-não: a última gravação na pasta aconteceu ao fechar a aba, mas a cópia do navegador
  não terminou de anotar a data nova. Arquivo sumiu da pasta → desliga o vínculo (o projeto continua no navegador).
- **`persist(record)`** <sub>interna</sub> · [L107](../src/saving.js#L107) — Chamado pelo store a cada salvamento automático. Grava na pasta (se ligado e permitido) e no navegador. Ordem importa: pasta PRIMEIRO, para a cópia do navegador já guardar a data nova do arquivo (senão, ao recarregar, o editor acharia que o arquivo "mudou por fora" e acusaria conflito à toa).
  - ↩︎ `Promise<'folder'\|'browser'>` onde o projeto ficou salvo
- **`sendThumb(file, { force = false } = {})`** <sub>interna</sub> · [L143](../src/saving.js#L143) — Gera e envia a miniatura do projeto (no máximo 1 a cada 15 s por arquivo; `force` ignora o intervalo). Roda "por fora": não atrasa o salvamento e, se falhar, só fica sem miniatura nova.
- **`quickSave()`** <sub>interna</sub> · [L160](../src/saving.js#L160) — Ctrl+S. Projeto ligado a um arquivo → grava agora. Em conflito → pergunta se substitui o arquivo do disco. Não ligado → devolve false (quem chamou abre a janela "Projetos" para escolher o nome). Sem servidor → baixa o .json (o comportamento antigo).
  - ↩︎ `Promise<boolean>` true se resolveu sozinho
- **`saveAs(file, { overwrite = false } = {})`** <sub>interna</sub> · [L192](../src/saving.js#L192) — Grava o projeto atual com o nome `file` e liga o projeto a ele. Se já existir outro arquivo com esse nome, pergunta antes de substituir. @returns {Promise<boolean>} true se gravou
- **`open(file)`** <sub>interna</sub> · [L218](../src/saving.js#L218) — Abre um projeto da pasta (salvando o atual antes) e liga o editor ao arquivo.
- **`openVersion(file, id)`** <sub>interna</sub> · [L229](../src/saving.js#L229) — Abre uma VERSÃO ANTIGA como projeto solto (não ligado a arquivo), para você conferir sem estragar o atual. Para restaurar, use "Salvar na pasta" com o mesmo nome e confirme a substituição.
- **`renameFile(file, newName)`** <sub>interna</sub> · [L239](../src/saving.js#L239) — Renomeia um projeto da pasta. Se for o projeto aberto, o vínculo passa para o nome novo.
  - ↩︎ `Promise<string\|null>` o nome final do arquivo, ou null se não deu
- **`duplicateFile(file)`** <sub>interna</sub> · [L252](../src/saving.js#L252) — Cria uma cópia de um projeto da pasta ("nome-copia.json", "nome-copia-2.json"...). Não abre a cópia.

---

## src/storage.js

**ONDE O PROJETO É GUARDADO: NAVEGADOR (IndexedDB) E PASTA DO COMPUTADOR (servidor)** · [abrir o código](../src/storage.js)

```text
 Duas camadas de salvamento, de propósito:

  1. CÓPIA NO NAVEGADOR (sempre ligada) — IndexedDB. Rápida, funciona sem servidor e sobrevive a
     recarregar a página. Antes usávamos localStorage, que tem limite de ~5 MB (estourava com imagens);
     o IndexedDB aceita centenas de MB. Projetos antigos do localStorage são migrados sozinhos.
     Ponto fraco: "limpar dados do site" apaga. Por isso existe a camada 2.

  2. PASTA NO COMPUTADOR — via API do server.js (`npm start`). Grava arquivos .json de verdade numa pasta
     escolhida em Configurações, com versões antigas guardadas. Se a pasta estiver dentro do Google Drive /
     OneDrive / Dropbox, o próprio programa deles sobe para a nuvem.

 Este módulo só sabe LER/GRAVAR; quem decide QUANDO salvar é o store (auto-salvar) e o main.js (menus).
```

- **`DB_NAME`** <sub>do módulo</sub> · [L21](../src/storage.js#L21) — Nome do banco IndexedDB e da "tabela" chave→valor dentro dele.
- **`DOC_KEY`** <sub>do módulo</sub> · [L24](../src/storage.js#L24) — Chave do registro do projeto atual.
- **`LEGACY_KEY`** <sub>do módulo</sub> · [L26](../src/storage.js#L26) — Chave antiga do localStorage (versões ≤ 0.5). Lida uma vez para migrar.
- **`PREF_KEY`** <sub>do módulo</sub> · [L28](../src/storage.js#L28) — Preferências de interface (largura dos painéis, auto-salvar na pasta...) — pequenas, ficam no localStorage.
- **`db()`** <sub>do módulo</sub> · [L33](../src/storage.js#L33) — Abre (uma vez) o banco IndexedDB. Rejeita se o navegador não oferecer (ex.: algumas janelas anônimas).
- **`tx(mode, fn)`** <sub>do módulo</sub> · [L45](../src/storage.js#L45) — Executa uma operação numa transação e devolve o resultado como Promise.
- **`useIdb`** <sub>do módulo</sub> · [L58](../src/storage.js#L58) — Usa o IndexedDB? Se falhar uma vez, caímos para o localStorage pelo resto da sessão.
- **`loadLocal()`** · [L64](../src/storage.js#L64) — Lê o projeto guardado no navegador. Ordem: IndexedDB → (migração) localStorage antigo → null.
  - ↩︎ `Promise<{doc, views?, theme?, link?, savedAt?` \|null>}
- **`saveLocal(record)`** · [L87](../src/storage.js#L87) — Grava o projeto no navegador. `record` = { doc, views, theme, link }. No IndexedDB o objeto é copiado na hora da chamada (structured clone), então pode continuar sendo editado. Depois da primeira gravação bem-sucedida no IndexedDB, apaga a cópia antiga do localStorage (migração concluída).
- **`browserUsage()`** · [L105](../src/storage.js#L105) — Espaço usado/disponível para este site (quando o navegador informa).
- **`requestPersistence()`** · [L118](../src/storage.js#L118) — Pede ao navegador para NÃO apagar os dados deste site quando faltar espaço (armazenamento "persistente"). O Chrome costuma aceitar sozinho para sites usados com frequência; o Firefox pode perguntar.
- **`loadPrefs()`** · [L124](../src/storage.js#L124) — Lê as preferências de interface (objeto vazio se não houver ou estiverem corrompidas).
- **`savePrefs(prefs)`** · [L128](../src/storage.js#L128) — Grava as preferências (falha em silêncio: são só conveniências).
- **`call(path, { method = 'GET', body, headers = {}, raw = false } = {})`** <sub>do módulo</sub> · [L139](../src/storage.js#L139) — Faz um pedido à API e devolve o JSON (ou lança ServerError com a mensagem do servidor).
- **`fileNameFor(name)`** · [L155](../src/storage.js#L155) — Converte o nome do projeto num nome de arquivo aceito pelo servidor: "Meu App!" → "meu-app.json".
- **`serialize(doc)`** <sub>do módulo</sub> · [L164](../src/storage.js#L164) — Projeto pronto para gravar em arquivo: o MESMO formato do "Baixar .json" (um arquivo baixado pode ir para a pasta e vice-versa).
- **`folder`** · [L170](../src/storage.js#L170) — API da pasta. Todas as funções lançam ServerError quando o servidor recusa e TypeError quando não há servidor (ex.: o app foi aberto por outro servidor estático, como `python -m http.server`).

---

## src/store.js

**ESTADO CENTRAL, HISTÓRICO (DESFAZER) E SALVAMENTO** · [abrir o código](../src/store.js)

```text
 É o "cérebro" do app: guarda o documento e o estado da interface, expõe como consultar (get, parentOf,
 selected...) e como alterar (update/commit), mantém o histórico de desfazer/refazer e salva sozinho no
 (via `persist`, ver storage.js). Nenhum outro módulo guarda estado próprio do documento; todos pedem ao store.

 REGRA DE OURO: nunca altere uma camada "por fora". Use `store.update(fn)` e, ao terminar o gesto,
 `store.commit()` — é isso que faz o desfazer, o salvamento e os painéis funcionarem.
```

- **`createStore({ initial = null, persist = async () => 'browser' } = {})`** · [L36](../src/store.js#L36) — Cria o STORE: a única fonte de verdade do app. Tudo que o usuário vê (canvas, painéis, menus) é uma função do que está aqui; e toda mudança passa por aqui. Fluxo:

    ação do usuário → store.update(...)/commit() → emit(motivo) → quem assina (canvas, painéis) redesenha

  O que o store guarda:
    state.doc  → o DOCUMENTO (o que é salvo): páginas, camadas, imagens, estilos
    state.ui   → estado de INTERFACE (não é salvo no .json): seleção, ferramenta, zoom, painel aberto...
  - `[opts]` <sub>object</sub> — 
  - `[opts.initial]` <sub>object\|null</sub> — projeto já carregado do navegador ({ doc, views, theme, link }) — ver storage.loadLocal. null/ausente = abre o projeto de exemplo.
  - `[opts.persist]` <sub>(record) => Promise<string></sub> — grava o projeto (navegador e, se ligado, a pasta). Devolve onde gravou ('browser' \| 'folder'). O store só decide QUANDO salvar; o COMO fica em main.js/storage.js.
  - ↩︎ `object` a API do store (get, update, commit, undo, setSelection, subscribe...)
- **`emit(reason)`** <sub>interna</sub> · [L102](../src/store.js#L102) — Avisa que algo mudou, dizendo o MOTIVO ('doc' | 'selection' | 'view' | 'tool' | 'history' | 'ui' | 'overlay' | 'hover'...). Dois canais de entrega, de propósito:

   - síncrono (subscribeSync): o canvas e o overlay precisam estar em dia ANTES do próximo evento do mouse,
     senão medem o DOM desatualizado durante um arrasto;
   - 1x por frame (subscribe): painéis pesados (camadas, propriedades) juntam vários motivos em uma só atualização.
- **`index()`** <sub>interna</sub> · [L127](../src/store.js#L127) — Índice id → { node, parent, list, i, page } de TODAS as camadas de todas as páginas. É reconstruído só quando `version` mudou (estrutura nova), o que torna get(id) barato mesmo com milhares de camadas. `list` é o array onde o nó vive (page.children ou parent.children) e `i` a posição dele nesse array.
- **`snapshot()`** <sub>interna</sub> · [L182](../src/store.js#L182) — Foto do documento para o histórico. Não inclui `assets` (imagens só entram, nunca saem) para ser leve.
- **`restore(snap)`** <sub>interna</sub> · [L210](../src/store.js#L210) — Volta o documento para uma foto do histórico (usado por desfazer/refazer). Mantém a seleção do que ainda existe.
- **`scheduleSave()`** <sub>interna</sub> · [L320](../src/store.js#L320) — Agenda o salvamento automático para 400 ms depois da ÚLTIMA mudança (debounce): editar 50 vezes seguidas grava só 1 vez. Marca saveState='saving' para o topo mostrar "Salvando…".
- **`save()`** <sub>interna</sub> · [L335](../src/store.js#L335) — Grava o projeto chamando `persist` (navegador + pasta, ver main.js). Só UMA gravação por vez: se algo mudar enquanto grava, marcamos `dirtyAgain` e gravamos de novo ao terminar (a última versão nunca se perde). Se falhar, saveState vira 'error' e `onSaveError` avisa o usuário.
  - ↩︎ `Promise<void>` resolve quando o projeto (como estava) terminou de ser gravado
- **`init()`** <sub>interna</sub> · [L385](../src/store.js#L385) — Estado inicial: usa o projeto que main.js já leu do navegador (`initial`); se não houver, abre o exemplo. Campos novos (assets, styles) são preenchidos para aceitar projetos salvos por versões antigas do app.

---

## src/svg.js

**EXPORTAÇÃO SVG VETORIAL   (módulo puro: sem DOM)** · [abrir o código](../src/svg.js)

```text
 Reescreve uma camada e seus filhos como SVG (não é "HTML dentro de SVG": são formas de verdade, editáveis em
 Illustrator/Inkscape/Figma). A posição dos filhos vem de um callback para respeitar flexbox/grid.
 Testado em tests/features.test.js.
```

- **`n2(v)`** <sub>do módulo</sub> · [L15](../src/svg.js#L15) — Arredonda para 2 casas decimais (mantém o SVG enxuto).
- **`esc(s)`** <sub>do módulo</sub> · [L17](../src/svg.js#L17) — Escapa & < > " para colocar texto do usuário com segurança dentro do SVG.
- **`roundedRect(w, h, r)`** <sub>do módulo</sub> · [L23](../src/svg.js#L23) — Caminho SVG de um retângulo com 4 raios independentes [tl, tr, br, bl] (arcos A nos cantos). Cada raio é limitado à metade da menor dimensão, como o CSS faz com border-radius.
- **`shapeD(node, w, h)`** <sub>do módulo</sub> · [L32](../src/svg.js#L32) — Contorno (atributo `d`) de uma camada em coordenadas locais (0,0)–(w,h): elipse como 2 arcos, vetor com seus pontos escalados para a caixa, e o resto como retângulo arredondado.
- **`toSvg(root, { assets = {}, boxOf = (n) => ({ x: n.x, y: n.y, w: n.w, h: n…)`** · [L55](../src/svg.js#L55) — ★ Exporta uma camada (e filhos) como SVG VETORIAL de verdade (formas, textos, gradientes, sombras, máscaras).

  Diferença para o PNG/HTML: aqui TUDO é reescrito em SVG. Como o SVG não tem flexbox/grid, a posição e o tamanho
  de cada filho vêm de `boxOf(node, parent)` — no editor, essa função MEDE o DOM, então o resultado respeita o
  auto layout exatamente como está na tela. Sem `boxOf` usa node.x/y/w/h.

  Limitações conhecidas: sombras internas e `backdrop-filter` (vidro) não existem em SVG e são omitidos;
  contorno "dentro/fora" é aproximado encolhendo/expandindo a forma.
  - `root` <sub>object</sub> — camada raiz (vira o tamanho do SVG)
  - ↩︎ `string` documento SVG
- **`paint(fill, w, h)`** <sub>interna</sub> · [L66](../src/svg.js#L66) — Atributo `fill` SVG de um preenchimento. Gradientes viram <linearGradient>/<radialGradient> em <defs> e o fill referencia por url(#id). O ângulo CSS (0° = para cima) vira o vetor x1,y1→x2,y2. Imagens são tratadas à parte.
- **`strokeAttr(st)`** <sub>interna</sub> · [L84](../src/svg.js#L84) — Atributos de contorno SVG (cor, espessura, opacidade e tracejado/pontilhado via stroke-dasharray).
- **`filterAttr(node)`** <sub>interna</sub> · [L94](../src/svg.js#L94) — Sombra externa e blur da camada como <filter> (feDropShadow + feGaussianBlur). stdDeviation = blur/2 porque o "blur" do CSS corresponde a ~2× o desvio-padrão do SVG. A área do filtro é ampliada (−50%…200%) para a sombra não ser cortada.
- **`textSvg(node, w, h)`** <sub>interna</sub> · [L111](../src/svg.js#L111) — Texto em SVG: uma <tspan> por linha (SVG não quebra linha sozinho). Calcula o deslocamento vertical para 'centro'/'embaixo' quando a caixa tem altura fixa e aplica text-transform na própria string (SVG não tem isso).
- **`imageSvg(fill, w, h, src)`** <sub>interna</sub> · [L136](../src/svg.js#L136) — Conteúdo SVG de uma IMAGEM de fundo dentro da caixa w×h, imitando o CSS do editor:

   - cover/contain/fill → <image preserveAspectRatio>; a posição (posX/posY) vira o alinhamento mais próximo entre 3
     (início/meio/fim) — o SVG não tem posição em %, então nesses ajustes é uma aproximação;
   - tamanho próprio ('size') → posição e tamanho EXATOS (usa natW/natH, o tamanho original guardado ao escolher a
     imagem); com repeat vira <pattern> (ladrilho). Sem natW/natH cai no "cobrir".
  (Repetir junto com "conter" não é exportado: sai uma imagem só.)
- **`shapeSvg(node, w, h)`** <sub>interna</sub> · [L162](../src/svg.js#L162) — Forma + contorno de retângulo/elipse/frame/vetor. Retângulos sem cantos viram <rect> simples (mais limpo); com cantos/elipse/vetor viram <path>. Imagem: <image> recortada pela forma, com o mesmo `fit` do editor.
- **`render(node, parent, isRoot)`** <sub>interna</sub> · [L210](../src/svg.js#L210) — Converte UMA camada (recursivo) em <g>. Ordem das transformações: posição (translate) → rotação em torno do centro → espelhamento. Frames com "cortar conteúdo" recortam os filhos por <clipPath>; grupos com máscara usam a forma da camada-máscara como clipPath.

---

## src/svgimport.js

**IMPORTA SVG COMO VETORES EDITÁVEIS** · [abrir o código](../src/svgimport.js)

```text
 Transforma um arquivo/texto SVG em camadas do editor (vetores 'path', textos e grupos), em vez de uma imagem
 "chapada". Usado ao arrastar/abrir um .svg, ao colar SVG copiado (Figma, Illustrator, sites de ícones) e pelo
 painel de ícones do Google.

 Como funciona:
  1. o navegador lê o XML (DOMParser);
  2. percorremos os elementos acumulando a TRANSFORMAÇÃO (matrix/translate/scale/rotate/skew, e o viewBox) e o
     ESTILO herdado (atributos, style="", e regras simples de <style> por classe/tag/id);
  3. cada forma vira contornos de Bézier cúbica — o mesmo formato da caneta (pontos com alças hin/hout):
     rect/circle/ellipse/line/polyline/polygon/path (M L H V C S Q T A Z, absolutos e relativos);
     arcos (A) e curvas quadráticas (Q/T) são convertidos em cúbicas;
  4. cada forma vira UM vetor (com todos os seus contornos, para furos funcionarem: ver css.js → nodePathData).

 SOMBRAS: filtros de sombra no formato que o Figma exporta (feOffset + feGaussianBlur + feColorMatrix + feBlend,
 inclusive várias sombras) e <feDropShadow> viram sombras de verdade do editor. Fontes com nome "técnico"
 (PostScript, como o Illustrator exporta: "Poppins-Bold", "ArialMT") viram família + peso + itálico.

 O que NÃO é importado (contamos e avisamos): outros filtros, máscaras, padrões, imagens embutidas, texto em curva,
 <use> para fora do arquivo, animações. Gradientes viram gradiente linear/radial aproximado (pela direção).

 As funções de geometria (parsePathD, applyMatrix, parseTransform...) são PURAS e têm testes em tests/.
```

- **`multiply(m1, m2)`** · [L37](../src/svgimport.js#L37) — m1 × m2 (aplica m2 primeiro, depois m1).
- **`apply(m, x, y)`** <sub>do módulo</sub> · [L43](../src/svgimport.js#L43) — Aplica a matriz a um ponto.
- **`scaleOf(m)`** <sub>do módulo</sub> · [L45](../src/svgimport.js#L45) — Quanto a matriz "estica" em média (para escalar a espessura do traço).
- **`parseTransform(text)`** · [L51](../src/svgimport.js#L51) — Lê o atributo transform="..." (pode ter várias funções em sequência) e devolve a matriz.
  - `text` <sub>string</sub> — ex.: "translate(10 20) rotate(45) scale(2)"
- **`parsePathD(d)`** · [L80](../src/svgimport.js#L80) — Lê o `d` de um <path> e devolve contornos no formato do editor:

    [{ points: [{ x, y, hin, hout }], closed }]
  Cada segmento curvo vira alças nos pontos das pontas (hout de quem sai, hin de quem chega).
  - `d` <sub>string</sub> — 
- **`arcToCubics(x1, y1, rx, ry, angle, largeArc, sweep, x2, y2)`** · [L166](../src/svgimport.js#L166) — Arco elíptico do SVG (comando A) → lista de curvas cúbicas [c1x, c1y, c2x, c2y, x, y], cada uma com até 90°. Conversão "ponta → centro" da especificação SVG (apêndice F.6) e aproximação clássica de arco por Bézier.
- **`transformContours(contours, m)`** · [L201](../src/svgimport.js#L201) — Aplica uma matriz a todos os pontos e alças de uma lista de contornos (Bézier é preservada por transformações afins).
- **`K`** <sub>do módulo</sub> · [L207](../src/svgimport.js#L207) — Contornos de formas básicas (já no formato do editor). k = constante para aproximar ¼ de círculo por Bézier.
- **`contoursBounds(contours)`** · [L230](../src/svgimport.js#L230) — Limites (aproximados pelas curvas) de vários contornos.
- **`colorCtx`** <sub>do módulo</sub> · [L250](../src/svgimport.js#L250) — Contexto 2D reaproveitado por parseColor para traduzir nomes de cor (criado só na primeira vez).
- **`parseColor(value)`** · [L252](../src/svgimport.js#L252) — Converte qualquer cor CSS ("red", "rgb(...)", "#abc") em { color: '#RRGGBB', alpha }. Usa o canvas do navegador.
- **`STYLE_PROPS`** <sub>do módulo</sub> · [L280](../src/svgimport.js#L280) — Propriedades de estilo que nos interessam (e que são herdadas pelos filhos no SVG).
- **`NOT_INHERITED`** <sub>do módulo</sub> · [L283](../src/svgimport.js#L283) — `opacity` e `display` não são herdados (cada elemento tem o seu); o resto é.
- **`parseStyleSheets(doc)`** <sub>do módulo</sub> · [L286](../src/svgimport.js#L286) — Lê as regras de <style> mais simples (".classe", "tag", "#id" e listas separadas por vírgula).
- **`parseDecl(text)`** <sub>do módulo</sub> · [L302](../src/svgimport.js#L302) — "fill:red; stroke: blue" → { fill: 'red', stroke: 'blue' }
- **`PS_WEIGHTS`** <sub>do módulo</sub> · [L313](../src/svgimport.js#L313) — Sufixos de estilo nos nomes PostScript → peso.
- **`resolveFontName(raw)`** · [L323](../src/svgimport.js#L323) — Converte o nome de fonte que veio no SVG em { family, weight?, italic? }.

    "'Poppins-Bold'" → Poppins 700 · "OpenSans-SemiBoldItalic" → Open Sans 600 itálico · "ArialMT" → Arial
  Nomes que já são famílias conhecidas passam direto. Desconhecidos ficam como vieram.
  - `raw` <sub>string</sub> — valor de font-family (pode ter lista com vírgulas e aspas)
- **`importSvg(text, { name, currentColor = '#111111', fill, size } = {})`** · [L351](../src/svgimport.js#L351) — Converte um SVG (texto) em UMA camada do editor (vetor, ou grupo de vetores), posicionada em (0,0).
  - `text` <sub>string</sub> — conteúdo do arquivo .svg
  - `[opts]` <sub>object</sub> — 
  - `[opts.name]` <sub>string</sub> — nome da camada (padrão: <title> do SVG ou "SVG importado")
  - `[opts.currentColor]` <sub>string</sub> — cor usada onde o SVG diz "currentColor" (ícones usam muito)
  - `[opts.fill]` <sub>string</sub> — cor para formas SEM preenchimento declarado (o padrão do SVG é preto). Os ícones do Google não declaram cor nenhuma: o painel de ícones passa aqui a cor escolhida.
  - `[opts.size]` <sub>number</sub> — redimensiona para caber neste tamanho (o maior lado)
  - ↩︎ `{ node: object, skipped: number, ignored: string[] ` }  node = camada pronta para inserir; skipped = quantos detalhes foram ignorados; ignored = O QUE foi ignorado, em português (ex.: ['sombra interna', 'máscara'])
- **`skip(what)`** <sub>interna</sub> · [L361](../src/svgimport.js#L361) — Registra algo do SVG que não deu para importar (o aviso ao usuário diz o quê).
- **`whatTag(tag)`** <sub>interna</sub> · [L363](../src/svgimport.js#L363) — Nome legível de um elemento não suportado.
- **`styleOf(el, parent)`** <sub>interna</sub> · [L379](../src/svgimport.js#L379) — Estilo calculado de um elemento: herdado do pai + regras de <style> + atributos + style="" (nessa ordem de força).
- **`fillOf(value, opacity, st)`** <sub>interna</sub> · [L393](../src/svgimport.js#L393) — Preenchimento do editor a partir de "fill" (cor, none, currentColor, url(#gradiente)).
- **`gradientOf(el, opacity)`** <sub>interna</sub> · [L410](../src/svgimport.js#L410) — <linearGradient>/<radialGradient> → gradiente do editor (direção aproximada; segue href="#outro" para pegar os stops).
- **`shadowsOf(f)`** <sub>interna</sub> · [L441](../src/svgimport.js#L441) — Lê um <filter> e devolve as SOMBRAS que ele descreve (ou null se for outro tipo de filtro). Formato do Figma: para cada sombra, feOffset (dx, dy) → feGaussianBlur (desfoque = 2 × stdDeviation) → [feMorphology = spread] → [feComposite arithmetic = sombra interna] → feColorMatrix (cor nos valores 5, 10, 15 e opacidade no 19) → feBlend (fecha a sombra). Também aceita <feDropShadow>.
- **`emitShape(contours, el, st, m)`** <sub>interna</sub> · [L470](../src/svgimport.js#L470) — Uma forma (já em contornos no espaço do elemento) → vetor do editor.
- **`emitText(el, st, m)`** <sub>interna</sub> · [L502](../src/svgimport.js#L502) — <text> simples (sem texto em curva) → camada de texto do editor.
- **`walk(el, m, parentStyle, depth = 0)`** <sub>interna</sub> · [L528](../src/svgimport.js#L528) — Percorre a árvore do SVG acumulando transformação e estilo.
- **`label(tag)`** <sub>do módulo</sub> · [L592](../src/svgimport.js#L592) — Nome legível do tipo de elemento.
- **`round(v)`** <sub>do módulo</sub> · [L594](../src/svgimport.js#L594) — Arredonda para 2 casas (coordenadas e tamanhos).

---

## src/thumbnail.js

**MINIATURA DO PROJETO (SVG) PARA A PÁGINA INICIAL** · [abrir o código](../src/thumbnail.js)

```text
 Reaproveita o exportador SVG (svg.js): monta um "grupo de mentira" com todas as camadas da raiz da página
 aberta e converte em SVG. As posições vêm do DOM do canvas (commands.localBox), então auto layout aparece
 certinho. Só funciona para a página que está NO CANVAS (é ela que está medida no DOM).

 Cuidados:
  - imagens grandes são trocadas por um retângulo cinza: a miniatura precisa ser leve (é gravada a cada
    salvamento na pasta e baixada pela página inicial);
  - dentro de <img>, um SVG não carrega fontes da web: os textos usam fontes do sistema (é só uma prévia).
```

- **`MAX_IMAGE`** <sub>do módulo</sub> · [L19](../src/thumbnail.js#L19) — Imagens maiores que isto (em caracteres do data URL) viram retângulo cinza na miniatura.
- **`GRAY`** <sub>do módulo</sub> · [L21](../src/thumbnail.js#L21) — PNG 1×1 cinza (#9aa0a6), usado no lugar das imagens grandes.
- **`pageThumbnail(store, commands)`** · [L29](../src/thumbnail.js#L29) — SVG da página aberta (todas as camadas visíveis da raiz), ou null se a página estiver vazia.
  - `store` <sub>object</sub> — 
  - `commands` <sub>object</sub> — usa commands.localBox para medir cada camada no DOM
  - ↩︎ `string\|null`

---

## src/tools.js

**INTERAÇÃO: MOUSE E TECLADO NO CANVAS** · [abrir o código](../src/tools.js)

```text
 Seleção, mover (com snap e reordenação de auto layout), redimensionar, rotacionar, desenhar, marquee,
 pan/zoom, edição de texto, guias e TODOS os atalhos de teclado.

 PADRÃO DE UM GESTO
   pointerdown → escolhe o gesto e guarda o estado inicial em `drag`
   pointermove → recalcula a partir do estado inicial (nunca acumula) e atualiza o documento ao vivo
   pointerup   → `store.commit()` UMA vez: um Ctrl+Z desfaz o gesto inteiro

 Este arquivo NÃO desenha nada (isso é overlay.js/canvas.js) e delega operações que mexem na árvore
 (agrupar, duplicar, alinhar...) para commands.js.
```

- **`DRAW_TOOLS`** <sub>do módulo</sub> · [L23](../src/tools.js#L23) — Ferramentas em que clicar/arrastar no canvas CRIA uma camada nova.
- **`TOOL_KEYS`** <sub>do módulo</sub> · [L25](../src/tools.js#L25) — Atalho de teclado → ferramenta (V mover, F/B frame, R retângulo, E elipse, T texto, H mão, P caneta, L linha).
- **`THRESHOLD`** <sub>do módulo</sub> · [L27](../src/tools.js#L27) — Quantos px de tela o mouse precisa andar para um clique virar ARRASTO (evita mover sem querer ao clicar).
- **`clone(v)`** <sub>do módulo</sub> · [L29](../src/tools.js#L29) — Cópia profunda via JSON (usada para guardar o estado inicial de um gesto).
- **`createTools({ store, canvas, commands, viewport, toast })`** · [L43](../src/tools.js#L43) — Cria as FERRAMENTAS: toda a interação do usuário com o canvas via mouse e teclado.

  Funciona como uma máquina de estados simples: `drag` guarda o gesto em andamento
  (null | 'pan' | 'move' | 'resize' | 'rotate' | 'draw' | 'marquee' | 'pen' | 'guide'):
    pointerdown → decide o que o clique significa e preenche `drag`
    pointermove → atualiza o documento ao vivo conforme o tipo de `drag` (sem histórico)
    pointerup   → encerra o gesto e dá UM `store.commit()` (um Ctrl+Z desfaz o gesto inteiro)
  - ↩︎ `{startEdit, finishEdit, copyCss, toggleProp, zoomTo, pen` } funções que a interface (menus/botões) também usa
- **`nodeAt(target)`** <sub>interna</sub> · [L55](../src/tools.js#L55) — id da camada sob um elemento do DOM (sobe até o .node mais próximo), ou null se for fundo/overlay.
- **`pickSelectable(id)`** <sub>interna</sub> · [L62](../src/tools.js#L62) — Qual camada um CLIQUE seleciona. Regra do Figma: grupos são uma peça só — clicar num filho seleciona o GRUPO; duplo clique (ou Ctrl+clique) "entra" e seleciona o filho. Se algo dentro do grupo já está selecionado, clicar noutro filho do mesmo grupo seleciona esse filho direto.
- **`frameUnder(clientX, clientY, { sections = false } = {})`** <sub>interna</sub> · [L77](../src/tools.js#L77) — Frame mais fundo sob o ponteiro (ou null = fundo do canvas). Usa `elementsFromPoint` e IGNORA o overlay (alças, rótulos: eles ficam embaixo do cursor durante o arrasto e atrapalhariam) e o que está sendo arrastado. Serve para saber em qual frame uma camada foi solta/desenhada. Com `sections: true` a SEÇÃO também conta como destino (só frames da raiz entram em seções).
- **`colorUnder(clientX, clientY)`** <sub>interna</sub> · [L91](../src/tools.js#L91) — Cor (sólida) que está VISÍVEL sob o ponteiro: a da camada mais de cima ali (ou de um pai dela) com preenchimento sólido e opaco. null = o fundo do canvas. Usada para a forma nova não nascer da mesma cor do que está embaixo.
- **`luma(hex)`** <sub>interna</sub> · [L103](../src/tools.js#L103) — Brilho percebido de uma cor #RRGGBB (0 = preto, 1 = branco).
- **`backdropOf(parent)`** <sub>interna</sub> · [L113](../src/tools.js#L113) — Cor de fundo visível atrás das camadas de um frame: o preenchimento sólido dele ou do ancestral mais próximo.
- **`refreshAutoFill(node)`** <sub>interna</sub> · [L124](../src/tools.js#L124) — Cor AUTOMÁTICA (escolhida pelo app, nunca mexida por você) se reajusta quando a camada muda de lugar: um retângulo criado fora e arrastado para dentro de uma sidebar da mesma cor sumiria. `node.autoFill` guarda a cor padrão do tipo e a cor que o app escolheu; se você trocou a cor, ela não bate mais e nada acontece.
- **`setDragIds(nodes)`** <sub>interna</sub> · [L148](../src/tools.js#L148) — Marca as camadas arrastadas (e descendentes): recebem a classe CSS 'dragging' (pointer-events:none), assim `elementsFromPoint` enxerga o que está EMBAIXO delas. Aplica direto no DOM (o próximo render só vem depois).
- **`collectIds(n)`** <sub>interna</sub> · [L154](../src/tools.js#L154) — ids de uma camada e de todos os descendentes.
- **`capture(e)`** <sub>interna</sub> · [L157](../src/tools.js#L157) — "Pointer capture": faz o viewport continuar recebendo o mouse mesmo que ele saia da janela durante o arrasto.
- **`startEdit(id)`** <sub>interna</sub> · [L165](../src/tools.js#L165) — Entra no modo de edição de texto da camada (o canvas dá foco e seleciona tudo; ver canvas.js → render).
- **`finishEdit()`** <sub>interna</sub> · [L174](../src/tools.js#L174) — Sai da edição de texto. Texto vazio apaga a camada (sem sobrar caixa invisível); senão grava no histórico.
- **`startPan(e)`** <sub>interna</sub> · [L202](../src/tools.js#L202) — Começa a arrastar a vista (botão do meio, Espaço+arrastar ou ferramenta Mão).
- **`startMove(e, { collapseTo })`** <sub>interna</sub> · [L327](../src/tools.js#L327) — Prepara o arrasto de mover as camadas selecionadas. `collapseTo`: se for só um clique (sem arrastar) numa seleção múltipla, reduz a seleção a essa camada.
- **`rebase(nodes)`** <sub>interna</sub> · [L342](../src/tools.js#L342) — Guarda o ponto de partida dos itens em coordenadas de MUNDO (origem + caixa). A posição final é sempre "origem inicial + deslocamento do ponteiro − origem do pai atual", então continua certa mesmo que o pai mude no meio do arrasto (quando a camada passa por cima de outro frame).
- **`snapCandidates()`** <sub>interna</sub> · [L352](../src/tools.js#L352) — Retângulos com os quais o item que se move pode "grudar" (snap): os irmãos e o pai. Calculado uma vez por arrasto (cache em drag.snapRects) porque os vizinhos não mudam enquanto você arrasta.
- **`snapMove(dx, dy)`** <sub>interna</sub> · [L370](../src/tools.js#L370) — SNAP: ajusta o deslocamento (dx, dy) para que bordas e centros do item alinhem com os dos vizinhos e com as guias de régua, quando estiverem a menos de 6px de TELA (6/zoom no mundo). Devolve também as linhas-guia rosa a desenhar onde houve alinhamento exato. Ctrl desliga o snap (no chamador).
  - ↩︎ `{dx:number, dy:number, guides:object[]` }
- **`flowReorder(node, p, parent = store.parentOf(node.id))`** <sub>interna</sub> · [L411](../src/tools.js#L411) — Dentro de um auto layout o item NÃO tem posição livre; arrastar significa REORDENAR. Acha o irmão cujo centro está mais perto do ponteiro e põe o item antes ou depois dele (conforme o ponteiro esteja antes/depois do centro dele no eixo principal). Funciona também com flex-wrap, porque usa distância 2D.
- **`moveDrag(e)`** <sub>interna</sub> · [L441](../src/tools.js#L441) — Cada movimento do mouse durante o gesto "mover". Passos: 1. passou do limiar? Se Alt estava pressionado, duplica e passa a arrastar as cópias 2. se o ponteiro entrou noutro frame, troca o pai da camada (mantendo a posição visual) 3. calcula o deslocamento (Shift trava o eixo), aplica snap (Ctrl desliga) 4. aplica: camadas livres recebem x/y; camadas em auto layout são reordenadas 5. camadas em auto layout ganham um "fantasma" (CSS `translate`) que segue o ponteiro
- **`startResize(e, handle)`** <sub>interna</sub> · [L533](../src/tools.js#L533) — Prepara o redimensionar. `hx`/`hy` dizem qual lado a alça move: hx=+1 direita, −1 esquerda; hy=+1 baixo, −1 cima (0 = não mexe nesse eixo; alça 'e' é hx=1,hy=0; canto 'nw' é hx=−1,hy=−1). Guarda o estado inicial para recalcular tudo a partir dele a cada movimento (evita acumular erro de arredondamento).
- **`resizeDrag(e)`** <sub>interna</sub> · [L559](../src/tools.js#L559) — Cada movimento do mouse ao redimensionar.

   - UMA camada: converte o deslocamento do mouse para os eixos LOCAIS da camada (desfazendo a rotação), muda w/h e
     recalcula x/y para que o lado OPOSTO (a âncora) fique parado no mundo — funciona com a camada girada.
     Shift mantém a proporção; Alt redimensiona a partir do centro.
   - VÁRIAS camadas: escala o conjunto pela caixa envolvente.
   - Grupos escalam os filhos; frames reaplicam as constraints dos filhos a partir do tamanho original.
- **`snapResize(dx, dy, hx, hy)`** <sub>interna</sub> · [L657](../src/tools.js#L657) — SNAP do redimensionar: só a borda que a alça move (direita/esquerda, baixo/cima) procura um alvo a menos de 6px de tela — bordas e centro do frame pai e dos vizinhos, e as guias da régua. É o que deixa você fazer uma camada exatamente do tamanho do frame (ou alinhada com a de cima) sem precisar acertar o pixel.
  - ↩︎ `{dx:number, dy:number, guides:object[]` } deslocamento do mouse já ajustado + linhas rosa a desenhar
- **`startRotate(e)`** <sub>interna</sub> · [L702](../src/tools.js#L702) — Prepara a rotação: guarda o centro da camada (em px de tela), a rotação inicial e o ângulo do mouse em relação ao centro.
- **`rotateDrag(e)`** <sub>interna</sub> · [L718](../src/tools.js#L718) — Rotação = rotação inicial + (ângulo atual do mouse − ângulo inicial). Shift prende em múltiplos de 15°. Resultado em −180..180.
- **`startDraw(e, tool)`** <sub>interna</sub> · [L733](../src/tools.js#L733) — Começa a desenhar com a ferramenta ativa. O frame sob o cursor vira o PAI da camada nova (posição relativa a ele). Retângulo/elipse/frame/linha já nascem no documento (tamanho 1) e crescem durante o arrasto, para você ver ao vivo. Texto, polígono e estrela só são criados ao soltar.
- **`drawDrag(e)`** <sub>interna</sub> · [L773](../src/tools.js#L773) — Durante o desenho: ajusta a camada ao retângulo arrastado (Shift = quadrado/ângulos de 15°; Alt = a partir do centro). A linha é um segmento girado; polígono/estrela mostram só o retângulo-guia (marquee) até soltar.
- **`finishDraw(d, e)`** <sub>interna</sub> · [L817](../src/tools.js#L817) — Ao soltar o mouse com uma ferramenta de desenho. Um clique SEM arrastar cria o tamanho padrão (frame 320×240, retângulo/elipse 100×100, linha 100px, polígono/estrela 100×100). Texto entra direto em edição. A ferramenta volta para Mover (como no Figma).
- **`adoptIntoSection(sec)`** <sub>interna</sub> · [L863](../src/tools.js#L863) — Seção recém-desenhada "adota" as telas da raiz que ficaram TOTALMENTE dentro dela: elas passam a ser filhas da seção (e andam junto com ela), mantendo a posição visual e a ordem entre si. Telas só parcialmente dentro ficam de fora.
- **`enterFlow(node)`** <sub>interna</sub> · [L878](../src/tools.js#L878) — Forma recém-desenhada dentro de um auto layout (estava "solta" durante o arrasto): entra na fila na posição mais próxima de onde foi desenhada — entre os dois itens em volta do centro dela (flowReorder).
- **`guideDrag(e)`** <sub>interna</sub> · [L888](../src/tools.js#L888) — Arrasta uma guia de régua já existente (atualiza a posição ao vivo; soltar sobre a régua apaga — ver endDrag).
- **`startMarquee(e, scope, clickId)`** <sub>interna</sub> · [L902](../src/tools.js#L902) — Começa o retângulo de seleção por arrasto. `scope` = id do frame raiz onde o arrasto começou (seleciona só filhos dele) ou null (seleciona camadas da raiz). `clickId` = camada a selecionar se foi só um clique.
- **`marqueeDrag(e)`** <sub>interna</sub> · [L913](../src/tools.js#L913) — Atualiza o marquee e a seleção. Regra do Figma: frames da raiz só entram se estiverem TOTALMENTE dentro do retângulo; as demais camadas entram ao serem tocadas. Shift soma à seleção anterior.
- **`endDrag(e)`** <sub>interna</sub> · [L988](../src/tools.js#L988) — POINTER UP / CANCEL: encerra o gesto. Cada tipo faz sua limpeza e quase todos terminam com UM `store.commit()` — por isso um Ctrl+Z desfaz o arrasto/redimensionamento INTEIRO, não pixel a pixel. Também limpa guias, marquee e destaque temporários do overlay.
- **`isTyping(t)`** <sub>interna</sub> · [L1091](../src/tools.js#L1091) — O foco está num campo onde o usuário DIGITA (input, select, texto editável)? Então os atalhos do canvas não devem agir.
- **`covered()`** <sub>interna</sub> · [L1097](../src/tools.js#L1097) — O canvas está "coberto"? (página inicial aberta ou uma janela modal: Configurações, Projetos, pergunta...) Então NENHUM atalho do canvas pode agir — senão um Delete com o foco num botão da janela apagaria camadas escondidas atrás dela.
- **`MARKER`** <sub>interna</sub> · [L1276](../src/tools.js#L1276) — COPIAR/COLAR com a área de transferência do sistema. Camadas copiadas ficam na memória do app (ui.clipboard); no sistema colocamos só este texto-marcador, para o "colar" saber que é para colar CAMADAS e não texto.
- **`toggleProp(prop)`** <sub>interna</sub> · [L1303](../src/tools.js#L1303) — Alterna 'locked' ou 'visible' nas camadas selecionadas: se alguma não está no estado alvo, aplica a todas; senão desfaz em todas.
- **`copyCss()`** <sub>interna</sub> · [L1311](../src/tools.js#L1311) — Ctrl+Shift+C: copia o CSS das camadas selecionadas para a área de transferência do sistema.
- **`zoomTo(z)`** <sub>interna</sub> · [L1323](../src/tools.js#L1323) — Define o zoom (1 = 100%) ancorado no centro da vista.
- **`applyTool()`** <sub>interna</sub> · [L1329](../src/tools.js#L1329) — Reflete a ferramenta ativa no DOM (muda o cursor por CSS: [data-tool=…]).

---

## src/ui/assets.js

**ABA "RECURSOS" (COMPONENTES E ESTILOS)** · [abrir o código](../src/ui/assets.js)

- **`createAssetsPanel({ store, commands, canvas, container })`** · [L19](../src/ui/assets.js#L19) — Cria a aba RECURSOS (painel esquerdo): três listas do documento —

   - Componentes: clicar insere uma instância no centro da tela
   - Cores: estilos de cor; clicar aplica à seleção; +, renomear e excluir
   - Tipografia: estilos de texto; idem
  Mudar um estilo muda todas as camadas ligadas a ele (ver components.js → syncStyles).
- **`section(title, add, body)`** <sub>interna</sub> · [L25](../src/ui/assets.js#L25) — Seção da lista: título, botão "+" opcional e linhas.
- **`components()`** <sub>interna</sub> · [L29](../src/ui/assets.js#L29) — Todos os componentes principais do documento (de qualquer página), com a página de cada um.
- **`render()`** <sub>interna</sub> · [L36](../src/ui/assets.js#L36) — Reconstrói as três listas a partir do documento (só roda com a aba aberta).

---

## src/ui/code.js

**ABA "CÓDIGO" (CSS E HTML DA SELEÇÃO)** · [abrir o código](../src/ui/code.js)

- **`esc(s)`** <sub>do módulo</sub> · [L11](../src/ui/code.js#L11) — Escapa & < > para exibir código dentro de <pre> sem o navegador interpretar como HTML.
- **`highlightCss(code)`** <sub>do módulo</sub> · [L17](../src/ui/code.js#L17) — Colore o CSS (só visual): seletor `.classe`, nome da propriedade, números/unidades e cores #hex. Cada etapa escapa o HTML antes de inserir os <span> de cor, então o texto do usuário nunca vira marcação.
- **`highlightHtml(code)`** <sub>do módulo</sub> · [L26](../src/ui/code.js#L26) — Colore o HTML (só visual): nomes de tag e atributos/valores.
- **`createCodePanel({ store, commands, toast })`** · [L37](../src/ui/code.js#L37) — Cria o painel CÓDIGO: mostra o CSS ou o HTML REAIS da seleção (ou da página inteira, se nada está selecionado). É a mesma saída de `generateCode` usada na exportação, então o que você copia aqui é o que o navegador está usando. Opção "Incluir filhos" liga/desliga as camadas internas; "Copiar" manda para a área de transferência.
- **`render()`** <sub>interna</sub> · [L63](../src/ui/code.js#L63) — Gera o código das camadas-alvo e mostra colorido. Só roda com a aba Código aberta (ver subscribe abaixo).

---

## src/ui/dom.js

**CRIAR ELEMENTOS + COMPONENTES DE FORMULÁRIO** · [abrir o código](../src/ui/dom.js)

```text
 O app não usa framework: a interface é feita com `h()` (criar elementos) e alguns componentes
 reutilizáveis (campo numérico com arrastar-para-ajustar, cor, lista suspensa, botões segmentados).
 Todo componente de formulário devolve { el, update }: `el` é o elemento e `update()` relê o valor do
 documento — é assim que o painel de propriedades se mantém em dia sem recriar tudo a cada mudança.
```

- **`h(tag, attrs, ...children)`** · [L26](../src/ui/dom.js#L26) — `h` = "hyperscript": cria elementos DOM com uma sintaxe curta (substitui um framework como React para este app).

    h('button.btn.primary', { type: 'button', onclick: fazer }, ico('play'), ' Texto')

   - 1º argumento: "tag.classe1.classe2" (sem tag = div)
   - 2º argumento (opcional): atributos. Chaves "onXxx" viram ouvintes de evento; `html` define innerHTML; `style` aceita
     objeto; `dataset` define data-*; o resto vira propriedade do elemento (ou atributo).
   - demais argumentos: filhos (elementos, textos ou listas aninhadas; null/false são ignorados)
  Se o 2º argumento já for um filho (elemento/texto/lista), é tratado como filho.
- **`ico(name, size = 16)`** · [L52](../src/ui/dom.js#L52) — Ícone SVG pronto para usar como filho: ico('trash', 14). Os desenhos estão em icons.js.
- **`clamp(v, min, max)`** · [L55](../src/ui/dom.js#L55) — Limita `v` ao intervalo [min, max].
- **`numField({ label, title, get, set, commit, min = -Infinity, max = Infinity, …)`** · [L77](../src/ui/dom.js#L77) — CAMPO NUMÉRICO no estilo Figma:

   - digite um valor ou uma CONTA simples ("100/2", "24+8" — só dígitos e + - * / ( ) são aceitos)
   - ↑/↓ mudam 1 (Shift = 10) · Enter confirma · Esc cancela
   - ARRASTAR o rótulo (a letra à esquerda) ajusta o valor: Shift = ×10, Alt = ×0.1

  Quando o valor muda (`set`) ele NÃO entra no histórico (é "ao vivo"); só ao terminar (Enter, sair do campo ou soltar
  o arrasto) chama `commit` — assim um Ctrl+Z desfaz a edição inteira.
  - `o` <sub>object</sub> — 
  - `o.label` <sub>string</sub> — letra/símbolo à esquerda (também serve de "alça" de arrasto)
  - `[o.title]` <sub>string</sub> — dica ao passar o mouse (costuma ser a propriedade CSS)
  - `o.get` <sub>() => number</sub> — lê o valor atual
  - `o.set` <sub>(v:number) => void</sub> — aplica um valor (sem histórico)
  - `[o.commit]` <sub>() => void</sub> — fecha a edição (histórico)
  - `[o.min]` <sub>number</sub> — [o.max] [o.step] [o.decimals] [o.unit] [o.width] [o.disabled]
  - `[o.nullable]` <sub>boolean</sub> — true: campo vazio = sem valor (`set(null)`); `get` pode devolver null
  - `[o.placeholder]` <sub>string</sub> — texto cinza quando vazio (ex.: "sem limite")
  - ↩︎ `{el: HTMLElement, update: () => void, input: HTMLInputElement` } `update` relê o valor sem atrapalhar quem está digitando
- **`fmt(v)`** <sub>interna</sub> · [L86](../src/ui/dom.js#L86) — Número → texto no campo (arredondado às casas decimais, com unidade).
- **`parse(txt)`** <sub>interna</sub> · [L91](../src/ui/dom.js#L91) — Texto → número. Aceita vírgula decimal e contas. Segurança: só passa para Function() se o texto tiver APENAS dígitos e operadores (regex abaixo), então nenhum código arbitrário consegue ser executado.
- **`textField({ get, set, commit, placeholder = '', mono = false })`** · [L161](../src/ui/dom.js#L161) — Campo de texto simples (usado para nomes e links). Mesma ideia: `set` ao digitar, `commit` ao terminar.
- **`selectField({ options, get, set, commit, title, label })`** · [L170](../src/ui/dom.js#L170) — Lista suspensa estilizada. `options`: [[valor, rótulo], ...]. Ao escolher, aplica e já grava no histórico.
- **`segmented({ options, get, set, commit })`** · [L180](../src/ui/dom.js#L180) — Grupo de botões de ícone onde um fica "ligado" (ex.: alinhamento de texto). `options`: [[valor, ícone, dica], ...].
- **`TIP_DELAY`** <sub>do módulo</sub> · [L194](../src/ui/dom.js#L194) — Quanto o mouse precisa ficar parado em cima antes da dica aparecer (ms): evita piscar ao atravessar o painel.
- **`hideTip()`** <sub>do módulo</sub> · [L201](../src/ui/dom.js#L201) — Esconde a dica e cancela a que estava agendada.
- **`showTip(target)`** <sub>do módulo</sub> · [L208](../src/ui/dom.js#L208) — Mostra a dica ao lado do elemento: à esquerda (o painel fica à direita da tela) ou, sem espaço, à direita/embaixo.
- **`installTips()`** <sub>do módulo</sub> · [L239](../src/ui/dom.js#L239) — Liga os ouvintes globais das dicas (uma única vez).
- **`tip(el, { title, css = '', text = '' })`** · [L264](../src/ui/dom.js#L264) — Liga uma dica rica a um elemento. Remove o `title` nativo dele e dos filhos (senão as duas dicas apareceriam).
  - `el` <sub>HTMLElement</sub> — o elemento que mostra a dica ao passar o mouse
  - ↩︎ `HTMLElement` o próprio `el` (para usar inline)
- **`iconButton(name, title, onclick, cls = '')`** · [L275](../src/ui/dom.js#L275) — Botão só com ícone. `cls` opcional ('small', 'on'...).
- **`PALETTES`** <sub>do módulo</sub> · [L282](../src/ui/dom.js#L282) — Paletas prontas que aparecem no seletor de cor, em grupos.
- **`toHex({ r, g, b })`** <sub>do módulo</sub> · [L288](../src/ui/dom.js#L288) — {r,g,b} (0–255) → "#RRGGBB".
- **`rgb2hsv({ r, g, b })`** <sub>do módulo</sub> · [L290](../src/ui/dom.js#L290) — {r,g,b} (0–255) → {h: 0–360, s: 0–1, v: 0–1}.
- **`hsv2rgb({ h: hh, s, v })`** <sub>do módulo</sub> · [L302](../src/ui/dom.js#L302) — {h,s,v} → {r,g,b} (0–255).
- **`closeColorPicker()`** · [L312](../src/ui/dom.js#L312) — Fecha o seletor de cor aberto, se houver.
- **`openColorPicker({ anchor, get, set, commit, groups })`** <sub>do módulo</sub> · [L320](../src/ui/dom.js#L320) — Abre o SELETOR DE COR: um popover com a área saturação/brilho, a barra de matiz, o campo HEX, o conta-gotas e grupos de cores (as do projeto, os estilos de cor e paletas prontas). Aplica ao vivo (`set`) e grava o histórico (`commit`) ao soltar. Fecha ao clicar fora, com Esc ou quando o campo que o abriu some do painel.
  - `[]` <sub>{anchor: HTMLElement, get: () => string, set: (hex: string) => void, commit?: () => void, groups?: () => {title: string, colors: string[]</sub> — }} o
- **`paint()`** <sub>interna</sub> · [L332](../src/ui/dom.js#L332) — Redesenha knobs, fundo da área e campo hex a partir do HSV.
- **`apply()`** <sub>interna</sub> · [L344](../src/ui/dom.js#L344) — Aplica a cor atual do HSV ao campo (ao vivo).
- **`drag(el, fn)`** <sub>interna</sub> · [L346](../src/ui/dom.js#L346) — Arrasto numa área/barra: `fn(x, y)` recebe a posição relativa 0–1; grava no histórico ao soltar.
- **`pick(c)`** <sub>interna</sub> · [L359](../src/ui/dom.js#L359) — Escolhe uma cor pronta (chip): atualiza HSV, aplica e grava.
- **`colorRow({ get, set, commit, opacity, setOpacity, groups })`** · [L410](../src/ui/dom.js#L410) — Linha de COR: amostra clicável (abre o seletor de cor próprio, com grupos de cores) + campo HEX + (opcional) opacidade em % + conta-gotas (onde o navegador oferece `EyeDropper`). Aceita hex de 3 ou 6 dígitos, com ou sem "#". `groups` (opcional): função que devolve grupos extras de cores para o seletor ([{title, colors}]).
- **`sync()`** <sub>interna</sub> · [L435](../src/ui/dom.js#L435) — Atualiza amostra, seletor e campo hex a partir do valor atual (sem mexer no hex enquanto digitam).

---

## src/ui/fontpicker.js

**SELETOR DE FONTES (Google Fonts + fontes do sistema)** · [abrir o código](../src/ui/fontpicker.js)

```text
 Um campo que mostra a fonte atual (escrita nela mesma). Ao clicar, abre uma caixa flutuante com:
  - busca por nome; filtros por categoria (sans, serif, display, manuscrita, mono);
  - lista com PRÉVIA de cada fonte no próprio estilo (só as fontes que aparecem na tela são baixadas, e só as
    letras do nome: ver fonts.js → loadPreview);
  - teclado: ↑/↓ escolhem, Enter aplica, Esc fecha.
 As mais usadas aparecem primeiro; as do sistema ficam no topo quando a busca está vazia.
```

- **`CATS`** <sub>do módulo</sub> · [L18](../src/ui/fontpicker.js#L18) — Categorias (rótulo na tela → valor salvo na lista).
- **`PAGE`** <sub>do módulo</sub> · [L20](../src/ui/fontpicker.js#L20) — Quantas linhas por vez (a lista tem quase 2 mil fontes).
- **`fontField({ get, set })`** · [L31](../src/ui/fontpicker.js#L31) — Campo de fonte para o painel de propriedades.
  - ↩︎ `{el: HTMLElement, update: () => void` }
- **`openPicker(anchor, current, onPick)`** <sub>do módulo</sub> · [L47](../src/ui/fontpicker.js#L47) — Abre a caixa de escolha embaixo de `anchor`.
- **`close()`** <sub>do módulo</sub> · [L134](../src/ui/fontpicker.js#L134) — Fecha a caixa aberta (se houver).

---

## src/ui/googleicons.js

**PAINEL "ÍCONES" (Material Symbols, os ícones do Google)** · [abrir o código](../src/ui/googleicons.js)

```text
 Aba do painel esquerdo. Busca entre os 4.299 ícones (lista embutida em src/data/material-icons.js), com
 estilo (contorno, arredondado, reto), versão preenchida, cor e tamanho. Clicar num ícone baixa o SVG dele
 de fonts.gstatic.com e insere como VETOR EDITÁVEL (svgimport.js): dentro do frame selecionado, ou no meio
 da tela. Depois de inserido, o ícone é um desenho do projeto: funciona sem internet.

 Licença: Material Symbols são do Google, sob Apache 2.0 — pode usar em qualquer projeto, inclusive comercial.
```

- **`iconUrl(name, style, filled)`** <sub>do módulo</sub> · [L18](../src/ui/googleicons.js#L18) — Endereço do SVG de um ícone no servidor de arquivos do Google (responde com CORS liberado).
- **`POPULAR`** <sub>do módulo</sub> · [L22](../src/ui/googleicons.js#L22) — Os mais usados aparecem primeiro quando a busca está vazia.
- **`PAGE`** <sub>do módulo</sub> · [L30](../src/ui/googleicons.js#L30) — Quantos ícones mostrar por vez (a lista toda são milhares de imagens).
- **`PT`** <sub>do módulo</sub> · [L33](../src/ui/googleicons.js#L33) — Sinônimos em português → termos em inglês da lista do Google (a busca aceita os dois).
- **`createIconsPanel({ commands, container, toast })`** · [L53](../src/ui/googleicons.js#L53) — Cria a aba "Ícones": busca nos Material Symbols (aceita palavras em português), escolha de estilo, cor e tamanho, e insere o ícone escolhido como vetor editável (commands.insertSvg).
  - `deps` <sub>object</sub> — 
  - `deps.commands` <sub>object</sub> — usa commands.insertSvg
  - `deps.container` <sub>HTMLElement</sub> — 
  - `deps.toast` <sub>(m: string) => void</sub> — 
- **`matches()`** <sub>interna</sub> · [L61](../src/ui/googleicons.js#L61) — Ícones que casam com a busca (em inglês ou pelos sinônimos em português).
- **`insert(name)`** <sub>interna</sub> · [L74](../src/ui/googleicons.js#L74) — Baixa (ou pega do cache) e insere o ícone como vetor.

---

## src/ui/home.js

**PÁGINA INICIAL (os seus projetos)** · [abrir o código](../src/ui/home.js)

```text
 Uma tela cheia por cima do editor, no estilo "tela de arquivos" do Figma/Penpot:
   - CONTINUAR: o projeto aberto agora, com miniatura ao vivo e onde ele está salvo;
   - NA PASTA: os projetos da pasta (miniatura, nome, data, tamanho), com busca, ordenação e um menu ⋯
     por projeto (abrir, renomear, duplicar, versões);
   - EXEMPLOS: os dois projetos de exemplo.
 Abre ao iniciar o app (dá para desligar em Configurações) e pelo logo / Arquivo → Página inicial.
 Enquanto está aberta, o editor fica `inert` (nem o mouse nem o teclado alcançam) e os atalhos do canvas
 ficam desligados (ui.homeOpen, ver tools.js → covered()).
```

- **`when(ms)`** <sub>do módulo</sub> · [L22](../src/ui/home.js#L22) — "há 5 min", "há 3 h", "ontem", ou a data.
- **`baseName(file)`** <sub>do módulo</sub> · [L32](../src/ui/home.js#L32) — Nome bonito a partir do arquivo: "meu-app.json" → "meu-app".
- **`hue(text)`** <sub>do módulo</sub> · [L35](../src/ui/home.js#L35) — Cor de fundo estável por nome (para os projetos sem miniatura não ficarem todos iguais).
- **`thumbBox(name, src)`** <sub>do módulo</sub> · [L42](../src/ui/home.js#L42) — Miniatura de um card: a imagem SVG (se houver) ou uma "capa" com a inicial do nome.
- **`createHome({ store, saving, canvas, thumbnail, toast, openSettings, openProjec…)`** · [L66](../src/ui/home.js#L66) — Cria a PÁGINA INICIAL: cards dos projetos da pasta (com miniatura, busca, renomear, duplicar), "continuar de onde parou" e exemplos. Abre por cima do editor e o deixa inativo (inert) enquanto estiver aberta.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — , deps.saving, deps.canvas
  - `deps.thumbnail` <sub>() => string\|null</sub> — miniatura da página aberta (thumbnail.js)
  - `deps.toast` <sub>(m: string) => void</sub> — 
  - `deps.openSettings` <sub>() => void</sub> — 
  - `deps.openProjects` <sub>(mode) => void</sub> — 
  - `deps.confirmReplace` <sub>(q: string) => Promise<boolean></sub> — pergunta antes de trocar o projeto aberto
  - `deps.importFile` <sub>() => void</sub> — abre o seletor de .json do computador
  - `[]` <sub>{ blank: () => void, samples: {label, description, load</sub> — }} deps.create
- **`close()`** <sub>interna</sub> · [L75](../src/ui/home.js#L75) — Fecha a página inicial e devolve o editor (foco no canvas para os atalhos voltarem a funcionar).
- **`open()`** <sub>interna</sub> · [L89](../src/ui/home.js#L89) — Abre (ou redesenha) a página inicial.
- **`onKey(e)`** <sub>interna</sub> · [L107](../src/ui/home.js#L107) — Esc fecha (volta ao editor); "/" foca a busca, como em muitos apps.
- **`refreshList()`** <sub>interna</sub> · [L116](../src/ui/home.js#L116) — Busca a lista da pasta e redesenha a grade.
- **`replaceWith(question, action)`** <sub>interna</sub> · [L127](../src/ui/home.js#L127) — Troca o projeto aberto por `action` (abrir da pasta, exemplo, novo), perguntando antes se for perder algo.
- **`openFile(file)`** <sub>interna</sub> · [L139](../src/ui/home.js#L139) — Abre um projeto da pasta. Se já é o aberto, só volta ao editor.
- **`renderGrid()`** <sub>interna</sub> · [L211](../src/ui/home.js#L211) — Só a grade de projetos da pasta (redesenhada ao buscar/ordenar sem perder o foco do campo de busca).
- **`card(p)`** <sub>interna</sub> · [L228](../src/ui/home.js#L228) — Card de um projeto da pasta: clique abre; ⋯ abre o menu; no modo "renomear", o nome vira um campo.

---

## src/ui/icons.js

**ÍCONES SVG (inline, sem dependências)** · [abrir o código](../src/ui/icons.js)

- **`P`** <sub>do módulo</sub> · [L11](../src/ui/icons.js#L11) — Os desenhos dos ícones, só o miolo do SVG (viewBox 24×24, traço de 1.8px herdando a cor do texto). Estilo "linha": mesmo traço e cantos arredondados em todos, para a interface ficar coesa.
- **`icon(name, size = 16)`** · [L100](../src/ui/icons.js#L100) — Markup SVG completo de um ícone pelo nome (ver `P`). Nome inexistente gera um SVG vazio em vez de quebrar.
  - `name` <sub>string</sub> — 
  - `[size=16]` <sub>number</sub> — px
- **`nodeIcon(type)`** · [L104](../src/ui/icons.js#L104) — Ícone usado na lista de camadas para cada tipo de camada.

---

## src/ui/layers.js

**PAINEL DE PÁGINAS E CAMADAS** · [abrir o código](../src/ui/layers.js)

- **`createLayersPanel({ store, commands, container })`** · [L21](../src/ui/layers.js#L21) — Cria o painel de CAMADAS (aba esquerda): lista de páginas + árvore de camadas.

  Na árvore, a camada MAIS À FRENTE aparece no TOPO (a lista é o array de trás para a frente). Cada linha tem: setinha
  (abrir/fechar), ícone, nome (duplo clique renomeia), cadeado e olho. Dá para ARRASTAR linhas para reordenar ou
  aninhar (soltar no meio de um frame coloca dentro dele; na borda de cima/baixo põe antes/depois).
- **`renderPages()`** <sub>interna</sub> · [L44](../src/ui/layers.js#L44) — Desenha a lista de páginas. Clique abre; duplo clique renomeia; botão direito abre o menu (renomear, duplicar, excluir). A última página não pode ser excluída (todo projeto tem ao menos uma).
- **`expandAncestors(ids)`** <sub>interna</sub> · [L92](../src/ui/layers.js#L92) — Abre as pastas que contêm as camadas selecionadas, para que a seleção fique visível na lista. Devolve true se algo mudou. (Guardamos `false` explicitamente: o padrão de "fechado" só vale para pastas nunca abertas.)
- **`isCollapsed(node, depth)`** <sub>interna</sub> · [L103](../src/ui/layers.js#L103) — Camadas dentro de frames começam FECHADAS (só os níveis de cima aparecem); selecionar abre o caminho. `ui.collapsed[id]` tem prioridade.
- **`rowFor(node, depth)`** <sub>interna</sub> · [L110](../src/ui/layers.js#L110) — Cria a linha de UMA camada (com todos os ouvintes: seleção, renomear, menu, arrastar e soltar).
  - `node` <sub>object</sub> — a camada
  - `depth` <sub>number</sub> — nível de aninhamento (recuo de 14px por nível)
- **`setAll(node, value)`** <sub>interna</sub> · [L240](../src/ui/layers.js#L240) — Alt+clique na setinha: abre ou fecha tudo dentro (recursivo).
- **`dropZone(e, row, node)`** <sub>interna</sub> · [L249](../src/ui/layers.js#L249) — Em qual "zona" da linha o mouse está: nos 25% de cima 'above', nos 25% de baixo 'below' e no meio 'inside' (só para frames/grupos, que aceitam filhos).
- **`clearDrop()`** <sub>interna</sub> · [L256](../src/ui/layers.js#L256) — Remove os indicadores visuais de soltura de todas as linhas.
- **`renderTree()`** <sub>interna</sub> · [L263](../src/ui/layers.js#L263) — Reconstrói a árvore. Percorre cada lista de trás para a frente (para a camada da frente ficar no topo) e só desce em pastas abertas. Com texto na busca, mostra uma lista plana das camadas cujo nome contém o texto. Preserva a posição de rolagem.
- **`signature()`** <sub>interna</sub> · [L297](../src/ui/layers.js#L297) — "Impressão digital" do que a lista MOSTRA (ids, nomes, visibilidade, trava, pastas abertas, seleção...). Se não mudou desde o último desenho (ex.: só a posição de uma camada mudou durante um arrasto), pulamos a reconstrução da lista — foi isso que tornou o arrastar fluido com centenas de camadas.
- **`render(reasons)`** <sub>interna</sub> · [L316](../src/ui/layers.js#L316) — Atualiza o painel só se algo visível mudou. Se a seleção mudou, abre as pastas dela; ao selecionar pelo canvas, rola a lista até a camada.

---

## src/ui/menus.js

**MENUS FLUTUANTES, JANELAS MODAIS E AJUDA DE ATALHOS** · [abrir o código](../src/ui/menus.js)

- **`closeMenus()`** · [L15](../src/ui/menus.js#L15) — Fecha o menu aberto, se houver.
- **`showMenu(x, y, items, { anchorRight = false } = {})`** · [L28](../src/ui/menus.js#L28) — Mostra um menu flutuante em (x, y), mantendo-o dentro da janela. Fecha ao clicar fora ou apertar Esc.
  - `x` <sub>number</sub> — 
  - `y` <sub>number</sub> — 
  - `items` <sub>(object\|'sep')[]</sub> — { label, hint (atalho), icon, onClick, disabled, danger, checked, heading } ou 'sep' (separador). `heading: true` = título de seção, só texto.
- **`contextMenuItems({ store, commands, tools })`** · [L89](../src/ui/menus.js#L89) — Itens do menu de botão direito, calculados para a seleção ATUAL (itens que não se aplicam ficam desabilitados). Os mesmos comandos existem como atalhos; o hint mostra a tecla (⌘ no Mac, Ctrl nos demais).
- **`SHORTCUTS`** <sub>do módulo</sub> · [L129](../src/ui/menus.js#L129) — Texto da janela "Atalhos de teclado": [seção, [[tecla, descrição], ...]]. Mantenha em sincronia com tools.js e o README.
- **`modalSeq`** <sub>do módulo</sub> · [L141](../src/ui/menus.js#L141) — Contador para dar um id único ao título de cada janela (aria-labelledby).
- **`openModal({ title, body, cls = '', onClose })`** · [L155](../src/ui/menus.js#L155) — JANELA MODAL acessível, usada pela ajuda, Configurações e Projetos:

   - role="dialog" + aria-modal + título ligado por aria-labelledby (leitores de tela anunciam o nome);
   - o foco vai para o primeiro campo/botão e fica PRESO dentro (Tab/Shift+Tab dão a volta);
   - fecha com Esc, no X ou clicando fora; ao fechar, o foco volta para quem abriu.
  - `o` <sub>object</sub> — 
  - `o.title` <sub>string</sub> — título (h2)
  - `o.body` <sub>Node\|Node[]</sub> — conteúdo
  - `[o.cls]` <sub>string</sub> — classe extra para o .modal (ex.: 'narrow')
  - `[o.onClose]` <sub>() => void</sub> — 
  - ↩︎ `{ el: HTMLElement, close: () => void ` }
- **`ask({ title, message, buttons })`** · [L202](../src/ui/menus.js#L202) — PERGUNTA no visual do app (substitui o `confirm()` do navegador, que é cinza, feio e não dá para ter 3 botões). Devolve uma Promise com o `value` do botão escolhido, ou null se a pessoa fechou (Esc, X, clique fora).

    const r = await ask({ title: 'Substituir?', message: 'Texto...', buttons: [
      { label: 'Cancelar', value: null }, { label: 'Substituir', value: 'ok', primary: true } ] });

  O botão `primary` recebe o foco (Enter confirma); `danger` pinta de vermelho (ações que apagam algo).
  - `[]` <sub>{title: string, message: string\|Node\|Node[], buttons: {label: string, value: any, primary?: boolean, danger?: boolean</sub> — }} o
  - ↩︎ `Promise<any>`
- **`askText({ title, label, value = '', confirm = 'OK' })`** · [L223](../src/ui/menus.js#L223) — Pede UM TEXTO numa janela do app (substitui o `prompt()` do navegador). Enter confirma, Esc cancela.
  - ↩︎ `Promise<string\|null>` o texto digitado, ou null se cancelou
- **`showHelp()`** · [L243](../src/ui/menus.js#L243) — Abre a janela de ajuda com todos os atalhos. Fecha com Esc, no X ou clicando fora.

---

## src/ui/projects.js

**JANELA "PROJETOS NA PASTA" (salvar com nome, abrir, versões antigas)** · [abrir o código](../src/ui/projects.js)

```text
 Aberta por Arquivo → Abrir da pasta (Ctrl+O), por Ctrl+S na primeira vez (para dar um nome) e por
 Arquivo → Salvar como (Ctrl+Shift+S).
 Em cima: campo "Salvar como" com o nome do arquivo. Embaixo: os projetos da pasta, do mais recente ao mais
 antigo, com "Abrir" e "Versões" (as cópias antigas que o servidor guarda; dá para abrir qualquer uma).
```

- **`when(ms)`** <sub>do módulo</sub> · [L19](../src/ui/projects.js#L19) — Data relativa curta: "agora", "há 5 min", "há 3 h", ou a data/hora completa.
- **`openProjects({ store, saving, canvas, toast, openSettings, confirmReplace = asyn…)`** · [L38](../src/ui/projects.js#L38) — Abre a janela.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.saving` <sub>object</sub> — ver saving.js
  - `deps.canvas` <sub>object</sub> — para "ajustar tudo" depois de abrir
  - `deps.toast` <sub>(m: string) => void</sub> — 
  - `deps.openSettings` <sub>() => void</sub> — 
  - `[deps.confirmReplace]` <sub>(q: string) => Promise<boolean></sub> — pergunta antes de trocar o projeto aberto (main.js)
  - `[deps.mode='open']` <sub>'open'\|'save'</sub> — 'save' = o foco vai para o nome (Ctrl+S / Salvar como)

---

## src/ui/props.js

**PAINEL "DESIGN" (PROPRIEDADES DA SELEÇÃO)** · [abrir o código](../src/ui/props.js)

```text
 Os campos usam os nomes do CSS (gap, padding, justify-content, align-items, opacity, mix-blend-mode...) de propósito:
 quem usa o painel aprende CSS sem perceber, e o código gerado bate com o que está escrito aqui.
```

- **`createDesignPanel({ store, canvas, commands, tools, toast })`** · [L34](../src/ui/props.js#L34) — Cria o painel DESIGN (aba direita): editor das propriedades da seleção, com nomes e valores do CSS.

  COMO FUNCIONA (importante para entender o arquivo):
   - Cada seção (alinhar, camada, auto layout, texto, preenchimento, contorno, efeitos, exportar) é uma função que
     CONSTRÓI os campos uma vez e registra, em `updaters`, como RELER o valor de cada campo do documento.
   - `render()` só reconstrói os campos quando a ESTRUTURA muda (outra seleção, outro tipo de preenchimento, +1 sombra...),
     detectado pela `signature()`. Em qualquer outra mudança só roda os `updaters` — assim digitar num campo nunca
     perde o foco por o painel ter sido refeito.
   - Campos usam `each(fn)` para aplicar a mudança a TODAS as camadas selecionadas (valores mostrados vêm da 1ª).
- **`commit()`** <sub>interna</sub> · [L61](../src/ui/props.js#L61) — Fecha a edição (grava no histórico). Passado aos campos para chamarem ao terminar.
- **`reg(ctl)`** <sub>interna</sub> · [L63](../src/ui/props.js#L63) — Registra o `update` de um campo e devolve o elemento dele (para usar direto como filho).
- **`row(...c)`** <sub>interna</sub> · [L65](../src/ui/props.js#L65) — Linha horizontal de campos.
- **`section(title, body, actions)`** <sub>interna</sub> · [L67](../src/ui/props.js#L67) — Seção do painel: título + (ações opcionais à direita, ex.: botão +) + corpo.
- **`cap(label, ...c)`** <sub>interna</sub> · [L71](../src/ui/props.js#L71) — Grupo "legenda pequena em cima + controle embaixo" (visual do Figma: "Posição", "Dimensões", "Opacidade"...).
- **`check(label, get, set)`** <sub>interna</sub> · [L79](../src/ui/props.js#L79) — Caixa de seleção (checkbox) estilizada: `get` lê, `set` aplica; grava no histórico ao alternar.
- **`pickImage(cb)`** <sub>interna</sub> · [L87](../src/ui/props.js#L87) — Abre o seletor de arquivos, importa a imagem escolhida (reduzida) e entrega { assetId, w, h } ao callback.
- **`alignRow()`** <sub>interna</sub> · [L98](../src/ui/props.js#L98) — Linha de alinhar (esquerda/centro/direita, topo/meio/base) e distribuir (precisa de 3+ camadas). Fica dentro da seção Posição.
- **`PRESETS`** <sub>interna</sub> · [L114](../src/ui/props.js#L114) — Tamanhos prontos para frames da raiz (telas e formatos comuns). Valor "LxA".
- **`H_CONS`** <sub>interna</sub> · [L121](../src/ui/props.js#L121) — Opções de constraint horizontal e vertical (ver model.js → applyConstraints).
- **`NO_RADIUS`** <sub>interna</sub> · [L124](../src/ui/props.js#L124) — Tipos que não têm cantos arredondados no painel (elipse já é redonda; texto/linha/vetor/grupo não têm cantos).
- **`positionSection()`** <sub>interna</sub> · [L130](../src/ui/props.js#L130) — Seção "Posição": X/Y (ou a caixa do conjunto, com várias camadas), constraints (em frame sem auto layout), rotação e espelhar. Dentro de um auto layout, X/Y ficam apagados: quem posiciona é o navegador (flex/grid).
- **`sizeSection()`** <sub>interna</sub> · [L169](../src/ui/props.js#L169) — Seção "Tamanho": W/H (+ travar proporção), modo de largura/altura (fixo / hug = do tamanho do conteúdo / fill = preenche o espaço do auto layout) e, em frames da raiz, os tamanhos prontos (celular, desktop...).
- **`ASPECTS`** <sub>interna</sub> · [L212](../src/ui/props.js#L212) — Proporções prontas do select (valor = largura/altura; 'atual' usa o tamanho de agora).
- **`limitsBlock(n0)`** <sub>interna</sub> · [L221](../src/ui/props.js#L221) — "Limites e proporção": min/max de largura e altura (CSS min-width, max-width, min-height, max-height) e aspect-ratio. Fica recolhido (abre sozinho se algum já está em uso). Campo vazio = sem limite. Em medidas FIXAS o valor é limitado na hora; em Hug/Fill quem obedece é o navegador (o canvas mede de volta).
- **`appearanceSection()`** <sub>interna</sub> · [L258](../src/ui/props.js#L258) — Seção "Aparência": opacidade, mistura (mix-blend-mode), cantos arredondados (border-radius, juntos ou um por canto), cortar conteúdo (overflow: hidden) e máscara.
- **`componentSection()`** <sub>interna</sub> · [L287](../src/ui/props.js#L287) — Seção "Componente": criar componente / (no principal) criar instância / (na instância) ir ao principal e desanexar.
- **`prop(name, ctl, title)`** <sub>interna</sub> · [L310](../src/ui/props.js#L310) — Linha "propriedade CSS → controle": o nome da propriedade à esquerda (em fonte mono, igual ao código gerado) e o campo à direita. Assim o painel lê como CSS: quem sabe CSS reconhece; quem não sabe aprende o nome certo.
- **`A_START`** <sub>interna</sub> · [L312](../src/ui/props.js#L312) — Opções de alinhamento (valores do modelo = os do flexbox; no grid o css.js traduz flex-start → start).
- **`CSS_DOC`** <sub>interna</sub> · [L315](../src/ui/props.js#L315) — Explicações (em português) das propriedades CSS do auto layout: alimentam as dicas e a caixa "CSS ao vivo".
- **`cssTip(key)`** <sub>interna</sub> · [L345](../src/ui/props.js#L345) — Monta o objeto de dica de uma propriedade do CSS_DOC.
- **`capK(label, key, ...children)`** <sub>interna</sub> · [L347](../src/ui/props.js#L347) — Grupo com legenda em português + nome da propriedade CSS (mono) e dica rica ao passar o mouse na legenda e no controle.
- **`autoLayoutSection()`** <sub>interna</sub> · [L359](../src/ui/props.js#L359) — Seção "Auto layout": modo em 4 cartões (livre / linha / coluna / grade), uma caixa "CSS ao vivo" com o CSS REAL que o frame está gerando agora e os controles agrupados por assunto. Cada coisa tem uma dica ao passar o mouse (título, CSS e explicação), para quem usa perceber: "isso aqui é CSS puro".

   - FLEX: gap, flex-wrap, padding, justify-content (eixo principal) e align-items (eixo cruzado);
   - GRID: colunas/linhas, gap, padding e justify-items/align-items (onde o item fica DENTRO da célula).
- **`pad(labels)`** <sub>interna</sub> · [L412](../src/ui/props.js#L412) — Campos de padding de vários lados (T/R/B/L = topo/direita/baixo/esquerda, mesma ordem do CSS).
- **`paddingBlock()`** <sub>interna</sub> · [L418](../src/ui/props.js#L418) — padding: ou 2 campos (horizontal/vertical) ou os 4 lados, alternável pelo botão.
- **`matrix(jName, aName)`** <sub>interna</sub> · [L435](../src/ui/props.js#L435) — Matriz 3×3 do alinhamento: um clique define os dois alinhamentos de uma vez. Em coluna, o eixo principal é o vertical, então linhas e colunas da matriz trocam de papel. A célula ativa é marcada quando os valores coincidem.
- **`opts(list, grid)`** <sub>interna</sub> · [L457](../src/ui/props.js#L457) — Opções de um <select> mostrando o valor CSS de verdade (ex.: "flex-start", "space-between").
- **`subTip(text, key)`** <sub>interna</sub> · [L459](../src/ui/props.js#L459) — Legenda mono pequena com dica (usada acima dos selects de alinhamento).
- **`gridPicker()`** <sub>interna</sub> · [L465](../src/ui/props.js#L465) — Seletor visual de grade 6×6 (como o de tabela de um editor de texto): passar o mouse destaca "colunas × linhas", clicar aplica as duas contagens de uma vez. A grade atual (se couber em 6×6) fica marcada.
- **`autoSection(body)`** <sub>interna</sub> · [L549](../src/ui/props.js#L549) — Casca da seção Auto layout: título + selo "CSS puro" (com dica) à direita.
- **`marginBlock()`** <sub>interna</sub> · [L558](../src/ui/props.js#L558) — "Margem" do item (CSS margin): horizontal/vertical, ou os 4 lados (botão) — igual ao padding do container. Valores zerados somem do documento (e do CSS). Só aparece para itens em fluxo e não absolutos.
- **`flowItemSection()`** <sub>interna</sub> · [L583](../src/ui/props.js#L583) — Seção "Item do layout": só para camadas dentro de auto layout. Mostra as propriedades CSS do FILHO:

   - position: absolute (ignora o layout do pai);
   - grid → grid-column / grid-row (span N), justify-self e align-self (sobrescrevem o justify-items/align-items do pai);
   - flex → align-self (sobrescreve o align-items do pai).
  "stretch" é o mesmo que tamanho "Preencher" naquele eixo, então os dois ficam ligados.
- **`selfSelect(key, axis, list, title)`** <sub>interna</sub> · [L598](../src/ui/props.js#L598) — Select de *-self ligado ao tamanho: stretch ⇔ 'fill' no eixo; outro valor tira o 'fill'.
- **`commandsOrigin(n)`** <sub>interna</sub> · [L623](../src/ui/props.js#L623) — Posição atual da camada relativa ao pai (lida do DOM): usada ao marcar "absoluta" para ela não pular de lugar.
- **`GRID_KINDS`** <sub>interna</sub> · [L631](../src/ui/props.js#L631) — Tipos de grade de layout (só guia visual).
- **`layoutGridsSection()`** <sub>interna</sub> · [L633](../src/ui/props.js#L633) — Seção "Grades de layout" de um frame: lista de grades (colunas/linhas/quadrícula) com quantidade, gutter, margem e cor.
- **`vectorSection()`** <sub>interna</sub> · [L661](../src/ui/props.js#L661) — Seção "Vetor": editar pontos, o ponto selecionado (tipo canto/suave e posição X/Y), caminho fechado, inverter direção e o código SVG (`d`) do desenho — para copiar, ou colar o `d` de outro SVG e trocar a forma.
- **`textSection()`** <sub>interna</sub> · [L720](../src/ui/props.js#L720) — Seção "Texto": estilo compartilhado, fonte, peso, tamanho, altura de linha, espaçamento, alinhamento, itálico, decoração, MAIÚSCULAS e alinhamento vertical.
- **`gradientBar()`** <sub>interna</sub> · [L782](../src/ui/props.js#L782) — Faixa de pré-visualização do gradiente (sempre mostrada em 90° só para ver as cores/posições).
- **`docTopColors(max = 14)`** <sub>interna</sub> · [L792](../src/ui/props.js#L792) — As cores mais usadas no projeto (até `max`), da mais usada para a menos.
- **`colorGroups()`** <sub>interna</sub> · [L804](../src/ui/props.js#L804) — Grupos de cores que o seletor de cor mostra: as do projeto e os estilos de cor (as paletas prontas vêm do próprio seletor).
- **`docColorChips(apply)`** <sub>interna</sub> · [L810](../src/ui/props.js#L810) — Quadradinhos com as cores mais usadas no projeto (até 14): clicar aplica. Só aparece se houver 2+ cores.
- **`fillSection()`** <sub>interna</sub> · [L821](../src/ui/props.js#L821) — Seção "Preenchimento" (ou "Cor do texto" em texto): tipo (nenhum/sólido/linear/radial/imagem) e os campos de cada tipo — cor + estilo de cor; ângulo + paradas do gradiente; imagem + ajuste.
- **`strokeSection()`** <sub>interna</sub> · [L906](../src/ui/props.js#L906) — Seção "Contorno": cor, espessura, estilo (sólido/tracejado/pontilhado) e posição (dentro/centro/fora). O botão +/− liga e desliga.
- **`sidesOn()`** <sub>interna</sub> · [L944](../src/ui/props.js#L944) — O contorno da camada selecionada está "por lado"?
- **`strokeSidesRows(st)`** <sub>interna</sub> · [L950](../src/ui/props.js#L950) — Linhas "Lados" do contorno: atalhos (todos, só em cima, só embaixo, esquerda, direita, em cima e embaixo, nas laterais) e "Personalizado", que mostra a espessura de cada lado. Gera o CSS `border-top`, `border-bottom`...
- **`current()`** <sub>interna</sub> · [L956](../src/ui/props.js#L956) — Qual atalho corresponde aos lados atuais (ou 'custom' se as espessuras forem diferentes entre si).
- **`toggleSide(i)`** <sub>interna</sub> · [L980](../src/ui/props.js#L980) — Liga/desliga um lado: de "todos", o clique escolhe SÓ aquele lado; depois soma/tira; os 4 ligados voltam a "todos".
- **`effectsSection()`** <sub>interna</sub> · [L1012](../src/ui/props.js#L1012) — Seção "Efeitos": lista de sombras (x, y, blur, spread, cor, interna) + blur da camada + desfoque de fundo (vidro).
- **`colorFiltersBlock()`** <sub>interna</sub> · [L1040](../src/ui/props.js#L1040) — Filtros de COR (brightness, contrast, saturate, grayscale, hue-rotate): recolhido, abre sozinho se algum está em uso.
- **`exportSection()`** <sub>interna</sub> · [L1057](../src/ui/props.js#L1057) — Seção "Exportar": escala (1x–4x) e botões PNG, SVG e HTML da seleção.
- **`emptySection()`** <sub>interna</sub> · [L1083](../src/ui/props.js#L1083) — Painel quando nada está selecionado: resumo da página e dicas de atalhos.
- **`signature()`** <sub>interna</sub> · [L1103](../src/ui/props.js#L1103) — "Assinatura" da ESTRUTURA do painel: tudo que, se mudar, exige reconstruir os campos (outra seleção, outro tipo de preenchimento, +1 sombra, layout ligado/desligado...). NÃO inclui valores como a espessura ou o padding — esses só pedem para reler os campos, e reconstruir no meio da digitação faria o campo perder o foco.
- **`render()`** <sub>interna</sub> · [L1128](../src/ui/props.js#L1128) — Reconstrói o painel se a estrutura mudou; em qualquer caso, atualiza os valores dos campos.

---

## src/ui/proto.js

**ABA "PROTÓTIPO" (INTERAÇÕES ENTRE TELAS)** · [abrir o código](../src/ui/proto.js)

- **`createProtoPanel({ store, present, toast })`** · [L17](../src/ui/proto.js#L17) — Cria a aba PROTÓTIPO: para a camada selecionada, lista suas INTERAÇÕES. Cada interação tem gatilho (clicar / passar o mouse), ação (navegar para um frame / voltar / abrir link) e, ao navegar, o frame de destino e a transição. Um frame da raiz pode ser marcado como ponto de partida do fluxo. O botão Apresentar abre o modo de apresentação. Dados das interações: camada.interactions = [{ trigger, action, target, transition, url }] (ver present.js).
- **`rootFrames()`** <sub>interna</sub> · [L22](../src/ui/proto.js#L22) — Frames da raiz de todas as páginas: são os destinos possíveis de "Navegar para".
- **`render()`** <sub>interna</sub> · [L25](../src/ui/proto.js#L25) — Reconstrói a aba para a camada selecionada (só roda com a aba aberta).

---

## src/ui/settings.js

**JANELA "CONFIGURAÇÕES" (onde salvar, versões, cópia no navegador, aparência)** · [abrir o código](../src/ui/settings.js)

```text
 Aberta pela engrenagem do topo, por Arquivo → Configurações ou Ctrl+, (vírgula).
 Seções:
  1. Pasta de projetos  — caminho no computador (o SERVIDOR grava lá), auto-salvar e nº de versões.
     Explica como usar Google Drive/OneDrive/Dropbox: escolher uma pasta sincronizada por eles.
  2. Cópia no navegador — sempre ligada (IndexedDB); mostra o espaço e pede proteção contra limpeza.
  3. Aparência e controles — tema, tela ao abrir o app (página inicial ou editor) e o que a roda do mouse faz.
```

- **`formatBytes(b)`** · [L19](../src/ui/settings.js#L19) — "12345678" bytes → "11,8 MB".
- **`checkbox(label, checked, onchange)`** <sub>do módulo</sub> · [L23](../src/ui/settings.js#L23) — Caixa de seleção no estilo do app (a mesma de props.js).
- **`openSettings({ store, saving, prefs, savePrefs, toast })`** · [L37](../src/ui/settings.js#L37) — Abre a janela de Configurações.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.saving` <sub>object</sub> — ver saving.js (refresh, server)
  - `deps.prefs` <sub>object</sub> — preferências (autoFolder, wheelMode)
  - `deps.savePrefs` <sub>() => void</sub> — 
  - `deps.toast` <sub>(m: string) => void</sub> — 
- **`render()`** <sub>interna</sub> · [L43](../src/ui/settings.js#L43) — Redesenha o conteúdo (chamado ao abrir e depois de cada mudança que o servidor confirma).

---

## server.js

**SERVIDOR LOCAL: ENTREGA O APP E SALVA OS PROJETOS NUMA PASTA DO SEU COMPUTADOR** · [abrir o código](../server.js)

```text
 Duas funções:
  1. ESTÁTICO: entrega index.html, src/ e assets/. O app usa módulos ES (`import ... from`), e o navegador
     não os carrega abrindo o index.html direto do disco (file://); precisa de http://.
  2. API /api/...: grava e lê projetos (.json) numa PASTA que você escolhe em Configurações (padrão:
     ./projetos). Guarda também VERSÕES antigas de cada projeto (no máximo 1 a cada 10 minutos).
     Dica: aponte a pasta para dentro do Google Drive/OneDrive/Dropbox para ter cópia na nuvem.

 Uso:  npm start   →   http://localhost:5173
 Variáveis: PORT (porta), DESIGNER_CONFIG (arquivo de configuração; padrão ./designer.config.json).

 SEGURANÇA (o servidor escreve no seu disco, então isto importa):
  - escuta só em 127.0.0.1: ninguém da sua rede alcança;
  - a API recusa pedidos cujo cabeçalho Host não seja localhost/127.0.0.1 (bloqueia "DNS rebinding":
    um site malicioso fingindo ser localhost);
  - pedidos que ESCREVEM exigem Content-Type JSON e, se vierem de uma página, Origin local. Assim um site
    aberto em outra aba não consegue mandar o servidor gravar nada (o navegador bloqueia antes);
  - nomes de arquivo passam por uma lista estrita (letras, números, - _ .) e terminam em .json: não dá para
    escapar da pasta com "../" nem sobrescrever outros tipos de arquivo.
```

- **`root`** <sub>do módulo</sub> · [L33](../server.js#L33) — Pasta do projeto (onde está este arquivo). Tudo que o servidor entrega é lido a partir daqui.
- **`port`** <sub>do módulo</sub> · [L35](../server.js#L35) — Porta HTTP. Padrão 5173; mude com `PORT=8080 npm start`.
- **`allowed`** <sub>do módulo</sub> · [L37](../server.js#L37) — Lista branca: SÓ estes caminhos são servidos (o app em si). package.json, .git, tests, projetos etc. nunca saem por aqui.
- **`configFile`** <sub>do módulo</sub> · [L39](../server.js#L39) — Arquivo onde a configuração (pasta escolhida, nº de versões) é lembrada entre execuções. Fica fora do git (.gitignore).
- **`DEFAULTS`** <sub>do módulo</sub> · [L41](../server.js#L41) — Configuração padrão: pasta ./projetos ao lado do app, guardando até 20 versões por projeto.
- **`VERSION_EVERY_MS`** <sub>do módulo</sub> · [L43](../server.js#L43) — Intervalo mínimo entre duas versões guardadas do mesmo projeto (o auto-salvar grava a cada poucos segundos; versões não).
- **`MAX_BODY`** <sub>do módulo</sub> · [L45](../server.js#L45) — Tamanho máximo aceito para um projeto (imagens embutidas deixam o .json grande).
- **`FILE_RE`** <sub>do módulo</sub> · [L47](../server.js#L47) — Nome de arquivo aceito: começa com letra/número, só usa letras, números, ponto, - e _, e termina em .json.
- **`types`** <sub>do módulo</sub> · [L50](../server.js#L50) — Tipo MIME por extensão. O de .js precisa ser text/javascript, senão o navegador recusa carregar módulos ES.
- **`loadConfig()`** <sub>do módulo</sub> · [L62](../server.js#L62) — Lê a configuração salva (ou a padrão, se ainda não existir / estiver corrompida).
- **`config`** <sub>do módulo</sub> · [L71](../server.js#L71) — Configuração atual, carregada uma vez ao iniciar e atualizada pelo PUT /api/config.
- **`expandHome(p)`** <sub>do módulo</sub> · [L74](../server.js#L74) — "~/Designer" → "/home/voce/Designer" (atalho comum para a pasta do usuário).
- **`useFolder(input)`** <sub>do módulo</sub> · [L80](../server.js#L80) — Valida e aplica uma pasta nova: precisa ser caminho ABSOLUTO; é criada se não existir; e testamos se dá para escrever nela (gravando e apagando um arquivo de teste) ANTES de aceitar — melhor errar agora do que no auto-salvar.
- **`httpError(status, message)`** <sub>do módulo</sub> · [L93](../server.js#L93) — Erro com status HTTP e mensagem que pode ir para a tela do usuário.
- **`sendJson(res, status, data)`** <sub>do módulo</sub> · [L97](../server.js#L97) — Responde JSON.
- **`readBody(req)`** <sub>do módulo</sub> · [L102](../server.js#L102) — Lê o corpo do pedido inteiro (com limite de tamanho) e devolve como texto.
- **`localHost(host = '')`** <sub>do módulo</sub> · [L113](../server.js#L113) — O Host do pedido é esta máquina? (protege contra DNS rebinding)
- **`localOrigin(origin)`** <sub>do módulo</sub> · [L115](../server.js#L115) — A página que fez o pedido (Origin) é local? Pedidos sem Origin (curl, testes) são aceitos: não vêm de um site.
- **`projectPath(name)`** <sub>do módulo</sub> · [L118](../server.js#L118) — Caminho do projeto `name` dentro da pasta configurada (o nome já foi validado por FILE_RE).
- **`versionsDir(name)`** <sub>do módulo</sub> · [L120](../server.js#L120) — Pasta onde ficam as versões antigas de um projeto: <pasta>/.versoes/<nome-sem-.json>/
- **`thumbPath(name)`** <sub>do módulo</sub> · [L122](../server.js#L122) — Miniatura (SVG) de um projeto, mostrada na página inicial: <pasta>/.miniaturas/<nome-sem-.json>.svg
- **`MAX_THUMB`** <sub>do módulo</sub> · [L124](../server.js#L124) — Tamanho máximo de uma miniatura (o app já tira imagens grandes antes de mandar).
- **`checkName(name)`** <sub>do módulo</sub> · [L126](../server.js#L126) — Valida o nome vindo da URL.
- **`listVersions(name)`** <sub>do módulo</sub> · [L132](../server.js#L132) — Lista as versões guardadas de um projeto, da mais nova para a mais antiga.
- **`snapshotVersion(name)`** <sub>do módulo</sub> · [L148](../server.js#L148) — Antes de sobrescrever um projeto, guarda o conteúdo ANTERIOR como versão — mas só se a última versão tiver mais de 10 min (senão o auto-salvar criaria centenas). Depois apaga as mais antigas além de `keepVersions`.
- **`api(req, res, path)`** <sub>do módulo</sub> · [L180](../server.js#L180) — Rotas da API (todas respondem JSON):

    GET  /api/status                         → { ok, folder, keepVersions }
    PUT  /api/config        { folder?, keepVersions? }  → muda a pasta / nº de versões
    GET  /api/projects                       → [{ file, modified, size }]
    GET  /api/projects/<arquivo>             → o projeto (+ cabeçalho X-Modified com a data de modificação)
    PUT  /api/projects/<arquivo>             → grava; responde { modified }. Envie X-Base-Modified com a data
         que você leu: se o arquivo mudou desde então (outra aba, outro programa), responde 409 em vez de apagar o
         trabalho alheio. Envie X-Overwrite: 1 para gravar mesmo assim (ex.: "Salvar como" sobre um nome existente,
         depois de o usuário confirmar).
    GET  /api/projects/<arquivo>/versions            → versões guardadas
    GET  /api/projects/<arquivo>/versions/<versão>   → conteúdo de uma versão
    GET  /api/projects/<arquivo>/thumb               → miniatura SVG (página inicial)
    PUT  /api/projects/<arquivo>/thumb   { svg }     → grava a miniatura
    POST /api/projects/<arquivo>/rename  { to }      → renomeia (leva junto versões e miniatura); 409 se o nome existe
