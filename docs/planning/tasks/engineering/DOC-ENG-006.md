# DOC-ENG-006 — Preparar a alpha pública local

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:45 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: o proprietário quer uma alpha pública em breve, pequena, para atrair quem instala e usa. O produto já edita, exporta e fala com agentes. Publicar antes dos bloqueios abaixo expõe canal sem identidade ou um README que ensina o modo sem conta.
- Evidências observadas: `README.md` ainda indica `STYLO_AUTH=local` como caminho sem autenticação. `GET /api/agent/events`, `/api/health`, `/api/presence` e `/api/agent/config` não pedem identidade (`events.ts`, `system.ts`). PRs #17 e #18 abertas em 2026-10-14. Escopo em [EVOLUTION.md](../../../product/EVOLUTION.md) e [ROADMAP.md](../../ROADMAP.md).

## Objetivo

Uma pessoa com Node 22 segue o README, sobe o servidor na primeira tentativa, cria a conta, desenha e exporta, e lê as limitações. Nada disso está feito por esta proposta.

## Escopo

- Incluído: checklist da alpha local descrita na roadmap. Demo curto no README. Limitações conhecidas no README. Conferir que o padrão escuta só na máquina local e que o que ficar acessível sem login é o mínimo da ADM-DEC-09.
- Fora do escopo: hospedar para a internet (DOC-SERVER-008). Remake visual. 3D, PDF, PPTX, React Native. Implementar transferência, códigos offline ou acesso de OWNER a projeto privado. Reescrever o editor vetorial.

## Módulo e contratos afetados

- Módulo/responsabilidade principal: engenharia / documentação de uso e superfície HTTP exposta.
- Módulos relacionados: servidor, Studio, README.
- Contratos/interfaces: ADM-DEC-09 (canal com identidade; público mínimo). Não ampliar o que a PR #18 já recorta.
- Testes relacionados: subida local, login da primeira conta, uma exportação. Validador se a tarefa mudar de estado.

## Dependências, riscos e bloqueios

- Dependências: merge da PR #17 e da PR #18 na `v0.1.0-beta` antes de começar a implementação. DOC-SERVER-007 é quem investiga o canal; coordenar para não duplicar.
- Riscos: anunciar alpha em rede aberta com SSE anônimo; documentar `STYLO_AUTH=local` como o caminho feliz.
- Bloqueios: não assumir enquanto #17 e #18 não estiverem na beta.

## Critérios de aceitação

- [ ] PRs #17 e #18 mergeadas na beta usada pela alpha.
- [ ] `npm install` e `npm start` com Node 22 abrem o Studio e a primeira conta vira OWNER. O README não ensina modo sem conta como caminho da alpha.
- [ ] Se o processo for alcançado de outra máquina, o canal de eventos exige identidade e a resposta pública não traz auditoria, diagnóstico detalhado nem aviso ao vivo. Instalação só local precisa desse limite escrito e verificado.
- [ ] README com demo: criar conta, frame, texto ou vetor, exportar HTML. Limitações conhecidas no mesmo texto (protótipo não roda no site exportado; SVG omite o que `svgimport.js` e `svg.js` já declaram; sem PDF, PPTX e 3D).
- [ ] Fora da alpha permanece listado na roadmap, sem implementação “de brinde”.

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

### 2026-10-14 08:45 UTC — [Grok 4.7] — criação

- Investigado: capacidades em `31f16bf`, superfície sem login, PRs #17 e #18.
- Alterado: nenhum código. Tarefa criada como Proposta.
- Arquivos: este documento.
- Testes: ainda não executados para esta tarefa.
- Resultado: escopo pequeno registrado. Não é autorização para publicar.
- Próximo passo: esperar o merge de #17 e #18 e só então assumir.

## Rollback

Apagar esta proposta se a alpha for cancelada. Não há runtime.
