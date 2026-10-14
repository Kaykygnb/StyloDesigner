# Instalação, configuração e solução de problemas

## Requisitos

- **Node.js 22 ou mais novo** e npm.
- Um navegador moderno (Chrome, Edge ou Firefox) para usar o painel.
- **Chromium** (opcional, recomendado) para medidas reais, imagem da tela (`get_image`), auditoria de vazamento e edição de fotos pelo agente. Já tem um instalado? Aponte com `STYLO_CHROMIUM_PATH`. Senão: `npx playwright install chromium`. Sem navegador essas ferramentas avisam e o resto funciona.

## Instalar e rodar

```bash
git clone --branch metaClaude https://github.com/Kaykygnb/StyloDesigner.git
cd StyloDesigner
npm install
npm start
```

Abra **http://localhost:5173/studio/**. No primeiro acesso o painel pede para **criar a conta de administração** (modo com contas, o padrão).

Para uma versão compilada do painel: `npm run build` (o servidor usa `apps/studio/dist` se existir; `STYLO_DEV=1` força o modo de desenvolvimento).

### Windows, macOS e Linux

Funciona nos três. No Windows use PowerShell ou Git Bash; variáveis de ambiente em PowerShell: `$env:STYLO_AUTH='local'; npm start`.

## Onde ficam os dados

| Caminho | O que é | No git? |
|---|---|---|
| `designer.db/` | banco PGlite (projetos, contas, versões…) | não |
| `designer.blobs/` | arquivos enviados (biblioteca, imagens) | não |
| `designer.secret` | chave que cifra segredos (chaves de provedores) | **nunca** |
| `designer.config.json` | configurações do servidor | não |
| `designer.db.before-migrations-*/` | cópia automática antes de uma migração | não (pode apagar) |

Para recomeçar do zero, pare o servidor e renomeie ou apague `designer.db/`.

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `PORT` | Porta (padrão `5173`). |
| `STYLO_HOST` | `127.0.0.1` ou `localhost` escuta só neste computador; qualquer outro valor (ou vazio) escuta na rede local (`0.0.0.0`). |
| `STYLO_AUTH` | `accounts` (padrão: contas e senha) ou `local` (sem login; só testes e desenvolvimento). |
| `DESIGNER_DB_DIR` | Pasta do PGlite (padrão `designer.db`; `memory` = em memória, some ao parar). |
| `DATABASE_URL` | Usa PostgreSQL em vez do PGlite. Há um teste de integração contra um Postgres descartável, mas ninguém usou isso no dia a dia ainda; trate como experimental. |
| `DESIGNER_CONFIG` | Caminho do arquivo de configuração. |
| `STYLO_SECRET_KEY` | Chave de 32 bytes em base64 para cifrar segredos (senão é criada em `designer.secret`). |
| `STYLO_BLOB_DIR` | Pasta dos arquivos enviados (`memory` para testes). |
| `STYLO_LIBRARY_QUOTA_MB` | Limite da biblioteca por conta (padrão 2048). |
| `STYLO_CHROMIUM_PATH` | Executável do Chromium/Chrome. |
| `PEXELS_API_KEY` | Chave opcional do Pexels (também pode ser salva em Administração). |
| `STYLO_DEV` | `1` força o painel em modo desenvolvimento (Vite). |

## Conectar agentes (MCP)

- **HTTP:** `http://localhost:5173/mcp`. Claude Code: `claude mcp add --transport http stylo http://localhost:5173/mcp`.
- **Com contas:** cadastre o agente em **Administração → Agentes** (ou na tela **Conexões MCP**), escolha os escopos (leitura, comentário, escrita, exportação) e use o **token Bearer** gerado (aparece uma vez). O guia na tela gera a configuração para Claude Code, Codex e outros.
- **Rede local:** em Administração há os endereços do computador e um QR Code. Compartilhe só em rede confiável.
- As instruções que o agente recebe estão em `apps/server/src/instrucoes-agente.txt`.

## Backups e versões

- **Versões do projeto:** automáticas; aba Histórico (nomear, comparar, duplicar, restaurar).
- **Backups do banco:** Administração → Backups cria snapshots; restaurar prepara a troca para o próximo reinício e guarda o banco atual em quarentena.
- **Antes de migrações** o servidor copia o banco para `designer.db.before-migrations-*`.

## Solução de problemas

| Sintoma | O que fazer |
|---|---|
| `O banco PGlite não pôde ser lido` | Pare o servidor, renomeie a pasta `designer.db` (ex.: `designer.db.antigo`) e inicie de novo (cria um banco novo), ou restaure um backup. Evite encerrar o terminal à força enquanto o servidor roda; use `Ctrl+C`. |
| Porta em uso | `PORT=5180 npm start` (PowerShell: `$env:PORT=5180`). |
| `get_image` ou medidas dizem que falta navegador | Instale o Chromium (`npx playwright install chromium`) ou defina `STYLO_CHROMIUM_PATH`. |
| Esqueci a senha de administração | Pare o servidor e renomeie `designer.db` (alpha: dados descartáveis). |
| Painel em branco após atualizar | `npm install` de novo; se usar a versão compilada, `npm run build`. |
| "A ferramenta … não está disponível agora" | O plugin que a oferece está desativado: ative em Administração → Plugins. |
