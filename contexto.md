# Stylo — contexto

**O que é:** um "Figma" local, em JavaScript puro (módulos ES, sem build, sem dependências de runtime), em que o
canvas é DOM + CSS de verdade. A ideia central: **um servidor ligado, onde humanos e agentes de IA (via MCP)
trabalham no mesmo projeto**, criando, editando e exportando sites.

**Objetivo do produto**
- O servidor fica ligado; qualquer agente (Claude Code, Codex, Cursor...) conecta em `http://localhost:5173/mcp`.
- O agente cria um arquivo (projeto), trabalha nele e: exporta um **zip de HTML estruturado** (`export_site`), ou
  **puxa o código** (`export_html`, `get_css`...) para construir o resto por conta própria.
- Humanos usam o editor visual no navegador; humanos e agentes podem estar no mesmo projeto ao mesmo tempo
  (presença, travas por camada, comentários). Isso pede contas e banco de dados (hoje: arquivos JSON numa pasta).

**Estado desta cópia:** limpeza em andamento. Tudo que era documentação, plano, captura de tela e identidade visual
foi removido (está no histórico do GitHub). Este é o único `.md`.

## Rodar
```
npm start        # http://localhost:5173  (PORT e DESIGNER_CONFIG mudam porta e arquivo de configuração)
npm test         # testes unitários e de API (node --test, ~3 s)
npm run test:e2e # testes de navegador (precisa de playwright)
```
Conectar um agente: Claude Code `claude mcp add --transport http projeto-designer http://localhost:5173/mcp`;
Codex/Claude Desktop (só stdio): `node scripts/mcp.mjs`, que repassa para o `/mcp`.

## Mapa do código (o quê, onde, por quê)

### Núcleo do documento — puro, roda no Node, tem teste unitário
| Arquivo | Faz |
|---|---|
| `src/model.js` | formato do documento (páginas → camadas), `createNode`, árvore, grupos, constraints |
| `src/store.js` | estado único, histórico (undo/redo), eventos, quando salvar |
| `src/components.js` | componentes/instâncias, estilos compartilhados |
| `src/modes.js`, `src/palettes.js`, `src/color.js` | variáveis por modo (claro/escuro), paletas, cores |
| `src/comments.js` | notas e comentários |
| `src/validate.js` | validação do JSON de um projeto |
| `src/geom.js`, `src/imagefx.js`, `src/image-assets.js` | geometria e imagens |

### Exportação — puro
| Arquivo | Faz |
|---|---|
| `src/css.js` | camada → CSS, `generateCode` (HTML+CSS), vetores, máscaras |
| `src/html.js`, `src/cssedit.js`, `src/codeassist.js` | HTML/CSS gerado, edição de CSS livre, ajudas de código |
| `src/svg.js`, `src/svgimport.js` | exportar e importar SVG |
| `src/site-export.js`, `src/zip.js` | site multipágina em **zip** (sem dependência) |
| `src/fonts.js`, `src/data/*` | Google Fonts / ícones (listas geradas por `scripts/gerar-listas-google.mjs`) |

### Servidor (Node, sem framework) — `server.js` + `server/`
| Arquivo | Faz |
|---|---|
| `server.js` (1000 linhas, **a fatiar**) | HTTP cru: estáticos, API `/api` (projetos, versões, miniaturas, conta, config), rota `/mcp`, rotas do chat de IA |
| `server/mcp.js` | protocolo MCP (JSON-RPC: initialize, tools/list, tools/call, ping) |
| `server/editor-bridge.js` | **ponto-chave de hoje:** repassa cada chamada de ferramenta à aba do editor aberta (SSE) e espera a resposta |
| `server/presence.js` | quem está no projeto (pessoas/agentes) e travas por camada, em memória |
| `server/account.js` | conta local (perfil sem senha) |
| `server/atomic.js` | gravação atômica de JSON |
| `server/photos.js`, `server/imageai.js` | busca de fotos (Openverse etc.) e edição generativa de imagem |
| `server/instrucoes-agente.txt` | instruções que o MCP entrega ao agente (lido pelo servidor a cada conexão) |
| `scripts/mcp.mjs` | ponte stdio → `/mcp` |

### Ferramentas MCP — `src/agent/`
| Arquivo | Faz |
|---|---|
| `schema.js` | as 41 ferramentas (nome, descrição, JSON Schema), compartilhada por servidor e navegador |
| `runner.js` | **executa** cada ferramenta usando store + commands — hoje só no navegador |
| `bridge.js` | permissão ("A IA quer alterar...") e escuta de `/api/agent/events` |
| `content.js` | divide conteúdo grande em trechos UTF-8 |
| `stream.js`, `providers.js`, `jev.js`, `subagents.js`, `ui/assistant.js` | **chat de IA embutido** (OpenAI/NIM/Ollama, Jev, subagentes) — candidato a remoção |

### Editor visual (navegador) — só interface; fora do escopo desta limpeza
`src/main.js`, `canvas.js`, `overlay.js`, `tools.js`, `commands.js`, `pen.js`, `rulers.js`, `present.js`,
`saving.js`, `storage.js`, `export.js`, `thumbnail.js`, `sample-vitrine.js`, `styles/app.css`, `ui/*`, `index.html`.

## Problema arquitetural central
Hoje **o editor aberto no navegador é quem executa as ferramentas MCP** (`runner.js` precisa de `store` e
`commands`, que tocam o DOM). Sem aba aberta, o agente não consegue trabalhar. Para "server ligado, qualquer agente
acessa" o documento e as operações precisam rodar **no servidor** (headless), com o navegador sendo só mais um cliente.

## Testes
`tests/*.test.js` (unitários e API, `node --test`) e `tests/e2e/*.mjs` (Playwright). Estado ao limpar: 364 passam.
