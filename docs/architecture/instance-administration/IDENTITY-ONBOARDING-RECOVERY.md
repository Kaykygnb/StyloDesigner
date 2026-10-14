# Identidade, onboarding e recuperação — plano técnico

Fonte normativa: [21 decisões/diretrizes humanas na ADR 0002](../adr/0002-self-hosted-administration.md). Fotografia de implementação: beta 50a8d00; registro não muda runtime. Identificadores HD preservam autoria humana; as soluções abaixo são recomendações técnicas. Nenhum SMTP, login federado ou mecanismo offline foi implementado nesta rodada.

## Conflitos e transição

| Requisito | Estado atual / conflito | Engenharia autorizada agora |
|---|---|---|
| Conta e senha em todo uso humano | main.ts:111 accounts padrão, mas STYLO_AUTH=local e identity.ts:20/27 dão acesso sem senha; localUser técnico OWNER criado em main.ts:114/auth.ts:98 | Inventariar runtime/GUI/MCP/scripts/tests e dados ligados à identidade técnica. Planejar migração/compatibilidade; não remover env/conta técnica agora |
| Primeiro OWNER principal protegido | setup cria role OWNER comum; schema User só role, sem relação de autoridade principal; count/create separados | Validar proteção/concorrência em fixtures e desenhar representação/invariantes/migração. Não presumir principal como menor UUID, primeiro timestamp ou e-mail coletivo |
| Só principal concede OWNER | routes/auth.ts:83/94 permite qualquer OWNER criar/promover OWNER | Registrar incompatibilidade e expectativas de autorização específicas após identificação segura de principal |
| Titularidade institucional | User tem e-mail pessoal; sem cadastro distinto de instituição/principal | Comparar metadados de instância com entidades novas; contato empresarial não autentica nem substitui pessoa administradora |
| Administração scoped/progressiva | Global adminOf amplo; membership por projeto já existe; não há setores/tenants | Mapear capabilities/contexto por conjuntos de projetos antes de criar hierarquia obrigatória; não dar leitura privada global |
| Recuperação por e-mail GUI | Reset temporário por admin e troca própria existentes; nenhum serviço SMTP/recovery-token identificado | Projetar tokens e envio/gui/cofre com testes isolados; envio real só com destinatário/credenciais expressamente autorizados |
| Recuperação offline/transferência | Sem procedimento completo identificado. Em 2026-10-14 o proprietário escolheu códigos offline de uso único e listou os requisitos da transferência. O procedimento de emergência continua a projetar | Desenhar em DOC-SERVER-010. Não tratar acesso ao banco como recuperação. Não implementar nesta atualização de registro |

### Plano de migração local (DOC-SERVER-009)

1. Inventário de contas técnicas, projetos/slug/memberships, agentes/grants/ownerId, notas/autoria, assets e segredos; setup ignora LOCAL_EMAIL, logo “primeira conta” significa conta humana do provisionamento autorizado.
2. Propor estado de instalação e principal referenciado por identidade individual estável, com invariantes transacionais. Relação singular de principal não proíbe múltiplos usuários role OWNER. Modelo ainda sujeito a revisão técnica; principal não é dono do software.
3. Autenticar/provisionar legitimamente operador antes de atribuir dados legados; provar colisões de nomes,ownership e grants, autoria preservada e retorno seguro. Não transformar todo OWNER técnico em pessoa principal silenciosamente.
4. Ensaiar em cópias descartáveis com checksums/contagens e gates de restore DOC-DB-001. Proteger segredos/config/blobs e preservar histórico; não resetar banco para “resolver” identidade.
5. Revisar compatibilidade de fixtures locais/scripts/stdio e staged depreciação. Uso humano permanente sem conta está fora do alvo; caminho legado temporário e fixture sintético não é exceção de produto aprovada. Retirada do runtime só após plano/testes/review, não neste registro.

### Onboarding progressivo (DOC-STUDIO-006 e SERVER-008)

Reutilizar Login/setup/Home/WorkspacePanel. Tela guiada esclarece uso pessoal/equipe/empresa, provisionamento autorizado, nome da pessoa e contatos institucionais opcionais. Perfis só mudam apresentação e sugestões: mesma identidade, mesmo core, sem novas edições/tenants. Campos empresariais e setores não são pré-requisito de uso individual. Primeiro visitante da rede não pode provisionar livremente; escolher mecanismo de prova do instalador com testes de concorrência.

Depois, revelar pessoas, administradores e sócios conforme necessidade pela GUI, sem recriar instalação/projetos. Criar convite/e-mail é evolução distinta de criação de conta existente. Transferência da autoridade principal exige procedimento explícito, prova de controle e continuidade; proteção principal não deve bloquear sucessão legítima. Não compartilhar senha institucional entre operadores.

## Recuperação por e-mail e configuração de envio (DOC-SERVER-010)

Desejo/requisitos humanos definidos; desenho ainda proposto. E-mail opcional, contas locais operam offline. Recuperação depende de endereço verificável e envio configurado; não usar SMTP como dependência de todo login.

Propor segredo aleatório de alta entropia, somente hash no banco, vínculo a conta/finalidade, TTL, consumo único atômico e invalidação coerente. Mensagens de pedido uniformes para evitar enumeração, limites por IP/conta/instância e auditoria sem token/senha; URL de recuperação baseada em origem confiável, não Host arbitrário. Definir efeito sobre sessões sem antecipar política completa. Reset autenticado por administrador já existe, mas não cobre perda de todos os acessos e não autoriza tomar conta principal.

GUI administrativa deve conter SMTP customizado, assistência de provedor, opções TLS/porta/auth, salvar sem revelar segredo, teste de conexão separado de teste de envio, diagnóstico redigido e estados claros. Teste de envio usa destinatário confirmado e limites; nunca envia automaticamente durante auditoria ou checagem de credencial. Validar destinos/headers para prevenir SSRF/injeção e abuso de relay; operação avançada não exige editar JSON.

Guardar credenciais em serviço protegido existente onde adequado; não equiparar máscara na resposta a cifragem em repouso. Chave de cifragem/rotação/backup ainda precisa de política; OAuth de SMTP e OAuth de login federado têm finalidades diferentes. Não solicitar login Google/Vich Hub ou client secrets nesta rodada.

### Alternativas offline

Em 2026-10-14 o proprietário escolheu códigos offline de uso único, com proteção adequada. A linha abaixo deixa de ser “não escolhida”. O procedimento excepcional de emergência continua a projetar. As outras linhas não foram escolhidas.

| Alternativa | Vantagem | Risco / validação necessária |
|---|---|---|
| Códigos de recuperação individuais, hash/uso único | Sem internet; usuário guarda prova fora da máquina. **Escolhida em 2026-10-14 para o OWNER principal** | Perda ou furto, reemissão, vínculo com o principal. Desenhar sem tratar acesso ao banco como recuperação |
| Procedimento local do operador com prova de controle da instalação | Recupera caso sem todos admins/e-mail; combina com self-hosted | Acesso ao SO pode já alcançar DB/chaves; definir registro, backup e transferência sem backdoor remoto ou senha fixa |
| Outro OWNER ajuda pelo fluxo aprovado | Facilita empresa com sócios | OWNER adicional não pode tomar principal; assistência não equivale a reset arbitrário ou concessão de OWNER |
| Restaurar backup verificado | Recuperação de desastre de dados | Não é mecanismo geral de senha; pode reintroduzir credenciais/sessões antigas, requer política e conjunto completo |

Transferência legítima é requisito. Em 2026-10-14 o proprietário definiu os seis passos (autenticação reforçada, sucessor indicado, aceite, operação atômica, auditoria, sessões). O procedimento excepcional de emergência continua a projetar. Não acrescentar quórum ou prazo que ele não pediu. Implementação federada permanece possibilidade futura sem prioridade imediata; Vich Hub requer verificação de protocolo/compatibilidade, não assumir OAuth/OIDC existente.

## Fronteiras de autorização para continuar

Permitido agora: registro, investigação/reprodução descartável, desenho técnico/review, testes e correções pequenas comprovadas dentro de tarefa autorizada; continuar restore existente. Não autorizado genericamente: remoção destrutiva local, migração de produção, implantação integral de SMTP/tenancy/principal, envio real e grandes refatorações. Quando decisão aberta bloqueia efeito específico, registrar e seguir trabalho independente, não paralisar projeto.

## Provedores de envio — pesquisa oficial, não interoperabilidade testada

Fontes consultadas por recovery_research em **2026-10-14**, HTTP200; nenhuma conta conectada ou mensagem enviada. Restrições variam por conta/tenant/política; não prometer senha comum ou fluxo OAuth universal.

| Provedor | Métodos documentados e limites | Fonte oficial |
|---|---|---|
| Gmail pessoal | SMTP XOAUTH2; senha de app quando 2SV e elegibilidade permitem. Senha de app não é senha comum Google; restrições de organização/Advanced Protection/security keys podem impedir opção | [App passwords](https://support.google.com/accounts/answer/185833?hl=en), [XOAUTH2](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol) |
| Google Workspace | Gmail SMTP/app password elegível ou relay administrado; relay depende de política/IP e não serve universalmente Gmail pessoal. Less secure apps/senha comum não suportadas desde 2025-05-01 segundo guia | [Envio SMTP Workspace](https://support.google.com/a/answer/176600?hl=en), atualização informada 2026-10-09 |
| Microsoft365/Exchange Online | SMTP AUTH depende de tenant/mailbox/security defaults; OAuth/XOAUTH2 exige app/consentimento/escopos. Não recomendar desligar segurança para passar teste | [SMTP AUTH](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission), [SMTP OAuth](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth) |
| Outlook.com | smtp-mail.outlook.com:587 STARTTLS, OAuth2/Modern Auth documentado; orientação de app password não prova Basic SMTP universal | [Configurações Outlook.com](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040) |

[Anúncio atualizado Microsoft](https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835), publicado 2026-01-27/modificado 2026-01-29: Basic SMTP permanece inalterado até dezembro2026; fimdezembro desabilitado por padrão em tenants existentes com possibilidade administrativa de habilitar; novos tenants depois desse marco com OAuth como método suportado e Basic indisponível por padrão. Data de remoção definitiva será anunciada no segundo semestre2027. Não afirmar que Basic já foi removido em março2026; revalidar fonte antes de implementar.

OAuth de envio pode exigir verificação/registro externo e refresh token; escopo Gmail mail.google.com é amplo, Gmail API granular é alternativa técnica a avaliar. Isso não autoriza login federado no Stylo. Assistente pode orientar preparo externo necessário, mas a configuração comum deve continuar GUI, sem exigir edição de arquivo.

`services/secrets.ts` oferece AES-GCM, mas o set atual é por usuário/provedor e limita a500 caracteres. Reutilizar primitivas sem truncar refresh token nem vincular envio institucional à permanência de uma pessoa por acidente; armazenamento/autoridade/rotação precisa projeto. Teste GUI distingue conexão/autenticação, aceitação SMTP e recebimento confirmado; aceitação não prova entrega.

Destino SMTP configurável cria risco SSRF/relay: impedir metadata/link-local/rebinding, respeitar exceção explícita de relay institucional privado em vez de proibir toda rede privada indiscriminadamente. Diagnóstico deve redigir segredo/AUTH/token/URL de recuperação. Nenhum envio real autorizado por este registro.
