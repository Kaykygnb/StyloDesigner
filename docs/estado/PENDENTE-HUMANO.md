# Pendências para a pessoa (não bloqueiam o trabalho)

Responda quando puder. Sem resposta, sigo com o padrão indicado. Marque com `[x]` e escreva a decisão ao lado.

## Decisões de produto (padrão em negrito)
1. [ ] Navegadores suportados na v1 estável: **só Chromium (Chrome/Edge)** / + Firefox / + Safari.
2. [ ] Licença: **manter MIT** / Apache-2.0. Marca "Stylo": já pesquisou conflito de nome?
3. [ ] Entram na v1 estável: **só correções + identidade + exemplo** / + JS no export / + React/Vite / + extensões.
4. [ ] Biblioteca global na pasta do usuário (`.stylo/library.json`): **sim, depois da v1 estável** / antes.
5. [ ] Fundir os menus duplicados (atalhos, ajuda, chaves) nesta versão: **sim** / depois.
6. [ ] ROADMAP (14 KB, com log de auditoria no topo): **mover o log para o CHANGELOG** / deixar. Benchmarks (`docs/benchmarks`) e as 9 capturas do README: **manter até refazer as capturas após o redesign**.

## Testes que só você consegue
- [ ] S3/S4: testar MCP com seu Claude Code e Codex depois da correção de origem/token.
- [ ] S12: abrir o site exportado num celular real.
- [ ] S10: escolher o acento e o logo entre 3 opções.
- [ ] Firefox/Safari: smoke test se a decisão 1 incluir.
- [ ] Chaves reais de imagem/Pexels, se quiser testar #5.

## Tarefas para as suas outras IAs (me avise quais quer)
- **IA A (pesquisa):** checar disponibilidade e conflito da marca "Stylo" (INPI/EUIPO/USPTO, GitHub, npm) e listar licenças de Google Fonts usadas pelo app. Entregar tabela.
- **IA B (design, só direção):** 3 diretrizes de marca para uma ferramenta de design sóbria e densa, com paleta (hex), tipografia e descrição do logo; sem imagens genéricas. Eu renderizo e meço contraste.
- **IA C (revisão cruzada):** revisar o diff das etapas S3 e S4 sem ver meu relatório, para segunda opinião.
