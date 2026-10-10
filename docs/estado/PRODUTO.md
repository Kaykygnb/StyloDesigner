# Análise de produto (10/10/2026) — respostas com evidência do código

Fonte: 3 pesquisadores só-leitura (sonnet), verificados por amostragem. Nada disso foi executado ao vivo; o MCP estava offline.

## Exportação, CSS, animação, 3D
- **Site de verdade:** vários HTML num ZIP, links `.html` conferidos, `@media`, viewport, modo escuro por `data-theme`/preferência. **Não há JS no export** (`<script>` e `on*` são removidos), então menu mobile, abas, scroll e botão de tema não existem. Interações de protótipo viram aviso. Imagens vão em base64 no CSS; fontes só do Google por rede; CSS repetido em cada página; sem favicon, meta description ou sitemap.
- **Animação:** transição única `all` e estados hover/foco com editor visual. `@keyframes` e `animation` só por CSS da página (funcionam no export; teste E2E confirma). Sem timeline.
- **3D:** `perspective` e `preserve-3d` por CSS livre funcionam no export. Sem campos para rotateX/Y e translateZ. WebGL, Three.js, `<canvas>` e `model-viewer` não funcionam (tags removidas).
- **CSS sem campo (só CSS livre):** container queries, grid areas/subgrid, `:has()`, clip-path arbitrário, scroll-snap, `@layer`, `clamp()`, logical properties, animation-timeline.
- **React/Vite:** export é HTML estático achatado; sem componentes, sem projeto Vite.

## Agentes e MCP
- O MCP cobre quase tudo que o assistente interno faz (mesmo schema). Só o interno tem `remember`, `delegate_task` e `jev_*`; só o MCP tem `list_editors`/`select_editor`, presença, travas e `get_image` como imagem real.
- Escopo: projeto aberto (leitura e escrita) + pasta de projetos (`list/open/save/new_project`, só com Acesso de administrador no MCP). Sem arquivo arbitrário, sem importar asset, sem configurações, sem excluir/renomear projeto.
- Provedores prontos: OpenAI, NVIDIA NIM, Ollama e "Outro" (qualquer endpoint compatível com OpenAI: serve em tese para OpenRouter, DeepSeek, Groq, LM Studio, Anthropic e Gemini via endpoints compatíveis, **não testado**).
- Tagueamento atual (`name`, `note`, `tag`, ids, componentes): razoável; falta papel semântico, dono e estado de revisão. A memória do agente fica no localStorage e o MCP não a vê.
- Revisão do trabalho do agente: só Ctrl+Z linear/global. Sem diff, sem histórico persistente por agente, sem desfazer só o dele. Permissões: sem modo só-leitura; admin mistura "agir sem perguntar" e "mexer em projetos".

## Armazenamento, conta, paletas, menus, extensões
- **JSON por projeto continua sendo a melhor base** (diff no git, agente edita, Drive/Dropbox sincroniza, falha isolada). SQLite sofre com sync de nuvem e exige dependência nativa. Melhorar: imagens em `<projeto>/assets/` em vez de base64; índice descartável só se precisar de busca.
- **Conta local** hoje só assina comentários e presença. Falta: exportar/importar tudo (.zip), levar paletas/preferências/estilos/componentes para a pasta do usuário (`<pasta>/.stylo/library.json`), biblioteca entre projetos.
- **Paletas** vivem só no localStorage (perdem-se ao limpar o navegador; MCP não vê).
- **Menus:** duplicações (atalhos em 2 lugares, ajuda em 2, "Chaves de API" separada de "Agente de IA", 3 navegações de abas escritas à mão, home e `openProjects` duplicados). Falta um componente de abas.
- **Plugins:** não existem. Forma segura: `extensions/<id>/manifest.json` só com dados (paletas, CSS escopado, componentes, ferramentas MCP declarativas), sem JS.
- **Licença:** MIT é aceitável; Apache-2.0 acrescenta patente e NOTICE. Verificar a marca "Stylo", atribuição de Google Fonts, Material Icons e Pexels, termos do Jev/Typesafe. Não é parecer jurídico.
- **Pronto para lançar?** Ainda não: faltam CI (não há `.github/workflows`, embora o CONTRIBUTING cite), SECURITY.md, PR template, NOTICE, campos `repository/bugs` no `package.json`, releases, instalação sem Node.

## Achados do uso real do MCP (identidade desenhada no próprio Stylo, 10/10/2026)
Detalhes em `docs/identidade/LEIA-ME.md`. Viram backlog da v1.1:
1. **Vários editores conectados**: sem `select_editor`, o servidor usa a aba mais recente e uma escrita caiu em outra aba, de outro projeto. Proposta: com mais de um editor conectado e nenhum escolhido, **recusar escritas** (leitura continua) e dizer para chamar `list_editors`/`select_editor`.
2. **`get_image` e o export PNG usam fonte de reserva** para Google Fonts (o `foreignObject` dentro de uma imagem SVG não carrega recursos de rede). A prévia que o agente vê não bate com o canvas. Proposta: embutir as fontes usadas (base64) no SVG do PNG ou avisar na resposta da ferramenta.
3. **`build_layout` devolve só a raiz** criada; os ids dos filhos exigem `find_layers`. Proposta: devolver a árvore de ids (nome → id).
4. `create_instance` aceita `props` de aparência (fill, stroke, opacity), o que permite mostrar estados forçados num guia; vale documentar no `AGENTE.md`.

