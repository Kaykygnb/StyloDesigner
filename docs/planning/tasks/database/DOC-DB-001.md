# DOC-DB-001 — Restore e migração descartáveis

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-13 00:00 -03:00
Progresso: 0/5 marcos (0%)
Participantes: —

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

## Marcos

### #1 — Investigação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #2 — Planejamento
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #3 — Implementação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #4 — Testes
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #5 — Validação final
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

## Histórico de trabalho

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.
