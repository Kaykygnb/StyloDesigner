# Plano em etapas — versão estável e profissional

Decisões do Jev (perguntas pequenas, em inglês, em lote; `jev-1.13.0`): **estabilidade antes do visual** (1,00); **tokens primeiro, depois substituição mecânica, nunca reescrever o CSS** (1,00); **a marca é escolhida por humano** (1,00). Onde o Jev ficou incerto (`review`), a decisão abaixo é minha e está marcada.

## Regras de execução
- Cada etapa: teste que **falha antes** → correção mínima → `npm test` + E2E relacionado → revisão do diff (`revisar-diff` + `jev_assess_code_risk`) → um commit por tema.
- Servidor E2E isolado (`DESIGNER_CONFIG` temporário). Nunca tocar nos projetos do usuário.
- Skills: engenharia = `testes-primeiro`, `diagnosticar-bugs`, `revisar-diff`, `desenhar-modulos`; design = `design:design-impecavel` (anti-"AI slop"), `prototipar` para variantes. O orquestrador usa `planejar-subagentes` antes de cada delegação.
- Máximo 4 subagentes em paralelo; etapas que editam o mesmo arquivo nunca em paralelo.

## Fase 0 — Base de teste (você e eu)
| Etapa | O que | Quem | Skills |
|---|---|---|---|
| S6 | Runner E2E sobe servidor isolado; `desempenho` por mediana; `fotos` com timeout e modo offline; investigar `agente-mcp` instável na bateria completa | eu (Jev: self 0,53, incerto) | `diagnosticar-bugs` (0,85), `testes-primeiro` |
Aceite: `npm run test:e2e` sozinho, 3 execuções seguidas 41/41.

## Fase 1 — Correção (risco: lógica; ordem fixa)
| Etapa | O que | Executor | Skills (Jev) | Teste/Aceite | Humano |
|---|---|---|---|---|---|
| S1 | Slug CSS válido (letra inicial) + namer único sem colisão | sonnet, teste primeiro (falha antes 0,94) | `testes-primeiro` 0,94, `diagnosticar-bugs` | unit: `2024 Hero`, duas camadas `botao` | não |
| S2 | `store.init` reutiliza `loadDoc` (breakpoints, comentários, projectId) | sonnet, em paralelo com S1 (arquivos distintos: model/css × store; **decisão minha**, Jev incerto) | idem | unit: reabrir projeto mantém breakpoints; exportação `@media` | não |
| S3 | Servidor: Origin exata + token de sessão em escritas/MCP/`/api/agent/*`; limite de corpo por rota | sonnet (Jev 0,65), eu reviso o diff | `testes-primeiro`, `revisar-diff` 0,93 | unit+E2E: página em outra porta recebe 403; corpo > limite recebe 413; MCP stdio continua | **sim**: revisar diff (Jev 0,81) e testar com seu Claude Code/Codex |
| S4 | Persistência: config atômica com fila; IDB×localStorage pega o mais novo; `save()` informa sucesso e `open()` aborta se falhar; `.tmp` órfão | sonnet; **depois de S3** (mesmo `server.js`) | `diagnosticar-bugs`, `revisar-diff` | testes que simulam falha de IDB e de escrita | **sim** (Jev 0,75) |
| S5 | Validar/normalizar o `.json` carregado (listas fechadas, números finitos) e escapar CSS/SVG | **eu** (risco alto, Jev 0,61) | `testes-primeiro`, `desenhar-modulos` | fuzz com `</style><script>` e valores inválidos; vitrine intacta | opcional (Jev incerto) |
| S5b | Menores: nomes reservados do Windows, listagem resiliente, erro 500 sem detalhe, CSS aninhado, `@media` com breakpoints do doc | haiku/sonnet em lote | `testes-primeiro` | unit por item | não |
Itens que o Jev mandou confirmar: `slug_digit` (0,73), `validate_doc` (0,58), `config_atomic` (0,47 `review`) e `responsive_export` (0,67): tratados como correção com revisão, não como decisão de produto.

## Fase 2 — Exportação responsiva (risco alto, Jev 0,54)
| S12 | Remover raiz fixa de 1440 px; validar 390/768/1440 sem overflow no Chromium | eu | `diagnosticar-bugs` 0,85, `built-in-browser`, `design-impecavel` | medir overflow horizontal e capturas nas 3 larguras | **sim**: abrir o site exportado num celular de verdade |

## Fase 3 — Identidade visual do editor (risco médio; ordem fixa)
| Etapa | O que | Executor | Skills | Aceite | Humano |
|---|---|---|---|---|---|
| S7 | Tokens em `:root` sem mudar nenhuma regra (raios 2/4/6, escala tipográfica 11/12/13/15, sombras neutras, espaçamento 4) | eu | `design-impecavel` 0,96 | diff só adiciona variáveis; E2E verde | não |
| S10 | Marca: 3 opções de acento e logo renderizadas, contraste AA medido nos dois temas | eu + `prototipar` (variantes) | `design-impecavel` 0,94, `prototipar` 0,75 | capturas lado a lado | **sim, você escolhe** (Jev 0,83) |
| S8 | Substituição mecânica por tipo (raios → fontes → sombras → hex), E2E após cada tipo; remover `.empty-art`, sombras com acento, `uppercase` em hex | haiku (Jev 1,00) com revisão minha | `design-impecavel`, `revisar-diff` | capturas antes/depois claro/escuro; E2E verde | você olha as capturas |
| S9 | Acessibilidade: foco em campos, `aria-label`, `prefers-reduced-motion` global, contraste do `--muted` claro, alvos mínimos; **depois de S8** (mesmo `app.css`) | sonnet | `design-impecavel` | testes de foco por teclado + contraste calculado | opcional |
| S10b | Aplicar a marca escolhida: acento, logo em `assets/`, estados vazios em traço de linha, copy da UI | eu | `design-impecavel` | tema claro revisado (#15) | **sim** (taste) |

## Fase 4 — Projeto-exemplo (depende da Fase 3)
| S11 | Nova vitrine com marca, paleta, tipografia e ritmo próprios; sem hero roxo/esfera/3 cards iguais | eu desenho; sonnet monta a árvore | `design-impecavel` 0,98, `prototipar` | `vitrine.mjs`, exportação 390 px, captura | **sim** (Jev 0,66 incerto: direção editorial é gosto) |

## Fase 5 — Fechamento
`npm test`, E2E 3× seguidas, `docs/BASELINE-AUDITORIA.md` atualizado, CHANGELOG, PR descrito com `descrever-pr`. Roteiro humano em `docs/ROTEIRO-ACEITE-HUMANO.md` com os itens marcados "sim".

## Fora desta versão
Edição em tempo real (#13), i18n (#12), IA de foto real (#5–#8), plugins, nuvem.
