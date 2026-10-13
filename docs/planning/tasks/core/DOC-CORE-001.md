# DOC-CORE-001 — Inventário verificável de ferramentas

- **Módulo:** core
- **Prioridade:** P0
- **Estado:** Proposto
- **Problema/evidência:** `schema.ts` registra catálogo e `runner.ts` monta handlers, mas não há matriz de handler, leitura/escrita, escopo, lock, undo, dependência externa e teste.
- **Objetivo:** produzir inventário gerado ou validado em teste sem duplicar descrições manualmente.
- **Escopo:** catálogo, runner, plugins e testes de contrato.
- **Fora do escopo:** mudar nomes, schemas ou comportamento.
- **Arquivos potenciais:** `packages/core/src/tools/schema.ts`, `runner.ts`, `runner/*`, testes de ferramentas.
- **Dependências:** nenhuma.
- **Riscos:** declarar cobertura por nome de teste sem verificar asserções.
- **Aceitação:** cada ferramenta tem registro, handler, modo, escopo, lock quando aplicável, limites e teste referenciado.
- **Testes obrigatórios:** catálogo, schema, autorização, resposta e um teste por família de handler.
- **Regressão:** `npm test`, `npm run typecheck`.
- **Rollback:** remover gerador/matriz sem alterar runtime.
