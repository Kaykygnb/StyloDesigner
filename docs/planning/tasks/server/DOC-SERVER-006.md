# DOC-SERVER-006 — Validar autoridade contextual e proteção de OWNER

Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-14 03:37 UTC
Última atualização: 2026-10-14 03:37 UTC
Progresso: 1/5 marcos (20%)
Participantes: [Codex], [identity_conflicts]

## Problema e evidências

- Problema: ADM-RISK-01 reproduzido em PGlite memória/Hono: ADMIN resetou/suspendeu/rebaixou/apagou primeira OWNER sem projetos, zero OWNERs humanos; risco05 write/share permanece comportamento amplo. Ver script/evidência no inventário.
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

- [ ] Principal distinguido e protegido conforme HD-OWNERSHIP-02, sem confundir OWNER adicional; concessão OWNER exclusiva do principal conforme HD-OWNERSHIP-03. Modelo/migração revisados antes de alterar runtime.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: handoff/docs/backlog lidos; investigação delegada identity_conflicts confirmou alvos OWNER; reprodução Hono/PGlite memória, sem rede ou dados externos. Nenhum principal persistido atual.
- Arquivos alterados: esta tarefa, CURRENT-STATE e ADR/plano de identidade; sem runtime.
- Evidências: script/stdout/limites no inventário; ADMIN reset200/suspend200/demote200/delete200; zero OWNER humanos no caso sem projetos. HD-OWNERSHIP-02/03 definidos, modelo/migração precisa projeto.
- Testes executados: reprodução sintética com close finally, exit0; não gate que celebra falha. Referências de linha verificadas, não estimadas.
- Problemas encontrados: proteger principal exige distingui-lo; não corrigir por heurística primeirotimestamp/UUID nem bloquear todo OWNER em nome de decisão humana diferente. Reset/transferência/matriz completa não decididos.

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

### 2026-10-14 03:34 UTC — [Codex] — reconciliação com diretrizes humanas

- Investigado: novo registro humano na ADR 0002, handoffs e dependências.
- Alterado: escopo esclarecido por HD: HD-OWNERSHIP-01..05, HD-ADMIN-01..04: principal protegido e somente principal concede OWNER; múltiplos OWNERs aprovados. Modelo/transferência/reset/matriz sensível e compartilhamento concretos abertos. Não inferir autorização de implementação integral.
- Arquivos: esta tarefa e documentos administrativos relacionados.
- Testes: investigação/provas em recurso sintético conforme CURRENT-STATE; nenhum gate estrutural inventado.
- Resultado: investigação/desenho autorizados podem prosseguir, sem esperar deliberação geral. Autor/responsável e histórico preservados.
- Próximo passo: assumir etapa específica conforme protocolo; registrar bloqueio apenas de mudança que precisa decisão ainda aberta.

### 2026-10-14 03:37 UTC — [Codex] — assunção e marco #1 retomados por criticidade

- Investigado: histórico/handoff, HD e achado reproduzido pelo agente em fixture própria; remoto base50a8d00 sem avanço na consulta.
- Alterado: responsável Codex, 1/5 investigação concluída. Janela: taskSERVER006 e docs autoridade; nenhuma alteração runtime. Requisitos principal definidos não autorizam migrar banco real.
- Arquivos: esta tarefa, inventário, ADR/plano e índice.
- Testes: ADMIN reset/suspensão/rebaixamento/exclusão da primeira OWNER sem projetos reproduzidos; sem rede/URL herdada. Segurança produção/concorrência não testadas.
- Resultado: investigação técnica P0 retomada; próxima etapa modelo/invariantes/migração. DB001 segue independente em paralelo.
- Próximo passo: planejar representação principal/upgrade seguro e regressões antes de implementar; separar questões abertas de poderes adicionais e compartilhar por agentes.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo revisor técnico]
Estado: Investigação concluída; planejamento técnico
Marco atual: #2 — Planejamento
Última atualização: 2026-10-14 03:37 UTC
Commit de referência: `50a8d00d006316175667397ac433ad4b6403832f`

### Estado atual

1/5 investigação concluída. Primeiro OWNER sintético sem projetos foi resetado/suspenso/rebaixado/excluído por ADMIN; principal inexiste no runtime. Requisitos HD registrados, sem patch estrutural.

### Decisões tomadas

Só humano definiu principal protegido e concessão exclusiva; modelo/migração e poderes sensíveis restantes não inferidos. Retomar investigação/testes e DB001, não aguardar nova rodada para engenharia independente.

### Arquivos envolvidos

ADR0002, CURRENT-STATE e IDENTITY-ONBOARDING-RECOVERY, esta tarefa. Script portátil no inventário; nada de segredo real.

### Evidências e testes

Reprodução isolada Hono/PGlite memória, exit0, close finally; status200/bools/count apenas. Não prova OWNER com projetos, corrida ou exploração de rede.

### Pendências

Modelo principal/migração/review, regressões negativas e implementação autorizada específica. Matrix completa e transferência excepcional ainda abertas.

### Próximas ações recomendadas

Desenhar invariantes de principal e upgrade não destrutivo; ensaiar em fixture; revisar alcance da proteção versus OWNERs adicionais; implementar só recorte autorizado e comprovado.

### Riscos e cuidados

Não remover owner técnico; cascade/slug collisions/grants/chaves exigem migração. Não escolher principal por heurística arbitrária.

### Condições para conclusão

Critérios específicos cumpridos com projeto/review e gates reais, sem cobrir lacunas pela aprovação beta config.

## Rollback

Descreva como desfazer a mudança sem apagar evidências.
