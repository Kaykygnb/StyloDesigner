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
import { ORGANIZATION_TOOLS } from './organization-schema.ts';
import { ARRANGE_TOOLS } from './arrange-schema.ts';
import { CODE_TOOLS } from './code-schema.ts';
import { DESIGN_RESOURCE_TOOLS } from './design-resources-schema.ts';
import { MAX_LAYER_UPDATES } from './runner/batch.ts';

z.config(z.locales.pt());

/** Propriedades que as ferramentas de criar/alterar aceitam (o resto é recusado com uma mensagem clara). */
export const PROP_HELP = `Propriedades aceitas (nomes do modelo do editor; o CSS gerado está entre parênteses):
- geral: name, x, y, w, h (px), rotation (graus), opacity (0..1), visible, locked, blend (mix-blend-mode), note (nota da camada)
- tamanho: sizeX/sizeY: "fixed" | "hug" (do tamanho do conteúdo) | "fill" (preenche o pai em flex/grid); minW, maxW, minH, maxH (px); aspect (largura/altura, aspect-ratio)
- aparência: fill: "#RRGGBB" | "none" | {styleId: "id de um estilo de cor"} (liga ao estilo: vira var(--cor) no CSS) | objeto {type:"solid"|"linear"|"radial", color, opacity, angle, stops:[{color, opacity, pos}]}; stroke: null | "#RRGGBB" | {color, width, style, position}; radius: número ou [tl,tr,br,bl] (border-radius); shadows: [{x,y,blur,spread,color,opacity,inset}] (box-shadow); blur, bgBlur (filter/backdrop-filter, px); clip (overflow: hidden, só frame)
- layout de um FRAME: layout: {mode:"none"|"row"|"column"|"grid", gap, padding: número ou [t,r,b,l], justify:"flex-start"|"center"|"flex-end"|"space-between"|"space-around"|"space-evenly"|"stretch", align:"flex-start"|"center"|"flex-end"|"stretch"|"baseline", wrap, cols, rows, colGap, rowGap}
- item dentro de flex/grid: absolute (sai do fluxo: position absolute), alignSelf, justifySelf, grow (flex-grow), margin: número ou [t,r,b,l], colSpan, rowSpan
- estilos compartilhados: effectStyleId (sombra, de create_effect_styles), fill: {gradientId} (gradiente, de create_gradient_styles)
- mídia (vídeo/áudio/3D/Lottie, criada por library_use): mediaAutoplay, mediaControls, mediaLoop, mediaMuted (true/false). Navegadores só tocam sozinho com mediaMuted:true
- texto: text, fontFamily, fontSize, fontWeight, fontStyle, lineHeight (multiplicador, ex.: 1.4), letterSpacing (px), textAlign, textDecoration, textTransform, truncate ("ellipsis"|"clamp"), lines
- comportamento: sticky (px do topo: position sticky, só item em fluxo), pointerEvents ("none"), cursor ("pointer", "text"...)
- transformar: flipX/flipY (espelhar), skewX/skewY (inclinação em graus), lockRatio (trava a proporção ao redimensionar), constraints {h:"left"|"right"|"leftright"|"center"|"scale", v:"top"|"bottom"|"topbottom"|"center"|"scale"} (só em frames sem layout), fx {brightness,contrast,saturate,grayscale (%), hue (graus)} (filtros de cor; null limpa), order e shrink (item de flex)
- modelo 3D (só em mídia do tipo model3d; arquivo .glb): modelAutoRotate (gira sozinho), modelScroll (gira uma volta conforme a página rola; parado com "menos movimento"), modelOrbit (ponto de vista inicial "horizontal vertical distância", ex.: "30deg 70deg 3m"; null apaga)
- 3D e profundidade (CSS 3D, sem JavaScript): rotateX/rotateY (graus, -360..360), depth (translateZ em px, -2000..2000), perspective (px, 100..5000; só em frame/grupo/seção: de onde a cena é vista), preserve3d (true: os filhos mantêm a profundidade; só em frame/grupo/seção. ATENÇÃO: o frame com preserve3d NÃO deve ter fill, senão o fundo dele esconde o que gira para trás; ponha a cor num frame pai. Ele também deixa de cortar o conteúdo), parallax (-1..1: quanto a camada se move com a rolagem da página; 0 = parada). Para ver profundidade o PAI precisa de perspective; null apaga.
- opcionais: mande null para APAGAR (rotateX, rotateY, depth, perspective, preserve3d, parallax, minW, maxW, minH, maxH, aspect, overflow, sticky, cursor, pointerEvents, skewX/Y, order, shrink, grow, margin, note, href, alt, whiteSpace, wordBreak, textWrap, truncate, lines, customCss, htmlId, classes…)
- mais: isMask (máscara; camada dentro de um grupo), noteInCode, fillRule ("nonzero"|"evenodd", vetor), shape {kind:"polygon"|"star", sides:3..24, innerRatio:0..1} (forma paramétrica editável), points [{x,y,hin?,hout?,mode?}] + closed + vw/vh (só path: troca todos os nós de uma vez, um passo de desfazer; para mexer em UM nó prefira edit_vector_node), customCss (declarações CSS livres, uma por linha), transition {duration ms, easing}, grids [{type:"columns"|"rows"|"grid", count, gutter, margin, size, color, opacity}] (grades de layout só de guia, em frames)
- protótipo: interactions [{trigger:"click"|"hover", action:"navigate"|"back"|"url", target (id da tela), transition ("instant"|"dissolve"|"slide-left"|"slide-right"|"slide-up"|"slide-down"), url}] (substitui a lista; null apaga), flowStart (true na tela onde a apresentação começa)
- photoCredit {provider, author, authorUrl, sourceUrl, license, licenseUrl, attribution, attributionRequired} (crédito de uma foto de banco de imagens; vai para o CREDITS.txt do site; null apaga)
- código HTML escrito à mão (camada type "html"): html (o texto HTML; é limpo ao exibir e exportar: sem <script> nem on*)
- HTML: htmlId (id), classes (classes extras separadas por espaço), title, role, lang, target/rel (links), buttonType, dateTime, cite; tag (etiqueta: p, h1..h6, span, a, button, label, li para texto; div, section, header, footer, nav, main, aside, article, ul, ol, li, button, a, form para caixas), href (link), alt (descrição para leitor de tela)`;

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
  ...DESIGN_RESOURCE_TOOLS.map(defineTool),
  ...ORGANIZATION_TOOLS.map(defineTool),
  ...ARRANGE_TOOLS.map(defineTool),
  ...CODE_TOOLS.map(defineTool),
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
    name: 'audit_vector',
    write: false,
    description: 'Audita vetores da página ou de uma camada: caminhos vazios/degenerados, pontos e alças inválidos, viewBox incoerente, contornos abertos com preenchimento, booleanas sem fontes, vetores invisíveis e filtros pesados. Não altera o documento; cada aviso traz severidade, código e sugestão de correção.',
    input: z.object({
      id: z.string().describe('id de um vetor ou de uma camada que contenha vetores; omita para auditar a página aberta').optional(),
      includeInvisible: z.boolean().describe('inclui vetores ocultos, transparentes ou sem tamanho (padrão true)').optional(),
      maxIssues: z.number().int().min(1).max(500).describe('máximo de problemas devolvidos').optional(),
    }),
  }),
  defineTool({
    name: 'inspect_vector',
    write: false,
    description: 'Inspeciona um vetor sem converter para SVG: devolve viewBox, fechamento, regra de preenchimento, contornos e nós com índices estáveis, coordenadas e alças hin/hout. Use contour_index ou node_index para uma leitura pequena antes de editar. maxBytes limita a resposta.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      contour_index: z.number().int().nonnegative().describe('contorno: 0 é o principal; os demais vêm dos furos/contornos compostos').optional(),
      node_index: z.number().int().nonnegative().describe('índice do nó dentro do contorno').optional(),
      max_points: z.number().int().min(1).max(500).describe('máximo de nós por contorno quando node_index não foi informado').optional(),
      maxBytes: z.number().int().min(1024).max(65536).describe('orçamento da resposta JSON; padrão 16 KiB').optional(),
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
    description: 'Procura camadas por nome/texto, tipo e propriedades base. Filtros são combinados (AND); page_id limita a página, within_id inclui a camada e seus descendentes. Resposta compacta por padrão: 20 linhas, até 8 KiB de JSON, sem texto/notas/layout. fields:"ids" devolve só IDs para update_layers; summary pede o resumo antigo. count é o retornado; total conta todos; continue com offset:nextOffset enquanto hasMore. Recomece a paginação se alterar o projeto/filtros. where.fontFamily é nome exato sem diferenciar maiúsculas; fillColor compara preenchimento sólido em hex; assetId aceita imagem/mídia; estilos são IDs exatos. visible/locked são flags da própria camada. Não resolve CSS, modos de cor, estados nem breakpoints; não mede layout em compact/ids. Use get_layer para detalhes e get_image para conferir.',
    input: z.object({
      query: z.string().describe('parte do nome ou do texto').optional(),
      type: z.enum(['frame', 'rect', 'ellipse', 'text', 'group', 'line', 'path', 'section', 'html', 'media']).optional(),
      page_id: z.string().optional(),
      within_id: z.string().describe('id da camada que limita a busca a ela e seus descendentes').optional(),
      where: z.object({
        fontFamily: z.string().min(1).optional(), fontSize: z.number().nonnegative().optional(), fontWeight: z.number().optional(),
        fillColor: z.string().regex(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i, 'Use #RGB ou #RRGGBB para a cor sólida.').optional(),
        colorStyleId: z.string().optional(), textStyleId: z.string().optional(), effectStyleId: z.string().optional(),
        gradientStyleId: z.string().optional(), assetId: z.string().optional(), instanceOf: z.string().optional(),
        component: z.boolean().optional(), visible: z.boolean().optional(), locked: z.boolean().optional(),
        tag: z.string().optional(), layoutMode: z.enum(['none', 'row', 'column', 'grid']).optional(),
      }).strict().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().nonnegative().optional(),
      fields: z.enum(['compact', 'ids', 'summary']).optional(),
      maxBytes: z.number().int().min(1024).max(65536).describe('orçamento do JSON do resultado em UTF-8; padrão 8192').optional(),
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
    name: 'update_layers',
    write: true,
    description: `Altera de 1 a ${MAX_LAYER_UPDATES} camadas em UMA operação: updates:[{id,props},...], com propriedades iguais ou diferentes por camada. Cada id aparece uma única vez. Valida o lote inteiro antes de escrever: se um item falhar, nenhum é aplicado. Um passo de undo desfaz tudo. Mesma regra de propriedades de update_layer; itens são processados na ordem enviada e pai/filho podem estar no mesmo lote. Mudanças de modo de layout usam a geometria atual como referência. Não cria, move nem apaga camadas e não ajusta breakpoints/estados: use as ferramentas específicas. Ao alterar w/h ou layout.mode o MCP reserva o documento, pois filhos podem mudar.
${PROP_HELP}`,
    input: z.object({
      updates: z.array(z.object({
        id: z.string().min(1).describe('id da camada, obtido com get_document ou find_layers'),
        props: z.record(z.string(), z.any()).describe('somente as propriedades a mudar nesta camada'),
      }).strict()).min(1).max(MAX_LAYER_UPDATES).refine((updates) => new Set(updates.map((update) => update.id)).size === updates.length, { message: 'Cada id deve aparecer uma única vez no lote. Junte as propriedades dessa camada em um item.' }),
    }),
  }),
  defineTool({
    name: 'create_layer',
    write: true,
    description: `Cria uma camada nova. Sem parent_id, vai para a raiz da página (vira uma tela, se for frame). type "section" (só na raiz) agrupa telas no canvas; "html" é uma caixa com HTML escrito à mão. Dentro de um frame com layout, entra na posição "index" (padrão: no fim).
${PROP_HELP}`,
    input: z.object({
      type: z.enum(['frame', 'rect', 'ellipse', 'text', 'line', 'path', 'section', 'html']),
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
    description: 'Procura ícones do Google (Material Symbols) pelo nome em inglês ou por um sinônimo em português. Para Lucide, use a busca de assets do plugin assets.',
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
      name: z.string().describe('nome exato do ícone (use search_icons ou asset_search)'),
      collection: z.enum(['Material Symbols', 'Lucide']).optional().describe('coleção do ícone; padrão Material Symbols'),
      parent_id: z.string().optional(),
      index: z.number().int().optional(),
      color: z.string().describe('#RRGGBB').optional(),
      size: z.number().int().describe('px (padrão 24)').optional(),
      style: z.enum(['outlined', 'rounded', 'sharp']).optional(),
      filled: z.boolean().optional(),
    }),
  }),
  defineTool({
    name: 'edit_vector_node',
    write: true,
    description: 'Edita um nó específico de um vetor em uma única operação de undo, preservando o ID, os demais nós, contornos e alças. Mande somente o que mudar: point pode conter x/y parciais; hin/hout aceitam {x,y} ou null para remover; mode aceita corner, smooth, symmetric ou free. Use inspect_vector antes para obter os índices.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      contour_index: z.number().int().nonnegative().describe('contorno: 0 é o principal').optional(),
      node_index: z.number().int().nonnegative().describe('índice do nó dentro do contorno'),
      point: z.object({ x: z.number().optional(), y: z.number().optional() }).strict().refine((p) => p.x !== undefined || p.y !== undefined, { message: 'point precisa trazer x ou y.' }).optional(),
      hin: z.union([z.object({ x: z.number(), y: z.number() }).strict(), z.null()]).optional(),
      hout: z.union([z.object({ x: z.number(), y: z.number() }).strict(), z.null()]).optional(),
      mode: z.enum(['corner', 'smooth', 'symmetric', 'free']).nullable().optional(),
    }),
  }),
  defineTool({
    name: 'create_vector_network',
    write: true,
    description: 'Cria uma rede vetorial editável com junções estáveis e segmentos de linha ou Bézier. A rede preserva ramificações e alças no metadata vectorNetwork e também é exportada como contornos SVG editáveis; as fontes não são achatadas em uma string. Uma operação de undo.',
    input: z.object({
      name: z.string().max(120).optional(),
      parent_id: z.string().optional(),
      index: z.number().int().nonnegative().optional(),
      nodes: z.array(z.object({ id: z.string().min(1).max(80).optional(), x: z.number(), y: z.number() }).strict()).min(2).max(200),
      segments: z.array(z.object({ id: z.string().min(1).max(80).optional(), from: z.string(), to: z.string(), kind: z.enum(['line', 'cubic']).optional(), hout_from: z.object({ x: z.number(), y: z.number() }).optional(), hin_to: z.object({ x: z.number(), y: z.number() }).optional() }).strict()).min(1).max(400),
      fill: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
      stroke: z.record(z.string(), z.any()).nullable().optional(),
    }).strict(),
  }),
  defineTool({
    name: 'edit_vector_shape',
    write: true,
    description: 'Altera os parâmetros de um polígono ou estrela paramétrico sem substituir o SVG: sides (3–24) e inner_ratio (0–1, usado na estrela) são regenerados de forma determinística e viram um único passo de undo. Use get_layer/inspect_vector para confirmar que a camada tem shape.kind.',
    input: z.object({
      id: z.string().describe('id da camada path paramétrica'),
      sides: z.number().int().min(3).max(24).describe('quantidade de lados/pontas').optional(),
      inner_ratio: z.number().gt(0).lte(1).describe('raio interno da estrela, entre 0 e 1').optional(),
    }).refine((value) => value.sides !== undefined || value.inner_ratio !== undefined, { message: 'Informe sides ou inner_ratio para alterar a forma.' }),
  }),
  defineTool({
    name: 'set_path_effect',
    write: true,
    description: 'Aplica ou remove o efeito vetorial não destrutivo de cantos arredondados. A geometria original e seus nós permanecem intactos; radius controla a distância do canto em unidades do viewBox e a operação tem undo.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      kind: z.enum(['round-corners', 'none']).describe('round-corners aplica; none remove').optional(),
      radius: z.number().positive().max(100000).describe('raio do arredondamento em unidades do viewBox').optional(),
    }),
  }),
  defineTool({
    name: 'interpolate_vectors',
    write: true,
    description: 'Cria um novo vetor entre dois paths compatíveis, interpolando posição, tamanho, nós e alças Bézier. As fontes permanecem intactas; exige a mesma quantidade de contornos, nós, fechamento e viewBox e registra um único undo.',
    input: z.object({
      from_id: z.string().describe('id do vetor inicial'),
      to_id: z.string().describe('id do vetor final'),
      t: z.number().min(0).max(1).describe('posição da interpolação: 0 = início, 1 = fim').optional(),
      name: z.string().max(120).optional(),
    }),
  }),
  defineTool({
    name: 'shape_builder',
    write: true,
    description: 'Cria uma nova forma a partir de regiões das formas selecionadas. points são coordenadas do canvas dentro das regiões a manter; mode add mantém as regiões e mode subtract remove-as da forma base. As fontes não são destruídas e o resultado tem undo.',
    input: z.object({
      ids: z.array(z.string()).min(2).max(6).describe('2 a 6 ids de formas fechadas'),
      points: z.array(z.object({ x: z.number(), y: z.number() })).min(1).max(64).describe('pontos do canvas nas regiões desejadas'),
      mode: z.enum(['add', 'subtract']).optional(),
    }),
  }),
  defineTool({
    name: 'reverse_vector',
    write: true,
    description: 'Inverte a direção dos segmentos de um vetor sem trocar sua identidade, preservando curvas ao trocar as alças hin/hout. Sem contour_index inverte todos os contornos; com ele inverte somente aquele contorno. Uma operação de undo.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      contour_index: z.number().int().nonnegative().describe('contorno específico; omita para inverter todos').optional(),
    }),
  }),
  defineTool({
    name: 'split_vector_contour',
    write: true,
    description: 'Divide um contorno em dois caminhos abertos no node_index, duplicando o nó de corte e preservando a geometria. Para contorno fechado, a aresta de fechamento também é preservada. Uma operação de undo.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      contour_index: z.number().int().nonnegative().optional(),
      node_index: z.number().int().positive().describe('nó onde a divisão acontece; não pode ser a primeira nem a última posição'),
    }),
  }),
  defineTool({
    name: 'simplify_vector',
    write: true,
    description: 'Reduz nós redundantes de contornos retos e Bézier (abertos ou fechados) com Ramer–Douglas–Peucker seguido de ajuste cúbico, preservando o ID, as alças editáveis e uma operação de undo. tolerance é a distância máxima em unidades do viewBox; contornos que não ganham redução permanecem intactos.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      contour_index: z.number().int().nonnegative().describe('contorno específico; omita para simplificar todos').optional(),
      tolerance: z.number().positive().max(10000).describe('desvio máximo permitido em unidades do vetor; padrão 1').optional(),
    }),
  }),
  defineTool({
    name: 'join_vector_contours',
    write: true,
    description: 'Une o contorno principal e os subcontornos de um vetor path em um único caminho aberto, preservando nós e alças, o ID e uma operação de undo. Use depois de split_vector_contour ou quando o vetor tiver vários subcaminhos editáveis.',
    input: z.object({
      id: z.string().describe('id da camada path com pelo menos dois contornos'),
    }),
  }),
  defineTool({
    name: 'stroke_to_path',
    write: true,
    description: 'Converte strokes centrais em formas preenchidas editáveis, achatando curvas com tolerance e preservando o ID em um único undo. Caminhos abertos aceitam pontas butt, square e round e tracejados/pontilhados viram subcaminhos separados; caminhos fechados sólidos e subcaminhos viram anéis com fillRule evenodd. Recusa tracejados fechados e posições inside/outside, que exigem regras geométricas diferentes.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      tolerance: z.number().positive().max(100).describe('tolerância do achatamento de curvas em unidades do vetor; padrão 0.5').optional(),
    }),
  }),
  defineTool({
    name: 'offset_path',
    write: true,
    description: 'Desloca contornos fechados de um vetor pela distância indicada, positiva para fora e negativa para dentro, preservando o ID e registrando um único undo. Curvas são achatadas com tolerance; contour_index limita a um contorno. Recusa caminhos abertos e distância zero para não alterar a geometria silenciosamente.',
    input: z.object({
      id: z.string().describe('id da camada path'),
      distance: z.number().finite().min(-100000).max(100000).refine((v) => v !== 0, 'distance não pode ser zero'),
      contour_index: z.number().int().nonnegative().optional(),
      tolerance: z.number().positive().max(100).describe('tolerância ao achatar curvas; padrão 0.5').optional(),
    }),
  }),
  defineTool({
    name: 'audit_svg',
    write: false,
    description: 'Audita um SVG antes da importação: valida o documento, informa dimensões, tipos de camadas editáveis, quantidade convertida e recursos ignorados. Não cria nem altera projeto; use o resultado para decidir se a importação é fiel.',
    input: z.object({
      svg: z.string().min(1).max(2_000_000).describe('conteúdo completo do arquivo SVG'),
      name: z.string().max(120).optional(),
      current_color: z.string().optional(),
      fill: z.string().optional(),
      size: z.number().positive().max(4096).optional(),
    }),
  }),
  defineTool({
    name: 'import_svg',
    write: true,
    description: 'Importa um SVG como vetor(es) editável(is), preservando caminhos, curvas, transformações, gradientes, textos simples e grupos suportados. Máscaras, filtros ou referências externas não suportados são informados no resultado, nunca ocultados. Dentro de parent_id entra no frame; sem parent_id entra na página.',
    input: z.object({
      svg: z.string().min(1).max(2_000_000).describe('conteúdo completo do arquivo SVG'),
      name: z.string().max(120).optional(),
      parent_id: z.string().optional(),
      index: z.number().int().optional(),
      current_color: z.string().optional(),
      fill: z.string().optional(),
      size: z.number().positive().max(4096).optional(),
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
    name: 'create_effect_styles',
    write: true,
    description: 'Cria ESTILOS DE SOMBRA do projeto (ex.: "Card", "Elevado"): uma ou mais sombras cada. Viram variáveis de CSS (--sombra-card). Ligue camadas com update_layer: {"effectStyleId": id}; mudar o estilo atualiza todas. Fazer shadows à mão numa camada solta o estilo.',
    input: z.object({
      styles: z.array(z.object({
        name: z.string(),
        shadows: z.array(z.object({
          x: z.number().optional(), y: z.number().optional(), blur: z.number().min(0).optional(), spread: z.number().optional(),
          color: z.string().describe('#RRGGBB').optional(), opacity: z.number().min(0).max(1).optional(), inset: z.boolean().optional(),
        })),
      })),
    }),
  }),
  defineTool({
    name: 'create_gradient_styles',
    write: true,
    description: 'Cria ESTILOS DE GRADIENTE do projeto (ex.: "Marca"): type linear/radial/conic, angle em graus (linear/conic) e stops [{color, pos 0..100, opacity}]. Viram variáveis de CSS (--gradiente-marca). Ligue camadas com update_layer: {"fill": {"gradientId": id}}.',
    input: z.object({
      styles: z.array(z.object({
        name: z.string(),
        type: z.enum(['linear', 'radial', 'conic']).optional(),
        angle: z.number().optional(),
        stops: z.array(z.object({ color: z.string().describe('#RRGGBB'), pos: z.number().min(0).max(100).optional(), opacity: z.number().min(0).max(1).optional() })).min(2),
      })),
    }),
  }),
  defineTool({
    name: 'create_text_styles',
    write: true,
    description: 'Cria ESTILOS DE TEXTO do projeto (ex.: Título, Corpo, Legenda): fonte, tamanho, peso, altura de linha, espaçamento. Depois aplique com apply_text_style; mudar o estilo atualiza todos os textos ligados. Veja os existentes em get_document (textStyles).',
    input: z.object({
      styles: z.array(z.object({
        name: z.string(),
        fontFamily: z.string().optional(),
        fontSize: z.number().positive().describe('px').optional(),
        fontWeight: z.number().int().min(100).max(900).optional(),
        fontStyle: z.enum(['normal', 'italic']).optional(),
        lineHeight: z.number().positive().describe('multiplicador, ex.: 1.4').optional(),
        letterSpacing: z.number().describe('px').optional(),
        wordSpacing: z.number().describe('px').optional(),
      })),
    }),
  }),
  defineTool({
    name: 'apply_text_style',
    write: true,
    description: 'Liga camadas de TEXTO a um estilo de texto (create_text_styles): elas passam a seguir o estilo. style_id vazio/null desliga (o texto mantém os valores atuais).',
    input: z.object({
      ids: z.array(z.string()),
      style_id: z.string().nullable().optional(),
    }),
  }),
  defineTool({
    name: 'add_color_mode',
    write: true,
    description: 'Cria um MODO de cor (ex.: "Escuro"). Com auto:true, gera os valores de todos os estilos de cor invertendo a luminosidade (ajuste depois com set_style_color). scheme "dark"/"light" faz o site exportado escolher o modo pela preferência do sistema; sem scheme, só vale com <html data-theme="nome">. Devolve o id do modo.',
    input: z.object({
      name: z.string(),
      scheme: z.enum(['dark', 'light']).optional(),
      auto: z.boolean().optional(),
    }),
  }),
  defineTool({
    name: 'set_style_color',
    write: true,
    description: 'Muda a cor de um ESTILO de cor, no valor padrão ou num modo (mode_id de add_color_mode / get_document colorModes). Todas as camadas ligadas ao estilo seguem.',
    input: z.object({
      style_id: z.string(),
      color: z.string().describe('#RRGGBB'),
      mode_id: z.string().describe('omita para o valor padrão').optional(),
      opacity: z.number().min(0).max(1).optional(),
    }),
  }),
  defineTool({
    name: 'create_size_variables',
    write: true,
    description: 'Cria VARIÁVEIS DE TAMANHO (px) reutilizáveis: espaçamentos, raios, tamanhos de fonte (viram --nome no CSS). Ligue camadas com bind_variable; mudar o valor da variável atualiza todas. Se o nome já existe, o valor é atualizado.',
    input: z.object({
      variables: z.array(z.object({ name: z.string(), value: z.number().min(0) })),
    }),
  }),
  defineTool({
    name: 'bind_variable',
    write: true,
    description: 'Liga um campo de camadas a uma variável de tamanho: gap e padding (frames com layout), radius, fontSize (texto). variable_id vazio/null desliga. A camada recebe o valor da variável na hora.',
    input: z.object({
      ids: z.array(z.string()),
      prop: z.enum(['gap', 'padding', 'radius', 'fontSize']),
      variable_id: z.string().nullable().optional(),
    }),
  }),
  defineTool({
    name: 'export_tokens',
    write: false,
    description: 'Exporta os TOKENS do design (cores com modos, estilos de texto, variáveis de tamanho) para quem vai programar: "css" (variáveis :root, modos por data-theme/prefers-color-scheme e classes .texto-*), "json" (tokens neutros) ou "tailwind" (tailwind.config.js + tokens.css; as cores usam as variáveis, então os modos funcionam). Devolve os arquivos com o conteúdo.',
    input: z.object({ format: z.enum(['css', 'json', 'tailwind']) }),
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
    name: 'inspect_layout',
    write: false,
    description: 'Inspeciona medidas reais em TEXTO para agentes sem imagens, usando Chromium isolado. id é uma tela (frame raiz ou dentro de seção raiz); renderiza a tela inteira. Escolha breakpoint OU width (200..4000px inteiros), ou a largura desktop da tela. within_id limita só a resposta à subárvore; depth relativo ao escopo, padrão1. Lista compacta/paginada, padrão20 linhas/8KiB: posição/tamanho em pixels CSS relativos à tela, rendered/visible, padding/gaps e tipografia computada. overflow indica saída horizontal da janela, saída do pai ou conteúdo maior que a caixa, não prova erro/recorte. Não detecta sobreposição/oclusão. count=entregues, total=camadas no escopo/profundidade; offset:nextOffset enquanto hasMore; reinicie após alterações. Não altera dimensões base nem devolve HTML/texto/imagens. Sem Chromium, erro explícito; get_layer/get_code continuam disponíveis.',
    input: z.object({
      id: z.string(),
      breakpoint: z.string().optional(),
      width: z.number().int().min(200).max(4000).optional(),
      within_id: z.string().optional(),
      depth: z.number().int().min(0).max(8).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().nonnegative().optional(),
      maxBytes: z.number().int().min(1024).max(65536).optional(),
    }),
  }),
  defineTool({
    name: 'check_design',
    write: false,
    description: 'Relatório paginado: padrão20/8KiB, limit até60, offset:nextOffset enquanto hasMore, totais completos. checked informa o que foi conferido; sem medições não afirma sucesso completo. checks opcionais styles/touch: sugere vínculos existentes na paleta/tipografia e mede links/botões por largura (44px até640px,24px acima), sem certificar WCAG. Touch requer tela raiz, usa Chromium no contexto inteiro, maxTargets padrão200/até1000; ao exceder ou falhar avisa NÃO conferido. Não verifica oclusão, exceções nem botões internos do HTML manual. Recomece paginação após alterações. AUDITA o design e diz o que consertar: conteúdo que VAZA da tela em cada breakpoint (texto que não quebra linha, largura fixa grande no celular), contraste de texto abaixo do WCAG, texto menor que 12px e imagens sem alt. Cada problema traz a camada, onde acontece e como corrigir. Rode ao terminar uma tela e depois de set_responsive. Sem id, confere todas as telas da página atual. O vazamento exige o navegador do servidor (o resto funciona sem).',
    input: z.object({
      id: z.string().describe('id de uma tela (opcional)').optional(),
      breakpoints: z.array(z.string()).max(10).describe('ids de breakpoints a conferir além do desktop (padrão: todos do projeto)').optional(),
      checks: z.array(z.enum(['styles','touch'])).max(2).refine(values => new Set(values).size === values.length, 'Não repita checks.').optional(),
      limit: z.number().int().min(1).max(60).optional(),
      offset: z.number().int().nonnegative().optional(),
      maxBytes: z.number().int().min(1024).max(65536).optional(),
      maxTargets: z.number().int().min(1).max(1000).optional(),
    }),
  }),
  defineTool({
    name: 'get_image',
    write: false,
    description: 'VÊ o design: devolve um PNG da camada (ou da tela inteira). Use para conferir o resultado depois de montar ou alterar algo. Sem id, usa a seleção ou a primeira tela da página. (No Assistente interno a imagem não chega ao modelo; no MCP, sim.)',
    input: z.object({
      id: z.string().optional(),
      scale: z.number().describe('0.5 a 2 (padrão 1)').optional(),
      breakpoint: z.string().describe('id de um breakpoint (tablet, mobile...; veja get_document → breakpoints): desenha a tela nessa largura, com as regras de set_responsive aplicadas. Use para CONFERIR o responsivo.').optional(),
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
      format: z.enum(['html', 'react']).describe('html (padrão): site estático. react: projeto Vite + React (um componente por tela, CSS Modules, tokens, imagens em public/), pronto para npm install && npm run dev.').optional(),
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
      id: z.string().describe('uma camada (ou use ids para várias de uma vez: um único passo no desfazer)').optional(),
      ids: z.array(z.string()).max(100).optional(),
      breakpoint: z.string().describe('id do breakpoint (ex.: "tablet", "mobile" ou um personalizado listado em get_document)'),
      props: z.record(z.string(), z.any()).optional(),
      reset: z.boolean().describe('true APAGA todos os ajustes desta camada neste breakpoint (volta a herdar do Desktop); props é ignorado').optional(),
    }),
  }),
  defineTool({
    name: 'set_state',
    write: true,
    description: 'Define como a camada fica no :hover, :active (pressionado) ou :focus-visible (foco do teclado) — vira .classe:hover no CSS, com a transição da camada. Aceita: fill, stroke, radius, shadows, blur, bgBlur, opacity, blend, scale (ex.: 1.03). Ex.: botão escurece no hover: {"state": "hover", "props": {"fill": "#991B1B"}}.',
    input: z.object({
      id: z.string().describe('uma camada (ou use ids para várias de uma vez: um único passo no desfazer)').optional(),
      ids: z.array(z.string()).max(100).optional(),
      state: z.enum(['hover', 'active', 'focus']),
      props: z.record(z.string(), z.any()).optional(),
      reset: z.boolean().describe('true APAGA as sobrescritas deste estado (a camada volta ao normal nele); props é ignorado').optional(),
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
    description: 'Duplica camadas (com tudo dentro). Em flex/grid, a cópia entra logo depois do original. Com moves, já leva as cópias para outro pai/posição na MESMA chamada (um único desfazer); em moves, id é o da camada ORIGINAL.',
    input: z.object({
      ids: z.array(z.string()),
      moves: z.array(z.object({
        id: z.string(),
        parent_id: z.string().optional(),
        index: z.number().int().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
      })).optional(),
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
      rx: z.number().min(0).max(1).describe('onde o pino fica na largura da camada (0 = esquerda, 1 = direita; padrão 1)').optional(),
      ry: z.number().min(0).max(1).describe('onde o pino fica na altura da camada (0 = topo, 1 = base; padrão 0)').optional(),
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
    description: 'EDITA A FOTO de uma camada com imagem (preenchimento de imagem), sem IA externa e sem chave. No servidor usa Chromium isolado: girar/espelhar, recortar (crop em px da imagem ou ratio), remover o fundo (automático: tira a cor das bordas; melhor com fundo liso), filtro pronto, ajustes (-100..100; sharpen 0..100; blur 0..40 px) e largura máxima/formato/qualidade. Ordem: girar → recortar → remover fundo → filtro → ajustes → tamanho. Grava uma imagem NOVA (a original fica guardada) e é um passo do Ctrl+Z. restore_original: true volta para a imagem de antes das edições. Fundo removido sai em PNG transparente. Limites do servidor: 16 MB, lado até 8192 px, 16 milhões de pixels; filtros/ajustes/fundo até 4 milhões de pixels após recorte. Para fotos maiores, primeiro reduza com max_width em outra chamada. Não faz edição generativa nem preserva animação de GIF.',
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
    description: 'Edição GENERATIVA: não está disponível pelo MCP do servidor atual. Use edit_image para ajustes locais sem IA externa. A definição é mantida para adaptadores que forneçam geração explicitamente: fill preenche a área; replace troca o objeto; expand inventa margens; generate cria imagem nova. area em % e expand em px. Não configure nem use chaves externas sem autorização da pessoa.',
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
      file: z.string().describe('nome do projeto, ex.: meu-site'),
    }),
  }),
  defineTool({
    name: 'save_project',
    write: true, noLock: true,
    description: 'Grava o projeto aberto na pasta (o servidor também grava sozinho depois de cada alteração). Com name, salva uma cópia com esse nome e passa a trabalhar nela.',
    input: z.object({
      name: z.string().describe('nome do projeto').optional(),
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
    name: 'get_project_map',
    write: false, needs: 'read',
    description: 'Resumo do projeto em Markdown para quem vai CONSTRUIR o produto: telas e tamanhos, breakpoints, design system (cores, textos, medidas, componentes), estrutura com os textos reais, navegação, decisões e pendências. Comece por aqui ao receber um protótipo do Stylo.',
    input: z.object({
      depth: z.number().int().describe('profundidade da estrutura de cada tela, 1 a 8 (padrão 4)').optional(),
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
    description: 'Compartilha o projeto aberto com uma pessoa que já tem conta (só o dono). role "editor" altera; "commenter" comenta; "viewer" só lê.',
    input: z.object({
      email: z.string(),
      role: z.enum(['editor', 'commenter', 'viewer']).optional(),
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
  // Argumento que a ferramenta não conhece (erro de digitação, nome trocado): o Zod o descartaria em silêncio e o agente
  // acharia que filtrou/alterou algo que não valeu. Recusamos dizendo quais nomes existem.
  const accepted = Object.keys((tool.input as any).shape ?? {});
  if (args && typeof args === 'object' && !Array.isArray(args) && accepted.length) {
    const unknown = Object.keys(args).filter((k) => !accepted.includes(k));
    if (unknown.length) return `Argumento desconhecido em ${name}: ${unknown.join(', ')}. Aceitos: ${accepted.join(', ')}.`;
  }
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
