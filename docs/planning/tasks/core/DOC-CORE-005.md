# DOC-CORE-005 — Animação, estados e interação declarativa

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:40 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

O Stylo já tem estados hover/pressed/focus e transições CSS, mas `Interaction` só tem navigate/back/url, sem `disabled`, keyframes, overlays nem troca de estado de componente (diretriz §8). JavaScript do usuário é proibido no canvas por regra firme. Origem: diretriz humana de 2026-10-14 (ver [EVOLUCAO.md](../../../architecture/EVOLUCAO.md)). Evidência de código lida em 14/10; não executada nesta criação.

## Objetivo

Investigar em duas camadas: (1) o que se faz só com CSS (disabled, @keyframes básicos, fade/slide/scale, easing/delay/repetição, prefers-reduced-motion, `<details>`/âncoras) e (2) um modelo declarativo gatilho→condição→ação executado por runtime próprio, nunca por JS arbitrário. Comparar Figma Prototyping, Framer, Penpot, ProtoPie, Rive sem presumir arquiteturas iguais. Propor ferramentas MCP correspondentes antes de qualquer botão.

## Escopo

- Incluído: investigação, planejamento, provas descartáveis e documentação conforme o objetivo.
- Fora do escopo: reescrita do editor, mudança de `LICENSE`, `allow-scripts` no canvas, alteração de schema sem migração, adotar dependência sem checar licença da árvore completa.

## Módulo e contratos afetados

- Responsabilidade principal: core; prioridade P2 (Horizonte B da evolução).
- Arquivos potenciais: packages/core css.js, types.ts (Interaction), site-export; apps/studio preview; docs/mcp.
- Contratos: ferramentas MCP e documentos existentes continuam compatíveis; capacidade nova nasce como ferramenta no core antes do botão.

## Dependências, riscos e bloqueios

- Dependências: ver ordem em [EVOLUCAO.md §6](../../../architecture/EVOLUCAO.md). Preservação e migração (DOC-CORE-003) precedem campos novos.
- Riscos: crescer o modelo sem migração; dependência com licença incompatível; fidelidade enganosa.
- Bloqueios atuais: nenhum para investigar; adoção depende de decisão humana quando mudar a experiência ou a licença.

## Critérios de aceitação

- [ ] Proposta escrita com escopo CSS-only entregável primeiro; modelo declarativo desenhado sem relaxar `allow-scripts`; paridade MCP/painel planejada.
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
