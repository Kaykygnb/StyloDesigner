# Guia do código

Este é o ponto de partida para **ler e mexer** no código do Projeto Designer, mesmo se você nunca abriu o projeto.

São três documentos, do mais simples ao mais detalhado:

| Documento | Para quê |
|---|---|
| **Este guia** | Por onde começar, o caminho de um clique pelo código e onde mexer para mudar cada coisa. |
| [Arquitetura](ARQUITETURA.md) | Como as peças se encaixam: princípios, modelo de dados, ciclo de uma mudança, salvamento e armadilhas conhecidas. |
| [Referência](REFERENCIA.md) | Todas as funções, arquivo por arquivo, com parâmetros e link para a linha. É gerada dos comentários do código (`npm run docs`). |

---

## 1. A ideia em uma frase

Cada camada que você desenha vira um **`<div>` de verdade**, com **CSS de verdade**. O editor não "imita" o navegador; ele **usa** o navegador.

Por isso:
- auto layout é `display: flex` / `display: grid` de verdade;
- o painel **Código** mostra o mesmo CSS que desenha o canvas;
- exportar HTML dá exatamente o que você vê.

Se você entende HTML e CSS, já entende metade do projeto.

## 2. Glossário rápido

| Palavra | O que significa no código |
|---|---|
| **Documento** (`doc`) | O projeto inteiro: páginas, camadas, imagens, estilos. É o que vai para o `.json`. |
| **Camada** ou **nó** (`node`) | Um objeto simples como `{ id, type: 'rect', x, y, w, h, fill, ... }`. Criado por `createNode` em `model.js`. |
| **Frame** | Camada que tem filhos (`children`) e pode ter auto layout. Uma "tela" é um frame na raiz da página. |
| **Auto layout** | `node.layout.mode` = `'row'`, `'column'` ou `'grid'`. Vira flexbox/grid no CSS. |
| **Em fluxo** (`isFlow`) | A camada está dentro de um auto layout e não é absoluta: quem decide a posição é o navegador. |
| **fixed / hug / fill** | Modo de tamanho: fixo em px, do tamanho do conteúdo, ou preenche o espaço do pai. |
| **Store** | O "cérebro": guarda o documento e o estado da interface. Todo mundo lê e escreve por ele. |
| **`update` / `commit`** | `store.update(fn)` muda o documento; `store.commit()` fecha a mudança (um passo do Ctrl+Z + salvamento). |
| **`emit` / `subscribe`** | O store avisa "mudou algo" e quem assinou (canvas, painéis) se redesenha. |
| **Mundo × tela** | "Mundo" = coordenadas do design (px do projeto). "Tela" = pixels do monitor, depende do zoom. `canvas.toWorld` / `toScreen` convertem. |
| **Overlay** | O que fica POR CIMA do design: caixa de seleção, alças, linhas rosa de snap, medidas. Não faz parte do documento. |
| **Gesto** (`drag`) | Um arrasto do mouse em andamento (mover, redimensionar, desenhar...). Vive em `tools.js`. |

## 3. Ordem sugerida de leitura

Não tente ler tudo. Siga esta ordem, e em cada arquivo leia primeiro **o comentário do topo**:

1. **`src/model.js`**: como é uma camada (`createNode`). É curto e explica todos os campos.
2. **`src/store.js`**: `update`, `commit`, `emit`. Entendendo isso, você entende o app.
3. **`src/css.js` → `nodeStyle`**: como uma camada vira CSS. É o coração do "design = CSS".
4. **`src/canvas.js` → `render` / `syncNode`**: como o CSS vai para os `<div>` na tela.
5. **`src/main.js`**: monta tudo na ordem certa. Bom para ver quem conversa com quem.
6. Só então, conforme a necessidade: `tools.js` (mouse/teclado), `commands.js` (operações), `ui/props.js` (painel Design).

## 4. O caminho de um clique: desenhar um retângulo

O que acontece quando você aperta `R` e arrasta no canvas:

```text
1. Tecla R           tools.js  keydown          → store.setTool('rect')
2. Aperta o mouse    tools.js  pointerdown      → startDraw(e, 'rect')
                                                    createNode('rect', {x, y, w:1, h:1})     (model.js)
                                                    store.update(page => page.children.push(node))
3. store avisa       store.js  emit('doc')      → canvas.render()                           (canvas.js)
                                                    syncNode cria o <div> e aplica nodeStyle(node)   (css.js)
                                                  → overlay.render() desenha a caixa de seleção (overlay.js)
4. Arrasta           tools.js  drawDrag(e)      → muda node.w / node.h com store.update(...)
                                                    (o passo 3 se repete a cada movimento)
5. Solta o mouse     tools.js  endDrag → finishDraw → store.commit()
                                                    vira UM passo do Ctrl+Z e agenda o salvamento
6. Um pouco depois   store.js  scheduleSave → save → persist   (saving.js / storage.js)
                                                    grava no navegador e, se ligado, na pasta (server.js)
7. Painéis           ui/props.js, ui/layers.js  (assinam com subscribe, 1x por frame)
                                                    mostram W/H, a nova camada na lista etc.
```

Quase toda funcionalidade segue esse mesmo desenho: **ação → `store.update` → `emit` → canvas/painéis redesenham → `commit` no fim.**

## 5. "Quero mudar X": onde mexer

| Quero... | Arquivo · função |
|---|---|
| Mudar o CSS gerado por uma propriedade | `src/css.js` · `nodeStyle` (e `src/svg.js` para o SVG exportado) |
| Adicionar um campo novo nas camadas | `src/model.js` · `createNode` (valor padrão). Veja a receita na [Arquitetura §12](ARQUITETURA.md#12-como-estender) |
| Mudar um campo do painel Design | `src/ui/props.js` · seções `positionSection`, `sizeSection`, `autoLayoutSection`, `flowItemSection`, `appearanceSection`, `fillSection`, `strokeSection`, `effectsSection`… |
| Mudar a ordem das seções do painel | `src/ui/props.js` · `render` |
| Mudar o visual (cores, espaçamentos do app) | `src/styles/app.css` (as cores ficam em variáveis no topo: `--panel`, `--accent`…) |
| Mudar o que o mouse faz (mover, redimensionar, snap) | `src/tools.js` · `moveDrag`, `resizeDrag`, `snapMove`, `snapResize` |
| Criar/mudar um atalho de teclado | `src/tools.js` · listener de `keydown` + lista `SHORTCUTS` em `src/ui/menus.js` |
| Mudar uma operação (agrupar, alinhar, auto layout…) | `src/commands.js` · ex.: `toggleAutoLayout`, `enableAutoLayout`, `setLayoutMode`, `align` |
| Mudar a caixa de seleção, alças, linhas rosa | `src/overlay.js` |
| Mudar a lista de camadas | `src/ui/layers.js` |
| Mudar como/onde salva | `src/saving.js` (regras), `src/storage.js` (navegador e API), `server.js` (disco) |
| Mudar a página inicial | `src/ui/home.js` |
| Mudar a importação de SVG (Figma, Illustrator) | `src/svgimport.js` |
| Mudar componentes e instâncias | `src/components.js` (lógica) e `src/commands.js` (`createComponent`, `insertInstance`, `detach`) |
| Mudar o modo Apresentar / protótipo | `src/present.js` e `src/ui/proto.js` |
| Mudar um ícone da interface | `src/ui/icons.js` |

Não achou? Procure o texto que aparece na tela (ex.: "Itens preenchem as células") em `src/`: quase sempre leva direto à função certa.

## 6. Regras do projeto (combinadas)

1. **JavaScript puro**, módulos ES, **sem build e sem dependências** no app. Só o Playwright, para testes.
2. **Nunca mude uma camada "por fora"** do store: use `store.update(...)` e `store.commit()` ao fim do gesto. Senão o Ctrl+Z, o salvamento e os painéis não ficam sabendo.
3. Durante um arrasto, use `update` várias vezes e **um** `commit` ao soltar.
4. `update(fn, { structural: false })` só quando `fn` **não** adiciona, remove nem reordena camadas.
5. **Fiel ao CSS:** se o editor mostra algo, o CSS exportado tem que fazer o mesmo. Nomes no painel = nomes do CSS sempre que possível.
6. **Comente em português** e explique o *porquê*, não só o *o quê*. Toda função nova ganha um `/** ... */` em cima. É desse comentário que sai a [Referência](REFERENCIA.md).
7. Projetos salvos por versões antigas precisam continuar abrindo: ao ler um campo novo, use um padrão (`node.campo ?? 'padrão'`).

## 7. Testes

| Comando | O que roda | Tempo |
|---|---|---|
| `npm test` | Testes rápidos no Node (`tests/*.test.js`): CSS gerado, modelo, servidor, importação de SVG… e confere se a Referência está em dia | segundos |
| `npm run test:e2e` | Abre o app num navegador de verdade e usa como uma pessoa (`tests/e2e/*.mjs`). Precisa do `npm start` rodando em outro terminal | alguns minutos |
| `npm run test:all` | Os dois | |

Cada suíte do navegador está descrita em [`tests/e2e/README.md`](../tests/e2e/README.md). Corrigiu um bug? Acrescente uma verificação que falharia antes da correção.

## 8. Documentação: como manter em dia

- Mudou ou criou uma função? Atualize o comentário `/** ... */` dela e rode **`npm run docs`**. Isso regenera `docs/REFERENCIA.md`.
- Se esquecer, `npm test` falha com a mensagem "docs/REFERENCIA.md está desatualizado".
- Mudou como as peças se encaixam (um módulo novo, um fluxo novo)? Atualize a [Arquitetura](ARQUITETURA.md).
- Mudou algo que o usuário vê? Atualize o [README](../README.md) e o [CHANGELOG](../CHANGELOG.md).
