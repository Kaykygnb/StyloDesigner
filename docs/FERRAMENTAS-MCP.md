# Ferramentas MCP

> Gerado automaticamente por `npm run docs:ferramentas` a partir do código. Não edite à mão.

O Stylo anuncia **120 ferramentas**: 97 do núcleo e 23 de plugins. O painel web usa as mesmas ferramentas: o que uma pessoa faz no editor é uma chamada destas.

Convenções: erros vêm em português dizendo o conserto; argumentos desconhecidos são recusados com a lista dos aceitos; ferramentas que escrevem entram num passo de desfazer; alterações respeitam bloqueios por camada quando duas pessoas/agentes trabalham juntos.

## Núcleo

### Camadas, layout e propriedades (22)

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `align_layers` | escreve | Alinha 1–100 camadas irmãs na página aberta. | ids, alignment |
| `distribute_layers` | escreve | Distribui 3–100 camadas irmãs com vãos iguais, mantendo extremos. | ids, axis |
| `group_layers` | escreve | Agrupa 2–100 camadas irmãs consecutivas na página aberta, preservando posição e ordem visual. | ids, name |
| `ungroup_layers` | escreve | Desagrupa 1–100 grupos ou seções irmãos, preservando posição. | ids |
| `reorder_layer` | escreve | Move uma camada ao índice exato entre suas irmãs na página aberta. | id, index |
| `set_guides` | escreve | Define as GUIAS de régua de uma página (page_id; padrão: a aberta): a lista completa [{axis, pos}], até 200. | page_id, guides |
| `move_layers` | escreve | Move 1–100 camadas de uma vez, tudo ou nada e com UM desfazer: cada item pode mudar de pai (parent_id, ou "root"), de posição entre as irmãs (index) e de posição dentro do pai (x, y; sem efeito em itens de auto layout). | moves |
| `arrange_layers` | escreve | Faz com 1–100 camadas o que o editor faz no botão direito. | ids, action |
| `edit_boolean_source` | escreve | Edita uma fonte de uma booleana sem destruir a operação. | id, source_index, dx, dy, scale, contour_index, point_index, x, y, hin_x, hin_y, hout_x, hout_y, clear_hin, clear_hout, mode |
| `paste_layers` | escreve | Copia 1–100 camadas (com tudo que há dentro) e cola a cópia: em parent_id (um frame) ou, sem parent_id, ao lado do original, no mesmo pai, com deslocamento de 16 px. | ids, parent_id |
| `set_layer_css` | escreve | Aplica CSS escrito à mão numa camada: o que o painel Design entende vira campo do modelo (cor, tamanho, raio, sombra, fonte…) e o resto vai para o CSS livre da camada (customCss), que vem por último. | id, css |
| `update_layer` | escreve | Altera propriedades de uma camada. | id, props |
| `update_layers` | escreve | Altera de 1 a 100 camadas em UMA operação: updates:[{id,props},...], com propriedades iguais ou diferentes por camada. | updates |
| `create_layer` | escreve | Cria uma camada nova. | type, parent_id, index, props |
| `delete_layers` | escreve | Apaga camadas (e o que estiver dentro delas). | ids |
| `move_layer` | escreve | Muda a camada de lugar na árvore: para dentro de outro frame/grupo (parent_id) e/ou para outra posição entre os irmãos (index). | id, parent_id, index |
| `build_layout` | escreve | Cria uma ESTRUTURA INTEIRA de uma vez (uma tela, uma seção, um card com tudo dentro): uma árvore de camadas aninhadas, com UMA permissão e UM passo do Ctrl+Z. | parent_id, index, tree |
| `shape_builder` | escreve | Cria uma nova forma a partir de regiões das formas selecionadas. | ids, points, mode |
| `set_responsive` | escreve | Ajusta uma camada SÓ num breakpoint do projeto (padrão: "tablet" ≤1024px e "mobile" ≤640px; o projeto pode ter outros, veja get_document → breakpoints): vira @media no CSS. | id, breakpoint, props, reset |
| `set_state` | escreve | Define como a camada fica no :hover, :active (pressionado) ou :focus-visible (foco do teclado) — vira .classe:hover no CSS, com a transição da camada. | id, state, props, reset |
| `duplicate_layers` | escreve | Duplica camadas (com tudo dentro). | ids |
| `add_interaction` | escreve | Protótipo: ao clicar na camada, "navigate" vai para outra tela (target_id), "back" volta, "url" abre um site. | id, action, target_id, url, transition |

### Exportar (3)

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `export_html` | lê | HTML de uma tela independente. | id, offset, maxBytes |
| `export_site` | lê | Lista os arquivos HTML estáticos de todas as pranchetas visíveis. | includeContent, path, maxBytes, offset, format |
| `export_zip` | lê | Grava o projeto e devolve o endereço para baixar o SITE inteiro em .zip (HTML estruturado, uma página por prancheta visível, pronto para publicar) e o do projeto em .json (para importar em outro Stylo). | — |

### Identidade, estilos e tokens (16)

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `list_design_resources` | lê | Lista estilos de cor/texto/sombra/gradiente, variáveis e modos do projeto, com IDs, resumo e número de vínculos (inclui overrides e snapshots de componentes). | kind, query, limit, offset, maxBytes |
| `update_design_resource` | escreve | Atualiza um recurso existente sem trocar seu ID, em um passo de desfazer. | kind, id, changes |
| `delete_design_resource` | escreve | Remove recurso existente. | kind, id, detach |
| `paste_style` | escreve | Copia a APARÊNCIA de source_id (preenchimento, contorno, cantos, sombras, blur, opacidade, mesclagem, filtros de cor e, se for texto, a tipografia) para 1–100 camadas ids. | source_id, ids |
| `create_color_styles` | escreve | Cria estilos de cor do projeto (a paleta: viram variáveis de CSS, ex.: --cor-primaria). | colors |
| `create_effect_styles` | escreve | Cria ESTILOS DE SOMBRA do projeto (ex.: "Card", "Elevado"): uma ou mais sombras cada. | styles |
| `create_gradient_styles` | escreve | Cria ESTILOS DE GRADIENTE do projeto (ex.: "Marca"): type linear/radial/conic, angle em graus (linear/conic) e stops [{color, pos 0..100, opacity}]. | styles |
| `create_text_styles` | escreve | Cria ESTILOS DE TEXTO do projeto (ex.: Título, Corpo, Legenda): fonte, tamanho, peso, altura de linha, espaçamento. | styles |
| `apply_text_style` | escreve | Liga camadas de TEXTO a um estilo de texto (create_text_styles): elas passam a seguir o estilo. | ids, style_id |
| `add_color_mode` | escreve | Cria um MODO de cor (ex.: "Escuro"). | name, scheme, auto |
| `set_style_color` | escreve | Muda a cor de um ESTILO de cor, no valor padrão ou num modo (mode_id de add_color_mode / get_document colorModes). | style_id, color, mode_id, opacity |
| `create_size_variables` | escreve | Cria VARIÁVEIS DE TAMANHO (px) reutilizáveis: espaçamentos, raios, tamanhos de fonte (viram --nome no CSS). | variables |
| `bind_variable` | escreve | Liga um campo de camadas a uma variável de tamanho: gap e padding (frames com layout), radius, fontSize (texto). | ids, prop, variable_id |
| `export_tokens` | lê | Exporta os TOKENS do design (cores com modos, estilos de texto, variáveis de tamanho) para quem vai programar: "css" (variáveis :root, modos por data-theme/prefers-color-scheme e classes .texto-*), "json" (tokens neutros) ou "tailwind" (tailwind.config.js + to | format |
| `create_component` | escreve | Transforma uma camada em COMPONENTE principal (as cópias, criadas com create_instance, mudam junto quando o principal muda). | id |
| `create_instance` | escreve | Cria uma cópia ligada (instância) de um componente, dentro de um frame (na posição index) ou na página. | component_id, parent_id, index, props |

### Imagens, assets, fontes e ícones (8)

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `list_assets` | lê | Lista as imagens já importadas neste projeto, com id, nome derivado da camada, formato, tamanho aproximado e camadas que as usam. | query |
| `add_asset` | escreve | ENVIA uma imagem para o projeto (PNG, JPEG, GIF, WebP ou SVG, até 16 MB) e devolve o asset_id, o tamanho e o formato. | name, data_base64, data_url, source_url, insert, parent_id, at |
| `insert_asset` | escreve | Insere no canvas uma imagem já existente no projeto, reutilizando o asset sem duplicar o arquivo. | id, name, parent_id, index, at |
| `search_icons` | lê | Procura ícones do Google (Material Symbols) pelo nome em inglês ou por um sinônimo em português. | query, limit |
| `insert_icon` | escreve | Insere um ícone do Google (Material Symbols) como vetor editável, dentro de um frame (na posição index) ou na página. | name, collection, parent_id, index, color, size, style, filled |
| `list_fonts` | lê | Lista fontes disponíveis (Google Fonts, carregadas sozinhas, e as do sistema) com os pesos de cada uma. | query, category |
| `edit_image` | escreve | EDITA A FOTO de uma camada com imagem (preenchimento de imagem), sem IA externa e sem chave. | id, rotate, flip_h, flip_v, crop, ratio, remove_background, background_tolerance, filter, adjust, max_width, format, quality, restore_original |
| `generate_image_edit` | escreve | Edição GENERATIVA: não está disponível pelo MCP do servidor atual. | id, mode, prompt, area, expand |

### Projeto, páginas, notas e colaboração (24)

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `rename_page` | escreve | Renomeia uma página existente, sem trocar a página aberta. | id, name |
| `reorder_page` | escreve | Move uma página ao índice exato na lista, sem trocar a página aberta. | id, index |
| `manage_comment` | escreve | Mexe num comentário existente (veja get_comments para os ids): action "reply" responde (text), "edit" troca o texto do comentário (ou de uma resposta, com reply_id), "resolve" marca como resolvido, "reopen" reabre, "delete" apaga (com as respostas). | comment_id, action, text, reply_id |
| `get_comments` | lê | Lê as anotações do projeto, incluindo respostas, autor, estado e camada/página associadas. | id, page_id, unresolved_only |
| `get_project_css` | lê | Lê a folha CSS global do projeto antes de revisá-la ou substituí-la com set_project_css. | — |
| `create_page` | escreve | Cria uma página nova no projeto (as abas de página do painel esquerdo) e abre ela. | name |
| `set_project_css` | escreve | Substitui o CSS global do projeto, incluindo seletores, @media, estados, @keyframes e efeitos CSS 3D. | css |
| `switch_page` | lê | Abre outra página do projeto (ids em get_document → pages). | id |
| `add_comment` | escreve | Deixa um comentário numa camada (aparece como pino no canvas e na aba Comentários). | id, text, rx, ry |
| `delete_page` | escreve | Apaga uma página do projeto (não dá para apagar a última). | id |
| `redo` | escreve | Refaz o que foi desfeito (Ctrl+Shift+Z). | — |
| `list_projects` | lê | Lista os projetos salvos na pasta do servidor (arquivo, data, tamanho) e diz qual está aberto nesta sessão. | — |
| `open_project` | escreve | Abre um projeto da pasta como o projeto desta sessão (use list_projects). | file |
| `save_project` | escreve | Grava o projeto aberto na pasta (o servidor também grava sozinho depois de cada alteração). | name |
| `new_project` | escreve | Cria um projeto novo em branco (com o nome dado) na pasta e o abre nesta sessão. | name |
| `add_note` | escreve | Grava uma nota no projeto (ou numa camada). | text, kind, layer_id, reply_to |
| `list_notes` | lê | Lista as notas do projeto, da mais antiga à mais nova, com autor (pessoa ou agente) e se foram resolvidas. | layer_id, kind, include_resolved, limit |
| `resolve_note` | escreve | Marca uma nota como resolvida (ou volta a abri-la com resolved:false). | id, resolved |
| `get_activity` | lê | O que foi feito no projeto: as últimas alterações, com quem fez (pessoa ou agente), a ferramenta e as camadas. | limit, agent |
| `who_is_here` | lê | Quem está no servidor agora: pessoas com o editor aberto, agentes conectados, o que cada agente fez por último e quais camadas estão reservadas. | — |
| `list_members` | lê | Lista quem tem acesso ao projeto aberto (dono, editores, leitores). | — |
| `share_project` | escreve | Compartilha o projeto aberto com uma pessoa que já tem conta (só o dono). | email, role |
| `unshare_project` | escreve | Tira o acesso de uma pessoa ao projeto aberto (só o dono). | email |
| `undo` | escreve | Desfaz a última alteração do projeto (o mesmo que Ctrl+Z). | — |

### Ver, medir e conferir (9)

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `get_document` | lê | Resumo do projeto aberto no editor: páginas, árvore de camadas da página atual (id, nome, tipo, etiqueta HTML, tamanho, layout e notas curtas), seleção, estilos de cor/texto e variáveis. | depth |
| `get_layer` | lê | Todos os dados de UMA camada (posição, tamanho, preenchimento, layout, texto, etiqueta...) e a lista dos filhos diretos. | id |
| `get_code` | lê | O HTML e o CSS que a camada gera (o mesmo da aba Código e da exportação). | id |
| `find_layers` | lê | Procura camadas por nome/texto, tipo e propriedades base. | query, type, page_id, within_id, where, limit, offset, fields, maxBytes |
| `get_selection` | lê | As camadas que a pessoa selecionou agora no editor (resumo de cada uma). | — |
| `select_layers` | lê | Seleciona camadas no editor (para mostrar à pessoa do que você está falando). | ids |
| `inspect_layout` | lê | Inspeciona medidas reais em TEXTO para agentes sem imagens, usando Chromium isolado. | id, breakpoint, width, within_id, depth, limit, offset, maxBytes |
| `check_design` | lê | Relatório paginado: padrão20/8KiB, limit até60, offset:nextOffset enquanto hasMore, totais completos. | id, breakpoints, checks, limit, offset, maxBytes, maxTargets |
| `get_image` | lê | VÊ o design: devolve um PNG da camada (ou da tela inteira). | id, scale, breakpoint |

### Vetores e SVG (15)

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `audit_vector` | lê | Audita vetores da página ou de uma camada: caminhos vazios/degenerados, pontos e alças inválidos, viewBox incoerente, contornos abertos com preenchimento, booleanas sem fontes, vetores invisíveis e filtros pesados. | id, includeInvisible, maxIssues |
| `inspect_vector` | lê | Inspeciona um vetor sem converter para SVG: devolve viewBox, fechamento, regra de preenchimento, contornos e nós com índices estáveis, coordenadas e alças hin/hout. | id, contour_index, node_index, max_points, maxBytes |
| `edit_vector_node` | escreve | Edita um nó específico de um vetor em uma única operação de undo, preservando o ID, os demais nós, contornos e alças. | id, contour_index, node_index, point, hin, hout, mode |
| `create_vector_network` | escreve | Cria uma rede vetorial editável com junções estáveis e segmentos de linha ou Bézier. | name, parent_id, index, nodes, segments, fill, stroke |
| `edit_vector_shape` | escreve | Altera os parâmetros de um polígono ou estrela paramétrico sem substituir o SVG: sides (3–24) e inner_ratio (0–1, usado na estrela) são regenerados de forma determinística e viram um único passo de undo. | id, sides, inner_ratio |
| `set_path_effect` | escreve | Aplica ou remove o efeito vetorial não destrutivo de cantos arredondados. | id, kind, radius |
| `interpolate_vectors` | escreve | Cria um novo vetor entre dois paths compatíveis, interpolando posição, tamanho, nós e alças Bézier. | from_id, to_id, t, name |
| `reverse_vector` | escreve | Inverte a direção dos segmentos de um vetor sem trocar sua identidade, preservando curvas ao trocar as alças hin/hout. | id, contour_index |
| `split_vector_contour` | escreve | Divide um contorno em dois caminhos abertos no node_index, duplicando o nó de corte e preservando a geometria. | id, contour_index, node_index |
| `simplify_vector` | escreve | Reduz nós redundantes de contornos retos e Bézier (abertos ou fechados) com Ramer–Douglas–Peucker seguido de ajuste cúbico, preservando o ID, as alças editáveis e uma operação de undo. | id, contour_index, tolerance |
| `join_vector_contours` | escreve | Une o contorno principal e os subcontornos de um vetor path em um único caminho aberto, preservando nós e alças, o ID e uma operação de undo. | id |
| `stroke_to_path` | escreve | Converte strokes centrais em formas preenchidas editáveis, achatando curvas com tolerance e preservando o ID em um único undo. | id, tolerance |
| `offset_path` | escreve | Desloca contornos fechados de um vetor pela distância indicada, positiva para fora e negativa para dentro, preservando o ID e registrando um único undo. | id, distance, contour_index, tolerance |
| `audit_svg` | lê | Audita um SVG antes da importação: valida o documento, informa dimensões, tipos de camadas editáveis, quantidade convertida e recursos ignorados. | svg, name, current_color, fill, size |
| `import_svg` | escreve | Importa um SVG como vetor(es) editável(is), preservando caminhos, curvas, transformações, gradientes, textos simples e grupos suportados. | svg, name, parent_id, index, current_color, fill, size |

## Plugins

### Identidade visual (`identidade`)

Auxiliares que calculam paletas, contraste, harmonias e escalas. Não criam nada sozinhos.

Categoria: design · permissões: read

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `font_pairs` | lê | PARES DE FONTES do Google Fonts (título + texto corrido) que combinam, com o clima de cada um. | mood, limit |
| `get_project_brief` | lê | Lê o BRIEF do projeto aberto: o que ele é, para quem, o tom, os valores, o que evitar. | — |
| `set_project_brief` | escreve | Grava o BRIEF do projeto (fica no documento). | summary, audience, tone, values, goals, avoid, notes |
| `color_scale` | lê | Gera uma ESCALA de 11 degraus (50, 100, 200 ... | color |
| `color_contrast` | lê | Contraste WCAG 2.x entre duas cores: a razão (1 a 21) e o que ela atende (AA/AAA para texto normal e grande, e AA para componentes de interface). | foreground, background |
| `color_harmony` | lê | Cores que combinam com a dada, por esquema: complementary (oposta), analogous (vizinhas), triadic, split-complementary, tetradic ou monochromatic (claras e escuras da mesma cor). | color, scheme |
| `color_text_on` | lê | Qual cor de texto fica mais legível sobre um fundo: compara as candidatas (padrão: preto e branco) e devolve todas ordenadas pelo contraste, da melhor para a pior. | background, candidates |
| `design_scale` | lê | Calcula uma escala de design. | kind, base, ratio, steps_up, steps_down, color, opacity |

### Assets gratuitos e biblioteca (`assets`)

Busca em provedores gratuitos, biblioteca da conta, fontes e fontes de assets cadastradas por você.

Categoria: asset-provider · permissões: read, write

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `asset_providers` | lê | Lista os provedores de assets (fotos, vídeos, áudio, 3D, ícones, fontes), o que cada um entrega, a licença e se está pronto para uso nesta conta. | — |
| `search_assets` | lê | BUSCA assets gratuitos de uso comercial: image (fotos, ilustrações), video, audio, model3d (modelos .glb), font (catálogo do Google Fonts), icon (Material Symbols e Lucide). | kind, query, provider, page, orientation, category |
| `library_save` | escreve | Guarda na BIBLIOTECA DA CONTA um resultado de search_assets (pela `ref`). | ref, name, tags |
| `library_add` | escreve | Guarda na biblioteca da conta um arquivo SEU (não de um provedor): data_base64 ou source_url (https público, baixado pelo servidor com proteção contra redes internas). | name, data_base64, source_url, tags, license, credit |
| `library_list` | lê | Lista os assets da BIBLIOTECA DA CONTA (todos os agentes e projetos desta pessoa enxergam os mesmos): filtre por tipo, por nome/etiqueta. | kind, query, tag, limit |
| `library_remove` | escreve | Remove um asset da biblioteca da conta. | id |
| `library_use` | escreve | COPIA um asset da biblioteca para o PROJETO ABERTO (a partir daí ele faz parte do projeto, com o crédito registrado para o CREDITS.txt do site exportado). | id, insert, name, parent_id, at |
| `add_font` | escreve | ADICIONA UMA FONTE DO GOOGLE FONTS ao projeto aberto, HOSPEDADA no próprio projeto (os arquivos .woff2 vão para dentro dele e para o zip exportado, com @font-face pronto; nada de CDN do Google). | id, weights, styles, subsets |
| `asset_source_add` | escreve | Cadastra, SEM código, uma fonte de assets da conta: o endereço de busca (https) com {consulta} (e {pagina}), cabeçalhos (ex.: Authorization), onde está a lista na resposta JSON (resultsPath, como "data.items") e onde está cada campo dentro de um item. | name, searchUrl, kinds, headers, resultsPath, fields, license |
| `asset_source_remove` | escreve | Remove uma fonte de assets cadastrada pela conta (pelo nome). | name |

### Acessibilidade (`acessibilidade`)

Audita contraste, tipografia, textos alternativos, títulos e alvos clicáveis.

Categoria: quality · permissões: read

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `accessibility_audit` | lê | Audita o projeto aberto por problemas de acessibilidade que podem ser detectados sem navegador: contraste, texto pequeno, alt ausente, títulos e alvos clicáveis pequenos. | page_id, include_warnings |

### Tailwind Export (`tailwind`)

Exporta tokens do projeto como tailwind.config.js e tokens.css.

Categoria: exporter · permissões: read

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `tailwind_export` | lê | Gera os arquivos tailwind.config.js e tokens.css com as cores, tamanhos, tipografia, sombras, gradientes e modos do projeto aberto. | — |

### SEO e Open Graph (`seo`)

Define metadata, descrição, canonical, favicon e Open Graph para a publicação.

Categoria: exporter · permissões: read, write

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `get_site_metadata` | lê | Lê metadata SEO/Open Graph do projeto aberto. | — |
| `set_site_metadata` | escreve | Define metadata da publicação: title, description, canonical HTTPS, image, favicon e idioma. | title, description, canonical, image, favicon, lang |

### QR Code (`qr`)

Gera QR Codes offline para URLs, textos e dados de integração.

Categoria: utility · permissões: read

| Ferramenta | Tipo | O que faz | Argumentos |
|---|---|---|---|
| `generate_qr_code` | lê | Gera um QR Code em SVG ou PNG a partir de texto ou URL, sem enviar o conteúdo para a rede. | value, format, size, margin, dark, light |
