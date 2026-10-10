# Retomada — leia primeiro depois de uma compactação de contexto

**Regra de checkpoint (pedido da pessoa em 10/10/2026):** atualizar ESTE arquivo e o `LEDGER.md` (a) ao fim de cada etapa, (b) antes de qualquer tarefa longa (bateria E2E completa, revisão do Codex, subagente) e (c) sempre que o contexto da conversa estiver ficando grande. A compactação é automática e pode vir sem aviso: o que não estiver nestes arquivos e em commits se perde. Fique de olho no saldo de tokens da sessão. Nunca deixe trabalho importante só na conversa.

## Onde estamos (atualizado em 10/10/2026, madrugada)
Branch `feat/versao-estavel` (base `feat/auditoria-organizada`). Só commits locais; **nenhum push**. Testes: 347 unitários e 43 suítes de navegador verdes no último commit de código (`4791471`).

**Feito e commitado:** S6 runner E2E isolado; S1 classes CSS; S2 breakpoints no `init`; S3 origem exata + limites de corpo; S4 persistência (servidor e navegador); S5 validação de projeto de terceiros; S5b núcleo; S13 (download de imagem #2, nomes reservados, pastas de sistema, limites de sessões, #14 F11, #10 `@media` no canvas); S12 aviso de largura fixa na exportação. Detalhes, commits e provas no `LEDGER.md`.

**Feito e commitado nesta fase:** S7 (tokens) e S8 parte 1 (raios e fontes por script determinístico), com capturas antes/depois em `docs/screenshots/identidade/`.

**Próximos passos (em ordem):** (1) S8 parte 2: remover `.empty-art` brilhante e sombras tingidas de acento, trocar hex soltos por variáveis, tirar `uppercase` do campo hex e dos títulos de menu (#4); (2) S9 acessibilidade (foco em `input/select/textarea`, `aria-label` nos botões de ícone, `prefers-reduced-motion` global, contraste do `--muted` no tema claro); (3) S10 três opções de marca/acento com contraste medido para a pessoa escolher; (4) S10b aplicar a marca e revisar o tema claro (#15); (5) S11 novo projeto-exemplo; (6) Fase 5 de lançamento (CI, SECURITY.md, NOTICE, versionar o formato do projeto, README/CHANGELOG, limpeza de docs).
- Instável conhecida: `tests/e2e/prototipo.mjs` (foco do modo Apresentar) falha de vez em quando na bateria longa e passa isolada.
- Processo meu ainda rodando: servidor de teste na porta 5190 (matar ao terminar as capturas).

## Pendências que dependem da pessoa
Tudo em `PENDENTE-HUMANO.md`. As que mais pesam: escolher acento/logo (S10); revisar os diffs de S3/S4/S5 (segurança e persistência); testar o MCP com Claude Code/Codex; abrir o site exportado num celular; decidir sobre `url()` externo no CSS livre e no CSS da página (hoje o CSS livre por camada só aceita `data:image` e `#id`; o CSS da página usa o filtro antigo `unsafeCss`).

## Como trabalhar (resumo; o completo está no `CLAUDE.md`)
- Teste que falha antes, correção mínima, `npm test`, E2E relacionado, commit pequeno em português com `Co-Authored-By`.
- **Cuidado com o shell:** heredocs e `sed` com barras invertidas são corrompidos pela ferramenta Bash. Para texto com `\`, escreva o arquivo com a ferramenta Write/Edit e rode o script depois.
- Codex (plugin `codex@openai-codex`, ajustado para `--write` sem sandbox) para tarefas mecânicas e revisão; sempre numa worktree descartável. Pedidos "de ataque" (valores hostis exatos) disparam a política cibernética da OpenAI: peça revisão de diff, sem pedir exploit.
- Jev: perguntas pequenas em inglês, em lote; classificador de skills em `…/jev/1.5.0/scripts/classify-skills.mjs`.
- Sem push, sem merge, sem apagar dados da pessoa.
