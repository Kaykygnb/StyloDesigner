# Benchmark visual — Linear Build

**Estado:** primeira comparação concluída; reprodução reprovada em responsividade e conteúdo.
**Data:** 9 de outubro de 2026
**Referência:** [linear.app/build](https://linear.app/build)
**Viewports:** desktop 1440 × 900; celular 390 × 844.
**Capturas:** Playwright Chromium, escala 1×; fonte e recursos da web carregados antes da captura.

## Medições observadas

A página de referência, no Chromium, coloca o título em `x=78`, `y=572`, largura `754.58 px` e altura `144 px`. Usa Inter Variable a `72 px`, peso 500, linha de `72 px` e espaçamento de letras `-1.584 px`. O título ocupa duas linhas. A reprodução preservou a posição horizontal e largura, mas o título começa em `y=500` e ocupa três linhas.

As capturas desktop têm o mesmo tamanho. A diferença absoluta média por canal RGB é **15.03/255**; **21.31%** dos pixels diferem em mais de 20 níveis em pelo menos um canal. Na faixa do título (`y=470…729`), a diferença média sobe para **34.06/255** e **47.6%** dos pixels passam do limiar. O fundo animado da referência varia entre capturas, portanto a métrica global inclui movimento e não mede apenas o layout.

Na referência mobile, o documento ocupa 390 px, o menu muda para controles compactos e o título redistribui-se em três linhas legíveis. A exportação conserva uma raiz CSS de 1440 px; o conteúdo é cortado na janela estreita. É uma falha estrutural de responsividade, independente do fundo animado.

## Falhas concretas da reprodução

- **Conteúdo incompleto:** faltam o símbolo da marca, os links Customers, Now e Contact, o separador e a ação Sign up. O rótulo “Build, review and ship” virou apenas “Build”.
- **Tipografia e quebra:** a referência carrega Inter Variable e consegue ajustar a frase inteira à segunda linha de 754.58 px. A exportação carrega Inter do Google, mede a frase em aproximadamente 825.67 px e quebra “agents” para uma terceira linha. A igualdade de nome de família não garantiu igualdade de métricas tipográficas.
- **Posição vertical:** o título exportado começa 72 px acima do título de referência, apesar de terminar na mesma coordenada inferior (`y=716`). O conteúdo auxiliar não preserva o texto completo.
- **Imagem e movimento:** o fundo é uma representação estática de brilhos e pílulas desfocadas; a referência mostra uma interface de produto animada e desfocada. Não há vídeo ou composição equivalente na exportação.
- **Celular:** a raiz rígida de 1440 px corta a navegação e o título. A reprodução não recebeu uma adaptação mobile.

## Pendências

A reprodução foi um benchmark exploratório feito por Claude via MCP. Ainda faltam corrigir conteúdo, equivalência tipográfica e responsividade da raiz; depois, repetir as medições e comparar regiões dinâmicas separadamente. Não há diff visual automatizado nem segunda iteração corrigida.
