# QA exploratório do Stylo

Esta área prepara sessões independentes de avaliação da experiência humana. O proprietário inicia o ChatGPT Work, fornece um ambiente e escolhe o escopo; o Work usa a interface gráfica, descobre dificuldades e entrega um relatório reproduzível. Não precisa conectar-se ao MCP do Stylo nem permanecer como agente residente.

Testes automatizados verificam cenários e invariantes programados; consulte a [estratégia existente](../testing/STRATEGY.md) e a [matriz de regressão](../testing/REGRESSION-MATRIX.md). Exploração humana avalia compreensão, descoberta, interação e recuperação em situações reais. Um teste automatizado aprovado não demonstra que toda a experiência é boa; um relatório exploratório também não substitui os gates de engenharia.

## Começar uma sessão

1. O proprietário abre uma sessão no ChatGPT Work.
2. Fornece URL alcançável, modo de autenticação, conta/perfil de teste, dados descartáveis, permissões e limites. Informa branch/commit implantados quando souber; a branch do repositório não prova a versão servida.
3. Solicita a leitura de **[WORK-GUIDE.md](WORK-GUIDE.md)**. Se o Work não puder ler o GitHub, fornece o arquivo ou seu conteúdo diretamente.
4. Escolhe uma ou mais [jornadas](TEST-JOURNEYS.md), tempo disponível e navegadores/viewports possíveis.
5. O Work confirma que consegue acessar o ambiente e interage pela GUI; pode explorar além dos roteiros dentro do escopo autorizado.
6. O Work produz um relatório pelo [modelo](REPORT-TEMPLATE.md), incluindo bloqueios e o que não executou.
7. O proprietário revisa o relatório e decide seu encaminhamento e armazenamento em [reports/](reports/README.md).
8. Problemas confirmados e selecionados são ligados a tarefas de engenharia.
9. Codex, Kimi ou outro participante assume e implementa correções conforme o protocolo.
10. O proprietário pode iniciar outra sessão para retestar a versão corrigida.

Nenhum passo presume acesso automático a localhost, rede privada, GitHub ou capacidade de anexar arquivos. Work não precisa executar a cadeia inteira: entrega do relatório em texto ao humano é uma saída válida. Esta preparação não contém sessões executadas nem resultados de QA.

## Triagem para engenharia

O [protocolo de tarefas](../planning/TASK-PROTOCOL.md) continua obrigatório; consulte o [backlog](../planning/BACKLOG.md) e as tarefas relacionadas antes de criar algo. A [DOC-QA-001](../planning/tasks/qa/DOC-QA-001.md) prepara o processo. A [DOC-STUDIO-003](../planning/tasks/studio/DOC-STUDIO-003.md) trata a revisão visual/usabilidade e poderá usar relatórios futuros como evidência; esta área não transfere sua responsabilidade, não altera seus critérios e não demonstra sua conclusão.

Para cada observação, o proprietário e a engenharia:

1. Conferem ambiente, autorização, passos e evidência; distinguem defeito reproduzido, problema de usabilidade, sugestão e não verificado.
2. Procuram duplicação por tela, comportamento, contrato e reprodução, inclusive em tarefas concluídas. Se já houver tarefa adequada, acrescentam referência/evidência com respeito ao responsável e histórico; não criam uma cópia.
3. Registram a decisão: confirmar, pedir reprodução, vincular ao existente, adiar ou não encaminhar, com motivo. Gravidade observada e prioridade do backlog são decisões distintas.
4. Criam uma tarefa somente quando o problema selecionado tem escopo e critérios verificáveis. Usam `_TEMPLATE.md`, ID único e fonte `relatório + observação/problema + jornada`; assumem pelo protocolo antes de implementar.
5. Ligam commit/PR da correção e regressões necessárias; retestam posteriormente e registram resultado/limitações. Uma sugestão visual não vira tarefa obrigatória automaticamente.

## Identificadores e rastreabilidade

| Registro | Convenção | Uso |
|---|---|---|
| Jornada | `QA-JRN-001` | ID estável do catálogo; não renumerar por reordenação |
| Sessão/relatório | `QA-RPT-AAAAMMDD-NNN` | Mesmo ID para a sessão e seu relatório; humano escolhe próximo número livre em reports/ e nos relatos ainda não publicados |
| Observação | `<ID-relatório>-OBS-NNN` | Qualquer observação, inclusive sugestão ou bloqueio |
| Problema confirmado | `<ID-relatório>-ISS-NNN` | Atribuir na triagem a defeito/usabilidade confirmado e selecionado; ligar à OBS original; se duplicado, reutilizar ISS existente |
| Tarefa | `DOC-<MÓDULO>-NNN` | Convenção do protocolo, não um novo sistema de tarefas |
| Reteste | `<ID-novo-relatório>-RET-NNN` | Nova sessão, versão e evidência; aponta ao ISS e commit testados |

A cadeia deve ser preenchida progressivamente: `JRN → OBS → ISS → DOC → commit/PR → RET`. Campos desconhecidos ficam explicitamente como `não conhecido`, `pendente` ou `não aplicável`; não gerar um ISS para toda sugestão. Uma mesma observação pode envolver várias jornadas; manter um ID e indicar todas. Não apagar o relato original para apresentar um reteste como primeira execução.

Os IDs e links permitem uma futura plataforma de engenharia via MCP consumir os registros. Hoje são Markdown: não há integração, sincronização, ingestão automática ou execução MCP implementada aqui.
