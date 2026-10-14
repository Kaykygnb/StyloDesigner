# DOC-SERVER-012 — Papéis de projeto separados da instalação

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:45 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: EDITOR e COMMENTER ainda são papéis globais da conta. A hierarquia aprovada da instalação é OWNER, ADMIN, MEMBER e VIEWER. Editar, comentar e só ver são permissões do projeto.
- Evidências observadas: enum `Role` em `packages/db/prisma/schema.prisma` inclui EDITOR e COMMENTER. O painel oferece esses valores em `apps/studio/src/screens/WorkspacePanel.tsx`. O acesso ao documento não usa esse papel global: `apps/server/src/services/projects.ts` olha dono ou `ProjectMember`. Decisão técnica delegada na ADR 0002, seção 2.4.

## Objetivo

A conta deixa de ter EDITOR ou COMMENTER global. Quem já tem esse valor vira MEMBER e não perde projeto, sessão nem vínculo. Permissão de projeto continua EDITOR, COMMENTER ou VIEWER.

## Escopo

- Migrar `User.role` EDITOR e COMMENTER para MEMBER.
- Manter `ownerId` e as linhas `ProjectMember` como estão. Não criar membro em projeto que a pessoa não acessa.
- Tirar EDITOR e COMMENTER do enum global, da API de conta e do seletor do painel, depois dos dados migrados.
- Teste: conta antiga EDITOR continua dona do próprio projeto e membro onde já era; não ganha projeto alheio; conta e sessão não somem.

## Fora de escopo

- Apagar usuário, projeto ou vínculo para “limpar” o papel.
- Dar a um EDITOR global antigo acesso a todos os projetos da instalação.
- Fundir VIEWER da instalação com VIEWER do projeto.
- Aplicar a ADM-DEC-02 (DOC-SERVER-013) ou o acesso de OWNER a projeto privado (DOC-SERVER-014). ADM-DEC-07 está aprovada: ADMIN não tem essa exceção.

## Critérios de aceitação

- [ ] Nenhuma linha de `User`, `Project` ou `ProjectMember` é apagada por causa desta troca.
- [ ] Conta que era EDITOR ou COMMENTER global fica MEMBER e entra com a mesma sessão válida.
- [ ] Projeto que ela possui continua com o mesmo `ownerId`.
- [ ] Membro de projeto mantém o `ProjectRole` anterior. Projeto sem vínculo continua sem vínculo.
- [ ] Criar ou editar conta não aceita mais EDITOR nem COMMENTER como papel da instalação. O compartilhamento do projeto continua aceitando esses níveis.

## Plano de execução

1. Contar contas EDITOR e COMMENTER e os vínculos delas antes de escrever.
2. Atualizar o papel global para MEMBER na mesma transação que registra a auditoria da troca.
3. Trocar o enum global sem apagar a tabela. Em PostgreSQL, criar o tipo novo e alterar a coluna.
4. Ajustar API, tipos e o seletor do painel.
5. Teste de migração com conta EDITOR dona de um projeto e membro COMMENTER de outro.

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

## Dependências e bloqueios

- Depende da ADR 0002, seção 2.4.
- Não bloqueia o primeiro desenho da alpha (DOC-ENG-006). O painel de pessoas da alpha ainda mostra a lista antiga até esta tarefa.

## Artefatos esperados

- Migração Prisma e teste.
- Painel sem EDITOR/COMMENTER globais.
- Atualização da matriz em `docs/architecture/instance-administration/PERMISSIONS.md` quando o código passar a cumprir a seção 2.4.

## Histórico de trabalho

### 2026-10-14 08:45 UTC — [Grok 4.7] — criação

- Investigado: enum `Role`, painel de pessoas e `projects.ts`. O papel global EDITOR não abre projeto alheio.
- Alterado: nenhum código.
- Arquivos: este documento, backlog, ADR 0002, PERMISSIONS.md.
- Testes: validador de tarefas nesta entrega.
- Resultado: Proposta. Não bloqueia o primeiro desenho da alpha.
- Próximo passo: assumir e migrar em banco descartável. Não apagar linhas.

## Rollback

Reverter a migração numa cópia, não em banco de alguém. Enquanto a troca do enum não for aceita, a conta antiga precisa continuar recuperável com o mesmo `ownerId` e os mesmos vínculos.
