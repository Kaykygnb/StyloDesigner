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
- [ ] S3 (feita, commit `500659d`): conferir que seu Claude Code e Codex continuam conectando ao MCP (a mudança só recusa `Origin` de outra porta; clientes sem Origin seguem aceitos). Revisar o diff: `git show 500659d -- server.js`.
- [ ] S4 (feita, commits `636739d` e `ec4a4ec`): revisar o diff de persistência (`git show ec4a4ec --stat`) e testar à mão: editar, fechar a aba, reabrir; trocar de projeto com o servidor desligado (deve avisar e NÃO descartar).
- [ ] S12: abrir o site exportado num celular real.
- [ ] **S10: escolher a paleta (A Âmbar, B Mar, C Lima) e o símbolo (A camadas, B colchete e linhas, C S de blocos).** Capturas do editor real nos dois temas em `docs/screenshots/identidade/marca-*.png`, prancha dos símbolos em `marca-simbolos.png`, contraste medido (tudo passa AA) e a minha recomendação (**A + B**) em `docs/estado/MARCA.md`. Responda, por exemplo, "A + B"; sem resposta eu não aplico a marca.
- [ ] Firefox/Safari: smoke test se a decisão 1 incluir.
- [ ] Chaves reais de imagem/Pexels, se quiser testar #5.

## Tarefas para as suas outras IAs (me avise quais quer)
- **IA A (pesquisa):** checar disponibilidade e conflito da marca "Stylo" (INPI/EUIPO/USPTO, GitHub, npm) e listar licenças de Google Fonts usadas pelo app. Entregar tabela.
- **IA B (design, só direção):** 3 diretrizes de marca para uma ferramenta de design sóbria e densa, com paleta (hex), tipografia e descrição do logo; sem imagens genéricas. Eu renderizo e meço contraste.
- **IA C (revisão cruzada):** revisar o diff das etapas S3 e S4 sem ver meu relatório, para segunda opinião.

## Codex como subagente (`codex app-server`)
- [x] (respondido: tem Codex e autorizou o uso) Você tem Codex logado e quer gastar a cota do plano ChatGPT nisso? Padrão: **só depois da Fase 1**, com prova de conceito pequena (esquema → sessão → tarefa trivial numa worktree → medir tokens contra `codex exec`). `codex-cli 0.162.1` instalado; o `app-server` é experimental.

## Plugin oficial do Codex para o Claude Code (`openai/codex-plugin-cc`)
- [x] RESOLVIDO em 10/10/2026: plugin instalado, `/reload-plugins` feito pela pessoa, sandbox do Windows corrigida e tarefas `--write` sem sandbox (autorizado). Detalhes e como reverter em `docs/estado/CODEX.md`. Padrão: `codex:codex-rescue` para tarefas mecânicas (modelo/esforço pela tabela), sempre em worktree.

## CSS da página com endereço externo (decisão de segurança vs. recurso)
- [ ] Hoje o CSS da página aceita `url(https://...)`, `@font-face` e `image-set` de fora (útil para fontes e imagens de CDN) e, ao abrir um projeto, o Stylo **avisa** os hosts. Um projeto hostil ainda faria o navegador buscar o endereço (rastreamento) antes de você ver o aviso. Opções: **manter assim com o aviso (padrão)** / bloquear fora do Google Fonts no canvas (a exportação continuaria igual) / bloquear tudo. O CSS por camada já só aceita `data:image` e `#id`.

## Autorizações e decisões pequenas
- [ ] **Baixar Firefox e WebKit do Playwright** (`npx playwright install firefox webkit`, do CDN oficial da Playwright, ~200 MB) para o smoke test entre navegadores? Padrão: sim, só em ferramenta de desenvolvimento. Sem isso só testamos em Chromium.
- [ ] **Versão do pacote**: `package.json` está em `1.0.0`. Sugestão para esta entrega: `1.1.0` (há mudança de comportamento: CSS livre só com `data:image`/`#id`, tela cheia do editor de código em `Ctrl+Shift+M`). Padrão: não alterar até você decidir.
- [ ] **Publicar**: tudo está só em commits locais na branch `feat/versao-estavel`. Quando quiser, `git push -u origin feat/versao-estavel` e abrir o PR (eu escrevo a descrição com a skill `descrever-pr`). Não faço push sozinho.
- [ ] `#11` (foto como `<img>`) fica para a v1.1; a acessibilidade (`role="img"` + `aria-label`) já funciona.

