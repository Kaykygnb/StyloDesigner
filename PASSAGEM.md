# Passagem de trabalho — Stylo

**Quem assume o projeto: leia nesta ordem.** (1) este arquivo; (2) `contexto.md` — o que a ferramenta é, vocabulário, mapa do código e receitas;
(3) `decisoes.md` — o diário do porquê (só se acrescenta no fim; nunca reescreva uma entrada antiga).

Estado em **2026-10-12**. Branch **`limpeza`**. `C:\Users\LENOVO\Desktop\Blbla\StyloDesigner` é o clone Windows da pessoa dona; o trabalho atual do agente acontece num clone descartável na nuvem.
**O trabalho está no GitHub, na branch `limpeza`** (enviada em 2026-10-11 por decisão da pessoa dona; o repositório é **PÚBLICO** e a licença é **MIT**). A `main` e a `stylo-2.0-planning` de lá são versões antigas e **não foram tocadas**. Nenhum PR aberto. Última verificação na nuvem: **555 testes, 555 passando, 0 falhas, 0 pulados**, com `STYLO_CHROMIUM_PATH=/usr/bin/chromium`; `npm run typecheck` limpo.

**Último bloco:** [ARQUITETURA-EDITOR.md](ARQUITETURA-EDITOR.md) fecha escolhas técnicas delegadas: React/TS/Vite, DOM isolado, contexto por sessão, operações comuns, fila/revisão/idempotência, conflitos explícitos e undo conservador. Planejamento concreto, não implementação: nenhum apps/web/store/workspace alterado ou novo teste. Primeiro bloco futuro deve provar contratos de concorrência/persistência. Negócio/acesso pendentes permanecem separados; suíte anterior555/tipos limpos.

**Sobre a pessoa dona:** não é programadora de formação; delega as decisões técnicas, quer entender o porquê e quer tudo em módulos
pequenos. Conversa em português. As decisões de **negócio** (seção 3) são dela: apresente opções com recomendação e espere a resposta.

---

## 0. O produto em duas versões (decisão da pessoa dona, 2026-10-12)

**Versão BASE — é esta que estamos construindo agora.** Qualquer pessoa **baixa o Stylo do GitHub e roda na própria máquina** (a "instalação"): ela guarda os projetos, serve o painel, o editor e o MCP.
O primeiro acesso cria uma conta de administrador; o administrador pode liberar contas para uma **pequena equipe** (mesma rede). **A prioridade é uma ferramenta ESTÁVEL que funcione**, não ter muitas coisas.
**Licença pretendida da versão base:** baixar e usar é livre (você e sua pequena equipe, inclusive para criar sites e apps com ela), **mas ninguém pode lançá-la como produto próprio nem lucrar vendendo a ferramenta**. (A licença ainda não foi escolhida: veja D1 e D15.)

**Versão PAGA hospedada — outro produto, para DEPOIS.** Roda no servidor da pessoa dona e é uma evolução muito maior desta. **Não trabalhe nela agora**: nada de cobrança, planos, multiusuário em nuvem, S3/R2 ou domínio. O que ela exigir (D5, D7, D12-serviço, D16) está separado na seção 3 para não contaminar a versão base.

**Consequência prática para quem programa:** em dúvida entre "mais um recurso" e "mais estabilidade", escolha estabilidade (a lista do que isso significa está na seção 4, "Meta: estável").

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
npm test                             # última suíte: 555 testes; ~5 min na nuvem
```
Preparação em clone limpo conferida em 2026-10-11. Na versão atual, o MCP lista **91 ferramentas**; os blocos de uso real do SDK oficial conferiram criação/montagem, auditoria, imagem/exportação e, mais recentemente, busca/lote e inspeção textual por largura. As verificações de cada bloco e suas ressalvas estão no fim de `decisoes.md`.

**O melhor jeito de entender o produto em 10 minutos:** conecte um agente e peça "monte uma landing page para uma loja de plantas, confira
no celular e exporte em React". Onde ele tropeçar é onde a ferramenta precisa melhorar (foi assim que se achou boa parte do que está em `decisoes.md`).

## 2. O que existe hoje

| Área | Estado |
|---|---|
| Servidor, MCP (SDK oficial, sessões, 91 ferramentas), contas, agentes com token/escopos, presença, log, notas, compartilhamento | ✅ |
| Projetos no Postgres/PGlite com revisão, versões, miniaturas; imagens/fontes/áudio fora do JSON (por sha256) | ✅ |
| Construir: `build_layout`, `create_layer`, `update_layer`, componentes, responsivo (`set_responsive`), estados, interações | ✅ |
| Localizar por propriedades: `find_layers`, página/subárvore, filtros, IDs/resumo e paginação | ✅ — até 20 itens/8KiB por padrão; valores base |
| Inspecionar em texto: `inspect_layout`, posição/tamanho/espaçamentos/fonte por largura/breakpoint | ✅ — Chromium; resposta recortada/paginada; não altera dimensões base |
| Ajustar em lote: `update_layers`, até 100 IDs únicos, validação antes da escrita, um desfazer, log e travas | ✅ — `w/h/layout.mode` reservam o documento; demais lotes reservam seus IDs |
| **Ver**: `get_image` (inclusive por breakpoint), com layout **medido de verdade** no Chromium | ✅ (precisa do Chromium) |
| **Auditar**: `check_design` — vazamento por breakpoint, contraste, texto pequeno, alt, títulos, alvo clicável | ✅ (vazamento precisa do Chromium) |
| Identidade: estilos de cor/texto/sombra/gradiente, modos claro/escuro, variáveis, `export_tokens` (CSS/JSON/Tailwind), pares de fontes, brief, escalas, contraste | ✅ |
| Assets: biblioteca da conta, 6 provedores gratuitos, fontes hospedadas no projeto, créditos, fontes cadastráveis, mídia (vídeo/áudio/3D/Lottie) como camada | ✅ — **Pexels/Pixabay/Poly Pizza nunca rodaram com chave real** |
| Edição local de fotos (`edit_image`) pelo MCP: giro, recorte, filtros, ajustes, fundo simples, formato e restauração | ✅ — Chromium isolado; sem IA externa/chave; limites em `FERRAMENTAS.md` |
| Exportar: zip HTML (imagens/fontes/players/créditos como arquivos) e **projeto React (Vite)** | ✅ |
| Editor visual | 🟡 legado (`apps/web`), a ser refeito; **não mexa** |
| React Native, TypeScript no React, JS de protótipo, paleta de imagem | ❌ |
| Acesso pela **rede local** com login (versão base) | 🟡 planejado em `ACESSO-WEB.md`; hoje o servidor só aceita local. **Internet pública não faz parte da versão base** |

Atenção: `generate_image_edit` continua anunciado, mas **não funciona pelo MCP do servidor**. `edit_image` agora funciona quando há Chromium. Capacidades e propostas por grupo: `FERRAMENTAS.md`.

---

## 3. Decisões que dependem do DONO (não decida por ela)

Cada uma traz minha recomendação e o que fica travado enquanto não houver resposta. Separadas nas duas versões (seção 0). **Bloqueiam o lançamento da versão base: D1, D2, D3, D12.**

### Versão BASE (agora)

| # | Decisão | Minha recomendação | Enquanto isso |
|---|---|---|---|
| **D1** | **Licença da versão base**: baixar e usar é livre; ninguém lança nem lucra vendendo a ferramenta | **PolyForm Shield 1.0.0** (uso livre para qualquer finalidade, **exceto** oferecer algo que concorra com o Stylo). Alternativa: FSL, que vira MIT/Apache depois de 2 anos (o oposto do que você quer). Detalhe abaixo | **o código da `limpeza` já está público em MIT** (decisão da pessoa dona); falta a licença das versões futuras |
| **D15** | A "pequena equipe" tem limite de tamanho? Uma empresa grande pode usar internamente? | Sem limite: o que se proíbe é **revender/concorrer**, não usar. Se quiser limitar por tamanho ou faturamento: PolyForm Small Business (grátis só para empresas pequenas) | usar a recomendação de D1 |
| **D2** | **O que fazer com o git** (`designer.secret` no histórico antigo; `main` antiga) | reescrever o histórico sem o segredo e manter o antigo numa branch `legado` | `limpeza` enviada (pública); `main` antiga intocada |
| **D3** | Nome do produto, nome do servidor MCP nos exemplos | "Stylo" + servidor MCP `stylo` | docs usam `stylo` |
| **D4** | Idioma: a versão base é para o público geral; hoje instruções, mensagens e docs são em português | pt-BR primeiro, textos isolados para permitir inglês depois; README de uso em inglês quando for divulgar | tudo em pt-BR |
| **D6** | Acesso na instalação: quem cria contas, login, política de agentes (o plano está em `ACESSO-WEB.md`) | só o administrador cria contas (sem cadastro aberto); login por identificação+senha; agentes em `approval` | modo local sem login |
| **D8** | Chaves de provedores de assets: cada instalação traz as suas (BYOK) | BYOK (é como funciona; não existe chave "do Stylo" na versão base) | BYOK |
| **D9** | Próximos formatos de exportação | variante **TypeScript** do React (barata), depois **React Native**; Vue/Svelte só se pedirem | só HTML e React |
| **D10** | **Editor novo**: a tecnologia e a arquitetura foram delegadas e fechadas em `ARQUITETURA-EDITOR.md`; **continua sua:** o escopo do v1 e quando começar a programar | começar só depois de provar concorrência/persistência (primeiro bloco já descrito lá) | editor legado congelado |
| **D11** | JavaScript de protótipo: o agente pode escrever? | confirmar a regra combinada (só ao Apresentar, em iframe isolado) e deixar para quando houver demanda | `<script>` é removido |
| **D12** | **Aviso de privacidade e termos mínimos da versão base** (os dados ficam na instalação de quem usa; o administrador responde por ela; assets de terceiros mantêm a licença deles) | texto curto e honesto no README/NOTICE, com revisão jurídica rápida | `NOTICE` atual |
| **D13** | IA generativa de imagem (`generate_image_edit`): manter? | tirar do núcleo e virar plugin opcional com chave da própria instalação | não funciona no servidor |
| **D14** | Telemetria na versão base | **nenhuma** (se um dia houver, só opcional e avisada); nunca o conteúdo dos projetos | nenhuma |

### Versão PAGA hospedada (DEPOIS — não trabalhar agora)

| # | Decisão | Minha recomendação (para quando chegar a hora) |
|---|---|---|
| **D5** | Onde hospedar (servidor, Postgres, arquivos, HTTPS, domínio) | VPS pequeno + Postgres gerenciado + Cloudflare R2 + Caddy (HTTPS) |
| **D7** | O que cobrar e os limites por plano (assentos, projetos, armazenamento, operações de agente/dia) | cota de armazenamento + limite de operações de agente por conta, plano grátis pequeno, cobrança via Stripe |
| **D12-serviço** | Privacidade e termos do **serviço** (LGPD/GDPR, exclusão de conta, retenção de versões, direitos sobre o que os agentes geram) | texto jurídico completo antes do lançamento |
| **D16** | Relação entre as duas versões: que parte do código da base entra na paga, em que licença a paga fica, como aceitar contribuições de terceiros sem perder o direito de relicenciar | a pessoa dona é a única titular do código hoje; antes de aceitar contribuições externas, exigir um **CLA** (termo de cessão) |

### Detalhe das que mais pesam

**D1 — Licença da versão base.** O que a pessoa dona quer (2026-10-12): **baixar e usar é livre** (ela e a pequena equipe dela, inclusive para fazer sites e apps), **mas não se pode lançar e lucrar com a ferramenta** como produto próprio.
Isso é "source-available", **não** "open source" (a definição oficial de open source não permite restringir uso comercial; não chame o Stylo assim). Opções:
- **PolyForm Shield 1.0.0 (recomendada):** qualquer um pode usar, copiar e modificar para qualquer finalidade, **exceto** fornecer um produto que concorra com o Stylo. Sem prazo, sem conversão. Casa com "baixe e use, mas não venda a ferramenta". Como a pessoa dona é a única titular do código, ela **continua livre para vender a versão paga hospedada**.
- **FSL (Functional Source License):** parecida, mas **vira MIT/Apache automaticamente depois de 2 anos**: passados 2 anos, qualquer um poderia vender aquela versão. Contra o que a pessoa quer.
- **PolyForm Small Business:** grátis só para empresas pequenas (limite de tamanho e faturamento); empresa grande paga. Só se a "pequena equipe" for um limite de verdade (D15).
- **AGPL:** copyleft; quem oferecer um serviço com o Stylo tem de abrir o código dele. Não impede vender, só exige abrir. **Fechar o código:** simples, mas contraria "baixar e usar".
Se aceitar contribuições de terceiros: **CLA** (D16). **Precisa de revisão jurídica** antes de valer. O `NOTICE` já lista as licenças das dependências (todas MIT/ISC/Apache, compatíveis).
**Já aconteceu (2026-10-11):** a pessoa dona mandou enviar a branch `limpeza` ao GitHub **público, em MIT**. Esse código passou a poder ser copiado e reutilizado por qualquer um, inclusive para vender, e **isso não se desfaz** para quem já copiou. Uma licença nova (FSL/Shield) só vale para versões futuras. Se a intenção de "source-available" continua, decidir D1 **antes** de enviar mais código importante.
**Posição da pessoa dona (2026-10-11):** o repositório é dela e a licença será decidida **depois**; se o resultado não ficar bom, ela **apaga o repositório e cria outro** (apagar não desfaz cópias já feitas por terceiros, mas permite recomeçar com a licença certa). Por isso: quem programa **não decide nada de licença** e **não conta com o remoto existir para sempre** — se um `push` ou `fetch` falhar porque o repositório sumiu ou mudou de endereço, **pare e avise a pessoa dona**; o histórico local continua valendo.

**D2 — Git (parcialmente resolvida em 2026-10-11).** A pessoa dona mandou enviar a branch `limpeza` ao GitHub, sem tocar na `main`. Antes do envio, o histórico foi varrido: só a
`designer.secret` (chave de criptografia **local de desenvolvimento**, commitada por engano no começo e removida depois) era sensível; nenhuma chave de API. Como o repositório é público, a chave
ficou visível no histórico; o banco local guardava **0 chaves criptografadas** com ela e **a chave foi trocada** (a antiga virou inútil). Nunca reutilize uma chave que tenha estado no git.
**Ainda aberto:** (a) reescrever o histórico para apagar o arquivo de vez (opcional; mudaria os códigos dos commits); (b) o que fazer com a `main` antiga — recomendo arquivar como branch `legado` e
fazer o merge da `limpeza` na `main` só quando a licença (D1) estiver decidida; (c) se o repositório segue público até lá.

**D7 — Cobrança (versão PAGA, depois; fora do escopo da base).** Já existem como base: cota de biblioteca por conta (`STYLO_LIBRARY_QUOTA_MB`), log de operações por agente, limites de tamanho por
tipo de arquivo. Faltam planos, limite de requisições, medição de uso e integração de pagamento. Decidir **o que é a unidade cobrada** antes de implementar.

### Ações que só a pessoa dona pode fazer (não são decisões)
- Cadastrar chaves reais do **Pexels**, **Pixabay** e **Poly Pizza** (`PUT /api/providers/<id>/key` ou variáveis de ambiente) para a verificação real.
- Contratar a revisão jurídica da licença da versão base (D1, D12). (Domínio e hospedagem, D5, só entram na versão paga, depois.)
- Apontar um agente real (Claude Code/Codex) para o servidor e dizer onde ele travou.

---

## 4. Próximos passos técnicos — o programador pode fazer SEM esperar decisão

### Meta: estável (versão base)

**"Estável e funciona" significa, na prática (sugestão minha; a pessoa dona confirma):**
1. **Instalar e rodar em poucos comandos**, no Windows, macOS e Linux, com mensagens claras quando faltar algo (Node, Chromium).
2. **Versões numeradas** (`v0.x`, `v1.0`) com um registro de mudanças (changelog) por versão, para a pessoa saber o que mudou ao atualizar.
3. **Atualizar sem perder projetos:** migrações do banco testadas de uma versão para a próxima; **backup e restauração** simples (exportar tudo / importar).
4. **Nunca perder trabalho:** gravação atômica, versões do projeto (já existem), recuperação após queda, erro sempre com explicação do conserto.
5. **Seguro por padrão:** acesso pela rede só com login e só se o administrador ligar; nada na internet pública.
6. **Testado de verdade:** suíte verde em CI nas plataformas suportadas (Node 22 e 24); roteiro de uso real (agente + pessoa) antes de cada versão.
7. **Documentação de USO** (para quem baixa), separada da documentação de quem programa.
Fora da versão base (não gaste tempo): cobrança, planos, multi-inquilino em nuvem, S3/R2, domínio e HTTPS públicos.

A pessoa dona pediu para pensar as capacidades por grupo e melhorar as ferramentas, mantendo o editor congelado.
O mapa atual e a ordem recomendada estão em `FERRAMENTAS.md`: edição local de fotos, ajustes em lote e busca por propriedades concluídos;
inspeção textual por largura também concluída; próximo grupo sugerido, manutenção dos estilos/componentes. A lista abaixo mantém as outras pendências técnicas da passagem:

1. **Dividir os arquivos grandes**, **sem mudar comportamento**, sob a suíte atual. **Executor concluído:** `tools/runner.ts` coordena módulos TypeScript em `tools/runner/`; `runner.js` é só uma fachada de compatibilidade. **Restam:** `css.js` ~1150 linhas e `commands.js` ~1250. É a regra mais repetida da pessoa dona ("não um arquivo com mil coisas"). Converta para `.ts` os que mexer.
2. **Mídia grande fora do documento:** guardar só a referência no `doc` e os bytes nos blobs, e então remover o limite de 25 MB por mídia (`assertFitsProject` em `plugins/assets/index.ts`). Pontos: a exportação (`site-export.ts`) é pura — injetar `readMedia(hash)`; o servidor lê dos blobs.
3. **Paleta a partir de imagem** sem dependência nova: reutilizar o codec de imagens isolado (`services/image-codec.ts`, `renderer.withImagePage`) e agrupar as cores em `plugins/identidade`. **Edição local `edit_image` no servidor concluída**, sem depender do editor; paleta ainda não foi implementada.
4. **Manutenção de estilos, modos e variáveis concluída no MCP**: list/update/delete por ID; limitações de modos/CSS manual acima.
5. **`check_design` mais completo** (`core/audit.ts`): cores fora dos estilos, ordem de foco, área de toque de 44 px no celular, medida de tamanhos por breakpoint também em `get_layer`.
6. **Verificação real dos provedores** quando houver chaves; conferir a API oficial do **Poly Pizza** (`plugins/assets/providers/polypizza.ts`, hoje `unverified`).
7. **Arquivo de licenças dentro do zip exportado** (players de 3D/Lottie e fontes) — pendência do `NOTICE`.
8. **Testes de rota HTTP** de `site.zip`/`react.zip`; teste de React com um projeto que use estados (hover) e animações.
9. **[ADIADO — versão paga]** ~~Preparar o terreno da hospedagem~~: S3/R2 para os blobs e limite de requisições por token só interessam à versão hospedada. **Fica na base:** filtro de eventos ao vivo (SSE) por pessoa, porque contas na rede local precisam disso (veja `ACESSO-WEB.md`).
10. **Limpar o repositório:** `scripts/auditar-colaboracao.mjs` e `scripts/gerar-miniatura-vitrine.mjs` são do editor antigo (provavelmente quebrados); `tests/e2e/*` está desatualizado; `apps/web` sai quando o editor novo chegar.

O que **depende de decisão** e por isso não está nesta lista: React Native e TypeScript no React (D9), escopo do editor v1 (D10), JS de protótipo (D11), login/contas da instalação (D6). **Versão paga (D5, D7, D12-serviço, D16): adiada.**

---

## 5. Registro do que está sendo PULADO de propósito

Lista viva: tudo que foi visto e deixado de lado. Quem pular algo novo, acrescente aqui; quem resolver, marque como feito (não apague).

| O que | Por que foi pulado | O que destrava |
|---|---|---|
| Paleta a partir de imagem; `edit_image`/`generate_image_edit` no servidor | **`edit_image` local resolvido** com codec Chromium e matemática de `imagefx`; paleta permanece pendente; geração depende de D13 | passo 3 para paleta; decisão da pessoa dona para geração |
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
| Medidas reais por largura em texto | **resolvido no MCP:** `inspect_layout` mede sem alterar dados base; `get_layer` continua lendo geometria desktop/base. Editor fora deste bloco | ampliar auditoria quando necessário |
| Rota HTTP `react.zip`/`site.zip` sem teste automatizado dedicado | mesmo caminho nas duas; download real das duas rotas conferido em 2026-10-11 após dividir o executor | passo 8 |
| Teste específico de `STYLO_CHROMIUM_PATH` procura o executável padrão do Playwright | **resolvido:** usa primeiro o caminho indicado em `STYLO_CHROMIUM_PATH`; continua pulando só quando nenhum navegador configurado está disponível | teste com o Chromium instalado, sem baixar outro |
| Efeitos em fotos acima de 4 milhões de pixels; animação GIF; metadados EXIF | limite de memória dos arrays de pixels; a edição trabalha num quadro rasterizado, não preserva animação/metadados | reduzir em uma chamada antes dos efeitos; avaliar tratamento dedicado se necessário |
| Filtros de pixels ainda rodam de forma síncrona no Node | reuso da matemática pura existente; fila e limite de pixels reduzem carga, mas o timeout do Chromium não interrompe CPU síncrona | avaliar worker de processamento caso apareça lentidão em fotos maiores |
| Lote de breakpoints/estados e simulação de geometria intermediária no lote | `update_layers` cobre as propriedades base; comandos de layout usam a geometria atual, sem medidas entre os itens | demanda real; `set_responsive`/`set_state` continuam individuais |
| Acesso pela rede local com login (versão base): HTTPS opcional, limites, SSE por pessoa | produto ainda local-only | `ACESSO-WEB.md` / D6 |
| **Versão paga hospedada** (cobrança, planos, cotas por plano, S3/R2, internet pública, domínio) | é outro produto, para depois (decisão de 2026-10-12) | D5, D7, D12-serviço, D16 |
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
- O Chromium é opcional para o resto, mas sem ele `get_image`, `edit_image`, o vazamento do `check_design` e a medida de layout ficam de fora (as ferramentas avisam).

## 8. Histórico resumido (detalhes e porquês em `decisoes.md`)

Faxina do repositório e remoção do agente embutido → MCP headless (workspace) → monorepo + Vite → Postgres/Prisma/PGlite → contas, agentes e conta mestre →
projetos com revisão e versões → Hono + SDK oficial do MCP → ferramentas em Zod → colaboração (notas, atividade, compartilhar) → `get_image` →
imagens fora do JSON → contrato de plugins + identidade visual → assets (biblioteca, provedores, fontes, créditos, mídia) → tokens, estilos de texto/sombra/gradiente,
modos, variáveis → exportador React → **dogfooding** (agente construindo uma página): medida real de layout, `get_image` por breakpoint, `check_design`, argumentos estritos.

## Plano aprovado em execução

A pessoa dona pediu planejamento e execução dos próximos grupos de ferramentas, com documentação a cada passo. Estado detalhado e critérios em [PLANO-MCP.md](PLANO-MCP.md). Primeiro bloco: manutenção de estilos, variáveis e modos com referências seguras; depois organização, auditoria textual e entrega. Sem alterações no editor ou decisões de negócio.
