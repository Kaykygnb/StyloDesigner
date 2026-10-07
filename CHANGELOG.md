# Changelog

Todas as mudanças relevantes do projeto, da mais nova para a mais antiga. Formato inspirado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/) (enquanto estiver na `0.x`, mudanças grandes podem acontecer entre versões).

Categorias: **Adicionado** · **Alterado** · **Corrigido** · **Desempenho** · **Documentação**.

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
