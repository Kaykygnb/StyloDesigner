# Contratos de engenharia

## Ferramentas

O catálogo em `packages/core/src/tools/schema.ts` é a fonte do nome, descrição e schema. `validateToolArgs` deve rejeitar campos desconhecidos e entradas inválidas antes do handler. O resultado pode ser texto, erro ou imagem.

## Escritas

Handlers de escrita devem declarar `write`, respeitar escopo, adquirir lock apropriado, validar novamente quando necessário e não deixar mutação parcial. Lotes de camadas têm limite de 100 segundo o contrato atual.

## Respostas

Leituras de camadas, busca, auditoria, inspeção e exportação precisam respeitar orçamento de resposta/paginação quando o contrato indicar. Um cursor não pode travar nem esconder silenciosamente o item que não cabe.

## Segurança

HTML/CSS/SVG/URLs externos, conteúdo de projeto, assets e credenciais são não confiáveis. Sanitização, limites, host checks e escopos devem permanecer antes do efeito externo.
