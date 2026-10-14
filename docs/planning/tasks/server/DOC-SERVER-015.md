# DOC-SERVER-015 — Separar compartilhar de editar

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 09:00 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: editar (write) ainda libera o agente a compartilhar. A decisão aprovada separa as duas coisas.
- Evidências observadas: `share_project` e `unshare_project` pedem `write` em `apps/server/src/workspace/index.ts`. Os scopes do agente são `read`, `comment`, `write` e `export` em `apps/server/src/services/agents.ts`. Para pessoa, só o dono compartilha (`apps/server/src/services/sharing.ts`). ADM-DEC-04 na ADR 0002.

## Objetivo

`project.share` é um scope próprio. Quem só edita não convida e não compartilha. Quem já compartilha por ter `write` não perde isso na migração.

## Escopo

- Criar o scope `project.share`, separado de `write`.
- `share_project` e `unshare_project` exigem esse scope no agente. `write` sozinho não basta.
- Pessoa dona do projeto continua compartilhando. Membro EDITOR continua editando sem compartilhar.
- Migração: agente que já tem `write` recebe `project.share`, porque hoje esse `write` abre o compartilhamento. Agente novo só com `write` não recebe o scope.
- Teste: editor humano edita e não compartilha; agente só com `write` não compartilha; agente com `project.share` compartilha no projeto do dono; agente antigo com `write` continua podendo compartilhar depois da migração.

## Fora de escopo

- Exigir ADMIN da instalação para compartilhar.
- Apagar a ferramenta `share_project` ou tirar o compartilhamento do dono.
- Deixar todo EDITOR de projeto compartilhar. A decisão não diz isso.
- Inventar convite para quem ainda não tem conta. Hoje o compartilhamento procura uma conta existente.
- Abrir projeto privado para OWNER (DOC-SERVER-014) ou mudar o gate de ADMIN (DOC-SERVER-013).

## Critérios de aceitação

- [ ] Agente com `write` e sem `project.share` edita e recebe recusa em `share_project` e `unshare_project`.
- [ ] Agente com `project.share` compartilha e tira acesso no projeto cujo dono é o dele. Não compartilha projeto alheio.
- [ ] Membro EDITOR humano edita e não compartilha. O dono humano compartilha.
- [ ] Agente que já tinha `write` antes da migração fica com `project.share` e não perde o compartilhamento.
- [ ] Agente criado depois, só com `write`, não ganha `project.share`.
- [ ] Nenhum membro, projeto ou agente é apagado por esta mudança.

## Plano de execução

1. Acrescentar o scope e a migração dos agentes que já têm `write`.
2. Trocar o gate de `share_project` e `unshare_project` para `project.share`.
3. Manter a checagem de dono do projeto.
4. Testes de agente novo, agente migrado, dono e membro EDITOR, em banco descartável.

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

- Depende da ADR 0002, ADM-DEC-04.
- Não bloqueia o primeiro desenho da alpha (DOC-ENG-006).
- Não editar DOC-SERVER-006 nem DOC-SERVER-007.

## Artefatos esperados

- Scope, migração e testes.
- Matriz de permissões alinhada ao código.

## Histórico de trabalho

### 2026-10-14 09:00 UTC — [Grok 4.7] — criação

- Investigado: gate de `share_project` e scopes do agente. Membro EDITOR já não compartilha.
- Alterado: nenhum código.
- Arquivos: este documento, backlog, ADR 0002, PERMISSIONS.md.
- Testes: validador de tarefas nesta entrega.
- Resultado: Proposta. Write novo não inclui compartilhar.
- Próximo passo: assumir em banco descartável, sem apagar agente.

## Rollback

Reverter o scope. Na cópia, o agente que ganhou `project.share` na migração precisa continuar com o acesso que tinha antes, até a troca ser aceita.
