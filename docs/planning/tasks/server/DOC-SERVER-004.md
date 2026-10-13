# DOC-SERVER-004 — Revalidar acesso em workspaces com compartilhamento alterado

Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-13 22:42 UTC
Última atualização: 2026-10-13 22:42 UTC
Progresso: 0/5 marcos (0%)
Participantes: [Codex]

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
- Estado: em andamento
- Responsável: [Codex]
- Atividades executadas: Leitura inicial confirmou papel armazenado em current/need e snapshot síncrono sem consulta de acesso atual. Isso sustenta a hipótese, mas downgrade/revogação ainda precisam ser reproduzidos em HTTP/MCP.
- Arquivos alterados: —
- Evidências: `apps/server/src/workspace/index.ts` guarda papel ao abrir; `routes/studio.ts` consulta snapshot sem revalidar compartilhamento. Leitura estática, não reprodução.
- Testes executados: nenhum de runtime nesta assunção; reprodução pendente.
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

### 2026-10-13 22:42 UTC — [Codex] — assunção e #1 Investigação

- Investigado: protocolo atualizado, handoff geral, backlog e código em `48b914a`; Leitura inicial confirmou papel armazenado em current/need e snapshot síncrono sem consulta de acesso atual. Isso sustenta a hipótese, mas downgrade/revogação ainda precisam ser reproduzidos em HTTP/MCP.
- Alterado: responsável, estado e marco #1; janela de trabalho declarada nesta tarefa.
- Arquivos: este documento, BACKLOG.md e HANDOFF.md; nenhum código alterado nesta assunção.
- Testes: validador documental antes da publicação; gates de runtime da sessão Kimi não foram reexecutados nesta etapa.
- Resultado: tarefa assumida após atualização por fast-forward; DOC-SERVER-005 permanece com [Kimi] em validação humana.
- Próximo passo: Reproduzir downgrade e revogação com workspace aberto; examinar também gates de agentes, plugins e snapshot antes de definir a correção.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante após transferência]
Estado: Em execução — investigação pendente
Marco atual: #1 — Investigação
Última atualização: 2026-10-13 22:42 UTC
Commit de referência: `48b914a5315bca4892d3f8dddf594dc13b6b98c1` na branch `v0.1.0-beta`

### Estado atual

Leitura inicial confirmou papel armazenado em current/need e snapshot síncrono sem consulta de acesso atual. Isso sustenta a hipótese, mas downgrade/revogação ainda precisam ser reproduzidos em HTTP/MCP.

### Decisões tomadas

Trabalhar na beta atual sem modificar a tarefa de Kimi; priorizar DOC-SERVER-004 (P0) antes da revisão visual P1. Assunção publicada para informar outros participantes antes de mudanças de código. Sem alegar lock técnico ou coordenação por mensagem.

### Arquivos envolvidos

Este documento, BACKLOG.md e HANDOFF.md. Consultar o escopo para os arquivos de implementação; ainda não alterados.

### Evidências e testes

Branch atualizada por fast-forward; tarefa sem responsável no backlog. Nenhuma reprodução nova ou teste de runtime nesta assunção. Validador documental exigido antes da publicação.

### Pendências

Marcos #1–#5; reproduções, implementação quando justificada e gates. As evidências anteriores de outras tarefas não encerram esta tarefa.

### Próximas ações recomendadas

Reproduzir downgrade e revogação com workspace aberto; examinar também gates de agentes, plugins e snapshot antes de definir a correção.

### Riscos e cuidados

Consultar o remoto antes de publicar e interromper sobreposição de arquivos se outro participante assumir escopo relacionado. Preservar mudanças e revisão humana pendente de DOC-SERVER-005; nenhum segredo em evidências.

### Condições para conclusão

Critérios de aceitação desta tarefa atendidos, marcos com evidências e gates proporcionais aprovados; backlog e handoff atualizados.

## Rollback

Nenhuma implementação nesta proposta; registrar cancelamento se a investigação invalidar a hipótese.
