# Roadmap de engenharia

## Agora

- CI de tipos/testes/build/documentação validada no GitHub e incorporada à beta (DOC-ENG-001 concluída);
- correção de datas/ordem dos backups incorporada à beta (DOC-SERVER-002 concluída);
- fluxo humano, menus por papel da conta e mobile validados e publicados na beta (DOC-STUDIO-002 concluída);
- E2E accounts isolado aprovado como job obrigatório no GitHub (DOC-ENG-002 concluída);
- workspace ligado à conta autenticada, com regressão aprovada para sid reutilizado (DOC-SERVER-003 concluída);

- gerar inventário de ferramentas e matriz de contrato;
- adicionar paridade Studio/MCP para operações críticas;
- testar PostgreSQL em ambiente descartável;
- documentar/automatizar restore sem dados de produção.

## Rodada humana atual

Rodada concluída nas tarefas DOC-ENG-002, DOC-STUDIO-002 e DOC-SERVER-003. Implementação 669df6e publicada diretamente na beta; CI 38471114507 aprovada em Node 22/24, build/documentação e E2E accounts.

## Próxima rodada de polimento (proposto)

1. Reproduzir gates de configuração accounts e revalidação de acesso em compartilhamentos alterados (DOC-SERVER-004 e DOC-SERVER-005; Proposto, não validado nesta rodada).
2. Medir carregamento do Studio e avaliar separação de código: o build local de 2026-10-13 em Node 24 gerou 857,06 kB de JavaScript (248,14 kB gzip) e avisou sobre import dinâmico ineficaz em `AutoLayoutSection.tsx`. Isso é evidência de tamanho do pacote, não de lentidão percebida.
3. Revisar a experiência visual e funcional para pessoas em desktop e mobile ([DOC-STUDIO-003](tasks/studio/DOC-STUDIO-003.md), Proposta): jornadas por perfil, legibilidade, foco, feedback e responsividade, com evidência antes/depois e testes proporcionais ao risco.

Essas propostas ainda não têm implementação ou validação; cada uma deve seguir TASK-PROTOCOL.md antes de ser assumida.

## Depois

- cobertura visual em desktop e mobile;
- observabilidade de renderer, locks e latência de ferramentas;
- avaliar extração do renderer somente após profiling.

## Decisão pendente

Não foi aprovada migração para microserviços. A decisão atual é manter monólito modular.

## Deliberação self-hosted (2026-10-14)

[Roadmap administrativo incremental](../architecture/instance-administration/ROADMAP.md) e [ADR 0002 proposta](../architecture/adr/0002-self-hosted-administration.md) atualizam as prioridades desta investigação. Organização única é recomendação, não decisão humana já aprovada. DOC-SERVER-004/005 estão concluídas; DOC-SERVER-005 recebeu aprovação beta com ressalvas. Propostas P0 SERVER-006/007 precedem piloto público; SERVER-008 prepara hosts/origem/bootstrap e ADMIN-002 auditoria. Restore reaproveita DB-001; painel já existe, sem reconstrução paralela. Nenhuma implementação estrutural foi autorizada por esta deliberação documental.

## Retomada por diretrizes humanas HD

Registro canônico21HD na ADR0002 e plano IDENTITY-ONBOARDING-RECOVERY. Conta/senha obrigatórias final; principal protegido e múltiplosOWNERs, GUI progressiva e e-mail opcional definidos. Tenancy e contratos abertos não aprovados por inferência. SERVER006 investigação P0 retomada1/5 com reprodução sintética; DB001 restore real retomado4/5. Novas propostas SERVER009/STUDIO006/SERVER010 cobrem recortes ausentes sem duplicarbootstrap/autoridade/QA. Sem remover legado/migrarprodução/implementarSMTP nesta rodada. Engenharia rotineira/provas isoladas prossegue sem nova deliberação geral.

## Horizontes de evolução (diretriz humana de 2026-10-14)

Detalhe, dependências, riscos e bibliotecas em [architecture/EVOLUCAO.md](../architecture/EVOLUCAO.md). Ordem de planejamento, **não cronograma aprovado**.

- **A — Beta atual:** estabilidade, correções, segurança, usabilidade, persistência, import/export existente. Inclui: fluxo exportar→abrir como teste de regressão, cliente MCP real, manual de uso na branch da beta, fatias mínimas de identidade (principal protegido, aviso de propriedade organizacional, suspensão de agentes), medição com documento grande.
- **B — Incremental:** DOC-CORE-003 (preservar dados desconhecidos + migração), DOC-CORE-004 (booleanas com curvas), DOC-CORE-005 (animação/estados/interação declarativa, CSS primeiro), DOC-CORE-006 (importar HTML + relatório de fidelidade), React com componentes, container queries.
- **C — Estrutural (exige plano revisado e autorização):** remake visual amplo (DOC-STUDIO-005), modelo declarativo completo e JS em sandbox, slides/PPTX/PDF editável, 3D com cena, React Native, multi-organização.

Decisões humanas pendentes: ver EVOLUCAO.md §7 e ADM-DEC-02 na ADR 0002.
