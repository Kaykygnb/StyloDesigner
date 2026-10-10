# Plano B — Identidade visual do editor

Direção: **sóbria e densa, com estilo próprio**. Referência de postura: ferramenta de trabalho, não demonstração.

## O que denuncia "feito por IA" hoje (medido em `src/styles/app.css`)
- Estado vazio com ícone num quadrado arredondado de 18px de raio e **brilho colorido** (`.empty-art`, linha ~333).
- **55** raios ≥ 12px e **25** sombras tingidas com o acento: tudo "macio" igual.
- **13** textos em caixa alta (também [#4](https://github.com/Kaykygnb/StyloDesigner/issues/4)) e 8 `backdrop-filter`.
- Azul padrão (`#4c8dff`/`#2f6ae0`) como única personalidade; logo genérico.
- Avisos em laranja e cartões grandes na página inicial, com muito ar e pouca informação.

## Identidade proposta
1. **Escala de raios curta**: 2 / 4 / 6 px (controles, painéis, modais). Círculo só para avatar.
2. **Sem brilho**: sombras neutras e curtas, só em elementos flutuantes. Bordas de 1px fazem a separação.
3. **Acento próprio**: trocar o azul padrão por um tom definido para a marca (escolher com capturas; contraste WCAG AA nos dois temas), usado só em seleção, foco e ação primária.
4. **Tipografia**: manter IBM Plex Sans/JetBrains Mono; definir escala (11/12/13/15) e pesos (400/500/600); caixa alta só em rótulos curtos com espaçamento, ou nenhuma.
5. **Densidade**: linhas de 24–28px nos painéis, ícones 14–16px, espaçamento múltiplo de 4.
6. **Marca**: refazer logo/ícone com um traço identificável (SVG em `assets/`), e estados vazios com ilustração simples de linha em vez de ícone brilhante.
7. **Copy da UI**: revisar textos de ajuda e vazios (curtos, sem frases de efeito).

## Execução
- Etapa 1: tokens (raios, sombras, tipografia, espaçamento) em `:root` e substituição por variáveis.
- Etapa 2: componentes (topbar, tabs, painéis, inputs, modais, página inicial, estados vazios).
- Etapa 3: tema claro revisado ([#15](https://github.com/Kaykygnb/StyloDesigner/issues/15)) e limpeza do CSS antigo.
- Capturas antes/depois dos dois temas em `docs/screenshots/`.
Aceite: nenhum teste E2E quebrado, contraste AA, sem `.empty-art` brilhante, ≤ 3 valores de raio.
