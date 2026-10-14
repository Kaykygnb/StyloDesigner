# Matriz de autoridade e permissões

**Atual** descreve código do snapshot; **requisito humano** descreve intenção estabelecida, ainda não implementação. **Proposta técnica** descreve mecanismo/contrato aberto. Nenhum contrato muda por esta tabela. Fontes detalhadas no [inventário](CURRENT-STATE.md). Instância, projeto e agente são contextos diferentes.

## Instância — comportamento atual

| Operação/contexto accounts | OWNER | ADMIN | Outros roles globais | Anônimo / bearer de agente |
|---|---|---|---|---|
| Próprio perfil/senha/sessões | Sim | Sim | Sim com sessão válida; senha temporária exige troca | Não como administração humana |
| PUT config e agent/config | Sim | Sim | Não | Não |
| Criar/promover OWNER | Sim | Não | Não | Não |
| Criar/editar contas comuns/ADMIN | Sim | Sim | Não | Não |
| Reset/suspensão/rebaixamento OWNER existente | Alcançável | Alcançável, proteção de alvo não identificada | Não | Não |
| Excluir conta OWNER | Não pelo serviço | Não pelo serviço | Não | Não |
| Sessões globais, revogar sessão alheia | Sim | Sim, sem proteção de alvo OWNER específica | Não | Não |
| Backup criar/listar/agendar restore | Sim, adapter local | Sim, adapter local | Não | Não |
| Plugins/configuração e atividade admin | Sim | Sim | Não | Não |
| Agentes criar/listar | Sim, próprios | Sim, próprios | Não | Não |
| Agentes aprovar/revogar/rotacionar/scopes | Sim, gate global | Sim, gate global; propriedade não conferida nessas rotas | Não | Não |
| Grants/atividade do agente | Agentes próprios + acesso ao projeto | Agentes próprios + acesso ao projeto | Não | Não |
| Ler conteúdo de projeto alheio sem membership | Não automaticamente | Não automaticamente | Não | Não |
| Health/status/presença/configuração pública | Acessíveis, sujeitos a guard Host/Origin | Idem | Idem | Acessíveis sem identidade; não afirmar ausência de metadados sensíveis |
| Setup primeiro OWNER, count=0 | Não requer conta anterior | Não requer conta anterior | Não requer conta anterior | Endpoint público sujeito aos guards atuais |

SSE /agent/events atualmente não passa por userOf; nome/projeto declarados por query não demonstram identidade nem ACL. Broadcast de projeto não filtra por membership. Validação/revogação específica proposta em DOC-SERVER-007.

Sessão humana exige validação via auth; token de agente não é token de usuário. Não confundir SSE de editor, cookie da pessoa e SID MCP. Legado atual: no modo local o usuário técnico é OWNER e não há limite de identidade multiusuário equivalente a accounts; parte das rotas de contas responde 404.

A política beta dos dois PUT foi aprovada explicitamente, com ressalva: segurança, privilégios e credenciais críticas exigem avaliação separada. Demais poderes atuais nesta tabela não ganharam aprovação adicional.

## Projetos — comportamento atual

| Operação | Proprietário do projeto | EDITOR do projeto | COMMENTER do projeto | VIEWER do projeto |
|---|---|---|---|---|
| Ler/abrir | Sim | Sim | Sim | Sim |
| Alterar documento/salvar | Sim | Sim | Não | Não |
| Compartilhar/remover colaborador | Sim | Não | Não | Não |
| Comentários/notas | Sim para pessoa | Sim para pessoa | Caminho de notas permitido para pessoa | Caminho de notas não distingue VIEWER de COMMENTER; não prometer viewer estritamente sem comentário |

Notas usam needs=comment e scopes do ator; atores humanos têm a autorização de scope do caminho humano, enquanto membership atual é revalidada. Não inferir a separação VIEWER/COMMENTER desejada só do nome dos enums. Exportação depende do caminho/ferramenta e scope export de agente; role global VIEWER não é uma ACL de documento.

O Projeto.ownerId é a autoridade para compartilhar; ADMIN da instalação pode ver metadados de projetos de usuários e revogar membership por rota administrativa, mas isso não equivale a abrir/editar todo documento.

## Agentes — comportamento atual e limites

| Ação | Requisitos atuais | Limite da evidência |
|---|---|---|
| Iniciar por bearer | Token válido, agente ACTIVE | Sem expiração do token; suspensão do dono não conferida explicitamente em authenticate |
| Abrir projeto | Acesso do dono + grant agente/projeto | Grant é binário, não role/scope por projeto |
| Ler/editar/exportar/comentar | Grant/acesso atual, read/write/export/comment e regra da ferramenta; comment também aceita write | Revalidação no início; catálogo completo não significa todas ferramentas executáveis |
| Compartilhar projeto | Dono com role OWNER + agente write | Já existe delegação ampla de compartilhamento; não é prova de autoelevação |
| Criar projeto | write conforme ferramenta, ownership do dono, auto-grant no projeto novo | Não dá grant livre em projeto alheio |
| Administrar seus tokens/scopes/globais | Não exposto como autoridade de agente | Rotas administrativas exigem identidade humana; isolamento SID/bearer requer validação específica |

## Política-alvo — decisões aprovadas ainda não aplicadas no código

| Ação sensível | Recomendação inicial | Contexto/decisão humana |
|---|---|---|
| Configuração operacional comum | OWNER/ADMIN conforme aprovação beta; capacidades futuras só refinam após aceite | Não restringir os PUT beta unilateralmente |
| Política de segurança e credencial mestra | Reservadas ao OWNER. ADMIN não recebe delegação genérica | ADM-DEC-02 aprovada; ainda não aplicada |
| Excluir/suspender/rebaixar OWNER principal | **Requisito humano:** negar ADMIN, usuários comuns e outros OWNERs; não deixar instância sem principal válido | HD-OWNERSHIP-02; principal inexiste hoje, implementação precisa projeto/migração |
| Conceder papel OWNER | **Requisito humano:** somente principal, mantendo vários OWNERs | HD-OWNERSHIP-03; hoje qualquer OWNER concede |
| Transferir principal / recuperar / reset sensível | Caminho seguro exigido; procedimento, reautenticação/prova e acesso excepcional são propostas abertas | HD-OWNERSHIP-05; não autoriza reset de principal por admin como recuperação |
| Administrar pessoas, equipes, agentes e configuração operacional | ADMIN no escopo delegado. Não trata conta OWNER como conta comum | ADM-DEC-02 aprovada; ADM-DEC-03 |
| Credencial de integração comum | ADMIN autorizado cadastra ou substitui e não vê o valor depois | ADM-DEC-02 aprovada; ainda não aplicada |
| Prazo de retenção da auditoria | Configuração sensível do OWNER principal. ADMIN não altera | ADM-DEC-02 e ADM-DEC-09 |
| Abrir projeto privado por ser admin | Proibido. Não há exceção, nem de emergência auditada. Só os OWNERs, pela regra organizacional | ADM-DEC-07 aprovada; ainda não aplicada |
| Delegar compartilhamento por agente | Capacidade explícita project.share, concedida por humano autorizado; teto por projeto/role | ADM-DEC-04; migração compatível de write atual |
| Alterar próprio grant/scope/autoridade | Agente não aumenta seu teto nem se autoaprova | Decisão de capacidades, nunca confiar em parâmetros fornecidos pelo agente |
| Suspender delegante/rotacionar/revogar token | Suspensão bloqueia agentes por padrão proposto; sessão vinculada e autoridade revalidada | ADM-DEC-05; tratar operações em voo explicitamente |
| Restaurar backup e trocar ou rotacionar a chave mestra | Só o OWNER, com autenticação reforçada e auditoria. ADMIN não faz | ADM-DEC-08 aprovada; ainda não aplicada |
| Expor serviço público | Mecanismos de bootstrap seguem técnicos. Health mínimo público já está na ADM-DEC-09 | ADM-DEC-06/09 |

RBAC identifica conjuntos iniciais de autoridade; capacidades e contexto restringem ator/alvo/recursos. Uma negativa em qualquer camada prevalece. Scopes não são papéis de instância. Decisões técnicas de interface/internas reversíveis podem ser recomendadas; alterações de autoridade aguardam aprovação explícita.

## Consequências HD sem mudar os gates atuais

- HD-IDENTITY-01/02: humanos sempre com conta/senha no alvo, inclusive individual. Tabela atual registra bypass legado para migração, não sua aprovação permanente.
- HD-ADMIN-01/02/03/04: gestão delegada/scoped e compartilhar por humanos/agentes essenciais, sem autoridade global desnecessária e sem setores obrigatórios. Separação concreta write/share/admin ainda a validar; não remover sharing dos agentes unilateralmente.
- HD-OWNERSHIP-04: contato/e-mail institucional não confere identidade nem permissão por si só.
- HD-RECOVERY-01/02/03: GUI de e-mail opcional exigida. Credencial de integração comum (envio) pode ser cadastrada ou substituída por ADMIN autorizado, sem ver o segredo depois. Recuperação privilegiada e credencial mestra ficam com o OWNER (ADM-DEC-02).
- HD-RECOVERY-05 foi superada no ponto dos códigos: em 2026-10-14 o proprietário escolheu códigos offline de uso único. O procedimento de emergência ainda não foi desenhado. Ver ADR 0002.

ADM-DEC-00 beta continua válida: OWNER e ADMIN mudam a configuração operacional global. ADM-DEC-02 está aprovada e não amplia ADMIN sobre política crítica, propriedade, recuperação privilegiada ou credencial mestra. Ainda não está no código.

## Decisões de 2026-10-14 — ainda não aplicadas

Fonte: ADR 0002, seção da rodada. A tabela “comportamento atual” acima não muda com este parágrafo.

- OWNER principal administra OWNERs secundários. ADMIN não trata conta OWNER como conta comum. Senha existente não é revelada.
- OWNER secundário não substitui, suspende, remove nem rebaixa o principal. ADMIN não lê projeto privado por ser ADMIN.
- Em instalação empresarial, só os OWNERs acessam projeto privado do espaço organizacional. ADMIN não tem exceção, nem de emergência auditada (ADM-DEC-07). O código atual não abre esse conteúdo nem para OWNER. Tarefa DOC-SERVER-014.
- Restaurar backup e trocar ou rotacionar a chave mestra ficam com o OWNER, com autenticação reforçada e auditoria (ADM-DEC-08). ADMIN restaura hoje pelo gate `adminOf`. Ainda não aplicada. Entra na DOC-SERVER-013.
- Suspensão de usuário corta sessões e agentes vinculados e não devolve o token do agente na reativação (ADM-DEC-05).
- Sem login, só o mínimo. Canal de eventos exige identidade (ADM-DEC-09). Prazos padrão: auditoria 365 dias, diagnóstico 30, evento gravado 7. Quem muda o número é o OWNER principal. É configuração sensível (ADM-DEC-02). ADMIN não altera.
- ADM-DEC-02 está aprovada: ADMIN administra usuários comuns, equipes, agentes e configuração operacional no escopo delegado. Pode cadastrar ou substituir credencial de integração comum sem ver o segredo depois. Política crítica, propriedade, recuperação privilegiada e credencial mestra ficam com o OWNER. Ainda não aplicada. Tarefa DOC-SERVER-013.
- EDITOR e COMMENTER não são papéis da instalação. São permissões de projeto (EDITOR, COMMENTER, VIEWER). A migração que preserva o acesso atual está na ADR 0002, seção 2.4, tarefa DOC-SERVER-012. Ainda não aplicada.
