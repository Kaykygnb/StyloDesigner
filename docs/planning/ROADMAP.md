# Roadmap de engenharia

## Agora

- CI de tipos/testes/build/documentação validada no GitHub e incorporada à beta (DOC-ENG-001 concluída);
- correção de datas/ordem dos backups incorporada à beta (DOC-SERVER-002 concluída);
- validar fluxo humano de entrada, menus por papel da conta e navegação mobile (DOC-STUDIO-002);
- executar E2E accounts isolado como job obrigatório (DOC-ENG-002);
- validar isolamento de workspace entre contas que reutilizam sid (DOC-SERVER-003);

- gerar inventário de ferramentas e matriz de contrato;
- adicionar paridade Studio/MCP para operações críticas;
- testar PostgreSQL em ambiente descartável;
- documentar/automatizar restore sem dados de produção.

## Rodada humana atual

E2E isolado de login/administração implementado e aprovado localmente; acompanhado em DOC-ENG-002. Fluxo humano, menus e mobile em DOC-STUDIO-002; vínculo conta/sid em DOC-SERVER-003.

## Próxima rodada de polimento (proposto)

1. Reproduzir gates de configuração accounts e revalidação de acesso em compartilhamentos alterados (DOC-SERVER-004 e DOC-SERVER-005; Proposto, não validado nesta rodada).
2. Medir carregamento do Studio e avaliar separação de código: o build local de 2026-10-13 em Node 24 gerou 857,06 kB de JavaScript (248,14 kB gzip) e avisou sobre import dinâmico ineficaz em `AutoLayoutSection.tsx`. Isso é evidência de tamanho do pacote, não de lentidão percebida.
3. Priorizar correções de experiência a partir do fluxo real em desktop e mobile, com evidência antes/depois e testes proporcionais ao risco.

Essas propostas ainda não têm implementação ou validação; cada uma deve seguir TASK-PROTOCOL.md antes de ser assumida.

## Depois

- cobertura visual em desktop e mobile;
- observabilidade de renderer, locks e latência de ferramentas;
- avaliar extração do renderer somente após profiling.

## Decisão pendente

Não foi aprovada migração para microserviços. A decisão atual é manter monólito modular.
