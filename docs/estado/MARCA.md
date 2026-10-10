# Direções de marca (geradas por `scripts/marca-opcoes.mjs`)

Contraste WCAG 2.x medido com os valores reais. Meta: ≥ 4,5 para texto e ≥ 3 para componentes.

## Opção A — Âmbar
Grafite quente com um único âmbar: ferramenta de oficina, sem azul de software genérico.

Símbolo: Camadas: dois blocos deslocados (o de trás só contorno).

**Tema escuro** (acento `#e9a23b`, texto do botão `#1a1206`)

| Par | Razão | Meta | Resultado |
|---|---|---|---|
| texto sobre o painel | 14.51 | 4.5 | passa |
| texto secundário sobre o painel | 6.60 | 4.5 | passa |
| texto secundário sobre o campo (panel-2) | 6.03 | 4.5 | passa |
| acento como texto/ícone sobre o painel | 8.11 | 4.5 | passa |
| texto do botão primário sobre o acento | 8.56 | 4.5 | passa |
| acento sobre o fundo (componente, mínimo 3) | 8.64 | 3 | passa |

**Tema claro** (acento `#9a5b00`, texto do botão `#ffffff`)

| Par | Razão | Meta | Resultado |
|---|---|---|---|
| texto sobre o painel | 17.18 | 4.5 | passa |
| texto secundário sobre o painel | 6.53 | 4.5 | passa |
| texto secundário sobre o campo (panel-2) | 5.64 | 4.5 | passa |
| acento como texto/ícone sobre o painel | 5.43 | 4.5 | passa |
| texto do botão primário sobre o acento | 5.43 | 4.5 | passa |
| acento sobre o fundo (componente, mínimo 3) | 4.90 | 3 | passa |


## Opção B — Mar
Grafite frio com verde-azulado: calmo, técnico, longe do roxo e do azul-padrão.

Símbolo: Regra: colchete e três linhas de larguras diferentes (auto layout).

**Tema escuro** (acento `#3cc2ae`, texto do botão `#04201b`)

| Par | Razão | Meta | Resultado |
|---|---|---|---|
| texto sobre o painel | 14.51 | 4.5 | passa |
| texto secundário sobre o painel | 6.47 | 4.5 | passa |
| texto secundário sobre o campo (panel-2) | 5.83 | 4.5 | passa |
| acento como texto/ícone sobre o painel | 7.79 | 4.5 | passa |
| texto do botão primário sobre o acento | 7.76 | 4.5 | passa |
| acento sobre o fundo (componente, mínimo 3) | 8.33 | 3 | passa |

**Tema claro** (acento `#0b7a6b`, texto do botão `#ffffff`)

| Par | Razão | Meta | Resultado |
|---|---|---|---|
| texto sobre o painel | 16.72 | 4.5 | passa |
| texto secundário sobre o painel | 6.20 | 4.5 | passa |
| texto secundário sobre o campo (panel-2) | 5.53 | 4.5 | passa |
| acento como texto/ícone sobre o painel | 5.24 | 4.5 | passa |
| texto do botão primário sobre o acento | 5.24 | 4.5 | passa |
| acento sobre o fundo (componente, mínimo 3) | 4.81 | 3 | passa |


## Opção C — Lima
Neutro puro com lima ácida: marcante, de ferramenta de design, nada de gradiente.

Símbolo: S de blocos encaixados, sem o quadrado de aplicativo.

**Tema escuro** (acento `#c3e84b`, texto do botão `#121700`)

| Par | Razão | Meta | Resultado |
|---|---|---|---|
| texto sobre o painel | 15.03 | 4.5 | passa |
| texto secundário sobre o painel | 6.55 | 4.5 | passa |
| texto secundário sobre o campo (panel-2) | 5.94 | 4.5 | passa |
| acento como texto/ícone sobre o painel | 12.65 | 4.5 | passa |
| texto do botão primário sobre o acento | 13.03 | 4.5 | passa |
| acento sobre o fundo (componente, mínimo 3) | 13.35 | 3 | passa |

**Tema claro** (acento `#4d6b00`, texto do botão `#ffffff`)

| Par | Razão | Meta | Resultado |
|---|---|---|---|
| texto sobre o painel | 17.44 | 4.5 | passa |
| texto secundário sobre o painel | 6.74 | 4.5 | passa |
| texto secundário sobre o campo (panel-2) | 5.84 | 4.5 | passa |
| acento como texto/ícone sobre o painel | 6.14 | 4.5 | passa |
| texto do botão primário sobre o acento | 6.14 | 4.5 | passa |
| acento sobre o fundo (componente, mínimo 3) | 5.57 | 3 | passa |


## Minha recomendação (opinião do engenheiro, a decisão é sua)

**Paleta A (Âmbar) com o símbolo B (colchete e três linhas).** Motivos: (1) o âmbar não é azul nem roxo, que são as cores padrão de software e de "IA"; (2) o grafite quente reduz a fadiga em sessões longas e deixa o design do usuário (frio, colorido) se destacar na tela; (3) o colchete com linhas de larguras diferentes diz o que o produto é, CSS real e auto layout, sem clichê de raio, pincel ou varinha; (4) funciona em 16 px (aba do navegador) e sem o quadrado escuro de aplicativo. A **C (Lima)** é a mais ousada, mas o verde-oliva escuro do tema claro fica pesado; a **B (Mar)** é a mais neutra e segura. Qualquer combinação entre paleta e símbolo é possível (os símbolos são independentes).

Para aplicar: dizer a letra da paleta e a letra do símbolo (por exemplo, "A + B"). Aplicação = trocar os valores do :root em src/styles/app.css, assets/logo-mark.svg, assets/logo.svg e o ícone da aba.
