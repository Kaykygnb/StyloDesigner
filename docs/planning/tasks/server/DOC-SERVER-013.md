# DOC-SERVER-013 — Aplicar a administração delegada

Responsável: [Não atribuído]
Estado: Proposta
Início: —
Última atualização: 2026-10-14 08:50 UTC
Progresso: 0/5 marcos (0%)
Participantes: —

## Problema e evidências

- Problema: a ADM-DEC-02 está aprovada e o código ainda trata OWNER e ADMIN como o mesmo gate.
- Evidências observadas: `adminOf` em `apps/server/src/http/identity.ts` aceita os dois papéis. Esse gate cobre usuários, agentes, `PUT /api/config`, `PUT /api/agent/config`, backup e restore (`apps/server/src/routes/auth.ts`, `apps/server/src/routes/system.ts`). Texto aprovado na ADR 0002, seção 4.

## Objetivo

ADMIN administra usuário comum, equipe, agente e configuração operacional no escopo delegado. Política crítica, propriedade da instalação, recuperação privilegiada e credencial mestra ficam com o OWNER. ADMIN autorizado cadastra ou substitui credencial de integração comum e a API não devolve o segredo. OWNER e ADMIN continuam mudando a configuração operacional da beta.

## Escopo

- Separar, nas rotas que hoje usam `adminOf`, o que é operacional do que é sensível.
- Operacional da beta, OWNER e ADMIN: o que a ADM-DEC-00 já protege, inclusive `keepVersions` em `PUT /api/config`.
- Sensível, só OWNER: prazo de retenção da auditoria (OWNER principal), propriedade da instalação, recuperação privilegiada e credencial mestra.
- Integração comum: escrita ou substituição por ADMIN autorizado; leitura posterior não devolve o valor.
- Teste: ADMIN entra na rota operacional e é recusado na sensível. OWNER entra nas duas. O segredo gravado não volta na resposta.

## Fora de escopo

- Escolher quem restaura backup ou rotaciona a chave mestra. Isso continua ADM-DEC-08, aberta.
- Dar a ADMIN acesso a projeto privado. Isso continua ADM-DEC-07.
- Redesenhar o reset que devolve senha. A seção 2.5 já proíbe revelar senha existente. O desenho da recuperação é a DOC-SERVER-010.
- Apagar conta, projeto ou segredo para “limpar” o gate.
- Mudar a migração de papéis de projeto (DOC-SERVER-012).

## Critérios de aceitação

- [ ] ADMIN altera a configuração operacional da beta e não altera o prazo de retenção.
- [ ] ADMIN não executa recuperação privilegiada nem lê credencial mestra.
- [ ] ADMIN autorizado grava ou substitui credencial de integração comum. A resposta e uma leitura seguinte não trazem o valor.
- [ ] ADMIN não administra conta OWNER como conta comum.
- [ ] OWNER principal continua podendo alterar o prazo. A mudança gera evento de auditoria.
- [ ] Nenhum teste antigo de autorização da ADM-DEC-00 é enfraquecido.

## Plano de execução

1. Listar cada rota de `adminOf` e marcar operacional, sensível ou integração comum, com o arquivo.
2. Recusar ADMIN na rota sensível sem mudar o que OWNER já faz.
3. Na integração comum, gravar e não devolver o segredo.
4. Testes de conta ADMIN e de conta OWNER em banco descartável.
5. Atualizar a matriz em `PERMISSIONS.md` quando o código cumprir a seção 4.

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

## Dependências e bloqueios

- Depende da ADR 0002, seção 4, e da ADM-DEC-00.
- Não bloqueia o primeiro desenho da alpha (DOC-ENG-006).
- Não editar DOC-SERVER-006 nem DOC-SERVER-007: estão com outros agentes.

## Artefatos esperados

- Rotas separadas e testes.
- Matriz de permissões alinhada ao código.

## Histórico de trabalho

### 2026-10-14 08:50 UTC — [Grok 4.7] — criação

- Investigado: seção 4 das diretrizes, agora aprovada, e o gate `adminOf`.
- Alterado: nenhum código.
- Arquivos: este documento, backlog, ADR 0002, PERMISSIONS.md.
- Testes: validador de tarefas nesta entrega.
- Resultado: Proposta. O prazo de retenção fica com o OWNER principal.
- Próximo passo: assumir e separar as rotas em banco descartável.

## Rollback

Reverter o patch das rotas. Não apagar credencial já gravada numa instalação de alguém.
