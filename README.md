# Projeto Designer

**Um editor de design que roda no seu computador, feito só com JavaScript — e onde o canvas é CSS de verdade.**

Funciona como Figma e Penpot (frames, camadas, auto layout, componentes, protótipo), mas com uma diferença que dá nome ao projeto: cada camada que você desenha é um elemento HTML estilizado pelo próprio navegador. Por isso o que você vê no editor é **exatamente** o que o CSS faz, o painel de código mostra o CSS real, e "auto layout" não é uma imitação: é `display: flex` e `display: grid`.

![Visão geral do Projeto Designer](docs/screenshots/01-visao-geral.png)

> **Em uma frase:** abra o app, desenhe uma tela, e copie o CSS/HTML dela. Sem conta, sem internet obrigatória, sem instalar dependências.

---

## Índice

1. [O que é e o que não é](#1-o-que-é-e-o-que-não-é)
2. [Veja o produto](#2-veja-o-produto)
3. [Começando em 3 minutos](#3-começando-em-3-minutos)
4. [Primeiros passos no editor](#4-primeiros-passos-no-editor)
5. [Referência de funcionalidades](#5-referência-de-funcionalidades)
6. [Atalhos de teclado](#6-atalhos-de-teclado)
7. [Como funciona por dentro](#7-como-funciona-por-dentro)
8. [Estrutura do repositório](#8-estrutura-do-repositório)
9. [Testes](#9-testes)
10. [Desempenho](#10-desempenho)
11. [Limitações (leia antes de usar em trabalho sério)](#11-limitações-leia-antes-de-usar-em-trabalho-sério)
12. [Contribuindo](#12-contribuindo)
13. [Inspiração e licença](#13-inspiração-e-licença)

---

## 1. O que é e o que não é

**É:**
- Um editor de design vetorial/UI **local**: abre no navegador e **salva sozinho numa pasta do seu computador** (arquivos `.json`, com versões antigas guardadas), além de uma cópia no próprio navegador.
- **JavaScript puro** (módulos ES), **sem TypeScript, sem framework, sem etapa de build, sem dependências** para rodar. O servidor incluído (`server.js`, só Node.js) entrega o app e grava os projetos na pasta.
- Uma ferramenta para **estudar e prototipar com CSS**: os campos do painel têm os nomes das propriedades (`gap`, `padding`, `justify-content`, `align-items`, `mix-blend-mode`...), então usar o editor ensina o CSS.

**Não é:**
- Um serviço na nuvem, nem um substituto fiel do Figma ou do Penpot: não há cadastro, login nem "abrir o site e trabalhar". Faltam operações booleanas, variantes de componentes, variáveis/temas e plugins (lista completa na [seção 11](#11-limitações-leia-antes-de-usar-em-trabalho-sério)).
- Uma ferramenta de **edição simultânea**: duas pessoas não editam o mesmo projeto ao mesmo tempo. Hoje o servidor também escuta só no próprio computador (de propósito, por segurança). Usar em equipe, com o app hospedado num servidor da empresa, é uma direção possível, mas ainda não existe: veja "Equipe e servidor" na [seção 11](#11-limitações-leia-antes-de-usar-em-trabalho-sério). Dá para ter cópia na nuvem apontando a pasta para dentro do Google Drive/OneDrive/Dropbox ([seção 3](#onde-meu-trabalho-fica-salvo)).

---

## 2. Veja o produto

Cada imagem abaixo é uma captura real do app (geradas por [`scripts/gerar-capturas.mjs`](scripts/gerar-capturas.mjs)). O projeto de exemplo "app mobile" está em **Arquivo → Exemplo: app mobile**.

### Página inicial: seus projetos
Ao abrir o app aparece a **página inicial**: o projeto em que você estava ("continuar de onde parou"), os projetos da pasta com **miniaturas**, busca (`/`), ordenação e um menu **⋯** em cada um (abrir, renomear, duplicar, versões), além dos exemplos. `Esc` ou **Ir para o editor** volta ao canvas; o logo no topo do editor traz você de volta. Prefere cair direto no editor? **Configurações → Ao abrir o app**.

![Página inicial com os projetos](docs/screenshots/15-pagina-inicial.png)

### Auto layout é flexbox de verdade
Selecione um frame, escolha o modo (linha, coluna, grid) e use a **matriz 3×3** para alinhar. Cada controle mostra o nome da propriedade CSS que gera: `display`, `gap`, `flex-wrap`, `padding`, `justify-content`, `align-items` (com os valores de verdade, como `flex-start`, `space-between`, `stretch`). Camadas filhas escolhem **Fixo**, **Hug** (do tamanho do conteúdo) ou **Fill** (`flex: 1`) e podem ter `align-self` próprio.

![Auto layout com flexbox](docs/screenshots/02-auto-layout-flexbox.png)

### CSS Grid
O mesmo painel liga `display: grid`: `grid-template-columns`/`rows` (quantas colunas e linhas), `column-gap`/`row-gap`, `justify-items`/`align-items` (onde cada item fica dentro da célula, incluindo `stretch`) e o botão **Itens preenchem as células**. Cada item pode ocupar várias células (`grid-column: span N`) e ter `justify-self`/`align-self` próprios.

![CSS Grid](docs/screenshots/03-css-grid.png)

### Componentes e estilos
Crie um **componente** (Ctrl+Alt+K) e insira **instâncias**. Mudou o principal, todas as instâncias mudam — mas o texto ou a cor que você personalizou numa instância continua lá. A aba **Recursos** lista componentes e **estilos** de cor e de texto compartilhados.

![Componentes e estilos](docs/screenshots/04-componentes.png)

### O CSS real, pronto para copiar
A aba **Código** mostra o CSS e o HTML da seleção (ou da página inteira). É a mesma função que desenha o canvas e exporta o HTML, então não existe diferença entre o que você vê e o que copia.

![Aba Código](docs/screenshots/05-codigo-css.png)

### Protótipo navegável
Na aba **Protótipo**, defina "ao clicar / ao passar o mouse → navegar para um frame, voltar ou abrir um link", com transições. As **setas de fluxo** aparecem no canvas, e o botão **Apresentar** abre em tela cheia.

![Protótipo com setas de fluxo](docs/screenshots/06-prototipo.png)

![Modo Apresentar](docs/screenshots/07-apresentar.png)

### Vetores com a caneta
Curvas de Bézier: clique e arraste para criar pontos suaves com alças; duplo clique num vetor para **editar os pontos** (arrastar pontos e alças, `Alt` + clique adiciona ponto **sem deformar a curva**, duplo clique alterna canto/suave, `Shift` trava em 45°, as setas movem o ponto). O painel **Vetor** edita o ponto selecionado (canto/suave, X/Y), inverte a direção e mostra o **código SVG (`d`)** do desenho: copie, ou cole o `d` de outro SVG para trocar a forma. Polígono e estrela viram vetores editáveis.

**Desenhar o seu próprio ícone SVG:** *Arquivo → Novo ícone (24×24)* abre um frame com grade de pixels e **encaixe de 1px**; desenhe com a caneta, continue um caminho aberto clicando na ponta dele, selecione **vários pontos** (caixa, `Shift`, `Ctrl+A`), converta canto/suave com `Alt`+clique, e ajuste **extremidade e quina** do traço (redondas para ícones de linha). Depois exporte o frame como **SVG**.

![Caneta e edição de pontos](docs/screenshots/08-vetores-caneta.png)

### SVG e ícones do Google viram vetores editáveis
Arraste um arquivo **`.svg`** para o canvas (ou use o botão de imagem), ou **cole** um SVG copiado (o "Copiar como SVG" do Figma, sites de ícones): ele entra como **camadas de vetor que você edita**, não como imagem. Cada forma vira um vetor (cores, contorno, gradiente, furos), e textos simples viram texto. A aba **Ícones** do painel esquerdo tem os **4.299 Material Symbols** do Google: busque (em inglês ou com palavras comuns em português, como "casa", "carrinho", "seta"), escolha estilo (contorno, arredondado, reto), preenchido, cor e tamanho, e clique. Com um frame selecionado, o ícone entra nele.

![Painel de ícones do Google](docs/screenshots/16-icones-google.png)

### Google Fonts
O campo de fonte abre um seletor com as **1.908 fontes do Google** mais as do sistema: busca, filtro por categoria (sans, serif, display, manuscrita, mono) e **prévia de cada fonte escrita nela mesma**. A fonte é baixada quando um texto passa a usá-la; a lista de pesos mostra só os que ela tem; e o **HTML exportado** já leva o `<link>` das fontes.

![Seletor de fontes do Google](docs/screenshots/17-google-fonts.png)

### Medidas, réguas, guias e grades
Segure **Alt** e passe o mouse sobre outra camada para ver as **distâncias**. Arraste das **réguas** para criar guias (o snap as enxerga). Cada frame pode ter **grades de layout** de colunas, linhas ou quadrícula.

![Medidas com Alt](docs/screenshots/09-medidas-alt.png)

![Réguas, guias e grades de colunas](docs/screenshots/10-reguas-guias-grades.png)

### Tema claro/escuro e efeitos
Gradientes, sombras múltiplas, `filter: blur`, **vidro fosco** (`backdrop-filter`), contorno tracejado, **contorno só de um lado** (`border-bottom`, `border-left`…), `mix-blend-mode`... tudo com os valores do CSS.

![Tema claro](docs/screenshots/11-tema-claro.png)

![Efeito vidro](docs/screenshots/12-efeito-vidro.png)

### Salvar numa pasta do computador (e no Google Drive)
Em **Configurações** (engrenagem no topo ou `Ctrl+,`) você escolhe a **pasta** onde os projetos ficam. Com o projeto ligado a um arquivo, cada mudança é gravada lá sozinha; o topo mostra **Salvo na pasta**. Aponte a pasta para dentro do **Google Drive para computador** (ou OneDrive/Dropbox) e o próprio programa deles sobe os arquivos para a nuvem.

![Configurações de salvamento](docs/screenshots/13-configuracoes-salvamento.png)

**Arquivo → Abrir da pasta** (`Ctrl+O`) lista os projetos. Em **Versões** ficam cópias antigas de cada um (no máximo uma a cada 10 minutos), e qualquer uma pode ser aberta.

![Projetos na pasta com versões antigas](docs/screenshots/14-projetos-na-pasta.png)

---

## 3. Começando em 3 minutos

### O que você precisa
- **Node.js 18 ou mais novo** ([nodejs.org](https://nodejs.org)). Para usar o app, não há nada para `npm install` (o `npm install` só baixa o Playwright, usado nos testes de navegador).
- Um navegador atual (Chrome, Edge, Firefox ou Safari).

> **Por que preciso de um servidor?** Por dois motivos. (1) O app usa módulos ES (`import ... from`), e o navegador não os carrega abrindo o `index.html` direto do disco (`file://`). (2) Um site, por segurança, não pode gravar arquivos onde quiser no seu computador; o `server.js` roda **na sua máquina** e é quem grava os projetos na pasta. Ele só aceita pedidos do próprio computador (`127.0.0.1`).

### Rodando

```bash
git clone https://github.com/Kaykygnb/projetodesigner2.git
cd projetodesigner2
npm start
```

Abra **http://localhost:5173**. Para usar outra porta: `PORT=8080 npm start`.

### Sem Node? Tudo bem

Qualquer servidor de arquivos estáticos serve. Por exemplo, com Python:

```bash
python3 -m http.server 8000     # depois abra http://localhost:8000
```

Só que, **sem o `server.js`, não existe pasta**: o projeto fica apenas no navegador, e `Ctrl+S` baixa um arquivo `.json`. O app avisa isso em Configurações.

### Publicar como site (GitHub Pages)
Como o app é estático, dá para hospedar de graça: no GitHub, **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**. O app abre em `https://SEU-USUARIO.github.io/projetodesigner2/`. Lá ele funciona como em "Sem Node": salva só no navegador e baixa `.json` (o GitHub Pages não roda o `server.js`).

### Onde meu trabalho fica salvo?

Em **dois lugares**, e o indicador ao lado do nome do projeto (topo) diz qual está em dia:

| Onde | Quando | Ponto forte | Ponto fraco |
|---|---|---|---|
| **Pasta do computador** (arquivos `.json`) | Depois que o projeto tem um arquivo: `Ctrl+S` na 1ª vez pede o nome; daí em diante grava sozinho a cada mudança | Arquivo de verdade: copie, mande por e-mail, ponha no Google Drive. Guarda **versões antigas** | Precisa do `npm start` rodando |
| **Navegador** (IndexedDB) | Sempre, a cada mudança, mesmo sem servidor | Automático, sem configurar nada; aguenta projetos grandes (centenas de MB) | Some se você limpar os dados do site ou trocar de navegador |

| O indicador diz | Significa |
|---|---|
| **Salvo na pasta** (verde) | O arquivo `.json` da pasta está em dia. |
| **Salvo no navegador** (verde) | Projeto ainda sem arquivo. Use `Ctrl+S` para criar um. |
| **Só no navegador** (amarelo) | O projeto tem arquivo, mas a pasta não pôde ser gravada (servidor desligado, sem permissão). Quando o servidor voltar, o app põe a pasta em dia sozinho. |
| **Conflito no arquivo** (amarelo) | O arquivo foi mudado **fora** do editor (outra aba, outro computador pelo Drive) enquanto você editava aqui. O app **parou de gravar nele** para não apagar o trabalho alheio. `Ctrl+S` pergunta se você quer substituir; senão, salve com outro nome. |

- **A pasta padrão** é `projetos/` dentro da pasta do app. Troque em **Configurações** (`Ctrl+,`); aceita caminhos como `C:\Users\voce\Documents\Designer`, `/home/voce/Designer` ou `~/Designer`, e cria a pasta se não existir.
- **Google Drive:** instale o [Google Drive para computador](https://www.google.com/drive/download/) e escolha uma pasta dentro dele (no Windows costuma ser `G:\Meu Drive\...`). O Drive sincroniza os `.json`. Funciona igual com OneDrive e Dropbox. O app **não** se conecta à sua conta Google diretamente (isso exigiria cadastrar o app no Google e fazer login).
- **Versões antigas** ficam em `.versoes/` dentro da pasta (até 20 por projeto, configurável). Abra em **Arquivo → Abrir da pasta → Versões**. Uma versão abre "solta"; para restaurá-la, salve com o mesmo nome e confirme.
- **Projetos antigos** (versões ≤ 0.5 salvavam no `localStorage`) são migrados sozinhos para o IndexedDB na primeira vez que você abre o app.
- **Importar/baixar:** **Arquivo → Importar arquivo .json** e **Baixar cópia (.json)** continuam existindo, para levar um projeto de um computador a outro sem pasta compartilhada.
- **Trocar de projeto nunca apaga trabalho sem perguntar.** Se o projeto aberto só existe no navegador (sem arquivo), abrir outro, criar um novo ou abrir um exemplo pergunta antes, com a opção **Salvar na pasta antes**. Projetos já gravados na pasta, ou exemplos que você nem mexeu, trocam direto.
- Depois de algumas edições num projeto sem arquivo, aparece **uma vez** um lembrete no topo do canvas com o botão **Salvar na pasta**.

---

## 4. Primeiros passos no editor

Um roteiro de 5 minutos para sentir o app. (Dica: na **página inicial**, o card **App mobile** abre um projeto pronto para explorar.)

1. **Desenhe um frame** — aperte `F` e arraste no canvas. Frames são as "telas".
2. **Desenhe dentro dele** — `R` retângulo, `E` elipse, `T` texto (clique e digite). O frame sob o cursor vira o pai da camada nova.
3. **Mova e redimensione** — `V` volta à ferramenta Mover. Arraste a camada (linhas rosa mostram o *snap*), puxe as alças para redimensionar (`Shift` mantém a proporção, `Alt` redimensiona do centro). Ao redimensionar, a borda **gruda** nas bordas do frame pai e dos vizinhos (linha rosa); `Ctrl` solta. Passe o mouse fora de um canto para **rotacionar**.
4. **Ligue o auto layout** — selecione o frame e aperte `Shift+A`. O app deduz direção, `gap`, `padding` e alinhamento a partir de onde as camadas estavam (nada "pula" de lugar). Agora arraste uma camada: ela **reordena** dentro do flexbox.
   > **Dica — retângulo não tem "dentro".** Para uma sidebar, um card ou um botão que vai *conter* outras coisas, use um **Frame** (`F`). Se você já desenhou um retângulo de fundo com itens em cima, selecione tudo e aperte `Shift+A`: o retângulo de baixo **vira o frame** (mesma cor e cantos) e os itens entram nele. Um retângulo sozinho + `Shift+A` também vira frame. Um **grupo** + `Shift+A` vira frame.
5. **Veja o CSS** — abra a aba **Código** no painel direito.
6. **Desfaça sem medo** — `Ctrl+Z` desfaz o gesto inteiro (um arrasto é um passo só).
7. **Salve e exporte** — `Ctrl+S` dá um nome ao projeto e o grava na pasta (daí em diante salva sozinho). Painel Design → **Exportar** gera PNG, SVG ou HTML.

---

## 5. Referência de funcionalidades

### Ferramentas
| Ferramenta | Atalho | O que faz |
|---|---|---|
| Mover | `V` | Seleciona, move, redimensiona, rotaciona. |
| Frame | `F` ou `B` | Desenha uma prancha/contêiner. Tem presets de tamanho (iPhone, Android, iPad, Desktop, A4, Story...). |
| Seção | `Shift+S` | Contêiner de **organização** do canvas (como no Figma): nome em destaque, só na raiz, guarda frames/telas e as leva junto ao mover. Desenhe em volta de telas existentes para **adotá-las**. Clique no nome ou no corpo para selecionar e arrastar. Sem auto layout, contorno nem efeitos; no código vira `<section>`. `Ctrl+Shift+G` desfaz a seção. |
| Retângulo / Elipse | `R` / `E` | Formas básicas. Um clique sem arrastar cria 100×100. |
| Linha | `L` | Linha com ângulo livre (`Shift` prende em múltiplos de 15°). |
| Polígono / Estrela | botão da barra | Viram vetores editáveis. |
| Caneta | `P` | Vetores com curvas de Bézier. |
| Texto | `T` | Clique para texto livre; arraste para uma caixa de largura fixa. |
| Imagem | botão, arrastar ou `Ctrl+V` | Cria um retângulo com preenchimento de imagem (reduzida a 1600 px). Arquivos **`.svg`** e SVG colado como texto viram **vetores editáveis**. |
| Mão | `H` ou segurar `Espaço` | Arrasta a vista. |

### Seleção e edição
| Recurso | Como |
|---|---|
| Selecionar | Clique; `Shift`+clique soma; arraste no vazio faz *marquee*; `Ctrl`+clique atravessa grupos; `Tab`/`Shift+Tab` percorrem as camadas. |
| Mover | Arraste; setas movem 1 px (`Shift` = 10 px); `Alt`+arrastar duplica; arrastar sobre outro frame **troca o pai**. |
| Alinhar / distribuir | Barra no topo do painel Design (esquerda, centro, direita, topo, meio, base; distribuir com 3+ camadas). |
| Várias camadas | O painel mostra **X/Y/W/H do conjunto** e escala todas juntas. |
| Agrupar | `Ctrl+G` agrupa; `Ctrl+Shift+G` desagrupa (também frames); `Ctrl+Alt+G` **envolve em frame**. |
| Máscara | `Ctrl+Alt+M`: a camada de baixo recorta as outras (`clip-path`). |
| Ordem (z) | `Ctrl+]` / `Ctrl+[` (um passo); com `Shift`, frente/fundo. |
| Copiar/colar | `Ctrl+C/X/V`; com **um frame selecionado**, cola dentro dele. Cola também imagem ou texto do sistema. |
| Copiar propriedades | `Ctrl+Alt+C` / `Ctrl+Alt+V` leva só a aparência (cor, borda, sombra...). |
| Travar / ocultar | Ícones na lista de camadas; `Ctrl+Shift+L` / `Ctrl+Shift+H`. |
| Espelhar | `Shift+H` / `Shift+V`. |
| Travar proporção | Botão de corrente ao lado de W/H. |
| Desfazer / refazer | `Ctrl+Z` / `Ctrl+Shift+Z` (até 200 passos). |

### Layout (o coração do projeto)
| Recurso | Detalhe |
|---|---|
| **Flexbox** | `flex-direction` (linha/coluna), `gap`, `padding` (horizontal/vertical ou por lado), `justify-content`, `align-items`, `flex-wrap`. |
| **CSS Grid** | Colunas, linhas, `column-gap`/`row-gap`, `justify-items`/`align-items` (com `stretch`); itens podem ocupar várias células (`grid-column: span N`) e ter `justify-self`/`align-self`. |
| Matriz 3×3 | Define `justify` e `align` de uma vez; troca de papel entre linha e coluna. |
| Tamanho do item | **Fixo**, **Ajustar ao conteúdo** (`hug`) ou **Preencher** (`flex: 1` / `align-self: stretch`). |
| Posição absoluta | Marque "Posição absoluta" para um item **ignorar** o auto layout do pai (enfeites, selos). |
| Constraints | Em frames **sem** auto layout: esquerda, direita, esquerda+direita, centro, escala (e o mesmo na vertical). Reagem ao redimensionar o frame. |
| Grades de layout | Colunas, linhas ou quadrícula por frame (só guia visual). |
| Réguas e guias | `Shift+R` liga/desliga; arraste da régua para criar; arraste de volta para apagar. |

### Aparência
| Recurso | Detalhe |
|---|---|
| Preenchimento | Nenhum, cor sólida, gradiente linear (com ângulo), radial, imagem (`cover`/`contain`/esticar). Várias paradas de cor. |
| Contorno | Cor, espessura, sólido/tracejado/pontilhado, dentro/centro/fora (usa `outline`, que não altera o layout). |
| Cantos | `border-radius` único ou por canto. |
| Sombras | Várias, externas e internas (`box-shadow`); em texto vira `text-shadow`; em vetor, `drop-shadow`. |
| Efeitos | `filter: blur`, **desfoque de fundo** (`backdrop-filter`, efeito vidro), opacidade, `mix-blend-mode` (16 modos). |
| Texto | Fonte (**Google Fonts** + sistema, com busca e prévia), peso (só os que a fonte tem), tamanho, `line-height`, `letter-spacing`, alinhamento, itálico, sublinhado/riscado, MAIÚSCULAS/minúsculas, alinhamento vertical na caixa, gradiente no texto. Durante a edição: `Ctrl+B/I/U`. |
| Cores do projeto | Atalhos com as cores já usadas, e conta-gotas (onde o navegador oferece). |

### Biblioteca
| Recurso | Detalhe |
|---|---|
| Componentes | `Ctrl+Alt+K` cria o principal; **instâncias** seguem o principal mas mantêm sobrescritas (texto, cor, tamanho...). `Ctrl+Alt+B` desanexa; "Ir ao principal" navega até ele. |
| Estilos de cor e de texto | Criados da seleção (aba Recursos ou botão **+**). Mudar o estilo muda todas as camadas ligadas. |
| Páginas | Várias por projeto; botão direito na página: renomear, **duplicar**, excluir. |
| Ícones | Aba **Ícones**: Material Symbols do Google (licença Apache 2.0, uso livre, inclusive comercial), inseridos como vetor. |

### Protótipo
Gatilhos **ao clicar** e **ao passar o mouse**; ações **navegar para**, **voltar** e **abrir link**; transições **instantâneo, dissolver e deslizar** (4 direções); ponto de partida do fluxo; setas no canvas; **Apresentar** em tela cheia (`Ctrl+Alt+Enter`; `Esc` sai, `R` reinicia).

### Código e exportação
| Saída | Como | Observação |
|---|---|---|
| **CSS e HTML** | Aba **Código** (ou `Ctrl+Shift+C` para copiar o CSS) | A mesma função do canvas; classes legíveis (`.cartao-de-saldo`). |
| **PNG** | Painel → Exportar (1x a 4x); **Arquivo → Exportar todos os frames** | Usa as fontes **instaladas** no seu computador e pode não mostrar `backdrop-filter`. |
| **SVG** | Painel → Exportar | Vetorial de verdade (formas, textos, gradientes, sombras, máscaras). Sombras internas e vidro não existem em SVG e são omitidos. |
| **HTML** | Painel → Exportar | Página completa, um arquivo só. |
| **Projeto (.json)** | `Ctrl+S` (pasta) · Arquivo → **Baixar cópia** | Páginas, imagens e estilos. Abrir: `Ctrl+O` (pasta) ou Arquivo → **Importar**. |

### Conforto de uso
Painéis **redimensionáveis** (arraste a borda; duplo clique restaura) · **modo foco** `Ctrl+\` esconde os painéis · busca de camadas · grade de pixels a partir de 800% de zoom · indicador de salvamento (pasta / navegador / conflito) · **Configurações** (`Ctrl+,`): pasta, versões, tema, roda do mouse · aviso amigável se algo inesperado acontecer.

### Acessibilidade (teclado e leitor de tela)
Menus abrem com `Enter`/`Espaço` e navegam com `↑`/`↓`/`Home`/`End`; `Esc` fecha e devolve o foco. As janelas (Configurações, Projetos, Atalhos, perguntas) prendem o foco enquanto abertas, e o app não usa mais as caixas `confirm()`/`prompt()` do navegador. Com a página inicial ou uma janela aberta, o editor por trás fica inativo (`inert`): nenhum atalho age escondido. Botões só com ícone, ferramentas e abas têm nome e estado para leitores de tela (`aria-label`, `aria-pressed`, `aria-selected`), e o foco do teclado aparece com um contorno.

---

## 6. Atalhos de teclado

No app, aperte **`?`** para ver esta lista. (No Mac, use `⌘` no lugar de `Ctrl`.)

| Área | Atalho | Ação |
|---|---|---|
| **Ferramentas** | `V` · `F`/`B` · `R` · `E` · `L` · `P` · `T` · `H` | Mover · Frame · Retângulo · Elipse · Linha · Caneta · Texto · Mão |
| **Edição** | `Ctrl+Z` / `Ctrl+Shift+Z` | Desfazer / Refazer |
| | `Ctrl+D` · `Alt`+arrastar | Duplicar |
| | `Ctrl+C` / `X` / `V` | Copiar / Recortar / Colar |
| | `Ctrl+A` | Selecionar tudo no mesmo nível |
| | `Delete` | Excluir |
| | Setas (`Shift` = 10 px) | Mover |
| | `0`–`9` | Opacidade (1 = 10% … 0 = 100%) |
| **Agrupar e layout** | `Ctrl+G` / `Ctrl+Shift+G` | Agrupar / Desagrupar |
| | `Ctrl+Alt+G` | Envolver em frame |
| | `Shift+A` | Auto layout: liga/desliga num frame; retângulo, grupo ou "fundo + itens" viram frame; camadas soltas ganham um frame que as abraça |
| | `Ctrl+Alt+M` | Máscara |
| | `Shift+H` / `Shift+V` | Espelhar |
| **Componentes** | `Ctrl+Alt+K` / `Ctrl+Alt+B` | Criar componente / Desanexar |
| | `Ctrl+Alt+C` / `Ctrl+Alt+V` | Copiar / colar propriedades |
| **Camadas** | `Ctrl+]` / `Ctrl+[` | Avançar / Recuar |
| | `Ctrl+Shift+]` / `Ctrl+Shift+[` | Frente / Fundo |
| | `Ctrl+Shift+L` / `Ctrl+Shift+H` | Travar / Ocultar |
| | `F2` | Renomear |
| | `Enter` / `Shift+Enter` | Entrar no grupo / sair para o pai |
| **Seleção** | `Ctrl`+clique | Seleciona através de grupos |
| | `Tab` / `Shift+Tab` | Próxima / anterior camada |
| | `Alt`+mouse | Mostra distâncias até outra camada |
| **Vista** | `Ctrl`+roda · `Ctrl`+`+`/`-`/`0` | Zoom · Aproximar/afastar/100% |
| | Roda · `Shift`+roda | Rolar vertical / horizontal |
| | `Espaço`+arrastar | Pan |
| | `Shift+1` / `Shift+2` / `Shift+0` | Ajustar tudo / seleção / 100% |
| | `Shift+R` | Réguas |
| | `Ctrl+\` | Esconder/mostrar painéis |
| **Ao arrastar** | `Shift` / `Alt` / `Ctrl` | Mantém proporção (ou trava eixo) / do centro / sem *snap* |
| **Texto (editando)** | `Ctrl+B` / `I` / `U` | Negrito / itálico / sublinhado |
| **Página inicial** | `/` · `Esc` | Buscar projeto · voltar ao editor (o logo do editor abre a página) |
| **Arquivo** | `Ctrl+S` | Salvar na pasta (na 1ª vez, escolhe o nome) |
| | `Ctrl+Shift+S` | Salvar como… (outro nome) |
| | `Ctrl+O` | Abrir projeto da pasta |
| | `Ctrl+,` | Configurações |
| | `Ctrl+Shift+C` | Copiar CSS |
| | `Ctrl+Alt+Enter` | Apresentar o protótipo |

---

## 7. Como funciona por dentro

O desenho em uma imagem:

```mermaid
flowchart LR
  U["Usuário<br/>(mouse e teclado)"] --> T["tools.js<br/>gestos e atalhos"]
  T -->|"store.update()<br/>store.commit()"| S[("store.js<br/>documento + histórico")]
  P["ui/*.js<br/>painéis"] -->|"mesmas funções"| S
  C["commands.js<br/>agrupar, alinhar, ..."] --> S
  S -->|"emit('doc')"| CV["canvas.js<br/>camadas → HTML"]
  CV -->|"usa"| CSS["css.js<br/>camada → CSS"]
  S --> O["overlay.js<br/>seleção, alças"]
  CSS --> CODE["aba Código<br/>exportar HTML/PNG"]
  S --> EX["svg.js · export.js<br/>SVG, PNG, .json"]
  S -->|"auto-salvar"| SV["saving.js · storage.js<br/>navegador (IndexedDB)"]
  SV -->|"fetch /api"| SRV["server.js<br/>pasta do computador"]
```

Os pontos que mais importam:

1. **Tudo é dado simples.** O documento é `páginas → árvore de camadas` em objetos JSON ([`src/model.js`](src/model.js)). Isso permite salvar com `JSON.stringify`, testar sem navegador e fazer histórico por "fotos".
2. **Uma função só gera o CSS.** [`nodeStyle()`](src/css.js) converte uma camada em CSS; o canvas, o painel Código, o HTML exportado e o PNG usam a mesma. Por isso não há diferença entre editor e saída.
3. **O navegador faz o layout.** Em auto layout, quem calcula posições é o motor CSS. O editor *lê* o resultado do DOM ([`canvas.js`](src/canvas.js)) em vez de reimplementar flexbox/grid.
4. **Gesto = um passo de histórico.** Durante um arrasto o documento muda ao vivo sem histórico; ao soltar o mouse há **um** `commit()`. Um `Ctrl+Z` desfaz o gesto inteiro.
5. **Instâncias de componente guardam uma "foto base".** A cada commit o app compara a instância com a foto para descobrir o que o usuário sobrescreveu, reconstrói a partir do principal e reaplica as sobrescritas ([`components.js`](src/components.js)).

Quer ler ou mexer no código? Comece pelo **[Guia do código](docs/GUIA-DO-CODIGO.md)**: por onde começar, o caminho de um clique pelo código e "quero mudar X → mexo no arquivo Y". Para o aprofundamento (modelo de dados campo a campo, algoritmos, como estender o editor) leia **[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)**, e para consultar qualquer função a **[Referência](docs/REFERENCIA.md)** (gerada dos comentários com `npm run docs`). O código inteiro é comentado em português, explicando o *porquê* de cada decisão.

---

## 8. Estrutura do repositório

```
projetodesigner2/
├── index.html              Página única: só o "esqueleto" (o app é montado por src/main.js)
├── server.js               Servidor local (sem dependências): entrega o app e grava os projetos na pasta (API /api)
├── package.json            Scripts: `npm start`, `npm test`, `npm run test:e2e`, `npm run test:all`, `npm run docs`
├── README.md               Este arquivo
├── CONTRIBUTING.md         Como contribuir e a convenção de commits
├── CHANGELOG.md            O que mudou em cada versão
├── docs/
│   ├── GUIA-DO-CODIGO.md   Por onde começar a ler o código e onde mexer para mudar cada coisa
│   ├── ARQUITETURA.md      Funcionamento interno e guia para estender
│   ├── REFERENCIA.md       Todas as funções, arquivo por arquivo (GERADO: npm run docs)
│   └── screenshots/        As capturas de tela usadas aqui
├── scripts/
│   ├── gerar-capturas.mjs  Regenera as capturas (usa Playwright)
│   ├── gerar-referencia.mjs  Gera docs/REFERENCIA.md a partir dos comentários do código
│   └── gerar-listas-google.mjs  Atualiza as listas de fontes e ícones do Google (src/data/)
├── src/
│   ├── main.js             Ponto de entrada: monta o app
│   ├── model.js            Modelo de dados e funções puras da árvore
│   ├── css.js              Camada → CSS / HTML / SVG (puro)
│   ├── store.js            Estado, histórico (desfazer) e QUANDO salvar (auto-salvar)
│   ├── saving.js           Regras de salvamento: pasta x navegador, conflito, servidor desligado
│   ├── storage.js          COMO gravar: IndexedDB, preferências e a API da pasta
│   ├── thumbnail.js        Miniatura SVG da página (para a página inicial)
│   ├── components.js       Componentes, instâncias e estilos (puro)
│   ├── canvas.js           Desenha o documento em HTML; pan, zoom e geometria
│   ├── overlay.js          Seleção, alças, guias, medidas, setas
│   ├── tools.js            Mouse e teclado: todos os gestos e atalhos
│   ├── commands.js         Agrupar, duplicar, alinhar, auto layout, componentes...
│   ├── pen.js              Ferramenta caneta e edição de pontos
│   ├── rulers.js           Réguas e guias
│   ├── present.js          Modo Apresentar (protótipo)
│   ├── svg.js              Exportação SVG (puro)
│   ├── svgimport.js        Importa SVG como vetores editáveis (arcos, curvas, transform, estilos)
│   ├── fonts.js            Google Fonts: lista, carregamento sob demanda, prévia, link no HTML
│   ├── data/               Listas embutidas: 1.908 fontes e 4.299 ícones do Google (geradas)
│   ├── export.js           PNG, SVG, HTML e arquivo de projeto
│   ├── sample.js           Os dois projetos de exemplo
│   ├── ui/                 Painéis (camadas, propriedades, código, recursos, protótipo, ícones), seletor de fontes, página inicial (home.js),
│   │                       menus e janelas (perguntas, configurações, projetos na pasta), ícones
│   └── styles/app.css      Todo o visual (tema claro/escuro por variáveis CSS)
└── tests/
    ├── css.test.js         Testes unitários do gerador de CSS e do modelo
    ├── features.test.js    Testes unitários de componentes, SVG, vetores, constraints...
    ├── server.test.js      Servidor: entrega os assets e bloqueia arquivos privados
    ├── api.test.js         API: pasta, gravar/ler, conflito, versões, miniatura, renomear, segurança
    ├── svgimport.test.js   Importador de SVG: caminhos, arcos, curvas, transformações, cores
    ├── fonts.test.js       Google Fonts: URL, pesos, fontes usadas, <link> no HTML exportado
    ├── referencia.test.js  Confere se docs/REFERENCIA.md está em dia com os comentários
    └── e2e/                Testes de navegador (usam Playwright)
```

---

## 9. Testes

### Testes unitários (rápidos, sem navegador)
Cobrem a lógica pura (geração de CSS, modelo, constraints, componentes e instâncias, estilos, SVG, vetores, medidas, exemplos) e o servidor (entrega de arquivos e a API de salvamento, numa pasta temporária).

```bash
npm test      # 54 testes
```

### Testes de navegador
Abrem o app de verdade e simulam o uso: desenhar, arrastar entre frames, redimensionar com rotação, caneta, componentes, protótipo, atalhos, salvar na pasta (conflito, versões, servidor desligado), página inicial (miniaturas, renomear, duplicar), teclado, layout e desempenho. Eles abrem o app com `?editor` para pular a página inicial. Usam o Playwright (dependência só de desenvolvimento):

```bash
npm install && npx playwright install chromium
npm start                 # em outro terminal
npm run test:e2e          # todas as suítes; sai com erro se alguma falhar
```

Detalhes e variáveis de ambiente em [`tests/e2e/README.md`](tests/e2e/README.md).

---

## 10. Desempenho

Medido movendo uma camada com o mouse num documento grande (tempo por movimento, em milissegundos; o ideal é abaixo de ~16 ms para 60 quadros por segundo):

| Camadas no projeto | Antes da otimização | Atual |
|---|---|---|
| 100 | 55 ms | ~17 ms |
| 400 | 150 ms | ~20 ms |
| 1000 | 350 ms | ~33 ms |

O ganho veio de não reconstruir a lista de camadas nem o índice interno quando só um *valor* muda. Reproduza com `node tests/e2e/desempenho.mjs 400`. A máquina de teste importa; seus números podem variar.

---

## 11. Limitações (leia antes de usar em trabalho sério)

Este projeto cobre bastante de Figma e Penpot para uso **individual e para protótipos**: layout em CSS de verdade (flex e grid), componentes, protótipo, seções, caneta para ícones SVG, importar e exportar SVG/HTML/PNG. Mas **não é** um clone completo.

### O que não tem

**Design**
- **Operações booleanas** (unir, subtrair, interseccionar formas). Pesa principalmente na criação de ícones.
- **Mais de um preenchimento ou contorno por camada.**
- **Variantes de componente**, **variáveis** e **temas** de design.
- **Plugins.**
- **Edição de imagem** (recorte, filtros) e lápis livre.
- Texto com **estilos misturados** na mesma caixa e listas.

### Equipe e servidor

Hoje o projeto é pensado para **uma pessoa por vez**. O que existe e o que falta para uma empresa pequena hospedar o app e todos usarem:

- **O servidor escuta só no computador local** (`127.0.0.1`) e recusa qualquer outro `Host`. É proposital: ele grava no disco. Para uso em rede seria preciso um modo "rede" ligado de forma explícita.
- **Sem login nem permissões.** Quem alcançasse o servidor leria, gravaria e apagaria tudo.
- **Sem edição simultânea.** Cada projeto é um arquivo `.json` inteiro. Se duas pessoas editam o mesmo arquivo, o app **detecta o conflito e para de gravar**, mas **não junta** as duas edições. Dividir o trabalho por projeto ou por página funciona; trabalhar juntos no mesmo projeto ao mesmo tempo, não.
- **Sem histórico por pessoa:** as versões antigas guardam o arquivo, não "quem mudou o quê".
- **Comentários** entre pessoas também não existem.

Detalhes que valem saber:

- **Salvar na pasta precisa do `npm start`.** Aberto por outro servidor (ou pelo GitHub Pages), o app salva só no navegador; `Ctrl+S` baixa um `.json`.
- **Conflito é detectado, não mesclado.** Se o mesmo arquivo for editado em dois lugares, o app para de gravar e pergunta; ele não junta as duas edições.
- **Google Drive** funciona por meio do programa do Drive no computador (pasta sincronizada), não por login direto na sua conta.
- **Acessibilidade:** menus, janelas, abas e botões funcionam por teclado e têm rótulos; **desenhar e mover no canvas ainda dependem do mouse** (as setas movem a seleção, mas não há como desenhar formas só pelo teclado).
- **Ícones e Google Fonts precisam de internet** para buscar/baixar. Um ícone, depois de inserido, é um desenho do projeto (funciona offline); uma fonte não: sem internet, o texto aparece numa fonte de reserva.
- **Importar SVG cobre o comum:** caminhos, formas, cores, classes CSS simples, gradientes (aproximados pela direção), grupos e transformações, furos, textos simples, **sombras exportadas pelo Figma** e nomes de fonte do Illustrator ("Poppins-Bold" → Poppins 700). **Sombra interna, outros filtros, máscaras, padrões, imagens embutidas e texto em curva ficam de fora** — e o aviso diz exatamente o quê. Testado com arquivos no formato do Figma e do Illustrator (`tests/fixtures/`), mas não com exports reais de todas as versões desses programas.
- **Vetor com furos:** com a caneta (`Enter`/duplo clique) você edita os pontos do **contorno principal**; os contornos dos furos acompanham, mas seus pontos ainda não são editáveis. Pelo mesmo motivo, **continuar um caminho** pela ponta não vale para vetores com furos nem para vetores girados.
- **PNG:** usa as fontes instaladas no seu computador (o navegador não carrega fontes da web dentro de uma imagem SVG) e pode não mostrar `backdrop-filter`. O **HTML** e o **SVG** exportados não têm esses limites (no SVG, sombras internas e vidro são omitidos porque não existem no formato).
- **Instâncias de componente** não aceitam adicionar ou remover camadas internas (reverte na próxima sincronização); mudar propriedades, textos e posições funciona.
- Telas (frames da raiz) **não "entram"** em outros frames ao serem arrastadas (de propósito, para não aninhar sem querer). Elas só trocam entre a raiz e uma **seção**; a seção, por sua vez, só existe na raiz e só guarda frames.
- **Grupos** redimensionam escalando os filhos; **frames** respeitam as *constraints* dos filhos.
- Foi testado principalmente no **Chromium**; Firefox e Safari devem funcionar, mas têm menos horas de uso.

> **Seja realista:** é uma base sólida e bem documentada, ótima para **uso individual**, prototipar, criar ícones simples, estudar e evoluir. Para um trabalho de cliente com prazo, para **várias pessoas editando juntas** ou para ilustração vetorial complexa, use o [Penpot](https://penpot.app) (gratuito e de código aberto) ou o Figma.

---

## 12. Contribuindo

Contribuições são bem-vindas. Leia o **[`CONTRIBUTING.md`](CONTRIBUTING.md)** — ele explica como rodar o projeto, como escrever comentários e, principalmente, a **convenção de mensagens de commit** (*Conventional Commits* em português, com um corpo listando "o que mudou").

Regras de ouro do código:
1. Nada de dependências nem etapa de build: JavaScript puro em módulos ES.
2. Toda alteração no documento passa por `store.update()`; ao final de um gesto, um `store.commit()`.
3. Lógica que não precisa do DOM mora em módulos **puros** (`model.js`, `css.js`, `components.js`, `svg.js`) e tem teste em `tests/`.
4. Comentário explica o **porquê**, em português.

---

## 13. Inspiração e licença

**Inspiração.** A organização do produto (páginas, frames/boards, camadas, auto layout em flexbox, painel de código, componentes, protótipo) é inspirada no [Penpot](https://penpot.app) e no Figma. Este projeto foi escrito do zero em JavaScript; **não copia código do Penpot** (que é escrito em Clojure/ClojureScript e licenciado sob MPL-2.0).

**Licença.** Ainda não definida: sem um arquivo `LICENSE`, o código fica com *todos os direitos reservados* por padrão, mesmo estando público. Se você é o autor e quer que outras pessoas possam usar, adicione uma licença (a [MIT](https://choosealicense.com/licenses/mit/) é a mais comum para projetos como este).
