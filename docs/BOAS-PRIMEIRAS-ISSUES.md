# Boas primeiras issues (rascunho)

Ideias de tarefas pequenas e bem delimitadas para quem está chegando. Cada item descreve o problema, onde olhar e como saber que ficou pronto.

> Este arquivo é um **rascunho**: as issues ainda não foram criadas no GitHub. Quem mantém o projeto cria as que fizerem sentido, com o rótulo `good first issue`. Os caminhos de arquivo foram conferidos no código; o comportamento descrito em "Problema" vem dos relatórios de teste de 14/10/2026 e do README — **confirme reproduzindo** antes de começar.

Nível: 🟢 fácil (sem mexer em lógica) · 🟡 médio (um pouco de código e teste) · 🔴 maior (converse na issue antes).

---

## 1. 🟢 Testar um agente de IA de verdade e documentar

**Problema.** O protocolo MCP foi validado com o cliente oficial do SDK, mas nenhum agente (Claude Code, Codex, Cursor, Claude Desktop…) foi conduzido com um modelo real num pedido tipo "faça uma página de cafeteria".

**O que fazer.** Conecte o seu agente (`claude mcp add --transport http stylo http://localhost:5173/mcp`), peça uma página simples e registre em [docs/mcp/COMPATIBILIDADE.md](mcp/COMPATIBILIDADE.md): versão do cliente, configuração, o que funcionou, o que travou, prints.

**Pronto quando** a tabela de compatibilidade tem uma linha nova com evidência (mesmo que o resultado seja "não funcionou").

## 2. 🟢 Traduzir os manuais de uso para inglês

**Problema.** `README.md` tem um resumo em inglês, mas [docs/INSTALACAO.md](INSTALACAO.md) e [docs/PAINEL.md](PAINEL.md) existem só em português.

**O que fazer.** Criar `docs/en/INSTALLATION.md` e `docs/en/PANEL.md` e linkar no README.

**Pronto quando** os dois arquivos existem, estão corretos e os links funcionam.

## 3. 🟢 Dica na tela de texto: Enter confirma, Esc cancela

**Problema.** Ao criar um texto no canvas, **Esc descarta** o que foi digitado; é preciso **Enter** para confirmar. Quem não sabe perde o texto sem aviso (visto no teste de exportação de 14/10/2026).

**Onde olhar.** `apps/studio/src/editor/BoardFrame.tsx` (a edição de texto trata `Escape` por volta da linha 128) e `apps/studio/src/lib/i18n.ts` (textos da interface, pt-BR e en-US).

**Pronto quando** aparece uma dica discreta durante a edição de texto (nos dois idiomas) ou o Esc passa a confirmar em vez de descartar, e há um teste ou, no mínimo, um print do comportamento.

## 4. 🟡 Negrito, itálico e sublinhado enquanto edita texto

**Problema.** `Ctrl+B`, `Ctrl+I` e `Ctrl+U` não funcionam na edição de texto (consta em [docs/ROADMAP-ALPHA.md](ROADMAP-ALPHA.md)).

**Onde olhar.** `apps/studio/src/editor/BoardFrame.tsx`, `apps/studio/src/editor/shortcuts.ts`. Lembre: o painel só altera o documento por **ferramenta MCP** (`update_layer`); veja se já existe propriedade de peso/estilo da fonte para reaproveitar.

**Pronto quando** os atalhos alteram o texto selecionado, desfazem com `Ctrl+Z` e há teste.

## 5. 🟡 O site exportado do React instala e compila?

**Problema.** O projeto React (.zip) é gerado e há testes do conteúdo, mas ninguém verificou, de forma automatizada, que `npm install && npm run build` funciona nele.

**Onde olhar.** `tests/export-react.test.ts`, `packages/core` (gerador do projeto React).

**O que fazer.** Um teste (ou script em `scripts/`) que exporta um projeto de exemplo, descompacta numa pasta temporária, instala e compila. Se for pesado para a CI, deixe opcional (`STYLO_TEST_REACT_BUILD=1`).

**Pronto quando** o teste existe e passa, ou revela um bug que vira nova issue.

## 6. 🟡 Investigar por que `tests/workspace.test.ts` é lento

**Problema.** Em alguns computadores esse arquivo estoura os 90 s do `npm test`; na CI do GitHub passa. Quem roda a suíte pela primeira vez vê um teste "cancelado".

**O que fazer.** Medir qual caso demora, ver se é espera fixa, banco ou renderer, e reduzir. Se for só a máquina, documentar o tempo esperado em [docs/DESENVOLVIMENTO.md](DESENVOLVIMENTO.md).

**Pronto quando** o teste termina em tempo razoável em máquina comum, ou a causa está documentada.

## 7. 🟡 Botão de "Largura fluida" a partir do aviso da Conferência

**Problema.** Toda tela nova nasce com largura fixa e sai assim no celular. A **Conferência** avisa e sugere ligar "Largura fluida no site exportado", mas o conserto é manual, no painel Design.

**Onde olhar.** `apps/studio/src/editor/Panels.tsx` (painel de problemas, chama `check_design`) e o campo de largura fluida em `apps/studio/src/editor/inspector/SizeSection.tsx` (propriedade `fluid`). A ação deve chamar `update_layer` (propriedade fluida), nunca editar o documento direto.

**Pronto quando** o aviso tem um botão "Aplicar" que liga a opção, a conferência refeita some com o aviso, e um teste cobre o caso. Não verificado ainda: se a opção já resolve o caso de celular — teste antes.

## 8. 🟡 Botões de Shape Builder e dividir/unir contornos na barra de vetor

**Problema.** As ferramentas MCP `shape_builder`, `split_vector_contour` e `join_vector_contours` existem, mas não há botão no painel.

**Onde olhar.** `apps/studio/src/editor/Toolbar.tsx` e `apps/studio/src/editor/inspector/MoreSections.tsx` (procure por `reverse_vector` e `simplify_vector` para ver como os outros botões chamam ferramentas) e [docs/FERRAMENTAS-MCP.md](FERRAMENTAS-MCP.md).

**Pronto quando** cada botão aparece quando faz sentido, chama a ferramenta e é desfeito com um `Ctrl+Z`.

## 9. 🟢 Capturas e um GIF curto para o README

**Problema.** O README tem uma captura do editor. Um GIF de 20 s (desenhar → conferir → exportar → abrir o site) vende o projeto melhor que qualquer texto.

**Pronto quando** há um GIF/vídeo leve (menos de 5 MB) em `docs/img/` e o README o usa. Se usar projeto de exemplo, inclua o `.json` em `docs/exemplos/`.

## 10. 🔴 Exemplo de projeto pronto para abrir

**Problema.** Quem abre o Stylo pela primeira vez vê uma lista vazia. Não há projeto de exemplo para explorar.

**O que fazer.** Criar um site simples e bonito (por exemplo, uma landing de cafeteria) usando o Stylo, exportar o `.json` e oferecer um caminho de "Importar JSON → explorar". Opcional (maior): botão "Abrir exemplo" no menu Arquivo, que ainda não existe.

**Pronto quando** o JSON importa sem erro, passa na Conferência e está documentado no README.

## 11. 🔴 Pinos de comentário desenhados no canvas

**Problema.** Os comentários existem e aparecem na aba, mas não há pinos sobre o canvas (ver [docs/ROADMAP-ALPHA.md](ROADMAP-ALPHA.md)). Converse na issue antes: toca em canvas, ferramentas MCP de comentário e permissões.

---

### Texto sugerido para o rótulo e cabeçalho de cada issue

> **Contexto:** (1–2 frases)
> **Passos para começar:** clone, `npm install`, `STYLO_AUTH=local npm start`
> **Onde mexer:** (arquivos)
> **Pronto quando:** (critério)
> Pode perguntar aqui mesmo — é para isso que a issue serve. 🙂
