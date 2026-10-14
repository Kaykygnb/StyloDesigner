# DOC-SERVER-001 — Validar adapters de persistência e rede

Responsável: [Kimi]
Estado: Em andamento
Início: 2026-10-14 01:20 UTC
Última atualização: 2026-10-14 01:20 UTC
Progresso: 0/5 marcos (0%)
Participantes: [Kimi]

- **Módulo:** server/database
- **Prioridade:** P1
- **Estado:** Proposto
- **Problema/evidência:** há suporte de configuração para PostgreSQL e rede local, mas esta revisão não executou PostgreSQL externo nem um cenário prolongado multiusuário.
- **Objetivo:** obter evidência reproduzível sem tocar dados do produto.
- **Escopo:** banco descartável, migrações, autenticação, projetos, locks e reconexão.
- **Fora do escopo:** migração de produção ou mudança de schema.
- **Dependências:** ambiente PostgreSQL temporário aprovado.
- **Riscos:** diferenças de driver, concorrência e cleanup.
- **Aceitação:** script documentado sobe ambiente descartável, roda migrações, fluxo auth/projeto/agent e destrói o ambiente.
- **Testes obrigatórios:** integração DB e HTTP; teste de falha de conexão.
- **Regressão:** `npm test`, `npm run typecheck`.
- **Rollback:** destruir apenas o ambiente descartável.

## Marcos

### #1 — Investigação
- Estado: em andamento
- Responsável: [Kimi]
- Atividades executadas: assumida por ser a P1 sem dependências que bloqueia DOC-DB-001 (restore/migração depende desta validação).
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

### 2026-10-14 01:20 UTC — [Kimi] — #1 Investigação (assunção)

- Investigado: protocolo, BACKLOG e HANDOFF — DOC-SERVER-001 é a P1 sem dependências que bloqueia DOC-DB-001 (restore real PGlite/PostgreSQL depende desta validação).
- Alterado: responsável registrado como [Kimi], estado `Em andamento`, marco #1 em andamento.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: nenhum nesta entrada.
- Resultado: tarefa assumida conforme protocolo §2, com autorização do proprietário ("pegue uma e faça").
- Próximo passo: ler `apps/server/src/db.ts` e `packages/db` para mapear o adapter (PGlite vs PostgreSQL via DATABASE_URL) e verificar disponibilidade de PostgreSQL descartável nesta máquina.

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.
