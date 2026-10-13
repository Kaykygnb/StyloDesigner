# Estratégia de testes

O projeto usa `node:test` com setup compartilhado e testes TypeScript/JavaScript. A estratégia combina:

1. funções puras do core (modelo, CSS, HTML, geometria);
2. contrato de ferramentas e runner;
3. integração de servidor, banco, auth, assets e MCP;
4. fluxo de UI com Playwright quando Chromium está disponível;
5. testes de segurança e limites.

O teste deve atravessar a interface pública do módulo sempre que possível. Mocks são adapters aceitáveis, mas não substituem um teste de integração para cada fluxo crítico.

## Entrada humana e administração

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

O comando compila o Studio e chama `tests/e2e/run.mjs`. Por padrão, o runner usa porta livre e banco PGlite real, configuração e blobs em uma pasta temporária exclusiva, em `STYLO_AUTH=accounts`; não reutiliza `DATABASE_URL` do ambiente. Verifica a prontidão do servidor e banco vazio, executa as suítes em sequência e encerra processos/remove seus dados ao terminar, inclusive em falha. Cada suíte tem prazo de três minutos; a subida tem prazo de 60 segundos.

- `studio-admin-fluxo.mjs`: configuração do proprietário, criação de usuário/senha temporária, agentes/token/guia MCP, revogação, plugins e tradução da administração/biblioteca.
- `studio-login-fluxo.mjs`: senha incorreta, usuário editor em contexto separado, senha temporária/reload/saída/troca, projetos, cookie de sessão, logout/reentrada, sessão revogada, suspensão/reativação e menus conforme papel da conta. Confere largura de 390 px e registra screenshots.

`APP_URL` explícito conserva a opção de testar um servidor accounts externo com dados descartáveis; `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD` escolhem a conta de teste. Sem `APP_URL`, o servidor é sempre isolado. `CHROMIUM_PATH` escolhe o executável. Logs e screenshots ficam em `capturas/e2e/` (ou `STYLO_E2E_ARTIFACTS`), fora do Git; em falha a CI publica essa pasta como artifact. Esses testes não validam outros navegadores, recuperação de senha por e-mail ou PostgreSQL externo.
