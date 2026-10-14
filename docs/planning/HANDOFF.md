# HANDOFF — continuidade entre sessões

Resumo geral; tarefa individual e histórico são a fonte de verdade. Protocolo: [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §6 e §10.

## Referência

- Branch: `v0.1.0-beta`
- Commit de referência: `50a8d00d006316175667397ac433ad4b6403832f`
- Última atualização: 2026-10-14 03:42 UTC — [Codex]

## Entrega atual

[DOC-ENG-004](tasks/engineering/DOC-ENG-004.md) concluída, 5/5: 13 fixtures legados com ambiente isolado e cleanup ordenado; teste de servidor usa configuração temporária. Específicos hostis sem setup 10/10; suíte 622/622, zero falhas/skips, incluindo PostgreSQL real e Studio UI automatizado. Typecheck, inventário e validador (20 tarefas) aprovados. Sem mudança funcional ou QA exploratório. Implementação publicada em f8f8141; CI remota ainda não consultada.

## Continuidade e deliberação administrativa

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) concluída 5/5 após aprovação explícita humana beta: OWNER/ADMIN nos PUT atuais, MEMBER/anônimo recusados. Implementação Kimi preservada; ressalvas de políticas/privilégios/credenciais críticas registradas. Não é certificação geral de segurança.
- [DOC-ADMIN-001](tasks/administration/DOC-ADMIN-001.md) concluída 5/5 de preparação documental, com revisão independente, propõe [arquitetura self-hosted](../architecture/instance-administration/README.md) e [ADR 0002](../architecture/adr/0002-self-hosted-administration.md), propostas sem mudança funcional. Referência de código 7055b65. Config autorização 1/1 nesta rodada; bloqueio Host público/Origin HTTPS reproduzido em guard sintético. Na fotografia anterior os riscos OWNER/MCP/SSE/bootstrap/auditoria eram estáticos; nesta rodada somente o cenário OWNER sem projetos foi reproduzido em memória, conforme registro HD abaixo. Os demais permanecem estáticos.
- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) continua Em validação 4/5 com Codex: aceite humano de lacunas GUI/hosted/imagem/stdio feliz não foi concedido pela aprovação administrativa.

## Diretrizes humanas de 2026-10-14 (rodada 2) — [Claude Code]

Registradas sem alterar código, na branch `metaClaude` (base `48b11e1`): decisões aprovadas e **ADM-DEC-02 pendente** em [ADR 0002](../architecture/adr/0002-self-hosted-administration.md#registro-de-decisões-humanas--rodada-2-diretrizes-de-governança-2026-10-14); visão em [VISION](../product/VISION.md); investigação, licenças, arquitetura e horizontes A/B/C em [EVOLUCAO.md](../architecture/EVOLUCAO.md); novas propostas DOC-CORE-003..006. Mudanças que afetam tarefas em andamento: recuperação do OWNER principal usa **códigos offline** (DOC-SERVER-010, antes só alternativa); ADM-DEC-03 e ADM-DEC-05 aprovadas (DOC-SERVER-006/007); proibido modo pessoal sem conta (DOC-SERVER-009). Os responsáveis dessas tarefas devem ler a ADR antes de continuar. Não foi implementado nada.

## Em andamento

[DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], preparação/insumos; execução exploratória guiada pelo proprietário conforme [WORK-GUIDE.md](../qa/WORK-GUIDE.md). Não ocorreu auditoria visual nesta entrega.

## Registro HD e trabalho retomado

- [ADR0002](../architecture/adr/0002-self-hosted-administration.md) registra 21 HD com autoria humana: conta/senha offline, GUI progressiva, principal protegido/múltiplos OWNERs, delegação/escopos, recuperação e-mail opcional GUI. Mecanismos e contratos abertos separados; tenancy favorece organização única, não aprovação definitiva.
- [DOC-SERVER-006](tasks/server/DOC-SERVER-006.md) assumida Codex,1/5: ADMIN alterou/apagou primeira OWNER sem projetos em memória. Próximo planejamento principal/migração; nenhum patch estrutural autorizado genericamente.
- [DOC-DB-001](tasks/database/DOC-DB-001.md) retomada Codex/restore_resume,4/5 Em validação: restore real PGlite específico5/5; suíte624/624 sem falhas/skips, typecheck/inventário e combinado final5/5 aprovados; PGdump/restore pendente. Não decide backup/chaves finais.
- Novas propostas deduplicadas: [SERVER009](tasks/server/DOC-SERVER-009.md) transição local, [STUDIO006](tasks/studio/DOC-STUDIO-006.md) onboarding progressivo, [SERVER010](tasks/server/DOC-SERVER-010.md) projeto recuperação/e-mail GUI/offline alternativas. Sem implementação integral ou e-mail enviado.

## Próximas prioridades e limites

Continuar planejamento/reprodução P0SERVER006 e investigação SERVER007; avançar restore independente. Não manter projeto aguardando decisões futuras: registrar bloqueio apenas na alteração específica. Questões abertas: tenancy/equipes, poderes sensíveis/acesso excepcional, transferência/recuperação principal, agentes/emvoo, backup/chaves, federação e auditoria/retenção.

Perfil local sem senha é legado a migrar com preservação; não removido nesta sessão. Modelo principal não existe ainda; contato institucional não é conta coletiva. Registro revisado independentemente; validador28, links147 e diff aprovados. Só documentos e prova de teste PGlite nesta entrega; nenhum runtime alterado.

## Cuidados

Não testar contra bancos/dados externos herdados. Novos fixtures usam configuração própria; PostgreSQL usa URL provisionada explicitamente. Conferir remoto e aceitar handoff antes de continuar; não duplicar tarefas nem apagar autores anteriores.
