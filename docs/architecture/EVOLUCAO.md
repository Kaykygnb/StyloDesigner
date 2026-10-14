# Evolução do Stylo — investigação, arquitetura proposta e horizontes

Fonte: diretriz do proprietário de 2026-10-14 (decisões em [ADR 0002](adr/0002-self-hosted-administration.md)). Registro por [Claude Code] em `v0.1.0-beta` + `metaClaude` (commit-base `48b11e1`). **Isto é proposta técnica, não decisão aprovada**, salvo onde indicado. Nenhum código foi alterado. Inventário detalhado de capacidades: [product/CAPABILITIES.md](../product/CAPABILITIES.md) e [TOOL-INVENTORY.md](../testing/TOOL-INVENTORY.md); não repetido aqui.

Legenda de evidência: **[lido]** li o código nesta sessão; **[relatório]** vem do inventário de 14/10 (pasta de arquivos do projeto, fora do repositório) (leitura de código, não execução); **[web]** fonte externa consultada hoje; **[não verificado]**.

## 1. O que já existe (e muda o plano)

Vários itens da diretriz **já têm base**; planejar como "do zero" seria desperdício.

| Tema da diretriz | Situação real | Evidência |
|---|---|---|
| Vetores: paths, nós, tangentes, booleanas, SVG import | Existe (caneta, redes vetoriais, `booleanPolygons`). **Limite:** a booleana achata curvas em polígonos (`flattenContour`), então o resultado perde as curvas Bézier originais. | [lido] `geom.js:14-15,357` |
| Estados interativos (hover, pressed, focus) e transições CSS | Existe: CSS por estado e `transition: all <ms> <easing>`. **Falta:** `disabled`, keyframes, sequenciamento, gatilhos além de CSS. | [lido] `css.js:372,838-856` |
| Interações de protótipo | Só `navigate`, `back`, `url` (+ campo `transition`). Sem overlays, estados de componente, condições. | [lido] `types.ts` `Interaction` |
| 3D | **Existe como camada de mídia** via `<model-viewer>` (GLB/glTF, Apache-2.0) e Lottie (MIT). Sem câmera/luz/animação editáveis no Stylo; o canvas não executa scripts, então o 3D só funciona no site exportado. | [lido] `media-runtime.ts:1,23`; licenças [web: npm] |
| CSS avançado | Cobre flex, grid, gradientes, blend, blur, backdrop blur, breakpoints, CSS à mão por camada/página. **Falta:** container queries na UI, keyframes, 3D transform, CSS nesting (descartado hoje), preservar CSS que o editor não entende. | [relatório] §3 |
| Componentes/instâncias, variáveis, modos de cor | Existem. **Falta:** variantes e props de componente. | [relatório] §2 |
| Exportar HTML/CSS (zip), React+Vite (estático), tokens | Existe. React sem componentes reutilizáveis nem TSX. PDF/PPTX/slides: não. | [relatório] §2,§4 |
| Importar | SVG e `.json` do Stylo. **Não importa HTML, PDF, PPTX.** | [relatório] §3 |
| JavaScript do usuário | **Não existe e é regra firme** (canvas sem `allow-scripts`, `CLAUDE.md`). | [lido] |
| MCP (FeatMCP) | 120 ferramentas, mesmo runner do painel. Nunca assumir que uma capacidade planejada tem ferramenta: consultar `TOOL-INVENTORY.md`. | [relatório] |

## 2. Honestidade sobre o que é realista

- **Estado do produto:** é um editor de **site estático** excelente em teoria; o fluxo exportar → abrir no navegador só foi comprovado num teste ponta a ponta em 14/10 (relatório "exportar ponta a ponta" de 14/10, na pasta de arquivos do projeto, fora do repositório). Nenhum cliente MCP real (Claude Desktop, Cursor) foi testado.
- **JavaScript programável, 3D editável, React Native e remake completo antes da beta estável são fora de ordem.** Cada um é meses de trabalho e abre superfície de segurança (JS) ou exige renderer novo (RN, 3D). Ficam no Horizonte C, atrás de pré-requisitos.
- **Administração self-hosted** já consumiu a maior parte do backlog (ver ADR 0002). As decisões de identidade agora estão fechadas; implementar o mínimo e voltar ao editor.
- **Nada aqui foi estimado em prazo.** Horizontes são ordem, não cronograma.

## 3. Arquitetura evolutiva proposta (hipótese a validar)

A hipótese do proprietário (núcleo de documento independente de editor, renderizadores, importadores, exportadores, plugins, MCP e adaptadores) **já é em grande parte verdade**: `packages/core` roda em Node puro, o painel só chama `tool()` e o MCP usa o mesmo runner (ADR 0001, [lido] `apps/studio/src/lib/api.ts`). Portanto **não proponho reescrita**; proponho 5 evoluções incrementais, nesta ordem:

1. **Preservação de dados desconhecidos (pré-requisito de tudo).** Hoje CSS/HTML fora da lista conhecida é barrado ou descartado (ex.: nesting). Antes de crescer o modelo: campo explícito `extras` por camada/página, com regra "o editor nunca apaga o que não entende" e teste de round-trip. Resolve o ponto §7 da diretriz sem inchar o painel.
2. **Versão do schema + migrações.** `version.ts` existe; formalizar `migrate(doc, from→to)` com fixtures de documentos antigos *antes* de qualquer campo novo (variantes, keyframes, 3D). Obrigatório pela diretriz ("preservar documentos existentes").
3. **Modelo declarativo de interação** (gatilho → condição → ação) como **dado** no documento, executado por um runtime pequeno *nosso* no preview e no export, nunca por JS arbitrário. Estende `Interaction` (hoje 3 ações). Cobre ~todo o §8 (overlays, trocar estado/variante, navegação, animações). É também o ponto de partida do §9: JS custom vira um *tipo de ação* opcional futuro, em sandbox separado.
4. **Interfaces de importador/exportador por registro** (`registerImporter/Exporter` com **relatório de fidelidade obrigatório**: o que preservou, aproximou, perdeu). Resolve §11.3 ("não perder silenciosamente"). Já há semente: matriz de exportação e warnings (DOC-CORE-002).
5. **Elemento 3D como tipo de mídia especializado** (continua o que existe), com dados de cena (câmera/luz/material) no documento só depois do item 1/2. Não é um segundo editor 3D.

Princípio de custo: cada capacidade nasce como ferramenta no core, depois botão (regra do `CLAUDE.md`), então MCP e painel evoluem juntos (§14).

## 4. Ferramentas e bibliotecas citadas — licença e adequação

Licenças de pacotes npm conferidas hoje via registro npm **[web]**. Isso é a licença *declarada no pacote*, **não** uma revisão jurídica nem de dependências transitivas; antes de adotar, rodar verificação de licenças da árvore completa e conferir `NOTICE`/obrigações. "Inspiração" ≠ "interoperabilidade" ≠ "copiar código" ≠ "reimplementar" (§6): só os dois últimos têm obrigação de licença.

| Item | Licença | Uso proposto | Veredito |
|---|---|---|---|
| **VectorCraft** | Identidade **não confirmada.** Achei um projeto "VectorCraft" (Rust, org `storytold`, MIT OR Apache-2.0, v0.8.0, com servidor MCP) **só em artigos de terceiros**; não consegui abrir o repositório (API do GitHub não respondeu daqui). Pode haver outros projetos com esse nome. | Estudar a ideia de booleanas exatas com Bézier preservadas. | **Perguntar ao proprietário qual VectorCraft ele quis dizer (link).** Não reutilizar nada antes de confirmar repositório, licença e dependências. Rust não entra direto num core TypeScript (só como WASM, custo alto). |
| Paper.js 0.12.18 | MIT | Booleanas **com curvas** (`unite/subtract/intersect/exclude`), offset de path. | **Melhor candidato** para substituir o achatamento de `booleanPolygons`. Roda em Node sem DOM (precisa de `paper-jsdom`/modo headless, **testar**). |
| paperjs-offset 2.2.1 | MIT | Contorno → forma (offset/stroke to path). | Candidato, depende de Paper.js. |
| polybooljs 1.2.2 | MIT | Booleanas poligonais. | Já temos equivalente; sem ganho. |
| Clipper (clipper-lib / clipper2-wasm) | **BSL** (Boost) | Offset/boolean polígonos robustos. | Licença permissiva, mas é polígono (mesmo limite); só se performance exigir. |
| Inkscape | GPL | Referência de recursos e UX. | **Só inspiração/interoperar via SVG.** Copiar código obrigaria GPL no Stylo; `LICENSE` não pode mudar sem decisão do proprietário. |
| Fabric.js 7.4.0 / Konva 10.8.0 | MIT / MIT | Canvas 2D com objetos. | **Não adotar:** o Stylo desenha DOM/CSS reais, não canvas; trocar o motor seria a reescrita que a diretriz proíbe. Útil como referência de seleção/transformação. |
| SVG nativo | — | Já usado nos vetores. | Manter. |
| Skia | BSD-3 (conhecimento geral, **não conferido hoje**) | — | Sem necessidade concreta; descartar por ora. |
| Three.js 0.186 / R3F 9.8 | MIT / MIT | Cena 3D editável (câmera, luz, material). | Horizonte C. R3F só faz sentido se exportarmos React; para HTML puro, Three direto ou `<model-viewer>`. |
| Babylon.js 9.30 | Apache-2.0 | Alternativa a Three. | Sem vantagem para o nosso caso; não duplicar motor. |
| `<model-viewer>` | Apache-2.0 | **Já usado.** | Manter para 3D "mostrar modelo"; é o caminho barato. |
| Spline / Blender | Spline: serviço proprietário [não verificado]; Blender: GPL | Referência de UX / de formatos. | Só referência. Interoperar por glTF/GLB (formato aberto Khronos). |
| PptxGenJS 4.0.1 | MIT | **Exportar** PPTX (slides) a partir das páginas. | Bom para exportar; fidelidade parcial (texto/formas/imagens). **Importar PPTX é outro problema** (precisa de leitor, não de PptxGenJS). |
| PDF.js (pdfjs-dist 6.4) | Apache-2.0 | **Ler/visualizar** PDF, extrair texto. | Bom para importar PDF como imagem/texto; converter em camadas editáveis é aproximado. |
| pdf-lib 1.17.1 | MIT | Gerar/manipular PDF. | Alternativa leve. **Mas** PDF fiel ao CSS vem melhor do Chromium (`page.pdf()`), que o renderer já usa (Playwright/Puppeteer Apache-2.0). Recomendo Chromium para PDF "renderizado/pesquisável" e deixar PDF "editável" como pesquisa. |
| lottie-web | MIT | Já usado. | Manter. |

## 5. Riscos, dependências e alternativas mais simples

| Pedido | Risco / dependência | Alternativa mais simples |
|---|---|---|
| Prototipação + animação (§8) | Precisa do modelo declarativo (§3.3) e do preview *com* runtime; o canvas é iframe sem scripts. | Primeiro: o que dá **só com CSS** (`:hover`, `:focus`, `<details>`, âncoras, `@keyframes`, `prefers-reduced-motion`), sem runtime. Cobre botão, accordion, fade/slide/scale. Runtime só para modal/tabs/overlay. |
| JS programável (§9) | Segurança: XSS, exfiltração, loop infinito. | Executar só no **preview isolado** (iframe `sandbox` de outra origem, sem cookies, com limite de tempo) e **só no exportado**; nunca no canvas. Decisão humana consciente. |
| 3D (§10) | Editor 3D é produto à parte. | Ficar em "colocar modelo GLB + câmera inicial + auto-rotate" (model-viewer). |
| React Native (§12.2) | Sem HTML/CSS/grid/gradiente reais; exige 2º gerador e 2º renderer. | Adiar. Responsivo + React web primeiro; Vue/Svelte são baratos (parte do mesmo HTML). Se RN for mesmo requisito, abrir ADR própria com um subconjunto declarado. |
| Importar HTML (§11) | Sanitização, fidelidade de CSS externo, scripts. | `import_html` como ferramenta do core reutilizando `sanitizeHtml`; importar *com relatório de fidelidade*. |
| Importar PPTX/PDF editável | Fidelidade ruim e custo alto. | Importar como imagem/referência primeiro (§11 tipo 1). |
| Remake visual (§5) | Risco de reescrever o que funciona; já há DOC-STUDIO-003 (usabilidade) e DOC-STUDIO-005 (redesign) sem dono. | Sequência: usabilidade (003) → direção visual aprovada pelo proprietário (005) → telas por grupos. Sem reescrita do editor. |
| Desempenho em documento grande (§15) | Sem medição; bundle do Studio 857 kB (`ROADMAP.md`). | Criar documento sintético grande e medir **antes** de prometer. |
| Contas/OWNER (§2-3) | Muita coisa não implementada (VIEWER, principal, códigos, transferência, ADM-DEC-05). | Entregar em fatias: principal+OWNER secundário → suspensão de agentes → códigos offline → transferência. Já mapeado em DOC-SERVER-006/007/009/010. |

## 6. Horizontes (ordem, sem datas)

**A — Beta atual (estabilidade).** Corrigir/entregar o que o produto já promete; provar com uso real.
- Bugs e fluxo ponta a ponta: exportar, abrir, celular (feito em 14/10; manter como teste de regressão).
- Cliente MCP real conectado (Claude Desktop/Cursor) — **maior lacuna do diferencial do produto**.
- Devolver o manual de uso à branch da beta (hoje só no `main`).
- Fatias mínimas de identidade que a beta exige: principal protegido, aviso de propriedade organizacional, suspensão de agentes (SERVER-006/007).
- Medir desempenho com documento grande; recuperação após falha.
- Decidir `STYLO_AUTH=local` (migração, DOC-SERVER-009).

**B — Incremental (sobre o que existe).**
- Preservação de CSS/HTML desconhecido + migrações de schema (§3.1–3.2) — habilita o resto.
- Booleanas vetoriais com curvas (Paper.js a validar) e contorno→forma.
- Animação/estados só-CSS: `disabled`, keyframes básicos, fade/slide/scale com easing/delay/repetição.
- Importar HTML (`import_html`) com relatório de fidelidade.
- React com componentes de verdade + TSX; export PDF via Chromium.
- Variantes/props de componente.
- Container queries e transformações 2D/3D na UI de CSS.

**C — Estrutural (só com plano revisado e aprovação).**
- Modelo declarativo de interação + runtime (overlays, tabs, modal, variantes interativas).
- Slides/PPTX (export), PDF editável/PPTX import (pesquisa).
- 3D com cena (câmera/luz/material), JS programável sandboxed, React Native, remake visual amplo, multi-organização.

Dependências-chave: B-preservação → B/C-novos campos; B-migração → todo campo novo; modelo declarativo → prototipação avançada e JS; relatório de fidelidade → qualquer import/export novo.

## 7. Decisões que realmente precisam do proprietário

1. **ADM-DEC-02** (ADMIN e credenciais): confirmar ou ajustar a proposta e a lista de "configurações críticas" vs "comuns".
2. **Qual VectorCraft?** Link do repositório que você tem em mente (não consegui confirmar identidade).
3. **Ordem:** confirmar que o Horizonte A (cliente MCP real, manual de volta, fatias de identidade) vem antes de qualquer item B/C.
4. **JavaScript:** aceitar a regra "nunca no canvas; só preview isolado/exportado" ou manter proibido por mais tempo.
5. **React Native:** é requisito real ou desejo? Se real, pede ADR própria; se desejo, adiar.
6. **"Autenticação reforçada"** para operações de OWNER: aceitar a proposta técnica (reautenticar com senha + código offline) quando ela for escrita.
7. **Branch oficial:** `v0.1.0-beta` ou `main` como referência (afeta onde o manual vive).

Decisões técnicas que **não** precisam dele (agentes decidem e registram): escolha de biblioteca vetorial após teste, formato de `extras`, nome de campos, estrutura do runtime.

## 8. Tarefas abertas por este registro

Propostas (estado `Proposta`, sem responsável) no [BACKLOG](../planning/BACKLOG.md): DOC-CORE-003 (preservação + migração do modelo), DOC-CORE-004 (booleanas vetoriais com curvas), DOC-CORE-005 (animação/estados e interação declarativa), DOC-CORE-006 (importar HTML e relatório de fidelidade). Remake visual continua em [DOC-STUDIO-005](../planning/tasks/studio/DOC-STUDIO-005.md); identidade/suspensão em DOC-SERVER-006/007/009/010. Slides/PPTX, 3D com cena, JS e React Native **não** viraram tarefa: dependem das decisões acima.
