# ADR 0002 — Administração de instâncias self-hosted

## Status

**Proposta para deliberação humana**, 2026-10-14, beta `7055b65`. Não implementada nem aprovada como arquitetura definitiva. A aprovação humana específica de DOC-SERVER-005 vale apenas para os dois PUT existentes, conforme seção abaixo. Mantém [ADR 0001](0001-modular-monolith.md); não a substitui.

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

Recomendar **A na beta**, organização como contexto operacional único, sem tabela fictícia de tenant. Formalizar administração como domínio interno composto sobre identity/auth/agents/config/backups/operations existentes. Evoluir WorkspacePanel, preservando modo local e programação via ferramentas. RBAC atual mais regras contextuais/capacidades apenas nos pontos aprovados; não implantar motor externo de políticas ou microserviço de administração.

MCP continua transporte das ferramentas. Proteção de identidade/revogação de sessão é requisito de autorização de agentes a verificar, não pretexto para mover administração da VPS ao MCP. Não há nova integração de firewall/SO/provedor.

## Aprovação imediata já recebida

**ADM-DEC-00 — Aprovada pelo proprietário humano nesta sessão, exclusivamente para beta:** OWNER e ADMIN podem modificar configurações globais atualmente protegidas por identity.adminOf; MEMBER e anônimos não. Preservar testes de autorização, ausência de mutação parcial e credenciais. Registro formal na DOC-SERVER-005, implementada por Kimi e tecnicamente revisada por Codex.

Ressalva explícita: não significa que toda configuração global deva permanecer acessível a todo ADMIN indefinidamente; políticas de segurança, privilégios e credenciais críticas devem ser avaliadas separadamente. Não é certificação geral de segurança, aceite de multi-tenancy ou aprovação dos demais poderes alcançáveis nas rotas atuais.

## Decisões humanas pendentes

| ID | Deliberação | Recomendação inicial / implicação |
|---|---|---|
| ADM-DEC-01 | Uma organização por instância como escopo da beta | Aprovar A; empresas independentes em instalações independentes |
| ADM-DEC-02 | Quais poderes sensíveis ADMIN recebe | Operação comum delegada; segurança/credenciais críticas/privilegios OWNER ou capacidade explícita auditada. Identificar tipos de segredo, não bloquear toda integração indistintamente |
| ADM-DEC-03 | OWNERs múltiplos, hierarquia de alvos, transferência/recuperação | ADMIN não resetar/suspender/rebaixar OWNER; proteger último OWNER ativo e definir atuação entre OWNER/ADMINs. Não assumir singleton incompatível com código atual |
| ADM-DEC-04 | Compartilhamento por agentes e teto de delegação | Separar project.share de write, migrar delegações atuais explicitamente; nunca permitir autoaumento de autoridade |
| ADM-DEC-05 | Suspensão do delegante e operações em voo | Bloquear agentes do dono suspenso por padrão proposto, revogar/revalidar sessões e definir efeito em chamadas já iniciadas |
| ADM-DEC-06 | Perfil público e bootstrap/recuperação | Instalação controlada de uso único, origem HTTPS/hosts/proxy explícitos, cookie Secure nesse perfil; recuperação fora de banda pelo operador, sem senha de emergência fixa |
| ADM-DEC-07 | Acesso excepcional a conteúdo privado de projeto | Não conceder acesso universal por ser ADMIN; exceção só com decisão explícita, justificativa e auditoria |
| ADM-DEC-08 | Backup, chave e poderes de restore | Conjunto DB/blobs/config/chave, proteção/retenção e prova de restore; quem pode restaurar/rotacionar chave mestre precisa de autoridade específica |
| ADM-DEC-09 | Auditoria e diagnósticos | Público mínimo, detalhes autenticados, retenção/consulta/exportação e audiência autorizada de presença/notificações SSE; consistência do evento com efeito e limites de inviolabilidade |

Não interpretar silêncio ou aprovação DOC-SERVER-005 como aprovação de qualquer linha pendente. Decisões reversíveis de organização documental/interface interna são recomendações técnicas; contratos de autoridade e escopo aguardam deliberação.

## Consequências e caminho de evolução

Ganha setup mais simples, continuidade com contratos existentes e administração comum pela GUI. Limita hospedagem compartilhada entre empresas numa instalação; exige múltiplas instalações e disciplina operacional. Riscos atuais não desaparecem ao escolher organização única: hierarquia OWNER, revogação de agentes, bootstrap/origem pública, backup completo e auditoria permanecem gates.

Só propor B após demanda real: ADR de migração, papéis de plataforma/organização separados, org context obrigatório e isolamento de todos os recursos, testes cruzados, quotas, restauração por tenant, rollback e migração de instâncias existentes. Preparação atual são fronteiras de domínio e documentação, sem implementar multi-tenancy.

## Validação e retorno

Aceitação documental: referências ao código/testes, revisão independente, validador e links; não teste GUI/segurança completa nem infraestrutura publicada. Hipóteses primeiro em fixtures descartáveis. Detalhes/gates no roadmap e tarefas propostas; mudanças estruturais aguardam decisões. Revisar ADR se escala/demanda contradizer A, preservando histórico de deliberação.
