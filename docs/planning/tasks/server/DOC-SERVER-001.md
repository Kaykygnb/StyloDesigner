# DOC-SERVER-001 — Validar adapters de persistência e rede

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
