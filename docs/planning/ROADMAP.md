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
