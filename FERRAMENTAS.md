# Ferramentas do Stylo — capacidades e próximos passos

Mapa em 2026-10-11. O foco é o **servidor e o MCP**; o editor legado está congelado.
São **80 ferramentas anunciadas**: 62 do núcleo, 8 de identidade e 10 de assets. Uma delas,
`generate_image_edit`, continua indisponível pelo MCP do servidor. Contagem não significa que todas
as integrações foram verificadas com serviços reais: veja as ressalvas de `PASSAGEM.md`.

Este mapa organiza as ações pelo objetivo de quem usa o Stylo. As mesmas operações podem servir,
no futuro, a interfaces, documentos e apresentações. A referência à ferramenta Canva é uma direção
de discussão; não aprova novos formatos de exportação nem mudanças no editor.

## 1. Entender e retomar o projeto

**Hoje:** `list_projects`, `open_project`, `new_project`, `save_project`, `get_document`,
`get_layer`, `find_layers`, `get_project_brief`, `set_project_brief`.

**Busca por propriedades implementada:** `find_layers` combina nome/texto, tipo, página/subárvore,
fonte/tamanho/peso, cor sólida, vínculos com estilos/imagens/componentes, tag, layout e flags.
O padrão entrega até 20 itens compactos, com orçamento de 8 KiB de JSON UTF-8; `fields:"ids"`
entrega só IDs para ajustes em lote. `limit` vai até 100; `maxBytes`, de 1024 a 65536.
Use `offset: nextOffset` enquanto `hasMore`; `total` conta todos os resultados e `count` os entregues.
Leia detalhes com `get_layer`; `fields:"summary"` pede o resumo com medidas. Compact/ids não medem.
Nomes longos são abreviados; IDs são preservados. Se uma linha não couber, recebe erro com orientação.

A busca compara propriedades base, sem resolver CSS, modos, estados ou breakpoints. Visibilidade e
trava são flags da própria camada, sem herança dos pais. Recomece a paginação após alterar o projeto
ou os filtros. O orçamento inclui avisos do workspace e o JSON formatado, mas não o envelope MCP;
é um limite de bytes, não uma medição de tokens/cobrança.

## 2. Montar e organizar

**Hoje:** `create_layer`, `build_layout`, `move_layer`, `delete_layers`, `duplicate_layers`,
`create_page`, `switch_page`, `delete_page`, `select_layers`, `get_selection`.

**Melhorar:** expor alinhamento, distribuição e agrupamento já existentes na base; ordenar e
renomear páginas de forma explícita. Avaliar controles reais de formulário: texto, seleção e checkbox.
Uma caixa com aparência de campo ainda não é um controle funcional.

## 3. Ajustar e revisar alterações

**Hoje:** `update_layer`, `update_layers`, `set_responsive`, `get_project_css`, `set_project_css`, `undo`, `redo`.

**Lote implementado:** `update_layers {updates:[{id,props},...]}` aceita de 1 a 100 itens com IDs únicos.
Prepara alterações em cópias compartilhadas de pais/filhos e valida tudo antes da escrita; revalida
após aguardar aprovação. Um passo de desfazer/refazer. Mantém a identidade dos nós vivos e registra
todos os IDs no log. Lotes com tamanho/modo de layout reservam o documento; outros reservam os IDs.
Não cria/move/apaga camadas nem altera breakpoints/estados; as ferramentas específicas continuam existindo.

**Melhorar:** facilitar ajustes repetidos sem substituir a folha CSS inteira.
Não é preciso criar uma ferramenta para cada propriedade: `update_layer` já renomeia uma camada.

## 4. Definir a identidade

**Hoje:** `create_color_styles`, `create_effect_styles`, `create_gradient_styles`,
`create_text_styles`, `apply_text_style`, `add_color_mode`, `set_style_color`,
`create_size_variables`, `bind_variable`, `font_pairs`, `color_scale`, `color_contrast`,
`color_harmony`, `color_text_on`, `design_scale`.

**Melhorar:** editar, renomear e remover estilos/modos/variáveis com tratamento dos vínculos;
mostrar onde cada estilo é usado; obter uma paleta de uma imagem. Os auxiliares calculam e sugerem,
sem criar uma identidade automaticamente.

## 5. Reutilizar componentes

**Hoje:** `create_component`, `create_instance`.

**Melhorar:** expor pelo MCP a separação de uma cópia do principal (`detachInstance` já existe
no núcleo); organizar variações e esclarecer os ajustes próprios de cada cópia.

## 6. Experimentar interações

**Hoje:** `set_state`, `add_interaction`.

**Melhorar:** discutir abertura de menu/janela, troca de abas e estados de carregamento/erro/sucesso.
Isso é uma proposta de alcance do protótipo; JavaScript de projeto continua sujeito à D11.
Interações de protótipo não são automaticamente funcionalidade do aplicativo exportado.

## 7. Trabalhar com arquivos, fotos e mídia

**Hoje:** `list_assets`, `add_asset`, `insert_asset`, `search_icons`, `insert_icon`, `list_fonts`,
`asset_providers`, `search_assets`, `library_save`, `library_add`, `library_list`, `library_remove`,
`library_use`, `add_font`, `asset_source_add`, `asset_source_remove`, `edit_image`.

**Anunciada, mas indisponível no servidor:** `generate_image_edit` (D13 permanece aberta).

**Edição local implementada:** giro/espelhamento, recorte/proporção, filtros, ajustes, remoção de
fundo simples pelas bordas, redução e PNG/WebP/JPEG. Chromium isolado, sem IA externa ou chave;
a primeira original fica guardada, restaurável e com desfazer/refazer. GIF vira imagem estática;
SVG é rasterizado. Remoção de fundo sempre sai em PNG transparente.

**Limites:** arquivo até 16 MiB, lado até 8192 px, entrada até 16 milhões de pixels. Efeitos por
pixel até 4 milhões de pixels após o recorte; para fotos maiores, reduzir primeiro com `max_width`
em outra chamada. Uma edição por vez, até quatro pedidos contando o que executa; o excesso recebe aviso para tentar depois.

**Melhorar:** paleta de imagem, prévias de vídeo/3D/Lottie, mídia grande fora do documento e
verificação real dos provedores pendentes. Remoção de fundo simples não é recorte inteligente de objetos.

## 8. Ver e conferir

**Hoje:** `get_image`, `get_code`, `check_design`.

**Melhorar:** medidas por largura em `get_layer`; auditoria de teclado/foco, consistência de
estilos e área de toque no celular. Imagens estáticas não verificam reprodução de mídia ou interações.

## 9. Exportar e entregar

**Hoje:** `export_html`, `export_site`, `export_zip`, `export_tokens`.

**Melhorar:** testes automatizados das rotas ZIP, entrega de licenças de fontes/players e
verificação de estados/animações no React exportado.

**Propostas para decisão da pessoa dona (D9):** exportação de imagens, PDF e apresentações.
Recomendação técnica para a discussão: PDF antes de PowerPoint editável, pois este exige transformar
o desenho em elementos editáveis de outro formato. Nenhum desses novos formatos foi implementado.

## 10. Colaborar e guardar contexto

**Hoje:** `add_comment`, `get_comments`, `add_note`, `list_notes`, `resolve_note`, `get_activity`,
`who_is_here`, `list_members`, `share_project`, `unshare_project`.

**Melhorar:** expor respostas/resolução de comentários de camada pelo MCP, retomar pendências
e evoluir colaboração sem perder alterações. Hospedagem, privacidade e políticas de acesso seguem
as decisões da pessoa dona em `PASSAGEM.md`.

## Ordem de trabalho recomendada

1. Edição local de fotos no servidor e correção das instruções antigas dos agentes — implementadas neste bloco.
2. Ajustes em lote e busca por propriedades com respostas limitadas — implementados.
3. Completar manutenção dos estilos e ações de componentes já existentes no núcleo.
4. Melhorar controles, inspeção e testes de entrega a partir de telas reais montadas pelo MCP.
5. Avaliar PDF/apresentações quando a pessoa dona fechar os novos formatos. Editor, licença e decisões de negócio não entram por autorização implícita.

As propostas acima são um roteiro revisável, não promessa de suporte já existente.
Resultados de testes e uso real ficam em `PASSAGEM.md` e no fim de `decisoes.md`.
