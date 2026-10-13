# DOC-MCP-001 — Matriz de compatibilidade MCP

- **Módulo:** mcp
- **Prioridade:** P0
- **Estado:** Proposto
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
