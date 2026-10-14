# Roadmap incremental — proposto

Priorizar segurança/recuperação e tarefas existentes. Concluir documentação não autoriza automaticamente implementação de política ou exposição pública.

| Etapa | Resultado e gate | Reutilização/dependência |
|---|---|---|
| 0 — Deliberação | Aprovação beta DOC-SERVER-005 registrada; arquitetura/ADR proposta, decisões humanas explícitas | DOC-ADMIN-001; revisão independente e validador |
| 1 — Limites críticos de autoridade | Reproduções descartáveis de ADMIN/OWNER, sessão de agente e canal SSE; matriz aprovada, negativas sem mutação/autoelevação; nenhuma execução contra dados reais | DOC-SERVER-006 e DOC-SERVER-007; reutilizar identity/agents/workspace e testes contas/MCP; não duplicar DOC-MCP-001 (compatibilidade) |
| 2 — Implantação pública controlada | Hosts/origem externa/proxy/cookie definidos; bootstrap seguro; HTTP local continua; testes CSRF/rebinding/HTTPS negativos e positivos; runbook do operador | DOC-SERVER-008, depende decisões ADM-DEC-06 e autoridade sensível; não desligar guards |
| 3 — Auditoria e recuperação para piloto | Eventos administrativos rastreáveis sem segredos; DB/blobs/config/chave recuperáveis por procedimento testado; operador comprova round-trip antes de oferecer restore | DOC-ADMIN-002 + **DOC-DB-001 existente**; DOC-SERVER-001/002 bases concluídas |
| 4 — Administração cotidiana compreensível | Melhorar painel existente, estados por seção, confirmação de impacto, acesso por capacidade e orientação sem JSON nas operações comuns | DOC-STUDIO-001/003 e QA-JRN-012; DOC-STUDIO-005 para estética, sem misturar com segurança |
| 5 — Evolução conforme necessidade | Convites com validade, recuperação fora de banda guiada, rotação de chave/versionamento, quotas/telemetria ou allowlist de ferramentas se demanda comprovar | Abrir tarefas específicas só após decisões e deduplicação; não requisitos compulsórios de beta |
| Futuro — Multi-organização | Não é requisito da beta. ADM-DEC-01 aprovou uma organização por instalação | Nova decisão humana e nova ADR antes de qualquer multi-tenant |

## Critério de MVP self-hosted empresarial

Uma instância operacionalmente única; OWNER/ADMIN fazem administração comum pela GUI existente; acesso/grants/documentos respeitam matriz aprovada. Antes de recomendar VPS pública: prova de autoridade/sessões, bootstrap restrito, domínio/HTTPS compatível sem enfraquecer guards, diagnóstico sem segredos, backup/restauração verificados e instruções claras do que depende de operador. Estes gates **não estão todos atendidos hoje**.

A beta pode continuar em ambiente individual/rede privada controlada enquanto as lacunas de exposição pública são deliberadas. Isso não constitui validação universal de segurança desse ambiente.

## Tarefas propostas após deduplicação

- **DOC-SERVER-006 (P0):** autoridade contextual — alvo OWNER, último acesso administrativo, delegação de compartilhamento por agentes. DOC-SERVER-005 protege somente dois PUT de configuração; DOC-SERVER-004 revalida membership, não resolve hierarquia/delegação.
- **DOC-SERVER-007 (P0):** vínculo de identidade e revogação de canais persistentes MCP/SSE — sem novo transporte MCP, com ACL para notificações. DOC-MCP-001 testa compatibilidade; esta proposta testa autoridade durante lifecycle.
- **DOC-SERVER-008 (P1, gate para VPS pública):** origem/hosts/proxy/cookie/bootstrap e runbook. DOC-ENG-002 isola E2E, não publica a instância com domínio; não presumir que proxy basta.
- **DOC-ADMIN-002 (P1):** trilha administrativa sensível sobre infraestrutura existente; Operation/AuthEvent atuais não cobrem toda mudança administrativa.

Estado atualizado: SERVER006 assumida por Codex, investigação1/5; SERVER007/008 e ADMIN002 seguem propostas não assumidas. Nenhuma dessas políticas estruturais foi implementada. Os riscos críticos podem ser investigados em recursos descartáveis; mudanças de contrato dependem da decisão correspondente. Não reservar todas as tarefas simultaneamente.

## Não duplicar

DOC-DB-001 recebe definição de conjunto restaurável e gates por referência, preservando estado/responsável; nenhuma nova task de restore. DOC-STUDIO-003 recebe riscos de UX como insumo, sem declarar exploração feita. DOC-STUDIO-005 não vira autorização para reconstruir administração. DOC-PLUGIN-001 continua providers/licenças, não cofre/segurança da instância. Aprovação DOC-SERVER-005 não fecha DOC-MCP-001 nem aprova as lacunas de clientes hosted.

## Gate de continuidade

Próximo agente lê inventário, ADR/matriz, backlog e handoff; registra aceite/assunção; reproduz hipótese específica antes de corrigir. Evidência liga `ADM-RISK → ADM-DEC → DOC → commit → teste/reteste`. Sugestão UX só gera tarefa obrigatória após triagem de impacto, duplicação e aprovação de escopo.

## Retomada após registro HD

A rodada humana foi encerrada por enquanto; não esperar nova resposta para investigação/testes e tarefas independentes autorizadas. Rastreabilidade completa na ADR e no plano de identidade/onboarding/recuperação.

1. DOC-SERVER-006: investigar/provar proteção OWNER e desenho de principal conforme HD-OWNERSHIP-02/03; poder de reset/transferência e matriz restante não escolhidos.
2. DOC-DB-001 retomada: prova PGlite real e migração em dados sintéticos; não escolhe estratégia final de produção/chaves. PostgreSQL restore separado da validação de persistência SERVER001.
3. DOC-SERVER-009: projeto de transição do acesso local, ownership/agents/chaves e rollback; sem remover paths nesta rodada.
4. DOC-STUDIO-006: planejamento de onboarding progressivo GUI reaproveitando telas, sem departamentos obrigatórios ou nova identidade.
5. DOC-SERVER-010: projetar recuperação/e-mail GUI, autenticação real de provedores e alternativas offline; sem envio de e-mail, implantação SMTP ou login federado nesta retomada.

SERVER007/008/ADMIN002 permanecem escopos existentes; atualizações HD desbloqueiam investigação, não implementação integral. Questão futura bloqueia somente ação específica; seguir trabalho independente com handoff.
