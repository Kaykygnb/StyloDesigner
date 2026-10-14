# Princípios e invariantes

1. O documento é a fonte única da verdade.
2. Studio e MCP devem alcançar a mesma capacidade através do runner do core.
3. Escritas validam argumentos antes de mutar, são atômicas quando o contrato promete isso e entram no undo quando aplicável.
4. Leituras devem ser paginadas e limitadas por bytes quando a resposta pode crescer.
5. Dados externos, HTML, CSS, SVG, URLs e imagens são entrada não confiável.
6. Autorização ocorre antes da escrita; locks protegem camadas ou o documento conforme o alvo.
7. Renderer, rede, provedores externos e banco são adapters; o core não os cria implicitamente.
8. Uma capacidade proposta não pode ser documentada como implementada sem teste ou observação reproduzível.

## Dependências proibidas

- `packages/core` → React, Hono, Prisma, filesystem ou rede.
- `apps/studio` → mutação direta do estado persistido/documento.
- Plugins → escrita fora do contrato de ferramentas.
- Documentação → afirmações baseadas apenas em nomes de arquivos ou tipos não executados.
