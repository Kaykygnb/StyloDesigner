# DOC-SERVER-001 — Validar adapters de persistência e rede

Responsável: [Kimi]
Estado: Concluída
Início: 2026-10-14 01:20 UTC
Última atualização: 2026-10-14 01:40 UTC
Progresso: 5/5 marcos (100%)
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
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: leitura de `packages/db/src/client.ts` (caminho `url` não aplica migrações — exige migração prévia, ao contrário do PGlite), `apps/server/src/db.ts`, `main.ts` (com `DATABASE_URL`, pula restore de pasta e backups usam `pg_dump`); verificação de ambiente: sem Docker/psql/serviço PostgreSQL nesta máquina; prova de conceito com `embedded-postgres` (PostgreSQL 18.4 descartável funcional).
- Arquivos alterados: —
- Evidências: PoC em pasta temporária fora do repo subiu PostgreSQL 18.4, criou banco e respondeu `SELECT version()`.
- Testes executados: PoC manual (fora do repo).
- Problemas encontrados: nenhum PostgreSQL externo instalado; solução = binário descartável via devDependency.

### #2 — Planejamento
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: plano = `tests/postgres-integracao.test.js` como "script documentado reproduzível": sobe PostgreSQL descartável (`embedded-postgres`, devDependency nova), cria banco temporário, aplica as 15 migrações de `packages/db/prisma/migrations` (mesmos arquivos do caminho PGlite), liga o servidor com `DATABASE_URL` em modo contas e roda: setup/login/troca de senha → projeto → agente MCP com bearer listando o projeto → compartilhamento e leitura por segunda sessão → **reinício do servidor com o mesmo banco** (persistência) → **falha de conexão** (derruba o PostgreSQL: health 503, erro JSON limpo, servidor de pé, recuperação ao voltar) → destruição do ambiente. Pula com aviso se o binário não puder ser provisionado (ex. CI sem rede).
- Arquivos alterados: —
- Evidências: aceite coberto ponta a ponta; nada toca dados de produto.
- Testes executados: —
- Problemas encontrados: —

### #3 — Implementação
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: novo `tests/postgres-integracao.test.js` (1 teste ponta a ponta, 23 s) e `embedded-postgres` em devDependencies; ajustes encontrados no caminho: `pg.getPgClient()` exige `connect()` explícito; URL do banco precisa da porta em variável (a opção não é exposta como propriedade); `persistent: true` obrigatório para ressober o banco na etapa de falha; cleanup com retry por EBUSY no Windows. Inventário de ferramentas regenerado (o teste cita ferramentas).
- Arquivos alterados: `tests/postgres-integracao.test.js`, `package.json`, `package-lock.json`, `docs/testing/TOOL-INVENTORY.json`, `docs/testing/TOOL-INVENTORY.md`
- Evidências: aceite coberto — ambiente descartável sobe, migrações aplicadas, fluxo auth/projeto/agente executa, ambiente destruído no fim.
- Testes executados: teste isolado 1/1 (após 3 iterações de correção de infra do próprio teste).
- Problemas encontrados: nenhum de produto; apenas ajustes de infra do teste (documentados acima).

### #4 — Testes
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: integração isolada 1/1; typecheck limpo; `npm test` 616/616 (615 anteriores + o novo); build ok; validador de tarefas ok.
- Arquivos alterados: —
- Evidências: suíte completa verde com o PostgreSQL real no lugar do PGlite de memória para este teste.
- Testes executados: `npm run typecheck`, `npm test`, `npm run build`.
- Problemas encontrados: —

### #5 — Validação final
- Estado: concluído
- Responsável: [Kimi]
- Atividades executadas: docs atualizadas (governança §9): `docs/modules/database/README.md`, `docs/product/CAPABILITIES.md` (PostgreSQL externo e clientes MCP além do SDK agora "verificado"), `docs/product/CURRENT-STATE.md`. Aceite atendido com evidência reproduzível; estado `Concluída`.
- Arquivos alterados: os três docs acima + BACKLOG.md.
- Evidências: commits a publicar; rollback = remover o teste, a devDependency e as linhas de docs.
- Testes executados: validador.
- Problemas encontrados: —

## Histórico de trabalho

### 2026-10-14 01:40 UTC — [Kimi] — #1–#5 conclusão

- Investigado: adapter `packages/db` (caminho `url` não migra sozinho), ambiente (sem Docker/psql) e viabilidade do `embedded-postgres` (PoC fora do repo: PostgreSQL 18.4 funcional).
- Alterado: `tests/postgres-integracao.test.js` (novo), devDependency `embedded-postgres`, inventário regenerado, docs de produto/módulo atualizadas; marcos #1–#5 concluídos, estado `Concluída`.
- Arquivos: os listados nos marcos.
- Testes: isolado 1/1 (23 s); typecheck; `npm test` 616/616; build; validador.
- Resultado: PostgreSQL externo passa de "implementado não verificado" para verificado de forma descartável e reproduzível — base que a DOC-DB-001 (restore real) pode usar.
- Próximo passo: DOC-DB-001 fica desbloqueada; rede multiusuário prolongada segue em CURRENT-STATE como não verificado.

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
