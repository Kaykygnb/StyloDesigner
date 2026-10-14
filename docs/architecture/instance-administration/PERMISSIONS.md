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

SSE `/agent/events` exige `userOf`. Nome e id da query não são identidade. O arquivo na query só entra se a conta pode ver o projeto. O broadcast de projeto vai para dono, membro ou OWNER da instalação; ADMIN sem membership não recebe e não há exceção de emergência. Suspensão e revogação de sessão fecham o canal (DOC-SERVER-007). Abrir ou gravar o documento privado só por ser OWNER da instalação não faz parte deste canal.

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
| Iniciar por bearer | Token válido, agente ACTIVE e dono não suspenso | Sem expiração do token. Suspensão do dono revoga o agente ACTIVE; reativar a conta não devolve o token (DOC-SERVER-007) |
| Abrir projeto | Acesso do dono + grant agente/projeto | Grant é binário, não role/scope por projeto |
| Ler/editar/exportar/comentar | Grant/acesso atual, read/write/export/comment e regra da ferramenta; comment também aceita write | Revalidação no início; catálogo completo não significa todas ferramentas executáveis |
| Compartilhar projeto | Dono com role OWNER + agente write | Já existe delegação ampla de compartilhamento; não é prova de autoelevação |
| Criar projeto | write conforme ferramenta, ownership do dono, auto-grant no projeto novo | Não dá grant livre em projeto alheio |
| Administrar seus tokens/scopes/globais | Não exposto como autoridade de agente | Rotas administrativas exigem identidade humana; isolamento SID/bearer requer validação específica |

## Política-alvo — PROPOSTA, não aplicada

| Ação sensível | Recomendação inicial | Contexto/decisão humana |
|---|---|---|
| Configuração operacional comum | OWNER/ADMIN conforme aprovação beta; capacidades futuras só refinam após aceite | Não restringir os PUT beta unilateralmente |
| Política de segurança e credencial crítica | OWNER por padrão; delegação ADMIN explicitamente concedida e auditada | ADM-DEC-02 |
| Excluir/suspender/rebaixar OWNER principal | **Requisito humano:** negar ADMIN, usuários comuns e outros OWNERs; não deixar instância sem principal válido | HD-OWNERSHIP-02; principal inexiste hoje, implementação precisa projeto/migração |
| Conceder papel OWNER | **Requisito humano:** somente principal, mantendo vários OWNERs | HD-OWNERSHIP-03; hoje qualquer OWNER concede |
| Transferir principal / recuperar / reset sensível | Caminho seguro exigido; procedimento, reautenticação/prova e acesso excepcional são propostas abertas | HD-OWNERSHIP-05; não autoriza reset de principal por admin como recuperação |
| Administrar pessoas/sessões comuns | ADMIN delegado; limitar alvo e impedir autoelevação/poder sobre OWNER | ADM-DEC-02/03 |
| Abrir projeto privado por ser admin | Não permitido por padrão; exceção de emergência só se aprovada/auditada | ADM-DEC-07 |
| Delegar compartilhamento por agente | Capacidade explícita project.share, concedida por humano autorizado; teto por projeto/role | ADM-DEC-04; migração compatível de write atual |
| Alterar próprio grant/scope/autoridade | Agente não aumenta seu teto nem se autoaprova | Decisão de capacidades, nunca confiar em parâmetros fornecidos pelo agente |
| Suspender delegante/rotacionar/revogar token | Suspensão bloqueia agentes por padrão proposto; sessão vinculada e autoridade revalidada | ADM-DEC-05; tratar operações em voo explicitamente |
| Restaurar backup/expor serviço público | OWNER ou administrador com capacidade explícita, confirmação e trilha; health mínimo público | ADM-DEC-06/08/09 |

RBAC identifica conjuntos iniciais de autoridade; capacidades e contexto restringem ator/alvo/recursos. Uma negativa em qualquer camada prevalece. Scopes não são papéis de instância. Decisões técnicas de interface/internas reversíveis podem ser recomendadas; alterações de autoridade aguardam aprovação explícita.

## Consequências HD sem mudar os gates atuais

- HD-IDENTITY-01/02: humanos sempre com conta/senha no alvo, inclusive individual. Tabela atual registra bypass legado para migração, não sua aprovação permanente.
- HD-ADMIN-01/02/03/04: gestão delegada/scoped e compartilhar por humanos/agentes essenciais, sem autoridade global desnecessária e sem setores obrigatórios. Separação concreta write/share/admin ainda a validar; não remover sharing dos agentes unilateralmente.
- HD-OWNERSHIP-04: contato/e-mail institucional não confere identidade nem permissão por si só.
- HD-RECOVERY-01/02/03/05: GUI de e-mail opcional exigida; quem configura credenciais e quais procedimentos recuperam principal seguem matriz sensível/projeto técnico abertos. Códigos offline não aprovados.

ADM-DEC-00 beta continua válida; novo registro não amplia ADMIN global. Somente requisitos HD e aprovação beta têm autoria humana; as recomendações de capacidades são técnicas.
