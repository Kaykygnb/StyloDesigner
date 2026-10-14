# DOC-DB-001 — Restore e migração descartáveis

Responsável: [Codex/restore_resume]
Estado: Em validação
Início: 2026-10-14 03:27 UTC
Última atualização: 2026-10-14 03:42 UTC
Progresso: 4/5 marcos (80%)
Participantes: [Codex/restore_resume]

- **Módulo:** database
- **Prioridade:** P1
- **Estado:** Em validação
- **Problema/evidência:** backups e migrations têm testes, mas não há procedimento documental único que prove restore de snapshot em ambiente isolado.
- **Objetivo:** verificar que backup, migration e abertura preservam um projeto fixture.
- **Escopo:** PGlite primeiro; PostgreSQL quando DOC-SERVER-001 existir. DOC-SERVER-001 está concluída, mas seu teste não cobre dump/restore: esse gate continua pendente nesta tarefa. Não define a estratégia final de backup/chaves da instância.
- **Fora do escopo:** dados reais.
- **Dependências:** nenhuma para PGlite; DOC-SERVER-001 para PostgreSQL.
- **Riscos:** fixtures conterem segredos ou blobs grandes.
- **Aceitação:** fixture sintética restaura, migra, abre e passa validação; falha deixa o ambiente intacto.
- **Testes obrigatórios:** backup, migration, project load e checksum/contagem.
- **Regressão:** `npm test`.
- **Rollback:** remover ambiente temporário.

## Marcos

### #1 — Investigação
- Estado: concluído
- Responsável: [Codex/restore_resume]
- Atividades executadas: Contratos atuais de snapshot, troca no boot, migrações, assets/projetos e testes existentes analisados.
- Arquivos alterados: `tests/restore-pglite.test.ts`, `docs/modules/database/README.md`, este documento.
- Evidências: fixture PGlite real e assertions verificáveis no teste; HEAD base `50a8d00`.
- Testes executados: testes específicos de restore/backups/db (ver histórico); gates finais pendentes no #5.
- Problemas encontrados: Backups anteriores usam arquivo texto e DB simulado; integração PostgreSQL não demonstra restauração.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Codex/restore_resume]
- Atividades executadas: Duas provas isoladas com PGlite real: restore/migração e falha de fonte ausente, contas/relacionamentos/documento/checksums.
- Arquivos alterados: `tests/restore-pglite.test.ts`, `docs/modules/database/README.md`, este documento.
- Evidências: fixture PGlite real e assertions verificáveis no teste; HEAD base `50a8d00`.
- Testes executados: testes específicos de restore/backups/db (ver histórico); gates finais pendentes no #5.
- Problemas encontrados: Estado pré-0014 reconstituído explicitamente no fixture; não é backup histórico real.

### #3 — Implementação
- Estado: concluído
- Responsável: [Codex/restore_resume]
- Atividades executadas: Criado teste descartável, sem alterar código funcional; documentado procedimento e limites no módulo database.
- Arquivos alterados: `tests/restore-pglite.test.ts`, `docs/modules/database/README.md`, este documento.
- Evidências: fixture PGlite real e assertions verificáveis no teste; HEAD base `50a8d00`.
- Testes executados: testes específicos de restore/backups/db (ver histórico); gates finais pendentes no #5.
- Problemas encontrados: Novos testes não certificam backup de blobs externos/configuração/chaves.

### #4 — Testes
- Estado: concluído
- Responsável: [Codex/restore_resume]
- Atividades executadas: Teste final combinado: backups, migração DB e duas provas de restore; resultados no histórico.
- Arquivos alterados: `tests/restore-pglite.test.ts`, `docs/modules/database/README.md`, este documento.
- Evidências: fixture PGlite real e assertions verificáveis no teste; HEAD base `50a8d00`.
- Testes executados: testes específicos de restore/backups/db (ver histórico); gates finais pendentes no #5.
- Problemas encontrados: Regressão completa npm test ainda pendente nesta janela.

### #5 — Validação final
- Estado: pendente
- Responsável: [Codex/restore_resume]
- Atividades executadas: Preparado handoff para gate de regressão e escopo PostgreSQL, sem inventar resultados.
- Arquivos alterados: `tests/restore-pglite.test.ts`, `docs/modules/database/README.md`, este documento.
- Evidências: fixture PGlite real e assertions verificáveis no teste; HEAD base `50a8d00`.
- Testes executados: testes específicos de restore/backups/db (ver histórico); gates finais pendentes no #5.
- Problemas encontrados: Dump/restore PostgreSQL e validação final continuam pendentes; tarefa não concluída.

## Histórico de trabalho

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.

### 2026-10-14 03:27 UTC — [Codex/restore_resume] — #1 Investigação e assunção

- Investigado: protocolo, backlog, handoff, `backups.ts`, cliente PGlite/migrations, projeto/asset e testes existentes; HEAD `50a8d00`.
- Alterado: assunção autorizada para continuidade independente das decisões finais de backup/chaves. Janela exclusiva: esta tarefa, novo teste de restore e documentação do módulo database, coordenada na thread.
- Arquivos: este documento.
- Testes: ainda não executados nesta assunção.
- Resultado: os testes anteriores copiam arquivo texto com DB simulado; restauração relacional real e migration pós-restore não estão demonstradas. PostgreSQL integrado existente não demonstra pg_dump/pg_restore.
- Próximo passo: prova PGlite em diretório sintético temporário, fechamento antes da troca, migration pendente real, hashes/contagens e recuperação de falha sem apagar original.

### 2026-10-14 03:30 UTC — [Codex/restore_resume] — #2–#4 Planejamento, implementação e provas PGlite

- Investigado: estado pré-0014, reabertura/migração, segurança pre-restore e falha de fonte desaparecida; nenhum defeito funcional reproduzido nesse recorte.
- Alterado: testes reais descartáveis com PNG binário/checksum, versão nomeada, duas contas, compartilhamento e grant de agente; documento do módulo descreve execução e limites.
- Arquivos: `tests/restore-pglite.test.ts`, `docs/modules/database/README.md`, este documento.
- Testes: versão inicial do comando combinado restore/backups/db 5/5; versão ampliada específica restore 2/2, sem falhas/skips. Rodada final combinada: `node --import tsx --import ./tests/_setup.mjs --test --test-timeout=90000 tests/restore-pglite.test.ts tests/backups.test.ts tests/db.test.ts` passou 5/5, zero falhas/skips, 21,94s.
- Resultado: contratos PGlite exercitados com migração 0014 realmente aplicada depois da troca; pedido não modifica banco aberto, cópia de segurança preserva revisão posterior e falha ENOENT reabre original sem perda do documento. Não é certificação geral de restauração.
- Próximo passo: integrar gates completos e decidir recorte verificável PostgreSQL dentro desta tarefa existente.

### 2026-10-14 03:42 UTC — [Codex] — aceite do handoff, revisão e gates integrados

- Investigado: handoff restore_resume e diff; review independente architecture_review confirmou isolamento/fechamento/asserções e limites, sugeriu par de grant preciso.
- Alterado: acrescentada verificação agentId/projectId e ownerId/scopes/status; sem runtime. Responsável implementador preservado; Codex recebe validação, não apaga histórico.
- Arquivos: tests/restore-pglite.test.ts, esta tarefa, módulo/índices/regressão.
- Testes: suíte624/624 sem falhas/skips, typecheck e inventário aprovados; após reforço de asserções no teste, combinado final restore/backups/db5/5 em43,87s. Validador28/links147/diff aprovados.
- Resultado: PGlite real validado no recorte; Em validação4/5 mantida porque restauração PostgreSQL continua sem prova. SERVER001 só testa persistência/rede.
- Próximo passo: publicar na beta e continuar prova descartável PG dump/restore nesta tarefa, sem escolher estratégia final backup/chaves ou usar banco externo herdado.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante]
Estado: Aguardando validação e continuidade
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 03:42 UTC
Commit de referência: 50a8d00d006316175667397ac433ad4b6403832f (base; alterações ainda sem commit)

### Estado atual

4/5, Em validação. Prova PGlite implementada e validada especificamente; PostgreSQL dump/restore ainda pendente; gates globais locais aprovados.

### Decisões tomadas

Reutilizar serviços e cliente atuais; sem sistema paralelo ou alteração funcional. Simular contrato anterior à 0014 somente em banco sintético próprio, não afirmar cobertura histórica universal. Decisões humanas finais de backup/chaves continuam abertas.

### Arquivos envolvidos

`tests/restore-pglite.test.ts`, `docs/modules/database/README.md`, esta tarefa.

### Evidências e testes

Comando reproduzível e assertions no módulo database. Restore específico final 2/2 aprovado; combinado final restore/backups/db 5/5 aprovado (21,94s), zero falhas/skips. Fonte inexistente produz ENOENT e reabertura original preserva hash/revisão. Sem uso de mocks de DB. Suíte624/624 sem falhas/skips e typecheck/inventário aprovados; combinado final5/5 após asserção precisa do grant; review independente limitado ao recorte PGlite.

### Pendências

Prova dump/restore PostgreSQL em recurso próprio ainda pendente; gates locais aprovados. Publicação nesta entrega, sem prova PG inventada. SERVER001 prova persistência, não restauração. Não marcar concluída apenas com evidência PGlite.

### Próximas ações recomendadas

1. Aceitar continuidade e conferir diff/teste final.
2. Conferir gates publicados: suíte624/624, typecheck/inventário/validador; combinado final5/5 após reforço do grant.
3. Implementar prova PostgreSQL descartável se suportada pelo ambiente, sem usar URLs herdadas nem escolher estratégia final de produção.
4. Fechar #5 somente após critérios e evidências ou manter limitação explicitamente registrada.

### Riscos e cuidados

Nunca trocar diretório com PGlite aberto; sempre fechar antes do cleanup. Marcador permanece após falha para diagnóstico; não orientar sua remoção automática em dados reais. Não inclui concorrência, energia/disco, corrupção, blobs externos ou chaves.

### Condições para conclusão

Critérios de aceitação e regressão verificados; cobertura PostgreSQL explicitada com resultado real ou decisão humana de recorte, sem inventar aprovação.
