# Efetividade e lacunas

## Forte

O conjunto testa invariantes de segurança, rejeição de argumentos, atomicidade de lotes, undo, sanitização, exportação e compatibilidade do modelo. Há integração real de MCP oficial e fluxo de Studio.

## Riscos remanescentes

- sucesso contra PostgreSQL externo não demonstrado;
- providers pagos/externos dependem de ambiente real;
- cobertura de browsers e touch é limitada;
- renderização visual não é uma comparação visual sistemática;
- não há matriz explícita de cada ferramenta para escopo, lock, undo e resposta.

Na execução da suíte, o fluxo visual do Studio também registrou avisos do Vite sobre `ResizeObserver loop completed with undelivered notifications`. O teste terminou aprovado, mas o aviso deve ser investigado antes de ser tratado como ruído.

## Próxima investigação

Criar inventário gerado do catálogo de ferramentas e ligar cada ferramenta a schema, handler, teste, escopo e lock sem declarar cobertura onde não houver teste.
