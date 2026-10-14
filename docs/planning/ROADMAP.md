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

[Roadmap administrativo incremental](../architecture/instance-administration/ROADMAP.md) e [ADR 0002 proposta](../architecture/adr/0002-self-hosted-administration.md) atualizam as prioridades desta investigação. ADM-DEC-01 aprovou uma organização por instalação na beta. Multi-tenant não é requisito. O parágrafo abaixo desta data que ainda chamasse isso de recomendação fica superado por essa aprovação. DOC-SERVER-004/005 estão concluídas; DOC-SERVER-005 recebeu aprovação beta com ressalvas. Propostas P0 SERVER-006/007 precedem piloto público; SERVER-008 prepara hosts/origem/bootstrap e ADMIN-002 auditoria. Restore reaproveita DB-001; painel já existe, sem reconstrução paralela. Nenhuma implementação estrutural foi autorizada por esta deliberação documental.

## Retomada por diretrizes humanas HD

Registro canônico 21 HD na ADR 0002 e plano IDENTITY-ONBOARDING-RECOVERY. Conta/senha obrigatórias no alvo; principal protegido e múltiplos OWNERs, GUI progressiva e e-mail opcional definidos. ADM-DEC-01 está aprovada: uma organização por instalação na beta. Multi-tenant não é requisito. ADM-DEC-02 está aprovada: ADMIN no escopo delegado; o prazo de retenção é configuração sensível do OWNER principal. ADM-DEC-07 está aprovada: ADMIN não acessa projeto privado. ADM-DEC-08 está aprovada: restore e chave mestra ficam com o OWNER. O contrato de `project.share` (ADM-DEC-04) continua aberto. Os outros contratos abertos não foram aprovados por inferência. Sem remover legado, migrar produção ou implementar SMTP nesta rodada.

## Horizontes (2026-10-14)

Detalhe e inventário em [EVOLUTION.md](../product/EVOLUTION.md). Não são versões.

- **A.** Beta estável e alpha local. Tarefas já abertas: DOC-SERVER-006 (PR #18), DOC-SERVER-007, DOC-SERVER-008, DOC-SERVER-009, DOC-STUDIO-003, DOC-STUDIO-006, DOC-SERVER-010, DOC-ADMIN-002. Preparação da alpha: DOC-ENG-006.
- **B.** CSS, protótipo e SVG em cima do que o código já faz. O editor vetorial não se reescreve.
- **C.** Remake visual (DOC-STUDIO-005), 3D, PDF, slides e comportamento programável, como adaptadores. Propriedade organizacional, transferência e códigos offline já têm decisão e não têm implementação.

## Alpha pública local

Alvo: a pessoa instala na própria máquina, cria conta e desenha. Não é site na internet.

Entra o que já existe: layout, texto, componentes, vetor, protótipo de navegar entre telas, comentários, exportação HTML/React/tokens/zip, agentes nas ferramentas reais, contas com senha.

Não entra: 3D, PDF, PPTX, React Native, JavaScript livre, remake visual, transferência de principal, códigos offline, OWNER abrindo projeto privado, suspensão completa de agente em voo, hospedagem pública (DOC-SERVER-008).

Antes de publicar:

1. Merge da PR #17 e da PR #18. DOC-SERVER-011 concluída: o login da conta obrigatória usa nome de usuário, com e-mail opcional.
2. O que responder sem login, se o processo sair da máquina, fica no mínimo da ADM-DEC-09. O canal de eventos verifica identidade. O padrão da alpha é escutar só na máquina local.
3. `npm install` e `npm start` com Node 22 funcionam na primeira tentativa. O README da alpha não ensina entrar sem conta.
4. README com demo: conta, frame, texto ou vetor, exportar HTML.
5. Limitações conhecidas nesse README: protótipo não roda no site exportado; SVG omite o que `svgimport.js` e `svg.js` declaram; sem PDF, PPTX e 3D.
