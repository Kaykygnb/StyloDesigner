# DOC-QA-001 — Preparar QA exploratório com ChatGPT Work

Responsável: [Codex]
Estado: Em validação
Início: 2026-10-13 23:02 UTC
Última atualização: 2026-10-13 23:07 UTC
Progresso: 4/5 marcos (80%)
Participantes: [Codex]

## Problema e evidências

A documentação tem estratégia/E2E e DOC-STUDIO-003 para revisão visual, mas não tem guia independente para um testador externo explorar a interface e produzir relatos reproduzíveis. O proprietário pediu a preparação documental; nenhuma sessão exploratória foi autorizada nesta tarefa.

## Objetivo

Entregar guia, catálogo de jornadas fundamentado na interface implementada, modelo de relatório e triagem rastreável, para sessões do ChatGPT Work iniciadas pelo proprietário.

## Escopo

- Incluído: docs/qa, links dos índices, registro desta tarefa/backlog/handoff e validação documental.
- Fora do escopo: exploração/auditoria visual, alterações funcionais, execução de E2E nesta tarefa, integração MCP, criação de defeitos ou resultados fictícios.

## Módulo e contratos afetados

- Responsabilidade principal: QA/documentação; prioridade P1.
- Contratos: formato documental de jornada, relatório, observação/problema e reteste; protocolo de engenharia preservado.
- Relacionadas: DOC-STUDIO-003 recebe evidências futuras, sem alterar responsável/estado/marcos; DOC-STUDIO-001 trata paridade; DOC-STUDIO-002 e DOC-ENG-002 documentam automação de login/admin; DOC-SERVER-004 trata compartilhamento ativo.
- Evidência de funcionalidades: Home/Login/WorkspacePanel, editor/Toolbar/LayersPanel/TopBar/Panels/menus/ProjectDialog, lib/actions/editing/app e testes studio-ui/e2e.

## Dependências, riscos e bloqueios

- Dependências: protocolo e documentação existentes; sem dependência técnica de MCP.
- Riscos: confundir implementação com execução exploratória, atribuir ao Work acesso a rede/GitHub não concedido ou converter preferências em defeitos obrigatórios.
- Bloqueios: nenhum para preparar documentos; ambiente/acesso/contas e autorização de QA serão fornecidos pelo humano antes de uma sessão futura.
- Janela de edição: docs/qa e esta tarefa; índices compartilhados serão publicados com verificação do HEAD remoto. Nenhuma edição de DOC-STUDIO-003 ou tarefa de Kimi.

## Critérios de aceitação

- [x] Área QA criada e vinculada ao índice principal/estratégia, reutilizando protocolo de engenharia.
- [x] Jornadas com IDs, objetivo, pré-condições, passos, resultado esperado, critérios, riscos, estado e fontes de implementação.
- [x] Guia externo descreve acesso/permissões, interface gráfica, primeira exploração sem ler implementação e tratamento de bloqueios.
- [x] Template registra contexto, reprodução, evidências reais, classificação, gravidade/impacto e limitações; nenhuma execução inventada.
- [x] Fluxo humano e rastreabilidade jornada → observação → problema → tarefa → correção → reteste documentados; triagem evita duplicatas e tarefas automáticas de sugestão.
- [ ] Apenas Markdown alterado; validador, links locais e diff revisados; publicação na beta e handoff atualizados.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Ler índice, protocolo, backlog, handoff, tarefas relacionadas, estratégia/matriz/inventário e E2E; examinar funcionalidades GUI.
- Arquivos alterados: esta tarefa e documentos/índices previstos no escopo.
- Evidências: Não existia docs/qa; fontes e escopos confirmados por leitura estática.
- Testes executados: Leitura documental/código; nenhuma execução exploratória ou E2E nesta tarefa.
- Problemas encontrados: sem bloqueio documental conhecido; execução exploratória fora do escopo.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Separar orientação externa, roteiros, modelo e armazenamento de relatos; reaproveitar protocolo de tarefas; IDs estáveis sem integração MCP.
- Arquivos alterados: esta tarefa e documentos/índices previstos no escopo.
- Evidências: Estrutura autorizada pelo proprietário e distinção de DOC-STUDIO-003.
- Testes executados: Revisão do escopo solicitado.
- Problemas encontrados: sem bloqueio documental conhecido; execução exploratória fora do escopo.

### #3 — Implementação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: criar docs/qa/README.md, WORK-GUIDE.md, TEST-JOURNEYS.md, REPORT-TEMPLATE.md e reports/README.md; vincular índice e estratégia; triagem/IDs/rastreabilidade definidos.
- Arquivos alterados: cinco documentos QA, docs/README.md, docs/testing/STRATEGY.md, esta tarefa, BACKLOG.md e HANDOFF.md.
- Evidências: catálogo de 14 jornadas com fontes da GUI, todas Não executada; pasta de relatórios sem sessão real; fluxo humano de dez passos e distinção entre categorias de observação.
- Testes executados: revisão documental estática; nenhum browser, E2E ou auditoria visual iniciado.
- Problemas encontrados: limites de acesso/perfil/upload/viewport explicitados; fonte de implementação separada para leitura posterior à primeira exploração.

### #4 — Testes

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: conferir IDs/campos, links locais, escopo Markdown e integridade da tarefa visual existente.
- Arquivos alterados: esta tarefa registra os resultados; nenhum código/teste do produto alterado.
- Evidências: node docs/planning/validate-tasks.mjs aprovou 16 tarefas; verificação Python aprovou 14 jornadas únicas, 59 links locais, todos os campos/estados e ausência de relatórios de sessão; git diff --check aprovado.
- Testes executados: validador documental; verificação estática de links/campos e arquivos; revisão do guia como roteiro de entrada externo.
- Problemas encontrados: nenhum link quebrado ou resultado exploratório inventado; verificação documental não demonstra usabilidade do produto ou acesso do Work ao ambiente.

### #5 — Validação final

- Estado: em andamento
- Responsável: [Codex]
- Atividades executadas: critérios documentais revisados; preparar commit beta e entrega do caminho do guia ao proprietário.
- Arquivos alterados: esta tarefa, backlog e handoff.
- Evidências: diff restrito a docs/**/*.md; DOC-STUDIO-003 preservada; publicação ainda pendente.
- Testes executados: repetir validador/diff após metadados finais; sem testes funcionais nesta tarefa exclusivamente documental.
- Problemas encontrados: falta registrar commit publicado antes de fechar o marco final.

## Histórico de trabalho

### 2026-10-13 23:02 UTC — [Codex] — assunção e #1–#2

- Investigado: documentos exigidos pelo proprietário, tarefas Studio relacionadas, E2E/estratégia/regressões e interfaces implementadas em 5ba7bbf.
- Alterado: tarefa documental própria assumida por autorização explícita; escopo definido e janela de edição declarada.
- Arquivos: este documento e BACKLOG.md; DOC-STUDIO-003 preservada.
- Testes: investigação por leitura; nenhum teste exploratório, navegador ou teste de produto iniciado.
- Resultado: marcos #1–#2 concluídos com fontes identificadas; #3 em andamento.
- Próximo passo: escrever documentos, validar links/protocolo e publicar.

### 2026-10-13 23:07 UTC — [Codex] — #3–#4 documentação e validação

- Investigado: coerência dos roteiros com GUI/código e testes examinados; catálogo não apresenta capacidades apenas MCP como ações gráficas.
- Alterado: cinco documentos QA, vínculo no índice/estratégia, IDs, permissões, triagem e modelo de relatório/reteste; nenhum arquivo funcional.
- Arquivos: docs/qa, docs/README.md, docs/testing/STRATEGY.md, esta tarefa, BACKLOG.md e HANDOFF.md.
- Testes: validador 16 tarefas; links/campos 14 jornadas e 59 links válidos; diff --check; somente Markdown, DOC-STUDIO-003 intacta.
- Resultado: documentação pronta e validada; sessão Work depende de iniciativa humana futura; nenhuma jornada executada.
- Próximo passo: publicar e registrar o commit para concluir #5.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Codex / próximo participante após transferência]
Estado: Aguardando publicação documental
Marco atual: #5 — Validação final
Última atualização: 2026-10-13 23:07 UTC
Commit de referência: `5ba7bbf1405f08f671aae993ff135f13143fe966`

### Estado atual

Cinco documentos QA completos e validados; nenhum resultado de sessão. Falta registrar a publicação para concluir a tarefa.

### Decisões tomadas

Work será orientado pelo proprietário, usará GUI e produzirá relatório; sem MCP residente. As fontes de implementação ficam no catálogo para mantenedores, sem exigir leitura na primeira exploração.

### Arquivos envolvidos

docs/qa/*.md, docs/qa/reports/README.md, esta tarefa, índices docs/README.md e docs/testing/STRATEGY.md, backlog e handoff geral.

### Evidências e testes

Validador: 16 tarefas válidas. Verificação estática: 14 jornadas, 59 links, apenas Markdown e DOC-STUDIO-003 intacta. Diff --check aprovado. Sem exploração ou testes do produto.

### Pendências

Commit da beta e fechamento documental do marco #5. Ambiente/contas/permissões de sessão Work permanecem a cargo do proprietário.

### Próximas ações recomendadas

Publicar os documentos na beta; registrar commit e fechar #5; fornecer docs/qa/WORK-GUIDE.md ao proprietário.

### Riscos e cuidados

Não atribuir acesso privado ao Work; não criar resultados fictícios; registrar sugestões separadamente de defeitos. Não alterar DOC-STUDIO-003.

### Condições para conclusão

Todos os critérios documentais atendidos e evidência de publicação/validação registrada.

## Rollback

Reverter apenas esta preparação documental se necessário, preservando histórico e relatos reais que vierem a existir. Nenhum código ou dado de produto modificado.
