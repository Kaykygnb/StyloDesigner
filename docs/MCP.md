# Conectar o MCP do Stylo

Este documento explica como expor o Stylo a ferramentas que falam MCP. O Stylo pode ser usado por uma pessoa no navegador e por um agente ao mesmo tempo.

## Antes de conectar

Na pasta do Stylo, instale as dependências e inicie o servidor:

```bash
npm install
npm start
```

Abra `http://localhost:5173/studio/` no navegador e mantenha o editor aberto. O endpoint MCP HTTP é:

```text
http://localhost:5173/mcp
```

O servidor é local por segurança. Ele aceita apenas `localhost`, `127.0.0.1` e `[::1]`. Um cliente remoto, incluindo uma conversa hospedada na nuvem, não consegue acessar esse endereço diretamente.

## Criar uma conexão e token

1. No Stylo, abra **Mais → Agentes**.
2. Crie uma conexão com o nome do cliente, por exemplo `Codex` ou `ChatGPT Work`.
3. Conceda somente as permissões necessárias:
   - `read`: ler o projeto;
   - `comment`: criar comentários e decisões;
   - `write`: criar e editar;
   - `export`: gerar HTML, React e arquivos exportados.
4. Autorize os projetos que a conexão pode abrir.
5. Copie o token imediatamente. Ele é exibido apenas uma vez.

O token deve ser enviado como:

```http
Authorization: Bearer stylo_agt_...
```

Não coloque o token no Git, em screenshots ou em mensagens públicas. Para invalidá-lo, revogue a conexão ou use **Rotacionar token**.

## Codex local

### Opção recomendada: HTTP

O Codex local pode usar o endpoint Streamable HTTP. No arquivo de configuração do Codex, adicione uma entrada equivalente a esta, substituindo o token:

```toml
[mcp_servers.stylo]
url = "http://localhost:5173/mcp"
headers = { Authorization = "Bearer stylo_agt_SEU_TOKEN" }
tool_timeout_sec = 200.0
```

O nome da seção pode variar conforme a versão do cliente; o importante é usar o servidor `stylo`, a URL `5173/mcp` e o header de autorização.

### Opção alternativa: ponte STDIO

Use a ponte quando a versão do cliente aceitar somente servidores MCP como processos locais:

```toml
[mcp_servers.stylo]
command = "node"
args = ["C:/caminho/StyloDesigner/apps/server/bin/mcp.mjs"]
env = { STYLO_TOKEN = "stylo_agt_SEU_TOKEN", STYLO_AGENT = "Codex" }
tool_timeout_sec = 200.0
```

A ponte encaminha as mensagens para `http://localhost:5173/mcp`. Portanto, o `npm start` e o navegador continuam sendo necessários.

No Windows, use o caminho absoluto real do checkout. Não reutilize caminhos de outra cópia do projeto.

## Claude Code

```bash
claude mcp add --transport http stylo http://localhost:5173/mcp --header "Authorization: Bearer stylo_agt_SEU_TOKEN"
```

Se for necessário usar STDIO:

```bash
claude mcp add stylo -- node C:/caminho/StyloDesigner/apps/server/bin/mcp.mjs
```

Nesse caso, forneça `STYLO_TOKEN` no ambiente do processo.

## Claude Desktop, Cursor, Windsurf e clientes genéricos

Quando o cliente aceitar configuração JSON, use:

```json
{
  "mcpServers": {
    "stylo": {
      "url": "http://localhost:5173/mcp",
      "headers": {
        "Authorization": "Bearer stylo_agt_SEU_TOKEN"
      }
    }
  }
}
```

Se o cliente não aceitar HTTP, use a ponte STDIO mostrada na seção do Codex.

## ChatGPT e Work

Uma conversa hospedada no ChatGPT/Work não acessa `localhost` diretamente. Para usá-la com o Stylo, é necessário um conector/app MCP executado no mesmo computador ou um gateway HTTPS autenticado que encaminhe para o Stylo.

O projeto já oferece o endpoint MCP e a ponte STDIO, mas não cria automaticamente um conector hospedado para ChatGPT/Work. Não exponha o servidor diretamente à internet sem autenticação forte, TLS, controle de origem e limites de acesso.

Quando houver um conector local disponível, configure-o com:

```text
URL: http://localhost:5173/mcp
Header: Authorization: Bearer stylo_agt_SEU_TOKEN
Transporte: Streamable HTTP
```

## Primeiro teste

Depois de conectar, peça ao agente para executar, nesta ordem:

1. `get_document` — confirmar que ele enxerga o projeto;
2. `get_project_map` — entender páginas, tokens e navegação;
3. `list_notes` — ler decisões existentes;
4. `get_image` — revisar visualmente a página atual;
5. uma alteração pequena com `update_layer`;
6. `get_image` novamente para confirmar o resultado.

Para criar um projeto do zero, use `new_project` e depois `build_layout`. Para um projeto existente, leia primeiro a seleção ou a camada antes de editar.

## Diagnóstico rápido

### `ECONNREFUSED` ou servidor indisponível

- confirme que `npm start` continua rodando;
- abra `http://localhost:5173/studio/`;
- confira se o cliente usa `5173/mcp`, não `5174/mcp`;
- confirme que não há outra cópia do Stylo ocupando a porta.

### `401` ou token recusado

- gere ou rotacione o token em **Mais → Agentes**;
- envie `Authorization: Bearer ...`;
- confirme que a conexão está ativa;
- confira se o agente está autorizado para aquele projeto.

### O cliente conecta, mas não pode editar

A conexão precisa ter a permissão `write`. Para exportar, também precisa de `export`; para comentários, `comment`.

### O agente não enxerga o projeto

Abra o projeto no Stylo, autorize o arquivo/projeto para a conexão e peça ao agente para executar `list_projects` e `open_project` antes de `get_document`.

### O editor não atualiza

Mantenha o navegador aberto. O MCP trabalha no workspace persistido do servidor e sincroniza com o editor aberto; recarregar a página pode resolver uma sessão visual antiga.

## Segurança e limites

- O token concede exatamente os escopos selecionados, mas `write` permite alterar o projeto autorizado.
- O MCP é local-first e não foi projetado para ficar aberto na internet.
- O servidor mantém sessões MCP e identifica o agente no histórico.
- Alterações feitas por agentes entram no histórico do Stylo e podem ser desfeitas.
- Antes de entregar um site, revise `get_image`, `check_design`, `get_code` e `export_site`.
