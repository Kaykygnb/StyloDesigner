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
