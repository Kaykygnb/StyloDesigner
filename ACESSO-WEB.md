# Acesso web e gerenciamento da instalação Stylo

Documento de planejamento, iniciado em 2026-10-12 a pedido da pessoa dona.
**Não é uma descrição de funcionalidades já prontas.** Estados e decisões pendentes aparecem abaixo.

## 1. Objetivo aprovado

A pessoa baixa o Stylo do GitHub e executa sua própria instalação. Essa instalação guarda os
projetos e serve o painel, o editor e o MCP. No primeiro acesso, configura uma conta de
administrador com identificação e senha; nos seguintes, entra pelo login.

O administrador pode permitir outras contas para pessoas da mesma rede acessarem os projetos
compartilhados dessa instalação. O produto atende tanto criação manual quanto trabalho por
agentes. Uma pessoa pode alternar entre os dois no mesmo projeto.

Este documento cobre acesso, contas, projetos, biblioteca, conexões MCP e administração.
A relação com o editor está definida, mas o desenho detalhado do editor merece um documento próprio.
Não decide licença, cobrança, domínio, serviço hospedado ou formatos novos de exportação.

## 2. Como a instalação funciona

- O computador que executa o programa é o servidor; o navegador é o meio de acesso.
- Projetos, contas e arquivos pertencem à instalação, com permissões por pessoa/projeto.
- Outra pessoa na rede usa um endereço da instalação e sua própria conta.
- Estar na mesma rede não concede acesso aos projetos automaticamente.
- O MCP conecta agentes ao servidor; o editor não precisa estar aberto para um agente trabalhar.
- Se o servidor estiver desligado, os demais computadores não conseguem acessar a instalação.
- Um projeto local não se torna público na internet por ser compartilhado com uma conta.

**Hoje:** o servidor escuta em127.0.0.1 e rejeita Host/Origin externos. Acesso pela rede ainda
não funciona. Modo padrão é local sem login; contas exigem STYLO_AUTH=accounts. O fluxo aprovado
para a experiência nova requer revisar esse padrão, sem quebrar silenciosamente instalações existentes.

## 3. Primeiro acesso e login

### Instalação nova

1. Mostrar “Configurar seu Stylo”, explicando que a conta criada administrará esta instalação.
2. Pedir nome, identificação de acesso, senha e confirmação da senha.
3. Criar uma única primeira conta administradora e iniciar a sessão.
4. Levar ao painel de projetos, com orientação curta para criar um projeto/conectar um agente.
5. Disponibilizar configurações da instalação para o administrador.

A configuração inicial deixa de existir após a criação da primeira conta. Duas requisições
simultâneas não podem criar dois administradores iniciais. Recomenda-se concluir essa configuração
na máquina servidora antes de liberar a rede; o procedimento exato ainda precisa ser especificado.

**Identificação pendente:** o pedido fala em usuário e senha; a API atual exige e-mail, nome e
senha. Decidir se o acesso usa nome de usuário, e-mail ou ambos antes de implementar o formulário.
Não exigir envio de e-mail para usar uma instalação local se isso não tiver sido escolhido.

### Acessos seguintes

- Login simples, com identificação e senha; nome da instalação quando configurado.
- Erro compreensível sem revelar se uma conta específica existe.
- Sessão expirada conduz ao login e permite voltar ao destino após autenticar.
- Sair encerra a sessão; páginas privadas deixam de ficar disponíveis.
- Não manter senha ou token completo em URL, histórico de atividade ou mensagens de erro.
- Recuperação de acesso precisa funcionar para uma instalação própria; não prometer e-mail de
  recuperação sem um serviço configurado. Procedimento de recuperação do administrador pendente.

## 4. Estrutura do painel

Navegação principal proposta: **Projetos, Biblioteca, Conexões MCP, Minha conta**.
**Administração** aparece apenas para quem administra a instalação.

A tela inicial é Projetos. O painel deve explicar tarefas, não expor nomes internos de banco,
escopos técnicos ou todas as ferramentas MCP. Informações técnicas ficam em detalhes/instruções.

| Área | Informações e ações previstas | Não mostrar |
|---|---|---|
| Projetos | Miniatura, nome, última alteração, proprietário, compartilhamento; criar, abrir, pesquisar e gerenciar | Projetos sem permissão, conteúdo privado de outras contas |
| Biblioteca | Arquivos disponíveis, tipo, tamanho, uso e alcance pessoal/compartilhado | Chaves de provedores, arquivos de outras contas sem autorização |
| Conexões MCP | Nome, situação, permissões, projetos permitidos, validade, última atividade; criar e revogar | Token completo após a criação, credenciais de outras pessoas |
| Minha conta | Nome, identificação, alteração de senha e sessões | Senha atual, hashes, tokens de sessão |
| Administração | Contas, política de entrada, acesso de rede, armazenamento e manutenção | Segredos nos logs ou campos de consulta comuns |

Estados obrigatórios: carregando, vazio com próximo passo, erro com tentativa novamente,
sem permissão, sessão expirada e servidor indisponível. Navegação por teclado, foco visível,
rótulos e mensagens legíveis fazem parte dos critérios das telas.

## 5. Contas e permissões

Separar duas responsabilidades:

- **Administrador da instalação:** administra contas e funcionamento do servidor.
- **Proprietário do projeto:** gerencia um projeto e seu compartilhamento.

Uma pessoa pode exercer ambas. Ser administrador não deve conceder silenciosamente acesso
editorial a todos os projetos: o alcance administrativo sobre conteúdo privado precisa de decisão explícita.

| Papel no projeto | Proposta de capacidade |
|---|---|
| Proprietário | Editar e administrar compartilhamento e projeto |
| Editor | Trabalhar no projeto sem administrar contas da instalação |
| Leitor | Consultar sem alterar |

Exportação/download, biblioteca, comentários e criação de agentes precisam ter regras próprias
coerentes com esses papéis. Não concluir que “leitor pode exportar tudo” sem definir a regra.
A API deve validar acesso em toda operação, mesmo se um botão estiver escondido.

### Entrada de outras pessoas

Direção aprovada: o administrador controla a disponibilidade de contas para outras pessoas.
Recomendação inicial: contas criadas pelo administrador. Solicitação de cadastro e convite são
alternativas futuras; cadastro aberto não está aprovado.

Gerenciamento previsto: listar contas e situação, criar conta, permitir/bloquear acesso e auxiliar
recuperação. Não mostrar senha de outra pessoa; senha temporária/troca obrigatória é proposta,
com fluxo a definir. Suspender conta deve invalidar acesso efetivo, inclusive sessões e conexões
conforme política definida. Exclusão requer regra para projetos, arquivos e histórico antes de implementação.

## 6. Projetos e compartilhamento

- Tela inicial com projetos acessíveis, pesquisa e filtro pessoal/compartilhado.
- Criar projeto sem exigir conectar IA; abrir o editor diretamente.
- Gerenciamento previsto: renomear, duplicar, compartilhar e excluir com consequências claras.
- Compartilhar por conta da instalação, exibindo papel de cada membro.
- Diferenciar “compartilhar projeto” de publicar um site exportado.
- Alteração de permissão deve refletir em navegador, eventos e MCP; não apenas na próxima tela.
- Indicar alterações salvas, salvamento em andamento e falha ao salvar.
- Não atribuir trabalho humano ao agente nem vice-versa no histórico.

Arquivamento, lixeira/restauração, pastas e transferência de propriedade são propostas posteriores.
A recuperação antes de exclusão definitiva e o alcance de versões ainda precisam ser definidos.
Hoje a colaboração tem limites: uma gravação externa pode recarregar o workspace. Não apresentar
edição simultânea como garantida sem resolver conflitos e validar esse comportamento.

## 7. Conexões MCP e tokens

Usar “Conectar agente” como ação principal; explicar token como uma chave de acesso.
Uma conexão representa um cadastro de agente, não necessariamente um programa em execução.
“Última atividade” não significa “conectado agora”. Presença atual exige fonte própria.

### Criação proposta

1. Definir nome compreensível, como “Codex do João”.
2. Selecionar projetos que a conexão pode acessar.
3. Escolher capacidades: consultar, comentar, alterar e exportar.
4. Definir política de aprovação de alterações e validade da chave.
5. Exibir token uma única vez e instruções para configurar o cliente escolhido.
6. Voltar à lista com os dados de gerenciamento, sem recuperar o segredo.

Recomenda-se uma chave por conexão. A autorização efetiva combina permissões da pessoa,
acesso ao projeto, capacidades do token e política de aprovação; a chave não amplia os direitos
da pessoa. Definir também como autorizar criação de projetos, que ainda não existem para selecionar.

### Gerenciamento e apresentação

Lista: nome, pessoa responsável, situação, capacidades, alcance, criação, validade e última atividade.
Detalhes: instruções de conexão, atividade autorizada e opções de revogar/substituir chave.
A interface deve explicar quando uma chave foi copiada, expirada ou revogada.
Revogação e mudança de acesso precisam afetar sessões MCP já abertas, não só conexões novas.
Não publicar token em link compartilhável, miniatura, exportação, log ou erro.

**Base existente:** escopos read/comment/write/export; token exibido na criação, hash no banco;
estados PENDING/ACTIVE/REVOKED e lastSeenAt. Rotas de criação/listagem/aprovação/revogação são
reservadas à conta administradora e a lista atual é global. Expiração, renovação, vínculo por
projeto e gestão de conexões por membros ainda não são funcionalidades comprovadas.
Aprovar a entrada de um agente não equivale a aprovar cada alteração no editor.

Instruções por Codex/Claude Code/OpenCode/Kimi devem declarar versões efetivamente testadas.
Não anunciar compatibilidade individual antes da verificação. CodexCLI foi bloqueado por
credencial expirada no ambiente anterior; os outros três não estavam instalados.

## 8. Biblioteca e configurações

Biblioteca deve permitir encontrar arquivos e entender seu alcance antes de inserir no projeto.
Base atual é biblioteca por conta; compartilhamento de projetos não comprova biblioteca compartilhada.
Definir cópia/referência, autorização de download, remoção de arquivos em uso e créditos.

Configurações pessoais incluem perfil e segurança. Chaves de provedores ficam em área própria:
mostrar “configurada” e ação para substituir/remover, sem revelar o segredo armazenado.
Armazenamento deve distinguir biblioteca, projetos e versões conforme o que for medido de verdade.
Não apresentar estimativa como cota global exata nem introduzir planos de cobrança neste trabalho.

## 9. Administração e acesso pela rede

Painel administrativo proposto: contas, regras de entrada, estado da instalação, armazenamento,
acesso de rede, cópia de segurança e instruções de atualização/recuperação.
Mostrar informação útil, sem expor caminhos internos/segredos em telas de usuários comuns.

Para habilitar rede, precisamos projetar e testar conjuntamente:

- Endereço de escuta configurável e endereços/origens explicitamente aceitos.
- Contas obrigatórias no acesso remoto; não transportar o modo local sem login para a rede.
- Transporte protegido para login/tokens; solução e instruções locais de HTTPS ainda a definir.
- Cookies, proteção de requisições, limites de tentativas e configuração de proxy quando aplicável.
- Isolamento por conta/projeto em HTTP, blobs, eventos, miniaturas, exportação e MCP.
- Configuração inicial sem permitir que outro computador tome a conta administradora.
- Orientação sobre porta/firewall e endereço para acessar; não abrir roteador/internet automaticamente.

Não basta trocar127.0.0.1 por0.0.0.0: as proteções atuais precisam evoluir junto.
Acesso pela rede local e exposição pública na internet são alcances distintos.

## 10. Relação com o editor

Caminho: configurar/login → painel → projeto → editor. Manual e agente usam o mesmo projeto;
conectar um agente não é condição para criar manualmente.

Proposta de grupos do editor: Inserir; propriedades contextuais; organização de seleção;
recursos de design; conferência; visualização/exportação. As91 ferramentas MCP não viram91 botões.
Selecionar texto mostra tipografia; selecionar foto mostra recorte/ajustes; seleção múltipla mostra
alinhar/distribuir/agrupar. A interface chama operações com as mesmas regras de autorização e histórico.

Área recolhível para presença, atividade, aprovações e problemas encontrados. Mostrar estado real
sem despejar JSON/argumentos técnicos na experiência comum. Não exigir chat integrado para usar MCP.
Desenho do editor, tecnologia e alcance da primeira versão ainda precisam ser fechados; este MD
não autoriza implementação em apps/web nem resolve a decisãoD10 sozinho.

## 11. Inventário: base existente e trabalho faltante

| Assunto | Base conferida no código | Trabalho ainda necessário |
|---|---|---|
| Primeira conta/login | setup/login/logout, sessão e senha protegidas | Telas novas, padrão de inicialização, identidade escolhida e setup concorrente |
| Contas | OWNER/MEMBER; administrador lista/cria | Alteração/suspensão/recuperação/exclusão, regras de cadastro |
| Projetos | Persistência, membros e papéis | Painel novo, fluxos e limites de gerenciamento |
| Agentes | Tokens/escopos/estado/revogação | UI, validade, alcance por projeto, gestão por membro e sessões abertas |
| Biblioteca | Arquivos por conta e provedores | UI, regras de arquivos compartilhados/remoção em uso |
| Rede | Restrição local explícita | Escuta/origens/autenticação/transporte e teste entre computadores |
| Editor | Legado e ferramentas MCP | Escopo/desenho novo e caminho comum de operações |
| Backup/recuperação | Persistência e versões não equivalem a backup completo | Procedimento incluindo banco, blobs e configuração necessária |

Inventário é leitura do código, não execução de testes novos de acesso web.

## 12. Ordem proposta de implementação

1. Fechar identidade de login, entrada de membros, direitos administrativos e alcance dos tokens.
2. Definir contratos e permissões necessários; verificar fluxos HTTP antes de telas que os prometem.
3. Primeiro acesso/login/logout e estrutura do painel em uso local com contas.
4. Projetos, membros e gerenciamento de conexões MCP.
5. Biblioteca, perfil e administração essenciais.
6. Habilitar rede com proteções e validar em dois computadores/contas.
7. Integrar o editor novo conforme seu planejamento próprio.

Ordem é proposta, não autorização para iniciar código. Em cada bloco: atualizar contexto e diário,
validar o que mudou, commit/pull --rebase/push somente na limpeza. Nenhum PR/main/force.

## 13. Critérios de aceite

- Clone/instalação nova chega à configuração inicial sem contas ou credenciais padrão públicas.
- Primeira conta é criada uma vez; acessos posteriores exigem login.
- Fluxos indicam claramente sessão expirada, erro de servidor e falta de permissão.
- Membro não recebe funções administrativas nem dados de projetos alheios por acessar uma URL.
- Compartilhamento e revogação funcionam também em API, eventos e MCP existentes.
- Token aparece uma vez; listagem/log/exportação não revelam segredo.
- Agente só opera no alcance escolhido e histórico atribui o autor corretamente.
- Duas pessoas conseguem acessar pela rede sem receber acesso automático ao mesmo conteúdo.
- Conflitos e falhas de salvamento não causam perda silenciosa de alterações.
- Interface utilizável por teclado e em telas menores; editor pode ter requisitos próprios.
- Recuperação/backup testados antes de serem oferecidos como recurso.
- Documentação informa exatamente quais navegadores/clientes/redes foram verificados.

## 14. Decisões ainda abertas

| Decisão | Direção sugerida, sem aprovação implícita |
|---|---|
| Identificação de login | Escolher usuário/e-mail/ambos; API atual usa e-mail |
| Entrada de membros | Administrador cria contas inicialmente; solicitação/convite depois |
| Poder administrativo sobre projetos | Separar gestão da instalação de acesso ao conteúdo |
| Gestão de tokens por membros | Cada pessoa gerencia suas conexões, dentro do acesso autorizado |
| Token: validade, criação de projetos e aprovação | Definir padrões e comportamento de sessões já abertas |
| Senha esquecida/administrador sem acesso | Recuperação local sem depender de serviço de e-mail obrigatório |
| Rede e transporte | Configuração explícita, autenticada, com solução local de HTTPS |
| Exclusão/transferência/backup | Definir consequências e recuperação antes de oferecer os botões |
| Editor novo | Documento próprio para alcance, desenho e integração de operações |

## 15. Verificação deste documento

Conferidos routes/auth.ts, services/auth.ts, services/agents.ts, http/guards.ts e o endereço de
escuta do servidor, além do estado registrado em PASSAGEM.md. Documento não altera código,
login, rede ou editor. Não foram feitos testes entre computadores nem novas execuções da suíte.
Última suíte anterior:555 testes passando,0 falhas/pulados; typecheck limpo. Isso não é validação
das telas e capacidades propostas aqui.
