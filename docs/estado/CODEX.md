# Codex como subagente (`codex app-server`)

Prova de conceito de 10/10/2026, `codex-cli 0.162.1`, login pelo ChatGPT (autorizado pela pessoa).

## Como usar
```bash
git worktree add -b trabalho/<nome> "$TEMP/wt-<nome>" HEAD
node scripts/codex-worker.mjs "$TEMP/wt-<nome>" "<tarefa em inglês, passos concretos, arquivos permitidos>" low
```
O script abre `codex app-server --listen stdio://` com `-c windows.sandbox="unelevated"`, faz `initialize` → `thread/start` (`sandbox: workspace-write`, `approvalPolicy: never`, `ephemeral`) → `turn/start` e imprime tempo, tokens (`thread/tokenUsage/updated`), tipos de item e a última mensagem. Pedidos de aprovação do servidor são recusados.

## O que a prova mostrou
- O protocolo funciona: o esquema vem de `codex app-server generate-json-schema`. Métodos úteis: `thread/start`, `turn/start`, `turn/steer`, `turn/interrupt`, `review/start`, `thread/goal/set`; notificações `turn/diff/updated`, `item/*`, `thread/tokenUsage/updated`.
- Tarefa real e pequena (remover o helper morto `escapeRe` de `src/html.js`): **29 s, ~104 mil tokens de entrada (a maior parte em cache), ~660 de saída**. A edição saiu correta (1 linha).
- **Sem `windows.sandbox="unelevated"` o terminal do Codex nem sobe** (`helper_unknown_error`).
- **Dentro da sandbox o Codex não consegue rodar `npm test`** (`spawn EPERM`, 34 falhas). Portanto o relato dele sobre testes não vale: quem roda os testes sou eu, na worktree, antes de integrar.
- Meu pedido esqueceu `npm run docs`; o teste da referência falhou até regenerar. Toda tarefa que mude comentários/linhas de `src/` deve pedir `npm run docs` (ou eu rodo depois).
- Não medi `codex exec` na mesma tarefa; não afirmo que o app-server economiza tokens. A primeira tentativa (sem o ajuste do Windows) gastou ~137 mil tokens sem resultado.

## Política de modelo (decidida com o Jev; plano Plus, cota limitada)
Modelos da conta (`model/list`): `gpt-6.1-sol` (padrão, trabalho geral), `gpt-6-astra` (o mais forte), `gpt-6-luna` (rápido e barato), mais versões antigas. Esforços: low/medium/high/xhigh.

| Tarefa | Modelo | Esforço | Sandbox | Jev |
|---|---|---|---|---|
| Remoção de código morto, edição trivial | `gpt-6-luna` | low | workspace-write | 0,70 |
| Troca mecânica por regra (S8, literais → tokens) | `gpt-6.1-sol` | low | workspace-write | 0,66 / 0,74 |
| Correções pequenas com teste primeiro | `gpt-6.1-sol` (Jev: Luna 0,52 × Sol 0,48, incerto) | medium | workspace-write | 0,28 `review` |
| Revisão de segurança do diff | `gpt-6-astra` | high | read-only | 0,77 / 0,82 |
| Deliberar decisão de arquitetura | `gpt-6-astra` | high | read-only | 0,51 / 0,46 `confirm` |
A Astra gasta cota rápido (Jev: risco de desperdício 0,97 em tarefa rotineira): reservar para revisão de segurança e para poucas deliberações. Sem o argumento de modelo o cliente usa o padrão da conta (Sol).
Exemplo: `node scripts/codex-worker.mjs <worktree> "<tarefa>" high gpt-6-astra read-only`.

## Subagentes do próprio Codex e deliberação
O Codex pode criar seus próprios subagentes se o pedido disser para isso (não testei). Para deliberar, mando o dilema com as opções e a minha inclinação, em `read-only`, e peço contra-argumentos e o que ele verificaria; a decisão final é minha e fica no `DECISOES.md`, com a objeção dele se for relevante.

## Regras
1. Sempre worktree descartável; nunca a árvore principal. Revisar o diff e rodar `npm test` eu mesmo.
2. Sem `ws://`; só `stdio://`.
3. Tarefas mecânicas e de escopo fechado (ex.: S8, trocar literais de CSS por tokens, um tipo por vez) e segunda opinião de revisão. Não para segurança, persistência ou design.
4. Pedido no formato do orquestrador (objetivo, arquivos, o que não fazer, verificação, devolução), em inglês.
