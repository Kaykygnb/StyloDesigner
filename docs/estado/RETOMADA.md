# Retomada — leia primeiro depois de uma compactação de contexto

**Regra de checkpoint (pedido da pessoa em 10/10/2026):** atualizar ESTE arquivo e o `LEDGER.md` (a) ao fim de cada etapa, (b) antes de qualquer tarefa longa (bateria E2E completa, revisão do Codex, subagente) e (c) sempre que o contexto da conversa estiver ficando grande. A compactação é automática e pode vir sem aviso: o que não estiver nestes arquivos e em commits se perde. Fique de olho no saldo de tokens da sessão. Nunca deixe trabalho importante só na conversa.

## Onde estamos (atualizado em 10/10/2026, madrugada)
Branch `feat/versao-estavel` (base `feat/auditoria-organizada`). Só commits locais; **nenhum push**. Testes: 347 unitários e 43 suítes de navegador verdes no último commit de código (`4791471`).

**Feito e commitado:** S6 runner E2E isolado; S1 classes CSS; S2 breakpoints no `init`; S3 origem exata + limites de corpo; S4 persistência (servidor e navegador); S5 validação de projeto de terceiros; S5b núcleo; S13 (download de imagem #2, nomes reservados, pastas de sistema, limites de sessões, #14 F11, #10 `@media` no canvas); S12 aviso de largura fixa na exportação. Detalhes, commits e provas no `LEDGER.md`.

**EM ANDAMENTO (não commitado):** S7+S8 da identidade visual.
- `scratchpad/tokens.mjs` (já rodou) trocou 284 raios e 197 tamanhos de fonte em `src/styles/app.css` por tokens novos no `:root`: `--r-sm 2px`, `--r-md 4px`, `--r-lg 6px`, `--r-full`, `--fs-xs 11px`, `--fs-sm 12px`, `--fs-md 13px`, `--fs-lg 15px`. O script está no diretório temporário da sessão; se sumir, o diff do `app.css` é a fonte da verdade.
- Já tiradas as capturas "antes" (10 PNG em `docs/screenshots/identidade/antes-*`, por `scripts/capturas-identidade.mjs antes`, servidor isolado na porta 5190).
- **Próximos passos:** (1) `npm test` + `npm run test:e2e` com o CSS novo; (2) `scripts/capturas-identidade.mjs depois` e olhar as capturas (texto ≤ 11 px pode ter estourado); (3) remover `.empty-art` brilhante e sombras com acento, tirar `uppercase` de campo hex (`.hex`) e de títulos de menu (#4); (4) commit; (5) S9 acessibilidade (foco em `input/select/textarea`, `aria-label` nos botões de ícone, `prefers-reduced-motion` global, contraste do `--muted` claro); (6) S10 três opções de marca/acento com contraste medido — **a pessoa escolhe**; (7) S10b aplicar a marca; (8) S11 novo projeto-exemplo.
- Processos meus ainda rodando: servidor de teste na porta 5190 (matar ao terminar).

## Pendências que dependem da pessoa
Tudo em `PENDENTE-HUMANO.md`. As que mais pesam: escolher acento/logo (S10); revisar os diffs de S3/S4/S5 (segurança e persistência); testar o MCP com Claude Code/Codex; abrir o site exportado num celular; decidir sobre `url()` externo no CSS livre e no CSS da página (hoje o CSS livre por camada só aceita `data:image` e `#id`; o CSS da página usa o filtro antigo `unsafeCss`).

## Como trabalhar (resumo; o completo está no `CLAUDE.md`)
- Teste que falha antes, correção mínima, `npm test`, E2E relacionado, commit pequeno em português com `Co-Authored-By`.
- **Cuidado com o shell:** heredocs e `sed` com barras invertidas são corrompidos pela ferramenta Bash. Para texto com `\`, escreva o arquivo com a ferramenta Write/Edit e rode o script depois.
- Codex (plugin `codex@openai-codex`, ajustado para `--write` sem sandbox) para tarefas mecânicas e revisão; sempre numa worktree descartável. Pedidos "de ataque" (valores hostis exatos) disparam a política cibernética da OpenAI: peça revisão de diff, sem pedir exploit.
- Jev: perguntas pequenas em inglês, em lote; classificador de skills em `…/jev/1.5.0/scripts/classify-skills.mjs`.
- Sem push, sem merge, sem apagar dados da pessoa.
