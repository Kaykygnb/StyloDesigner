# ADR 0002 — Administração de instâncias self-hosted

## Status

**Decisões humanas parcialmente estabelecidas; projeto técnico ainda aberto**, atualizado em 2026-10-14, referência `50a8d00`. Requisitos HD abaixo aprovados diretamente pelo proprietário; mecanismos, contratos e execução integral não estão automaticamente autorizados. ADM-DEC-00 continua aprovação beta dos dois PUT. Mantém [ADR 0001](0001-modular-monolith.md); não a substitui.

> **Atualização 2026-10-14 (diretrizes humanas, rodada 2):** o proprietário enviou a diretriz "STYLO — DIRETRIZES HUMANAS, GOVERNANÇA E EVOLUÇÃO DO PRODUTO". Suas decisões estão em [Registro rodada 2](#registro-de-decisões-humanas--rodada-2-diretrizes-de-governança-2026-10-14), com ADM-DEC-03 e ADM-DEC-05 agora aprovadas e **ADM-DEC-02 ainda pendente**.

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
| HD-OWNERSHIP-05 | Caminho seguro de transferência principal para sucessão/venda/mudança; procedimento/exigências/recuperação excepcional ainda a projetar e validar. | DOC-SERVER-006; DOC-SERVER-010 |
| HD-ADMIN-01 | Delegação administrativa; ADMIN cadastra/convida funcionários, administra recursos autorizados e compartilha conforme permissões. | DOC-SERVER-006; DOC-STUDIO-006 |
| HD-ADMIN-02 | Administração com escopo para conjuntos de projetos/equipes/setores; sem acesso automático a projetos privados de outro setor; investigar representação existente antes de entidades novas. | DOC-SERVER-006 |
| HD-ADMIN-03 | Compartilhamento essencial para humanos e agentes, inclusive criar e disponibilizar visualização sem autoridade global desnecessária; separar edição/compartilhamento/administração tecnicamente. | DOC-SERVER-006; DOC-STUDIO-001 |
| HD-ADMIN-04 | Sem obrigar indivíduo ou pequena empresa a criar departamentos; experiência simples, progressiva e configurável. | DOC-STUDIO-006 |
| HD-RECOVERY-01 | Desejado suporte a recuperação por e-mail, inclusive individual com conectividade/envio configurado; verificação, expiração e uso único seguros. | DOC-SERVER-010 |
| HD-RECOVERY-02 | Configuração de envio pela GUI: SMTP customizado, assistência Gmail/Workspace e possibilidade Outlook/M365; teste conexão/envio, diagnóstico e credenciais protegidas; investigar auth real do provedor. | DOC-SERVER-010 |
| HD-RECOVERY-03 | E-mail opcional para funcionamento normal; não exigir Google/Microsoft/provedor específico. | DOC-SERVER-010 |
| HD-RECOVERY-04 | Login Google/Vich Hub/outros é possibilidade futura, não prioridade imediata autorizada; depende de compatibilidade técnica. | DOC-SERVER-010 (registro futuro, sem implementação federada) |
| HD-RECOVERY-05 | Investigar recuperação offline; códigos e procedimentos administrativos são alternativas discutidas, não escolha humana definitiva. | DOC-SERVER-010 **(atualizado na rodada 2, ver registro abaixo)** |

A implementação atual **ainda não atende** integralmente a esse modelo. OWNER principal não é hoje distinguido dos demais OWNERs; contas com senha já existem, mas STYLO_AUTH=local mantém bypass e identidade técnica. Registro não faz migração, não escolhe flags/tabelas, não converte e-mail empresarial em credencial coletiva e não promete SMTP/recuperação já presentes. Plano técnico detalhado em [identidade, onboarding e recuperação](../instance-administration/IDENTITY-ONBOARDING-RECOVERY.md).

## Deliberações anteriores reconciliadas e questões ainda abertas

| ID | Deliberação | Recomendação inicial / implicação |
|---|---|---|
| ADM-DEC-01 | Escopo de tenancy não decidido | Intenção de pessoa/empresa instalar sua instância favorece A; não é aprovação de multi-tenancy nem de exclusão definitiva. A permanece recomendação técnica |
| ADM-DEC-02 | Quais poderes sensíveis ADMIN recebe | Operação comum delegada; segurança/credenciais críticas/privilegios OWNER ou capacidade explícita auditada. Identificar tipos de segredo, não bloquear toda integração indistintamente |
| ADM-DEC-03 | Parcialmente definida pelos HD-OWNERSHIP | Principal protegido e múltiplos OWNERs/atribuição exclusiva pelo principal estabelecidos. Relação persistida, poderes sobre OWNERs adicionais, reset de senha/recuperação excepcional e transferência ainda a projetar; não ampliar proteção principal a toda matriz por inferência **(atualizado na rodada 2, ver registro abaixo)** |
| ADM-DEC-04 | Essencialidade/delegação aprovada como diretriz HD-ADMIN-03, contrato aberto | project.share separado de write é recomendação, não scope humano escolhido; não retirar compartilhamento dos agentes nem exigir ADMIN global sem prova/validação |
| ADM-DEC-05 | Suspensão do delegante e operações em voo | Bloquear agentes do dono suspenso por padrão proposto, revogar/revalidar sessões e definir efeito em chamadas já iniciadas **(atualizado na rodada 2, ver registro abaixo)** |
| ADM-DEC-06 | Provisionamento autorizado e GUI estabelecidos, mecanismos abertos | Primeira conta humana é principal; impedir apropriação por visitante. Token de instalação, trust proxy e recuperação offline são alternativas técnicas, não decisões humanas adicionais |
| ADM-DEC-07 | Acesso excepcional a conteúdo privado de projeto | Não conceder acesso universal por ser ADMIN; exceção só com decisão explícita, justificativa e auditoria |
| ADM-DEC-08 | Backup, chave e poderes de restore | Conjunto DB/blobs/config/chave, proteção/retenção e prova de restore; quem pode restaurar/rotacionar chave mestre precisa de autoridade específica |
| ADM-DEC-09 | Auditoria e diagnósticos | Público mínimo, detalhes autenticados, retenção/consulta/exportação e audiência autorizada de presença/notificações SSE; consistência do evento com efeito e limites de inviolabilidade |

Continuam abertas: multi-tenancy; entidades de equipes/setores/workspaces; matriz completa sensível ADMIN/OWNER; acesso excepcional privado; procedimentos principal/transferência/recuperação; revogação de agentes/em voo; backup/restore/chaves; implementação federada; auditoria/retenção. Não interpretar silêncio ou aprovação DOC-SERVER-005 como aprovação de qualquer linha pendente. Decisões reversíveis de organização documental/interface interna são recomendações técnicas; contratos de autoridade e escopo aguardam deliberação.

## Consequências e caminho de evolução

Se A for adotada, ganha setup mais simples, continuidade com contratos existentes e administração comum pela GUI. Essa alternativa limita hospedagem compartilhada entre empresas numa instalação e exige múltiplas instalações/disciplina operacional; a decisão definitiva de tenancy permanece aberta. Riscos atuais não desaparecem ao escolher organização única: hierarquia OWNER, revogação de agentes, bootstrap/origem pública, backup completo e auditoria permanecem gates.

Só propor B após demanda real: ADR de migração, papéis de plataforma/organização separados, org context obrigatório e isolamento de todos os recursos, testes cruzados, quotas, restauração por tenant, rollback e migração de instâncias existentes. Preparação atual são fronteiras de domínio e documentação, sem implementar multi-tenancy.

## Validação e retorno

Aceitação documental: referências ao código/testes, revisão independente, validador e links; não teste GUI/segurança completa nem infraestrutura publicada. Hipóteses primeiro em fixtures descartáveis. Detalhes/gates no roadmap e tarefas propostas; mudanças estruturais aguardam decisões. Revisar ADR se escala/demanda contradizer A, preservando histórico de deliberação.

## Registro de decisões humanas — rodada 2 (diretrizes de governança, 2026-10-14)

Autoria: **proprietário humano**, mensagem "STYLO — DIRETRIZES HUMANAS, GOVERNANÇA E EVOLUÇÃO DO PRODUTO" (§ citados abaixo são as seções dessa mensagem). Registrado por [Claude Code]. Texto preservado o mais perto possível do original; sem reinterpretação. Onde a rodada 1 (tabela HD acima) diz o mesmo, vale o texto mais específico, e a mudança está anotada. Só IDs que o proprietário deu (ADM-DEC-03, HD-OWNERSHIP-05, ADM-DEC-05) são IDs humanos; os demais itens são referenciados por seção (DG-§n) para não inventar numeração em nome dele.

### Aprovadas

| Ref | Decisão (fiel à mensagem) | Obs. técnica de registro |
|---|---|---|
| DG-§2.1 | Toda instalação exige conta, inclusive uso individual local. Primeiro usuário = OWNER principal. Conta funciona localmente, sem autenticação em servidores externos. Nome de usuário e senha obrigatórios; e-mail não obrigatório para funcionamento local. Autenticação vale também para integrações e FeatMCP. Identidade externa pode vir depois. **Não criar modo pessoal que contorne o sistema de contas.** | Reforça HD-IDENTITY-01..04. Hoje `STYLO_AUTH=local` ainda contorna (ver CURRENT-STATE de administração); continua legado a migrar, não removido. |
| DG-§2.2 | Mesma fundação de identidade, autorização e documentos para uso pessoal e empresarial. Uso individual simples, sem painéis empresariais desnecessários; uso empresarial pode ter usuários, equipes, administradores, permissões, auditoria e compartilhamento. **Não construir duas aplicações independentes.** | Reforça HD-ONBOARDING-02, HD-ADMIN-04. |
| DG-§2.3 | Em instalação empresarial, projetos criados no espaço organizacional **pertencem à organização**; o criador não é necessariamente o proprietário organizacional. Projeto privado restringe outros membros e administradores delegados, **mas não impede os OWNERs da organização**. O produto deve comunicar essa política claramente. Projetos pessoais com propriedade independente de organização: estudo futuro, não requisito da beta. | Novo. Precisa de texto de aviso na GUI (a especificar) e de teste que prove que OWNER lê projeto privado e ADMIN delegado não. |
| DG-§2.4 | Papéis: OWNER principal, OWNER secundário, ADMIN, MEMBER, VIEWER. Principal tem autoridade máxima. OWNERs secundários têm acesso organizacional amplo a projetos empresariais, mas **não podem substituir, suspender, remover ou rebaixar unilateralmente o principal**. ADMIN tem poderes delegados, sem acesso universal implícito a projetos privados. MEMBER e VIEWER acessam só o autorizado. Autorização considera **recurso, operação e escopo**, não só comparação numérica de papéis. | O código hoje tem OWNER/ADMIN/MEMBER; **VIEWER e OWNER principal/secundário não existem como papel/relação** (verificar em DOC-SERVER-006). |
| ADM-DEC-03 / HD-OWNERSHIP-05 (DG-§2.5) | O OWNER principal pode nomear, suspender, rebaixar e remover OWNERs secundários. Operações sensíveis exigem autenticação reforçada e auditoria. ADMINs não administram contas OWNER como contas comuns. Senhas existentes não são reveladas; recuperações/redefinições seguem procedimentos seguros. | **Fecha** o que a rodada 1 deixava aberto em ADM-DEC-03 sobre "poderes sobre OWNERs adicionais". Ainda abertos: representação técnica e o que é "autenticação reforçada". |
| DG-§2.6 | Recuperação do OWNER principal usa **códigos offline de uso único, com proteção adequada**. Procedimento excepcional de emergência ainda deverá ser projetado. Não presumir que acesso ao banco/SO equivale a recuperação segura e auditável. | **Muda HD-RECOVERY-05**: lá, códigos eram "alternativa discutida"; agora é o mecanismo decidido. Alternativas "procedimento local do operador" e "restaurar backup" seguem só como estudo para o procedimento de emergência (aberto). |
| DG-§2.7 | Transferência da propriedade principal exige: (1) autenticação reforçada do principal atual; (2) indicação explícita do sucessor; (3) aceitação e confirmação de identidade pelo sucessor; (4) operação atômica; (5) auditoria; (6) tratamento seguro das sessões administrativas. Proibido: transferência automática por antiguidade, mudança informal de papel, remoção do titular. | Detalha HD-OWNERSHIP-05. |
| ADM-DEC-05 (DG-§3) | Usuário suspenso: sessões bloqueadas; credenciais/sessões dos agentes vinculados invalidadas ou suspensas; novas operações desses agentes negadas; operações em andamento interrompidas quando tecnicamente possível; autorizações revalidadas em operações longas e antes de alterações relevantes; histórico, tarefas, documentos e auditoria preservados; administrador autorizado pode transferir responsabilidade sobre tarefas e recursos; **reativar o usuário não reativa automaticamente credenciais de agentes suspensos**. Identidade histórica do agente não é apagada. Considerar revogação efetiva em conexões persistentes, chamadas MCP, sessões web e canais de eventos. | **Fecha** ADM-DEC-05 (antes "proposto"). Verificação técnica em DOC-SERVER-007. |
| DG-§1.1 | Governança: o proprietário define visão, objetivos, necessidades e prioridades; agentes investigam, questionam, propõem, implementam e validam. Agentes **podem contestar ou substituir sugestões técnicas** do proprietário com justificativa objetiva. Requisitos de produto não são descartados em silêncio; decisões humanas formalmente aprovadas são respeitadas ou devolvidas à deliberação se houver impedimento técnico, jurídico ou de segurança; detalhes de implementação são autônomos dentro das restrições; mudanças irreversíveis, destrutivas ou de grande impacto exigem autorização humana. | Orienta todos os agentes; ver também `docs/planning/TASK-PROTOCOL.md`. |
| DG-§17 | Esta mensagem **não** autoriza reescrita completa do editor nem implementar indiscriminadamente as funcionalidades citadas. Reescrita só com plano revisado e autorização explícita. | Regra de trabalho. |

### Pendente — não aprovada

| Ref | Proposta (fiel à mensagem) | Estado |
|---|---|---|
| **ADM-DEC-02** (DG-§4) | ADMINs administram usuários comuns, equipes, agentes e configurações operacionais dentro do escopo delegado. Políticas críticas de segurança, propriedade da instalação, recuperação privilegiada e credenciais mestras ficam reservadas ao OWNER. ADMINs autorizados podem cadastrar ou substituir credenciais de integrações comuns **sem visualizar depois seus valores secretos**. Preservar a decisão de que OWNER e ADMIN podem modificar configurações globais operacionais na beta, distinguindo-as das sensíveis. | **PENDENTE.** "Não registrar como aprovada até confirmação do proprietário." Nenhum código ou teste deve tratá-la como regra. Falta: lista de quais configurações/credenciais são "críticas" vs "comuns" (agentes devem propor; proprietário confirma). |

### Dependências abertas criadas por estas decisões

- Aviso de propriedade organizacional na GUI (DG-§2.3) e teste de visibilidade: OWNER lê projeto privado, ADMIN delegado e MEMBER não.
- Papel VIEWER e relação OWNER principal/secundário no modelo de identidade (DOC-SERVER-006).
- "Autenticação reforçada" não está definida (nova senha? segundo fator? código offline?). Decisão técnica a propor, validada pelo proprietário se alterar a experiência.
- Procedimento excepcional de emergência (DG-§2.6): ainda a projetar.
- Agentes: nunca recebem acesso irrestrito só porque o usuário responsável é OWNER (DG-§14); identidade própria, permissão explícita e escopo.

## Histórico de deliberação

- 2026-10-14 — preparação DOC-ADMIN-001 em 50a8d00: arquitetura proposta, investigação/review e aprovação beta ADM-DEC-00.
- 2026-10-14 — proprietário humano estabeleceu HD-IDENTITY-01..04, HD-ONBOARDING-01..03, HD-OWNERSHIP-01..05, HD-ADMIN-01..04 e HD-RECOVERY-01..05. Codex registrou 21 IDs sem substituir autoria; recomendações anteriores foram reconciliadas, não convertidas em aprovação genérica. Engenharia de investigação/testes/restore segue; contratos estruturais dependem de projeto/revisão específica.
- 2026-10-14 — proprietário humano enviou diretrizes de governança (rodada 2): contas obrigatórias, OWNER principal/secundário, ADM-DEC-03/HD-OWNERSHIP-05, transferência, recuperação por códigos offline e ADM-DEC-05 aprovados; ADM-DEC-02 mantida pendente. Registrado por [Claude Code] sem alteração de código.
