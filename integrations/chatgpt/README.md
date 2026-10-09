# ChatGPT (site e app) com o Stylo

## Situação hoje

O ChatGPT do site/app só conecta a servidores MCP **pela internet**, num endereço **HTTPS** público (modo desenvolvedor → criar app/conector). Ele não consegue falar com programas locais como o `scripts/mcp.mjs`, nem com `http://localhost`.

O servidor do Stylo, de propósito, **só aceita pedidos deste computador**: ele lê e grava os seus projetos, e com o acesso de administrador age sem perguntar. Abrir isso para a internet (com um túnel como Cloudflare Tunnel ou ngrok) exigiria uma proteção que o app ainda não tem: autenticação forte (OAuth ou um segredo no endereço), limitar o que um acesso remoto pode fazer e registrar tudo. Por isso **não há acesso remoto pronto**.

## Como usar modelos GPT agora

1. **Codex** (CLI da OpenAI, modelos GPT): conecta pelo MCP local, com todas as 33 ferramentas. Veja [`../codex/config.toml`](../codex/config.toml) e [`../codex/AGENTS.md`](../codex/AGENTS.md).
2. **Assistente interno** (botão ✦ no topo do editor): escolha o provedor **OpenAI** em Configurações → Assistente de IA e MCP, cole a sua chave e escolha um modelo GPT. Ele usa as mesmas ferramentas (menos a imagem, que o chat não recebe).

## Se um dia quiser o ChatGPT do site

Isso é uma decisão sua, porque expõe o editor na internet. O caminho seria:
1. adicionar ao servidor um endereço remoto protegido (autenticação + permissões limitadas);
2. publicar com um túnel HTTPS (ex.: `cloudflared tunnel --url http://localhost:5173`);
3. no ChatGPT: Configurações → modo desenvolvedor → criar app com o endereço do túnel.

O ChatGPT também pede confirmação antes de ações que alteram dados, e o plano da conta precisa permitir o modo desenvolvedor (isso varia por plano).
