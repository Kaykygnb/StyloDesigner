# HANDOFF — continuidade entre sessões

Resumo geral; tarefa individual e histórico são a fonte de verdade. Protocolo: [TASK-PROTOCOL.md](TASK-PROTOCOL.md) §6 e §10.

## Entrega desta sessão — 2026-10-14 10:08 UTC — [Grok]

Branch `cursor/login-por-usuario-1d56`, commit `68e03e6`. [DOC-SERVER-011](tasks/server/DOC-SERVER-011.md) em validação, 5/5. Login por nome de usuário ou e-mail. E-mail opcional. Migração `0016_nome_de_usuario` gera o usuário e não apaga o e-mail. `STYLO_AUTH=local` não entra mais sem senha. Se a única conta é o usuário técnico sem senha utilizável, o primeiro setup assume o mesmo id. A alpha [DOC-ENG-006](tasks/engineering/DOC-ENG-006.md) continua Proposta: falta o demo e as limitações no README. `GET /api/agent/config` ainda responde sem sessão.

## Referência

- Branch de trabalho: `cursor/canais-persistentes-e5d4`, atualizada sobre `v0.1.0-beta` com as PRs #19, #17 e #18
- Commit da matriz: `aabece8`
- Commit do zip de VIEWER: `d9a7b5a`
- Última atualização: 2026-10-14 09:40 UTC — integração da PR #20

## Entrega desta sessão

[DOC-SERVER-007](tasks/server/DOC-SERVER-007.md) em validação, 5/5, [Grok]. Sessão MCP não troca de agente. SSE, health e presença exigem sessão. Quando a suspensão é permitida, `setSuspended` apaga sessões, revoga agentes ACTIVE e fecha os canais; reativar não devolve a credencial. A trava do principal e a reconfirmação da [DOC-SERVER-006](tasks/server/DOC-SERVER-006.md) ficam: o principal não é suspenso por esta rota, e só ele administra outro OWNER. Documento privado de OWNER da instalação continua fora, na DOC-SERVER-014.

## Entrega atual

[DOC-STUDIO-001](tasks/studio/DOC-STUDIO-001.md) concluída, 5/5. Matriz em `tests/studio-parity.test.js`: callers reais do Studio e do MCP, projetos PGlite equivalentes, comparação por forma (documento, seleção, undo/redo, metadados de `export_site`, trilha `USER`×`AGENT`) e recusa de escrita (escopo `read` e papel `VIEWER`).

Decisão do proprietário em 2026-10-14, aplicada nesta entrega: papel de projeto VIEWER não baixa nem exporta o zip. `export_zip` (caller do painel e do MCP) e os GET `site.zip`/`react.zip` recusam com `Você só pode ler ou comentar este projeto.`, antes de gravar. O agente só de leitura do dono continua na mensagem de scope. COMMENTER segue podendo baixar. `export_site`, `export_html` e `export_tokens` continuam leitura.

[DOC-ENG-005](tasks/engineering/DOC-ENG-005.md) já está em `v0.1.0-beta`: decisões da ADR 0002, inventário vetorial e alpha local. Nenhum runtime nessa entrega.

## Continuidade

- [DOC-SERVER-007](tasks/server/DOC-SERVER-007.md) está em validação, 5/5. As decisões ADM-DEC-05/07/09 já estavam na ADR 0002. A implementação entrou nesta integração, sem abrir documento privado para todo OWNER.
- [DOC-SERVER-006](tasks/server/DOC-SERVER-006.md) está em andamento, 5/6, [Grok]. O principal administra OWNER secundário no runtime. O marco #6 segue bloqueado: códigos offline, emergência e transferência.
- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) continua Em validação 4/5: aceite humano das lacunas GUI/hosted/imagem/stdio feliz.
- [DOC-DB-001](tasks/database/DOC-DB-001.md) continua Em validação 4/5: restore PGlite provado; pg_dump/pg_restore pendente.
- [DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) continua com [Codex], execução exploratória guiada pelo proprietário. A 001 não cobre revisão visual.

## Próxima prioridade

DOC-SERVER-006 permanece aberta no marco #6 (códigos, emergência, transferência). Não escolher o principal por heurística nem ampliar autoridade. A recusa de zip para VIEWER já foi decidida e implementada na 001; não reabrir esse ponto.

## Continuidade e deliberação administrativa

- [DOC-SERVER-005](tasks/server/DOC-SERVER-005.md) concluída 5/5 após aprovação explícita humana beta: OWNER/ADMIN nos PUT atuais, MEMBER/anônimo recusados. Implementação Kimi preservada; ressalvas de políticas/privilégios/credenciais críticas registradas. Não é certificação geral de segurança.
- [DOC-ADMIN-001](tasks/administration/DOC-ADMIN-001.md) concluída 5/5 de preparação documental, com revisão independente, propõe [arquitetura self-hosted](../architecture/instance-administration/README.md) e [ADR 0002](../architecture/adr/0002-self-hosted-administration.md), propostas sem mudança funcional. Referência de código 7055b65. Config autorização 1/1 nesta rodada; bloqueio Host público/Origin HTTPS reproduzido em guard sintético. Na fotografia anterior os riscos OWNER/MCP/SSE/bootstrap/auditoria eram estáticos; nesta rodada somente o cenário OWNER sem projetos foi reproduzido em memória, conforme registro HD abaixo. Os demais permanecem estáticos.
- [DOC-MCP-001](tasks/mcp/DOC-MCP-001.md) continua Em validação 4/5 com Codex: aceite humano de lacunas GUI/hosted/imagem/stdio feliz não foi concedido pela aprovação administrativa.

## Em andamento

[DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md) — [Codex], preparação/insumos; execução exploratória guiada pelo proprietário conforme [WORK-GUIDE.md](../qa/WORK-GUIDE.md). Não ocorreu auditoria visual nesta entrega.

## Registro HD e trabalho retomado

- [ADR0002](../architecture/adr/0002-self-hosted-administration.md) registra 21 HD com autoria humana: conta/senha offline, GUI progressiva, principal protegido/múltiplos OWNERs, delegação/escopos, recuperação e-mail opcional GUI. Mecanismos e contratos abertos separados; tenancy favorece organização única, não aprovação definitiva.
- [DOC-SERVER-006](tasks/server/DOC-SERVER-006.md) assumida Codex,1/5: ADMIN alterou/apagou primeira OWNER sem projetos em memória. Próximo planejamento principal/migração; nenhum patch estrutural autorizado genericamente.
- [DOC-DB-001](tasks/database/DOC-DB-001.md) retomada Codex/restore_resume,4/5 Em validação: restore real PGlite específico5/5; suíte624/624 sem falhas/skips, typecheck/inventário e combinado final5/5 aprovados; PGdump/restore pendente. Não decide backup/chaves finais.
- Novas propostas deduplicadas: [SERVER009](tasks/server/DOC-SERVER-009.md) transição local, [STUDIO006](tasks/studio/DOC-STUDIO-006.md) onboarding progressivo, [SERVER010](tasks/server/DOC-SERVER-010.md) projeto recuperação/e-mail GUI/offline alternativas. Sem implementação integral ou e-mail enviado.

## Próximas prioridades e limites

Continuar planejamento/reprodução P0SERVER006 e investigação SERVER007; avançar restore independente. Não manter projeto aguardando decisões futuras: registrar bloqueio apenas na alteração específica. Questões abertas: tenancy/equipes, poderes sensíveis/acesso excepcional, transferência/recuperação principal, agentes/emvoo, backup/chaves, federação e auditoria/retenção. A PR #19 registrou na ADR 0002 as decisões humanas dessa lista que o proprietário aprovou; este parágrafo histórico não reabre o que a ADR já decidiu.

Perfil local sem senha é legado a migrar com preservação; não removido nesta sessão. Modelo principal não existe ainda; contato institucional não é conta coletiva. Registro revisado independentemente; validador28, links147 e diff aprovados. Só documentos e prova de teste PGlite nesta entrega; nenhum runtime alterado.

## Cuidados

Não testar contra bancos ou dados externos herdados. Novos fixtures usam configuração própria; PostgreSQL usa URL provisionada explicitamente. Conferir remoto e aceitar handoff antes de continuar; não duplicar tarefas nem apagar autores anteriores.

## Registro de produto — 2026-10-14 08:45 UTC — [Grok 4.7]

Branch de trabalho: `cursor/produto-horizontes-alpha-4159`, base `v0.1.0-beta` em `31f16bf`. [DOC-ENG-005](tasks/engineering/DOC-ENG-005.md) concluída: decisões 2.1–2.7, ADM-DEC-05 e ADM-DEC-09 na ADR 0002; prazo de retenção é detalhe técnico e configuração sensível do OWNER principal. ADM-DEC-02 está aprovada; a aplicação é [DOC-SERVER-013](tasks/server/DOC-SERVER-013.md). ADM-DEC-07 e ADM-DEC-08 estão aprovadas: ADMIN não acessa projeto privado; restore e chave mestra ficam com o OWNER ([DOC-SERVER-014](tasks/server/DOC-SERVER-014.md) e DOC-SERVER-013). ADM-DEC-04 está aprovada: `project.share` é separado de write ([DOC-SERVER-015](tasks/server/DOC-SERVER-015.md)). Não resta decisão humana pendente na ADR. Inventário vetorial e alpha local em [EVOLUTION.md](../product/EVOLUTION.md). [DOC-ENG-006](tasks/engineering/DOC-ENG-006.md) é Proposta e espera as PRs #17 e #18 e a DOC-SERVER-011 (login por nome de usuário, bloqueio da alpha). ADM-DEC-01 está aprovada: uma organização por instalação na beta. Multi-tenant não é requisito. EDITOR e COMMENTER saem do papel global e ficam no projeto; a migração sem apagar dados é [DOC-SERVER-012](tasks/server/DOC-SERVER-012.md). DOC-SERVER-006 e DOC-SERVER-007 não foram editados. Nenhum runtime alterado.
