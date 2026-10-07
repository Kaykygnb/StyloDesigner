# Changelog

Todas as mudanças relevantes do projeto, da mais nova para a mais antiga. Formato inspirado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/) (enquanto estiver na `0.x`, mudanças grandes podem acontecer entre versões).

Categorias: **Adicionado** · **Alterado** · **Corrigido** · **Desempenho** · **Documentação**.

---

## [0.5.0] — 2026-10-07

Documentação completa, capturas de tela e correções achadas ao fotografar o produto.

### Adicionado
- **Novo projeto de exemplo "app mobile"** (Arquivo → *Exemplo: app mobile*): tela de carteira digital que mostra **CSS Grid**, **componente com 4 instâncias** (texto/ícone sobrescritos), **estilos de cor e texto** ligados a camadas e **protótipo navegável** (Enviar → Sucesso → Voltar). O exemplo antigo virou *Exemplo: landing page*.
- **12 capturas de tela** do produto em `docs/screenshots/` e o script que as gera (`scripts/gerar-capturas.mjs`).
- `CONTRIBUTING.md` com a **convenção de commits** (Conventional Commits em português), estilo de código e checklist de PR.
- `docs/ARQUITETURA.md`: modelo de dados campo a campo, ciclo de uma mudança, algoritmos (gestos, instâncias, exportação) e guia para estender o editor.
- Teste unitário do novo exemplo (instâncias, estilos e destinos de interação).

### Corrigido
- **Seta do protótipo** fazia um laço atravessando o desenho quando o destino ficava à esquerda; agora sai e entra pelos lados certos (direita↔esquerda ou vertical).
- **Campo hex da cor da sombra** aparecia vazio (colapsava a 0 px) na seção Efeitos.
- **Painel Código** cortava linhas longas de CSS na lateral; agora quebram.
- **Etiqueta de tamanho** sobrepunha o número da medida ao segurar `Alt`.
- **Lista de atalhos** do app estava incompleta (faltavam `Ctrl+A`, `Ctrl+Alt+G`, `Ctrl+Alt+Enter`, zoom por teclado, `Ctrl+S/O`, `?`).

### Documentação
- **Todo o código-fonte comentado em português** (cabeçalho de cada arquivo, JSDoc nas funções e o *porquê* das decisões). Nenhuma linha de lógica foi alterada: o diff dos commits `docs(...)` contém só comentários.
- `README.md` reescrito: galeria com imagens, passo a passo para iniciantes, referência de funcionalidades, tabela de atalhos, desempenho medido e limitações.

---

## [0.4.0] — 2026-10-06 — Usabilidade e desempenho

### Desempenho
- Arrastar com **400 camadas**: de ~150 ms para ~20 ms por movimento (1000 camadas: de 350 ms para ~33 ms). Causas corrigidas: o painel de camadas se reconstruía a cada movimento e o índice interno era refeito mesmo quando só um valor mudava.

### Adicionado
- **Camadas**: começam recolhidas (abrem o caminho da seleção sozinhas), `Shift`+clique seleciona intervalo, `Alt`+clique na setinha abre/fecha tudo, busca por nome, menu da página (renomear, **duplicar**, excluir).
- **Seleção**: `Ctrl`+clique atravessa grupos, `Tab`/`Shift+Tab` percorrem camadas, **X/Y/W/H do conjunto** para várias camadas.
- **Medidas**: segurar `Alt` sobre outra camada mostra as distâncias.
- **Propriedades**: `Ctrl+Alt+C/V` copia/cola só a aparência; `Ctrl+V` com um frame selecionado cola **dentro** dele; `Ctrl+B/I/U` na edição de texto.
- **Auto layout**: matriz 3×3 de alinhamento, padding horizontal/vertical (ou por lado).
- **Texto**: MAIÚSCULAS/minúsculas e alinhamento vertical na caixa.
- Atalhos de cores já usadas no projeto, **grade de pixels** (≥ 800% de zoom), painéis **redimensionáveis** e **modo foco** (`Ctrl+\`), indicador *Salvo*, aviso amigável em erros inesperados, **exportar todos os frames**, desagrupar frames.

### Corrigido
- Padding aparecia como `[object HTMLDivElement]` no painel.

---

## [0.3.0] — 2026-10-06 — Protótipo e SVG

### Adicionado
- **Protótipo**: aba com interações (ao clicar / ao passar o mouse → navegar, voltar, abrir link), **transições** (dissolver e deslizar), ponto de partida do fluxo, **setas de fluxo** no canvas e modo **Apresentar** em tela cheia (`Ctrl+Alt+Enter`).
- **Exportação SVG vetorial** (formas, textos, gradientes, sombras, máscaras, vetores).
- `Ctrl+Alt+G` envolve a seleção em um frame.
- Testes de navegador (`tests/e2e/`) e unitários do SVG.

---

## [0.2.0] — 2026-10-06 — Layout, vetores e biblioteca

### Adicionado
- **CSS Grid** como modo de auto layout (colunas, linhas, gaps, `span` por item).
- **Constraints** dos filhos ao redimensionar frames; travar proporção; espelhar.
- **Vetores**: ferramentas **Linha**, **Polígono**, **Estrela** e **Caneta** (curvas de Bézier, edição de pontos e alças).
- **Componentes** com instâncias e sobrescritas; **estilos** compartilhados de cor e de texto (aba **Recursos**).
- **Máscara** (`clip-path`), **grades de layout**, presets de tamanho de frame (iPhone, Android, iPad, Desktop, A4, Story...).
- **Réguas** e **guias** arrastáveis, com *snap*.

### Corrigido
- Duplo clique não funcionava (alvo do evento com *pointer capture*): afetava editar texto e renomear frames.
- Objeto "pulava" ao ser arrastado de um frame para outro (as alças da seleção atrapalhavam a detecção do frame de destino).

---

## [0.1.0] — 2026-10-06 — Primeira versão

### Adicionado
- Editor local em JavaScript puro, com canvas em **HTML/CSS real**.
- Ferramentas Mover, Frame, Retângulo, Elipse, Texto, Imagem e Mão.
- **Auto layout em flexbox** (direção, gap, padding, justify, align, wrap) e tamanhos fixo/hug/fill.
- Camadas (arrastar para reordenar/aninhar), páginas, grupos, alinhar/distribuir, desfazer/refazer.
- Preenchimentos (sólido, gradientes, imagem), contorno, sombras, blur, `backdrop-filter`, `mix-blend-mode`.
- Aba **Código** (CSS/HTML real), exportação PNG/HTML e arquivo de projeto `.json`.
- Salvamento automático no navegador, tema claro/escuro, projeto de exemplo.
