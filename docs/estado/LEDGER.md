# Ledger de execução

Status: `FEITO` · `EM ANDAMENTO` · `PENDENTE` · `BLOQUEADO (humano)`. Atualize ao fim de cada etapa: o que foi feito, como, como foi testado, evidência, quem executou.

## Linha de base (10/10/2026)
- `npm test`: 290/290. E2E em servidor isolado: 39/41. `fotos.mjs` travou na rede e foi encerrado à mão; `agente-mcp.mjs` falhou na bateria completa e passa isolado (instável).
- Não testado: Firefox/WebKit, celular real, MCP com clientes reais, APIs reais de imagem.

## Etapas
| Id | Etapa | Status | O que foi feito / como | Teste e evidência | Executor |
|---|---|---|---|---|---|
| P0 | Entender o código, relatório e planos | FEITO | 3 revisões só-leitura + verificação própria; `docs/planos/RELATORIO-ENGENHARIA.md`, `PLANO-ETAPAS.md` | achados confirmados por execução: slug com dígito, breakpoints no `init`, Origin, corpo 200 MB | eu + 3 sonnet (leitura) |
| P3 | Plano mestre e prompts para outras IAs | FEITO | `docs/planos/PLANO-MESTRE.md`, `docs/estado/PROMPTS-OUTRAS-IAS.md`; backlog classificado com Jev (só confiança alta usada direto) | revisão de leitura | eu + Jev |
| P2 | Pesquisa de produto (CSS, export, agentes, armazenamento, licença) | FEITO | 3 pesquisadores só-leitura; resultado em `docs/estado/PRODUTO.md` | achados por leitura de código; nada executado ao vivo | 3 sonnet |
| P1 | Limpeza de arquivos inúteis | EM ANDAMENTO | Removidos `docs/screenshots/polimento-v0.13` e `BASELINE-AUDITORIA.md`; falta fundir `GUIA-DO-CODIGO.md` em `ARQUITETURA.md` e decidir ROADMAP/benchmarks/capturas | `npm test` após cada remoção | eu |
| S6 | Runner E2E isolado + suítes instáveis | EM ANDAMENTO | `tests/e2e/rodar-todos.mjs` sobe servidor em porta livre com config e pasta de projetos temporárias, limite de tempo por suíte (`E2E_TIMEOUT_MS`), filtro por nome (`npm run test:e2e -- fotos`); `desempenho.mjs` usa a mediana de 5 rodadas (limite 16 ms mantido). Commit `da6b24d` | `desempenho` 6,3 ms (rodadas 9,2/8,2/6,3/6,1/6,2); `agente-mcp` e `fotos` passam isoladas e em pares (desempenho+fotos, agente-mcp+fotos, foto-ia+fotos). O travamento de `fotos` NÃO foi reproduzido; hipótese: subagentes editavam `css.js`/`store.js` durante a 2ª execução. Bateria completa pelo runner novo: execução 1 = 41/41 (inclui `fotos`, `agente-mcp`, `desempenho`). Execuções 2 e 3 em andamento | eu |
| S1 | Slug CSS válido e namer sem colisão | FEITO | `makeClassNamer` em `src/css.js`: slug com dígito ganha `l-`; unicidade por Set com sufixo livre; `slugify` intocado (gera arquivos e atributos). Commit `7c9136a` | 5 testes novos em `tests/classnames.test.js`, 3 falhavam antes; `npm test` 296/296 | sonnet; diff conferido por mim |
| S2 | `store.init` reutiliza `loadDoc` | FEITO | `normalizeDoc` (projectId, styles, comments, breakpoints) usada por `loadDoc` e `init` em `src/store.js`. Commit `7c9136a`. Jev `assess_code_risk`: baixo (0,68), sem flag de segurança/dados | teste novo em `tests/store.test.js` falhava antes (`[1024,640]` em vez de `[900,500]`) | sonnet; diff conferido por mim |
| S3 | Servidor: Origin exata + token + limites de corpo | PENDENTE | | | |
| S4 | Persistência atômica e cópia mais nova vence | PENDENTE | | | |
| S5 | Validar e normalizar `.json` carregado | PENDENTE | | | |
| S5b | Itens menores (nomes reservados, listagem, erro 500, CSS aninhado) | PENDENTE | | | |
| S12 | Exportação responsiva sem raiz fixa 1440 px | PENDENTE | | | |
| S7 | Tokens em `:root` | PENDENTE | | | |
| S10 | Marca: 3 opções | BLOQUEADO (humano) | | | |
| S8 | Substituição mecânica de literais | PENDENTE | | | |
| S9 | Acessibilidade | PENDENTE | | | |
| S10b | Aplicar marca | PENDENTE | | | |
| S11 | Novo projeto-exemplo | PENDENTE | | | |
| F | Fechamento: README, CHANGELOG, E2E 3×, aceite humano | PENDENTE | | | |
