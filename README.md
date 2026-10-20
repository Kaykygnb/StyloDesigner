# Stylo

Editor de design que roda no seu computador. Você (ou um agente de IA) desenha pranchetas, textos, formas e vetores, organiza com layout automático e exporta páginas HTML prontas, SVG e PNG.

Só HTML, CSS e JavaScript. Não tem `npm install`, banco de dados nem login.

## Rodar

Precisa do Node.js 20 ou mais novo.

```sh
npm start
```

Abra http://localhost:3000. Os projetos são salvos como arquivos `.json` na pasta `projetos/`. Antes de cada gravação, a versão anterior fica guardada em `.bak`. Apagar um projeto só renomeia o arquivo; ele não some de vez.

Variáveis opcionais:

- `PORT`: porta (padrão 3000).
- `STYLO_DATA`: outra pasta para os projetos.

Sem o servidor (abrindo os arquivos com outro servidor estático), o editor funciona, mas salva só no navegador.

## Como fazer um site

1. Aperte `F` e clique no canvas: aparece uma prancheta de 1440 × 900. Cada prancheta vira uma página.
2. Coloque textos (`T`), retângulos (`R`), imagens (arraste o arquivo para a tela) e vetores (`P`).
3. Selecione os itens e aperte `Shift+A`: eles entram num **layout automático** (flexbox). É isso que deixa a página boa no celular.
4. Para ligar páginas, selecione um botão e escolha a prancheta em **Link**.
5. Clique em **Visualizar** para testar no tamanho de celular, tablet ou tela cheia.
6. Em **Exportar → Site inteiro**, você baixa um `.zip` com uma página `.html` por prancheta. A primeira vira `index.html`.

Aperte `?` no editor para ver todos os atalhos.

## Vetores

- Caneta (`P`): clique cria ponto reto, clique e arraste cria curva. Clique no primeiro ponto para fechar. Enter termina.
- Lápis (`B`): traço livre, suavizado sozinho.
- Duplo clique num vetor ou forma: edita os pontos. Arraste pontos e alças. Duplo clique num ponto troca entre reto e curvo. Alt solta a alça do outro lado.
- Selecione duas formas ou mais para **unir, subtrair, interseção ou excluir**. A combinação continua editável.
- Exportar SVG gera vetor de verdade, com o texto como `<text>`.

## Agentes de IA (MCP)

O servidor tem um endpoint MCP em `http://localhost:3000/mcp` (HTTP, JSON-RPC). Um agente consegue:

- `list_projects`, `create_project`, `get_project`
- `add_page`, `add_layers` (com filhos aninhados), `update_layers`, `delete_layers`, `move_layer`, `combine_shapes`
- `export_html`, `export_svg` (com `save: true` grava o `.svg`), `export_png`

**Ícones:** o agente desenha em camadas (formas e vetores), junta com `combine_shapes` (unir, subtrair, interseção, excluir) e exporta. O SVG e o PNG ficam em `projetos/exportados/`. Para o PNG, o projeto precisa estar aberto no Stylo no navegador, porque é o navegador que desenha a imagem.

O que o agente muda aparece na hora no editor aberto. Se você e o agente mexerem ao mesmo tempo, as mudanças são juntadas camada por camada, e Ctrl+Z desfaz a do agente.

Exemplo de configuração num cliente MCP que aceita HTTP:

```json
{ "mcpServers": { "stylo": { "type": "http", "url": "http://localhost:3000/mcp" } } }
```

## Segurança

- O servidor só escuta em `127.0.0.1` e recusa pedidos vindos de outros sites (proteção contra DNS rebinding e CSRF). `STYLO_ALLOW_REMOTE=1` libera, por sua conta e risco.
- Todo projeto passa por validação: só campos conhecidos, cores em hex, links `https` ou para outra prancheta, imagens embutidas PNG/JPEG/WebP/GIF.

## Arquivos

- `index.html`, `styles.css`, `tokens.css`, `icons.js`: a interface.
- `app.js`: o editor (ferramentas, canvas, painéis, salvar).
- `model.js`: o documento, geometria, validação e exportação (usado pelo editor e pelo servidor).
- `server.js`: servidor, arquivos de projeto e eventos ao vivo.
- `agent.js`: as ferramentas MCP para agentes.
- `tests/`: `npm test`.

## Limites honestos

- Um projeto por arquivo e um usuário por vez no computador. Não é colaboração em tempo real entre pessoas.
- O layout automático cobre linha, coluna, espaço, margem, alinhamento e quebra de linha. Não tem grid nem breakpoints manuais.
- Fontes: usa as fontes do sistema (Arial, Georgia, Verdana etc.). Não baixa fontes da internet.

Licença MIT. Os tokens visuais vêm do projeto original Stylo.
