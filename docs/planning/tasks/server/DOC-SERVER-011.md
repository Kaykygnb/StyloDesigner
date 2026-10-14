# DOC-SERVER-011 — Implementar login por nome de usuário

Responsável: [Grok]
Estado: Em validação
Início: 2026-10-14 09:36 UTC
Última atualização: 2026-10-14 10:08 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Grok]

## Problema e evidências

- Problema: a conta obrigatória pede nome de usuário e e-mail opcional. O código entrava só por e-mail, e o e-mail era obrigatório. O modo `STYLO_AUTH=local` ainda entrava sem senha.
- Evidências observadas: `User.email` era único e obrigatório; `login` buscava por e-mail (`apps/server/src/services/auth.ts`). Decisão técnica na ADR 0002, seção 2.1. O nome de exibição (`name`) não é o login. O proprietário pediu, nesta tarefa, a retirada do modo sem conta, com migração que não apaga projetos.

## Objetivo

A pessoa entra com nome de usuário ou, se tiver, com e-mail. Conta antiga ganha usuário na migração e não perde o e-mail. Não existe modo que entre sem conta. Instalação que só tinha o usuário técnico é assumida pelo primeiro setup, no mesmo id.

## Escopo

- Incluído: coluna `username` obrigatória, única sem distinguir maiúsculas, sem `@`. `email` passa a aceitar nulo e, quando existe, continua único sem distinguir maiúsculas. Login aceita os dois. Migração gera o usuário pela parte local do e-mail (minúsculas, só letras e dígitos; vazio vira `user`; colisão ganha `-2`, `-3`). `name` não muda. Testes de migração, login, colisão e conta sem e-mail. Studio e setup pedem o usuário e não exigem e-mail. Retirada de `STYLO_AUTH=local`, pedida pelo proprietário nesta tarefa: o servidor ignora essa variável, o MCP exige token e a conta técnica antiga só é assumida quando é a única e ainda tem senha inutilizável.
- Fora do escopo: códigos offline (DOC-SERVER-010). Escolher principal por data ou id (DOC-SERVER-006). Migração de papéis de projeto (DOC-SERVER-012). O restante da alpha (DOC-ENG-006). A DOC-SERVER-009 continua sendo o plano; a retirada foi feita aqui por ordem do proprietário, e a 009 não foi marcada concluída.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: server; prioridade P1. Bloqueia a alpha (DOC-ENG-006) até esta validação ser aceita.
- Módulos relacionados: banco, Studio (login, setup e administração), testes de contas, MCP.
- Contratos/interfaces: detalhe técnico da ADR 0002, seção 2.1. Não é decisão humana nova. A retirada do bypass segue a mesma seção.
- Testes relacionados: `tests/username-login.test.ts`, `tests/principal-autoridade.test.ts`, contas HTTP, serviços de auth, e2e de login e administração.

## Dependências, riscos e bloqueios

- Dependências: ADR 0002. A autoridade principal da DOC-SERVER-006 permanece: a migração 0016 não escolhe principal.
- Riscos: colisão de usuário gerado; apagar e-mail na migração; tratar `name` como login; apagar a conta técnica e órfã de projetos.
- Bloqueios: nenhum no código. A aceitação humana desta validação ainda não ocorreu.

## Critérios de aceitação

- [x] Migração em cópia descartável: cada conta fica com usuário único e com o mesmo e-mail de antes. O nome de exibição não muda.
- [x] Login com usuário e com e-mail, sem distinguir maiúsculas. Conta sem e-mail entra só com usuário. Texto com `@` não é aceito como nome de usuário.
- [x] Dois usuários iguais com caixa diferente são recusados. E-mail duplicado continua recusado.
- [x] Setup da primeira conta pede usuário e senha; e-mail pode ficar vazio. A primeira conta é a autoridade principal. Testes automatizados cobrem os casos acima.
- [x] `STYLO_AUTH=local` não abre o servidor sem senha. Se a única conta é `local@stylo.local` com senha inutilizável, o setup assume esse id e o projeto continua do mesmo dono.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: li a ADR 0002 seção 2.1, o auth, a migração 0015 e os testes que dependiam do modo sem senha.
- Arquivos alterados: nenhum neste marco.
- Evidências: o login era por e-mail; `STYLO_AUTH=local` criava `local@stylo.local` com senha `!` e liberava o MCP sem token.
- Testes executados: nenhum neste marco.
- Problemas encontrados: a tarefa original deixava a retirada do modo local na DOC-SERVER-009. O proprietário trouxe essa retirada para cá, com migração segura.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: usuário guardado em minúsculas; e-mail nulo permitido; texto com `@` procura e-mail; migração gera o usuário sem mudar `name` e sem escolher principal; o setup assume a conta técnica só quando ela é a única e a senha ainda é `!`.
- Arquivos alterados: nenhum neste marco.
- Evidências: decisão registrada no histórico e na ADR, sem apagar o conflito com `31f16bf`.
- Testes executados: nenhum neste marco.
- Problemas encontrados: instalação com outras contas humanas não pode ganhar principal por heurística.

### #3 — Implementação

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: migração `0016_nome_de_usuario`; login, setup e administração passam a usar usuário; Studio pede usuário e deixa o e-mail opcional; o servidor não cria mais o usuário técnico na subida; o MCP exige Bearer.
- Arquivos alterados: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/0016_nome_de_usuario/migration.sql`, `apps/server/src/services/auth.ts`, rotas, identidade, gateway, `main.ts`, Studio (`Login`, `Home`, `WorkspacePanel`, `api.ts`) e `scripts/importar.ts`.
- Evidências: `normalizeUsername` recusa `@`; `setup` adota a conta técnica no mesmo id; `agentProjectAccess` não tem mais atalho.
- Testes executados: ver marco #5.
- Problemas encontrados: testes HTTP e de MCP que subiam sem conta passaram a criar a conta mestre e o token do agente.

### #4 — Testes

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: `tests/username-login.test.ts` cobre a migração e o login. `tests/principal-autoridade.test.ts` cobre a corrida do setup e a adoção da conta técnica com projeto. E2E de login e administração usam os rótulos novos.
- Arquivos alterados: testes em `tests/` e `tests/e2e/`.
- Evidências: migração gera `anasilva`, `ab`/`ab-2`, `user`/`user-2`/`user-3` e `local`, sem apagar e-mail e sem escolher principal. Adoção conserva `ownerId`.
- Testes executados: os do marco #5.
- Problemas encontrados: o inventário de ferramentas citava a linha antiga de `tests/mcp-sdk.test.js`. Foi regenerado.

### #5 — Validação final

- Estado: concluído
- Responsável: [Grok]
- Atividades executadas: typecheck, build, suíte, e2e, inventário e validador de tarefas.
- Arquivos alterados: os desta tarefa, mais a documentação que ainda descrevia o modo sem conta.
- Evidências: comandos abaixo, todos com saída 0.
- Testes executados: `npm run typecheck`; `npm run build` (dentro de `npm run test:e2e`); `npm test` — 636 testes, 0 falhas, 0 pulados; `npm run test:e2e` — fluxos de administração e de login passaram; `npm run docs:inventario -- --check` — 120 ferramentas; `node docs/planning/validate-tasks.mjs`.
- Problemas encontrados: a primeira suíte completa falhou em três pontos corrigidos antes desta evidência: criação de usuário sem `username` em `tests/config-autorizacao.test.js`, inventário desatualizado e Chromium do Playwright ausente na máquina (instalado; os testes não foram enfraquecidos). Não verificado: PostgreSQL de produção de alguém, nem uma instalação real já em uso fora dos testes.

## Handoff atual

Preparado por: [Grok]
Destinatário: [Revisor humano]
Estado: Aguardando revisão
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 10:08 UTC
Commit de referência: ver o commit desta branch após o push

### Estado atual

O login por nome de usuário está no código, com migração e testes. A tarefa espera revisão humana. Não foi mergeada.

### Decisões tomadas

Usuário obrigatório, único sem distinguir maiúsculas, sem `@`, separado de `name`. E-mail opcional; se existir, também entra e continua único sem distinguir maiúsculas. Texto com `@` procura e-mail. A migração não apaga e-mail, não muda o nome de exibição e não escolhe principal. A conta técnica antiga só é assumida quando é a única e a senha ainda é inutilizável. Não há modo sem conta.

### Arquivos envolvidos

Migração `0016_nome_de_usuario`, `auth.ts`, rotas de conta, gateway MCP, Studio e os testes citados. A ADR 0002 ganhou uma nota; o conflito com `31f16bf` ficou no texto.

### Evidências e testes

Ver o marco #5. O e2e cobre setup com usuário, e-mail opcional, erro `Usuário ou senha incorretos.` e criação de usuário no painel.

### Pendências

Revisão humana desta validação. A alpha DOC-ENG-006 ainda precisa do demo e das limitações no README. `GET /api/agent/config` responde sem sessão.

### Próximas ações recomendadas

1. Revisar a migração e a adoção da conta técnica.
2. Aceitar ou devolver esta tarefa.
3. Só então assumir a DOC-ENG-006.

### Riscos e cuidados

Não rodar a migração em banco de alguém como ensaio. Não recriar `STYLO_AUTH=local`. Não escolher principal por data. Instalação com várias contas e principal nulo continua sem principal até um procedimento próprio (DOC-SERVER-006, marco #6).

### Condições para conclusão

Revisor humano aceita a validação. Os critérios acima permanecem verdes no commit revisado.

## Histórico de trabalho

### 2026-10-14 10:08 UTC — [Grok] — validação

- Investigado: login, migração e testes que ainda dependiam do modo sem senha.
- Alterado: usuário obrigatório, e-mail opcional, retirada de `STYLO_AUTH=local`, adoção da conta técnica e documentação que ainda ensinava o modo antigo.
- Arquivos: ver marcos #3 e #4.
- Testes: typecheck, build, `npm test` (636, 0 falhas), `npm run test:e2e`, inventário (120) e validador.
- Resultado: Em validação, 5/5. Não mergear.
- Próximo passo: revisão humana. A alpha continua na DOC-ENG-006.

### 2026-10-14 09:36 UTC — [Grok] — assunção

- Investigado: a tarefa estava Proposta e bloqueava a alpha. O proprietário pediu a implementação da ADR 0002 seção 2.1 e a retirada do modo sem conta, com migração segura.
- Alterado: responsável e estado.
- Arquivos: este documento.
- Testes: ainda não, neste registro.
- Resultado: Em andamento.
- Próximo passo: migrar em banco descartável e cobrir o login.

### 2026-10-14 08:40 UTC — [Grok 4.7] — criação

- Investigado: ADR 0002 seção 2.1 e `auth.ts`. DOC-SERVER-009 planeja a saída do modo local e não implementa este login.
- Alterado: nenhum código.
- Arquivos: este documento, backlog, ADR, DOC-ENG-006.
- Testes: validador de tarefas nesta entrega.
- Resultado: Proposta. Bloqueia a alpha.
- Próximo passo: assumir e migrar em banco descartável. Coordenar com a PR #18.

## Rollback

Reverter o commit numa cópia, não em banco de alguém. A migração 0016 preenche `username` e torna `email` anulável; o e-mail anterior permanece na coluna. Não apagar a tabela `User` para desfazer.
