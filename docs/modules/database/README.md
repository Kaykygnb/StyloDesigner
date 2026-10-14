# Database

`packages/db` define schema Prisma, migrations e adapters para PGlite/PostgreSQL.

## Controla

Persistência relacional, relações de conta/projeto/agente, migrações e criação do cliente.

## Não deve fazer

Não deve conter regras de apresentação, ferramentas MCP ou geometria.

## Verificação

Testes de migração, projetos, contas, backups e biblioteca. PostgreSQL externo é verificado de forma descartável por `tests/postgres-integracao.test.js` (DOC-SERVER-001): sobe um PostgreSQL temporário, aplica as migrações, roda fluxo auth/projeto/agente, reinício do servidor e falha de conexão.

## Prova de restauração descartável

`tests/restore-pglite.test.ts` usa PGlite real em diretórios exclusivos criados com `mkdtemp`, sem URLs herdadas, dados reais ou banco simulado. Execute:

```sh
node --import tsx --import ./tests/_setup.mjs --test --test-timeout=90000 tests/restore-pglite.test.ts tests/backups.test.ts tests/db.test.ts
```

O primeiro teste cria duas contas sintéticas, um projeto/documento, uma imagem PNG, versão nomeada, compartilhamento VIEWER e agente autorizado. Reconstitui no próprio fixture o contrato imediatamente anterior à migração `0014_agent_type`: remove a coluna adicionada por essa migração e sua entrada no registro. Isso não representa cobertura de todos os backups de versões antigas nem um backup histórico de produção.

Pelo serviço existente, cria snapshot após `CHECKPOINT`, grava uma revisão posterior e solicita restauração. Confirma que o banco aberto continua na revisão posterior. Fecha o cliente antes de executar `applyPendingRestore`, seguindo a ordem de inicialização do servidor, e reabre pelo cliente oficial: a migração pendente é aplicada, projeto/imagem preservam SHA-256, contagens e vínculos conferem, documento passa `sanitizeDoc`, e a segunda aplicação sem pedido retorna `false`. A cópia `pre-restore` também é aberta de verdade e contém a revisão posterior. O diretório substituído e a cópia preventiva da migração são preservados pelo contrato atual.

O segundo teste remove apenas a fonte sintética após preparar o pedido: a troca falha com `ENOENT`, o diretório original é devolvido ao caminho anterior e o projeto abre com o mesmo checksum e revisão. O marcador permanece para diagnóstico; a rotina não declara recuperação de toda falha possível. ID inválido é rejeitado antes da preparação.

O cleanup fecha PGlite antes de apagar a raiz temporária. Este roteiro é uma prova automatizada dos contratos atuais, não um procedimento autorizado de restauração em produção.

### Limites de cobertura

- Não inclui backup integral da instância: blobs externos da biblioteca, configurações e chaves não são certificados pelo snapshot da pasta PGlite.
- Não verifica concorrência de escrita durante cópia, crash/queda de energia, disco cheio, snapshots corrompidos ou falha da reversão do `rename`.
- PostgreSQL exige `pg_dump`/`pg_restore`; o serviço recusa copiar/restaurar sua pasta. A integração PostgreSQL existente prova persistência e migrações, mas **não** prova dump/restore. Esse gate continua pendente em [DOC-DB-001](../../planning/tasks/database/DOC-DB-001.md), sem definir a estratégia final de backup/chaves ainda aberta na ADR 0002.
