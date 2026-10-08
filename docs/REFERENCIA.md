# Referência do código

> **Arquivo gerado** por `scripts/gerar-referencia.mjs` a partir dos comentários do código. **Não edite à mão**:
> mude o comentário no `.js` e rode `npm run docs`. (Os testes avisam se esta página ficou desatualizada.)
>
> Para entender o projeto antes de mergulhar aqui, leia o [Guia do código](GUIA-DO-CODIGO.md) e a [Arquitetura](ARQUITETURA.md).

49 arquivos · 750 funções e constantes documentadas.

Legenda: sem marca = **exportada** (outros arquivos podem importar) · <sub>do módulo</sub> = só usada dentro do arquivo · <sub>interna</sub> = definida dentro de uma fábrica (`createStore`, `createTools`…) e acessível pelo objeto que ela devolve, se estiver na lista de retorno.

## Índice

| Arquivo | O que é |
|---|---|
| [`src/canvas.js`](#srccanvasjs) | Desenha o documento em HTML/CSS + pan, zoom e geometria |
| [`src/color.js`](#srccolorjs) | Matemática de cor (puro): hex ↔ rgb ↔ hsl ↔ hsv, harmonias, tons e contraste |
| [`src/commands.js`](#srccommandsjs) | Comandos de edição |
| [`src/comments.js`](#srccommentsjs) | Comentários nas camadas (módulo puro: sem DOM, testado em tests/features.test.js) |
| [`src/components.js`](#srccomponentsjs) | Componentes (principal + instâncias) e estilos compartilhados (módulo puro) |
| [`src/css.js`](#srccssjs) | Camada → CSS / HTML / SVG (módulo puro: sem DOM) |
| [`src/export.js`](#srcexportjs) | Saídas: PNG, SVG, HTML e arquivo de projeto (.json) |
| [`src/fonts.js`](#srcfontsjs) | Fontes do Google Fonts (lista, carregamento sob demanda e prévia) |
| [`src/main.js`](#srcmainjs) | Ponto de entrada: monta o app |
| [`src/model.js`](#srcmodeljs) | Modelo de dados do documento |
| [`src/modes.js`](#srcmodesjs) | Modos de cor (claro/escuro...) e variáveis de tamanho (módulo puro, testado em tests/modes.test.js) |
| [`src/overlay.js`](#srcoverlayjs) | Interface por cima do canvas (seleção, alças, guias, medidas...) |
| [`src/palettes.js`](#srcpalettesjs) | Paletas de cor próprias (salvas no navegador, valem para todos os projetos) |
| [`src/pen.js`](#srcpenjs) | Ferramenta caneta (vetores) e edição de pontos |
| [`src/present.js`](#srcpresentjs) | Modo apresentar (protótipo em tela cheia) |
| [`src/rulers.js`](#srcrulersjs) | Réguas e criação de guias |
| [`src/sample-vitrine.js`](#srcsample-vitrinejs) | Exemplo "vitrine": um site inteiro que usa tudo que o editor faz |
| [`src/saving.js`](#srcsavingjs) | Regras de salvamento (navegador + pasta do computador) |
| [`src/storage.js`](#srcstoragejs) | Onde o projeto é guardado: navegador (IndexedDB) e pasta do computador (servidor) |
| [`src/store.js`](#srcstorejs) | Estado central, histórico (desfazer) e salvamento |
| [`src/svg.js`](#srcsvgjs) | Exportação SVG vetorial (módulo puro: sem DOM) |
| [`src/svgimport.js`](#srcsvgimportjs) | Importa SVG como vetores editáveis |
| [`src/thumbnail.js`](#srcthumbnailjs) | Miniatura do projeto (SVG) para a página inicial |
| [`src/tools.js`](#srctoolsjs) | Interação: mouse e teclado no canvas |
| [`src/version.js`](#srcversionjs) |  |
| [`src/agent/bridge.js`](#srcagentbridgejs) | Permissão e ponte com o MCP (lado do navegador) |
| [`src/agent/runner.js`](#srcagentrunnerjs) | Executa as ferramentas do agente no editor aberto |
| [`src/agent/schema.js`](#srcagentschemajs) | As ferramentas que uma IA pode usar no editor (lista única, sem DOM) |
| [`src/ui/assets.js`](#srcuiassetsjs) | Aba "recursos" (componentes e estilos) |
| [`src/ui/assistant.js`](#srcuiassistantjs) | Painel "assistente" (agente de IA dentro do editor) |
| [`src/ui/code.js`](#srcuicodejs) | Aba "código" (CSS e HTML da seleção) |
| [`src/ui/colorpicker.js`](#srcuicolorpickerjs) | Seletor de cor (popover) com gerenciador de paletas |
| [`src/ui/comments.js`](#srcuicommentsjs) | Painel "comentários" (aba do painel direito) |
| [`src/ui/dom.js`](#srcuidomjs) | Criar elementos + componentes de formulário |
| [`src/ui/fontpicker.js`](#srcuifontpickerjs) | Seletor de fontes (Google Fonts + fontes do sistema) |
| [`src/ui/googleicons.js`](#srcuigoogleiconsjs) | Painel "ícones" (Material Symbols, os ícones do Google) |
| [`src/ui/home.js`](#srcuihomejs) | Página inicial (os seus projetos) |
| [`src/ui/icons.js`](#srcuiiconsjs) | Ícones SVG (inline, sem dependências) |
| [`src/ui/info.js`](#srcuiinfojs) |  |
| [`src/ui/layers.js`](#srcuilayersjs) | Painel de páginas e camadas |
| [`src/ui/menus.js`](#srcuimenusjs) | Menus flutuantes, janelas modais e ajuda de atalhos |
| [`src/ui/projects.js`](#srcuiprojectsjs) | Janela "projetos na pasta" (salvar com nome, abrir, versões antigas) |
| [`src/ui/props.js`](#srcuipropsjs) | Painel "design" (propriedades da seleção) |
| [`src/ui/proto.js`](#srcuiprotojs) | Aba "protótipo" (interações entre telas) |
| [`src/ui/responsive.js`](#srcuiresponsivejs) | Largura da tela (Desktop · tablet · celular) e modo de cor |
| [`src/ui/settings.js`](#srcuisettingsjs) | Janela "configurações" (onde salvar, versões, cópia no navegador, aparência) |
| [`server.js`](#serverjs) | Servidor local: entrega o app e salva os projetos numa pasta do seu computador |
| [`server/mcp.js`](#servermcpjs) | O protocolo MCP (model context protocol), sem dependências |
| [`scripts/mcp.mjs`](#scriptsmcpmjs) | Servidor MCP por "stdio" (para Claude Desktop, Codex e outros) |

---

## src/canvas.js

**DESENHA O DOCUMENTO EM HTML/CSS + PAN, ZOOM E GEOMETRIA** · [abrir o código](../src/canvas.js)

```text
 Cada camada vira um <div> real, estilizado pelo CSS que css.js gera. Por isso flexbox, grid, sombras,
 gradientes e blur funcionam "de graça": quem renderiza é o motor do navegador, não código nosso.

 Este módulo é a ÚNICA ponte entre o modelo (dados) e o DOM. Quando precisamos saber "onde a camada está
 de verdade" (ex.: dentro de um auto layout), lemos do DOM aqui, em vez de recalcular layout na mão.
```

- **`MIN_ZOOM`** <sub>do módulo</sub> · [L18](../src/canvas.js#L18) — Limites do zoom: 2% (para ver pranchas enormes) até 6400% (para conferir pixels).
- **`createCanvas(store, viewport)`** · [L36](../src/canvas.js#L36) — Cria o CANVAS: transforma as camadas do documento em elementos HTML reais dentro do `viewport`.

  Estrutura do DOM:
    .viewport  (a janela visível: recorta, recebe mouse/teclado, desenha o fundo pontilhado)
      ├─ .world   (um "mundo" gigante; recebe translate+scale para fazer pan e zoom)
      │    └─ .node  um <div> por camada, estilizado por css.js → nodeStyle (CSS de verdade!)
      └─ .overlay (seleção, alças, guias — criado por overlay.js, em pixels de TELA, fora do zoom)

  Também oferece a GEOMETRIA: onde cada camada está no mundo (lida do DOM, porque em auto layout quem decide a
  posição é o navegador, não o modelo), conversões tela↔mundo, zoom ancorado no cursor e "ajustar à tela".
  - `store` <sub>object</sub> — o store do app
  - `viewport` <sub>HTMLElement</sub> — elemento que vira a janela do canvas
- **`getView()`** <sub>interna</sub> · [L52](../src/canvas.js#L52) — Vista (pan/zoom) da página atual: { x, y, zoom }. x/y = deslocamento do mundo em px de tela. Cada página lembra a sua. `fresh: true` marca "nunca foi ajustada" — o app então faz "ajustar tudo" sozinho.
- **`applyView()`** <sub>interna</sub> · [L55](../src/canvas.js#L55) — Aplica a vista ao DOM: transforma o mundo e faz o fundo pontilhado acompanhar (some quando o zoom é muito baixo).
- **`setView(patch)`** <sub>interna</sub> · [L66](../src/canvas.js#L66) — Atualiza parte da vista ({x, y, zoom}), limitando o zoom ao intervalo permitido, e avisa o app ('view').
- **`zoomAt(newZoom, cx, cy)`** <sub>interna</sub> · [L82](../src/canvas.js#L82) — Muda o zoom MANTENDO O PONTO (cx, cy) parado na tela — é o que faz o zoom "ir para onde o mouse está". Matemática: queremos que o ponto do mundo sob o cursor continue sob o cursor, então deslocamos x/y na proporção da mudança.
  - `newZoom` <sub>number</sub> — zoom desejado (1 = 100%)
  - `cx` <sub>number</sub> — x do ponto fixo, em px relativos ao viewport
  - `cy` <sub>number</sub> — y do ponto fixo
- **`vpRect()`** <sub>interna</sub> · [L89](../src/canvas.js#L89) — Retângulo do viewport na tela (px da janela do navegador).
- **`toWorld(clientX, clientY)`** <sub>interna</sub> · [L91](../src/canvas.js#L91) — Converte um ponto da TELA (clientX/clientY de um evento) para coordenadas do MUNDO (as do documento).
- **`toScreen(wx, wy)`** <sub>interna</sub> · [L97](../src/canvas.js#L97) — Converte coordenadas do MUNDO para px relativos ao viewport (o oposto de toWorld).
- **`originOf(id)`** <sub>interna</sub> · [L108](../src/canvas.js#L108) — Origem (canto superior esquerdo, sem rotação) da camada em coordenadas do mundo. Soma offsetLeft/offsetTop subindo a cadeia de pais posicionados — esses valores ignoram transform, então não são afetados por rotação/zoom. É por LER o DOM (e não o modelo) que isso também funciona em flex/grid.
- **`ancestorRotated(id)`** <sub>interna</sub> · [L120](../src/canvas.js#L120) — Algum ancestral está rotacionado? (Nesse caso a soma de offsets deixa de valer e usamos o retângulo envolvente.)
- **`worldBox(id)`** <sub>interna</sub> · [L130](../src/canvas.js#L130) — Caixa da camada no mundo: { x, y, w, h, cx, cy, rot } — centro, tamanho e a rotação PRÓPRIA da camada. É o que o overlay usa para desenhar a seleção girada. Se um ancestral está girado, devolve o retângulo envolvente com rot=0 (simplificação aceita).
- **`aabb(id)`** <sub>interna</sub> · [L147](../src/canvas.js#L147) — AABB = retângulo envolvente alinhado aos eixos (considera rotação), em coordenadas do mundo. Calculado com getBoundingClientRect, que já inclui qualquer transform. Usado em snap, alinhar, marquee e medidas.
- **`unionAabb(ids)`** <sub>interna</sub> · [L157](../src/canvas.js#L157) — Menor retângulo que envolve as AABBs de várias camadas (ou null se nenhuma existir).
- **`ensureVisible(id)`** <sub>interna</sub> · [L169](../src/canvas.js#L169) — Rola a vista só o necessário para a camada ficar visível (com 60px de folga), sem mexer no zoom. Usado pelo Tab.
- **`fit(ids, { maxZoom = 2, padding = 80 } = {})`** <sub>interna</sub> · [L188](../src/canvas.js#L188) — "Ajustar à tela": enquadra as camadas dadas (ou todas, se vazio) no centro do viewport.
  - `[ids]` <sub>string[]</sub> — camadas a enquadrar; vazio/null = todas as da página
- **`syncNode(node, parent, parentEl, index)`** <sub>interna</sub> · [L214](../src/canvas.js#L214) — Sincroniza UMA camada (e, recursivamente, os filhos) com o DOM: cria o elemento se não existe, atualiza o estilo, o texto e a posição na lista de irmãos. É um "diff" simples: só toca no DOM quando algo mudou (comparamos o CSS novo com o último aplicado, guardado em `el._css` — ler `style.cssText` seria caro).
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai (decide se é item de flex/grid)
  - `parentEl` <sub>HTMLElement</sub> — elemento DOM do pai
  - `index` <sub>number</sub> — posição desejada entre os irmãos (a ordem do array é a ordem z)
- **`measureBack(list, parent)`** <sub>interna</sub> · [L272](../src/canvas.js#L272) — "Medida de volta": para camadas com tamanho 'hug'/'fill' (ou dentro de auto layout), o tamanho real só o navegador sabe. Lemos offsetWidth/Height e gravamos em node.w/h, para o painel, o SVG e o 'ajustar' mostrarem o tamanho verdadeiro. Não cria entrada no histórico (é dado derivado).
- **`render()`** <sub>interna</sub> · [L296](../src/canvas.js#L296) — Desenha a página atual: sincroniza todas as camadas, remove elementos órfãos (camada apagada ou de outra página), mede de volta os tamanhos e, se há texto em edição, dá foco e seleciona o conteúdo.

---

## src/color.js

**MATEMÁTICA DE COR (puro): hex ↔ RGB ↔ HSL ↔ HSV, harmonias, tons e contraste** · [abrir o código](../src/color.js)

```text
 Usado pelo seletor de cor (sugestões de harmonia, contraste) e testado no Node (tests/color.test.js).
 Convenções: RGB = {r,g,b} 0–255 · HSL = {h: 0–360, s: 0–1, l: 0–1} · HSV = {h: 0–360, s: 0–1, v: 0–1}.
```

- **`rgbToHex({ r, g, b })`** · [L13](../src/color.js#L13) — {r,g,b} (0–255) → "#RRGGBB".
- **`hexToRgb(hex)`** · [L16](../src/color.js#L16) — "#abc" / "#aabbcc" (com ou sem #) → {r,g,b}; texto inválido → preto.
- **`rgbToHsv({ r, g, b })`** · [L25](../src/color.js#L25) — RGB → HSV.
- **`hsvToRgb({ h, s, v })`** · [L38](../src/color.js#L38) — HSV → RGB.
- **`rgbToHsl({ r, g, b })`** · [L48](../src/color.js#L48) — RGB → HSL.
- **`hslToRgb({ h, s, l })`** · [L62](../src/color.js#L62) — HSL → RGB.
- **`rotateHue(hex, deg)`** · [L72](../src/color.js#L72) — Gira o matiz de uma cor (graus) mantendo saturação e luminosidade.
- **`withLightness(hex, l)`** · [L78](../src/color.js#L78) — Muda a luminosidade (HSL) de uma cor para `l` (0–1).
- **`harmonies(hex)`** · [L88](../src/color.js#L88) — Harmonias de cor a partir de uma cor base: [{ key, title, colors }].

   - complementar: a oposta na roda de cores · análogas: vizinhas (±30°) · tríade: três cores a 120° ·
   - tons: da mais clara à mais escura, mesma cor (para estados, fundos e bordas).
- **`luminance(hex)`** · [L100](../src/color.js#L100) — Luminância relativa (WCAG 2) de uma cor, de 0 (preto) a 1 (branco).
- **`contrast(a, b)`** · [L107](../src/color.js#L107) — Razão de contraste (1–21) entre duas cores, como na WCAG.
- **`wcagLevel(ratio)`** · [L113](../src/color.js#L113) — Nível WCAG para texto normal: 'AAA' (≥7), 'AA' (≥4.5), 'AA grande' (≥3, só texto grande) ou 'falha'.

---

## src/commands.js

**COMANDOS DE EDIÇÃO** · [abrir o código](../src/commands.js)

```text
 Tudo o que o usuário "faz" com camadas e que vai além de arrastar: excluir, duplicar, copiar/colar,
 agrupar, auto layout, alinhar, distribuir, ordem z, componentes, máscara, guias, vetores, imagens.
 Atalhos (tools.js), menus (ui/menus.js) e painéis (ui/*.js) chamam estas funções — a lógica não se repete.
```

- **`createCommands(store, canvas)`** · [L29](../src/commands.js#L29) — Cria os COMANDOS de edição: operações que mudam a ÁRVORE de camadas ou várias camadas de uma vez (excluir, duplicar, copiar/colar, agrupar, ordem z, auto layout, alinhar, distribuir, componentes, máscara, guias, vetores, imagens). É chamado por atalhos de teclado (tools.js), menus (menus.js) e painéis (ui/*.js), então a lógica fica em UM lugar só.

  Padrão de todo comando: (1) descobre as camadas-alvo, (2) `store.update(...)` aplica a mudança, (3) ajusta a
  seleção, (4) `store.commit()` grava no histórico (um desfazer desfaz o comando inteiro).
  - `store` <sub>object</sub> — 
  - `canvas` <sub>object</sub> — precisa da geometria do DOM (posições reais em auto layout)
- **`topSelection()`** <sub>interna</sub> · [L37](../src/commands.js#L37) — Seleção "de topo": camadas selecionadas que NÃO têm um ancestral também selecionado. Se você seleciona um frame e um filho dele, mover/duplicar/excluir deve agir só no frame (o filho vai junto).
- **`parentOrigin(parent)`** <sub>interna</sub> · [L46](../src/commands.js#L46) — Origem (canto superior esquerdo, no mundo) do pai; (0,0) quando a camada está na raiz da página.
- **`freezePositions(nodes, parent)`** <sub>interna</sub> · [L53](../src/commands.js#L53) — "Congela" a posição VISUAL atual como x/y. Em auto layout x/y do modelo são ignorados (o navegador posiciona), então, antes de uma camada sair do fluxo (agrupar, desligar auto layout...), lemos onde ela está no DOM e gravamos em x/y — assim nada "pula" de lugar.
- **`deleteSelection()`** <sub>interna</sub> · [L64](../src/commands.js#L64) — Exclui as camadas selecionadas (e tudo dentro delas).
- **`duplicate()`** <sub>interna</sub> · [L79](../src/commands.js#L79) — Duplica a seleção logo acima do original, deslocada 20px (em auto layout entra no fluxo, sem deslocar).
- **`copy()`** <sub>interna</sub> · [L104](../src/commands.js#L104) — Copia a seleção para a área de transferência INTERNA do app (ui.clipboard). Guardamos uma cópia JSON, assim ela sobrevive mesmo que o original seja editado/apagado depois. Devolve false se não havia nada selecionado.
- **`cut()`** <sub>interna</sub> · [L116](../src/commands.js#L116) — Recortar = copiar + excluir.
- **`paste()`** <sub>interna</sub> · [L126](../src/commands.js#L126) — Cola o que está na área de transferência interna.

   - Com UM frame selecionado (que não seja o próprio copiado): cola DENTRO dele, mantendo a posição se couber
     ou centralizando se não couber.
   - Caso contrário: cola no mesmo pai de onde foi copiado, deslocando 16px a cada colagem seguida.
- **`setSelectionBox({ x, y, w, h })`** <sub>interna</sub> · [L169](../src/commands.js#L169) — Move e/ou redimensiona várias camadas como UM conjunto, pelos campos X/Y/W/H do painel. Cada campo é opcional. Mudar W/H escala cada camada e a distância dela até a borda do conjunto (como esticar a caixa de seleção). Camadas dentro de auto layout só mudam de tamanho (a posição é do navegador). `structural:false`: só números mudam, o índice do store continua válido (mais rápido).
- **`STYLE_KEYS`** <sub>interna</sub> · [L197](../src/commands.js#L197) — "Copiar propriedades" (Ctrl+Alt+C / Ctrl+Alt+V), como "copiar formato" do Word: leva só a APARÊNCIA (preenchimento, contorno, cantos, sombras, blur, opacidade, mesclagem) e, se a origem é texto, também a tipografia.
- **`copyStyle()`** <sub>interna</sub> · [L201](../src/commands.js#L201) — Guarda a aparência da 1ª camada selecionada em ui.styleClipboard.
- **`pasteStyle()`** <sub>interna</sub> · [L214](../src/commands.js#L214) — Aplica a aparência guardada a todas as camadas selecionadas, ignorando o que não faz sentido para o tipo do destino (ex.: tipografia em retângulo, cantos em elipse/texto, fill em grupo).
- **`group()`** <sub>interna</sub> · [L238](../src/commands.js#L238) — Agrupa as camadas selecionadas (Ctrl+G). Só agrupa irmãs do MESMO pai (a 1ª selecionada manda). O grupo entra na posição da camada mais alta e os filhos mantêm a ordem z. Antes, congela as posições (ver freezePositions). A caixa do grupo é calculada depois, no commit, por fitGroups.
- **`ungroup()`** <sub>interna</sub> · [L261](../src/commands.js#L261) — Desagrupa (Ctrl+Shift+G): os filhos sobem um nível, no lugar do grupo, mantendo a posição visual (somamos x/y do grupo). Funciona em grupos e em frames comuns; componentes/instâncias são ignorados.
- **`reorder(mode)`** <sub>interna</sub> · [L288](../src/commands.js#L288) — Muda a ordem z (quem fica na frente). A ordem do array É a ordem de desenho: o último é o que fica por cima.
  - `mode` <sub>'front'\|'back'\|'forward'\|'backward'</sub> — frente / fundo / um passo à frente / um passo atrás
- **`enableAutoLayout(frame)`** <sub>interna</sub> · [L322](../src/commands.js#L322) — Liga o auto layout num frame que tinha filhos livres, DEDUZINDO a configuração a partir de onde eles estão, para nada "pular" de lugar:

   - direção: filhos espalhados mais na horizontal → 'row'; senão 'column'. Um filho só: frame alto (ex.: uma
     sidebar) → 'column'; largo → 'row';
   - gap: média dos vãos entre filhos consecutivos;
   - padding: distância entre os filhos e as bordas. Mas se o conteúdo está encostado no início e sobra MUITO
     espaço no fim (ex.: um item no topo de uma sidebar), essa sobra é espaço livre, não margem: o padding do fim
     fica igual ao do início (senão um padding-bottom de 500px espremeria os próximos itens);
   - alinhamento: conteúdo centralizado no frame → 'center'; encostado no fim → 'flex-end'. No eixo cruzado, com
     vários filhos, olha se eles estavam alinhados pelo início, pelo centro ou pelo fim.
  Também reordena os filhos na ordem em que aparecem na tela, e tira o "absoluto" de todos.
- **`disableAutoLayout(frame)`** <sub>interna</sub> · [L370](../src/commands.js#L370) — Desliga o auto layout congelando as posições atuais (nada muda visualmente).
- **`setLayoutMode(frames, mode)`** <sub>interna</sub> · [L380](../src/commands.js#L380) — Troca o modo do layout (none | row | column | grid). Ao LIGAR numa frame livre, deduz a configuração (enableAutoLayout); ao DESLIGAR, congela as posições. Em grid, sugere um nº de colunas pela raiz da qtd de filhos. Chamado de dentro de `store.update`, por isso não faz commit.
- **`toggleAutoLayout()`** <sub>interna</sub> · [L410](../src/commands.js#L410) — Shift+A — "Adicionar auto layout", tentando entender a INTENÇÃO (como no Figma), em vez de só embrulhar:

   - FRAME selecionado → liga/desliga o auto layout dele;
   - um RETÂNGULO sozinho → ele VIRA um frame com auto layout (mesma cor, cantos, contorno, sombra e id), pronto
     para receber camadas. Embrulhar um retângulo num frame não serviria para nada: retângulo não tem filhos;
   - um GRUPO → o grupo vira o frame (os filhos dele são os itens do layout);
   - várias camadas → um frame novo envolve todas. Se a camada MAIS AO FUNDO for um retângulo que contém todas as
     outras (ex.: o fundo de uma sidebar com itens em cima), ele vira o FUNDO do frame em vez de mais um item —
     senão o auto layout colocaria o fundo e os itens lado a lado. Sem fundo, o frame abraça o conteúdo (hug).
- **`frameFrom(r, props)`** <sub>interna</sub> · [L423](../src/commands.js#L423) — Frame com a APARÊNCIA de um retângulo (para o retângulo "virar" o frame).
- **`shift(node, dx, dy)`** <sub>interna</sub> · [L483](../src/commands.js#L483) — Soma dx/dy à posição x/y da camada (arredondando).
- **`align(kind)`** <sub>interna</sub> · [L493](../src/commands.js#L493) — Alinha a seleção. Com UMA camada, alinha dentro do pai; com várias, alinha entre si (pela caixa do conjunto). Camadas em auto layout são ignoradas (o navegador decide a posição delas).
  - `kind` <sub>'left'\|'hcenter'\|'right'\|'top'\|'vcenter'\|'bottom'</sub> — 
- **`distribute(axis)`** <sub>interna</sub> · [L524](../src/commands.js#L524) — Distribui 3+ camadas com vãos IGUAIS entre elas, mantendo a primeira e a última no lugar.
  - `axis` <sub>'h'\|'v'</sub> — horizontal ou vertical
- **`reparent(nodes, newParent, index = null)`** <sub>interna</sub> · [L557](../src/commands.js#L557) — Move camadas para outro pai (ou para a raiz da página) MANTENDO a posição visual: lê a origem de cada uma no DOM antes e recalcula x/y relativo ao novo pai. Usado ao arrastar para dentro de frames e no arrastar da lista de camadas. Não deixa mover uma camada para dentro de si mesma/de um descendente.
  - `nodes` <sub>object[]</sub> — camadas a mover
  - `newParent` <sub>object\|null</sub> — novo pai (null = raiz)
  - `[index]` <sub>number\|null</sub> — posição na lista do novo pai (null = no topo)
- **`importAsset(file)`** <sub>interna</sub> · [L585](../src/commands.js#L585) — Lê o arquivo de imagem (reduzindo se for grande), guarda em doc.assets e devolve { assetId, w, h }.
- **`addImageFiles(files, at)`** <sub>interna</sub> · [L597](../src/commands.js#L597) — Cria uma camada-retângulo com preenchimento de imagem para cada arquivo (botão, arrastar, colar). A imagem é reduzida para caber em 520px de maior lado e fica centralizada na posição `at` (ou no centro da vista).
  - ↩︎ `Promise<boolean>` true se criou alguma camada
- **`notify(msg)`** <sub>interna</sub> · [L634](../src/commands.js#L634) — Mostra um aviso ao usuário (main.js liga em `commands.notify = toast`).
- **`placeNew(node, at)`** <sub>interna</sub> · [L640](../src/commands.js#L640) — Insere uma camada NOVA já pronta: dentro do frame selecionado (centralizada nele; se o frame tem auto layout, ela entra no fluxo) ou na raiz da página, centralizada em `at` (mundo) ou no meio da tela. Seleciona e grava.
- **`insertSvg(text, { at, name, currentColor, fill, size } = {})`** <sub>interna</sub> · [L667](../src/commands.js#L667) — Importa um SVG (texto) como vetores editáveis e insere (ver placeNew). Avisa O QUE do SVG ficou de fora (ex.: "sombra interna, máscara"). Lança erro se o texto não for um SVG com formas.
  - `text` <sub>string</sub> — 
- **`addText(textValue, at)`** <sub>interna</sub> · [L675](../src/commands.js#L675) — Cria uma camada de texto com o texto dado (usado ao colar texto do sistema no canvas).
- **`wrapInFrame(same, name)`** <sub>interna</sub> · [L691](../src/commands.js#L691) — Envolve camadas irmãs num frame novo (sem layout, sem preenchimento) do tamanho do conjunto. Base de "Envolver em frame", "Criar componente" de vários itens e "Auto layout" de vários itens. Deve ser chamada dentro de `store.update`.
- **`sameLevel(nodes)`** <sub>interna</sub> · [L707](../src/commands.js#L707) — Filtra a seleção para as camadas que estão na mesma lista que a primeira (irmãs), ordenadas pela ordem z.
- **`createComponent()`** <sub>interna</sub> · [L716](../src/commands.js#L716) — Ctrl+Alt+K: transforma a seleção em COMPONENTE PRINCIPAL. Várias camadas (ou texto/linha soltos) são primeiro envolvidas num frame, porque componente precisa de uma raiz.
- **`insertInstance(mainId, at)`** <sub>interna</sub> · [L737](../src/commands.js#L737) — Cria uma INSTÂNCIA de um componente. Sem posição dada, entra ao lado do principal; com `at`, centralizada ali (usado ao clicar no componente na aba Recursos).
  - `mainId` <sub>string</sub> — id do componente principal
- **`detach()`** <sub>interna</sub> · [L758](../src/commands.js#L758) — Ctrl+Alt+B: desanexa as instâncias selecionadas (viram camadas comuns).
- **`goToMain(id)`** <sub>interna</sub> · [L765](../src/commands.js#L765) — "Ir ao principal": abre a página do componente principal, seleciona e enquadra.
- **`toggleMask()`** <sub>interna</sub> · [L780](../src/commands.js#L780) — Ctrl+Alt+M: máscara. Com várias camadas: agrupa e usa a de baixo como máscara (recorta as outras, via clip-path). Com uma camada que já está num grupo: liga/desliga o papel de máscara dela.
- **`flip(axis)`** <sub>interna</sub> · [L795](../src/commands.js#L795) — Espelha as camadas selecionadas na horizontal ('x') ou vertical ('y').
- **`addColorStyle(node, name)`** <sub>interna</sub> · [L804](../src/commands.js#L804) — Cria um estilo de cor compartilhado a partir do preenchimento de uma camada e já liga a camada a ele.
- **`addColorStyles(items)`** <sub>interna</sub> · [L812](../src/commands.js#L812) — Cria vários estilos de cor de uma vez (ex.: a partir de uma paleta): [{ name, color }]. Um único passo de desfazer.
- **`addColorMode({ name, scheme = null, auto = false })`** <sub>interna</sub> · [L818](../src/commands.js#L818) — Cria um modo de cor (escuro...) e já o mostra no canvas. `auto`: gera os valores invertendo a luminosidade.
- **`renameColorMode(id, name)`** <sub>interna</sub> · [L825](../src/commands.js#L825) — Muda o nome de um modo de cor (o atributo data-theme no CSS acompanha).
- **`setModeScheme(id, scheme)`** <sub>interna</sub> · [L832](../src/commands.js#L832) — Define se o modo vale sozinho pela preferência do sistema ('dark' | 'light' | null = só com data-theme).
- **`deleteColorMode(id)`** <sub>interna</sub> · [L839](../src/commands.js#L839) — Apaga um modo de cor (os valores dele nos estilos também).
- **`addSizeVar(name, value)`** <sub>interna</sub> · [L845](../src/commands.js#L845) — Cria uma variável de tamanho (espaçamento, raio, fonte).
- **`setSizeVar(id, patch)`** <sub>interna</sub> · [L851](../src/commands.js#L851) — Muda o valor de uma variável e leva o valor a todas as camadas ligadas a ela.
- **`deleteSizeVar(id)`** <sub>interna</sub> · [L860](../src/commands.js#L860) — Apaga uma variável (as camadas mantêm o valor que tinham).
- **`bindSizeVar(nodes, prop, v)`** <sub>interna</sub> · [L865](../src/commands.js#L865) — Liga (ou, com `v` nulo, desliga) um campo de várias camadas a uma variável de tamanho.
- **`addTextStyle(node, name)`** <sub>interna</sub> · [L870](../src/commands.js#L870) — Cria um estilo de texto compartilhado a partir da tipografia de uma camada e já liga a camada a ele.
- **`removeStyle(kind, id)`** <sub>interna</sub> · [L878](../src/commands.js#L878) — Apaga um estilo ('colors' ou 'texts'); as camadas ligadas mantêm os valores que tinham.
- **`guides()`** <sub>interna</sub> · [L887](../src/commands.js#L887) — Lista de guias da página atual (cria se não existir, para páginas de projetos antigos).
- **`addGuide(axis, pos)`** <sub>interna</sub> · [L889](../src/commands.js#L889) — Cria uma guia de régua. axis 'x' = linha vertical na posição x; 'y' = linha horizontal na posição y.
- **`removeGuide(i)`** <sub>interna</sub> · [L893](../src/commands.js#L893) — Remove a guia de índice `i`.
- **`addPathFromWorld(pts, closed, parent)`** <sub>interna</sub> · [L905](../src/commands.js#L905) — Cria uma camada-vetor a partir de pontos em coordenadas do MUNDO (o que a caneta coleta). Calcula a caixa que envolve o desenho (incluindo as curvas) e converte os pontos para o espaço local do vetor.
  - `[]` <sub>{x,y,hin?,hout?</sub> — } pts  pontos com alças opcionais
  - `closed` <sub>boolean</sub> — caminho fechado (ganha preenchimento cinza)
  - `parent` <sub>object\|null</sub> — frame onde inserir (null = raiz)
- **`updatePathFromWorld(id, pts, closed)`** <sub>interna</sub> · [L926](../src/commands.js#L926) — Atualiza um vetor EXISTENTE com novos pontos (em coordenadas do mundo): usado ao CONTINUAR um caminho aberto com a caneta. Como addPathFromWorld, recalcula a caixa; nome, cor e contorno do vetor continuam.
- **`newIcon(size = 24)`** <sub>interna</sub> · [L949](../src/commands.js#L949) — Cria um frame de ÍCONE (24×24 por padrão, fundo branco, cortando o que sai) no centro da vista, com a grade de 1px ligada, enquadra com zoom grande, liga o encaixe de 1px e deixa a caneta pronta. É o começo de "desenhar o meu SVG".
- **`normalizePath(node)`** <sub>interna</sub> · [L973](../src/commands.js#L973) — Reajusta a caixa do vetor depois de editar pontos: recalcula o retângulo que envolve o desenho e desloca os pontos/posição para a caixa "colar" no desenho. Pula se o vetor está girado (a conta ficaria imprecisa).
- **`addShapePath(kind, box, parent, sides = 5)`** <sub>interna</sub> · [L998](../src/commands.js#L998) — Cria um polígono regular (`sides` lados) ou estrela (pontas alternando raio 100% e 45%) já como vetor editável.
  - `kind` <sub>'polygon'\|'star'</sub> — 
- **`localBox(node)`** <sub>interna</sub> · [L1014](../src/commands.js#L1014) — Caixa da camada relativa ao PAI, medida no DOM (respeita flexbox/grid). Usada pela exportação SVG.
- **`frameSelection()`** <sub>interna</sub> · [L1023](../src/commands.js#L1023) — Ctrl+Alt+G: envolve a seleção num frame novo, sem layout.
- **`cssOf(nodes)`** <sub>interna</sub> · [L1034](../src/commands.js#L1034) — CSS (só o CSS, sem HTML) das camadas dadas — usado por "Copiar CSS".
- **`readImage(file)`** <sub>do módulo</sub> · [L1058](../src/commands.js#L1058) — Lê um arquivo de imagem e devolve { dataUrl, w, h }. Imagens grandes (>1600px ou >400KB) são redesenhadas num <canvas> menor: o projeto inteiro é regravado a cada mudança (navegador e pasta), então imagem enorme deixaria o salvamento lento e o .json gigante. PNG continua PNG (preserva transparência); o resto vira JPEG 88%.
- **`pathBounds(pts, closed = false)`** · [L1091](../src/commands.js#L1091) — Retângulo { x0, y0, x1, y1 } que envolve TODOS os pontos e também as curvas de Bézier (amostradas a cada 5%), já que uma curva pode "sair" para fora dos pontos de ancoragem.
  - `[]` <sub>{x,y,hin?,hout?</sub> — } pts
  - `[closed]` <sub>boolean</sub> — considera o segmento de volta ao primeiro ponto

---

## src/comments.js

**COMENTÁRIOS NAS CAMADAS   (módulo puro: sem DOM, testado em tests/features.test.js)** · [abrir o código](../src/comments.js)

```text
 Um comentário é uma anotação presa a UMA camada, com um ponto relativo à caixa dela (rx, ry de 0 a 1:
 1,0 = canto superior direito). Como é relativo, o "pino" acompanha a camada quando ela se move ou muda de tamanho.

 Onde ficam: em `doc.comments` (lista), DENTRO do mesmo arquivo do projeto. Por isso viajam com o .json, entram
 nas versões antigas e no desfazer. Documentos antigos não têm a lista (todas as funções toleram isso).

 Formato:
   { id, nodeId, rx, ry, text, author, at (data ISO), editedAt?, resolved, replies: [{ id, text, author, at, editedAt? }] }

 Sem login: o autor é o nome definido nas Configurações. Quando existir trabalho em equipe, o mesmo formato serve.
```

- **`commentsOf(doc)`** · [L23](../src/comments.js#L23) — Todos os comentários do documento (lista vazia se o projeto é antigo e não tem).
- **`addComment(doc, { nodeId, rx = 1, ry = 0, text, author })`** · [L31](../src/comments.js#L31) — Cria um comentário numa camada e o põe no documento. Texto vazio não cria nada.
  - `doc` <sub>object</sub> — 
  - ↩︎ `object\|null` o comentário criado (ou null se o texto estava vazio)
- **`addReply(comment, { text, author })`** · [L40](../src/comments.js#L40) — Responde a um comentário. Texto vazio não cria nada. @returns {object|null} a resposta criada
- **`editText(item, text)`** · [L52](../src/comments.js#L52) — Troca o texto de um comentário (ou de uma resposta: qualquer objeto com `text`) e marca `editedAt`. Texto vazio ou igual ao atual não muda nada. @returns {boolean} true se mudou
- **`setResolved(comment, resolved)`** · [L61](../src/comments.js#L61) — Marca (ou reabre) um comentário como resolvido.
- **`removeComment(doc, id)`** · [L66](../src/comments.js#L66) — Apaga um comentário pelo id. @returns {boolean} true se existia
- **`forNode(doc, nodeId)`** · [L73](../src/comments.js#L73) — Comentários de uma camada (todos, resolvidos ou não).
- **`openCount(doc, nodeId)`** · [L76](../src/comments.js#L76) — Quantos comentários ABERTOS (não resolvidos) há no documento, ou numa camada se `nodeId` for dado.
- **`pruneComments(doc)`** · [L83](../src/comments.js#L83) — Remove os comentários cujas camadas não existem mais (a camada foi apagada). Roda a cada commit. Como o desfazer restaura a foto anterior do documento (que ainda tem o comentário), apagar uma camada e desfazer traz tudo de volta.
  - ↩︎ `boolean` true se removeu algo
- **`timeAgo(iso, now = Date.now())`** · [L99](../src/comments.js#L99) — "há 5 min", "há 3 h", "ontem", "12/10" — o tempo desde `iso`, curto e em português.
  - `iso` <sub>string</sub> — data ISO
  - `[now]` <sub>number</sub> — agora em ms (para testar)

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

- **`px(v)`** <sub>do módulo</sub> · [L30](../src/css.js#L30) — Formata um número como pixels CSS, arredondado: px(10.004) → "10px".
- **`GRID_ALIGN`** <sub>do módulo</sub> · [L36](../src/css.js#L36) — Tradução dos valores de alinhamento do flexbox (usados no modelo, ex. 'flex-start') para os do CSS Grid ('start'). O grid não aceita 'flex-start' em justify-items/align-items. 'auto' (ou valor desconhecido) fica de fora: o item herda o alinhamento do grid pai.
- **`hexToRgb(hex)`** · [L42](../src/css.js#L42) — Converte uma cor hexadecimal ("#RGB" ou "#RRGGBB") em { r, g, b } (0..255). Entrada inválida vira preto em vez de lançar erro, para o app nunca travar por causa de uma cor ruim.
- **`rgba(hex, a = 1)`** · [L55](../src/css.js#L55) — Monta a cor CSS final. Opacidade total (>= 1) devolve o hex curto "#rrggbb"; menor que 1 devolve "rgba(r, g, b, a)". Assim o código gerado fica o mais limpo possível.
  - `hex` <sub>string</sub> — cor base
  - `[a=1]` <sub>number</sub> — opacidade 0..1
- **`stopsCss(stops)`** <sub>do módulo</sub> · [L62](../src/css.js#L62) — Lista de paradas de gradiente em CSS, ordenada por posição: "#7c5cff 0%, #2dd4ff 100%".
- **`fillCss(fill, assets = {})`** · [L79](../src/css.js#L79) — Propriedades CSS de um PREENCHIMENTO (fill). Devolve um objeto { propriedade: valor }.

   - solid  → background-color
   - linear → background-image: linear-gradient(...)
   - radial → background-image: radial-gradient(...)
   - conic  → background-image: conic-gradient(from Ndeg, ...)
   - image  → background-image: url(data:...) + size/position/repeat (se a imagem não existir mais, cinza neutro)
   - none   → nada
  - `fill` <sub>object</sub> — preenchimento (ver model.js → defaultFill)
  - `[assets]` <sub>Object<string,string></sub> — doc.assets: id → data URL das imagens
- **`fontStack(family)`** <sub>do módulo</sub> · [L111](../src/css.js#L111) — Monta a lista de fontes com alternativas: 'Inter', system-ui, sans-serif. Se o usuário já digitou uma lista (com vírgula), respeita.
- **`nodeStyle(node, parent, assets = {}, opts = {})`** · [L125](../src/css.js#L125) — ★ O CORAÇÃO DO PROJETO ★ — converte UMA camada em CSS. O mesmo resultado é usado em 3 lugares: (1) o canvas (cada camada é um elemento com este estilo), (2) o painel "Código" e (3) a exportação HTML/PNG. Por isso o que você vê no editor é o que o navegador renderiza de verdade.
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai (decide se a camada está em fluxo de flex/grid ou é absoluta)
  - `[assets]` <sub>Object<string,string></sub> — imagens do documento
  - ↩︎ `Object<string,string>` propriedades CSS em ordem de inserção (kebab-case)
- **`overflowCss(node, s, opts = {})`** <sub>do módulo</sub> · [L348](../src/css.js#L348) — Overflow do frame. Altera `s` diretamente. `opts.editor` = desenho do CANVAS: as variações de rolagem viram "cortar", porque barras de rolagem dentro do canvas atrapalhariam o editor (a rolagem de verdade vale na apresentação e no código exportado).
- **`marginCss(node, s)`** <sub>do módulo</sub> · [L360](../src/css.js#L360) — Margem de um item EM FLUXO (flex/grid): atalho `margin` com 1 valor (todos iguais) ou 4 (topo direita baixo esquerda). Só aparece quando algum lado não é zero. Altera `s` diretamente. Camadas livres (position:absolute) não usam margem: a posição delas já é o left/top.
- **`COLOR_FILTERS`** <sub>do módulo</sub> · [L367](../src/css.js#L367) — Funções de filtro de COR da camada, na ordem do CSS, só as que fogem do padrão: brightness, contrast, saturate, grayscale, hue-rotate.
- **`colorFilters(node)`** · [L368](../src/css.js#L368) — _(sem comentário)_
- **`truncateCss(node, s)`** <sub>do módulo</sub> · [L384](../src/css.js#L384) — Truncar texto (campo `truncate`). Altera `s` diretamente; vale DEPOIS do alinhamento vertical e do white-space.

   - 'ellipsis': uma linha só, o que não cabe vira "…"  → white-space:nowrap + overflow:hidden + text-overflow:ellipsis
   - 'clamp': no máximo `lines` linhas, com "…" no fim → display:-webkit-box + -webkit-line-clamp (e line-clamp)
  Os dois precisam de uma LARGURA (fixa ou máxima) para saber onde cortar. O alinhamento vertical por grid
  (centro/fim) é desligado, porque o grid e o -webkit-box/ellipsis não funcionam juntos.
- **`sizeLimitsCss(node, s)`** <sub>do módulo</sub> · [L409](../src/css.js#L409) — Limites de tamanho e proporção da camada. Altera `s` diretamente. Ficam DEPOIS do tamanho, então `min-width` substitui o `min-width: 0` que o item "fill" de um flex escreve sozinho.

   - min-/max-width/height: só aparecem quando o usuário define (campos minW, maxW, minH, maxH).
   - aspect-ratio: só quando ALGUMA medida é flexível (hug/fill). A medida fixa vira `auto` no eixo oposto para a
     proporção valer (com as duas fixas o CSS ignoraria o aspect-ratio, e quem mantém a proporção é o editor).
- **`transformOf(node)`** · [L429](../src/css.js#L429) — Junta rotação e espelhamento numa única propriedade `transform`. Ordem: rotate primeiro, depois scale. Devolve '' quando não há nada a aplicar (assim o CSS gerado não ganha `transform` à toa).
- **`lineStyle(node, s, flow)`** <sub>do módulo</sub> · [L443](../src/css.js#L443) — Estilo da LINHA. Em vez de border ou SVG, a linha é uma caixa de ≥12px de altura com um `background` que desenha uma barra de `stroke.width` px no meio: sólida (linear-gradient), tracejada (gradiente repetido) ou pontilhada (radial-gradient repetido). Os 12px de altura só existem para facilitar clicar nela. Altera `s` diretamente.
- **`hasStrokeSides(node)`** · [L475](../src/css.js#L475) — A camada usa contorno POR LADO? (`stroke.sides` = [cima, direita, baixo, esquerda] em px). Só retângulos, frames e grupos de imagem — em elipse, texto e vetor "lado" não faz sentido.
- **`num(n)`** <sub>do módulo</sub> · [L480](../src/css.js#L480) — Arredonda para 2 casas (coordenadas de SVG).
- **`pathData(points, closed, tx = (x) => x, ty = (y) => y)`** · [L490](../src/css.js#L490) — Gera o atributo `d` de um <path> SVG a partir dos pontos do vetor. Segmento reto quando nenhum dos dois pontos tem alça (comando L); curva de Bézier cúbica quando algum tem (C).
  - `[]` <sub>{x:number,y:number,hin?:object,hout?:object</sub> — } points  pontos; hin/hout = alças de entrada/saída
  - `closed` <sub>boolean</sub> — fecha o caminho com Z (liga o último ao primeiro)
  - `[tx]` <sub>(x:number)=>number</sub> — transformação opcional de x (usada pelo clip-path e pelo SVG exportado)
  - `[ty]` <sub>(y:number)=>number</sub> — idem para y
- **`nodePathData(node, tx, ty)`** · [L512](../src/css.js#L512) — `d` COMPLETO de um vetor: o contorno principal (`points`) + os contornos extras (`contours`), se houver. Contornos extras existem em desenhos importados de SVG (ícones com "furos", letras como "o", várias formas num só vetor). A regra de preenchimento (`fillRule`: 'nonzero' | 'evenodd') decide o que vira furo.
  - `node` <sub>object</sub> — camada do tipo 'path'
  - `[tx]` <sub>(x:number)=>number</sub> — 
  - `[ty]` <sub>(y:number)=>number</sub> — 
- **`svgPaint(fill, id, assets)`** <sub>do módulo</sub> · [L526](../src/css.js#L526) — Preenchimento de um vetor em SVG. Gradientes precisam de uma definição (<linearGradient>) referenciada por url(#id); devolve { paint (valor do atributo fill), defs (markup das definições), opacity }. O ângulo CSS (0° = para cima) é convertido em x1,y1→x2,y2 do SVG (0..1).
- **`pathSvg(node, assets = {})`** · [L553](../src/css.js#L553) — Markup <svg> de um nó `path` (usado no canvas, no HTML exportado e no modo apresentar).

   - preserveAspectRatio="none": o desenho estica junto com a caixa da camada.
   - vector-effect="non-scaling-stroke": a espessura do traço NÃO muda ao esticar.
   - 2º <path> transparente e grosso (stroke-width 12): serve só de "área de clique" para linhas finas.
- **`maskClip(group)`** · [L576](../src/css.js#L576) — Converte a camada marcada como máscara (`isMask`) do grupo em um `clip-path` CSS: elipse → ellipse(), vetor → path(), retângulo → inset() (com cantos arredondados se houver). Devolve '' se o grupo não tem máscara.
- **`toCssText(style)`** · [L593](../src/css.js#L593) — Objeto de estilo → texto para `element.style.cssText` ("a:1;b:2").
- **`cssRule(selector, style, indent = '')`** · [L599](../src/css.js#L599) — Objeto de estilo → regra CSS legível com uma propriedade por linha (usada no painel Código e no HTML exportado).
- **`stateStyle(node, parent, assets, opts, states)`** · [L615](../src/css.js#L615) — CSS de UM estado, só com o que MUDA em relação ao normal (é o que vai dentro de `.botao:hover { ... }`). Propriedade que existia no normal e sumiu no estado vira `unset` (volta ao padrão do CSS: sem sombra, sem filtro, sem fundo...).
  - `node` <sub>object</sub> — 
  - `parent` <sub>object\|null</sub> — 
  - `assets` <sub>object</sub> — 
  - `states` <sub>string\|string[]</sub> — 'hover' \| 'active' \| 'focus' (ou lista, em ordem de cascata)
- **`pathStateStyle(node, assets, state)`** · [L629](../src/css.js#L629) — Estilo de um ESTADO (hover, pressionado, foco) para o desenho DENTRO do <svg> de um vetor: o que o estado muda no preenchimento e no contorno (cor, opacidade, espessura). Vira `.classe:hover path[data-vis] { fill: ...; stroke: ... }`. Gradientes e imagens não entram (precisariam de outra definição no <svg>); a cor sólida e o contorno, sim.
- **`makeClassNamer()`** <sub>do módulo</sub> · [L652](../src/css.js#L652) — Cria um gerador de nomes de classe únicos a partir do nome da camada: "Botão" → "botao", e a segunda camada com o mesmo nome vira "botao-2". Um gerador novo por exportação garante nomes estáveis e sem colisão.
- **`noteComment(node)`** · [L663](../src/css.js#L663) — Texto da nota da camada pronto para virar comentário de HTML ou CSS (uma linha, sem "--" nem "*\/" que fechariam o comentário); '' se não vai ao código.
- **`escapeHtml(s)`** <sub>do módulo</sub> · [L669](../src/css.js#L669) — Escapa & < > " para que texto digitado pelo usuário nunca vire HTML/atributo no código exportado.
- **`generateCode(nodes, parent, assets = {}, { root = false, styles = null, ids = fa…)`** · [L680](../src/css.js#L680) — Gera { html, css } legíveis para uma lista de camadas: uma <div> (ou <p> para texto) por camada, cada uma com uma classe própria, e uma regra CSS por classe. Camadas ocultas não entram.
  - `nodes` <sub>object[]</sub> — camadas irmãs a exportar
  - `parent` <sub>object\|null</sub> — pai delas (define se são itens de flex/grid)
  - `[assets]` <sub>object</sub> — imagens do documento
- **`colorVarNames(styles)`** · [L806](../src/css.js#L806) — Nomes das variáveis de CSS dos ESTILOS DE COR do documento: id do estilo → "--cor-nome" (nome sem acento, em minúsculas, com hífens; nomes repetidos ganham -2, -3...). Vazio se não há estilos.
- **`joinCss(parts)`** · [L823](../src/css.js#L823) — Junta o CSS de várias chamadas de generateCode e escreve UM bloco `:root { --cor-x: ...; }` no topo com as variáveis usadas por elas. Sem variáveis, devolve só as regras.
  - `[]` <sub>{css: string, tokens?: [string, string][]</sub> — } parts
- **`EXPORT_RESET`** · [L853](../src/css.js#L853) — "Zera" os estilos que o NAVEGADOR dá sozinho a cada etiqueta. O editor desenha tudo com <div>, que não tem estilo próprio; no HTML exportado, porém, <ul> ganha recuo de 40px e marcadores, <button> ganha borda, fundo e texto centralizado, <a> fica azul e sublinhado, <h1> fica maior... Sem este bloco o site exportado ficava diferente do que o editor mostra. As regras das camadas (por classe) vêm depois e vencem estas.
- **`exportHtml(node, assets, title = 'Design', styles = null, { ids = false } = {})`** · [L864](../src/css.js#L864) — Documento HTML COMPLETO e independente (um único arquivo, sem dependências) com a camada e seus filhos. Abre direto no navegador; o CSS fica num <style> no <head>.

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
- **`exportHtmlFile(node, assets, styles = null)`** · [L34](../src/export.js#L34) — Baixa a camada como HTML completo e independente (um arquivo só). Nome: "<nome-da-camada>.html".
- **`saveProject(doc)`** · [L42](../src/export.js#L42) — Baixa o PROJETO inteiro como `.designer.json` (todas as páginas, imagens e estilos). É o backup de verdade: o salvamento automático fica só no navegador. Para abrir de novo: Arquivo → Abrir.
- **`openProjectFile(file)`** · [L51](../src/export.js#L51) — Lê um arquivo de projeto (.json) escolhido pelo usuário. Valida o mínimo (tem páginas) e completa campos que projetos antigos não tinham. Lança um erro com mensagem amigável se o arquivo não for um projeto.
  - `file` <sub>File</sub> — 
- **`exportPng(node, assets, scale = 2, styles = null)`** · [L69](../src/export.js#L69) — Exporta a camada como PNG. Técnica: monta o HTML+CSS da camada (o MESMO do painel Código), embrulha num SVG com <foreignObject>, carrega como imagem e desenha num <canvas> na escala pedida (2x = dobro de pixels, nítido em telas HiDPI). Se a camada está girada, a imagem tem o tamanho da caixa rotacionada e a camada fica centralizada nela.

  LIMITAÇÕES: o navegador não carrega fontes da web dentro de uma imagem SVG, então só valem as fontes INSTALADAS no
  computador; e efeitos como backdrop-filter podem não aparecer. (O HTML/SVG exportados não têm essas limitações.)
  - `node` <sub>object</sub> — camada
  - `assets` <sub>object</sub> — imagens do documento
  - `[scale=2]` <sub>number</sub> — 1 a 4
- **`exportSvgFile(node, assets, boxOf)`** · [L98](../src/export.js#L98) — Baixa a camada como SVG vetorial (ver svg.js). `boxOf` mede cada filho no DOM para respeitar flexbox/grid.

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

- **`toast(msg)`** <sub>do módulo</sub> · [L53](../src/main.js#L53) — Mostra um aviso curto (balão preto) na parte de baixo da tela por ~3s. Só um por vez: o novo substitui o antigo.
- **`savePrefs()`** <sub>do módulo</sub> · [L67](../src/main.js#L67) — Grava as preferências (falhas silenciosas: é só conveniência).
- **`openSettings()`** <sub>do módulo</sub> · [L92](../src/main.js#L92) — Janelas de Configurações e Projetos (ver ui/settings.js e ui/projects.js).
- **`quickSave()`** <sub>do módulo</sub> · [L95](../src/main.js#L95) — Ctrl+S: grava no arquivo ligado; se ainda não há arquivo, abre a janela para dar um nome.
- **`setLeftTab(tab)`** <sub>do módulo</sub> · [L127](../src/main.js#L127) — Troca a aba do painel esquerdo ('layers' | 'assets' | 'icons').
- **`setTab(tab)`** <sub>do módulo</sub> · [L159](../src/main.js#L159) — Troca a aba do painel direito ('design' | 'proto' | 'code' | 'comments') e já redesenha o painel escolhido.
- **`confirmReplace(question)`** <sub>do módulo</sub> · [L271](../src/main.js#L271) — Antes de TROCAR o projeto aberto (abrir outro, novo, exemplo, importar). Regras:

   - projeto gravado na pasta, ou exemplo/em branco não editado → troca sem perguntar (nada se perde);
   - projeto que só existe no navegador → pergunta, porque o navegador guarda UM projeto: ele seria substituído.
     Opções: salvar na pasta antes (abre "Salvar na pasta" e cancela a troca), trocar mesmo assim, ou cancelar.
  - ↩︎ `Promise<boolean>` true = pode trocar
- **`syncTopbar()`** <sub>do módulo</sub> · [L314](../src/main.js#L314) — Atualiza a barra superior conforme o estado: desfazer/refazer habilitados, ícone do tema, nome e indicador de salvo.
- **`saveStatus()`** <sub>do módulo</sub> · [L331](../src/main.js#L331) — O que o indicador do topo mostra: [estado (cor), texto, dica ao passar o mouse].

   - "Salvo na pasta"       → gravado no arquivo .json da pasta (e no navegador)
   - "Salvo no navegador"   → projeto ainda sem arquivo: só a cópia do navegador existe
   - "Só no navegador"      → tem arquivo, mas a pasta falhou (servidor desligado, conflito, permissão)
- **`TOOLS`** <sub>do módulo</sub> · [L343](../src/main.js#L343) — Ferramentas da barra flutuante: [id, ícone, dica com atalho]. A ordem é a ordem na tela.
- **`syncTools()`** <sub>do módulo</sub> · [L404](../src/main.js#L404) — Destaca o botão da ferramenta ativa (aria-pressed diz ao leitor de tela qual está ligada).
- **`syncZoom()`** <sub>do módulo</sub> · [L440](../src/main.js#L440) — Mostra o zoom atual em % no botão.
- **`syncCommentBadge()`** <sub>do módulo</sub> · [L486](../src/main.js#L486) — Número de comentários abertos no selo da aba (some quando é zero).
- **`setWidth(side, w)`** <sub>do módulo</sub> · [L570](../src/main.js#L570) — Define a largura de um painel (entre 200 e 520px), avisa quem depende do tamanho (réguas, canvas) e devolve o valor aplicado.
- **`syncEmpty()`** <sub>do módulo</sub> · [L624](../src/main.js#L624) — Mostra/esconde a dica conforme a página tem ou não camadas.
- **`onFail(msg)`** <sub>do módulo</sub> · [L632](../src/main.js#L632) — Trata uma falha inesperada: registra no console e avisa o usuário (com limite de frequência).

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
- **`TEXT_TAGS`** · [L69](../src/model.js#L69) — Etiquetas HTML que a camada pode virar no código exportado (campo opcional `tag`). A lista é FECHADA de propósito: o valor vai para o HTML gerado, então só entram nomes conhecidos e seguros.
- **`BOX_TAGS`** · [L70](../src/model.js#L70) — _(sem comentário)_
- **`tagOf(node)`** · [L72](../src/model.js#L72) — Etiqueta HTML efetiva da camada: a escolhida (se válida) ou a padrão (p para texto, section para seção, div para o resto).
- **`INTERACTIVE_TAGS`** <sub>do módulo</sub> · [L79](../src/model.js#L79) — Etiquetas que não podem ficar uma dentro da outra (link/botão dentro de link/botão).
- **`htmlTagIn(node, ancestors = [])`** · [L89](../src/model.js#L89) — Etiqueta que a camada usa NO HTML EXPORTADO, conferindo onde ela está. O editor desenha tudo com <div> (montado pelo JavaScript), mas o arquivo exportado é LIDO pelo navegador, e a leitura do HTML tem regras: um <li> dentro de outro <li> fecha o primeiro sozinho, um link dentro de outro link também. Sem esta conferência, a página exportada desmontava (itens saindo de dentro do card). Quando a etiqueta escolhida não cabe ali, volta para a padrão.
  - `node` <sub>object</sub> — 
  - `ancestors` <sub>string[]</sub> — etiquetas dos pais, do mais externo ao pai direto
  - ↩︎ `{ tag: string, wanted: string, reason: string ` }  `reason` vazio = a escolhida vale
- **`TYPE_LABEL`** · [L104](../src/model.js#L104) — Nome padrão (em português) de cada tipo de camada. Usado para nomear camadas novas ("Retângulo 3") e como fallback na lista de camadas.
- **`defaultFill(color = '#D9D9D9')`** · [L125](../src/model.js#L125) — Cria um objeto de PREENCHIMENTO (fill) completo. Um fill guarda os dados de TODOS os tipos ao mesmo tempo, de propósito: assim, ao trocar de "cor sólida" para "gradiente" e voltar, o usuário não perde a cor que tinha escolhido. Só o campo `type` decide qual parte vale.

   - type:    'none' | 'solid' | 'linear' | 'radial' | 'conic' | 'image'  (conic = gradiente cônico/angular)
   - color/opacity: cor sólida (hex #RRGGBB) e opacidade 0..1
   - stops:   paradas do gradiente [{ color, opacity, pos(0..100) }]
   - angle:   ângulo do gradiente linear em graus (CSS: 0 = para cima, 90 = para a direita); no cônico, onde o giro começa
   - assetId/fit: imagem (id em doc.assets) e como encaixa ('cover' | 'contain' | 'fill' | 'size' = tamanho próprio)
   - campos OPCIONAIS da imagem (ausente = padrão): posX/posY (posição 0–100%, padrão 50 = centro), size (% da largura da
     camada, só no ajuste 'size', padrão 100), repeat ('no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y', só em
     'contain'/'size', padrão 'no-repeat') e natW/natH (tamanho original da imagem, para o SVG exportado calcular o ladrilho)
   - styleId (opcional): liga a um estilo de cor compartilhado (ver components.js → syncStyles)
  - `[color='#D9D9D9']` <sub>string</sub> — cor sólida inicial
- **`defaultStroke()`** · [L143](../src/model.js#L143) — Contorno (stroke). No CSS vira `outline` (não `border`) porque o outline NÃO altera o layout nem o tamanho da caixa — por isso trocar a espessura não "empurra" os vizinhos num auto layout. `position`: 'inside' | 'center' | 'outside' controla o `outline-offset`.
- **`defaultShadow()`** · [L146](../src/model.js#L146) — Sombra (vira `box-shadow`; em textos vira `text-shadow`). `inset` = sombra interna.
- **`defaultLayout()`** · [L160](../src/model.js#L160) — Configuração de auto layout de um FRAME. É literalmente CSS:

   - mode: 'none' (filhos livres, position:absolute) | 'row' | 'column' (display:flex) | 'grid' (display:grid)
   - gap / colGap / rowGap: espaço entre itens (flex usa `gap`; grid usa colGap e rowGap)
   - cols / rows: colunas e linhas do grid (rows 0 = linhas automáticas)
   - colsTemplate / rowsTemplate (opcionais, só no grid): lista de trilhas em CSS, ex.: "200px 1fr 2fr" ou
     "repeat(auto-fit, minmax(200px, 1fr))". Quando existem, mandam no lugar de cols/rows (veja cleanTrackList)
   - padding: [topo, direita, baixo, esquerda] — mesma ordem do atalho `padding` do CSS
   - justify: justify-content (flex) ou justify-items (grid)
   - align:   align-items
   - wrap:    flex-wrap: wrap
- **`createNode(type, props = {})`** · [L183](../src/model.js#L183) — Cria uma camada ("nó") nova, com todos os campos que qualquer camada tem + os do seu tipo.

  SISTEMA DE COORDENADAS: `x` e `y` são relativos ao canto superior esquerdo do PAI (ou ao mundo, se for
  uma camada na raiz da página) e SEM rotação. A rotação gira a caixa em torno do próprio centro.
  - `type` <sub>'frame'\|'rect'\|'ellipse'\|'text'\|'group'\|'line'\|'path'\|'section'</sub> — tipo da camada
  - `[props]` <sub>object</sub> — campos que sobrescrevem os padrões (ex.: { x: 10, name: 'Botão' })
  - ↩︎ `object` o nó, já pronto para entrar em `page.children` ou `node.children`
- **`OVERFLOWS`** · [L308](../src/model.js#L308) — Modos de "conteúdo que sai da caixa" de um frame: [valor, rótulo].
- **`overflowOf(n)`** · [L313](../src/model.js#L313) — Modo de overflow de um frame: o campo `overflow`, ou — em projetos antigos — o que `clip` diz (true = cortar).
- **`cleanTrackList(text)`** · [L321](../src/model.js#L321) — Limpa o texto de uma lista de trilhas do grid (grid-template-columns/rows) digitado pelo usuário: tira o que não faz parte de uma lista de trilhas (; { } : aspas, @, etc.), apara os espaços e limita o tamanho. Como o texto vai para o CSS exportado, isso impede que alguém "feche" a regra e escreva outras. Valor inválido para o CSS (ex.: "abc") é simplesmente ignorado pelo navegador.
- **`isContainer(n)`** · [L326](../src/model.js#L326) — true para camadas que guardam filhos (frame, grupo e seção).
- **`isBoard(node, parent)`** · [L334](../src/model.js#L334) — "Prancheta" (board): frame no nível de cima, ou seja, na raiz da página OU direto dentro de uma seção. É o que ganha nome flutuante acima do canvas, vira tela no modo Apresentar e não entra em outros frames ao ser arrastado.
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai dela (null = raiz da página)
- **`constraintsOf(n)`** · [L337](../src/model.js#L337) — Constraints de uma camada, com padrão (esquerda/topo) para documentos salvos antes desse recurso existir.
- **`hasLayout(n)`** · [L340](../src/model.js#L340) — true se o nó é um frame com auto layout ligado (flex ou grid).
- **`isFlow(node, parent)`** · [L346](../src/model.js#L346) — A camada participa do fluxo do auto layout do pai? Se sim, ela é `position: relative` e quem decide a posição é o navegador (flex/grid); se não, é `position: absolute` e usa x/y.
- **`cloneDeep(v)`** · [L349](../src/model.js#L349) — Cópia profunda via JSON (suficiente: o documento só tem dados simples, sem funções nem datas).
- **`STATE_KEYS`** · [L356](../src/model.js#L356) — Propriedades VISUAIS que um estado pode sobrescrever (o resto — tamanho, posição, layout — não muda com o mouse). `scale` só existe nos estados (padrão 1): vira `transform: scale()`.
- **`STATE_LIST`** · [L358](../src/model.js#L358) — Estados disponíveis: [id, rótulo, pseudo-classe CSS].
- **`STATE_DEFAULT`** <sub>do módulo</sub> · [L360](../src/model.js#L360) — Valor padrão das chaves que a camada base pode não ter.
- **`canHaveStates(n)`** · [L363](../src/model.js#L363) — Camadas com caixa própria que aceitam estados (grupo, seção e linha não).
- **`hasStates(n, which)`** · [L365](../src/model.js#L365) — A camada tem algum estado com sobrescritas? (`which`: um estado específico, ou qualquer um se omitido.)
- **`stateView(node, states)`** · [L374](../src/model.js#L374) — "Visão" de uma camada num ou mais estados: uma cópia rasa dela com as sobrescritas do(s) estado(s) por cima, na ordem dada (como a cascata do CSS: ['hover', 'active'] = hover e depois pressionado por cima). Sem sobrescritas devolve a própria camada. Não altera nada.
  - `node` <sub>object</sub> — 
  - `states` <sub>string\|string[]</sub> — 
- **`editState(node, state, fn)`** · [L393](../src/model.js#L393) — Edita UM estado de uma camada: roda `fn` num RASCUNHO com os valores visuais do estado e guarda em `node.states[estado]` SÓ o que ficou diferente da camada base (se voltar ao valor base, a sobrescrita some; sem nenhuma, o estado some). É assim que o painel Design edita um estado sem saber que está num estado.
  - `node` <sub>object</sub> — camada real (é alterada)
  - `state` <sub>string</sub> — 'hover' \| 'active' \| 'focus'
  - `fn` <sub>(draft: object) => void</sub> — recebe o rascunho (mexa só nas chaves de STATE_KEYS)
- **`BREAKPOINTS`** · [L418](../src/model.js#L418) — Larguras em que o design muda (CSS @media). Desktop é o desenho base; Tablet vale até `max` px de janela; Celular também (e vem depois, então vence o Tablet). `preview` = largura sugerida para as telas ao desenhar naquele modo.
- **`BP_KEYS`** · [L423](../src/model.js#L423) — Propriedades que um breakpoint pode mudar (as que fazem sentido variar com a largura da tela).
- **`bpsUpTo(bp)`** · [L430](../src/model.js#L430) — Breakpoints "até" um (inclusive), na ordem da cascata: ate('mobile') = ['tablet', 'mobile'].
- **`hasBps(n, which)`** · [L435](../src/model.js#L435) — A camada tem sobrescritas em algum breakpoint (ou num específico)?
- **`bpView(node, bp)`** · [L444](../src/model.js#L444) — "Visão" de uma camada num breakpoint: cópia rasa com as sobrescritas por cima, em cascata (celular = base + tablet + celular). `null` numa sobrescrita significa "esta propriedade não existe aqui". Sem sobrescritas devolve a própria camada. Não altera nada.
  - `node` <sub>object</sub> — 
  - `bp` <sub>string\|null</sub> — 'tablet' \| 'mobile' \| null (desktop)
- **`editBp(node, bp, fn)`** · [L467](../src/model.js#L467) — Edita UM breakpoint de uma camada: roda `fn` num RASCUNHO com os valores daquela largura e guarda em `node.bps[bp]` SÓ o que difere da largura anterior na cascata (se voltar ao valor de antes, a sobrescrita some). É assim que o painel Design edita o Tablet/Celular sem saber que está nele.
  - `node` <sub>object</sub> — camada real (é alterada)
  - `bp` <sub>string</sub> — 'tablet' \| 'mobile'
  - `fn` <sub>(draft: object) => void</sub> — recebe o rascunho (só as chaves de BP_KEYS ficam)
- **`cloneNode(node)`** · [L489](../src/model.js#L489) — Clona uma camada e TODOS os descendentes, gerando ids novos (usado em duplicar, copiar/colar e Alt+arrastar).
- **`walk(list, fn, parent = null)`** · [L505](../src/model.js#L505) — Percorre a árvore de camadas em profundidade.
  - `list` <sub>object[]</sub> — lista de nós (ex.: page.children)
  - `fn` <sub>(node, parent, list, index) => (void\|false)</sub> — chamada para cada nó; retornar `false` NÃO desce nos filhos dele
  - `[parent]` <sub>object\|null</sub> — pai da lista (null na raiz)
- **`makePage(name = 'Página 1')`** · [L514](../src/model.js#L514) — Cria uma página vazia. `guides` guarda as guias de régua (posições em px do mundo).
- **`makeDoc()`** · [L526](../src/model.js#L526) — Documento vazio. Estrutura completa: { version, name,

     pages:  [{ id, name, children: [camadas], guides: [{axis:'x'|'y', pos}] }],
     assets: { [assetId]: 'data:image/...' }   // imagens ficam FORA das páginas para não pesarem no histórico
     styles: { colors: [...], texts: [...] },  // estilos compartilhados de cor e texto
     comments: [...] }                          // comentários nas camadas (veja comments.js)
- **`nextName(page, type)`** · [L531](../src/model.js#L531) — Gera o próximo nome livre para o tipo ("Retângulo 1", "Retângulo 2"...), contando as camadas do mesmo tipo na página.
- **`fitGroups(list)`** · [L552](../src/model.js#L552) — Ajusta cada GRUPO ao retângulo que envolve seus filhos e remove grupos vazios. Como um grupo não tem tamanho próprio, depois de mover/redimensionar um filho a caixa do grupo precisa ser recalculada. Roda no fim de cada gesto (em `store.commit`), não durante o arrasto, para não "mexer o chão" debaixo do ponteiro. As coordenadas dos filhos são relativas ao grupo, então ao mover a origem do grupo subtraímos o mesmo valor dos filhos (a posição visual não muda).
  - `list` <sub>object[]</sub> — lista de nós a processar (recursivo)
- **`applyConstraints(frame, ow, oh)`** · [L586](../src/model.js#L586) — Aplica as CONSTRAINTS dos filhos depois que o frame mudou de tamanho (de ow×oh para frame.w×frame.h). Por eixo, cada filho escolhe: colar no início (padrão), colar no fim (right/bottom), esticar entre as duas bordas (leftright/topbottom), manter o centro ou escalar proporcionalmente. Não faz nada em frames com auto layout (aí quem manda é o CSS). É recursivo: se um filho mudou de tamanho, os filhos dele reagem também.
  - `frame` <sub>object</sub> — frame JÁ com o tamanho novo
  - `ow` <sub>number</sub> — largura antiga
  - `oh` <sub>number</sub> — altura antiga
- **`hasSizeLimits(n)`** · [L613](../src/model.js#L613) — Tipos de camada que têm uma caixa CSS de verdade para receber limites de tamanho e proporção: grupos não têm tamanho próprio (a caixa é recalculada dos filhos) e a linha é só uma barra.
- **`hasAspect(n)`** · [L616](../src/model.js#L616) — A camada tem proporção (aspect-ratio) ligada? Texto, grupo e linha não usam.
- **`limitSize(n, w, h)`** · [L623](../src/model.js#L623) — Ajusta (w, h) aos LIMITES da camada: campos opcionais `minW`, `maxW`, `minH`, `maxH` em px (ausentes = sem limite). Como no CSS, o mínimo vence o máximo quando os dois se contradizem.
  - ↩︎ `[number, number]` largura e altura já limitadas
- **`applyLimits(n)`** · [L636](../src/model.js#L636) — Aplica os limites ao tamanho JÁ guardado, só nos eixos de tamanho FIXO (os eixos hug/fill quem decide é o navegador, e o canvas mede de volta). Se mudou, os filhos reagem como em qualquer redimensionamento (constraints).
- **`resizeNode(n, nw, nh, axis = 'w')`** · [L652](../src/model.js#L652) — Redimensiona UMA camada de forma "inteligente": respeita "travar proporção", marca o eixo como 'fixed' e propaga o efeito para dentro (escala os filhos de um grupo; aplica constraints nos filhos de um frame).
  - `n` <sub>object</sub> — camada
  - `nw` <sub>number</sub> — nova largura
  - `nh` <sub>number</sub> — nova altura
  - `[axis='w']` <sub>'w'\|'h'</sub> — qual campo o usuário editou (importa para a trava de proporção)
- **`scaleNode(node, sx, sy)`** · [L683](../src/model.js#L683) — Escala uma camada e (se for grupo) todos os filhos por (sx, sy), multiplicando posição e tamanho. Usado ao redimensionar grupos e seleções múltiplas. Textos viram 'fixed' na largura (senão voltariam ao tamanho natural no render).
- **`slugify(s)`** · [L700](../src/model.js#L700) — Transforma um nome em "slug" seguro para classe CSS e nome de arquivo: tira acentos, deixa minúsculo e troca qualquer coisa fora de a-z/0-9 por '-'. "Botão primário" → "botao-primario". Vazio vira 'item'.

---

## src/modes.js

**MODOS DE COR (claro/escuro...) E VARIÁVEIS DE TAMANHO   (módulo puro, testado em tests/modes.test.js)** · [abrir o código](../src/modes.js)

```text
 MODOS: um estilo de cor ({ id, name, color, opacity }) pode ter um valor diferente por modo:
     style.modes = { [idDoModo]: { color, opacity } }
 Os modos do projeto ficam em `doc.styles.modes = [{ id, name, scheme }]` (`scheme`: 'dark' | 'light' | null, para o
 CSS escolher o modo sozinho pela preferência do sistema). O modo "padrão" é o próprio valor do estilo (sem entrada).
 No CSS isso vira variáveis: `:root { --cor-fundo: #fff }` e `:root[data-theme="escuro"] { --cor-fundo: #111 }`.

 VARIÁVEIS: números reutilizáveis ({ id, name, value }) — espaçamentos, raios e tamanhos de fonte. Uma camada liga um
 campo a uma variável em `node.vars = { gap: id, padding: id, radius: id, fontSize: id }`; o valor continua guardado
 na camada (para o canvas) e `syncVars` o atualiza quando a variável muda. No CSS vira `gap: var(--espaco-md)`.
```

- **`VAR_PROPS`** · [L21](../src/modes.js#L21) — Campos que uma camada pode ligar a uma variável, e como cada um é lido/escrito.
- **`modesOf(styles)`** · [L38](../src/modes.js#L38) — Lista de modos do projeto (vazia se não há).
- **`darkVariant(hex)`** · [L44](../src/modes.js#L44) — Cor "escura" automática: inverte a luminosidade (claro vira escuro e vice-versa), mantendo o matiz e atenuando um pouco a saturação dos tons muito claros, que ficariam berrantes no escuro.
- **`addMode(styles, { name, scheme = null, auto = false })`** · [L55](../src/modes.js#L55) — Cria um modo. Com `auto`, já gera os valores de todos os estilos de cor (inversão de luminosidade); senão os estilos começam iguais ao padrão e você ajusta um a um.
  - ↩︎ `object` o modo criado
- **`removeMode(styles, id)`** · [L63](../src/modes.js#L63) — Apaga um modo e os valores dele em todos os estilos.
- **`styleValue(style, modeId)`** · [L70](../src/modes.js#L70) — Valor de um estilo de cor num modo (o do próprio estilo se o modo não tem entrada).
- **`setStyleColor(style, modeId, color, opacity)`** · [L73](../src/modes.js#L73) — Muda a cor de um estilo no modo dado (null = o valor padrão do estilo).
- **`modeView(node, styles, modeId)`** · [L82](../src/modes.js#L82) — "Visão" de uma camada num modo de cor: se o preenchimento sólido está ligado a um estilo que tem valor para o modo, devolve uma cópia com essa cor. Senão, a própria camada. Não altera nada.
- **`varsOf(styles)`** · [L92](../src/modes.js#L92) — Variáveis do projeto.
- **`addVar(styles, name, value)`** · [L95](../src/modes.js#L95) — Cria uma variável ({ id, name, value }).
- **`removeVar(styles, id)`** · [L102](../src/modes.js#L102) — Apaga uma variável (as camadas ligadas a ela mantêm o valor que tinham; `syncVars` solta as ligações).
- **`bindVar(node, prop, v)`** · [L108](../src/modes.js#L108) — Liga um campo de uma camada a uma variável e já aplica o valor.
- **`unbindVar(node, prop)`** · [L115](../src/modes.js#L115) — Desliga um campo da variável (o valor atual fica).
- **`syncVars(doc, force = false)`** · [L127](../src/modes.js#L127) — Reconcilia as camadas ligadas a variáveis. Roda a cada commit (como syncStyles):

   - ligação a uma variável que não existe mais, ou a um campo que a camada não tem (gap em texto), é solta;
   - se o valor do campo FOI EDITADO à mão (difere da variável), a ligação é solta e o valor da pessoa fica;
   - com `force` (quando a própria variável mudou de valor), o valor da variável é escrito em todas as camadas ligadas.
- **`varCssNames(styles, slugify)`** · [L146](../src/modes.js#L146) — Nomes de variável de CSS das variáveis de tamanho: id → "--espaco-md" (nome sem acento, minúsculo, com hífens; repetidos ganham -2). Vazio se não há.

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
- **`docVersion`** <sub>interna</sub> · [L501](../src/overlay.js#L501) — Muda a cada alteração do documento: invalida o "mapa de classes" do inspetor.
- **`classCache`** <sub>interna</sub> · [L503](../src/overlay.js#L503) — Cache do mapa id → { tag, cls } da tela inspecionada (gerar o HTML da tela inteira a cada movimento seria caro).
- **`exportedName(id)`** <sub>interna</sub> · [L508](../src/overlay.js#L508) — Etiqueta HTML e classe CSS que a camada recebe NO CÓDIGO EXPORTADO. As classes dependem da tela inteira (nomes repetidos ganham -2, -3...), então gera o código da tela onde a camada está (uma vez por versão do documento).
- **`drawInspect(id)`** <sub>interna</sub> · [L527](../src/overlay.js#L527) — Desenha o "box model" da camada como o DevTools: margem (laranja), padding (verde) e conteúdo (azul), medidos no próprio elemento do canvas (getComputedStyle = o CSS que o navegador está aplicando de verdade), e a etiqueta com etiqueta HTML, classe, tamanho e as propriedades principais.
- **`pill(aabb, text)`** <sub>interna</sub> · [L584](../src/overlay.js#L584) — Etiqueta azul "L × A" logo abaixo da seleção.

---

## src/palettes.js

**PALETAS DE COR PRÓPRIAS (salvas no navegador, valem para todos os projetos)** · [abrir o código](../src/palettes.js)

```text
 Uma paleta é uma lista nomeada de cores: { id, name, colors: ['#7C5CFF', ...] }. Diferente dos "estilos de cor"
 (que moram DENTRO do projeto e mudam todas as camadas ligadas a eles), as paletas são uma "gaveta de tintas" pessoal:
 ficam no navegador, aparecem no seletor de cor de qualquer projeto e podem virar estilos de cor quando você quiser.

 As funções de cima são PURAS (testadas no Node, tests/palettes.test.js). O fim do arquivo é o armazenamento
 (localStorage) com um aviso para quem estiver ouvindo (painel Recursos e seletor de cor).
```

- **`MAX_COLORS`** · [L15](../src/palettes.js#L15) — Máximo de cores por paleta e de paletas (evita lotar o armazenamento por engano).
- **`MAX_PALETTES`** · [L16](../src/palettes.js#L16) — _(sem comentário)_
- **`normalizeHex(v)`** · [L21](../src/palettes.js#L21) — "#abc", "abc", "#AABBCC" → "#AABBCC"; qualquer outra coisa → null.
- **`makePalette(name, colors = [])`** · [L28](../src/palettes.js#L28) — Cria uma paleta (cores inválidas e repetidas são descartadas).
- **`addColor(p, color)`** · [L35](../src/palettes.js#L35) — Acrescenta uma cor (se válida, nova e houver espaço). Devolve true se entrou.
- **`removeColor(p, color)`** · [L43](../src/palettes.js#L43) — Tira uma cor da paleta. Devolve true se existia.
- **`parseColors(text)`** · [L55](../src/palettes.js#L55) — Lê cores de um texto livre: aceita "#7c5cff", "7c5cff", "#fff", "rgb(124, 92, 255)" separados por espaço, vírgula, ponto e vírgula ou quebra de linha. Devolve só as válidas, sem repetir, na ordem em que aparecem.
- **`docColors(doc, max = MAX_COLORS)`** · [L69](../src/palettes.js#L69) — As cores mais usadas num documento (preenchimentos sólidos, contornos e sombras), da mais para a menos usada.
- **`slug(s)`** · [L84](../src/palettes.js#L84) — Nome de variável de CSS a partir do nome da paleta: "Marca Roxa" → "marca-roxa".
- **`paletteCss(p)`** · [L87](../src/palettes.js#L87) — A paleta como bloco de variáveis de CSS, pronto para colar: ":root { --marca-1: #7C5CFF; ... }".
- **`sanitize(list)`** · [L93](../src/palettes.js#L93) — Limpa uma lista lida do armazenamento (formato errado, cores inválidas, excesso). Nunca lança.
- **`getPalettes()`** · [L112](../src/palettes.js#L112) — Paletas atuais (carrega do navegador na 1ª chamada).
- **`persist()`** <sub>do módulo</sub> · [L120](../src/palettes.js#L120) — Grava e avisa os ouvintes.
- **`createPalette(name, colors = [])`** · [L126](../src/palettes.js#L126) — Cria uma paleta nova, já a deixa como a paleta ativa do seletor de cor, e devolve ela.
- **`changePalette(id, fn)`** · [L137](../src/palettes.js#L137) — Aplica uma mudança a uma paleta (por id) e salva. Devolve o que a função devolveu (ou undefined se não achou).
- **`getActiveId()`** · [L149](../src/palettes.js#L149) — Id da paleta ativa no seletor de cor (a escolhida por último; senão a 1ª). null se não há paletas.
- **`setActiveId(id)`** · [L157](../src/palettes.js#L157) — Escolhe a paleta ativa do seletor de cor.
- **`getRecents()`** · [L163](../src/palettes.js#L163) — Últimas cores escolhidas (a mais recente primeiro, até 14).
- **`pushRecent(color)`** · [L171](../src/palettes.js#L171) — Registra uma cor escolhida nas recentes (sem repetir).
- **`deletePalette(id)`** · [L179](../src/palettes.js#L179) — Apaga uma paleta.
- **`onPalettes(fn)`** · [L186](../src/palettes.js#L186) — Ouve mudanças (devolve a função que desliga).

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
- **`editNode()`** <sub>interna</sub> · [L198](../src/pen.js#L198) — Vetor em edição (ou null).
- **`toLocal(n, w)`** <sub>interna</sub> · [L204](../src/pen.js#L204) — Mundo → espaço do vetor (o "viewBox" vw×vh). Desfaz a rotação da camada (rotação inversa em torno do centro) e converte a posição na caixa para o sistema de coordenadas dos pontos.
- **`toWorld(n, p)`** <sub>interna</sub> · [L212](../src/pen.js#L212) — Espaço do vetor → mundo (o inverso de toLocal), considerando a rotação da camada. Usado para desenhar os pontos na tela.
- **`startEdit(id)`** <sub>interna</sub> · [L220](../src/pen.js#L220) — Entra no modo de edição de pontos de um vetor (duplo clique ou Enter).
- **`exitEdit()`** <sub>interna</sub> · [L230](../src/pen.js#L230) — Sai da edição de pontos.
- **`downEdit(e, kind, idx)`** <sub>interna</sub> · [L244](../src/pen.js#L244) — Clicou num ponto ou alça. `kind`: 'pt' (ponto), 'hin' ou 'hout' (alças).

   - Shift+clique num ponto: soma/tira o ponto da seleção (sem arrastar).
   - Alt+clique num ponto: converte canto ↔ suave (como a ferramenta "converter ponto" do Illustrator).
   - Clique/arrasto: seleciona o ponto (se já está num grupo selecionado, o grupo todo vai junto).
- **`moveEditHandle(world, e)`** <sub>interna</sub> · [L268](../src/pen.js#L268) — Arrasta ponto ou alça (converte o mouse para o espaço do vetor).

   - Ponto: leva as próprias alças junto.
   - Alça: a alça oposta é espelhada (curva suave) — segure Alt para quebrar o espelho e fazer um bico.
- **`togglePointType(idx)`** <sub>interna</sub> · [L300](../src/pen.js#L300) — Alterna o ponto entre CANTO (sem alças) e SUAVE. Ao suavizar, cria alças opostas e proporcionais à direção entre o ponto anterior e o próximo (quarto da distância), que dá uma curva natural.
- **`deletePoint()`** <sub>interna</sub> · [L317](../src/pen.js#L317) — Remove os pontos selecionados (o caminho mantém no mínimo 2 pontos).
- **`addPointAt(e)`** <sub>interna</sub> · [L333](../src/pen.js#L333) — Alt+clique no traço: insere um ponto no lugar do traço mais perto do clique, MEDINDO NA CURVA (nearestOnPath) e dividindo o segmento (splitSegment): num trecho curvo o ponto novo nasce com as alças certas e o desenho não muda.
- **`hover(e)`** <sub>interna</sub> · [L350](../src/pen.js#L350) — Com Alt pressionado, mostra um pontinho no traço onde o clique adicionaria um ponto (feedback antes de clicar).
- **`scaleOf(n)`** <sub>interna</sub> · [L366](../src/pen.js#L366) — Escala do espaço do vetor (vw×vh) para px da camada.
- **`pointType()`** <sub>interna</sub> · [L369](../src/pen.js#L369) — Tipo do ponto selecionado: 'corner' (sem alças), 'smooth' (alças alinhadas e iguais) ou 'free' (qualquer outra).
- **`setPointType(type)`** <sub>interna</sub> · [L382](../src/pen.js#L382) — Define o tipo dos pontos selecionados: 'corner' tira as alças; 'smooth' deixa as duas alças iguais e opostas.
- **`pointPos()`** <sub>interna</sub> · [L407](../src/pen.js#L407) — Posição do ponto selecionado em px, relativa ao PAI da camada (como o X/Y da camada): { x, y } ou null.
- **`setPointPos(axis, v)`** <sub>interna</sub> · [L419](../src/pen.js#L419) — Move o ponto selecionado para X ou Y (px relativos ao pai), levando as alças junto. NÃO grava no histórico: quem chama (o campo numérico do painel) faz o commit ao terminar.
- **`nudge(dx, dy)`** <sub>interna</sub> · [L434](../src/pen.js#L434) — Setas movem o ponto selecionado (px do pai; Shift = 10). Devolve true se tratou a tecla.
- **`reverse(id)`** <sub>interna</sub> · [L454](../src/pen.js#L454) — Inverte a direção do caminho (o primeiro ponto vira o último). O desenho não muda; setas de preenchimento e animações de traço sim.
- **`pathD(id)`** <sub>interna</sub> · [L470](../src/pen.js#L470) — O atributo `d` do SVG deste vetor (todos os contornos), no espaço próprio dele (viewBox 0 0 vw vh).
- **`applyPathD(id, d)`** <sub>interna</sub> · [L480](../src/pen.js#L480) — Substitui o desenho do vetor pelo `d` de um SVG (aceita M L H V C S Q T A Z, absolutos e relativos). Só mexe na geometria: cor, contorno, nome e posição continuam. A caixa passa a ter o tamanho do desenho colado.
  - ↩︎ `boolean` false se o texto não tem nenhum caminho
- **`continueAt(e)`** <sub>interna</sub> · [L513](../src/pen.js#L513) — Cliques da caneta na PONTA de um vetor aberto que está selecionado CONTINUAM aquele caminho: devolve um caminho em desenho (ui.pen) já com os pontos do vetor, com a ponta clicada no fim. Não vale para vetor girado ou com furos.
- **`marqueeStart(e, onBody)`** <sub>interna</sub> · [L530](../src/pen.js#L530) — Começa um retângulo de seleção de PONTOS (arrastar no vazio durante a edição). Shift soma à seleção atual.
- **`marqueeMove(e, d)`** <sub>interna</sub> · [L537](../src/pen.js#L537) — Atualiza o retângulo e seleciona os pontos que caem dentro dele.
- **`marqueeEnd(d)`** <sub>interna</sub> · [L555](../src/pen.js#L555) — Soltou: sem arrastar, clicar no vazio limpa os pontos (e, fora do vetor, sai da edição e desmarca).
- **`selectAll()`** <sub>interna</sub> · [L564](../src/pen.js#L564) — Seleciona todos os pontos do vetor em edição (Ctrl+A).
- **`selectedCount()`** <sub>interna</sub> · [L572](../src/pen.js#L572) — Quantos pontos estão selecionados.
- **`openAfter()`** <sub>interna</sub> · [L578](../src/pen.js#L578) — "Abrir aqui": num caminho FECHADO, corta o segmento logo DEPOIS do ponto selecionado e o caminho vira aberto (o ponto seguinte passa a ser o início). É a tesoura do Illustrator, em versão simples.
- **`overlaySvg()`** <sub>interna</sub> · [L599](../src/pen.js#L599) — Markup SVG (em px de tela) do que a caneta mostra: o caminho em construção com o "elástico" até o cursor, os pontos (o primeiro em rosa, indica onde fechar) e as alças; ou, na edição, os pontos do vetor (e as alças do ponto selecionado). Elementos com data-edit/data-idx são clicáveis (tools.js os reconhece).
- **`isDrawing()`** <sub>interna</sub> · [L635](../src/pen.js#L635) — Está desenhando um caminho novo?
- **`isEditing()`** <sub>interna</sub> · [L637](../src/pen.js#L637) — Está editando os pontos de um vetor?

---

## src/present.js

**MODO APRESENTAR (PROTÓTIPO EM TELA CHEIA)** · [abrir o código](../src/present.js)

```text
 Executa as interações definidas na aba Protótipo (clicar/passar o mouse → navegar, voltar, abrir link)
 com transições. Reaproveita css.js, então a apresentação tem exatamente a aparência do design.
```

- **`TRANSITIONS`** <sub>do módulo</sub> · [L18](../src/present.js#L18) — Transições entre telas no modo Apresentar. Cada uma tem `enter` (animação da tela que ENTRA) e `leave` (da que SAI), no formato de keyframes da Web Animations API. 'instant' = null (troca seca). Os transforms são combinados com o `scale` de encaixe na tela em show().
- **`TRANSITION_OPTIONS`** · [L27](../src/present.js#L27) — Lista [valor, rótulo] das transições, para o menu da aba Protótipo.
- **`attachStates(el, node, parent, assets, isRoot)`** <sub>do módulo</sub> · [L37](../src/present.js#L37) — Liga os ESTADOS (hover, pressionado, foco) de uma camada ao elemento da apresentação: ao entrar/sair/pressionar, troca o estilo inline pelo da visão correspondente (o `transition` do próprio estilo anima a troca). Pressionado vale em cima do hover, como a cascata do CSS.
- **`buildDom(node, parent, assets, isRoot)`** <sub>do módulo</sub> · [L68](../src/present.js#L68) — Monta o DOM de um frame para apresentação a partir do MODELO (não copia o canvas do editor). Usa o MESMO `nodeStyle` do editor, então a apresentação é idêntica ao design. Camadas com interação ganham cursor de mão; `data-id` permite achar a camada (e suas interações) no clique.
- **`createPresent({ store, canvas })`** · [L87](../src/present.js#L87) — Cria o modo APRESENTAR (protótipo em tela cheia).

   - open(id): abre no frame da camada selecionada (ou no marcado como ponto de partida, ou no primeiro)
   - cliques/hover disparam as interações da camada (ou do ancestral mais próximo que tenha uma)
   - `stack` guarda o histórico de telas visitadas, para a ação "Voltar"
   - Esc fecha · R reinicia
- **`frames()`** <sub>interna</sub> · [L96](../src/present.js#L96) — Todos os frames do documento (de todas as páginas) — destinos possíveis das interações.
- **`findFrame(id)`** <sub>interna</sub> · [L102](../src/present.js#L102) — Frame pelo id.
- **`rootOf(id)`** <sub>interna</sub> · [L104](../src/present.js#L104) — Frame da raiz que contém a camada (sobe os pais).
- **`fit(board)`** <sub>interna</sub> · [L111](../src/present.js#L111) — Escala a tela para caber na janela (até 200%), centralizada. Devolve o fator usado.
- **`makeBoard(frame)`** <sub>interna</sub> · [L119](../src/present.js#L119) — Cria o "quadro" de uma tela: caixa do tamanho do frame + DOM + ouvintes de clique e hover.
- **`trigger(target, kind, related)`** <sub>interna</sub> · [L142](../src/present.js#L142) — Dispara a interação do tipo pedido ('click' | 'hover'). Sobe da camada clicada até um ancestral que tenha uma interação desse tipo (assim clicar no texto dentro de um botão aciona o botão). No hover, ignora movimentos dentro do mesmo elemento (só vale ao ENTRAR).
- **`run(it)`** <sub>interna</sub> · [L152](../src/present.js#L152) — Executa uma interação: abrir link, voltar para a tela anterior ou navegar para outro frame (com a transição escolhida).
- **`show(frameId, transition, isBack = false)`** <sub>interna</sub> · [L171](../src/present.js#L171) — Mostra uma tela, animando a troca. A tela antiga fica por baixo durante a transição e é removida ao final; `busy` bloqueia novos cliques nesse intervalo (330ms ≈ duração 320ms).
  - `frameId` <sub>string</sub> — frame a mostrar
  - `transition` <sub>string</sub> — chave de TRANSITIONS
  - `[isBack]` <sub>boolean</sub> — true quando vem de "Voltar" (não empilha no histórico)
- **`open(startId)`** <sub>interna</sub> · [L195](../src/present.js#L195) — Abre a apresentação. Devolve false se não há nenhum frame para apresentar.
- **`onKey(e)`** <sub>interna</sub> · [L221](../src/present.js#L221) — Teclas na apresentação (captura antes do editor): Esc fecha, R reinicia; as outras são engolidas para não mexer no editor por trás.
- **`onResize()`** <sub>interna</sub> · [L233](../src/present.js#L233) — Reencaixa as telas quando a janela muda de tamanho.
- **`close()`** <sub>interna</sub> · [L238](../src/present.js#L238) — Fecha a apresentação e remove os ouvintes globais.

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

## src/sample-vitrine.js

**EXEMPLO "VITRINE": um site inteiro que usa TUDO que o editor faz** · [abrir o código](../src/sample-vitrine.js)

```text
 Uma landing page responsiva (a fictícia "Lumen") feita só com o que o app oferece. Abra, mexa e exporte o HTML:

  • AUTO LAYOUT: flexbox em linha e coluna, `fill`/`hug`, `wrap`, e uma GRADE de 3 colunas (CSS Grid);
  • RESPONSIVO: a grade vai de 3 → 2 → 1 colunas, o hero vira coluna, o menu some e as fontes diminuem
    (barra Desktop/Tablet/Celular no topo) e a tela raiz tem largura FLUIDA (width: 100%);
  • MODOS DE COR: estilos de cor com valor claro e ESCURO (botão de sol/lua no topo);
  • VARIÁVEIS: espaçamentos e raio ligados a variáveis (`var(--espaco-m)`) + estilos de texto;
  • ESTADOS: hover, pressionado e foco nos botões e nos cards, com transição e cursor;
  • COMPONENTES: botão, card de recurso e card de plano (um principal, várias instâncias com texto próprio);
  • VETORES: ícones desenhados com a caneta; gradientes linear, radial e cônico; sombras, blur e VIDRO;
  • HTML SEMÂNTICO: header, nav, section, h1/h2/h3, a (com href), button, footer; descrição de acessibilidade;
  • TEXTO: limite de linhas com "…" (line-clamp), tamanhos máximos, e uma faixa que ROLA na horizontal;
  • PROTÓTIPO: o botão do topo leva à tela "Obrigado" (e ela volta);
  • NOTAS e COMENTÁRIOS nas camadas, grades de layout na tela, seção do canvas e uma 2ª página "Guia de estilo".
```

- **`text(t, props = {})`** <sub>do módulo</sub> · [L39](../src/sample-vitrine.js#L39) — Atalhos de criação: texto, cor sólida, cor ligada a um estilo, flex e vetor (ícone de 24×24).
- **`star(cx = 12, cy = 12, ro = 10.5, ri = 4.6)`** <sub>do módulo</sub> · [L52](../src/sample-vitrine.js#L52) — Estrela de 5 pontas em 24×24 (para o logo e um ícone).
- **`buildSampleShowcase()`** · [L70](../src/sample-vitrine.js#L70) — Monta o projeto "Vitrine" (documento completo, pronto para abrir).
  - ↩︎ `object` documento (ver model.js → makeDoc)

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

- **`createStore({ initial = null, persist = async () => 'browser' } = {})`** · [L38](../src/store.js#L38) — Cria o STORE: a única fonte de verdade do app. Tudo que o usuário vê (canvas, painéis, menus) é uma função do que está aqui; e toda mudança passa por aqui. Fluxo:

    ação do usuário → store.update(...)/commit() → emit(motivo) → quem assina (canvas, painéis) redesenha

  O que o store guarda:
    state.doc  → o DOCUMENTO (o que é salvo): páginas, camadas, imagens, estilos
    state.ui   → estado de INTERFACE (não é salvo no .json): seleção, ferramenta, zoom, painel aberto...
  - `[opts]` <sub>object</sub> — 
  - `[opts.initial]` <sub>object\|null</sub> — projeto já carregado do navegador ({ doc, views, theme, link }) — ver storage.loadLocal. null/ausente = abre o projeto de exemplo.
  - `[opts.persist]` <sub>(record) => Promise<string></sub> — grava o projeto (navegador e, se ligado, a pasta). Devolve onde gravou ('browser' \| 'folder'). O store só decide QUANDO salvar; o COMO fica em main.js/storage.js.
  - ↩︎ `object` a API do store (get, update, commit, undo, setSelection, subscribe...)
- **`emit(reason)`** <sub>interna</sub> · [L114](../src/store.js#L114) — Avisa que algo mudou, dizendo o MOTIVO ('doc' | 'selection' | 'view' | 'tool' | 'history' | 'ui' | 'overlay' | 'hover'...). Dois canais de entrega, de propósito:

   - síncrono (subscribeSync): o canvas e o overlay precisam estar em dia ANTES do próximo evento do mouse,
     senão medem o DOM desatualizado durante um arrasto;
   - 1x por frame (subscribe): painéis pesados (camadas, propriedades) juntam vários motivos em uma só atualização.
- **`index()`** <sub>interna</sub> · [L139](../src/store.js#L139) — Índice id → { node, parent, list, i, page } de TODAS as camadas de todas as páginas. É reconstruído só quando `version` mudou (estrutura nova), o que torna get(id) barato mesmo com milhares de camadas. `list` é o array onde o nó vive (page.children ou parent.children) e `i` a posição dele nesse array.
- **`restore(snap)`** <sub>interna</sub> · [L225](../src/store.js#L225) — Volta o documento para uma foto do histórico (usado por desfazer/refazer). Mantém a seleção do que ainda existe.
- **`scheduleSave()`** <sub>interna</sub> · [L362](../src/store.js#L362) — Agenda o salvamento automático para 400 ms depois da ÚLTIMA mudança (debounce): editar 50 vezes seguidas grava só 1 vez. Marca saveState='saving' para o topo mostrar "Salvando…".
- **`save()`** <sub>interna</sub> · [L377](../src/store.js#L377) — Grava o projeto chamando `persist` (navegador + pasta, ver main.js). Só UMA gravação por vez: se algo mudar enquanto grava, marcamos `dirtyAgain` e gravamos de novo ao terminar (a última versão nunca se perde). Se falhar, saveState vira 'error' e `onSaveError` avisa o usuário.
  - ↩︎ `Promise<void>` resolve quando o projeto (como estava) terminou de ser gravado
- **`init()`** <sub>interna</sub> · [L427](../src/store.js#L427) — Estado inicial: usa o projeto que main.js já leu do navegador (`initial`); se não houver, abre o exemplo. Campos novos (assets, styles) são preenchidos para aceitar projetos salvos por versões antigas do app.

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
- **`colorFilterPrimitives(node)`** · [L60](../src/svg.js#L60) — Os filtros de COR da camada (brightness, contrast, saturate, grayscale, hue-rotate) como primitivas de <filter> do SVG, na mesma ordem do CSS. grayscale vira `saturate` com (1 − valor), que é o mesmo efeito visual.
  - ↩︎ `string[]` primitivas prontas (vazio se a camada não usa nenhum)
- **`toSvg(root, { assets = {}, boxOf = (n) => ({ x: n.x, y: n.y, w: n.w, h: n…)`** · [L76](../src/svg.js#L76) — _(sem comentário)_
- **`paint(fill, w, h)`** <sub>interna</sub> · [L87](../src/svg.js#L87) — Atributo `fill` SVG de um preenchimento. Gradientes viram <linearGradient>/<radialGradient> em <defs> e o fill referencia por url(#id). O ângulo CSS (0° = para cima) vira o vetor x1,y1→x2,y2. Imagens são tratadas à parte.
- **`strokeAttr(st)`** <sub>interna</sub> · [L109](../src/svg.js#L109) — Atributos de contorno SVG (cor, espessura, opacidade e tracejado/pontilhado via stroke-dasharray).
- **`filterAttr(node)`** <sub>interna</sub> · [L119](../src/svg.js#L119) — Sombra externa, blur e filtros de cor da camada como <filter> (feDropShadow + feGaussianBlur). stdDeviation = blur/2 porque o "blur" do CSS corresponde a ~2× o desvio-padrão do SVG. A área do filtro é ampliada (−50%…200%) para a sombra não ser cortada.
- **`textSvg(node, w, h)`** <sub>interna</sub> · [L136](../src/svg.js#L136) — Texto em SVG: uma <tspan> por linha (SVG não quebra linha sozinho). Calcula o deslocamento vertical para 'centro'/'embaixo' quando a caixa tem altura fixa e aplica text-transform na própria string (SVG não tem isso).
- **`imageSvg(fill, w, h, src)`** <sub>interna</sub> · [L161](../src/svg.js#L161) — Conteúdo SVG de uma IMAGEM de fundo dentro da caixa w×h, imitando o CSS do editor:

   - cover/contain/fill → <image preserveAspectRatio>; a posição (posX/posY) vira o alinhamento mais próximo entre 3
     (início/meio/fim) — o SVG não tem posição em %, então nesses ajustes é uma aproximação;
   - tamanho próprio ('size') → posição e tamanho EXATOS (usa natW/natH, o tamanho original guardado ao escolher a
     imagem); com repeat vira <pattern> (ladrilho). Sem natW/natH cai no "cobrir".
  (Repetir junto com "conter" não é exportado: sai uma imagem só.)
- **`shapeSvg(node, w, h)`** <sub>interna</sub> · [L187](../src/svg.js#L187) — Forma + contorno de retângulo/elipse/frame/vetor. Retângulos sem cantos viram <rect> simples (mais limpo); com cantos/elipse/vetor viram <path>. Imagem: <image> recortada pela forma, com o mesmo `fit` do editor.
- **`render(node, parent, isRoot)`** <sub>interna</sub> · [L235](../src/svg.js#L235) — Converte UMA camada (recursivo) em <g>. Ordem das transformações: posição (translate) → rotação em torno do centro → espelhamento. Frames com "cortar conteúdo" recortam os filhos por <clipPath>; grupos com máscara usam a forma da camada-máscara como clipPath.

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
- **`startComment(e, hitId)`** <sub>interna</sub> · [L358](../src/tools.js#L358) — Clique da ferramenta Comentar: guarda um RASCUNHO (camada + ponto relativo à caixa dela) e abre o painel Comentários com a caixa de texto já focada. Quem cria o comentário é o painel, quando você envia.
- **`startMove(e, { collapseTo })`** <sub>interna</sub> · [L374](../src/tools.js#L374) — Prepara o arrasto de mover as camadas selecionadas. `collapseTo`: se for só um clique (sem arrastar) numa seleção múltipla, reduz a seleção a essa camada.
- **`rebase(nodes)`** <sub>interna</sub> · [L389](../src/tools.js#L389) — Guarda o ponto de partida dos itens em coordenadas de MUNDO (origem + caixa). A posição final é sempre "origem inicial + deslocamento do ponteiro − origem do pai atual", então continua certa mesmo que o pai mude no meio do arrasto (quando a camada passa por cima de outro frame).
- **`snapCandidates()`** <sub>interna</sub> · [L399](../src/tools.js#L399) — Retângulos com os quais o item que se move pode "grudar" (snap): os irmãos e o pai. Calculado uma vez por arrasto (cache em drag.snapRects) porque os vizinhos não mudam enquanto você arrasta.
- **`snapMove(dx, dy)`** <sub>interna</sub> · [L417](../src/tools.js#L417) — SNAP: ajusta o deslocamento (dx, dy) para que bordas e centros do item alinhem com os dos vizinhos e com as guias de régua, quando estiverem a menos de 6px de TELA (6/zoom no mundo). Devolve também as linhas-guia rosa a desenhar onde houve alinhamento exato. Ctrl desliga o snap (no chamador).
  - ↩︎ `{dx:number, dy:number, guides:object[]` }
- **`flowReorder(node, p, parent = store.parentOf(node.id))`** <sub>interna</sub> · [L458](../src/tools.js#L458) — Dentro de um auto layout o item NÃO tem posição livre; arrastar significa REORDENAR. Acha o irmão cujo centro está mais perto do ponteiro e põe o item antes ou depois dele (conforme o ponteiro esteja antes/depois do centro dele no eixo principal). Funciona também com flex-wrap, porque usa distância 2D.
- **`moveDrag(e)`** <sub>interna</sub> · [L488](../src/tools.js#L488) — Cada movimento do mouse durante o gesto "mover". Passos: 1. passou do limiar? Se Alt estava pressionado, duplica e passa a arrastar as cópias 2. se o ponteiro entrou noutro frame, troca o pai da camada (mantendo a posição visual) 3. calcula o deslocamento (Shift trava o eixo), aplica snap (Ctrl desliga) 4. aplica: camadas livres recebem x/y; camadas em auto layout são reordenadas 5. camadas em auto layout ganham um "fantasma" (CSS `translate`) que segue o ponteiro
- **`startResize(e, handle)`** <sub>interna</sub> · [L580](../src/tools.js#L580) — Prepara o redimensionar. `hx`/`hy` dizem qual lado a alça move: hx=+1 direita, −1 esquerda; hy=+1 baixo, −1 cima (0 = não mexe nesse eixo; alça 'e' é hx=1,hy=0; canto 'nw' é hx=−1,hy=−1). Guarda o estado inicial para recalcular tudo a partir dele a cada movimento (evita acumular erro de arredondamento).
- **`resizeDrag(e)`** <sub>interna</sub> · [L606](../src/tools.js#L606) — Cada movimento do mouse ao redimensionar.

   - UMA camada: converte o deslocamento do mouse para os eixos LOCAIS da camada (desfazendo a rotação), muda w/h e
     recalcula x/y para que o lado OPOSTO (a âncora) fique parado no mundo — funciona com a camada girada.
     Shift mantém a proporção; Alt redimensiona a partir do centro.
   - VÁRIAS camadas: escala o conjunto pela caixa envolvente.
   - Grupos escalam os filhos; frames reaplicam as constraints dos filhos a partir do tamanho original.
- **`snapResize(dx, dy, hx, hy)`** <sub>interna</sub> · [L704](../src/tools.js#L704) — SNAP do redimensionar: só a borda que a alça move (direita/esquerda, baixo/cima) procura um alvo a menos de 6px de tela — bordas e centro do frame pai e dos vizinhos, e as guias da régua. É o que deixa você fazer uma camada exatamente do tamanho do frame (ou alinhada com a de cima) sem precisar acertar o pixel.
  - ↩︎ `{dx:number, dy:number, guides:object[]` } deslocamento do mouse já ajustado + linhas rosa a desenhar
- **`startRotate(e)`** <sub>interna</sub> · [L749](../src/tools.js#L749) — Prepara a rotação: guarda o centro da camada (em px de tela), a rotação inicial e o ângulo do mouse em relação ao centro.
- **`rotateDrag(e)`** <sub>interna</sub> · [L765](../src/tools.js#L765) — Rotação = rotação inicial + (ângulo atual do mouse − ângulo inicial). Shift prende em múltiplos de 15°. Resultado em −180..180.
- **`startDraw(e, tool)`** <sub>interna</sub> · [L780](../src/tools.js#L780) — Começa a desenhar com a ferramenta ativa. O frame sob o cursor vira o PAI da camada nova (posição relativa a ele). Retângulo/elipse/frame/linha já nascem no documento (tamanho 1) e crescem durante o arrasto, para você ver ao vivo. Texto, polígono e estrela só são criados ao soltar.
- **`drawDrag(e)`** <sub>interna</sub> · [L820](../src/tools.js#L820) — Durante o desenho: ajusta a camada ao retângulo arrastado (Shift = quadrado/ângulos de 15°; Alt = a partir do centro). A linha é um segmento girado; polígono/estrela mostram só o retângulo-guia (marquee) até soltar.
- **`finishDraw(d, e)`** <sub>interna</sub> · [L864](../src/tools.js#L864) — Ao soltar o mouse com uma ferramenta de desenho. Um clique SEM arrastar cria o tamanho padrão (frame 320×240, retângulo/elipse 100×100, linha 100px, polígono/estrela 100×100). Texto entra direto em edição. A ferramenta volta para Mover (como no Figma).
- **`adoptIntoSection(sec)`** <sub>interna</sub> · [L910](../src/tools.js#L910) — Seção recém-desenhada "adota" as telas da raiz que ficaram TOTALMENTE dentro dela: elas passam a ser filhas da seção (e andam junto com ela), mantendo a posição visual e a ordem entre si. Telas só parcialmente dentro ficam de fora.
- **`enterFlow(node)`** <sub>interna</sub> · [L925](../src/tools.js#L925) — Forma recém-desenhada dentro de um auto layout (estava "solta" durante o arrasto): entra na fila na posição mais próxima de onde foi desenhada — entre os dois itens em volta do centro dela (flowReorder).
- **`guideDrag(e)`** <sub>interna</sub> · [L935](../src/tools.js#L935) — Arrasta uma guia de régua já existente (atualiza a posição ao vivo; soltar sobre a régua apaga — ver endDrag).
- **`startMarquee(e, scope, clickId)`** <sub>interna</sub> · [L949](../src/tools.js#L949) — Começa o retângulo de seleção por arrasto. `scope` = id do frame raiz onde o arrasto começou (seleciona só filhos dele) ou null (seleciona camadas da raiz). `clickId` = camada a selecionar se foi só um clique.
- **`marqueeDrag(e)`** <sub>interna</sub> · [L960](../src/tools.js#L960) — Atualiza o marquee e a seleção. Regra do Figma: frames da raiz só entram se estiverem TOTALMENTE dentro do retângulo; as demais camadas entram ao serem tocadas. Shift soma à seleção anterior.
- **`endDrag(e)`** <sub>interna</sub> · [L1036](../src/tools.js#L1036) — POINTER UP / CANCEL: encerra o gesto. Cada tipo faz sua limpeza e quase todos terminam com UM `store.commit()` — por isso um Ctrl+Z desfaz o arrasto/redimensionamento INTEIRO, não pixel a pixel. Também limpa guias, marquee e destaque temporários do overlay.
- **`isTyping(t)`** <sub>interna</sub> · [L1140](../src/tools.js#L1140) — O foco está num campo onde o usuário DIGITA (input, select, texto editável)? Então os atalhos do canvas não devem agir.
- **`covered()`** <sub>interna</sub> · [L1146](../src/tools.js#L1146) — O canvas está "coberto"? (página inicial aberta ou uma janela modal: Configurações, Projetos, pergunta...) Então NENHUM atalho do canvas pode agir — senão um Delete com o foco num botão da janela apagaria camadas escondidas atrás dela.
- **`MARKER`** <sub>interna</sub> · [L1334](../src/tools.js#L1334) — COPIAR/COLAR com a área de transferência do sistema. Camadas copiadas ficam na memória do app (ui.clipboard); no sistema colocamos só este texto-marcador, para o "colar" saber que é para colar CAMADAS e não texto.
- **`toggleProp(prop)`** <sub>interna</sub> · [L1361](../src/tools.js#L1361) — Alterna 'locked' ou 'visible' nas camadas selecionadas: se alguma não está no estado alvo, aplica a todas; senão desfaz em todas.
- **`copyCss()`** <sub>interna</sub> · [L1369](../src/tools.js#L1369) — Ctrl+Shift+C: copia o CSS das camadas selecionadas para a área de transferência do sistema.
- **`zoomTo(z)`** <sub>interna</sub> · [L1381](../src/tools.js#L1381) — Define o zoom (1 = 100%) ancorado no centro da vista.
- **`applyTool()`** <sub>interna</sub> · [L1387](../src/tools.js#L1387) — Reflete a ferramenta ativa no DOM (muda o cursor por CSS: [data-tool=…]).

---

## src/version.js

- **`VERSION`** · [L2](../src/version.js#L2) — Versão do app mostrada na página inicial. Mantida igual à do package.json (tests/versao.test.js confere).

---

## src/agent/bridge.js

**PERMISSÃO E PONTE COM O MCP (lado do navegador)** · [abrir o código](../src/agent/bridge.js)

```text
 createApprover: a janela "A IA quer alterar o design" que aparece antes de CADA alteração feita por uma IA
 (o agente interno ou um programa via MCP). Respostas: Permitir · Permitir tudo nesta sessão · Recusar.
 "Sessão" = até recarregar a página, e vale só para aquele programa (permitir o Assistente não libera o Claude).
 Os pedidos fazem fila: duas IAs ao mesmo tempo não abrem duas janelas uma em cima da outra.

 connectMcpBridge: deixa o editor "ouvindo" o servidor (GET /api/agent/events). Quando um programa de IA chama
 uma ferramenta pelo MCP, o servidor repassa para cá, o runner executa (pedindo permissão se for alteração) e
 o resultado volta pelo POST /api/agent/reply. Se o servidor cair, o EventSource reconecta sozinho.
```

- **`createApprover()`** · [L23](../src/agent/bridge.js#L23) — Cria a função de permissão.
  - ↩︎ `(req: {client: string, tool: string, summary: string` ) => Promise<boolean>}
- **`allowed`** <sub>interna</sub> · [L25](../src/agent/bridge.js#L25) — Programas liberados até recarregar a página ("Permitir tudo nesta sessão").
- **`queue`** <sub>interna</sub> · [L27](../src/agent/bridge.js#L27) — Fila: cada pergunta espera a anterior terminar.
- **`connectMcpBridge({ runner, toast })`** · [L60](../src/agent/bridge.js#L60) — Liga o editor à ponte do servidor (MCP).
  - `deps` <sub>object</sub> — 
  - `deps.toast` <sub>(m: string) => void</sub> — 
  - ↩︎ `{ close: () => void ` }
- **`greeted`** <sub>interna</sub> · [L64](../src/agent/bridge.js#L64) — Avisa (uma vez por programa) que uma IA externa começou a usar o editor.

---

## src/agent/runner.js

**EXECUTA AS FERRAMENTAS DO AGENTE NO EDITOR ABERTO** · [abrir o código](../src/agent/runner.js)

```text
 Recebe "use a ferramenta X com estes argumentos" (do agente interno ou do MCP, ver agent/schema.js) e faz
 com o store e os comandos do editor, como se você tivesse clicado. Regras de segurança:
   - ferramentas de LEITURA rodam direto;
   - ferramentas que ALTERAM o projeto chamam `approve(...)` antes: a pessoa vê o que vai mudar e decide
     (Permitir / Permitir tudo nesta sessão / Recusar). Recusado = nada muda;
   - cada alteração aprovada termina com UM `store.commit()`: um Ctrl+Z desfaz a alteração inteira;
   - só as propriedades conhecidas são aceitas (veja PROPS): a IA não consegue gravar lixo no projeto.
 Erros viram mensagens em português devolvidas à IA (ela lê e corrige), nunca quebram o editor.
```

- **`SIMPLE`** <sub>do módulo</sub> · [L21](../src/agent/runner.js#L21) — Campos simples (número, texto ou booleano) que podem ser copiados direto para a camada.
- **`SPECIAL`** <sub>do módulo</sub> · [L29](../src/agent/runner.js#L29) — Campos com tratamento próprio (ver applyProps).
- **`PROPS`** · [L31](../src/agent/runner.js#L31) — Tudo que update_layer / create_layer aceitam.
- **`ENUMS`** <sub>do módulo</sub> · [L33](../src/agent/runner.js#L33) — Valores válidos de alguns campos (o resto é conferido pelo tipo).
- **`hex(v)`** <sub>do módulo</sub> · [L41](../src/agent/runner.js#L41) — "#abc" / "#AABBCC" → "#AABBCC"; outra coisa → null.
- **`four(v, what)`** <sub>do módulo</sub> · [L48](../src/agent/runner.js#L48) — Número ou lista de 4 → lista de 4 (padding, margin, radius).
- **`applyProps(node, props, ctx = {})`** · [L61](../src/agent/runner.js#L61) — Aplica `props` numa camada (dentro de um store.update). Lança Error com mensagem clara se algo não vale.
  - `node` <sub>object</sub> — 
  - `props` <sub>object</sub> — 
- **`summarize(n, depth = 0)`** · [L129](../src/agent/runner.js#L129) — Resumo curto de uma camada (o que a IA precisa para se orientar, sem o peso de todos os campos).
- **`describeCall(tool, args, store)`** · [L153](../src/agent/runner.js#L153) — Descrição em português de uma alteração, para a janela de permissão.
- **`createRunner({ store, commands, approve })`** · [L177](../src/agent/runner.js#L177) — Cria o executor.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.commands` <sub>object</sub> — 
  - ↩︎ `{ run: (tool: string, args: object, client?: string) => Promise<object> ` }
- **`need(id)`** <sub>interna</sub> · [L179](../src/agent/runner.js#L179) — Camada pelo id ou erro claro (a IA às vezes inventa ids: a mensagem manda ela procurar antes).
- **`setLayoutMode(node, mode)`** <sub>interna</sub> · [L185](../src/agent/runner.js#L185) — Liga/desliga o layout com a lógica do painel (deduz direção, gap e padding ao ligar).
- **`run(tool, args = {}, client = 'Assistente')`** <sub>interna</sub> · [L284](../src/agent/runner.js#L284) — Roda uma ferramenta e devolve o resultado (objeto JSON). Nunca lança: erros voltam como { error }.
  - `tool` <sub>string</sub> — 
  - `args` <sub>object</sub> — 
  - `[client]` <sub>string</sub> — quem pediu ('Assistente', 'Claude Code'...), aparece na janela de permissão
- **`restoreDoc(json)`** <sub>interna</sub> · [L310](../src/agent/runner.js#L310) — Desfaz uma alteração que falhou no meio, sem criar passo no histórico.

---

## src/agent/schema.js

**AS FERRAMENTAS QUE UMA IA PODE USAR NO EDITOR (lista única, sem DOM)** · [abrir o código](../src/agent/schema.js)

```text
 Uma IA (o agente interno, com a sua chave da OpenAI, ou um programa externo via MCP, como o Claude Code)
 não mexe no projeto "por fora": ela pede para usar uma destas ferramentas, e quem executa é o EDITOR aberto
 (agent/runner.js), com os mesmos comandos que você usa clicando. Assim:
   - o canvas e os painéis atualizam na hora, e cada alteração é UM passo do Ctrl+Z;
   - toda alteração passa pela sua permissão antes (veja runner.js → approve);
   - o servidor MCP (server.js) e o agente interno usam EXATAMENTE a mesma lista: o que um faz, o outro faz.

 Este arquivo é só dados (nome, descrição e parâmetros em JSON Schema, o formato que a OpenAI e o MCP usam),
 por isso o servidor (Node) e o navegador importam o mesmo arquivo.
```

- **`PROP_HELP`** · [L18](../src/agent/schema.js#L18) — Propriedades que as ferramentas de criar/alterar aceitam (o resto é recusado com uma mensagem clara).
- **`AGENT_TOOLS`** · [L31](../src/agent/schema.js#L31) — As ferramentas. `write: true` = altera o projeto (pede permissão e vira um passo do Ctrl+Z). `inputSchema` segue JSON Schema (MCP chama assim; a OpenAI chama de `parameters`).
- **`toolByName(name)`** · [L130](../src/agent/schema.js#L130) — Procura uma ferramenta pelo nome.
- **`openAiTools()`** · [L133](../src/agent/schema.js#L133) — As ferramentas no formato da API da OpenAI (Chat Completions: `tools: [{ type: 'function', function }]`).
- **`mcpTools()`** · [L139](../src/agent/schema.js#L139) — As ferramentas no formato do MCP (`tools/list`).
- **`AGENT_INSTRUCTIONS`** · [L150](../src/agent/schema.js#L150) — Instruções para a IA (o "prompt de sistema" do agente interno e as `instructions` do servidor MCP). Explicam o que a ferramenta é e as regras de trabalho, para a IA agir do jeito certo desde a primeira mensagem.

---

## src/ui/assets.js

**ABA "RECURSOS" (COMPONENTES E ESTILOS)** · [abrir o código](../src/ui/assets.js)

- **`cssSlug(s)`** <sub>do módulo</sub> · [L16](../src/ui/assets.js#L16) — Nome da variável de CSS (o mesmo do código gerado).
- **`createAssetsPanel({ store, commands, canvas, container, toast })`** · [L25](../src/ui/assets.js#L25) — Cria a aba RECURSOS (painel esquerdo): três listas do documento —

   - Componentes: clicar insere uma instância no centro da tela
   - Cores: estilos de cor; clicar aplica à seleção; +, renomear e excluir
   - Tipografia: estilos de texto; idem
  Mudar um estilo muda todas as camadas ligadas a ele (ver components.js → syncStyles).
- **`section(title, add, body)`** <sub>interna</sub> · [L31](../src/ui/assets.js#L31) — Seção da lista: título, botão "+" opcional e linhas.
- **`components()`** <sub>interna</sub> · [L35](../src/ui/assets.js#L35) — Todos os componentes principais do documento (de qualquer página), com a página de cada um.
- **`render()`** <sub>interna</sub> · [L42](../src/ui/assets.js#L42) — Reconstrói as três listas a partir do documento (só roda com a aba aberta).
- **`applyColor(hex, asStroke)`** <sub>interna</sub> · [L154](../src/ui/assets.js#L154) — Aplica uma cor da paleta à seleção: preenchimento (ou contorno, com Shift).
- **`askColors(title)`** <sub>interna</sub> · [L168](../src/ui/assets.js#L168) — Pede uma lista de cores escrita/colada e devolve as válidas (ou null se cancelou).

---

## src/ui/assistant.js

**PAINEL "ASSISTENTE" (agente de IA dentro do editor)** · [abrir o código](../src/ui/assistant.js)

```text
 Uma conversa flutuante no canto do canvas. Você escreve ("deixa o botão com cantos de 12px", "esse card
 precisa de mais respiro"), a IA lê o design com as ferramentas de agent/schema.js e propõe alterações, que
 passam pela janela de permissão antes de valer (e saem com Ctrl+Z).

 COMO FUNCIONA (o "laço do agente"):
   1. manda a conversa + a lista de ferramentas para POST /api/agent/chat (o servidor usa a SUA chave da OpenAI,
      que fica só no seu computador, e repassa para a API — ou para um servidor compatível, como o Ollama);
   2. se a resposta pede ferramentas (tool_calls), o runner executa cada uma no editor e devolve o resultado;
   3. repete até a IA responder só com texto (no máximo MAX_STEPS rodadas por mensagem).
 A conversa vive só na memória (some ao recarregar) e não entra no arquivo do projeto.
```

- **`MAX_STEPS`** <sub>do módulo</sub> · [L22](../src/ui/assistant.js#L22) — Máximo de rodadas "IA pede ferramenta → editor responde" por mensagem (evita laço infinito e gasto à toa).
- **`MAX_RESULT`** <sub>do módulo</sub> · [L24](../src/ui/assistant.js#L24) — Resultados de ferramenta maiores que isso são cortados antes de voltar à IA (economiza tokens).
- **`TOOL_LABEL`** <sub>do módulo</sub> · [L26](../src/ui/assistant.js#L26) — Nome amigável de cada ferramenta na conversa.
- **`createAssistant({ store, runner, openSettings, stage })`** · [L41](../src/ui/assistant.js#L41) — Cria o painel.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.openSettings` <sub>() => void</sub> — abre as Configurações (para pôr a chave)
  - `deps.stage` <sub>HTMLElement</sub> — onde o painel flutua
  - ↩︎ `{ el: HTMLElement, toggle: () => void, open: () => void, close: () => void, isOpen: () => boolean ` }
- **`messages`** <sub>interna</sub> · [L43](../src/ui/assistant.js#L43) — Conversa no formato da API (sem a mensagem de sistema, que é montada a cada envio).
- **`add(node)`** <sub>interna</sub> · [L70](../src/ui/assistant.js#L70) — Acrescenta uma linha na conversa e rola até ela.
- **`rich(text)`** <sub>interna</sub> · [L72](../src/ui/assistant.js#L72) — Texto da IA → parágrafos, com `código` destacado (sem HTML vindo da IA: tudo vira texto).
- **`refreshConfig()`** <sub>interna</sub> · [L76](../src/ui/assistant.js#L76) — Mostra a configuração atual (modelo) e, sem chave, o convite para configurar.
- **`reset()`** <sub>interna</sub> · [L96](../src/ui/assistant.js#L96) — Começa do zero (esquece a conversa).
- **`context()`** <sub>interna</sub> · [L106](../src/ui/assistant.js#L106) — Contexto do editor anexado a cada pedido (onde a pessoa está e o que selecionou), sem aparecer na conversa.
- **`submit()`** <sub>interna</sub> · [L113](../src/ui/assistant.js#L113) — Envia a mensagem digitada e roda o laço do agente.
- **`stepLine(name, args, result)`** <sub>interna</sub> · [L162](../src/ui/assistant.js#L162) — Linha discreta mostrando o que a IA fez com cada ferramenta (✓ feito, ✗ erro, ⊘ recusado).

---

## src/ui/code.js

**ABA "CÓDIGO" (CSS E HTML DA SELEÇÃO)** · [abrir o código](../src/ui/code.js)

- **`esc(s)`** <sub>do módulo</sub> · [L11](../src/ui/code.js#L11) — Escapa & < > para exibir código dentro de <pre> sem o navegador interpretar como HTML.
- **`highlightCss(code)`** <sub>do módulo</sub> · [L17](../src/ui/code.js#L17) — Colore o CSS (só visual): seletor `.classe`, nome da propriedade, números/unidades e cores #hex. Cada etapa escapa o HTML antes de inserir os <span> de cor, então o texto do usuário nunca vira marcação.
- **`highlightHtml(code)`** <sub>do módulo</sub> · [L26](../src/ui/code.js#L26) — Colore o HTML (só visual): nomes de tag e atributos/valores.
- **`createCodePanel({ store, commands, toast })`** · [L37](../src/ui/code.js#L37) — Cria o painel CÓDIGO: mostra o CSS ou o HTML REAIS da seleção (ou da página inteira, se nada está selecionado). É a mesma saída de `generateCode` usada na exportação, então o que você copia aqui é o que o navegador está usando. Opção "Incluir filhos" liga/desliga as camadas internas; "Copiar" manda para a área de transferência.
- **`render()`** <sub>interna</sub> · [L63](../src/ui/code.js#L63) — Gera o código das camadas-alvo e mostra colorido. Só roda com a aba Código aberta (ver subscribe abaixo).

---

## src/ui/colorpicker.js

**SELETOR DE COR (popover) com gerenciador de paletas** · [abrir o código](../src/ui/colorpicker.js)

```text
 Abre ao clicar numa amostra de cor do painel. De cima para baixo:
   1. área saturação/brilho + barra de matiz (+ barra de opacidade quando o campo tem opacidade);
   2. a cor atual (ao lado da original) com campos HEX · RGB · HSL e conta-gotas;
   3. contraste da cor sobre branco e sobre preto (WCAG), para saber se o texto fica legível;
   4. SUGESTÕES de harmonia (complementar, análogas, tríade, tons): um clique escolhe, outro guarda na paleta;
   5. PALETAS PRÓPRIAS, gerenciáveis aqui mesmo: abas, nova paleta, renomear, guardar a cor atual, tirar cor,
      duplicar, copiar como variáveis CSS e excluir;
   6. cores recentes, as do projeto, estilos de cor e paletas prontas.
 Aplica ao vivo (`set`) e grava o histórico (`commit`) ao soltar. Fecha ao clicar fora, com Esc ou quando o campo
 que o abriu some do painel.
```

- **`BUILTIN`** <sub>do módulo</sub> · [L27](../src/ui/colorpicker.js#L27) — Paletas prontas (de fábrica).
- **`closeColorPicker()`** · [L38](../src/ui/colorpicker.js#L38) — Fecha o seletor de cor aberto, se houver.
- **`colorPickerAnchor()`** · [L40](../src/ui/colorpicker.js#L40) — O campo (amostra) que abriu o seletor agora, ou null.
- **`openColorPicker({ anchor, get, set, commit, opacity, setOpacity, groups, onClose })`** · [L48](../src/ui/colorpicker.js#L48) — Abre o seletor de cor.
- **`paint()`** <sub>interna</sub> · [L77](../src/ui/colorpicker.js#L77) — Redesenha os controles a partir de `hsv`/`alpha` (sem mexer no campo que a pessoa está digitando).
- **`buildFields()`** <sub>interna</sub> · [L97](../src/ui/colorpicker.js#L97) — Campos do formato atual: HEX | R G B | H S L (+ opacidade em %, se houver).
- **`paintFields()`** <sub>interna</sub> · [L149](../src/ui/colorpicker.js#L149) — Atualiza só os valores dos campos (se a pessoa não está digitando num deles).
- **`paintContrast(c)`** <sub>interna</sub> · [L157](../src/ui/colorpicker.js#L157) — Contraste da cor sobre branco e sobre preto, no padrão WCAG.
- **`push()`** <sub>interna</sub> · [L171](../src/ui/colorpicker.js#L171) — Aplica a cor atual (e a opacidade) ao campo, ao vivo.
- **`applyRgb(rgb, keepHue = false)`** <sub>interna</sub> · [L174](../src/ui/colorpicker.js#L174) — Cor nova vinda de RGB (campos, chips). `keepHue`: mantém o matiz quando a cor fica sem saturação.
- **`finish(quiet = false)`** <sub>interna</sub> · [L182](../src/ui/colorpicker.js#L182) — Fim de uma edição: grava no histórico e guarda nas recentes.
- **`pick(c, quiet = false)`** <sub>interna</sub> · [L189](../src/ui/colorpicker.js#L189) — Escolhe uma cor pronta (chip): aplica e grava.
- **`drag(el, fn)`** <sub>interna</sub> · [L196](../src/ui/colorpicker.js#L196) — Arrasto numa área/barra: `fn(x, y)` recebe a posição relativa 0–1; grava ao soltar.

---

## src/ui/comments.js

**PAINEL "COMENTÁRIOS" (aba do painel direito)** · [abrir o código](../src/ui/comments.js)

```text
 Escrever comentários nas camadas, responder, resolver e apagar. A lógica de dados vive em comments.js (puro);
 aqui só a tela. Os "pinos" no canvas são desenhados pelo overlay.js (e o clique neles abre a conversa aqui).

 Como se comenta:
   - selecione UMA camada e escreva na caixa (o pino nasce no canto superior direito dela); ou
   - use a ferramenta Comentar (C) e clique no ponto exato da camada; ou
   - botão direito na camada → Comentar.
 Ctrl+Enter envia. Só aparecem os comentários das camadas da PÁGINA aberta.
```

- **`initial(name)`** <sub>do módulo</sub> · [L20](../src/ui/comments.js#L20) — Primeira letra (maiúscula) do nome, para o "avatar".
- **`createCommentsPanel({ store, canvas, prefs, toast })`** · [L27](../src/ui/comments.js#L27) — Cria o painel de comentários.
  - ↩︎ `{el: HTMLElement, render: () => void` }
- **`findItem(id)`** <sub>interna</sub> · [L39](../src/ui/comments.js#L39) — Comentário ou resposta pelo id, no documento de agora (os objetos antigos ficam velhos depois de desfazer).
- **`target()`** <sub>interna</sub> · [L50](../src/ui/comments.js#L50) — Para onde vai o comentário novo: o ponto escolhido com a ferramenta, ou a camada selecionada (canto superior direito).
- **`change(fn)`** <sub>interna</sub> · [L57](../src/ui/comments.js#L57) — Muda o documento (um passo de desfazer) e redesenha tudo que mostra comentários.
- **`send()`** <sub>interna</sub> · [L65](../src/ui/comments.js#L65) — Envia o comentário novo.
- **`goTo(c)`** <sub>interna</sub> · [L80](../src/ui/comments.js#L80) — Seleciona a camada do comentário, rola até ela e destaca o pino.
- **`composer({ placeholder, text, onText, onSend, onEsc, disabled, label, autofo…)`** <sub>interna</sub> · [L90](../src/ui/comments.js#L90) — Caixa de texto com enviar (compositor de comentário novo ou de resposta).
- **`thread(c, n)`** <sub>interna</sub> · [L103](../src/ui/comments.js#L103) — Um comentário (com respostas e ações). `n` = número do pino no canvas.
- **`body(item, owner)`** <sub>interna</sub> · [L107](../src/ui/comments.js#L107) — Texto do comentário/resposta: com o botão de editar, ou a caixa de edição aberta.
- **`render()`** <sub>interna</sub> · [L162](../src/ui/comments.js#L162) — Redesenha o painel (pula se nada que ele mostra mudou).

---

## src/ui/dom.js

**CRIAR ELEMENTOS + COMPONENTES DE FORMULÁRIO** · [abrir o código](../src/ui/dom.js)

```text
 O app não usa framework: a interface é feita com `h()` (criar elementos) e alguns componentes
 reutilizáveis (campo numérico com arrastar-para-ajustar, cor, lista suspensa, botões segmentados).
 Todo componente de formulário devolve { el, update }: `el` é o elemento e `update()` relê o valor do
 documento — é assim que o painel de propriedades se mantém em dia sem recriar tudo a cada mudança.
```

- **`h(tag, attrs, ...children)`** · [L27](../src/ui/dom.js#L27) — `h` = "hyperscript": cria elementos DOM com uma sintaxe curta (substitui um framework como React para este app).

    h('button.btn.primary', { type: 'button', onclick: fazer }, ico('play'), ' Texto')

   - 1º argumento: "tag.classe1.classe2" (sem tag = div)
   - 2º argumento (opcional): atributos. Chaves "onXxx" viram ouvintes de evento; `html` define innerHTML; `style` aceita
     objeto; `dataset` define data-*; o resto vira propriedade do elemento (ou atributo).
   - demais argumentos: filhos (elementos, textos ou listas aninhadas; null/false são ignorados)
  Se o 2º argumento já for um filho (elemento/texto/lista), é tratado como filho.
- **`ico(name, size = 16)`** · [L53](../src/ui/dom.js#L53) — Ícone SVG pronto para usar como filho: ico('trash', 14). Os desenhos estão em icons.js.
- **`clamp(v, min, max)`** · [L56](../src/ui/dom.js#L56) — Limita `v` ao intervalo [min, max].
- **`numField({ label, title, get, set, commit, min = -Infinity, max = Infinity, …)`** · [L78](../src/ui/dom.js#L78) — CAMPO NUMÉRICO no estilo Figma:

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
- **`fmt(v)`** <sub>interna</sub> · [L87](../src/ui/dom.js#L87) — Número → texto no campo (arredondado às casas decimais, com unidade).
- **`parse(txt)`** <sub>interna</sub> · [L92](../src/ui/dom.js#L92) — Texto → número. Aceita vírgula decimal e contas. Segurança: só passa para Function() se o texto tiver APENAS dígitos e operadores (regex abaixo), então nenhum código arbitrário consegue ser executado.
- **`textField({ get, set, commit, placeholder = '', mono = false })`** · [L162](../src/ui/dom.js#L162) — Campo de texto simples (usado para nomes e links). Mesma ideia: `set` ao digitar, `commit` ao terminar.
- **`selectField({ options, get, set, commit, title, label })`** · [L171](../src/ui/dom.js#L171) — Lista suspensa estilizada. `options`: [[valor, rótulo], ...]. Ao escolher, aplica e já grava no histórico.
- **`segmented({ options, get, set, commit })`** · [L181](../src/ui/dom.js#L181) — Grupo de botões de ícone onde um fica "ligado" (ex.: alinhamento de texto). `options`: [[valor, ícone, dica], ...].
- **`TIP_DELAY`** <sub>do módulo</sub> · [L195](../src/ui/dom.js#L195) — Quanto o mouse precisa ficar parado em cima antes da dica aparecer (ms): evita piscar ao atravessar o painel.
- **`hideTip()`** <sub>do módulo</sub> · [L202](../src/ui/dom.js#L202) — Esconde a dica e cancela a que estava agendada.
- **`showTip(target)`** <sub>do módulo</sub> · [L209](../src/ui/dom.js#L209) — Mostra a dica ao lado do elemento: à esquerda (o painel fica à direita da tela) ou, sem espaço, à direita/embaixo.
- **`installTips()`** <sub>do módulo</sub> · [L251](../src/ui/dom.js#L251) — Liga os ouvintes globais das dicas (uma única vez).
- **`tip(el, { title, css = '', text = '', key = '' })`** · [L276](../src/ui/dom.js#L276) — Liga uma dica rica a um elemento. Remove o `title` nativo dele e dos filhos (senão as duas dicas apareceriam).
  - `el` <sub>HTMLElement</sub> — o elemento que mostra a dica ao passar o mouse
  - ↩︎ `HTMLElement` o próprio `el` (para usar inline)
- **`SHORTCUT`** <sub>do módulo</sub> · [L297](../src/ui/dom.js#L297) — Dicas bonitas em TUDO: todo elemento com `title` (já existente ou criado depois) vira uma dica rica, no mesmo estilo, em vez da bolha cinza do navegador. "Nome (Ctrl+Z)" mostra o atalho como tecla. Elementos que já têm dica rica (data-tip-title) ficam como estão.
- **`installAutoTips(root = document.body)`** · [L298](../src/ui/dom.js#L298) — _(sem comentário)_
- **`iconButton(name, title, onclick, cls = '')`** · [L324](../src/ui/dom.js#L324) — Botão só com ícone. `cls` opcional ('small', 'on'...).
- **`colorRow({ get, set, commit, opacity, setOpacity, groups })`** · [L337](../src/ui/dom.js#L337) — Linha de COR: amostra clicável (abre o seletor de cor próprio, com grupos de cores) + campo HEX + (opcional) opacidade em % + conta-gotas (onde o navegador oferece `EyeDropper`). Aceita hex de 3 ou 6 dígitos, com ou sem "#". `groups` (opcional): função que devolve grupos extras de cores para o seletor ([{title, colors}]).
- **`sync()`** <sub>interna</sub> · [L362](../src/ui/dom.js#L362) — Atualiza amostra, seletor e campo hex a partir do valor atual (sem mexer no hex enquanto digitam).

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

- **`when(ms)`** <sub>do módulo</sub> · [L23](../src/ui/home.js#L23) — "há 5 min", "há 3 h", "ontem", ou a data.
- **`baseName(file)`** <sub>do módulo</sub> · [L33](../src/ui/home.js#L33) — Nome bonito a partir do arquivo: "meu-app.json" → "meu-app".
- **`hue(text)`** <sub>do módulo</sub> · [L36](../src/ui/home.js#L36) — Cor de fundo estável por nome (para os projetos sem miniatura não ficarem todos iguais).
- **`thumbBox(name, src)`** <sub>do módulo</sub> · [L43](../src/ui/home.js#L43) — Miniatura de um card: a imagem SVG (se houver) ou uma "capa" com a inicial do nome.
- **`createHome({ store, saving, canvas, thumbnail, toast, openSettings, openProjec…)`** · [L67](../src/ui/home.js#L67) — Cria a PÁGINA INICIAL: cards dos projetos da pasta (com miniatura, busca, renomear, duplicar), "continuar de onde parou" e exemplos. Abre por cima do editor e o deixa inativo (inert) enquanto estiver aberta.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — , deps.saving, deps.canvas
  - `deps.thumbnail` <sub>() => string\|null</sub> — miniatura da página aberta (thumbnail.js)
  - `deps.toast` <sub>(m: string) => void</sub> — 
  - `deps.openSettings` <sub>() => void</sub> — 
  - `deps.openProjects` <sub>(mode) => void</sub> — 
  - `deps.confirmReplace` <sub>(q: string) => Promise<boolean></sub> — pergunta antes de trocar o projeto aberto
  - `deps.importFile` <sub>() => void</sub> — abre o seletor de .json do computador
  - `[]` <sub>{ blank: () => void, samples: {label, description, load</sub> — }} deps.create
- **`close()`** <sub>interna</sub> · [L76](../src/ui/home.js#L76) — Fecha a página inicial e devolve o editor (foco no canvas para os atalhos voltarem a funcionar).
- **`open()`** <sub>interna</sub> · [L90](../src/ui/home.js#L90) — Abre (ou redesenha) a página inicial.
- **`onKey(e)`** <sub>interna</sub> · [L108](../src/ui/home.js#L108) — Esc fecha (volta ao editor); "/" foca a busca, como em muitos apps.
- **`refreshList()`** <sub>interna</sub> · [L117](../src/ui/home.js#L117) — Busca a lista da pasta e redesenha a grade.
- **`replaceWith(question, action)`** <sub>interna</sub> · [L128](../src/ui/home.js#L128) — Troca o projeto aberto por `action` (abrir da pasta, exemplo, novo), perguntando antes se for perder algo.
- **`openFile(file)`** <sub>interna</sub> · [L140](../src/ui/home.js#L140) — Abre um projeto da pasta. Se já é o aberto, só volta ao editor.
- **`renderGrid()`** <sub>interna</sub> · [L215](../src/ui/home.js#L215) — Só a grade de projetos da pasta (redesenhada ao buscar/ordenar sem perder o foco do campo de busca).
- **`card(p)`** <sub>interna</sub> · [L232](../src/ui/home.js#L232) — Card de um projeto da pasta: clique abre; ⋯ abre o menu; no modo "renomear", o nome vira um campo.

---

## src/ui/icons.js

**ÍCONES SVG (inline, sem dependências)** · [abrir o código](../src/ui/icons.js)

- **`P`** <sub>do módulo</sub> · [L11](../src/ui/icons.js#L11) — Os desenhos dos ícones, só o miolo do SVG (viewBox 24×24, traço de 1.8px herdando a cor do texto). Estilo "linha": mesmo traço e cantos arredondados em todos, para a interface ficar coesa.
- **`icon(name, size = 16)`** · [L108](../src/ui/icons.js#L108) — Markup SVG completo de um ícone pelo nome (ver `P`). Nome inexistente gera um SVG vazio em vez de quebrar.
  - `name` <sub>string</sub> — 
  - `[size=16]` <sub>number</sub> — px
- **`nodeIcon(type)`** · [L112](../src/ui/icons.js#L112) — Ícone usado na lista de camadas para cada tipo de camada.

---

## src/ui/info.js

- **`closeInformation(restoreFocus = false)`** · [L6](../src/ui/info.js#L6) — Fecha a informação aberta; Escape devolve o foco ao botão que a abriu.
- **`informationButton(title, text)`** · [L11](../src/ui/info.js#L11) — Ajuda de uma seção, acessível por clique ou teclado sem ocupar o painel.

---

## src/ui/layers.js

**PAINEL DE PÁGINAS E CAMADAS** · [abrir o código](../src/ui/layers.js)

- **`createLayersPanel({ store, commands, container })`** · [L22](../src/ui/layers.js#L22) — Cria o painel de CAMADAS (aba esquerda): lista de páginas + árvore de camadas.

  Na árvore, a camada MAIS À FRENTE aparece no TOPO (a lista é o array de trás para a frente). Cada linha tem: setinha
  (abrir/fechar), ícone, nome (duplo clique renomeia), cadeado e olho. Dá para ARRASTAR linhas para reordenar ou
  aninhar (soltar no meio de um frame coloca dentro dele; na borda de cima/baixo põe antes/depois).
- **`renderPages()`** <sub>interna</sub> · [L45](../src/ui/layers.js#L45) — Desenha a lista de páginas. Clique abre; duplo clique renomeia; botão direito abre o menu (renomear, duplicar, excluir). A última página não pode ser excluída (todo projeto tem ao menos uma).
- **`expandAncestors(ids)`** <sub>interna</sub> · [L93](../src/ui/layers.js#L93) — Abre as pastas que contêm as camadas selecionadas, para que a seleção fique visível na lista. Devolve true se algo mudou. (Guardamos `false` explicitamente: o padrão de "fechado" só vale para pastas nunca abertas.)
- **`isCollapsed(node, depth)`** <sub>interna</sub> · [L104](../src/ui/layers.js#L104) — Camadas dentro de frames começam FECHADAS (só os níveis de cima aparecem); selecionar abre o caminho. `ui.collapsed[id]` tem prioridade.
- **`rowFor(node, depth)`** <sub>interna</sub> · [L111](../src/ui/layers.js#L111) — Cria a linha de UMA camada (com todos os ouvintes: seleção, renomear, menu, arrastar e soltar).
  - `node` <sub>object</sub> — a camada
  - `depth` <sub>number</sub> — nível de aninhamento (recuo de 14px por nível)
- **`setAll(node, value)`** <sub>interna</sub> · [L250](../src/ui/layers.js#L250) — Alt+clique na setinha: abre ou fecha tudo dentro (recursivo).
- **`dropZone(e, row, node)`** <sub>interna</sub> · [L259](../src/ui/layers.js#L259) — Em qual "zona" da linha o mouse está: nos 25% de cima 'above', nos 25% de baixo 'below' e no meio 'inside' (só para frames/grupos, que aceitam filhos).
- **`clearDrop()`** <sub>interna</sub> · [L266](../src/ui/layers.js#L266) — Remove os indicadores visuais de soltura de todas as linhas.
- **`renderTree()`** <sub>interna</sub> · [L273](../src/ui/layers.js#L273) — Reconstrói a árvore. Percorre cada lista de trás para a frente (para a camada da frente ficar no topo) e só desce em pastas abertas. Com texto na busca, mostra uma lista plana das camadas cujo nome contém o texto. Preserva a posição de rolagem.
- **`signature()`** <sub>interna</sub> · [L307](../src/ui/layers.js#L307) — "Impressão digital" do que a lista MOSTRA (ids, nomes, visibilidade, trava, pastas abertas, seleção...). Se não mudou desde o último desenho (ex.: só a posição de uma camada mudou durante um arrasto), pulamos a reconstrução da lista — foi isso que tornou o arrastar fluido com centenas de camadas.
- **`render(reasons)`** <sub>interna</sub> · [L326](../src/ui/layers.js#L326) — Atualiza o painel só se algo visível mudou. Se a seleção mudou, abre as pastas dela; ao selecionar pelo canvas, rola a lista até a camada.

---

## src/ui/menus.js

**MENUS FLUTUANTES, JANELAS MODAIS E AJUDA DE ATALHOS** · [abrir o código](../src/ui/menus.js)

- **`closeMenus()`** · [L15](../src/ui/menus.js#L15) — Fecha o menu aberto, se houver.
- **`showMenu(x, y, items, { anchorRight = false } = {})`** · [L28](../src/ui/menus.js#L28) — Mostra um menu flutuante em (x, y), mantendo-o dentro da janela. Fecha ao clicar fora ou apertar Esc.
  - `x` <sub>number</sub> — 
  - `y` <sub>number</sub> — 
  - `items` <sub>(object\|'sep')[]</sub> — { label, hint (atalho), icon, onClick, disabled, danger, checked, heading } ou 'sep' (separador). `heading: true` = título de seção, só texto.
- **`contextMenuItems({ store, commands, tools })`** · [L89](../src/ui/menus.js#L89) — Itens do menu de botão direito, calculados para a seleção ATUAL (itens que não se aplicam ficam desabilitados). Os mesmos comandos existem como atalhos; o hint mostra a tecla (⌘ no Mac, Ctrl nos demais).
- **`SHORTCUTS`** <sub>do módulo</sub> · [L146](../src/ui/menus.js#L146) — Texto da janela "Atalhos de teclado": [seção, [[tecla, descrição], ...]]. Mantenha em sincronia com tools.js e o README.
- **`modalSeq`** <sub>do módulo</sub> · [L158](../src/ui/menus.js#L158) — Contador para dar um id único ao título de cada janela (aria-labelledby).
- **`openModal({ title, body, cls = '', onClose })`** · [L172](../src/ui/menus.js#L172) — JANELA MODAL acessível, usada pela ajuda, Configurações e Projetos:

   - role="dialog" + aria-modal + título ligado por aria-labelledby (leitores de tela anunciam o nome);
   - o foco vai para o primeiro campo/botão e fica PRESO dentro (Tab/Shift+Tab dão a volta);
   - fecha com Esc, no X ou clicando fora; ao fechar, o foco volta para quem abriu.
  - `o` <sub>object</sub> — 
  - `o.title` <sub>string</sub> — título (h2)
  - `o.body` <sub>Node\|Node[]</sub> — conteúdo
  - `[o.cls]` <sub>string</sub> — classe extra para o .modal (ex.: 'narrow')
  - `[o.onClose]` <sub>() => void</sub> — 
  - ↩︎ `{ el: HTMLElement, close: () => void ` }
- **`ask({ title, message, buttons })`** · [L219](../src/ui/menus.js#L219) — PERGUNTA no visual do app (substitui o `confirm()` do navegador, que é cinza, feio e não dá para ter 3 botões). Devolve uma Promise com o `value` do botão escolhido, ou null se a pessoa fechou (Esc, X, clique fora).

    const r = await ask({ title: 'Substituir?', message: 'Texto...', buttons: [
      { label: 'Cancelar', value: null }, { label: 'Substituir', value: 'ok', primary: true } ] });

  O botão `primary` recebe o foco (Enter confirma); `danger` pinta de vermelho (ações que apagam algo).
  - `[]` <sub>{title: string, message: string\|Node\|Node[], buttons: {label: string, value: any, primary?: boolean, danger?: boolean</sub> — }} o
  - ↩︎ `Promise<any>`
- **`askText({ title, label, value = '', confirm = 'OK' })`** · [L240](../src/ui/menus.js#L240) — Pede UM TEXTO numa janela do app (substitui o `prompt()` do navegador). Enter confirma, Esc cancela.
  - ↩︎ `Promise<string\|null>` o texto digitado, ou null se cancelou
- **`showHelp()`** · [L260](../src/ui/menus.js#L260) — Abre a janela de ajuda com todos os atalhos. Fecha com Esc, no X ou clicando fora.

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

- **`createDesignPanel({ store, canvas, commands, tools, toast })`** · [L39](../src/ui/props.js#L39) — Cria o painel DESIGN (aba direita): editor das propriedades da seleção, com nomes e valores do CSS.

  COMO FUNCIONA (importante para entender o arquivo):
   - Cada seção (alinhar, camada, auto layout, texto, preenchimento, contorno, efeitos, exportar) é uma função que
     CONSTRÓI os campos uma vez e registra, em `updaters`, como RELER o valor de cada campo do documento.
   - `render()` só reconstrói os campos quando a ESTRUTURA muda (outra seleção, outro tipo de preenchimento, +1 sombra...),
     detectado pela `signature()`. Em qualquer outra mudança só roda os `updaters` — assim digitar num campo nunca
     perde o foco por o painel ter sido refeito.
   - Campos usam `each(fn)` para aplicar a mudança a TODAS as camadas selecionadas (valores mostrados vêm da 1ª).
- **`parentOf(id)`** <sub>interna</sub> · [L72](../src/ui/props.js#L72) — Pai da camada, na visão do breakpoint atual (o layout do pai pode ser outro no Celular).
- **`commit()`** <sub>interna</sub> · [L74](../src/ui/props.js#L74) — Fecha a edição (grava no histórico). Passado aos campos para chamarem ao terminar.
- **`reg(ctl)`** <sub>interna</sub> · [L76](../src/ui/props.js#L76) — Registra o `update` de um campo e devolve o elemento dele (para usar direto como filho).
- **`row(...c)`** <sub>interna</sub> · [L78](../src/ui/props.js#L78) — Linha horizontal de campos.
- **`SECTION_INFO`** <sub>interna</sub> · [L83](../src/ui/props.js#L83) — Para cada seção: ícone e uma explicação curta, em português simples, de PARA QUE ELA SERVE e qual é a propriedade do CSS por trás. A explicação abre pelo ícone de informação ao lado do título.
- **`cap(label, ...c)`** <sub>interna</sub> · [L135](../src/ui/props.js#L135) — Grupo "legenda pequena em cima + controle embaixo" (visual do Figma: "Posição", "Dimensões", "Opacidade"...).
- **`check(label, get, set)`** <sub>interna</sub> · [L143](../src/ui/props.js#L143) — Caixa de seleção (checkbox) estilizada: `get` lê, `set` aplica; grava no histórico ao alternar.
- **`pickImage(cb)`** <sub>interna</sub> · [L151](../src/ui/props.js#L151) — Abre o seletor de arquivos, importa a imagem escolhida (reduzida) e entrega { assetId, w, h } ao callback.
- **`alignRow()`** <sub>interna</sub> · [L162](../src/ui/props.js#L162) — Linha de alinhar (esquerda/centro/direita, topo/meio/base) e distribuir (precisa de 3+ camadas). Fica dentro da seção Posição.
- **`PRESETS`** <sub>interna</sub> · [L178](../src/ui/props.js#L178) — Tamanhos prontos para frames da raiz (telas e formatos comuns). Valor "LxA".
- **`H_CONS`** <sub>interna</sub> · [L185](../src/ui/props.js#L185) — Opções de constraint horizontal e vertical (ver model.js → applyConstraints).
- **`NO_RADIUS`** <sub>interna</sub> · [L188](../src/ui/props.js#L188) — Tipos que não têm cantos arredondados no painel (elipse já é redonda; texto/linha/vetor/grupo não têm cantos).
- **`positionSection()`** <sub>interna</sub> · [L194](../src/ui/props.js#L194) — Seção "Posição": X/Y (ou a caixa do conjunto, com várias camadas), constraints (em frame sem auto layout), rotação e espelhar. Dentro de um auto layout, X/Y ficam apagados: quem posiciona é o navegador (flex/grid).
- **`headerBlock()`** <sub>interna</sub> · [L241](../src/ui/props.js#L241) — Cabeçalho do painel: ícone, nome e tipo da camada (com a etiqueta HTML que ela vira), mostrar/ocultar, travar e Nota sob demanda.
- **`bpBanner(ns)`** <sub>interna</sub> · [L270](../src/ui/props.js#L270) — Aviso do modo responsivo: em que largura se está editando e o botão para voltar uma camada ao Desktop.
- **`noteSection()`** <sub>interna</sub> · [L289](../src/ui/props.js#L289) — Seção "Nota": uma anotação sobre PARA QUE SERVE a camada ("Botão principal: leva ao checkout"). Fica no projeto, aparece como selo na lista de camadas e vira comentário no HTML/CSS gerado (dá para desligar).
- **`htmlSection()`** <sub>interna</sub> · [L319](../src/ui/props.js#L319) — Seção "HTML": a etiqueta (tag) que a camada vira no código exportado, o endereço (para link) e a descrição para leitores de tela e buscadores (aria-label). Só afeta o código gerado; o canvas continua igual.
- **`sizeSection()`** <sub>interna</sub> · [L348](../src/ui/props.js#L348) — Seção "Tamanho": W/H (+ travar proporção), modo de largura/altura (fixo / hug = do tamanho do conteúdo / fill = preenche o espaço do auto layout) e, em frames da raiz, os tamanhos prontos (celular, desktop...).
- **`ASPECTS`** <sub>interna</sub> · [L406](../src/ui/props.js#L406) — Proporções prontas do select (valor = largura/altura; 'atual' usa o tamanho de agora).
- **`limitsBlock(n0)`** <sub>interna</sub> · [L415](../src/ui/props.js#L415) — "Limites e proporção": min/max de largura e altura (CSS min-width, max-width, min-height, max-height) e aspect-ratio. Fica recolhido (abre sozinho se algum já está em uso). Campo vazio = sem limite. Em medidas FIXAS o valor é limitado na hora; em Hug/Fill quem obedece é o navegador (o canvas mede de volta).
- **`appearanceSection()`** <sub>interna</sub> · [L451](../src/ui/props.js#L451) — Seção "Aparência": opacidade, mistura (mix-blend-mode), cantos arredondados (border-radius, juntos ou um por canto), cortar conteúdo (overflow: hidden) e máscara.
- **`componentSection()`** <sub>interna</sub> · [L486](../src/ui/props.js#L486) — Seção "Componente": criar componente / (no principal) criar instância / (na instância) ir ao principal e desanexar.
- **`A_START`** <sub>interna</sub> · [L506](../src/ui/props.js#L506) — Opções de alinhamento (valores do modelo = os do flexbox; no grid o css.js traduz flex-start → start).
- **`CSS_DOC`** <sub>interna</sub> · [L509](../src/ui/props.js#L509) — Explicações (em português) das propriedades CSS do auto layout: alimentam as dicas e a caixa "CSS ao vivo".
- **`cssTip(key)`** <sub>interna</sub> · [L586](../src/ui/props.js#L586) — Monta o objeto de dica de uma propriedade do CSS_DOC.
- **`varButton(prop)`** <sub>interna</sub> · [L592](../src/ui/props.js#L592) — Botãozinho "variável" na legenda de um campo: liga/desliga o campo a uma variável do projeto (--espaco-md).
- **`autoLayoutSection()`** <sub>interna</sub> · [L641](../src/ui/props.js#L641) — Seção "Auto layout": modo em 4 cartões (livre / linha / coluna / grade), uma caixa "CSS ao vivo" com o CSS REAL que o frame está gerando agora e os controles agrupados por assunto. Cada coisa tem uma dica ao passar o mouse (título, CSS e explicação), para quem usa perceber: "isso aqui é CSS puro".

   - FLEX: gap, flex-wrap, padding, justify-content (eixo principal) e align-items (eixo cruzado);
   - GRID: colunas/linhas, gap, padding e justify-items/align-items (onde o item fica DENTRO da célula).
- **`pad(labels)`** <sub>interna</sub> · [L694](../src/ui/props.js#L694) — Campos de padding de vários lados (T/R/B/L = topo/direita/baixo/esquerda, mesma ordem do CSS).
- **`paddingBlock()`** <sub>interna</sub> · [L700](../src/ui/props.js#L700) — padding: ou 2 campos (horizontal/vertical) ou os 4 lados, alternável pelo botão.
- **`matrix(jName, aName)`** <sub>interna</sub> · [L717](../src/ui/props.js#L717) — Matriz 3×3 do alinhamento: um clique define os dois alinhamentos de uma vez. Em coluna, o eixo principal é o vertical, então linhas e colunas da matriz trocam de papel. A célula ativa é marcada quando os valores coincidem.
- **`opts(list, grid)`** <sub>interna</sub> · [L739](../src/ui/props.js#L739) — Opções de um <select> mostrando o valor CSS de verdade (ex.: "flex-start", "space-between").
- **`subTip(text, key)`** <sub>interna</sub> · [L741](../src/ui/props.js#L741) — Legenda mono pequena com dica (usada acima dos selects de alinhamento).
- **`gridPicker()`** <sub>interna</sub> · [L747](../src/ui/props.js#L747) — Seletor visual de grade 6×6 (como o de tabela de um editor de texto): passar o mouse destaca "colunas × linhas", clicar aplica as duas contagens de uma vez. A grade atual (se couber em 6×6) fica marcada.
- **`autoSection(body)`** <sub>interna</sub> · [L839](../src/ui/props.js#L839) — Casca da seção Auto layout: título + selo "CSS puro" (com dica) à direita.
- **`STATE_DOC`** <sub>interna</sub> · [L845](../src/ui/props.js#L845) — Dicas dos estados.
- **`statesSection()`** <sub>interna</sub> · [L859](../src/ui/props.js#L859) — Seção "Estados": alterna entre Normal, Hover, Pressionado e Foco. Num estado, o painel passa a editar SÓ as sobrescritas dele (cor, contorno, sombra, filtros, opacidade, cantos, escala): o canvas mostra a camada naquele estado e o CSS ganha `.camada:hover { … }`. No Normal ficam a transição (`transition`) e o cursor.
- **`stateScaleBlock()`** <sub>interna</sub> · [L896](../src/ui/props.js#L896) — Escala do estado (`transform: scale()`): só existe dentro de um estado.
- **`marginBlock()`** <sub>interna</sub> · [L904](../src/ui/props.js#L904) — "Margem" do item (CSS margin): horizontal/vertical, ou os 4 lados (botão) — igual ao padding do container. Valores zerados somem do documento (e do CSS). Só aparece para itens em fluxo e não absolutos.
- **`flowItemSection()`** <sub>interna</sub> · [L929](../src/ui/props.js#L929) — Seção "Item do layout": só para camadas dentro de auto layout. Mostra as propriedades CSS do FILHO:

   - position: absolute (ignora o layout do pai);
   - grid → grid-column / grid-row (span N), justify-self e align-self (sobrescrevem o justify-items/align-items do pai);
   - flex → align-self (sobrescreve o align-items do pai).
  "stretch" é o mesmo que tamanho "Preencher" naquele eixo, então os dois ficam ligados.
- **`selfSelect(key, axis, list, title)`** <sub>interna</sub> · [L944](../src/ui/props.js#L944) — Select de *-self ligado ao tamanho: stretch ⇔ 'fill' no eixo; outro valor tira o 'fill'.
- **`commandsOrigin(n)`** <sub>interna</sub> · [L973](../src/ui/props.js#L973) — Posição atual da camada relativa ao pai (lida do DOM): usada ao marcar "absoluta" para ela não pular de lugar.
- **`GRID_KINDS`** <sub>interna</sub> · [L981](../src/ui/props.js#L981) — Tipos de grade de layout (só guia visual).
- **`layoutGridsSection()`** <sub>interna</sub> · [L983](../src/ui/props.js#L983) — Seção "Grades de layout" de um frame: lista de grades (colunas/linhas/quadrícula) com quantidade, gutter, margem e cor.
- **`vectorSection()`** <sub>interna</sub> · [L1011](../src/ui/props.js#L1011) — Seção "Vetor": editar pontos, o ponto selecionado (tipo canto/suave e posição X/Y), caminho fechado, inverter direção e o código SVG (`d`) do desenho — para copiar, ou colar o `d` de outro SVG e trocar a forma.
- **`textSection()`** <sub>interna</sub> · [L1070](../src/ui/props.js#L1070) — Seção "Texto": estilo compartilhado, fonte, peso, tamanho, altura de linha, espaçamento, alinhamento, itálico, decoração, MAIÚSCULAS e alinhamento vertical.
- **`gradientBar()`** <sub>interna</sub> · [L1132](../src/ui/props.js#L1132) — Faixa de pré-visualização do gradiente (sempre mostrada em 90° só para ver as cores/posições).
- **`docTopColors(max = 14)`** <sub>interna</sub> · [L1142](../src/ui/props.js#L1142) — As cores mais usadas no projeto (até `max`), da mais usada para a menos.
- **`colorGroups()`** <sub>interna</sub> · [L1154](../src/ui/props.js#L1154) — Grupos de cores que o seletor de cor mostra: as do projeto e os estilos de cor (as paletas prontas vêm do próprio seletor).
- **`docColorChips(apply)`** <sub>interna</sub> · [L1160](../src/ui/props.js#L1160) — Quadradinhos com as cores mais usadas no projeto (até 14): clicar aplica. Só aparece se houver 2+ cores.
- **`fillSection()`** <sub>interna</sub> · [L1171](../src/ui/props.js#L1171) — Seção "Preenchimento" (ou "Cor do texto" em texto): tipo (nenhum/sólido/linear/radial/imagem) e os campos de cada tipo — cor + estilo de cor; ângulo + paradas do gradiente; imagem + ajuste.
- **`strokeSection()`** <sub>interna</sub> · [L1267](../src/ui/props.js#L1267) — Seção "Contorno": cor, espessura, estilo (sólido/tracejado/pontilhado) e posição (dentro/centro/fora). O botão +/− liga e desliga.
- **`sidesOn()`** <sub>interna</sub> · [L1305](../src/ui/props.js#L1305) — O contorno da camada selecionada está "por lado"?
- **`strokeSidesRows(st)`** <sub>interna</sub> · [L1311](../src/ui/props.js#L1311) — Linhas "Lados" do contorno: atalhos (todos, só em cima, só embaixo, esquerda, direita, em cima e embaixo, nas laterais) e "Personalizado", que mostra a espessura de cada lado. Gera o CSS `border-top`, `border-bottom`...
- **`current()`** <sub>interna</sub> · [L1317](../src/ui/props.js#L1317) — Qual atalho corresponde aos lados atuais (ou 'custom' se as espessuras forem diferentes entre si).
- **`toggleSide(i)`** <sub>interna</sub> · [L1341](../src/ui/props.js#L1341) — Liga/desliga um lado: de "todos", o clique escolhe SÓ aquele lado; depois soma/tira; os 4 ligados voltam a "todos".
- **`effectsSection()`** <sub>interna</sub> · [L1373](../src/ui/props.js#L1373) — Seção "Efeitos": lista de sombras (x, y, blur, spread, cor, interna) + blur da camada + desfoque de fundo (vidro).
- **`colorFiltersBlock()`** <sub>interna</sub> · [L1399](../src/ui/props.js#L1399) — Filtros de COR (brightness, contrast, saturate, grayscale, hue-rotate): recolhido, abre sozinho se algum está em uso.
- **`exportSection()`** <sub>interna</sub> · [L1415](../src/ui/props.js#L1415) — Seção "Exportar": escala (1x–4x) e botões PNG, SVG e HTML da seleção.
- **`emptySection()`** <sub>interna</sub> · [L1441](../src/ui/props.js#L1441) — Painel quando nada está selecionado: resumo da página e dicas de atalhos.
- **`signature()`** <sub>interna</sub> · [L1461](../src/ui/props.js#L1461) — "Assinatura" da ESTRUTURA do painel: tudo que, se mudar, exige reconstruir os campos (outra seleção, outro tipo de preenchimento, +1 sombra, layout ligado/desligado...). NÃO inclui valores como a espessura ou o padding — esses só pedem para reler os campos, e reconstruir no meio da digitação faria o campo perder o foco.
- **`render()`** <sub>interna</sub> · [L1488](../src/ui/props.js#L1488) — Reconstrói o painel se a estrutura mudou; em qualquer caso, atualiza os valores dos campos.

---

## src/ui/proto.js

**ABA "PROTÓTIPO" (INTERAÇÕES ENTRE TELAS)** · [abrir o código](../src/ui/proto.js)

- **`createProtoPanel({ store, present, toast })`** · [L17](../src/ui/proto.js#L17) — Cria a aba PROTÓTIPO: para a camada selecionada, lista suas INTERAÇÕES. Cada interação tem gatilho (clicar / passar o mouse), ação (navegar para um frame / voltar / abrir link) e, ao navegar, o frame de destino e a transição. Um frame da raiz pode ser marcado como ponto de partida do fluxo. O botão Apresentar abre o modo de apresentação. Dados das interações: camada.interactions = [{ trigger, action, target, transition, url }] (ver present.js).
- **`rootFrames()`** <sub>interna</sub> · [L22](../src/ui/proto.js#L22) — Frames da raiz de todas as páginas: são os destinos possíveis de "Navegar para".
- **`render()`** <sub>interna</sub> · [L25](../src/ui/proto.js#L25) — Reconstrói a aba para a camada selecionada (só roda com a aba aberta).

---

## src/ui/responsive.js

**LARGURA DA TELA (Desktop · Tablet · Celular) E MODO DE COR** · [abrir o código](../src/ui/responsive.js)

```text
 Fica na barra do topo, em poucos ícones. Escolher Tablet ou Celular muda a VISÃO do documento inteiro para aquela
 largura: o que você editar no painel Design passa a valer só ali (vira uma regra `@media (max-width: …)` no CSS
 exportado) e o que não for mexido continua herdando do Desktop. Só o que é DIFERENTE do Desktop é guardado, em `node.bps`.
 No Desktop não aparece mais nada; em Tablet/Celular surge uma faixa fina no topo do canvas com o resumo e os atalhos.

 O botão de lua/sol ao lado escolhe o MODO DE COR (claro/escuro...) visto no canvas e cria/renomeia/exclui modos.

 A parte de dados (bpView/editBp) mora em model.js; o CSS é gerado em css.js (generateCode).
```

- **`createResponsiveBar({ store, canvas, commands, toast, stage })`** · [L26](../src/ui/responsive.js#L26) — Cria os controles. `topEl` vai para a barra superior; a faixa de resumo é pendurada no palco.
  - ↩︎ `{topEl: HTMLElement, render: () => void` }
- **`countOverrides(bp)`** <sub>interna</sub> · [L46](../src/ui/responsive.js#L46) — Quantas camadas da página têm sobrescritas neste breakpoint.
- **`fitScreens()`** <sub>interna</sub> · [L53](../src/ui/responsive.js#L53) — Ajusta a largura das telas (frames da raiz e dentro de seções) para a largura típica do modo.
- **`makeMode(opts)`** <sub>interna</sub> · [L68](../src/ui/responsive.js#L68) — Cria um modo de cor a partir de uma opção do menu.
- **`modeMenu(e)`** <sub>interna</sub> · [L74](../src/ui/responsive.js#L74) — Menu único do modo de cor: escolher o modo visto, criar um novo e, no modo ativo, renomear/excluir.

---

## src/ui/settings.js

**JANELA "CONFIGURAÇÕES" (onde salvar, versões, cópia no navegador, aparência)** · [abrir o código](../src/ui/settings.js)

```text
 Aberta pela engrenagem do topo, por Arquivo → Configurações ou Ctrl+, (vírgula).
 Seções:
  1. Pasta de projetos  — caminho no computador (o SERVIDOR grava lá), auto-salvar e nº de versões.
     Explica como usar Google Drive/OneDrive/Dropbox: escolher uma pasta sincronizada por eles.
  2. Cópia no navegador — sempre ligada (IndexedDB); mostra o espaço e pede proteção contra limpeza.
  3. Assistente de IA e MCP — chave/modelo/endereço da API (OpenAI ou compatível) e como ligar o Claude Code/Codex.
  4. Aparência e controles — tema, tela ao abrir o app (página inicial ou editor) e o que a roda do mouse faz.
```

- **`formatBytes(b)`** · [L20](../src/ui/settings.js#L20) — "12345678" bytes → "11,8 MB".
- **`checkbox(label, checked, onchange)`** <sub>do módulo</sub> · [L24](../src/ui/settings.js#L24) — Caixa de seleção no estilo do app (a mesma de props.js).
- **`openSettings({ store, saving, prefs, savePrefs, toast })`** · [L38](../src/ui/settings.js#L38) — Abre a janela de Configurações.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.saving` <sub>object</sub> — ver saving.js (refresh, server)
  - `deps.prefs` <sub>object</sub> — preferências (autoFolder, wheelMode)
  - `deps.savePrefs` <sub>() => void</sub> — 
  - `deps.toast` <sub>(m: string) => void</sub> — 
- **`render()`** <sub>interna</sub> · [L44](../src/ui/settings.js#L44) — Redesenha o conteúdo (chamado ao abrir e depois de cada mudança que o servidor confirma).
- **`save(patch)`** <sub>interna</sub> · [L145](../src/ui/settings.js#L145) — Grava no servidor (a chave só vai se você digitou uma nova).

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

- **`root`** <sub>do módulo</sub> · [L35](../server.js#L35) — Pasta do projeto (onde está este arquivo). Tudo que o servidor entrega é lido a partir daqui.
- **`port`** <sub>do módulo</sub> · [L37](../server.js#L37) — Porta HTTP. Padrão 5173; mude com `PORT=8080 npm start`.
- **`allowed`** <sub>do módulo</sub> · [L39](../server.js#L39) — Lista branca: SÓ estes caminhos são servidos (o app em si). package.json, .git, tests, projetos etc. nunca saem por aqui.
- **`configFile`** <sub>do módulo</sub> · [L41](../server.js#L41) — Arquivo onde a configuração (pasta escolhida, nº de versões) é lembrada entre execuções. Fica fora do git (.gitignore).
- **`DEFAULTS`** <sub>do módulo</sub> · [L43](../server.js#L43) — Configuração padrão: pasta ./projetos ao lado do app, guardando até 20 versões por projeto.
- **`VERSION_EVERY_MS`** <sub>do módulo</sub> · [L45](../server.js#L45) — Intervalo mínimo entre duas versões guardadas do mesmo projeto (o auto-salvar grava a cada poucos segundos; versões não).
- **`MAX_BODY`** <sub>do módulo</sub> · [L47](../server.js#L47) — Tamanho máximo aceito para um projeto (imagens embutidas deixam o .json grande).
- **`FILE_RE`** <sub>do módulo</sub> · [L49](../server.js#L49) — Nome de arquivo aceito: começa com letra/número, só usa letras, números, ponto, - e _, e termina em .json.
- **`types`** <sub>do módulo</sub> · [L52](../server.js#L52) — Tipo MIME por extensão. O de .js precisa ser text/javascript, senão o navegador recusa carregar módulos ES.
- **`loadConfig()`** <sub>do módulo</sub> · [L64](../server.js#L64) — Lê a configuração salva (ou a padrão, se ainda não existir / estiver corrompida).
- **`config`** <sub>do módulo</sub> · [L73](../server.js#L73) — Configuração atual, carregada uma vez ao iniciar e atualizada pelo PUT /api/config.
- **`expandHome(p)`** <sub>do módulo</sub> · [L76](../server.js#L76) — "~/Designer" → "/home/voce/Designer" (atalho comum para a pasta do usuário).
- **`useFolder(input)`** <sub>do módulo</sub> · [L82](../server.js#L82) — Valida e aplica uma pasta nova: precisa ser caminho ABSOLUTO; é criada se não existir; e testamos se dá para escrever nela (gravando e apagando um arquivo de teste) ANTES de aceitar — melhor errar agora do que no auto-salvar.
- **`publicConfig()`** <sub>do módulo</sub> · [L94](../server.js#L94) — O que a configuração mostra para fora: tudo MENOS a chave da IA (ela nunca sai deste computador nem volta ao navegador).
- **`httpError(status, message)`** <sub>do módulo</sub> · [L98](../server.js#L98) — Erro com status HTTP e mensagem que pode ir para a tela do usuário.
- **`sendJson(res, status, data)`** <sub>do módulo</sub> · [L102](../server.js#L102) — Responde JSON.
- **`readBody(req)`** <sub>do módulo</sub> · [L107](../server.js#L107) — Lê o corpo do pedido inteiro (com limite de tamanho) e devolve como texto.
- **`localHost(host = '')`** <sub>do módulo</sub> · [L118](../server.js#L118) — O Host do pedido é esta máquina? (protege contra DNS rebinding)
- **`localOrigin(origin)`** <sub>do módulo</sub> · [L120](../server.js#L120) — A página que fez o pedido (Origin) é local? Pedidos sem Origin (curl, testes) são aceitos: não vêm de um site.
- **`projectPath(name)`** <sub>do módulo</sub> · [L123](../server.js#L123) — Caminho do projeto `name` dentro da pasta configurada (o nome já foi validado por FILE_RE).
- **`versionsDir(name)`** <sub>do módulo</sub> · [L125](../server.js#L125) — Pasta onde ficam as versões antigas de um projeto: <pasta>/.versoes/<nome-sem-.json>/
- **`thumbPath(name)`** <sub>do módulo</sub> · [L127](../server.js#L127) — Miniatura (SVG) de um projeto, mostrada na página inicial: <pasta>/.miniaturas/<nome-sem-.json>.svg
- **`MAX_THUMB`** <sub>do módulo</sub> · [L129](../server.js#L129) — Tamanho máximo de uma miniatura (o app já tira imagens grandes antes de mandar).
- **`checkName(name)`** <sub>do módulo</sub> · [L131](../server.js#L131) — Valida o nome vindo da URL.
- **`listVersions(name)`** <sub>do módulo</sub> · [L137](../server.js#L137) — Lista as versões guardadas de um projeto, da mais nova para a mais antiga.
- **`snapshotVersion(name)`** <sub>do módulo</sub> · [L153](../server.js#L153) — Antes de sobrescrever um projeto, guarda o conteúdo ANTERIOR como versão — mas só se a última versão tiver mais de 10 min (senão o auto-salvar criaria centenas). Depois apaga as mais antigas além de `keepVersions`.
- **`api(req, res, path)`** <sub>do módulo</sub> · [L185](../server.js#L185) — Rotas da API (todas respondem JSON):

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
- **`editors`** <sub>do módulo</sub> · [L295](../server.js#L295) — PONTE COM O EDITOR. Quem executa as ferramentas da IA é o editor aberto no navegador (é lá que o projeto está vivo, com desfazer e a janela de permissão). O editor se conecta em GET /api/agent/events (Server-Sent Events: uma conexão que fica aberta e pela qual o servidor manda mensagens); o servidor manda "use a ferramenta X" e espera a resposta em POST /api/agent/reply. Com várias abas abertas, vale a última que conectou.
- **`pending`** <sub>do módulo</sub> · [L297](../server.js#L297) — Pedidos esperando resposta do editor: id → { resolve, timer }.
- **`EDITOR_TIMEOUT_MS`** <sub>do módulo</sub> · [L300](../server.js#L300) — Tempo máximo esperando o editor (inclui a pessoa decidir na janela de permissão).
- **`callEditor(tool, args, client)`** <sub>do módulo</sub> · [L303](../server.js#L303) — Pede ao editor aberto para rodar uma ferramenta; devolve o resultado (ou erro claro se não houver editor).
- **`mcpSession`** <sub>do módulo</sub> · [L315](../server.js#L315) — Nome do programa de IA conectado pelo MCP (vem no "initialize"), mostrado na janela de permissão.
- **`mcpRoute(req, res)`** <sub>do módulo</sub> · [L321](../server.js#L321) — MCP por HTTP (http://localhost:5173/mcp, transporte "Streamable HTTP" do MCP, respondendo JSON simples). POST com uma mensagem JSON-RPC (ou uma lista delas). GET não é usado (405), como o protocolo permite.
- **`OPENAI_URL`** <sub>do módulo</sub> · [L333](../server.js#L333) — Endereço padrão da API da OpenAI (dá para trocar por um servidor compatível no seu PC, como Ollama ou LM Studio).
- **`DEFAULT_MODEL`** <sub>do módulo</sub> · [L335](../server.js#L335) — Modelo padrão do agente interno (troque em Configurações pelo nome de um modelo disponível na sua conta).
- **`agentConfig()`** <sub>do módulo</sub> · [L337](../server.js#L337) — Configuração do agente interno: URL da API, modelo e chave (a chave também pode vir da variável OPENAI_API_KEY).
- **`agentApi(req, res, parts)`** <sub>do módulo</sub> · [L351](../server.js#L351) — Rotas da IA:

    GET  /api/agent/events   → o editor fica ouvindo os pedidos de ferramenta (Server-Sent Events)
    POST /api/agent/reply    { id, result } → o editor devolve o resultado de um pedido
    GET  /api/agent/config   → { baseUrl, model, hasKey, editors } (a chave NUNCA é devolvida)
    PUT  /api/agent/config   { apiKey?, model?, baseUrl? } → grava (apiKey "" apaga a chave)
    POST /api/agent/chat     { messages, tools } → repassa à API de chat (OpenAI ou compatível) com a SUA chave

---

## server/mcp.js

**O PROTOCOLO MCP (Model Context Protocol), SEM DEPENDÊNCIAS** · [abrir o código](../server/mcp.js)

```text
 MCP é o "padrão de tomada" que programas de IA (Claude Code, Claude Desktop, Codex, Cursor...) usam para
 conversar com ferramentas externas. Por baixo é JSON-RPC 2.0: a IA manda { id, method, params } e recebe
 { id, result } ou { id, error }. Só precisamos de quatro métodos:
   initialize   → "oi, eu sou o Projeto Designer e sei usar ferramentas"
   tools/list   → a lista de agent/schema.js
   tools/call   → executa uma ferramenta (quem executa de verdade é o EDITOR aberto no navegador; ver server.js)
   ping         → "estou vivo"
 Mensagens sem `id` são avisos (notifications) e não têm resposta.

 Este arquivo só traduz o protocolo; não sabe nada de HTTP nem de navegador (`callTool` vem de fora). Assim ele
 é testado direto no Node (tests/mcp.test.js) e usado tanto pelo endereço http://localhost:5173/mcp quanto pelo
 scripts/mcp.mjs (para programas que só falam MCP pela entrada/saída padrão, o "stdio").
```

- **`PROTOCOL_VERSIONS`** · [L23](../server/mcp.js#L23) — Versões do protocolo MCP que este servidor entende (a mais nova primeiro).
- **`rpcError(id, code, message)`** <sub>do módulo</sub> · [L26](../server/mcp.js#L26) — Resposta de erro do JSON-RPC (códigos padrão: -32601 método inexistente, -32602 parâmetro inválido...).
- **`handleMcp(msg, { callTool, version = '0.0.0', session = {} })`** · [L37](../server/mcp.js#L37) — Responde UMA mensagem JSON-RPC do MCP.
  - `msg` <sub>object</sub> — a mensagem já lida (objeto)
  - `deps` <sub>object</sub> — 
  - `deps.callTool` <sub>(name: string, args: object, client: string) => Promise<object></sub> — executa a ferramenta (no editor)
  - `deps.version` <sub>string</sub> — versão do app (aparece para a IA)
  - ↩︎ `Promise<object\|null>` a resposta, ou null quando a mensagem é um aviso (sem id)

---

## scripts/mcp.mjs

**SERVIDOR MCP POR "STDIO" (para Claude Desktop, Codex e outros)** · [abrir o código](../scripts/mcp.mjs)

```text
 Alguns programas de IA só sabem ligar um servidor MCP como um programa de terminal: eles escrevem os pedidos
 (uma mensagem JSON por linha) na ENTRADA dele e leem as respostas na SAÍDA. Este script é só um "repassador":
 cada linha que chega vai para o endereço http://localhost:5173/mcp do servidor do app (npm start), e a resposta
 volta como uma linha. Toda a lógica fica no servidor (server/mcp.js) e no editor aberto no navegador.

 Precisa: `npm start` rodando e o editor aberto no navegador.
 Variável opcional: DESIGNER_URL (padrão http://localhost:5173).

 Exemplos de configuração (veja o README para todos):
   Claude Code:  claude mcp add designer -- node /caminho/do/projeto/scripts/mcp.mjs
   Codex:        ~/.codex/config.toml → [mcp_servers.designer] command = "node", args = ["/caminho/scripts/mcp.mjs"]
```

- **`send(obj)`** <sub>do módulo</sub> · [L24](../scripts/mcp.mjs#L24) — Escreve uma resposta (uma linha JSON) na saída. NADA além disso pode ir para a saída: quebraria o protocolo.
