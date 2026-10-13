# DOC-CORE-002 — Matriz de exportação e warnings

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-13 00:00 -03:00
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

Exportação HTML, React e ZIP têm warnings e limites em módulos diferentes; o risco por formato não está indexado em uma matriz única.

## Objetivo

Relacionar cada formato de exportação a operação, código, warnings, limites e testes executados.

## Escopo

- Incluído: HTML, React, ZIP, tokens, assets, fontes e warnings.
- Fora do escopo: mudar o formato exportado.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: core/exportação.
- Módulos relacionados: server/routes/projects, Studio ExportPanel.
- Contratos/interfaces: `export_html`, `export_site`, `export_zip` e endpoints de publicação.
- Testes relacionados: `exportacao`, `site-export`, `export-react`, `export-zip-http`.

## Dependências, riscos e bloqueios

- Dependências: DOC-CORE-001.
- Riscos: confundir warning implementado com garantia de publicação.
- Bloqueios: nenhum conhecido.

## Critérios de aceitação

- [ ] Cada formato tem código, entrada, saída, warning e teste referenciados.
- [ ] Limites de bytes, paths e assets estão registrados.
- [ ] Lacunas externas permanecem marcadas como não verificadas.

## Marcos

### #1 — Investigação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #2 — Planejamento
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #3 — Implementação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #4 — Testes
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #5 — Validação final
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

## Histórico de trabalho

### 2026-10-13 00:00 -03:00 — [Sistema] — criação
- Investigado: backlog apontava uma lacuna sem documento individual.
- Alterado: tarefa criada no formato colaborativo.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: Proposta não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.

## Rollback

Remover somente este documento e a linha do backlog antes de qualquer execução; preservar o histórico da decisão em uma atualização documental.
