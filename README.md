# Stylo

Editor de design **local**, onde o canvas é CSS de verdade. Você desenha, e o que sai é HTML/CSS (ou um projeto React) que um
desenvolvedor, ou um agente de IA, pode usar. Pessoas e agentes de IA (via MCP) trabalham no mesmo projeto, ao mesmo tempo.

Tudo roda no seu computador: o servidor escuta só em `127.0.0.1`, o banco é um arquivo SQLite e não há nada para instalar além do Node.

## Estado: alpha

O Stylo é uma alternativa gratuita e aberta para desenhar o protótipo de um site ou app, local primeiro. Você pode (1) desenhar e
exportar HTML/CSS para editar à mão, (2) baixar só o protótipo, ou (3) conectar um agente de IA e construir o site a partir do
protótipo. Dados do alpha podem mudar de formato entre versões `0.x`; faça backup do que importa. Veja os [limites conhecidos](#limites-conhecidos).

## Sumário

- [Estado: alpha](#estado-alpha)
- [Começar](#começar)
- [O que ele faz](#o-que-ele-faz)
- [Agentes de IA (MCP)](#agentes-de-ia-mcp)
- [Guia de conexão MCP](docs/MCP.md)
- [Exportar e importar](#exportar-e-importar)
- [Onde ficam seus dados](#onde-ficam-seus-dados)
- [Configuração](#configuração)
- [Como o código está organizado](#como-o-código-está-organizado)
- [Testes](#testes)
- [Limites conhecidos](#limites-conhecidos)
- [Licença](#licença)

## Começar

Precisa de **Node 22 ou mais novo** (o banco usa o SQLite que já vem no Node).

```bash
npm install
npm start
```

Abra <http://localhost:5173/studio/>. Na primeira vez o editor é compilado (leva alguns segundos); nas próximas já abre pronto.

- **Primeiro acesso:** o Stylo pede para criar a conta do dono (nome, e-mail e senha). O modo padrão é com **contas**: dá para convidar
  outras pessoas e definir, projeto a projeto, quem é dono, editor ou leitor.
- **Outra porta:** `PORT=8080 npm start`.
- **Modo de desenvolvimento** (editor com Vite, recarrega sozinho; mais pesado): `npm run dev`.

## O que ele faz

**Editor visual**
- Telas, seções, retângulos, elipses, linhas, polígonos, estrelas, textos, imagens, ícones e blocos de HTML escrito à mão.
- Auto layout com flexbox e grid, restrições, margens, limites de tamanho, proporção e `sticky`.
- Responsivo: ajustes por largura de tela (tablet, celular ou breakpoints próprios) viram `@media` no CSS.
- Estados `:hover`, `:active` e `:focus-visible`, com transição.
- Componentes e instâncias, estilos de cor, texto, sombra e gradiente, modos de cor (claro/escuro) e variáveis de tamanho.
- Máscaras, filtros, desfoque de fundo, mesclagem, CSS livre por camada e CSS da página.
- Comentários, histórico de versões (restaurar, comparar, duplicar), protótipo com modo Apresentar e régua com guias.
- Verificações do projeto: contraste, texto pequeno, imagens sem descrição, títulos e alvos clicáveis.

**Vetores**
- Caneta (clique = ponto, arraste = curva) e **lápis**, que ajusta curvas de Bézier ao seu traço em vez de ligar pontos com retas.
- Edição de nós e alças, unir e dividir contornos, inverter direção, simplificar, deslocar contorno (`offset`) e **contorno → forma**
  (com junção em ponta, chanfro ou arredondada, e pontas redondas, retas ou quadradas).
- Operações booleanas (unir, subtrair, interseção, excluir), polígonos e estrelas paramétricos, cantos arredondados e importação de SVG.

**3D**
- CSS 3D por camada: giro em X e Y, profundidade (`translateZ`), perspectiva e `preserve-3d` no contêiner.
- **Parallax** ligado à rolagem, só com CSS (`animation-timeline`). Fica parado em navegador sem suporte e para quem pediu menos movimento.
- Camada de **modelo 3D** (arquivo `.glb`, via `<model-viewer>`): gira sozinho, gira com a rolagem e tem ponto de vista inicial.
- O Stylo guarda a **intenção** (o que gira, quanto, em que perspectiva). Cenas completas em Three.js não são editadas aqui: um agente
  as escreve no código exportado.

**Idiomas da interface:** Português (Brasil), English, Русский, 日本語, 简体中文 e 한국어.

## Agentes de IA (MCP)

O servidor expõe um endpoint MCP em `http://localhost:5173/mcp` (HTTP). Para conectar um agente:

1. Na tela inicial, abra o menu **Mais → Agentes** (a área "Conexões criativas") e adicione uma conexão. O token aparece **uma única vez**.
2. Escolha o que o agente pode fazer: `read`, `comment`, `write` e `export`.
3. Autorize os projetos que ele pode acessar.
4. Em "Configuração avançada" há um guia rápido para clientes MCP. O passo a passo completo, incluindo Codex, ChatGPT/Work, STDIO, HTTP e diagnóstico, está em [docs/MCP.md](docs/MCP.md).

Ao todo são **mais de 120 ferramentas** (ler o documento, criar e alterar camadas, layout, responsivo, estados, vetores, imagens,
notas, exportação…): cerca de 80 no núcleo e o resto vem dos plugins.

**Por onde o agente deve começar:** `get_project_map` devolve um resumo em Markdown do protótipo (telas, tamanhos, design system,
estrutura com os textos reais, navegação e decisões). `add_note` e `list_notes` guardam o **porquê** das decisões, para a pessoa e o
agente seguirem o mesmo rumo. O Stylo é a camada de desenho e planejamento: o agente constrói o produto de verdade a partir dele. Plugins embutidos: SEO e Open Graph, acessibilidade, identidade visual (paletas, contraste, pares de
fontes e brief do projeto), QR code, Tailwind e provedores de imagens e ícones (Pexels, Pixabay, Openverse, Lucide, Material, Poly Pizza).

As alterações dos agentes são feitas pelas mesmas ferramentas do editor e **entram no histórico**: você desfaz com Ctrl+Z.

## Exportar e importar

| Saída | O que é |
| --- | --- |
| **Site (HTML)** | `.zip` com uma página por tela visível, imagens e fontes em arquivos, e sem CDN. Players de 3D e Lottie só entram se o projeto usar. |
| **React** | Projeto Vite + React: um componente por tela, CSS Modules, tokens em CSS e imagens em `public/`. |
| **Projeto (`.stylo`)** | O projeto inteiro para guardar ou levar a outro Stylo (JSON por dentro). A importação também aceita `.json`. |
| **Imagens, SVG e CSS** | Por camada, pelo painel de exportação e de código. |

A ideia do produto é que o **Stylo guarda o design**, e o código só sai quando você exporta.

## Onde ficam seus dados

Por padrão, na pasta do projeto, ao lado de `designer.config.json`:

| Arquivo | O que guarda |
| --- | --- |
| `designer.sqlite` | Contas, projetos, versões, imagens e agentes (um arquivo só). |
| `designer.blobs/` | Arquivos grandes: biblioteca de assets e `.zip` publicados. |
| `stylo-backup-designer.sqlite-<data>` | Cópias de segurança, criadas pelo painel. Restaurar vale no **próximo início**. |
| `designer.config.json` | Configuração do servidor. |

- O esquema do banco é atualizado sozinho ao abrir, e uma cópia de segurança é feita antes de qualquer migração.
- Se o arquivo do banco estiver corrompido, o servidor tenta se recuperar a partir das cópias.
- Quem vem de uma versão antiga (que guardava tudo numa pasta `designer.db/`) tem os dados importados **uma vez**, na primeira abertura.
  A pasta antiga não é alterada nem apagada. Essa importação usa o pacote opcional `@electric-sql/pglite`.

## Configuração

Variáveis de ambiente (todas opcionais):

| Variável | Para quê |
| --- | --- |
| `PORT` | Porta do servidor (padrão `5173`). |
| `DESIGNER_CONFIG` | Caminho do arquivo de configuração. O banco e os blobs ficam ao lado dele. |
| `DESIGNER_DB` | Caminho do arquivo SQLite (`memory` = só na memória, usado nos testes). |
| `STYLO_BLOB_DIR` | Pasta dos arquivos grandes (`memory` nos testes). |
| `STYLO_SECRET_KEY` | Chave (32 bytes em base64) que cifra as chaves de API dos provedores guardadas por conta. Sem ela, o servidor cria um arquivo `*.secret` ao lado da configuração. |
| `STYLO_LIBRARY_QUOTA_MB` | Limite de espaço da biblioteca de assets. |
| `STYLO_CHROMIUM_PATH` ou `CHROMIUM_PATH` | Usa um Chromium que já existe para gerar miniaturas e editar imagens, em vez de baixar outro. |
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | Chaves dos provedores de fotos (opcionais). |
| `STYLO_AUTH=local` | **Sem login**, só para testes e desenvolvimento. Não use para guardar trabalho de verdade. |
| `STYLO_DEV=1` | Editor em modo de desenvolvimento (o mesmo que `npm run dev`). |

**Segurança.** O servidor só aceita pedidos com `Host` local (`localhost`, `127.0.0.1` ou `[::1]`), e os pedidos que **escrevem** exigem JSON e, se vierem de uma página, `Origin` deste mesmo servidor. O HTML que você
escreve é limpo (sem `<script>` nem atributos `on*`) e a apresentação roda num iframe isolado. O editor não executa JavaScript do projeto.

## Como o código está organizado

Monorepo com npm workspaces:

```
apps/
  server/     Servidor (Hono): API HTTP, contas e sessões, gateway MCP, projetos, workspace ao vivo, renderizador
  studio/     Editor (React 19 + Vite + TypeScript): telas, canvas, painéis e traduções
packages/
  core/       Modelo do documento, CSS e HTML gerados, geometria dos vetores, ferramentas (79) e exportadores
  db/         Banco SQLite: camada de dados com a API do Prisma que o servidor usava, migrações e importação do banco antigo
  plugins/    Plugins embutidos (SEO, acessibilidade, identidade, QR, Tailwind, provedores de imagem)
scripts/      start.mjs (liga tudo) e utilitários
tests/        Testes automatizados
```

Pontos de partida para ler o código:
- `packages/core/src/css.js`: como cada camada vira CSS (e onde entram 3D e parallax).
- `packages/core/src/geom.js`: geometria dos vetores (curvas, booleanas, deslocamento).
- `packages/core/src/tools/schema.ts`: a lista de ferramentas que o editor e os agentes usam.
- `apps/studio/src/editor/canvas/gestures.ts`: os gestos do canvas (mover, redimensionar, girar, desenhar).
- `apps/server/src/main.ts`: como o servidor é montado.
- `apps/studio/src/ui/ink3d/scene.ts`: a pilha de camadas em 3D (three.js) da página inicial e do login; só é baixada quando aparece e cai para a versão em CSS sem WebGL.

## Testes

```bash
npm test               # testes unitários e de integração
npm run typecheck      # TypeScript em todos os pacotes
npm run test:e2e       # fluxos de contas e administração num navegador (compila antes)
```

Os testes de interface (`studio-ui`, `studio-gestos`) e os de ponta a ponta precisam de um Chromium. Sem um, os de interface são
**pulados** em silêncio. Para rodá-los com um Chromium que você já tem:

```bash
CHROMIUM_PATH=/caminho/do/chromium npm test
CHROMIUM_PATH=/caminho/do/chromium npm run test:e2e
```

## Limites conhecidos

- **Traduções:** o inglês e o português são a base. As de russo, japonês, chinês e coreano foram feitas por IA e **não foram revisadas
  por falantes nativos**. Só existe chinês simplificado. Algumas mensagens do servidor ainda saem em português.
- **3D:** é CSS 3D mais o `<model-viewer>`. Não há editor de cenas com luz, câmera animada ou partículas. No canvas, camadas giradas em 3D
  se editam pelo painel de números, sem alças de mouse em 3D, e o parallax só aparece no site exportado.
- **Parallax:** precisa de um navegador recente (`animation-timeline`). Sem ele, a camada fica parada.
- **Frame com `preserve-3d`:** não deve ter cor de fundo (ela esconde o que gira para trás). Ponha a cor num frame pai. Esse frame também
  deixa de cortar o conteúdo.
- **Desfazer:** a maioria das ações em várias camadas vale um passo só. Algumas edições seguidas ainda geram mais de um.
- **Uso local:** o Stylo não foi feito para ficar exposto na internet. Para colaborar com outras pessoas, use as contas na mesma máquina ou rede
  controlada por você.

## Licença

[MIT](LICENSE).
