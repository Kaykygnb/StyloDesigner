# Server

O servidor compõe o processo: HTTP, autenticação, projetos, workspace, persistência, presença, renderer, biblioteca e entrega do Studio.

## Controla

Identidade, autorização, ciclo de vida do workspace, gravação, versões, blobs, rede e adapters externos.

O caller do Studio associa o identificador público da aba à conta autenticada para formar a chave interna do workspace; a rota de snapshot usa a mesma chave. Cookie/Bearer continuam sendo a identidade; o sid sozinho não autoriza acesso ao documento (DOC-SERVER-003).

Configuração de servidor (`PUT /api/config` e `PUT /api/agent/config`) exige papel de administrador (`identity.adminOf`): anônimo recebe 401, MEMBER/EDITOR/VIEWER/COMMENTER recebem 403 e a recusa não muta nada (DOC-SERVER-005). As chaves de integração (Pexels) nunca são devolvidas por nenhuma rota.

Workspaces ativos revalidam o papel atual da pessoa por ID do projeto antes de ferramentas que dependem dele; agentes também precisam manter seu grant. O snapshot HTTP do Studio usa o mesmo gate. Downgrade atualiza o papel e recusa escrita, revogação recusa leitura/escrita, e novo compartilhamento pode permitir continuar sem reabrir. A consulta não hidrata documento/assets. A verificação acontece no início da chamada e não cancela operações já em execução (DOC-SERVER-004).

`export_zip` e os GET `site.zip`/`react.zip` recusam o papel de projeto VIEWER com a mesma mensagem das escritas recusadas, antes de gravar ou devolver o pacote. O agente só de leitura continua limitado pelo scope `export`. COMMENTER pode baixar o zip (decisão do proprietário em 2026-10-14).

Sessão MCP fica presa ao agente que a abriu. Bearer de outro agente não troca essa identidade. Pedido sem bearer revalida a credencial presa: token rotacionado, revogação, escopo reduzido e dono suspenso passam a valer em POST, GET e DELETE. Suspender uma conta que a regra permite apaga as sessões web, marca os agentes ACTIVE como REVOKED e fecha os canais daquela conta. O principal não é suspenso por esta rota; outro OWNER só é suspenso pelo principal, depois de reconfirmar a senha. Reativar a conta não devolve essas credenciais. O registro do agente, o projeto e o log de operações permanecem. Uma ferramenta que já passou da checagem do sinal pode concluir o passo atual; a próxima chamada e o canal persistente não seguem (DOC-SERVER-007, junto da DOC-SERVER-006).

`GET /api/agent/events` exige sessão. A query não escolhe usuário nem inscreve projeto sem acesso. Evento de projeto vai para dono, membro ou OWNER da instalação. ADMIN sem membership não recebe projeto privado e não há exceção de emergência. `GET /api/health` e `GET /api/presence` exigem sessão. `GET /api/status` continua sendo o mínimo público. Não há entrada sem conta.

## Não deve fazer

Não deve duplicar regras do modelo ou implementar uma segunda versão de ferramentas.

## Verificação

Testes HTTP, banco, contas, assets, presença, projetos e renderização.

`tests/backups.test.ts` confere snapshots de arquivos, datas UTC e ordenação da listagem, cópia de segurança e restauração pendente no próximo boot, em pastas temporárias exclusivas. O adapter de banco simula apenas `CHECKPOINT`; esses testes não comprovam integridade de restore PGlite/PostgreSQL real (DOC-DB-001).

## Administração self-hosted

[Domínio administrativo proposto](../../architecture/instance-administration/README.md) inventaria serviços/painel existentes e lacunas, sem reimplementá-los. A política adminOf dos dois PUT foi aprovada para beta, com ressalva: segurança, privilégios e credenciais críticas têm deliberação separada. Não é certificação geral de segurança nem aprovação da arquitetura proposta.

## Registro humano de identidade e recuperação

[ADR0002](../../architecture/adr/0002-self-hosted-administration.md) distingue requisitos HD e runtime. Accounts é padrão, mas o bypass local persiste. O principal é o ponteiro da instalação (migração `0015`): só essa conta administra outro OWNER, com reconfirmação de senha. Códigos offline, emergência e transferência ainda não estão no runtime. [Plano técnico](../../architecture/instance-administration/IDENTITY-ONBOARDING-RECOVERY.md).
