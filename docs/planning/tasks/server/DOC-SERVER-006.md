# DOC-SERVER-006 — Validar autoridade contextual e proteção de OWNER

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 02:39 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: Achados estáticos ADM-RISK-01/05: ADMIN alcança OWNER existente; write de agente delega compartilhamento. Não reproduzidos nesta auditoria.
- Evidências observadas: docs/architecture/instance-administration/CURRENT-STATE.md; referências de código/testes e níveis de evidência preservados.

## Objetivo

Entregar o escopo com evidências e gates proporcionais; aprovação de mudança de autoridade antes da implementação, não inferida de DOC-SERVER-005.

## Escopo

- Incluído: Reproduzir alvos OWNER/ADMIN/último OWNER e delegação por fixtures; definir/aplicar apenas política aprovada com regressões de negativa sem mutação e compatibilidade de scopes.
- Fora do escopo: Não presumir aprovação da arquitetura definitiva, singleton OWNER ou mudança automática de write/share.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P0.
- Módulos relacionados: servidor, Studio, banco e agentes, por contratos atuais.
- Contratos/interfaces: identidade/autoridade contextual; sem mudanças nesta proposta.
- Testes relacionados: config-autorizacao, contas, MCP-contas, workspace, E2E accounts; validador documental. Só rodar os pertinentes ao escopo implementado.

## Dependências, riscos e bloqueios

- Dependências: DOC-ADMIN-001, DOC-SERVER-005; decisões ADM-DEC-02/03/04/07. DOC-SERVER-004 não cobre hierarquia.
- Riscos: confundir risco estático com exploração; ampliar autoridade ou perder dados; duplicar sistema existente.
- Bloqueios: decisões humanas indicadas para mudar contrato; investigação sintética/documentação pode preceder aprovação.

## Critérios de aceitação

- [ ] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação.
- [ ] Política necessária aprovada antes de implementação; testes/gates e handoff coerentes com resultados reais.

- [ ] Matriz ator/alvo inclui OWNER, ADMIN, conta comum, múltiplos OWNER e último OWNER ativo; reset/suspensão/rebaixamento/revogação têm expectativas aprovadas.
- [ ] Negativas não mutam papel/senha/status/sessões; regressões positivas mantêm administração comum e modo local.
- [ ] Delegação de compartilhamento por agente respeita teto aprovado; comportamento write/share atual não muda antes do aceite/plano compatível.

## Marcos

### #1 — Investigação

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #2 — Planejamento

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #3 — Implementação

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #4 — Testes

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #5 — Validação final

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

## Histórico de trabalho

### 2026-10-14 02:39 UTC — [Codex] — proposta após investigação e deduplicação

- Investigado: backlog e inventário administrativo, investigações independentes e ADR 0002.
- Alterado: nenhum código.
- Arquivos: este documento.
- Testes: ainda não executados.
- Resultado: Proposta registrada; nenhuma autorização estrutural inferida.
- Próximo passo: consultar decisões pendentes e assumir conforme protocolo; reproduzir em ambiente descartável antes de implementar.

## Handoff atual

<!-- Opcional enquanto a tarefa estiver Proposta/Pronta. Obrigatório ao transferir,
encerrar sessão com pendências, entregar para revisão ou ficar Bloqueada/Em validação.
Veja TASK-PROTOCOL.md §10. -->

Preparado por: [Ninguém]
Destinatário: —
Estado: —
Marco atual: —
Última atualização: —
Commit de referência: —

### Estado atual

### Decisões tomadas

### Arquivos envolvidos

### Evidências e testes

### Pendências

### Próximas ações recomendadas

### Riscos e cuidados

### Condições para conclusão

## Rollback

Descreva como desfazer a mudança sem apagar evidências.
