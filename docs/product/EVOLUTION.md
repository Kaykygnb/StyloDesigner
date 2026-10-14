# Evolução do produto

Registro de planejamento de 2026-10-14. Não muda runtime. A visão curta continua em [VISION.md](VISION.md). O índice de trabalho continua em [BACKLOG.md](../planning/BACKLOG.md) e [ROADMAP.md](../planning/ROADMAP.md). Decisões humanas de conta e autoridade estão na [ADR 0002](../architecture/adr/0002-self-hosted-administration.md).

Fotografia do código: branch `v0.1.0-beta`, commit `31f16bf`. As PRs [#17](https://github.com/Kaykygnb/StyloDesigner/pull/17) e [#18](https://github.com/Kaykygnb/StyloDesigner/pull/18) estão abertas e não entraram nesta fotografia.

## O que o produto já é

O Stylo é um editor visual local. A pessoa e o agente mudam o mesmo documento pelas ferramentas do núcleo. O Studio não grava o documento por fora dessas ferramentas. O MCP transporta as mesmas ferramentas; não é um segundo conjunto de regras.

Inventário gerado: 120 ferramentas (97 do núcleo, 23 de plugins). Conferido com `npm run docs:inventario -- --check` nesta entrega. Lista em [TOOL-INVENTORY.md](../testing/TOOL-INVENTORY.md).

Já existem, com código e testes citados na [matriz de capacidades](CAPABILITIES.md): documento com páginas e camadas, layout, estilos e variáveis, componentes e instâncias (`create_component`, `create_instance`), estados visuais, interações de protótipo, exportação HTML/site/React/tokens/zip, contas, agentes, presença, locks e biblioteca de assets.

## Editor vetorial — o que o código faz

O proprietário afirmou que o editor vetorial já está completo. A leitura do código confirma um editor vetorial real no núcleo, no Studio e nas ferramentas. Isto não é um plano. Não trata ausência de uma biblioteca externa como falta.

| Capacidade | Onde está |
|---|---|
| Caminho com pontos e alças Bézier cúbicas (`hin` / `hout`), vários contornos, fechado ou aberto, `fillRule` nonzero ou evenodd | `model.ts` (tipo `path`), `css.js` `nodePathData` / `pathSvg` |
| Caneta (clique cria ponto, arraste cria curva) e lápis (traço livre simplificado em curvas) | `PenOverlay.tsx`, `geom.js` `smoothStroke` / `fitCurve` |
| Edição de nós no canvas: mover nó, arrastar alça, vários nós com Shift, setas (1 px, Shift 10 px). Aparece nas ferramentas Nó e Inspecionar, com um path selecionado | `SelectionOverlay.tsx` `VectorNodeOverlay`, `Canvas.tsx` |
| Edição de um nó por ferramenta, com índice estável, inclusive outro contorno: posição parcial, alça ou `null`, modo `corner` / `smooth` / `symmetric` / `free` | `edit_vector_node`, `commands.js` |
| Polígono e estrela paramétricos (3–24 lados) regenerados sem trocar o id | `edit_vector_shape` |
| Rede de junções e segmentos `line` ou `cubic`, guardada em `vectorNetwork` e também como contornos | `create_vector_network` |
| Booleanas união, subtração, interseção e exclusão entre paths, retângulos, elipses e frames vazios. As fontes ficam em `boolean.sources` e podem ser editadas; o resultado visível é o polígono reajustado em curvas | `commands.js` `booleanOp`, `geom.js` `booleanPolygons`, `Toolbar.tsx`, `arrange_layers` |
| Shape builder: regiões apontadas, modo add ou subtract, 2 a 6 formas | `shape_builder` |
| Contorno: cor, opacidade, espessura, sólido/tracejado/pontilhado, traço personalizado, ponta butt/round/square, junção round/miter/bevel, marcadores arrow/circle/square, alinhamento center/inside/outside em path fechado | `StrokeSection.tsx`, `css.js` `pathSvg` |
| Contorno vira forma preenchida; deslocar contorno fechado; simplificar (Ramer–Douglas–Peucker e ajuste cúbico); dividir; unir; inverter direção; interpolar dois paths com a mesma topologia; cantos arredondados sem destruir os nós | `stroke_to_path`, `offset_path`, `simplify_vector`, `split_vector_contour`, `join_vector_contours`, `reverse_vector`, `interpolate_vectors`, `set_path_effect` |
| Importar SVG como vetor editável: `path` (M L H V C S Q T A Z), retângulo, círculo, elipse, linha, polyline, polígono, transformações, estilo herdado, gradiente linear/radial aproximado, sombra, clip simples vira máscara | `svgimport.js`, `import_svg`, `audit_svg` |
| Exportar SVG de formas, texto, gradientes, sombras e máscaras. O path no canvas e no HTML usa o mesmo `pathSvg` | `svg.js` `toSvg` |
| Auditoria e inspeção sem converter para SVG | `audit_vector`, `inspect_vector` |
| Testes de área das booleanas, furo, bordas coincidentes e reajuste de curva; booleanas pelo mesmo contrato do editor, com fontes preservadas | `tests/geom.test.js`, `tests/arrange.test.ts` |

### Limites que o próprio código declara

Estes itens estão escritos no código. Não são suposições de lacuna.

- `stroke_to_path` recusa tracejado fechado e posição inside/outside (`schema.ts`).
- `offset_path` recusa caminho aberto e distância zero.
- `interpolate_vectors` exige a mesma quantidade de contornos, nós, fechamento e viewBox.
- A booleana achata as curvas em polígonos e reajusta. O comentário em `booleanOp` diz que o resultado pode ter mais pontos. As alças originais ficam nas fontes, não no contorno achatado.
- `svg.js` omite sombra interna e `backdrop-filter`. Contorno inside/outside é aproximado. Gradiente cônico no SVG usa a primeira parada (`svgPaint`).
- `svgimport.js` avisa e não importa: máscara de luminância, imagem embutida, texto em curva, `<use>` externo, animação e filtro que não seja sombra.
- O overlay de nós desenha `node.points` (contorno principal). Outro contorno é editável pela ferramenta `edit_vector_node`, com `contour_index`.

Não há ferramenta separada chamada `export_svg`. A exportação SVG é `toSvg` / `pathSvg`, usada pelo canvas, pelo HTML e pelo modo apresentar.

## O que ainda não está no código

Isto é ausência verificada (não há tipo, ferramenta ou leitor), distinta dos limites do vetor.

| Tema | Evidência |
|---|---|
| PDF e PPTX | Nenhuma ferramenta ou dependência desses formatos |
| Modelo 3D / glTF | Nenhum tipo de camada 3D |
| JavaScript de comportamento no documento | Protótipo é declarativo (`trigger`, `action`, `transition` em `model.ts`). O site exportado avisa que a interação de protótipo não roda (`site-export.ts`) |
| Conta sem e-mail | `User.email` é obrigatório e único; `login` busca por e-mail (`auth.ts`). O campo `name` é nome de exibição |
| OWNER principal no runtime desta fotografia | O schema em `31f16bf` não tem ponteiro de principal. A PR #18, não mergeada, adiciona esse ponteiro |
| Canal de eventos com identidade | `GET /api/agent/events` aceita nome e projeto pela query (`events.ts`, `system.ts`) |
| Suspensão que corta o agente | DOC-SERVER-007 registrou agente ainda válido depois do dono suspenso. Não reexecutei esse teste nesta entrega |

## Arquitetura que se mantém

O núcleo (`packages/core`) continua dono do documento, dos comandos e das ferramentas. Não importa React, Hono, Prisma, arquivo ou rede. Isso já é regra em [PRINCIPLES.md](../architecture/PRINCIPLES.md).

Importador, exportador, canvas, MCP e um futuro visor 3D são adaptadores. Eles convertem para o documento e de volta. Não criam uma segunda árvore de objetos com regras próprias.

Regra prática: capacidade nova nasce como ferramenta no núcleo e só depois vira botão. Dado que o editor ainda não desenha permanece no documento. O validador hoje remove chaves perigosas e corrige número ou palavra-chave inválidos; não apaga um campo desconhecido só por não reconhecê-lo (`validate.ts`).

3D, quando existir, entra como elemento especializado: referência glTF/GLB mais transformação no documento, e um adaptador de visualização por fora do núcleo. Não é um segundo editor.

## Bibliotecas citadas

Consulta em 2026-10-14 às páginas oficiais e aos repositórios. Nenhuma foi instalada.

| Nome | Identidade verificada | Licença | Encaixe |
|---|---|---|---|
| VectorCraft | Aplicativo de ilustração em Rust, repositório `storytold/vectorcraft` (ArtCraft). Não é pacote npm. Usa interface própria (egui) e renderer (vello) | MIT ou Apache-2.0, à escolha. Marca ArtCraft não é open source | Não incorporar. O Stylo já tem editor vetorial. `kurbo` e `linesweeper` (os dois MIT ou Apache-2.0) são bibliotecas de curva e booleana em Rust, úteis só se um teste futuro mostrar defeito medido na booleana atual |
| Paper.js | `paperjs/paper.js`, cena 2D e caminhos | MIT | Não usar como modelo do documento. Seria outra árvore de objetos ao lado do núcleo |
| Fabric.js | `fabricjs/fabric.js`, cena em canvas | MIT | Mesma razão |
| Konva | `konvajs/konva`, cena em canvas | MIT | Mesma razão |
| PptxGenJS | `gitbrent/PptxGenJS` 4.0.1 | MIT | Só escreve PPTX. Não lê apresentação. Não serve para importar |
| PDF.js | Mozilla `mozilla/pdf.js` | Apache-2.0 | Lê e desenha PDF. Não vira documento editável sozinho |
| pdf-lib | `Hopding/pdf-lib` | MIT | Cria e altera PDF. Não interpreta layout CSS. Citada como alternativa de geração, não como pedido do proprietário |
| Three.js | `mrdoob/three.js` | MIT | Adaptador de visualização, se o 3D for aprovado para implementação. Fora do núcleo |
| React Three Fiber | `pmndrs/react-three-fiber` | MIT | Depende de React. Não entra em `packages/core` |
| Babylon.js | motor WebGL/WebGPU | Apache-2.0 | Segundo motor. Não adotar junto com Three.js |
| glTF 2.0 | Especificação Khronos, não biblioteca | Royalty-free | Formato de troca para um futuro elemento 3D |

Inkscape, Figma, Penpot, Illustrator, Rive, Framer, ProtoPie, Spline e Blender são referências de produto. Não são dependências e não se copia interface nem arquivo.

## Onde a sugestão técnica não foi seguida

- Não substituir o editor vetorial por VectorCraft, Paper.js, Fabric.js ou Konva. O editor já está no núcleo e nas ferramentas. Trocar a cena duplicaria regras e afastaria o MCP do documento.
- Não prometer importação PPTX com PptxGenJS. A biblioteca não lê o arquivo.
- Não colocar Three.js, React Three Fiber ou Babylon no núcleo. 3D fica para o horizonte C, como adaptador.
- Não abrir uma segunda aplicação “pessoal” sem conta. A decisão 2.1 proíbe isso. O modo `STYLO_AUTH=local` existe no código e conflita; a retirada é migração (DOC-SERVER-009), não um atalho nesta entrega.

## Horizontes

Não são versões nem datas.

### A — Beta e alpha local

Estabilidade, conta, o que já exporta, e uma alpha instalável. Detalhe da alpha na [roadmap](../planning/ROADMAP.md). Tarefas já existentes: DOC-SERVER-006 (PR #18), DOC-SERVER-007, DOC-SERVER-008, DOC-SERVER-009, DOC-STUDIO-003, DOC-STUDIO-006, DOC-SERVER-010, DOC-ADMIN-002. A preparação da alpha é DOC-ENG-006.

### B — Evolução em cima do que existe

CSS que o documento já representa e a pessoa ainda manipula mal; protótipo e animação simples em cima de `interactions` e `states`; interoperabilidade SVG nos limites que o importador já declara. Não reescrever o vetor. Cada item só vira tarefa quando houver um defeito reproduzido ou um pedido de produto ainda sem tarefa.

### C — Estrutural

Remake visual (DOC-STUDIO-005, depende de direção humana). Modelo para 3D, PDF, slides e comportamento programável, cada um como adaptador, com perda declarada. Propriedade organizacional completa, transferência e códigos offline: decisões já aprovadas, implementação ainda não autorizada por este registro.

## Alpha pública

O alvo é uma alpha **local**: a pessoa instala, cria a conta e desenha. Não é um site multi-usuário na internet. Hospedar para desconhecidos continua em DOC-SERVER-008 e fica de fora.

Entra: o editor atual (layout, texto, componentes, vetor como acima, protótipo de navegar, comentários), exportação HTML/React/tokens/zip, agentes MCP nas ferramentas reais, contas com senha no modo padrão.

Não entra: 3D, PDF, PPTX, React Native, JavaScript livre, remake visual, transferência de principal, códigos offline, acesso automático de OWNER a projeto privado, suspensão completa de agente em voo.

Bloqueios antes de publicar: merge das PRs #17 e #18; segurança do que responder sem login se o processo for alcançado fora da máquina; `npm install` e `npm start` na primeira tentativa; README com um demo curto; limitações conhecidas escritas nesse README. Tarefa: [DOC-ENG-006](../planning/tasks/engineering/DOC-ENG-006.md).
