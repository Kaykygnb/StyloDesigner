# Stylo

O Stylo permite que agentes de IA construam, inspecionem e ajustem desenhos de sites pelo **MCP**,
com um documento estruturado e CSS real. O agente pode montar telas, organizar estilos, editar fotos,
conferir problemas e exportar HTML, um projeto React com Vite ou tokens de design.

O foco atual é o **servidor e o uso pelo MCP**, inclusive por agentes que não recebem imagens.
O editor visual em `apps/web` é legado e está congelado; sua reformulação fica para outro trabalho.

**Branch deste trabalho: [`limpeza`](https://github.com/Kaykygnb/StyloDesigner/tree/limpeza).**
A `main` contém a versão antiga. Estado documentado em **2026-10-12**:
**81 ferramentas anunciadas** (63 do núcleo + 8 de identidade + 10 de assets),
com uma ferramenta generativa ainda indisponível no servidor.

## Começar

Requer **Node.js ≥ 22**. O banco local PGlite é preparado pelo servidor; Postgres também é suportado.

```bash
git clone --single-branch -b limpeza https://github.com/Kaykygnb/StyloDesigner.git
cd StyloDesigner
npm install
npm run typecheck
```

Para medidas reais, imagens, auditoria de vazamento e edição de fotos, é necessário Chromium.
Se já houver um instalado, use seu caminho; exemplo no Linux:

```bash
export STYLO_CHROMIUM_PATH=/usr/bin/chromium
npm start
```

Se não houver Chromium disponível, instale o usado pelo Playwright:

```bash
npx playwright install chromium
npm start
```

Servidor local: `http://localhost:5173`. Endpoint MCP HTTP: `http://localhost:5173/mcp`.
Exemplo de conexão no Claude Code:

```bash
claude mcp add --transport http stylo http://localhost:5173/mcp
```

Outros clientes precisam aceitar esse transporte MCP e ser configurados conforme suas próprias
instruções. O fluxo foi conferido com o cliente oficial do SDK MCP; **não foi validado individualmente
em Codex, Claude Code, Kimi ou OpenCode**. A capacidade de receber imagens depende do cliente e do modelo.

O modo local inicia sem login. Contas, tokens de agentes, papéis e escopos existem no servidor;
configuração e autenticação estão em [contexto.md](contexto.md). O produto ainda não está preparado
para hospedagem pública; as decisões de acesso e hospedagem estão em [PASSAGEM.md](PASSAGEM.md).

## O que já pode ser feito pelo MCP

| Objetivo | Ferramentas e comportamento |
|---|---|
| Abrir e retomar | Projetos, páginas, brief, notas, comentários e atividade. |
| Montar telas | `build_layout`, `create_layer`, mover, duplicar e remover camadas; layouts flex/grid, texto e vetores. |
| Localizar alvos | `find_layers`: busca por texto, tipo, página/subárvore e propriedades como fonte, cor e vínculos com estilos. |
| Ajustar juntos | `update_layers`: até 100 IDs únicos, validação antes da escrita e um passo de desfazer/refazer. |
| Conferir em texto | `inspect_layout`: medidas reais, espaçamentos e fonte aplicada na largura escolhida, sem precisar entregar imagens ao modelo. |
| Conferir problemas | `check_design`: vazamento horizontal por breakpoint, contraste, texto pequeno, descrição de imagens, títulos e alvos clicáveis. |
| Receber imagem | `get_image`: PNG da tela, inclusive no celular/tablet, quando o cliente consegue mostrar imagens ao agente. |
| Organizar identidade | Estilos de cor/texto/sombra/gradiente, modos de cor, variáveis de tamanho, componentes e instâncias. |
| Ajustar responsivo e estados | `set_responsive`, `set_state` e interações de protótipo. Protótipo não garante funcionalidade de aplicativo. |
| Trabalhar com assets | Biblioteca, busca de ícones/assets, fontes hospedadas, créditos e camadas de mídia. Integrações têm ressalvas abaixo. |
| Editar fotos localmente | `edit_image`: giro, espelhamento, recorte, filtros, ajustes, fundo simples, redução, formatos e restauração da original. |
| Exportar | HTML/site ZIP, projeto React com Vite e tokens em CSS/JSON/Tailwind. |

O catálogo por grupo, os limites e as melhorias pendentes estão em [FERRAMENTAS.md](FERRAMENTAS.md).
As ferramentas fazem alterações no documento do Stylo; elas não implementam automaticamente
backend, pagamentos, login ou outras funções de negócio do site exportado.

## Trabalhar sem despejar o projeto inteiro no agente

Um fluxo recomendado é **buscar → ler o trecho necessário → ajustar → conferir novamente**.
Os exemplos abaixo são argumentos de chamadas MCP; substitua os IDs pelos retornados nas chamadas anteriores.

Localizar textos de uma fonte, recebendo apenas seus IDs:

```json
{
  "type": "text",
  "where": { "fontFamily": "Inter", "fontSize": 16 },
  "fields": "ids",
  "limit": 20
}
```

Chame `find_layers` com esses argumentos. Por padrão, a busca entrega até **20 itens compactos e 8 KiB**
de JSON UTF-8. `fields:"ids"` reduz os detalhes; `get_layer` abre uma camada específica;
`fields:"summary"` pede o resumo com medidas. A busca compara valores base, sem resolver CSS,
modos de cor, estados ou breakpoints.

Conferir um trecho da tela no celular com `inspect_layout`:

```json
{
  "id": "ID_DA_TELA",
  "within_id": "ID_DO_TRECHO",
  "breakpoint": "mobile",
  "depth": 1,
  "limit": 20
}
```

A inspeção renderiza **a tela inteira**, mantendo o contexto dos pais, e devolve só o trecho pedido.
Retorna posição/tamanho, padding/gaps, tipografia computada e indicadores geométricos.
As caixas são relativas à tela, em pixels CSS, incluindo transformações.
`rendered` indica presença no layout; `visible` considera visibilidade/opacidade sem verificar oclusão.
As medidas de leitura não são gravadas nas dimensões base do projeto.

Use `breakpoint` **ou** `width` inteiro entre 200 e 4000 px; sem ambos, usa a largura desktop da tela.
`id` deve ser um frame raiz ou um frame dentro de uma seção raiz; `depth` é relativo ao escopo,
de 0 a 8, com padrão 1. A ferramenta também entrega até **20 linhas e 8 KiB** por padrão.

Ajustar alvos com `update_layers`:

```json
{
  "updates": [
    { "id": "ID_DO_TEXTO_1", "props": { "fontSize": 18 } },
    { "id": "ID_DO_TEXTO_2", "props": { "fontSize": 18 } }
  ]
}
```

O lote exige IDs únicos e valida todos os itens antes de publicar. Um erro não deixa parte do lote
aplicada. Ele ajusta propriedades base; alterações de breakpoint/estado continuam em suas ferramentas próprias.

Nas duas consultas paginadas, `count` é a quantidade entregue e `total` conta os resultados dentro
do filtro/escopo e profundidade solicitados. Continue com `offset: nextOffset` enquanto `hasMore`.
`limit` vai até 100 e `maxBytes` de 1024 a 65536; o orçamento pode reduzir a quantidade entregue.
Recomece a paginação depois de alterar o projeto ou os filtros.
O orçamento inclui JSON formatado e avisos, exclui o envelope MCP e **não mede tokens nem cobrança**.

## Limites e o que ainda não foi verificado

- Sem Chromium, `inspect_layout`, `get_image` e `edit_image` não executam; a parte medida de
  `check_design` fica pendente. Dados base e código continuam disponíveis, sem inventar medidas reais.
- O navegador de medição roda sem JavaScript do projeto e sem rede externa. Fontes hospedadas
  funcionam; fontes externas não hospedadas podem ser substituídas pelo sistema.
- Indicadores de saída da janela/pai/conteúdo não são erros automáticos: recorte e rolagem podem
  ser intencionais. A inspeção não avalia estética, sobreposição ou oclusão, nem executa estados/interações.
- Edição de fotos aceita até 16 MiB, 8192 px por lado e 16 milhões de pixels; efeitos por pixel até
  4 milhões após o recorte. Remoção de fundo é simples, pela cor das bordas. GIF vira quadro estático,
  SVG é rasterizado e metadados EXIF não são preservados. Detalhes em [FERRAMENTAS.md](FERRAMENTAS.md).
- `generate_image_edit` está anunciado, mas indisponível no servidor MCP. Não há suporte generativo
  verificado para criar imagens, preencher áreas ou remover objetos por IA.
- Pexels, Pixabay e Poly Pizza não foram conferidos com chaves reais. Reprodução de vídeo/áudio/3D/Lottie
  precisa ser conferida no resultado exportado; uma medida ou imagem estática não comprova reprodução.
- PDF, apresentações, React Native e variante TypeScript do React não estão implementados.
  Formatos futuros e decisões de negócio continuam com a pessoa dona do projeto.
- O editor legado e os testes antigos em `tests/e2e` ficam fora da validação atual.

## Verificação

Última verificação de código, em **2026-10-12**: **507 testes passaram, 0 falhas e 0 pulados**,
com `STYLO_CHROMIUM_PATH=/usr/bin/chromium`; `npm run typecheck` passou.

O cliente oficial MCP conferiu busca paginada, ajustes em lote, medidas desktop/mobile,
correção de saída horizontal e ausência de alteração do projeto salvo durante a inspeção.
Testes com Chromium também conferiram isolamento e proteção contra HTML que falsificava identificadores de camadas.
A última implementação não verificou composição estética, provedores com chave real ou exportação;
checagens de exportação em blocos anteriores e demais ressalvas estão em [PASSAGEM.md](PASSAGEM.md)
e [decisoes.md](decisoes.md).

Para repetir a suíte usando um Chromium já instalado no Linux:

```bash
STYLO_CHROMIUM_PATH=/usr/bin/chromium npm test
npm run typecheck
```

## Documentação do projeto

- [PROMPT-INICIAL.md](PROMPT-INICIAL.md): leitura obrigatória para agentes que assumem o projeto; regras e protocolo de trabalho.
- [PASSAGEM.md](PASSAGEM.md): estado atual, preparação, próximos passos e decisões reservadas à pessoa dona.
- [contexto.md](contexto.md): arquitetura, vocabulário, mapa do código e receitas técnicas.
- [FERRAMENTAS.md](FERRAMENTAS.md): capacidades por grupo, limites e propostas.
- [decisoes.md](decisoes.md): histórico de decisões e verificações; novas entradas só no fim.
- [NOTICE](NOTICE): licenças de terceiros. [LICENSE](LICENSE): licença atual MIT; decisões futuras em PASSAGEM.md.

Contribuições e continuidade deste trabalho ficam na **`limpeza`**. Não mexer no editor,
na `main` ou nas decisões de licença/negócio sem instrução da pessoa dona.
