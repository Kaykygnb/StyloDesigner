# MCP

O gateway MCP é uma interface de transporte e sessão sobre as capacidades do core.

## Controla

Sessões, catálogo exposto, identidade de agente, escopos, adaptação de resultados e transporte HTTP/stdio.

## Não deve fazer

Não deve conter a implementação de domínio das ferramentas nem divergir do runner usado pelo Studio.

## Verificação

`mcp-sdk`, `mcp-stdio`, `mcp-contas`, `mcp-compatibilidade`, `agent*` e testes de segurança de API.

A compatibilidade com clientes externos (versão, configuração, fluxo, resultado e lacunas) está em [docs/mcp/COMPATIBILIDADE.md](../../mcp/COMPATIBILIDADE.md) (DOC-MCP-001).
