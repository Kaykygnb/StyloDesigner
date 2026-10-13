# Quality gates

## Obrigatórios para mudança de código

```bash
npm run typecheck
npm test
```

Para Studio: `npm run build`. Para entrada humana, contas ou fluxo administrativo: `npm run test:e2e` (compila o Studio e inicia um servidor accounts descartável por padrão).

## Automação na CI

O workflow `.github/workflows/ci.yml` executa `npm run typecheck` e `npm test` em Node 22 e 24. A matriz instala Chromium com `npx playwright install --with-deps chromium` antes da suíte, que inclui renderização e fluxo do editor. Um job obrigatório adicional compila o Studio com `npm run build` e valida o formato das tarefas com `node docs/planning/validate-tasks.mjs` em Node 22. Esses jobs rodam em pull requests e pushes em `main`, `v0.1.0-beta` e `feat/**`.

O job `navegador` é obrigatório para o resultado do workflow e executa administração e login humano em Chromium/accounts, com servidor, porta, banco, configuração e assets isolados pelo runner. Não usa `continue-on-error`; em falha publica os diagnósticos de `capturas/e2e/`. A obrigatoriedade de checks para merge depende das regras de proteção configuradas no GitHub.

## Evidência mínima

Registrar comando, resultado, data, testes relevantes, limitações externas e se a mudança altera contrato, persistência, autorização, ferramenta ou exportação.

## Gate documental

Antes de concluir, verificar: capacidades, contratos, módulo responsável, risco, tarefa relacionada e matriz de regressão. Propostas devem usar o rótulo **Proposto**.
