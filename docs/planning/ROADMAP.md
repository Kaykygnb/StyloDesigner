# Roadmap de engenharia

## Agora

- validar no GitHub a CI da beta com tipos, testes/Chromium, build e formato documental já implementados localmente (DOC-ENG-001);
- revisar a correção de datas/ordem dos backups e testes portáveis de snapshots/restore (DOC-SERVER-002; validação local aprovada);

- gerar inventário de ferramentas e matriz de contrato;
- adicionar paridade Studio/MCP para operações críticas;
- testar PostgreSQL em ambiente descartável;
- documentar/automatizar restore sem dados de produção.

## Próxima rodada de polimento (proposto)

1. Preparar servidor e dados isolados no job E2E administrativo; só torná-lo obrigatório após execução real aprovada.
2. Medir carregamento do Studio e avaliar separação de código: o build local de 2026-10-13 em Node 24 gerou 857,06 kB de JavaScript (248,14 kB gzip) e avisou sobre import dinâmico ineficaz em `AutoLayoutSection.tsx`. Isso é evidência de tamanho do pacote, não de lentidão percebida.
3. Priorizar correções de experiência a partir do fluxo real em desktop e mobile, com evidência antes/depois e testes proporcionais ao risco.

Essas propostas ainda não têm implementação ou validação; cada uma deve seguir TASK-PROTOCOL.md antes de ser assumida.

## Depois

- cobertura visual em desktop e mobile;
- observabilidade de renderer, locks e latência de ferramentas;
- avaliar extração do renderer somente após profiling.

## Decisão pendente

Não foi aprovada migração para microserviços. A decisão atual é manter monólito modular.
