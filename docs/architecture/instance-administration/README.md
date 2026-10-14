# Administração de instâncias self-hosted

Deliberação documental da beta, tarefa [DOC-ADMIN-001](../../planning/tasks/administration/DOC-ADMIN-001.md). Referência de código: `v0.1.0-beta`, `7055b65f83db15f4aac3ea8a783bc8a9d4665b1e`, 2026-10-14. Código funcional não alterado nesta rodada.

**ADM-DEC-01 aprovada:** uma organização por instalação na beta (single-tenant). Multi-tenant não é requisito. Vários usuários, projetos e agentes ficam nessa instalação, no monólito modular. Não existe entidade tenant e não se cria uma só por causa desta decisão. Empresas independentes usam instalações independentes.

- [Estado atual e evidências](CURRENT-STATE.md): capacidades, cobertura e riscos.
- [Arquitetura recomendada](ARCHITECTURE.md): responsabilidades, fluxos e fronteiras.
- [Identidade, onboarding e recuperação](IDENTITY-ONBOARDING-RECOVERY.md): conflitos, migração e alternativas técnicas vinculadas às decisões HD.
- [Matriz de permissões](PERMISSIONS.md): comportamento atual separado de proposta.
- [Roadmap incremental](ROADMAP.md): gates, prioridades e reutilização do backlog.
- [ADR 0002](../adr/0002-self-hosted-administration.md): alternativas, trade-offs e decisões humanas pendentes.

A aprovação beta anterior é a decisão humana explícita na [DOC-SERVER-005](../../planning/tasks/server/DOC-SERVER-005.md): OWNER/ADMIN nos dois PUT atualmente protegidos por adminOf, com ressalvas. Os 21 requisitos/diretrizes HD da nova rodada estão formalizados na ADR; contratos/mecanismos abertos não estão automaticamente aprovados para implementação. A arquitetura completa permanece parcialmente proposta. Não é certificação de segurança nem comprovação de implantação pública pronta.

Não confundir papel da instalação, papel no projeto e scopes do agente. Administração não concede automaticamente acesso ao conteúdo de todos os projetos. Agentes permanecem clientes das ferramentas; administração da VPS, TLS, firewall e provedor fica fora do Stylo.

## Atualização humana

Conta/senha obrigatórias inclusive individual, principal protegido, múltiplos OWNERs com atribuição exclusiva do principal e administração progressiva estabelecidos pelo humano. Em 2026-10-14 também ficaram aprovados: sem modo que contorne a conta; mesma fundação para uso individual e empresarial; OWNER administra secundários; códigos offline de uso único; requisitos de transferência; suspensão de usuário e agente (ADM-DEC-05); público mínimo e canal de eventos com identidade (ADM-DEC-09). O prazo de retenção é detalhe técnico na ADR e configuração sensível do OWNER principal. ADM-DEC-02 está aprovada: ADMIN no escopo delegado; política crítica, propriedade, recuperação privilegiada e credencial mestra ficam com o OWNER. ADM-DEC-07 está aprovada: ADMIN não acessa projeto privado, nem em emergência. ADM-DEC-08 está aprovada: restaurar backup e trocar ou rotacionar a chave mestra ficam com o OWNER. Ainda não está no código. Modo local sem conta é legado de transição, não experiência final aprovada. ADM-DEC-01 está aprovada: uma organização por instalação na beta (single-tenant). Multi-tenant não é requisito.
