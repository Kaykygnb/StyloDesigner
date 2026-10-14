# DOC-CORE-003 — Preservar dados desconhecidos e migrar o schema do documento

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:40 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

A diretriz do proprietário (§7, §13) exige preservar semântica que o editor ainda não manipula e preservar documentos existentes. Hoje CSS/HTML fora da lista conhecida é barrado ou descartado (ex.: CSS nesting dentro da camada) e não há prova de round-trip. Origem: diretriz humana de 2026-10-14 (ver [EVOLUCAO.md](../../../architecture/EVOLUCAO.md)). Evidência de código lida em 14/10; não executada nesta criação.

## Objetivo

Definir e provar: (a) campo de extras por camada/página que nunca é apagado pelo editor; (b) `migrate(doc, de→para)` com fixtures de documentos antigos, pré-requisito para qualquer campo novo (variantes, keyframes, cena 3D).

## Escopo

- Incluído: investigação, planejamento, provas descartáveis e documentação conforme o objetivo.
- Fora do escopo: reescrita do editor, mudança de `LICENSE`, `allow-scripts` no canvas, alteração de schema sem migração, adotar dependência sem checar licença da árvore completa.

## Módulo e contratos afetados

- Responsabilidade principal: core; prioridade P1 (Horizonte B da evolução).
- Arquivos potenciais: packages/core (model, validate, version, css, cssedit, html); tests/versao, tests/validacao.
- Contratos: ferramentas MCP e documentos existentes continuam compatíveis; capacidade nova nasce como ferramenta no core antes do botão.

## Dependências, riscos e bloqueios

- Dependências: ver ordem em [EVOLUCAO.md §6](../../../architecture/EVOLUCAO.md). Preservação e migração (DOC-CORE-003) precedem campos novos.
- Riscos: crescer o modelo sem migração; dependência com licença incompatível; fidelidade enganosa.
- Bloqueios atuais: nenhum para investigar; adoção depende de decisão humana quando mudar a experiência ou a licença.

## Critérios de aceitação

- [ ] Round-trip de CSS/HTML desconhecido preservado em teste; documentos da v0.1.0 abrem após cada mudança de schema; nenhum campo novo sem migração.
- [ ] `npm run typecheck`, `npm test` e o validador documental aprovados nas mudanças que existirem.
- [ ] Limitações e o que não foi verificado registrados no histórico.

## Marcos

### #1 — Investigação

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #2 — Planejamento

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #3 — Implementação

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #4 — Testes

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

### #5 — Validação final

- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas:
- Arquivos alterados:
- Evidências:
- Testes executados:
- Problemas encontrados:

## Histórico de trabalho

### 2026-10-14 08:40 UTC — [Claude Code] — criação

- Investigado: backlog existente (sem duplicata), código citado em Problema, licenças via registro npm.
- Alterado: apenas esta proposta e o BACKLOG.
- Arquivos: este documento e BACKLOG.md.
- Testes: validador documental.
- Resultado: Proposta, sem responsável, 0/5. Nada implementado.
- Próximo passo: participante assume pelo protocolo.

## Rollback

Só documentação; reverter o commit.
