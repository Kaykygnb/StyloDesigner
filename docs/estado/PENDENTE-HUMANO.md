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
- [ ] S10: escolher o acento e o logo entre 3 opções.
- [ ] Firefox/Safari: smoke test se a decisão 1 incluir.
- [ ] Chaves reais de imagem/Pexels, se quiser testar #5.

## Tarefas para as suas outras IAs (me avise quais quer)
- **IA A (pesquisa):** checar disponibilidade e conflito da marca "Stylo" (INPI/EUIPO/USPTO, GitHub, npm) e listar licenças de Google Fonts usadas pelo app. Entregar tabela.
- **IA B (design, só direção):** 3 diretrizes de marca para uma ferramenta de design sóbria e densa, com paleta (hex), tipografia e descrição do logo; sem imagens genéricas. Eu renderizo e meço contraste.
- **IA C (revisão cruzada):** revisar o diff das etapas S3 e S4 sem ver meu relatório, para segunda opinião.

## Codex como subagente (`codex app-server`)
- [x] (respondido: tem Codex e autorizou o uso) Você tem Codex logado e quer gastar a cota do plano ChatGPT nisso? Padrão: **só depois da Fase 1**, com prova de conceito pequena (esquema → sessão → tarefa trivial numa worktree → medir tokens contra `codex exec`). `codex-cli 0.162.1` instalado; o `app-server` é experimental.

## Plugin oficial do Codex para o Claude Code (`openai/codex-plugin-cc`)
- [x] INSTALADO por mim em 10/10/2026 via `claude plugin install` (você autorizou). `~/.codex/config.toml` ajustado por mim (`elevated` → `unelevated`, backup `.bak-antes-do-plugin`): o plugin já executa comandos. **Falta**: (1) `/reload-plugins` no Claude Code; (2) decidir sobre rodar testes dentro do Codex: exige sem-sandbox (`danger-full-access`), que o Claude Code me bloqueou de ativar; veja `docs/estado/CODEX.md`. Sem isso, o Codex edita/revisa e eu rodo os testes. Os comandos de instalação eram: `/plugin marketplace add openai/codex-plugin-cc`, `/plugin install codex@openai-codex`, `/reload-plugins`, depois `/codex:setup`. Dá `/codex:review`, `/codex:adversarial-review`, `/codex:rescue` (tarefas em segundo plano com `/codex:status`, `/codex:result`, `/codex:cancel`) e o subagente `codex:codex-rescue`. Apache-2.0, ~34 mil estrelas, usa a mesma cota do Codex. Padrão: **instalar**; meu `scripts/codex-worker.mjs` continua para escolher modelo/sandbox e medir tokens.
