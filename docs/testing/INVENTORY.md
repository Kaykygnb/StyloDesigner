# Inventário de testes

| Área | Exemplos | O que verificam |
|---|---|---|
| Modelo/validação | `validacao`, `formato-versao`, `projeto-hostil` | entradas inválidas, versão e sanitização |
| CSS/HTML/export | `css`, `exportacao`, `site-export`, `export-react` | saída gerada e segurança |
| Geometria/vetores | `geom`, `svgimport`, `arrange-props` | paths, booleanas, nós e curvas |
| Runner/MCP | `runner-seguranca`, `mcp-sdk`, `mcp-stdio`, `agent*` | schemas, escopos, resultados e sessões |
| Server/DB | `db`, `conta`, `backups`, `biblioteca-http` | persistência, auth, blobs e biblioteca |
| Studio | `studio-ui`, `studio-geometry`, `studio-api`, `studio-pasteboard` | interação, canvas e integração |
| Auditoria/medidas | `audit*`, `inspect-layout`, `layout-inspection-renderer` | problemas e medidas responsivas |

Execução local de referência (2026-10-13 23:29 UTC, tooling/contratos de 08a6c03): 613 pass, 0 fail, 0 cancelled, 0 skipped. Esta contagem descreve a suíte executada, não cobertura completa de toda capacidade.
