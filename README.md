# Designer Estudo

Editor independente inspirado no [StyloDesigner](https://github.com/Kaykygnb/StyloDesigner), reduzido a **HTML, CSS e JavaScript nativos**. Abre direto no canvas: sem login, banco, React, TypeScript, build, APIs ou pacotes de produção.

## Rodar

Com Node.js 20 ou superior:

```sh
npm start
```

Abra http://localhost:3000. Não precisa executar `npm install`. O servidor serve somente os cinco arquivos da interface. `PORT` e `HOST` podem ser configurados; o padrão é acesso local em `127.0.0.1:3000`.

Também funciona com um servidor estático, por exemplo `python3 -m http.server 3000`. Use HTTP para carregar os módulos JavaScript.

## Ferramentas

- Seleção múltipla com Shift, mover, redimensionar, duplicar, copiar/colar e excluir.
- Frames, seções, retângulos, elipses, linhas, polígonos, estrelas, texto, traços livres e imagens locais.
- Camadas com visibilidade e bloqueio; renomear com duplo clique; agrupamento, ordem e alinhamento entre irmãos.
- Inspetor com posição, tamanho, rotação, opacidade, preenchimento, borda, raio, sombra e tipografia.
- Páginas, pan, zoom, desfazer/refazer, prévia e exportação HTML e SVG com `foreignObject`.
- Salvamento automático no `localStorage`; JSON para transportar ou guardar projetos. Imagens são incorporadas como data URLs.
- Formas inteiramente desenhadas dentro de um frame são adicionadas como suas filhas.

Atalhos: V selecionar, H mão, F frame, S seção, R retângulo, E elipse, L linha, T texto, P caneta; Espaço + arrastar para pan; Ctrl/⌘ + roda para zoom; Ctrl/⌘+Z desfazer; Shift+Ctrl/⌘+Z refazer; Ctrl/⌘+D duplicar; Ctrl/⌘+G agrupar; Shift+Ctrl/⌘+G desagrupar; Ctrl/⌘+S baixar JSON. Setas movem 1 px, Shift+setas 10 px.

## Estrutura para estudo

- `index.html`: estrutura do editor.
- `tokens.css`: tokens visuais preservados do Stylo (MIT).
- `styles.css`: layout e aparência do editor.
- `model.js`: documento, busca de camadas, geometria adaptada do Stylo, validação e exportação.
- `app.js`: estado, ferramentas, interação com canvas e armazenamento local.
- `server.js`: servidor estático com módulos nativos do Node.
- `tests/model.test.js`: validação, exportação segura e camadas aninhadas; execute `npm test`.

## Diferenças em relação ao Stylo

Esta é uma reimplementação leve do núcleo visual, não uma conversão integral de cada recurso do monorepo. Foram removidos servidor de aplicação, banco/Prisma, autenticação, workspaces, MCP/agentes e colaboração. Não inclui comentários, protótipos, componentes reutilizáveis, auto layout, operações booleanas ou edição Bézier/nós. Caneta e lápis produzem polilinhas livres. Os JSONs desta versão possuem formato próprio e não importam documentos do Stylo original.

O redimensionamento de grupos altera sua caixa, sem escalar os filhos; desagrupar exige rotação zero. A exportação SVG usa HTML em `foreignObject` e depende do suporte do aplicativo de destino. O histórico fica apenas em memória. O projeto atual fica neste navegador/origem; limpezas dos dados do navegador podem apagá-lo, então baixe JSONs para manter cópias. Se a cota local encher, o editor avisa para salvar o arquivo.

## Licença

MIT. Tokens visuais e geometria de polígonos/estrelas derivados do StyloDesigner; autoria original preservada em `LICENSE`.
