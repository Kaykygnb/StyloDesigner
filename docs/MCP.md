# MCP: usar o Claude, o Codex (GPT) e outros programas de IA no editor

O **MCP** (*Model Context Protocol*) é o "padrão de tomada" que programas de IA usam para operar ferramentas externas. O Stylo tem um servidor MCP embutido: com o app aberto, o **Claude Code**, o **Claude Desktop**, o **Codex** (modelos GPT) e outros conseguem ver e alterar o design aberto no navegador, sem limite de chamadas (é tudo no seu computador).

> **Regra de ouro:** o MCP só funciona com `npm start` rodando **e** o editor aberto no navegador (http://localhost:5173). Quem executa as ações é o editor, então o canvas atualiza na hora e tudo sai com Ctrl+Z.

---

## 1. Ligar cada programa

| Programa | Como ligar |
|---|---|
| **Claude Code (plugin, recomendado)** | Dentro do Claude Code: `/plugin marketplace add Kaykygnb/StyloDesigner` e depois `/plugin install projeto-designer@projeto-designer`. Traz o MCP já configurado e o guia de trabalho (skill `projeto-designer`). |
| Claude Code (sem plugin) | `claude mcp add --transport http designer http://localhost:5173/mcp` (acrescente `--scope user` para valer em todas as pastas). |
| **Codex (GPT)** | Copie o bloco de [`integrations/codex/config.toml`](../integrations/codex/config.toml) para `~/.codex/config.toml` (troque o caminho) e o [`integrations/codex/AGENTS.md`](../integrations/codex/AGENTS.md) para `~/.codex/AGENTS.md`. |
| Claude Desktop | Configurações → Desenvolvedor → Editar configuração → em `mcpServers`: `"projeto-designer": { "command": "node", "args": ["CAMINHO/DO/PROJETO/scripts/mcp.mjs"] }`. Reinicie o Claude Desktop. |
| Cursor, Windsurf e outros | Servidor MCP HTTP em `http://localhost:5173/mcp`, ou stdio com `node CAMINHO/scripts/mcp.mjs`. |
| **ChatGPT (site/app)** | Ainda não: veja [`integrations/chatgpt/README.md`](../integrations/chatgpt/README.md). Para usar modelos GPT hoje: o **Codex** (acima) ou o **Assistente** interno com a sua chave da OpenAI. |

Os comandos prontos para copiar também aparecem em **Configurações → Assistente de IA e MCP**, com o caminho certo da sua pasta.

## 2. Permissão e "Acesso de administrador"

- **Normal (padrão):** cada alteração feita por um programa de IA abre uma janela no editor: *"Claude Code quer alterar “Card”: padding"*, com **Permitir**, **Permitir tudo nesta sessão** ou **Recusar**. Leituras (ver, procurar, gerar imagem) não perguntam.
- **Acesso de administrador** (Configurações → Assistente de IA e MCP → caixa *Acesso de administrador*): os programas **deste computador** alteram **sem perguntar** e ganham as ferramentas de **projeto** (listar, abrir, salvar e criar projetos na pasta). Cada alteração aparece num aviso na tela e continua saindo com Ctrl+Z. A opção fica gravada no `designer.config.json` (fora do git).
- O endereço `/mcp` só aceita pedidos **desta máquina** (`localhost`), nunca de outro computador nem de um site aberto no navegador. Isso vale com ou sem acesso de administrador.

## 2.1 Vários agentes ao mesmo tempo

Cada conexão MCP é uma **sessão** com nome próprio (cabeçalho `Mcp-Session-Id`, criado no `initialize`). Duas pessoas podem deixar projetos diferentes abertos em abas distintas, e cada sessão MCP escolhe explicitamente qual aba controla:

- `list_editors` mostra as abas conectadas e seus ids;
- `select_editor` vincula a sessão ao id escolhido. A escolha persiste para leituras, escritas e `open_project` daquela sessão;
- se a aba escolhida desconectar, a chamada falha com orientação para listar e selecionar outra. O servidor não redireciona silenciosamente para a última aba conectada;
- sem seleção, mantém compatibilidade com o comportamento anterior e usa a aba conectada mais recente.

Depois disso dá para deixar o Claude Code montando o cabeçalho numa aba enquanto o Codex ajusta o rodapé em outra:

- **Nome de cada agente**: vem do programa (ex.: `claude-code`). Para dar um nome seu, use `--agente` no script stdio ou a variável `STYLO_AGENT`:
  `claude mcp add stylo-layout -- node scripts/mcp.mjs --agente "Layout"` e `claude mcp add stylo-revisor -- node scripts/mcp.mjs --agente "Revisor"`. Pelo endereço HTTP, mande o cabeçalho `X-Stylo-Agent`.
- **Travas**: cada chamada de escrita tem uma trava própria. Escritas paralelas da mesma sessão não podem disputar a mesma camada; quem altera uma camada fica com ela enquanto a operação estiver ativa e por mais 10 s depois de terminar. Operações sem uma camada específica (por exemplo, criar página ou desfazer) travam o documento inteiro enquanto rodam. Outro agente que tentar mexer no recurso recebe um erro claro e pode seguir em outra parte.
- **Presença**: os avatares no topo do editor mostram as pessoas com o editor aberto e os agentes conectados; o painel "No projeto agora" lista o que cada um fez e o que está travando. `GET /api/presence` devolve o mesmo em JSON.
- **Desconexão e cancelamento**: clientes HTTP encerram a sessão com `DELETE /mcp` e o cabeçalho `Mcp-Session-Id`; o proxy stdio faz isso quando o processo fecha normalmente. `notifications/cancelled` cancela uma operação MCP que ainda aguarda a permissão no editor. Se uma chamada passar de 3 minutos sem resposta, o servidor também pede o cancelamento, mantendo a trava até o editor confirmar ou desconectar. Sessões abandonadas são removidas após 10 minutos sem atividade.

**Limites atuais:** as travas coordenam clientes MCP no mesmo servidor, mas não bloqueiam edição manual na interface nem sincronizam o documento entre abas. Se duas sessões escolherem a mesma aba, trabalham sobre o mesmo documento; se escolherem abas diferentes, cada uma atua no estado daquela aba. Cada cliente deve reenviar o `Mcp-Session-Id` devolvido por `initialize`; `tools/call` sem esse cabeçalho recebe HTTP 400 para não misturar identidade e travas entre clientes. Não há chat direto entre agentes MCP: eles compartilham presença, atividade, travas e comentários presos ao design; comentários não são um canal de mensagens. O servidor ainda usa o protocolo MCP com `initialize` e sessões (revisão de 2025); a revisão sem sessões publicada em 2026 ainda não é compatível. Clientes atuais que negociam a revisão antiga continuam usando o fluxo documentado aqui.

Sem `select_editor`, o servidor encaminha chamadas à aba conectada mais recentemente. Para evitar que uma nova aba altere o destino implícito de um cliente, agentes devem chamar `list_editors` e selecionar explicitamente o editor. O roteamento padrão por aba ainda precisa de uma decisão de produto e permanece no roadmap.

## 3. O que a IA consegue fazer (41 ferramentas de design + 2 de sessão MCP)

| Grupo | Ferramentas |
|---|---|
| Ver e ler | `get_document` (projeto, páginas, árvore, paleta), `get_comments` (anotações e respostas com camada/página), `get_project_css`, `get_selection`, `get_layer`, `find_layers`, `list_assets` (imagens do projeto sem enviar os arquivos), **`get_image`** (PNG da tela: a IA *vê* o design), `get_code` (HTML/CSS de uma camada), `export_html` (um HTML), `export_site` (todas as pranchetas como arquivos HTML) |
| Criar | **`build_layout`** (uma página/seção inteira numa chamada, com ícones), `create_layer`, `duplicate_layers`, `insert_asset` (reutilizar imagem do projeto), `search_icons` + `insert_icon` (Material Symbols do Google) |
| Estilo | `update_layer` (qualquer propriedade: cor, texto, fonte, layout, tamanho, etiqueta HTML...), `create_color_styles` (paleta → variáveis de CSS), `get_project_css` + `set_project_css` (CSS global, `@media`, `@keyframes`, efeitos CSS incluindo perspectiva 3D), `list_fonts`, `set_state` (hover, pressionado, foco) |
| Responsivo | `set_responsive` (só no Tablet ≤ 1024px ou só no Celular ≤ 640px → `@media`) |
| Componentes | `create_component`, `create_instance` |
| Protótipo e revisão | `add_interaction` (clicar → ir para outra tela / voltar / abrir site), `add_comment` |
| Estrutura | `move_layer`, `delete_layers`, `select_layers`, `create_page`, `switch_page`, `delete_page`, `undo`, `redo` |
| Projetos *(administrador)* | `list_projects`, `open_project`, `save_project`, `new_project` |
| Escopo da sessão MCP | `list_editors`, `select_editor` |

O que cada uma aceita está descrito no próprio MCP (a IA lê sozinha). O MCP não envia o arquivo JSON bruto; agentes consultam `get_document`, `get_layer`, `get_code`, `get_project_css`, `get_image` e `get_comments` para receber estrutura, código, imagem e anotações do editor. `set_project_css` substitui a folha CSS global depois da aprovação; a exportação sanitiza a folha. Animações `@keyframes` e CSS 3D foram verificados no canvas e no HTML exportado. As **instruções da IA** (quem ela é, regras de layout da plataforma, habilidades de design e revisão) ficam em [`docs/AGENTE.md`](AGENTE.md): o servidor manda esse texto para todo programa que conecta. Editou, vale na próxima conexão.

### Exportação e funcionamento do site

`export_html` produz o HTML de uma tela em trechos UTF-8 de 256 KiB por padrão; continue com `offset=nextOffset` até `complete:true`. `export_site` percorre as pranchetas visíveis do projeto: a primeira vira `index.html` e as demais recebem nomes derivados das pranchetas, com colisões numeradas. Por padrão, o MCP retorna `files[{path,bytes}]` e `warnings`, sem inserir HTML grande no contexto. Para ler conteúdo, envie `includeContent:true`; prefira também `path` para pedir um arquivo por vez e use `offset`/`nextOffset` em páginas grandes. Cada chamada limita o conteúdo a 256 KiB por padrão, até 1 MiB. A exportação humana baixa os HTMLs em ZIP. CSS e imagens ficam embutidos em cada página; fontes Google são carregadas pela rede. Links relativos para arquivos presentes no pacote continuam válidos; links `.html` sem destino ou com caixa diferente geram avisos.

É uma saída estática: animações e efeitos CSS exportados funcionam no navegador; `add_interaction` pertence ao modo **Apresentar** e não é exportado como JavaScript. Formulários sem endpoint não enviam dados. Scripts arbitrários não são executados; a camada “Código HTML” remove `<script>` e atributos `on*` por segurança. O pacote não cria rotas limpas nem projetos React/Vite.

## 4. Exemplos de pedido

- *"Abre o projeto loja.json e faz uma página de produto com galeria, preço, botão de comprar e avaliações."* (administrador)
- *"Revisa a tela Início: olha a imagem, aponta 3 problemas com comentários e corrige o espaçamento."*
- *"Deixa a tela Início responsiva: no celular o grid vira 1 coluna, o menu some e o título diminui."*
- *"Transforma o card de plano em componente e cria mais duas cópias com Pro e Equipe."*
- *"Liga o botão Começar à tela Cadastro com transição deslizando."*

## 5. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "O editor não está aberto" | Rode `npm start` e abra http://localhost:5173 (a aba precisa ficar aberta). |
| "O Stylo não está rodando" (stdio) | O `scripts/mcp.mjs` não achou o servidor: `npm start` primeiro. Porta diferente? Use a variável `DESIGNER_URL`. |
| A IA "espera" e nada acontece | Tem uma janela de permissão aberta no editor esperando você (ou ligue o acesso de administrador). |
| "precisa do Acesso de administrador" | Ferramentas de projeto: ligue em Configurações → Assistente de IA e MCP. |
| A imagem de `get_image` está com outra fonte | Normal: a imagem usa as fontes instaladas no computador; o editor e o HTML exportado usam as do Google. |
