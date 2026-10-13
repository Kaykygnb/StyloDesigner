# Quality gates

## Obrigatórios para mudança de código

```bash
npm run typecheck
npm test
```

Para Studio: `npm run build`. Para o fluxo administrativo: `npm run test:e2e` com servidor e configuração exigidos pelo teste.

## Evidência mínima

Registrar comando, resultado, data, testes relevantes, limitações externas e se a mudança altera contrato, persistência, autorização, ferramenta ou exportação.

## Gate documental

Antes de concluir, verificar: capacidades, contratos, módulo responsável, risco, tarefa relacionada e matriz de regressão. Propostas devem usar o rótulo **Proposto**.
