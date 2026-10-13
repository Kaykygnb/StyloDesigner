# Protocolo colaborativo de tarefas

Este é o protocolo obrigatório para tarefas de engenharia registradas em Markdown. Ele é aplicável a humanos e agentes.

## 1. Descobrir antes de criar

Antes de criar uma tarefa:

1. leia este protocolo;
2. consulte `BACKLOG.md`;
3. procure o ID, título, módulo, contrato e teste relacionado nas tarefas existentes;
4. confirme que o problema não é duplicado;
5. identifique o módulo ou responsabilidade principal.

Crie a tarefa com `_TEMPLATE.md`, um ID único e estado `Proposta`, salvo autorização explícita para iniciar. A tarefa precisa registrar problema, evidências, objetivo, escopo, riscos, dependências, módulos, contratos, testes e critérios de aceitação. Decisões arquiteturais aprovadas não podem ser alteradas silenciosamente; proponha uma ADR ou peça autorização.

## 2. Assumir

Uma tarefa só é assumida quando o participante registra:

```text
Responsável: [Codex]
Estado: Em andamento
Início: 2026-10-13 17:00 -03:00
```

Se já houver responsável, não substitua a identificação. Registre uma transferência no histórico, com responsável anterior, novo responsável, data, motivo e estado da tarefa. Os colchetes identificam a pessoa ou agente, mas não são um lock técnico.

Verifique a atividade do responsável por mecanismos existentes do projeto quando a tarefa tocar código ou dados compartilhados. Com vários participantes, coordene por thread, presença, lock ou outro mecanismo disponível antes de alterar o mesmo documento.

## 3. Marcos

Use marcos numerados, normalmente:

```text
#1 — Investigação
#2 — Planejamento
#3 — Implementação
#4 — Testes
#5 — Validação final
```

Cada marco deve conter estado (`pendente`, `em andamento`, `concluído` ou `bloqueado`), responsável, atividades, arquivos alterados, evidências, testes e problemas. Um marco concluído exige evidência verificável. O progresso geral é a razão entre marcos concluídos e marcos definidos; marcos bloqueados continuam no denominador.

## 4. Histórico incremental

Após a identificação do responsável, mantenha `Histórico de trabalho`. Nunca apague entradas anteriores. Cada entrada registra data e hora, autor, marco, investigação, mudanças, arquivos, testes, resultado e próximo passo.

Formato mínimo:

```markdown
### 2026-10-13 17:00 -03:00 — [Codex] — #1 Investigação

- Investigado: ...
- Alterado: ...
- Arquivos: `...`
- Testes: `...`
- Resultado: ...
- Próximo passo: ...
```

## 5. Estados válidos

Use exatamente um destes estados:

`Proposta` · `Pronta` · `Em andamento` · `Bloqueada` · `Em revisão` · `Em validação` · `Concluída` · `Cancelada`

`Concluída` exige critérios de aceitação atendidos, testes necessários executados e evidências registradas. Se algo estiver faltando, use `Em validação`, `Bloqueada` ou `Em revisão`.

## 6. Concorrência e transferência

- Não sobrescreva responsável ou histórico de outro participante.
- Não edite simultaneamente a mesma tarefa sem coordenação.
- Registre bloqueios, dependências e transferências.
- Use locks, presença, atividade ou coordenação de threads quando disponíveis.
- Se não houver mecanismo técnico, declare a janela de edição no histórico.

## 7. Backlog

`BACKLOG.md` é um índice curto. Cada linha deve permitir localizar ID, título, módulo, prioridade, estado, responsável, progresso, dependências e link. O documento individual é a fonte de verdade do estado, marcos e histórico; não replique o histórico no backlog.

## 8. Revisão e conclusão

Antes de concluir:

1. releia os critérios de aceitação;
2. confirme os arquivos realmente alterados;
3. execute os testes obrigatórios e registre comandos/resultados;
4. atualize a matriz de regressão se o risco mudou;
5. registre commit, PR ou outra evidência disponível;
6. atualize o estado para `Em validação` e peça revisão quando houver revisão humana exigida;
7. use `Concluída` somente após a validação.

## 9. Governança

Se a tarefa alterar responsabilidade, contrato, persistência, autorização, ferramenta, plugin, fluxo de dados ou decisão arquitetural, atualize a documentação de engenharia e avalie uma ADR. Propostas futuras devem continuar marcadas como propostas. O validador detecta inconsistências de formato; ele não prova a verdade das evidências.
