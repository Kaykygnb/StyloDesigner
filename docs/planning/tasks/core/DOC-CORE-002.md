# DOC-CORE-002 — Matriz de exportação e warnings

Responsável: [Muse Spark]
Estado: Em andamento
Início: 2026-10-14 01:05 -03:00
Última atualização: 2026-10-14 01:05 -03:00
Progresso: 0/5 marcos (0%)
Participantes: [Muse Spark]

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
- Estado: em andamento
- Responsável: [Muse Spark]
- Atividades executadas: assunção conforme §2 após 007 ficar bloqueada em decisão humana; leitura de BACKLOG, DOC-CORE-001 (concluída, padrão de inventário + limites), CAPABILITIES; verificação de duplicação (001 = catálogo de ferramentas; esta = matriz por formato de exportação; sem sobreposição).
- Arquivos alterados: este documento e BACKLOG.md (assunção).
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

### 2026-10-14 01:05 -03:00 — [Muse Spark] — assunção

- Investigado: protocolo §1; BACKLOG (P1 livre, dependência DOC-CORE-001 concluída, sem bloqueios conhecidos); DOC-CORE-001 (padrão gerador + drift check + limites "menção textual não é cobertura"); 007 segue bloqueada em ADM-DEC-05/07/09 sem sobreposição de escopo.
- Alterado: responsável [Muse Spark], Estado Em andamento, #1 em andamento. Sem runtime.
- Arquivos: esta tarefa, `docs/planning/BACKLOG.md`.
- Testes: ainda não executados.
- Resultado: tarefa assumida; investigação de código de exportação autorizada (leitura + testes existentes, sem mudar formato).
- Próximo passo: mapear `export_html/export_site/export_zip`, `site-export.ts`, `export-react.ts`, warnings/limites e testes `exportacao/site-export/export-react/export-zip-http`.

## Handoff atual

Preparado por: [Muse Spark]
Destinatário: [Próximo agente / revisor humano]
Estado: Assumida; investigação em curso
Marco atual: #1 — Investigação
Última atualização: 2026-10-14 01:05 -03:00
Commit de referência: `9e1fb6c` na branch `v0.1.0-beta`

### Estado atual

Tarefa assumida por [Muse Spark]. #1 em andamento, #2-#5 pendentes. Nenhum código alterado além deste documento e BACKLOG.

### Decisões tomadas

Seguir o padrão da DOC-CORE-001 (matriz verificável + referências de teste como candidatas, não certificação); sem mudar formato exportado (fora do escopo).

### Arquivos envolvidos

Esta tarefa, `docs/planning/BACKLOG.md`; a ler: `packages/core/src/tools/runner/export.ts`, `packages/core/src/site-export.ts`, `packages/core/src/export-react.ts`, `packages/core/src/tools/schema.ts:640-680`, testes `exportacao/site-export/export-react/export-zip-http`.

### Evidências e testes

Ainda sem evidências executadas nesta assunção.

### Pendências

Concluir #1 (mapa formato → operação/código/warnings/limites/testes) e #2 (formato da matriz e local da doc).

### Próximas ações recomendadas

1. Ler código de exportação e registrar warnings/limites por formato.
2. Rodar testes de exportação pertinentes e registrar resultados.
3. Produzir matriz sem alterar runtime.

### Riscos e cuidados

Não confundir warning implementado com garantia de publicação; não certificar cobertura por simples referência de teste (lição da 001).

### Condições para conclusão

Critérios de aceitação cumpridos: cada formato com código/entrada/saída/warning/teste; limites registrados; lacunas externas marcadas não verificadas.

## Rollback

Remover somente este documento e a linha do backlog antes de qualquer execução; preservar o histórico da decisão em uma atualização documental.
