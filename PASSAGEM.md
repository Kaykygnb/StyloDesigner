# Passagem de trabalho — Stylo

Documento para quem assume o projeto. Leia este arquivo primeiro; depois `contexto.md` (o mapa do código) e `decisoes.md`
(o diário de decisões, com o porquê de cada uma). **`decisoes.md` só recebe entradas novas no fim; nunca reescreva as antigas.**

Estado em 2026-10-11. Código em `C:\Users\LENOVO\Desktop\Blbla\StyloDesigner`, **branch `limpeza`**, ~225 commits locais,
**nada foi enviado ao GitHub** (sem push, sem PR). A pessoa dona do projeto **não é programadora de formação**: delega as
decisões técnicas, quer entender o porquê, e quer tudo em módulos pequenos, sem arquivos que fazem mil coisas. Conversa em
português. A decisão de licença foi **adiada** (hoje o repositório está em MIT; a intenção é "source-available", ver abaixo).

---

## 1. O que é o Stylo

Um "Figma" para **agentes de IA e pessoas** usarem juntos, via **MCP**, para prototipar e construir sites e aplicativos completos
(React, React Native ou o que for). O canvas é CSS de verdade: cada camada vira HTML/CSS. Um servidor fica ligado; qualquer agente
acessa pelo MCP, cria um projeto, trabalha nele, e exporta um **zip de HTML estruturado** (com imagens e fontes como arquivos reais)
ou **puxa o código/dados** para construir o resto por conta própria. Pessoas usam o editor visual no navegador, no mesmo projeto.
Vai ser usado localmente e também **hospedado e cobrado** (por isso Postgres, contas, tokens de agente).

## 2. O que fizemos (em ordem) e por que

1. **Faxina do repositório.** Veio de https://github.com/Kaykygnb/StyloDesigner. Apagamos docs, capturas, planos e "lixo de versões
   antigas" (~26 mil linhas); sobrou `contexto.md`. *Por quê:* o histórico está no GitHub; o código estava bagunçado.
2. **Removemos o agente de IA embutido** (chat, Jev, subagentes). *Por quê:* toda IA entra por MCP; um chat próprio duplica Claude Code/Codex.
3. **MCP sem navegador (headless).** O servidor mantém os projetos em memória (`workspace`) e roda o mesmo executor/comandos do editor,
   com geometria calculada do modelo (`model-canvas.ts`). *Por quê:* "server ligado, qualquer agente acessa" sem depender de uma aba aberta.
4. **Monorepo + Vite** (`packages/core`, `packages/db`, `packages/plugins`, `apps/server`, `apps/web`). *Por quê:* cada parte com um lugar e um motivo;
   regra: `web → core`, `server → core`, `core → nada`.
5. **Banco: Postgres + Prisma** (PGlite embutido para uso local/testes; MongoDB e SQLite descartados). *Por quê:* haverá serviço pago e muitos
   usuários; contas, permissões, log e cobrança são relacionais; a árvore do design cabe numa coluna JSONB.
6. **Contas, agentes e conta mestre.** Primeira conta = mestre. Agentes cadastrados com token (só o hash fica), escopos
   (`read`/`comment`/`write`/`export`), estados PENDING/ACTIVE/REVOKED, política de entrada `open`/`approval`/`closed`. Log de operações
   (quem fez o quê) alimenta as "bolinhas" de presença. Papéis por projeto (dono/editor/leitor). *Por quê:* vários humanos e agentes no mesmo servidor.
7. **Projetos no banco com revisão** (conflito 409 em vez de apagar trabalho alheio), versões, miniaturas, compartilhamento. JSON deixou de ser
   armazenamento (só exportar/importar; `npm run importar -- <pasta>` traz .json antigos).
8. **Servidor em Hono + SDK oficial do MCP** (`server.js` de ~700 linhas virou módulos pequenos). *Por quê:* menos código nosso, protocolo conforme a especificação.
9. **Ferramentas MCP definidas com Zod** (uma definição gera JSON Schema + validação em português + tipos) e **TypeScript** em parte do núcleo.
10. **Ferramentas de colaboração:** notas de decisão e comentários no banco, atividade, quem está aqui, compartilhar projeto.
11. **`get_image` no servidor** (Chromium isolado: sem JavaScript, sem rede) para o agente "ver" o que fez.
12. **Imagens fora do JSON** (tabela `Asset`, por sha256; o JSON leva `asset:<hash>`); `add_asset` (base64/data URL/https com proteção SSRF).
13. **Exportação com imagens como arquivos** em `assets/` (sem base64 no HTML).
14. **Contrato de plugins** + plugin **identidade** (auxiliares que só calculam: escala de cor OKLCH, contraste WCAG, harmonias, escalas tipográfica/espaçamento/raios/sombras).
15. **Plugin assets:** biblioteca de assets **da conta** (cópia para o projeto ao usar), provedores gratuitos, fontes do Google **hospedadas no projeto**,
    créditos no `CREDITS.txt`, chaves de provedores por conta (criptografadas), fontes de assets cadastráveis sem código.

Também corrigimos bugs reais achados em teste (laço editor↔servidor regravando, `DOMParser` ausente no servidor quebrando `insert_icon`,
travas de documento em `open_project`, sombreamento de `imageInfo` no runner...). Cada um está no `decisoes.md`.

## 3. Como rodar

```bash
npm install                 # roda sozinho o `prisma generate`; precisa de Node >= 22
npm start                   # http://localhost:5173 (sobe o Vite junto, mesma porta; banco PGlite local, sem login)
npm run build               # gera apps/web/dist (com ele presente o servidor entrega os arquivos de lá; STYLO_DEV=1 força o Vite)
npm test                    # ~410 testes, ~2 min (cada teste de servidor sobe um PGlite em memória)
npm run typecheck           # tsc em db, core, plugins e server
npm run importar -- <pasta> # importa .json antigos (idempotente)
```

Variáveis: `PORT`, `DESIGNER_CONFIG` (arquivo de configuração), `DATABASE_URL` (Postgres; sem ela, PGlite), `DESIGNER_DB_DIR` (`memory` nos testes),
`STYLO_AUTH=accounts` (login com contas; padrão = modo local sem login), `STYLO_DEV=1`, `STYLO_BLOB_DIR` (`memory` nos testes), `STYLO_SECRET_KEY`
(32 bytes base64; sem ela cria `*.secret`), `STYLO_LIBRARY_QUOTA_MB` (padrão 2048), `STYLO_TOKEN` (token de agente na ponte stdio), chaves de provedores
(`PEXELS_API_KEY`, `PIXABAY_API_KEY`, `POLYPIZZA_API_KEY`).

Conectar um agente: `claude mcp add --transport http designer http://localhost:5173/mcp` (Claude Code), ou `node apps/server/bin/mcp.mjs` (ponte stdio para Codex/Claude Desktop).
Para `get_image` funcionar: `npx playwright install chromium`.

Testes usam `node --import tsx --import ./tests/_setup.mjs --test`. Para um arquivo só: `node --import tsx --import ./tests/_setup.mjs --test tests/<arquivo>`.

## 4. Mapa rápido (detalhes em `contexto.md`)

| Pasta | O que é |
|---|---|
| `packages/core` | O documento puro (sem DOM): modelo, store, comandos, CSS/HTML/SVG, exportação, **ferramentas MCP em Zod** (`tools/schema.ts`), executor (`tools/runner.js`), **contrato de plugin** (`plugin.ts`) |
| `packages/db` | Prisma: `prisma/schema.prisma`, migrações SQL `0001`–`0004`, `src/client.ts` (Postgres por URL ou PGlite) |
| `packages/plugins` | Plugins embutidos: `identidade/` e `assets/` (provedores em `assets/providers/`) |
| `apps/server` | Hono: `main.ts` (liga tudo), `app.ts`, `routes/`, `mcp/` (SDK oficial), `services/`, `workspace/` (onde o MCP trabalha) |
| `apps/web` | Editor visual antigo (JS puro, Vite). **Será refeito do zero; não gaste esforço nele.** |
| `tests/` | Testes unitários/de API (`*.test.js|ts`) e `tests/e2e/` (Playwright, **desatualizados**) |

Fluxo do MCP: agente → `/mcp` (Bearer token ou nome do programa) → `workspace.call(ferramenta, ator)` → executor sobre `store` → grava em 400 ms →
`projects.write` (banco) → avisa editores abertos por SSE. Ferramentas de plugin passam pela mesma validação, escopos, travas e log.

## 5. Próximos passos (por prioridade, com detalhes)

### P1. Camada de mídia no projeto — **feita em grande parte (2026-10-11)**
**Já existe:** camada `media` (vídeo, áudio, 3D, Lottie) criada por `library_use insert:true`; `update_layer` aceita `mediaAutoplay/Controls/Loop/Muted`; exportação escreve `<video>`, `<audio>`, `<model-viewer>` e `<div data-lottie-src>`, copia os arquivos para `assets/media-*` e, para 3D e Lottie, põe o player em `vendor/` (de `node_modules`, via `apps/server/src/services/vendor.ts`; `exportSite(doc, { vendor })`; sem o fornecedor avisa). Limite de 25 MB por mídia dentro do projeto. **Falta:** guardar mídia grande fora de `doc.assets` (hoje vira data URL em memória — por isso o limite), prévia no canvas do editor novo, `poster` do vídeo, e ferramenta para criar mídia a partir de URL sem passar pela biblioteca. O texto antigo abaixo descreve o plano original:
Vídeo, áudio, 3D (`.glb`) e Lottie podem ser **buscados e guardados na biblioteca**, mas **não entram no projeto** (`library_use` recusa com mensagem clara).
Fazer: novo tipo de camada `media` (`packages/core/src/types.ts`, `model.ts`) que aponta para um asset; no canvas aparece uma **imagem de prévia**; na exportação sai
`<video>`, `<audio>`, `<model-viewer>` (glb) ou player Lottie, **com os arquivos copiados para `assets/`** (não como data URL: são grandes). Pontos de atenção:
(a) arquivos grandes **não** podem ir para `doc.assets` (data URL hidratado em memória a cada leitura): guardar só metadados no `doc` (ex.: `doc.media[id] = { hash, kind, mime, size, name, credit }`)
e os bytes no armazenamento de blobs por projeto; (b) a exportação (`site-export.ts`) é pura e síncrona: injetar uma função `readMedia(hash)` fornecida pelo servidor;
(c) vender o uso das bibliotecas `model-viewer`/Lottie **vendorizadas no zip** (sem CDN); (d) a licença/crédito do asset já existe, ligar a `doc.credits`.

### P2. Testar os provedores com chaves reais
Pexels e Pixabay: lógica testada com respostas simuladas e conferida na documentação oficial, **nunca rodou com chave real**. **Poly Pizza: a API não foi conferida na documentação
oficial** (só descrições de terceiros: `https://api.poly.pizza/v1/search/{consulta}`, header `X-Auth-Token`); o provedor é `unverified` e a leitura é defensiva — validar com chave real e ajustar
`packages/plugins/src/assets/providers/polypizza.ts`. Ainda sem provedor: **Lottie** e **ilustrações** (pesquisar APIs abertas e licenças).

### P3. Interface mínima de configuração (sem refazer o editor)
Cadastrar chaves de provedores hoje só por `PUT /api/providers/<id>/key` (body `{ "key": "..." }`). Falta tela. O editor novo vai cuidar, mas a API já existe.

### P4. Mais ferramentas para a identidade visual — **parte feita (2026-10-11)**
**Já existe:** `create_text_styles`, `apply_text_style`, `add_color_mode`, `set_style_color`, `create_size_variables`, `bind_variable` e `export_tokens` (css / json / tailwind; `packages/core/src/tokens.ts`). **Também feito:** `font_pairs` (16 pares curados, todos conferidos no Fontsource) e `get_project_brief` / `set_project_brief` (o brief fica em `doc.brief`). **Falta:** paleta a partir de imagem (precisa decodificar pixels no servidor: avaliar `sharp` ou usar o Chromium do renderizador), tabela de cores CSS nomeadas, remover modo/variável/estilo por MCP. Também há `create_effect_styles` (sombras) e `create_gradient_styles` (gradientes), ligados por `update_layer` (`effectStyleId`, `fill:{gradientId}`) e presentes em `export_tokens`. Notas: no Tailwind as cores usam `var(--cor-x)`, então o modificador de opacidade (`bg-fundo/50`) não funciona nelas; sombra de TEXTO não usa variável (a sintaxe de `text-shadow` difere de `box-shadow`).
Texto original:
Faltam no MCP: **estilos de texto** e **variáveis/modos (claro/escuro)** — o núcleo (`modes.ts`, `components.ts`) já suporta, só não há ferramentas; **exportar tokens**
(variáveis CSS, JSON, Tailwind); **paleta a partir de imagem**; pares de fontes; **brief** do projeto (um lugar fixo para público/tom/valores, que viaja com o projeto); tabela de cores CSS nomeadas
(hoje "red" dentro de SVG depende do navegador; `svgimport.js` linha ~268).

### P5. Exportadores de framework
React (componentes) e React Native (StyleSheet; só flex — **grid não existe no RN**, avisar). Plugins de exportação seguindo o contrato de `plugin.ts`. Também **bibliotecas CSS** prontas (animate.css etc.)
como catálogo que entra no projeto e no zip.

### P6. JavaScript de DOM para prototipar
Decisão: roda **só ao apresentar** (como o Figma), em ambiente isolado (iframe sem mesma origem), nunca no editor nem no servidor; sai como `.js` no zip. Hoje `<script>` é removido de propósito (`html.js`).
Camadas precisam de ids estáveis para o script achar elementos. O `get_image` do servidor mantém JavaScript desligado (se um dia animar, só em contexto isolado e sem rede).

### P7. Exposição segura na internet (antes de hospedar)
Hoje o servidor escuta só em `127.0.0.1` e aceita só Host/Origin locais (`http/guards.ts`). Falta: ouvir fora do localhost e domínio configurável, **HTTPS**, **limite de requisições**,
**filtrar os eventos ao vivo (SSE) por pessoa** (hoje todo editor conectado recebe o aviso de todo projeto), tela de login no editor, S3/R2 para os blobs (`services/blobs.ts` já tem a interface),
cobrança (o banco guarda plano/uso; usar Stripe ou similar), backups do Postgres.

### P8. TypeScript no restante do núcleo
Já são `.ts`: types, model, color, comments, modes, zip, icons, fonts, components, image-assets, validate, site-export, cssedit, palettes, tools/schema, plugin, asset-kinds, image-size. **Continuam `.js`**:
`store`, `commands`, `css`, `html`, `svg`, `svgimport`, `geom`, `imagefx`, `codeassist`, `sample-vitrine`, `tools/runner`. (Converter tudo de uma vez dá ~700 erros de tipo; converter quando forem mexidos.
`noImplicitAny: false` no core e no servidor, de propósito, para ser gradual.) Também restam rotas antigas em `req/res` (`routes/legacy.ts`: fotos e IA de imagem do editor antigo) — viram plugins MCP.

### P9. Editor novo (decisão da pessoa: refazer do zero, depois das ferramentas)
Ideia registrada: o servidor já é o **único dono do documento** (`workspace`); o editor novo deve mandar **operações** a ele em vez do projeto inteiro. Assim várias pessoas e agentes editam juntos sem CRDT.
Aproveitar para unificar os dois sistemas de comentário (comentários dentro do documento do editor antigo × notas do banco) e apagar `apps/web`, os e2e antigos e a configuração de pasta que não faz mais nada.

### P10. Testes e qualidade
`tests/e2e/*` estão **desatualizados** (usam o chat removido e `window.designer.agent`): refazer junto com o editor. A suíte unitária leva ~2 min (muitos PGlite): considerar compartilhar uma instância por arquivo.
`edit_image` e `generate_image_edit` (pixels) ainda dependem do navegador e **não funcionam no servidor**. `npm audit`: 0 vulnerabilidades graças a `overrides` no `package.json` (deepmerge-ts, mysql2 — vêm da CLI do Prisma); Prisma está **fixo na 7.10.0** (a 8.x ainda é release candidate).

### P11. Licença (adiada pela pessoa)
Quer **source-available**: ninguém pode vender a ferramenta como produto próprio; **usar o resultado** (os sites que os agentes criam) é livre. Candidatas: **FSL** ou **PolyForm Shield**. O repositório está em MIT
e as versões já publicadas continuam MIT. Conferir a compatibilidade com as licenças das dependências e fazer **revisão jurídica** antes de lançar/cobrar. Não chamar de "open source" (a definição oficial proíbe restringir uso comercial).

## 6. Regras de trabalho que a pessoa pediu

- Decisões grandes: explicar o porquê e registrar em `decisoes.md` (sempre acrescentando).
- Código em módulos pequenos; cada arquivo uma função; sem "arquivo de mil linhas". Evitar reinventar o que um framework faz bem.
- Segurança desde o começo: o HTML/CSS/script vem de agentes e pessoas e **nunca** é confiável (sandbox, sem rede, sem JS no servidor); downloads por endereço só com a proteção SSRF de `services/remote-image.ts`.
- Só uso comercial livre nos assets de terceiros; sempre registrar licença e crédito.
- Não fazer push, não abrir PR e não apagar dados do usuário sem pedir.
- Antes de afirmar que algo funciona: testar de verdade (testes + uma checagem real). Dizer com franqueza o que **não** foi verificado (ex.: Poly Pizza, chaves reais).

## 7. Armadilhas conhecidas

- **Windows:** o shell mastiga aspas/crases em comandos longos; para editar arquivos grandes use uma ferramenta de edição de arquivo, não `node -e`/heredoc com template literals.
- **PGlite** aceita **um processo por vez** e travou uma vez ao fechar com consulta em andamento: sempre `await operations.idle()` antes de fechar o banco (já feito em `main.ts` e nos testes).
- **Vite em modo desenvolvimento** sobe no primeiro pedido de página e pode demorar sob carga; testes de servidor têm paciência de sobra de propósito.
- `designer.secret` (chave de cifragem local) **não pode ir para o git**: já está no `.gitignore` (foi commitado por engano uma vez e removido do controle de versão; a cópia antiga fica só no histórico local, que nunca foi enviado).
- `packages/core/src/tools/runner.js` tem um auxiliar local chamado `imageInfo`; o import de `image-size.ts` entra como `sniffImage` por causa disso.
- Migrações Prisma são geradas com `prisma migrate diff --from-schema <antigo> --to-schema prisma/schema.prisma --script` (não há Postgres de verdade aqui para `migrate dev`).
