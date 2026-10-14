# DOC-ADMIN-002 — Completar trilha de auditoria administrativa sensível

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:55 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: ADM-RISK-07: Operation/AuthEvent atuais não formam trilha de mudanças de privilégios, política, chaves, reset e restore.
- Evidências observadas: docs/architecture/instance-administration/CURRENT-STATE.md; referências de código/testes e níveis de evidência preservados.
- Atualização 2026-10-14: ADM-DEC-09 está aprovada na ADR 0002. O prazo não é mais decisão humana: auditoria 365 dias, diagnóstico 30, evento gravado 7. ADM-DEC-02 classifica a mudança desse prazo como configuração sensível do OWNER principal. ADMIN não altera. ADM-DEC-08 também está aprovada: restaurar backup e trocar ou rotacionar a chave mestra são ações do OWNER, com autenticação reforçada e auditoria. Esta tarefa continua Proposta e não implementa isso. Esses eventos entram no inventário.

## Objetivo

Entregar o escopo com evidências e gates proporcionais; aprovação de mudança de autoridade antes da implementação, não inferida de DOC-SERVER-005.

## Escopo

- Incluído: Inventariar eventos existentes, definir ator/alvo/ação/resultado/correlação sem segredos; atomicidade/recusas/retencao após aprovação; reutilizar persistência e painel atuais.
- Fora do escopo: Não prometer inviolabilidade da VPS ou armazenar tokens/senhas/documentos na trilha; não recriar logs de design.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: administration; prioridade P1.
- Módulos relacionados: servidor, Studio, banco e agentes, por contratos atuais.
- Contratos/interfaces: identidade/autoridade contextual; sem mudanças nesta proposta.
- Testes relacionados: config-autorizacao, contas, MCP-contas, workspace, E2E accounts; validador documental. Só rodar os pertinentes ao escopo implementado.

## Dependências, riscos e bloqueios

- Dependências: DOC-ADMIN-001; ADM-DEC-09; DOC-SERVER-006/008 e DOC-DB-001 relacionados, não bloquear investigação inicial.
- Riscos: confundir risco estático com exploração; ampliar autoridade ou perder dados; duplicar sistema existente.
- Bloqueios: decisões humanas indicadas para mudar contrato; investigação sintética/documentação pode preceder aprovação.

## Critérios de aceitação

- [ ] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação.
- [ ] Política necessária aprovada antes de implementação; testes/gates e handoff coerentes com resultados reais.

- [ ] Ações sensíveis inventariadas: role/reset/suspensão/revogação, scopes/tokens/grants, políticas/credenciais e restore; evento esperado por ação e recusa definido.
- [ ] Evento inclui ator/tipo, alvo, ação, data, resultado e correlação; testes confirmam ausência de token/senha/chave/documento.
- [ ] Semântica de falha de auditoria e atomicidade exercitada. Retenção segue o padrão técnico da ADR 0002 (não pedir outro prazo ao proprietário). Consulta e exportação só para quem está autenticado e autorizado. Sem prometer inviolabilidade da VPS.

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

### 2026-10-14 08:55 UTC — [Grok 4.7] — ADM-DEC-08 aprovada

- Investigado: restore e rotação da chave mestra ficaram com o OWNER.
- Alterado: a nota do problema. Tarefa continua Proposta.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: essas duas ações entram no inventário, com auditoria. ADMIN não as executa.
- Próximo passo: assumir só quando for implementar a trilha.

### 2026-10-14 08:50 UTC — [Grok 4.7] — ADM-DEC-02 aprovada

- Investigado: a seção 4 das diretrizes, agora aprovada. O prazo de retenção é política crítica, não configuração operacional.
- Alterado: a nota do problema. Tarefa continua Proposta.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: mudar o prazo fica no inventário como ação do OWNER principal. ADMIN não altera.
- Próximo passo: assumir só quando for implementar a trilha.

### 2026-10-14 08:45 UTC — [Grok 4.7] — nota de decisão

- Investigado: ADM-DEC-09 aprovada na ADR 0002, com prazo técnico.
- Alterado: problema e critério de retenção. Tarefa continua Proposta, sem responsável novo.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: o próximo agente não espera um prazo humano.
- Próximo passo: assumir só quando for implementar a trilha.

### 2026-10-14 02:39 UTC — [Codex] — proposta após investigação e deduplicação

- Investigado: backlog e inventário administrativo, investigações independentes e ADR 0002.
- Alterado: nenhum código.
- Arquivos: este documento.
- Testes: ainda não executados.
- Resultado: Proposta registrada; nenhuma autorização estrutural inferida.
- Próximo passo: consultar decisões pendentes e assumir conforme protocolo; reproduzir em ambiente descartável antes de implementar.

### 2026-10-14 03:34 UTC — [Codex] — reconciliação com diretrizes humanas

- Investigado: novo registro humano na ADR 0002, handoffs e dependências.
- Alterado: escopo esclarecido por HD: Registro HD define necessidades, mas contrato completo de auditoria/retenção continua aberto. Investigar eventos/segredos sem alterar autoridade. Não inferir autorização de implementação integral.
- Arquivos: esta tarefa e documentos administrativos relacionados.
- Testes: investigação/provas em recurso sintético conforme CURRENT-STATE; nenhum gate estrutural inventado.
- Resultado: investigação/desenho autorizados podem prosseguir, sem esperar deliberação geral. Autor/responsável e histórico preservados.
- Próximo passo: assumir etapa específica conforme protocolo; registrar bloqueio apenas de mudança que precisa decisão ainda aberta.

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
