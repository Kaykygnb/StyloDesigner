# Projeto Designer

Um editor de design **local**, feito em **JavaScript puro** (sem TypeScript, sem framework, sem build), com funcionalidades parecidas com as do Figma e do Penpot. A ideia central: **o canvas é CSS de verdade**. Cada camada é um elemento HTML estilizado pelo navegador, então o que você desenha segue as regras do CSS e o código gerado é exatamente o que você está vendo.

> Não é uma cópia do Figma nem um substituto dele. É uma ferramenta pequena, rápida e sua, que roda no seu computador.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo. Não tem nada para instalar.

```bash
npm start
```

Abra **http://localhost:5173**. (Os módulos ES do navegador não funcionam abrindo o `index.html` direto do disco; por isso o mini servidor.)

Outros comandos:

```bash
npm test     # testes da parte pura (modelo e gerador de CSS)
PORT=8080 npm start
```

## O que já faz

**Desenho e edição**
- Ferramentas: Mover (V), Frame (F), Retângulo (R), Elipse (E), Linha (L), Polígono, Estrela, **Caneta (P)**, Texto (T), Imagem, Mão (H)
- Selecionar, selecionar vários (Shift / marquee), mover, redimensionar (Shift = proporção, Alt = do centro), rotacionar, espelhar (Shift+H / Shift+V), travar proporção
- Snap com guias ao mover; arrastar para dentro/fora de frames troca o pai automaticamente
- Frames aninhados, grupos (Ctrl+G), envolver em frame (Ctrl+Alt+G), máscara (Ctrl+Alt+M), duplicar (Ctrl+D ou Alt+arrastar), copiar/colar, ordem de camadas
- Edição de texto direto no canvas; imagens por botão, arrastar ou colar
- Alinhar e distribuir, desfazer/refazer, várias páginas, busca de camadas
- **Réguas** (Shift+R) e **guias**: arraste das réguas para criar, arraste de volta para apagar; o snap enxerga as guias
- Pan e zoom (Ctrl+roda, Espaço+arrastar, Shift+1 ajusta tudo)

**Vetores**
- Caneta com curvas de Bézier (clique e arraste cria alças; clicar no primeiro ponto fecha)
- Edição de pontos (duplo clique no vetor): arraste pontos e alças, Alt+clique no traço adiciona ponto, duplo clique no ponto alterna canto/suave, Delete remove
- Polígono e estrela viram vetores editáveis

**CSS de verdade**
- **Auto layout = flexbox** (`flex-direction`, `gap`, `padding`, `justify-content`, `align-items`, `flex-wrap`) **ou CSS Grid** (colunas, linhas, `gap`, `grid-column: span N`)
- Tamanho do item: fixo, ajustar ao conteúdo (hug), preencher (fill = `flex: 1`), `align-self`, posição absoluta
- **Constraints** (esquerda, direita, esquerda+direita, centro, escala) que reagem ao redimensionar o frame
- Preenchimento sólido, gradiente linear/radial com várias cores, imagem; contorno (sólido/tracejado/pontilhado, dentro/centro/fora); `border-radius` por canto
- Sombras múltiplas, `filter: blur`, `backdrop-filter` (vidro), `mix-blend-mode`, `opacity`; texto com fonte, peso, `line-height`, `letter-spacing`, gradiente
- **Grades de layout** (colunas, linhas, quadrícula) por frame e predefinições de tamanho (iPhone, Android, iPad, Desktop, A4, Story…)

**Biblioteca**
- **Componentes**: Ctrl+Alt+K cria; instâncias seguem o principal, mas mantêm o que você sobrescreveu (texto, cor, tamanho…); desanexar (Ctrl+Alt+B)
- **Estilos de cor e de texto**: mudou o estilo, mudam todas as camadas ligadas (aba Recursos)

**Protótipo**
- Aba Protótipo: ao clicar / ao passar o mouse → navegar para um frame, voltar ou abrir link, com transições (dissolver, deslizar)
- Setas de fluxo no canvas e modo **Apresentar** em tela cheia (Ctrl+Alt+Enter)

**Código e exportação**
- Aba **Código**: CSS e HTML reais da seleção, com copiar (ou Ctrl+Shift+C)
- Exporta **PNG** (1x a 4x), **SVG** vetorial, **HTML** standalone e o projeto em **.json** (Ctrl+S)
- Salva sozinho no navegador (localStorage)

Aperte **?** dentro do app para ver todos os atalhos.

## Limitações (seja realista)

Cobre muita coisa de Figma/Penpot, mas **não é** um clone completo. **Não tem:** operações booleanas (união/subtração/interseção de formas), múltiplos preenchimentos/contornos por camada, variáveis e temas, variantes de componente, comentários, colaboração em tempo real, plugins, edição de imagem (recorte/filtros), ferramenta lápis livre, texto com listas/estilos mistos na mesma caixa.

Detalhes que valem saber:
- O auto-save usa o `localStorage` do navegador. Se você limpar os dados do site ou trocar de navegador/porta, perde. **Use Arquivo → Salvar projeto** para guardar um backup. Muitas imagens grandes podem estourar o limite (~5 MB) e o app avisa.
- O PNG usa as fontes instaladas no seu computador e pode não mostrar `backdrop-filter`. O SVG aproxima sombras internas e `backdrop-filter` (não exporta). O HTML/CSS copiado mantém tudo.
- Instâncias de componente não aceitam adicionar/remover camadas internas (isso é revertido na próxima sincronização); mudar propriedades, texto e posições é suportado.
- Frames raiz não "entram" em outros frames ao serem arrastados (de propósito, para não aninhar sem querer).
- Grupos redimensionam escalando os filhos; frames respeitam as constraints dos filhos.

## Estrutura

```
index.html            página única
server.js             servidor estático (sem dependências)
src/
  model.js            nós, defaults, árvore, grupos (puro)
  css.js              nó -> CSS/HTML (puro, usado pelo canvas, painel de código e exportação)
  store.js            estado, seleção, histórico, persistência
  canvas.js           renderiza o DOM, pan/zoom, geometria
  overlay.js          seleção, alças, guias, marquee
  tools.js            mouse/teclado: mover, redimensionar, desenhar...
  commands.js         agrupar, duplicar, auto layout, componentes, alinhar, reparent...
  components.js       componentes/instâncias e estilos (puro)
  pen.js              ferramenta caneta e edição de pontos
  rulers.js           réguas e guias
  present.js          modo apresentar (protótipo)
  svg.js              exportação SVG (puro)
  export.js           PNG, SVG, HTML, .json
  sample.js           projeto de exemplo
  ui/                 painéis: camadas, recursos, propriedades, protótipo, código, menus
  styles/app.css
tests/                testes (node --test); tests/e2e = testes de navegador (opcionais)
```

## Inspiração

A organização (páginas, frames/boards, camadas, auto layout em flexbox, painel de código) é inspirada no [Penpot](https://penpot.app), que também baseia o design em padrões web. Este projeto foi escrito do zero em JavaScript; **não copia código do Penpot** (que é escrito em Clojure/ClojureScript e licenciado sob MPL-2.0).
