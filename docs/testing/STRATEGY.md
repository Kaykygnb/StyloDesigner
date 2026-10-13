# Estratégia de testes

O projeto usa `node:test` com setup compartilhado e testes TypeScript/JavaScript. A estratégia combina:

1. funções puras do core (modelo, CSS, HTML, geometria);
2. contrato de ferramentas e runner;
3. integração de servidor, banco, auth, assets e MCP;
4. fluxo de UI com Playwright quando Chromium está disponível;
5. testes de segurança e limites.

O teste deve atravessar a interface pública do módulo sempre que possível. Mocks são adapters aceitáveis, mas não substituem um teste de integração para cada fluxo crítico.
