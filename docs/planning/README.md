# Planejamento colaborativo

Este diretório é o sistema de tarefas do Stylo para humanos e agentes. Comece por [TASK-PROTOCOL.md](TASK-PROTOCOL.md), depois consulte [BACKLOG.md](BACKLOG.md) e abra o documento individual da tarefa.

## Fluxo rápido

1. Consulte o backlog e as tarefas relacionadas antes de criar algo.
2. Escolha uma tarefa sem responsável ou crie uma nova usando [_TEMPLATE.md](_TEMPLATE.md).
3. Registre sua identificação entre colchetes, estado `Em andamento` e início.
4. Execute os marcos no documento da tarefa e acrescente entradas no histórico.
5. Atualize o backlog sem copiar o histórico completo.
6. Só use `Concluída` depois de cumprir os critérios e registrar evidências.

Validador local:

```bash
node docs/planning/validate-tasks.mjs
```

O validador verifica IDs únicos, estados, responsáveis, marcos numerados, histórico, links do backlog e evidência mínima para tarefas concluídas.
