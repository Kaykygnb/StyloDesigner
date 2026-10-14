# DOC-CORE-001 — Inventário verificável de ferramentas

Responsável: [Codex]
Estado: Concluída
Início: 2026-10-13 23:18 UTC
Última atualização: 2026-10-13 23:29 UTC
Progresso: 5/5 marcos (100%)
Participantes: [Codex]

- **Módulo:** core
- **Prioridade:** P0
- **Estado:** Concluída
- **Problema/evidência:** `schema.ts` registra catálogo e `runner.ts` monta handlers, mas não há matriz de handler, leitura/escrita, escopo, lock, undo, dependência externa e teste.
- **Objetivo:** produzir inventário gerado ou validado em teste sem duplicar descrições manualmente.
- **Escopo:** catálogo, runner, plugins e testes de contrato.
- **Fora do escopo:** mudar nomes, schemas ou comportamento.
- **Arquivos potenciais:** `packages/core/src/tools/schema.ts`, `runner.ts`, `runner/*`, testes de ferramentas.
- **Dependências:** nenhuma.
- **Riscos:** declarar cobertura por nome de teste sem verificar asserções.
- **Aceitação:** cada ferramenta tem registro, handler, modo, escopo, lock quando aplicável, limites e teste referenciado.
- **Testes obrigatórios:** catálogo, schema, autorização, resposta e um teste por família de handler.
- **Regressão:** `npm test`, `npm run typecheck`.
- **Rollback:** remover gerador/matriz sem alterar runtime.

## Critérios de aceitação verificados

- [x] 120 ferramentas registradas com origem/handler efetivo e modo/escopo/lock/undo; composição e dispatch conferidos pelo gerador/contrato.
- [x] Schemas/limites de entrada preservados no JSON; fonte do handler ligada para limites imperativos/respostas, sem alegar transcrição completa desses guards.
- [x] Cada registro referencia o teste estrutural do inventário; referências textuais de outros testes são explicitamente candidatas, não certificação de cobertura individual.
- [x] Regressões existentes de catálogo/schema/autorização/respostas/famílias executadas na suíte; novos casos de metadata, Tailwind e auditoria aprovados.
- [x] Geração determinística e check de drift na CI; índices/core/estratégia atualizados; produto preservado; typecheck, suíte e validador aprovados.

## Limites da conclusão

Concluída a entrega de inventário verificável, não uma auditoria universal de cada combinação de ferramenta/perfil/lock/undo/resposta. Dependências diretas são referências do corpo do handler; transitivas/ambientais e limites imperativos não são todos inferidos. DOC-MCP-001 e DOC-STUDIO-001 podem usar os registros para suas matrizes específicas; ausência de menção literal não comprova ausência de teste. Nenhum resultado de QA humano foi produzido.

## Marcos

### #1 — Investigação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Examinar catálogo, composição READ/WRITE, workspace.PROJECT, callers e plugins; distinguir handlers sobrescritos e cobertura textual.
- Arquivos alterados: scripts/inventário, testes/CI, package.json/lock e documentação de planejamento/core/testes.
- Evidências: 120 ferramentas, 97 core e 23 plugins; gerador anterior só descrevia argumentos; métodos homônimos existem em factories distintas.
- Testes executados: Leitura de catálogo/AST e regressões existentes; nenhuma exploração visual.
- Problemas encontrados: Sem bloqueio conhecido; não certificar comportamento por simples referência de teste.

### #2 — Planejamento

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Gerar JSON/Markdown determinísticos, com handler efetivo, schemas, modo/escopo/lock/undo, dependências diretas e referências de teste; checar drift sem alterar runtime.
- Arquivos alterados: scripts/inventário, testes/CI, package.json/lock e documentação de planejamento/core/testes.
- Evidências: Composição do runner segue ordem de spreads; workspace.PROJECT é o dispatch servidor para operações de projeto.
- Testes executados: Revisão dos contratos e riscos; menção textual não é cobertura.
- Problemas encontrados: Sem bloqueio conhecido; não certificar comportamento por simples referência de teste.

### #3 — Implementação

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: Adicionar gerador e --check, teste de contrato, gate CI, parser somente dev e teste comportamental de metadata/Tailwind/auditoria; documentação vinculada.
- Arquivos alterados: scripts/inventário, testes/CI, package.json/lock e documentação de planejamento/core/testes.
- Evidências: scripts/inventario-ferramentas.mjs, gerar-inventario-ferramentas.mjs; docs/testing/TOOL-INVENTORY.{md,json}; tests/tool-inventory.test.js e plugins.test.ts.
- Testes executados: Geração/check 120 registros; dois testes de contrato e novo teste de plugins aprovados; typecheck aprovado.
- Problemas encontrados: API AST tradicional não está exposta pelo TypeScript 7 instalado; adotado @babel/parser 7 como devDependency compatível com Node >=22. Parser 8 descartado por exigir versões mais restritas de Node; entradas não relacionadas do lock foram preservadas.

### #4 — Testes

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: executar suíte completa e contratos específicos, revisar links/registros/diff e gerar/checkar artefatos finais.
- Arquivos alterados: registros desta tarefa e documentação de testes; nenhum handler/schema do produto alterado.
- Evidências: npm test 613/613, zero falhas/cancelamentos/skips; typecheck aprovado; contrato 2/2, plugin publicação/qualidade 1/1; geração/check 120 registros; validador 16 tarefas e links locais aprovados.
- Testes executados: npm run typecheck; npm test; npm run docs:inventario; npm run docs:inventario -- --check; testes específicos; node docs/planning/validate-tasks.mjs; git diff --check.
- Problemas encontrados: aviso preexistente ResizeObserver no teste automatizado de Studio, aprovado; inventário distingue testes estruturais de referências candidatas sem afirmar cobertura geral.

### #5 — Validação final

- Estado: concluído
- Responsável: [Codex]
- Atividades executadas: critérios/limites revistos, implementação publicada na beta e handoff/backlog atualizados.
- Arquivos alterados: esta tarefa, BACKLOG.md, HANDOFF.md, docs/testing/INVENTORY.md.
- Evidências: [08a6c03](https://github.com/Kaykygnb/StyloDesigner/commit/08a6c03c801b23ad6b443c1b322a4dd8f1a469e0); artefatos em docs/testing/TOOL-INVENTORY.md e JSON; parser apenas dev, runtime do produto intacto.
- Testes executados: gates locais do #4 aprovados; checagem --check e validador repetidos antes da entrega. A CI do novo commit pode ainda estar em execução: aprovação remota não afirmada nesta conclusão local.
- Problemas encontrados: nenhuma pendência da geração/contrato; limites e lacunas da evidência descritos na seção própria, sem transformá-los em cobertura completa.

## Histórico de trabalho

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.

### 2026-10-13 23:18 UTC — [Codex] — assunção
- Investigado: backlog/handoff atuais; gerador descritivo existente, catálogo, runner, workspace e plugins. DOC-STUDIO-003 segue sem exploração.
- Alterado: responsável/estado; janela de edição scripts/inventário/teste de contrato, sem mudar nomes/schemas/runtime.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: leitura inicial; implementação/validação pendentes.
- Resultado: P0 assumida; gerador existente não fornece dispatch/políticas/cobertura auditável.
- Próximo passo: gerar registros a partir de AST/catálogo, falhar em handler ausente e distinguir menção textual de cobertura.

### 2026-10-13 23:26 UTC — [Codex] — #1–#3 inventário e contratos

- Investigado: fontes de 120 registros, origem real dos handlers e limitações de dependência/cobertura. schema.ts e funções de produto preservados.
- Alterado: inventário gerado, comando/check/CI, teste de drift/dispatch e caso comportamental de três famílias de plugins; parser somente desenvolvimento.
- Arquivos: scripts, docs/testing/TOOL-INVENTORY.*, tests/tool-inventory.test.js, tests/plugins.test.ts, package.json/lock, CI e índices/documentação.
- Testes: geração/check e testes específicos aprovados; typecheck aprovado; npm test em andamento.
- Resultado: matriz rastreável com esquema/limites de entrada e links; dependências transitivas e cobertura universal não afirmadas. Todas as linhas referenciam o teste estrutural do inventário; referências de comportamento são candidatas.
- Próximo passo: conferir suíte completa, fechar marcos com evidência e publicar.

### 2026-10-13 23:29 UTC — [Codex] — #4–#5 validação e entrega

- Investigado: resultados finais e contrato dos artefatos; não confundir menções com asserções de comportamento.
- Alterado: tarefa concluída 5/5; backlog/handoff e contagem factual da execução no inventário de testes atualizados; histórico anterior preservado.
- Arquivos: documentação de planejamento e docs/testing/INVENTORY.md; entrega de tooling em 08a6c03.
- Testes: 613/613, zero falhas/cancelamentos/skips; typecheck, geração/check, contrato/plugin específicos, links, validador e diff aprovados.
- Resultado: inventário determinístico e CI com gate de drift; fontes e limites registrados. Nenhuma alteração funcional ou exploração visual.
- Próximo passo: DOC-MCP-001 e DOC-STUDIO-001 podem partir desta base; revisão visual aguarda sessão humana autorizada e DOC-SERVER-005 permanece com Kimi.

## Handoff atual

Preparado por: [Codex]
Destinatário: [Próximo participante]
Estado: Concluída — inventário entregue
Marco atual: #5 — Validação final concluída
Última atualização: 2026-10-13 23:29 UTC
Commit de referência: `08a6c03c801b23ad6b443c1b322a4dd8f1a469e0`

### Estado atual

120 registros gerados/validados, 97 core e 23 plugins; runtime preservado. Gates locais aprovados; conclusão é do inventário, não da cobertura universal.

### Decisões tomadas

Resolver composição e dispatch de projeto; ler AST sem executar handlers; schemas reais no JSON; referências e dependências com limites explícitos. Parser Babel 7 como devDependency por compatibilidade com Node >=22 e API tradicional ausente no TypeScript 7.

### Arquivos envolvidos

scripts/inventario-ferramentas.mjs, scripts/gerar-inventario-ferramentas.mjs; TOOL-INVENTORY.md/JSON; testes de contrato/plugins, package/lock, CI e documentação.

### Evidências e testes

Commit 08a6c03; npm test 613/613; typecheck; geração/check 120 registros; contrato 2/2 e plugin 1/1; links e validador 16 tarefas aprovados. Logs locais /tmp/stylo-inventory-*.log. CI remota ainda deve ser consultada; não alegar aprovação antes de terminar.

### Pendências

Nenhuma da geração/contrato. Matrizes MCP/paridade e auditoria de cobertura/limites específicos continuam trabalho próprio; não presumir que todo teste candidato cobre toda ferramenta. QA humano não executado.

### Próximas ações recomendadas

Assumir DOC-MCP-001 ou DOC-STUDIO-001 pelo protocolo; usar registros/schema e revisar asserções dos testes relevantes. Ao mudar catálogo/handlers/referências, rodar npm run docs:inventario e -- --check.

### Riscos e cuidados

Não editar artefatos manualmente, nem remover o gate por drift sem regenerar. Dependências transitivas não inferidas; ordem de composição importa. Preservar trabalho de Kimi e sessão QA orientada pelo proprietário.

### Condições para conclusão

Critérios de inventário atendidos e entrega publicada; não altera a condição das tarefas dependentes automaticamente.
