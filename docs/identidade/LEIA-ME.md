# Identidade visual do Stylo, desenhada no próprio Stylo

Esta pasta é o resultado de pedir ao Stylo, **pelo servidor MCP dele**, que desenhe a própria identidade. Nada aqui foi feito num editor de imagens: o guia é um projeto do Stylo (`stylo-identidade.json`), montado por chamadas de ferramentas (`build_layout`, `create_color_styles`, `create_component`, `set_state`, `create_instance`) e conferido com `get_image` e `export_html`.

**Direção usada: paleta A (Âmbar) + símbolo B (colchete e três linhas).** É a recomendação de `docs/estado/MARCA.md`; ainda **não foi aplicada ao aplicativo** (cores, logo e ícone da aba continuam os de antes) porque a escolha final é sua. As outras duas paletas (B Mar, C Lima) estão em `docs/screenshots/identidade/marca-*.png`.

## Arquivos
| Arquivo | O que é |
|---|---|
| `stylo-identidade.json` | O projeto do Stylo (1 MB). Para abrir: Arquivo → **Importar arquivo .json…**. 7 páginas: o Guia de estilo (8 seções) mais as 6 explorações abaixo; 22 estilos de cor, o componente **Botão primário** com `:hover`, `:active` e `:focus-visible`, 25 notas e 10 comentários. |
| `guia-de-estilo.html` | A exportação HTML do próprio Stylo (uma página independente, com as fontes do Google Fonts). |
| `guia-de-estilo.png` | Captura da página inteira do HTML acima (1280 px). |
| `secao-1.png` … `secao-8.png` | Uma captura por seção: capa, propósito e princípios, logotipo, cores, tipografia, formas e profundidade, ícones, componentes e estados. |
| `simbolo-escuro.svg`, `simbolo-claro.svg` | O símbolo avulso, para usar quando a marca for aplicada (`assets/logo-mark.svg` e o ícone da aba). Sem fundo; âmbar `#E9A23B` sobre fundo escuro e `#9A5B00` sobre claro. |

## O que o guia define
Propósito e quatro princípios (CSS de verdade, sóbrio e denso, um único acento, local e honesto); logotipo e área de respiro; paleta nomeada com a razão de contraste medida de cada par (todas passam AA); IBM Plex Sans para a interface e JetBrains Mono só para código, com a escala 11/12/13/15 px; raios 2/4/6 px, espaço em múltiplos de 4 e profundidade; ícones Material Symbols em contorno; componentes e estados.

## Explorações (7 páginas no projeto, imagens em `exploracoes/`)
Tudo abaixo está no `stylo-identidade.json` com **notas** nas camadas (o porquê de cada peça) e **comentários** onde há dúvida para você responder (aba Comentários do editor; eu leio com `get_comments`).
| Página | O que tem | Imagem |
|---|---|---|
| Ícones (caneta) | 8 ícones próprios desenhados com **vetores de Bézier** (tipo `path`, criado nesta etapa para o agente): camadas, regra CSS, breakpoints, componente, exportar, agente, nota, comentário. Três tamanhos de teste cada. | `exploracoes/icones.png` |
| Logo — exploração | 4 conceitos de símbolo, todos com a caneta: A camadas, B colchete e linhas (recomendado), C S de blocos, D fio contínuo. Testes em 128, 48, 24 e 16 px. | `exploracoes/logos.png` |
| Home — versão 1 (lista) | Tela inicial densa: lateral com navegação, pasta e estado do agente; faixa "Continuar"; tabela com `:hover` real; mais o estado de **primeiro uso**. | `home-v1-lista.png`, `home-v1-primeiro-uso.png` |
| Home — versão 2 (galeria) | Miniaturas, destaque do último projeto, atividade do agente e "Aprender fazendo". **Responsiva**: 4 colunas, 2 no tablet, 1 no celular, sem rolagem horizontal. | `home-v2-galeria-1440.png`, `-768.png`, `-390.png` |
| Conversa com o agente | O "chatzinho": aba Conversa com presença, respostas rápidas, pedido de permissão como cartão e `@camada`. É uma **proposta de design**; ainda não existe no produto. | `conversa-com-o-agente.png` |
| Brief e crítica da Home | O brief no formato da skill de design, com as decisões em aberto como SUPOSIÇÃO e a crítica das duas versões (recomenda V1 com alternador). | `brief-e-critica.png` |

Os arquivos `.html` ao lado de cada imagem são a exportação do próprio Stylo.

## Perguntas que ficaram nos comentários
Hoje: lista ou galeria como padrão da Home; mostrar a atividade do agente na Home; primeiro uso abre o exemplo ou um projeto em branco; trocar os ícones do app pelos novos; qual símbolo (A, B, C ou D); se devo começar a aba Conversa (primeiro passo: `get_messages` e `send_message` sobre os comentários que já existem).

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
