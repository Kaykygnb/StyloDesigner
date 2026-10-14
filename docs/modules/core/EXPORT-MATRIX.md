# Matriz de exportação e warnings

Fonte de verdade operacional da DOC-CORE-002. Cada formato relaciona operação, código, entrada/saída, warnings, limites e testes. Referências de teste são candidatas, não certificação de cobertura individual (mesmo limite da DOC-CORE-001). Lacunas externas estão marcadas como **não verificadas**.

Verificado em: branch `v0.1.0-beta`, testes `exportacao + site-export + export-react + export-zip-http` 32/32.

## Formatos

| Formato | Operação (ferramenta/endpoint) | Código | Entrada → saída |
|---|---|---|---|
| HTML de uma tela | `export_html` (leitura) | [runner/export.ts:14](../../../packages/core/src/tools/runner/export.ts#L14), [schema.ts:640](../../../packages/core/src/tools/schema.ts#L640) | `{id, offset?, maxBytes?}` → `{file: slug.html, html: trecho, chunkBytes, offset, nextOffset, totalBytes, complete}` |
| Site estático (lista + conteúdo) | `export_site` (leitura, `format: 'html'`) | [runner/export.ts:26](../../../packages/core/src/tools/runner/export.ts#L26), [schema.ts:650](../../../packages/core/src/tools/schema.ts#L650), [site-export.ts:167](../../../packages/core/src/site-export.ts#L167) | `{includeContent?, path?, maxBytes?, offset?, format?}` → `{files: [{path, bytes, binary?}], totalBytes, warnings, hint?}` |
| Projeto Vite+React | `export_site` com `format: 'react'` | [runner/export.ts:28](../../../packages/core/src/tools/runner/export.ts#L28), [export-react.ts:35](../../../packages/core/src/export-react.ts#L35) | mesma entrada do site → pacote React (um componente por tela, CSS Modules, tokens, imagens em `public/`) |
| ZIP + JSON do projeto | `export_zip` (leitura; scope `export` no agente; papel de projeto VIEWER recusado antes de gravar) | [workspace/index.ts:226](../../../apps/server/src/workspace/index.ts#L226), [schema.ts:662](../../../packages/core/src/tools/schema.ts#L662) | `{}` → `{site_zip_url, react_zip_url, project_json_url, files, warnings}` (grava o projeto antes, só se o papel permitir) |
| Download do ZIP | `GET /api/projects/:file/site.zip` e `/react.zip` (conta autenticada; VIEWER recebe 403) | [routes/projects.ts:69](../../../apps/server/src/routes/projects.ts#L69) | path do projeto → `application/zip` (`site.zip` com `no-store`) |
| Publicação versionada | `POST /api/projects/:file/publish` (conta autenticada) + `ExportPanel` do Studio | [routes/projects.ts:97](../../../apps/server/src/routes/projects.ts#L97), [api.ts:114](../../../apps/studio/src/lib/api.ts#L114) | `{format: 'html'|'react', label?}` → `{download, bytes, warnings, audit, status: READY ou READY_WITH_WARNINGS}` + `publishRecord` no banco |
| Design tokens | `export_tokens` (leitura) | [runner/export.ts:21](../../../packages/core/src/tools/runner/export.ts#L21) | `{format}` → `{format, files}`; erro quando o projeto não tem estilos/variáveis |

## Warnings por origem

| Origem | Warning | Código |
|---|---|---|
| Página sem prancheta visível | `A página "…" não tem pranchetas visíveis para exportar.` | [site-export.ts:74](../../../packages/core/src/site-export.ts#L74) |
| Largura fixa maior que o menor breakpoint | `… vai rolar na horizontal. Ative "Largura fluida no site exportado"…` (não muda o padrão para preservar exportações existentes) | [site-export.ts:186](../../../packages/core/src/site-export.ts#L186) |
| Interações de protótipo | `… contém interações de protótipo; elas não são executadas no site exportado.` | [site-export.ts:194](../../../packages/core/src/site-export.ts#L194) |
| Links locais | `O link "…" não corresponde a um arquivo exportado.` / diferença de maiúsculas/minúsculas | [site-export.ts:202](../../../packages/core/src/site-export.ts#L202) |
| Conversão JSX | `A página "…" tem HTML que não consegui converter para JSX (…); ela entra como HTML bruto` (+ CSS global em vez de module) | [export-react.ts:85](../../../packages/core/src/export-react.ts#L85) |
| Mídia sem player | `O projeto usa mídia …, mas este servidor não tem o player (…); o elemento vai aparecer vazio.` | [media-runtime.ts:39](../../../packages/core/src/media-runtime.ts#L39) |
| Imagens em `export_site` | Binários listados com `binary: true` + hint: o conteúdo vai pelo `.zip` (`export_zip`) | [runner/export.ts:40](../../../packages/core/src/tools/runner/export.ts#L40) |

## Limites

| Limite | Valor | Código |
|---|---|---|
| Trecho padrão de conteúdo ao agente | 256 KiB | [content.ts:2](../../../packages/core/src/tools/content.ts#L2) |
| Teto de conteúdo por chamada | 1 MiB (piso 1 KiB; `agentContentLimit` prende o pedido ao intervalo) | [content.ts:3](../../../packages/core/src/tools/content.ts#L3) |
| `offset` sem `path` | recusado em `export_site` com `includeContent` (`Informe path…`); `offset` fora do conteúdo ou no meio de caractere UTF-8 é recusado | [runner/export.ts:37](../../../packages/core/src/tools/runner/export.ts#L37), [content.ts:19](../../../packages/core/src/tools/content.ts#L19) |
| Conteúdo total sem `path` acima do teto | recusado com orientação de paginar por `path`/`offset` | [runner/export.ts:38](../../../packages/core/src/tools/runner/export.ts#L38) |
| `format` inválido | recusado (`html` ou `react`); publish com formato inválido → 400 | [runner/export.ts:27](../../../packages/core/src/tools/runner/export.ts#L27), [routes/projects.ts:103](../../../apps/server/src/routes/projects.ts#L103) |
| `export_zip` de papel VIEWER | recusado antes de gravar (`Você só pode ler ou comentar este projeto.`); o GET do zip responde 403 com a mesma mensagem. COMMENTER continua podendo baixar. `export_site`, `export_html` e `export_tokens` seguem leitura | [workspace/index.ts:229](../../../apps/server/src/workspace/index.ts#L229), [routes/projects.ts:72](../../../apps/server/src/routes/projects.ts#L72) |
| `export_zip` sem scope `export` | recusado (`Este agente não tem permissão de exportar.`), depois do papel | [workspace/index.ts:230](../../../apps/server/src/workspace/index.ts#L230) |
| Assets e fontes | imagens externas em `assets/` (deduplicadas, 1 arquivo); fontes do projeto em `fonts/` com `@font-face`; demais famílias via CDN do Google | testes `site-export`/`export-react` |

## Testes relacionados (candidatos)

`tests/exportacao.test.js`, `tests/site-export.test.js`, `tests/export-react.test.ts`, `tests/export-zip-http.test.ts` + casos `export_zip`/`export_site` em `tests/workspace.test.ts` e a recusa de VIEWER em `tests/studio-parity.test.js`. A contagem 32/32 era da revisão da DOC-CORE-002; o gate de papel entrou depois, na decisão de 2026-10-14.

## Lacunas externas — não verificadas

- Disponibilidade do CDN de fontes do Google no ambiente de quem abre o site.
- Publicação/hospedagem real do ZIP (a tarefa cobre o pacote, não o deploy).
- Execução de JavaScript de protótipo no site exportado (por construção, não executado).
- Fidelidade visual do pacote em navegadores/hospedagens externas (sem QA humano nesta entrega).
