# Contratos de engenharia

## Ferramentas

O catálogo em `packages/core/src/tools/schema.ts` é a fonte do nome, descrição e schema. `validateToolArgs` deve rejeitar campos desconhecidos e entradas inválidas antes do handler. O resultado pode ser texto, erro ou imagem.

## Escritas

Handlers de escrita devem declarar `write`, respeitar escopo, adquirir lock apropriado, validar novamente quando necessário e não deixar mutação parcial. Lotes de camadas têm limite de 100 segundo o contrato atual.

## Respostas

Leituras de camadas, busca, auditoria, inspeção e exportação precisam respeitar orçamento de resposta/paginação quando o contrato indicar. Um cursor não pode travar nem esconder silenciosamente o item que não cabe.

## Segurança

HTML/CSS/SVG/URLs externos, conteúdo de projeto, assets e credenciais são não confiáveis. Sanitização, limites, host checks e escopos devem permanecer antes do efeito externo.

## Backups locais

Os IDs de snapshot seguem `YYYYMMDD-HHMMSS` em UTC. `BackupInfo.createdAt` na listagem deve refletir essa data com precisão de segundos; a lista retorna os snapshots do mais novo ao mais antigo. Restore prepara uma cópia de segurança e um marcador para aplicação no próximo boot; não substitui o banco durante a sessão ativa. PostgreSQL exige `pg_dump`/`pg_restore`, sem cópia da pasta do processo.

## Entrada humana no Studio

Contas com `mustChangePassword` acessam autenticação/troca de senha, sem carregar o workspace antes da troca. A interface não usa `role` do projeto para conceder controles de administração da instalação: esses controles dependem de `user.role` OWNER/ADMIN. O backend continua sendo responsável por negar operações sem sessão/permissão. A orientação de conexão MCP leva ao guia com token de agente. Logout só limpa a interface após confirmação do servidor, e remove o contexto de navegação da conta anterior.

O `sid` público identifica a aba e não é credencial: o workspace humano usa uma chave interna vinculada a `user.id` e `sid` em chamadas e snapshots. Reutilizar o mesmo `sid` com outra conta não devolve nem altera o workspace anterior; cada conta pode manter seu próprio projeto, inclusive com o mesmo nome de arquivo. Identificadores de sessões MCP e de presença não mudam.

## Identidade humana — diretrizes de alvo registradas

Os [21 HD da ADR0002](../architecture/adr/0002-self-hosted-administration.md) exigem conta/senha inclusive individual, contas locais offline, principal protegido, concessão OWNER exclusiva pelo principal, GUI progressiva e recuperação por e-mail opcional configurável pela interface. A DOC-SERVER-011 retirou `STYLO_AUTH=local`: conta e senha valem também no uso local. Se a única conta ainda é o usuário técnico sem senha utilizável, o primeiro setup assume esse id e preserva projetos. Papéis de projeto, códigos offline e o documento privado do OWNER continuam nas tarefas seguintes. Não conceder poderes de instância por papel de projeto ou e-mail institucional.

Projetos/capacidades de administrador, transferência/recuperação principal, offline recovery, agentes/em voo, backup/chaves e auditoria seguem contratos parcialmente abertos. ADM-DEC-01 está aprovada: uma organização por instalação na beta; multi-tenant não é requisito e não pede tabela de tenant. Não converter recomendação técnica em decisão humana nem usar proteção principal para aplicar regra indiscriminada a qualquer OWNER. Testes legados não autorizam bypass humano permanente no produto final.
