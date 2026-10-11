/**
 * tools/schema.ts — AS FERRAMENTAS MCP, DEFINIDAS UMA VEZ COM ZOD
 *
 * Cada ferramenta tem nome, descrição e os parâmetros em Zod (`input`). Daí saem, sem repetir nada:
 *   - o JSON Schema que o MCP anuncia em tools/list (`inputSchema`);
 *   - a validação dos argumentos antes de executar (`validateToolArgs`), com mensagens em português que a IA entende;
 *   - os tipos TypeScript dos argumentos (`z.infer<typeof tool.input>`).
 * Sem DOM: o servidor (Node) e o navegador importam o mesmo arquivo.
 *
 * Marcas de uma ferramenta: `write` altera o projeto (vira um passo do desfazer); `noLock` não mexe nas camadas (não
 * reserva o documento); `needs` o que exige de quem chama: read | comment | write | owner (ferramentas de colaboração).
 */

import { z } from 'zod';

z.config(z.locales.pt());

/** Propriedades que as ferramentas de criar/alterar aceitam (o resto é recusado com uma mensagem clara). */
export const PROP_HELP = `Propriedades aceitas (nomes do modelo do editor; o CSS gerado está entre parênteses):
- geral: name, x, y, w, h (px), rotation (graus), opacity (0..1), visible, locked, blend (mix-blend-mode), note (nota da camada)
- tamanho: sizeX/sizeY: "fixed" | "hug" (do tamanho do conteúdo) | "fill" (preenche o pai em flex/grid); minW, maxW, minH, maxH (px); aspect (largura/altura, aspect-ratio)
- aparência: fill: "#RRGGBB" | "none" | {styleId: "id de um estilo de cor"} (liga ao estilo: vira var(--cor) no CSS) | objeto {type:"solid"|"linear"|"radial", color, opacity, angle, stops:[{color, opacity, pos}]}; stroke: null | "#RRGGBB" | {color, width, style, position}; radius: número ou [tl,tr,br,bl] (border-radius); shadows: [{x,y,blur,spread,color,opacity,inset}] (box-shadow); blur, bgBlur (filter/backdrop-filter, px); clip (overflow: hidden, só frame)
- layout de um FRAME: layout: {mode:"none"|"row"|"column"|"grid", gap, padding: número ou [t,r,b,l], justify:"flex-start"|"center"|"flex-end"|"space-between"|"space-around"|"space-evenly"|"stretch", align:"flex-start"|"center"|"flex-end"|"stretch"|"baseline", wrap, cols, rows, colGap, rowGap}
- item dentro de flex/grid: absolute (sai do fluxo: position absolute), alignSelf, justifySelf, grow (flex-grow), margin: número ou [t,r,b,l], colSpan, rowSpan
- mídia (vídeo/áudio/3D/Lottie, criada por library_use): mediaAutoplay, mediaControls, mediaLoop, mediaMuted (true/false). Navegadores só tocam sozinho com mediaMuted:true
- texto: text, fontFamily, fontSize, fontWeight, fontStyle, lineHeight (multiplicador, ex.: 1.4), letterSpacing (px), textAlign, textDecoration, textTransform, truncate ("ellipsis"|"clamp"), lines
- comportamento: sticky (px do topo: position sticky, só item em fluxo), pointerEvents ("none"), cursor ("pointer", "text"...)
- HTML: tag (etiqueta: p, h1..h6, span, a, button, label, li para texto; div, section, header, footer, nav, main, aside, article, ul, ol, li, button, a, form para caixas), href (link), alt (descrição para leitor de tela)`;

type Shape = z.ZodObject<any, any>;
export interface ToolDef<S extends Shape = Shape> {
  name: string;
  write: boolean;
  noLock?: boolean;
  needs?: 'read' | 'comment' | 'write' | 'owner';
  description: string;
  /** Parâmetros em Zod (fonte da verdade). */
  input: S;
  /** O mesmo em JSON Schema, no formato que o MCP anuncia. */
  inputSchema: Record<string, any>;
}

/** JSON Schema do Zod sem o ruído que ele acrescenta (limites de inteiro seguro, propertyNames, $schema). */
function cleanJsonSchema(node: any): any {
  if (Array.isArray(node)) return node.map(cleanJsonSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === '$schema' || k === 'propertyNames') continue;
    if ((k === 'minimum' && v === -9007199254740991) || (k === 'maximum' && v === 9007199254740991)) continue;
    out[k] = cleanJsonSchema(v);
  }
  return out;
}

export function defineTool<S extends Shape>(def: Omit<ToolDef<S>, 'inputSchema'>): ToolDef<S> {
  return { ...def, inputSchema: cleanJsonSchema(z.toJSONSchema(def.input, { io: 'input' })) };
}

/** As ferramentas. */
export const AGENT_TOOLS: ToolDef[] = [
  defineTool({
    name: 'get_document',
    write: false,
    description: 'Resumo do projeto aberto no editor: páginas, árvore de camadas da página atual (id, nome, tipo, etiqueta HTML, tamanho, layout e notas curtas), seleção, estilos de cor/texto e variáveis. Comece por aqui; para notas completas, leia a camada com get_layer.',
    input: z.object({
      depth: z.number().int().describe('Quantos níveis da árvore mostrar (padrão 3, máximo 8).').optional(),
    }),
  }),
  defineTool({
    name: 'get_comments',
    write: false,
    description: 'Lê as anotações do projeto, incluindo respostas, autor, estado e camada/página associadas. Use antes de revisar ou alterar uma camada comentada. Pode filtrar por camada, página ou somente comentários em aberto.',
    input: z.object({
      id: z.string().describe('id opcional da camada').optional(),
      page_id: z.string().describe('id opcional da página').optional(),
      unresolved_only: z.boolean().describe('se true, devolve somente comentários não resolvidos').optional(),
    }),
  }),
  defineTool({
    name: 'get_project_css',
    write: false,
    description: 'Lê a folha CSS global do projeto antes de revisá-la ou substituí-la com set_project_css.',
    input: z.object({}),
  }),
  defineTool({
    name: 'list_assets',
    write: false,
    description: 'Lista as imagens já importadas neste projeto, com id, nome derivado da camada, formato, tamanho aproximado e camadas que as usam. Não envia o conteúdo binário. Use insert_asset para reutilizar uma imagem.',
    input: z.object({
      query: z.string().describe('filtra por nome, id, formato ou página').optional(),
    }),
  }),
  defineTool({
    name: 'get_layer',
    write: false,
    description: 'Todos os dados de UMA camada (posição, tamanho, preenchimento, layout, texto, etiqueta...) e a lista dos filhos diretos.',
    input: z.object({
      id: z.string().describe('id da camada'),
    }),
  }),
  defineTool({
    name: 'get_code',
    write: false,
    description: 'O HTML e o CSS que a camada gera (o mesmo da aba Código e da exportação). Use para revisar o código.',
    input: z.object({
      id: z.string().describe('id da camada'),
    }),
  }),
  defineTool({
    name: 'find_layers',
    write: false,
    description: 'Procura camadas em todas as páginas pelo nome ou texto (sem diferenciar maiúsculas) e/ou pelo tipo.',
    input: z.object({
      query: z.string().describe('parte do nome ou do texto').optional(),
      type: z.enum(['frame', 'rect', 'ellipse', 'text', 'group', 'line', 'path', 'section']).optional(),
    }),
  }),
  defineTool({
    name: 'get_selection',
    write: false,
    description: 'As camadas que a pessoa selecionou agora no editor (resumo de cada uma). Útil quando ela diz "isto aqui".',
    input: z.object({}),
  }),
  defineTool({
    name: 'select_layers',
    write: false,
    description: 'Seleciona camadas no editor (para mostrar à pessoa do que você está falando). Não altera o projeto.',
    input: z.object({
      ids: z.array(z.string()),
    }),
  }),
  defineTool({
    name: 'update_layer',
    write: true,
    description: `Altera propriedades de uma camada. Mande só o que muda. Objetos (fill, stroke, layout) são mesclados com o valor atual.
${PROP_HELP}`,
    input: z.object({
      id: z.string().describe('id da camada'),
      props: z.record(z.string(), z.any()).describe('propriedades a mudar (veja a lista na descrição)'),
    }),
  }),
  defineTool({
    name: 'create_layer',
    write: true,
    description: `Cria uma camada nova. Sem parent_id, vai para a raiz da página (vira uma tela, se for frame). Dentro de um frame com layout, entra na posição "index" (padrão: no fim).
${PROP_HELP}`,
    input: z.object({
      type: z.enum(['frame', 'rect', 'ellipse', 'text', 'line', 'path']),
      parent_id: z.string().describe('id do frame/grupo pai (opcional)').optional(),
      index: z.number().int().describe('posição entre os irmãos (0 = primeiro / mais ao fundo)').optional(),
      props: z.record(z.string(), z.any()).optional(),
    }),
  }),
  defineTool({
    name: 'add_asset',
    write: true,
    description: 'ENVIA uma imagem para o projeto (PNG, JPEG, GIF, WebP ou SVG, até 16 MB) e devolve o asset_id, o tamanho e o formato. Mande UM entre: data_base64 (conteúdo em base64), data_url ("data:image/png;base64,...") ou source_url (endereço https público que o servidor baixa; redes internas são bloqueadas). Com insert:true já cria a camada de imagem (parent_id/at opcionais); sem ele, use insert_asset depois. Enviar a mesma imagem de novo reaproveita o asset existente. As imagens ficam guardadas fora do JSON do projeto.',
    input: z.object({
      name: z.string().describe('nome da camada criada (com insert:true)').optional(),
      data_base64: z.string().describe('conteúdo da imagem em base64, sem prefixo (ou com ele)').optional(),
      data_url: z.string().describe('data URL completo da imagem').optional(),
      source_url: z.string().describe('endereço https público da imagem').optional(),
      insert: z.boolean().describe('se true, já coloca a imagem numa camada nova').optional(),
      parent_id: z.string().describe('com insert: id do frame/grupo que recebe a imagem').optional(),
      at: z.object({
        x: z.number(),
        y: z.number(),
      }).describe('com insert: ponto do canvas (centro da imagem)').optional(),
    }),
  }),
  defineTool({
    name: 'insert_asset',
    write: true,
    description: 'Insere no canvas uma imagem já existente no projeto, reutilizando o asset sem duplicar o arquivo. Descubra os ids com list_assets. Pode inserir dentro de um frame com parent_id; at usa coordenadas do canvas.',
    input: z.object({
      id: z.string().describe('id devolvido por list_assets'),
      name: z.string().describe('nome opcional da nova camada').optional(),
      parent_id: z.string().describe('id opcional de frame/grupo que recebe a imagem').optional(),
      index: z.number().int().describe('posição opcional dentro do pai').optional(),
      at: z.object({
        x: z.number(),
        y: z.number(),
      }).describe('ponto opcional do canvas (centro da imagem)').optional(),
    }),
  }),
  defineTool({
    name: 'delete_layers',
    write: true,
    description: 'Apaga camadas (e o que estiver dentro delas).',
    input: z.object({
      ids: z.array(z.string()),
    }),
  }),
  defineTool({
    name: 'move_layer',
    write: true,
    description: 'Muda a camada de lugar na árvore: para dentro de outro frame/grupo (parent_id) e/ou para outra posição entre os irmãos (index). parent_id "root" = raiz da página.',
    input: z.object({
      id: z.string(),
      parent_id: z.string().optional(),
      index: z.number().int().optional(),
    }),
  }),
  defineTool({
    name: 'build_layout',
    write: true,
    description: `Cria uma ESTRUTURA INTEIRA de uma vez (uma tela, uma seção, um card com tudo dentro): uma árvore de camadas aninhadas, com UMA permissão e UM passo do Ctrl+Z. Use para "faça uma página/seção/cabeçalho...". Sem parent_id, a árvore vira uma tela nova na página, posicionada ao lado das que já existem (não precisa selecionar nada).
Cada nó: {"type": "frame"|"rect"|"ellipse"|"text"|"line"|"icon"|"path", "props": {...}, "children": [...]}. Para "path" (VETOR, a caneta: ícones e formas próprios), props = {"points": [{"x": 3, "y": 4}, {"x": 21, "y": 4, "hout": {"x": 23, "y": 4}}, ...], "closed": true|false, "vw": 24, "vh": 24, "w": 48, "h": 48, "fill": "none"|"#RRGGBB", "stroke": {"color": "#RRGGBB", "width": 1.75, "cap": "round", "join": "round"}}. Os pontos ficam em coordenadas do viewBox vw × vh (omitidos, vêm do tamanho dos pontos); w e h esticam esse espaço. "hin" (alça de entrada) e "hout" (alça de saída) são pontos {x, y} absolutos no mesmo espaço: ponto sem alças é canto; com alças, o trecho vira curva de Bézier. Máximo de 500 pontos; path não tem filhos. Para "icon", props = {"name": "nome do Material Symbol (use search_icons)", "color": "#RRGGBB", "size": 24, "style": "outlined"|"rounded"|"sharp", "filled": false}.
Dica: tela de site = frame com props {"name":"Início","w":1440,"fluid":true,"sizeY":"hug","layout":{"mode":"column"}} e seções dentro com sizeX "fill".
${PROP_HELP}`,
    input: z.object({
      parent_id: z.string().describe('id do frame onde a árvore entra (opcional; sem ele, vira uma tela nova)').optional(),
      index: z.number().int().describe('posição entre os irmãos (padrão: no fim)').optional(),
      tree: z.record(z.string(), z.any()).describe('o nó raiz: {type, props, children}'),
    }),
  }),
  defineTool({
    name: 'search_icons',
    write: false,
    description: 'Procura ícones do Google (Material Symbols, mais de 4 mil) pelo nome em inglês ou por um sinônimo em português (casa, carrinho, seta, sino...). Devolve os nomes para usar em insert_icon ou em build_layout.',
    input: z.object({
      query: z.string(),
      limit: z.number().int().describe('máximo de resultados (padrão 20)').optional(),
    }),
  }),
  defineTool({
    name: 'insert_icon',
    write: true,
    description: 'Insere um ícone do Google (Material Symbols) como vetor editável, dentro de um frame (na posição index) ou na página.',
    input: z.object({
      name: z.string().describe('nome exato do ícone (use search_icons)'),
      parent_id: z.string().optional(),
      index: z.number().int().optional(),
      color: z.string().describe('#RRGGBB').optional(),
      size: z.number().int().describe('px (padrão 24)').optional(),
      style: z.enum(['outlined', 'rounded', 'sharp']).optional(),
      filled: z.boolean().optional(),
    }),
  }),
  defineTool({
    name: 'list_fonts',
    write: false,
    description: 'Lista fontes disponíveis (Google Fonts, carregadas sozinhas, e as do sistema) com os pesos de cada uma. Use antes de mudar fontFamily/fontWeight: o nome precisa ser exato.',
    input: z.object({
      query: z.string().describe('parte do nome (vazio = as mais usadas)').optional(),
      category: z.enum(['sans', 'serif', 'display', 'handwriting', 'mono']).optional(),
    }),
  }),
  defineTool({
    name: 'create_color_styles',
    write: true,
    description: 'Cria estilos de cor do projeto (a paleta: viram variáveis de CSS, ex.: --cor-primaria). Devolve os ids para ligar as camadas com fill: {"styleId": id}. Antes, veja os que já existem em get_document (colorStyles) para não repetir.',
    input: z.object({
      colors: z.array(z.object({
        name: z.string(),
        color: z.string().describe('#RRGGBB'),
      })),
    }),
  }),
  defineTool({
    name: 'create_page',
    write: true,
    description: 'Cria uma página nova no projeto (as abas de página do painel esquerdo) e abre ela.',
    input: z.object({
      name: z.string(),
    }),
  }),
  defineTool({
    name: 'set_project_css',
    write: true,
    description: 'Substitui o CSS global do projeto, incluindo seletores, @media, estados, @keyframes e efeitos CSS 3D. Leia get_project_css antes de editar uma folha existente. Envie a folha completa em css; string vazia limpa o CSS global. Confira o resultado com get_image e get_code.',
    input: z.object({
      css: z.string().describe('Folha CSS completa do projeto; substitui o conteúdo atual.'),
    }),
  }),
  defineTool({
    name: 'switch_page',
    write: false,
    description: 'Abre outra página do projeto (ids em get_document → pages). Não altera nada.',
    input: z.object({
      id: z.string(),
    }),
  }),
  defineTool({
    name: 'get_image',
    write: false,
    description: 'VÊ o design: devolve um PNG da camada (ou da tela inteira). Use para conferir o resultado depois de montar ou alterar algo. Sem id, usa a seleção ou a primeira tela da página. (No Assistente interno a imagem não chega ao modelo; no MCP, sim.)',
    input: z.object({
      id: z.string().optional(),
      scale: z.number().describe('0.5 a 2 (padrão 1)').optional(),
    }),
  }),
  defineTool({
    name: 'export_html',
    write: false,
    description: 'HTML de uma tela independente. O conteúdo vem em trechos UTF-8 de 256 KiB por padrão; continue com offset=nextOffset até complete=true. maxBytes pode chegar a 1 MiB.',
    input: z.object({
      id: z.string().describe('id da tela (frame)'),
      offset: z.number().int().describe('Posição em bytes da resposta anterior (nextOffset).').optional(),
      maxBytes: z.number().int().describe('Tamanho máximo do trecho: 256 KiB por padrão, máximo 1 MiB.').optional(),
    }),
  }),
  defineTool({
    name: 'export_site',
    write: false,
    description: 'Lista os arquivos HTML estáticos de todas as pranchetas visíveis. Inclua includeContent:true para receber conteúdo; use path para buscar uma página por vez. O conteúdo incluído tem limite de 256 KiB por chamada (máximo configurável de 1 MiB). CSS e imagens ficam embutidos; fontes Google carregam pela rede. Interações de protótipo e JavaScript arbitrário não são executados.',
    input: z.object({
      includeContent: z.boolean().describe('Padrão false: retorna caminhos/tamanhos. true inclui o HTML, respeitando maxBytes.').optional(),
      path: z.string().describe('Retorna somente este caminho do pacote, por exemplo index.html.').optional(),
      maxBytes: z.number().int().describe('Limite do conteúdo por chamada: 256 KiB por padrão, máximo 1 MiB.').optional(),
      offset: z.number().int().describe('Posição em bytes da resposta anterior (nextOffset); requer path e includeContent:true.').optional(),
    }),
  }),
  defineTool({
    name: 'export_zip',
    write: false,
    description: 'Grava o projeto e devolve o endereço para baixar o SITE inteiro em .zip (HTML estruturado, uma página por prancheta visível, pronto para publicar) e o do projeto em .json (para importar em outro Stylo). Faça o download desses endereços com HTTP GET.',
    input: z.object({}),
  }),
  defineTool({
    name: 'set_responsive',
    write: true,
    description: 'Ajusta uma camada SÓ num breakpoint do projeto (padrão: "tablet" ≤1024px e "mobile" ≤640px; o projeto pode ter outros, veja get_document → breakpoints): vira @media no CSS. O Desktop continua igual. Ex.: grid de 3 colunas vira 1 no celular: props {"layout": {"cols": 1}}; esconder no celular: {"visible": false}; texto menor: {"fontSize": 36}. Aceita: x, y, w, h, sizeX, sizeY, minW, maxW, minH, maxH, aspect, margin, grow, absolute, visible, alignSelf, justifySelf, colSpan, rowSpan, layout, rotation, overflow, fluid, fontSize, lineHeight, letterSpacing, wordSpacing, textAlign, fontWeight, textTransform, truncate, lines, radius, opacity, blend, clip, fill, stroke, shadows, blur, bgBlur.',
    input: z.object({
      id: z.string(),
      breakpoint: z.string().describe('id do breakpoint (ex.: "tablet", "mobile" ou um personalizado listado em get_document)'),
      props: z.record(z.string(), z.any()),
    }),
  }),
  defineTool({
    name: 'set_state',
    write: true,
    description: 'Define como a camada fica no :hover, :active (pressionado) ou :focus-visible (foco do teclado) — vira .classe:hover no CSS, com a transição da camada. Aceita: fill, stroke, radius, shadows, blur, bgBlur, opacity, blend, scale (ex.: 1.03). Ex.: botão escurece no hover: {"state": "hover", "props": {"fill": "#991B1B"}}.',
    input: z.object({
      id: z.string(),
      state: z.enum(['hover', 'active', 'focus']),
      props: z.record(z.string(), z.any()),
    }),
  }),
  defineTool({
    name: 'create_component',
    write: true,
    description: 'Transforma uma camada em COMPONENTE principal (as cópias, criadas com create_instance, mudam junto quando o principal muda).',
    input: z.object({
      id: z.string(),
    }),
  }),
  defineTool({
    name: 'create_instance',
    write: true,
    description: 'Cria uma cópia ligada (instância) de um componente, dentro de um frame (na posição index) ou na página. props sobrescreve só nesta cópia (ex.: name). Para mudar o texto de dentro, use update_layer nos filhos da instância.',
    input: z.object({
      component_id: z.string(),
      parent_id: z.string().optional(),
      index: z.number().int().optional(),
      props: z.record(z.string(), z.any()).optional(),
    }),
  }),
  defineTool({
    name: 'duplicate_layers',
    write: true,
    description: 'Duplica camadas (com tudo dentro). Em flex/grid, a cópia entra logo depois do original.',
    input: z.object({
      ids: z.array(z.string()),
    }),
  }),
  defineTool({
    name: 'add_interaction',
    write: true,
    description: 'Protótipo: ao clicar na camada, "navigate" vai para outra tela (target_id), "back" volta, "url" abre um site. Aparece no modo Apresentar.',
    input: z.object({
      id: z.string(),
      action: z.enum(['navigate', 'back', 'url']),
      target_id: z.string().optional(),
      url: z.string().optional(),
      transition: z.enum(['instant', 'dissolve', 'slide-left', 'slide-right', 'slide-up', 'slide-down']).optional(),
    }),
  }),
  defineTool({
    name: 'add_comment',
    write: true,
    description: 'Deixa um comentário numa camada (aparece como pino no canvas e na aba Comentários). Bom para revisões: aponte o problema sem mudar nada.',
    input: z.object({
      id: z.string(),
      text: z.string(),
    }),
  }),
  defineTool({
    name: 'delete_page',
    write: true,
    description: 'Apaga uma página do projeto (não dá para apagar a última).',
    input: z.object({
      id: z.string(),
    }),
  }),
  defineTool({
    name: 'redo',
    write: true,
    description: 'Refaz o que foi desfeito (Ctrl+Shift+Z).',
    input: z.object({}),
  }),
  defineTool({
    name: 'edit_image',
    write: true,
    description: 'EDITA A FOTO de uma camada com imagem (preenchimento de imagem), no navegador, sem IA externa e sem chave: girar/espelhar, recortar (crop em px da imagem ou ratio), remover o fundo (automático: tira a cor das bordas; melhor com fundo liso), filtro pronto, ajustes (-100..100; sharpen 0..100; blur 0..40 px) e largura máxima/formato/qualidade. Ordem: girar → recortar → remover fundo → filtro → ajustes → tamanho. Grava uma imagem NOVA (a original fica guardada) e é um passo do Ctrl+Z. restore_original: true volta para a imagem de antes das edições.',
    input: z.object({
      id: z.string().describe('id da camada com preenchimento de imagem'),
      rotate: z.literal([90, 180, 270, -90]).describe('graus, sentido horário').optional(),
      flip_h: z.boolean().optional(),
      flip_v: z.boolean().optional(),
      crop: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        w: z.number().optional(),
        h: z.number().optional(),
      }).describe('recorte em px da imagem (depois de girar)').optional(),
      ratio: z.enum(['1:1', '4:3', '16:9', '3:2']).describe('recorte centralizado nesta proporção (no lugar de crop)').optional(),
      remove_background: z.boolean().describe('remove o fundo (fica transparente; o formato vira PNG)').optional(),
      background_tolerance: z.number().int().describe('1..80 (padrão 28): maior = tira cores mais diferentes do fundo').optional(),
      filter: z.enum(['none', 'vivo', 'quente', 'frio', 'suave', 'drama', 'pb', 'noir', 'sepia', 'vintage']).optional(),
      adjust: z.object({
        brightness: z.number().optional(),
        contrast: z.number().optional(),
        saturation: z.number().optional(),
        exposure: z.number().optional(),
        temperature: z.number().optional(),
        sharpen: z.number().optional(),
        blur: z.number().optional(),
      }).optional(),
      max_width: z.number().int().describe('largura máxima em px (nunca aumenta)').optional(),
      format: z.enum(['webp', 'png', 'jpeg']).optional(),
      quality: z.number().describe('0.3..1 (WebP/JPEG, padrão 0.9)').optional(),
      restore_original: z.boolean().describe('volta para a imagem original (ignora o resto)').optional(),
    }),
  }),
  defineTool({
    name: 'generate_image_edit',
    write: true,
    description: 'Edição GENERATIVA da foto de uma camada com imagem, pelo modelo de imagem configurado no servidor (Configurações → Agente de IA e modelos → Modelo de imagem). mode: "fill" = preenche a área com o que o prompt pedir (ex.: tirar uma pessoa); "replace" = troca o objeto da área (sem área = variação da foto toda); "expand" = aumenta a foto para os lados (expand em px) inventando o resto; "generate" = imagem nova só pelo prompt, no lugar da atual. area em % da imagem (0..100). Se não houver modelo de imagem, devolve erro: avise a pessoa. Demora alguns segundos; um Ctrl+Z desfaz.',
    input: z.object({
      id: z.string().describe('id da camada com preenchimento de imagem'),
      mode: z.enum(['fill', 'replace', 'expand', 'generate']),
      prompt: z.string().describe('o que a IA deve fazer/desenhar (português ou inglês)'),
      area: z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        w: z.number().optional(),
        h: z.number().optional(),
      }).describe('retângulo em % da imagem (fill/replace)').optional(),
      expand: z.object({
        top: z.number().optional(),
        right: z.number().optional(),
        bottom: z.number().optional(),
        left: z.number().optional(),
      }).describe('px a acrescentar de cada lado (expand)').optional(),
    }),
  }),
  defineTool({
    name: 'list_projects',
    write: false,
    description: 'Lista os projetos salvos na pasta do servidor (arquivo, data, tamanho) e diz qual está aberto nesta sessão.',
    input: z.object({}),
  }),
  defineTool({
    name: 'open_project',
    write: true, noLock: true,
    description: 'Abre um projeto da pasta como o projeto desta sessão (use list_projects). Quem mais abrir o mesmo arquivo trabalha no mesmo projeto.',
    input: z.object({
      file: z.string().describe('ex.: meu-site.json'),
    }),
  }),
  defineTool({
    name: 'save_project',
    write: true, noLock: true,
    description: 'Grava o projeto aberto na pasta (o servidor também grava sozinho depois de cada alteração). Com name, salva uma cópia com esse nome e passa a trabalhar nela.',
    input: z.object({
      name: z.string().describe('nome do arquivo (sem .json)').optional(),
    }),
  }),
  defineTool({
    name: 'new_project',
    write: true, noLock: true,
    description: 'Cria um projeto novo em branco (com o nome dado) na pasta e o abre nesta sessão. Recusa se já existir um arquivo com esse nome.',
    input: z.object({
      name: z.string().optional(),
    }),
  }),
  defineTool({
    name: 'add_note',
    write: true, noLock: true, needs: 'comment',
    description: 'Grava uma nota no projeto (ou numa camada). kind "decision" (padrão) = POR QUE algo foi decidido ou feito assim: quem retomar o trabalho depois (outra IA ou pessoa) lê isso com list_notes. kind "comment" = conversa/revisão. reply_to responde a outra nota. Anote decisões importantes enquanto trabalha.',
    input: z.object({
      text: z.string().describe('o texto da nota (até 8000 caracteres)'),
      kind: z.enum(['decision', 'comment']).optional(),
      layer_id: z.string().describe('camada a que a nota se refere (opcional)').optional(),
      reply_to: z.string().describe('id de uma nota a que esta responde (opcional)').optional(),
    }),
  }),
  defineTool({
    name: 'list_notes',
    write: false, needs: 'read',
    description: 'Lista as notas do projeto, da mais antiga à mais nova, com autor (pessoa ou agente) e se foram resolvidas. LEIA as notas de decisão ao abrir um projeto que você não conhece.',
    input: z.object({
      layer_id: z.string().optional(),
      kind: z.enum(['decision', 'comment']).optional(),
      include_resolved: z.boolean().describe('padrão true').optional(),
      limit: z.number().int().describe('padrão 100, máximo 500').optional(),
    }),
  }),
  defineTool({
    name: 'resolve_note',
    write: true, noLock: true, needs: 'comment',
    description: 'Marca uma nota como resolvida (ou volta a abri-la com resolved:false).',
    input: z.object({
      id: z.string(),
      resolved: z.boolean().describe('padrão true').optional(),
    }),
  }),
  defineTool({
    name: 'get_activity',
    write: false, needs: 'read',
    description: 'O que foi feito no projeto: as últimas alterações, com quem fez (pessoa ou agente), a ferramenta e as camadas. Use para entender o estado antes de continuar o trabalho de outra pessoa/IA.',
    input: z.object({
      limit: z.number().int().describe('padrão 30, máximo 200').optional(),
      agent: z.string().describe('filtra pelo nome do agente (opcional)').optional(),
    }),
  }),
  defineTool({
    name: 'who_is_here',
    write: false, needs: 'read',
    description: 'Quem está no servidor agora: pessoas com o editor aberto, agentes conectados, o que cada agente fez por último e quais camadas estão reservadas. Veja antes de mexer numa área que outra pessoa/IA pode estar editando.',
    input: z.object({}),
  }),
  defineTool({
    name: 'list_members',
    write: false, needs: 'read',
    description: 'Lista quem tem acesso ao projeto aberto (dono, editores, leitores).',
    input: z.object({}),
  }),
  defineTool({
    name: 'share_project',
    write: true, noLock: true, needs: 'owner',
    description: 'Compartilha o projeto aberto com uma pessoa que já tem conta (só o dono). role "editor" altera; "viewer" só lê e comenta.',
    input: z.object({
      email: z.string(),
      role: z.enum(['editor', 'viewer']).optional(),
    }),
  }),
  defineTool({
    name: 'unshare_project',
    write: true, noLock: true, needs: 'owner',
    description: 'Tira o acesso de uma pessoa ao projeto aberto (só o dono).',
    input: z.object({
      email: z.string(),
    }),
  }),
  defineTool({
    name: 'undo',
    write: true,
    description: 'Desfaz a última alteração do projeto (o mesmo que Ctrl+Z).',
    input: z.object({}),
  }),
];

/**
 * Ferramentas que vêm de PLUGINS (ver plugin.ts). O servidor as registra ao ligar; daí em diante aparecem no tools/list e
 * passam pela mesma validação e pelas mesmas travas das ferramentas do núcleo.
 */
const PLUGIN_TOOLS: ToolDef[] = [];

/** Registra as ferramentas de um plugin. Nome repetido (com o núcleo ou com outro plugin) é erro. */
export function registerPluginTools(defs: ToolDef[]) {
  for (const def of defs) {
    if (PLUGIN_TOOLS.includes(def)) continue; // o mesmo plugin ligado de novo (testes, reinício a quente): sem efeito
    if (AGENT_TOOLS.some((t) => t.name === def.name) || PLUGIN_TOOLS.some((t) => t.name === def.name)) throw new Error(`Ferramenta repetida: ${def.name}.`);
    PLUGIN_TOOLS.push(def);
  }
}

/** Todas as ferramentas disponíveis: as do núcleo e as dos plugins. */
export const allTools = (): ToolDef[] => [...AGENT_TOOLS, ...PLUGIN_TOOLS];

/** Procura uma ferramenta pelo nome (núcleo ou plugin). */
export const toolByName = (name: string): ToolDef | null => AGENT_TOOLS.find((t) => t.name === name) || PLUGIN_TOOLS.find((t) => t.name === name) || null;

export const mcpToolByName = (name: string) => toolByName(name);

/** As ferramentas no formato do MCP (`tools/list`). */
export const mcpTools = () => allTools().map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: t.inputSchema,
  annotations: { readOnlyHint: !t.write, destructiveHint: ['delete_layers', 'delete_page'].includes(t.name) },
}));

/**
 * Confere os argumentos de uma chamada contra o Zod da ferramenta. Devolve uma mensagem em português (para a IA corrigir
 * e tentar de novo) ou null se está tudo certo. Campos que a ferramenta não conhece são ignorados.
 */
export function validateToolArgs(name: string, args: unknown): string | null {
  const tool = toolByName(name);
  if (!tool) return null;
  const parsed = tool.input.safeParse(args ?? {});
  if (parsed.success) return null;
  const problems = parsed.error.issues.map((i) => {
    const where = i.path.length ? i.path.join('.') : 'argumentos';
    return `${where}: ${i.message}`;
  });
  return `Argumentos inválidos para ${name} — ${problems.join('; ')}.`;
}

/**
 * Instruções para a IA (o "prompt de sistema" do agente interno e as `instructions` do servidor MCP). Explicam o
 * que a ferramenta é e as regras de trabalho, para a IA agir do jeito certo desde a primeira mensagem.
 */
export const AGENT_INSTRUCTIONS = `Você ajuda numa ferramenta de design em que o canvas É CSS de verdade: cada camada vira um elemento HTML, frames com layout viram display:flex ou display:grid, e o que se vê no editor é exatamente o HTML/CSS exportado.
Regras:
- Responda em português do Brasil, de forma simples e direta.
- Antes de alterar, LEIA: get_document, get_selection ou get_layer. Use os ids que essas ferramentas devolvem; nunca invente ids.
- Antes de tudo: list_projects e open_project para continuar um projeto, ou new_project para criar. O servidor grava sozinho; outras pessoas e agentes podem estar no mesmo projeto.
- Prefira layout (flex/grid com gap e padding) a posicionar com x/y. Use os nomes do CSS ao explicar.
- Pedido claro = FAÇA, sem pedir confirmação nem descrever o plano antes. Só pergunte se for impossível decidir. Para criar estruturas (página, seção, card), use build_layout numa chamada só; sem seleção, ela vira uma tela nova.
- Alterações são gravadas direto no projeto e podem ser desfeitas com undo; trabalhe em camadas pequenas e nomeadas para não atrapalhar quem está no mesmo projeto.
- Ao terminar, diga em no máximo 3 frases o que ficou pronto.`;
