# Arquitetura implementada

O Stylo é um monólito modular em um monorepo npm. Há um processo principal do servidor, com módulos internos e adapters para HTTP, Studio, MCP, banco, renderer e plugins.

```text
Studio React ───────┐
                    ├─ HTTP studio caller ─┐
Agente MCP ─────────┘                      ├─ core runner ── modelo/comandos ── workspace ── banco/blobs
                                           └─ presença, autorização, atividade e locks
```

## Módulos

- `packages/core`: modelo, comandos, CSS/HTML/SVG, geometria, auditoria, exportação e catálogo/runner de ferramentas. Não deve depender de HTTP, banco ou React.
- `apps/studio`: apresentação, interação, estado de sessão e chamada HTTP. Não deve mutar o documento por fora do caller de ferramentas.
- `apps/server`: composição do processo, rotas, autenticação, workspace, persistência, presença, renderer e adapters de transporte.
- `apps/server/src/mcp`: sessão MCP, catálogo exposto, identidade do agente e adaptação de resultados.
- `packages/db`: Prisma, schema, migrations e adapters PGlite/PostgreSQL.
- `packages/plugins`: registro de ferramentas complementares e providers de assets. Plugins não devem contornar validação do core.

## Arquitetura-alvo mínima

Manter o monólito modular até que uma necessidade operacional force separação. A primeira extração plausível seria renderer/imagem, pois já possui uma seam de dependência no runner e custo computacional diferente. Não extrair MCP nem core prematuramente.
