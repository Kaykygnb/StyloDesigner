# DOC-SERVER-008 — Preparar exposição pública e bootstrap seguro da instância

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 02:39 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: ADM-RISK-03 reproduzido sinteticamente: domínio público/Origin HTTPS recusados; bootstrap/cookie/health têm riscos estáticos ADM-RISK-04/07.
- Evidências observadas: docs/architecture/instance-administration/CURRENT-STATE.md; referências de código/testes e níveis de evidência preservados.

## Objetivo

Entregar o escopo com evidências e gates proporcionais; aprovação de mudança de autoridade antes da implementação, não inferida de DOC-SERVER-005.

## Escopo

- Incluído: Definir hosts/origem externa/proxy confiável, cookie HTTPS preservando local, setup único controlado e health mínimo; runbook de operador e regressões CSRF/rebinding/primeiro acesso em recursos descartáveis.
- Fora do escopo: Não controlar SO/firewall/VPS, desligar guards ou publicar instância sem decisão e configuração explícitas.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P1.
- Módulos relacionados: servidor, Studio, banco e agentes, por contratos atuais.
- Contratos/interfaces: identidade/autoridade contextual; sem mudanças nesta proposta.
- Testes relacionados: config-autorizacao, contas, MCP-contas, workspace, E2E accounts; validador documental. Só rodar os pertinentes ao escopo implementado.

## Dependências, riscos e bloqueios

- Dependências: DOC-ADMIN-001; autoridade DOC-SERVER-006/007 para piloto; ADM-DEC-06/09. Não duplicar isolamento E2E DOC-ENG-002.
- Riscos: confundir risco estático com exploração; ampliar autoridade ou perder dados; duplicar sistema existente.
- Bloqueios: decisões humanas indicadas para mudar contrato; investigação sintética/documentação pode preceder aprovação.

## Critérios de aceitação

- [ ] Evidências específicas reproduzíveis ou limites explícitos, sem dados reais; escopo sem duplicação.
- [ ] Política necessária aprovada antes de implementação; testes/gates e handoff coerentes com resultados reais.

- [ ] Domínio HTTPS aprovado funciona só com hosts/origens/proxy confiáveis explícitos; origem/host maliciosos e cabeçalhos encaminhados não confiáveis permanecem recusados.
- [ ] HTTP local e modo accounts preservados; cookie Secure no perfil HTTPS e regressões CSRF/rebinding aprovadas.
- [ ] Bootstrap controlado de uso único testado concorrente, sem apropriação por visitante alheio; recuperação/prerrequisitos do operador definidos pelo humano.
- [ ] Health público não expõe erro interno/segredo; diagnóstico detalhado exige autorização; runbook distingue Stylo de TLS/SO/firewall/VPS.

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
