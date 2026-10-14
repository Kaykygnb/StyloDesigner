# DOC-CORE-002 — Matriz de exportação e warnings

Responsável: [Muse Spark]
Estado: Concluída
Início: 2026-10-14 01:05 -03:00
Última atualização: 2026-10-14 01:05 -03:00
Progresso: 5/5 marcos (100%)
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
- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: assunção conforme §2 após 007 ficar bloqueada em decisão humana; leitura de BACKLOG, DOC-CORE-001 (concluída, padrão de inventário + limites), CAPABILITIES; verificação de duplicação (001 = catálogo de ferramentas; esta = matriz por formato de exportação; sem sobreposição); leitura de `runner/export.ts`, `schema.ts:640-666`, `site-export.ts:167-209`, `export-react.ts:35-94`, `workspace/index.ts:226-237`, `routes/projects.ts:68-106`, `tools/content.ts`.
- Arquivos alterados: este documento e BACKLOG.md (assunção).
- Evidências: mapa formato→código — `export_html` = `exportHtml`+`boundedUtf8Chunk` (256 KiB padrão, máx 1 MiB); `export_site` = `exportSite`/`exportReact` + metadados, `includeContent` com teto `agentContentLimit`, binários só via zip; `export_zip` = workspace (exige scope `export`, grava antes) + URLs site/react/project; `publish` = snapshot + audit + `READY[_WITH_WARNINGS]`; warnings em `site-export.ts:62-207` (prancheta invisível, largura fixa, protótipo, links), `export-react.ts:85` (JSX fallback), `media-runtime.ts:39` (player ausente); limites `DEFAULT 256 KiB / MAX 1 MiB` (`content.ts:2-8`); sem matriz única existente (só 1 menção em CAPABILITIES).
- Testes executados: `exportacao + site-export + export-react + export-zip-http` — 32/32 aprovados.
- Problemas encontrados: conteúdo de imagem nunca vai inline no `export_site` (só metadados + hint); fontes Google via rede e JS de protótipo não executado são limites externos a marcar não verificados.
### #2 — Planejamento
- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: matriz única em `docs/modules/core/EXPORT-MATRIX.md` (doc do módulo, junto ao código): uma linha por formato (HTML, site estático, React, ZIP, tokens/fontes/assets via publish) com operação, código, entrada/saída, warnings, limites e testes. Sem gerador/drift: superfície pequena (4 ferramentas + 2 endpoints) e referências de teste são candidatas, não certificação (lição da 001). Sem mudar formato (fora do escopo).
- Arquivos alterados: este documento.
- Evidências: decisão proporcional registrada; lacunas externas (CDN Google, publicação real, JS de protótipo) marcadas não verificadas na matriz.
- Testes executados: base 32/32 da #1 continua válida.
- Problemas encontrados: nenhum bloqueio.
### #3 — Implementação
- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: criada `docs/modules/core/EXPORT-MATRIX.md` (7 formatos + 7 origens de warning + 7 limites + testes candidatos + 4 lacunas não verificadas); link na seção nova do `docs/modules/core/README.md`. Sem runtime (fora do escopo).
- Arquivos alterados: `docs/modules/core/EXPORT-MATRIX.md` (novo), `docs/modules/core/README.md`, este documento.
- Evidências: cada linha da matriz aponta código com linha; warnings transcritos do código; limites com valores e clamp.
- Testes executados: ainda não reexecutados nesta entrada (base 32/32 da #1).
- Problemas encontrados: nenhum.
### #4 — Testes
- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: reexecução com `workspace.test.ts` incluído (casos `export_zip`/permissão/`export_site` react); validador documental; `git diff --check`.
- Arquivos alterados: nenhum novo.
- Evidências: 56/56 aprovados (32 exportação + 24 workspace); validador 28 tarefas; diff só Markdown (`README.md`, tarefa + `EXPORT-MATRIX.md` novo); sem runtime, sem drift de inventário (nenhuma ferramenta citada em teste novo).
- Testes executados: `exportacao + site-export + export-react + export-zip-http + workspace`; `validate-tasks.mjs`.
- Problemas encontrados: nenhum.
### #5 — Validação final
- Estado: concluído
- Responsável: [Muse Spark]
- Atividades executadas: relidos os 3 critérios de aceitação contra a matriz; confirmados arquivos alterados; matriz de regressão sem mudança de risco (só docs); sem necessidade de ADR (nenhum contrato/fluxo alterado); regra de manutenção atendida (README do módulo linka a matriz na mesma mudança).
- Arquivos alterados: este documento.
- Evidências: critério 1 — 7 linhas de formato com operação/código/entrada-saída/warning/teste; critério 2 — 7 limites + assets/fontes; critério 3 — 4 lacunas externas marcadas não verificadas.
- Testes executados: evidências da #4 reutilizadas, sem reexecução redundante.
- Problemas encontrados: nenhum.

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

### 2026-10-14 01:05 -03:00 — [Muse Spark] — #1 concluída e #2 planejada

- Investigado: código de exportação (runner, schema, site-export, export-react, workspace, publish, content limits) e ausência de matriz única; testes de exportação 32/32.
- Alterado: #1 e #2 concluídas; sem runtime.
- Arquivos: este documento.
- Testes: `exportacao + site-export + export-react + export-zip-http` 32/32; sem regressão de formato.
- Resultado: mapa formato→operação/código/warnings/limites/testes pronto; matriz será `docs/modules/core/EXPORT-MATRIX.md`.
- Próximo passo: #3 criar a matriz; #4 rodar gates pertinentes + validador.

### 2026-10-14 01:05 -03:00 — [Muse Spark] — #3/#4/#5 concluídas, tarefa Concluída

- Investigado: critérios re-lidos contra a matriz; risco de regressão inalterado (só docs).
- Alterado: matriz criada + README linkado; 5/5, Estado Concluída.
- Arquivos: `docs/modules/core/EXPORT-MATRIX.md`, `docs/modules/core/README.md`, esta tarefa, `docs/planning/BACKLOG.md`.
- Testes: 56/56 (exportação + workspace); validador 28; `git diff --check` limpo.
- Resultado: 3/3 critérios atendidos; sem ADR (nenhum contrato alterado).
- Próximo passo: nenhum — aguardar consumo pela DOC-STUDIO-001 quando assumida.

## Handoff atual

Preparado por: [Muse Spark]
Destinatário: —
Estado: Concluída; sem pendências
Marco atual: #5 — Validação final
Última atualização: 2026-10-14 01:05 -03:00
Commit de referência: `b2f96ca` na branch `v0.1.0-beta` (matriz entra no próximo push)

### Estado atual

5/5 (100%), Concluída. Matriz publicada em `docs/modules/core/EXPORT-MATRIX.md` e linkada no README do módulo.

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
