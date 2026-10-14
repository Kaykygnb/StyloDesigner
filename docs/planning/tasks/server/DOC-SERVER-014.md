# DOC-SERVER-014 — Acesso de OWNER a projeto privado

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:55 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: a regra organizacional dá aos OWNERs o acesso a projeto privado. O código não abre esse conteúdo por papel da instalação. ADMIN não pode ganhar exceção.
- Evidências observadas: `apps/server/src/services/projects.ts` só encontra projeto do dono ou de membro explícito. A matriz em `docs/architecture/instance-administration/PERMISSIONS.md` registra o mesmo limite. ADM-DEC-07 e a seção 2.3 da ADR 0002 estão aprovadas.

## Objetivo

OWNER da instalação acessa o projeto privado do espaço organizacional. ADMIN não acessa, nem em emergência auditada. Membro e administrador delegado continuam de fora, salvo vínculo explícito no projeto.

## Escopo

- Abrir leitura do projeto privado para OWNER principal e OWNER secundário, como a seção 2.3 já diz.
- Recusar ADMIN, MEMBER e VIEWER da instalação quando não há vínculo no projeto. Não criar caminho de emergência.
- Teste: OWNER lê; ADMIN recebe recusa mesmo com motivo de emergência; membro sem vínculo continua de fora.
- Não apagar projeto nem vínculo.

## Fora de escopo

- Projeto pessoal independente. A seção 2.3 deixa isso como estudo futuro, fora da beta.
- Várias organizações na mesma instalação. ADM-DEC-01 não pede isso.
- Exceção auditada para ADMIN. A decisão proíbe.
- Restore e chave mestra. Isso é a ADM-DEC-08, na DOC-SERVER-013.

## Critérios de aceitação

- [ ] OWNER principal e OWNER secundário leem o projeto privado do espaço organizacional.
- [ ] ADMIN não lê, não grava e não há rota de emergência.
- [ ] Quem não é OWNER e não é membro continua sem esse acesso.
- [ ] Nenhum projeto ou vínculo é apagado por esta mudança.
- [ ] O produto comunica que o OWNER da organização alcança o projeto privado.

## Plano de execução

1. Marcar, no modelo atual de uma instalação, o que conta como projeto do espaço organizacional. Projeto pessoal independente não entra.
2. Permitir a leitura ao papel OWNER sem criar membro falso.
3. Teste de recusa do ADMIN, inclusive com pedido que se diga emergência.
4. Atualizar a matriz quando o código cumprir a seção 2.3.

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

- Depende da ADR 0002, seção 2.3, e da ADM-DEC-07.
- Não bloqueia o primeiro desenho da alpha (DOC-ENG-006). A alpha não inclui OWNER abrindo projeto privado.
- Não editar DOC-SERVER-006 nem DOC-SERVER-007.

## Artefatos esperados

- Regra de acesso e teste.
- Matriz alinhada ao código.

## Histórico de trabalho

### 2026-10-14 08:55 UTC — [Grok 4.7] — criação

- Investigado: seção 2.3, ADM-DEC-07 e `projects.ts`. O papel da instalação não abre projeto hoje.
- Alterado: nenhum código.
- Arquivos: este documento, backlog, ADR 0002, PERMISSIONS.md.
- Testes: validador de tarefas nesta entrega.
- Resultado: Proposta. ADMIN não tem exceção.
- Próximo passo: assumir em banco descartável, sem apagar projeto.

## Rollback

Reverter a regra de leitura. Não apagar projeto de uma instalação de alguém.
