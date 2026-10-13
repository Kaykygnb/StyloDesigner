# DOC-SERVER-004 — Revalidar acesso em workspaces com compartilhamento alterado

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-13 21:24 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

**Proposto — investigação pendente.** workspace guarda o papel no momento de open_project e usa esse valor em chamadas posteriores. É preciso reproduzir downgrade/revogação com a sessão ainda aberta, sem reabrir o projeto.

## Objetivo

Reproduzir mudanças de compartilhamento e validar que leitura/escrita respeitam as permissões atuais, inclusive em workspace ativo.

## Escopo

workspace/index.ts, services/projects.ts, sharing, snapshots, testes HTTP/MCP; preservar nomes e formatos públicos. Fora do escopo: redesenho da autenticação, mudança de schema e dados reais.

## Módulo e contratos afetados

- Módulo: server/autorização.
- Contratos: identidade, permissões atuais e formato de respostas; avaliar documentação antes da implementação.
- Testes: integração HTTP accounts e regressões relevantes, typecheck, npm test; E2E se tocar fluxo humano.
- Duplicações: DOC-SERVER-003 trata vínculo entre conta e sid; esta proposta trata mudança de permissão/gates após autenticação, com cenário distinto.

## Dependências, riscos e bloqueios

- Dependência: contexto de DOC-SERVER-003 e infraestrutura accounts de DOC-ENG-002.
- Sem reprodução executada nesta rodada. Evitar carregar documentos completos apenas para conferir permissão; preservar colaboração e distinguir papel da conta/projeto.

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
