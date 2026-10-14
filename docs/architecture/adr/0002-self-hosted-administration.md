# ADR 0002 — Administração de instâncias self-hosted

## Status

**Decisões humanas parcialmente estabelecidas; projeto técnico ainda aberto**, atualizado em 2026-10-14, referência de código `31f16bf`. Requisitos HD e as aprovações da seção “Rodada de 2026-10-14” foram aceitos pelo proprietário; mecanismos, contratos e execução integral não estão automaticamente autorizados. ADM-DEC-00 continua aprovação beta dos dois PUT. ADM-DEC-02 continua pendente. Mantém [ADR 0001](0001-modular-monolith.md); não a substitui.

## Contexto e evidências

Uma empresa quer operar o Stylo numa VPS, administrando funcionários, projetos, agentes e integrações sem editar configuração para operações comuns. O código já tem contas, roles, painel amplo, grants/tokens, plugins, backup local e diagnóstico. Não há entidade de organização/tenant; queries e segredos/backup/config têm escopo de instalação/usuário/projeto. [Auditoria](../instance-administration/CURRENT-STATE.md), [arquitetura](../instance-administration/ARCHITECTURE.md), [matriz](../instance-administration/PERMISSIONS.md) e [roadmap](../instance-administration/ROADMAP.md) são os detalhes, evitando duplicá-los aqui.

## Alternativas

| Critério | A — uma organização por instalação | B — várias organizações por instalação |
|---|---|---|
| Complexidade | Aproveita monólito, contas e propriedade atuais; domínio admin explícito | Novo org membership/contexto, namespaces, consultas/constraints e migração de todos os recursos |
| Segurança/isolamento | Fronteira entre empresas via instâncias; acesso interno por projetos/scopes; VPS/config/backup ainda compartilhados dentro da organização | Isolamento lógico entre tenants precisa ser demonstrado em banco, blobs, credentials, backup, diagnóstico, cache/presença e ferramentas |
| Manutenção/custo | Mais instalações para várias empresas, menor custo de desenvolvimento/MVP | Menos processos por várias organizações, alto custo de política/isolamento/operabilidade e testes contínuos |
| Permissões | OWNER/ADMIN da instalação, ownership/membership projeto, agente delegado | Administrador de plataforma separado de admins de organização; usuário com memberships múltiplas; autoridade cruzada cuidadosamente limitada |
| Compatibilidade | Alta, sem exigir tenant_id ou duplicar auth/painel | Baixa sem migração; não basta adicionar seletor GUI nem organizationId opcional |
| Escalabilidade | Escalar processo/DB/renderer conforme evidência; limite operacional por instalação | Compartilhamento eficiente possível, quotas/noisy-neighbor e blast radius maiores; tenancy não resolve gargalo do renderer |
| MVP | Atende empresa única e uso individual hoje | Sem necessidade comprovada para beta; amplia escopo e riscos |

Alternativa C considerada: instâncias independentes para empresas independentes. É o caminho operacional de A para múltiplos clientes, não um sistema multi-tenant disfarçado.

## Recomendação

Recomendar **A na beta**, organização como contexto operacional único, sem tabela fictícia de tenant. Formalizar administração como domínio interno composto sobre identity/auth/agents/config/backups/operations existentes. Evoluir WorkspacePanel e programação via ferramentas. A recomendação anterior de preservar modo local permanente foi superada por HD-IDENTITY-01/02/04: preservar caminhos e dados apenas durante transição avaliada, não oferecer bypass humano permanente. RBAC atual mais regras contextuais/capacidades apenas nos pontos aprovados; não implantar motor externo de políticas ou microserviço de administração.

MCP continua transporte das ferramentas. Proteção de identidade/revogação de sessão é requisito de autorização de agentes a verificar, não pretexto para mover administração da VPS ao MCP. Não há nova integração de firewall/SO/provedor.

## Aprovação imediata já recebida

**ADM-DEC-00 — Aprovada pelo proprietário humano nesta sessão, exclusivamente para beta:** OWNER e ADMIN podem modificar configurações globais atualmente protegidas por identity.adminOf; MEMBER e anônimos não. Preservar testes de autorização, ausência de mutação parcial e credenciais. Registro formal na DOC-SERVER-005, implementada por Kimi e tecnicamente revisada por Codex.

Ressalva explícita: não significa que toda configuração global deva permanecer acessível a todo ADMIN indefinidamente; políticas de segurança, privilégios e credenciais críticas devem ser avaliadas separadamente. Não é certificação geral de segurança, aceite de multi-tenancy ou aprovação dos demais poderes alcançáveis nas rotas atuais.

## Registro de decisões e diretrizes humanas — rodada encerrada por enquanto

Autoria: **proprietário humano do projeto**, instrução “Registro de decisões humanas e retomada dos trabalhos”, recebida nesta sessão. Registro por [Codex]. IDs humanos preservados; não atribuir recomendações de agentes ao humano. Este registro estabelece requisitos/diretrizes e investigação; não autoriza implementação integral ou remoção destrutiva dos caminhos antigos.

| ID humano | Conteúdo formalizado | Rastreabilidade técnica |
|---|---|---|
| HD-IDENTITY-01 | Conta autenticada obrigatória para todo usuário, inclusive uso individual no próprio computador. | DOC-SERVER-009 |
| HD-IDENTITY-02 | Senha obrigatória no modelo básico; sem autenticação automática por estar na máquina do usuário. | DOC-SERVER-009 |
| HD-IDENTITY-03 | Contas gerenciadas pela instalação, sem serviço central ou internet permanente; identidade externa só adicional futura. | DOC-SERVER-009/010 |
| HD-IDENTITY-04 | Acesso local sem autenticação não é experiência final; investigar remoção/migração preservando dados, projetos e dependências, sem eliminação precipitada. | DOC-SERVER-009 |
| HD-ONBOARDING-01 | Configuração inicial GUI com sugestões para pessoal/equipe/empresa; opções adaptam experiência, não edições nem identidades incompatíveis. | DOC-STUDIO-006 |
| HD-ONBOARDING-02 | Administração progressiva individual→empresa→funcionários→administradores→sócios, sem recriação manual de contas/projetos/configuração. | DOC-STUDIO-006; DOC-SERVER-006 |
| HD-ONBOARDING-03 | Primeira conta no provisionamento autorizado é OWNER principal; impedir visitante não autorizado de assumir instalação acessível na rede. | DOC-SERVER-006/008; DOC-STUDIO-006 |
| HD-OWNERSHIP-01 | OWNER administra determinada instalação; não é proprietário do código/software Stylo. | DOC-SERVER-006 |
| HD-OWNERSHIP-02 | Cada instalação tem autoridade principal válida; ADMIN, usuários comuns e outros OWNERs não podem excluir/suspender/rebaixar o OWNER principal. | DOC-SERVER-006 |
| HD-OWNERSHIP-03 | Múltiplos OWNERs permitidos; somente OWNER principal concede papel OWNER, demais OWNERs não. | DOC-SERVER-006 |
| HD-OWNERSHIP-04 | Contemplar titularidade institucional/contatos/e-mail empresarial separada de identidade pessoal dos operadores; e-mail institucional não implica conta compartilhada cotidiana. | DOC-SERVER-006; DOC-STUDIO-006 |
| HD-OWNERSHIP-05 | Caminho seguro de transferência principal para sucessão/venda/mudança. O texto de 2026-10-14, na seção seguinte, aprova os requisitos. O procedimento excepcional de emergência continua a projetar. | DOC-SERVER-006; DOC-SERVER-010 |
| HD-ADMIN-01 | Delegação administrativa; ADMIN cadastra/convida funcionários, administra recursos autorizados e compartilha conforme permissões. | DOC-SERVER-006; DOC-STUDIO-006 |
| HD-ADMIN-02 | Administração com escopo para conjuntos de projetos/equipes/setores; sem acesso automático a projetos privados de outro setor; investigar representação existente antes de entidades novas. | DOC-SERVER-006 |
| HD-ADMIN-03 | Compartilhamento essencial para humanos e agentes, inclusive criar e disponibilizar visualização sem autoridade global desnecessária; separar edição/compartilhamento/administração tecnicamente. | DOC-SERVER-006; DOC-STUDIO-001 |
| HD-ADMIN-04 | Sem obrigar indivíduo ou pequena empresa a criar departamentos; experiência simples, progressiva e configurável. | DOC-STUDIO-006 |
| HD-RECOVERY-01 | Desejado suporte a recuperação por e-mail, inclusive individual com conectividade/envio configurado; verificação, expiração e uso único seguros. | DOC-SERVER-010 |
| HD-RECOVERY-02 | Configuração de envio pela GUI: SMTP customizado, assistência Gmail/Workspace e possibilidade Outlook/M365; teste conexão/envio, diagnóstico e credenciais protegidas; investigar auth real do provedor. | DOC-SERVER-010 |
| HD-RECOVERY-03 | E-mail opcional para funcionamento normal; não exigir Google/Microsoft/provedor específico. | DOC-SERVER-010 |
| HD-RECOVERY-04 | Login Google/Vich Hub/outros é possibilidade futura, não prioridade imediata autorizada; depende de compatibilidade técnica. | DOC-SERVER-010 (registro futuro, sem implementação federada) |
| HD-RECOVERY-05 | Texto original: investigar recuperação offline; códigos e procedimentos administrativos são alternativas discutidas, não escolha humana definitiva. Em 2026-10-14 o proprietário escolheu códigos offline de uso único (seção seguinte). Essa frase de “não escolha” fica superada nesse ponto. O procedimento excepcional de emergência continua a projetar. O e-mail opcional (HD-RECOVERY-01/03) não foi cancelado. | DOC-SERVER-010 |

A implementação atual **ainda não atende** integralmente a esse modelo. OWNER principal não é hoje distinguido dos demais OWNERs; contas com senha já existem, mas STYLO_AUTH=local mantém bypass e identidade técnica. Registro não faz migração, não escolhe flags/tabelas, não converte e-mail empresarial em credencial coletiva e não promete SMTP/recuperação já presentes. Plano técnico detalhado em [identidade, onboarding e recuperação](../instance-administration/IDENTITY-ONBOARDING-RECOVERY.md).

## Deliberações anteriores reconciliadas e questões ainda abertas

| ID | Deliberação | Recomendação inicial / implicação |
|---|---|---|
| ADM-DEC-01 | Escopo de tenancy não decidido | Intenção de pessoa/empresa instalar sua instância favorece A; não é aprovação de multi-tenancy nem de exclusão definitiva. A permanece recomendação técnica |
| ADM-DEC-02 | Pendente. Reafirmada pendente em 2026-10-14. Não registrar como aprovada | Operação comum delegada; segurança/credenciais críticas/privilégios OWNER ou capacidade explícita auditada. Identificar tipos de segredo, não bloquear toda integração indistintamente |
| ADM-DEC-03 | Aprovada em 2026-10-14. Texto na seção seguinte | O principal administra OWNERs secundários. Não amplia, por inferência, a proteção do principal a toda a matriz |
| ADM-DEC-04 | Essencialidade/delegação aprovada como diretriz HD-ADMIN-03, contrato aberto | project.share separado de write é recomendação, não scope humano escolhido; não retirar compartilhamento dos agentes nem exigir ADMIN global sem prova/validação |
| ADM-DEC-05 | Aprovada em 2026-10-14. Texto na seção seguinte | O código desta fotografia não cumpre a decisão: DOC-SERVER-007 viu agente válido após o dono suspenso. Não foi reexecutado aqui |
| ADM-DEC-06 | Provisionamento autorizado e GUI estabelecidos, mecanismos abertos | Primeira conta humana é principal; impedir apropriação por visitante. Token de instalação, trust proxy e recuperação offline são alternativas técnicas, não decisões humanas adicionais |
| ADM-DEC-07 | Acesso excepcional a conteúdo privado de projeto | Não conceder acesso universal por ser ADMIN; exceção só com decisão explícita, justificativa e auditoria |
| ADM-DEC-08 | Backup, chave e poderes de restore | Conjunto DB/blobs/config/chave, proteção/retenção e prova de restore; quem pode restaurar/rotacionar chave mestre precisa de autoridade específica |
| ADM-DEC-09 | Aprovada em 2026-10-14. Texto e prazo técnico na seção seguinte | O proprietário aceitou a recomendação inicial e delegou o prazo. O prazo não é decisão humana pendente |

Continuam abertas: multi-tenancy (ADM-DEC-01); o que ADMIN pode fazer de sensível (ADM-DEC-02); contrato de `project.share` (ADM-DEC-04); acesso excepcional de ADMIN a projeto privado (ADM-DEC-07); backup, chave e restore (ADM-DEC-08); mecanismos de bootstrap (ADM-DEC-06); login federado. Aprovadas e ainda sem implementação integral: administração de OWNERs secundários, requisitos de transferência, códigos offline, suspensão (ADM-DEC-05) e audiência da auditoria (ADM-DEC-09). O prazo de retenção dessa última é detalhe técnico, não item pendente. Não interpretar silêncio ou aprovação DOC-SERVER-005 como aprovação de qualquer linha pendente.

## Rodada de 2026-10-14 — texto do proprietário

Autoria: proprietário. Registro por [Grok 4.7]. O texto abaixo é o que foi aprovado. Não substitui os 21 HD anteriores; onde conflita, o conflito fica marcado e não é resolvido aqui. A PR #18 guarda um resumo no ticket DOC-SERVER-006 e não editou esta ADR. Este texto é o registro canônico. O ticket não foi alterado nesta entrega.

### 2.1 Contas obrigatórias

Toda instalação exige conta, inclusive uso local individual. Primeiro usuário = OWNER principal. Conta funciona localmente sem autenticação externa. Nome de usuário obrigatório; senha obrigatória; e-mail não obrigatório no local; autenticação aplica-se às integrações e ao FeatMCP; provedores externos de identidade podem vir depois. Não criar modo pessoal que contorne o sistema de contas.

Conflito com o código em `31f16bf`: `STYLO_AUTH=local` entra sem senha e cria usuário técnico OWNER (`auth.ts`). `User.email` é obrigatório, único, e é a chave do login. `name` é nome de exibição.

O proprietário delegou a forma do login aos engenheiros. Detalhe técnico, não decisão humana nova:

- O nome de usuário é o identificador de login. É obrigatório, único sem distinguir maiúsculas, e separado do nome de exibição (`name`).
- O e-mail é opcional e pode ser nulo. Quando existe, também serve para entrar e continua único sem distinguir maiúsculas.
- O login aceita usuário ou e-mail. A comparação não distingue maiúsculas. Texto com `@` procura e-mail; o resto procura usuário. O nome de usuário não contém `@`.
- Contas que já existem recebem um nome de usuário na migração e não perdem o e-mail. A geração usa a parte local do e-mail, em minúsculas, só letras e dígitos. Se não sobrar nada, o valor é `user`. Colisão recebe sufixo `-2`, `-3`, e assim por diante. O nome de exibição não muda.

Implementação, migração e testes: DOC-SERVER-011. Isso bloqueia a alpha, porque o fluxo de conta obrigatória depende desse login. Ainda não está no código.

### 2.2 Uso individual e empresarial

Mesma fundação de identidade, autorização e documentos. Individual: simples, sem painéis empresariais desnecessários. Empresarial: usuários, equipes, admins, permissões, auditoria, compartilhamento. Não construir duas aplicações.

Não decide tenancy (ADM-DEC-01 permanece pendente).

### 2.3 Propriedade organizacional

Em instalação empresarial, projetos no espaço organizacional pertencem à organização; criador não é necessariamente o proprietário. Projeto privado restringe outros membros e administradores delegados, mas não impede acesso dos OWNERs da organização. O produto deve comunicar claramente essa política. Projetos pessoais independentes: estudo futuro, não requisito da beta.

Conflito: hoje o conteúdo privado não abre por ser OWNER ou ADMIN da instalação (matriz de permissões). A decisão não está implementada. ADM-DEC-07 (exceção de ADMIN) continua pendente: 2.3 não dá acesso implícito a ADMIN. “Espaço organizacional” não aprova várias organizações na mesma instalação.

### 2.4 Hierarquia de autoridade

Papéis: OWNER principal, OWNER secundário, ADMIN, MEMBER, VIEWER. OWNER principal tem autoridade máxima. OWNERs secundários têm acesso organizacional amplo aos projetos empresariais, mas não podem substituir, suspender, remover ou rebaixar unilateralmente o principal. ADMINs têm poderes delegados e não recebem acesso universal implícito a projetos privados. MEMBER e VIEWER só acessam o autorizado. Autorização considera recurso, operação e escopo, não comparação numérica de papéis.

Conflito: o enum `Role` também tem EDITOR e COMMENTER globais. Não foram removidos. O proprietário precisa dizer se continuam. Papel de projeto (editor, commenter, viewer) é outro contexto e não foi apagado por esta lista.

### 2.5 Administração de OWNERs (ADM-DEC-03 e HD-OWNERSHIP-05)

OWNER principal pode nomear, suspender, rebaixar e remover OWNERs secundários. Operações sensíveis exigem autenticação reforçada e auditoria. ADMINs não administram contas OWNER como contas comuns. Senhas existentes nunca reveladas; recuperações e redefinições seguem procedimentos seguros.

Conflito: o reset atual devolve senha temporária. A PR #18, não mergeada, protege o principal designado e ainda devolve essa senha; o corpo da PR diz que ADMIN ainda pode rebaixar OWNER secundário. Não foi “corrigido” neste registro.

### 2.6 Recuperação do OWNER principal

Códigos offline de uso único, com proteção adequada. Procedimento excepcional de emergência ainda a projetar. Não presumir que acesso ao banco ou ao sistema operacional equivale a recuperação segura e auditável.

Isto escolhe o mecanismo que HD-RECOVERY-05 ainda chamava de alternativa. O desenho do procedimento é engenharia (DOC-SERVER-010). Não foi implementado.

### 2.7 Transferência da propriedade principal

Exige: (1) autenticação reforçada do principal atual; (2) indicação explícita do sucessor; (3) aceitação e confirmação de identidade pelo sucessor; (4) operação atômica; (5) auditoria; (6) tratamento seguro das sessões administrativas. Proibido: transferência automática por antiguidade, alteração informal de papel ou remoção do titular.

### 3. ADM-DEC-05 — Suspensão de usuários e agentes

Ao suspender usuário: bloquear sessões; invalidar ou suspender credenciais e sessões dos agentes vinculados; negar novas operações desses agentes; interromper operações em andamento quando possível; revalidar autorização em operações longas e antes de alterações relevantes; preservar histórico, tarefas, documentos e auditoria; admin autorizado pode transferir responsabilidade sobre tarefas e recursos; reativar o usuário não reativa automaticamente credenciais de agentes suspensos. Identidade histórica dos agentes não é apagada. Revogação efetiva em conexões persistentes, chamadas MCP, sessões web e canais de eventos.

“Admin autorizado” não define o poder do ADMIN. Isso continua ADM-DEC-02, pendente.

### ADM-DEC-09 — Auditoria, diagnóstico e canal de eventos

O proprietário aceitou a recomendação inicial dos documentos e acrescentou, em 2026-10-14:

Publicamente, sem login, fica exposto apenas o mínimo. Detalhes de auditoria, diagnósticos e avisos em tempo real ficam só para quem está autenticado e autorizado. O canal de eventos não pode mais aceitar conexões sem verificar a identidade.

A recomendação aceita inclui: consulta e exportação para essa mesma audiência; audiência autorizada de presença e notificações; evento consistente com o efeito; sem prometer inviolabilidade da máquina de quem hospeda.

O prazo não foi escolhido pelo proprietário. Ele delegou (“um tempo relativamente bom”). O padrão abaixo é detalhe técnico desta decisão aprovada.

| Classe | O que guarda | Padrão | Piso | Teto |
|---|---|---|---|---|
| Auditoria de segurança | Login, falha, sessão, papel, suspensão, transferência, código de recuperação, token e grant de agente, mudança do próprio prazo | 365 dias | 90 dias | 2555 dias (7 anos) |
| Diagnósticos | Falha de saúde, renderer, provedor, conexão recusada | 30 dias | 7 dias | 90 dias |
| Eventos ao vivo | Rastro gravado de presença ou SSE, se passar a ser gravado. Hoje o canal é só memória | 7 dias | 1 dia | 30 dias |

Justificativa: um ano alcança um uso indevido de conta descoberto tarde, sem guardar para sempre. Trinta dias cobrem um defeito recente; diagnóstico cresce rápido. Sete dias bastam para presença, que não é trilha de segurança. O piso impede zerar a auditoria num clique. O teto limita disco.

Quem altera o número: o OWNER principal. Um ADMIN só altera se tiver capacidade explícita. Criar essa capacidade é ADM-DEC-02 e continua pendente. Até lá, ADMIN não muda prazo. Mudar o prazo gera evento de auditoria. O relógio é UTC. Encurtar passa a valer na limpeza seguinte, nos registros mais velhos que a janela nova. Consulta e exportação usam a mesma audiência autenticada.

Interpretação de engenharia de “mínimo” público: o processo responde ou não. Sem lista de migrações, contagem de usuários ou projetos, texto de erro, porta, quantidade de editores ou política de agente.

Conflito com `31f16bf`: `GET /api/health` devolve migrações, contagens, motor e, na falha, a mensagem de erro. `GET /api/presence` e `GET /api/agent/config` não pedem conta. `GET /api/agent/events` não verifica identidade. Nada disso foi fechado nesta entrega. DOC-SERVER-007 já investiga o canal; o arquivo dela não foi editado aqui.

## Consequências e caminho de evolução

Se A for adotada, ganha setup mais simples, continuidade com contratos existentes e administração comum pela GUI. Essa alternativa limita hospedagem compartilhada entre empresas numa instalação e exige múltiplas instalações/disciplina operacional; a decisão definitiva de tenancy permanece aberta. Riscos atuais não desaparecem ao escolher organização única: hierarquia OWNER, revogação de agentes, bootstrap/origem pública, backup completo e auditoria permanecem gates.

Só propor B após demanda real: ADR de migração, papéis de plataforma/organização separados, org context obrigatório e isolamento de todos os recursos, testes cruzados, quotas, restauração por tenant, rollback e migração de instâncias existentes. Preparação atual são fronteiras de domínio e documentação, sem implementar multi-tenancy.

## Validação e retorno

Aceitação documental: referências ao código/testes, revisão independente, validador e links; não teste GUI/segurança completa nem infraestrutura publicada. Hipóteses primeiro em fixtures descartáveis. Detalhes/gates no roadmap e tarefas propostas; mudanças estruturais aguardam decisões. Revisar ADR se escala/demanda contradizer A, preservando histórico de deliberação.

## Histórico de deliberação

- 2026-10-14 — preparação DOC-ADMIN-001 em 50a8d00: arquitetura proposta, investigação/review e aprovação beta ADM-DEC-00.
- 2026-10-14 — proprietário humano estabeleceu HD-IDENTITY-01..04, HD-ONBOARDING-01..03, HD-OWNERSHIP-01..05, HD-ADMIN-01..04 e HD-RECOVERY-01..05. Codex registrou 21 IDs sem substituir autoria; recomendações anteriores foram reconciliadas, não convertidas em aprovação genérica. Engenharia de investigação/testes/restore segue; contratos estruturais dependem de projeto/revisão específica.
- 2026-10-14 — proprietário aprovou as seções 2.1–2.7, ADM-DEC-05 e ADM-DEC-09. ADM-DEC-02 segue pendente. O prazo da ADM-DEC-09 foi delegado e registrado como detalhe técnico (365 / 30 / 7 dias). [Grok 4.7]. Sem mudança de runtime. Conflitos com o código e com HD-RECOVERY-05 ficam na seção da rodada.
- 2026-10-14 — o proprietário delegou a forma do login. Detalhe técnico na seção 2.1: usuário obrigatório e único, e-mail opcional, entrada por um ou por outro, migração gera o usuário sem apagar o e-mail. Tarefa DOC-SERVER-011. Bloqueia a alpha. [Grok 4.7].
