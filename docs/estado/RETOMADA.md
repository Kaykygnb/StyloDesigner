# Retomada — leia primeiro depois de uma compactação de contexto

**Regra de checkpoint (pedido da pessoa em 10/10/2026):** atualizar ESTE arquivo e o `LEDGER.md` (a) ao fim de cada etapa, (b) antes de qualquer tarefa longa (bateria E2E completa, revisão do Codex, subagente) e (c) sempre que o contexto da conversa estiver ficando grande. A compactação é automática e pode vir sem aviso: o que não estiver nestes arquivos e em commits se perde. Fique de olho no saldo de tokens da sessão. Nunca deixe trabalho importante só na conversa.

## Onde estamos (atualizado em 10/10/2026, madrugada)
Branch `feat/versao-estavel` (base `feat/auditoria-organizada`). Só commits locais; **nenhum push**. Testes: 347 unitários e 43 suítes de navegador verdes no último commit de código (`4791471`).

**Feito e commitado:** S6 runner E2E isolado; S1 classes CSS; S2 breakpoints no `init`; S3 origem exata + limites de corpo; S4 persistência (servidor e navegador); S5 validação de projeto de terceiros; S5b núcleo; S13 (download de imagem #2, nomes reservados, pastas de sistema, limites de sessões, #14 F11, #10 `@media` no canvas); S12 aviso de largura fixa na exportação. Detalhes, commits e provas no `LEDGER.md`.

**Feito e commitado nesta fase (identidade):** S7 tokens, S8 raios e fontes, S8b limpeza visual, S9 acessibilidade, S10 três direções de marca (aguarda a escolha da pessoa). Capturas em `docs/screenshots/identidade/`.

**Feito também:** Fase 5 parcial: S19 CI, S20 SECURITY.md/NOTICE/template de PR/campos do package.json, S21 versão do formato + aviso de hosts externos no CSS da página (commit desta etapa).

**Estado em 10/10/2026, de madrugada:** 358 testes unitários e 43 suítes de navegador verdes; commits até `fc91706`. Fase 5 quase fechada: CI, SECURITY, NOTICE, versão do formato, limpeza de docs, CHANGELOG da versão estável, roteiro de aceite e projeto hostil de exemplo.

**S24 concluída:** 3 execuções completas seguidas da bateria de navegador, 44/44 suítes em cada uma; 358 unitários.

**Próximos passos que NÃO dependem da pessoa:** (1) Firefox/WebKit smoke exige baixar os navegadores do Playwright (~200 MB): está em `PENDENTE-HUMANO.md` para você autorizar; (2) #11 `<img>` real para fotos (v1.1: a parte de acessibilidade, `role="img"` + `aria-label`, já existe); (3) itens do backlog v1.1 do `PLANO-MESTRE.md`; (4) revisar com o Codex (Astra, só leitura) o diff de persistência e de validação depois que você revisar; (5) conferir `git log` e o `LEDGER.md` para ver se algo ficou sem registro. **Dependem da pessoa:** S10b (escolher a marca em `docs/estado/MARCA.md`), S11 (novo projeto-exemplo, depende da marca), testes humanos do roteiro (seção 0), decisão sobre `url()` externo no CSS da página, versão (`package.json` está em 1.0.0; sugestão 1.1.0).

## Pendências que dependem da pessoa
Tudo em `PENDENTE-HUMANO.md`. As que mais pesam: escolher acento/logo (S10); revisar os diffs de S3/S4/S5 (segurança e persistência); testar o MCP com Claude Code/Codex; abrir o site exportado num celular; decidir sobre `url()` externo no CSS livre e no CSS da página (hoje o CSS livre por camada só aceita `data:image` e `#id`; o CSS da página usa o filtro antigo `unsafeCss`).

## Como trabalhar (resumo; o completo está no `CLAUDE.md`)
- Teste que falha antes, correção mínima, `npm test`, E2E relacionado, commit pequeno em português com `Co-Authored-By`.
- **Cuidado com o shell:** heredocs e `sed` com barras invertidas são corrompidos pela ferramenta Bash. Para texto com `\`, escreva o arquivo com a ferramenta Write/Edit e rode o script depois.
- Codex (plugin `codex@openai-codex`, ajustado para `--write` sem sandbox) para tarefas mecânicas e revisão; sempre numa worktree descartável. Pedidos "de ataque" (valores hostis exatos) disparam a política cibernética da OpenAI: peça revisão de diff, sem pedir exploit.
- Jev: perguntas pequenas em inglês, em lote; classificador de skills em `…/jev/1.5.0/scripts/classify-skills.mjs`.
- Sem push, sem merge, sem apagar dados da pessoa.
