# Fluxos de dados

## Edição pelo Studio

1. Evento de UI atualiza estado transitório/seleção.
2. `apps/studio/src/lib/api.ts` envia chamada para `/api/studio/call`.
3. `apps/server/src/studio/studio-calls.ts` identifica usuário, verifica permissão e adquire locks.
4. `packages/core/src/tools/runner.ts` valida schema e executa handler.
5. Store/comandos mutam o documento, registram undo e devolvem resultado.
6. Workspace persiste e eventos atualizam outras sessões.

## Edição pelo MCP

1. Gateway cria/valida sessão MCP e agente.
2. `agent-calls.ts` aplica escopo e lock.
3. O mesmo runner executa a ferramenta.
4. `gateway.ts` adapta texto, imagem ou erro ao resultado MCP.

## Ciclo de vida

```text
criar/importar → abrir workspace → ler/editar → persistir/revisionar → exportar/publicar → backup/restore
```

Dados de projeto e metadados ficam no banco; blobs são tratados por adapters de blob e não devem ser embutidos indiscriminadamente em respostas de inspeção.
