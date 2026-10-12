# Guia do painel web

Abra **http://localhost:5173/studio/**. Tudo que você faz aqui é uma chamada de ferramenta MCP: um agente conectado vê e faz o mesmo.

## Projetos (tela inicial)

- **Novo projeto**, **Importar JSON**, busca, miniatura da primeira tela, **Exportar JSON**.
- No topo: **Biblioteca** (arquivos da sua conta), **Conexões MCP** (como conectar agentes), **Administração**, **Minha conta**, tema claro/escuro.

## Editor — visão geral

| Área | O que tem |
|---|---|
| **Topo** | Projetos · nome do projeto (clique: brief, notas, pessoas) · Desktop/Tablet/Celular · desfazer/refazer · Conferir · Agentes · Histórico · Apresentar · Publicar · Exportar |
| **Esquerda** | **Camadas** (páginas + árvore), **Recursos** (fotos, imagens do projeto, componentes, estilos de cor/texto/sombra/gradiente, variáveis, modos de cor, paletas) e **Ícones** |
| **Centro** | Canvas com réguas e guias, zoom e barra de ferramentas |
| **Direita** | Design · Protótipo · Código · Comentários · Inspecionar · Problemas · Agentes · Histórico · Exportar |

## Canvas

- **Mover a vista:** `Espaço`+arrastar, ferramenta Mão (`H`) ou botão do meio. **Zoom:** `Ctrl`+roda, `Ctrl` `+`/`-`/`0`, `Shift+1` (tudo), `Shift+2` (seleção), `Shift+0` (100%).
- **Selecionar:** clique; `Shift` soma/tira; `Ctrl`+clique atravessa grupos; duplo clique entra no grupo ou edita o texto; arrastar no vazio faz caixa de seleção.
- **Mover/redimensionar/girar:** arraste; `Shift` trava eixo/proporção; `Alt` duplica ao arrastar ou redimensiona a partir do centro; `Ctrl` desliga o encaixe. Em layouts flex, arrastar reordena os itens e mostra onde vai cair.
- **Medidas:** segure `Alt` sobre outra camada para ver as distâncias.
- **Réguas e guias:** `Ctrl+R` liga/desliga; arraste da régua para criar guias; solte sobre a régua para apagar.
- **Telas (frames):** crie com `F`+arrastar; cada tela é HTML real. Tablet/Celular mostram a tela naquela largura e as mudanças valem só ali.

## Ferramentas (barra inferior)

Mover `V` · Mão `H` · Frame `F` · Seção `⇧S` · Retângulo `R` · Elipse `E` · Linha `L` · Polígono · Estrela · Texto `T` · **Caneta `P`** · **Lápis** · **Editar nós `N`** · Comentar `C` · Inspecionar `I` · Imagem.

Clique simples cria no tamanho padrão; arrastar desenha. Um texto novo já entra em edição.

### Vetores

- **Caneta:** clique põe ponto; arrastar faz curva; clicar no primeiro ponto fecha; `Enter`/duplo clique termina; `Backspace` volta; `Esc` cancela. **Guias cor-de-rosa** mostram o alinhamento com bordas/centros de outras camadas, das guias da régua e dos seus próprios pontos; `Shift` trava em 45°; `Ctrl` desliga o encaixe.
- **Lápis:** risque à mão livre; o traço é simplificado ao soltar.
- **Editar nós (`N`):** arraste pontos e alças; `Shift` seleciona vários; setas movem (com `Shift`, 10 px); a lista de pontos e o tipo do nó (canto, suave, simétrico, livre) ficam no painel Design → Vetor.
- **Barra de vetor** (aparece com um vetor selecionado): editar nós, inverter direção, simplificar, arredondar cantos, converter contorno em forma. Com dois vetores: **interpolar**. Com duas ou mais camadas: **união, subtração, interseção, exclusão**.
- **Importar SVG:** envie um `.svg` pelo botão de imagem; ele vira vetor editável.

## Painel Design

Posição e alinhamento · tamanho (fixo, hug, fill; mín./máx.; proporção) · **auto layout** (flex e grid: direção, gap, padding, alinhamentos, quebra, colunas/linhas e modelos) · aparência (opacidade, mesclagem, raio, recorte, filtros) · **preenchimento** (cor, gradiente linear/radial/cônico, imagem com ajuste, estilos de cor) · contorno (posição, estilo, marcadores) · sombras e efeitos · **texto** (fonte, peso, tamanho, linha, alinhamento, transformações, estilos de texto) · restrições · componente (criar, desanexar, instância) · **responsivo** por breakpoint · **estados** hover/foco/ativo · interações de protótipo · vetor · mídia (vídeo, áudio, Lottie, 3D) · HTML (etiqueta, id, classes, link, descrição).

## Outras abas

- **Protótipo:** liga telas por clique/hover com transições; **Apresentar** (`Ctrl+Alt+Enter`) abre o protótipo clicável.
- **Código:** o **CSS e o HTML reais** da seleção (os mesmos da exportação). Edite as declarações: o que o painel entende vira campo da camada, o resto vai para o CSS livre (apagar uma linha que o desenho ainda gera vira `unset`). Aba **Página:** CSS global do projeto (seletores, `@media`, `@keyframes`).
- **Comentários:** fios com respostas, resolver/reabrir; comente uma camada pela ferramenta Comentar.
- **Inspecionar:** informações da camada como no F12 (posição, tamanho, HTML e CSS).
- **Problemas (Conferir):** vazamento horizontal por breakpoint, contraste, texto pequeno, imagem sem descrição, títulos fora de ordem, alvos de toque; clicar seleciona a camada.
- **Agentes:** quem está conectado e o que fizeram; o que um agente altera aparece sozinho na tela.
- **Histórico:** versões automáticas; nomear, comparar, duplicar como novo projeto e restaurar.
- **Exportar:** site HTML (.zip), projeto React + Vite (.zip), tokens (CSS, JSON, Tailwind), publicações recentes.

## Janela do projeto

Clique no **nome do projeto**: **Brief** (o que é, para quem, tom, valores, metas, o que evitar — agentes leem antes de desenhar), **Notas** (o porquê das decisões) e **Pessoas** (compartilhar por e-mail com uma conta existente, em modo com contas).

## Botão direito

Na camada: copiar, colar, colar por cima, duplicar, apagar; agrupar/desagrupar, envolver em frame; criar componente/desanexar; máscara; booleanas; ordem (frente, fundo, avançar, recuar); travar/ocultar; espelhar; auto layout; copiar/colar propriedades e **copiar CSS**; renomear; comentar. No vazio do canvas: colar, ajustar à tela, réguas.

## Atalhos

Pressione `?` no editor para a lista completa. Principais:

| Ferramentas | |
|---|---|
| `V` mover · `H` mão · `F`/`B` frame · `⇧S` seção · `R` retângulo · `E` elipse · `L` linha · `T` texto · `P` caneta · `N` nós · `C` comentar · `I` inspecionar | |

| Edição | |
|---|---|
| `Ctrl+Z` / `Ctrl+⇧Z` | desfazer / refazer |
| `Ctrl+D` | duplicar (ou `Alt`+arrastar) |
| `Ctrl+C` / `X` / `V` | copiar / recortar / colar |
| `Ctrl+A` | selecionar tudo no mesmo nível |
| `Ctrl+G` / `Ctrl+⇧G` | agrupar / desagrupar |
| `Ctrl+Alt+G` | envolver em frame |
| `Ctrl+Alt+K` / `B` / `M` | criar componente / desanexar / máscara |
| `Ctrl+Alt+U` `I` `X` `S` | união, interseção, exclusão, subtração |
| `Ctrl+Alt+C` / `V` | copiar / colar propriedades |
| `Ctrl+⇧C` | copiar CSS |
| `0`–`9` | opacidade (1 = 10% … 0 = 100%) |
| `⇧A` | auto layout |
| `Delete` | excluir |
| setas (`⇧` = 10 px) | mover |

| Camadas | |
|---|---|
| `Ctrl+]` / `[` | avançar / recuar |
| `Ctrl+⇧]` / `[` | frente / fundo |
| `Ctrl+⇧L` / `H` | travar / ocultar |
| `F2` | renomear |
| `Enter` / `⇧Enter` | entrar / sair do grupo |
| `Tab` / `⇧Tab` | próxima / anterior |

| Vista | |
|---|---|
| `Ctrl+R` | réguas |
| `Ctrl+\` | esconder/mostrar painéis |
| `Ctrl+,` | configurações |
| `Ctrl+Alt+Enter` | apresentar |

## Configurações (`Ctrl+,`)

Tema (claro, escuro, sistema), cor de destaque, densidade, idioma (pt-BR/en-US), **atalhos das ferramentas** (uma tecla por ação, sem repetir), réguas e guias, **metadados do site** (título, descrição, idioma, URL canônica, imagem social, favicon) e o comando para conectar um agente. Aparência, idioma e atalhos são preferências **da sua conta**: não entram no projeto.

## Administração

- **Modo local (`STYLO_AUTH=local`):** saúde do servidor e do banco, endereços da rede local com QR Code, atividade global, backups, plugins e provedores de assets (ativar, diagnosticar, chaves), fontes de assets.
- **Modo com contas (padrão):** tudo isso, mais usuários (criar com senha temporária exibida uma única vez, papéis, suspender, revogar sessões), agentes MCP (tokens, escopos, aprovar/revogar, atividade) e o guia de conexão por cliente.
