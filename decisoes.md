# Decisões do Stylo (histórico)

**Como usar este arquivo:** é um diário. Só se ACRESCENTA no fim; entradas antigas não são editadas (se uma decisão
mudar, escreva uma entrada nova que diga "substitui a de <data> — <título>"). Cada entrada: o que foi decidido, por
quê, e o que foi feito. Quem retoma o trabalho (pessoa ou IA) deve ler `contexto.md` (o que o projeto é e onde está
cada coisa) e este arquivo (por que está assim e o que ficou combinado).

Pessoa dona do projeto: não é programadora de formação; delega as decisões técnicas, quer entender o porquê e que
tudo fique organizado em módulos pequenos. Conversa em português.

---

## 2026-10-10 — Faxina do repositório
**Decisão:** copiar o repositório para uma pasta de trabalho, apagar lixo de versões antigas, todos os `.md`
(capturas, planos, identidade visual, relatórios) e deixar um único `contexto.md`.
**Por quê:** a documentação já existe no GitHub (histórico); o código estava bagunçado e cheio de arquivos grandes.
**Feito:** commit `chore: remove docs...`; ~26 mil linhas de documentação saíram.

## 2026-10-10 — Sem agente de IA dentro do app
**Decisão:** remover o chat embutido (OpenAI/NVIDIA/Ollama, Jev, subagentes). Toda IA entra por MCP.
**Por quê:** o produto é uma ferramenta que agentes de fora usam; um chat próprio duplica o que Claude Code/Codex já fazem.
**Feito:** removidos `stream.js`, `jev.js`, `subagents.js`, `ui/assistant.js`, rotas de chat e a aba de Configurações.

## 2026-10-10 — O MCP é o centro; o editor vem depois
**Decisão:** primeiro fechar todas as ferramentas e o funcionamento completo via MCP; o editor visual será
**refeito do zero** depois. Não gastar esforço no editor atual (apps/web): só o mínimo para não quebrar.
**Por quê:** o valor está nos agentes e humanos operando o mesmo projeto; a interface atual é legado.

## 2026-10-10 — O servidor executa as ferramentas (sem navegador)
**Decisão:** o servidor mantém os projetos abertos em memória (workspace) e roda o mesmo executor (`runner`) sobre o
mesmo store/comandos do editor, com geometria calculada do modelo. O navegador é só mais um cliente.
**Por quê:** "server ligado, qualquer agente acessa, cria, trabalha e exporta" — sem depender de uma aba aberta.
**Limites aceitos:** `get_image`, `edit_image`, `generate_image_edit` precisam de navegador (renderizador futuro).

## 2026-10-10 — Monorepo, Vite e módulos independentes
**Decisão:** `packages/core` (documento puro), `packages/db`, `apps/server`, `apps/web`. Imports entre pacotes por
`@stylo/*`. `core` não pode depender de `web`/`server`. Abrir mão de "só HTML/JS/CSS sem build".
**Por quê:** o projeto vai crescer; cada parte precisa ter um lugar e um motivo claros.

## 2026-10-10 — Banco: Postgres + Prisma (PGlite como atalho local)
**Decisão:** Postgres de verdade em produção (`DATABASE_URL`); sem ele, PGlite (Postgres embutido) para uso local e
testes. Prisma fixado na 7.10.0 (a 8 ainda é release candidate). MongoDB e SQLite descartados.
**Por quê:** haverá cobrança/serviço pago e muitos usuários; contas, permissões, log e cobrança são relacionais; a
árvore do design cabe numa coluna JSONB. SQLite não escala para vários processos/instâncias.
**Feito:** esquema e migrações 0001/0002; JSON deixou de ser armazenamento (só exportar/importar).

## 2026-10-10 — Contas, agentes e conta mestre
**Decisão:** a primeira conta é a **conta mestre** (aprova pessoas e agentes). Agentes são cadastrados (token mostrado
uma vez, só o hash fica; escopos read/write/export; estados PENDING/ACTIVE/REVOKED). Política de entrada de agentes
sem token: `open` (padrão local), `approval`, `closed` (padrão com contas). Dois modos: `local` e `accounts`
(`STYLO_AUTH=accounts`). Cada alteração por MCP é registrada no log de operações (alimenta as "bolinhas").
**Por quê:** vários humanos e agentes no mesmo servidor, com controle de quem pode o quê.

## 2026-10-10 — Dependências de segurança
**Decisão:** `overrides` no npm para `deepmerge-ts@^8` e `mysql2@^3.24` em vez de trocar de versão do Prisma.
**Por quê:** os avisos "alta" vinham da CLI do Prisma (não do código em produção) e o "fix" do npm rebaixava o Prisma.

## 2026-10-10 — Gravar o mesmo conteúdo não cria revisão
**Decisão:** o banco ignora gravação idêntica (hash do JSON) e o store aceita `loadDoc(..., { clean: true })`.
**Por quê:** achado em teste real: editor e servidor se regravavam em laço, subindo a revisão sem parar.

## 2026-10-10 — Plano a seguir (aprovado pela pessoa)
**TypeScript:** não converter tudo. `apps/web` fica em JS até ser descartado. Converter só o contrato: modelo do
documento, `runner`, ferramentas e servidor. **Zod** define cada ferramenta MCP uma vez (validação + JSON Schema do
MCP + tipos), substituindo `schema.js` à mão.
**Importar .json antigos:** só um comando de linha (`npm run importar -- <pasta>`), para testes/aproveitar o que existe.
Os `.json` **não ficam para sempre** na ferramenta; a configuração antiga de pasta some com o editor novo.
**Ordem:** (1) importador; (2) fechar a superfície do MCP — notas de decisão e comentários, ler o histórico de
atividade e quem está no projeto, compartilhar projeto e papéis, imagens como arquivos fora do JSON, renderizador
para `get_image` (Chromium), ferramentas de identidade visual; (3) SDK oficial do MCP + Hono, encolhendo `server.js`;
(4) Zod/TypeScript no núcleo; (5) exposição segura (HTTPS, limite de requisições, ouvir fora de 127.0.0.1, eventos
ao vivo por pessoa); (6) licença.
**Ideia para o editor novo (não construir agora):** o servidor já é o único dono do documento; o editor novo deve
enviar **operações** ao workspace em vez do projeto inteiro. Assim várias pessoas e agentes editam juntos sem resolver
conflitos nem CRDT.
**Licença:** adiar. Será "source-available" (ninguém vende a ferramenta como produto próprio; usar o resultado é
livre). Candidatas: FSL ou PolyForm Shield. O repositório continua em MIT por enquanto; precisa de revisão jurídica.

## 2026-10-10 — Ferramentas de colaboração via MCP (notas, atividade, presença, compartilhar)
**Decisão:** 8 ferramentas novas, executadas no workspace com o banco: `add_note`, `list_notes`, `resolve_note`
(notas de DECISÃO = o porquê, e COMENTÁRIOS, no banco), `get_activity`, `who_is_here`, `list_members`,
`share_project`, `unshare_project`. Agentes ganham o escopo `comment` (comentar sem poder editar). Cada ferramenta
declara `needs` (read/comment/write/owner) e `noLock` no schema; notas e compartilhamento entram no log de atividade.
**Por quê:** a memória entre sessões e entre IAs tem que viver no projeto, não só nos arquivos .md; e agentes precisam
saber quem está trabalhando e o que já foi feito antes de mexer.
**Pendente (decidir quando refizermos o editor):** hoje há dois sistemas de comentário — os comentários dentro do
documento (`add_comment`, usados pelo editor atual) e as notas do banco. A intenção é unificar nas notas do banco.
**Também:** `npm run importar -- <pasta>` importa .json antigos (idempotente, pula nomes existentes); o log de
operações espera terminar de gravar antes de fechar o banco (achado: fechar o PGlite no meio de uma consulta trava).

## 2026-10-10 — get_image: renderizador com Chromium isolado no servidor
**Decisão:** o servidor desenha o design (HTML exportado) num Chromium sem interface via `playwright-core`, com
contexto isolado por imagem: **sem JavaScript, sem rede** (só `data:`), tempo limite de 20 s e no máximo 2 desenhos
ao mesmo tempo. Fontes da web ficam com a fonte do sistema. O Chromium é carregado só no primeiro `get_image`.
**Por quê:** o agente precisa "ver" o que fez para corrigir o próprio trabalho; o HTML vem de agentes e pessoas, então
tem de ser tratado como não confiável.
**Requisito de instalação:** `npx playwright install chromium` no servidor. Sem ele, só `get_image` falha, com mensagem clara.
**Continuam indisponíveis sem navegador:** `edit_image` e `generate_image_edit` (mexem nos pixels no editor).

## 2026-10-10 — Servidor em Hono + SDK oficial do MCP; server.js desaparece
**Decisão:** o `server.js` (HTTP cru, ~700 linhas) foi dividido em módulos: `main.ts` (liga tudo), `app.ts` (Hono),
`http/*` (proteções e identidade), `routes/*`, `mcp/*`, `events.ts`, `config.ts`, `context.ts`. O protocolo MCP passou a ser
o do **SDK oficial** (`@modelcontextprotocol/sdk`, transporte Streamable HTTP, uma instância de `Server` por sessão); o
`server/mcp.js` escrito à mão foi apagado. Sessões, identidade do agente, travas e presença continuam nossas (`mcp/gateway.ts`
e `mcp/agent-calls.ts`). Fotos e IA de imagem seguem em req/res do Node, montadas pelo Hono (`routes/legacy.ts`), até virarem plugins MCP.
**Por quê:** servidor mais curto e padronizado; conformidade com a especificação sem manutenção própria; cada arquivo faz uma coisa.
**Consequências aceitas:** `initialize` agora precisa ser válido (protocolVersion, capabilities, clientInfo); clientes sem o
cabeçalho `Accept` são aceitos (completamos); o "Acesso de administrador" e a pasta de projetos deixaram de existir de vez;
`STYLO_TOKEN` na ponte stdio leva o token do agente. Achado e corrigido: `new_project`/`open_project`/`save_project`
travavam o documento inteiro (`noLock`), o que impedia outro agente de abrir o projeto logo depois.
**Teste:** `tests/mcp-sdk.test.js` usa o CLIENTE oficial do SDK contra o servidor real.

## 2026-10-10 — Ferramentas com Zod e TypeScript no núcleo (em etapas)
**Decisão:** as 50 ferramentas MCP passaram a ser definidas **uma vez** com Zod em `packages/core/src/tools/schema.ts`.
Daí saem o JSON Schema do `tools/list` (gerado e limpo, igual ao antigo — conferi ferramenta por ferramenta), a **validação
dos argumentos** antes de executar (`validateToolArgs`, mensagens em português; o `runner` devolve o erro sem rodar a
ferramenta) e os tipos. Campos desconhecidos são ignorados. Removido: `openAiTools` (não há mais agente interno).
**TypeScript:** `types.ts` descreve o formato do documento (LayerNode, Page, Doc...) e `model.ts` o usa. Também já são
`.ts`: color, comments, modes, version, zip, icons, fonts, components, image-assets, validate, site-export, cssedit,
palettes, tools/content. **Continuam `.js`** (muitos erros de tipo para corrigir sem ganho imediato): store, commands, css,
html, svg, svgimport, geom, imagefx, codeassist, sample-vitrine, tools/runner. Converter quando forem mexidos.
O `core` e o servidor usam `noImplicitAny: false` (gradual); `npm run typecheck` passa em db, core e server.
**Por quê:** erros nos pontos de contato (agente ↔ servidor ↔ documento) eram descobertos só em execução; agora a
validação e os tipos nascem da mesma definição. O editor (`apps/web`) fica em JS até ser descartado.

## 2026-10-10 — Imagens fora do JSON do projeto; ferramenta add_asset
**Decisão:** na gravação, as imagens (data URLs) vão para a tabela `Asset` (uma por conteúdo, chave = sha256 por projeto) e o
JSON do projeto leva só `"asset:<hash>"`; na leitura voltam a ser data URLs. O núcleo e o editor **não mudam** (continuam
vendo `doc.assets`). Versões e histórico ficam leves; imagens que nenhuma versão usa mais são recolhidas. Cada imagem sai por
`GET /api/projects/<arquivo>/assets/<sha256>` (cache imutável, CSP com sandbox). Projetos antigos são externalizados na
próxima gravação. Nova ferramenta MCP `add_asset` (base64, data URL ou `source_url`), com tipo e dimensões lidos dos bytes
(`core/image-size.ts`, sem DOM) e reaproveitamento de imagem repetida.
**Segurança:** `source_url` só aceita https e é protegida contra SSRF — o IP é conferido **na hora de conectar** (hook `lookup`
do undici), IP privado/loopback/link-local/reservado é recusado (IPv4, IPv6 e IPv4 embutido), redirecionamentos conferidos
a cada passo, limite de 16 MB e 12 s.
**Achado:** em `runner.js` já existia um auxiliar local chamado `imageInfo`; importar outro com o mesmo nome o sombreou
(o erro só apareceu em teste). Importado como `sniffImage`.

## 2026-10-10 — Identidade visual = conjunto de auxiliares; o agente decide (esclarecido pela pessoa)
**Decisão:** NÃO haverá ferramenta que "gera a identidade de uma vez". Haverá um **conjunto de ferramentas auxiliares**
independentes (cores, tipografia, escalas, tokens, brief) que o agente — ou a pessoa, pela interface — combina como quiser no
mesmo projeto. Quem decide o que fazer é sempre quem usa o MCP. Auxiliares **calculam** (ex.: paleta a partir de uma cor,
contraste, escala tipográfica); não criam nada sozinhos nem escolhem por ninguém.
**Propósito mais amplo:** a ferramenta serve a IAs/agentes que constroem projetos em **React, React Native e o que for**; ela é a
fonte do design (estrutura, tokens, assets) que o agente traduz para o framework dele.
**Estado de cobertura registrado:** HTML/CSS sim; JavaScript não (scripts são removidos de propósito por segurança); assets
só imagens (PNG/JPEG/GIF/WebP/SVG) e hoje a exportação embute imagem como data URL no CSS (a corrigir: arquivos reais);
faltam vídeo, áudio, 3D (glb/gltf), Lottie, fontes próprias; faltam ferramentas MCP para variáveis/modos e estilos de texto.
**Bundler (Webpack/Vite):** não é papel da ferramenta — é do projeto que consome. Nosso papel: entregar arquivos reais com
nomes estáveis e dados estruturados.

## 2026-10-10 — Escopo ampliado: ferramenta geral de prototipagem de sites e apps completos (visão da pessoa)
**Visão:** o Stylo é uma ferramenta **geral** para tudo que envolve estilização e prototipagem de um site ou aplicativo
completo, usada por agentes (e pessoas) que constroem em React, React Native ou o que for. Isso inclui: JavaScript de DOM/animação
para prototipar; acesso do agente a **assets gratuitos** (ícones, fotos, vídeos, 3D, Lottie, ilustrações...) e também a
outros tipos de asset; sites com 3D e animação elaborada; bibliotecas CSS prontas (animate.css etc.) quando úteis.
**Consequência de arquitetura:** provedores de assets, bibliotecas, exportadores (React, React Native, tokens) e auxiliares de
identidade visual são **plugins do núcleo** — é hora de definir o contrato de plugin (decisão 3 do início) antes de crescer.
**Achado:** `insert_icon` (e qualquer importação de SVG) quebrava no servidor ("DOMParser is not defined") desde que o MCP passou
a rodar sem navegador. Corrigido com `apps/server/src/dom-polyfill.ts` (linkedom) e teste.
**Pendente (detalhar com a pessoa):** política de licença dos assets de terceiros (só uso comercial livre; registrar créditos);
quais provedores primeiro; JS do projeto roda **só em sandbox** (iframe sem mesma origem / Chromium isolado) e vira arquivo `.js`
no zip exportado — nunca dentro do editor/servidor.

## 2026-10-11 — Plugins, biblioteca de assets da conta, provedores e fontes (aprovado em linhas gerais pela pessoa)
**Plugins:** aprovado. Provedores de assets, bibliotecas, exportadores e auxiliares são plugins do núcleo. Plugins de terceiros com
código só entram por configuração de quem opera o servidor (código de plugin tem acesso total); **o usuário comum adiciona fontes de
assets de forma declarativa** (sem código): nome, tipos, endereço de busca com `{consulta}`, mapeamento dos campos da resposta,
chave/cabeçalho.
**Biblioteca da conta:** cada pessoa tem a sua biblioteca de assets (imagens, vídeos, 3D, Lottie, fontes próprias, áudio); **os
agentes dessa pessoa, ao usar o MCP, enxergam e usam todos os assets dela** (listar, buscar, trazer para o projeto). Os assets de
um projeto continuam por projeto; a biblioteca é por conta. Arquivos grandes (vídeo, 3D) ficam num armazenamento de blobs
(disco local; S3 no serviço hospedado), não no banco.
**Assets gratuitos:** imagem, vídeo, ícone, 3D e **fontes**, sempre seguindo a licença de cada fonte: cada resultado traz licença
e autor; só uso comercial livre por padrão; créditos registrados no projeto e exportados num arquivo. **Google Fonts entram "de
verdade"**: catálogo rico (categorias, pesos, prévia) e **hospedadas no zip exportado** (woff2 local), não por CDN do Google.
**JavaScript de DOM:** roda **só na hora de apresentar** (como o Figma), em ambiente isolado (iframe sem mesma origem); nunca no
editor nem no servidor. Por ser ferramenta principalmente local, o risco prático é baixo, mas o isolamento continua porque a versão
hospedada executaria código de outras pessoas.
**Provedores a verificar (APIs e licenças ainda não confirmadas na fonte oficial):** Pexels (fotos e vídeos, chave grátis),
Pixabay (baixar e hospedar; cache de 24 h; limite de uso), Poly Pizza (3D .glb, CC0/CC-BY, chave grátis), Openverse (imagens e
áudio, sem chave), Fontsource/Google Fonts (woff2, OFL).

## 2026-10-11 — Contrato de plugins; plugin "identidade" (auxiliares de cor e escalas); imagens como arquivos na exportação
**Biblioteca da conta (esclarecido):** é só da pessoa, e quando algo da biblioteca é usado num projeto ele passa a **estar no
projeto** (cópia embutida): o projeto fica autossuficiente. Decisão da pessoa: fazer o que eu julgar certo, sem precisar concordar 100%.
**Exportação:** `exportSite` agora grava cada imagem como arquivo em `assets/img-<hash>.<ext>` e o HTML aponta para ele (sem
base64 no HTML; mesma imagem = um arquivo; nome estável pelo conteúdo). `assets: 'inline'` mantém o modo antigo. O zip aceita bytes.
**Plugins (`packages/core/src/plugin.ts`, `packages/plugins`, `apps/server/src/plugins.ts`):** um plugin tem `id` e ferramentas;
cada ferramenta = definição em Zod (`defineTool`) + `run(args, ctx)`, com `ctx` = ator, projeto aberto (se `needsProject`) e
serviços do servidor. As ferramentas entram no tools/list e passam pela mesma validação, escopos (`needs`), travas e registro de
atividade das do núcleo; ferramenta que altera o documento tem o `commit` feito pelo servidor. `definePlugin` valida ids e nomes.
Plugins com código só são carregados pelo operador do servidor (nunca por upload de usuário).
**Plugin "identidade" (5 ferramentas, só calculam; não criam nada):** `color_scale` (escala 50–950 em OKLCH; o degrau da cor dada
usa a cor exata), `color_contrast` (WCAG 2.x), `color_harmony` (complementar, análogas, tríade, split, tétrade, monocromática),
`color_text_on` (melhor texto sobre um fundo) e `design_scale` (tipográfica modular, espaçamento, raios, sombras).
**Falta (identidade):** estilos de texto e variáveis/modos no MCP, exportação de tokens, cores a partir de imagem, pares de fontes, brief.

## 2026-10-11 — Assets: biblioteca da conta, provedores gratuitos, fontes hospedadas, créditos (plugin "assets")
**Biblioteca da conta:** tabela `LibraryAsset` (ficha: tipo, origem, licença, crédito) + armazenamento de blobs por sha256 (pasta
`<config>.blobs` ou `STYLO_BLOB_DIR`; `memory` nos testes; S3 depois, mesma interface). Tipo e MIME vêm dos **bytes**
(`core/asset-kinds.ts`), nunca do que o remetente declara. Limites por tipo (imagem 16 MB, fonte 4, Lottie 10, áudio 50, 3D 100,
vídeo 200) e cota por conta (padrão 2 GB, `STYLO_LIBRARY_QUOTA_MB`). Usar um asset num projeto **copia** o conteúdo (`library_use`).
**Provedores (cada um é uma peça pequena em `packages/plugins/src/assets/providers`):** Openverse (imagens e áudio, sem chave —
testado ao vivo), Fontsource/Google Fonts (catálogo de ~2.000 famílias e arquivos .woff2 por peso, sem chave — testado ao vivo, o
`add_font` baixou Playfair Display de verdade), Material Symbols (ícones, já havia), **Pexels** e **Pixabay** (fotos e vídeos, chave
grátis; APIs conferidas na documentação oficial: Pexels `Authorization`, 200 pedidos/h; Pixabay chave na URL, 100/60 s, cache de 24 h
exigido — implementado — e proibição de ligar permanente às URLs, por isso baixamos) e **Poly Pizza** (3D .glb; **API NÃO conferida
na documentação oficial**, só em descrições de terceiros — marcado `unverified`, leitura defensiva; precisa ser testado com uma chave real).
**Chaves por conta, criptografadas:** AES-256-GCM; a chave de cifragem é do servidor (`STYLO_SECRET_KEY` ou arquivo `*.secret`
0600). A chave nunca volta por API nem por MCP. Ordem de busca da chave: conta → configuração do servidor → variável de ambiente.
**Resultados autênticos:** `library_save` salva pela `ref` de uma busca recente (1 h), com a licença e o crédito que o **provedor**
informou; nunca um endereço/licença inventado pelo agente. Só licenças de uso comercial. **Fontes cadastradas pela pessoa** (sem
código): endereço https com `{consulta}`, caminho da lista e dos campos; a busca passa pelo download protegido contra SSRF.
**Fontes tipográficas:** `add_font` hospeda os .woff2 dentro do projeto (`doc.fonts`, arquivos como assets) e a exportação gera
`fonts/*.woff2` + `@font-face` com `unicode-range`; famílias do projeto saem do `<link>` do Google. **Créditos:** `doc.credits`
(preenchido por `library_use` e `add_font`) vira `CREDITS.txt` no pacote exportado.
**Ainda falta:** camada de mídia no projeto (vídeo, áudio, 3D, Lottie só ficam na biblioteca); busca de Lottie e ilustrações;
interface para cadastrar chaves (hoje por `PUT /api/providers/<id>/key`); testar Pexels, Pixabay e Poly Pizza com chaves reais.

## 2026-10-11 — Encerramento do dia e passagem para outra pessoa
**Decisão:** criado `PASSAGEM.md` (guia de passagem: o que foi feito e por quê, como rodar, mapa, próximos passos priorizados P1–P11,
regras de trabalho e armadilhas) para outro programador continuar. **Achado de segurança:** `designer.secret` (chave de cifragem local)
tinha sido commitado por engano; removido do controle de versão e do `.gitignore` (`*.secret`, `*.blobs/`, `designer.config.json`). A
cópia antiga existe só no histórico local (nunca enviado ao GitHub); se algum dia o histórico for publicado, gerar nova chave.

## 2026-10-11 — Mídia no projeto: players dentro do zip, sem CDN
A camada `media` (vídeo, áudio, 3D, Lottie) já existia; faltava o site exportado funcionar. `<model-viewer>` e Lottie precisam de script:
em vez de CDN, o zip leva `vendor/model-viewer.min.js` (@google/model-viewer 4.4.0) e `vendor/lottie_light.min.js` (lottie-web 5.13.0, mais um
iniciador de 10 linhas) — **só** nas páginas que usam, e offline funciona. Lottie deixou de ser `<lottie-player>` (descontinuado) e virou
`<div data-lottie-src>`. O core continua puro: `exportSite(doc, { vendor })` recebe uma função; quem lê `node_modules` é o servidor. Mídia
dentro do projeto ≤ 25 MB (a biblioteca aceita até 200 MB): limite provisório porque o projeto ainda carrega a mídia como data URL na memória;
a solução definitiva é guardar só a referência no documento e os bytes no armazenamento de blobs.

## 2026-10-11 — Identidade visual no MCP: estilos de texto, modos, variáveis e exportação de tokens
O núcleo já sabia fazer estilos de texto, modos de cor (claro/escuro) e variáveis de tamanho, mas só o editor antigo os alcançava. Agora há 7
ferramentas MCP (58 no núcleo): `create_text_styles`, `apply_text_style`, `add_color_mode`, `set_style_color`, `create_size_variables`,
`bind_variable`, `export_tokens`. Os valores ficam NO PROJETO (nada em arquivo à parte) e `get_document` lista estilos, modos e variáveis.
`export_tokens` é função pura (`core/tokens.ts`) e gera: **css** (variáveis `:root`, modos por `data-theme` e por `prefers-color-scheme`, classes
`.texto-*`), **json** (parecido com o padrão W3C Design Tokens) e **tailwind** (config + tokens.css; as cores apontam para as variáveis para os
modos funcionarem). Razão: o agente que vai construir em React/RN/o que for precisa dos mesmos valores que o desenho usa, sem copiar à mão.
Escolha deliberada: criar poucas ferramentas "de gravação" claras, em vez de uma ferramenta única cheia de ações.

## 2026-10-11 — Estilos de sombra e de gradiente (como os de cor)
Sombras e gradientes não eram estilos compartilhados: cada camada tinha a sua cópia, sem token e sem atualização em conjunto. Agora existem
`styles.effects` (sombras) e `styles.gradients`, ligados por `node.effectStyleId` e `fill.gradientId`, sincronizados a cada commit junto com cor e
texto (`syncStyles`), e escritos no CSS como `var(--sombra-x)` / `var(--gradiente-x)` com o bloco `:root`. Mexer à mão no fill ou nas sombras solta o
estilo. Ferramentas: `create_effect_styles`, `create_gradient_styles` (60 no núcleo); ligação por `update_layer`, como já era com `fill:{styleId}`.
Sombra de texto (`text-shadow`) não usa variável. O editor antigo não ganhou interface para isso (fica para o editor novo).

## 2026-10-11 — Brief do projeto e pares de fontes (plugin identidade)
**Brief:** `get_project_brief` / `set_project_brief` guardam em `doc.brief` (resumo, público, tom, valores, metas, o que evitar, notas). Razão: vários
agentes e pessoas mexem no mesmo projeto e precisam de UM lugar que diga para quem é e em que tom, para a identidade não derivar. Mesclado campo a
campo; vazio apaga. **Pares de fontes:** `font_pairs` sugere pares curados (16) por clima, com os ids do Fontsource para `add_font`; só sugere,
não cria nada (regra das ferramentas de identidade: calculam, quem decide é o agente/pessoa). **Ficou para depois:** paleta a partir de imagem (exige
ler pixels no servidor). Também reforcei a espera de subida do servidor nos testes HTTP (60 s, com erro claro), que falhavam de vez em quando sob carga.

## 2026-10-11 — Exportador React (projeto Vite) a partir do mesmo site exportado
Para o agente que vai construir em React: `export_site {format:"react"}` (e `react.zip`). **Decisão de arquitetura:** o exportador React NÃO gera
código por conta própria; parte do site que `exportSite` já produz (HTML, CSS, imagens, fontes, créditos, avisos) e o reorganiza. Assim HTML e React
nunca divergem e uma correção no gerador vale nos dois. Cada tela vira um componente com **CSS Module** (as classes de uma página não colidem com as de
outra: o gerador repete nomes como `.titulo` em páginas diferentes); `class` → `styles["x"]` só para as classes que existem no CSS da página, o resto
(classes escritas à mão) fica literal. Imagens/fontes em `public/`; 3D e Lottie viram dependências do npm (não os arquivos vendor/). Navegação por `#`
para não impor uma biblioteca de rotas. O conversor de HTML→JSX é próprio e pequeno porque só precisa entender o HTML que NÓS geramos; se achar algo
fora disso, a página entra como HTML bruto com aviso, nunca quebra a exportação. Fica de fora (registrado em PASSAGEM §5b): React Native e TypeScript.

## 2026-10-11 — "Uso a ferramenta como um agente": o que o atrito mostrou e o que foi feito
Em vez de adivinhar melhorias, montei uma landing page inteira SÓ pelas ferramentas MCP (roteiro descartável) e anotei onde doeu. Achados e correções:
1. **`get_image` cortava telas "hug"** (altura automática): o servidor usava o `h` guardado, que para "hug" era só uma estimativa; o agente via só a ponta de cima.
   → O renderizador agora **mede o layout real** (`renderer.measure`, via `page.evaluate` com o JavaScript DA PÁGINA desligado) e grava em `node.w/h` com a mesma
   regra da "medida de volta" do editor (`workspace/measure.ts`). É preguiçoso: o projeto fica "sujo" após escrita e a medida roda só antes de leituras que mostram
   tamanhos (get_document, get_layer, find_layers, get_selection, get_image, check_design); se o Chromium falhar, segue com os tamanhos guardados (e espera 60 s para tentar de novo).
2. **O agente não conseguia ver o celular**: `set_responsive` existia, mas `get_image` só desenhava no desktop. → `get_image {breakpoint}` desenha na largura do breakpoint.
3. **Argumentos desconhecidos eram descartados em silêncio** (`find_layers {name}` devolvia tudo e o agente achava que filtrou). → agora é erro, listando os nomes aceitos.
4. **`w/h` junto com `sizeY:"hug"` descartava o hug** (o tamanho fixo vencia). → sizeX/sizeY explícitos prevalecem.
5. **Fontes do projeto não apareciam nas imagens**: `add_font` hospeda, mas o renderizador (sem rede) ignorava. → as fontes hospedadas entram embutidas no desenho.
6. **O agente não sabia que errou** (texto que não quebra linha vazando no celular). → ferramenta nova `check_design` (`core/audit.ts`): vazamento por breakpoint (medido no
   Chromium), contraste WCAG, texto < 12px e imagem sem alt, cada um com o conserto. Fica em "core" (conhece o modelo do documento), não em plugin.
Resultado no roteiro: a auditoria achou 6 problemas reais; depois do `set_responsive` caiu para 3 (os textos que não quebram linha).

## 2026-10-11 — Passagem para outro programador: documentos refeitos, decisões do dono separadas, correções de higiene
**Documentos.** `contexto.md` estava desatualizado (dizia "JavaScript puro, sem dependências", "pasta de JSON", "get_image ainda não feito") e foi
reescrito: vocabulário, arquitetura, mapa correto, fluxos, **receitas** (nova ferramenta/plugin/provedor/exportação/migração) e convenções. `PASSAGEM.md`
foi refeito: como começar, o que existe, **as decisões que dependem do dono (D1–D14) com recomendação de cada uma**, passos técnicos que não esperam decisão, e a lista de
pulados. Criado `README.md` (porta de entrada). `NOTICE` reescrito com as licenças reais das dependências, dos provedores e dos players embutidos.
**Verificação.** Num clone limpo do repositório: `npm install`, `typecheck`, servidor no ar e um cliente do SDK oficial do MCP criando, auditando, vendo e exportando um projeto.
**Defeito achado no clone/varredura:** `zod` era importado pelo núcleo e pelos plugins mas não estava declarado em nenhum `package.json` (só chegava como dependência
do SDK do MCP). Agora está declarado em `packages/core` e `packages/plugins`.
**Melhorias junto:** `check_design` ganhou hierarquia de títulos (um h1, sem pular nível) e alvo clicável < 24 px; `alt: ""` passa a valer como "imagem decorativa" (só
"nunca definido" é aviso); `build_layout` devolve a altura medida; ferramentas de assets fora do servidor explicam o que falta em vez de um erro técnico.
**Decisão de método:** o que é decisão de negócio (licença, cobrança, hospedagem, nome, idioma, privacidade, formatos, editor) NÃO é decidido por quem programa: fica em
`PASSAGEM.md §3` com opções e recomendação.

## 2026-10-11 — Branch `limpeza` enviada ao GitHub (público, MIT) por decisão da pessoa dona
O agente que ia assumir o projeto não conseguia trabalhar só na pasta local, então a pessoa dona mandou **enviar o trabalho numa branch nova**. Foi enviada a `limpeza`
(sem forçar nada; `main` e `stylo-2.0-planning` do GitHub intocadas). **Avisos feitos antes, e a escolha dela:** o repositório é **público** e a licença é **MIT**, então o código
passa a poder ser copiado e vendido por qualquer um, sem volta (a intenção declarada era "source-available" e a decisão D1 está aberta). Foi oferecido tornar o repositório privado
primeiro; a pessoa escolheu **manter público**. **Segurança:** varredura do histórico (só `designer.secret` era sensível, nenhuma chave de API); o banco local tinha 0 chaves
criptografadas com ela; **chave local trocada** antes do envio (a antiga ficou em `designer.antiga.secret`, ignorada pelo git, e pode ser apagada). A chave antiga continua no histórico
público, agora inútil. Em aberto: reescrever o histórico, o destino da `main` antiga e a licença (PASSAGEM.md D1/D2).

## 2026-10-11 — Licença: fica para depois; o repositório pode ser apagado e recriado
A pessoa dona confirmou que o repositório é dela e que a decisão de licença (D1) fica para depois: se o resultado não ficar bom, ela **apaga o repositório e cria outro**.
Consequência para quem programa: não decidir nada de licença; não depender de o remoto existir para sempre (histórico local é a fonte); se `push`/`fetch` falhar porque o
repositório sumiu, parar e avisar. Apagar o repositório não desfaz cópias que terceiros já tenham feito da versão enviada em MIT.

## 2026-10-11 — O agente passa a trabalhar na nuvem: push na `limpeza` autorizado, Chromium configurável
A pessoa dona avisou que o próximo agente roda **na nuvem** (ambiente descartável) e não no computador dela. Consequências: (1) o que não for enviado ao GitHub se perde, então
**`git push` na branch `limpeza` ao fim de cada bloco passa a ser permitido** (continua proibido: `--force`, PR, `main`, `stylo-2.0-planning`, reescrever histórico); (2) o prompt inicial
foi reescrito para esse ambiente (Linux, sem acesso ao PC dela, sem dados locais, rede possivelmente restrita, a pessoa não vê o ambiente); (3) novo `STYLO_CHROMIUM_PATH` para o
renderizador usar um Chromium já instalado (comum em nuvem) em vez de baixar outro; erro claro cita a variável; teste novo. Dois agentes em paralelo: o segundo usa uma branch `agente/<tarefa>`.

## 2026-10-11 — Executor das ferramentas dividido em módulos TypeScript
**Autorização:** a pessoa dona permitiu dividir o executor depois de esclarecer que as ferramentas são as ações usadas pelos agentes via MCP e a base das operações do produto.
**Decisão:** `tools/runner.ts` concentra validação, aprovação, cancelamento, commit e restauração após falha; os métodos ficam em módulos por responsabilidade em `tools/runner/`: leitura, inspeção, exportação, construção de árvores/ícones/vetores, camadas, estilos, projetos e imagens. Helpers de propriedades, apresentação e contexto ficam separados. O arquivo central caiu de 1.020 para 92 linhas; o maior módulo tem 155. Razão: facilitar manutenção sem misturar regras de segurança com cada ação.
**Compatibilidade:** `tools/runner.js` permanece como fachada com os mesmos seis exports. O workspace do servidor importa diretamente o `.ts`; `apps/web` não foi alterado. Mantidos argumentos, respostas, mensagens, ordem de aprovação/cancelamento, exceções de histórico, consulta dinâmica ao documento atual, cache de ícones por executor e serviços injetados. Store/comandos legados e argumentos dinâmicos ainda usam tipos amplos nesta conversão gradual; não foi feita uma tipagem completa do núcleo.
**Verificação:** revisão dos 52 métodos contra a versão anterior, 28 testes focados passando, `npm run typecheck` limpo e suíte completa com 449 testes: 448 passaram, 0 falhas, 1 pulado. Acrescentados seis testes do executor para recusa/ausência de aprovação, administrador externo, cancelamento, histórico, falha parcial e preservação de edição concorrente. Nenhuma ferramenta atual declara `admin:true`; esse bloqueio legado foi preservado, mas não há ferramenta atual para exercitá-lo.
**Uso real:** servidor com `STYLO_CHROMIUM_PATH=/usr/bin/chromium`, cliente oficial MCP listando 79 ferramentas, criação de tela, estilo de cor, ajuste responsivo, imagens desktop/celular, auditoria medida sem problemas na tela de conferência, tokens CSS, exportação React, download dos ZIPs HTML/React com resposta HTTP 200 e assinatura ZIP, desfazer/refazer. Imagem do celular inspecionada. Servidor encerrado depois.
**Ressalvas:** o teste específico de `STYLO_CHROMIUM_PATH` se pula porque procura o navegador na pasta padrão do Playwright; os outros testes de renderização/medida/auditoria passaram com o navegador instalado. Registrado em PASSAGEM §5. Não foram verificados o editor legado, provedores com chaves reais ou instalação/compilação do React exportado neste bloco. Restam `css.js` e `commands.js` grandes; decisões de negócio e licença não foram alteradas.

## 2026-10-11 — Ferramentas por capacidade; edição local de fotos pelo MCP
**Direção:** a pessoa dona pediu agrupar as ferramentas, identificar lacunas e melhorar as capacidades, usando Canva como referência de produto, sem mexer no editor. Criado `FERRAMENTAS.md`, com as 79 ferramentas em dez grupos, suporte atual, limites e propostas. PDF/apresentações são propostas para D9; geração de imagem continua dependente de D13. Nenhum novo formato de exportação ou decisão de negócio foi implementado.
**Primeiro bloco escolhido:** fazer `edit_image` funcionar no servidor, porque a matemática de pixels já existia em `core/imagefx.js` e faltava o adaptador fora do navegador do editor. Sem dependência nova. `core/image-edit.ts` define o contrato e a escrita pura no documento; `services/image-codec.ts` decodifica/gira/espelha/recorta/codifica; `services/image-operations.ts` aplica filtro/ajustes/fundo com o núcleo e controla fila. `main.ts` injeta o adaptador no workspace, que mantém os mesmos escopos e permissões.
**Segurança e limites:** `renderer.withImagePage` abre uma página vazia num contexto novo, com JavaScript da página desligado e rede bloqueada. Só o código confiável do codec roda em evaluate; dados não viram código. A edição aceita bytes de imagem já guardados no projeto, normaliza o MIME pelo conteúdo e confere dimensões antes e depois da decodificação. Arquivo até 16 MiB, lado até 8192 px e 16 milhões de pixels; efeitos por pixel até 4 milhões de pixels após recorte. Uma edição por vez, até quatro pedidos contando o ativo; excesso recebe mensagem para aguardar. O codec tem limite de tempo de 20 s e fecha o contexto ao terminar/falhar.
**Comportamento:** giro/espelhamento → recorte → máscara de fundo → filtro → ajustes → redução → codificação. PNG/WebP/JPEG; JPEG usa fundo branco; remover fundo sempre gera PNG transparente. A primeira original fica em `origAssetId`; edições repetidas não a perdem. Restaurar confere novamente o alvo antes da escrita e repõe dimensões naturais. Uma chamada é um passo de desfazer/refazer. Resultado atrasado não sobrescreve uma foto trocada enquanto o codec aguardava.
**Limites explícitos:** remoção de fundo é simples, pela cor das bordas, não segmentação de objetos por IA. GIF vira imagem estática e SVG é rasterizado; animação/metadados EXIF não são preservados. Fotos acima do limite de efeitos podem ser reduzidas primeiro com max_width em outra chamada. Geração externa continua indisponível e é recusada antes de rede/aprovação. Filtros puros ainda são síncronos no Node; limite de pixels/fila reduz carga, mas o timeout do Chromium não interrompe CPU síncrona. Pendência registrada na passagem.
**Manual:** removidas orientações antigas sobre agente interno, Jev, subagentes e remember; corrigidas afirmações de que MCP não cria estilos de texto/não vê imagens e de que imagens/fontes exportadas são todas embutidas/dependem de CDN. Mantidas boas orientações de design; documentados edição local, formatos e limites. Corrigida também a nota de get_image sobre fontes hospedadas.
**Verificação:** typecheck limpo; 463 testes passaram, 0 falhas, 0 pulados. Acrescentados 14 testes de edição/segurança, incluindo pixels esperados, transparência, formatos, MIME, filtros, limites, fila, original/histórico, concorrência, erro de original danificada, Chromium ausente e geração sem rede. O teste de STYLO_CHROMIUM_PATH agora usa o caminho configurado antes do padrão do Playwright e roda com o navegador já instalado.
**Uso real:** cliente oficial MCP listou 79 ferramentas e criou uma prancheta com imagem sintética; importou, girou, recortou, aplicou filtro P&B/brilho, gerou imagem, restaurou a original, removeu fundo, salvou e baixou ZIP HTML com a foto editada. Desfazer/refazer e reabrir o projeto passaram. PNGs de recorte e fundo transparente inspecionados; servidor encerrado. Não foram testados editor legado, provedores com chaves reais ou compilação do React exportado neste bloco; limite de saída de 16 MiB e timeout não foram forçados em teste. Próximo bloco recomendado: ajustes em lote e busca por propriedades.

## 2026-10-11 — Ajustar várias camadas em uma operação (`update_layers`)
**Autorização e objetivo:** a pessoa dona autorizou o próximo passo proposto: ajustar várias camadas numa única operação. Nova ferramenta `update_layers {updates:[{id,props},...]}`: de 1 a 100 itens, cada ID uma única vez, propriedades iguais ou diferentes por camada. Agora são 62 ferramentas do núcleo + 18 de plugins = 80 anunciadas. Não cria/move/apaga camadas nem muda breakpoints/estados.
**Atomicidade:** `tools/runner/batch.ts` prepara cópias das árvores afetadas, usando uma raiz compartilhada quando pai e filho estão no mesmo lote. Reutiliza `applyProps` e os comandos existentes, processando itens na ordem enviada. Valida o lote inteiro antes de pedir aprovação e revalida depois de aguardá-la, para não publicar uma cópia antiga sobre alterações feitas enquanto a pessoa respondia. Patches e resposta são preparados antes da escrita. Só então um `store.update` publica tudo; o executor central faz um commit. Um `undo` desfaz o lote inteiro. Texto não string recebe erro claro antes da publicação.
**Identidade e layout:** a publicação aplica patches aos nós vivos, sem substituir as árvores por cópias; preserva referências dos filhos e alterações de constraints/ordem feitas pelos comandos. Ao desligar layout, o comando usa as posições atuais do canvas/modelo como referência, não uma medida recalculada entre cada item do lote. Isso fica explícito na descrição da ferramenta. Não foi criado um segundo gerador de geometria no núcleo.
**Colaboração e atividade:** `targetsOf` inclui todos os IDs de `updates`. Lotes comuns reservam seus IDs; se houver `w`, `h` ou `layout.mode`, a ponte MCP acrescenta a trava de documento porque filhos fora da lista também podem mudar. Uma camada ocupada recusa a reserva inteira, sem reservar as outras. O log grava até 100 IDs para esta ferramenta; as demais mantêm o limite anterior de 50. Permissões de escrita/papel continuam conferidas pelo workspace.
**Verificação:** typecheck limpo; 37 testes focados passaram; suíte completa com 480 testes passando, 0 falhas e 0 pulados. Acrescentados 17 testes: 13 do lote, 2 da ponte de travas, 1 de presença e 1 de workspace. Cobrem erros no último item sem mudanças, argumentos estritos, IDs duplicados/ausentes, limite de 100 itens, histórico único, revalidação durante aprovação, pai/filho em ambas ordens, comando de layout que falha em cópia, texto inválido, trava integral/documento e log de 60 IDs com escopo de leitura/VIEWER recusados.
**Uso real:** cliente oficial MCP listou 80 ferramentas, criou uma tela e alterou quatro camadas com `update_layers`; lote inválido não mudou a primeira camada. Desfazer/refazer restaurou/reaplicou títulos e botões com um passo. Imagens desktop/mobile geradas; mobile inspecionada; auditoria medida encontrou 0 erros/avisos nessa tela. ZIP HTML baixado (HTTP 200, assinatura ZIP) e atividade com os quatro IDs conferida. Servidor encerrado.
**Ressalvas e próximo passo:** editor legado, provedores com chave real e compilação React não foram verificados neste bloco. Lotes de responsivo/estados e medidas intermediárias de layout não foram implementados; registrados na passagem. Não houve decisão de negócio, licença ou formato de exportação. Próximo bloco recomendado: ampliar `find_layers` para localizar por propriedades e vínculos, facilitando escolher os alvos do lote.

### 2026-10-11 — Busca por propriedades com respostas limitadas

**Pedido:** a pessoa dona aprovou localizar alvos sem despejar contexto excessivo no agente. Ampliada `find_layers`, sem ferramenta nova nem alteração no editor.
**Contrato:** filtros combinados por texto/tipo, página/subárvore, fonte/tamanho/peso, cor sólida, IDs de estilos/imagem/componente, tag/layout e flags. São valores base: não resolvem CSS, modos, estados, breakpoints ou visibilidade herdada. Padrão agora compacto, até20 itens/8192 bytes UTF-8; `fields:"ids"` para lotes e `summary` para o resumo anterior com medidas. Limite até100; orçamento1024..65536. `count` conta itens entregues; `total` conta todos; `nextOffset`/`hasMore` continuam a busca em ordem de árvore. Reiniciar após alterações/filtros novos. Clientes que precisavam de texto/layout no resultado devem pedir `summary` ou `get_layer`.
**Implementação:** módulo `runner/search.ts`, sem DOM. IDs nunca abreviados; nomes/páginas truncados por caracteres Unicode. O orçamento conta o JSON formatado efetivamente devolvido pelo MCP e avisos do workspace, excluindo o envelope do protocolo. Linha grande gera erro com orientação, sem página vazia/cursor parado; redução para caber mantém cursor no último item entregue. Aviso extenso é resumido. Compact/ids não chamam medição Chromium; summary mantém a medição existente. Manual orienta buscar IDs e abrir só detalhes necessários.
**Uso real:** cliente oficial MCP listou80 ferramentas;137 textos filtrados, padrão20 compacto e paginação de IDs sob1024 bytes sem perdas/repetições. Os20 primeiros foram ajustados juntos, nova busca encontrou117 restantes/20 ajustados e undo restaurou137. Servidor encerrado.
**Ressalvas:** orçamento de bytes não mede tokens nem cobrança real. Não verificados neste bloco: editor, provedores com chave real, revisão visual e exportação. PDF/slides seguem propostas; nenhuma decisão de licença/negócio. Próximo grupo técnico: manutenção dos estilos e componentes.

**Verificação deste bloco:** typecheck limpo;493 testes passaram,0 falhas/0 pulados. Acrescentados13 testes de filtros/escopo, paginação, orçamento UTF-8, erros/repetição, ausência de mutações, avisos com cursor correto e medição apenas em summary. Conferência real MCP descrita acima; sem mudanças no editor.

### 2026-10-12 — Inspeção textual por largura para agentes MCP

**Pedido:** continuar melhorando o uso pelos agentes, sem trabalhar na interface visual da pessoa usuária. Adicionada `inspect_layout` (81 ferramentas:63 núcleo+18 plugins), leitura sem aprovação/alteração de dados, para clientes que não entregam imagens ao modelo.
**Contrato:** `id` é uma tela frame raiz/dentro de seção raiz. Renderiza a tela inteira; `within_id` e `depth` filtram só a resposta. Largura desktop por padrão ou `breakpoint` OU `width` inteiro200..4000, sem clamp silencioso. Padrão até20 linhas/8192 bytes; limit até100, orçamento1024..65536, offset/nextOffset/hasMore e total dentro do escopo/profundidade. Recomeçar após alterações. Não envia texto/HTML/imagens nem grava medidas responsivas em w/h base.
**Medidas:** caixas root-relativas em pixels CSS, incluindo transformações; padding/gaps e tipografia computada preservam unidades/valores como normal. `rendered` indica caixa de layout, `visible` considera visibility/opacidade ancestral, sem oclusão; caixa ausente nula, tela oculta root:null. Indícios de saída horizontal da janela, saída do pai e conteúdo maior que caixa, sem chamar recorte/rolagem de erro automaticamente. Viewport height800 informado; não marca toda tela longa como vazamento vertical.
**Implementação:** contratos em core/layout-inspection.ts; seleção/resposta em runner/layout-inspection.ts; coletor DOM em server/services/layout-inspection.ts. Dependência injetada do renderer, Chromium com JS/rede externos desligados, espera fonts.ready e timeout20s encerrando contexto. Captura raiz/estilos/fontes/assets antes de esperar. Orçamento JSON formatado compartilhado com find_layers em response-budget.ts, inclusive avisos do workspace/cursor corrigido após redução; envelope MCP fora do orçamento. IDs não são interpolados em seletores CSS.
**Correção confirmada na revisão:** HTML manual malformado podia fechar wrapper e forjar data-node-id de outra camada (777×333 atribuídos a40×50). A cópia usada na inspeção agora sanitiza HTML e remove o marcador reservado dos atributos antes de exportar, preservando texto/markup; o coletor também ignora descendentes opacos de HTML/vetor/mídia. Teste de regressão com Chromium passou e comprovou documento original intacto. A proteção também entra no HTML com marcadores de measure/overflow; teste confirmou medida40×50 e ausência de vazamento falsamente atribuído ao retângulo nesses caminhos. HTML de imagem/exportação e documento original preservados.
**Uso real:** cliente oficial MCP listou81 ferramentas; CSS desktop/mobile conferido (fonte32→18), posição36/36, padding16,34 camadas paginadas sob4096 bytes sem perdas, saída horizontal identificada/corrigida e projeto salvo idêntico antes/depois das leituras (HTTP200). HTML malformado conferido no teste real do renderer, não criado via MCP (create_layer não oferece html).
**Ressalvas:** não verificados editor, provedores com chave real, exportação e composição estética neste bloco. Não mede tokens/cobrança, sobreposição/oclusão, reprodução de mídia ou estados de interação. Recursos remotos bloqueados; fontes não hospedadas podem ser substituídas. Não houve decisão de licença/negócio ou formato novo; PDF/slides seguem propostas. Próximo grupo: manutenção dos estilos/componentes ou auditoria textual.

**Verificação deste bloco:** typecheck limpo; 507 testes passaram, 0 falhas/0 pulados. Acrescentados 14 testes de escopo/profundidade/paginação, orçamento UTF-8, erros honestos, CSS responsivo, leitura sem alteração, isolamento e HTML malformado. Conferência final pelo cliente oficial MCP passou; servidor encerrado. Nenhuma mudança em apps/web, licença ou decisões de negócio.

### 2026-10-12 — README da branch atualizado para o estado atual

**Pedido:** atualizar a branch, o README e os detalhes no GitHub. README ampliado com foco servidor/MCP, instalação na limpeza, Chromium existente ou Playwright, conexão HTTP, grupos de capacidades, exemplos de busca/inspeção/lote e respostas limitadas. Documentados 81 tools anunciadas, geração indisponível, clientes não validados individualmente, limites de fotos, recursos remotos bloqueados, formatos pendentes e editor congelado. Referências para arquitetura, passagem, mapa e histórico mantêm os detalhes técnicos em seus arquivos próprios.
**Passagem:** corrigido comentário antigo de ~440 testes; agora registra 507/~5min da última suíte. Separada a preparação em clone limpo de 2026-10-11 das verificações posteriores; acrescentadas linhas de busca e inspeção textual na tabela atual.
**Verificação deste bloco:** apenas documentação; git diff --check limpo, links locais conferidos, três exemplos JSON validados contra schemas atuais (find_layers/inspect_layout/update_layers) e contagem de 63 ferramentas do núcleo conferida. Não repetida a suíte nem nova instalação: preservada a evidência anterior de 507 testes e typecheck limpo, sem apresentá-la como execução deste bloco. Nenhuma mudança em código, editor, licença ou decisões de negócio.

### 2026-10-12 — Plano aprovado de evolução do MCP

**Pedido:** planejar e seguir as melhorias antes do editor, atualizando contexto e registro a cada passo. Criado PLANO-MCP.md com etapas, critérios e protocolo de commit/pull/push por bloco: manutenção de recursos de design, organização, auditoria textual, entrega e validação individual por cliente quando disponível. Escopo inicial permanece páginas de sites pelo MCP; PDF/slides, IA generativa, editor, licença e negócio fora do plano.
**Verificação:** bloco só de documentação, sem executar novamente a suíte. Critérios distinguem teste do SDK MCP de uso em Codex/Claude Code/OpenCode/Kimi; indisponibilidade de cliente/credenciais será registrada como limite concreto, não como suporte comprovado.

### 2026-10-12 — Plano MCP, etapa 1: manutenção dos recursos de design

**Implementação:** list_design_resources/update_design_resource/delete_design_resource para cor/texto/efeito/gradiente/variável/modo (84 ferramentas:66núcleo+18plugins). Lista20/8KiB paginada com referências estruturadas; resumos de efeitos/gradientes usam contagens. Campos changes estritos por kind, nomes sem colisão e IDs mantidos. Atualiza vínculos base/variantes explícitas/snapshots, valida antes e depois da aprovação e escreve num passo de desfazer. Exclusão em uso exige detach explícito; preserva literais locais, limpa vínculos que poderiam reaparecer por sincronização. Modos implícitos não são recursos removíveis; excluir cor desligada perde variações por modo. CSS manual não é reescrito e recebe nota quando aplicável. Trava de documento protege propagação entre páginas/camadas; log não chama ID de recurso de ID de camada.
**Uso real:** SDK oficial listou84 tools, atualizou os seis tipos, conferiu propagação para componente/instância,36 recursos paginados sob1024 bytes, recusa de remoção em uso, detach preservando gap28, undo restaurando vínculo e tokens CSS com novo nome. Servidor encerrado.
**Limites:** não houve editor, provedores reais, revisão estética ou clientes individuais nesta etapa; só protocolo MCP real. Plano/contexto/mapa/readme/passagem atualizados. Próxima etapa: organização de camadas/páginas.

**Verificação final da etapa 1:** 519 testes passaram (0 falhas/0 pulados), typecheck limpo. Acrescentados12 testes de manutenção e trava/orçamento; SDK oficial MCP real descrito acima. Documentação/instruções atualizadas, sem repetir suíte por edição de texto.

### 2026-10-12 — Plano MCP, etapa 2: organização de camadas e páginas

**Implementação:** sete ferramentas,91 anunciadas (73núcleo+18plugins). Mesma página aberta/pai, IDs únicos até100; alinhamento/distribuição reutilizam commands/model-canvas com limites de fluxo/rotação explícitos. Agrupa irmãs consecutivas em tela, nunca telas raiz nem grupos em seções; protege exportação/semântica ul/ol. Desagrupa somente grupos/seções sem efeitos/recorte/interação/variações, não desmonta frames. Recusa sobrescritas posicionais e estrutura de instâncias. Comandos síncronos reutilizados com store.commit temporariamente suprimido em try/finally; executor central faz um passo. Reordenação por splice único, páginas sem trocar ativa. Respostas até20 IDs/contagem; alterações reservam documento.
**Problemas confirmados e prevenidos:** irmãs intercaladas mudariam ordem visual; overrides mobile.x deslocavam após agrupamento; opacity do grupo se perdia ao desagrupar. Casos recusados antes da aprovação, até haver preservação explícita. Seleção restaurada em operações geométricas e mantida intencionalmente nos grupos/resultados.
**Uso real:** SDK oficial listou91 tools; posições reais0/50/100 após alinhar/distribuir; group/ungroup preservaram medidas; undo/redo e ordem conferidos, página renomeada/reordenada manteve ativa. Recusas de rootframes, variação responsiva e efeitos conferidas. Geometria base não resolve CSS manual; conferir com inspect_layout. Sem editor/provedores/clientes individuais nesta etapa.

**Verificação final da etapa 2:** 537 testes passaram (0 falhas/0 pulados), typecheck limpo. Acrescentados18 testes de organização, casos recusados, contexto/resposta e trava de documento. SDK oficial real descrito acima; servidor encerrado. Documentos atualizados; editor/licença/negócio intactos.

### 2026-10-12 — Plano MCP, etapa 3: auditoria ampliada

**Implementação:** checks styles/touch opcionais em check_design, sem novas ferramentas (91). Estilos verificam referências explícitas e equivalência dos campos efetivamente compartilhados, incluindo itálico. Touch mede tag/tamanho real em snapshots por largura, lotes de100 IDs e limite200 alvos padrão. Zero área recebe aviso; ausência/falha/limite excedido informa NÃO verificado, sem resultados parciais. checked separa conferências; paginação20/8KiB com contagens totais e orçamento aplicado após avisos do workspace.
**Verificação:** 550 testes passaram, zero falhas/pulados; typecheck limpo. MCP real detectou estilo sem vínculo e botão mobile30×30; vínculo e44×44 corrigiram avisos; CSS real0×20 foi detectado. Não certifica acessibilidade, exceções de espaçamento/oclusão, HTML manual interno ou estética. Cliente individual ainda não conferido nesta etapa. Editor e negócio intactos.
