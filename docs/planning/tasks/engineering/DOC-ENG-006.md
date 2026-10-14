# DOC-ENG-006 — Preparar a alpha pública local

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 10:10 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: o proprietário quer uma alpha pública em breve, pequena, para atrair quem instala e usa. O produto já edita, exporta e fala com agentes. Publicar antes dos bloqueios abaixo expõe canal sem identidade ou um README que ensina o modo sem conta.
- Evidências observadas em 2026-10-14 08:45 UTC: README ensinava `STYLO_AUTH=local`; eventos, health e presença respondiam sem identidade; PRs #17 e #18 estavam abertas. Atualização na DOC-SERVER-011: o README não ensina mais o modo sem conta; eventos, health e presença pedem sessão. `GET /api/agent/config` ainda responde sem sessão (endereço do MCP, se há chave do Pexels, política). O demo da alpha e as limitações conhecidas ainda não estão no README.

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

- Dependências: DOC-SERVER-011 em validação (login por usuário). O demo e as limitações do README são o trabalho desta tarefa. DOC-SERVER-007 já exige sessão em eventos, health e presença.
- Riscos: tratar `GET /api/agent/config` sem sessão como superfície pública além do mínimo da ADM-DEC-09; publicar a alpha antes do README.
- Bloqueios: não marcar esta tarefa concluída enquanto o README não tiver o demo e as limitações, e enquanto a DOC-SERVER-011 não estiver aceita.

## Critérios de aceitação

- [ ] PRs #17 e #18 mergeadas na beta usada pela alpha. DOC-SERVER-011 concluída: login por usuário ou e-mail, e-mail opcional, contas antigas com usuário gerado.
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

### 2026-10-14 10:10 UTC — [Grok 4.7] — bloqueio do login atendido em outra tarefa

- Investigado: a DOC-SERVER-011 implementou o login por usuário e retirou `STYLO_AUTH=local`. Eventos, health e presença já pedem sessão. `GET /api/agent/config` continua sem sessão.
- Alterado: evidências e dependências. Nenhum roteiro de alpha.
- Arquivos: este documento.
- Testes: não executados para esta tarefa.
- Resultado: continua Proposta. O demo e as limitações conhecidas ainda faltam.
- Próximo passo: assumir só depois da aceitação da DOC-SERVER-011 e escrever o README da alpha.

### 2026-10-14 08:40 UTC — [Grok 4.7] — bloqueio da alpha

- Investigado: o fluxo de conta obrigatória depende do login por nome de usuário.
- Alterado: dependência e critério. DOC-SERVER-011 bloqueia esta tarefa.
- Arquivos: este documento.
- Testes: não executados aqui.
- Resultado: continua Proposta.
- Próximo passo: não assumir antes de #17, #18 e DOC-SERVER-011.

### 2026-10-14 08:45 UTC — [Grok 4.7] — criação

- Investigado: capacidades em `31f16bf`, superfície sem login, PRs #17 e #18.
- Alterado: nenhum código. Tarefa criada como Proposta.
- Arquivos: este documento.
- Testes: ainda não executados para esta tarefa.
- Resultado: escopo pequeno registrado. Não é autorização para publicar.
- Próximo passo: esperar o merge de #17 e #18 e só então assumir.

## Rollback

Apagar esta proposta se a alpha for cancelada. Não há runtime.
