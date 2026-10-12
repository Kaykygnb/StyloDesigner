# Arquitetura

Stylo é um monorepo npm (workspaces) em TypeScript/JavaScript, Node ≥ 22.

```
apps/server        servidor Hono: API HTTP, MCP (HTTP e stdio), presença ao vivo, contas, entrega do painel
apps/studio        painel web (React 19 + TypeScript + Vite), servido em /studio/
packages/core      o documento, comandos, CSS/HTML/SVG, exportação, auditorias e as ferramentas MCP
packages/db        Prisma + PGlite/PostgreSQL: esquema, migrações, cliente
packages/plugins   plugins embutidos (identidade, assets, acessibilidade, Tailwind, SEO, QR)
scripts/           utilitários (importar projetos, gerar documentação, benchmark)
tests/             testes (node:test) e o e2e do painel de administração
docs/              esta documentação
```

## A ideia central

> **O canvas é CSS de verdade, e há um único caminho para alterar o documento: as ferramentas MCP.**

```
 pessoa ──► painel (apps/studio) ──┐
                                    ├──► /api/studio/call ─┐
 agente de IA ──► MCP (/mcp) ───────┘                       ├──► runner de ferramentas (packages/core)
                                                            │         │
                                                            │         ▼
                                                            │   documento (model + store + comandos)
                                                            │         │
                                                            ▼         ▼
                                                       presença/bloqueios      banco (PGlite/Postgres)
```

- O painel **nunca escreve no documento diretamente**. Cada clique vira uma chamada de ferramenta (`lib/api.ts` → `tool()`/`run()`). Por isso pessoa e agente produzem exatamente o mesmo resultado, ambos entram no histórico de desfazer e ambos aparecem na atividade do projeto.
- Quando uma capacidade falta ao painel, a regra é: **primeiro a ferramenta no núcleo, depois o botão**.

## packages/core

| Módulo | Papel |
|---|---|
| `model.ts`, `types.ts` | Estrutura do documento (páginas → camadas), criação e validação de nós, valores padrão. |
| `store.js`, `commands.js` | Histórico (desfazer/refazer, um passo por operação) e comandos de edição (mover, agrupar, booleanas, nós de caminho…). |
| `css.js`, `html.js`, `svg.js`, `svgimport.js`, `geom.js` | Geração de CSS/HTML/SVG a partir das camadas; importação de SVG; geometria de vetores. |
| `site-export.ts`, `export-react.ts`, `zip.ts`, `tokens.ts` | Exportação: site HTML, projeto React + Vite, tokens CSS/JSON/Tailwind. |
| `audit*.ts`, `layout-inspection.ts` | Conferência do design (vazamento, contraste, texto pequeno, alvos de toque) e medidas reais. |
| `modes.ts`, `palettes.ts`, `components.ts`, `comments.ts`, `fonts.ts`, `icons.ts` | Modos de cor, paletas, componentes/instâncias, comentários, catálogo de fontes e ícones. |
| `tools/schema.ts` | **Catálogo** das ferramentas (nome, descrição, argumentos em Zod) e as instruções entregues ao agente. |
| `tools/runner.ts` + `tools/runner/*.ts` | **Execução** das ferramentas: leitura, propriedades, camadas, organização, vetores, código, apresentação. |
| `plugin.ts` | Contrato de plugins (`definePlugin`). |

Sem DOM: roda igual no Node e no navegador. O painel importa direto daqui apenas funções puras (por exemplo `model.js`, `cssedit.ts`).

## apps/server

- `main.ts` monta serviços, MCP e a entrega do painel (Vite em desenvolvimento, `apps/studio/dist` em produção).
- `routes/*` (Hono): autenticação, projetos, biblioteca, plugins, sistema (saúde, rede, backups), fotos e IA de imagem (`photos.ts`), painel (`studio.ts`).
- `services/*`: projetos, versões, contas e sessões, compartilhamento, agentes, biblioteca de arquivos, backups, operações (atividade).
- `workspace/`: o documento aberto de cada sessão, gravação atômica, medição com Chromium, exportações.
- `mcp/`: gateway MCP (sessões, escopos por agente), chamadas de agente.
- `presence.js`: quem está no projeto, bloqueios por camada (`DOCUMENT_WIDE_TOOLS` são as ferramentas que mexem no documento todo), frases de atividade no passado.
- `instrucoes-agente.txt`: o manual que todo agente recebe ao conectar. **Mudou uma ferramenta, mude este arquivo.**

## apps/studio

Estado global em `lib/app.ts` (store simples), ações em `lib/actions.ts` e `lib/editing.ts`, internacionalização em `lib/i18n.ts` (pt-BR e en-US).

Editor (`editor/`):

| Peça | Papel |
|---|---|
| `Canvas.tsx` | Mundo com zoom/pan, gestos (mover, redimensionar, girar, caixa de seleção, desenhar), encaixe, guias, caneta/lápis. |
| `BoardFrame.tsx` | Cada tela é o HTML exportado num `iframe` com `sandbox="allow-same-origin"` (**sem scripts**); o conteúdo é atualizado no lugar, sem recarregar. |
| `SelectionOverlay.tsx`, `Rulers.tsx`, `PenOverlay.tsx` | Tudo que se desenha por cima das telas (alças, guias, nós de vetor, caneta). |
| `canvas/geometry.ts` | Cálculo puro de encaixe, redimensionamento, giro (coberto por teste). |
| `Inspector.tsx` + `inspector/*` | Painel Design: posição, tamanho, auto layout, aparência, preenchimento, contorno, efeitos, texto, vetor, mídia, responsivo, estados, interações. |
| `LeftPanel.tsx`, `LayersPanel.tsx`, `AssetsTab.tsx`, `IconsTab.tsx` | Camadas/páginas, Recursos e Ícones. |
| `CodePanel.tsx`, `CommentsPanel.tsx`, `PrototypePanel.tsx`, `Presentation.tsx`, `InspectPanel.tsx`, `VersionsPanel.tsx`, `Panels.tsx`, `ProjectDialog.tsx`, `Dialogs.tsx` | Demais abas e janelas. |
| `menus.ts`, `shortcuts.ts` | Menu do botão direito e atalhos. |

Telas (`screens/`): projetos, biblioteca, conexões MCP, administração, conta e login.

### Decisões e regras do painel

- **Sem scripts no canvas:** nunca coloque `allow-scripts` no `iframe` das telas (o HTML pode vir de agentes). A apresentação do protótipo roda num contexto isolado próprio.
- **Entre iframes não use `instanceof Element`:** falha sempre; use checagem por métodos. Ouvintes criados uma vez (arrasto, atalhos) devem ler estado por `ref`, não por fechamento antigo.
- **Coordenadas:** o "mundo" usa as mesmas coordenadas do documento; a vista é `{panX, panY, zoom}`. Eventos vindos de dentro de um `iframe` passam por `toParent()` para virar coordenadas da janela.
- **Prévias ao vivo:** durante um arrasto o elemento real do `iframe` é movido por estilo inline e restaurado ao terminar; só então vem a chamada de ferramenta (`move_layers`, `update_layer(s)`), com um único passo de desfazer.
- **O mouse nativo do Playwright apertado sobre um `iframe` derruba o Chromium automatizado** (defeito dele). Nos testes simule arrastos com eventos enviados por script.

## packages/db e o banco

Prisma + esquema em `packages/db/prisma/schema.prisma`; as migrações em SQL ficam em `packages/db/prisma/migrations/NNNN_nome/migration.sql` e são aplicadas pelo próprio cliente ao abrir o banco (com cópia de segurança antes, quando há migração pendente).

- **PGlite** (padrão): Postgres compilado para WebAssembly, dentro do Node; dados na pasta `designer.db/`.
- **PostgreSQL** (`DATABASE_URL`): mesmo esquema; ainda não validado contra um Postgres real (veja [ROADMAP](ROADMAP.md)).

O documento do projeto é guardado como JSON dentro do banco; versões, notas, atividade, contas, sessões, agentes, biblioteca e publicações têm tabelas próprias.

## Segurança (princípios)

- O que entra (HTML/CSS de agentes ou de importações) **nunca é confiável**: é limpo ao exibir e exportar (sem `<script>` nem `on*`).
- JavaScript de DOM só existe ao **apresentar** o protótipo, isolado.
- Contas com senha (padrão), papéis (OWNER, ADMIN, EDITOR, COMMENTER, VIEWER), tokens de agente com escopos (read, comment, write, export) e aprovação; chaves de provedores guardadas cifradas em `designer.secret`.
- Downloads por endereço passam por proteção SSRF; o Chromium de desenho não tem rede liberada.
- O produto **não está preparado para hospedagem pública** nesta versão.
