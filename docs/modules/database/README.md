# Database

`packages/db` define schema Prisma, migrations e adapters para PGlite/PostgreSQL.

## Controla

Persistência relacional, relações de conta/projeto/agente, migrações e criação do cliente.

## Não deve fazer

Não deve conter regras de apresentação, ferramentas MCP ou geometria.

## Verificação

Testes de migração, projetos, contas, backups e biblioteca. PostgreSQL externo é verificado de forma descartável por `tests/postgres-integracao.test.js` (DOC-SERVER-001): sobe um PostgreSQL temporário, aplica as migrações, roda fluxo auth/projeto/agente, reinício do servidor e falha de conexão.
