# DOC-SERVER-011 — Implementar login por nome de usuário

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:40 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: a conta obrigatória pede nome de usuário e e-mail opcional. O código entra só por e-mail, e o e-mail é obrigatório.
- Evidências observadas: `User.email` único e obrigatório; `login` busca por e-mail (`apps/server/src/services/auth.ts`). Decisão técnica delegada na ADR 0002, seção 2.1. O nome de exibição (`name`) não é o login.

## Objetivo

A pessoa entra com nome de usuário ou, se tiver, com e-mail. Conta antiga ganha usuário na migração e não perde o e-mail. Testes cobrem a migração e o login.

## Escopo

- Incluído: coluna `username` obrigatória, única sem distinguir maiúsculas, sem `@`. `email` passa a aceitar nulo e, quando existe, continua único sem distinguir maiúsculas. Login aceita os dois. Migração gera o usuário pela parte local do e-mail (minúsculas, só letras e dígitos; vazio vira `user`; colisão ganha `-2`, `-3`). `name` não muda. Testes de migração, login, colisão e conta sem e-mail. Studio e setup pedem o usuário e não exigem e-mail.
- Fora do escopo: não remover `STYLO_AUTH=local` (isso é DOC-SERVER-009). Não desenhar códigos offline (DOC-SERVER-010). Não mudar o ponteiro de principal da PR #18.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P1. Bloqueia a alpha (DOC-ENG-006).
- Módulos relacionados: banco, Studio (login e setup), testes de contas.
- Contratos/interfaces: detalhe técnico da ADR 0002, seção 2.1. Não é decisão humana nova.
- Testes relacionados: contas HTTP, serviços de auth, migração em banco descartável.

## Dependências, riscos e bloqueios

- Dependências: ADR 0002. A PR #18 também mexe em `auth.ts` e no schema; integrar depois do merge, sem redefinir o principal.
- Riscos: colisão de usuário gerado; apagar e-mail na migração; tratar `name` como login.
- Bloqueios: nenhum para assumir o desenho. A alpha não publica enquanto isto não estiver concluído.

## Critérios de aceitação

- [ ] Migração em cópia descartável: cada conta fica com usuário único e com o mesmo e-mail de antes. O nome de exibição não muda.
- [ ] Login com usuário e com e-mail, sem distinguir maiúsculas. Conta sem e-mail entra só com usuário. Texto com `@` não é aceito como nome de usuário.
- [ ] Dois usuários iguais com caixa diferente são recusados. E-mail duplicado continua recusado.
- [ ] Setup da primeira conta pede usuário e senha; e-mail pode ficar vazio. Testes automatizados cobrem os casos acima.

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

### 2026-10-14 08:40 UTC — [Grok 4.7] — criação

- Investigado: ADR 0002 seção 2.1 e `auth.ts`. DOC-SERVER-009 planeja a saída do modo local e não implementa este login.
- Alterado: nenhum código.
- Arquivos: este documento, backlog, ADR, DOC-ENG-006.
- Testes: validador de tarefas nesta entrega.
- Resultado: Proposta. Bloqueia a alpha.
- Próximo passo: assumir e migrar em banco descartável. Coordenar com a PR #18.

## Rollback

Reverter a migração numa cópia, não em banco de alguém. O e-mail antigo tem de continuar recuperável até a migração ser aceita.
