# DOC-SERVER-005 — Verificar gates de autorização da configuração do servidor

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-13 21:24 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

**Proposto — investigação pendente.** routes/system.ts contém PUT /config sem chamada explícita a identity.userOf/adminOf no handler. A proteção global de origem/JSON precisa ser diferenciada da autorização de conta.

## Objetivo

Reproduzir acesso anônimo e de membro em accounts; definir/assertar a política já existente de administração e corrigir os gates que não a cumprirem.

## Escopo

routes/system.ts, identidade e testes HTTP; modo local e casos OWNER/ADMIN/MEMBER; configuração pública e persistência sem exposição de chaves. Fora do escopo: redesenho da autenticação, mudança de schema e dados reais.

## Módulo e contratos afetados

- Módulo: server/autorização.
- Contratos: identidade, permissões atuais e formato de respostas; avaliar documentação antes da implementação.
- Testes: integração HTTP accounts e regressões relevantes, typecheck, npm test; E2E se tocar fluxo humano.
- Duplicações: DOC-SERVER-003 trata vínculo entre conta e sid; esta proposta trata mudança de permissão/gates após autenticação, com cenário distinto.

## Dependências, riscos e bloqueios

- Dependência: contexto de DOC-SERVER-003 e infraestrutura accounts de DOC-ENG-002.
- Reprodução ainda pendente; confirmar consumidores e política antes de alterar acesso. Não mudar contratos por suposição nem imprimir credenciais.

## Critérios de aceitação

- [ ] Cenário reproduzido e política confirmada com contratos existentes.
- [ ] Comportamento autorizado permitido e acesso indevido recusado, sem mutação parcial.
- [ ] Testes, regressões e documentação atualizados com evidências.

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

### 2026-10-13 21:24 UTC — [Codex] — proposta

- Investigado: leitura limitada durante revisão do fluxo accounts; sem reprodução deste cenário.
- Alterado: proposta registrada para próxima rodada, sem mudança de runtime.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: pendentes nesta proposta.
- Resultado: hipótese/escopo de validação marcado explicitamente como Proposto.
- Próximo passo: descobrir duplicações novamente, assumir e reproduzir antes de implementar.

## Rollback

Nenhuma implementação nesta proposta; registrar cancelamento se a investigação invalidar a hipótese.
