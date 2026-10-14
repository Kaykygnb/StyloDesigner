# Matriz de compatibilidade MCP

Validação dos clientes MCP contra o servidor do Stylo (DOC-MCP-001). Cada cliente testado registra **versão, configuração, fluxo e resultado**. O que não pôde ser verificado neste ambiente fica **explicitamente marcado como lacuna**, com roteiro para validação manual.

Transporte do servidor: Streamable HTTP em `/mcp` (`WebStandardStreamableHTTPServerTransport` do SDK oficial), uma sessão por cabeçalho `Mcp-Session-Id` (máx. 64, encerra após 10 min ociosa), identidade do agente por `Authorization: Bearer stylo_agt_...` (modo contas) ou nome do programa (modo local, conforme política de agentes).

## Subconjunto de protocolo por cliente

| Cliente | Versão | initialize | tools/list | tools/call | Sessão (Mcp-Session-Id) | Bearer/contas | Texto | Imagem | Erro (isError / JSON-RPC) |
|---|---|---|---|---|---|---|---|---|---|
| SDK oficial TypeScript (`@modelcontextprotocol/sdk`) | 1.32.1 | ✔ | ✔ (120) | ✔ | ✔ | ✔ (`mcp-contas`) | ✔ | não verificado¹ | ✔ |
| Ponte stdio (`apps/server/bin/mcp.mjs`) | próprio (repo) | — | — | — | — | — | — | — | ✔² |
| Cliente HTTP cru (JSON-RPC manual) | protocolo 2025-11-25 | ✔ | ✔ (120) | ✔ | ✔ | não aplicável³ | ✔ | não verificado¹ | ✔ (-32700, -32602, isError) |

¹ **Imagem: lacuna consciente.** Conteúdo do tipo `image` só é produzido por `get_image`, que exige Chromium no servidor. Os testes desta matriz não chamam essa ferramenta; portanto, a disponibilidade do renderer e a apresentação de imagem nesses clientes não foram verificadas nesta rodada. Ferramentas como `generate_qr_code` (PNG) devolvem dataURL dentro do conteúdo de **texto**. Verificação manual: disponibilizar Chromium no servidor, abrir um projeto pelo cliente MCP, chamar `get_image` e conferir `content[].type === 'image'`.

² A ponte stdio foi validada no comportamento de falha: respostas HTTP inesperadas (ex. 403) viram erro MCP claro para a IA (`tests/mcp-stdio.test.js`). O caminho feliz stdio usa o mesmo gateway HTTP internamente.

³ Modo local: identidade vem do nome do programa informado no `initialize` (`clientInfo.name`), sem Bearer. Bearer em modo contas está coberto por `tests/mcp-contas.test.js`.

## Clientes testados

### SDK oficial TypeScript — 1.32.1 — ✔ aprovado

- **Configuração:** `StreamableHTTPClientTransport` apontando para `http://localhost:PORTA/mcp`, `Client` do mesmo SDK; modo local.
- **Fluxo:** connect (initialize) → `tools/list` → `tools/call` (`color_scale`, `generate_qr_code`, `new_project`, `create_layer`, `get_layer`) → `ping` → encerramento.
- **Resultado:** 3 testes em `tests/mcp-sdk.test.js`, todos passando. Inclui presença por nome de programa, isolamento de sessões e remoção da presença ao encerrar.

### Ponte stdio — próprio — ✔ aprovado (escopo de falha)

- **Configuração:** `DESIGNER_URL=http://localhost:PORTA` e JSON-RPC newline-delimited no stdin.
- **Fluxo:** envia `ping` com o servidor respondendo HTTP 403.
- **Resultado:** erro MCP com mensagem clara (`HTTP 403 ... Acesso negado.`), processo sai 0. `tests/mcp-stdio.test.js`.

### Cliente HTTP cru (sem SDK) — protocolo 2025-11-25 — ✔ aprovado

- **Configuração:** `fetch`/curl falando JSON-RPC 2.0 puro em `POST /mcp`, sem biblioteca MCP.
- **Fluxo:** pedido sem sessão → 400; JSON inválido → -32700; `initialize` → sessão + `serverInfo` + instruções; `tools/list` → 120 ferramentas; `tools/call` → texto/isError; ferramenta inexistente → -32602; `DELETE` → sessão encerrada (404 depois); duas sessões isoladas com presença nomeada.
- **Resultado:** 3 testes em `tests/mcp-compatibilidade.test.js` (incluindo isolamento do ambiente adicionado por DOC-ENG-003), todos passando.

Reprodução manual com curl (servidor local em `STYLO_AUTH=local`):

```bash
# 1. initialize: guardar o Mcp-Session-Id devolvido no cabeçalho
curl -sD - -X POST http://localhost:5173/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"meu-cliente","version":"1.0.0"}}}'

# 2. ferramentas, usando a sessão
curl -s -X POST http://localhost:5173/mcp \
  -H 'content-type: application/json' -H 'mcp-session-id: <SID>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3. chamada
curl -s -X POST http://localhost:5173/mcp \
  -H 'content-type: application/json' -H 'mcp-session-id: <SID>' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"color_scale","arguments":{"color":"#2F6AE0"}}}'

# 4. encerrar
curl -s -X DELETE http://localhost:5173/mcp -H 'mcp-session-id: <SID>'
```

Em modo contas, acrescentar `-H "Authorization: Bearer stylo_agt_..."` em todos os passos.

## Lacunas — não verificados neste ambiente

| Cliente | Motivo | Risco | Como validar |
|---|---|---|---|
| Claude Desktop | não instalável/automátizável aqui | não avaliado — teste do SDK não comprova integração desse cliente | apontar `http://<host>:<porta>/mcp` nas configurações e chamar `list_projects` |
| Cursor / Windsurf | idem | não avaliado — integração desse cliente ainda não testada | configurar URL do servidor em `STYLO_AUTH=accounts` com token de agente |
| ChatGPT Work / outros hosted | exigem URL pública + credenciais | médio — rede exposta exige modo contas e política de agentes `closed`/`approval` | expor com reverse proxy local, bearer obrigatório, validar `initialize` + `tools/list` |
| Conteúdo de imagem (`get_image`) | exige renderer com navegador | não avaliado — geração e apresentação da imagem ainda não testadas | com Chromium no servidor e projeto aberto pelo cliente MCP, chamar `get_image` e conferir `content[].type === 'image'` |

Estas lacunas permanecem **explicitamente não verificadas** por decisão de escopo (DOC-MCP-001): a evidência automatizada cobre apenas os caminhos e operações indicados acima. Ela não comprova compatibilidade completa de clientes GUI/hosted, imagem ou do caminho feliz stdio. A aceitação das lacunas para a beta permanece pendente na tarefa.

## Regressão

Antes de alterar o gateway, rode: `tests/mcp-sdk.test.js`, `tests/mcp-stdio.test.js`, `tests/mcp-contas.test.js`, `tests/mcp-compatibilidade.test.js` e os testes de segurança de API. Preservar os testes e registrar novas evidências na matriz quando ampliar a cobertura.

## Revisão técnica independente

[Codex] recebeu o handoff de [Kimi] em 2026-10-14: a implementação original permanece atribuída a Kimi. A matriz distingue agora operações verificadas de integração ainda não testada; risco baixo não é inferido do uso do mesmo transporte. QA GUI com ChatGPT Work continua independente, orientado por `docs/qa/WORK-GUIDE.md`, sem exigir conexão MCP. Gates desta revisão e aceite de escopo são registrados em DOC-MCP-001.
