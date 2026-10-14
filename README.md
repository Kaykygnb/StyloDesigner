# Stylo

Stylo é um editor visual de interfaces com um documento CSS/HTML exportável, um Studio React e um servidor local que expõe HTTP e MCP.

Esta documentação é a fonte de verdade de engenharia. Ela descreve o código observado no commit documentado em [docs/README.md](docs/README.md). Propostas futuras estão marcadas como propostas e não devem ser tratadas como funcionalidades existentes.

## Executar

Requer Node.js 22+.

```bash
npm install
npm start
```

Abra `http://localhost:5173/studio/`. A primeira visita pede uma conta: nome de usuário e senha. O e-mail é opcional. Não há modo sem conta.

## Verificar

```bash
npm run typecheck
npm test
npm run build
```

Consulte [docs/engineering/QUALITY-GATES.md](docs/engineering/QUALITY-GATES.md) antes de alterar o software.

Para trabalho colaborativo, consulte [docs/planning/TASK-PROTOCOL.md](docs/planning/TASK-PROTOCOL.md) antes de criar ou assumir uma tarefa.
