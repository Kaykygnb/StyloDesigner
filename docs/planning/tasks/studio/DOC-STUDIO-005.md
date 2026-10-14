# DOC-STUDIO-005 — Redesign visual e identidade do Studio

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 02:02 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

O proprietário quer refazer toda a apresentação do Studio para criar um ambiente mais bonito, agradável, expressivo e cheio de detalhes para o usuário humano: o “fru-fru” deve aparecer em identidade, acabamentos e interações. Esta é uma intenção de produto autorizada para registro, não evidência de defeito em todas as telas nem um redesign já executado.

DOC-STUDIO-003 investiga dificuldades reais de uso e corrige problemas reproduzidos; seu escopo exclui redesign completo sem justificativa. DOC-STUDIO-001 trata paridade Studio/MCP. Nenhuma delas representa a direção estética ampla solicitada aqui. Esta proposta complementa essas tarefas sem mudar seus responsáveis ou estados.

## Objetivo

Construir uma identidade visual consistente para toda a interface humana do Studio, com hierarquia clara, acabamento cuidadoso, personalidade e pequenas interações agradáveis. A estética deve tornar o trabalho mais acolhedor e prazeroso, mantendo as ações compreensíveis, o editor funcional e as permissões existentes.

## Escopo

- Incluído: login/setup/troca de senha; projetos; biblioteca; conta; administração e conexões; estrutura do editor, barras, navegação, painéis, inspector, menus, diálogos e apresentação dos controles de exportação/comentários/versões existentes.
- Incluído: cores, tipografia, espaçamento, densidade, bordas, cantos, sombras, ícones, hierarquia, temas existentes e consistência entre telas.
- Incluído: detalhes decorativos coerentes com a identidade; estados vazios/carregamento/erro/sucesso; hover, foco, seleção, transições, animações e feedback de pequenas interações.
- Incluído: desktop e celular, acessibilidade, redução de movimento e verificação de desempenho proporcional ao que mudar.
- Fora do escopo: mudar o conteúdo/estilo dos documentos que os usuários desenham, nomes/schemas MCP, autenticação/autorização, persistência, migração de backend ou criação de funcionalidades novas por demanda estética.
- Fora do escopo desta criação: implementar telas, produzir mockups, escolher uma identidade final ou executar auditoria visual. Tudo isso será trabalho futuro da tarefa assumida.

## Módulo e contratos afetados

- Responsabilidade principal: studio/design e experiência humana; prioridade P1.
- Arquivos potenciais: apps/studio/src/styles/, ui/, screens/, editor/ e lib/i18n.ts; documentação de fundamentos/componentes e testes GUI conforme mudanças reais.
- Contratos: manter endpoints, regras de conta/projeto, atalhos e operações existentes; mudanças de navegação/interação devem ser explícitas e verificadas, sem reduzir autorização do servidor.
- Relacionadas: [DOC-STUDIO-003](DOC-STUDIO-003.md) oferece evidências de usabilidade; [DOC-STUDIO-001](DOC-STUDIO-001.md) cobre paridade; [DOC-QA-001](../qa/DOC-QA-001.md) prepara avaliação humana independente.
- Testes relacionados: tests/studio-ui.test.js, tests/e2e/studio-login-fluxo.mjs, tests/e2e/studio-admin-fluxo.mjs e jornadas de [QA exploratório](../../../qa/TEST-JOURNEYS.md).

## Dependências, riscos e bloqueios

- Dependências de execução: direção visual acordada com o proprietário antes de uma migração ampla de telas; critérios de comparação e escopo por etapa definidos. Relatórios QA serão insumos quando existirem, sem exigir que DOC-STUDIO-003 esteja concluída para iniciar o planejamento visual.
- Coordenação: consultar backlog/remoto e responsável da DOC-STUDIO-003 antes de tocar CSS/componentes compartilhados; não implementar simultaneamente no mesmo arquivo sem coordenação pelo protocolo.
- Riscos: ornamentação prejudicar leitura/foco; animações distrair ou tornar interação lenta; CSS global afetar canvas/inspector; redesign esconder ações/permissões; misturar preferência estética com defeito reproduzido.
- Bloqueios atuais: nenhuma direção visual final, baseline de capturas ou sessão de avaliação desta proposta foi produzida; registrar essas etapas antes da implementação ampla.

## Etapas de execução propostas

1. **Direção visual:** reunir referências/preferências, definir personalidade e apresentar alternativas concretas com telas representativas, incluindo login, projetos e editor. Registrar decisão do proprietário e seus motivos.
2. **Fundamentos e componentes:** estabelecer tokens/fundamentos reutilizáveis e estados de botões, campos, cards, navegação, menus e diálogos; documentar tipografia, cores, espaçamento e movimento.
3. **Telas:** migrar por grupos revisáveis, começando pela entrada/projetos e avançando para biblioteca/conta/administração e estrutura do editor. Comparar antes/depois e manter o aplicativo utilizável a cada etapa.
4. **Detalhes e animações:** acrescentar acabamentos, estados vazios, feedback e transições coerentes; oferecer experiência equivalente com prefers-reduced-motion e não bloquear ações essenciais.
5. **Validação humana:** proprietário/Work percorre jornadas escolhidas em ambiente autorizado, registra relatório real e avalia tanto funcionalidade quanto direção estética. Triar defeitos/usabilidade/sugestões conforme o processo QA; não converter toda preferência em tarefa obrigatória.

Os marcos abaixo seguem o protocolo de engenharia. As etapas visuais serão detalhadas no planejamento e implementadas incrementalmente no marco #3; esta lista não declara progresso executado.

## Critérios de aceitação

- [ ] Direção visual documentada com referências, telas representativas e decisão registrada do proprietário; preferências explicitadas, sem assumir que “bonito” tenha um único significado.
- [ ] Fundamentos/tokens e componentes reutilizáveis aplicados às telas do escopo; variantes/estados e temas existentes consistentes; pendências de migração registradas explicitamente.
- [ ] Entrada, projetos, biblioteca, conta/administração e estrutura do editor revisadas com evidências reais antes/depois; navegação e ações essenciais continuam funcionando por perfil.
- [ ] Detalhes decorativos e movimento reforçam identidade/feedback; redução de movimento respeitada; animações não atrasam resposta de cliques/teclado ou escondem informação essencial.
- [ ] Desktop (1440×900) e celular (390×844), foco/teclado, rótulos e contraste do texto alterado verificados; rolagem intencional do canvas distinguida de overflow da interface; limitações de touch/browser registradas.
- [ ] Login/senha obrigatória/logout, menus por papel da conta, abertura/salvamento, edição, undo/redo e exportação cobertos por regressões apropriadas às mudanças; nenhum conteúdo de documento real alterado pela migração estética.
- [ ] Impacto de estilos/assets/animações no carregamento e interação medido quando relevante, com baseline e comparação; nenhum ganho de desempenho inventado.
- [ ] npm run typecheck, npm test, npm run build, npm run test:e2e, inventário/check e validador documental aprovados após implementação; matriz de regressão, histórico e handoff atualizados.
- [ ] Avaliação humana da estética/usabilidade registrada com [relatório QA](../../../qa/REPORT-TEMPLATE.md), contexto/commit/jornadas/evidências e decisão final do proprietário; problemas confirmados triados sem duplicar DOC-STUDIO-003.

## Marcos

### #1 — Investigação

- Estado: pendente
- Responsável: [Não atribuído]
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

### 2026-10-14 02:02 UTC — [Codex] — criação

- Investigado: backlog e escopos de DOC-STUDIO-001/003 e QA; ID DOC-STUDIO-005 disponível; solicitação explícita de registrar redesign amplo.
- Alterado: proposta com direção visual, componentes, telas, detalhes/movimento e avaliação humana; sem implementação ou assunção.
- Arquivos: este documento e BACKLOG.md.
- Testes: validação documental e links antes da publicação; testes funcionais não necessários para criar a proposta.
- Resultado: Proposta, responsável não atribuído e marcos 0/5. Nenhuma estética escolhida, captura/resultado QA produzido ou tela alterada.
- Próximo passo: participante assume pelo protocolo, coordena com DOC-STUDIO-003 e desenvolve direção visual para avaliação do proprietário.

### 2026-10-14 08:40 UTC — [Claude Code] — nota (sem assumir)

- Investigado: diretriz humana §5 (remake visual) e §17.
- Resultado: a diretriz amplia o escopo para canvas, camadas, guias/réguas, atalhos, acessibilidade e desempenho com documentos grandes, e proíbe reescrita do editor sem plano revisado e autorização. Esta tarefa segue Proposta, sem dono. Ordem sugerida em [EVOLUCAO.md](../../../architecture/EVOLUCAO.md): DOC-STUDIO-003 antes, direção visual aprovada pelo proprietário, depois telas por grupos.

## Rollback

Implementar a migração futura por etapas reversíveis; reverter somente mudanças da etapa com regressão, preservando evidências e histórico. Esta proposta só acrescenta documentação e não altera o produto.
