# Changelog

Todas as mudanças relevantes do projeto, da mais nova para a mais antiga. Formato inspirado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/) (enquanto estiver na `0.x`, mudanças grandes podem acontecer entre versões).

Categorias: **Adicionado** · **Alterado** · **Corrigido** · **Desempenho** · **Documentação**.

---

## [0.12.0] — 2026-10-08 — Painel Design explicativo, notas, HTML semântico e paletas

### Adicionado
- **Painel Design que explica**: cada seção ganhou ícone, cabeçalho clicável que **recolhe/abre** (lembrado) e uma explicação curta em português simples; o botão **Explicações** (topo do painel) liga/desliga esses textos. Novo **cabeçalho da seleção** com ícone, nome, tipo, a etiqueta HTML (`<div>`) e atalhos para ocultar/travar.
- **Todos os campos com legenda + nome do CSS + dica rica**: posição (`left · top`), dimensões, modo de largura/altura (fixo/hug/fill), rotação, restrições, opacidade, mesclagem, cantos, fonte, peso, tamanho, altura da linha, espaçamento, alinhamento e caixa do texto, tipo de preenchimento, contorno (espessura, estilo, posição, extremidade, quina, lados) e sombras (deslocamento X/Y, desfoque, espalhar).
- **Empilhamento** (`z-index`): botões trazer para frente / avançar / recuar / enviar para trás na seção Posição.
- **Dicas bonitas em tudo**: todo `title` do app vira a mesma dica rica (barra de destaque, atalho como tecla, posição inteligente: à esquerda no painel direito, à direita no esquerdo, em cima na barra de ferramentas).
- **Nota na camada** (`node.note`): seção **Nota** (recolhida enquanto vazia), menu de contexto **Adicionar/Editar nota**, selo na lista de camadas (com a nota na dica) e **comentário `<!-- ... -->` no HTML gerado** (opção "Incluir no código"). Não é herdada por instâncias.
- **Seção HTML**: etiqueta da camada (`div`, `section`, `header`, `nav`, `button`, `a`, `h1`–`h6`, `p`, `ul`, `li`...; lista fechada e validada), `href` para links e descrição (`aria-label`, com `role="img"` em camadas sem filhos). Sincroniza com componentes (`tag`, `href`, `alt`).
- **Paletas de cor próprias** (`palettes.js`): aba Recursos → Paletas (criar vazia/da seleção/do projeto/colando cores, renomear, duplicar, excluir, aplicar com clique ou Shift+clique no contorno, **copiar como variáveis CSS**, **adicionar ao projeto como estilos de cor**) e grupo "paleta própria" no **seletor de cor** com **+** para guardar a cor atual e "Nova paleta com esta cor". Salvas no navegador, valem em todos os projetos, sincronizam entre abas.
- Testes: `palettes.test.js`, `html-nota.test.js` e a suíte de navegador `notas-paletas-painel.mjs`.

### Alterado
- Os testes de navegador que buscavam `[title=...]` passam a usar `aria-label` (o `title` nativo foi trocado pela dica rica).

---

## [0.11.0] — 2026-10-08 — CSS ampliado, estados interativos, comentários e testes de navegador

### Adicionado (comentários nas camadas)
- **Comentários**: anote o que precisa mudar direto na camada. Três jeitos: selecione **uma** camada e escreva na aba **Comentários** (ícone de balão no painel direito; o pino nasce no canto superior direito), use a ferramenta **Comentar (`C`)** e clique no **ponto exato** da camada, ou botão direito → **Comentar**. `Ctrl+Enter` envia.
- **Pinos no canvas** (gota com o número) acompanham a camada quando ela se move ou muda de tamanho; clicar num pino abre a conversa. Resolvidos somem do canvas (continuam na lista, filtro "Resolvidos").
- **Conversa**: responder, **Resolver/Reabrir**, apagar; clicar no card seleciona a camada e rola até ela. A lista mostra os comentários da **página aberta**. Selo com o número de **abertos** na aba e **um balão com a contagem** em cada camada comentada na lista de camadas.
- Ficam **dentro do projeto** (`doc.comments`, mesmo arquivo `.json`): entram no desfazer (`Ctrl+Z` desfaz criar/resolver/apagar), nas versões antigas e na pasta; apagar a camada leva os comentários dela (desfazer traz de volta). Projetos antigos abrem normalmente (sem lista).
- **Autor**: o nome definido em Configurações → "Seu nome nos comentários" (padrão "Eu"). Sem login: o mesmo formato serve para quando houver trabalho em equipe.
- Módulo puro `comments.js` (testado) e a suíte de navegador `comentarios.mjs`.

### Adicionado (mais CSS útil)
- **Gradiente cônico** (`conic-gradient(from Ndeg, ...)`): novo tipo de preenchimento, com o ângulo de início e as paradas. Em vetores e no SVG exportado vale só a cor da 1ª parada (o SVG não tem gradiente cônico).
- **Peso do espaço** (`flex-grow`): item "Preencher" no eixo principal de um flex ganha o campo "Peso do espaço" (1 e 3 dividem em 1/4 e 3/4; os limites min/max continuam valendo por cima). Sincroniza do principal para os filhos; o peso da raiz da instância é da própria instância.
- **Trilhas personalizadas no grid**: "Trilhas personalizadas (CSS)" para colunas e linhas (`240px 1fr 2fr`, `auto 1fr auto`, `repeat(auto-fit, minmax(200px, 1fr))`). Vazio usa os números de colunas/linhas; escolher no seletor visual ou nos números limpa as trilhas. O texto é **sanitizado** (`cleanTrackList`: sem `; { } : aspas`) para não fechar a regra no CSS exportado.
- Blocos recolhíveis do painel (Limites e proporção, Filtros de cor, Trilhas personalizadas) **lembram se estavam abertos** (antes fechavam sozinhos ao apagar o último valor).

### Adicionado (variáveis de CSS)
- **Estilos de cor viram variáveis de CSS** no código gerado: camadas ligadas a um estilo escrevem `background-color: var(--cor-primaria)` (em texto, `color: var(...)`) e o CSS começa com **um** bloco `:root { --cor-primaria: #7c5cff; }` com as variáveis usadas. Vale no painel Código, em "Copiar CSS", no HTML exportado e no PNG. Nomes repetidos ganham sufixo (`-2`); vetores (cor dentro do `<svg>`) e camadas sem estilo continuam com o valor direto. Mudar o estilo no editor muda a variável, como num design system de verdade.

### Adicionado (rolagem em frames)
- **"Conteúdo que sai"** (substitui o "Cortar conteúdo"): *Cortar*, *Mostrar*, *Rolar na vertical*, *Rolar na horizontal* ou *Rolar nos dois sentidos* (`overflow: hidden | visible | auto`, por eixo). A rolagem **funciona de verdade na apresentação e no HTML exportado** (listas, telas longas, carrosséis); no editor o conteúdo continua cortado para não aparecerem barras de rolagem no canvas. Projetos antigos continuam iguais (`clip` define cortar ou mostrar). Sincroniza com componentes.

### Adicionado (estados interativos)
- **Estados** (seção "Estados" do painel Design): **Normal · Hover · Pressionado · Foco**. Escolha um estado e o painel passa a editar SÓ as sobrescritas dele — preenchimento/cor, contorno, cantos, sombras, filtros, opacidade, mesclagem e **escala** (`transform: scale()`). O canvas mostra a camada selecionada naquele estado e uma bolinha marca os estados em uso; "Limpar este estado" apaga. Só o que difere do normal é guardado (voltar ao valor normal remove a sobrescrita) e um estado pode **remover** algo da base (ex.: tirar o contorno no hover).
- **Código gerado**: uma regra por estado só com o que muda (`.botao:hover`, `.botao:active`, `.botao:focus-visible`; o que sumiu vira `unset`) e `tabindex="0"` na camada com foco. Vale para o painel Código, copiar CSS e HTML exportado.
- **Transição** (`transition: all 200ms ease`): duração e curva (suave, entra e sai, desacelera, acelera, constante) e **cursor** (`pointer`, `text`, `grab`, `not-allowed`...). Aparecem no código exportado e na apresentação; no editor nada anima nem muda o cursor das ferramentas.
- **Limitação**: em vetores, estados de preenchimento/contorno valem no editor e na apresentação, mas **não no HTML exportado** (a cor fica dentro do `<svg>`; uma regra `:hover` na `<div>` não a alcança).
- **Modo Apresentar** aplica hover, pressionado (por cima do hover, como a cascata do CSS) e foco, com a transição.
- `states`, `transition` e `cursor` sincronizam do componente principal para as instâncias. Trocar de seleção sai do modo estado. Grupo, seção e linha não têm estados.

### Alterado (caneta e acessibilidade)
- **Caneta:** clicar, sem arrastar, num ponto que faz parte de um grupo selecionado passa a selecionar **só ele** (arrastar continua levando o grupo todo).
- **Dicas ricas:** o texto do `title` nativo agora vira `aria-label` (antes só sumia), então leitores de tela e seletores continuam achando o controle; os `<select>` com título também ganham `aria-label`.

### Testes
- Instalado o **Playwright** (dev) e rodadas as **16 suítes de navegador: todas passam** (279 verificações). Cinco suítes foram atualizadas porque a interface mudou de propósito: modo do auto layout em cartões (`.al-mode`), matriz de alinhamento (`.al-cell`), contorno por lado em ícones, `aria-label` no lugar de `title` e o novo item "Novo ícone" no menu Arquivo.

### Alterado (polimento do painel)
- "Efeitos" e "Item do layout" no mesmo padrão do resto: legendas em português com o nome da propriedade CSS e **dicas ricas** (`filter: blur()`, `backdrop-filter`, `position`, `grid-column`, `grid-row`, `justify-self`, `align-self`).
- Removido código morto: o ajudante `prop()` e o CSS da matriz antiga, das linhas `prop-*` e do seletor de cor nativo.

### Adicionado (CSS ampliado)
- **Limites de tamanho**: `min-width`, `max-width`, `min-height`, `max-height` (seção Tamanho → "Limites e proporção"; campo vazio = sem limite). Em medida **fixa** o valor é limitado na hora (e ao redimensionar com as alças); em **Hug/Fill** quem obedece é o navegador e o canvas mede de volta. O `min-width` do usuário substitui o `min-width: 0` que o item "fill" de um flex escreve sozinho. Texto com largura "hug" e largura máxima passa a **quebrar linha** (`white-space: pre-wrap`) ao chegar no limite.
- **Proporção** (`aspect-ratio`): presets (1:1, 4:3, 16:9, 3:2, 2:1, 3:4, 9:16) ou "usar o tamanho atual". Com as duas medidas fixas o editor mantém a proporção ao redimensionar; quando uma medida é Hug/Fill o CSS `aspect-ratio` entra no código e a medida fixa vira `auto` no outro eixo. Os limites vencem a proporção, e depois do corte o outro eixo segue a proporção de novo, como no CSS.
- Não valem para grupos (a caixa deles é recalculada dos filhos); a proporção também não vale para texto e linha.
- Os campos novos (`minW`, `maxW`, `minH`, `maxH`, `aspect`) **sincronizam do componente principal para as instâncias** e podem ser sobrescritos numa instância.
- Campo numérico "anulável" (`nullable` em `ui/dom.js`): apagar o texto remove o valor.
- **Imagem de fundo com controle de verdade**: ajuste (cobrir, conter, esticar ou **tamanho próprio** em % da camada), **posição** (matriz 3×3 + X/Y em %) e **repetição** (ladrilho, só na horizontal ou só na vertical; vale em "conter" e "tamanho próprio"). Sai como `background-size`, `background-position` e `background-repeat`. Projetos antigos continuam iguais (cover, centro, sem repetir).
- **Margem do item** (`margin`): horizontal/vertical ou por lado, para itens em fluxo de um flex/grid (seção "Item do layout"). Camadas livres/absolutas ignoram (a posição já é left/top). A margem do item é do **lugar** dele: não vem do componente principal para a raiz da instância (como x/y), mas a do **filho** dentro de uma instância sincroniza e pode ser sobrescrita.
- **Filtros de cor** (seção Efeitos, recolhido): `brightness`, `contrast`, `saturate`, `grayscale`, `hue-rotate`; só os que fogem do padrão entram no CSS (`filter: blur() brightness() ...`). Sincronizam com componentes e entram em copiar/colar propriedades (colar de uma camada sem filtros **limpa** os do destino). Não saem no SVG exportado (como o `backdrop-filter`).
- **Texto — truncar**: "Quando não cabe": *Quebrar linha* (padrão), *Uma linha com …* (`white-space: nowrap` + `text-overflow: ellipsis`) ou *Limitar linhas* (`-webkit-line-clamp` + `line-clamp`, de 1 a N linhas). Precisam de largura fixa ou máxima (o painel avisa). O alinhamento vertical por grid é desligado enquanto se trunca, e durante a edição o texto aparece inteiro. Dica no painel e no SVG: o SVG exportado mostra o texto completo (não trunca).
- **Texto — espaço entre palavras** (`word-spacing`), também em estilos de texto compartilhados e no SVG. `truncate`, `lines` e `wordSpacing` sincronizam do componente para as instâncias e entram em copiar/colar estilo.
- No **SVG exportado**: tamanho próprio e posição ficam **exatos** (o editor guarda o tamanho original da imagem ao escolhê-la) e a repetição vira `<pattern>`; em cobrir/conter a posição é aproximada em 3 alinhamentos (o SVG não tem posição em %). Repetir junto com "conter" não é exportado.

### Adicionado
- **Seletor de cor próprio** (no lugar do seletor feio do navegador): área de saturação/brilho, barra de matiz, campo HEX, conta-gotas e **grupos de cores**: "Neste projeto" (as mais usadas), "Estilos de cor" e paletas prontas (Neutros, Vivas, Suaves). Aplica ao vivo, grava o histórico ao soltar, fecha com Esc ou clicando fora e rola se a tela for baixa. Vale para preenchimento, contorno, gradiente, sombras e grades.
- **Contorno por lado em ÍCONES**: Todos · Cima · Direita · Baixo · Esquerda · Espessura por lado. Cada lado liga/desliga sozinho e dá para combinar (ex.: cima e baixo); de "Todos", o clique escolhe só aquele lado; com os quatro ligados volta a "Todos". Substitui a lista de opções, e cada ícone tem dica com o CSS (`border-top`...).

## [0.10.0] — 2026-10-07 — Seção, auto layout com cara de produto e caneta para ícones SVG

### Adicionado
- **Seção** (`Shift+S`, como no Figma): contêiner de organização do canvas. Só existe na raiz, guarda frames, tem o nome em destaque acima dela e leva as telas junto ao ser movida. Desenhar uma seção em volta de telas da raiz **adota** as que ficaram totalmente dentro. Clicar no nome ou no corpo seleciona e arrasta a seção. Telas podem entrar e sair arrastando. Painel Design mostra só Posição, Tamanho, Preenchimento e Exportar. Exportada como `<section>`; `Ctrl+Shift+G` desfaz a seção.
### Adicionado (caneta para criar ícones SVG)
- **Arquivo → Novo ícone (24×24)**: cria um frame de ícone no centro da vista, com a **grade de pixels de 1px**, enquadra com zoom grande, liga o **encaixe de 1px** e deixa a caneta pronta. Exporte pelo painel (SVG) como qualquer frame.
- **Barra da caneta** (aparece sozinha com a caneta ou na edição de pontos): **Encaixe** Livre/1/2/4/8 px — pontos grudam na grade contada do canto do frame — e os atalhos à vista.
- **Continuar um caminho**: com um vetor aberto selecionado, a caneta (P) clicando na **ponta** dele continua desenhando o mesmo vetor (clicar no início também vale). Clicar no outro extremo fecha.
- **Vários pontos**: arraste uma caixa no vazio, **Shift+clique** soma/tira, **Ctrl+A** seleciona todos. Mover, setas, canto/suave e Excluir valem para o grupo.
- **Alt+clique num ponto** converte canto ↔ suave (como o "converter ponto" do Illustrator). **Abrir aqui** corta um caminho fechado depois do ponto selecionado.
- **Extremidade e quina do traço** (reta/redonda/quadrada, pontuda/redonda/chanfrada) para vetores, no painel Contorno e no SVG exportado — o SVG antes ignorava a extremidade (saía "reta" mesmo com o editor mostrando redonda).

### Adicionado (caneta e SVG)
- **Alt+clique no traço agora segue a CURVA**: o ponto novo é inserido no lugar certo do trecho curvo e nasce com as alças corretas (divisão de Bézier, De Casteljau), então o desenho **não muda** ao adicionar pontos. Antes ele media na corda reta e entortava a curva.
- Com **Alt** pressionado, um pontinho rosa mostra no traço **onde** o clique vai adicionar o ponto.
- **Shift** trava em múltiplos de 45°: ao desenhar um segmento novo, ao arrastar um ponto e ao arrastar uma alça.
- **Setas movem o ponto selecionado** (Shift = 10 px) durante a edição de pontos.
- **Painel Vetor renovado**: botão Concluir edição; "Ponto N de M" com tipo **Canto / Suave**, **X / Y** numéricos (relativos ao pai, como a camada) e Excluir ponto; **Inverter** direção do caminho.
- **Código SVG (path `d`)** do vetor num bloco recolhível: **Copiar** e **Aplicar**. Cole o `d` de outro SVG (aceita M L H V C S Q T A Z, absolutos e relativos) para trocar a forma sem perder cor, contorno e nome. Texto sem caminho válido é recusado.

### Corrigido
- **Menu de contexto (botão direito) cortado em telas baixas**: os menus agora têm altura máxima (~70% da janela, sempre dentro dela) e rolam por dentro, então a última opção sempre dá para alcançar. Vale para todos os menus flutuantes (camadas, canvas, Arquivo, zoom).

### Alterado (polimento)
- A caixa **"CSS ao vivo"** agora começa **fechada** e abre/fecha com a setinha (a escolha fica lembrada). Segue não editável: é só uma curiosidade.
- **Painéis laterais mais delicados**: abas em pílula (sem sublinhado), seções com mais respiro e divisórias leves, campos e botões com cantos mais redondos, foco com halo suave, rolagem fina.
- **Lembrete "este projeto ainda não tem arquivo"** menor e mais suave, com ícone num selo; indicador de "Salvo" no topo virou uma pílula discreta com dica rica.

### Adicionado (Auto layout com cara de produto)
- **Auto layout redesenhado**: o modo virou 4 cartões (Livre · Linha · Coluna · Grade) com o CSS de cada um embaixo, um selo "CSS puro" e a caixa **"CSS ao vivo"**, que mostra as declarações reais que o frame gera agora (`display`, `gap`, `padding`, `justify-*`, `align-items`...) e muda junto com os controles.
- **Dicas ricas** (`tip` em `ui/dom.js`): ao passar o mouse, aparece um cartão com título, o CSS correspondente (colorido, em fonte mono) e uma frase em português explicando o que aquilo faz. Vale para os cartões de modo, a caixa de CSS ao vivo (cada propriedade), a matriz de alinhamento, gap, padding, wrap, colunas/linhas e alinhamentos. Substitui a dica nativa do navegador nesses controles.
- Cada legenda mostra o nome da propriedade CSS ao lado ("Espaço entre itens · gap").

### Adicionado (CSS Grid)
- **Seletor visual de grade** 6×6 no Auto layout em modo grid: passe o mouse para ver "colunas × linhas" e clique para aplicar as duas contagens de uma vez.
- **Células do grid no canvas**: com um frame em grid selecionado (ou um item dele), as células reais aparecem tracejadas, lidas do estilo calculado do navegador (valem para linhas automáticas e `gap`).
- **Espaço entre células unido**: um campo só para `gap`, com botão para separar em coluna/linha (separa sozinho se os valores forem diferentes).

### Alterado
- **Painel Design com o visual do Figma**: títulos de seção maiores, legendas pequenas em cima dos campos ("Alinhamento", "Posição", "Dimensões", "Opacidade", "Raio dos cantos", "Peso", "Espessura"... também em Texto, Preenchimento e Contorno), campos mais altos com cantos suaves e os botões de alinhar/distribuir em três "pílulas". O alinhamento deixou de ser uma barra fixa no topo e passou a fazer parte da seção Posição.
- Tela dentro de uma seção não é mais recolorida pela cor automática (branco sobre cinza claro é o esperado).

### Adicionado (continuação)
- Telas dentro de seções valem como "telas" no modo Apresentar e no painel Protótipo (`isBoard` em `model.js`).

---

## [0.9.1] — 2026-10-07 — Documentação do código

### Documentação
- **[Guia do código](docs/GUIA-DO-CODIGO.md)** para quem vai ler ou mexer no código: glossário, ordem de leitura, o caminho de um clique (desenhar um retângulo) pelos arquivos, tabela "quero mudar X → arquivo/função", regras do projeto e como manter a documentação.
- **[Referência](docs/REFERENCIA.md)** com as 496 funções e constantes, arquivo por arquivo, com parâmetros e link para a linha. É **gerada dos comentários** do próprio código por `scripts/gerar-referencia.mjs` (`npm run docs`), então não envelhece; `npm test` avisa se ela ficou desatualizada.
- Comentários nas 5 funções exportadas que ainda não tinham descrição (`createSaving`, `createHome`, `createIconsPanel`, `openModal`, `parseColor`).

---

## [0.9.0] — 2026-10-07 — CSS de verdade no painel: grid, contorno por lado, snap ao redimensionar

4º relato do teste real: "contorno só de um lado", "CSS Grid não exerce força", "opções de layout esquisitas", "não vejo a barreira do frame ao redimensionar", "painel meio feio".

### Corrigido
- **CSS Grid não alinhava os itens**: todo item de grid recebia `justify-self: start` / `align-self: start` fixos, e no CSS isso anula o `justify-items` / `align-items` do grid pai. Agora o item só escreve `*-self` quando você escolhe (ou quando o tamanho é "Fill" = `stretch`), então o alinhamento do grid vale de verdade.
- **Trocar de flex para grid** com `space-between` (que não existe no grid) caía num valor inválido; agora vira `start`. E `stretch` (que não existe em `justify-content`) vira `flex-start` ao voltar para flex.

### Adicionado
- **Snap ao redimensionar**: a borda que você puxa gruda (até 6 px de tela) nas bordas do frame pai, dos vizinhos e das guias da régua, com a linha rosa. `Ctrl` ou `Alt` desligam. Só bordas: centros não puxam, para não atrapalhar um tamanho livre.
- **Contorno por lado** em retângulos e frames: todos, só em cima, só embaixo, só esquerda, só direita, cima+baixo, esquerda+direita ou personalizado (espessura por lado). Vira `border-top/right/bottom/left` no CSS e linhas no SVG exportado.
- **Grid**: opção `stretch` em `justify-items`/`align-items`, `justify-self` por item e o botão "Itens preenchem as células".
- **Flex**: `stretch` e `baseline` em `align-items`, `stretch` em `align-self`.
- 19 verificações novas em `tests/e2e/css-polimento.mjs`.

### Alterado
- **Seção de layout com os nomes do CSS**: cada controle mostra a propriedade que gera (`display`, `gap`, `flex-wrap`, `justify-content`, `align-items`, `grid-template-columns`, `grid-template-rows`, `column-gap`/`row-gap`, `justify-items`…). Os seletores mostram o valor CSS de verdade (`flex-start`, `space-between`…). No item: `position: absolute`, `grid-column`/`grid-row` span, `justify-self`, `align-self`. Escolher `stretch` no item liga o tamanho "Fill" daquele eixo (são a mesma coisa no CSS).
- **Painel direito reorganizado** na ordem do Figma: a antiga seção "Camada" virou **Posição** (X/Y, constraints, rotação, espelhar), **Tamanho** (W/H, modo W/H fixo/hug/fill com rótulo, tamanhos prontos) e **Aparência** (opacidade, mistura, cantos, cortar conteúdo, máscara). "Criar componente" foi para o fim (componente principal/instância continua no topo). Desfoques com o nome da propriedade (`filter: blur`, `backdrop-filter`).

---

## [0.8.4] — 2026-10-07 — Arrastar para dentro de auto layout

3º relato do teste real (print): "o retângulo e a bordinha de redimensionar estão ligados, porém separados".

### Corrigido
- **Desenho e alças da seleção separados** depois de arrastar uma camada de fora para dentro de um frame com auto layout. Durante o arrasto em auto layout, o app desloca o desenho com CSS `translate` (o "fantasma" que segue o mouse) e nunca o limpava ao soltar; quando a camada não era redesenhada do zero, o deslocamento ficava para sempre. Agora é limpo ao soltar e quando a camada sai do auto layout no meio do arrasto.
- **Frame alto e vazio + `Shift+A` virava linha**: agora vira coluna (uma sidebar vazia), como já acontecia com um filho só.
- **Cinza sobre cinza ao arrastar**: a cor que o app escolheu sozinho (e que você nunca mexeu) se ajusta quando a camada vai para um fundo da mesma cor. Cor escolhida por você nunca é alterada.

### Adicionado
- 5 verificações em `tests/e2e/auto-layout-intencao.mjs` com o caso relatado.

---

## [0.8.3] — 2026-10-07 — Desenhar dentro de auto layout

2º relato do teste real: "a caixa de seleção fica num lugar e o retângulo em outro" ao desenhar dentro da sidebar.

### Corrigido
- **Forma desenhada dentro de um frame com auto layout ia para o FIM da fila** já durante o desenho, longe do mouse (a caixa de seleção e o retângulo apareciam em lugares diferentes). Agora ela fica sob o mouse enquanto você arrasta e, ao soltar, entra na fila **na posição onde foi desenhada**. Vale para retângulo, elipse, frame e linha; texto entra onde você clicou.
- **Nomes repetidos** ("Retângulo 4" duas vezes): o nome novo agora usa o maior número existente + 1.

### Adicionado
- 5 verificações em `tests/e2e/auto-layout-intencao.mjs` (desenhar entre itens, texto entre itens, nome único) e 1 teste unitário de nomes.

---

## [0.8.2] — 2026-10-07 — Auto layout que entende a intenção

Relatado no primeiro teste real: "desenhei um retângulo grande (sidebar) e um pequeno em cima; ao ligar o auto layout, o pequeno ia mudando de lugar".

### Corrigido
- **`Shift+A` com um retângulo de fundo e itens em cima** punha o fundo e os itens lado a lado (o item "pulava" e transbordava). Agora o retângulo de baixo **vira o frame** (cor, cantos, contorno, sombra) e os itens entram nele, no mesmo lugar.
- **`Shift+A` num grupo** embrulhava o grupo inteiro como um item só; agora o grupo vira o frame.
- **`Shift+A` num retângulo sozinho** o embrulhava num frame inútil; agora o retângulo vira um frame com auto layout (mesmo id; `Ctrl+Z` desfaz).
- A dedução do auto layout transformava o espaço livre em padding gigante (ex.: 520 px embaixo de um item no topo de uma sidebar), espremendo os itens seguintes; agora detecta conteúdo centralizado/no fim e mantém o espaço livre como espaço livre. Sidebar alta com um item vira coluna.
- Frame criado em volta de camadas soltas agora abraça o conteúdo (hug): nada transborda.
- **Formas nasciam invisíveis** (cinza sobre cinza, frame branco dentro de frame branco, texto preto sobre fundo escuro); agora nascem num tom que contrasta com o que está embaixo do cursor.

### Adicionado
- `tests/e2e/auto-layout-intencao.mjs` (16 verificações) reproduz o caso relatado.

---

## [0.8.1] — 2026-10-07 — SVG do Figma e do Illustrator

### Adicionado
- **Sombras do Figma** (o filtro que ele exporta, inclusive várias sombras com spread) e `<feDropShadow>` viram sombras de verdade ao importar SVG.
- **Nomes de fonte do Illustrator** ("Poppins-Bold", "OpenSans-SemiBoldItalic", "ArialMT") viram família + peso + itálico.
- O aviso da importação diz **o que** ficou de fora ("sombra interna", "máscara", "imagem"...) em vez de só quantos.
- `tests/fixtures/figma-export.svg` e `illustrator-export.svg` (estrutura igual à desses programas) com 8 verificações no navegador; 1 teste unitário de nomes de fonte.

### Corrigido
- `Esc` não fechava a página inicial com o foco na busca (achado e corrigido pelo Codex no teste em Windows).

---

## [0.8.0] — 2026-10-07 — SVG editável, ícones do Google e Google Fonts

### Adicionado
- **Importar SVG como vetores editáveis**: arrastar/abrir um `.svg` ou colar SVG como texto (Figma "Copiar como SVG", sites de ícones). Suporta `path` (M L H V C S Q T A Z, absolutos e relativos; arcos e quadráticas viram cúbicas), `rect` (cantos arredondados), `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text` simples, grupos, `transform`, `viewBox`, `<use>`, estilos herdados, `<style>` por classe/tag/id, cores com nome e gradientes. O que não é suportado é ignorado e contado num aviso.
- **Vetores com vários contornos e furos** (`contours` + `fillRule: 'evenodd'`), desenhados no canvas, na máscara e no SVG exportado.
- **Aba Ícones** com os **4.299 Material Symbols** do Google: busca (inglês e palavras comuns em português), estilo contorno/arredondado/reto, preenchido, cor e tamanho; insere como vetor (dentro do frame selecionado).
- **Google Fonts**: seletor com **1.908 fontes** + as do sistema, busca, categorias, prévia de cada fonte, teclado (↑/↓/Enter/Esc). Fontes baixadas sob demanda (ao abrir o projeto e ao usar); pesos limitados aos que a fonte tem; HTML exportado leva o `<link>`.
- `scripts/gerar-listas-google.mjs` (atualiza as listas em `src/data/`); testes `svgimport.test.js` (13), `fonts.test.js` (5) e `tests/e2e/svg-icones-fontes.mjs` (26 verificações); capturas 16 e 17.

### Corrigido
- Com 3 abas, o painel esquerdo ficava mais largo que o espaço e rolava para o lado ao focar um campo. Agora as abas são compactas e, em painéis estreitos, mostram só o texto.

---

## [0.7.0] — 2026-10-07 — Página inicial e polimentos

### Adicionado
- **Página inicial** com os seus projetos: "continuar de onde parou" (miniatura ao vivo e onde está salvo), projetos da pasta com **miniaturas**, busca (`/`), ordenação, menu ⋯ (abrir, renomear, duplicar, versões) e cards dos exemplos. Abre ao iniciar (configurável) e pelo logo do editor ou Arquivo → Página inicial.
- **Miniaturas**: geradas a partir do exportador SVG depois de salvar na pasta (no máximo 1 a cada 15 s) e servidas com política que bloqueia scripts.
- **Renomear e duplicar** projetos da pasta (versões e miniatura vão junto ao renomear).
- **Recentes** no menu Arquivo (os 5 últimos projetos da pasta).
- **Lembrete** "este projeto ainda não tem arquivo", uma vez por projeto, com botão Salvar na pasta.
- Configurações → **Ao abrir o app**: página inicial ou direto no editor.
- `tests/e2e/pagina-inicial.mjs` (33 verificações) e testes da API para miniatura e renomear.

### Alterado
- **Janelas do app no lugar de `confirm()`, `prompt()` e `alert()`** do navegador (trocar de projeto, conflito, substituir arquivo, excluir/renomear página, estilos de cor/texto). A pergunta de conflito ganhou 3 opções: substituir, salvar com outro nome ou cancelar.
- Trocar de projeto só pergunta quando algo se perderia; exemplos e projetos em branco não editados trocam direto.
- O logo do topo virou botão para a página inicial.
- Botões desabilitados ficam visivelmente apagados.

### Corrigido
- **Abrir um projeto pela janela Projetos (ou abrir uma versão antiga) substituía sem perguntar** um projeto que só existia no navegador, que se perdia.
- Com uma janela aberta (Configurações, Projetos...), `Delete`, `Ctrl+V` e outros atalhos do canvas ainda agiam nas camadas escondidas atrás dela.
- Em palcos estreitos (~1100 px de janela), o controle de zoom cobria o fim da barra de ferramentas.

---

## [0.6.0] — 2026-10-07 — Salvamento na pasta do computador

### Adicionado
- **Salvar numa pasta do computador.** O `server.js` ganhou uma API (`/api`) que grava os projetos como arquivos `.json` numa pasta escolhida por você. Com o projeto ligado a um arquivo, **cada mudança é gravada lá sozinha**.
  - `Ctrl+S` na 1ª vez pede o nome; `Ctrl+Shift+S` salva com outro nome; `Ctrl+O` abre da pasta.
  - **Versões antigas** de cada projeto (no máximo uma a cada 10 min, até 20 por padrão), que podem ser abertas na janela Projetos.
  - **Proteção contra conflito**: se o arquivo mudar fora do editor (outra aba, outro computador pelo Drive), o app para de gravar nele e pergunta antes de substituir.
  - Gravação atômica (arquivo temporário + renomear).
- **Janela Configurações** (engrenagem no topo, `Ctrl+,`): pasta de projetos (com instruções para Google Drive/OneDrive/Dropbox), auto-salvar na pasta, nº de versões, espaço usado no navegador, proteção contra limpeza automática, tema e roda do mouse.
- **Janela Projetos na pasta**: salvar como, lista com data e tamanho, abrir e versões.
- Indicador do topo mostra **onde** está salvo: *Salvo na pasta*, *Salvo no navegador*, *Só no navegador* (servidor desligado) ou *Conflito no arquivo*. Clicar nele abre as Configurações.
- **Acessibilidade**: menus por teclado (`↑`/`↓`/`Home`/`End`, `Esc` devolve o foco), janelas modais com foco preso e `role="dialog"`, `aria-label` em botões só com ícone, `aria-pressed` nas ferramentas, `aria-selected` nas abas, contorno de foco visível.
- Testes: `tests/api.test.js` (API numa pasta temporária: gravar/ler, conflito, versões, segurança) e `tests/e2e/salvar-pasta.mjs` (40 verificações no navegador).
- Capturas `13-configuracoes-salvamento` e `14-projetos-na-pasta`.

### Alterado
- **Cópia no navegador agora usa IndexedDB** em vez de `localStorage`: acaba o limite de ~5 MB (testado com projeto de 8 MB). Projetos antigos são **migrados sozinhos** na primeira abertura.
- Arquivo: "Abrir arquivo" virou **Importar arquivo .json** e "Salvar projeto" virou **Baixar cópia (.json)**; `Ctrl+S`/`Ctrl+O` passaram a usar a pasta (sem servidor, `Ctrl+S` continua baixando o `.json`).
- Trocar de projeto (novo, exemplo, importar) avisa quando o projeto atual só existe no navegador.
- A preferência "roda do mouse dá zoom" agora é lembrada.

### Corrigido
- Versões guardadas no mesmo segundo se sobrescreviam (achado pelo teste da API).
- Ao recarregar a página, o editor podia acusar "conflito" com o próprio arquivo (a gravação feita ao fechar a aba chegava à pasta, mas não à cópia do navegador).

### Segurança
- A API só aceita pedidos de `localhost` (cabeçalho `Host`, contra *DNS rebinding*), exige `Content-Type: application/json` e `Origin` local para gravar (um site aberto em outra aba não consegue mandar o servidor gravar), e só aceita nomes de arquivo `[a-z0-9._-].json`.

---

## [0.5.1] — 2026-10-07 — Correções do Windows e dos testes

### Corrigido
- **Tela em branco no Windows**: o servidor comparava caminhos com `/`, mas no Windows o separador é `\`; `/src/main.js` e o CSS davam 404. Achado numa revisão feita em Windows + Chrome.
- Suítes de navegador agora **saem com código ≠ 0 quando falham** (antes só imprimiam `FAIL`, e o CI poderia ficar verde).
- Arquivos temporários dos testes usam `os.tmpdir()` (funcionam no Windows).
- Servidor distingue arquivo inexistente (404) de erro interno (500, com log).

### Alterado
- Medição de desempenho separa o tempo do *handler* do app (p95 ≈ 7 ms com 400 camadas) da latência da automação.

### Adicionado
- `tests/server.test.js` (assets 200; `package.json`, `.git`, traversal 404), `npm run test:e2e` e `npm run test:all`.

---

## [0.5.0] — 2026-10-07

Documentação completa, capturas de tela e correções achadas ao fotografar o produto.

### Adicionado
- **Novo projeto de exemplo "app mobile"** (Arquivo → *Exemplo: app mobile*): tela de carteira digital que mostra **CSS Grid**, **componente com 4 instâncias** (texto/ícone sobrescritos), **estilos de cor e texto** ligados a camadas e **protótipo navegável** (Enviar → Sucesso → Voltar). O exemplo antigo virou *Exemplo: landing page*.
- **12 capturas de tela** do produto em `docs/screenshots/` e o script que as gera (`scripts/gerar-capturas.mjs`).
- `CONTRIBUTING.md` com a **convenção de commits** (Conventional Commits em português), estilo de código e checklist de PR.
- `docs/ARQUITETURA.md`: modelo de dados campo a campo, ciclo de uma mudança, algoritmos (gestos, instâncias, exportação) e guia para estender o editor.
- Teste unitário do novo exemplo (instâncias, estilos e destinos de interação).

### Corrigido
- **Seta do protótipo** fazia um laço atravessando o desenho quando o destino ficava à esquerda; agora sai e entra pelos lados certos (direita↔esquerda ou vertical).
- **Campo hex da cor da sombra** aparecia vazio (colapsava a 0 px) na seção Efeitos.
- **Painel Código** cortava linhas longas de CSS na lateral; agora quebram.
- **Etiqueta de tamanho** sobrepunha o número da medida ao segurar `Alt`.
- **Lista de atalhos** do app estava incompleta (faltavam `Ctrl+A`, `Ctrl+Alt+G`, `Ctrl+Alt+Enter`, zoom por teclado, `Ctrl+S/O`, `?`).

### Documentação
- **Todo o código-fonte comentado em português** (cabeçalho de cada arquivo, JSDoc nas funções e o *porquê* das decisões). Nenhuma linha de lógica foi alterada: o diff dos commits `docs(...)` contém só comentários.
- `README.md` reescrito: galeria com imagens, passo a passo para iniciantes, referência de funcionalidades, tabela de atalhos, desempenho medido e limitações.

---

## [0.4.0] — 2026-10-06 — Usabilidade e desempenho

### Desempenho
- Arrastar com **400 camadas**: de ~150 ms para ~20 ms por movimento (1000 camadas: de 350 ms para ~33 ms). Causas corrigidas: o painel de camadas se reconstruía a cada movimento e o índice interno era refeito mesmo quando só um valor mudava.

### Adicionado
- **Camadas**: começam recolhidas (abrem o caminho da seleção sozinhas), `Shift`+clique seleciona intervalo, `Alt`+clique na setinha abre/fecha tudo, busca por nome, menu da página (renomear, **duplicar**, excluir).
- **Seleção**: `Ctrl`+clique atravessa grupos, `Tab`/`Shift+Tab` percorrem camadas, **X/Y/W/H do conjunto** para várias camadas.
- **Medidas**: segurar `Alt` sobre outra camada mostra as distâncias.
- **Propriedades**: `Ctrl+Alt+C/V` copia/cola só a aparência; `Ctrl+V` com um frame selecionado cola **dentro** dele; `Ctrl+B/I/U` na edição de texto.
- **Auto layout**: matriz 3×3 de alinhamento, padding horizontal/vertical (ou por lado).
- **Texto**: MAIÚSCULAS/minúsculas e alinhamento vertical na caixa.
- Atalhos de cores já usadas no projeto, **grade de pixels** (≥ 800% de zoom), painéis **redimensionáveis** e **modo foco** (`Ctrl+\`), indicador *Salvo*, aviso amigável em erros inesperados, **exportar todos os frames**, desagrupar frames.

### Corrigido
- Padding aparecia como `[object HTMLDivElement]` no painel.

---

## [0.3.0] — 2026-10-06 — Protótipo e SVG

### Adicionado
- **Protótipo**: aba com interações (ao clicar / ao passar o mouse → navegar, voltar, abrir link), **transições** (dissolver e deslizar), ponto de partida do fluxo, **setas de fluxo** no canvas e modo **Apresentar** em tela cheia (`Ctrl+Alt+Enter`).
- **Exportação SVG vetorial** (formas, textos, gradientes, sombras, máscaras, vetores).
- `Ctrl+Alt+G` envolve a seleção em um frame.
- Testes de navegador (`tests/e2e/`) e unitários do SVG.

---

## [0.2.0] — 2026-10-06 — Layout, vetores e biblioteca

### Adicionado
- **CSS Grid** como modo de auto layout (colunas, linhas, gaps, `span` por item).
- **Constraints** dos filhos ao redimensionar frames; travar proporção; espelhar.
- **Vetores**: ferramentas **Linha**, **Polígono**, **Estrela** e **Caneta** (curvas de Bézier, edição de pontos e alças).
- **Componentes** com instâncias e sobrescritas; **estilos** compartilhados de cor e de texto (aba **Recursos**).
- **Máscara** (`clip-path`), **grades de layout**, presets de tamanho de frame (iPhone, Android, iPad, Desktop, A4, Story...).
- **Réguas** e **guias** arrastáveis, com *snap*.

### Corrigido
- Duplo clique não funcionava (alvo do evento com *pointer capture*): afetava editar texto e renomear frames.
- Objeto "pulava" ao ser arrastado de um frame para outro (as alças da seleção atrapalhavam a detecção do frame de destino).

---

## [0.1.0] — 2026-10-06 — Primeira versão

### Adicionado
- Editor local em JavaScript puro, com canvas em **HTML/CSS real**.
- Ferramentas Mover, Frame, Retângulo, Elipse, Texto, Imagem e Mão.
- **Auto layout em flexbox** (direção, gap, padding, justify, align, wrap) e tamanhos fixo/hug/fill.
- Camadas (arrastar para reordenar/aninhar), páginas, grupos, alinhar/distribuir, desfazer/refazer.
- Preenchimentos (sólido, gradientes, imagem), contorno, sombras, blur, `backdrop-filter`, `mix-blend-mode`.
- Aba **Código** (CSS/HTML real), exportação PNG/HTML e arquivo de projeto `.json`.
- Salvamento automático no navegador, tema claro/escuro, projeto de exemplo.
