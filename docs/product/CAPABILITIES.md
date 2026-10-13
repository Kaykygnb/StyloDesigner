# Capacidades por evidência

| Capacidade | Status | Evidência principal |
|---|---|---|
| Modelo de documento e validação | Verificado | `packages/core/src/model.ts`, `validate.ts`, testes `versao`, `validacao` |
| Edição de camadas e layout | Verificado | `packages/core/src/tools/runner/layout.ts`, `layers.ts`, `batch.ts` |
| CSS/HTML/SVG e exportação React | Verificado | `css.js`, `html.js`, `site-export.ts`, `export-react.ts` |
| Vetores e operações geométricas | Verificado | `geom.js`, `runner/vector.ts`, testes `geom`, `svgimport`, `arrange` |
| Auditoria e inspeção | Verificado | `audit*.ts`, `layout-inspection`, `renderer` |
| Studio visual | Verificado em fluxo automatizado | `apps/studio`, `tests/studio-ui.test.js` |
| MCP HTTP/stdio | Verificado | `apps/server/src/mcp`, `mcp-sdk`, `mcp-stdio` |
| Autenticação e agentes | Verificado | `routes/auth.ts`, `services/auth.ts`, `services/agents.ts` |
| Locks e presença | Verificado | `presence.js`, `studio-calls.ts`, `agent-calls.ts` |
| Biblioteca de assets | Verificado | `services/library.ts`, `blobs.ts`, plugins de assets |
| Plugins embutidos | Implementado; cobertura varia | `packages/plugins/src`, `plugins.test.ts` |
| PostgreSQL externo | Implementado não verificado | `packages/db`, `DATABASE_URL`; sem execução externa registrada |
| Clientes MCP além do SDK oficial | Implementado não verificado | contrato HTTP existe; cliente oficial é o validado |
