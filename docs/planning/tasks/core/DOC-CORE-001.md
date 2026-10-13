# DOC-CORE-001 — Inventário verificável de ferramentas

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-13 00:00 -03:00
Progresso: 0/5 marcos (0%)
Participantes: —

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

## Marcos

### #1 — Investigação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #2 — Planejamento
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #3 — Implementação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #4 — Testes
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

### #5 — Validação final
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

## Histórico de trabalho

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.
