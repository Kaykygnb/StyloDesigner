# DOC-MCP-001 — Matriz de compatibilidade MCP

Responsável: [Codex]
Estado: Em revisão
Início: 2026-10-13 23:45 UTC
Última atualização: 2026-10-14 02:18 UTC
Progresso: 4/5 marcos (80%)
Participantes: [Kimi], [Codex]

- **Módulo:** mcp
- **Prioridade:** P0
- **Estado:** Em revisão
- **Problema/evidência:** o cliente oficial do SDK tem testes; clientes MCP externos não foram validados individualmente.
- **Objetivo:** registrar o subconjunto de protocolo e diferenças observadas por cliente.
- **Escopo:** initialize, tools/list, tools/call, sessão, bearer, texto/imagem/erro.
- **Fora do escopo:** implementar clientes externos no Stylo.
- **Dependências:** DOC-CORE-001.
- **Riscos:** clientes mudam formatos e capacidades.
- **Aceitação:** cada cliente testado tem versão, configuração, fluxo e resultado anexados; lacunas permanecem explicitamente não verificadas.
- **Testes obrigatórios:** contrato MCP oficial e testes manuais reproduzíveis.
- **Regressão:** `mcp-sdk`, `mcp-stdio`, auth e segurança.
- **Rollback:** remover apenas fixtures de compatibilidade.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: leitura de `mcp/gateway.ts` (transporte Streamable HTTP do SDK, sessão por `Mcp-Session-Id`, Bearer `stylo_agt_...`, leniente com `Accept`, erros -32700/-32602), `tests/mcp-sdk.test.js` (cliente oficial SDK TS `^1.32.1`: initialize, tools/list, tools/call, isError, ping, presença), `tests/mcp-stdio.test.js` (ponte stdio `bin/mcp.mjs`) e `tests/mcp-contas.test.js` (tokens em modo contas).
- Arquivos alterados: —
- Evidências: conteúdo de IMAGEM só é produzido por `get_image` (exige renderer com navegador — indisponível no servidor de teste); ferramentas como `generate_qr_code` em PNG devolvem dataUrl dentro do conteúdo de texto.
- Testes executados: leitura estática; nenhum comando nesta entrada.
- Problemas encontrados: nenhum teste cobre cliente externo que NÃO use o SDK oficial (JSON-RPC manual sobre HTTP) — lacuna central da tarefa.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: definição dos clientes verificáveis neste ambiente e da matriz. Clientes testados: SDK oficial TS (existente), ponte stdio (existente), contas/bearer (existente) e novo cliente HTTP cru (JSON-RPC 2.0 manual via fetch, sem SDK). Lacunas explícitas: clientes GUI/hosted (Claude Desktop, Cursor, Windsurf, ChatGPT Work) — não instaláveis neste ambiente; deixam de ser verificados com justificativa e roteiro manual.
- Arquivos alterados: —
- Evidências: plano = `tests/mcp-compatibilidade.test.js` (novo) + `docs/mcp/COMPATIBILIDADE.md` (matriz com versão, configuração, fluxo e resultado por cliente, mais comandos curl reproduzíveis).
- Testes executados: —
- Problemas encontrados: —
### #3 — Implementação
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: criado `tests/mcp-compatibilidade.test.js` (cliente HTTP cru, 2 testes: protocolo ponta a ponta e isolamento de sessões) e `docs/mcp/COMPATIBILIDADE.md` (matriz com versão/configuração/fluxo/resultado por cliente, lacunas GUI/hosted e roteiro curl reproduzível); inventário de ferramentas regenerado (`npm run docs:inventario`) porque o teste novo adicionou referências.
- Arquivos alterados: `tests/mcp-compatibilidade.test.js`, `docs/mcp/COMPATIBILIDADE.md`, `docs/modules/mcp/README.md`, `docs/testing/TOOL-INVENTORY.json`, `docs/testing/TOOL-INVENTORY.md`
- Evidências: nenhuma mudança de runtime — cobertura de teste e documentação apenas.
- Testes executados: teste novo isolado 2/2.
- Problemas encontrados: —

### #4 — Testes
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: contrato MCP (mcp-sdk, mcp-stdio, mcp-compatibilidade, tool-inventory) 8/8 isolado; typecheck limpo; build ok; suíte completa: única falha é `tests/studio-ui.test.js` (linha 155, etapa "Conferir"), reproduzida na árvore limpa — pré-existente e fora do escopo; registrada como [DOC-STUDIO-004](../studio/DOC-STUDIO-004.md).
- Arquivos alterados: —
- Evidências: `npm test` — 615 passando, 1 falha pré-existente (studio-ui); MCP e inventário verdes.
- Testes executados: `node --import tsx --import ./tests/_setup.mjs --test tests/tool-inventory.test.js tests/mcp-compatibilidade.test.js tests/mcp-sdk.test.js tests/mcp-stdio.test.js` (8/8); `npm run typecheck`; `npm test`; `npm run build`.
- Problemas encontrados: falha ambiental pré-existente do E2E de painel web (DOC-STUDIO-004).
### #5 — Validação final
- Estado: em andamento
- Responsável: [Codex]
- Atividades executadas: handoff de Kimi recebido; revisão técnica da matriz corrigiu inferências não sustentadas por testes. Marcos #1–#4 e histórico original permanecem atribuídos a Kimi. Aceite humano das lacunas ainda pendente.
- Arquivos alterados: docs/mcp/COMPATIBILIDADE.md, documentação de planejamento.
- Evidências: matriz distingue imagem não verificada, stdio somente falha e clientes GUI/hosted sem evidência de compatibilidade.
- Testes executados: SDK/autorização específicos aprovados; typecheck e validador aprovados; suíte atual em execução.
- Problemas encontrados: não interpretar transporte comum como integração verificada; não vincular QA GUI do Work a MCP obrigatório.

## Histórico de trabalho

### 2026-10-14 00:30 UTC — [Kimi] — #3 Implementação, #4 Testes e #5 Validação

- Investigado: produção de conteúdo de imagem (`get_image` exige renderer) e integração do teste novo com o inventário de ferramentas (drift check exigiu regeneração).
- Alterado: `tests/mcp-compatibilidade.test.js`, `docs/mcp/COMPATIBILIDADE.md`, `docs/modules/mcp/README.md`, inventário regenerado; marcos #3 e #4 concluídos; proposta DOC-STUDIO-004 registrada para a falha pré-existente do E2E de painel web.
- Arquivos: os acima + BACKLOG.md + este documento.
- Testes: MCP + inventário 8/8 isolados; typecheck limpo; build ok; suíte 615/1 falha pré-existente (studio-ui, fora do escopo).
- Resultado: matriz de compatibilidade publicada com lacunas explícitas; nenhuma mudança de runtime.
- Próximo passo: fechar marco #5 (revisão) e mover para `Em validação`/`Concluída`.

### 2026-10-13 23:58 UTC — [Kimi] — #1 Investigação e #2 Planejamento

- Investigado: `mcp/gateway.ts`, `tests/mcp-sdk.test.js`, `tests/mcp-stdio.test.js`, `tests/mcp-contas.test.js` e produção de conteúdo de imagem (`get_image` exige renderer; QR PNG devolve dataUrl em texto).
- Alterado: marcos #1 e #2 concluídos com plano — novo teste de cliente HTTP cru (JSON-RPC manual, sem SDK) e matriz `docs/mcp/COMPATIBILIDADE.md` com lacunas GUI/hosted explicitamente não verificadas.
- Arquivos: apenas este documento.
- Testes: nenhum executado nesta entrada.
- Resultado: escopo e aceitação endereçados sem implementar clientes externos no Stylo.
- Próximo passo: implementar `tests/mcp-compatibilidade.test.js` e a matriz (marco #3).

### 2026-10-13 23:45 UTC — [Kimi] — #1 Investigação (assunção)

- Investigado: protocolo, BACKLOG, HANDOFF geral (Codex concluiu DOC-SERVER-004, DOC-CORE-001 e DOC-QA-001; DOC-STUDIO-003 segue com [Codex]) e duplicação com DOC-CORE-001 (concluída — inventário de ferramentas; esta tarefa valida clientes, não ferramentas).
- Alterado: responsável registrado como [Kimi], estado `Em andamento`, marco #1 em andamento.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: nenhum nesta entrada.
- Resultado: tarefa assumida conforme protocolo §2, após `git pull` sincronizar 7 commits novos da branch (80818cd).
- Próximo passo: ler `mcp/gateway.ts` e os testes `mcp-sdk`/`mcp-stdio`/`mcp-contas` para mapear o contrato de transporte antes de planejar a matriz.

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.

### 2026-10-14 02:18 UTC — [Codex] — aceite de transferência para revisão técnica

- Investigado: handoff preparado por [Kimi] para próximo agente, commits publicados cc9bec8/1c39a54/a502ba7 e matriz atual; remoto b4ae89d sem avanço concorrente na consulta.
- Alterado: transferência de responsável anterior [Kimi] para novo [Codex], aceita nesta entrada por solicitação humana de continuidade por criticidade. Estado Em revisão, 4/5; implementação/histórico Kimi preservados. Janela: matriz MCP e documentação desta revisão.
- Arquivos: esta tarefa, docs/mcp/COMPATIBILIDADE.md, BACKLOG.md e HANDOFF.md.
- Testes: inspeção cruzada matriz/fixtures/renderer; reexecução dos gates em andamento junto à ENG-004. Não foram testados clientes GUI ou imagens nesta revisão.
- Resultado: corrigidas afirmações sem evidência sobre imagem, classificação baixa de risco por transporte e contagem desatualizada dos testes. A falha Studio foi corrigida e os commits já foram publicados; não repetir essas pendências antigas.
- Próximo passo: registrar gates atuais, revisar escopo residual; aceitação humana das lacunas continua pendente.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / revisor humano]
Estado: Em revisão
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 02:18 UTC
Commit de referência: `cc9bec8` na branch `v0.1.0-beta`

### Estado atual

Marcos #1–#4 concluídos por Kimi. Codex aceitou revisão técnica; matriz ajustada para limitar conclusões ao que os testes verificam. Alterações originais já publicadas; falha DOC-STUDIO-004 corrigida. Gates atuais em execução; GUI/imagem/stdio feliz seguem não verificados.

### Decisões tomadas

- Lacuna de imagem deixada explícita em vez de mockada: conteúdo `image` só vem de `get_image`, que exige renderer com navegador; QR PNG devolve dataURL em texto.
- Clientes GUI/hosted (Claude Desktop, Cursor, Windsurf, ChatGPT Work) registrados como não verificados neste ambiente, com roteiro manual — em vez de simulações que não provariam compatibilidade real.
- Teste novo entrou no inventário de ferramentas: `npm run docs:inventario` é obrigatório ao adicionar testes que mencionam ferramentas (drift check do DOC-CORE-001).

### Arquivos envolvidos

- Alterados: `tests/mcp-compatibilidade.test.js` (novo), `docs/mcp/COMPATIBILIDADE.md` (novo), `docs/modules/mcp/README.md`, `docs/testing/TOOL-INVENTORY.{json,md}` (regenerados), `docs/planning/BACKLOG.md` (DOC-STUDIO-004), este documento.

### Evidências e testes

- Isolado: tool-inventory + mcp-sdk + mcp-stdio + mcp-compatibilidade = 8/8.
- `npm run typecheck` limpo; `npm run build` ok; `npm test` = 615 passando + 1 falha pré-existente (`studio-ui.test.js:155`, DOC-STUDIO-004, reproduzida na árvore limpa).

### Pendências

- Publicar ajustes desta revisão e registrar gates; só concluir #5 após aceite de escopo.
- Revisão humana da matriz (principalmente a classificação das lacunas).

### Próximas ações recomendadas

1. Registrar gates da revisão e publicar ajustes na `v0.1.0-beta`.
2. Atualizar `HANDOFF.md` geral com a DOC-MCP-001.
3. Revisão: conferir se as lacunas declaradas são aceitáveis como "explicitamente não verificadas".

### Riscos e cuidados

- Nunca enfraquecer as asserções do `tests/tool-inventory.test.js` ao regenerar o inventário — ele é o gate de drift do DOC-CORE-001.
- A falha do `studio-ui.test.js` não foi causada por esta tarefa; não misturar correções (DOC-STUDIO-004).

### Condições para conclusão

- Mudanças publicadas na branch; validador de tarefas ok; matriz revisada e aceita.
