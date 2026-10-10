# Identidade visual do Stylo, desenhada no próprio Stylo

Esta pasta é o resultado de pedir ao Stylo, **pelo servidor MCP dele**, que desenhe a própria identidade. Nada aqui foi feito num editor de imagens: o guia é um projeto do Stylo (`stylo-identidade.json`), montado por chamadas de ferramentas (`build_layout`, `create_color_styles`, `create_component`, `set_state`, `create_instance`) e conferido com `get_image` e `export_html`.

**Direção usada: paleta A (Âmbar) + símbolo B (colchete e três linhas).** É a recomendação de `docs/estado/MARCA.md`; ainda **não foi aplicada ao aplicativo** (cores, logo e ícone da aba continuam os de antes) porque a escolha final é sua. As outras duas paletas (B Mar, C Lima) estão em `docs/screenshots/identidade/marca-*.png`.

## Arquivos
| Arquivo | O que é |
|---|---|
| `stylo-identidade.json` | O projeto do Stylo. Para abrir: Arquivo → **Importar arquivo .json…**. Tem a página "Guia de estilo" (8 seções, ~420 camadas), 22 estilos de cor e o componente **Botão primário** com `:hover`, `:active` e `:focus-visible`. |
| `guia-de-estilo.html` | A exportação HTML do próprio Stylo (uma página independente, com as fontes do Google Fonts). |
| `guia-de-estilo.png` | Captura da página inteira do HTML acima (1280 px). |
| `secao-1.png` … `secao-8.png` | Uma captura por seção: capa, propósito e princípios, logotipo, cores, tipografia, formas e profundidade, ícones, componentes e estados. |
| `simbolo-escuro.svg`, `simbolo-claro.svg` | O símbolo avulso, para usar quando a marca for aplicada (`assets/logo-mark.svg` e o ícone da aba). Sem fundo; âmbar `#E9A23B` sobre fundo escuro e `#9A5B00` sobre claro. |

## O que o guia define
Propósito e quatro princípios (CSS de verdade, sóbrio e denso, um único acento, local e honesto); logotipo e área de respiro; paleta nomeada com a razão de contraste medida de cada par (todas passam AA); IBM Plex Sans para a interface e JetBrains Mono só para código, com a escala 11/12/13/15 px; raios 2/4/6 px, espaço em múltiplos de 4 e profundidade; ícones Material Symbols em contorno; componentes e estados.

## Como foi feito (e o que isso ensinou sobre o produto)
O uso real do MCP achou coisas que merecem virar melhoria (registradas em `docs/estado/PRODUTO.md`):
1. **Duas abas do editor conectadas ao mesmo servidor**: o MCP escolhe a aba "mais recente" e uma chamada minha caiu numa aba de outro projeto (desfeito na hora). Com mais de um editor conectado e nenhum escolhido, o servidor deveria **recusar escritas** até haver `select_editor`.
2. **`get_image` e o PNG usam fontes de reserva** (o SVG com `foreignObject` não carrega o Google Fonts): a prévia não bate com o canvas. Para a imagem fiel, use `export_html` e fotografe num navegador (foi o que se fez aqui).
3. **`build_layout` devolve só a raiz criada**, não os ids dos filhos: foi preciso `find_layers` para achar onde criar as instâncias.
4. O Stylo conseguiu produzir um guia coerente, com componente real e estados de CSS, só com a API de agente: a ferramenta cumpre o que promete.

## Como refazer
Com um servidor isolado no ar (`DESIGNER_CONFIG` temporário e `PORT=5173`), o editor aberto em `http://localhost:5173/?editor` e o "Acesso de administrador" ligado nesse servidor:
```bash
node scripts/identidade/cliente-mcp.mjs call new_project '{"name":"Identidade Stylo"}'
node scripts/identidade/cliente-mcp.mjs call create_color_styles @scripts/identidade/cores.json   # a paleta (20 estilos)
node scripts/identidade/cliente-mcp.mjs call create_page '{"name":"Guia de estilo"}'
node scripts/identidade/montar-guia.mjs tudo
node scripts/identidade/montar-componentes.mjs
node scripts/identidade/exportar-guia.mjs docs/identidade
```
Os scripts usam o `Mcp-Session-Id` guardado em um arquivo temporário e a aba escolhida com `select_editor`; confira com `list_editors` que só há **um** editor conectado antes de rodar.
