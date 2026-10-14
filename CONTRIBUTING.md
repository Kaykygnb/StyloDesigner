# Como contribuir com o Stylo

Obrigado por querer ajudar! O Stylo é um alpha: há muito a fazer e muita coisa que só quem usa pela primeira vez percebe. Você não precisa ser expert em nada para ser útil.

## Formas de ajudar (da mais fácil para a mais difícil)

1. **Usar e relatar.** Instale (veja o [README](README.md)), tente montar um site de verdade e abra uma issue com o que quebrou, confundiu ou faltou. Print e passo a passo ajudam muito.
2. **Testar com um agente de IA.** Conecte Claude Code, Codex, Cursor ou outro cliente MCP e conte o que funcionou. Hoje só o cliente oficial do SDK foi testado.
3. **Melhorar a documentação.** Achou algo confuso, desatualizado ou só em português quando devia ter inglês? Corrija.
4. **Corrigir algo pequeno.** Veja [docs/BOAS-PRIMEIRAS-ISSUES.md](docs/BOAS-PRIMEIRAS-ISSUES.md) e as issues marcadas com `good first issue`.
5. **Construir uma funcionalidade.** Abra uma issue antes, para alinharmos o desenho. Veja o [que falta](docs/ROADMAP-ALPHA.md).

## Preparar o ambiente

Precisa de **Node.js 22+** e git.

```bash
git clone https://github.com/<seu-usuario>/StyloDesigner.git   # seu fork
cd StyloDesigner
git checkout metaClaude   # branch oficial do alpha por enquanto
npm install
STYLO_AUTH=local npm start      # painel em http://localhost:5173/studio/ sem login
```

## Antes de mandar o pull request

```bash
npm run typecheck   # tipos de todos os pacotes
npm test            # suíte completa (alguns minutos)
```

Dicas para a suíte:

- Sem Chromium, os testes que precisam dele são **pulados**. Para rodá-los: `npx playwright install chromium` ou `STYLO_CHROMIUM_PATH=/caminho/do/chrome`.
- O teste do PostgreSQL descartável não roda como `root` (o `initdb` recusa). Pule com `STYLO_SKIP_POSTGRES_TEST=1 npm test`.
- Um teste só: `node --import tsx --import ./tests/_setup.mjs --test tests/arrange.test.ts`.
- `tests/workspace.test.ts` é lento e pode estourar o tempo em máquinas fracas (está na lista de [boas primeiras issues](docs/BOAS-PRIMEIRAS-ISSUES.md)); se só ele falhar e você não mexeu em workspace, avise no PR.

Mudou algo no painel (`apps/studio`)? Rode também `npm run build`. Mudou o catálogo de ferramentas MCP? Rode `npm run docs:ferramentas` e `npm run docs:inventario` e inclua os arquivos gerados.

## Regras que não mudamos

Estas aparecem também em [CLAUDE.md](CLAUDE.md):

- **O painel nunca altera o documento direto.** Toda ação é uma ferramenta MCP (`apps/studio/src/lib/api.ts` → `tool()`). Faltou uma capacidade? Primeiro a ferramenta em `packages/core`, depois o botão.
- **Nunca** ponha `allow-scripts` no `iframe` do canvas. Entre iframes não use `instanceof Element`.
- **Não enfraqueça um teste para ele passar.** Se o teste está errado, explique por quê no PR.
- Não altere `LICENSE`. Não commite segredos (`*.secret`, `designer.config.json`, `designer.db*/`, `designer.blobs/`).
- Mensagens para o usuário e para agentes ficam em português do Brasil, simples, dizendo a causa e o que fazer.

Receitas passo a passo (nova ferramenta, plugin, migração) estão em [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md); a visão geral do código em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Pull requests

- Pequenos e focados: uma ideia por PR.
- Descreva **antes e depois** em linguagem simples e como você verificou. Print ajuda em mudança visual.
- Escreva em português ou inglês, como preferir.
- A CI roda tipos, testes (Node 22 e 24), build e o e2e de administração. PR vermelho não é mesclado.
- Quer ajuda com uma dúvida? Abra o PR como rascunho e pergunte lá.

## Conduta

Seja gentil e paciente, principalmente com quem está começando. Veja o [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Segurança

Achou uma falha de segurança? **Não abra issue pública.** Veja [SECURITY.md](SECURITY.md).
