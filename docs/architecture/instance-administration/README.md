# Administração de instâncias self-hosted

Deliberação documental da beta, tarefa [DOC-ADMIN-001](../../planning/tasks/administration/DOC-ADMIN-001.md). Referência de código: `v0.1.0-beta`, `7055b65f83db15f4aac3ea8a783bc8a9d4665b1e`, 2026-10-14. Código funcional não alterado nesta rodada.

A recomendação é **uma instalação por organização**, com vários usuários, projetos e agentes, preservando o monólito modular. Organização é o contexto operacional da instalação; não existe entidade tenant nova nem isolamento multi-organização implementado. Para empresas independentes, instalações independentes por enquanto.

- [Estado atual e evidências](CURRENT-STATE.md): capacidades, cobertura e riscos.
- [Arquitetura recomendada](ARCHITECTURE.md): responsabilidades, fluxos e fronteiras.
- [Matriz de permissões](PERMISSIONS.md): comportamento atual separado de proposta.
- [Roadmap incremental](ROADMAP.md): gates, prioridades e reutilização do backlog.
- [ADR 0002](../adr/0002-self-hosted-administration.md): alternativas, trade-offs e decisões humanas pendentes.

A única aprovação de autoridade desta rodada é a decisão humana explícita na [DOC-SERVER-005](../../planning/tasks/server/DOC-SERVER-005.md): OWNER/ADMIN nos dois PUT atualmente protegidos por adminOf, com ressalvas. A arquitetura aqui recomendada está **proposta**, não aprovada para implementação. Não é certificação de segurança nem comprovação de implantação pública pronta.

Não confundir papel da instalação, papel no projeto e scopes do agente. Administração não concede automaticamente acesso ao conteúdo de todos os projetos. Agentes permanecem clientes das ferramentas; administração da VPS, TLS, firewall e provedor fica fora do Stylo.
