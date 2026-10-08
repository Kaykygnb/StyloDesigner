/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  agent/schema.js — AS FERRAMENTAS QUE UMA IA PODE USAR NO EDITOR (lista única, sem DOM)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Uma IA (o agente interno, com a sua chave da OpenAI, ou um programa externo via MCP, como o Claude Code)
 *  não mexe no projeto "por fora": ela pede para usar uma destas ferramentas, e quem executa é o EDITOR aberto
 *  (agent/runner.js), com os mesmos comandos que você usa clicando. Assim:
 *    - o canvas e os painéis atualizam na hora, e cada alteração é UM passo do Ctrl+Z;
 *    - toda alteração passa pela sua permissão antes (veja runner.js → approve);
 *    - o servidor MCP (server.js) e o agente interno usam EXATAMENTE a mesma lista: o que um faz, o outro faz.
 *
 *  Este arquivo é só dados (nome, descrição e parâmetros em JSON Schema, o formato que a OpenAI e o MCP usam),
 *  por isso o servidor (Node) e o navegador importam o mesmo arquivo.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Propriedades que as ferramentas de criar/alterar aceitam (o resto é recusado com uma mensagem clara). */
export const PROP_HELP = `Propriedades aceitas (nomes do modelo do editor; o CSS gerado está entre parênteses):
- geral: name, x, y, w, h (px), rotation (graus), opacity (0..1), visible, locked, blend (mix-blend-mode), note (nota da camada)
- tamanho: sizeX/sizeY: "fixed" | "hug" (do tamanho do conteúdo) | "fill" (preenche o pai em flex/grid); minW, maxW, minH, maxH (px); aspect (largura/altura, aspect-ratio)
- aparência: fill: "#RRGGBB" | "none" | {styleId: "id de um estilo de cor"} (liga ao estilo: vira var(--cor) no CSS) | objeto {type:"solid"|"linear"|"radial", color, opacity, angle, stops:[{color, opacity, pos}]}; stroke: null | "#RRGGBB" | {color, width, style, position}; radius: número ou [tl,tr,br,bl] (border-radius); shadows: [{x,y,blur,spread,color,opacity,inset}] (box-shadow); blur, bgBlur (filter/backdrop-filter, px); clip (overflow: hidden, só frame)
- layout de um FRAME: layout: {mode:"none"|"row"|"column"|"grid", gap, padding: número ou [t,r,b,l], justify:"flex-start"|"center"|"flex-end"|"space-between"|"space-around"|"space-evenly"|"stretch", align:"flex-start"|"center"|"flex-end"|"stretch"|"baseline", wrap, cols, rows, colGap, rowGap}
- item dentro de flex/grid: absolute (sai do fluxo: position absolute), alignSelf, justifySelf, grow (flex-grow), margin: número ou [t,r,b,l], colSpan, rowSpan
- texto: text, fontFamily, fontSize, fontWeight, fontStyle, lineHeight (multiplicador, ex.: 1.4), letterSpacing (px), textAlign, textDecoration, textTransform, truncate ("ellipsis"|"clamp"), lines
- HTML: tag (etiqueta: p, h1..h6, span, a, button, label, li para texto; div, section, header, footer, nav, main, aside, article, ul, ol, li, button, a, form para caixas), href (link), alt (descrição para leitor de tela)`;

/**
 * As ferramentas. `write: true` = altera o projeto (pede permissão e vira um passo do Ctrl+Z).
 * `inputSchema` segue JSON Schema (MCP chama assim; a OpenAI chama de `parameters`).
 */
export const AGENT_TOOLS = [
  {
    name: 'get_document',
    write: false,
    description: 'Resumo do projeto aberto no editor: páginas, a árvore de camadas da página atual (id, nome, tipo, etiqueta HTML, tamanho, layout), a seleção, os estilos de cor/texto e as variáveis. Comece por aqui.',
    inputSchema: {
      type: 'object',
      properties: { depth: { type: 'integer', description: 'Quantos níveis da árvore mostrar (padrão 3, máximo 8).' } },
    },
  },
  {
    name: 'get_layer',
    write: false,
    description: 'Todos os dados de UMA camada (posição, tamanho, preenchimento, layout, texto, etiqueta...) e a lista dos filhos diretos.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id da camada' } }, required: ['id'] },
  },
  {
    name: 'get_code',
    write: false,
    description: 'O HTML e o CSS que a camada gera (o mesmo da aba Código e da exportação). Use para revisar o código.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id da camada' } }, required: ['id'] },
  },
  {
    name: 'find_layers',
    write: false,
    description: 'Procura camadas em todas as páginas pelo nome ou texto (sem diferenciar maiúsculas) e/ou pelo tipo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'parte do nome ou do texto' },
        type: { type: 'string', enum: ['frame', 'rect', 'ellipse', 'text', 'group', 'line', 'path', 'section'] },
      },
    },
  },
  {
    name: 'get_selection',
    write: false,
    description: 'As camadas que a pessoa selecionou agora no editor (resumo de cada uma). Útil quando ela diz "isto aqui".',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'select_layers',
    write: false,
    description: 'Seleciona camadas no editor (para mostrar à pessoa do que você está falando). Não altera o projeto.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] },
  },
  {
    name: 'update_layer',
    write: true,
    description: `Altera propriedades de uma camada. Mande só o que muda. Objetos (fill, stroke, layout) são mesclados com o valor atual.\n${PROP_HELP}`,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id da camada' },
        props: { type: 'object', description: 'propriedades a mudar (veja a lista na descrição)', additionalProperties: true },
      },
      required: ['id', 'props'],
    },
  },
  {
    name: 'create_layer',
    write: true,
    description: `Cria uma camada nova. Sem parent_id, vai para a raiz da página (vira uma tela, se for frame). Dentro de um frame com layout, entra na posição "index" (padrão: no fim).\n${PROP_HELP}`,
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['frame', 'rect', 'ellipse', 'text', 'line'] },
        parent_id: { type: 'string', description: 'id do frame/grupo pai (opcional)' },
        index: { type: 'integer', description: 'posição entre os irmãos (0 = primeiro / mais ao fundo)' },
        props: { type: 'object', additionalProperties: true },
      },
      required: ['type'],
    },
  },
  {
    name: 'delete_layers',
    write: true,
    description: 'Apaga camadas (e o que estiver dentro delas).',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] },
  },
  {
    name: 'move_layer',
    write: true,
    description: 'Muda a camada de lugar na árvore: para dentro de outro frame/grupo (parent_id) e/ou para outra posição entre os irmãos (index). parent_id "root" = raiz da página.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, parent_id: { type: 'string' }, index: { type: 'integer' } },
      required: ['id'],
    },
  },
  {
    name: 'build_layout',
    write: true,
    description: `Cria uma ESTRUTURA INTEIRA de uma vez (uma tela, uma seção, um card com tudo dentro): uma árvore de camadas aninhadas, com UMA permissão e UM passo do Ctrl+Z. Use para "faça uma página/seção/cabeçalho...". Sem parent_id, a árvore vira uma tela nova na página, posicionada ao lado das que já existem (não precisa selecionar nada).
Cada nó: {"type": "frame"|"rect"|"ellipse"|"text"|"line"|"icon", "props": {...}, "children": [...]}. Para "icon", props = {"name": "nome do Material Symbol (use search_icons)", "color": "#RRGGBB", "size": 24, "style": "outlined"|"rounded"|"sharp", "filled": false}.
Dica: tela de site = frame com props {"name":"Início","w":1440,"fluid":true,"sizeY":"hug","layout":{"mode":"column"}} e seções dentro com sizeX "fill".
${PROP_HELP}`,
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string', description: 'id do frame onde a árvore entra (opcional; sem ele, vira uma tela nova)' },
        index: { type: 'integer', description: 'posição entre os irmãos (padrão: no fim)' },
        tree: { type: 'object', description: 'o nó raiz: {type, props, children}', additionalProperties: true },
      },
      required: ['tree'],
    },
  },
  {
    name: 'search_icons',
    write: false,
    description: 'Procura ícones do Google (Material Symbols, mais de 4 mil) pelo nome em inglês ou por um sinônimo em português (casa, carrinho, seta, sino...). Devolve os nomes para usar em insert_icon ou em build_layout.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', description: 'máximo de resultados (padrão 20)' } }, required: ['query'] },
  },
  {
    name: 'insert_icon',
    write: true,
    description: 'Insere um ícone do Google (Material Symbols) como vetor editável, dentro de um frame (na posição index) ou na página.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'nome exato do ícone (use search_icons)' },
        parent_id: { type: 'string' }, index: { type: 'integer' },
        color: { type: 'string', description: '#RRGGBB' }, size: { type: 'integer', description: 'px (padrão 24)' },
        style: { type: 'string', enum: ['outlined', 'rounded', 'sharp'] }, filled: { type: 'boolean' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_fonts',
    write: false,
    description: 'Lista fontes disponíveis (Google Fonts, carregadas sozinhas, e as do sistema) com os pesos de cada uma. Use antes de mudar fontFamily/fontWeight: o nome precisa ser exato.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'parte do nome (vazio = as mais usadas)' },
        category: { type: 'string', enum: ['sans', 'serif', 'display', 'handwriting', 'mono'] },
      },
    },
  },
  {
    name: 'create_color_styles',
    write: true,
    description: 'Cria estilos de cor do projeto (a paleta: viram variáveis de CSS, ex.: --cor-primaria). Devolve os ids para ligar as camadas com fill: {"styleId": id}. Antes, veja os que já existem em get_document (colorStyles) para não repetir.',
    inputSchema: {
      type: 'object',
      properties: { colors: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string', description: '#RRGGBB' } }, required: ['name', 'color'] } } },
      required: ['colors'],
    },
  },
  {
    name: 'create_page',
    write: true,
    description: 'Cria uma página nova no projeto (as abas de página do painel esquerdo) e abre ela.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'switch_page',
    write: false,
    description: 'Abre outra página do projeto (ids em get_document → pages). Não altera nada.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'undo',
    write: true,
    description: 'Desfaz a última alteração do projeto (o mesmo que Ctrl+Z).',
    inputSchema: { type: 'object', properties: {} },
  },
];

/** Procura uma ferramenta pelo nome. */
export const toolByName = (name) => AGENT_TOOLS.find((t) => t.name === name) || null;

/** As ferramentas no formato da API da OpenAI (Chat Completions: `tools: [{ type: 'function', function }]`). */
export const openAiTools = () => AGENT_TOOLS.map((t) => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.inputSchema },
}));

/** As ferramentas no formato do MCP (`tools/list`). */
export const mcpTools = () => AGENT_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: t.inputSchema,
  annotations: { readOnlyHint: !t.write, destructiveHint: t.name === 'delete_layers' },
}));

/**
 * Instruções para a IA (o "prompt de sistema" do agente interno e as `instructions` do servidor MCP). Explicam o
 * que a ferramenta é e as regras de trabalho, para a IA agir do jeito certo desde a primeira mensagem.
 */
export const AGENT_INSTRUCTIONS = `Você ajuda numa ferramenta de design em que o canvas É CSS de verdade: cada camada vira um elemento HTML, frames com layout viram display:flex ou display:grid, e o que se vê no editor é exatamente o HTML/CSS exportado.
Regras:
- Responda em português do Brasil, de forma simples e direta.
- Antes de alterar, LEIA: get_document, get_selection ou get_layer. Use os ids que essas ferramentas devolvem; nunca invente ids.
- Prefira layout (flex/grid com gap e padding) a posicionar com x/y. Use os nomes do CSS ao explicar.
- Pedido claro = FAÇA, sem pedir confirmação nem descrever o plano antes. Só pergunte se for impossível decidir. Para criar estruturas (página, seção, card), use build_layout numa chamada só; sem seleção, ela vira uma tela nova.
- Toda alteração passa pela permissão da pessoa; se ela recusar, não insista: pergunte o que ela prefere.
- Ao terminar, diga em no máximo 3 frases o que ficou pronto.`;
