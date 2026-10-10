# Baseline de carregamento do HTML exportado

**Fixture:** tela “Página”, do projeto de exemplo Vitrine, com 157 camadas.
**Ambiente:** Chromium/Playwright local, viewport 1440 × 900, cinco contextos novos (cache frio).
**Comando:** `node scripts/benchmark-site-load.mjs`.

## Resultado observado

| Medida | Mediana |
|---|---:|
| HTML transferido | 76,3 KiB |
| DOMContentLoaded | 12,7 ms |
| evento `load` | 14,2 ms |
| FCP / LCP | 100,0 ms |
| CLS | 0,0000 |
| tarefas longas durante a carga | 59,0 ms; máxima 59,0 ms |
| overflow horizontal | nenhum |
| erros de JavaScript | nenhum |

**Última repetição:** 2026-10-09. Bytes transferidos: 76,6 KiB; uma requisição no documento medido. O valor de FCP/LCP variou em relação à execução anterior (92 ms); compare medianas no mesmo ambiente em vez de interpretar uma repetição como regressão isolada.

O teste serve como baseline local para comparações entre revisões; **não é um SLA de produção**. A rota é `127.0.0.1`, então não mede TTFB de hospedagem/CDN. Fontes Google são substituídas por uma folha vazia para tirar a variabilidade de rede da medição. O baseline não mede mobile, cache quente, imagens remotas, interação posterior, acessibilidade ou o custo de scripts de terceiros. Para comparar provedores/hospedagem, medir separadamente com fontes e assets reais, rede controlada e Lighthouse/Web Vitals.

## Repetição

O script gera o HTML a partir de `buildSampleShowcase()` e do `exportHtml()` reais, serve o artefato em uma porta local aleatória, abre cinco contextos Chromium novos, calcula medianas e encerra o servidor temporário. Não altera o editor compartilhado nem os arquivos do projeto. A fixture seleciona a tela visível com maior árvore; revise a tela escolhida se a composição do exemplo mudar.
