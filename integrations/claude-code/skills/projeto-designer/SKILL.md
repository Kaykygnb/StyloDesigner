---
name: projeto-designer
description: Desenhar, revisar e ajustar interfaces no Projeto Designer (o editor em que o canvas é CSS de verdade) pelo MCP "projeto-designer". Use quando a pessoa pedir para criar ou mudar uma página, tela, seção, componente, estilo, responsivo ou protótipo no editor, ou para revisar o HTML/CSS de um design.
---

# Projeto Designer pelo MCP

Você controla o **editor aberto no navegador** da pessoa pelas ferramentas do MCP `projeto-designer`. Cada camada é HTML/CSS de verdade: frames com layout viram `display: flex`/`grid`, e o que aparece no editor é o que vai para o código exportado. As instruções completas da ferramenta (regras de layout, habilidades de design, receita de página) chegam junto com o MCP; siga-as.

## Antes de começar

- O editor precisa estar aberto: `npm start` na pasta do projeto e http://localhost:5173 no navegador. Se uma ferramenta responder "O editor não está aberto", diga isso à pessoa em uma frase e pare.
- Sem o **Acesso de administrador** (Configurações → Assistente de IA e MCP), cada alteração abre uma janela de permissão no editor e espera a pessoa. Se ela recusar, não insista.

## Como trabalhar (ciclo curto)

1. **Entenda o estado**: `get_document` (páginas, árvore, paleta). Se a pessoa disse "isto", use `get_selection`.
2. **Construa em blocos grandes**: para criar, use `build_layout` com a estrutura inteira (uma página, uma seção) numa chamada. Para ajustes, `update_layer`. Não crie camada por camada.
3. **Veja o resultado**: chame `get_image` na tela que você criou ou mudou e olhe de verdade (alinhamento, espaçamento, contraste, hierarquia). Corrija o que estiver feio com `update_layer`.
4. **Responsivo**: depois do Desktop pronto, ajuste o Celular com `set_responsive` (grids viram 1 coluna, `row` vira `column`, títulos menores, padding menor).
5. **Termine curto**: 2 ou 3 frases dizendo o que ficou pronto.

## Ferramentas por tarefa

| Tarefa | Ferramentas |
|---|---|
| Ver / ler | `get_document`, `get_selection`, `get_layer`, `find_layers`, `get_image`, `get_code`, `export_html` |
| Criar | `build_layout` (principal), `create_layer`, `insert_icon` + `search_icons`, `duplicate_layers` |
| Estilo | `update_layer`, `create_color_styles` (paleta → variáveis de CSS), `list_fonts`, `set_state` (hover/foco) |
| Responsivo | `set_responsive` (`tablet` ≤ 1024px, `mobile` ≤ 640px) |
| Reaproveitar | `create_component`, `create_instance` |
| Protótipo e revisão | `add_interaction`, `add_comment` |
| Estrutura | `move_layer`, `delete_layers`, `create_page`, `switch_page`, `delete_page`, `undo`, `redo` |
| Projetos (só com acesso de administrador) | `list_projects`, `open_project`, `save_project`, `new_project` |

## Armadilhas da plataforma

- Dentro de frame com layout, `x`/`y` não valem: use ordem, `gap`, `padding`, `justify`, `align`. Para tirar do fluxo: `absolute: true`.
- Texto que deve quebrar linha: `sizeX: "fill"` (coluna à esquerda) ou `sizeX: "hug"` + `maxW` (coluna centralizada).
- Um `h1` por página; `li` só direto dentro de `ul`/`ol`; link (`a`) ou botão nunca dentro de outro.
- A imagem de `get_image` usa fontes do sistema no lugar das do Google e pode não mostrar o efeito vidro: o editor e o HTML exportado estão certos.
- Trocar de projeto (`open_project`/`new_project`) é recusado se o projeto aberto só existe no navegador: salve antes com `save_project`.
