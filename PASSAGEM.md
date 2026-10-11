# Passagem de trabalho — Stylo

**Quem assume o projeto: leia nesta ordem.** (1) este arquivo; (2) `contexto.md` — o que a ferramenta é, vocabulário, mapa do código e receitas;
(3) `decisoes.md` — o diário do porquê (só se acrescenta no fim; nunca reescreva uma entrada antiga).

Estado em **2026-10-11**. Branch **`limpeza`**. `C:\Users\LENOVO\Desktop\Blbla\StyloDesigner` é o clone Windows da pessoa dona; o trabalho atual do agente acontece num clone descartável na nuvem.
**O trabalho está no GitHub, na branch `limpeza`** (enviada em 2026-10-11 por decisão da pessoa dona; o repositório é **PÚBLICO** e a licença é **MIT**). A `main` e a `stylo-2.0-planning` de lá são versões antigas e **não foram tocadas**. Nenhum PR aberto. Última verificação na nuvem: **449 testes, 448 passando, 0 falhas, 1 pulado** (teste específico que procura o Chromium do Playwright; os demais testes visuais usaram `/usr/bin/chromium`); `npm run typecheck` limpo.

**Último bloco:** executor das ferramentas dividido em módulos TypeScript, sem mudar o contrato. Conferência real pelo cliente oficial MCP: 79 ferramentas, criação de tela, estilo de cor, ajuste e imagem no celular, auditoria medida, tokens, exportação HTML/React, download dos dois ZIPs, desfazer/refazer. Servidor encerrado depois. Não foi conferido o editor legado, não houve chaves reais de provedores nem instalação/compilação do React exportado neste bloco.

**Sobre a pessoa dona:** não é programadora de formação; delega as decisões técnicas, quer entender o porquê e quer tudo em módulos
pequenos. Conversa em português. As decisões de **negócio** (seção 3) são dela: apresente opções com recomendação e espere a resposta.

---

## 1. Comece aqui (verificado num clone limpo, 2026-10-11)

**De onde vem o código:** a branch **`limpeza`** do GitHub (`Kaykygnb/StyloDesigner`, repositório público). **A `main` de lá é a versão ANTIGA: nunca use a `main`.**
**Hoje o agente trabalha na NUVEM** (ambiente descartável: o que não for enviado ao GitHub se perde), então: `git clone -b limpeza https://github.com/Kaykygnb/StyloDesigner.git`, e **`git pull --rebase origin limpeza` + `git push` ao fim de cada bloco** (pushes na `limpeza` estão autorizados; nada de `--force`, PR ou `main`).
Se for rodar na máquina Windows da pessoa dona (pasta `C:/Users/LENOVO/Desktop/Blbla/StyloDesigner`, que é um clone da mesma branch): abra a sessão DENTRO de `StyloDesigner`, só um agente por vez (arquivos, banco PGlite e porta 5173 não aceitam dois).
Dados locais (banco `designer.db/`, chave `designer.secret`, `designer.config.json`) **não vão para o git**; num clone novo eles são criados na primeira execução.
Chromium na nuvem: costuma vir pré-instalado; use `STYLO_CHROMIUM_PATH=<executável>` em vez de baixar outro (veja `contexto.md §4`).

```bash
cd StyloDesigner
npm install                          # ~1 min; roda o `prisma generate` sozinho
npx playwright install chromium      # para get_image, check_design (vazamento) e a medida de layout
npm run typecheck                    # deve passar sem erro
npm start                            # http://localhost:5173 — servidor + editor legado; PGlite local; sem login
claude mcp add --transport http stylo http://localhost:5173/mcp   # conecta um agente (Claude Code)
npm test                             # ~440 testes, 2–3 min
```
Confirmado no clone limpo: instala, o typecheck passa, o servidor sobe, o MCP lista **79 ferramentas**, e um cliente do SDK oficial cria
projeto, monta uma tela (`build_layout`), audita (`check_design`), recebe a imagem (`get_image`) e exporta (`export_zip`).

**O melhor jeito de entender o produto em 10 minutos:** conecte um agente e peça "monte uma landing page para uma loja de plantas, confira
no celular e exporte em React". Onde ele tropeçar é onde a ferramenta precisa melhorar (foi assim que se achou boa parte do que está em `decisoes.md`).

## 2. O que existe hoje

| Área | Estado |
|---|---|
| Servidor, MCP (SDK oficial, sessões, 79 ferramentas), contas, agentes com token/escopos, presença, log, notas, compartilhamento | ✅ |
| Projetos no Postgres/PGlite com revisão, versões, miniaturas; imagens/fontes/áudio fora do JSON (por sha256) | ✅ |
| Construir: `build_layout`, `create_layer`, `update_layer`, componentes, responsivo (`set_responsive`), estados, interações | ✅ |
| **Ver**: `get_image` (inclusive por breakpoint), com layout **medido de verdade** no Chromium | ✅ (precisa do Chromium) |
| **Auditar**: `check_design` — vazamento por breakpoint, contraste, texto pequeno, alt, títulos, alvo clicável | ✅ (vazamento precisa do Chromium) |
| Identidade: estilos de cor/texto/sombra/gradiente, modos claro/escuro, variáveis, `export_tokens` (CSS/JSON/Tailwind), pares de fontes, brief, escalas, contraste | ✅ |
| Assets: biblioteca da conta, 6 provedores gratuitos, fontes hospedadas no projeto, créditos, fontes cadastráveis, mídia (vídeo/áudio/3D/Lottie) como camada | ✅ — **Pexels/Pixabay/Poly Pizza nunca rodaram com chave real** |
| Exportar: zip HTML (imagens/fontes/players/créditos como arquivos) e **projeto React (Vite)** | ✅ |
| Editor visual | 🟡 legado (`apps/web`), a ser refeito; **não mexa** |
| React Native, TypeScript no React, JS de protótipo, paleta de imagem | ❌ |
| Exposição segura na internet (HTTPS, limites, login no editor) | ❌ — o servidor só aceita local |

Atenção: `edit_image` e `generate_image_edit` aparecem na lista de ferramentas mas **não funcionam no servidor** (dependem do navegador).

---

## 3. Decisões que dependem do DONO (não decida por ela)

Cada uma traz minha recomendação e o que fica travado enquanto não houver resposta. **Bloqueiam o lançamento** = D1–D7, D12.

| # | Decisão | Minha recomendação | Enquanto isso |
|---|---|---|---|
| **D1** | **Licença e modelo de negócio** | FSL ou PolyForm Shield (veja abaixo) | **o código da `limpeza` já está público em MIT** (decisão da pessoa dona); falta a licença das versões futuras e o serviço |
| **D2** | **O que fazer com o git** (232 commits locais, `designer.secret` no histórico antigo) | reescrever o histórico sem o segredo e manter o antigo numa branch `legado` | `limpeza` enviada (pública); `main` antiga intocada |
| **D3** | Nome do produto, nome do servidor MCP nos exemplos, domínio | "Stylo" + servidor MCP `stylo` | docs usam `stylo` |
| **D4** | Idioma do produto (hoje: instruções e mensagens em português) | manter pt-BR agora, isolar os textos para permitir inglês | tudo em pt-BR |
| **D5** | Onde hospedar (servidor, Postgres, arquivos, HTTPS) | VPS pequeno + Postgres gerenciado + Cloudflare R2 + Caddy (HTTPS) | só local |
| **D6** | Quem entra e como (cadastro aberto, convite ou aprovação; login por e-mail/senha ou Google/GitHub; política padrão de agentes) | convite + e-mail/senha; agentes em `approval` | modo local sem login |
| **D7** | O que cobrar e os limites por plano (assentos, projetos, armazenamento, operações de agente/dia) | cota de armazenamento + limite de operações de agente por conta, plano grátis pequeno, cobrança via Stripe | cota fixa de 2 GB e mídia ≤ 25 MB |
| **D8** | Chaves de provedores de assets: cada conta traz a sua (BYOK) ou uma chave única do serviço | BYOK no início (é como funciona hoje); só usar chave única depois de ler os termos do Pexels/Pixabay | BYOK |
| **D9** | Próximos formatos de exportação | variante **TypeScript** do React (barata), depois **React Native**; Vue/Svelte só se pedirem | só HTML e React |
| **D10** | **Editor novo**: tecnologia, escopo do v1, quando começar; colaboração por operações no servidor ou CRDT | React + Vite, canvas DOM como hoje, **operações enviadas ao workspace** (sem CRDT) | editor legado congelado |
| **D11** | JavaScript de protótipo: o agente pode escrever? | confirmar a regra já combinada (só ao Apresentar, em iframe isolado, nunca no editor/servidor) e deixar para quando houver demanda | `<script>` é removido |
| **D12** | Privacidade e termos de uso (LGPD/GDPR, exclusão de conta, retenção de versões, direitos sobre o que os agentes geram e sobre assets de terceiros) | texto jurídico antes do lançamento | — |
| **D13** | IA generativa de imagem (`generate_image_edit`): manter? | tirar do núcleo e virar plugin opcional com chave da própria conta | não funciona no servidor |
| **D14** | Telemetria e logs do serviço pago | só erros e métricas agregadas; nunca o conteúdo dos projetos | nenhuma |

### Detalhe das que mais pesam

**D1 — Licença.** O pedido é "source-available": ninguém vende a ferramenta como produto próprio; **usar o resultado** (os sites) é livre e
agentes que a usam para prototipar são bem-vindos. Hoje o repositório está em **MIT** (qualquer um pode revender). Opções:
*FSL (Functional Source License)* — impede concorrente direto por 2 anos e depois vira MIT/Apache; *PolyForm Shield* — impede concorrente
direto sem prazo; *AGPL* — copyleft (um SaaS concorrente teria de abrir o código dele); *fechar o código*. Não chame de "open source"
(a definição oficial não permite restringir uso comercial). Se aceitar contribuições de terceiros, precisa de um **CLA**. **Precisa de revisão
jurídica** antes de valer. O `NOTICE` já lista as licenças das dependências (todas MIT/ISC/Apache, compatíveis).
**Já aconteceu (2026-10-11):** a pessoa dona mandou enviar a branch `limpeza` ao GitHub **público, em MIT**. Esse código passou a poder ser copiado e reutilizado por qualquer um, inclusive para vender, e **isso não se desfaz** para quem já copiou. Uma licença nova (FSL/Shield) só vale para versões futuras. Se a intenção de "source-available" continua, decidir D1 **antes** de enviar mais código importante.
**Posição da pessoa dona (2026-10-11):** o repositório é dela e a licença será decidida **depois**; se o resultado não ficar bom, ela **apaga o repositório e cria outro** (apagar não desfaz cópias já feitas por terceiros, mas permite recomeçar com a licença certa). Por isso: quem programa **não decide nada de licença** e **não conta com o remoto existir para sempre** — se um `push` ou `fetch` falhar porque o repositório sumiu ou mudou de endereço, **pare e avise a pessoa dona**; o histórico local continua valendo.

**D2 — Git (parcialmente resolvida em 2026-10-11).** A pessoa dona mandou enviar a branch `limpeza` ao GitHub, sem tocar na `main`. Antes do envio, o histórico foi varrido: só a
`designer.secret` (chave de criptografia **local de desenvolvimento**, commitada por engano no começo e removida depois) era sensível; nenhuma chave de API. Como o repositório é público, a chave
ficou visível no histórico; o banco local guardava **0 chaves criptografadas** com ela e **a chave foi trocada** (a antiga virou inútil). Nunca reutilize uma chave que tenha estado no git.
**Ainda aberto:** (a) reescrever o histórico para apagar o arquivo de vez (opcional; mudaria os códigos dos commits); (b) o que fazer com a `main` antiga — recomendo arquivar como branch `legado` e
fazer o merge da `limpeza` na `main` só quando a licença (D1) estiver decidida; (c) se o repositório segue público até lá.

**D7 — Cobrança.** Já existem como base: cota de biblioteca por conta (`STYLO_LIBRARY_QUOTA_MB`), log de operações por agente, limites de tamanho por
tipo de arquivo. Faltam planos, limite de requisições, medição de uso e integração de pagamento. Decidir **o que é a unidade cobrada** antes de implementar.

### Ações que só a pessoa dona pode fazer (não são decisões)
- Cadastrar chaves reais do **Pexels**, **Pixabay** e **Poly Pizza** (`PUT /api/providers/<id>/key` ou variáveis de ambiente) para a verificação real.
- Contratar a revisão jurídica (D1, D12) e escolher domínio/hospedagem (D5).
- Apontar um agente real (Claude Code/Codex) para o servidor e dizer onde ele travou.

---

## 4. Próximos passos técnicos — o programador pode fazer SEM esperar decisão

Ordem sugerida (do que mais destrava para o que mais agrega):

1. **Dividir os arquivos grandes**, **sem mudar comportamento**, sob a suíte atual. **Executor concluído:** `tools/runner.ts` coordena módulos TypeScript em `tools/runner/`; `runner.js` é só uma fachada de compatibilidade. **Restam:** `css.js` ~1150 linhas e `commands.js` ~1250. É a regra mais repetida da pessoa dona ("não um arquivo com mil coisas"). Converta para `.ts` os que mexer.
2. **Mídia grande fora do documento:** guardar só a referência no `doc` e os bytes nos blobs, e então remover o limite de 25 MB por mídia (`assertFitsProject` em `plugins/assets/index.ts`). Pontos: a exportação (`site-export.ts`) é pura — injetar `readMedia(hash)`; o servidor lê dos blobs.
3. **Paleta a partir de imagem** sem dependência nova: o Chromium já está no servidor e `page.evaluate` funciona com o JavaScript da página desligado — decodificar a imagem com `createImageBitmap`/canvas em `renderer.ts` e agrupar as cores (k-means simples) em `plugins/identidade`. O mesmo caminho destrava `edit_image` no servidor.
4. **Ferramentas de remover/renomear** estilos, modos e variáveis (hoje só se cria e se liga).
5. **`check_design` mais completo** (`core/audit.ts`): cores fora dos estilos, ordem de foco, área de toque de 44 px no celular, medida de tamanhos por breakpoint também em `get_layer`.
6. **Verificação real dos provedores** quando houver chaves; conferir a API oficial do **Poly Pizza** (`plugins/assets/providers/polypizza.ts`, hoje `unverified`).
7. **Arquivo de licenças dentro do zip exportado** (players de 3D/Lottie e fontes) — pendência do `NOTICE`.
8. **Testes de rota HTTP** de `site.zip`/`react.zip`; teste de React com um projeto que use estados (hover) e animações.
9. **Preparar o terreno da hospedagem sem fechar decisões:** interface de `blobs.ts` para S3/R2 (já existe a interface; falta a implementação), filtro de eventos SSE por pessoa, limite de requisições por token. (A parte de HTTPS/domínio depende de D5.)
10. **Limpar o repositório:** `scripts/auditar-colaboracao.mjs` e `scripts/gerar-miniatura-vitrine.mjs` são do editor antigo (provavelmente quebrados); `tests/e2e/*` está desatualizado; `apps/web` sai quando o editor novo chegar.

O que **depende de decisão** e por isso não está nesta lista: React Native e TypeScript no React (D9), editor novo (D10), JS de protótipo (D11), hospedagem/login/cobrança (D5–D7).

---

## 5. Registro do que está sendo PULADO de propósito

Lista viva: tudo que foi visto e deixado de lado. Quem pular algo novo, acrescente aqui; quem resolver, marque como feito (não apague).

| O que | Por que foi pulado | O que destrava |
|---|---|---|
| Paleta a partir de imagem; `edit_image`/`generate_image_edit` no servidor | exigem ler pixels; não há biblioteca de imagem | passo 3 acima (Chromium) |
| Mídia grande dentro do projeto (limite 25 MB) | hoje vira data URL na memória | passo 2 |
| `poster` do vídeo / prévia da mídia no canvas / mídia visível em `get_image` | decodificar vídeo; vídeo/3D/Lottie não desenham sem JS | editor novo, ou extrair um quadro no renderizador |
| Tela para cadastrar chaves de provedores | o editor será refeito | editor novo (a API `PUT /api/providers/<id>/key` existe) |
| Pexels, Pixabay, Poly Pizza com chave real | não há chaves | ação da pessoa dona; **Poly Pizza** ainda precisa conferir a API oficial |
| Lottie e ilustrações como fonte de assets | falta escolher APIs e conferir licenças (LottieFiles tem termos próprios) | pesquisa de fontes abertas |
| Remover/renomear modo, variável, estilo por MCP | só criar e ligar foi priorizado | passo 4 |
| Tabela de cores CSS nomeadas ("red" em SVG importado) | `svgimport.js` depende do canvas do navegador | tabela fixa de ~150 nomes |
| `tokens.css` dentro do zip HTML | o HTML já leva as variáveis que usa | se um agente pedir |
| Sombra de texto como variável; opacidade do Tailwind nas cores (`bg-fundo/50`) | `text-shadow` tem outra sintaxe; limite do `var()` no Tailwind v3 | cores em canais RGB nos tokens |
| React: navegação por `#` (sem React Router), só JavaScript, `public/` exige site na raiz do domínio | simplicidade | D9 |
| React Native; variante TypeScript do React | o React veio primeiro; RN usa outro modelo (só flex, sem grid) | D9 |
| Auditoria além de contraste/alt/tamanho/títulos/alvo/vazamento | o essencial primeiro | passo 5 |
| Medida de layout só no desktop e no breakpoint pedido | a "medida de volta" do editor também ignora breakpoints | se um agente precisar |
| Rota HTTP `react.zip`/`site.zip` sem teste automatizado dedicado | mesmo caminho nas duas; download real das duas rotas conferido em 2026-10-11 após dividir o executor | passo 8 |
| Teste específico de `STYLO_CHROMIUM_PATH` procura o executável padrão do Playwright | na nuvem há `/usr/bin/chromium`; o teste específico se pula, embora renderização, medida e auditoria funcionem com ele | adaptar o teste para aceitar o navegador já instalado, sem baixar outro |
| Exposição na internet (HTTPS, limites, SSE por pessoa, login no editor) | produto ainda não hospedado | D5–D6 |
| Cobrança, planos, cotas por plano, S3/R2 | só há pasta/memória e cota fixa | D5, D7 |
| TypeScript no resto do núcleo (`store`, `commands`, `css`...) | converter tudo de uma vez deu ~700 erros; **executor convertido e dividido** | converter ao mexer (passo 1) |
| `tests/e2e` antigos | dependem do chat/agente removido e do editor antigo | editor novo (D10) |
| Importador de `.json` antigos | é só uma ponte | `npm run importar`; apagar quando não houver mais `.json` |
| Arquivo de licenças dentro dos zips exportados | pendência do `NOTICE` | passo 7 |

## 6. Regras de trabalho que a pessoa dona pediu

- Decisão grande: explicar o porquê e registrar em `decisoes.md` (**sempre acrescentando**, sem reeditar o que já está lá).
- Código em módulos pequenos; evitar reinventar o que um framework faz bem; dependências são bem-vindas se encolherem o código.
- Segurança desde o começo: HTML/CSS que entra **nunca** é confiável (sem `<script>`, sem JS no servidor, Chromium sem rede, proteção SSRF).
- Só uso comercial livre nos assets de terceiros; sempre registrar licença e crédito.
- **Pushes só na branch `limpeza`**, sem `--force`, sem PR e sem tocar na `main`. Não apagar dados da pessoa. Não mexer no editor (`apps/web`) por enquanto.
- Antes de afirmar que algo funciona: testar de verdade (suíte + uma checagem real) e dizer com franqueza o que **não** foi verificado.

## 7. Armadilhas conhecidas

- **Windows:** o shell mastiga aspas, crases e `$` em comandos longos. Para editar arquivos grandes use a ferramenta de edição, não `node -e`/heredoc com template literals.
- **O typecheck não cobre os `.js` legados**, como `css.js` e `commands.js`. O executor agora está em TypeScript e é checado; `runner.js` só reexporta. Ao mexer no executor, rode os testes de agente e `tests/runner-seguranca.test.ts`, além da suíte inteira.
- **PGlite** aceita um processo por vez e travou uma vez ao fechar com consulta em andamento: sempre `await operations.idle()` antes de fechar o banco (já feito em `main.ts` e nos testes).
- **Testes de servidor** sobem um PGlite cada; sob carga o primeiro pedido demora (a espera é de até 60 s, de propósito).
- `designer.secret`, `*.blobs/`, `designer.config.json` e `designer.db/` são dados locais: **não vão para o git** (`.gitignore`).
- `tools/runner/images.ts` tem um auxiliar local `imageInfo`; o import de `image-size.ts` entra como `sniffImage` por causa disso.
- Migrações Prisma: `prisma migrate diff --from-schema <antigo> --to-schema packages/db/prisma/schema.prisma --script` (não há Postgres de verdade aqui para `migrate dev`).
- **Argumentos das ferramentas são estritos:** se um cliente MCP mandar campo extra, recebe erro listando os aceitos (de propósito; veja `decisoes.md`).
- O Chromium é opcional para o resto, mas sem ele `get_image`, o vazamento do `check_design` e a medida de layout ficam de fora (as ferramentas avisam).

## 8. Histórico resumido (detalhes e porquês em `decisoes.md`)

Faxina do repositório e remoção do agente embutido → MCP headless (workspace) → monorepo + Vite → Postgres/Prisma/PGlite → contas, agentes e conta mestre →
projetos com revisão e versões → Hono + SDK oficial do MCP → ferramentas em Zod → colaboração (notas, atividade, compartilhar) → `get_image` →
imagens fora do JSON → contrato de plugins + identidade visual → assets (biblioteca, provedores, fontes, créditos, mídia) → tokens, estilos de texto/sombra/gradiente,
modos, variáveis → exportador React → **dogfooding** (agente construindo uma página): medida real de layout, `get_image` por breakpoint, `check_design`, argumentos estritos.
