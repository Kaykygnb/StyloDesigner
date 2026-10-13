# DOC-MCP-001 — Matriz de compatibilidade MCP

Responsável: [Kimi]
Estado: Em andamento
Início: 2026-10-13 23:45 UTC
Última atualização: 2026-10-13 23:45 UTC
Progresso: 0/5 marcos (0%)
Participantes: [Kimi]

- **Módulo:** mcp
- **Prioridade:** P0
- **Estado:** Proposto
- **Problema/evidência:** o cliente oficial do SDK tem testes; clientes MCP externos não foram validados individualmente.
- **Objetivo:** registrar o subconjunto de protocolo e diferenças observadas por cliente.
- **Escopo:** initialize, tools/list, tools/call, sessão, bearer, texto/imagem/erro.
- **Fora do escopo:** implementar clientes externos no Stylo.
- **Dependências:** DOC-CORE-001.
- **Riscos:** clientes mudam formatos e capacidades.
- **Aceitação:** cada cliente testado tem versão, configuração, fluxo e resultado anexados; lacunas permanecem explicitamente não verificadas.
- **Testes obrigatórios:** contrato MCP oficial e testes manuais reproduzíveis.
- **Regressão:** `mcp-sdk`, `mcp-stdio`, auth e segurança.
- **Rollback:** remover apenas fixtures de compatibilidade.

## Marcos

### #1 — Investigação
- Estado: em andamento
- Responsável: [Kimi]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #2 — Planejamento
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #3 — Implementação
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #4 — Testes
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —
### #5 — Validação final
- Estado: pendente
- Responsável: [Não atribuído]
- Atividades executadas: —
- Arquivos alterados: —
- Evidências: —
- Testes executados: —
- Problemas encontrados: —

## Histórico de trabalho

### 2026-10-13 23:45 UTC — [Kimi] — #1 Investigação (assunção)

- Investigado: protocolo, BACKLOG, HANDOFF geral (Codex concluiu DOC-SERVER-004, DOC-CORE-001 e DOC-QA-001; DOC-STUDIO-003 segue com [Codex]) e duplicação com DOC-CORE-001 (concluída — inventário de ferramentas; esta tarefa valida clientes, não ferramentas).
- Alterado: responsável registrado como [Kimi], estado `Em andamento`, marco #1 em andamento.
- Arquivos: esta tarefa e BACKLOG.md.
- Testes: nenhum nesta entrada.
- Resultado: tarefa assumida conforme protocolo §2, após `git pull` sincronizar 7 commits novos da branch (80818cd).
- Próximo passo: ler `mcp/gateway.ts` e os testes `mcp-sdk`/`mcp-stdio`/`mcp-contas` para mapear o contrato de transporte antes de planejar a matriz.

### 2026-10-13 00:00 -03:00 — [Sistema] — adaptação ao protocolo
- Investigado: tarefa existente e formato anterior.
- Alterado: metadados, marcos e histórico foram adicionados; conteúdo técnico preservado.
- Arquivos: este documento.
- Testes: validador documental pendente.
- Resultado: tarefa continua Proposta e não atribuída.
- Próximo passo: consultar duplicações e assumir explicitamente.
