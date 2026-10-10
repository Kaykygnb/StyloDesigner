# Relatório de engenharia — Stylo (branch `feat/versao-estavel`, base `feat/auditoria-organizada`)

Data: 10/10/2026. Método: leitura do código por 3 revisores só-leitura (Claude sonnet), verificação própria por execução/leitura dos achados mais graves, testes automáticos, inspeção visual no navegador. Jev usado para roteamento e escolha de skills.

## 1. O que é e como está organizado
Editor de design local em JavaScript puro (módulos ES, sem build) onde cada camada é um elemento DOM com CSS real. ~27,6 mil linhas em `src/`, servidor Node (`server.js`, `server/*.js`) em 127.0.0.1 que grava projetos em `.json`, expõe API do assistente e um servidor MCP. Arquitetura clara e documentada (`docs/ARQUITETURA.md`); núcleo puro (`model`, `css`, `store`) testável no Node.

## 2. O que eu verifiquei sozinho
| Verificação | Resultado |
|---|---|
| `npm test` (unitários) | 290/290 passam |
| Abrir o app e o projeto-exemplo no navegador | Funciona; enquadra corretamente numa janela 1440×900 |
| Zoom ~2% observado ao redimensionar a janela depois da abertura | Efeito do redimensionamento; não é bug confirmado (baixa prioridade) |
| `slugify('2024 Hero')` → `2024-hero` | **Confirmado**: classe CSS inválida (`.2024-hero`) |
| `store.init` não chama `setBreakpoints` | **Confirmado** na leitura (store.js:455-466; `loadDoc` chama em :345) |
| `localOrigin` aceita qualquer porta em localhost | **Confirmado** (server.js:159) |
| `readBody` aceita até 200 MB em toda rota JSON | **Confirmado** (server.js:146-155) |
| `npm run test:e2e` | Ver seção 7 |
| Contagens de CSS (raios, fontes, sombras, `outline:none`) | Ordem de grandeza confirmada |

Observação sobre o runner E2E: ele **não sobe servidor** e usa a porta 5173 fixa. Sem servidor, 29 de 41 suítes falham por `ECONNREFUSED`. Rodei com servidor isolado (`DESIGNER_CONFIG` temporário) para não tocar nos seus projetos.

## 3. Bugs e riscos (priorizados)
Itens marcados ✔ eu confirmei; os demais vêm dos revisores e precisam de teste que falhe antes de corrigir.

**Perda de dados / correção (prioridade 1)**
1. ✔ Slug de classe começando por dígito gera CSS inválido; colisões de nome (`botao 2` vs duas `botao`) geram classes iguais. (`model.js:755`, `css.js:765-772`)
2. ✔ Reabrir projeto salvo perde breakpoints personalizados até um `loadDoc`/undo; `@media` exportado sai errado. (`store.js:455-466`)
3. IndexedDB falha no meio da sessão → saves vão ao localStorage, mas o próximo load lê o IDB antigo e as edições somem. (`storage.js:243-244`, `120-131`)
4. `save()` nunca rejeita; `open()` carrega outro documento mesmo se o salvamento falhou/conflitou. (`saving.js:261-275`)
5. CSS aninhado (`&:hover{}`) no CSS manual quebra chaves do CSS exportado. (`html.js:395-402`)
6. `@media` usa breakpoints globais, não os do documento, em export de site/MCP. (`css.js:849/932`)

**Segurança (prioridade 1, é app local mas expõe MCP e chaves)**
7. ✔ Origem: qualquer página em `localhost:<qualquer porta>` pode chamar `PUT /api/agent/mcp {admin:true}` (desliga confirmações) e `PUT /api/config`. Solução: token de sessão injetado no `index.html` + Origin exata.
8. ✔ Corpo JSON de 200 MB em qualquer rota; limitar por rota (1 MB, exceto PUT de projeto).
9. Chaves de API em `config` gravadas sem atomicidade; falha deixa JSON truncado e o servidor volta ao padrão em silêncio, perdendo chaves.
10. Download de imagem gerada sem teto de memória e sem lista de hosts (já é a issue #2).
11. IDs de chamada ao editor previsíveis; `/api/agent/reply` não vincula resposta à conexão.
12. Documento `.json` de terceiros não é validado: valores vão crus para CSS/atributos SVG (XSS potencial no HTML exportado).

**Menores:** nomes reservados do Windows (`con.json`), listagem de projetos cai se um arquivo sumir entre `readdir` e `stat`, erro 500 expõe detalhe interno, `.tmp` órfão, `doc.assets` só cresce, funções gigantes (`createCommands` ~1170 linhas, `nodeStyle` 238, `createStore` 438).

## 4. Interface: diagnóstico de "cara de IA" (Plano B)
- ~320 raios de canto em 20 valores diferentes; só 5 usos do token `--radius`. ~330 tamanhos de fonte em 20 valores (meios-pixels e ≤9px). 80 `box-shadow`, 64 fora do token. ~96 linhas com hex fora das variáveis.
- `.empty-art` (ícone com brilho e raio 18px) é o sinal mais evidente; usado em um lugar (`props.js:1675`).
- 13 `uppercase`; dois deles (`.hex`, css:316 e 1567) alteram o texto digitado de cores.
- Tema claro: `--muted` sobre `--panel-3` dá 4,86 (abaixo de 4,5 só por pouco em outros pares); `#fff` fixo e cores semânticas sem versão clara; logo sempre escuro.
- Acessibilidade: foco não cobre `input/select/textarea`; 26 `outline:none`; só 1 `prefers-reduced-motion`; vários botões de ícone de 20–22 px e alguns sem `aria-label`.
- Copy: pouca frase de efeito; revisar estados vazios e o eyebrow "Seu espaço de trabalho".

## 5. O que preciso de você (teste humano e opinião)
Não consigo julgar bem sozinho:
1. **Gosto e identidade**: escolher o acento de cor da marca e o traço do logo (eu apresento 3 opções com captura; você escolhe).
2. **Densidade**: linhas de 24–28 px nos painéis estão boas para o seu uso? (teste real com o seu fluxo).
3. **Fluxos reais** que testes não cobrem: desenhar uma página do zero, auto layout com grid, caneta Bézier, exportar o site e abrir no celular de verdade, Apresentar.
4. **MCP/agente com seus clientes** (Claude Code/Codex): conectar, criar uma tela, cancelar no meio, duas sessões ao mesmo tempo.
5. **Teste com API real** de imagem e Pexels (precisam das suas chaves; eu não as uso).
6. **Tema claro e touch/tablet** em dispositivo real.
7. **Decisão de produto**: tempo real entre pessoas (#13) e i18n (#12) entram nesta versão estável? Recomendo **não**.

## 6. Melhorias que combinam com a proposta da ferramenta
Fiéis ao princípio "o canvas é CSS de verdade, local, sem build":
1. **Validar o documento num único ponto de entrada** (`loadDoc`) — fecha vários bugs de uma vez e protege contra `.json` de terceiros.
2. **Token de sessão local** para escritas, MCP e `/api/agent/*`.
3. **Camada de persistência única no servidor** (fila por arquivo, escrita atômica) e **um namer único** de classes/variáveis CSS.
4. **Exportação responsiva sem raiz fixa de 1440 px** (a maior lacuna do benchmark Linear) e fotos como `<img>` (#11).
5. **Runner E2E que sobe o próprio servidor isolado** e repete suítes sensíveis a tempo (desempenho) por mediana.
6. Unidades `%`, `rem`, `vw`, `calc()` nos campos do painel (já no roadmap).
Não combinam com a proposta agora: nuvem/login, plugins de terceiros, build/bundler.

## 7. Execução do E2E
Servidor isolado (porta 5173, configuração temporária), 10/10/2026: **39/41 suítes passaram**.
- `fotos.mjs`: travou ~7 min (depende de Openverse/rede externa); encerrei o processo à mão. Não é regressão de código: precisa de modo offline/mock ou timeout curto.
- `agente-mcp.mjs`: falhou dentro da bateria completa, mas **passou isolado** (ALL PASS). Indica instabilidade (ordem/tempo/estado compartilhado). A auditoria anterior só repetiu essa suíte isolada, então esse cenário não estava coberto.
- `desempenho.mjs` passou nesta execução.

## 8. Skills escolhidas via Jev (classificador, `--side claude`)
| Frente | Skills (confiança) |
|---|---|
| Servidor e segurança | revisar-diff 0,93 · testes-primeiro 0,81 · diagnosticar-bugs 0,83 |
| Perda de dados e CSS | diagnosticar-bugs 0,90–0,94 · testes-primeiro 0,81 · revisar-diff 0,90 |
| Identidade do editor (B) | design-impecavel 0,98 · prototipar 0,85 · revisar-diff 0,79 |
| Projeto-exemplo (C) | design-impecavel 0,97 · prototipar 0,79 |
`jev_route_task` para as correções: abordagem **investigar primeiro** (0,93), **precisa de testes** (0,96), irreversível: não (0,06), esforço alto.

## 9. Ordem proposta
1. Fase 1 (correções, TDD, commits pequenos): itens 1, 2, 7, 8 acima; depois 3, 4, 9.
2. Runner E2E isolado + medições estáveis.
3. Plano B etapas 1–2 (tokens e substituição mecânica), depois acessibilidade, só então marca.
4. Plano C.
