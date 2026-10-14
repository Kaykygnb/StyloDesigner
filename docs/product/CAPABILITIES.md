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
| Entrada humana accounts e administração | Verificado localmente em Chromium | `tests/e2e/run.mjs`, `studio-admin-fluxo.mjs`, `studio-login-fluxo.mjs`; senha temporária, sessão, suspensão e menus por papel da conta |
| Locks e presença | Verificado | `presence.js`, `studio-calls.ts`, `agent-calls.ts` |
| Biblioteca de assets | Verificado | `services/library.ts`, `blobs.ts`, plugins de assets |
| Plugins embutidos | Implementado; cobertura varia | `packages/plugins/src`, `plugins.test.ts` |
| PostgreSQL externo | Verificado descartável | `packages/db`, `DATABASE_URL`; `tests/postgres-integracao.test.js` sobe PostgreSQL temporário (DOC-SERVER-001) |
| Clientes MCP além do SDK oficial | Verificado | `tests/mcp-compatibilidade.test.js` com JSON-RPC cru; lacunas GUI/hosted explícitas em `docs/mcp/COMPATIBILIDADE.md` (DOC-MCP-001) |
