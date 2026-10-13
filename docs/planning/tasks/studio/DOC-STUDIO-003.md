# DOC-STUDIO-003 — Revisão visual e usabilidade do Studio para pessoas

Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-13 22:42 UTC
Última atualização: 2026-10-13 22:42 UTC
Progresso: 0/5 marcos (0%)
Participantes: [Codex]

## Problema e evidências

DOC-STUDIO-002 corrigiu o cabeçalho que ocupava 491 px em uma viewport de 390 px e validou entrada, troca de senha e menus por perfil. Essa evidência cobre aquele fluxo; ainda não existe uma revisão documentada da experiência visual nas demais telas. DOC-STUDIO-001 trata paridade de operações e exclui redesign visual. Esta tarefa registra a revisão mais ampla sem afirmar defeitos ainda não reproduzidos.

## Objetivo

Revisar jornadas humanas no Studio e corrigir problemas reproduzidos de legibilidade, navegação, feedback e responsividade, com evidência antes/depois e verificação funcional.

## Escopo

- Incluído: entrada e recuperação de sessão como regressão; projetos/biblioteca, abertura e edição de documento, conta e administração conforme os perfis disponíveis; desktop e mobile; hierarquia visual, textos, contraste, foco, navegação por teclado e estados de carregamento, vazio, erro e sucesso.
- Incluído: verificar se ações visíveis funcionam, se o próximo passo é compreensível e se falhas permitem recuperação; priorizar correções por impacto na jornada.
- Fora do escopo: mudança de marca ou redesign completo sem justificativa; novos contratos de autenticação; paridade MCP (DOC-STUDIO-001); autorização no servidor (DOC-SERVER-004/005).

## Módulo e contratos afetados

- Módulo/responsabilidade principal: studio; experiência de pessoas.
- Módulos relacionados: infraestrutura E2E e documentação de regressão.
- Contratos/interfaces: preservar endpoints e regras de acesso; menus devem refletir a conta e o projeto corretamente, sem substituir autorização do servidor.
- Arquivos potenciais: `apps/studio/src/screens/`, componentes do editor, `apps/studio/src/styles/app.css`, `apps/studio/src/lib/i18n.ts`, `tests/e2e/`.
- Testes relacionados: `tests/e2e/studio-login-fluxo.mjs`, `tests/e2e/studio-admin-fluxo.mjs`; novos casos somente para riscos comportamentais relevantes.

## Dependências, riscos e bloqueios

- Dependências: DOC-STUDIO-002 e DOC-ENG-002, ambas concluídas.
- Riscos: mudanças de CSS afetarem o editor; controles sumirem por viewport ou perfil; screenshots isolados não provarem que o fluxo funciona.
- Bloqueios: nenhum conhecido; revisão ampla ainda não executada.
- Prioridade: P1; os riscos P0 de autorização permanecem prioritários.

## Critérios de aceitação

- [ ] Inventário das jornadas e telas revisadas, com perfil, viewport e resultado; limitações explicitamente registradas.
- [ ] Fluxos principais executados em desktop (1440×900) e mobile (390×844), com capturas e passos reproduzíveis; áreas deliberadamente roláveis do editor identificadas.
- [ ] Problemas observados priorizados por impacto; correções escolhidas com evidência antes/depois; pendências vinculadas a tarefas próprias quando necessário.
- [ ] Ações essenciais permanecem alcançáveis; textos e feedback orientam o próximo passo; estados vazio/erro/carregamento têm comportamento verificado quando aplicáveis.
- [ ] Controles alterados têm rótulos acessíveis e foco visível; navegação por teclado e contraste do texto alterado verificados conforme WCAG AA.
- [ ] Regressão de login, senha obrigatória, saída e permissões por perfil aprovada; editor dono de projeto continua sem administração de conta.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` e validador documental aprovados após alterações de código; histórico e matriz de regressão atualizados.

## Marcos

### #1 — Investigação

- Estado: em andamento
- Responsável: [Codex]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #2 — Planejamento

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #3 — Implementação

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #4 — Testes

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #5 — Validação final

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

## Histórico de trabalho

### 2026-10-13 22:03 UTC — [Codex] — criação

- Investigado: backlog e tarefas DOC-STUDIO-001/002; a revisão visual ampla aparecia somente como intenção no roadmap.
- Alterado: proposta específica com jornadas, critérios visuais e funcionais, evidências e regressões exigidas; nenhuma mudança de interface nesta etapa.
- Arquivos: este documento, `docs/planning/BACKLOG.md`, `docs/planning/ROADMAP.md`.
- Testes: revisão documental; validação de formato será executada antes da publicação.
- Resultado: Proposta registrada, sem marcos de execução concluídos.
- Próximo passo: assumir a tarefa pelo protocolo e investigar as jornadas; registrar problemas observados antes de implementar.

### 2026-10-13 22:42 UTC — [Codex] — assunção e #1 Investigação

- Investigado: protocolo atualizado, handoff geral, backlog e código em `48b914a`; Escopo e dependências conferidos: revisão visual ampla não duplica a paridade de DOC-STUDIO-001 nem as correções de entrada já concluídas em DOC-STUDIO-002. Revisão de telas ainda não executada.
- Alterado: responsável, estado e marco #1; janela de trabalho declarada nesta tarefa.
- Arquivos: este documento, BACKLOG.md e HANDOFF.md; nenhum código alterado nesta assunção.
- Testes: validador documental antes da publicação; gates de runtime da sessão Kimi não foram reexecutados nesta etapa.
- Resultado: tarefa assumida após atualização por fast-forward; DOC-SERVER-005 permanece com [Kimi] em validação humana.
- Próximo passo: Depois da investigação P0 de DOC-SERVER-004, executar jornadas humanas por perfil em desktop/mobile e registrar evidências antes de corrigir a interface.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante após transferência]
Estado: Em execução — investigação pendente
Marco atual: #1 — Investigação
Última atualização: 2026-10-13 22:42 UTC
Commit de referência: `48b914a5315bca4892d3f8dddf594dc13b6b98c1` na branch `v0.1.0-beta`

### Estado atual

Escopo e dependências conferidos: revisão visual ampla não duplica a paridade de DOC-STUDIO-001 nem as correções de entrada já concluídas em DOC-STUDIO-002. Revisão de telas ainda não executada.

### Decisões tomadas

Trabalhar na beta atual sem modificar a tarefa de Kimi; priorizar DOC-SERVER-004 (P0) antes da revisão visual P1. Assunção publicada para informar outros participantes antes de mudanças de código. Sem alegar lock técnico ou coordenação por mensagem.

### Arquivos envolvidos

Este documento, BACKLOG.md e HANDOFF.md. Consultar o escopo para os arquivos de implementação; ainda não alterados.

### Evidências e testes

Branch atualizada por fast-forward; tarefa sem responsável no backlog. Nenhuma reprodução nova ou teste de runtime nesta assunção. Validador documental exigido antes da publicação.

### Pendências

Marcos #1–#5; reproduções, implementação quando justificada e gates. As evidências anteriores de outras tarefas não encerram esta tarefa.

### Próximas ações recomendadas

Depois da investigação P0 de DOC-SERVER-004, executar jornadas humanas por perfil em desktop/mobile e registrar evidências antes de corrigir a interface.

### Riscos e cuidados

Consultar o remoto antes de publicar e interromper sobreposição de arquivos se outro participante assumir escopo relacionado. Preservar mudanças e revisão humana pendente de DOC-SERVER-005; nenhum segredo em evidências.

### Condições para conclusão

Critérios de aceitação desta tarefa atendidos, marcos com evidências e gates proporcionais aprovados; backlog e handoff atualizados.

## Rollback

Reverter somente mudanças implementadas nesta tarefa se houver regressão, preservando o histórico e a evidência. A proposta não altera código nem dados.
