# DOC-DB-001 — Restore e migração descartáveis

- **Módulo:** database
- **Prioridade:** P1
- **Estado:** Proposto
- **Problema/evidência:** backups e migrations têm testes, mas não há procedimento documental único que prove restore de snapshot em ambiente isolado.
- **Objetivo:** verificar que backup, migration e abertura preservam um projeto fixture.
- **Escopo:** PGlite primeiro; PostgreSQL quando DOC-SERVER-001 existir.
- **Fora do escopo:** dados reais.
- **Dependências:** nenhuma para PGlite; DOC-SERVER-001 para PostgreSQL.
- **Riscos:** fixtures conterem segredos ou blobs grandes.
- **Aceitação:** fixture sintética restaura, migra, abre e passa validação; falha deixa o ambiente intacto.
- **Testes obrigatórios:** backup, migration, project load e checksum/contagem.
- **Regressão:** `npm test`.
- **Rollback:** remover ambiente temporário.
