# Documentação de engenharia

## Escopo e evidência

Esta documentação foi reconstruída a partir do código, contratos, configurações e testes existentes. A fotografia de referência é:

- branch: `main`
- commit: `e8bece1cf51c05bfb64da095fc6471a6b411d666`
- versão do pacote raiz: `0.1.0`
- data da reconstrução: 2026-10-13
- snapshot dos documentos anteriores: `work/documentation-snapshot-20261013-0515.zip`

Os documentos anteriores foram removidos da documentação ativa. O snapshot é recuperável localmente e não depende de GitHub.

## Status usado nesta documentação

- **Verificado**: há implementação e uma verificação executada nesta revisão ou em teste automatizado identificado.
- **Implementado não verificado**: há código, mas não existe evidência suficiente de execução nesta revisão.
- **Parcial**: há apenas parte do comportamento ou uma dependência externa não validada.
- **Incerto**: o código não permite concluir o comportamento com segurança.
- **Proposto**: decisão ou trabalho futuro; não é capacidade atual.

## Mapa

- [product/CURRENT-STATE.md](product/CURRENT-STATE.md): estado factual.
- [product/CAPABILITIES.md](product/CAPABILITIES.md): capacidades por status.
- [architecture/OVERVIEW.md](architecture/OVERVIEW.md): arquitetura implementada.
- [architecture/PRINCIPLES.md](architecture/PRINCIPLES.md): invariantes e dependências.
- [architecture/PATTERNS.md](architecture/PATTERNS.md): padrões observados e recomendados.
- [architecture/DATA-FLOW.md](architecture/DATA-FLOW.md): fluxos de documento, ferramenta e persistência.
- [architecture/DEPENDENCIES.md](architecture/DEPENDENCIES.md): dependências e adapters.
- [architecture/instance-administration/README.md](architecture/instance-administration/README.md): auditoria, arquitetura administrativa proposta, matriz e roadmap self-hosted.
- [architecture/adr/0002-self-hosted-administration.md](architecture/adr/0002-self-hosted-administration.md): alternativas organização única/múltipla e decisões humanas pendentes.
- [architecture/adr/0001-modular-monolith.md](architecture/adr/0001-modular-monolith.md): decisão atual de implantação.
- [modules/](modules/): responsabilidades dos módulos.
- [engineering/CONTRACTS.md](engineering/CONTRACTS.md): interfaces que não podem ser alteradas casualmente.
- [testing/](testing/): estratégia, inventário, efetividade e regressões.
- [testing/TOOL-INVENTORY.md](testing/TOOL-INVENTORY.md): catálogo/handlers/políticas gerados; referências de teste são candidatas, não cobertura comprovada.
- [qa/README.md](qa/README.md): processo exploratório orientado pelo proprietário; [guia para ChatGPT Work](qa/WORK-GUIDE.md), jornadas e modelo de relato (sem execução de QA nesta preparação).
- [planning/](planning/): backlog e tarefas executáveis.
- [planning/TASK-PROTOCOL.md](planning/TASK-PROTOCOL.md): protocolo obrigatório para descobrir, assumir e concluir tarefas.

## Regra de manutenção

Uma mudança que altere responsabilidade, contrato, fluxo de dados, autenticação, autorização, persistência, ferramenta, plugin ou estado de verificação deve atualizar esta documentação na mesma mudança. Uma decisão difícil de reverter, surpreendente ou baseada em trade-off deve ganhar ADR. Toda nova capacidade deve incluir teste de contrato ou registrar explicitamente por que ainda não pode ser testada.
