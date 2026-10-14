# Planejamento colaborativo

Este diretório é o sistema de tarefas do Stylo para humanos e agentes. Comece por [TASK-PROTOCOL.md](TASK-PROTOCOL.md), depois consulte [BACKLOG.md](BACKLOG.md) e abra o documento individual da tarefa. Para continuar trabalho de outra sessão, leia [HANDOFF.md](HANDOFF.md) e a seção `## Handoff atual` da tarefa (TASK-PROTOCOL.md §10).

## Fluxo rápido

1. Consulte o backlog e as tarefas relacionadas antes de criar algo.
2. Se estiver continuando trabalho existente, leia o [HANDOFF.md](HANDOFF.md) geral e o `## Handoff atual` da tarefa antes de tocar no código (TASK-PROTOCOL.md §10.5).
3. Escolha uma tarefa sem responsável ou crie uma nova usando [_TEMPLATE.md](_TEMPLATE.md).
4. Registre sua identificação entre colchetes, estado `Em andamento` e início.
5. Execute os marcos no documento da tarefa e acrescente entradas no histórico.
6. Atualize o backlog sem copiar o histórico completo.
7. Ao pausar, transferir ou entregar para revisão, atualize o `## Handoff atual` da tarefa e o [HANDOFF.md](HANDOFF.md).
8. Só use `Concluída` depois de cumprir os critérios e registrar evidências.

Validador local:

```bash
node docs/planning/validate-tasks.mjs
```

O validador verifica IDs únicos, estados, responsáveis, marcos numerados, histórico, links do backlog, evidência mínima para tarefas concluídas e a estrutura do handoff nas tarefas em andamento, bloqueadas, em revisão ou em validação.
