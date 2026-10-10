# Referência do código

> **Arquivo gerado** por `scripts/gerar-referencia.mjs` a partir dos comentários do código. **Não edite à mão**:
> mude o comentário no `.js` e rode `npm run docs`. (Os testes avisam se esta página ficou desatualizada.)
>
> Para entender o projeto antes de mergulhar aqui, leia o [Guia do código](GUIA-DO-CODIGO.md) e a [Arquitetura](ARQUITETURA.md).

75 arquivos · 1181 funções e constantes documentadas.

Legenda: sem marca = **exportada** (outros arquivos podem importar) · <sub>do módulo</sub> = só usada dentro do arquivo · <sub>interna</sub> = definida dentro de uma fábrica (`createStore`, `createTools`…) e acessível pelo objeto que ela devolve, se estiver na lista de retorno.

## Índice

| Arquivo | O que é |
|---|---|
| [`src/account.js`](#srcaccountjs) | Conta local no navegador (espelho do perfil guardado pelo servidor) |
| [`src/canvas.js`](#srccanvasjs) | Desenha o documento em HTML/CSS + pan, zoom e geometria |
| [`src/codeassist.js`](#srccodeassistjs) | Autocompletar de CSS/HTML e abreviações emmet (lógica pura, sem DOM) |
| [`src/color.js`](#srccolorjs) | Matemática de cor (puro): hex ↔ rgb ↔ hsl ↔ hsv, harmonias, tons e contraste |
| [`src/commands.js`](#srccommandsjs) | Comandos de edição |
| [`src/comments.js`](#srccommentsjs) | Comentários nas camadas (módulo puro: sem DOM, testado em tests/features.test.js) |
| [`src/components.js`](#srccomponentsjs) | Componentes (principal + instâncias) e estilos compartilhados (módulo puro) |
| [`src/css.js`](#srccssjs) | Camada → CSS / HTML / SVG (módulo puro: sem DOM) |
| [`src/cssedit.js`](#srccsseditjs) | CSS da camada editado à mão (aba código → CSS → editar) |
| [`src/export.js`](#srcexportjs) | Saídas: PNG, SVG, HTML e arquivo de projeto (.json) |
| [`src/fonts.js`](#srcfontsjs) | Fontes do Google Fonts (lista, carregamento sob demanda e prévia) |
| [`src/geom.js`](#srcgeomjs) | Geometria dos vetores (sem DOM, sem dependências; testável no node) |
| [`src/html.js`](#srchtmljs) | HTML e CSS escritos à mão (sanitização, CSS da página, atributos HTML) |
| [`src/image-assets.js`](#srcimage-assetsjs) |  |
| [`src/imagefx.js`](#srcimagefxjs) | Matemática da IA de foto (funções puras sobre pixels, sem DOM) |
| [`src/main.js`](#srcmainjs) | Ponto de entrada: monta o app |
| [`src/model.js`](#srcmodeljs) | Modelo de dados do documento |
| [`src/modes.js`](#srcmodesjs) | Modos de cor (claro/escuro...) e variáveis de tamanho (módulo puro, testado em tests/modes.test.js) |
| [`src/overlay.js`](#srcoverlayjs) | Interface por cima do canvas (seleção, alças, guias, medidas...) |
| [`src/palettes.js`](#srcpalettesjs) | Paletas de cor próprias (salvas no navegador, valem para todos os projetos) |
| [`src/pen.js`](#srcpenjs) | Ferramenta caneta (vetores) e edição de pontos |
| [`src/present.js`](#srcpresentjs) | Modo apresentar (o design num navegador de verdade) |
| [`src/rulers.js`](#srcrulersjs) | Réguas e criação de guias |
| [`src/sample-vitrine.js`](#srcsample-vitrinejs) | Exemplo "vitrine": um site inteiro que usa tudo que o editor faz |
| [`src/saving.js`](#srcsavingjs) | Regras de salvamento (navegador + pasta do computador) |
| [`src/site-export.js`](#srcsite-exportjs) |  |
| [`src/storage.js`](#srcstoragejs) | Onde o projeto é guardado: navegador (IndexedDB) e pasta do computador (servidor) |
| [`src/store.js`](#srcstorejs) | Estado central, histórico (desfazer) e salvamento |
| [`src/svg.js`](#srcsvgjs) | Exportação SVG vetorial (módulo puro: sem DOM) |
| [`src/svgimport.js`](#srcsvgimportjs) | Importa SVG como vetores editáveis |
| [`src/thumbnail.js`](#srcthumbnailjs) | Miniatura do projeto (SVG) para a página inicial |
| [`src/tools.js`](#srctoolsjs) | Interação: mouse e teclado no canvas |
| [`src/version.js`](#srcversionjs) |  |
| [`src/zip.js`](#srczipjs) |  |
| [`src/agent/bridge.js`](#srcagentbridgejs) | Permissão e ponte com o MCP (lado do navegador) |
| [`src/agent/content.js`](#srcagentcontentjs) |  |
| [`src/agent/jev.js`](#srcagentjevjs) | O jev (typesafe) como "segunda opinião" rápida do agente |
| [`src/agent/providers.js`](#srcagentprovidersjs) | De onde vem a IA do assistente (provedores prontos) |
| [`src/agent/runner.js`](#srcagentrunnerjs) | Executa as ferramentas do agente no editor aberto |
| [`src/agent/schema.js`](#srcagentschemajs) | As ferramentas que uma IA pode usar no editor (lista única, sem DOM) |
| [`src/agent/stream.js`](#srcagentstreamjs) | Resposta da IA em tempo real (streaming) e controle do "raciocínio" |
| [`src/agent/subagents.js`](#srcagentsubagentsjs) | Subagentes: o agente divide o trabalho em até 4 ajudantes em paralelo |
| [`src/ui/assets.js`](#srcuiassetsjs) | Aba "recursos" (componentes e estilos) |
| [`src/ui/assistant.js`](#srcuiassistantjs) | Aba do agente (chat de IA dentro do editor) |
| [`src/ui/code.js`](#srcuicodejs) | Aba "código" (CSS e HTML da seleção, CSS da página, atributos) |
| [`src/ui/codedock.js`](#srcuicodedockjs) | Editor de código grande (acoplado embaixo do canvas, ou em tela cheia) |
| [`src/ui/codeeditor.js`](#srcuicodeeditorjs) | Editor de código leve (sem dependências) |
| [`src/ui/colorpicker.js`](#srcuicolorpickerjs) | Seletor de cor (popover) com gerenciador de paletas |
| [`src/ui/comments.js`](#srcuicommentsjs) | Painel "comentários" (aba do painel direito) |
| [`src/ui/dom.js`](#srcuidomjs) | Criar elementos + componentes de formulário |
| [`src/ui/fontpicker.js`](#srcuifontpickerjs) | Seletor de fontes (Google Fonts + fontes do sistema) |
| [`src/ui/googleicons.js`](#srcuigoogleiconsjs) | Painel "ícones" (Material Symbols, os ícones do Google) |
| [`src/ui/guides.js`](#srcuiguidesjs) |  |
| [`src/ui/home.js`](#srcuihomejs) | Página inicial (os seus projetos) |
| [`src/ui/icons.js`](#srcuiiconsjs) | Ícones SVG (inline, sem dependências) |
| [`src/ui/imageai.js`](#srcuiimageaijs) | IA de foto: o editor de imagem (painel grande) e as edições usadas pelo agente |
| [`src/ui/info.js`](#srcuiinfojs) |  |
| [`src/ui/inspector.js`](#srcuiinspectorjs) | Painel do inspecionar (como a aba "elements" do F12) |
| [`src/ui/layers.js`](#srcuilayersjs) | Painel de páginas e camadas |
| [`src/ui/menus.js`](#srcuimenusjs) | Menus flutuantes, janelas modais e ajuda de atalhos |
| [`src/ui/photos.js`](#srcuiphotosjs) |  |
| [`src/ui/presence.js`](#srcuipresencejs) | Quem está no projeto (pessoas e agentes) na barra do topo |
| [`src/ui/projects.js`](#srcuiprojectsjs) | Janela "projetos na pasta" (salvar com nome, abrir, versões antigas) |
| [`src/ui/props.js`](#srcuipropsjs) | Painel "design" (propriedades da seleção) |
| [`src/ui/proto.js`](#srcuiprotojs) | Aba "protótipo" (interações entre telas) |
| [`src/ui/responsive.js`](#srcuiresponsivejs) | Largura da tela (Desktop · tablet · celular) e modo de cor |
| [`src/ui/settings.js`](#srcuisettingsjs) | Página "configurações" (tela cheia dentro do app, não é janela modal) |
| [`server.js`](#serverjs) | Servidor local: entrega o app e salva os projetos numa pasta do seu computador |
| [`server/account.js`](#serveraccountjs) | Conta local (o seu perfil neste computador) |
| [`server/editor-bridge.js`](#servereditor-bridgejs) |  |
| [`server/imageai.js`](#serverimageaijs) | Edição generativa de foto (preencher área, expandir, trocar objeto, gerar) |
| [`server/mcp.js`](#servermcpjs) | O protocolo MCP (model context protocol), sem dependências |
| [`server/photos.js`](#serverphotosjs) |  |
| [`server/presence.js`](#serverpresencejs) | Quem está no projeto (pessoas e agentes) e as travas por camada |
| [`scripts/mcp.mjs`](#scriptsmcpmjs) | Servidor MCP por "stdio" (para Claude Desktop, Codex e outros) |

---

## src/account.js

**CONTA LOCAL NO NAVEGADOR (espelho do perfil guardado pelo servidor)** · [abrir o código](../src/account.js)

```text
 A conta mora no servidor (GET/PUT /api/account, ver server/account.js). Este módulo:
   - carrega a conta ao abrir o app e MIGRA o nome antigo (prefs.author/authorColor, de antes da conta existir)
     quando a conta do servidor ainda está vazia;
   - mantém prefs.author e prefs.authorColor sincronizados a partir da conta, porque comentários (ui/comments.js)
     e presença (ui/presence.js) leem dali;
   - avisa quem estiver ouvindo (avatar do topo, página de Configurações) quando o perfil muda.
 Sem servidor, a conta funciona só com as preferências do navegador (nome e cor).
```

- **`ACCOUNT_COLORS`** · [L16](../src/account.js#L16) — Cores de avatar (as mesmas do servidor e da presença).
- **`initials(name)`** · [L19](../src/account.js#L19) — "Kayky Silva" → "KS"; "Ana" → "A"; vazio → "?".
- **`createAccount({ prefs, savePrefs, server })`** · [L28](../src/account.js#L28) — _(sem comentário)_
- **`mirror()`** <sub>interna</sub> · [L36](../src/account.js#L36) — Copia nome e cor para as preferências (lidas por comentários e presença).
- **`avatarEl(h, acc, cls = '')`** · [L82](../src/account.js#L82) — Avatar da conta: a imagem enviada ou as iniciais sobre a cor escolhida.
  - `h` <sub>(tag: string, ...args) => HTMLElement</sub> — helper de ui/dom.js
- **`shrinkAvatar(file)`** · [L93](../src/account.js#L93) — Reduz uma imagem escolhida pela pessoa para caber no limite do servidor (quadrada, até 160 px).
  - ↩︎ `Promise<string>` data URL (JPEG, ou PNG se for pequena o bastante e tiver transparência)

---

## src/canvas.js

**DESENHA O DOCUMENTO EM HTML/CSS + PAN, ZOOM E GEOMETRIA** · [abrir o código](../src/canvas.js)

```text
 Cada camada vira um <div> real, estilizado pelo CSS que css.js gera. Por isso flexbox, grid, sombras,
 gradientes e blur funcionam "de graça": quem renderiza é o motor do navegador, não código nosso.

 Este módulo é a ÚNICA ponte entre o modelo (dados) e o DOM. Quando precisamos saber "onde a camada está
 de verdade" (ex.: dentro de um auto layout), lemos do DOM aqui, em vez de recalcular layout na mão.
```

- **`MIN_ZOOM`** <sub>do módulo</sub> · [L19](../src/canvas.js#L19) — Limites do zoom: 2% (para ver pranchas enormes) até 6400% (para conferir pixels).
- **`createCanvas(store, viewport)`** · [L37](../src/canvas.js#L37) — Cria o CANVAS: transforma as camadas do documento em elementos HTML reais dentro do `viewport`.

  Estrutura do DOM:
    .viewport  (a janela visível: recorta, recebe mouse/teclado, desenha o fundo pontilhado)
      ├─ .world   (um "mundo" gigante; recebe translate+scale para fazer pan e zoom)
      │    └─ .node  um <div> por camada, estilizado por css.js → nodeStyle (CSS de verdade!)
      └─ .overlay (seleção, alças, guias — criado por overlay.js, em pixels de TELA, fora do zoom)

  Também oferece a GEOMETRIA: onde cada camada está no mundo (lida do DOM, porque em auto layout quem decide a
  posição é o navegador, não o modelo), conversões tela↔mundo, zoom ancorado no cursor e "ajustar à tela".
  - `store` <sub>object</sub> — o store do app
  - `viewport` <sub>HTMLElement</sub> — elemento que vira a janela do canvas
- **`getView()`** <sub>interna</sub> · [L59](../src/canvas.js#L59) — Vista (pan/zoom) da página atual: { x, y, zoom }. x/y = deslocamento do mundo em px de tela. Cada página lembra a sua. `fresh: true` marca "nunca foi ajustada" — o app então faz "ajustar tudo" sozinho.
- **`applyView()`** <sub>interna</sub> · [L62](../src/canvas.js#L62) — Aplica a vista ao DOM: transforma o mundo e faz o fundo pontilhado acompanhar (some quando o zoom é muito baixo).
- **`setView(patch)`** <sub>interna</sub> · [L73](../src/canvas.js#L73) — Atualiza parte da vista ({x, y, zoom}), limitando o zoom ao intervalo permitido, e avisa o app ('view').
- **`zoomAt(newZoom, cx, cy)`** <sub>interna</sub> · [L89](../src/canvas.js#L89) — Muda o zoom MANTENDO O PONTO (cx, cy) parado na tela — é o que faz o zoom "ir para onde o mouse está". Matemática: queremos que o ponto do mundo sob o cursor continue sob o cursor, então deslocamos x/y na proporção da mudança.
  - `newZoom` <sub>number</sub> — zoom desejado (1 = 100%)
  - `cx` <sub>number</sub> — x do ponto fixo, em px relativos ao viewport
  - `cy` <sub>number</sub> — y do ponto fixo
- **`vpRect()`** <sub>interna</sub> · [L96](../src/canvas.js#L96) — Retângulo do viewport na tela (px da janela do navegador).
- **`toWorld(clientX, clientY)`** <sub>interna</sub> · [L98](../src/canvas.js#L98) — Converte um ponto da TELA (clientX/clientY de um evento) para coordenadas do MUNDO (as do documento).
- **`toScreen(wx, wy)`** <sub>interna</sub> · [L104](../src/canvas.js#L104) — Converte coordenadas do MUNDO para px relativos ao viewport (o oposto de toWorld).
- **`originOf(id)`** <sub>interna</sub> · [L115](../src/canvas.js#L115) — Origem (canto superior esquerdo, sem rotação) da camada em coordenadas do mundo. Soma offsetLeft/offsetTop subindo a cadeia de pais posicionados — esses valores ignoram transform, então não são afetados por rotação/zoom. É por LER o DOM (e não o modelo) que isso também funciona em flex/grid.
- **`ancestorRotated(id)`** <sub>interna</sub> · [L127](../src/canvas.js#L127) — Algum ancestral está rotacionado? (Nesse caso a soma de offsets deixa de valer e usamos o retângulo envolvente.)
- **`worldBox(id)`** <sub>interna</sub> · [L137](../src/canvas.js#L137) — Caixa da camada no mundo: { x, y, w, h, cx, cy, rot } — centro, tamanho e a rotação PRÓPRIA da camada. É o que o overlay usa para desenhar a seleção girada. Se um ancestral está girado, devolve o retângulo envolvente com rot=0 (simplificação aceita).
- **`aabb(id)`** <sub>interna</sub> · [L154](../src/canvas.js#L154) — AABB = retângulo envolvente alinhado aos eixos (considera rotação), em coordenadas do mundo. Calculado com getBoundingClientRect, que já inclui qualquer transform. Usado em snap, alinhar, marquee e medidas.
- **`unionAabb(ids)`** <sub>interna</sub> · [L164](../src/canvas.js#L164) — Menor retângulo que envolve as AABBs de várias camadas (ou null se nenhuma existir).
- **`ensureVisible(id)`** <sub>interna</sub> · [L176](../src/canvas.js#L176) — Rola a vista só o necessário para a camada ficar visível (com 60px de folga), sem mexer no zoom. Usado pelo Tab.
- **`fit(ids, { maxZoom = 2, padding = 80 } = {})`** <sub>interna</sub> · [L195](../src/canvas.js#L195) — "Ajustar à tela": enquadra as camadas dadas (ou todas, se vazio) no centro do viewport.
  - `[ids]` <sub>string[]</sub> — camadas a enquadrar; vazio/null = todas as da página
- **`syncNode(node, parent, parentEl, index)`** <sub>interna</sub> · [L221](../src/canvas.js#L221) — Sincroniza UMA camada (e, recursivamente, os filhos) com o DOM: cria o elemento se não existe, atualiza o estilo, o texto e a posição na lista de irmãos. É um "diff" simples: só toca no DOM quando algo mudou (comparamos o CSS novo com o último aplicado, guardado em `el._css` — ler `style.cssText` seria caro).
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai (decide se é item de flex/grid)
  - `parentEl` <sub>HTMLElement</sub> — elemento DOM do pai
  - `index` <sub>number</sub> — posição desejada entre os irmãos (a ordem do array é a ordem z)
- **`measureBack(list, parent)`** <sub>interna</sub> · [L291](../src/canvas.js#L291) — "Medida de volta": para camadas com tamanho 'hug'/'fill' (ou dentro de auto layout), o tamanho real só o navegador sabe. Lemos offsetWidth/Height e gravamos em node.w/h, para o painel, o SVG e o 'ajustar' mostrarem o tamanho verdadeiro. Não cria entrada no histórico (é dado derivado).
- **`render()`** <sub>interna</sub> · [L315](../src/canvas.js#L315) — Desenha a página atual: sincroniza todas as camadas, remove elementos órfãos (camada apagada ou de outra página), mede de volta os tamanhos e, se há texto em edição, dá foco e seleciona o conteúdo.

---

## src/codeassist.js

**AUTOCOMPLETAR DE CSS/HTML E ABREVIAÇÕES EMMET (lógica pura, sem DOM)** · [abrir o código](../src/codeassist.js)

```text
 O editor de código (ui/codeeditor.js) pergunta "o que sugerir aqui?" passando o texto e a posição do cursor.
 Este módulo descobre o CONTEXTO e devolve a lista já filtrada (busca "fuzzy") e ordenada:
  - CSS: propriedades, valores por propriedade, unidades depois de números, funções (calc, clamp, var...),
    variáveis do documento (estilos de cor e variáveis de tamanho), seletores (classes e ids das camadas,
    etiquetas, pseudo-classes) e @regras (@media com os breakpoints do projeto, @keyframes, @supports);
  - HTML: etiquetas, atributos por etiqueta, valores de atributos, fechamento de etiqueta e Emmet
    (`div.card>h2+p` vira o HTML completo).
 Cada sugestão: { label, kind, insert, detail?, doc?, color?, retrigger?, hits? }. Em `insert`, o caractere
 CARET (\u0001) marca onde o cursor fica depois de aceitar. Testado em tests/codeassist.test.js.
```

- **`CARET`** · [L18](../src/codeassist.js#L18) — Marca de onde o cursor fica dentro de um `insert` (o editor remove a marca ao inserir).
- **`fuzzyMatch(q, label)`** · [L26](../src/codeassist.js#L26) — Pontua `label` para a busca `q` (maior = melhor; -1 = não combina). Começo da palavra vale mais que meio, letras seguidas valem mais que espalhadas, e começo de pedaço (depois de - . : # @ espaço) ganha bônus: "jc" acha "justify-content". Devolve { score, hits } (hits = posições das letras que combinaram).
- **`rank(items, q, max = 60)`** · [L55](../src/codeassist.js#L55) — Filtra e ordena as sugestões pela busca (a ordem original desempata: as mais usadas vêm primeiro).
- **`COMMON_PROPS`** <sub>do módulo</sub> · [L70](../src/codeassist.js#L70) — Propriedades mais usadas (aparecem primeiro quando a busca está vazia ou empata).
- **`MORE_PROPS`** <sub>do módulo</sub> · [L79](../src/codeassist.js#L79) — Lista completa das propriedades CSS modernas (além das comuns acima).
- **`CSS_PROPERTIES`** · [L123](../src/codeassist.js#L123) — Todas as propriedades (comuns primeiro, depois o resto em ordem alfabética).
- **`PROP_DOC`** <sub>do módulo</sub> · [L126](../src/codeassist.js#L126) — Descrição curta (rodapé da lista) das propriedades mais usadas.
- **`CSS_VALUES`** · [L174](../src/codeassist.js#L174) — Valores (palavras-chave) sugeridos por propriedade.
- **`GLOBAL_VALUES`** <sub>do módulo</sub> · [L310](../src/codeassist.js#L310) — Valores que servem para qualquer propriedade.
- **`SINGLE`** <sub>do módulo</sub> · [L313](../src/codeassist.js#L313) — Propriedades de UM valor só: aceitar a sugestão já põe o ";" no fim da linha.
- **`NAMED_COLORS`** · [L323](../src/codeassist.js#L323) — As 148 cores com nome do CSS (+ transparent e currentColor).
- **`FN_DOC`** <sub>do módulo</sub> · [L338](../src/codeassist.js#L338) — Funções de CSS: nome → descrição curta.
- **`fnsFor(prop)`** <sub>do módulo</sub> · [L357](../src/codeassist.js#L357) — Funções sugeridas por "tipo" de propriedade.
- **`FN_ARGS`** <sub>do módulo</sub> · [L370](../src/codeassist.js#L370) — Sugestões DENTRO de uma função: nome da função → valores.
- **`COLOR_ARG_FNS`** <sub>do módulo</sub> · [L383](../src/codeassist.js#L383) — As funções que recebem cores entre os argumentos.
- **`unitsFor(prop)`** <sub>do módulo</sub> · [L394](../src/codeassist.js#L394) — Unidades possíveis para a propriedade (vazio = sem unidade).
- **`SELECTOR_TAGS`** <sub>do módulo</sub> · [L407](../src/codeassist.js#L407) — Etiquetas HTML mais usadas no CSS (seletores).
- **`PSEUDOS`** <sub>do módulo</sub> · [L411](../src/codeassist.js#L411) — Pseudo-classes e pseudo-elementos (o `()` indica que recebe argumento).
- **`AT_RULES`** <sub>do módulo</sub> · [L423](../src/codeassist.js#L423) — _(sem comentário)_
- **`MEDIA_FEATURES`** <sub>do módulo</sub> · [L436](../src/codeassist.js#L436) — Condições do @media (além das larguras dos breakpoints).
- **`scanCss(text, pos)`** · [L448](../src/codeassist.js#L448) — Lê o CSS até o cursor e diz onde ele está: { in: 'comment'|'string' } ou { stack: [cabeçalhos dos blocos abertos], stmt: texto desde o último { } ; , stmtStart }.
- **`blockKind(stack, decls)`** <sub>do módulo</sub> · [L476](../src/codeassist.js#L476) — Tipo do bloco onde o cursor está: 'decls' (propriedades), 'rules' (seletores/@regras) ou 'keyframes'.
- **`localVars(text)`** <sub>do módulo</sub> · [L486](../src/codeassist.js#L486) — Variáveis declaradas no próprio texto (`--nome: valor`), além das do documento.
- **`openFn(value)`** <sub>do módulo</sub> · [L493](../src/codeassist.js#L493) — Função aberta mais interna no valor (ex.: "repeat(auto-fill, " → "repeat"), ou ''.
- **`varItems(vars, { bare = false } = {})`** <sub>do módulo</sub> · [L505](../src/codeassist.js#L505) — Itens de variáveis: { name: '--cor-x', value, kind: 'color'|'size' } → var(--x).
- **`fnItem(name)`** <sub>do módulo</sub> · [L514](../src/codeassist.js#L514) — Itens de função: "calc()" com o cursor dentro dos parênteses.
- **`completeCss(text, pos, opts = {})`** · [L525](../src/codeassist.js#L525) — SUGESTÕES DE CSS para o cursor em `pos`.
  - `text` <sub>string</sub> — todo o texto do editor
  - `pos` <sub>number</sub> — posição do cursor
  - `[]` <sub>{ decls?: boolean, manual?: boolean, vars?: {name:string,value:string,kind:string,label?:string</sub> — , classes?: string[], ids?: string[], breakpoints?: {name:string,max:number}[], colors?: {name:string,value:string}[] }} [opts] decls = o texto é só uma lista de declarações (CSS da camada) · manual = Ctrl+Espaço (mostra mesmo sem nada digitado)
  - ↩︎ `{ from: number, to: number, items: object[], context: string ` \| null}
- **`HTML_TAGS`** · [L655](../src/codeassist.js#L655) — Etiquetas HTML: nome → descrição curta.
- **`VOID_TAGS`** · [L673](../src/codeassist.js#L673) — Etiquetas que não têm fechamento.
- **`INLINE_TAGS`** <sub>do módulo</sub> · [L675](../src/codeassist.js#L675) — Etiquetas "de linha" (no Emmet, ficam na mesma linha do pai).
- **`GLOBAL_ATTRS`** <sub>do módulo</sub> · [L677](../src/codeassist.js#L677) — Atributos que valem em qualquer etiqueta.
- **`TAG_ATTRS`** <sub>do módulo</sub> · [L683](../src/codeassist.js#L683) — Atributos próprios de cada etiqueta.
- **`BOOLEAN_ATTRS`** <sub>do módulo</sub> · [L695](../src/codeassist.js#L695) — Atributos sem valor (só o nome).
- **`ATTR_VALUES`** <sub>do módulo</sub> · [L698](../src/codeassist.js#L698) — Valores de atributos comuns: "etiqueta.atributo" ou só "atributo".
- **`openTags(text)`** · [L713](../src/codeassist.js#L713) — Pilha das etiquetas abertas (e não fechadas) no HTML até `pos` — a última é a que um "</" deve fechar.
- **`completeHtml(text, pos, opts = {})`** · [L733](../src/codeassist.js#L733) — SUGESTÕES DE HTML para o cursor em `pos`: etiquetas (depois de "<"), fechamento ("</"), atributos (dentro da etiqueta), valores de atributos (entre aspas, inclusive as classes do projeto em class="") e, no texto, etiquetas e abreviações Emmet.
  - `text` <sub>string</sub> — 
  - `pos` <sub>number</sub> — 
  - ↩︎ `{ from: number, to: number, items: object[], context: string ` \| null}
- **`emmetAbbrBefore(lineBefore)`** · [L820](../src/codeassist.js#L820) — Pega a abreviação Emmet logo antes do cursor (ex.: "  ul>li.item*3" → "ul>li.item*3"). Para no espaço (fora de [] e {}) e no fim da última etiqueta HTML da linha. Devolve '' se não houver.
- **`parseEmmet(src)`** · [L837](../src/codeassist.js#L837) — Lê a abreviação e monta a árvore: [{ tag, id, classes, attrs, text, children, count, group }]. Lança erro se inválida.
- **`implicitTag(parent)`** <sub>do módulo</sub> · [L905](../src/codeassist.js#L905) — Etiqueta implícita (quando a abreviação começa com . ou #): li dentro de ul/ol, td em tr, span em linha...
- **`DEFAULT_ATTRS`** <sub>do módulo</sub> · [L914](../src/codeassist.js#L914) — Atributos que já vêm por padrão em algumas etiquetas.
- **`expandEmmet(abbr)`** · [L922](../src/codeassist.js#L922) — EXPANDE uma abreviação Emmet em HTML indentado (2 espaços). Suporta etiqueta, .classe, #id, [atributos], {texto}, > (filho), + (irmão), ^ (sobe), *N (repete) com $ numerando, e (grupos). O cursor (CARET) fica no primeiro lugar vazio. Devolve '' se a abreviação for inválida.

    expandEmmet('div.card>h2+p') → '<div class="card">\n  <h2>⁁</h2>\n  <p></p>\n</div>'

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

- **`createCommands(store, canvas)`** · [L31](../src/commands.js#L31) — Cria os COMANDOS de edição: operações que mudam a ÁRVORE de camadas ou várias camadas de uma vez (excluir, duplicar, copiar/colar, agrupar, ordem z, auto layout, alinhar, distribuir, componentes, máscara, guias, vetores, imagens). É chamado por atalhos de teclado (tools.js), menus (menus.js) e painéis (ui/*.js), então a lógica fica em UM lugar só.

  Padrão de todo comando: (1) descobre as camadas-alvo, (2) `store.update(...)` aplica a mudança, (3) ajusta a
  seleção, (4) `store.commit()` grava no histórico (um desfazer desfaz o comando inteiro).
  - `store` <sub>object</sub> — 
  - `canvas` <sub>object</sub> — precisa da geometria do DOM (posições reais em auto layout)
- **`topSelection()`** <sub>interna</sub> · [L39](../src/commands.js#L39) — Seleção "de topo": camadas selecionadas que NÃO têm um ancestral também selecionado. Se você seleciona um frame e um filho dele, mover/duplicar/excluir deve agir só no frame (o filho vai junto).
- **`parentOrigin(parent)`** <sub>interna</sub> · [L48](../src/commands.js#L48) — Origem (canto superior esquerdo, no mundo) do pai; (0,0) quando a camada está na raiz da página.
- **`freezePositions(nodes, parent)`** <sub>interna</sub> · [L55](../src/commands.js#L55) — "Congela" a posição VISUAL atual como x/y. Em auto layout x/y do modelo são ignorados (o navegador posiciona), então, antes de uma camada sair do fluxo (agrupar, desligar auto layout...), lemos onde ela está no DOM e gravamos em x/y — assim nada "pula" de lugar.
- **`deleteSelection()`** <sub>interna</sub> · [L66](../src/commands.js#L66) — Exclui as camadas selecionadas (e tudo dentro delas).
- **`duplicate()`** <sub>interna</sub> · [L81](../src/commands.js#L81) — Duplica a seleção logo acima do original, deslocada 20px (em auto layout entra no fluxo, sem deslocar).
- **`copy()`** <sub>interna</sub> · [L106](../src/commands.js#L106) — Copia a seleção para a área de transferência INTERNA do app (ui.clipboard). Guardamos uma cópia JSON, assim ela sobrevive mesmo que o original seja editado/apagado depois. Devolve false se não havia nada selecionado.
- **`cut()`** <sub>interna</sub> · [L118](../src/commands.js#L118) — Recortar = copiar + excluir.
- **`paste()`** <sub>interna</sub> · [L128](../src/commands.js#L128) — Cola o que está na área de transferência interna.

   - Com UM frame selecionado (que não seja o próprio copiado): cola DENTRO dele, mantendo a posição se couber
     ou centralizando se não couber.
   - Caso contrário: cola no mesmo pai de onde foi copiado, deslocando 16px a cada colagem seguida.
- **`setSelectionBox({ x, y, w, h })`** <sub>interna</sub> · [L171](../src/commands.js#L171) — Move e/ou redimensiona várias camadas como UM conjunto, pelos campos X/Y/W/H do painel. Cada campo é opcional. Mudar W/H escala cada camada e a distância dela até a borda do conjunto (como esticar a caixa de seleção). Camadas dentro de auto layout só mudam de tamanho (a posição é do navegador). `structural:false`: só números mudam, o índice do store continua válido (mais rápido).
- **`STYLE_KEYS`** <sub>interna</sub> · [L199](../src/commands.js#L199) — "Copiar propriedades" (Ctrl+Alt+C / Ctrl+Alt+V), como "copiar formato" do Word: leva só a APARÊNCIA (preenchimento, contorno, cantos, sombras, blur, opacidade, mesclagem) e, se a origem é texto, também a tipografia.
- **`copyStyle()`** <sub>interna</sub> · [L203](../src/commands.js#L203) — Guarda a aparência da 1ª camada selecionada em ui.styleClipboard.
- **`pasteStyle()`** <sub>interna</sub> · [L216](../src/commands.js#L216) — Aplica a aparência guardada a todas as camadas selecionadas, ignorando o que não faz sentido para o tipo do destino (ex.: tipografia em retângulo, cantos em elipse/texto, fill em grupo).
- **`group()`** <sub>interna</sub> · [L240](../src/commands.js#L240) — Agrupa as camadas selecionadas (Ctrl+G). Só agrupa irmãs do MESMO pai (a 1ª selecionada manda). O grupo entra na posição da camada mais alta e os filhos mantêm a ordem z. Antes, congela as posições (ver freezePositions). A caixa do grupo é calculada depois, no commit, por fitGroups.
- **`ungroup()`** <sub>interna</sub> · [L263](../src/commands.js#L263) — Desagrupa (Ctrl+Shift+G): os filhos sobem um nível, no lugar do grupo, mantendo a posição visual (somamos x/y do grupo). Funciona em grupos e em frames comuns; componentes/instâncias são ignorados.
- **`reorder(mode)`** <sub>interna</sub> · [L290](../src/commands.js#L290) — Muda a ordem z (quem fica na frente). A ordem do array É a ordem de desenho: o último é o que fica por cima.
  - `mode` <sub>'front'\|'back'\|'forward'\|'backward'</sub> — frente / fundo / um passo à frente / um passo atrás
- **`enableAutoLayout(frame)`** <sub>interna</sub> · [L324](../src/commands.js#L324) — Liga o auto layout num frame que tinha filhos livres, DEDUZINDO a configuração a partir de onde eles estão, para nada "pular" de lugar:

   - direção: filhos espalhados mais na horizontal → 'row'; senão 'column'. Um filho só: frame alto (ex.: uma
     sidebar) → 'column'; largo → 'row';
   - gap: média dos vãos entre filhos consecutivos;
   - padding: distância entre os filhos e as bordas. Mas se o conteúdo está encostado no início e sobra MUITO
     espaço no fim (ex.: um item no topo de uma sidebar), essa sobra é espaço livre, não margem: o padding do fim
     fica igual ao do início (senão um padding-bottom de 500px espremeria os próximos itens);
   - alinhamento: conteúdo centralizado no frame → 'center'; encostado no fim → 'flex-end'. No eixo cruzado, com
     vários filhos, olha se eles estavam alinhados pelo início, pelo centro ou pelo fim.
  Também reordena os filhos na ordem em que aparecem na tela, e tira o "absoluto" de todos.
- **`disableAutoLayout(frame)`** <sub>interna</sub> · [L372](../src/commands.js#L372) — Desliga o auto layout congelando as posições atuais (nada muda visualmente).
- **`setLayoutMode(frames, mode)`** <sub>interna</sub> · [L382](../src/commands.js#L382) — Troca o modo do layout (none | row | column | grid). Ao LIGAR numa frame livre, deduz a configuração (enableAutoLayout); ao DESLIGAR, congela as posições. Em grid, sugere um nº de colunas pela raiz da qtd de filhos. Chamado de dentro de `store.update`, por isso não faz commit.
- **`toggleAutoLayout()`** <sub>interna</sub> · [L412](../src/commands.js#L412) — Shift+A — "Adicionar auto layout", tentando entender a INTENÇÃO (como no Figma), em vez de só embrulhar:

   - FRAME selecionado → liga/desliga o auto layout dele;
   - um RETÂNGULO sozinho → ele VIRA um frame com auto layout (mesma cor, cantos, contorno, sombra e id), pronto
     para receber camadas. Embrulhar um retângulo num frame não serviria para nada: retângulo não tem filhos;
   - um GRUPO → o grupo vira o frame (os filhos dele são os itens do layout);
   - várias camadas → um frame novo envolve todas. Se a camada MAIS AO FUNDO for um retângulo que contém todas as
     outras (ex.: o fundo de uma sidebar com itens em cima), ele vira o FUNDO do frame em vez de mais um item —
     senão o auto layout colocaria o fundo e os itens lado a lado. Sem fundo, o frame abraça o conteúdo (hug).
- **`frameFrom(r, props)`** <sub>interna</sub> · [L425](../src/commands.js#L425) — Frame com a APARÊNCIA de um retângulo (para o retângulo "virar" o frame).
- **`shift(node, dx, dy)`** <sub>interna</sub> · [L485](../src/commands.js#L485) — Soma dx/dy à posição x/y da camada (arredondando).
- **`align(kind)`** <sub>interna</sub> · [L495](../src/commands.js#L495) — Alinha a seleção. Com UMA camada, alinha dentro do pai; com várias, alinha entre si (pela caixa do conjunto). Camadas em auto layout são ignoradas (o navegador decide a posição delas).
  - `kind` <sub>'left'\|'hcenter'\|'right'\|'top'\|'vcenter'\|'bottom'</sub> — 
- **`distribute(axis)`** <sub>interna</sub> · [L526](../src/commands.js#L526) — Distribui 3+ camadas com vãos IGUAIS entre elas, mantendo a primeira e a última no lugar.
  - `axis` <sub>'h'\|'v'</sub> — horizontal ou vertical
- **`reparent(nodes, newParent, index = null)`** <sub>interna</sub> · [L559](../src/commands.js#L559) — Move camadas para outro pai (ou para a raiz da página) MANTENDO a posição visual: lê a origem de cada uma no DOM antes e recalcula x/y relativo ao novo pai. Usado ao arrastar para dentro de frames e no arrastar da lista de camadas. Não deixa mover uma camada para dentro de si mesma/de um descendente.
  - `nodes` <sub>object[]</sub> — camadas a mover
  - `newParent` <sub>object\|null</sub> — novo pai (null = raiz)
  - `[index]` <sub>number\|null</sub> — posição na lista do novo pai (null = no topo)
- **`importAsset(file)`** <sub>interna</sub> · [L587](../src/commands.js#L587) — Lê o arquivo de imagem (reduzindo se for grande), guarda em doc.assets e devolve { assetId, w, h }.
- **`addImageFiles(files, at)`** <sub>interna</sub> · [L599](../src/commands.js#L599) — Cria uma camada-retângulo com preenchimento de imagem para cada arquivo (botão, arrastar, colar). A imagem é reduzida para caber em 520px de maior lado e fica centralizada na posição `at` (ou no centro da vista).
  - ↩︎ `Promise<boolean>` true se criou alguma camada
- **`insertImageAsset(assetId, at, { parentId = null, index, name } = {})`** <sub>interna</sub> · [L636](../src/commands.js#L636) — Reutiliza uma imagem já importada no projeto, sem duplicar seu data URL.
- **`notify(msg)`** <sub>interna</sub> · [L681](../src/commands.js#L681) — Mostra um aviso ao usuário (main.js liga em `commands.notify = toast`).
- **`placeNew(node, at)`** <sub>interna</sub> · [L687](../src/commands.js#L687) — Insere uma camada NOVA já pronta: dentro do frame selecionado (centralizada nele; se o frame tem auto layout, ela entra no fluxo) ou na raiz da página, centralizada em `at` (mundo) ou no meio da tela. Seleciona e grava.
- **`insertSvg(text, { at, name, currentColor, fill, size } = {})`** <sub>interna</sub> · [L714](../src/commands.js#L714) — Importa um SVG (texto) como vetores editáveis e insere (ver placeNew). Avisa O QUE do SVG ficou de fora (ex.: "sombra interna, máscara"). Lança erro se o texto não for um SVG com formas.
  - `text` <sub>string</sub> — 
- **`addHtmlEmbed(at)`** <sub>interna</sub> · [L725](../src/commands.js#L725) — Cria uma camada "Código HTML" (HTML escrito à mão, ver html.js → sanitizeHtml) no frame selecionado ou no meio da tela e abre a aba Código já no modo de edição do HTML.
- **`addText(textValue, at)`** <sub>interna</sub> · [L733](../src/commands.js#L733) — Cria uma camada de texto com o texto dado (usado ao colar texto do sistema no canvas).
- **`wrapInFrame(same, name)`** <sub>interna</sub> · [L749](../src/commands.js#L749) — Envolve camadas irmãs num frame novo (sem layout, sem preenchimento) do tamanho do conjunto. Base de "Envolver em frame", "Criar componente" de vários itens e "Auto layout" de vários itens. Deve ser chamada dentro de `store.update`.
- **`sameLevel(nodes)`** <sub>interna</sub> · [L765](../src/commands.js#L765) — Filtra a seleção para as camadas que estão na mesma lista que a primeira (irmãs), ordenadas pela ordem z.
- **`createComponent()`** <sub>interna</sub> · [L774](../src/commands.js#L774) — Ctrl+Alt+K: transforma a seleção em COMPONENTE PRINCIPAL. Várias camadas (ou texto/linha soltos) são primeiro envolvidas num frame, porque componente precisa de uma raiz.
- **`insertInstance(mainId, at)`** <sub>interna</sub> · [L795](../src/commands.js#L795) — Cria uma INSTÂNCIA de um componente. Sem posição dada, entra ao lado do principal; com `at`, centralizada ali (usado ao clicar no componente na aba Recursos).
  - `mainId` <sub>string</sub> — id do componente principal
- **`detach()`** <sub>interna</sub> · [L816](../src/commands.js#L816) — Ctrl+Alt+B: desanexa as instâncias selecionadas (viram camadas comuns).
- **`goToMain(id)`** <sub>interna</sub> · [L823](../src/commands.js#L823) — "Ir ao principal": abre a página do componente principal, seleciona e enquadra.
- **`toggleMask()`** <sub>interna</sub> · [L838](../src/commands.js#L838) — Ctrl+Alt+M: máscara. Com várias camadas: agrupa e usa a de baixo como máscara (recorta as outras, via clip-path). Com uma camada que já está num grupo: liga/desliga o papel de máscara dela.
- **`flip(axis)`** <sub>interna</sub> · [L853](../src/commands.js#L853) — Espelha as camadas selecionadas na horizontal ('x') ou vertical ('y').
- **`addColorStyle(node, name)`** <sub>interna</sub> · [L862](../src/commands.js#L862) — Cria um estilo de cor compartilhado a partir do preenchimento de uma camada e já liga a camada a ele.
- **`addColorStyles(items)`** <sub>interna</sub> · [L870](../src/commands.js#L870) — Cria vários estilos de cor de uma vez (ex.: a partir de uma paleta): [{ name, color }]. Um único passo de desfazer.
- **`addColorMode({ name, scheme = null, auto = false })`** <sub>interna</sub> · [L876](../src/commands.js#L876) — Cria um modo de cor (escuro...) e já o mostra no canvas. `auto`: gera os valores invertendo a luminosidade.
- **`renameColorMode(id, name)`** <sub>interna</sub> · [L883](../src/commands.js#L883) — Muda o nome de um modo de cor (o atributo data-theme no CSS acompanha).
- **`setModeScheme(id, scheme)`** <sub>interna</sub> · [L890](../src/commands.js#L890) — Define se o modo vale sozinho pela preferência do sistema ('dark' | 'light' | null = só com data-theme).
- **`deleteColorMode(id)`** <sub>interna</sub> · [L897](../src/commands.js#L897) — Apaga um modo de cor (os valores dele nos estilos também).
- **`addSizeVar(name, value)`** <sub>interna</sub> · [L903](../src/commands.js#L903) — Cria uma variável de tamanho (espaçamento, raio, fonte).
- **`setSizeVar(id, patch)`** <sub>interna</sub> · [L909](../src/commands.js#L909) — Muda o valor de uma variável e leva o valor a todas as camadas ligadas a ela.
- **`deleteSizeVar(id)`** <sub>interna</sub> · [L918](../src/commands.js#L918) — Apaga uma variável (as camadas mantêm o valor que tinham).
- **`bindSizeVar(nodes, prop, v)`** <sub>interna</sub> · [L923](../src/commands.js#L923) — Liga (ou, com `v` nulo, desliga) um campo de várias camadas a uma variável de tamanho.
- **`addTextStyle(node, name)`** <sub>interna</sub> · [L928](../src/commands.js#L928) — Cria um estilo de texto compartilhado a partir da tipografia de uma camada e já liga a camada a ele.
- **`removeStyle(kind, id)`** <sub>interna</sub> · [L936](../src/commands.js#L936) — Apaga um estilo ('colors' ou 'texts'); as camadas ligadas mantêm os valores que tinham.
- **`guides()`** <sub>interna</sub> · [L945](../src/commands.js#L945) — Lista de guias da página atual (cria se não existir, para páginas de projetos antigos).
- **`addGuide(axis, pos)`** <sub>interna</sub> · [L947](../src/commands.js#L947) — Cria uma guia de régua. axis 'x' = linha vertical na posição x; 'y' = linha horizontal na posição y.
- **`removeGuide(i)`** <sub>interna</sub> · [L951](../src/commands.js#L951) — Remove a guia de índice `i`.
- **`addPathFromWorld(pts, closed, parent)`** <sub>interna</sub> · [L963](../src/commands.js#L963) — Cria uma camada-vetor a partir de pontos em coordenadas do MUNDO (o que a caneta coleta). Calcula a caixa que envolve o desenho (incluindo as curvas) e converte os pontos para o espaço local do vetor.
  - `[]` <sub>{x,y,hin?,hout?</sub> — } pts  pontos com alças opcionais
  - `closed` <sub>boolean</sub> — caminho fechado (ganha preenchimento cinza)
  - `parent` <sub>object\|null</sub> — frame onde inserir (null = raiz)
- **`updatePathFromWorld(id, pts, closed)`** <sub>interna</sub> · [L984](../src/commands.js#L984) — Atualiza um vetor EXISTENTE com novos pontos (em coordenadas do mundo): usado ao CONTINUAR um caminho aberto com a caneta. Como addPathFromWorld, recalcula a caixa; nome, cor e contorno do vetor continuam.
- **`newIcon(size = 24)`** <sub>interna</sub> · [L1007](../src/commands.js#L1007) — Cria um frame de ÍCONE (24×24 por padrão, fundo branco, cortando o que sai) no centro da vista, com a grade de 1px ligada, enquadra com zoom grande, liga o encaixe de 1px e deixa a caneta pronta. É o começo de "desenhar o meu SVG".
- **`normalizePath(node)`** <sub>interna</sub> · [L1031](../src/commands.js#L1031) — Reajusta a caixa do vetor depois de editar pontos: recalcula o retângulo que envolve o desenho e desloca os pontos/posição para a caixa "colar" no desenho. Pula se o vetor está girado (a conta ficaria imprecisa).
- **`addShapePath(kind, box, parent, sides = 5)`** <sub>interna</sub> · [L1056](../src/commands.js#L1056) — Cria um polígono regular (`sides` lados) ou estrela (pontas alternando raio 100% e 45%) já como vetor editável.
  - `kind` <sub>'polygon'\|'star'</sub> — 
- **`BOOL_TYPES`** <sub>interna</sub> · [L1073](../src/commands.js#L1073) — Tipos que entram numa operação booleana.
- **`worldContours(n)`** <sub>interna</sub> · [L1080](../src/commands.js#L1080) — Contornos de uma camada em coordenadas do MUNDO (rotação e espelhamento aplicados), ainda com curvas. Retângulo/frame (com cantos arredondados), elipse e vetor (com todos os contornos). Devolve { contours, rule }.
- **`booleanOp(op)`** <sub>interna</sub> · [L1109](../src/commands.js#L1109) — OPERAÇÃO BOOLEANA com a seleção (2+ vetores/retângulos/elipses/frames): 'union' unir, 'subtract' subtrair (a camada de BAIXO menos as de cima, como no Figma), 'intersect' interseção, 'exclude' excluir a sobreposição. As curvas são achatadas em polígonos (geom.js) e o resultado é reajustado em curvas onde era curvo: o vetor final pode ter alguns pontos a mais que o original. O resultado fica no lugar da camada de baixo, com o estilo dela.
  - ↩︎ `{node?: object, error?: string` }
- **`localBox(node)`** <sub>interna</sub> · [L1167](../src/commands.js#L1167) — Caixa da camada relativa ao PAI, medida no DOM (respeita flexbox/grid). Usada pela exportação SVG.
- **`frameSelection()`** <sub>interna</sub> · [L1176](../src/commands.js#L1176) — Ctrl+Alt+G: envolve a seleção num frame novo, sem layout.
- **`cssOf(nodes)`** <sub>interna</sub> · [L1187](../src/commands.js#L1187) — CSS (só o CSS, sem HTML) das camadas dadas — usado por "Copiar CSS".
- **`readImage(file)`** <sub>do módulo</sub> · [L1212](../src/commands.js#L1212) — Lê um arquivo de imagem e devolve { dataUrl, w, h }. Imagens grandes (>1600px ou >400KB) são redesenhadas num <canvas> menor: o projeto inteiro é regravado a cada mudança (navegador e pasta), então imagem enorme deixaria o salvamento lento e o .json gigante. PNG continua PNG (preserva transparência); o resto vira JPEG 88%.
- **`pathBounds(pts, closed = false)`** · [L1245](../src/commands.js#L1245) — Retângulo { x0, y0, x1, y1 } que envolve TODOS os pontos e também as curvas de Bézier (amostradas a cada 5%), já que uma curva pode "sair" para fora dos pontos de ancoragem.
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

- **`px(v)`** <sub>do módulo</sub> · [L31](../src/css.js#L31) — Formata um número como pixels CSS, arredondado: px(10.004) → "10px".
- **`GRID_ALIGN`** <sub>do módulo</sub> · [L37](../src/css.js#L37) — Tradução dos valores de alinhamento do flexbox (usados no modelo, ex. 'flex-start') para os do CSS Grid ('start'). O grid não aceita 'flex-start' em justify-items/align-items. 'auto' (ou valor desconhecido) fica de fora: o item herda o alinhamento do grid pai.
- **`hexToRgb(hex)`** · [L43](../src/css.js#L43) — Converte uma cor hexadecimal ("#RGB" ou "#RRGGBB") em { r, g, b } (0..255). Entrada inválida vira preto em vez de lançar erro, para o app nunca travar por causa de uma cor ruim.
- **`rgba(hex, a = 1)`** · [L56](../src/css.js#L56) — Monta a cor CSS final. Opacidade total (>= 1) devolve o hex curto "#rrggbb"; menor que 1 devolve "rgba(r, g, b, a)". Assim o código gerado fica o mais limpo possível.
  - `hex` <sub>string</sub> — cor base
  - `[a=1]` <sub>number</sub> — opacidade 0..1
- **`stopsCss(stops)`** <sub>do módulo</sub> · [L63](../src/css.js#L63) — Lista de paradas de gradiente em CSS, ordenada por posição: "#7c5cff 0%, #2dd4ff 100%".
- **`fillCss(fill, assets = {})`** · [L80](../src/css.js#L80) — Propriedades CSS de um PREENCHIMENTO (fill). Devolve um objeto { propriedade: valor }.

   - solid  → background-color
   - linear → background-image: linear-gradient(...)
   - radial → background-image: radial-gradient(...)
   - conic  → background-image: conic-gradient(from Ndeg, ...)
   - image  → background-image: url(data:...) + size/position/repeat (se a imagem não existir mais, cinza neutro)
   - none   → nada
  - `fill` <sub>object</sub> — preenchimento (ver model.js → defaultFill)
  - `[assets]` <sub>Object<string,string></sub> — doc.assets: id → data URL das imagens
- **`splitFontFamilies(value)`** <sub>do módulo</sub> · [L114](../src/css.js#L114) — Separa a lista CSS respeitando vírgulas dentro de nomes entre aspas.
- **`fontStack(family)`** <sub>do módulo</sub> · [L130](../src/css.js#L130) — Monta uma pilha de fontes com fallback sem deixar dados importados escaparem da string CSS.
- **`nodeStyle(node, parent, assets = {}, opts = {})`** · [L155](../src/css.js#L155) — ★ O CORAÇÃO DO PROJETO ★ — converte UMA camada em CSS. O mesmo resultado é usado em 3 lugares: (1) o canvas (cada camada é um elemento com este estilo), (2) o painel "Código" e (3) a exportação HTML/PNG. Por isso o que você vê no editor é o que o navegador renderiza de verdade.
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai (decide se a camada está em fluxo de flex/grid ou é absoluta)
  - `[assets]` <sub>Object<string,string></sub> — imagens do documento
  - ↩︎ `Object<string,string>` propriedades CSS em ordem de inserção (kebab-case)
- **`overflowCss(node, s, opts = {})`** <sub>do módulo</sub> · [L401](../src/css.js#L401) — Overflow do frame. Altera `s` diretamente. `opts.editor` = desenho do CANVAS: as variações de rolagem viram "cortar", porque barras de rolagem dentro do canvas atrapalhariam o editor (a rolagem de verdade vale na apresentação e no código exportado).
- **`marginCss(node, s)`** <sub>do módulo</sub> · [L413](../src/css.js#L413) — Margem de um item EM FLUXO (flex/grid): atalho `margin` com 1 valor (todos iguais) ou 4 (topo direita baixo esquerda). Só aparece quando algum lado não é zero. Altera `s` diretamente. Camadas livres (position:absolute) não usam margem: a posição delas já é o left/top.
- **`COLOR_FILTERS`** <sub>do módulo</sub> · [L420](../src/css.js#L420) — Funções de filtro de COR da camada, na ordem do CSS, só as que fogem do padrão: brightness, contrast, saturate, grayscale, hue-rotate.
- **`colorFilters(node)`** · [L421](../src/css.js#L421) — _(sem comentário)_
- **`truncateCss(node, s)`** <sub>do módulo</sub> · [L437](../src/css.js#L437) — Truncar texto (campo `truncate`). Altera `s` diretamente; vale DEPOIS do alinhamento vertical e do white-space.

   - 'ellipsis': uma linha só, o que não cabe vira "…"  → white-space:nowrap + overflow:hidden + text-overflow:ellipsis
   - 'clamp': no máximo `lines` linhas, com "…" no fim → display:-webkit-box + -webkit-line-clamp (e line-clamp)
  Os dois precisam de uma LARGURA (fixa ou máxima) para saber onde cortar. O alinhamento vertical por grid
  (centro/fim) é desligado, porque o grid e o -webkit-box/ellipsis não funcionam juntos.
- **`sizeLimitsCss(node, s)`** <sub>do módulo</sub> · [L462](../src/css.js#L462) — Limites de tamanho e proporção da camada. Altera `s` diretamente. Ficam DEPOIS do tamanho, então `min-width` substitui o `min-width: 0` que o item "fill" de um flex escreve sozinho.

   - min-/max-width/height: só aparecem quando o usuário define (campos minW, maxW, minH, maxH).
   - aspect-ratio: só quando ALGUMA medida é flexível (hug/fill). A medida fixa vira `auto` no eixo oposto para a
     proporção valer (com as duas fixas o CSS ignoraria o aspect-ratio, e quem mantém a proporção é o editor).
- **`parseCustomCss(text)`** · [L488](../src/css.js#L488) — Lê o "CSS livre" de uma camada ("propriedade: valor;" por linha) e devolve só as declarações seguras: nome de propriedade válido (ou variável --x) e valor sem chaves, sinais de tag nem "@". Linhas ruins são ignoradas.
  - `text` <sub>string</sub> — 
  - ↩︎ `Record<string, string>`
- **`transformOf(node)`** · [L501](../src/css.js#L501) — _(sem comentário)_
- **`lineStyle(node, s, flow)`** <sub>do módulo</sub> · [L516](../src/css.js#L516) — Estilo da LINHA. Em vez de border ou SVG, a linha é uma caixa de ≥12px de altura com um `background` que desenha uma barra de `stroke.width` px no meio: sólida (linear-gradient), tracejada (gradiente repetido) ou pontilhada (radial-gradient repetido). Os 12px de altura só existem para facilitar clicar nela. Altera `s` diretamente.
- **`hasStrokeSides(node)`** · [L548](../src/css.js#L548) — A camada usa contorno POR LADO? (`stroke.sides` = [cima, direita, baixo, esquerda] em px). Só retângulos, frames e grupos de imagem — em elipse, texto e vetor "lado" não faz sentido.
- **`num(n)`** <sub>do módulo</sub> · [L553](../src/css.js#L553) — Arredonda para 2 casas (coordenadas de SVG).
- **`pathData(points, closed, tx = (x) => x, ty = (y) => y)`** · [L563](../src/css.js#L563) — Gera o atributo `d` de um <path> SVG a partir dos pontos do vetor. Segmento reto quando nenhum dos dois pontos tem alça (comando L); curva de Bézier cúbica quando algum tem (C).
  - `[]` <sub>{x:number,y:number,hin?:object,hout?:object</sub> — } points  pontos; hin/hout = alças de entrada/saída
  - `closed` <sub>boolean</sub> — fecha o caminho com Z (liga o último ao primeiro)
  - `[tx]` <sub>(x:number)=>number</sub> — transformação opcional de x (usada pelo clip-path e pelo SVG exportado)
  - `[ty]` <sub>(y:number)=>number</sub> — idem para y
- **`nodePathData(node, tx, ty)`** · [L585](../src/css.js#L585) — `d` COMPLETO de um vetor: o contorno principal (`points`) + os contornos extras (`contours`), se houver. Contornos extras existem em desenhos importados de SVG (ícones com "furos", letras como "o", várias formas num só vetor). A regra de preenchimento (`fillRule`: 'nonzero' | 'evenodd') decide o que vira furo.
  - `node` <sub>object</sub> — camada do tipo 'path'
  - `[tx]` <sub>(x:number)=>number</sub> — 
  - `[ty]` <sub>(y:number)=>number</sub> — 
- **`svgPaint(fill, id, assets)`** <sub>do módulo</sub> · [L599](../src/css.js#L599) — Preenchimento de um vetor em SVG. Gradientes precisam de uma definição (<linearGradient>) referenciada por url(#id); devolve { paint (valor do atributo fill), defs (markup das definições), opacity }. O ângulo CSS (0° = para cima) é convertido em x1,y1→x2,y2 do SVG (0..1).
- **`pathSvg(node, assets = {})`** · [L626](../src/css.js#L626) — Markup <svg> de um nó `path` (usado no canvas, no HTML exportado e no modo apresentar).

   - preserveAspectRatio="none": o desenho estica junto com a caixa da camada.
   - vector-effect="non-scaling-stroke": a espessura do traço NÃO muda ao esticar.
   - 2º <path> transparente e grosso (stroke-width 12): serve só de "área de clique" para linhas finas.
- **`strokeAlign(node)`** · [L662](../src/css.js#L662) — Onde fica o contorno de um VETOR: 'center' (padrão), 'inside' ou 'outside' (`stroke.align`). Dentro/fora só valem em caminho fechado; num caminho aberto o traço é sempre centrado. (Retângulos e frames usam `stroke.position`.)
- **`dashAttr(st, w = st?.width)`** · [L672](../src/css.js#L672) — `stroke-dasharray` do contorno: o tracejado PERSONALIZADO (`stroke.dash`, ex.: "8 4" ou "12 4 2 4") tem prioridade; senão, o estilo tracejado/pontilhado gera um padrão proporcional à espessura. Devolve o atributo (com espaço) ou ''.
- **`dashList(text)`** · [L679](../src/css.js#L679) — "8, 4 px" → "8 4" (só números ≥ 0; vazio ou tudo zero → '').
- **`maskClip(group)`** · [L689](../src/css.js#L689) — Converte a camada marcada como máscara (`isMask`) do grupo em um `clip-path` CSS: elipse → ellipse(), vetor → path(), retângulo → inset() (com cantos arredondados se houver). Devolve '' se o grupo não tem máscara.
- **`toCssText(style)`** · [L706](../src/css.js#L706) — Objeto de estilo → texto para `element.style.cssText` ("a:1;b:2").
- **`cssRule(selector, style, indent = '')`** · [L712](../src/css.js#L712) — Objeto de estilo → regra CSS legível com uma propriedade por linha (usada no painel Código e no HTML exportado).
- **`stateStyle(node, parent, assets, opts, states)`** · [L728](../src/css.js#L728) — CSS de UM estado, só com o que MUDA em relação ao normal (é o que vai dentro de `.botao:hover { ... }`). Propriedade que existia no normal e sumiu no estado vira `unset` (volta ao padrão do CSS: sem sombra, sem filtro, sem fundo...).
  - `node` <sub>object</sub> — 
  - `parent` <sub>object\|null</sub> — 
  - `assets` <sub>object</sub> — 
  - `states` <sub>string\|string[]</sub> — 'hover' \| 'active' \| 'focus' (ou lista, em ordem de cascata)
- **`pathStateStyle(node, assets, state)`** · [L742](../src/css.js#L742) — Estilo de um ESTADO (hover, pressionado, foco) para o desenho DENTRO do <svg> de um vetor: o que o estado muda no preenchimento e no contorno (cor, opacidade, espessura). Vira `.classe:hover path[data-vis] { fill: ...; stroke: ... }`. Gradientes e imagens não entram (precisariam de outra definição no <svg>); a cor sólida e o contorno, sim.
- **`makeClassNamer()`** <sub>do módulo</sub> · [L765](../src/css.js#L765) — Cria um gerador de nomes de classe únicos a partir do nome da camada: "Botão" → "botao", e a segunda camada com o mesmo nome vira "botao-2". Um gerador novo por exportação garante nomes estáveis e sem colisão.
- **`classNamesOf(roots)`** · [L779](../src/css.js#L779) — Classe que cada camada recebe no código exportado (id → classe), como o generateCode faz quando cada raiz da lista é exportada sozinha (ex.: cada tela da página). Usado pelo canvas para o CSS da página valer no editor.
- **`withPageCss(css, styles)`** · [L790](../src/css.js#L790) — Junta o CSS DA PÁGINA (doc.styles.pageCss, já limpo) depois das regras das camadas: assim ele vence na cascata.
- **`noteComment(node)`** · [L796](../src/css.js#L796) — Texto da nota da camada pronto para virar comentário de HTML ou CSS (uma linha, sem "--" nem "*\/" que fechariam o comentário); '' se não vai ao código.
- **`escapeHtml(s)`** <sub>do módulo</sub> · [L802](../src/css.js#L802) — Escapa & < > " para que texto digitado pelo usuário nunca vire HTML/atributo no código exportado.
- **`generateCode(nodes, parent, assets = {}, { root = false, styles = null, ids = fa…)`** · [L813](../src/css.js#L813) — Gera { html, css } legíveis para uma lista de camadas: uma <div> (ou <p> para texto) por camada, cada uma com uma classe própria, e uma regra CSS por classe. Camadas ocultas não entram.
  - `nodes` <sub>object[]</sub> — camadas irmãs a exportar
  - `parent` <sub>object\|null</sub> — pai delas (define se são itens de flex/grid)
  - `[assets]` <sub>object</sub> — imagens do documento
- **`colorVarNames(styles)`** · [L954](../src/css.js#L954) — Nomes das variáveis de CSS dos ESTILOS DE COR do documento: id do estilo → "--cor-nome" (nome sem acento, em minúsculas, com hífens; nomes repetidos ganham -2, -3...). Vazio se não há estilos.
- **`docCssVars(styles)`** · [L971](../src/css.js#L971) — Variáveis CSS do projeto, na ordem: estilos de cor (--cor-x) e variáveis de tamanho (--espaco-md). Cada uma: { name, value, kind: 'color'|'size', label, hex? }. Usado pelo autocompletar do editor de código e pelo canvas (que as define no mundo, para `var(--cor-x)` escrito à mão valer no editor também).
- **`joinCss(parts)`** · [L988](../src/css.js#L988) — Junta o CSS de várias chamadas de generateCode e escreve UM bloco `:root { --cor-x: ...; }` no topo com as variáveis usadas por elas. Sem variáveis, devolve só as regras.
  - `[]` <sub>{css: string, tokens?: [string, string][]</sub> — } parts
- **`EXPORT_RESET`** · [L1018](../src/css.js#L1018) — "Zera" os estilos que o NAVEGADOR dá sozinho a cada etiqueta. O editor desenha tudo com <div>, que não tem estilo próprio; no HTML exportado, porém, <ul> ganha recuo de 40px e marcadores, <button> ganha borda, fundo e texto centralizado, <a> fica azul e sublinhado, <h1> fica maior... Sem este bloco o site exportado ficava diferente do que o editor mostra. As regras das camadas (por classe) vêm depois e vencem estas.
- **`exportHtml(node, assets, title = 'Design', styles = null, { ids = false } = {})`** · [L1032](../src/css.js#L1032) — Documento HTML COMPLETO e independente (um único arquivo, sem dependências) com a camada e seus filhos. Abre direto no navegador; o CSS fica num <style> no <head>.

---

## src/cssedit.js

**CSS DA CAMADA EDITADO À MÃO (aba Código → CSS → Editar)** · [abrir o código](../src/cssedit.js)

```text
 A pessoa edita as declarações que a camada gera (o mesmo CSS da exportação) e aplica. Como o desenho é guardado
 em campos do modelo (w, fill, radius...) e não em CSS, a aplicação funciona em 3 passos:
  1. MAPEIA o que dá para virar campo do modelo (largura/altura em px, posição, cor sólida, raio, opacidade,
     fonte, gap/padding do auto layout...). Assim o painel Design continua mostrando o valor certo;
  2. tudo o que não é mapeável vai para o CSS LIVRE da camada (node.customCss), que vem por último no CSS gerado e
     vence. Declarações APAGADAS que o desenho ainda gera viram `propriedade: unset` no CSS livre;
  3. só guarda no CSS livre o que difere do que o modelo já gera (nada de duplicar).
 Função PURA: muda o nó recebido (chame dentro de store.update) e devolve o relatório. Testada em tests/codigo.test.js.
```

- **`parseColor(v)`** · [L30](../src/cssedit.js#L30) — Cor CSS (#rgb, #rrggbb, #rrggbbaa, rgb()/rgba()) → { color: '#RRGGBB', opacity }; null se for outro formato.
- **`MAPPERS`** <sub>do módulo</sub> · [L53](../src/cssedit.js#L53) — Propriedades que viram campo do modelo: set(node, valor, ctx) devolve true se conseguiu. ctx = { before } (o CSS que a camada gerava antes).
- **`declarationsText(text)`** · [L131](../src/cssedit.js#L131) — Tira o "seletor { }" se a pessoa colou a regra inteira: fica só o que está dentro da 1ª chave.
- **`lintLayerCss(text, supports)`** · [L148](../src/cssedit.js#L148) — Confere o texto do editor de CSS da camada. `supports` = CSS.supports do navegador (opcional).
  - ↩︎ `{line:number, level:'error'\|'warn', msg:string` []}  linhas a partir de 1
- **`applyLayerCss(node, parent, assets, text)`** · [L164](../src/cssedit.js#L164) — Aplica o CSS editado na camada (muda `node`). Ver o topo do arquivo.
  - `node` <sub>object</sub> — 
  - `parent` <sub>object\|null</sub> — 
  - `assets` <sub>object</sub> — 
  - `text` <sub>string</sub> — declarações ("prop: valor;" por linha) ou a regra inteira
  - ↩︎ `{ mapped: string[], custom: string[], unset: string[], ignored: string[] ` }
- **`layerCssText(node, parent, assets)`** · [L202](../src/cssedit.js#L202) — Declarações que a camada mostra no editor (o CSS da exportação), uma por linha.
- **`releaseOverrides(node, beforePlain, afterPlain)`** · [L215](../src/cssedit.js#L215) — O painel Design mandou de novo: tira do CSS livre da camada as propriedades cujo valor GERADO pelo modelo mudou nesta edição (ex.: o CSS editado à mão fixou `width` e agora a pessoa mexeu na largura pelo painel). Sem isso, o CSS livre (que vem por último) continuaria vencendo e o painel pareceria não funcionar.
  - `node` <sub>object</sub> — 
  - `beforePlain` <sub>Record<string, string></sub> — nodeStyle da camada SEM o CSS livre, antes da edição
  - `afterPlain` <sub>Record<string, string></sub> — idem, depois da edição
  - ↩︎ `string[]` propriedades liberadas

---

## src/export.js

**SAÍDAS: PNG, SVG, HTML E ARQUIVO DE PROJETO (.json)** · [abrir o código](../src/export.js)

```text
 Formatos: PNG (imagem), SVG (vetor), HTML (página completa com CSS) e .designer.json (projeto inteiro, para
 salvar/abrir). Cada função "baixa" o arquivo pelo navegador, sem servidor.
```

- **`download(filename, data, type)`** · [L23](../src/export.js#L23) — Faz o navegador BAIXAR um arquivo gerado na memória: cria um Blob, uma URL temporária e clica num <a download> invisível. A URL é liberada depois de 2s para não vazar memória.
  - `filename` <sub>string</sub> — nome do arquivo
  - `data` <sub>string\|Blob</sub> — conteúdo
  - `[type]` <sub>string</sub> — tipo MIME (ignorado se `data` já for Blob)
- **`exportHtmlFile(node, assets, styles = null)`** · [L36](../src/export.js#L36) — Baixa a camada como HTML completo e independente (um arquivo só). Nome: "<nome-da-camada>.html".
- **`exportSiteFile(doc)`** · [L41](../src/export.js#L41) — Baixa todas as pranchetas visíveis como um site estático de páginas HTML dentro de um ZIP.
- **`saveProject(doc)`** · [L52](../src/export.js#L52) — Baixa o PROJETO inteiro como `.designer.json` (todas as páginas, imagens e estilos). É o backup de verdade: o salvamento automático fica só no navegador. Para abrir de novo: Arquivo → Abrir.
- **`openProjectFile(file)`** · [L61](../src/export.js#L61) — Lê um arquivo de projeto (.json) escolhido pelo usuário. Valida o mínimo (tem páginas) e completa campos que projetos antigos não tinham. Lança um erro com mensagem amigável se o arquivo não for um projeto.
  - `file` <sub>File</sub> — 
- **`exportPng(node, assets, scale = 2, styles = null)`** · [L81](../src/export.js#L81) — Exporta a camada como PNG. Técnica: monta o HTML+CSS da camada (o MESMO do painel Código), embrulha num SVG com <foreignObject>, carrega como imagem e desenha num <canvas> na escala pedida (2x = dobro de pixels, nítido em telas HiDPI). Se a camada está girada, a imagem tem o tamanho da caixa rotacionada e a camada fica centralizada nela.

  LIMITAÇÕES: o navegador não carrega fontes da web dentro de uma imagem SVG, então só valem as fontes INSTALADAS no
  computador; e efeitos como backdrop-filter podem não aparecer. (O HTML/SVG exportados não têm essas limitações.)
  - `node` <sub>object</sub> — camada
  - `assets` <sub>object</sub> — imagens do documento
  - `[scale=2]` <sub>number</sub> — 1 a 4
- **`renderPng(node, assets, scale = 2, styles = null)`** · [L91](../src/export.js#L91) — Desenha a camada como PNG e devolve o arquivo (Blob), sem baixar. Usado pelo exportPng e pela IA (ferramenta get_image do MCP: o Claude/GPT "vê" o design). Mesmas limitações do exportPng (fontes instaladas, sem vidro).
  - ↩︎ `Promise<Blob>`
- **`exportSvgFile(node, assets, boxOf)`** · [L119](../src/export.js#L119) — Baixa a camada como SVG vetorial (ver svg.js). `boxOf` mede cada filho no DOM para respeitar flexbox/grid.

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

## src/geom.js

**GEOMETRIA DOS VETORES (sem DOM, sem dependências; testável no Node)** · [abrir o código](../src/geom.js)

```text
 Pontos de vetor: { x, y, hin, hout, mode? } — hin/hout são as alças (null = sem alça) e `mode` diz como as alças
 se comportam ao arrastar uma delas:
   'mirror' → espelhadas (mesma direção oposta e mesmo comprimento: curva suave e simétrica)
   'asym'   → assimétricas (direção oposta, mas cada uma com o seu comprimento)
   'free'   → independentes (cada alça vai para onde quiser: forma um bico)
 Sem `mode`, o tipo é deduzido das alças (pointMode).

 Conteúdo:
   rdp / fitCurve / smoothStroke     → lápis à mão livre (simplificação + ajuste de curvas de Bézier)
   flattenContour                    → curvas → polígono (para as booleanas)
   booleanPolygons                   → unir / subtrair / interseção / excluir entre polígonos
   polygonsToContours                → polígono do resultado → pontos de vetor (com curvas reajustadas)
   pointMode / dragHandle / smoothPoint / reversePoints → edição de pontos
```

- **`cubicAt(a, c1, c2, b, t)`** · [L31](../src/geom.js#L31) — Ponto da Bézier cúbica (a, c1, c2, b) em t.
- **`pointMode(pt)`** · [L44](../src/geom.js#L44) — Tipo do ponto: 'corner' (sem alças), 'mirror', 'asym' ou 'free'. Usa `pt.mode` quando existe e o ponto tem alças; senão deduz: alças opostas e iguais = mirror; opostas e de tamanhos diferentes = asym; o resto = free.
- **`dragHandle(pt, kind, pos, breakMirror = false)`** · [L62](../src/geom.js#L62) — Move a alça `kind` ('hin'|'hout') do ponto para `pos`, respeitando o modo do ponto: mirror → a outra alça espelha; asym → a outra fica na direção oposta mas mantém o comprimento; free → só esta. `breakMirror` (Alt) força 'free' e grava isso no ponto. Altera `pt` e o devolve.
- **`smoothPoint(pts, i, closed, mode = 'mirror')`** · [L80](../src/geom.js#L80) — Transforma o ponto `pts[i]` num ponto CURVO (alças ao longo da direção vizinho anterior → próximo, com 1/4 da distância entre eles) ou num CANTO (tira as alças). Num ponto da ponta de um caminho aberto, usa o único vizinho.
- **`cornerPoint(pt)`** · [L98](../src/geom.js#L98) — Ponto de canto: tira as alças.
- **`reversePoints(pts)`** · [L104](../src/geom.js#L104) — Inverte a direção do caminho (troca hin/hout de cada ponto). Devolve uma lista nova.
- **`segDist(p, a, b)`** <sub>do módulo</sub> · [L114](../src/geom.js#L114) — Distância do ponto p ao segmento a–b.
- **`rdp(points, eps)`** · [L126](../src/geom.js#L126) — Ramer–Douglas–Peucker: remove pontos que se desviam menos que `eps` da reta entre os vizinhos que ficam. Iterativo (não estoura a pilha com traços longos). Devolve pontos {x, y}.
- **`fitCurve(points, error = 4)`** · [L149](../src/geom.js#L149) — Ajusta curvas de Bézier cúbicas a uma sequência de pontos (algoritmo de Philip J. Schneider, "Graphics Gems", 1990). Divide recursivamente onde o erro passa de `error` px. Devolve pontos de vetor { x, y, hin, hout, mode }: os pontos internos ficam com alças alinhadas (curva contínua).
- **`smoothStroke(raw, level = 50, scale = 1)`** · [L253](../src/geom.js#L253) — Traço do LÁPIS → pontos de vetor. `level` (0..100) é a suavização: 0 segue o traço quase exatamente, 100 vira poucas curvas largas. `scale` = px de tela por unidade (para a tolerância valer em px de tela). Etapas: tira pontos repetidos/colados → RDP (tira o tremido) → ajuste de curvas de Schneider.
- **`densify(pts, step)`** <sub>do módulo</sub> · [L266](../src/geom.js#L266) — Acrescenta pontos intermediários para nenhum trecho passar de `step`.
- **`flattenContour(points, closed, tol = 0.5)`** · [L281](../src/geom.js#L281) — Achata um contorno (pontos com alças) em polígono. Cada curva vira N retas (N pela extensão do polígono de controle e pela tolerância `tol` em unidades do desenho). Retas ficam como estão.
- **`polygonArea(poly)`** · [L300](../src/geom.js#L300) — Área com sinal do polígono (positiva = sentido horário na tela, com y para baixo).
- **`winding(rings, p)`** <sub>do módulo</sub> · [L310](../src/geom.js#L310) — Número de voltas (winding) dos anéis em torno de p.
- **`insideShape(shape, p)`** · [L324](../src/geom.js#L324) — p está dentro da forma (anéis + regra de preenchimento)?
- **`booleanPolygons(shapes, op)`** · [L342](../src/geom.js#L342) — OPERAÇÃO BOOLEANA entre formas poligonais. Cada forma: { rings: [[{x,y}...]...], rule: 'nonzero'|'evenodd' }. op: 'union' (unir), 'subtract' (a 1ª menos as outras), 'intersect' (só onde todas se sobrepõem),

      'exclude' (onde um número ÍMPAR de formas se sobrepõe).

  Como funciona (sem dependências, robusto a bordas coincidentes):
   1. Junta todas as arestas e as divide em TODOS os cruzamentos (inclusive pontas encostadas no meio de outra aresta).
   2. Para cada pedacinho, testa um ponto um pouco à esquerda e outro à direita: a aresta faz parte da borda do
      resultado se um lado está DENTRO do resultado e o outro FORA. Ela é orientada com o "dentro" sempre do mesmo lado
      (assim furos saem no sentido contrário e a regra nonzero funciona).
   3. Encadeia as arestas que sobraram em anéis fechados.
  Devolve uma lista de anéis (polígonos) — vazia se o resultado é vazio.
- **`intersectEdges(e, f, EPS)`** <sub>do módulo</sub> · [L437](../src/geom.js#L437) — Registra o(s) ponto(s) de encontro entre as arestas e e f (cruzamento ou sobreposição colinear).
- **`polygonsToContours(rings, { tol = 0.1, smooth = true } = {})`** · [L468](../src/geom.js#L468) — Anéis do resultado → contornos de vetor. Tira pontos colineares (RDP com `tol`) e, com `smooth`, reajusta curvas nos trechos que eram curvos (sequências de muitos pontos com pouca virada), mantendo as QUINAS (virada > 30°) como pontos de canto. Devolve [{ points, closed: true }].
- **`refitRing(ring, tol)`** <sub>do módulo</sub> · [L480](../src/geom.js#L480) — Reajusta curvas num anel fechado, quebrando nas quinas.
- **`ellipseContour(w, h)`** · [L524](../src/geom.js#L524) — Elipse w×h (origem no canto) como 4 pontos curvos.
- **`rectContour(w, h, radius = [0, 0, 0, 0])`** · [L535](../src/geom.js#L535) — Retângulo w×h com cantos arredondados [tl, tr, br, bl] (raios limitados à metade do lado).

---

## src/html.js

**HTML E CSS ESCRITOS À MÃO (sanitização, CSS da página, atributos HTML)** · [abrir o código](../src/html.js)

```text
 Funções PURAS (rodam no navegador e no Node, sem DOM) usadas pela aba Código, pelo canvas e pela exportação:
  - sanitizeHtml: limpa o HTML da camada "Código HTML" (sem <script>, sem on*, sem javascript:...);
  - parseCssBlocks / scopePageCss / safePageCss: o CSS GLOBAL da página (doc.styles.pageCss) com seletores,
    @media, :hover e @keyframes. No canvas as regras são "escopadas" (só valem dentro do canvas);
  - htmlAttrs: atributos extras de uma camada (id, classes, title, role, aria-label, target/rel, type...).
```

- **`escapeAttr(s)`** · [L14](../src/html.js#L14) — Escapa & < > " para texto e valores de atributo.
- **`safeUrl(url, { image = false } = {})`** · [L21](../src/html.js#L21) — URL segura para href/src: http(s), mailto, tel, âncora (#), caminho relativo e data:image (só em src). Qualquer outro esquema (javascript:, vbscript:, data:text/html...) devolve ''.
- **`ALLOWED_TAGS`** <sub>do módulo</sub> · [L35](../src/html.js#L35) — Etiquetas permitidas no "Código HTML" (o resto some, mas o texto de dentro fica).
- **`DROP_WITH_CONTENT`** <sub>do módulo</sub> · [L43](../src/html.js#L43) — Etiquetas removidas JUNTO com tudo o que está dentro (código, estilos globais, objetos externos).
- **`VOID`** <sub>do módulo</sub> · [L45](../src/html.js#L45) — Etiquetas sem fechamento.
- **`URL_ATTRS`** <sub>do módulo</sub> · [L47](../src/html.js#L47) — Atributos que levam URL.
- **`SVG_CASE`** <sub>do módulo</sub> · [L49](../src/html.js#L49) — Nomes das etiquetas SVG com maiúsculas (o filtro compara em minúsculas).
- **`safeStyleValue(v)`** · [L52](../src/html.js#L52) — Valor de `style=""` seguro: sem expression(), sem url(javascript:), sem behavior/-moz-binding.
- **`sanitizeHtml(input)`** · [L68](../src/html.js#L68) — Limpa o HTML escrito pela pessoa para ele poder ir ao canvas e ao arquivo exportado:

   - remove <script>, <style>, <object>, <embed>... (com o conteúdo) e comentários;
   - etiquetas desconhecidas somem (o texto de dentro fica);
   - remove atributos on* (onclick...), srcdoc, e URLs perigosas (javascript:, data: fora de imagens);
   - <iframe> só com endereço https:// (e ganha sandbox); sem endereço válido, some;
   - <a target="_blank"> ganha rel="noopener noreferrer".
  - `input` <sub>string</sub> — 
  - ↩︎ `{ html: string, removed: string[] ` }  `removed` = o que foi tirado (para avisar a pessoa)
- **`parseAttrs(text)`** <sub>do módulo</sub> · [L153](../src/html.js#L153) — Lê `a="1" b='2' c=3 d` → [[a,'1'],[b,'2'],[c,'3'],[d,null]] (entidades &quot; etc. são decodificadas).
- **`parseCssBlocks(text)`** · [L176](../src/html.js#L176) — Lê uma folha de CSS em blocos (sem depender do navegador): regras `seletor { decls }` e at-rules com bloco (`@media ... { regras }`) ou sem (`@import ...;`). Guarda a linha de cada bloco para as mensagens de erro.
  - ↩︎ `{ blocks: object[], errors: {line:number, msg:string` [] }} bloco = { kind: 'rule', selector, body, line } \| { kind: 'at', name, prelude, children?: bloco[], body?, line }
- **`readPrelude()`** <sub>interna</sub> · [L190](../src/html.js#L190) — Lê até `{`, `;` ou `}` no nível atual (respeitando aspas e parênteses).
- **`readBody()`** <sub>interna</sub> · [L206](../src/html.js#L206) — Lê o corpo entre { } (já depois da `{`) sem interpretar; devolve o texto.
- **`parseDeclarations(body)`** · [L269](../src/html.js#L269) — Declarações de um corpo de regra `a: b; c: d` → [{prop, value, important, line}] (linha relativa ao corpo, 0 = 1ª). Respeita aspas e parênteses (url(data:...;...) não quebra).
- **`unsafeCss(s)`** <sub>do módulo</sub> · [L299](../src/html.js#L299) — O valor de CSS é seguro (sem javascript:, expression(), quebra de <style>)?
- **`trustedFontImport(prelude)`** <sub>do módulo</sub> · [L302](../src/html.js#L302) — Só permite folhas CSS do endpoint oficial do Google Fonts; @import é global e poderia estilizar o editor inteiro.
- **`scopeSelector(selector, scope)`** · [L318](../src/html.js#L318) — Reescreve um seletor para valer SÓ dentro do canvas do editor, onde cada camada é um <div> com data-tag (etiqueta), data-cls (classes) e data-hid (id). `.card` → `:is([data-cls~="card"], .card)` (a 2ª forma pega o HTML real das camadas "Código HTML"), `#topo` e `h1` do mesmo jeito; html/body/:root viram o próprio escopo. Pseudo-classes (:hover...) ficam como estão.
- **`printBlocks(blocks, { selector = (s) => s, decls = (d) => d, indent = '' } = {})`** <sub>do módulo</sub> · [L395](../src/html.js#L395) — Monta o texto de uma lista de blocos de volta (com transformação do seletor e das declarações).
- **`safePageCss(text)`** · [L425](../src/html.js#L425) — CSS da página pronto para o ARQUIVO EXPORTADO (e a apresentação): o mesmo texto, relido e reescrito sem nada perigoso (javascript:, expression(), "</style"). @import do Google Fonts vai para o topo (exigência do CSS).
- **`scopePageCss(text, scope = '.world')`** · [L438](../src/html.js#L438) — CSS da página para o CANVAS do editor: cada seletor só vale dentro de `scope` (ver scopeSelector) e as declarações ganham !important, porque no canvas o estilo de cada camada é inline (venceria qualquer regra). Só @import do Google Fonts fica no topo; outras folhas globais podem estilizar a própria interface do editor.
- **`lintCss(text, supports)`** · [L457](../src/html.js#L457) — Confere uma folha de CSS: erros de estrutura (chaves) e, se `supports` for dado (CSS.supports do navegador), propriedades/valores que o navegador não entende. Devolve mensagens com o número da linha.
  - `text` <sub>string</sub> — 
  - `[supports]` <sub>(prop:string, value:string) => boolean</sub> — 
  - ↩︎ `{line:number, msg:string, level:'error'\|'warn'` []}
- **`checkDecl(d, line, supports)`** · [L476](../src/html.js#L476) — Confere UMA declaração (usada pelo lintCss e pelo editor de CSS da camada).
- **`LINK_TARGETS`** · [L490](../src/html.js#L490) — Valores aceitos em alguns atributos (lista fechada: o texto vai para o HTML).
- **`BUTTON_TYPES`** · [L491](../src/html.js#L491) — _(sem comentário)_
- **`ATTR_KEYS`** · [L493](../src/html.js#L493) — Campos da camada que viram atributos (todos opcionais).
- **`cleanId(v)`** · [L496](../src/html.js#L496) — Id válido de HTML/CSS (letra primeiro; letras, números, - e _). '' se inválido.
- **`cleanClasses(v)`** · [L498](../src/html.js#L498) — Lista de classes extras válidas (sem duplicadas).
- **`htmlAttrs(node, tag)`** · [L506](../src/html.js#L506) — Atributos extras de uma camada, já escapados, prontos para entrar na etiqueta (cada um começa com espaço). A classe da camada (gerada) e o href/aria-label continuam no gerador (css.js); aqui ficam os novos.
  - `node` <sub>object</sub> — 
  - `tag` <sub>string</sub> — etiqueta efetiva no HTML exportado

---

## src/image-assets.js

- **`imageAssetCatalog(doc)`** · [L7](../src/image-assets.js#L7) — _(sem comentário)_

---

## src/imagefx.js

**MATEMÁTICA DA IA DE FOTO (funções puras sobre pixels, sem DOM)** · [abrir o código](../src/imagefx.js)

```text
 Tudo aqui trabalha com arrays de pixels RGBA (Uint8ClampedArray, 4 bytes por pixel, o mesmo formato do
 `ImageData` do canvas) e devolve arrays NOVOS (nunca altera a entrada). Por não depender do navegador, os
 testes do Node (tests/imagefx.test.js) conferem cada conta. Quem desenha na tela é ui/imageai.js.

 Conteúdo:
  - AJUSTES: brilho, contraste, saturação, exposição, temperatura, nitidez e desfoque (adjustPixels)
  - FILTROS prontos (FILTERS / applyFilter): combinações de ajustes + P&B, sépia e vinheta
  - REMOVER FUNDO: estimativa automática pelas bordas (autoBackground), varinha mágica (magicWand),
    pincel de apagar/restaurar (paintMask) e aplicação da máscara no canal alfa (applyMask)
  - GEOMETRIA: recorte por proporção, redimensionar e o "plano" da edição generativa (planGenerative)
  - MULTIPART: monta o corpo multipart/form-data que a API de imagens recebe (buildMultipart, usado no servidor)
```

- **`clamp(v, lo, hi)`** <sub>do módulo</sub> · [L20](../src/imagefx.js#L20) — Limita v a [lo, hi].
- **`num(v, d = 0)`** <sub>do módulo</sub> · [L22](../src/imagefx.js#L22) — Número válido ou o padrão.
- **`ADJ_DEFAULTS`** · [L26](../src/imagefx.js#L26) — Ajustes neutros (nada muda). Faixas: -100..100, exceto nitidez 0..100 e desfoque 0..40 (px).
- **`ADJ_FIELDS`** · [L28](../src/imagefx.js#L28) — Rótulos e faixas dos controles (a tela monta os controles a partir desta lista).
- **`normalizeAdj(adj = {})`** · [L39](../src/imagefx.js#L39) — Ajustes completos e dentro da faixa (aceita objeto parcial ou com lixo).
- **`isNeutral(adj)`** · [L45](../src/imagefx.js#L45) — true se nenhum ajuste muda a imagem.
- **`toneLut({ exposure = 0, brightness = 0, contrast = 0 } = {})`** · [L53](../src/imagefx.js#L53) — Tabela (LUT) de 256 valores com exposição, brilho e contraste: a mesma conta para os três canais, feita uma vez só.

   - exposição: multiplica (como abrir o diafragma): 2^(e/50) → +100 = ×4, -100 = ×¼
   - brilho: soma até ±128
   - contraste: fórmula clássica de contraste em torno do cinza médio (128)
- **`boxBlur(src, w, h, radius)`** · [L67](../src/imagefx.js#L67) — Desfoque em caixa (box blur) separável, 3 passadas (fica parecido com o gaussiano). Raio em px. Funciona no RGBA inteiro. Devolve um array novo.
- **`adjustPixels(src, w, h, adj = {})`** · [L104](../src/imagefx.js#L104) — Aplica os ajustes a uma imagem RGBA (w × h). Ordem: tom (exposição/brilho/contraste) → saturação → temperatura → desfoque → nitidez (máscara de nitidez: realça a diferença entre a imagem e ela mesma desfocada). O alfa não muda.
  - `src` <sub>Uint8ClampedArray</sub> — 
  - `w` <sub>number</sub> — @param {number} h
  - `adj` <sub>object</sub> — ver ADJ_DEFAULTS
  - ↩︎ `Uint8ClampedArray`
- **`keepAlpha(to, from)`** <sub>do módulo</sub> · [L137](../src/imagefx.js#L137) — Copia o alfa de `from` para `to` (o desfoque não deve mexer na transparência).
- **`FILTERS`** · [L147](../src/imagefx.js#L147) — Filtros: cada um é uma combinação de ajustes (adj) e, se quiser, P&B (mono), sépia (0..1) e vinheta (0..1). A tela mostra uma miniatura de cada um aplicada à foto.
- **`filterById(id)`** · [L160](../src/imagefx.js#L160) — Filtro pelo id (ou o "Original").
- **`applyFilter(src, w, h, id, strength = 1)`** · [L166](../src/imagefx.js#L166) — Aplica um filtro pronto. `strength` (0..1) mistura com a imagem de entrada (1 = filtro inteiro).
  - ↩︎ `Uint8ClampedArray`
- **`vignette(src, w, h, amount)`** · [L190](../src/imagefx.js#L190) — Escurece os cantos: multiplica por 1 − força·(distância ao centro)².
- **`renderPixels(src, w, h, { filter = 'none', adj = null, mask = null } = {})`** · [L209](../src/imagefx.js#L209) — Pipeline completo dos pixels: filtro → ajustes → máscara (fundo removido). É o que a prévia e o "Aplicar" usam.
- **`dist2(d, i, r, g, b)`** <sub>do módulo</sub> · [L218](../src/imagefx.js#L218) — Distância de cor ao quadrado (RGB).
- **`tolToDist2(tol)`** · [L220](../src/imagefx.js#L220) — Tolerância 0..100 → distância máxima ao quadrado no espaço RGB (100 = 441,7, a diagonal do cubo).
- **`magicWand(src, w, h, x, y, tolerance = 32, contiguous = true)`** · [L228](../src/imagefx.js#L228) — VARINHA MÁGICA: seleciona os pixels com cor parecida com a do ponto clicado. `contiguous` (padrão) = só os que estão ligados ao ponto (preenchimento por inundação, 4 vizinhos); senão, todos da imagem com cor parecida. Pixels já transparentes (alfa < 8) contam como "parecidos" (o fundo já removido não para a varinha).
  - ↩︎ `Uint8Array` 1 = selecionado
- **`borderColors(src, w, h)`** · [L258](../src/imagefx.js#L258) — Cores dominantes da BORDA da imagem (o que provavelmente é fundo): agrupa as cores da moldura de 1 px em "caixas" de 32 níveis por canal e devolve a média das caixas que somam pelo menos 8% da borda (até 4 cores).
  - ↩︎ `{r:number,g:number,b:number,share:number` []}
- **`autoBackground(src, w, h, { tolerance = 28, feather = 1, shrink = 1 } = {})`** · [L287](../src/imagefx.js#L287) — REMOVER FUNDO AUTOMÁTICO (sem IA): estima as cores do fundo pela borda (borderColors) e "inunda" a partir de todos os pixels da borda que têm essas cores, avançando para vizinhos parecidos com alguma cor de fundo. O que a inundação alcança é fundo (alfa 0); o resto é o objeto. Ilhas de fundo fechadas (ex.: o miolo de um "O") ficam: use a varinha. No fim tira `shrink` px da borda do objeto (a mistura com o fundo) e suaviza o recorte (`feather` px) para não ficar serrilhado.
  - ↩︎ `{mask: Uint8Array, colors: object[], removed: number` }  mask: 0..255 por pixel (255 = mantém)
- **`erodeMask(mask, w, h)`** · [L320](../src/imagefx.js#L320) — Tira 1 px do objeto em volta de tudo que já é fundo (4 vizinhos). Altera `mask` no lugar; devolve quantos saíram.
- **`featherMask(mask, w, h, radius)`** · [L332](../src/imagefx.js#L332) — Suaviza a máscara (desfoque em caixa só no canal da máscara).
- **`combineSelection(mask, sel, mode = 'erase')`** · [L349](../src/imagefx.js#L349) — Junta uma seleção (da varinha) à máscara: modo "erase" apaga (vira fundo) e "keep" restaura (volta a aparecer).
  - ↩︎ `Uint8Array` máscara nova
- **`paintMask(mask, w, h, x, y, r, value, hardness = 0.6)`** · [L361](../src/imagefx.js#L361) — PINCEL na máscara: círculo de raio `r` em (x, y). `value` 0 = apagar, 255 = restaurar. `hardness` (0..1) é a parte do raio com força total; dali até a borda, a força cai até zero (borda macia). Altera `mask` NO LUGAR (o pincel roda a cada movimento do mouse; copiar a máscara inteira a cada passo ficaria lento) e devolve ela.
- **`paintStroke(mask, w, h, a, b, r, value, hardness)`** · [L379](../src/imagefx.js#L379) — Pinta uma linha do pincel (de a até b), com passos de ¼ do raio: o traço sai contínuo mesmo com o mouse rápido.
- **`applyMask(src, mask)`** · [L387](../src/imagefx.js#L387) — Multiplica o alfa de cada pixel pela máscara (0..255). Devolve um array novo.
- **`maskCoverage(mask)`** · [L394](../src/imagefx.js#L394) — Quanto da imagem a máscara tira (0..1).
- **`resizeMask(mask, w, h, nw, nh)`** · [L401](../src/imagefx.js#L401) — Máscara redimensionada (vizinho mais próximo): para levar a máscara da prévia ao tamanho real e vice-versa.
- **`CROP_RATIOS`** · [L412](../src/imagefx.js#L412) — Proporções do recorte (rótulo, largura/altura; null = livre).
- **`cropForRatio(w, h, ratio)`** · [L415](../src/imagefx.js#L415) — Maior retângulo centralizado com a proporção `ratio` (largura/altura) dentro de w × h. Sem ratio, a imagem toda.
- **`clampCrop(c, w, h, ratio = null, min = 8)`** · [L426](../src/imagefx.js#L426) — Ajusta um recorte para caber na imagem, com tamanho mínimo e (se pedido) a proporção. Usado ao arrastar as alças. `anchor` = canto oposto ao que está sendo arrastado ('nw' | 'ne' | 'sw' | 'se'), para manter a proporção a partir dele.
- **`fitWidth(w, h, maxW)`** · [L439](../src/imagefx.js#L439) — Tamanho final com largura máxima (mantém a proporção; nunca aumenta).
- **`formatBytes(n)`** · [L446](../src/imagefx.js#L446) — "184 KB", "1,2 MB" (base 1024, vírgula decimal).
- **`dataUrlBytes(url)`** · [L453](../src/imagefx.js#L453) — Bytes de um data URL base64 (sem decodificar).
- **`planGenerative({ w, h, size = 1024, expand = null })`** · [L469](../src/imagefx.js#L469) — PLANO DA EDIÇÃO GENERATIVA. A API de imagens trabalha num quadrado (ex.: 1024 × 1024). Para qualquer proporção:

   - a área de saída E (a imagem, ou a imagem + as margens de "Expandir") é encaixada no quadrado, centralizada;
   - a imagem original ocupa o retângulo R dentro de E;
   - depois, o servidor devolve o quadrado e a tela recorta E de volta, no tamanho outW × outH.
  - ↩︎ `{size:number, scale:number, out:{x,y,w,h` , image:{x,y,w,h}, outW:number, outH:number}}
- **`buildMultipart(parts, boundary = `----stylo${Math.random().toString(16).slice(2)}$…)`** · [L489](../src/imagefx.js#L489) — Monta um corpo multipart/form-data (o formato de envio de arquivos por formulário), que o POST /images/edits das APIs compatíveis com a OpenAI exige. Sem dependências: concatena as partes em bytes.
  - `[]` <sub>{name:string, value?:string, data?:Uint8Array, filename?:string, type?:string</sub> — } parts texto (value) ou arquivo (data + filename + type)
  - `[boundary]` <sub>string</sub> — separador (precisa não aparecer no conteúdo; o padrão é aleatório o bastante)
  - ↩︎ `{body: Uint8Array, contentType: string, boundary: string` }
- **`parseDataUrl(url)`** · [L509](../src/imagefx.js#L509) — Lê um data URL de imagem: { type, bytes } ou null se não for imagem base64.

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

- **`presenceSlot`** <sub>do módulo</sub> · [L52](../src/main.js#L52) — Lugar da presença na barra do topo (preenchido quando a presença é criada, mais abaixo).
- **`toast(msg)`** <sub>do módulo</sub> · [L61](../src/main.js#L61) — Mostra um aviso curto (balão preto) na parte de baixo da tela por ~3s. Só um por vez: o novo substitui o antigo.
- **`savePrefs()`** <sub>do módulo</sub> · [L75](../src/main.js#L75) — Grava as preferências (falhas silenciosas: é só conveniência).
- **`openSettings(section)`** <sub>do módulo</sub> · [L109](../src/main.js#L109) — Página de Configurações (ver ui/settings.js) e janela de Projetos (ui/projects.js). `section` abre direto numa seção.
- **`quickSave()`** <sub>do módulo</sub> · [L114](../src/main.js#L114) — Ctrl+S: grava no arquivo ligado; se ainda não há arquivo, abre a janela para dar um nome.
- **`bindPanelTabs(buttons, panel, id)`** <sub>do módulo</sub> · [L145](../src/main.js#L145) — Uma parada de Tab por painel; as setas percorrem as abas sem acionar atalhos do canvas.
- **`setLeftTab(tab)`** <sub>do módulo</sub> · [L169](../src/main.js#L169) — Troca a aba do painel esquerdo ('layers' | 'assets' | 'icons').
- **`setTab(tab)`** <sub>do módulo</sub> · [L209](../src/main.js#L209) — Troca a aba do painel direito ('design' | 'proto' | 'code' | 'comments') e já redesenha o painel escolhido.
- **`confirmReplace(question)`** <sub>do módulo</sub> · [L354](../src/main.js#L354) — Antes de TROCAR o projeto aberto (abrir outro, novo, exemplo, importar). Regras:

   - projeto gravado na pasta, ou exemplo/em branco não editado → troca sem perguntar (nada se perde);
   - projeto que só existe no navegador → pergunta, porque o navegador guarda UM projeto: ele seria substituído.
     Opções: salvar na pasta antes (abre "Salvar na pasta" e cancela a troca), trocar mesmo assim, ou cancelar.
  - ↩︎ `Promise<boolean>` true = pode trocar
- **`syncTopbar()`** <sub>do módulo</sub> · [L400](../src/main.js#L400) — Atualiza a barra superior conforme o estado: desfazer/refazer habilitados, ícone do tema, nome e indicador de salvo.
- **`saveStatus()`** <sub>do módulo</sub> · [L417](../src/main.js#L417) — O que o indicador do topo mostra: [estado (cor), texto, dica ao passar o mouse].

   - "Salvo na pasta"       → gravado no arquivo .json da pasta (e no navegador)
   - "Salvo no navegador"   → projeto ainda sem arquivo: só a cópia do navegador existe
   - "Só no navegador"      → tem arquivo, mas a pasta falhou (servidor desligado, conflito, permissão)
- **`TOOLS`** <sub>do módulo</sub> · [L430](../src/main.js#L430) — Ferramentas da barra flutuante: [id, ícone, dica com atalho]. A ordem é a ordem na tela.
- **`syncTools()`** <sub>do módulo</sub> · [L511](../src/main.js#L511) — Destaca o botão da ferramenta ativa (aria-pressed diz ao leitor de tela qual está ligada).
- **`syncZoom()`** <sub>do módulo</sub> · [L549](../src/main.js#L549) — Mostra o zoom atual em % no botão.
- **`syncCommentBadge()`** <sub>do módulo</sub> · [L597](../src/main.js#L597) — Número de comentários abertos no selo da aba (some quando é zero).
- **`setWidth(side, w)`** <sub>do módulo</sub> · [L687](../src/main.js#L687) — Define a largura de um painel (entre 200 e 520px), avisa quem depende do tamanho (réguas, canvas) e devolve o valor aplicado.
- **`onFail(msg)`** <sub>do módulo</sub> · [L750](../src/main.js#L750) — Trata uma falha inesperada: registra no console e avisa o usuário (com limite de frequência).

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
- **`createProjectId()`** · [L31](../src/model.js#L31) — Identidade estável do projeto, distinta dos IDs curtos usados nas camadas.
- **`forkProject(doc)`** · [L44](../src/model.js#L44) — Cria uma cópia independente sem alterar o documento de origem.
- **`round(n, d = 2)`** · [L53](../src/model.js#L53) — Arredonda `n` para `d` casas decimais (padrão 2). Usado em quase todo lugar onde um número vai para o documento ou para o CSS, para evitar valores como 10.000000000002 que aparecem depois de contas com ponto flutuante.
  - `n` <sub>number</sub> — número a arredondar
  - `[d=2]` <sub>number</sub> — casas decimais
- **`FONT_FAMILIES`** · [L63](../src/model.js#L63) — Fontes oferecidas no painel de texto. As 4 últimas (Poppins, DM Sans, Playfair, JetBrains Mono) são carregadas do Google Fonts pelo index.html; sem internet o navegador usa uma fonte do sistema no lugar. O usuário também pode usar qualquer família que esteja instalada no computador dele.
- **`FONT_WEIGHTS`** · [L69](../src/model.js#L69) — Pesos de fonte do CSS (`font-weight`) com o nome que o Figma/Penpot usam. Formato: [valor, rótulo].
- **`BLEND_MODES`** · [L75](../src/model.js#L75) — Modos de mesclagem aceitos em `mix-blend-mode` (mesma lista do CSS). 'normal' = sem mesclagem.
- **`TEXT_TAGS`** · [L85](../src/model.js#L85) — Etiquetas HTML que a camada pode virar no código exportado (campo opcional `tag`). A lista é FECHADA de propósito: o valor vai para o HTML gerado, então só entram nomes conhecidos e seguros.
- **`BOX_TAGS`** · [L87](../src/model.js#L87) — _(sem comentário)_
- **`tagOf(node)`** · [L90](../src/model.js#L90) — Etiqueta HTML efetiva da camada: a escolhida (se válida) ou a padrão (p para texto, section para seção, div para o resto).
- **`INTERACTIVE_TAGS`** <sub>do módulo</sub> · [L97](../src/model.js#L97) — Etiquetas que não podem ficar uma dentro da outra (link/botão dentro de link/botão).
- **`htmlTagIn(node, ancestors = [])`** · [L107](../src/model.js#L107) — Etiqueta que a camada usa NO HTML EXPORTADO, conferindo onde ela está. O editor desenha tudo com <div> (montado pelo JavaScript), mas o arquivo exportado é LIDO pelo navegador, e a leitura do HTML tem regras: um <li> dentro de outro <li> fecha o primeiro sozinho, um link dentro de outro link também. Sem esta conferência, a página exportada desmontava (itens saindo de dentro do card). Quando a etiqueta escolhida não cabe ali, volta para a padrão.
  - `node` <sub>object</sub> — 
  - `ancestors` <sub>string[]</sub> — etiquetas dos pais, do mais externo ao pai direto
  - ↩︎ `{ tag: string, wanted: string, reason: string ` }  `reason` vazio = a escolhida vale
- **`TYPE_LABEL`** · [L122](../src/model.js#L122) — Nome padrão (em português) de cada tipo de camada. Usado para nomear camadas novas ("Retângulo 3") e como fallback na lista de camadas.
- **`defaultFill(color = '#D9D9D9')`** · [L143](../src/model.js#L143) — Cria um objeto de PREENCHIMENTO (fill) completo. Um fill guarda os dados de TODOS os tipos ao mesmo tempo, de propósito: assim, ao trocar de "cor sólida" para "gradiente" e voltar, o usuário não perde a cor que tinha escolhido. Só o campo `type` decide qual parte vale.

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
- **`defaultStroke()`** · [L161](../src/model.js#L161) — Contorno (stroke). No CSS vira `outline` (não `border`) porque o outline NÃO altera o layout nem o tamanho da caixa — por isso trocar a espessura não "empurra" os vizinhos num auto layout. `position`: 'inside' | 'center' | 'outside' controla o `outline-offset`.
- **`defaultShadow()`** · [L164](../src/model.js#L164) — Sombra (vira `box-shadow`; em textos vira `text-shadow`). `inset` = sombra interna.
- **`defaultLayout()`** · [L178](../src/model.js#L178) — Configuração de auto layout de um FRAME. É literalmente CSS:

   - mode: 'none' (filhos livres, position:absolute) | 'row' | 'column' (display:flex) | 'grid' (display:grid)
   - gap / colGap / rowGap: espaço entre itens (flex usa `gap`; grid usa colGap e rowGap)
   - cols / rows: colunas e linhas do grid (rows 0 = linhas automáticas)
   - colsTemplate / rowsTemplate (opcionais, só no grid): lista de trilhas em CSS, ex.: "200px 1fr 2fr" ou
     "repeat(auto-fit, minmax(200px, 1fr))". Quando existem, mandam no lugar de cols/rows (veja cleanTrackList)
   - padding: [topo, direita, baixo, esquerda] — mesma ordem do atalho `padding` do CSS
   - justify: justify-content (flex) ou justify-items (grid)
   - align:   align-items
   - wrap:    flex-wrap: wrap
- **`createNode(type, props = {})`** · [L201](../src/model.js#L201) — Cria uma camada ("nó") nova, com todos os campos que qualquer camada tem + os do seu tipo.

  SISTEMA DE COORDENADAS: `x` e `y` são relativos ao canto superior esquerdo do PAI (ou ao mundo, se for
  uma camada na raiz da página) e SEM rotação. A rotação gira a caixa em torno do próprio centro.
  - `type` <sub>'frame'\|'rect'\|'ellipse'\|'text'\|'group'\|'line'\|'path'\|'section'</sub> — tipo da camada
  - `[props]` <sub>object</sub> — campos que sobrescrevem os padrões (ex.: { x: 10, name: 'Botão' })
  - ↩︎ `object` o nó, já pronto para entrar em `page.children` ou `node.children`
- **`OVERFLOWS`** · [L335](../src/model.js#L335) — Modos de "conteúdo que sai da caixa" de um frame: [valor, rótulo].
- **`overflowOf(n)`** · [L340](../src/model.js#L340) — Modo de overflow de um frame: o campo `overflow`, ou — em projetos antigos — o que `clip` diz (true = cortar).
- **`cleanTrackList(text)`** · [L348](../src/model.js#L348) — Limpa o texto de uma lista de trilhas do grid (grid-template-columns/rows) digitado pelo usuário: tira o que não faz parte de uma lista de trilhas (; { } : aspas, @, etc.), apara os espaços e limita o tamanho. Como o texto vai para o CSS exportado, isso impede que alguém "feche" a regra e escreva outras. Valor inválido para o CSS (ex.: "abc") é simplesmente ignorado pelo navegador.
- **`isContainer(n)`** · [L353](../src/model.js#L353) — true para camadas que guardam filhos (frame, grupo e seção).
- **`isBoard(node, parent)`** · [L361](../src/model.js#L361) — "Prancheta" (board): frame no nível de cima, ou seja, na raiz da página OU direto dentro de uma seção. É o que ganha nome flutuante acima do canvas, vira tela no modo Apresentar e não entra em outros frames ao ser arrastado.
  - `node` <sub>object</sub> — a camada
  - `parent` <sub>object\|null</sub> — o pai dela (null = raiz da página)
- **`constraintsOf(n)`** · [L364](../src/model.js#L364) — Constraints de uma camada, com padrão (esquerda/topo) para documentos salvos antes desse recurso existir.
- **`hasLayout(n)`** · [L367](../src/model.js#L367) — true se o nó é um frame com auto layout ligado (flex ou grid).
- **`isFlow(node, parent)`** · [L373](../src/model.js#L373) — A camada participa do fluxo do auto layout do pai? Se sim, ela é `position: relative` e quem decide a posição é o navegador (flex/grid); se não, é `position: absolute` e usa x/y.
- **`cloneDeep(v)`** · [L376](../src/model.js#L376) — Cópia profunda via JSON (suficiente: o documento só tem dados simples, sem funções nem datas).
- **`STATE_KEYS`** · [L383](../src/model.js#L383) — Propriedades VISUAIS que um estado pode sobrescrever (o resto — tamanho, posição, layout — não muda com o mouse). `scale` só existe nos estados (padrão 1): vira `transform: scale()`.
- **`STATE_LIST`** · [L385](../src/model.js#L385) — Estados disponíveis: [id, rótulo, pseudo-classe CSS].
- **`STATE_DEFAULT`** <sub>do módulo</sub> · [L387](../src/model.js#L387) — Valor padrão das chaves que a camada base pode não ter.
- **`canHaveStates(n)`** · [L390](../src/model.js#L390) — Camadas com caixa própria que aceitam estados (grupo, seção e linha não).
- **`hasStates(n, which)`** · [L392](../src/model.js#L392) — A camada tem algum estado com sobrescritas? (`which`: um estado específico, ou qualquer um se omitido.)
- **`stateView(node, states)`** · [L401](../src/model.js#L401) — "Visão" de uma camada num ou mais estados: uma cópia rasa dela com as sobrescritas do(s) estado(s) por cima, na ordem dada (como a cascata do CSS: ['hover', 'active'] = hover e depois pressionado por cima). Sem sobrescritas devolve a própria camada. Não altera nada.
  - `node` <sub>object</sub> — 
  - `states` <sub>string\|string[]</sub> — 
- **`editState(node, state, fn)`** · [L420](../src/model.js#L420) — Edita UM estado de uma camada: roda `fn` num RASCUNHO com os valores visuais do estado e guarda em `node.states[estado]` SÓ o que ficou diferente da camada base (se voltar ao valor base, a sobrescrita some; sem nenhuma, o estado some). É assim que o painel Design edita um estado sem saber que está num estado.
  - `node` <sub>object</sub> — camada real (é alterada)
  - `state` <sub>string</sub> — 'hover' \| 'active' \| 'focus'
  - `fn` <sub>(draft: object) => void</sub> — recebe o rascunho (mexa só nas chaves de STATE_KEYS)
- **`DEFAULT_BREAKPOINTS`** · [L445](../src/model.js#L445) — Larguras em que o design muda (CSS @media). Desktop é o desenho base; Tablet vale até `max` px de janela; Celular também (e vem depois, então vence o Tablet). `preview` = largura sugerida para as telas ao desenhar naquele modo.
- **`BREAKPOINT_PRESETS`** · [L450](../src/model.js#L450) — Breakpoints prontos para adicionar ao projeto (os mais usados na web).
- **`BREAKPOINTS`** · [L462](../src/model.js#L462) — Breakpoints ATIVOS do documento aberto, do maior para o menor (a ordem da cascata). É o mesmo array durante toda a vida do app: `setBreakpoints` troca o conteúdo quando o documento muda (cada projeto guarda os seus em `doc.breakpoints`; projetos antigos usam DEFAULT_BREAKPOINTS).
- **`setBreakpoints(list)`** · [L464](../src/model.js#L464) — Normaliza e aplica a lista de breakpoints (sem duplicados, largura de 200 a 4000px, maior primeiro).
- **`bpIcon(b)`** · [L475](../src/model.js#L475) — Ícone de um breakpoint pela largura (desktop / tablet / celular).
- **`BP_KEYS`** · [L477](../src/model.js#L477) — Propriedades que um breakpoint pode mudar (as que fazem sentido variar com a largura da tela).
- **`bpsUpTo(bp)`** · [L485](../src/model.js#L485) — Breakpoints "até" um (inclusive), na ordem da cascata: ate('mobile') = ['tablet', 'mobile'].
- **`hasBps(n, which)`** · [L490](../src/model.js#L490) — A camada tem sobrescritas em algum breakpoint (ou num específico)?
- **`bpView(node, bp)`** · [L499](../src/model.js#L499) — "Visão" de uma camada num breakpoint: cópia rasa com as sobrescritas por cima, em cascata (celular = base + tablet + celular). `null` numa sobrescrita significa "esta propriedade não existe aqui". Sem sobrescritas devolve a própria camada. Não altera nada.
  - `node` <sub>object</sub> — 
  - `bp` <sub>string\|null</sub> — 'tablet' \| 'mobile' \| null (desktop)
- **`editBp(node, bp, fn)`** · [L522](../src/model.js#L522) — Edita UM breakpoint de uma camada: roda `fn` num RASCUNHO com os valores daquela largura e guarda em `node.bps[bp]` SÓ o que difere da largura anterior na cascata (se voltar ao valor de antes, a sobrescrita some). É assim que o painel Design edita o Tablet/Celular sem saber que está nele.
  - `node` <sub>object</sub> — camada real (é alterada)
  - `bp` <sub>string</sub> — 'tablet' \| 'mobile'
  - `fn` <sub>(draft: object) => void</sub> — recebe o rascunho (só as chaves de BP_KEYS ficam)
- **`cloneNode(node)`** · [L544](../src/model.js#L544) — Clona uma camada e TODOS os descendentes, gerando ids novos (usado em duplicar, copiar/colar e Alt+arrastar).
- **`walk(list, fn, parent = null)`** · [L560](../src/model.js#L560) — Percorre a árvore de camadas em profundidade.
  - `list` <sub>object[]</sub> — lista de nós (ex.: page.children)
  - `fn` <sub>(node, parent, list, index) => (void\|false)</sub> — chamada para cada nó; retornar `false` NÃO desce nos filhos dele
  - `[parent]` <sub>object\|null</sub> — pai da lista (null na raiz)
- **`makePage(name = 'Página 1')`** · [L569](../src/model.js#L569) — Cria uma página vazia. `guides` guarda as guias de régua (posições em px do mundo).
- **`makeDoc()`** · [L581](../src/model.js#L581) — Documento vazio. Estrutura completa: { version, projectId, name,

     pages:  [{ id, name, children: [camadas], guides: [{axis:'x'|'y', pos}] }],
     assets: { [assetId]: 'data:image/...' }   // imagens ficam FORA das páginas para não pesarem no histórico
     styles: { colors: [...], texts: [...] },  // estilos compartilhados de cor e texto
     comments: [...] }                          // comentários nas camadas (veja comments.js)
- **`nextName(page, type)`** · [L586](../src/model.js#L586) — Gera o próximo nome livre para o tipo ("Retângulo 1", "Retângulo 2"...), contando as camadas do mesmo tipo na página.
- **`fitGroups(list)`** · [L607](../src/model.js#L607) — Ajusta cada GRUPO ao retângulo que envolve seus filhos e remove grupos vazios. Como um grupo não tem tamanho próprio, depois de mover/redimensionar um filho a caixa do grupo precisa ser recalculada. Roda no fim de cada gesto (em `store.commit`), não durante o arrasto, para não "mexer o chão" debaixo do ponteiro. As coordenadas dos filhos são relativas ao grupo, então ao mover a origem do grupo subtraímos o mesmo valor dos filhos (a posição visual não muda).
  - `list` <sub>object[]</sub> — lista de nós a processar (recursivo)
- **`applyConstraints(frame, ow, oh)`** · [L641](../src/model.js#L641) — Aplica as CONSTRAINTS dos filhos depois que o frame mudou de tamanho (de ow×oh para frame.w×frame.h). Por eixo, cada filho escolhe: colar no início (padrão), colar no fim (right/bottom), esticar entre as duas bordas (leftright/topbottom), manter o centro ou escalar proporcionalmente. Não faz nada em frames com auto layout (aí quem manda é o CSS). É recursivo: se um filho mudou de tamanho, os filhos dele reagem também.
  - `frame` <sub>object</sub> — frame JÁ com o tamanho novo
  - `ow` <sub>number</sub> — largura antiga
  - `oh` <sub>number</sub> — altura antiga
- **`hasSizeLimits(n)`** · [L668](../src/model.js#L668) — Tipos de camada que têm uma caixa CSS de verdade para receber limites de tamanho e proporção: grupos não têm tamanho próprio (a caixa é recalculada dos filhos) e a linha é só uma barra.
- **`hasAspect(n)`** · [L671](../src/model.js#L671) — A camada tem proporção (aspect-ratio) ligada? Texto, grupo e linha não usam.
- **`limitSize(n, w, h)`** · [L678](../src/model.js#L678) — Ajusta (w, h) aos LIMITES da camada: campos opcionais `minW`, `maxW`, `minH`, `maxH` em px (ausentes = sem limite). Como no CSS, o mínimo vence o máximo quando os dois se contradizem.
  - ↩︎ `[number, number]` largura e altura já limitadas
- **`applyLimits(n)`** · [L691](../src/model.js#L691) — Aplica os limites ao tamanho JÁ guardado, só nos eixos de tamanho FIXO (os eixos hug/fill quem decide é o navegador, e o canvas mede de volta). Se mudou, os filhos reagem como em qualquer redimensionamento (constraints).
- **`resizeNode(n, nw, nh, axis = 'w')`** · [L707](../src/model.js#L707) — Redimensiona UMA camada de forma "inteligente": respeita "travar proporção", marca o eixo como 'fixed' e propaga o efeito para dentro (escala os filhos de um grupo; aplica constraints nos filhos de um frame).
  - `n` <sub>object</sub> — camada
  - `nw` <sub>number</sub> — nova largura
  - `nh` <sub>number</sub> — nova altura
  - `[axis='w']` <sub>'w'\|'h'</sub> — qual campo o usuário editou (importa para a trava de proporção)
- **`scaleNode(node, sx, sy)`** · [L738](../src/model.js#L738) — Escala uma camada e (se for grupo) todos os filhos por (sx, sy), multiplicando posição e tamanho. Usado ao redimensionar grupos e seleções múltiplas. Textos viram 'fixed' na largura (senão voltariam ao tamanho natural no render).
- **`slugify(s)`** · [L755](../src/model.js#L755) — Transforma um nome em "slug" seguro para classe CSS e nome de arquivo: tira acentos, deixa minúsculo e troca qualquer coisa fora de a-z/0-9 por '-'. "Botão primário" → "botao-primario". Vazio vira 'item'.

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
- **`docVersion`** <sub>interna</sub> · [L510](../src/overlay.js#L510) — Muda a cada alteração do documento: invalida o "mapa de classes" do inspetor.
- **`classCache`** <sub>interna</sub> · [L512](../src/overlay.js#L512) — Cache do mapa id → { tag, cls } da tela inspecionada (gerar o HTML da tela inteira a cada movimento seria caro).
- **`exportedName(id)`** <sub>interna</sub> · [L517](../src/overlay.js#L517) — Etiqueta HTML e classe CSS que a camada recebe NO CÓDIGO EXPORTADO. As classes dependem da tela inteira (nomes repetidos ganham -2, -3...), então gera o código da tela onde a camada está (uma vez por versão do documento).
- **`drawInspect(id)`** <sub>interna</sub> · [L536](../src/overlay.js#L536) — Desenha o "box model" da camada como o DevTools: margem (laranja), padding (verde) e conteúdo (azul), medidos no próprio elemento do canvas (getComputedStyle = o CSS que o navegador está aplicando de verdade), e a etiqueta com etiqueta HTML, classe, tamanho e as propriedades principais.
- **`drawInspectInside(id, cs, { cx, cy, cw, ch, z, vp })`** <sub>interna</sub> · [L602](../src/overlay.js#L602) — O que está DENTRO do elemento inspecionado, como o DevTools mostra num flex/grid:

   - contorno tracejado de cada filho visível (para ver onde cada item começa e termina);
   - GRID: as linhas de cada coluna e linha (lidas do CSS calculado: grid-template-columns/rows já em px) e os
     espaços entre elas (gap) hachurados;
   - FLEX: o espaço entre itens vizinhos (gap) hachurado.
- **`pill(aabb, text)`** <sub>interna</sub> · [L647](../src/overlay.js#L647) — Etiqueta azul "L × A" logo abaixo da seleção.

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

- **`createPen({ store, canvas, commands, frameUnder })`** · [L36](../src/pen.js#L36) — Cria a CANETA. Dois modos, que não ficam ativos ao mesmo tempo:

   A) DESENHAR (ui.pen): cada clique adiciona um ponto. Clicar e ARRASTAR cria um ponto "suave": o arrasto define a
      alça de saída (hout) e a de entrada (hin) é o espelho dela — é isso que faz a curva de Bézier. Clicar no 1º
      ponto fecha o caminho; Enter/Esc/duplo clique termina deixando-o aberto.
   B) EDITAR PONTOS (ui.editPathId): depois de criado, duplo clique no vetor mostra os pontos. Arrastar ponto/alça
      altera a forma; Alt+clique no traço adiciona ponto (SEGUINDO a curva, sem deformá-la); duplo clique no ponto
      alterna canto↔suave; Delete remove; setas movem o ponto (Shift = 10); Shift ao arrastar/desenhar trava em 45°.
      O painel Design (seção Vetor) edita o ponto selecionado (tipo, X/Y) e mostra/aceita o `d` do SVG.
      Clicar no traço (sem Alt) também adiciona um ponto e já permite arrastá-lo.
   C) LÁPIS (ui.pencil, ferramenta 'pencil', Shift+P): arrastar desenha à mão livre; ao soltar, o traço é simplificado
      (Ramer–Douglas–Peucker) e vira curvas de Bézier (ajuste de Schneider), com o nível de suavização ui.pencilSmooth.

   Modos das alças por ponto (`pt.mode`, ver geom.js): 'mirror' espelhadas, 'asym' assimétricas, 'free' independentes.

  Este módulo não desenha: `overlaySvg()` devolve o SVG (em px de tela) que o overlay.js exibe.
- **`dist(a, b)`** <sub>interna</sub> · [L45](../src/pen.js#L45) — Distância entre dois pontos (px).
- **`screenOf(p)`** <sub>interna</sub> · [L47](../src/pen.js#L47) — Ponto do mundo → px de tela (para medir distâncias na tela, independentes do zoom).
- **`selPts()`** <sub>interna</sub> · [L50](../src/pen.js#L50) — Índices dos pontos selecionados (sempre inclui o principal).
- **`setSel(arr, primary)`** <sub>interna</sub> · [L52](../src/pen.js#L52) — Define a seleção de pontos e o ponto principal (por padrão, o último da lista).
- **`gridOrigin(n)`** <sub>interna</sub> · [L58](../src/pen.js#L58) — Origem (mundo) do pai do vetor em edição, ou do caminho em desenho: é daqui que a grade de encaixe conta.
- **`snapW(w, o)`** <sub>interna</sub> · [L63](../src/pen.js#L63) — Arredonda um ponto do mundo para a grade de encaixe (sem encaixe ligado, devolve o próprio ponto).
- **`snap45(from, p)`** <sub>interna</sub> · [L68](../src/pen.js#L68) — Com Shift: trava `p` em múltiplos de 45° a partir de `from` (mantém a distância).
- **`layerRects(skipId)`** <sub>interna</sub> · [L80](../src/pen.js#L80) — Bordas e centros das camadas visíveis da página (raiz e um nível abaixo), menos o vetor em edição.
- **`magnet(p, pts, e, skipId)`** <sub>interna</sub> · [L104](../src/pen.js#L104) — Gruda `p` (mundo) no candidato mais próximo de cada eixo e grava as linhas-guia em ui.guides.
  - `[]` <sub>{x:number,y:number</sub> — } pts  outros pontos do caminho (já no mundo)
  - `e` <sub>MouseEvent</sub> — 
  - `[skipId]` <sub>string</sub> — vetor em edição (não gruda nele mesmo)
- **`editWorldPts(n, skip)`** <sub>interna</sub> · [L131](../src/pen.js#L131) — Pontos (mundo) do vetor em edição, menos os índices dados.
- **`cubicAt(a, c1, c2, b, t)`** <sub>interna</sub> · [L134](../src/pen.js#L134) — Ponto da curva de Bézier cúbica (a, c1, c2, b) no parâmetro t (0..1).
- **`nearestOnPath(n, l)`** <sub>interna</sub> · [L145](../src/pen.js#L145) — Ponto do traço MAIS PERTO de `l` (espaço do vetor), medindo na curva de verdade (não na corda reta). Amostra 48 pontos por segmento. Devolve { i: segmento, t, d: distância, pt: ponto } ou null.
- **`splitSegment(a, b, t)`** <sub>interna</sub> · [L164](../src/pen.js#L164) — Divide o segmento a→b em `t` (algoritmo de De Casteljau) e devolve o ponto novo JÁ com as alças certas; ajusta as alças de a e b. O desenho não muda: só ganha um ponto a mais no meio da curva.
- **`finish(close = false)`** <sub>interna</sub> · [L179](../src/pen.js#L179) — Termina o desenho: cria a camada-vetor se há 2+ pontos e volta para a ferramenta Mover.
  - `[close=false]` <sub>boolean</sub> — true fecha o caminho (liga o último ponto ao primeiro)
- **`removeLast()`** <sub>interna</sub> · [L194](../src/pen.js#L194) — Backspace durante o desenho: tira o ÚLTIMO ponto (sem pontos, cancela o caminho). Devolve true se tratou.
- **`down(e)`** <sub>interna</sub> · [L210](../src/pen.js#L210) — Clique da caneta. Clicar perto (<9px de tela) do 1º ponto, com 2+ pontos, FECHA o caminho. Senão adiciona um ponto de canto e começa um possível arrasto (que viraria alças de Bézier). O frame sob o primeiro clique vira o pai da camada final. Clicar na PONTA de um vetor aberto selecionado CONTINUA aquele caminho (como a caneta do Illustrator).
  - ↩︎ o gesto de arrasto, ou null se o caminho foi fechado
- **`move(e)`** <sub>interna</sub> · [L241](../src/pen.js#L241) — Movimento do mouse: atualiza o "elástico" até o cursor (preview do próximo segmento) e, se está arrastando após o clique, define as alças: hout segue o mouse e hin é o ESPELHO em torno do ponto (curva suave). Só vira arrasto após 3px (cliques tremidos continuam sendo pontos de canto).
- **`up()`** <sub>interna</sub> · [L265](../src/pen.js#L265) — Soltou o mouse: se estava editando um ponto/alça, ajusta a caixa do vetor e grava no histórico (1 desfazer).
- **`editNode()`** <sub>interna</sub> · [L283](../src/pen.js#L283) — Vetor em edição (ou null).
- **`toLocal(n, w)`** <sub>interna</sub> · [L289](../src/pen.js#L289) — Mundo → espaço do vetor (o "viewBox" vw×vh). Desfaz a rotação da camada (rotação inversa em torno do centro) e converte a posição na caixa para o sistema de coordenadas dos pontos.
- **`toWorld(n, p)`** <sub>interna</sub> · [L297](../src/pen.js#L297) — Espaço do vetor → mundo (o inverso de toLocal), considerando a rotação da camada. Usado para desenhar os pontos na tela.
- **`startEdit(id)`** <sub>interna</sub> · [L305](../src/pen.js#L305) — Entra no modo de edição de pontos de um vetor (duplo clique ou Enter).
- **`exitEdit()`** <sub>interna</sub> · [L315](../src/pen.js#L315) — Sai da edição de pontos.
- **`downEdit(e, kind, idx)`** <sub>interna</sub> · [L329](../src/pen.js#L329) — Clicou num ponto ou alça. `kind`: 'pt' (ponto), 'hin' ou 'hout' (alças).

   - Shift+clique num ponto: soma/tira o ponto da seleção (sem arrastar).
   - Alt+clique num ponto: converte canto ↔ suave (como a ferramenta "converter ponto" do Illustrator).
   - Clique/arrasto: seleciona o ponto (se já está num grupo selecionado, o grupo todo vai junto).
- **`moveEditHandle(world, e)`** <sub>interna</sub> · [L358](../src/pen.js#L358) — Arrasta ponto ou alça (converte o mouse para o espaço do vetor).

   - Ponto: leva as próprias alças junto.
   - Alça: a alça oposta segue o modo do ponto (espelhada, assimétrica ou independente) — Alt torna independente.
- **`togglePointType(idx)`** <sub>interna</sub> · [L392](../src/pen.js#L392) — Alterna o ponto entre CANTO (sem alças) e SUAVE. Ao suavizar, cria alças opostas e proporcionais à direção entre o ponto anterior e o próximo (quarto da distância), que dá uma curva natural.
- **`deletePoint()`** <sub>interna</sub> · [L405](../src/pen.js#L405) — Remove os pontos selecionados (o caminho mantém no mínimo 2 pontos).
- **`addPointAt(e, { drag: startDrag = false } = {})`** <sub>interna</sub> · [L421](../src/pen.js#L421) — Alt+clique no traço: insere um ponto no lugar do traço mais perto do clique, MEDINDO NA CURVA (nearestOnPath) e dividindo o segmento (splitSegment): num trecho curvo o ponto novo nasce com as alças certas e o desenho não muda.
- **`onSegment(e)`** <sub>interna</sub> · [L443](../src/pen.js#L443) — O clique (px de tela) caiu em cima do traço do vetor em edição (a menos de 6px)?
- **`hover(e)`** <sub>interna</sub> · [L455](../src/pen.js#L455) — Mostra um pontinho no traço onde o clique adicionaria um ponto (feedback antes de clicar): perto do traço (6px), ou num raio maior (18px) com Alt. Não aparece em cima de um ponto ou alça.
- **`scaleOf(n)`** <sub>interna</sub> · [L471](../src/pen.js#L471) — Escala do espaço do vetor (vw×vh) para px da camada.
- **`pointType()`** <sub>interna</sub> · [L477](../src/pen.js#L477) — Tipo do ponto selecionado: 'corner' (sem alças), 'mirror' (espelhadas), 'asym' (assimétricas) ou 'free' (independentes). Ver geom.js → pointMode.
- **`setPointType(type)`** <sub>interna</sub> · [L487](../src/pen.js#L487) — Define o tipo dos pontos selecionados: 'corner' tira as alças; 'mirror' deixa as duas alças iguais e opostas; 'asym' alinha as alças mantendo os comprimentos; 'free' marca o ponto como independente (cria alças se não houver). ('smooth' é aceito como sinônimo de 'mirror', por compatibilidade.)
- **`pointPos()`** <sub>interna</sub> · [L513](../src/pen.js#L513) — Posição do ponto selecionado em px, relativa ao PAI da camada (como o X/Y da camada): { x, y } ou null.
- **`setPointPos(axis, v)`** <sub>interna</sub> · [L525](../src/pen.js#L525) — Move o ponto selecionado para X ou Y (px relativos ao pai), levando as alças junto. NÃO grava no histórico: quem chama (o campo numérico do painel) faz o commit ao terminar.
- **`nudge(dx, dy)`** <sub>interna</sub> · [L540](../src/pen.js#L540) — Setas movem o ponto selecionado (px do pai; Shift = 10). Devolve true se tratou a tecla.
- **`reverse(id)`** <sub>interna</sub> · [L560](../src/pen.js#L560) — Inverte a direção do caminho (o primeiro ponto vira o último). O desenho não muda; setas de preenchimento e animações de traço sim.
- **`pathD(id)`** <sub>interna</sub> · [L576](../src/pen.js#L576) — O atributo `d` do SVG deste vetor (todos os contornos), no espaço próprio dele (viewBox 0 0 vw vh).
- **`applyPathD(id, d)`** <sub>interna</sub> · [L586](../src/pen.js#L586) — Substitui o desenho do vetor pelo `d` de um SVG (aceita M L H V C S Q T A Z, absolutos e relativos). Só mexe na geometria: cor, contorno, nome e posição continuam. A caixa passa a ter o tamanho do desenho colado.
  - ↩︎ `boolean` false se o texto não tem nenhum caminho
- **`continueAt(e)`** <sub>interna</sub> · [L619](../src/pen.js#L619) — Cliques da caneta na PONTA de um vetor aberto que está selecionado CONTINUAM aquele caminho: devolve um caminho em desenho (ui.pen) já com os pontos do vetor, com a ponta clicada no fim. Não vale para vetor girado ou com furos.
- **`marqueeStart(e, onBody)`** <sub>interna</sub> · [L636](../src/pen.js#L636) — Começa um retângulo de seleção de PONTOS (arrastar no vazio durante a edição). Shift soma à seleção atual.
- **`marqueeMove(e, d)`** <sub>interna</sub> · [L643](../src/pen.js#L643) — Atualiza o retângulo e seleciona os pontos que caem dentro dele.
- **`marqueeEnd(d)`** <sub>interna</sub> · [L661](../src/pen.js#L661) — Soltou: sem arrastar, clicar no vazio limpa os pontos (e, fora do vetor, sai da edição e desmarca).
- **`selectAll()`** <sub>interna</sub> · [L670](../src/pen.js#L670) — Seleciona todos os pontos do vetor em edição (Ctrl+A).
- **`selectedCount()`** <sub>interna</sub> · [L678](../src/pen.js#L678) — Quantos pontos estão selecionados.
- **`openAfter()`** <sub>interna</sub> · [L684](../src/pen.js#L684) — "Abrir aqui": num caminho FECHADO, corta o segmento logo DEPOIS do ponto selecionado e o caminho vira aberto (o ponto seguinte passa a ser o início). É a tesoura do Illustrator, em versão simples.
- **`setClosed(id, closed)`** <sub>interna</sub> · [L700](../src/pen.js#L700) — Fecha ou abre o caminho (liga/desliga o segmento do último ponto ao primeiro).
- **`pencilDown(e)`** <sub>interna</sub> · [L714](../src/pen.js#L714) — Começa um traço do lápis. O frame sob o clique vira o pai do vetor.
- **`pencilMove(e)`** <sub>interna</sub> · [L720](../src/pen.js#L720) — Arrastando o lápis: guarda os pontos (só os que andaram ≥1px de tela, para não acumular repetidos).
- **`pencilUp()`** <sub>interna</sub> · [L731](../src/pen.js#L731) — Soltou o lápis: simplifica e ajusta curvas (geom.js → smoothStroke) e cria o vetor. Se o traço termina perto do começo (<12px de tela), o caminho é FECHADO. Traço curto demais (um clique) não cria nada.
- **`overlaySvg()`** <sub>interna</sub> · [L775](../src/pen.js#L775) — Markup SVG (em px de tela) do que a caneta mostra: o caminho em construção com o "elástico" até o cursor, os pontos (o primeiro em rosa, indica onde fechar) e as alças; ou, na edição, os pontos do vetor (e as alças do ponto selecionado). Elementos com data-edit/data-idx são clicáveis (tools.js os reconhece).
- **`isDrawing()`** <sub>interna</sub> · [L819](../src/pen.js#L819) — Está desenhando um caminho novo?
- **`isEditing()`** <sub>interna</sub> · [L821](../src/pen.js#L821) — Está editando os pontos de um vetor?

---

## src/present.js

**MODO APRESENTAR (O DESIGN NUM NAVEGADOR DE VERDADE)** · [abrir o código](../src/present.js)

```text
 Cada tela é o HTML + CSS EXPORTADOS (css.js → exportHtml) dentro de um <iframe>: rolagem, :hover, :focus,
 sticky, @media e fontes funcionam como num site publicado. Por cima, uma barra de navegador: voltar/avançar,
 recarregar, endereço com a lista de telas, larguras (desenhada, responsiva ou fixas) e "abrir em nova aba".
 As interações da aba Protótipo (clicar/passar o mouse → navegar, voltar, link) são ligadas dentro do iframe
 pelo atributo data-node-id. Enquanto aberta, a apresentação se atualiza sozinha quando o documento muda.
```

- **`TRANSITIONS`** <sub>do módulo</sub> · [L17](../src/present.js#L17) — Transições entre telas (Web Animations no quadro do iframe). 'instant' = troca seca.
- **`TRANSITION_OPTIONS`** · [L26](../src/present.js#L26) — Lista [valor, rótulo] das transições, para o menu da aba Protótipo.
- **`PRESENT_WIDTHS`** · [L31](../src/present.js#L31) — Larguras da barra: [valor, rótulo]. 'auto' = largura desenhada da tela; 'fill' = a janela toda (responsivo).
- **`presentHtml(frame, doc)`** · [L36](../src/present.js#L36) — HTML de uma tela para a apresentação: o mesmo da exportação, com `data-node-id` em cada elemento.
- **`createPresent({ store })`** · [L52](../src/present.js#L52) — Cria o modo APRESENTAR.

   - open(id): abre na tela da camada selecionada (ou na marcada como ponto de partida, ou na primeira)
   - Esc fecha · R reinicia · Alt+← / Alt+→ voltam e avançam
- **`frames()`** <sub>interna</sub> · [L59](../src/present.js#L59) — Todos os frames do documento (de todas as páginas): destinos possíveis das interações.
- **`rootOf(id)`** <sub>interna</sub> · [L67](../src/present.js#L67) — Tela (frame raiz) que contém a camada.
- **`layout()`** <sub>interna</sub> · [L75](../src/present.js#L75) — Largura do iframe e escala para caber no espaço disponível.
- **`wire(frameEl)`** <sub>interna</sub> · [L93](../src/present.js#L93) — Liga as interações do protótipo dentro do documento do iframe.
- **`run(it)`** <sub>interna</sub> · [L136](../src/present.js#L136) — Executa uma interação: link externo, voltar, ou navegar para outra tela.
- **`show(frameId, transition = 'instant', push = true)`** <sub>interna</sub> · [L144](../src/present.js#L144) — Monta o iframe da tela. `push` = entra no histórico (navegação normal).
- **`openTab()`** <sub>interna</sub> · [L190](../src/present.js#L190) — Abre numa aba nova do navegador a tela atual, como página HTML independente.
- **`open(startId)`** <sub>interna</sub> · [L199](../src/present.js#L199) — Abre a apresentação. Devolve false se não há nenhuma tela.
- **`renderTabs()`** <sub>interna</sub> · [L271](../src/present.js#L271) — A ordem de apresentação é local à sessão e não altera a ordem das camadas no documento.
- **`onKey(e)`** <sub>interna</sub> · [L304](../src/present.js#L304) — Teclas (captura antes do editor). As demais são engolidas para não mexer no editor por trás.
- **`close()`** <sub>interna</sub> · [L331](../src/present.js#L331) — Fecha a apresentação e remove os ouvintes globais.

---

## src/rulers.js

**RÉGUAS E CRIAÇÃO DE GUIAS** · [abrir o código](../src/rulers.js)

- **`RULER`** · [L8](../src/rulers.js#L8) — Espessura das réguas em px (a de cima tem 20px de altura; a da esquerda, 20px de largura).
- **`createRulers({ store, canvas, stage, commands, onManageGuides })`** · [L16](../src/rulers.js#L16) — Cria as RÉGUAS (topo e esquerda) e a criação de GUIAS: arrastar a partir da régua cria uma linha-guia que o snap enxerga; arrastar a guia de volta para a régua a apaga. As réguas são <canvas> 2D desenhados com a vista atual (pan/zoom) e destacam a faixa da seleção em azul. Guias são dados da página (page.guides: [{axis, pos}]); quem as DESENHA é o overlay.js.
- **`css(name)`** <sub>interna</sub> · [L39](../src/rulers.js#L39) — Lê uma variável CSS do tema atual (as réguas usam as mesmas cores dos painéis, claro ou escuro).
- **`step(zoom)`** <sub>interna</sub> · [L45](../src/rulers.js#L45) — Escolhe o intervalo entre marcações (1, 2, 5, 10, 20, 50, 100…) para que fiquem a ≥60px uma da outra na tela, qualquer que seja o zoom — a régua nunca fica poluída nem vazia.
- **`draw()`** <sub>interna</sub> · [L56](../src/rulers.js#L56) — Redesenha as duas réguas: fundo, faixa translúcida da seleção, marcas e números. Rótulos da régua da esquerda ficam girados em −90°. Considera o devicePixelRatio para ficar nítida em telas HiDPI.
- **`bind(el, axis)`** <sub>interna</sub> · [L126](../src/rulers.js#L126) — Liga o arrasto numa régua: durante o arrasto mostra a guia + a posição; ao soltar, cria a guia — mas só se o mouse estiver DENTRO da área do canvas (soltar em cima da régua cancela).
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

- **`THUMB_EVERY_MS`** <sub>do módulo</sub> · [L26](../src/saving.js#L26) — Intervalo mínimo entre duas miniaturas do mesmo projeto: gerar SVG da página toda a cada tecla seria desperdício.
- **`createSaving({ prefs, toast, thumbnail = () => null })`** · [L37](../src/saving.js#L37) — Cria o SALVAMENTO: decide quando e onde gravar (navegador sempre; pasta do computador quando o projeto está ligado a um arquivo), reconcilia ao abrir (navegador × pasta, avisando conflito) e envia as miniaturas.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — o store (criado DEPOIS: use `attach(store)`)
  - `deps.prefs` <sub>object</sub> — preferências (prefs.autoFolder: auto-salvar na pasta; padrão ligado)
  - `deps.toast` <sub>(msg: string) => void</sub> — 
  - `[deps.thumbnail]` <sub>() => string\|null</sub> — gera a miniatura SVG da página aberta (ver thumbnail.js)
- **`server`** <sub>interna</sub> · [L42](../src/saving.js#L42) — Situação do servidor: { ok, folder, keepVersions } ou null (sem servidor). Atualizada por refresh().
- **`refresh()`** <sub>interna</sub> · [L50](../src/saving.js#L50) — Pergunta ao servidor se ele está aí e qual é a pasta. Guarda em store.ui.server para os painéis mostrarem. Se o servidor VOLTOU e a pasta tinha ficado para trás, agenda um salvamento para pô-la em dia.
- **`reconcile()`** <sub>interna</sub> · [L73](../src/saving.js#L73) — Ao ABRIR o app com um projeto ligado a um arquivo: a cópia do navegador e o arquivo da pasta podem divergir. Decidimos SEM comparar relógios, com duas perguntas:

    (a) o arquivo mudou desde a última vez que o vimos?  (data do disco ≠ link.modified)
    (b) o navegador tem mudanças que ainda não foram para a pasta?  (link.synced === false)

               | (b) não                          | (b) sim
    (a) não    | tudo em dia                      | grava na pasta agora (seguro: o arquivo é o que conhecemos)
    (a) sim    | abre o do disco (é o mais novo)  | CONFLITO: mantém o do navegador, não grava; Ctrl+S decide

  Caso real do (a)-sim/(b)-não: a última gravação na pasta aconteceu ao fechar a aba, mas a cópia do navegador
  não terminou de anotar a data nova. Arquivo sumiu da pasta → desliga o vínculo (o projeto continua no navegador).
- **`persist(record)`** <sub>interna</sub> · [L110](../src/saving.js#L110) — Chamado pelo store a cada salvamento automático. Grava na pasta (se ligado e permitido) e no navegador. Ordem importa: pasta PRIMEIRO, para a cópia do navegador já guardar a data nova do arquivo (senão, ao recarregar, o editor acharia que o arquivo "mudou por fora" e acusaria conflito à toa).
  - ↩︎ `Promise<'folder'\|'browser'>` onde o projeto ficou salvo
- **`recoverConflictCopy(link = store.ui.link)`** <sub>interna</sub> · [L144](../src/saving.js#L144) — Depois que a pessoa dá um nome à cópia conflitante, separa o autosave desta aba do documento compartilhado.
- **`sendThumb(file, { force = false } = {})`** <sub>interna</sub> · [L161](../src/saving.js#L161) — Gera e envia a miniatura do projeto (no máximo 1 a cada 15 s por arquivo; `force` ignora o intervalo). Roda "por fora": não atrasa o salvamento e, se falhar, só fica sem miniatura nova.
- **`quickSave()`** <sub>interna</sub> · [L178](../src/saving.js#L178) — Ctrl+S. Projeto ligado a um arquivo → grava agora. Em conflito → pergunta se substitui o arquivo do disco. Não ligado → devolve false (quem chamou abre a janela "Projetos" para escolher o nome). Sem servidor → baixa o .json (o comportamento antigo).
  - ↩︎ `Promise<boolean>` true se resolveu sozinho
- **`saveAs(file, { overwrite = false } = {})`** <sub>interna</sub> · [L211](../src/saving.js#L211) — Grava o projeto atual com o nome `file` e liga o projeto a ele. Se já existir outro arquivo com esse nome, pergunta antes de substituir. @returns {Promise<boolean>} true se gravou
- **`open(file)`** <sub>interna</sub> · [L261](../src/saving.js#L261) — Abre um projeto da pasta (salvando o atual antes) e liga o editor ao arquivo.
- **`openVersion(file, id)`** <sub>interna</sub> · [L272](../src/saving.js#L272) — Abre uma VERSÃO ANTIGA como projeto solto (não ligado a arquivo), para você conferir sem estragar o atual. Para restaurar, use "Salvar na pasta" com o mesmo nome e confirme a substituição.
- **`renameFile(file, newName)`** <sub>interna</sub> · [L282](../src/saving.js#L282) — Renomeia um projeto da pasta. Se for o projeto aberto, o vínculo passa para o nome novo.
  - ↩︎ `Promise<string\|null>` o nome final do arquivo, ou null se não deu
- **`duplicateFile(file)`** <sub>interna</sub> · [L295](../src/saving.js#L295) — Cria uma cópia de um projeto da pasta ("nome-copia.json", "nome-copia-2.json"...). Não abre a cópia.

---

## src/site-export.js

- **`exportSite(doc)`** · [L53](../src/site-export.js#L53) — _(sem comentário)_
  - ↩︎ `{files: {path: string, content: string` [], warnings: string[]}}

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
- **`LEGACY_KEY`** <sub>do módulo</sub> · [L28](../src/storage.js#L28) — Chave antiga do localStorage (versões ≤ 0.5). Lida uma vez para migrar.
- **`PREF_KEY`** <sub>do módulo</sub> · [L30](../src/storage.js#L30) — Preferências de interface (largura dos painéis, auto-salvar na pasta...) — pequenas, ficam no localStorage.
- **`editorTabId()`** <sub>do módulo</sub> · [L49](../src/storage.js#L49) — Identifica esta aba durante a sessão para separar seus rascunhos e projetos depois de um conflito.
- **`db()`** <sub>do módulo</sub> · [L89](../src/storage.js#L89) — Abre (uma vez) o banco IndexedDB. Rejeita se o navegador não oferecer (ex.: algumas janelas anônimas).
- **`tx(mode, fn)`** <sub>do módulo</sub> · [L101](../src/storage.js#L101) — Executa uma operação numa transação e devolve o resultado como Promise.
- **`useIdb`** <sub>do módulo</sub> · [L114](../src/storage.js#L114) — Usa o IndexedDB? Se falhar uma vez, caímos para o localStorage pelo resto da sessão.
- **`loadLocal()`** · [L120](../src/storage.js#L120) — Lê o projeto guardado no navegador. Ordem: IndexedDB → (migração) localStorage antigo → null.
  - ↩︎ `Promise<{doc, views?, theme?, link?, savedAt?` \|null>}
- **`saveLocal(record)`** · [L181](../src/storage.js#L181) — Grava o projeto no navegador. `record` = { doc, views, theme, link }. No IndexedDB o objeto é copiado na hora da chamada (structured clone), então pode continuar sendo editado. Depois da primeira gravação bem-sucedida no IndexedDB, apaga a cópia antiga do localStorage (migração concluída).
- **`forkLocalProject(record)`** · [L254](../src/storage.js#L254) — Separa uma cópia conflitante depois que a pessoa a salvou explicitamente como outro projeto.
- **`listLocalProjects()`** · [L290](../src/storage.js#L290) — Lista projetos e rascunhos locais recuperáveis, inclusive os de abas já fechadas.
- **`openLocalProject(key)`** · [L328](../src/storage.js#L328) — Abre uma cópia recuperável listada por listLocalProjects.
- **`deleteLocalProject(key)`** · [L349](../src/storage.js#L349) — Remove uma cópia local antiga; protege o documento que a aba está editando agora.
- **`isActiveLocalProject(key)`** · [L363](../src/storage.js#L363) — Informa se a chave aponta para o documento que esta aba está editando.
- **`browserUsage()`** · [L369](../src/storage.js#L369) — Espaço usado/disponível para este site (quando o navegador informa).
- **`requestPersistence()`** · [L382](../src/storage.js#L382) — Pede ao navegador para NÃO apagar os dados deste site quando faltar espaço (armazenamento "persistente"). O Chrome costuma aceitar sozinho para sites usados com frequência; o Firefox pode perguntar.
- **`loadPrefs()`** · [L388](../src/storage.js#L388) — Lê as preferências de interface (objeto vazio se não houver ou estiverem corrompidas).
- **`savePrefs(prefs)`** · [L392](../src/storage.js#L392) — Grava as preferências (falha em silêncio: são só conveniências).
- **`call(path, { method = 'GET', body, headers = {}, raw = false } = {})`** <sub>do módulo</sub> · [L403](../src/storage.js#L403) — Faz um pedido à API e devolve o JSON (ou lança ServerError com a mensagem do servidor).
- **`fileNameFor(name)`** · [L419](../src/storage.js#L419) — Converte o nome do projeto num nome de arquivo aceito pelo servidor: "Meu App!" → "meu-app.json".
- **`serialize(doc)`** <sub>do módulo</sub> · [L428](../src/storage.js#L428) — Projeto pronto para gravar em arquivo: o MESMO formato do "Baixar .json" (um arquivo baixado pode ir para a pasta e vice-versa).
- **`folder`** · [L434](../src/storage.js#L434) — API da pasta. Todas as funções lançam ServerError quando o servidor recusa e TypeError quando não há servidor (ex.: o app foi aberto por outro servidor estático, como `python -m http.server`).

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

- **`createStore({ initial = null, persist = async () => 'browser' } = {})`** · [L39](../src/store.js#L39) — Cria o STORE: a única fonte de verdade do app. Tudo que o usuário vê (canvas, painéis, menus) é uma função do que está aqui; e toda mudança passa por aqui. Fluxo:

    ação do usuário → store.update(...)/commit() → emit(motivo) → quem assina (canvas, painéis) redesenha

  O que o store guarda:
    state.doc  → o DOCUMENTO (o que é salvo): páginas, camadas, imagens, estilos
    state.ui   → estado de INTERFACE (não é salvo no .json): seleção, ferramenta, zoom, painel aberto...
  - `[opts]` <sub>object</sub> — 
  - `[opts.initial]` <sub>object\|null</sub> — projeto já carregado do navegador ({ doc, views, theme, link }) — ver storage.loadLocal. null/ausente = abre o projeto de exemplo.
  - `[opts.persist]` <sub>(record) => Promise<string></sub> — grava o projeto (navegador e, se ligado, a pasta). Devolve onde gravou ('browser' \| 'folder'). O store só decide QUANDO salvar; o COMO fica em main.js/storage.js.
  - ↩︎ `object` a API do store (get, update, commit, undo, setSelection, subscribe...)
- **`emit(reason)`** <sub>interna</sub> · [L119](../src/store.js#L119) — Avisa que algo mudou, dizendo o MOTIVO ('doc' | 'selection' | 'view' | 'tool' | 'history' | 'ui' | 'overlay' | 'hover'...). Dois canais de entrega, de propósito:

   - síncrono (subscribeSync): o canvas e o overlay precisam estar em dia ANTES do próximo evento do mouse,
     senão medem o DOM desatualizado durante um arrasto;
   - 1x por frame (subscribe): painéis pesados (camadas, propriedades) juntam vários motivos em uma só atualização.
- **`index()`** <sub>interna</sub> · [L144](../src/store.js#L144) — Índice id → { node, parent, list, i, page } de TODAS as camadas de todas as páginas. É reconstruído só quando `version` mudou (estrutura nova), o que torna get(id) barato mesmo com milhares de camadas. `list` é o array onde o nó vive (page.children ou parent.children) e `i` a posição dele nesse array.
- **`restore(snap)`** <sub>interna</sub> · [L232](../src/store.js#L232) — Volta o documento para uma foto do histórico (usado por desfazer/refazer). Mantém a seleção do que ainda existe.
- **`scheduleSave()`** <sub>interna</sub> · [L383](../src/store.js#L383) — Agenda o salvamento automático para 400 ms depois da ÚLTIMA mudança (debounce): editar 50 vezes seguidas grava só 1 vez. Marca saveState='saving' para o topo mostrar "Salvando…".
- **`save()`** <sub>interna</sub> · [L398](../src/store.js#L398) — Grava o projeto chamando `persist` (navegador + pasta, ver main.js). Só UMA gravação por vez: se algo mudar enquanto grava, marcamos `dirtyAgain` e gravamos de novo ao terminar (a última versão nunca se perde). Se falhar, saveState vira 'error' e `onSaveError` avisa o usuário.
  - ↩︎ `Promise<void>` resolve quando o projeto (como estava) terminou de ser gravado
- **`init()`** <sub>interna</sub> · [L455](../src/store.js#L455) — Estado inicial: usa o projeto que main.js já leu do navegador (`initial`); se não houver, abre o exemplo. Campos novos (assets, styles) são preenchidos para aceitar projetos salvos por versões antigas do app.

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
- **`filterAttr(node)`** <sub>interna</sub> · [L120](../src/svg.js#L120) — Sombra externa, blur e filtros de cor da camada como <filter> (feDropShadow + feGaussianBlur). stdDeviation = blur/2 porque o "blur" do CSS corresponde a ~2× o desvio-padrão do SVG. A área do filtro é ampliada (−50%…200%) para a sombra não ser cortada.
- **`textSvg(node, w, h)`** <sub>interna</sub> · [L137](../src/svg.js#L137) — Texto em SVG: uma <tspan> por linha (SVG não quebra linha sozinho). Calcula o deslocamento vertical para 'centro'/'embaixo' quando a caixa tem altura fixa e aplica text-transform na própria string (SVG não tem isso).
- **`imageSvg(fill, w, h, src)`** <sub>interna</sub> · [L162](../src/svg.js#L162) — Conteúdo SVG de uma IMAGEM de fundo dentro da caixa w×h, imitando o CSS do editor:

   - cover/contain/fill → <image preserveAspectRatio>; a posição (posX/posY) vira o alinhamento mais próximo entre 3
     (início/meio/fim) — o SVG não tem posição em %, então nesses ajustes é uma aproximação;
   - tamanho próprio ('size') → posição e tamanho EXATOS (usa natW/natH, o tamanho original guardado ao escolher a
     imagem); com repeat vira <pattern> (ladrilho). Sem natW/natH cai no "cobrir".
  (Repetir junto com "conter" não é exportado: sai uma imagem só.)
- **`shapeSvg(node, w, h)`** <sub>interna</sub> · [L188](../src/svg.js#L188) — Forma + contorno de retângulo/elipse/frame/vetor. Retângulos sem cantos viram <rect> simples (mais limpo); com cantos/elipse/vetor viram <path>. Imagem: <image> recortada pela forma, com o mesmo `fit` do editor.
- **`render(node, parent, isRoot)`** <sub>interna</sub> · [L250](../src/svg.js#L250) — Converte UMA camada (recursivo) em <g>. Ordem das transformações: posição (translate) → rotação em torno do centro → espelhamento. Frames com "cortar conteúdo" recortam os filhos por <clipPath>; grupos com máscara usam a forma da camada-máscara como clipPath.

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
- **`startComment(e, hitId)`** <sub>interna</sub> · [L366](../src/tools.js#L366) — Clique da ferramenta Comentar: guarda um RASCUNHO (camada + ponto relativo à caixa dela) e abre o painel Comentários com a caixa de texto já focada. Quem cria o comentário é o painel, quando você envia.
- **`startMove(e, { collapseTo })`** <sub>interna</sub> · [L382](../src/tools.js#L382) — Prepara o arrasto de mover as camadas selecionadas. `collapseTo`: se for só um clique (sem arrastar) numa seleção múltipla, reduz a seleção a essa camada.
- **`rebase(nodes)`** <sub>interna</sub> · [L397](../src/tools.js#L397) — Guarda o ponto de partida dos itens em coordenadas de MUNDO (origem + caixa). A posição final é sempre "origem inicial + deslocamento do ponteiro − origem do pai atual", então continua certa mesmo que o pai mude no meio do arrasto (quando a camada passa por cima de outro frame).
- **`snapCandidates()`** <sub>interna</sub> · [L407](../src/tools.js#L407) — Retângulos com os quais o item que se move pode "grudar" (snap): os irmãos e o pai. Calculado uma vez por arrasto (cache em drag.snapRects) porque os vizinhos não mudam enquanto você arrasta.
- **`snapMove(dx, dy)`** <sub>interna</sub> · [L425](../src/tools.js#L425) — SNAP: ajusta o deslocamento (dx, dy) para que bordas e centros do item alinhem com os dos vizinhos e com as guias de régua, quando estiverem a menos de 6px de TELA (6/zoom no mundo). Devolve também as linhas-guia rosa a desenhar onde houve alinhamento exato. Ctrl desliga o snap (no chamador).
  - ↩︎ `{dx:number, dy:number, guides:object[]` }
- **`flowReorder(node, p, parent = store.parentOf(node.id))`** <sub>interna</sub> · [L466](../src/tools.js#L466) — Dentro de um auto layout o item NÃO tem posição livre; arrastar significa REORDENAR. Acha o irmão cujo centro está mais perto do ponteiro e põe o item antes ou depois dele (conforme o ponteiro esteja antes/depois do centro dele no eixo principal). Funciona também com flex-wrap, porque usa distância 2D.
- **`moveDrag(e)`** <sub>interna</sub> · [L496](../src/tools.js#L496) — Cada movimento do mouse durante o gesto "mover". Passos: 1. passou do limiar? Se Alt estava pressionado, duplica e passa a arrastar as cópias 2. se o ponteiro entrou noutro frame, troca o pai da camada (mantendo a posição visual) 3. calcula o deslocamento (Shift trava o eixo), aplica snap (Ctrl desliga) 4. aplica: camadas livres recebem x/y; camadas em auto layout são reordenadas 5. camadas em auto layout ganham um "fantasma" (CSS `translate`) que segue o ponteiro
- **`startResize(e, handle)`** <sub>interna</sub> · [L588](../src/tools.js#L588) — Prepara o redimensionar. `hx`/`hy` dizem qual lado a alça move: hx=+1 direita, −1 esquerda; hy=+1 baixo, −1 cima (0 = não mexe nesse eixo; alça 'e' é hx=1,hy=0; canto 'nw' é hx=−1,hy=−1). Guarda o estado inicial para recalcular tudo a partir dele a cada movimento (evita acumular erro de arredondamento).
- **`resizeDrag(e)`** <sub>interna</sub> · [L614](../src/tools.js#L614) — Cada movimento do mouse ao redimensionar.

   - UMA camada: converte o deslocamento do mouse para os eixos LOCAIS da camada (desfazendo a rotação), muda w/h e
     recalcula x/y para que o lado OPOSTO (a âncora) fique parado no mundo — funciona com a camada girada.
     Shift mantém a proporção; Alt redimensiona a partir do centro.
   - VÁRIAS camadas: escala o conjunto pela caixa envolvente.
   - Grupos escalam os filhos; frames reaplicam as constraints dos filhos a partir do tamanho original.
- **`snapResize(dx, dy, hx, hy)`** <sub>interna</sub> · [L712](../src/tools.js#L712) — SNAP do redimensionar: só a borda que a alça move (direita/esquerda, baixo/cima) procura um alvo a menos de 6px de tela — bordas e centro do frame pai e dos vizinhos, e as guias da régua. É o que deixa você fazer uma camada exatamente do tamanho do frame (ou alinhada com a de cima) sem precisar acertar o pixel.
  - ↩︎ `{dx:number, dy:number, guides:object[]` } deslocamento do mouse já ajustado + linhas rosa a desenhar
- **`startRotate(e)`** <sub>interna</sub> · [L757](../src/tools.js#L757) — Prepara a rotação: guarda o centro da camada (em px de tela), a rotação inicial e o ângulo do mouse em relação ao centro.
- **`rotateDrag(e)`** <sub>interna</sub> · [L773](../src/tools.js#L773) — Rotação = rotação inicial + (ângulo atual do mouse − ângulo inicial). Shift prende em múltiplos de 15°. Resultado em −180..180.
- **`startDraw(e, tool)`** <sub>interna</sub> · [L788](../src/tools.js#L788) — Começa a desenhar com a ferramenta ativa. O frame sob o cursor vira o PAI da camada nova (posição relativa a ele). Retângulo/elipse/frame/linha já nascem no documento (tamanho 1) e crescem durante o arrasto, para você ver ao vivo. Texto, polígono e estrela só são criados ao soltar.
- **`drawDrag(e)`** <sub>interna</sub> · [L828](../src/tools.js#L828) — Durante o desenho: ajusta a camada ao retângulo arrastado (Shift = quadrado/ângulos de 15°; Alt = a partir do centro). A linha é um segmento girado; polígono/estrela mostram só o retângulo-guia (marquee) até soltar.
- **`finishDraw(d, e)`** <sub>interna</sub> · [L872](../src/tools.js#L872) — Ao soltar o mouse com uma ferramenta de desenho. Um clique SEM arrastar cria o tamanho padrão (frame 320×240, retângulo/elipse 100×100, linha 100px, polígono/estrela 100×100). Texto entra direto em edição. A ferramenta volta para Mover (como no Figma).
- **`adoptIntoSection(sec)`** <sub>interna</sub> · [L918](../src/tools.js#L918) — Seção recém-desenhada "adota" as telas da raiz que ficaram TOTALMENTE dentro dela: elas passam a ser filhas da seção (e andam junto com ela), mantendo a posição visual e a ordem entre si. Telas só parcialmente dentro ficam de fora.
- **`enterFlow(node)`** <sub>interna</sub> · [L933](../src/tools.js#L933) — Forma recém-desenhada dentro de um auto layout (estava "solta" durante o arrasto): entra na fila na posição mais próxima de onde foi desenhada — entre os dois itens em volta do centro dela (flowReorder).
- **`guideDrag(e)`** <sub>interna</sub> · [L943](../src/tools.js#L943) — Arrasta uma guia de régua já existente (atualiza a posição ao vivo; soltar sobre a régua apaga — ver endDrag).
- **`startMarquee(e, scope, clickId)`** <sub>interna</sub> · [L957](../src/tools.js#L957) — Começa o retângulo de seleção por arrasto. `scope` = id do frame raiz onde o arrasto começou (seleciona só filhos dele) ou null (seleciona camadas da raiz). `clickId` = camada a selecionar se foi só um clique.
- **`marqueeDrag(e)`** <sub>interna</sub> · [L968](../src/tools.js#L968) — Atualiza o marquee e a seleção. Regra do Figma: frames da raiz só entram se estiverem TOTALMENTE dentro do retângulo; as demais camadas entram ao serem tocadas. Shift soma à seleção anterior.
- **`endDrag(e)`** <sub>interna</sub> · [L1045](../src/tools.js#L1045) — POINTER UP / CANCEL: encerra o gesto. Cada tipo faz sua limpeza e quase todos terminam com UM `store.commit()` — por isso um Ctrl+Z desfaz o arrasto/redimensionamento INTEIRO, não pixel a pixel. Também limpa guias, marquee e destaque temporários do overlay.
- **`isTyping(t)`** <sub>interna</sub> · [L1153](../src/tools.js#L1153) — O foco está num campo onde o usuário DIGITA (input, select, texto editável)? Então os atalhos do canvas não devem agir.
- **`covered()`** <sub>interna</sub> · [L1159](../src/tools.js#L1159) — O canvas está "coberto"? (página inicial aberta ou uma janela modal: Configurações, Projetos, pergunta...) Então NENHUM atalho do canvas pode agir — senão um Delete com o foco num botão da janela apagaria camadas escondidas atrás dela.
- **`MARKER`** <sub>interna</sub> · [L1356](../src/tools.js#L1356) — COPIAR/COLAR com a área de transferência do sistema. Camadas copiadas ficam na memória do app (ui.clipboard); no sistema colocamos só este texto-marcador, para o "colar" saber que é para colar CAMADAS e não texto.
- **`toggleProp(prop)`** <sub>interna</sub> · [L1383](../src/tools.js#L1383) — Alterna 'locked' ou 'visible' nas camadas selecionadas: se alguma não está no estado alvo, aplica a todas; senão desfaz em todas.
- **`copyCss()`** <sub>interna</sub> · [L1391](../src/tools.js#L1391) — Ctrl+Shift+C: copia o CSS das camadas selecionadas para a área de transferência do sistema.
- **`zoomTo(z)`** <sub>interna</sub> · [L1403](../src/tools.js#L1403) — Define o zoom (1 = 100%) ancorado no centro da vista.
- **`applyTool()`** <sub>interna</sub> · [L1409](../src/tools.js#L1409) — Reflete a ferramenta ativa no DOM (muda o cursor por CSS: [data-tool=…]).

---

## src/version.js

- **`VERSION`** · [L2](../src/version.js#L2) — Versão do app mostrada na página inicial. Mantida igual à do package.json (tests/versao.test.js confere).

---

## src/zip.js

- **`encoder`** <sub>do módulo</sub> · [L2](../src/zip.js#L2) — ZIP Store writer para bundles pequenos gerados pelo editor. Não precisa de dependências ou servidor.
- **`createZip(files)`** · [L46](../src/zip.js#L46) — Gera um ZIP Store (sem compressão) para manter o escritor mínimo e funcionar offline.

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

- **`createApprover()`** · [L30](../src/agent/bridge.js#L30) — Cria a função de permissão.
  - ↩︎ `(req: {client: string, tool: string, summary: string` ) => Promise<boolean>}
- **`allowed`** <sub>interna</sub> · [L32](../src/agent/bridge.js#L32) — Programas liberados até recarregar a página ("Permitir tudo nesta sessão").
- **`auto`** <sub>interna</sub> · [L34](../src/agent/bridge.js#L34) — Programas em "fazer sem perguntar" (opção do painel do Assistente, lembrada nas preferências).
- **`queue`** <sub>interna</sub> · [L36](../src/agent/bridge.js#L36) — Fila: cada pergunta espera a anterior terminar.
- **`connectMcpBridge({ runner, toast, profile = () => ({ name: 'Pessoa', color: '' }), o…)`** · [L90](../src/agent/bridge.js#L90) — Liga o editor à ponte do servidor (MCP) e à presença.
  - `deps` <sub>object</sub> — 
  - `deps.toast` <sub>(m: string) => void</sub> — 
  - `[deps.onPresence]` <sub>(data: object) => void</sub> — recebe o retrato de quem está no projeto
  - ↩︎ `{ close: () => void, reconnect: () => void ` }
- **`greeted`** <sub>interna</sub> · [L97](../src/agent/bridge.js#L97) — Avisa (uma vez por programa) que uma IA externa começou a usar o editor.

---

## src/agent/content.js

- **`DEFAULT_AGENT_CONTENT_BYTES`** · [L2](../src/agent/content.js#L2) — Limites para conteúdo de código devolvido ao agente: resposta moderada por padrão, nunca acima de 1 MiB.
- **`MAX_AGENT_CONTENT_BYTES`** · [L3](../src/agent/content.js#L3) — _(sem comentário)_
- **`agentContentLimit(value)`** · [L5](../src/agent/content.js#L5) — _(sem comentário)_
- **`boundedUtf8Chunk(value, { offset = 0, maxBytes = DEFAULT_AGENT_CONTENT_BYTES } = {})`** · [L14](../src/agent/content.js#L14) — Retorna uma parte UTF-8 segura de um texto. `offset` e `nextOffset` são posições em bytes e nunca cortam um caractere multibyte. O chamador usa `nextOffset` na chamada seguinte até `complete` ser true.

---

## src/agent/jev.js

**O JEV (TypeSafe) COMO "SEGUNDA OPINIÃO" RÁPIDA DO AGENTE** · [abrir o código](../src/agent/jev.js)

```text
 O Jev é um modelo "System One" da TypeSafe: não escreve texto, só responde perguntas FECHADAS com
 probabilidades, em menos de meio segundo e quase de graça. O agente usa para decisões limitadas:
   - jev_choose: escolher entre opções que ele já tem (ex.: 3 paletas, 2 estruturas de página);
   - jev_score:  dar nota numa rubrica (ex.: "o contraste desta tela está bom?" de 1 a 5);
   - jev_check:  a evidência sustenta a afirmação? (ex.: "o rodapé tem 3 colunas" × os dados do get_layer).
 Quem chama a API é o SERVIDOR (server.js → POST /api/agent/jev), com a chave JEV_API_KEY guardada lá: a chave
 nunca vai para o navegador. Sem chave, estas ferramentas nem são oferecidas ao modelo.
 Formato da API (POST {url}, Bearer): { state, model, questions: { id: { type: choice|score|noul, instructions,
 criteria } } } → { answers: { id: { choice, probabilities, confidence, score, legend, noul } }, usage, model }.
 Este arquivo só monta os pedidos e lê as respostas (sem rede): o servidor e os testes importam.
```

- **`JEV_URL`** · [L19](../src/agent/jev.js#L19) — Endereço padrão da API do Jev (TypeSafe System One).
- **`JEV_MODEL`** · [L21](../src/agent/jev.js#L21) — Modelo padrão do Jev.
- **`ADVISORY`** <sub>do módulo</sub> · [L23](../src/agent/jev.js#L23) — Aviso que vai junto de toda resposta: é um sinal, não uma ordem.
- **`JEV_TOOLS`** · [L27](../src/agent/jev.js#L27) — As 3 ferramentas do Jev no formato da OpenAI (o agente interno recebe só se houver chave).
- **`JEV_NAMES`** · [L80](../src/agent/jev.js#L80) — Nomes das ferramentas do Jev.
- **`isJevTool(name)`** · [L82](../src/agent/jev.js#L82) — É uma ferramenta do Jev?
- **`safeId(id, i)`** <sub>do módulo</sub> · [L87](../src/agent/jev.js#L87) — id de opção aceito pela API (o modelo às vezes manda "Opção 1"): vira opcao_1.
- **`buildJevRequest(tool, args = {})`** · [L102](../src/agent/jev.js#L102) — Monta o pedido à API do Jev para uma ferramenta. Lança Error com mensagem clara se os argumentos não servem.
  - `tool` <sub>string</sub> — jev_choose \| jev_score \| jev_check
  - `args` <sub>object</sub> — 
  - ↩︎ `{ state: object, questions: object, ids?: string[] ` }
- **`choiceConfidence(probs)`** <sub>do módulo</sub> · [L148](../src/agent/jev.js#L148) — Confiança de uma escolha: quanto a maior probabilidade passa do "chute" (1/n).
- **`readJevAnswer(tool, payload, req = {})`** · [L162](../src/agent/jev.js#L162) — Lê a resposta da API e devolve um resultado curto para o agente (com "decision").
  - `tool` <sub>string</sub> — 
  - `payload` <sub>object</sub> — corpo da resposta ({ answers, usage, model })
  - `[req]` <sub>object</sub> — o que buildJevRequest devolveu (para traduzir os ids de volta)

---

## src/agent/providers.js

**DE ONDE VEM A IA DO ASSISTENTE (provedores prontos)** · [abrir o código](../src/agent/providers.js)

```text
 Todos estes provedores falam o mesmo "idioma" (a API Chat Completions da OpenAI, com ferramentas): por isso o
 Assistente funciona com qualquer um, trocando só o endereço, a chave e o nome do modelo. Escolher um provedor em
 Configurações só preenche esses campos; dá para usar qualquer outro compatível em "Outro".

 Cada provedor guarda a SUA chave (trocar de OpenAI para NVIDIA e voltar não apaga nenhuma). As chaves ficam só
 no servidor local (designer.config.json) ou nas variáveis de ambiente indicadas em `envKey`.
 Só dados: o servidor e a tela de Configurações importam este mesmo arquivo.
```

- **`PROVIDERS`** · [L15](../src/agent/providers.js#L15) — _(sem comentário)_
- **`providerOf(baseUrl)`** · [L34](../src/agent/providers.js#L34) — Provedor de um endereço (ou null = "Outro"). Compara sem a barra final.
- **`isLocalUrl(baseUrl)`** · [L40](../src/agent/providers.js#L40) — O endereço é na própria máquina (Ollama, LM Studio)? Esses não precisam de chave.

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
   - falha assíncrona não restaura uma cópia velha se o documento mudou enquanto a ferramenta aguardava.
 Erros viram mensagens em português devolvidas à IA (ela lê e corrige), nunca quebram o editor.
```

- **`SIMPLE`** <sub>do módulo</sub> · [L31](../src/agent/runner.js#L31) — Campos simples (número, texto ou booleano) que podem ser copiados direto para a camada.
- **`SPECIAL`** <sub>do módulo</sub> · [L39](../src/agent/runner.js#L39) — Campos com tratamento próprio (ver applyProps).
- **`PROPS`** · [L41](../src/agent/runner.js#L41) — Tudo que update_layer / create_layer aceitam.
- **`ENUMS`** <sub>do módulo</sub> · [L43](../src/agent/runner.js#L43) — Valores válidos de alguns campos (o resto é conferido pelo tipo).
- **`hex(v)`** <sub>do módulo</sub> · [L51](../src/agent/runner.js#L51) — "#abc" / "#AABBCC" → "#AABBCC"; outra coisa → null.
- **`four(v, what)`** <sub>do módulo</sub> · [L58](../src/agent/runner.js#L58) — Número ou lista de 4 → lista de 4 (padding, margin, radius).
- **`applyProps(node, props, ctx = {})`** · [L71](../src/agent/runner.js#L71) — Aplica `props` numa camada (dentro de um store.update). Lança Error com mensagem clara se algo não vale.
  - `node` <sub>object</sub> — 
  - `props` <sub>object</sub> — 
- **`summarize(n, depth = 0)`** · [L144](../src/agent/runner.js#L144) — Resumo curto de uma camada (o que a IA precisa para se orientar, sem o peso de todos os campos).
- **`describeCall(tool, args, store)`** · [L169](../src/agent/runner.js#L169) — Descrição em português de uma alteração, para a janela de permissão.
- **`assertCurrentImageTarget(store, id, doc, node, fill, source)`** · [L216](../src/agent/runner.js#L216) — Confere que uma operação assíncrona ainda aponta para o mesmo documento e a mesma imagem.
- **`createRunner({ store, commands, approve, saving = null, folder = null })`** · [L234](../src/agent/runner.js#L234) — Cria o executor.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.commands` <sub>object</sub> — 
  - `[deps.saving]` <sub>object</sub> — salvamento (abrir/salvar projetos da pasta) · @param {object} [deps.folder]  API da pasta (listar)
  - ↩︎ `{ run: (tool: string, args: object, client?: string, opts?: {external?: boolean, admin?: boolean` ) => Promise<object> }}
- **`need(id)`** <sub>interna</sub> · [L236](../src/agent/runner.js#L236) — Camada pelo id ou erro claro (a IA às vezes inventa ids: a mensagem manda ela procurar antes).
- **`setLayoutMode(node, mode)`** <sub>interna</sub> · [L242](../src/agent/runner.js#L242) — Liga/desliga o layout com a lógica do painel (deduz direção, gap e padding ao ligar).
- **`iconCache`** <sub>interna</sub> · [L381](../src/agent/runner.js#L381) — SVGs de ícones já baixados (não baixa o mesmo duas vezes).
- **`fetchIcon(name, style = 'outlined', filled = false)`** <sub>interna</sub> · [L383](../src/agent/runner.js#L383) — Baixa o SVG de um ícone do Google (precisa de internet; depois de inserido, é um desenho do projeto).
- **`iconNode(svg, { name, color = '#111111', size = 24 })`** <sub>interna</sub> · [L398](../src/agent/runner.js#L398) — Ícone (SVG já baixado) → camada de vetor, na cor e no tamanho pedidos.
- **`colorStyle(id)`** <sub>interna</sub> · [L404](../src/agent/runner.js#L404) — Cor e opacidade de um estilo de cor do projeto (ou null).
- **`targetList(parent_id)`** <sub>interna</sub> · [L406](../src/agent/runner.js#L406) — Lista onde uma camada nova entra (filhos do pai ou a raiz da página), conferindo se o pai aceita filhos.
- **`insertAt(list, node, index)`** <sub>interna</sub> · [L412](../src/agent/runner.js#L412) — Insere na posição pedida (ou no fim).
- **`placeBeside(node)`** <sub>interna</sub> · [L414](../src/agent/runner.js#L414) — Tela nova na raiz: à direita do que já existe na página (não cai em cima de nada).
- **`checkSpec(spec, depth = 0, acc = { count: 0, icons: [] })`** <sub>interna</sub> · [L422](../src/agent/runner.js#L422) — Confere a árvore de build_layout antes de criar qualquer coisa (tipos, tamanho, ícones) e devolve os ícones usados.
- **`buildSpec(spec, svgs, nested)`** <sub>interna</sub> · [L434](../src/agent/runner.js#L434) — Cria as camadas da árvore (os ícones já baixados em `svgs`).
- **`guardSwitch()`** <sub>interna</sub> · [L459](../src/agent/runner.js#L459) — Trocar de projeto só quando nada se perde (projeto salvo na pasta, ou exemplo/em branco intocado).
- **`imageLayer(id)`** <sub>interna</sub> · [L468](../src/agent/runner.js#L468) — Camada com preenchimento de imagem (ou erro claro).
- **`imageInfo(n)`** <sub>interna</sub> · [L474](../src/agent/runner.js#L474) — Resumo da imagem gravada (tamanho e peso).
- **`imageTarget(id)`** <sub>interna</sub> · [L479](../src/agent/runner.js#L479) — Impede uma operação de imagem lenta de aplicar o resultado sobre uma imagem que a pessoa já trocou.
- **`run(tool, args = {}, client = 'Assistente', { external = false, admin =…)`** <sub>interna</sub> · [L712](../src/agent/runner.js#L712) — Roda uma ferramenta e devolve o resultado (objeto JSON). Nunca lança: erros voltam como { error }.
  - `tool` <sub>string</sub> — 
  - `args` <sub>object</sub> — 
  - `[client]` <sub>string</sub> — quem pediu ('Assistente', 'Claude Code'...), aparece na janela de permissão
- **`restoreDoc(json)`** <sub>interna</sub> · [L762](../src/agent/runner.js#L762) — Restaura uma alteração parcial que falhou, sem criar passo no histórico (só sem mudanças concorrentes).

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
- **`AGENT_TOOLS`** · [L34](../src/agent/schema.js#L34) — As ferramentas. `write: true` = altera o projeto (pede permissão e vira um passo do Ctrl+Z). `admin: true` = mexe nos ARQUIVOS de projeto (abrir, salvar, criar): para programas externos (MCP), só funciona com o "Acesso de administrador" ligado em Configurações. O Assistente interno pode usar (com permissão). `inputSchema` segue JSON Schema (MCP chama assim; a OpenAI chama de `parameters`).
- **`toolByName(name)`** · [L420](../src/agent/schema.js#L420) — Procura uma ferramenta pelo nome.
- **`MCP_SESSION_TOOLS`** <sub>do módulo</sub> · [L423](../src/agent/schema.js#L423) — Ferramentas de controle da sessão HTTP MCP; não são oferecidas ao Assistente interno.
- **`mcpToolByName(name)`** · [L437](../src/agent/schema.js#L437) — _(sem comentário)_
- **`openAiTools()`** · [L440](../src/agent/schema.js#L440) — As ferramentas no formato da API da OpenAI (Chat Completions: `tools: [{ type: 'function', function }]`).
- **`mcpTools()`** · [L446](../src/agent/schema.js#L446) — As ferramentas no formato do MCP (`tools/list`).
- **`AGENT_INSTRUCTIONS`** · [L462](../src/agent/schema.js#L462) — Instruções para a IA (o "prompt de sistema" do agente interno e as `instructions` do servidor MCP). Explicam o que a ferramenta é e as regras de trabalho, para a IA agir do jeito certo desde a primeira mensagem.

---

## src/agent/stream.js

**RESPOSTA DA IA EM TEMPO REAL (streaming) E CONTROLE DO "RACIOCÍNIO"** · [abrir o código](../src/agent/stream.js)

```text
 Com `stream: true`, as APIs compatíveis com a OpenAI (OpenAI, NVIDIA NIM, Ollama...) mandam a resposta aos
 pedaços, no formato SSE ("data: {json}" por linha, terminando com "data: [DONE]"). Cada pedaço traz um "delta":
   - `content`: texto da resposta (pode vir com o raciocínio entre <think> e </think>, como no DeepSeek-R1);
   - `reasoning_content` ou `reasoning`: o raciocínio em campo separado (NIM, DeepSeek, Qwen, gpt-oss);
   - `tool_calls`: pedaços das chamadas de ferramenta (o nome vem uma vez; os argumentos vêm picados por `index`).
 Este arquivo junta tudo isso: o servidor repassa o texto e o raciocínio ao navegador enquanto chegam e, no fim,
 monta a mensagem completa (com as ferramentas). Também decide, por modelo, como pedir MENOS raciocínio à NVIDIA
 NIM (os modelos que "pensam, pensam e nunca dão em nada").
 Só lógica, sem DOM nem Node: o servidor e os testes importam este arquivo.
```

- **`createSseReader(onData)`** · [L23](../src/agent/stream.js#L23) — Leitor de SSE: recebe o texto em pedaços (que podem cortar uma linha no meio) e chama `onData` com o conteúdo de cada evento `data:` completo. "[DONE]" vira `onData(null)`. Linhas de comentário (": ping") são ignoradas.
  - `onData` <sub>(data: string\|null) => void</sub> — 
  - ↩︎ `{ push: (chunk: string) => void, end: () => void ` }
- **`partialTail(text, tag)`** <sub>do módulo</sub> · [L52](../src/agent/stream.js#L52) — Quantos caracteres do fim de `text` podem ser o começo de `tag` (para não cortar "<thi" + "nk>" ao meio).
- **`createChatAccumulator()`** · [L63](../src/agent/stream.js#L63) — Junta os pedaços de UMA resposta de chat em streaming. `add(json)` recebe cada objeto do SSE e devolve o que é novo para mostrar: `{ text, reasoning }` (strings, podem ser vazias). `result()` devolve a mensagem completa: `{ content, reasoning, tool_calls, finish_reason, usage }`. O raciocínio entre <think>…</think> dentro do `content` é separado do texto, mesmo se a tag vier cortada.
- **`splitContent(piece)`** <sub>interna</sub> · [L74](../src/agent/stream.js#L74) — Separa texto e raciocínio de um pedaço de `content` (máquina de estados do <think>).
- **`parseChatStream(body)`** · [L161](../src/agent/stream.js#L161) — Junta um stream SSE inteiro (texto) de uma vez: útil nos testes e para respostas já completas.
  - `body` <sub>string</sub> — 
- **`reasoningParams(model, { provider = '', limit = true, maxTokens = 0 } = {})`** · [L184](../src/agent/stream.js#L184) — Como pedir MENOS raciocínio a cada modelo da NVIDIA NIM (documentação "Reasoning Models" da NIM e cartões dos modelos). Devolve `{ body, system, note }`: campos extras do pedido, uma linha para o INÍCIO da mensagem de sistema e um aviso para a tela (modelos que não dá para desligar). Outros provedores: nada (a OpenAI recusa campos desconhecidos).

    - Nemotron Super 49B v1 / Ultra 253B v1 → "detailed thinking off" na mensagem de sistema;
    - Nemotron v1.5 e Nemotron Nano v2 → "/no_think" na mensagem de sistema;
    - Nemotron 3, Qwen3, MiMo, GLM, Kimi → chat_template_kwargs { enable_thinking: false };
    - DeepSeek V3.1/V3.2 → chat_template_kwargs { thinking: false };
    - gpt-oss → reasoning_effort "low" (não desliga, só encurta);
    - DeepSeek-R1, QwQ e outros "só raciocínio" → não desliga: só o limite de tokens (aviso na tela).
  - `model` <sub>string</sub> — 
- **`rejectsExtras(status, detail)`** · [L200](../src/agent/stream.js#L200) — O erro da API fala de um campo extra que ela não aceita? (aí tentamos de novo sem os extras)
- **`rejectsTools(status, detail)`** · [L205](../src/agent/stream.js#L205) — O erro da API diz que o modelo não aceita ferramentas?

---

## src/agent/subagents.js

**SUBAGENTES: O AGENTE DIVIDE O TRABALHO EM ATÉ 4 AJUDANTES EM PARALELO** · [abrir o código](../src/agent/subagents.js)

```text
 Com a ferramenta `delegate_task` (só do agente interno, como `remember`), o agente principal cria de 1 a 4
 subagentes, cada um com uma TAREFA, um ESCOPO opcional (ids de camadas onde ele pode mexer) e um MODELO opcional.
 Cada subagente roda o mesmo laço de ferramentas do agente (ui/assistant.js), em paralelo, com contexto mínimo
 (instruções + tarefa + resumo do documento) e um limite de passos; no fim, devolve um resumo ao principal.

 TRAVAS POR CAMADA (a mesma ideia de server/presence.js, aqui no navegador): quando um subagente altera uma camada,
 ela fica dele até ele terminar. Outro subagente que tentar alterar a mesma camada recebe um erro claro ("está com
 o Subagente 2") e pode trabalhar em outra parte. Com escopo, ele só altera camadas DENTRO do escopo.
 As alterações continuam passando pela permissão (ou "Fazer sem perguntar") e saem com Ctrl+Z.
 Só lógica, sem DOM: os testes importam este arquivo.
```

- **`MAX_SUBAGENTS`** · [L19](../src/agent/subagents.js#L19) — Máximo de subagentes por chamada de delegate_task.
- **`SUBAGENT_STEPS`** · [L21](../src/agent/subagents.js#L21) — Passos (rodadas de ferramentas) de cada subagente.
- **`DELEGATE_TOOL`** · [L24](../src/agent/subagents.js#L24) — A ferramenta, no formato da OpenAI (só o agente principal recebe; subagentes não delegam de novo).
- **`normalizeTasks(args)`** · [L56](../src/agent/subagents.js#L56) — Confere e limpa os argumentos de delegate_task. Lança Error com mensagem que a IA entende.
  - `args` <sub>object</sub> — 
  - ↩︎ `{ id: string, name: string, task: string, scope: string[], model: string ` []}
- **`changedIds(args = {})`** · [L71](../src/agent/subagents.js#L71) — ids que uma ferramenta vai ALTERAR (as travas valem para estes; o pai de uma criação só confere o escopo).
- **`createLayerLocks({ isWithin = (id, scope) => scope.includes(id) } = {})`** · [L84](../src/agent/subagents.js#L84) — Travas das camadas entre subagentes do mesmo agente.
- **`runSubagents(tasks, runOne, { concurrency = MAX_SUBAGENTS, signal } = {})`** · [L123](../src/agent/subagents.js#L123) — Roda os subagentes em paralelo (no máximo `concurrency` ao mesmo tempo) e devolve um resultado por tarefa, na mesma ordem. Um subagente que falha não derruba os outros.
  - `tasks` <sub>object[]</sub> — de normalizeTasks
  - ↩︎ `Promise<{ id, name, status: 'done'\|'error'\|'stopped', summary?, error?, steps ` []>}
- **`subagentBrief(t, docSummary)`** · [L149](../src/agent/subagents.js#L149) — A mensagem que o subagente recebe (o "contexto mínimo"): quem ele é, a tarefa, o escopo e um resumo do documento.
  - `docSummary` <sub>string</sub> — resumo curto do projeto (telas e camadas principais com ids)

---

## src/ui/assets.js

**ABA "RECURSOS" (COMPONENTES E ESTILOS)** · [abrir o código](../src/ui/assets.js)

- **`cssSlug(s)`** <sub>do módulo</sub> · [L19](../src/ui/assets.js#L19) — Nome da variável de CSS (o mesmo do código gerado).
- **`createAssetsPanel({ store, commands, canvas, container, toast })`** · [L28](../src/ui/assets.js#L28) — Cria a aba RECURSOS (painel esquerdo): três listas do documento —

   - Componentes: clicar insere uma instância no centro da tela
   - Cores: estilos de cor; clicar aplica à seleção; +, renomear e excluir
   - Tipografia: estilos de texto; idem
  Mudar um estilo muda todas as camadas ligadas a ele (ver components.js → syncStyles).
- **`section(title, add, body)`** <sub>interna</sub> · [L35](../src/ui/assets.js#L35) — Seção da lista: título, botão "+" opcional e linhas.
- **`components()`** <sub>interna</sub> · [L39](../src/ui/assets.js#L39) — Todos os componentes principais do documento (de qualquer página), com a página de cada um.
- **`compQuery`** <sub>interna</sub> · [L46](../src/ui/assets.js#L46) — Busca da biblioteca de componentes (lembrada entre redesenhos).
- **`usage()`** <sub>interna</sub> · [L49](../src/ui/assets.js#L49) — Quantas cópias (instâncias) de cada componente existem no documento.
- **`thumb(n, page)`** <sub>interna</sub> · [L55](../src/ui/assets.js#L55) — Miniatura do componente (SVG do próprio desenho). Só para os da página aberta, que estão medidos no canvas.
- **`componentGrid(comps)`** <sub>interna</sub> · [L63](../src/ui/assets.js#L63) — Grade de cards: miniatura, nome e usos. Clique insere uma cópia no centro; arrastar para o canvas também.
- **`imageGrid(doc)`** <sub>interna</sub> · [L100](../src/ui/assets.js#L100) — Biblioteca das imagens já embutidas no projeto; o asset original é reutilizado ao inserir.
- **`render()`** <sub>interna</sub> · [L147](../src/ui/assets.js#L147) — Reconstrói as três listas a partir do documento (só roda com a aba aberta).
- **`applyColor(hex, asStroke)`** <sub>interna</sub> · [L252](../src/ui/assets.js#L252) — Aplica uma cor da paleta à seleção: preenchimento (ou contorno, com Shift).
- **`askColors(title)`** <sub>interna</sub> · [L266](../src/ui/assets.js#L266) — Pede uma lista de cores escrita/colada e devolve as válidas (ou null se cancelou).

---

## src/ui/assistant.js

**ABA DO AGENTE (chat de IA dentro do editor)** · [abrir o código](../src/ui/assistant.js)

```text
 Um painel próprio, encaixado à direita do canvas. Você escreve ("deixa o botão com cantos de 12px", "monta
 um rodapé"), o agente lê o design com as ferramentas de agent/schema.js e altera com a sua permissão (ou
 direto, com "Fazer sem perguntar"); cada alteração sai com Ctrl+Z.

 O que ele guarda (só neste navegador, em localStorage — nada vai para o arquivo do projeto):
   - CONVERSAS: várias por projeto, com título, modelo escolhido e histórico. Reabrir continua de onde parou.
   - MEMÓRIA do projeto: notas curtas ("a marca usa azul #2f6ae0") que o agente grava com a ferramenta
     `remember` ou que você escreve. Vão junto em todo pedido, então ele lembra entre conversas.
 O MODELO é escolhido por conversa no topo do painel (lista da sua conta, ou qualquer nome); sem escolha, vale o
 das Configurações.

 COMO FUNCIONA (o "laço do agente"):
   1. manda a conversa + ferramentas + memória para POST /api/agent/chat (o servidor junta docs/AGENTE.md e usa
      a SUA chave, que fica só no seu computador);
   2. a resposta chega EM TEMPO REAL (streaming, NDJSON): o texto aparece enquanto o modelo escreve e o raciocínio
      vai para um bloco "Pensando… 12 s" recolhível. "Parar" fecha a conexão e o servidor aborta o pedido à API;
   3. se a resposta pede ferramentas, o runner executa cada uma no editor e devolve o resultado;
   4. repete até a IA responder só com texto (no máximo MAX_STEPS rodadas por mensagem).
 SUBAGENTES (delegate_task, agent/subagents.js): o agente divide um trabalho grande em até 4 ajudantes que rodam
 este mesmo laço em paralelo, cada um num cartão recolhível, com travas por camada. JEV (agent/jev.js): segunda
 opinião rápida (escolher, dar nota, conferir), oferecida só se o servidor tiver a chave.
```

- **`MAX_STEPS`** <sub>do módulo</sub> · [L36](../src/ui/assistant.js#L36) — Máximo de rodadas "IA pede ferramenta → editor responde" por mensagem (evita laço infinito e gasto à toa).
- **`MAX_RESULT`** <sub>do módulo</sub> · [L38](../src/ui/assistant.js#L38) — Resultados de ferramenta maiores que isso são cortados antes de voltar à IA (economiza tokens).
- **`STORE_KEY`** <sub>do módulo</sub> · [L40](../src/ui/assistant.js#L40) — Onde as conversas e a memória ficam guardadas.
- **`CONTEXT_MARK`** <sub>do módulo</sub> · [L42](../src/ui/assistant.js#L42) — Marca onde começa o contexto do editor anexado à mensagem (não aparece na conversa).
- **`cleanReply(text)`** · [L47](../src/ui/assistant.js#L47) — Limpa o texto da IA antes de mostrar: modelos que "pensam em voz alta" (DeepSeek-R1, Qwen e outros da NVIDIA NIM) mandam o raciocínio entre <think> e </think>; a pessoa só precisa da resposta.
- **`looksLikeTextToolCall(text)`** · [L52](../src/ui/assistant.js#L52) — O modelo "escreveu" a chamada de ferramenta como texto em vez de usar o formato certo? (Acontece com modelos sem suporte bom a ferramentas: a documentação da NVIDIA avisa desse caso.) Aí a ferramenta não roda e avisamos.
- **`parseArgs(raw)`** · [L54](../src/ui/assistant.js#L54) — Argumentos da chamada: texto JSON (OpenAI) ou objeto pronto (alguns servidores compatíveis). null = inválido.
- **`readNdjson(body, onEvent)`** · [L65](../src/ui/assistant.js#L65) — Lê uma resposta NDJSON (um JSON por linha) enquanto ela chega e chama `onEvent` para cada linha. Linhas cortadas entre dois pedaços são juntadas; linhas inválidas são ignoradas.
  - `body` <sub>ReadableStream<Uint8Array></sub> — 
  - `onEvent` <sub>(ev: object) => void</sub> — pode lançar (interrompe a leitura)
- **`titleFrom(text)`** · [L84](../src/ui/assistant.js#L84) — Título automático de uma conversa a partir da 1ª mensagem.
- **`REMEMBER_TOOL`** <sub>do módulo</sub> · [L90](../src/ui/assistant.js#L90) — Ferramenta só do agente interno: guardar uma nota na memória do projeto.
- **`TOOL_LABEL`** <sub>do módulo</sub> · [L100](../src/ui/assistant.js#L100) — Nome amigável de cada ferramenta na conversa.
- **`loadSaved()`** <sub>do módulo</sub> · [L110](../src/ui/assistant.js#L110) — Lê/grava o estado guardado (conversas + memória). Navegador sem localStorage: tudo vive só na memória.
- **`createAssistant({ store, runner, openSettings, stage, approve, prefs = {}, savePref…)`** · [L129](../src/ui/assistant.js#L129) — Cria o painel.
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.openSettings` <sub>() => void</sub> — abre as Configurações numa seção ('ai', 'keys')
  - `deps.stage` <sub>HTMLElement</sub> — onde o painel se encaixa
  - `[deps.prefs]` <sub>object</sub> — preferências (lembra a opção) · @param {() => void} [deps.savePrefs]
  - ↩︎ `{ el: HTMLElement, toggle: () => void, open: () => void, close: () => void, isOpen: () => boolean ` }
- **`project()`** <sub>interna</sub> · [L140](../src/ui/assistant.js#L140) — Projeto aberto: as conversas e a memória são separadas por projeto (pelo nome).
- **`ensureSession()`** <sub>interna</sub> · [L162](../src/ui/assistant.js#L162) — Conversa ativa (cria uma se o projeto ainda não tem).
- **`scrollEnd()`** <sub>interna</sub> · [L218](../src/ui/assistant.js#L218) — Rola a conversa até o fim (só se a pessoa já estava perto do fim: não puxa quem subiu para ler).
- **`add(node)`** <sub>interna</sub> · [L220](../src/ui/assistant.js#L220) — Acrescenta uma linha na conversa e rola até ela.
- **`rich(text)`** <sub>interna</sub> · [L222](../src/ui/assistant.js#L222) — Texto da IA → parágrafos, com `código` destacado (sem HTML vindo da IA: tudo vira texto).
- **`renderLog()`** <sub>interna</sub> · [L294](../src/ui/assistant.js#L294) — Redesenha a conversa guardada (mensagens do usuário, respostas e o que cada ferramenta fez).
- **`refreshConfig()`** <sub>interna</sub> · [L340](../src/ui/assistant.js#L340) — Lê a configuração do servidor (modelo padrão, provedor, se falta a chave).
- **`context()`** <sub>interna</sub> · [L355](../src/ui/assistant.js#L355) — Contexto do editor anexado a cada pedido (onde a pessoa está e o que selecionou), sem aparecer na conversa.
- **`secs(ms)`** <sub>interna</sub> · [L368](../src/ui/assistant.js#L368) — "12 s", "1 min 4 s".
- **`thinkBlock(text = '', ms = 0, live = false)`** <sub>interna</sub> · [L374](../src/ui/assistant.js#L374) — Bloco de raciocínio recolhível: "Pensando… 12 s" enquanto o modelo pensa (aberto, rolando sozinho), "Pensou por 12 s" quando ele começa a responder (recolhe). Clicar abre/fecha.
- **`chatTurn({ messages, tools, model, subagent = false, signal, put, status })`** <sub>interna</sub> · [L387](../src/ui/assistant.js#L387) — Uma rodada de chat em streaming: POST /api/agent/chat e lê a resposta NDJSON enquanto chega. `put` coloca nós na conversa (antes do indicador), `status` muda o indicador. Devolve { message, reasoning, thinkMs, firstTokenMs }. Erros (timeout, modelo sem ferramentas...) viram Error com a mensagem do servidor.
- **`agentLoop({ messages, tools, model, maxSteps, signal, put, status, execute, o…)`** <sub>interna</sub> · [L452](../src/ui/assistant.js#L452) — O LAÇO DO AGENTE (o mesmo para o agente principal e para cada subagente): pede uma resposta, executa as ferramentas pedidas, devolve os resultados e repete até a IA responder só com texto ou acabar os passos.
  - ↩︎ `Promise<{ reply: string, steps: number, capped: boolean ` >}
- **`runJev(name, args)`** <sub>interna</sub> · [L486](../src/ui/assistant.js#L486) — Ferramenta do Jev: quem chama a API é o servidor (com a chave guardada lá).
- **`mainTools()`** <sub>interna</sub> · [L495](../src/ui/assistant.js#L495) — As ferramentas oferecidas: as do editor + remember + delegate_task (+ Jev, se houver chave).
- **`subTools()`** <sub>interna</sub> · [L497](../src/ui/assistant.js#L497) — As dos subagentes: sem remember e sem delegate_task (não criam outros subagentes).
- **`docSummary()`** <sub>interna</sub> · [L500](../src/ui/assistant.js#L500) — Resumo curto do projeto para os subagentes (o "contexto mínimo").
- **`runDelegation(args, signal, put)`** <sub>interna</sub> · [L510](../src/ui/assistant.js#L510) — delegate_task: cria os subagentes, mostra um cartão para cada um (nome, status, passos, Parar) e roda todos em paralelo com as travas por camada. Devolve à IA principal o resumo de cada um.
- **`subCard(t, state, { summary = '', steps = 0 } = {})`** <sub>interna</sub> · [L557](../src/ui/assistant.js#L557) — Cartão recolhível de um subagente (ao vivo ou redesenhado do histórico).
- **`submit()`** <sub>interna</sub> · [L594](../src/ui/assistant.js#L594) — Envia a mensagem digitada e roda o laço do agente.
- **`stepLine(name, args, result)`** <sub>interna</sub> · [L637](../src/ui/assistant.js#L637) — Linha discreta mostrando o que a IA fez com cada ferramenta (✓ feito, ✗ erro, ⊘ recusado).

---

## src/ui/code.js

**ABA "CÓDIGO" (CSS E HTML DA SELEÇÃO, CSS DA PÁGINA, ATRIBUTOS)** · [abrir o código](../src/ui/code.js)

```text
 Três abas (só leitura; "Editar" abre o EDITOR GRANDE embaixo do canvas — ui/codedock.js):
  - CSS: o CSS REAL da seleção (o mesmo da exportação). Editar → declarações da camada; ao aplicar, o que dá vira
    campo do modelo e o resto vai para o CSS livre (ver cssedit.js). Ctrl+Z desfaz;
  - HTML: o HTML da seleção + os ATRIBUTOS da camada (id, classes, title, role, aria-label, link...). Numa camada
    "Código HTML", Editar → o HTML escrito à mão (limpo por html.js → sanitizeHtml);
  - Página: o CSS GLOBAL do projeto (doc.styles.pageCss) com seletores, @media, :hover e @keyframes. Vale no canvas,
    no HTML exportado e na apresentação.
```

- **`setKids(parent, list)`** <sub>do módulo</sub> · [L22](../src/ui/code.js#L22) — Troca os filhos só se mudaram (mover o editor no DOM tiraria o foco de quem está digitando).
- **`createCodePanel({ store, commands, toast, dock })`** · [L32](../src/ui/code.js#L32) — Cria o painel CÓDIGO. Mostra o código REAL (a mesma saída de `generateCode` usada na exportação); "Editar" abre o editor grande (ui/codedock.js) na aba correspondente.
- **`render()`** <sub>interna</sub> · [L71](../src/ui/code.js#L71) — Gera o código das camadas-alvo e mostra colorido (na aba Página, o CSS escrito à mão).

---

## src/ui/codedock.js

**EDITOR DE CÓDIGO GRANDE (acoplado embaixo do canvas, ou em tela cheia)** · [abrir o código](../src/ui/codedock.js)

```text
 A aba Código do painel direito é estreita demais para escrever. "Editar" (ou Ctrl+Shift+E) abre este painel:
  - fica EMBAIXO do canvas; arrastar a borda de cima muda a altura (lembrada nas preferências);
  - maximizar (botão ou F11 dentro do editor) ocupa a janela toda; Esc volta;
  - abas: "CSS da camada" (declarações da camada selecionada, ver cssedit.js), "CSS da página"
    (doc.styles.pageCss) e "HTML" (camada "Código HTML", limpo por html.js → sanitizeHtml);
  - AO VIVO: enquanto digita, o canvas mostra o resultado (com atraso curto), sem entrar no histórico.
    Aplicar (Ctrl+S / Ctrl+Enter) grava com 1 passo de desfazer; Descartar volta ao que era.
 Cada aba tem a sua "sessão" (texto, camada-alvo, mudanças pendentes). Com mudança pendente, a aba fica PRESA
 à camada que estava sendo editada, mesmo se a seleção mudar.
```

- **`supports(p, v)`** <sub>do módulo</sub> · [L26](../src/ui/codedock.js#L26) — CSS.supports do navegador (quando existe) para conferir propriedades e valores.
- **`TABS`** <sub>do módulo</sub> · [L31](../src/ui/codedock.js#L31) — As três abas do editor grande.
- **`createCodeDock({ store, commands, toast, prefs, savePrefs })`** · [L42](../src/ui/codedock.js#L42) — Cria o editor grande. Devolve { el, open(tab?), close(), toggle(), isOpen(), sync() }.
- **`editorOf(id)`** <sub>interna</sub> · [L110](../src/ui/codedock.js#L110) — Editor (criado na primeira vez) da aba pedida.
- **`targetOf(id)`** <sub>interna</sub> · [L130](../src/ui/codedock.js#L130) — Camada que a aba edita agora (presa à anterior enquanto houver mudança pendente).
- **`sourceText(id, node)`** <sub>interna</sub> · [L145](../src/ui/codedock.js#L145) — Texto atual (no documento) que a aba deve mostrar.
- **`emptyReason(id, node)`** <sub>interna</sub> · [L152](../src/ui/codedock.js#L152) — Motivo para a aba não ter o que editar (ou '' se tem).
- **`goToLine(n)`** <sub>interna</sub> · [L188](../src/ui/codedock.js#L188) — Leva o cursor para o começo da linha (1-based).
- **`snapNode(n)`** <sub>interna</sub> · [L200](../src/ui/codedock.js#L200) — Guarda os campos da camada (menos os filhos) para poder voltar.
- **`preview()`** <sub>interna</sub> · [L208](../src/ui/codedock.js#L208) — Mostra no canvas o que está no editor (sem histórico). Com erro de sintaxe, mantém a última prévia boa.
- **`revertPreview(id)`** <sub>interna</sub> · [L231](../src/ui/codedock.js#L231) — Desfaz a pré-visualização ao vivo da aba (o documento volta ao que estava antes de digitar).
- **`apply()`** <sub>interna</sub> · [L244](../src/ui/codedock.js#L244) — Aplica o que está no editor (CSS da camada, CSS da página ou HTML) com 1 passo de desfazer.
- **`discard(id = tab)`** <sub>interna</sub> · [L283](../src/ui/codedock.js#L283) — Joga fora as mudanças da aba atual (e a prévia no canvas).
- **`openDock(which)`** <sub>interna</sub> · [L312](../src/ui/codedock.js#L312) — Abre o editor grande (na aba pedida, ou na que faz sentido para a seleção) e põe o foco no código.
- **`close()`** <sub>interna</sub> · [L329](../src/ui/codedock.js#L329) — Fecha (pergunta antes se há mudança não aplicada).
- **`syncChrome()`** <sub>interna</sub> · [L379](../src/ui/codedock.js#L379) — Cabeçalho, status e botões conforme a aba atual.
- **`sync(force = false)`** <sub>interna</sub> · [L398](../src/ui/codedock.js#L398) — Atualiza o painel: aba, alvo e texto (sem apagar o que está sendo digitado). `force` recarrega o texto.

---

## src/ui/codeeditor.js

**EDITOR DE CÓDIGO LEVE (sem dependências)** · [abrir o código](../src/ui/codeeditor.js)

```text
 Um <textarea> transparente por cima de um <pre> colorido (o texto que você vê é o <pre>; o cursor e a seleção
 são do textarea). Tem:
  - números de linha, linha atual destacada, marcas de erro/aviso por linha;
  - Tab/Shift+Tab indentam, Enter mantém o recuo (e abre o bloco entre { } ou entre <a></a>);
  - colchetes e aspas fecham sozinhos, Ctrl+/ comenta a linha, Ctrl+F procura, Ctrl+Enter/Ctrl+S aplicam;
  - AUTOCOMPLETAR de verdade (ver codeassist.js): popup com ícone do tipo, descrição e prévia de cor, setas
    navegam, Enter/Tab aceitam, Esc fecha, Ctrl+Espaço abre; no HTML, fecha etiquetas e expande Emmet com Tab.
 As edições usam execCommand('insertText'), então o Ctrl+Z do próprio campo continua funcionando.
```

- **`highlightCss(code)`** · [L22](../src/ui/codeeditor.js#L22) — Colore uma folha de CSS (ou só declarações): comentários, @regras, seletores, propriedades, valores.
- **`highlightHtml(code)`** · [L59](../src/ui/codeeditor.js#L59) — Colore HTML: etiquetas, atributos, valores, comentários.
- **`KINDS`** <sub>do módulo</sub> · [L75](../src/ui/codeeditor.js#L75) — Ícone (letra) e nome de cada tipo de sugestão, no popup.
- **`createCodeEditor({ language, value = '', placeholder = '', label = 'Editor de código…)`** · [L93](../src/ui/codeeditor.js#L93) — Cria um editor.
  - ↩︎ {{ el: HTMLElement, textarea: HTMLTextAreaElement, getValue: ()=>string, setValue: (v:string)=>void, setDiagnostics: (list:{line:number,level:string,msg:string}[])=>void, focus: ()=>void, complete: (manual?:boolean)=>void, openFind: ()=>void, refresh: ()=>void }}
- **`measure()`** <sub>interna</sub> · [L122](../src/ui/codeeditor.js#L122) — Altura da linha, largura do caractere e recuos (fonte monoespaçada; medido uma vez por fonte).
- **`lineCol(pos)`** <sub>interna</sub> · [L134](../src/ui/codeeditor.js#L134) — Linha e coluna (0-based) de uma posição do texto.
- **`quiet`** <sub>interna</sub> · [L183](../src/ui/codeeditor.js#L183) — Insere texto no lugar de [from, to] mantendo o desfazer nativo do campo.
- **`insertSnippet(text, from, to)`** <sub>interna</sub> · [L194](../src/ui/codeeditor.js#L194) — Insere um trecho com a marca CARET (onde o cursor fica) e recua as linhas novas como a linha atual.
- **`complete(manual = false)`** <sub>interna</sub> · [L209](../src/ui/codeeditor.js#L209) — Calcula as sugestões para o cursor e mostra o popup (ou fecha, se não houver).
- **`placePopup()`** <sub>interna</sub> · [L232](../src/ui/codeeditor.js#L232) — Posiciona o popup logo abaixo do cursor (ou acima, se embaixo não couber); encolhe a lista se faltar espaço.
- **`reveal(pos)`** <sub>interna</sub> · [L329](../src/ui/codeeditor.js#L329) — Rola o campo para a posição ficar visível.
- **`inHtmlTag(v, pos)`** <sub>do módulo</sub> · [L517](../src/ui/codeeditor.js#L517) — O cursor está dentro de uma etiqueta (<a href="…">)? Usado para decidir se aspas fecham sozinhas no HTML.
- **`markHits(label, hits = [])`** <sub>do módulo</sub> · [L522](../src/ui/codeeditor.js#L522) — Rótulo com as letras que combinaram com a busca em negrito.
- **`charWidth(font)`** <sub>do módulo</sub> · [L532](../src/ui/codeeditor.js#L532) — Largura de um caractere da fonte monoespaçada (mede uma vez por fonte).

---

## src/ui/colorpicker.js

**SELETOR DE COR (popover) com gerenciador de paletas** · [abrir o código](../src/ui/colorpicker.js)

```text
 Abre ao clicar numa amostra de cor do painel. Em CIMA, a cor em si:
   1. área saturação/brilho; conta-gotas + barras de matiz e opacidade + amostra (nova sobre a original);
   2. formato (HEX · RGB · HSL) e campos;
   3. contraste da cor sobre branco e sobre preto (WCAG), para saber se o texto fica legível.
 EMBAIXO, as cores prontas para um clique, como fileiras de amostras com nome:
   4. MINHAS PALETAS (uma fileira por paleta; a ativa em destaque), gerenciáveis aqui mesmo: nova, renomear,
      + guardar a cor atual, × tirar cor, duplicar, copiar como variáveis CSS e excluir;
   5. cores do documento e estilos de cor (vindos de `groups`) e as recentes;
   6. SUGESTÕES de harmonia (complementar, análogas, tríade, tons) como faixa de amostras, recolhidas;
   7. paletas prontas, recolhidas.
 Aplica ao vivo (`set`) e grava o histórico (`commit`) ao soltar. Fecha ao clicar fora, com Esc ou quando o campo
 que o abriu some do painel.
```

- **`BUILTIN`** <sub>do módulo</sub> · [L29](../src/ui/colorpicker.js#L29) — Paletas prontas (de fábrica).
- **`closeColorPicker()`** · [L44](../src/ui/colorpicker.js#L44) — Fecha o seletor de cor aberto, se houver.
- **`colorPickerAnchor()`** · [L46](../src/ui/colorpicker.js#L46) — O campo (amostra) que abriu o seletor agora, ou null.
- **`openColorPicker({ anchor, get, set, commit, opacity, setOpacity, groups, onClose })`** · [L54](../src/ui/colorpicker.js#L54) — Abre o seletor de cor.
- **`paint()`** <sub>interna</sub> · [L88](../src/ui/colorpicker.js#L88) — Redesenha os controles a partir de `hsv`/`alpha` (sem mexer no campo que a pessoa está digitando).
- **`buildFields()`** <sub>interna</sub> · [L113](../src/ui/colorpicker.js#L113) — Campos do formato atual: HEX | R G B | H S L (+ opacidade em %, se houver).
- **`paintFields()`** <sub>interna</sub> · [L165](../src/ui/colorpicker.js#L165) — Atualiza só os valores dos campos (se a pessoa não está digitando num deles).
- **`paintContrast(c)`** <sub>interna</sub> · [L173](../src/ui/colorpicker.js#L173) — Contraste da cor sobre branco e sobre preto, no padrão WCAG.
- **`push()`** <sub>interna</sub> · [L187](../src/ui/colorpicker.js#L187) — Aplica a cor atual (e a opacidade) ao campo, ao vivo.
- **`applyRgb(rgb, keepHue = false)`** <sub>interna</sub> · [L190](../src/ui/colorpicker.js#L190) — Cor nova vinda de RGB (campos, chips). `keepHue`: mantém o matiz quando a cor fica sem saturação.
- **`finish(quiet = false)`** <sub>interna</sub> · [L198](../src/ui/colorpicker.js#L198) — Fim de uma edição: grava no histórico e guarda nas recentes.
- **`pick(c, quiet = false)`** <sub>interna</sub> · [L205](../src/ui/colorpicker.js#L205) — Escolhe uma cor pronta (chip): aplica e grava.
- **`drag(el, fn)`** <sub>interna</sub> · [L212](../src/ui/colorpicker.js#L212) — Arrasto numa área/barra: `fn(x, y)` recebe a posição relativa 0–1; grava ao soltar.
- **`keyboardAdjust(el, adjust)`** <sub>interna</sub> · [L225](../src/ui/colorpicker.js#L225) — Faz os controles de cor responderem às setas sem roubar os atalhos do canvas.
- **`swatchRow(title, colors)`** <sub>interna</sub> · [L260](../src/ui/colorpicker.js#L260) — Fileira de amostras com o nome em cima (cores do documento, estilos, recentes, paletas prontas).

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
- **`fontField({ get, set })`** · [L32](../src/ui/fontpicker.js#L32) — Campo de fonte para o painel de propriedades.
  - ↩︎ `{el: HTMLElement, update: () => void` }
- **`openPicker(anchor, current, onPick)`** <sub>do módulo</sub> · [L48](../src/ui/fontpicker.js#L48) — Abre a caixa de escolha embaixo de `anchor`.
- **`close()`** <sub>do módulo</sub> · [L149](../src/ui/fontpicker.js#L149) — Fecha a caixa aberta (se houver).

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

- **`iconUrl(name, style, filled)`** · [L18](../src/ui/googleicons.js#L18) — Endereço do SVG de um ícone no servidor de arquivos do Google (responde com CORS liberado).
- **`POPULAR`** <sub>do módulo</sub> · [L22](../src/ui/googleicons.js#L22) — Os mais usados aparecem primeiro quando a busca está vazia.
- **`PAGE`** <sub>do módulo</sub> · [L30](../src/ui/googleicons.js#L30) — Quantos ícones mostrar por vez (a lista toda são milhares de imagens).
- **`PT`** · [L33](../src/ui/googleicons.js#L33) — Sinônimos em português → termos em inglês da lista do Google (a busca aceita os dois).
- **`fold(s)`** · [L43](../src/ui/googleicons.js#L43) — _(sem comentário)_
- **`ORDERED`** <sub>do módulo</sub> · [L46](../src/ui/googleicons.js#L46) — Todos os nomes, com os mais usados primeiro.
- **`searchIcons(query)`** · [L54](../src/ui/googleicons.js#L54) — Busca ícones pelo nome em inglês ou por um sinônimo em português ("casa" → home). Quem COMEÇA com o termo vem primeiro. Usada pelo painel e pelo agente de IA (ferramenta search_icons).
  - `query` <sub>string</sub> — 
  - ↩︎ `string[]` nomes dos ícones (vazio = os mais usados)
- **`iconExists(name)`** · [L67](../src/ui/googleicons.js#L67) — O ícone existe na lista do Google?
- **`createIconsPanel({ commands, container, toast })`** · [L77](../src/ui/googleicons.js#L77) — Cria a aba "Ícones": busca nos Material Symbols (aceita palavras em português), escolha de estilo, cor e tamanho, e insere o ícone escolhido como vetor editável (commands.insertSvg).
  - `deps` <sub>object</sub> — 
  - `deps.commands` <sub>object</sub> — usa commands.insertSvg
  - `deps.container` <sub>HTMLElement</sub> — 
  - `deps.toast` <sub>(m: string) => void</sub> — 
- **`matches()`** <sub>interna</sub> · [L83](../src/ui/googleicons.js#L83) — Ícones que casam com a busca (em inglês ou pelos sinônimos em português).
- **`insert(name)`** <sub>interna</sub> · [L86](../src/ui/googleicons.js#L86) — Baixa (ou pega do cache) e insere o ícone como vetor.

---

## src/ui/guides.js

- **`setGuidesLocked(store, locked)`** · [L5](../src/ui/guides.js#L5) — Trava só o arrasto no canvas; as posições continuam editáveis pela janela.
- **`openGuides({ store, commands, canvas })`** · [L12](../src/ui/guides.js#L12) — Edição precisa das guias da página, usando o mesmo histórico dos arrastos na régua.

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
- **`refreshList()`** <sub>interna</sub> · [L118](../src/ui/home.js#L118) — Busca a lista da pasta e redesenha a grade.
- **`replaceWith(question, action)`** <sub>interna</sub> · [L129](../src/ui/home.js#L129) — Troca o projeto aberto por `action` (abrir da pasta, exemplo, novo), perguntando antes se for perder algo.
- **`openFile(file)`** <sub>interna</sub> · [L141](../src/ui/home.js#L141) — Abre um projeto da pasta. Se já é o aberto, só volta ao editor.
- **`renderGrid()`** <sub>interna</sub> · [L216](../src/ui/home.js#L216) — Só a grade de projetos da pasta (redesenhada ao buscar/ordenar sem perder o foco do campo de busca).
- **`card(p)`** <sub>interna</sub> · [L233](../src/ui/home.js#L233) — Card de um projeto da pasta: clique abre; ⋯ abre o menu; no modo "renomear", o nome vira um campo.

---

## src/ui/icons.js

**ÍCONES SVG (inline, sem dependências)** · [abrir o código](../src/ui/icons.js)

- **`P`** <sub>do módulo</sub> · [L11](../src/ui/icons.js#L11) — Os desenhos dos ícones, só o miolo do SVG (viewBox 24×24, traço de 1.8px herdando a cor do texto). Estilo "linha": mesmo traço e cantos arredondados em todos, para a interface ficar coesa.
- **`icon(name, size = 16)`** · [L128](../src/ui/icons.js#L128) — Markup SVG completo de um ícone pelo nome (ver `P`). Nome inexistente gera um SVG vazio em vez de quebrar.
  - `name` <sub>string</sub> — 
  - `[size=16]` <sub>number</sub> — px
- **`nodeIcon(type)`** · [L132](../src/ui/icons.js#L132) — Ícone usado na lista de camadas para cada tipo de camada.

---

## src/ui/imageai.js

**IA DE FOTO: o EDITOR DE IMAGEM (painel grande) e as edições usadas pelo agente** · [abrir o código](../src/ui/imageai.js)

```text
 Modelo HÍBRIDO:
  - EDIÇÕES LOCAIS, no navegador e sem chave: recortar (livre, 1:1, 4:3, 16:9, 3:2), girar e espelhar; ajustes
    (brilho, contraste, saturação, exposição, temperatura, nitidez, desfoque); filtros prontos com miniatura;
    REMOVER FUNDO (automático pelas bordas, varinha mágica e pincel de apagar/restaurar); tamanho e compressão
    (largura máxima, formato WebP/PNG/JPEG, qualidade, mostrando o tamanho final). A matemática está em ../imagefx.js.
  - EDIÇÃO GENERATIVA, pelo servidor (server/imageai.js, com a chave guardada lá): preencher uma área pintada,
    expandir para os lados e trocar objeto/gerar variação.

 O editor tem o PRÓPRIO desfazer (Ctrl+Z dentro dele). "Aplicar" grava uma imagem NOVA em doc.assets, troca a
 imagem da camada (guardando a original em fill.origAssetId, para "Restaurar original") e vira UM passo do Ctrl+Z
 do documento.

 O agente usa as mesmas funções sem abrir o painel: editImageLocal (ferramenta edit_image) e generativeEdit
 (ferramenta generate_image_edit), ver agent/runner.js.
```

- **`canvasOf(w, h)`** <sub>do módulo</sub> · [L33](../src/ui/imageai.js#L33) — Canvas novo w × h.
- **`ctx2d(c)`** <sub>do módulo</sub> · [L35](../src/ui/imageai.js#L35) — Contexto 2D (com leitura frequente: getImageData é usado o tempo todo aqui).
- **`loadImage(src)`** · [L37](../src/ui/imageai.js#L37) — Carrega uma imagem (data URL) e espera ela estar pronta.
- **`toCanvas(img)`** <sub>do módulo</sub> · [L46](../src/ui/imageai.js#L46) — Imagem → canvas do mesmo tamanho.
- **`pixelsOf(c)`** <sub>do módulo</sub> · [L52](../src/ui/imageai.js#L52) — Pixels (ImageData) do canvas inteiro.
- **`fromPixels(data, w, h)`** <sub>do módulo</sub> · [L54](../src/ui/imageai.js#L54) — Canvas a partir de um array RGBA.
- **`resized(src, w, h)`** <sub>do módulo</sub> · [L60](../src/ui/imageai.js#L60) — Redimensiona com boa qualidade (reduções grandes em etapas de metade, para não serrilhar).
- **`rotated(src, deg)`** <sub>do módulo</sub> · [L72](../src/ui/imageai.js#L72) — Gira 90° (sentido horário com dir=1, anti-horário com -1) ou 180°.
- **`flipped(src, axis)`** <sub>do módulo</sub> · [L83](../src/ui/imageai.js#L83) — Espelha na horizontal ('h') ou vertical ('v').
- **`cropped(src, r)`** <sub>do módulo</sub> · [L91](../src/ui/imageai.js#L91) — Recorta um retângulo.
- **`mimeOf(url)`** <sub>do módulo</sub> · [L97](../src/ui/imageai.js#L97) — Tipo MIME de um data URL.
- **`FORMAT_MIME`** <sub>do módulo</sub> · [L99](../src/ui/imageai.js#L99) — Formato de saída → MIME.
- **`hasAlpha(c)`** <sub>do módulo</sub> · [L101](../src/ui/imageai.js#L101) — A imagem tem algum pixel não opaco?
- **`encodeCanvas(c, format = 'png', quality = 0.9)`** · [L110](../src/ui/imageai.js#L110) — Codifica o canvas no formato pedido. JPEG não tem transparência: o fundo vira branco. Devolve o data URL, os bytes e o formato que o navegador realmente gerou (se ele não souber WebP, cai para PNG).
- **`maskCanvas(mask, w, h, invert = false)`** <sub>do módulo</sub> · [L124](../src/ui/imageai.js#L124) — Desenha a máscara (0..255, 255 = mantém) num canvas cujo ALFA é a máscara (para usar com drawImage/composição).
- **`imageNodeOf(store, id)`** · [L132](../src/ui/imageai.js#L132) — A camada tem imagem de preenchimento (com o arquivo presente)?
- **`applyImageToNode(store, id, { dataUrl, w, h }, { commit = true } = {})`** · [L141](../src/ui/imageai.js#L141) — Grava a imagem nova como ARQUIVO NOVO em doc.assets e troca a imagem da camada. A original fica guardada em fill.origAssetId (só a primeira: editar de novo não perde a original). Com `commit` (padrão) vira um passo do Ctrl+Z.
- **`hasOriginal(n)`** · [L158](../src/ui/imageai.js#L158) — A camada tem uma imagem original guardada (e a imagem atual é uma edição dela)?
- **`restoreOriginal(store, id, { commit = true, beforeApply = null } = {})`** · [L161](../src/ui/imageai.js#L161) — Volta para a imagem original (antes de qualquer edição). Devolve false se não houver original guardada.
- **`editImageLocal(src, ops = {})`** · [L189](../src/ui/imageai.js#L189) — EDIÇÃO LOCAL em lote (ferramenta edit_image do agente). Ordem: girar/espelhar → recortar → remover fundo → filtro → ajustes → largura máxima → codificar.
  - `src` <sub>string</sub> — data URL da imagem
  - `ops` <sub>object</sub> — { rotate: 90\|180\|270\|-90, flip_h, flip_v, crop: {x,y,w,h} (px) \| ratio: '1:1'\|'4:3'\|'16:9'\|'3:2', remove_background: true \| {tolerance, feather}, filter, adjust: {...}, max_width, format, quality }
  - ↩︎ `Promise<{dataUrl:string, w:number, h:number, bytes:number, removed?:number` >}
- **`imageAiConfig()`** · [L226](../src/ui/imageai.js#L226) — Configuração do modelo de imagem do servidor ({ available, reason, model, ... }) ou null sem servidor.
- **`postImageAi(path, body, signal)`** <sub>do módulo</sub> · [L235](../src/ui/imageai.js#L235) — POST na API de imagem do servidor; erro com a mensagem que o servidor mandou.
- **`generativeEdit({ src, mode, prompt, mask = null, area = null, expand = null, signal })`** · [L262](../src/ui/imageai.js#L262) — EDIÇÃO GENERATIVA (servidor + modelo de imagem). Monta o quadrado que a API espera (planGenerative), a máscara (transparente = a IA pode mudar), manda, recorta a resposta de volta e cola a imagem original por cima do que não era para mudar (assim o resto fica idêntico, sem perder nitidez).
  - `o` <sub>object</sub> — 
  - `o.src` <sub>string</sub> — data URL da imagem atual
  - `o.mode` <sub>'fill'\|'replace'\|'variation'\|'expand'\|'generate'</sub> — 
  - `o.prompt` <sub>string</sub> — 
  - `[o.mask]` <sub>Uint8Array</sub> — área pintada (w×h, >0 = mudar) — editor
  - `[o.signal]` <sub>AbortSignal</sub> — 
  - ↩︎ `Promise<{dataUrl:string, w:number, h:number` >}
- **`TOOLS`** <sub>do módulo</sub> · [L335](../src/ui/imageai.js#L335) — Ferramentas da barra da esquerda: id, ícone, nome.
- **`current`** <sub>do módulo</sub> · [L344](../src/ui/imageai.js#L344) — Editor aberto agora (só um por vez).
- **`openImageEditor({ store, nodeId, toast = () => {}, tool = 'adjust' })`** · [L354](../src/ui/imageai.js#L354) — Abre o editor de imagem da camada `nodeId` (precisa ter preenchimento de imagem).
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.nodeId` <sub>string</sub> — 
  - `[deps.toast]` <sub>(msg: string) => void</sub> — 
  - `[deps.tool]` <sub>string</sub> — ferramenta inicial ('crop', 'adjust', 'filters', 'background', 'ai', 'size')
- **`hist`** <sub>interna</sub> · [L368](../src/ui/imageai.js#L368) — Histórico do editor: cada item é uma foto do estado (canvases não mudam depois de criados: são compartilhados).
- **`commit()`** <sub>interna</sub> · [L371](../src/ui/imageai.js#L371) — Fecha uma alteração: entra no desfazer do editor.
- **`workResized()`** <sub>interna</sub> · [L433](../src/ui/imageai.js#L433) — Recalcula a escala da prévia (tamanho do palco) e a cópia reduzida.
- **`maskChanged()`** <sub>interna</sub> · [L448](../src/ui/imageai.js#L448) — A máscara de fundo mudou: refaz a versão reduzida.
- **`schedule()`** <sub>interna</sub> · [L450](../src/ui/imageai.js#L450) — Agenda um redesenho (no máximo um por quadro).
- **`summary()`** <sub>interna</sub> · [L452](../src/ui/imageai.js#L452) — Resumo do estado em data-state (testes automáticos e depuração leem daqui).
- **`drawOverlay()`** <sub>interna</sub> · [L467](../src/ui/imageai.js#L467) — Camada por cima da prévia: a área pintada da IA generativa (vermelho) e o contorno do Expandir.
- **`afterMask()`** <sub>interna</sub> · [L564](../src/ui/imageai.js#L564) — A máscara de fundo terminou de mudar: prévia, histórico, formato com transparência e painel.
- **`rendered()`** <sub>interna</sub> · [L575](../src/ui/imageai.js#L575) — Imagem de trabalho com filtro, ajustes e fundo removido já aplicados (tamanho real).
- **`setWork(c, { bake = false } = {})`** <sub>interna</sub> · [L580](../src/ui/imageai.js#L580) — Troca a imagem de trabalho (giro, recorte, resultado da IA). `bake` = aplica antes os ajustes/filtro/fundo.
- **`geometry(fn)`** <sub>interna</sub> · [L589](../src/ui/imageai.js#L589) — Giro/espelho: o fundo removido é aplicado antes (a máscara é do tamanho antigo).
- **`slider(label, value, min, max, step, onInput, onDone, fmt = (v) => String(v))`** <sub>interna</sub> · [L599](../src/ui/imageai.js#L599) — Controle deslizante com valor: `onInput` ao vivo, `onDone` ao soltar (histórico).
- **`finalImage()`** <sub>interna</sub> · [L787](../src/ui/imageai.js#L787) — A imagem final (tudo aplicado, no tamanho e formato escolhidos).
- **`dirty()`** <sub>interna</sub> · [L838](../src/ui/imageai.js#L838) — Houve alguma mudança (para perguntar antes de fechar e para o Aplicar não gravar uma cópia igual).
- **`imageEditorOpen()`** · [L911](../src/ui/imageai.js#L911) — O editor de imagem está aberto?
- **`imageModelCard({ card, row, toast })`** · [L919](../src/ui/imageai.js#L919) — Cartão "Modelo de imagem" da seção Agente de IA e modelos (ui/settings.js). Mostra se a edição generativa está disponível e permite escolher outro endereço/modelo/chave só para imagens.

---

## src/ui/info.js

- **`closeInformation(restoreFocus = false)`** · [L6](../src/ui/info.js#L6) — Fecha a informação aberta; Escape devolve o foco ao botão que a abriu.
- **`informationButton(title, text)`** · [L11](../src/ui/info.js#L11) — Ajuda de uma seção, acessível por clique ou teclado sem ocupar o painel.

---

## src/ui/inspector.js

**PAINEL DO INSPECIONAR (como a aba "Elements" do F12)** · [abrir o código](../src/ui/inspector.js)

```text
 Com a ferramenta Inspecionar (I) e uma camada clicada, mostra num painel flutuante sobre o canvas:
  - etiqueta, classes e id do HTML exportado + tamanho;
  - o BOX MODEL desenhado (margem, borda, padding, conteúdo) com os números lidos do navegador;
  - propriedades CSS COMPUTADAS (getComputedStyle) agrupadas: layout, tipografia, aparência (cores com amostra);
  - as REGRAS que se aplicam: a da classe da camada, estados (:hover, :focus...), @media dos breakpoints e as
    regras do CSS da página cujo seletor pega este elemento;
  - botão para copiar o CSS da camada.
 Só LÊ: nada aqui altera o documento.
```

- **`GROUPS`** <sub>do módulo</sub> · [L23](../src/ui/inspector.js#L23) — Grupos de propriedades computadas: [título, propriedades]. Valores padrão (sem efeito) ficam de fora.
- **`BORING`** <sub>do módulo</sub> · [L33](../src/ui/inspector.js#L33) — Valores que não dizem nada (o padrão do navegador): não aparecem.
- **`STATE_PSEUDO`** <sub>do módulo</sub> · [L39](../src/ui/inspector.js#L39) — Estados que o editor não "liga" sozinho: para testar se uma regra pega o elemento, tiramos esses pedaços.
- **`createInspectorPanel({ store, canvas, commands, toast, stage })`** · [L41](../src/ui/inspector.js#L41) — _(sem comentário)_
- **`safeMatch(q)`** <sub>do módulo</sub> · [L178](../src/ui/inspector.js#L178) — matchMedia sem quebrar com condições inválidas.

---

## src/ui/layers.js

**PAINEL DE PÁGINAS E CAMADAS** · [abrir o código](../src/ui/layers.js)

- **`createLayersPanel({ store, commands, container })`** · [L22](../src/ui/layers.js#L22) — Cria o painel de CAMADAS (aba esquerda): lista de páginas + árvore de camadas.

  Na árvore, a camada MAIS À FRENTE aparece no TOPO (a lista é o array de trás para a frente). Cada linha tem: setinha
  (abrir/fechar), ícone, nome (duplo clique renomeia), cadeado e olho. Dá para ARRASTAR linhas para reordenar ou
  aninhar (soltar no meio de um frame coloca dentro dele; na borda de cima/baixo põe antes/depois).
- **`renderPages()`** <sub>interna</sub> · [L45](../src/ui/layers.js#L45) — Desenha a lista de páginas. Clique abre; duplo clique renomeia; botão direito abre o menu (renomear, duplicar, excluir). A última página não pode ser excluída (todo projeto tem ao menos uma).
- **`screensOf(page)`** <sub>interna</sub> · [L90](../src/ui/layers.js#L90) — Quantas telas (frames da raiz, também dentro de seções) a página tem.
- **`layoutIcon(node)`** <sub>interna</sub> · [L96](../src/ui/layers.js#L96) — Ícone do frame pelo layout (linha, coluna, grade), para ler a estrutura sem abrir o painel.
- **`layoutBadge(node)`** <sub>interna</sub> · [L98](../src/ui/layers.js#L98) — Selo discreto com o CSS do layout ("flex", "grid 3") e "sticky".
- **`expandAncestors(ids)`** <sub>interna</sub> · [L111](../src/ui/layers.js#L111) — Abre as pastas que contêm as camadas selecionadas, para que a seleção fique visível na lista. Devolve true se algo mudou. (Guardamos `false` explicitamente: o padrão de "fechado" só vale para pastas nunca abertas.)
- **`isCollapsed(node, depth)`** <sub>interna</sub> · [L122](../src/ui/layers.js#L122) — Camadas dentro de frames começam FECHADAS (só os níveis de cima aparecem); selecionar abre o caminho. `ui.collapsed[id]` tem prioridade.
- **`rowFor(node, depth)`** <sub>interna</sub> · [L129](../src/ui/layers.js#L129) — Cria a linha de UMA camada (com todos os ouvintes: seleção, renomear, menu, arrastar e soltar).
  - `node` <sub>object</sub> — a camada
  - `depth` <sub>number</sub> — nível de aninhamento (recuo de 14px por nível)
- **`setAll(node, value)`** <sub>interna</sub> · [L269](../src/ui/layers.js#L269) — Alt+clique na setinha: abre ou fecha tudo dentro (recursivo).
- **`dropZone(e, row, node)`** <sub>interna</sub> · [L278](../src/ui/layers.js#L278) — Em qual "zona" da linha o mouse está: nos 25% de cima 'above', nos 25% de baixo 'below' e no meio 'inside' (só para frames/grupos, que aceitam filhos).
- **`clearDrop()`** <sub>interna</sub> · [L285](../src/ui/layers.js#L285) — Remove os indicadores visuais de soltura de todas as linhas.
- **`renderTree()`** <sub>interna</sub> · [L292](../src/ui/layers.js#L292) — Reconstrói a árvore. Percorre cada lista de trás para a frente (para a camada da frente ficar no topo) e só desce em pastas abertas. Com texto na busca, mostra uma lista plana das camadas cujo nome contém o texto. Preserva a posição de rolagem.
- **`signature()`** <sub>interna</sub> · [L326](../src/ui/layers.js#L326) — "Impressão digital" do que a lista MOSTRA (ids, nomes, visibilidade, trava, pastas abertas, seleção...). Se não mudou desde o último desenho (ex.: só a posição de uma camada mudou durante um arrasto), pulamos a reconstrução da lista — foi isso que tornou o arrastar fluido com centenas de camadas.
- **`render(reasons)`** <sub>interna</sub> · [L345](../src/ui/layers.js#L345) — Atualiza o painel só se algo visível mudou. Se a seleção mudou, abre as pastas dela; ao selecionar pelo canvas, rola a lista até a camada.

---

## src/ui/menus.js

**MENUS FLUTUANTES, JANELAS MODAIS E AJUDA DE ATALHOS** · [abrir o código](../src/ui/menus.js)

- **`closeMenus()`** · [L15](../src/ui/menus.js#L15) — Fecha o menu aberto, se houver.
- **`showMenu(x, y, items, { anchorRight = false } = {})`** · [L28](../src/ui/menus.js#L28) — Mostra um menu flutuante em (x, y), mantendo-o dentro da janela. Fecha ao clicar fora ou apertar Esc.
  - `x` <sub>number</sub> — 
  - `y` <sub>number</sub> — 
  - `items` <sub>(object\|'sep')[]</sub> — { label, hint (atalho), icon, onClick, disabled, danger, checked, heading } ou 'sep' (separador). `heading: true` = título de seção, só texto.
- **`contextMenuItems({ store, commands, tools })`** · [L90](../src/ui/menus.js#L90) — Itens do menu de botão direito, calculados para a seleção ATUAL (itens que não se aplicam ficam desabilitados). Os mesmos comandos existem como atalhos; o hint mostra a tecla (⌘ no Mac, Ctrl nos demais).
- **`SHORTCUTS`** · [L147](../src/ui/menus.js#L147) — Texto da janela "Atalhos de teclado": [seção, [[tecla, descrição], ...]]. Mantenha em sincronia com tools.js e o README.
- **`modalSeq`** <sub>do módulo</sub> · [L161](../src/ui/menus.js#L161) — Contador para dar um id único ao título de cada janela (aria-labelledby).
- **`openModal({ title, body, cls = '', onClose, dismissOnBackdrop = true })`** · [L176](../src/ui/menus.js#L176) — JANELA MODAL acessível, usada pela ajuda, Configurações e Projetos:

   - role="dialog" + aria-modal + título ligado por aria-labelledby (leitores de tela anunciam o nome);
   - o foco vai para o primeiro campo/botão e fica PRESO dentro (Tab/Shift+Tab dão a volta);
   - fecha com Esc, no X ou (por padrão) clicando fora; ao fechar, o foco volta para quem abriu.
  - `o` <sub>object</sub> — 
  - `o.title` <sub>string</sub> — título (h2)
  - `o.body` <sub>Node\|Node[]</sub> — conteúdo
  - `[o.cls]` <sub>string</sub> — classe extra para o .modal (ex.: 'narrow')
  - `[o.onClose]` <sub>() => void</sub> — 
  - `[o.dismissOnBackdrop=true]` <sub>boolean</sub> — permite fechar clicando no fundo
  - ↩︎ `{ el: HTMLElement, close: () => void ` }
- **`ask({ title, message, buttons, signal, dismissOnBackdrop = true })`** · [L223](../src/ui/menus.js#L223) — PERGUNTA no visual do app (substitui o `confirm()` do navegador, que é cinza, feio e não dá para ter 3 botões). Devolve uma Promise com o `value` do botão escolhido, ou null se a pessoa fechou (Esc, X ou clique fora habilitado).

    const r = await ask({ title: 'Substituir?', message: 'Texto...', buttons: [
      { label: 'Cancelar', value: null }, { label: 'Substituir', value: 'ok', primary: true } ] });

  O botão `primary` recebe o foco (Enter confirma); `danger` pinta de vermelho (ações que apagam algo).
  - `[]` <sub>{title: string, message: string\|Node\|Node[], buttons: {label: string, value: any, primary?: boolean, danger?: boolean</sub> — , dismissOnBackdrop?: boolean}} o
  - ↩︎ `Promise<any>`
- **`askText({ title, label, value = '', confirm = 'OK' })`** · [L246](../src/ui/menus.js#L246) — Pede UM TEXTO numa janela do app (substitui o `prompt()` do navegador). Enter confirma, Esc cancela.
  - ↩︎ `Promise<string\|null>` o texto digitado, ou null se cancelou
- **`GUIDE`** <sub>do módulo</sub> · [L266](../src/ui/menus.js#L266) — Primeiros passos da Central de ajuda: [título, texto].
- **`FAQ`** <sub>do módulo</sub> · [L274](../src/ui/menus.js#L274) — Problemas comuns: [pergunta, resposta].
- **`diagnostics(version)`** <sub>do módulo</sub> · [L284](../src/ui/menus.js#L284) — Texto de diagnóstico para colar num pedido de suporte (sem dados do projeto, só o ambiente).
- **`showHelp(tab = 'keys', version = '')`** · [L294](../src/ui/menus.js#L294) — Central de ajuda (botão ? e tecla ?): primeiros passos, atalhos, problemas comuns e suporte.
  - `[tab]` <sub>string</sub> — aba inicial: 'start' \| 'keys' \| 'faq' \| 'support'
  - `[version]` <sub>string</sub> — versão do app, para o diagnóstico

---

## src/ui/photos.js

- **`createPhotosPanel({ store, commands, canvas, toast })`** · [L9](../src/ui/photos.js#L9) — _(sem comentário)_

---

## src/ui/presence.js

**QUEM ESTÁ NO PROJETO (pessoas e agentes) NA BARRA DO TOPO** · [abrir o código](../src/ui/presence.js)

```text
 Avatares de quem está com o editor aberto (pelo seu perfil: nome e cor) e dos agentes conectados pelo MCP
 (Claude Code, Codex...). Clicar abre o painel "No projeto agora": cada agente com o que fez por último e as
 camadas que está travando, a atividade recente e o seu perfil (o nome também assina os comentários).
 Os dados vêm do servidor (server/presence.js), pelo evento SSE "presence" ou por GET /api/presence.
```

- **`COLORS`** <sub>do módulo</sub> · [L15](../src/ui/presence.js#L15) — Cores para escolher no perfil (as mesmas da presença no servidor).
- **`createPresence({ store, prefs, editProfile })`** · [L23](../src/ui/presence.js#L23) — _(sem comentário)_
- **`profile()`** <sub>interna</sub> · [L30](../src/ui/presence.js#L30) — Perfil desta pessoa (nome + cor). Sem nome ainda: "Você".

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

- **`createDesignPanel({ store, canvas, commands, tools, toast })`** · [L41](../src/ui/props.js#L41) — Cria o painel DESIGN (aba direita): editor das propriedades da seleção, com nomes e valores do CSS.

  COMO FUNCIONA (importante para entender o arquivo):
   - Cada seção (alinhar, camada, auto layout, texto, preenchimento, contorno, efeitos, exportar) é uma função que
     CONSTRÓI os campos uma vez e registra, em `updaters`, como RELER o valor de cada campo do documento.
   - `render()` só reconstrói os campos quando a ESTRUTURA muda (outra seleção, outro tipo de preenchimento, +1 sombra...),
     detectado pela `signature()`. Em qualquer outra mudança só roda os `updaters` — assim digitar num campo nunca
     perde o foco por o painel ter sido refeito.
   - Campos usam `each(fn)` para aplicar a mudança a TODAS as camadas selecionadas (valores mostrados vêm da 1ª).
- **`plainStyle(n)`** <sub>interna</sub> · [L73](../src/ui/props.js#L73) — Estilo gerado pelo modelo, sem o CSS livre (para saber o que uma edição do painel mudou).
- **`parentOf(id)`** <sub>interna</sub> · [L83](../src/ui/props.js#L83) — Pai da camada, na visão do breakpoint atual (o layout do pai pode ser outro no Celular).
- **`commit()`** <sub>interna</sub> · [L85](../src/ui/props.js#L85) — Fecha a edição (grava no histórico). Passado aos campos para chamarem ao terminar.
- **`reg(ctl)`** <sub>interna</sub> · [L87](../src/ui/props.js#L87) — Registra o `update` de um campo e devolve o elemento dele (para usar direto como filho).
- **`row(...c)`** <sub>interna</sub> · [L89](../src/ui/props.js#L89) — Linha horizontal de campos.
- **`SECTION_INFO`** <sub>interna</sub> · [L94](../src/ui/props.js#L94) — Para cada seção: ícone e uma explicação curta, em português simples, de PARA QUE ELA SERVE e qual é a propriedade do CSS por trás. A explicação abre pelo ícone de informação ao lado do título.
- **`cap(label, ...c)`** <sub>interna</sub> · [L146](../src/ui/props.js#L146) — Grupo "legenda pequena em cima + controle embaixo" (visual do Figma: "Posição", "Dimensões", "Opacidade"...).
- **`check(label, get, set)`** <sub>interna</sub> · [L154](../src/ui/props.js#L154) — Caixa de seleção (checkbox) estilizada: `get` lê, `set` aplica; grava no histórico ao alternar.
- **`pickImage(cb)`** <sub>interna</sub> · [L162](../src/ui/props.js#L162) — Abre o seletor de arquivos, importa a imagem escolhida (reduzida) e entrega { assetId, w, h } ao callback.
- **`alignRow()`** <sub>interna</sub> · [L173](../src/ui/props.js#L173) — Linha de alinhar (esquerda/centro/direita, topo/meio/base) e distribuir (precisa de 3+ camadas). Fica dentro da seção Posição.
- **`booleanRow()`** <sub>interna</sub> · [L192](../src/ui/props.js#L192) — Botões das operações BOOLEANAS (unir, subtrair, interseção, excluir) — aparecem com 2+ formas selecionadas (vetores, retângulos, elipses ou frames vazios). Atalhos: Ctrl+Alt+U / S / I / X.
- **`PRESETS`** <sub>interna</sub> · [L208](../src/ui/props.js#L208) — Tamanhos prontos para frames da raiz (telas e formatos comuns). Valor "LxA".
- **`H_CONS`** <sub>interna</sub> · [L215](../src/ui/props.js#L215) — Opções de constraint horizontal e vertical (ver model.js → applyConstraints).
- **`NO_RADIUS`** <sub>interna</sub> · [L218](../src/ui/props.js#L218) — Tipos que não têm cantos arredondados no painel (elipse já é redonda; texto/linha/vetor/grupo não têm cantos).
- **`positionSection()`** <sub>interna</sub> · [L224](../src/ui/props.js#L224) — Seção "Posição": X/Y (ou a caixa do conjunto, com várias camadas), constraints (em frame sem auto layout), rotação e espelhar. Dentro de um auto layout, X/Y ficam apagados: quem posiciona é o navegador (flex/grid).
- **`headerBlock()`** <sub>interna</sub> · [L275](../src/ui/props.js#L275) — Cabeçalho do painel: ícone, nome e tipo da camada (com a etiqueta HTML que ela vira), mostrar/ocultar, travar e Nota sob demanda.
- **`bpBanner(ns)`** <sub>interna</sub> · [L304](../src/ui/props.js#L304) — Aviso do modo responsivo: em que largura se está editando e o botão para voltar uma camada ao Desktop.
- **`noteSection()`** <sub>interna</sub> · [L323](../src/ui/props.js#L323) — Seção "Nota": uma anotação sobre PARA QUE SERVE a camada ("Botão principal: leva ao checkout"). Fica no projeto, aparece como selo na lista de camadas e vira comentário no HTML/CSS gerado (dá para desligar).
- **`htmlSection()`** <sub>interna</sub> · [L353](../src/ui/props.js#L353) — Seção "HTML": a etiqueta (tag) que a camada vira no código exportado, o endereço (para link) e a descrição para leitores de tela e buscadores (aria-label). Só afeta o código gerado; o canvas continua igual.
- **`sizeSection()`** <sub>interna</sub> · [L382](../src/ui/props.js#L382) — Seção "Tamanho": W/H (+ travar proporção), modo de largura/altura (fixo / hug = do tamanho do conteúdo / fill = preenche o espaço do auto layout) e, em frames da raiz, os tamanhos prontos (celular, desktop...).
- **`ASPECTS`** <sub>interna</sub> · [L440](../src/ui/props.js#L440) — Proporções prontas do select (valor = largura/altura; 'atual' usa o tamanho de agora).
- **`limitsBlock(n0)`** <sub>interna</sub> · [L449](../src/ui/props.js#L449) — "Limites e proporção": min/max de largura e altura (CSS min-width, max-width, min-height, max-height) e aspect-ratio. Fica recolhido (abre sozinho se algum já está em uso). Campo vazio = sem limite. Em medidas FIXAS o valor é limitado na hora; em Hug/Fill quem obedece é o navegador (o canvas mede de volta).
- **`appearanceSection()`** <sub>interna</sub> · [L485](../src/ui/props.js#L485) — Seção "Aparência": opacidade, mistura (mix-blend-mode), cantos arredondados (border-radius, juntos ou um por canto), cortar conteúdo (overflow: hidden) e máscara.
- **`componentSection()`** <sub>interna</sub> · [L520](../src/ui/props.js#L520) — Seção "Componente": criar componente / (no principal) criar instância / (na instância) ir ao principal e desanexar.
- **`A_START`** <sub>interna</sub> · [L540](../src/ui/props.js#L540) — Opções de alinhamento (valores do modelo = os do flexbox; no grid o css.js traduz flex-start → start).
- **`CSS_DOC`** <sub>interna</sub> · [L543](../src/ui/props.js#L543) — Explicações (em português) das propriedades CSS do auto layout: alimentam as dicas e a caixa "CSS ao vivo".
- **`cssTip(key)`** <sub>interna</sub> · [L631](../src/ui/props.js#L631) — Monta o objeto de dica de uma propriedade do CSS_DOC.
- **`varButton(prop)`** <sub>interna</sub> · [L637](../src/ui/props.js#L637) — Botãozinho "variável" na legenda de um campo: liga/desliga o campo a uma variável do projeto (--espaco-md).
- **`autoLayoutSection()`** <sub>interna</sub> · [L686](../src/ui/props.js#L686) — Seção "Auto layout": modo em 4 cartões (livre / linha / coluna / grade), uma caixa "CSS ao vivo" com o CSS REAL que o frame está gerando agora e os controles agrupados por assunto. Cada coisa tem uma dica ao passar o mouse (título, CSS e explicação), para quem usa perceber: "isso aqui é CSS puro".

   - FLEX: gap, flex-wrap, padding, justify-content (eixo principal) e align-items (eixo cruzado);
   - GRID: colunas/linhas, gap, padding e justify-items/align-items (onde o item fica DENTRO da célula).
- **`pad(labels)`** <sub>interna</sub> · [L739](../src/ui/props.js#L739) — Campos de padding de vários lados (T/R/B/L = topo/direita/baixo/esquerda, mesma ordem do CSS).
- **`paddingBlock()`** <sub>interna</sub> · [L745](../src/ui/props.js#L745) — padding: ou 2 campos (horizontal/vertical) ou os 4 lados, alternável pelo botão.
- **`matrix(jName, aName)`** <sub>interna</sub> · [L762](../src/ui/props.js#L762) — Matriz 3×3 do alinhamento: um clique define os dois alinhamentos de uma vez. Em coluna, o eixo principal é o vertical, então linhas e colunas da matriz trocam de papel. A célula ativa é marcada quando os valores coincidem.
- **`opts(list, grid)`** <sub>interna</sub> · [L785](../src/ui/props.js#L785) — Opções de um <select> mostrando o valor CSS de verdade (ex.: "flex-start", "space-between").
- **`subTip(text, key)`** <sub>interna</sub> · [L787](../src/ui/props.js#L787) — Legenda mono pequena com dica (usada acima dos selects de alinhamento).
- **`gridPicker()`** <sub>interna</sub> · [L793](../src/ui/props.js#L793) — Seletor visual de grade 6×6: passar o mouse ou mover o foco destaca "colunas × linhas"; clique/Enter aplica. A navegação usa foco roving e setas, para a pessoa não precisar atravessar 36 paradas de Tab.
- **`autoSection(body)`** <sub>interna</sub> · [L977](../src/ui/props.js#L977) — Casca da seção Auto layout: título + selo "CSS puro" (com dica) à direita.
- **`STATE_DOC`** <sub>interna</sub> · [L983](../src/ui/props.js#L983) — Dicas dos estados.
- **`statesSection()`** <sub>interna</sub> · [L1002](../src/ui/props.js#L1002) — Seção "Estados": alterna entre Normal, Hover, Pressionado e Foco. Num estado, o painel passa a editar SÓ as sobrescritas dele (cor, contorno, sombra, filtros, opacidade, cantos, escala): o canvas mostra a camada naquele estado e o CSS ganha `.camada:hover { … }`. No Normal ficam a transição (`transition`) e o cursor.
- **`stateScaleBlock()`** <sub>interna</sub> · [L1042](../src/ui/props.js#L1042) — Escala do estado (`transform: scale()`): só existe dentro de um estado.
- **`marginBlock()`** <sub>interna</sub> · [L1050](../src/ui/props.js#L1050) — "Margem" do item (CSS margin): horizontal/vertical, ou os 4 lados (botão) — igual ao padding do container. Valores zerados somem do documento (e do CSS). Só aparece para itens em fluxo e não absolutos.
- **`flowItemSection()`** <sub>interna</sub> · [L1075](../src/ui/props.js#L1075) — Seção "Item do layout": só para camadas dentro de auto layout. Mostra as propriedades CSS do FILHO:

   - position: absolute (ignora o layout do pai);
   - grid → grid-column / grid-row (span N), justify-self e align-self (sobrescrevem o justify-items/align-items do pai);
   - flex → align-self (sobrescreve o align-items do pai).
  "stretch" é o mesmo que tamanho "Preencher" naquele eixo, então os dois ficam ligados.
- **`selfSelect(key, axis, list, title)`** <sub>interna</sub> · [L1090](../src/ui/props.js#L1090) — Select de *-self ligado ao tamanho: stretch ⇔ 'fill' no eixo; outro valor tira o 'fill'.
- **`commandsOrigin(n)`** <sub>interna</sub> · [L1124](../src/ui/props.js#L1124) — Posição atual da camada relativa ao pai (lida do DOM): usada ao marcar "absoluta" para ela não pular de lugar.
- **`GRID_KINDS`** <sub>interna</sub> · [L1132](../src/ui/props.js#L1132) — Tipos de grade de layout (só guia visual).
- **`layoutGridsSection()`** <sub>interna</sub> · [L1134](../src/ui/props.js#L1134) — Seção "Grades de layout" de um frame: lista de grades (colunas/linhas/quadrícula) com quantidade, gutter, margem e cor.
- **`vectorSection()`** <sub>interna</sub> · [L1162](../src/ui/props.js#L1162) — Seção "Vetor": editar pontos, o ponto selecionado (tipo canto/suave e posição X/Y), caminho fechado, inverter direção e o código SVG (`d`) do desenho — para copiar, ou colar o `d` de outro SVG e trocar a forma.
- **`textSection()`** <sub>interna</sub> · [L1225](../src/ui/props.js#L1225) — Seção "Texto": estilo compartilhado, fonte, peso, tamanho, altura de linha, espaçamento, alinhamento, itálico, decoração, MAIÚSCULAS e alinhamento vertical.
- **`gradientBar()`** <sub>interna</sub> · [L1291](../src/ui/props.js#L1291) — Faixa de pré-visualização do gradiente (sempre mostrada em 90° só para ver as cores/posições).
- **`docTopColors(max = 14)`** <sub>interna</sub> · [L1301](../src/ui/props.js#L1301) — As cores mais usadas no projeto (até `max`), da mais usada para a menos.
- **`colorGroups()`** <sub>interna</sub> · [L1313](../src/ui/props.js#L1313) — Grupos de cores que o seletor de cor mostra: as do projeto e os estilos de cor (as paletas prontas vêm do próprio seletor).
- **`docColorChips(apply)`** <sub>interna</sub> · [L1319](../src/ui/props.js#L1319) — Quadradinhos com as cores mais usadas no projeto (até 14): clicar aplica. Só aparece se houver 2+ cores.
- **`colorStylePicker(styles, styleOf)`** <sub>interna</sub> · [L1331](../src/ui/props.js#L1331) — Seletor de ESTILO DE COR (visual do Figma): um botão com a amostra e o nome do estilo ligado (ou "Sem estilo de cor"). Abre um menu com as amostras dos estilos do documento, "Criar estilo a partir desta cor" e "Desvincular". Ao lado, um atalho: + cria estilo (sem estilo ligado) ou desvincula (com estilo ligado).
- **`fillSection()`** <sub>interna</sub> · [L1369](../src/ui/props.js#L1369) — Seção "Preenchimento" (ou "Cor do texto" em texto): tipo (nenhum/sólido/linear/radial/imagem) e os campos de cada tipo — cor + estilo de cor; ângulo + paradas do gradiente; imagem + ajuste.
- **`strokeSection()`** <sub>interna</sub> · [L1461](../src/ui/props.js#L1461) — Seção "Contorno": cor, espessura, estilo (sólido/tracejado/pontilhado) e posição (dentro/centro/fora). O botão +/− liga e desliga.
- **`sidesOn()`** <sub>interna</sub> · [L1506](../src/ui/props.js#L1506) — O contorno da camada selecionada está "por lado"?
- **`strokeSidesRows(st)`** <sub>interna</sub> · [L1512](../src/ui/props.js#L1512) — Linhas "Lados" do contorno: atalhos (todos, só em cima, só embaixo, esquerda, direita, em cima e embaixo, nas laterais) e "Personalizado", que mostra a espessura de cada lado. Gera o CSS `border-top`, `border-bottom`...
- **`current()`** <sub>interna</sub> · [L1518](../src/ui/props.js#L1518) — Qual atalho corresponde aos lados atuais (ou 'custom' se as espessuras forem diferentes entre si).
- **`toggleSide(i)`** <sub>interna</sub> · [L1542](../src/ui/props.js#L1542) — Liga/desliga um lado: de "todos", o clique escolhe SÓ aquele lado; depois soma/tira; os 4 ligados voltam a "todos".
- **`effectsSection()`** <sub>interna</sub> · [L1574](../src/ui/props.js#L1574) — Seção "Efeitos": lista de sombras (x, y, blur, spread, cor, interna) + blur da camada + desfoque de fundo (vidro).
- **`colorFiltersBlock()`** <sub>interna</sub> · [L1600](../src/ui/props.js#L1600) — Filtros de COR (brightness, contrast, saturate, grayscale, hue-rotate): recolhido, abre sozinho se algum está em uso.
- **`customCssSection()`** <sub>interna</sub> · [L1619](../src/ui/props.js#L1619) — CSS LIVRE: qualquer declaração que o painel ainda não tem ("propriedade: valor;" por linha). Vale por breakpoint; linhas que o navegador não entende ficam marcadas em amarelo (o navegador as ignora).
- **`exportSection()`** <sub>interna</sub> · [L1645](../src/ui/props.js#L1645) — Seção "Exportar": escala (1x–4x) e botões PNG, SVG e HTML da seleção.
- **`emptySection()`** <sub>interna</sub> · [L1671](../src/ui/props.js#L1671) — Painel quando nada está selecionado: resumo da página e dicas de atalhos.
- **`signature()`** <sub>interna</sub> · [L1691](../src/ui/props.js#L1691) — "Assinatura" da ESTRUTURA do painel: tudo que, se mudar, exige reconstruir os campos (outra seleção, outro tipo de preenchimento, +1 sombra, layout ligado/desligado...). NÃO inclui valores como a espessura ou o padding — esses só pedem para reler os campos, e reconstruir no meio da digitação faria o campo perder o foco.
- **`render()`** <sub>interna</sub> · [L1719](../src/ui/props.js#L1719) — Reconstrói o painel se a estrutura mudou; em qualquer caso, atualiza os valores dos campos.

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
- **`modeButton(m, i)`** <sub>interna</sub> · [L30](../src/ui/responsive.js#L30) — Botão de um modo (Desktop ou breakpoint). Só o ativo mostra o nome; todos mostram a largura no balão.
- **`buildSeg()`** <sub>interna</sub> · [L41](../src/ui/responsive.js#L41) — Refaz os botões quando a lista de breakpoints muda.
- **`saveBps(list, drop)`** <sub>interna</sub> · [L49](../src/ui/responsive.js#L49) — Grava a lista de breakpoints no documento (com desfazer). `drop`: id cujos ajustes são apagados das camadas.
- **`bpMenu(e)`** <sub>interna</sub> · [L76](../src/ui/responsive.js#L76) — Menu de breakpoints: adicionar presets ou um personalizado; renomear, mudar a largura ou remover os do projeto.
- **`countOverrides(bp, all = false)`** <sub>interna</sub> · [L108](../src/ui/responsive.js#L108) — Quantas camadas da página têm sobrescritas neste breakpoint.
- **`fitScreens()`** <sub>interna</sub> · [L115](../src/ui/responsive.js#L115) — Ajusta a largura das telas (frames da raiz e dentro de seções) para a largura típica do modo.
- **`makeMode(opts)`** <sub>interna</sub> · [L130](../src/ui/responsive.js#L130) — Cria um modo de cor a partir de uma opção do menu.
- **`modeMenu(e)`** <sub>interna</sub> · [L136](../src/ui/responsive.js#L136) — Menu único do modo de cor: escolher o modo visto, criar um novo e, no modo ativo, renomear/excluir.

---

## src/ui/settings.js

**PÁGINA "CONFIGURAÇÕES" (tela cheia dentro do app, não é janela modal)** · [abrir o código](../src/ui/settings.js)

```text
 Aberta pelo menu da conta (avatar no topo), por Arquivo → Configurações, pelo indicador "Salvo" ou Ctrl+,
 (vírgula). Abrir só ESCONDE o editor (fica `inert` por trás, sem recarregar nada); "Voltar ao editor" e Esc
 fecham. À esquerda, uma barra fixa com as seções; à direita, o conteúdo da seção escolhida, em cartões:
  1. Conta              — o seu perfil local (nome, e-mail, cargo, avatar, idioma), salvo sozinho (account.js).
  2. Projetos e pasta   — pasta do computador (o SERVIDOR grava lá), auto-salvar, versões e a cópia no navegador.
  3. Agente de IA       — provedor, modelo (lista "Ver modelos", "Testar modelo" com os resultados guardados), endereço
                          da API, tempos (1º pedaço, tempo máximo pensando) e "Pedir menos raciocínio" (NVIDIA NIM).
  4. Chaves de API      — a chave do provedor escolhido e a do Jev (TypeSafe); ficam só neste computador.
  5. MCP e agentes      — acesso de administrador e como ligar Claude Code / Codex / Claude Desktop.
  6. Aparência          — tema, tela ao abrir o app e o que a roda do mouse faz.
  7. Atalhos            — a lista de atalhos de teclado.
  8. Sobre e suporte    — versão e a Central de ajuda.
 Explicações longas (copiar a pasta para a nuvem, caminhos, comandos) ficam atrás do botão "i" ou de um
 "Mostrar detalhes": quem não precisa delas não as vê.
```

- **`formatBytes(b)`** · [L32](../src/ui/settings.js#L32) — "12345678" bytes → "11,8 MB".
- **`checkbox(label, checked, onchange)`** <sub>do módulo</sub> · [L36](../src/ui/settings.js#L36) — Caixa de seleção no estilo do app (a mesma de props.js).
- **`formatSecs(ms)`** · [L42](../src/ui/settings.js#L42) — "1234" ms → "1,2 s".
- **`testBadge(t)`** · [L44](../src/ui/settings.js#L44) — Selo curto do teste de um modelo (para a lista de modelos): "✓ ferramentas · 1,2 s", "✗ sem ferramentas"...
- **`SECTIONS`** <sub>do módulo</sub> · [L48](../src/ui/settings.js#L48) — Seções da página: [id, ícone, nome, descrição curta no cabeçalho].
- **`current`** <sub>do módulo</sub> · [L60](../src/ui/settings.js#L60) — A página aberta agora (só existe uma).
- **`openSettings({ store, saving, prefs, savePrefs, toast, account, section = 'accou…)`** · [L74](../src/ui/settings.js#L74) — Abre a página de Configurações (ou, se já está aberta, só troca de seção).
  - `deps` <sub>object</sub> — 
  - `deps.store` <sub>object</sub> — 
  - `deps.saving` <sub>object</sub> — ver saving.js (refresh, server)
  - `deps.prefs` <sub>object</sub> — preferências (autoFolder, wheelMode, startScreen)
  - `deps.savePrefs` <sub>() => void</sub> — 
  - `deps.toast` <sub>(m: string) => void</sub> — 
  - `deps.account` <sub>object</sub> — conta local (account.js)
  - `[deps.section]` <sub>string</sub> — seção para mostrar ('account', 'folder', 'ai'...)
  - ↩︎ `{ close: () => void ` }
- **`show(id, focus = false)`** <sub>interna</sub> · [L95](../src/ui/settings.js#L95) — Mostra uma seção (as outras ficam escondidas, mas continuam montadas: campos não salvos não se perdem).
- **`onKey(e)`** <sub>interna</sub> · [L106](../src/ui/settings.js#L106) — Esc fecha (se não houver janela, menu ou balão de informação por cima).
- **`sectionEl(id, ...cards)`** <sub>interna</sub> · [L136](../src/ui/settings.js#L136) — Cabeçalho + cartões de uma seção.
- **`card(title, desc, info, ...body)`** <sub>interna</sub> · [L143](../src/ui/settings.js#L143) — Cartão: título (com "i" opcional), descrição curta e o conteúdo.
- **`row(label, hint, ...control)`** <sub>interna</sub> · [L149](../src/ui/settings.js#L149) — Linha rótulo/descrição à esquerda e controle à direita.
- **`details(summary, ...body)`** <sub>interna</sub> · [L151](../src/ui/settings.js#L151) — Bloco recolhido "Mostrar detalhes".
- **`queue(patch, wait = 450)`** <sub>interna</sub> · [L168](../src/ui/settings.js#L168) — Junta mudanças e grava depois de uma pausa curta (indicador "Salvando…" → "Salvo").
- **`aiSections(ai)`** <sub>interna</sub> · [L299](../src/ui/settings.js#L299) — Monta as seções de IA e de chaves juntas: "Ver modelos" usa a chave digitada na seção de chaves.
- **`save(patch, done = 'Agente configurado.', out = msg)`** <sub>interna</sub> · [L305](../src/ui/settings.js#L305) — Grava no servidor e redesenha (a chave só vai quando você digita uma nova).
- **`putConfig(patch)`** <sub>interna</sub> · [L313](../src/ui/settings.js#L313) — Grava sem redesenhar a página (para não sumir com a lista de modelos aberta).
- **`jevCard()`** <sub>interna</sub> · [L474](../src/ui/settings.js#L474) — CHAVE DO JEV (TypeSafe): liga as ferramentas jev_choose / jev_score / jev_check do agente.
- **`pexelsCard()`** <sub>interna</sub> · [L486](../src/ui/settings.js#L486) — Chave opcional do Pexels: usada só pelo servidor na busca da biblioteca de fotos.
- **`render()`** <sub>interna</sub> · [L570](../src/ui/settings.js#L570) — Redesenha o conteúdo (ao abrir e depois de cada mudança que o servidor confirma).
- **`settingsOpen()`** · [L599](../src/ui/settings.js#L599) — A página de Configurações está aberta?

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
  3. IA: o endereço /mcp (programas como Claude Code e Codex usam o editor aberto) e /api/agent/... (o Assistente
     fala com a OpenAI usando a chave guardada só aqui). Quem executa as ferramentas é o EDITOR (ver agentApi).

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

- **`root`** <sub>do módulo</sub> · [L47](../server.js#L47) — Pasta do projeto (onde está este arquivo). Tudo que o servidor entrega é lido a partir daqui.
- **`port`** <sub>do módulo</sub> · [L49](../server.js#L49) — Porta HTTP. Padrão 5173; mude com `PORT=8080 npm start`.
- **`allowed`** <sub>do módulo</sub> · [L51](../server.js#L51) — Lista branca: SÓ estes caminhos são servidos (o app em si). package.json, .git, tests, projetos etc. nunca saem por aqui.
- **`configFile`** <sub>do módulo</sub> · [L53](../server.js#L53) — Arquivo onde a configuração (pasta escolhida, nº de versões) é lembrada entre execuções. Fica fora do git (.gitignore).
- **`VERSION_EVERY_MS`** <sub>do módulo</sub> · [L59](../server.js#L59) — Intervalo mínimo entre duas versões guardadas do mesmo projeto (o auto-salvar grava a cada poucos segundos; versões não).
- **`MAX_BODY`** <sub>do módulo</sub> · [L61](../server.js#L61) — Tamanho máximo aceito para um projeto (imagens embutidas deixam o .json grande).
- **`FILE_RE`** <sub>do módulo</sub> · [L63](../server.js#L63) — Nome de arquivo aceito: começa com letra/número, só usa letras, números, ponto, - e _, e termina em .json.
- **`types`** <sub>do módulo</sub> · [L66](../server.js#L66) — Tipo MIME por extensão. O de .js precisa ser text/javascript, senão o navegador recusa carregar módulos ES.
- **`loadConfig()`** <sub>do módulo</sub> · [L78](../server.js#L78) — Lê a configuração salva (ou a padrão, se ainda não existir / estiver corrompida).
- **`config`** <sub>do módulo</sub> · [L87](../server.js#L87) — Configuração atual, carregada uma vez ao iniciar e atualizada pelo PUT /api/config.
- **`loadAccount()`** <sub>do módulo</sub> · [L91](../server.js#L91) — Conta local salva (sempre completa; arquivo ausente ou corrompido = conta vazia).
- **`expandHome(p)`** <sub>do módulo</sub> · [L96](../server.js#L96) — Expande `~/` para a pasta pessoal do usuário, mantendo o restante do caminho.
- **`useFolder(input)`** <sub>do módulo</sub> · [L102](../server.js#L102) — Valida e aplica uma pasta nova: precisa ser caminho ABSOLUTO; é criada se não existir; e testamos se dá para escrever nela (gravando e apagando um arquivo de teste) ANTES de aceitar — melhor errar agora do que no auto-salvar.
- **`publicConfig()`** <sub>do módulo</sub> · [L114](../server.js#L114) — O que a configuração mostra para fora: tudo MENOS a chave da IA (ela nunca sai deste computador nem volta ao navegador).
- **`httpError(status, message)`** <sub>do módulo</sub> · [L118](../server.js#L118) — Erro com status HTTP e mensagem que pode ir para a tela do usuário.
- **`knownContent`** <sub>do módulo</sub> · [L123](../server.js#L123) — Conteúdo de cada projeto que o servidor leu/gravou por último (ver PUT /api/projects/:arquivo).
- **`hashOf(data)`** <sub>do módulo</sub> · [L125](../server.js#L125) — Hash curto do conteúdo de um arquivo de projeto.
- **`projectWriteQueues`** <sub>do módulo</sub> · [L127](../server.js#L127) — Serializa comparação de revisão + gravação por arquivo, sem bloquear projetos independentes.
- **`readBody(req)`** <sub>do módulo</sub> · [L146](../server.js#L146) — Lê o corpo do pedido inteiro (com limite de tamanho) e devolve como texto.
- **`localHost(host = '')`** <sub>do módulo</sub> · [L157](../server.js#L157) — O Host do pedido é esta máquina? (protege contra DNS rebinding)
- **`localOrigin(origin)`** <sub>do módulo</sub> · [L159](../server.js#L159) — A página que fez o pedido (Origin) é local? Pedidos sem Origin (curl, testes) são aceitos: não vêm de um site.
- **`projectPath(name)`** <sub>do módulo</sub> · [L162](../server.js#L162) — Caminho do projeto `name` dentro da pasta configurada (o nome já foi validado por FILE_RE).
- **`versionsDir(name)`** <sub>do módulo</sub> · [L164](../server.js#L164) — Pasta onde ficam as versões antigas de um projeto: <pasta>/.versoes/<nome-sem-.json>/
- **`thumbPath(name)`** <sub>do módulo</sub> · [L166](../server.js#L166) — Miniatura (SVG) de um projeto, mostrada na página inicial: <pasta>/.miniaturas/<nome-sem-.json>.svg
- **`MAX_THUMB`** <sub>do módulo</sub> · [L168](../server.js#L168) — Tamanho máximo de uma miniatura (o app já tira imagens grandes antes de mandar).
- **`checkName(name)`** <sub>do módulo</sub> · [L170](../server.js#L170) — Valida o nome vindo da URL.
- **`listVersions(name)`** <sub>do módulo</sub> · [L176](../server.js#L176) — Lista as versões guardadas de um projeto, da mais nova para a mais antiga.
- **`snapshotVersion(name)`** <sub>do módulo</sub> · [L192](../server.js#L192) — Antes de sobrescrever um projeto, guarda o conteúdo ANTERIOR como versão — mas só se a última versão tiver mais de 10 min (senão o auto-salvar criaria centenas). Depois apaga as mais antigas além de `keepVersions`.
- **`api(req, res, path)`** <sub>do módulo</sub> · [L226](../server.js#L226) — Rotas da API (todas respondem JSON):

    GET  /api/status                         → { ok, folder, keepVersions }
    PUT  /api/config        { folder?, keepVersions? }  → muda a pasta / nº de versões
    GET  /api/account                        → conta local { name, email, role, color, avatar, language, createdAt }
    PUT  /api/account       { campos... }    → atualiza o perfil (400 com mensagem se algo for inválido)
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
- **`editors`** <sub>do módulo</sub> · [L374](../server.js#L374) — PONTE COM O EDITOR. Quem executa as ferramentas da IA é o editor aberto no navegador (é lá que o projeto está vivo, com desfazer e a janela de permissão). O editor se conecta em GET /api/agent/events (Server-Sent Events: uma conexão que fica aberta e pela qual o servidor manda mensagens); o servidor manda "use a ferramenta X" e espera a resposta em POST /api/agent/reply. Com várias abas abertas, vale a última que conectou.
- **`editorSessions`** <sub>do módulo</sub> · [L376](../server.js#L376) — Identidade visual (aba e pessoa) de cada conexão SSE do editor.
- **`editorBridge`** <sub>do módulo</sub> · [L378](../server.js#L378) — Pede cancelamento ao editor ao atingir 3 min; encerra após 5 s sem confirmação para não prender o MCP.
- **`presence`** <sub>do módulo</sub> · [L386](../server.js#L386) — VÁRIOS AGENTES AO MESMO TEMPO. Cada conexão MCP ganha uma sessão (cabeçalho Mcp-Session-Id, criado no "initialize") com o nome do programa. A presença guarda quem está conectado, o que fez e as TRAVAS: alterar uma camada a reserva por alguns segundos para aquela sessão; outro agente que tentar mexer nela recebe um aviso.
- **`mcpSessions`** <sub>do módulo</sub> · [L388](../server.js#L388) — Sessões MCP: identidade e chamadas em voo, para o DELETE não soltar travas antes do fim de uma edição.
- **`activeMcpCalls`** <sub>do módulo</sub> · [L390](../server.js#L390) — Chamadas JSON-RPC ativas, indexadas por sessão e id para notifications/cancelled.
- **`mcpSessionSweep`** <sub>do módulo</sub> · [L392](../server.js#L392) — Remove sessões abandonadas pelo cliente sem expirar operações ainda em andamento.
- **`broadcastPresence()`** <sub>do módulo</sub> · [L404](../server.js#L404) — Manda o retrato da presença para todas as abas do editor (evento SSE "presence").
- **`callAgentTool(sid, state, tool, args, name, signal, editorId = '')`** <sub>do módulo</sub> · [L415](../server.js#L415) — Executa uma ferramenta pedida por uma sessão MCP: presença, trava das camadas e registro da atividade.
- **`mcpRoute(req, res)`** <sub>do módulo</sub> · [L460](../server.js#L460) — MCP por HTTP (http://localhost:5173/mcp, transporte "Streamable HTTP" do MCP, respondendo JSON simples). POST com uma mensagem JSON-RPC (ou uma lista delas). GET não é usado (405), como o protocolo permite.
- **`imageAi`** <sub>do módulo</sub> · [L533](../server.js#L533) — IA de foto (server/imageai.js): lê a configuração atual e grava as mudanças no mesmo arquivo.
- **`DEFAULT_PROVIDER`** <sub>do módulo</sub> · [L536](../server.js#L536) — Provedor padrão do Assistente (o 1º da lista: OpenAI). Troque em Configurações (OpenAI, NVIDIA NIM, Ollama, outro).
- **`agentConfig()`** <sub>do módulo</sub> · [L542](../server.js#L542) — Configuração do Assistente: endereço da API, modelo e a chave DAQUELE endereço. Cada provedor guarda a sua chave (config.agent.keys[endereço]); a chave também pode vir da variável de ambiente do provedor (OPENAI_API_KEY, NVIDIA_API_KEY). `config.agent.apiKey` é o formato antigo (uma chave só) e continua valendo.
- **`jevConfig()`** <sub>do módulo</sub> · [L564](../server.js#L564) — Chave e endereço do Jev (TypeSafe): a chave vem de Configurações → Chaves de API (config.jev.apiKey) ou da variável de ambiente JEV_API_KEY, e NUNCA volta ao navegador. O endereço pode ser trocado por JEV_API_URL ou, só para um servidor DESTA máquina (testes), por config.jev.url.
- **`agentInstructions()`** <sub>do módulo</sub> · [L573](../server.js#L573) — Instruções da IA (quem ela é, o que pode fazer, como a ferramenta funciona): o arquivo docs/AGENTE.md, lido a cada conversa (editar o arquivo muda o comportamento na hora, sem reiniciar). Sem o arquivo, vale o texto curto embutido.
- **`authHeader(a)`** <sub>do módulo</sub> · [L575](../server.js#L575) — Monta o cabeçalho de autorização (servidores locais, como o Ollama, não usam chave).
- **`chatError(code, message, extra = {})`** <sub>do módulo</sub> · [L578](../server.js#L578) — Erro de uma conversa com a IA, com um código para a tela (first_token, thinking, no_tools, http, network).
- **`streamChat({ a, model, messages, tools, extras = {}, signal, onDelta = () => {…)`** <sub>do módulo</sub> · [L587](../server.js#L587) — Uma rodada de chat em STREAMING com a API (OpenAI, NVIDIA NIM, Ollama...). Repassa os pedaços em `onDelta` ({ text, reasoning }) enquanto chegam e devolve a mensagem completa ({ content, reasoning, tool_calls, ... }). Tempos: sem nenhum pedaço em `firstTokenMs` → erro "first_token"; só raciocínio por mais de `maxThinkMs` → erro "thinking"; parado sem receber nada por `firstTokenMs` no meio → erro "stalled". `signal` aborta tudo (botão Parar). Servidores que ignoram stream:true e mandam JSON inteiro também funcionam.
- **`chatWithRetry({ a, model, system, messages, tools, signal, onDelta })`** <sub>do módulo</sub> · [L665](../server.js#L665) — Chat com as tentativas certas: manda os extras de raciocínio da NIM (reasoningParams) e, se a API recusar algum campo extra, tenta de novo sem eles. Devolve o mesmo que streamChat e `note` (aviso para a tela, se houver).
- **`chatErrorText(err, model, a)`** <sub>do módulo</sub> · [L678](../server.js#L678) — Frase para a tela a partir do erro de chat (com o que fazer).
- **`PING_TOOL`** <sub>do módulo</sub> · [L692](../server.js#L692) — Ferramenta mínima usada por "Testar modelo" (mede se o modelo chama ferramentas).
- **`agentApi(req, res, parts)`** <sub>do módulo</sub> · [L710](../server.js#L710) — Rotas da IA:

    GET  /api/agent/events   → o editor fica ouvindo os pedidos de ferramenta (Server-Sent Events)
    POST /api/agent/reply    { id, result } → o editor devolve o resultado de um pedido
    GET  /api/agent/config   → { baseUrl, model, hasKey, editors } (a chave NUNCA é devolvida)
    PUT  /api/agent/config   { apiKey?, model?, baseUrl? } → grava (apiKey "" apaga a chave)
    POST /api/agent/chat     { messages, tools, model?, memory?, subagent? } → repassa à API de chat (OpenAI, NVIDIA NIM,
                             Ollama...) com a SUA chave e as instruções de docs/AGENTE.md, em STREAMING: responde NDJSON
                             (um JSON por linha): {type:"start"} · {type:"reasoning", text} · {type:"text", text} ·
                             {type:"done", message, model, firstTokenMs, totalMs} · {type:"error", error, code}.
                             Fechar a conexão (botão Parar) aborta o pedido à API na hora.
    POST /api/agent/test     { model? } → testa o modelo: tempo até o 1º pedaço e se ele chama ferramentas (guarda)
    POST /api/agent/jev      { tool, args } → roda jev_choose / jev_score / jev_check na API do Jev (chave só aqui)
    GET  /api/agent/models   → { models } a lista de modelos da conta (testa a chave)
    PUT  /api/agent/mcp      { admin } → liga/desliga o "Acesso de administrador" do MCP (só programas deste computador)

---

## server/account.js

**CONTA LOCAL (o seu perfil neste computador)** · [abrir o código](../server/account.js)

```text
 O Stylo roda na SUA máquina, então a "conta" não tem senha: é só um perfil guardado pelo servidor num
 arquivo JSON ao lado da configuração (designer.account.json). Ele assina comentários, aparece na presença
 ("quem está no projeto") e no avatar do topo.
   { name, email, role, color, avatar (data URL de imagem ou ""), language, createdAt, updatedAt }
 Este módulo só VALIDA e LIMITA os campos (o servidor lê/grava o arquivo). Funções puras: dá para testar.
```

- **`ACCOUNT_COLORS`** · [L14](../server/account.js#L14) — Cores de avatar aceitas (as mesmas da presença e do editor).
- **`ACCOUNT_LANGUAGES`** · [L16](../server/account.js#L16) — Idiomas oferecidos (a interface hoje é só pt-BR; guardamos a escolha para o futuro).
- **`MAX_AVATAR`** · [L18](../server/account.js#L18) — Tamanho máximo da imagem do avatar (o data URL inteiro), ~200 KB.
- **`emptyAccount()`** · [L21](../server/account.js#L21) — Conta vazia (antes de a pessoa preencher qualquer coisa).
- **`line(v, max)`** <sub>do módulo</sub> · [L24](../server/account.js#L24) — Texto de uma linha, sem caracteres de controle, cortado em `max`.
- **`mergeAccount(current, patch = {})`** · [L30](../server/account.js#L30) — Aplica `patch` (vindo do navegador) sobre a conta `current`. Campos desconhecidos são ignorados. Lança Error com mensagem legível quando um valor é inválido (o servidor responde 400 com ela).
- **`normalizeAccount(saved)`** · [L61](../server/account.js#L61) — Lê uma conta salva (pode estar velha ou corrompida): devolve sempre um objeto completo e válido.

---

## server/editor-bridge.js

- **`createEditorBridge({ getEditors, getEditorId = () => '', timeoutMs = 3 * 60 * 1000, ca…)`** · [L2](../server/editor-bridge.js#L2) — Ponte entre pedidos do servidor e a aba do editor conectada por SSE.

---

## server/imageai.js

**EDIÇÃO GENERATIVA DE FOTO (preencher área, expandir, trocar objeto, gerar)** · [abrir o código](../server/imageai.js)

```text
 O editor de imagem (src/ui/imageai.js) faz as edições LOCAIS sozinho, no navegador. As GENERATIVAS precisam de um
 modelo de imagem: o navegador manda a imagem (e a máscara) para cá, e ESTE arquivo fala com a API de imagens
 compatível com a OpenAI usando a chave guardada no servidor (config.agent.keys[endereço]). A chave nunca vai ao
 navegador.

   POST {endereço}/images/edits        multipart: model, prompt, image (PNG), mask (PNG), size, n
   POST {endereço}/images/generations  JSON: model, prompt, size, n

 Qual endereço/modelo: o de Configurações → Agente de IA e modelos → Modelo de imagem (config.imageai) ou, sem
 escolha, o do provedor do Agente — se ele tiver API de imagem (a OpenAI tem; NVIDIA NIM e Ollama não).

 Rotas (ligadas em server.js → api(), que já confere Host, Origin e Content-Type JSON):
   GET  /api/imageai/config   → { available, reason, baseUrl, model, provider, hasKey, custom, maxMB, timeoutSec }
   PUT  /api/imageai/config   { baseUrl?, model?, apiKey? } → grava ("" volta ao padrão / apaga a chave)
   POST /api/imageai/edit     { image, mask?, prompt, size? } → { image } (data URLs PNG)
   POST /api/imageai/generate { prompt, size? } → { image }
```

- **`IMAGE_MODELS`** · [L28](../server/imageai.js#L28) — Modelo de imagem padrão por provedor (provedor fora da lista = sem API de imagem até alguém escolher um modelo).
- **`MAX_REQUEST`** <sub>do módulo</sub> · [L30](../server/imageai.js#L30) — Limite do pedido inteiro (imagem + máscara em base64) e de cada imagem decodificada.
- **`SIZES`** <sub>do módulo</sub> · [L33](../server/imageai.js#L33) — Tamanhos aceitos (os da API da OpenAI).
- **`fail(status, message, code = 'error')`** <sub>do módulo</sub> · [L36](../server/imageai.js#L36) — Erro com status e mensagem para a tela (o mesmo formato do server.js: expose = pode mostrar).
- **`imageConfigOf(config = {}, env = process.env)`** · [L43](../server/imageai.js#L43) — Endereço, modelo e chave do modelo de imagem a partir da configuração do servidor.
  - `config` <sub>object</sub> — configuração inteira (designer.config.json)
  - `[env]` <sub>object</sub> — variáveis de ambiente (testes passam outras)
- **`apiErrorText(status, detail, { baseUrl = '', model = '' } = {})`** · [L62](../server/imageai.js#L62) — Texto claro para um erro HTTP da API de imagens.
- **`readImageResult(json, { timeoutMs = 60000, fetchImpl = fetch } = {})`** · [L76](../server/imageai.js#L76) — Lê a resposta da API ({ data: [{ b64_json } | { url }] }) e devolve um data URL. Se vier só a URL, baixa a imagem (com tempo e tamanho limitados).
- **`readJson(req)`** <sub>do módulo</sub> · [L96](../server/imageai.js#L96) — Lê o corpo JSON com limite próprio (imagens em base64 são grandes, mas não tanto).
- **`imageBytes(url, label)`** <sub>do módulo</sub> · [L108](../server/imageai.js#L108) — Data URL de imagem → bytes (com limite e só PNG/JPEG/WebP).
- **`promptOf(v)`** <sub>do módulo</sub> · [L118](../server/imageai.js#L118) — Texto do pedido (prompt): obrigatório, até 1000 caracteres.
- **`callApi(ic, path, init)`** <sub>do módulo</sub> · [L125](../server/imageai.js#L125) — Chama a API de imagens com tempo limite e transforma qualquer falha numa mensagem clara.
- **`sizeOf(s, model)`** <sub>do módulo</sub> · [L145](../server/imageai.js#L145) — Tamanho pedido (só os aceitos); dall-e-2 só faz quadrado.
- **`createImageAi({ getConfig, saveConfig })`** · [L154](../server/imageai.js#L154) — Cria o tratador das rotas /api/imageai/...

---

## server/mcp.js

**O PROTOCOLO MCP (Model Context Protocol), SEM DEPENDÊNCIAS** · [abrir o código](../server/mcp.js)

```text
 MCP é o "padrão de tomada" que programas de IA (Claude Code, Claude Desktop, Codex, Cursor...) usam para
 conversar com ferramentas externas. Por baixo é JSON-RPC 2.0: a IA manda { id, method, params } e recebe
 { id, result } ou { id, error }. Só precisamos de quatro métodos:
   initialize   → "oi, eu sou o Stylo e sei usar ferramentas"
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
- **`handleMcp(msg, { callTool, version = '0.0.0', session = {}, instructions = AG…)`** · [L38](../server/mcp.js#L38) — Responde UMA mensagem JSON-RPC do MCP.
  - `msg` <sub>object</sub> — a mensagem já lida (objeto)
  - `deps` <sub>object</sub> — 
  - `deps.callTool` <sub>(name: string, args: object, client: string) => Promise<object></sub> — executa a ferramenta (no editor)
  - `deps.version` <sub>string</sub> — versão do app (aparece para a IA)
  - `[deps.instructions]` <sub>string</sub> — quem a IA é e como trabalhar (o servidor lê de docs/AGENTE.md)
  - ↩︎ `Promise<object\|null>` a resposta, ou null quando a mensagem é um aviso (sem id)

---

## server/photos.js

- **`OPENVERSE_PAGE`** · [L3](../server/photos.js#L3) — Openverse sem login aceita no máximo 20 por página (com 24 responde 401).
- **`MAX_PHOTO_BYTES`** · [L4](../server/photos.js#L4) — _(sem comentário)_
- **`commercialLicense(result)`** · [L12](../server/photos.js#L12) — _(sem comentário)_
- **`normalizeOpenverse(item)`** · [L20](../server/photos.js#L20) — _(sem comentário)_
- **`normalizePexels(item)`** · [L36](../server/photos.js#L36) — _(sem comentário)_
- **`normalizeResults(openverse = [], pexels = [])`** · [L49](../server/photos.js#L49) — _(sem comentário)_
- **`validateProxyUrl(value)`** · [L56](../server/photos.js#L56) — _(sem comentário)_
- **`validateImageResponse(contentType, contentLength)`** · [L66](../server/photos.js#L66) — _(sem comentário)_
- **`boundedPhotoBytes(response)`** · [L73](../server/photos.js#L73) — _(sem comentário)_
- **`createPhotosHandler({ getKey = () => '', fetchImpl = fetch, now = Date.now } = {})`** · [L96](../server/photos.js#L96) — _(sem comentário)_

---

## server/presence.js

**QUEM ESTÁ NO PROJETO (pessoas e agentes) E AS TRAVAS POR CAMADA** · [abrir o código](../server/presence.js)

```text
 Várias IAs podem usar o mesmo editor ao mesmo tempo pelo MCP (Claude Code, Codex, ChatGPT...). Cada conexão MCP
 é uma SESSÃO com nome próprio. Para duas não brigarem pela mesma camada, quem altera uma camada fica com a TRAVA
 dela por alguns segundos: outro agente que tentar mexer nela recebe um aviso claro ("espere") em vez de
 sobrescrever o trabalho. Pessoas (abas do editor) também aparecem aqui, com nome e cor.
 Só memória: nada disso é gravado em disco. Sem dependências (o servidor e os testes importam este arquivo).
```

- **`PRESENCE_COLORS`** · [L14](../server/presence.js#L14) — Cores das pessoas e agentes (escolhidas pelo nome: o mesmo nome tem sempre a mesma cor).
- **`colorFor(name)`** · [L15](../server/presence.js#L15) — _(sem comentário)_
- **`LOCK_MS`** · [L22](../server/presence.js#L22) — Tempo da trava de uma camada depois de uma alteração.
- **`AGENT_IDLE_MS`** · [L24](../server/presence.js#L24) — Agente sem atividade há mais que isso some da lista.
- **`DOCUMENT_LOCK`** · [L26](../server/presence.js#L26) — Recurso compartilhado por operações que mudam a estrutura ou o estado inteiro do projeto.
- **`targetsOf(args = {})`** · [L29](../server/presence.js#L29) — ids de camadas que uma ferramenta vai alterar (para as travas).
- **`createPresence({ now = Date.now } = {})`** · [L40](../server/presence.js#L40) — Cria o registro de presença.

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

- **`argi`** <sub>do módulo</sub> · [L27](../scripts/mcp.mjs#L27) — Nome deste agente na presença e na janela de permissão (vários agentes no mesmo projeto): --agente "Nome" ou a variável STYLO_AGENT. Sem isso, vale o nome que o programa manda no initialize (ex.: "claude-code").
- **`session`** <sub>do módulo</sub> · [L30](../scripts/mcp.mjs#L30) — Sessão MCP deste processo (o servidor cria no initialize): cada janela de agente é uma sessão separada.
- **`send(obj)`** <sub>do módulo</sub> · [L32](../scripts/mcp.mjs#L32) — Escreve uma resposta (uma linha JSON) na saída. NADA além disso pode ir para a saída: quebraria o protocolo.
- **`disconnect()`** <sub>do módulo</sub> · [L36](../scripts/mcp.mjs#L36) — Libera a presença e as travas do agente quando o cliente fecha o processo normalmente.
