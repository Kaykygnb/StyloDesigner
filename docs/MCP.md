# MCP: usar o Claude, o Codex (GPT) e outros programas de IA no editor

O **MCP** (*Model Context Protocol*) é o "padrão de tomada" que programas de IA usam para operar ferramentas externas. O Stylo tem um servidor MCP embutido: com o app aberto, o **Claude Code**, o **Claude Desktop**, o **Codex** (modelos GPT) e outros conseguem ver e alterar o design aberto no navegador, sem limite de chamadas (é tudo no seu computador).

> **Regra de ouro:** o MCP só funciona com `npm start` rodando **e** o editor aberto no navegador (http://localhost:5173). Quem executa as ações é o editor, então o canvas atualiza na hora e tudo sai com Ctrl+Z.

---

## 1. Ligar cada programa

| Programa | Como ligar |
|---|---|
| **Claude Code (plugin, recomendado)** | Dentro do Claude Code: `/plugin marketplace add Kaykygnb/projetodesigner2` e depois `/plugin install projeto-designer@projeto-designer`. Traz o MCP já configurado e o guia de trabalho (skill `projeto-designer`). |
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

## 3. O que a IA consegue fazer (33 ferramentas)

| Grupo | Ferramentas |
|---|---|
| Ver e ler | `get_document` (projeto, páginas, árvore, paleta), `get_selection`, `get_layer`, `find_layers`, **`get_image`** (PNG da tela: a IA *vê* o design), `get_code` (HTML/CSS de uma camada), `export_html` (o arquivo HTML completo) |
| Criar | **`build_layout`** (uma página/seção inteira numa chamada, com ícones), `create_layer`, `duplicate_layers`, `search_icons` + `insert_icon` (Material Symbols do Google) |
| Estilo | `update_layer` (qualquer propriedade: cor, texto, fonte, layout, tamanho, etiqueta HTML...), `create_color_styles` (paleta → variáveis de CSS), `list_fonts`, `set_state` (hover, pressionado, foco) |
| Responsivo | `set_responsive` (só no Tablet ≤ 1024px ou só no Celular ≤ 640px → `@media`) |
| Componentes | `create_component`, `create_instance` |
| Protótipo e revisão | `add_interaction` (clicar → ir para outra tela / voltar / abrir site), `add_comment` |
| Estrutura | `move_layer`, `delete_layers`, `select_layers`, `create_page`, `switch_page`, `delete_page`, `undo`, `redo` |
| Projetos *(administrador)* | `list_projects`, `open_project`, `save_project`, `new_project` |

O que cada uma aceita está descrito no próprio MCP (a IA lê sozinha). As **instruções da IA** (quem ela é, regras de layout da plataforma, habilidades de design e a receita de página) ficam em [`docs/AGENTE.md`](AGENTE.md): o servidor manda esse texto para todo programa que conecta. Editou, vale na próxima conexão.

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
