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

### Continuidade por etapa

Uma tarefa pode passar do agente implementador para outro agente revisor: entregar o handoff indicando marco, evidências, pendências e destinatário; o próximo registra o aceite e a transferência no histórico antes de continuar. Preserve quem executou cada marco e seus commits. Revise os gates e critérios antes de concluir; abrir uma revisão técnica não exige repetir a implementação nem criar tarefa duplicada. Revisão humana é necessária quando a tarefa explicita uma decisão humana, não por todo handoff entre agentes. Atualize o backlog e o handoff geral para mostrar quem continua e o que falta.

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

## 10. Handoff de contexto

Handoff é a transferência de contexto entre sessões e participantes. Ele garante continuidade: quem chega deve saber onde o trabalho parou, por que parou, o que já foi decidido, o que falta e como continuar com segurança. Não é execução simultânea nem orquestração.

**Handoff não substitui o histórico.** O histórico registra o que aconteceu, em ordem, sem apagar entradas; o handoff informa o que o próximo participante precisa saber e fazer, agora. Não duplique o histórico no handoff — referencie-o.

### 10.1 Onde fica

- **Por tarefa:** a seção `## Handoff atual` no documento individual da tarefa. É a fonte de verdade da continuidade daquela tarefa.
- **Por sessão:** [HANDOFF.md](HANDOFF.md), no mesmo diretório deste protocolo, resume o estado geral do projeto entre sessões. É curto e aponta para as tarefas; não copia o conteúdo delas.

### 10.2 Quando produzir ou atualizar

Produza ou atualize o handoff quando:

1. encerrar uma sessão com trabalho pendente;
2. transferir uma tarefa (o entregue registra a transferência e o recebido confirma a aceite no histórico);
3. encontrar um bloqueio;
4. finalizar uma investigação importante (mesmo sem implementação);
5. entregar trabalho para revisão humana;
6. alterar uma decisão que afete a continuidade.

Se não houver mudanças relevantes, não gere registros redundantes. Um handoff simples e correto é melhor que um relatório extenso e repetitivo.

### 10.3 Conteúdo mínimo do handoff por tarefa

O cabeçalho registra quem entrega, para quem, quando e com qual referência:

```text
Preparado por: [Kimi]
Destinatário: [Próximo agente] ou [Revisor humano]
Estado: Aguardando continuidade
Marco atual: #5 — Validação
Última atualização: data/hora
Commit de referência: SHA
```

O corpo cobre: estado atual, decisões tomadas (com justificativa), arquivos envolvidos, evidências e testes (comandos, resultados, limitações), pendências, próximas ações recomendadas em ordem de execução, riscos e cuidados, e condições para conclusão.

### 10.4 Preservar o que é difícil de reconstruir

O handoff deve registrar: motivos de decisões técnicas, hipóteses descartadas, investigações inconclusivas, falhas reproduzidas, comportamentos inesperados, restrições identificadas, testes relevantes e riscos de regressão. Nunca inclua credenciais, tokens, senhas ou outros segredos.

### 10.5 Como continuar uma tarefa recebida

Antes de continuar, o novo participante deve, nesta ordem:

1. ler o `## Handoff atual` da tarefa e o [HANDOFF.md](HANDOFF.md) geral;
2. conferir a tarefa e seu histórico de trabalho;
3. verificar branch, commit de referência e estado atual do código (o handoff pode estar desatualizado);
4. confirmar que as pendências descritas ainda existem;
5. registrar sua identidade entre colchetes (assunção conforme §2, ou transferência conforme §6);
6. continuar a partir do marco apropriado e atualizar o handoff ao encerrar.

Nunca assuma que um handoff antigo continua válido sem conferir o repositório. Se o contexto mudou, registre a divergência antes de prosseguir.
