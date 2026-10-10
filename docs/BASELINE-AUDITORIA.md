# Baseline antes da organização da auditoria

Executado em 10 de outubro de 2026 na branch de trabalho anterior, baseada no commit `b1754a0`, antes de organizar as mudanças na branch `feat/auditoria-organizada`. O baseline representa o estado de trabalho daquela branch, inclusive alterações locais ainda não organizadas em commits.

| Comando | Resultado |
|---|---:|
| `npm test` | 289/289 testes passaram |
| `npm run test:e2e` | 41/41 suítes passaram |

Suítes E2E que passaram:

`agente-mcp.mjs`, `agente-streaming.mjs`, `arrastar-e-paineis.mjs`, `auto-layout-intencao.mjs`, `basico.mjs`, `camadas-paineis-salvar.mjs`, `caneta-completa.mjs`, `caneta-icones.mjs`, `codigo-editavel.mjs`, `comentarios.mjs`, `configuracoes-abas.mjs`, `conta-local.mjs`, `css-polimento.mjs`, `css-util.mjs`, `desempenho.mjs`, `design-polimento.mjs`, `editor-compacto.mjs`, `editor-grande.mjs`, `exportacao-animacao-css-3d.mjs`, `exportacao-fiel.mjs`, `exportar-site.mjs`, `extras.mjs`, `foto-ia.mjs`, `fotos.mjs`, `layout-limpo.mjs`, `layout-polido.mjs`, `modos-variaveis.mjs`, `notas-paletas-painel.mjs`, `pagina-inicial.mjs`, `persistencia-multitab.mjs`, `propriedades-layout-texto.mjs`, `prototipo.mjs`, `recursos-imagens.mjs`, `responsivo.mjs`, `salvar-pasta.mjs`, `secao.mjs`, `selecao-teclado-medidas.mjs`, `seletor-de-cor.mjs`, `svg-icones-fontes.mjs`, `vetores-componentes-grid.mjs`, `vitrine.mjs`.

## Resultado final da branch organizada

| Comando | Resultado |
|---|---:|
| `npm test` | 290/290 testes passaram |
| `npm run test:e2e` | 41/41 suítes passaram |
| `agente-mcp.mjs` repetido | 5/5 execuções passaram |
| `persistencia-multitab.mjs` repetido | 5/5 execuções passaram |

O conjunto unitário passou de 289 para 290 testes. A comparação de nomes confirmou que os casos de exportação MCP e identidade ao importar JSON foram preservados; o teste de lista de ferramentas foi ampliado para cobrir também `list_editors` e `select_editor`. Não houve regressão de suíte E2E em relação às 41 aprovadas no baseline.

## Validação dos commits individualmente

`npm test` foi executado em cada commit da branch reconstruída. A referência gerada foi atualizada no mesmo commit das mudanças que alteraram sua fonte.

| Commit | Testes aprovados |
|---|---:|
| `d6172b2` fix(segurança): impede escape do sanitizador e do CSS | 256/256 |
| `a195f88` feat(mcp): isola sessões e cancela chamadas pendentes | 269/269 |
| `b413ab1` feat(persistência): protege revisões e recupera cópias locais | 274/274 |
| `721602a` feat(agente): evita aplicar resultados lentos obsoletos | 279/279 |
| `42b807a` feat(apresentação): melhora teclado e movimento reduzido | 279/279 |
| `2e8f36a` feat(exportação): gera sites e centraliza telas exportadas | 288/288 |
| `5e86e6b` feat(assets): organiza as imagens do projeto | 288/288 |
| `e21ced6` chore: adiciona scripts de auditoria e desempenho | 288/288 |
| `b5c3566` fix(auditoria): corrige testes instáveis encontrados | 290/290 |
| `38988b1` docs: registra resultados e próximos passos da auditoria | 290/290 |

Na primeira execução E2E completa da branch reconstruída, `desempenho.mjs` marcou 16,6 ms contra o limite de 16 ms; as outras 40 suítes passaram. A suíte isolada mediu 11,5 ms, e a execução E2E completa repetida passou 41/41 (11,5 ms no cenário de desempenho). O resultado indica variação da medição sob carga, registrada para não ocultar o evento.
