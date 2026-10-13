# QA-RPT-AAAAMMDD-NNN — título da sessão

> Modelo vazio. Substituir os campos pelos fatos da sessão. Nenhum resultado foi produzido nesta preparação. ID da sessão = ID do relatório; escolher próximo número livre com o proprietário.

## Contexto

- Testador: [nome/ChatGPT Work e supervisão humana]
- Proprietário/revisor: [nome]
- Data/hora e fuso: [início/fim]
- Branch: [v0.1.0-beta, outra ou não conhecida]
- Commit implantado: [SHA ou não conhecido; origem da informação]
- URL/ambiente: [sem segredos na URL]
- Navegador/versão: [ou não conhecido]
- Viewport/resolução/zoom: [ou não conhecidos]
- Modo de autenticação/perfil: [local/accounts; papel da conta e papel do projeto, quando conhecidos]
- Conta e dados: [aliases de teste; não credenciais]
- Autorizações e limites: [ações/alvos liberados; ações que não foram autorizadas]
- Ferramentas disponíveis/limitações de acesso: [GUI, captura, teclado, arquivos etc.]
- Escopo e tempo: [jornadas escolhidas e exploração livre autorizada]
- Intervenções: [ajuda humana/consulta técnica após primeira exploração, ou nenhuma]

## Jornadas executadas

| Jornada | Estado | Variante/perfil/viewport | Resultado observado | OBS vinculadas | Limites/passos não executados |
|---|---|---|---|---|---|
| [QA-JRN-NNN] | [Não executada/Em execução/Concluída/Parcial/Bloqueada] | [contexto] | [fatos ou não verificado] | [IDs] | [motivo] |

Não preencher jornadas futuras como aprovadas. Registrar descoberta livre como `Exploração livre`, com contexto e link a uma jornada relacionada quando houver.

## Observações

Copiar este bloco para cada observação, com IDs únicos no relatório.

### <ID-relatório>-OBS-NNN — título

- Categoria: [Defeito reproduzido / Problema de usabilidade / Sugestão / Não verificado]
- Jornada(s): [IDs ou Exploração livre]
- Tela/objetivo e pré-condições: [projeto QA, perfil, seleção, estado inicial]
- Gravidade observada: [Crítica/Alta/Média/Baixa/Não atribuída; justificar]
- Impacto: [quem fica impedido, perda/risco, frequência e alternativa disponível]
- Resultado esperado e fundamento: [objetivo do usuário, rótulo/contrato informado; hipótese como hipótese]
- Resultado observado: [comportamento literal; mensagem exata quando disponível]
- Passos mínimos de reprodução:
  1. [preparação/estado inicial]
  2. [ação visível exata]
  3. [resultado observado]
- Tentativas/reproduções: [quantas realizadas e quantas reproduziram; não estimar]
- Evidências reais: [captura/log/texto, caminho ou URL autorizada, horário, viewport; ou não disponível + motivo]
- Dados omitidos/redigidos: [quais categorias e por quê; nunca incluir o segredo]
- Dificuldade de compreensão/interação: [o que procurou/tentou, rótulos, ajuda necessária; quando aplicável]
- Sugestão separada do achado: [opcional; não apresentada como resultado existente]
- Recuperação tentada: [ação segura, resultado ou não tentada]
- Causa: [não determinada, salvo evidência suficiente; não inferir implementação]

Gravidade descreve o impacto observado: crítica para perda grave/exposição ou impedimento essencial sem alternativa; alta para jornada principal bloqueada; média para dificuldade relevante com alternativa; baixa para impacto pequeno. Não é a prioridade de implementação, nem prova de vulnerabilidade. Se não conseguiu avaliar, use Não atribuída. Sugestão não recebe gravidade de defeito automaticamente.

## Revisão e encaminhamento pelo proprietário/engenharia

O testador pode deixar esta seção pendente; não inventar aprovação ou uma tarefa.

| OBS | Decisão e motivo | ISS confirmado ou duplicado | Jornada | Tarefa existente/nova | Prioridade decidida por | Correção (commit/PR) | Reteste |
|---|---|---|---|---|---|---|---|
| [ID] | [pendente/confirmar/pedir reprodução/vincular/adiar/não encaminhar] | [<ID-relatório>-ISS-NNN, ISS anterior ou não aplicável] | [QA-JRN-NNN] | [DOC-ID/link ou pendente] | [humano/engenharia ou pendente] | [link/SHA ou pendente] | [RET-ID ou pendente] |

Preservar a OBS original. ISS pode reutilizar problema já identificado em outro relatório. Buscar duplicações no backlog antes de criar tarefa; melhorias opcionais não são tarefas obrigatórias. Convenções completas em [README.md](README.md).

## Retestes realizados nesta sessão

Preencher somente quando esta sessão realmente retestar uma correção; caso contrário, `Não executados`.

### <ID-deste-relatório>-RET-NNN

- Relatório/OBS/ISS original: [IDs e links]
- Tarefa e correção: [DOC-ID, commit/PR]
- Versão/ambiente retestados: [SHA informado ou não conhecido; não copiar automaticamente SHA do repositório]
- Jornada e passos repetidos: [IDs e passos]
- Evidências reais: [arquivos/texto]
- Resultado: [Resolvido no cenário testado / Persiste / Não verificado]
- Limites e regressões verificadas: [fatos]

## Limitações e trabalho não executado

- Jornadas/passos/perfis/navegadores não testados e motivo: [lista]
- Bloqueios de acesso, autorização, conta, conectividade ou ferramenta: [lista]
- Comportamentos incertos: [lista]
- Dados/arquivos QA que ficaram no ambiente e limpeza autorizada executada: [lista]
- Próximas verificações recomendadas: [sem declarar que já ocorreram]

## Histórico do relatório

- [Data — autor — criação com observações reais]
- [Data — revisor — decisão de triagem; preservar resultados originais]
