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
