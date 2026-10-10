# Plano mestre — Stylo v1 estável e profissional

Substitui `PLANO-ETAPAS.md` como documento de referência (o anterior fica como histórico das decisões do Jev). Estado e histórico: `docs/estado/LEDGER.md`.
Meta: uma versão que não perde dados, não tem brechas óbvias, exporta sites corretos, tem identidade visual própria e pode ser lançada no GitHub com confiança.

## Padrões adotados enquanto você não responde (mude em `PENDENTE-HUMANO.md`)
Navegadores: Chromium + smoke em Firefox/WebKit · v1 sem JS no export, sem React, sem extensões · licença MIT mantida · fusão de menus fica para v1.1 · biblioteca global fica para v1.1.

## Definition of Done de qualquer etapa
1. Teste que falhou antes e passa depois. 2. `npm test` verde. 3. E2E relacionado verde em servidor isolado. 4. Diff revisado (`revisar-diff`; `jev_assess_code_risk` se tocar servidor, persistência ou carregamento). 5. LEDGER atualizado (o quê, como, teste, evidência, executor). 6. Commit pequeno em português.
Portões humanos (eu paro e registro em `PENDENTE-HUMANO.md`; não faço push nem merge): S3, S4, S12, S10, S10b, S11.

## Fases
**Fase 0 — Base de teste.** S6: runner E2E sobe servidor isolado; `desempenho` por mediana de N execuções; `fotos` com timeout e modo offline; reproduzir e consertar a instabilidade do `agente-mcp` na bateria completa; teste de que o runner não toca em `projetos/`.

**Fase 1 — Correção.**
- S1 slug/namer de classes CSS.
- S2 `init` via `loadDoc`.
- S3 Origin exata + token + limites de corpo por rota.
- S4 persistência: config atômica, cópia mais nova vence, `save()` informa sucesso/falha.
- S5 validar `.json` carregado.
- S5b menores: nomes reservados do Windows, listagem resiliente, erro 500 genérico, CSS aninhado, `url(data:...;base64)` no CSS manual, `/*` sem fechar, colar na página certa, `visible` indefinido, `!important`.
- S13 issues #14 (F11), #10 (`@media` no canvas pela largura da tela), #2 (limite e hosts no download de imagem gerada).
- S14 `PUT /api/config` recusa raízes de sistema; limite de sessões MCP e conexões SSE.

**Fase 2 — Exportação.** S12 remover raiz fixa de 1440 px e validar 390/768/1440; S15 fotos como `<img>` com `alt` (#11); S16 PNG com HTML de camada de código (XML válido ou erro claro); S17 `<meta description>`, favicon e título por página.

**Fase 3 — Identidade visual.** S7 tokens; S10 três opções de marca (humano escolhe); S8 substituição mecânica por tipo; S9 acessibilidade; S10b aplicar marca; S18 tema claro (#15) e menus sem caixa alta (#4). Skills: `design:design-impecavel`, `prototipar`.

**Fase 4 — Projeto-exemplo.** S11 nova vitrine com voz própria; regerar miniatura e capturas do README.

**Fase 5 — Lançamento.**
- S19 CI (`.github/workflows/ci.yml`: unit + E2E em servidor isolado + Playwright Chromium; Firefox/WebKit como smoke).
- S20 SECURITY.md, PR template, NOTICE (Google Fonts, Material Icons, Pexels), `package.json` (`repository`, `bugs`, `homepage`).
- S21 versionar o formato (`doc.version`) com função de migração e teste.
- S22 limpeza final de docs: fundir `GUIA-DO-CODIGO` em `ARQUITETURA`, mover o log de auditoria do ROADMAP para o CHANGELOG, regerar `REFERENCIA.md`, refazer capturas.
- S23 README, CHANGELOG, versão.
- S24 E2E 3 vezes seguidas + `ROTEIRO-ACEITE-HUMANO.md` com a sua lista.

## Backlog pós-v1 (ordem)
**v1.1:** JS opcional e seguro no export (menu mobile, abas, tema) · imagens como arquivos em `assets/` · registro persistente por agente + tela "Revisar" + reverter seletivo · memória do agente dentro do projeto e `get_memory`/`remember` no MCP + `meta.role/owner/status` + `get_outline` · modo "propor e revisar" e admin separado em dois interruptores · provedores nativos Anthropic/Gemini · biblioteca global em `<pasta>/.stylo/library.json` + exportar/importar tudo em ZIP · fusão de menus e componente único de abas · campos de painel para container queries, grid areas, scroll-snap, `clamp()`, rotação 3D · pacote instalável sem Node.
**Depois:** export de componentes React/Vite · extensões só com dados · edição em tempo real (#13) · i18n (#12).
**Rejeitado:** conta em nuvem com login, build obrigatório, plugins com JS arbitrário.

## Divergências Jev × engenheiro
Jev sugeriu `i18n`, `extensions`, `library_json` e `export_js` na v1 com confiança baixa (0,14–0,56); adiei por tamanho e risco. Jev sugeriu apagar `ROTEIRO-ACEITE-HUMANO.md` (0,91); mantive porque é o seu roteiro de teste. Jev classificou `export_react` como "rejeitar" (0,31); fica como "depois". Usei só resultados de confiança alta de forma direta.

## Modo noturno (enquanto você dorme)
Faço, nesta ordem e só localmente: S6 → S1 e S2 em paralelo → S5b (itens que não tocam o servidor) → S13/#10 → S15. Não faço push, não aplico S3/S4 antes da sua revisão (preparo só os testes que falham), não decido marca. Se um teste novo falhar de forma inesperada, paro essa etapa, registro no LEDGER e sigo com outra.
