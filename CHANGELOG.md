# Changelog

Todas as mudanças relevantes do projeto, da mais nova para a mais antiga. Formato inspirado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/) (enquanto estiver na `0.x`, mudanças grandes podem acontecer entre versões).

Categorias: **Adicionado** · **Alterado** · **Corrigido** · **Desempenho** · **Documentação**.

---

## [Unreleased]

### Versão estável (branch `feat/versao-estavel`)

#### Segurança
- **Servidor local**: as escritas, o `/mcp` e as rotas de agente só aceitam `Origin` da própria porta. Antes, qualquer página em outra porta de `localhost` podia ligar o "Acesso de administrador" do MCP e alterar a configuração.
- Corpo JSON com limite por rota (1 MB padrão; 32 MB para chat, respostas de ferramentas, miniaturas e MCP; 200 MB só para gravar um projeto) e recusa antecipada por `Content-Length`.
- Nomes de projeto reservados do Windows (`con`, `nul`, `com1`...) recusados; a pasta de projetos não pode ser a raiz do disco nem uma pasta do sistema; corpo JSON que não é objeto vira 400; erro interno não expõe a mensagem original.
- No máximo 64 sessões MCP e 32 editores conectados (429 acima disso).
- **Imagem gerada por IA (#2)**: o download só aceita `https` de host público, sem credenciais, sem IP privado/loopback/link-local, sem seguir redirecionamento e com o limite de tamanho aplicado durante a leitura.
- **Projeto `.json` de terceiros é entrada não confiável**: `sanitizeDoc` (`src/validate.js`) valida estrutura, números, palavras-chave, ids, imagens (só `data:image`), remove chaves como `toString` e `__proto__` e limita o aninhamento; todo valor que vira CSS ou SVG passa por `isSafeCssValue`, `safeIdent` e `cssUrl`. Uma revisão independente do Codex achou escapes reais (`\"`, `\(`, CR/FF dentro de strings) que foram corrigidos.
- Ao abrir um projeto, o Stylo avisa quais hosts externos o CSS da página vai acessar.
- Configuração e conta gravadas de forma atômica, em fila e só para o dono; um arquivo de configuração corrompido vira `config.json.corrompido-<hora>` em vez de perder as chaves em silêncio.

#### Corrigido
- **Perda de dados**: se o IndexedDB falhasse no meio da sessão, as edições seguintes ficavam no localStorage e sumiam no próximo carregamento; agora abre a cópia mais nova. `saveNow` informa se salvou, e abrir, importar ou trocar de projeto não descarta mais o projeto atual quando o salvamento falha.
- Reabrir um projeto salvo perdia os breakpoints personalizados (`@media` exportado errado).
- Nome de camada que começa com número gerava classe CSS inválida (`.2024-hero`); nomes iguais podiam gerar a mesma classe.
- CSS da página com blocos aninhados quebrava as regras seguintes; `;` dentro de `url(data:...)` e `/*` sem fechar no CSS livre; colar uma camada ia para a página errada; `visible` indefinido era tratado de dois modos; `!important` se perdia no CSS livre.
- **Exportar PNG** de camada de código HTML com `<br>`, `<img>`, `<input>` ou entidades falhava sempre.
- `@media` de largura do CSS da página agora responde à largura da **tela desenhada** no canvas, como container query (#10). A exportação segue com `@media`.
- Tela cheia do editor de código agora é `Ctrl+Shift+M`: o F11 é reservado pelo navegador (#14).
- Exportar site avisa quando uma tela de largura fixa vai rolar na horizontal em celular, e diz onde ligar a largura fluida.

#### Alterado
- **Interface mais sóbria**: tokens de raio (2/4/6 px) e de tipografia (11/12/13/15 px), sem o ícone de estado vazio brilhante, sem halos de acento, sem `backdrop-filter` decorativo, sem caixa alta em campos de hex e títulos de seção (#4), aba selecionada com texto forte e sublinhado. Texto de 7,5 a 10,5 px subiu para 11 px.
- Acessibilidade: `accent-color`, seleção de texto, cursor e barras de rolagem da interface tematizados; anel de foco nas buscas e em `summary`; `prefers-reduced-motion` para a interface.
- **Mudança de comportamento**: no CSS livre por camada só valem `url()` de `data:image` ou `#id`; imagens externas em `assets` são removidas ao abrir.
- O formato do projeto passa a ter versão (`FORMAT_VERSION`): projeto de versão mais nova abre com aviso e não é rebaixado em silêncio.
- Repositório com o nome oficial `StyloDesigner` (menu de suporte, comando de plugin, CONTRIBUTING, issue template).

#### Adicionado
- **Agente e MCP desenham vetores**: `build_layout` e `create_layer` aceitam o tipo `path` (pontos, alças de Bézier `hin`/`hout`, `closed`, `vw`/`vh`, contorno com `cap` e `join`). Antes o agente só criava frame, rect, ellipse, text, line e icon.
- Runner E2E isolado (`npm run test:e2e`): sobe um servidor próprio em porta livre com pasta de projetos temporária, limita cada suíte a 4 min e aceita filtro (`npm run test:e2e -- exportacao`). O teste de desempenho usa a mediana de 5 rodadas.
- CI no GitHub Actions (unitários em Node 20 e 22; navegador em Chromium, ainda sem bloquear), `SECURITY.md`, `NOTICE`, template de pull request, campos `repository`, `bugs` e `homepage` no `package.json`.
- Plugin e cliente do Codex (`scripts/codex-worker.mjs`) e registro de estado em `docs/estado/` (retomada, decisões, pendências humanas) para trabalho contínuo por agentes.
- Três direções de marca com capturas do editor real e contraste medido (`docs/estado/MARCA.md`), à espera de escolha.
- Testes: de 290 para 358 unitários e de 41 para 44 suítes de navegador.

#### Documentação
- `ROADMAP.md` enxuto (o log de auditoria veio para este arquivo), guia do código atualizado, `README` com a contagem real de testes.

### Auditoria local — 9 de outubro de 2026 (movida do ROADMAP)

- **MCP verificado no navegador**: duas sessões leem em paralelo; chamadas de escrita têm travas próprias (inclusive duas chamadas do mesmo cliente), e operações sem alvo específico travam o documento; `DELETE` e `notifications/cancelled` cancelam operações pendentes, inclusive uma escrita cancelada enquanto espera atrás de outra permissão; stdio atende uma leitura durante outra chamada lenta. A validação final desta branch passou: 290 testes unitários e 41 suítes E2E; `agente-mcp.mjs` e `persistencia-multitab.mjs` passaram cinco execuções consecutivas cada. A expiração de sessão abandonada está implementada, mas ainda não foi validada com espera real de 10 minutos.
- **Revisão independente**: Claude Code Sonnet, autenticado pela assinatura Claude.ai Pro, fez leitura somente; Jev indicou Sonnet como modelo adequado (confiança 0,91). A franquia restante do Claude não estava disponível no CLI. Codex revisou e integrou as mudanças.
- **Página construída por agente via MCP**: Claude Sonnet criou a landing page Atelier em uma árvore, corrigiu o layout usando `get_image`, aplicou breakpoints e exportou HTML sem salvar o projeto. A prévia exibiu um erro de quebra de linha que o modelo corrigiu depois de observar a imagem. É evidência real de criação e iteração autônoma pelo MCP.
- **Biblioteca de imagens**: o painel Recursos lista as imagens do projeto com miniatura, dimensão, tamanho aproximado e quantidade de usos; clicar aplica à seleção ou insere no canvas. `list_assets` e `insert_asset` dão ao MCP o mesmo acesso sem enviar o data URL, e a inserção pede permissão e reutiliza os bytes existentes. O E2E da UI e do MCP passou; pastas/pacotes, renomear e excluir assets seguem abertos.
- **Referência visual reproduzida e comparada**: [Linear · Build](https://linear.app/build), desktop 1440×900 e celular 390×844. Claude montou a tela pelo MCP; a captura do HTML exportado tem diferença média RGB 15.03/255 e 21.31% dos pixels diferem em mais de 20 níveis. O título e a responsividade falharam: três linhas em `y=500` contra duas em `y=572`, e a raiz fixa em 1440 px fica cortada em 390 px. Também faltam itens da navegação e o asset animado original. Capturas, medições e ciclo de correção estão em [`docs/benchmarks/linear-build.md`](benchmarks/linear-build.md). A região animada varia entre capturas, então o número global inclui movimento; ainda falta um diff automatizado com essa região separada.
- **Exportação verificada no Chromium**: `export_html` gera HTML estático com CSS embutido, breakpoints e fonte Google via rede; a saída não é React/Vite e sanitiza `<script>` e atributos `on*` do HTML manual. No primeiro render, a página tinha moldura cinza e 24 px de padding no body; isso foi removido. O Atelier exportado foi medido em 1440 px e 390 px, sem overflow horizontal nem erros de console.
- **Colaboração e persistência**: há presença, atividade, travas e comentários; não há chat direto de agentes. Os projetos seguem em JSON com histórico de versões; nenhuma migração de banco foi decidida. O IndexedDB usa comparação transacional por revisão: uma aba desatualizada não sobrescreve a cópia mais nova; guarda um rascunho conflitante, recuperável após recarregar, e permite separar a aba quando a pessoa salva como outro projeto. Ainda não há mesclagem nem sincronização em tempo real. A bateria E2E verificou salvamento automático, conflito com edição externa, concorrência entre abas, recuperação de rascunho, indisponibilidade do servidor e versões antigas.
- **Colaboração — risco de rollback parcialmente mitigado**: o store agora expõe uma revisão de mutação. Se uma ferramenta falha depois de outra mutação ter ocorrido, o agente não restaura uma cópia antiga do documento; informa que manteve o estado atual. Um E2E atrasou de propósito o download de um ícone, fez uma edição humana durante a espera e confirmou que ela sobrevive à falha. Isso não prova rollback transacional de cada ferramenta quando ela própria já alterou parte do documento.
- **Riscos de colaboração em aberto**: experimento com duas pessoas em abas diferentes e dois agentes MCP confirmou que ambos os agentes leem/escrevem na última aba conectada, enquanto as alterações humanas ficam em documentos locais separados; ver `scripts/auditar-colaboracao.mjs` e o relatório da auditoria. As travas MCP não bloqueiam edição manual e as abas não sincronizam. O servidor direciona chamadas de todos os clientes com sessão para o editor conectado por último. Ainda faltam roteamento explícito por documento/aba, edição simultânea na mesma camada e undo de um agente durante escrita alheia.
- **Entrega de respostas MCP resiliente**: o cliente agora repete respostas após falha transitória de rede até o servidor confirmar, aborta tentativas ao desconectar e trata resposta duplicada como terminal (`410`). O teste E2E injeta uma falha de rede na primeira resposta e confirma que a operação é aplicada; os testes de MCP e toda a suíte E2E passaram no servidor isolado.
- **Sessões e brief MCP**: `tools/call` sem `Mcp-Session-Id` agora recebe HTTP 400, em vez de compartilhar o alias de identidade/travas de outro cliente. As instruções de `initialize` refletem se o Acesso de administrador está ativo, e `get_document` inclui notas de camada limitadas a 180 caracteres (nota completa em `get_layer`). Verificados por E2E MCP e unitários.
- **Sanitização de HTML**: nomes de `sandbox`, `target` e `rel` em qualquer caixa agora recebem política consistente; atributos `sandbox` duplicados são removidos antes de aplicar o valor controlado pelo editor e links `_blank` recebem `noopener noreferrer`. Dois casos vulneráveis foram reproduzidos e corrigidos; 14/14 testes de HTML/CSS e o parser real do Chromium passaram. Fuzzing adversarial ainda não foi feito.
- **CSS avançado verificado**: edição CSS por MCP com `get_project_css`/`set_project_css`; `@keyframes`, `perspective` e `transform-style: preserve-3d` aplicam no canvas e continuam no HTML exportado em Chromium. Não há editor visual de 3D, WebGL nem execução de JavaScript arbitrário.
- **Ainda por testar**: diff visual automatizado com regiões dinâmicas isoladas; corrigir e repetir a reprodução Linear em desktop/celular; outros efeitos e elementos HTML; preview real em tablet/celular; teste de três atores (dois MCPs e pessoa editando) e de falha/cancelamento durante escrita assíncrona; chat entre agentes e permissões por identidade/capacidade; colaboração entre abas; pacotes/organização de assets e ações de renomear/excluir; recuperação stdio depois de reinício do servidor; teste com API real de imagem.


### Mudanças que quebram compatibilidade
- Chamadas HTTP `tools/call` sem o cabeçalho `Mcp-Session-Id` agora recebem HTTP 400. Clientes devem enviar o identificador devolvido por `initialize` em cada chamada; o cliente stdio do repositório já faz isso.
- O HTML exportado agora usa fundo branco e centraliza a tela, removendo a moldura cinza e o padding de 24 px do `body`.

### Adicionado (fotos e IA de foto, fase 3)
- **Fotos grátis** (Recursos → Fotos; feito pelo Codex, revisado pelo Claude): busca no Openverse (sem chave, só licenças de uso comercial e com derivação permitida) e no Pexels (com chave guardada só no servidor). Clique ou arraste para inserir, "usar como preenchimento", crédito do autor guardado na camada e exportado no HTML quando a licença pede. O servidor baixa as fotos só de provedores permitidos, só bitmaps (sem SVG) e até 8 MB.
- **Editor de imagem** ("Editar imagem" numa camada com foto): recortar com proporções, girar e espelhar, ajustes, filtros com prévia, remover fundo (automático pelas bordas, varinha e pincel), tamanho/formato/qualidade com o peso final, "Restaurar original". Tudo no navegador, sem chave; "Aplicar" vira um passo do Ctrl+Z.
- **IA generativa de foto**: preencher área, trocar objeto e expandir, pela API de imagens do provedor (padrão OpenAI `gpt-image-1`; outro endereço em Configurações → Modelo de imagem). A chave não sai do servidor.
- Ferramentas do agente `edit_image` e `generate_image_edit` (esta só aparece com modelo de imagem configurado).

### Corrigido
- Salvar acusa conflito também em discos exFAT/FAT (data grosseira): o servidor compara o conteúdo, não só a data.
- Depois de editar o CSS à mão, o painel Design volta a funcionar na mesma propriedade.
- Traço padrão de vetores e linhas novos em cinza visível (#808080) no canvas escuro e em fundo branco.

### Adicionado (agente, fase 2)
- **Resposta em tempo real (streaming)**: o `/api/agent/chat` pede `stream: true` à API (OpenAI, NVIDIA NIM, Ollama) e repassa ao navegador em NDJSON. O texto aparece enquanto o modelo escreve; o raciocínio (`reasoning_content`, `reasoning` ou `<think>…</think>`) vai para um bloco recolhível "Pensando… 12 s" → "Pensou por 12 s"; as chamadas de ferramenta são montadas a partir dos pedaços.
- **Nunca mais travado**: tempo para o 1º pedaço (padrão 60 s) e tempo máximo só pensando (padrão 120 s), configuráveis, com erro claro e sugestão. O botão **Parar** fecha a conexão e o servidor aborta o pedido à API na hora.
- **Menos raciocínio na NVIDIA NIM** (opção ligada por padrão): o parâmetro certo por modelo — `chat_template_kwargs` (`enable_thinking`/`thinking: false`), "detailed thinking off", `/no_think` ou `reasoning_effort: low` — e `max_tokens` (padrão 4096). Se a API recusar um campo, o pedido é refeito sem ele. Modelo que não aceita ferramentas recebe uma explicação e sugestão.
- **Testar modelo** (Configurações → Agente de IA): mede o tempo até o 1º pedaço e se o modelo chama ferramentas; o resultado fica guardado e marca a lista de modelos ("✓ ferramentas · 1,2 s", "✗ sem ferramentas") e o menu de modelos do painel.
- **Subagentes** (`delegate_task`, só no agente interno): o agente divide um trabalho grande em 1 a 4 subagentes que rodam em paralelo, cada um com tarefa, escopo de camadas e modelo opcionais, contexto mínimo e limite de passos. Travas por camada impedem dois subagentes de alterar a mesma camada ao mesmo tempo; cada um aparece como um cartão recolhível (nome, status, passos, Parar). As alterações passam pela permissão/"Fazer sem perguntar" e saem com Ctrl+Z.
- **Jev (TypeSafe) para o agente**: `jev_choose`, `jev_score` e `jev_check` (segunda opinião rápida). O servidor chama a API com a chave `JEV_API_KEY` (Configurações → Chaves de API ou variável de ambiente), que nunca volta ao navegador; sem chave, as ferramentas nem são oferecidas.

### Corrigido
- Aba do Agente: abrir o painel depois de trocar de projeto não redesenha mais a conversa no meio de uma resposta.

### Documentação
- `docs/AGENTE.md`: quando usar subagentes e o Jev; streaming e tempos.

### Adicionado (editor de código)
- **Editor de código grande**: "Editar" na aba Código (ou `Ctrl+Shift+E`) abre um editor embaixo do canvas, com abas *CSS da camada*, *CSS da página* e *HTML*. Arraste a borda para mudar a altura (fica lembrada), `F11`/botão para tela cheia e `Esc` para voltar. O canvas mostra o resultado **ao vivo** enquanto você digita (sem entrar no histórico); `Ctrl+S`/`Ctrl+Enter` aplica com um passo de desfazer.
- **Autocompletar de verdade** (sem dependências): propriedades CSS modernas com busca fuzzy (`jc` → `justify-content`), valores por propriedade, unidades depois de números, funções (`var()`, `calc()`, `clamp()`, `repeat()`, `minmax()`, gradientes...), variáveis do projeto (estilos de cor e variáveis de tamanho com prévia da cor), seletores com as classes e ids das camadas, pseudo-classes e `@media` com os breakpoints do projeto. No HTML: etiquetas, atributos por etiqueta, valores comuns, fechamento automático e **Emmet** (`div.card>h2+p` + `Tab`).
- No editor: linha atual destacada, colchetes e aspas fecham sozinhos, Enter abre o bloco entre `{ }`, `Ctrl+/` comenta a linha e `Ctrl+F` procura.
- As variáveis do projeto (`--cor-…`, `--espaco-…`) agora também valem no canvas, então `var(--cor-x)` escrito à mão aparece igual ao exportado.

## [1.0.0] — 2026-10-08 · Stylo

### Adicionado (rodada 2)
- **Apresentar = navegador de verdade**: cada tela é o HTML/CSS exportado num iframe. Rolagem, :hover, :focus, sticky e @media funcionam. Barra com voltar/avançar (Alt+←/→), recarregar, endereço com a lista de telas, larguras (Desenhada, Responsivo, 1440, 1280, 1024, 768, 390), abrir em nova aba e atualização ao vivo quando o design muda.
- **Breakpoints por projeto**: presets (Laptop 1280, Tablet 1024, Tablet retrato 768, Celular 640, Celular pequeno 380) e personalizados (nome + max-width). Renomear, mudar largura e remover pelo menu ao lado da barra; a largura ativa aparece no topo.
- **Aba do Agente**: painel encaixado à direita com várias conversas por projeto (continuam de onde pararam), modelo escolhido por conversa, memória do projeto (ferramenta `remember` + notas editáveis) e chips de contexto.
- **Vários agentes ao mesmo tempo (MCP)**: cada conexão é uma sessão com nome próprio (`--agente`, `STYLO_AGENT` ou o cabeçalho `X-Stylo-Agent`); travas de 10 s por camada evitam que um agente sobrescreva o outro; `GET /api/presence`.
- **Usuários e presença**: perfil local (nome e cor) que assina comentários; avatares no topo com quem está no projeto (pessoas e agentes), o que cada agente fez e o que está travando.
- **CSS**: CSS livre por camada (qualquer propriedade, vale por breakpoint e na exportação, com validação), `order`, `flex-shrink`, `white-space`, `word-break`, `text-wrap: balance/pretty` e `transform: skew`.

### Alterado
- O projeto agora se chama **Stylo**: novo nome, logo e ícone da aba. O identificador do servidor MCP continua `projeto-designer` para não quebrar integrações já configuradas.
- Nova identidade visual: grafite neutro com azul de destaque (#4c8dff) e âmbar para medidas e guias, sem degradês; a interface usa IBM Plex Sans. Tema claro reajustado com a mesma lógica.


### Adicionado (editor de código)
- **Central de ajuda** (botão ? ou tecla ?): primeiros passos, atalhos, problemas comuns e suporte, com diagnóstico do ambiente para copiar e link para abrir um chamado.
- CSS: `position: sticky` ("Fixar ao rolar") e `pointer-events: none` na seção Estados → Normal. O sticky só vale para itens em fluxo e aparece na apresentação e no HTML exportado.

### Removido
- Relatórios avulsos (`AVALIACAO-MANUAL.md`, `RELATORIO-ERROS-E-MELHORIAS.md`, `docs/POLIMENTO-V0.13.md`): o que importava já está no CHANGELOG e nos testes.

### Alterado
- Ferramentas agrupadas por tarefa, com Mão disponível na barra, adaptação ao espaço do canvas e zoom posicionado de acordo com a altura da barra.
- Réguas com subdivisões e gerenciador de guias: posições numéricas, bordas/centro da seleção, remoção individual/em conjunto e trava de arrasto. Criar conjuntos de guias pode ser desfeito em um passo.
- Criar guias: Esc, perda de captura e soltura fora do canvas cancelam o gesto sem deixar uma guia acidental.
- Trilhas CSS do grid: validação com aviso preserva o último layout válido; Esc descarta o texto inválido. O seletor visual identifica quando as trilhas são personalizadas.
- Código: opção de quebra de linhas longas; controles de layout e alinhamento anunciam seu estado para leitores de tela.
- Configurações: navegação fixa por assunto, conteúdo com rolagem própria, campos mais legíveis e adaptação a telas estreitas. Trocar de seção preserva os rascunhos dos campos.
- Abas dos painéis: aparência consistente, foco visível, navegação com setas/Home/End e associação acessível entre aba e conteúdo.
- Seletor de fontes: melhora a semântica para leitores de tela e mantém os controles de paginação fora da lista de opções.
- Auto layout em Grid: grade rápida 6×6 navegável pelas setas e com foco único por Tab; trilhas CSS editáveis ganharam modelos de colunas comuns e orientação sobre como voltar aos controles numéricos.
- CSS ao vivo: a dica agora explica como editar o layout pelos controles e onde inserir trilhas CSS diretamente.
- Seletor de cores: matiz e opacidade expõem valores acessíveis, e os controles de cor respondem ao teclado.

### Verificação
- Cenários E2E adicionados para navegação da grade rápida, controles do seletor de cores e semântica da busca de fontes.

## [0.17.0] — 2026-10-08 — MCP completo, acesso de administrador e plugin do Claude


### Adicionado (editor de código)
- **15 ferramentas novas** (33 no total): `get_image` (a IA **vê** a tela como PNG, enviado como imagem pelo MCP), `export_html`, `set_responsive` (Tablet/Celular → `@media`), `set_state` (hover/pressionado/foco), `create_component`, `create_instance`, `duplicate_layers`, `add_interaction` (protótipo), `add_comment`, `delete_page`, `redo` e, para projetos, `list_projects`, `open_project`, `save_project`, `new_project`.
- **Acesso de administrador** (Configurações → Assistente de IA e MCP): os programas de IA **deste computador** alteram sem a janela de permissão (um aviso mostra cada alteração; Ctrl+Z desfaz) e podem abrir, salvar e criar projetos. Sem ele, as ferramentas de projeto são recusadas. O `/mcp` continua aceitando só pedidos desta máquina.
- **Plugin do Claude Code**: o repositório é um marketplace (`.claude-plugin/marketplace.json`) com o plugin `projeto-designer` (`integrations/claude-code`): MCP configurado + skill com o ciclo de trabalho (ler → montar → olhar a imagem → corrigir → responsivo). Instalação: `/plugin marketplace add Kaykygnb/projetodesigner2` e `/plugin install projeto-designer@projeto-designer`.
- **Codex (GPT)**: `integrations/codex/config.toml` e `AGENTS.md` prontos. **ChatGPT do site**: `integrations/chatgpt/README.md` explica por que ainda não conecta (só aceita MCP pela internet) e as alternativas.
- **`docs/MCP.md`**: guia completo (ligar cada programa, permissão e administrador, as 33 ferramentas, exemplos, problemas comuns).

### Corrigido
- Depois de **"Salvar como"**, o app ainda achava que o projeto estava "só no navegador" até o próximo salvamento automático (abrir outro projeto logo depois perguntava à toa).
- `exportPng` separado em `renderPng` (gera o PNG sem baixar), usado também pelo `get_image`.

---

## [0.16.0] — 2026-10-08 — Um agente que faz (e sabe design)

Relato do teste real com a NVIDIA (Nemotron): "conversa demais e faz pouco", "não sabe trocar fonte nem pôr ícone", "por que preciso selecionar algo?", "a cor dele é burra".


### Adicionado (editor de código)
- **`build_layout`**: a IA monta uma **estrutura inteira numa chamada** (página, seção, card, formulário, com ícones dentro), com UMA permissão e UM Ctrl+Z. Sem seleção, vira uma tela nova ao lado das existentes. Frames com layout sem tamanho nascem "hug"; a tela cresce com o conteúdo.
- **Ícones e fontes para a IA**: `search_icons` (aceita "carrinho", "casa"...), `insert_icon` (e nós `icon` dentro do `build_layout`) e `list_fonts` (nomes e pesos exatos).
- **Paleta**: `create_color_styles` cria os estilos de cor (variáveis de CSS) e `fill: {styleId}` liga as camadas a eles.
- **Páginas**: `create_page` e `switch_page`. A IA agora tem 18 ferramentas.
- **"Fazer sem perguntar"** no painel do Assistente (lembrado nas preferências): as alterações valem direto, sem a janela de permissão; cada uma continua saindo com Ctrl+Z. Programas do MCP continuam perguntando.
- Contexto de cada mensagem leva as **telas da página** e a **paleta**, para criar sem precisar selecionar.

### Alterado
- **`docs/AGENTE.md` reescrito**: "você FAZ, não conversa" (pedido claro = executa; resposta final em até 3 frases), as regras de layout da plataforma em detalhe (telas, flex/grid, x/y ignorados no fluxo, hug/fill, texto que quebra linha, padding/gap), **habilidades de design** (hierarquia, escala de espaçamento 4/8, tipografia, cor com paleta e 60-30-10, contraste, padrões de página, ícones, lugares de imagem) e uma receita completa de página.
- Até 30 rodadas de ferramenta por mensagem (eram 12), para trabalhos grandes.

---

## [0.15.2] — 2026-10-08 — Escolher o modelo da NVIDIA de verdade

Relato do teste real: "não consegui selecionar os modelos da NVIDIA nas configurações".

### Corrigido
- **"Ver modelos" exigia clicar em Salvar antes**: com a chave só colada, ele reclamava que não havia chave. Agora grava sozinho o endereço e a chave digitados antes de consultar.
- **A lista de modelos escondia quase tudo**: usava o `<datalist>` do navegador, que só mostra o que combina com o texto já escrito no campo (que vinha preenchido com o modelo sugerido). Virou uma lista de verdade, com busca ("llama", "qwen", "deepseek"); clicar escolhe e salva.
- A lista mostrava um "null" solto quando a busca tinha resultado; e o Esc na busca não fechava a janela.

---

## [0.15.1] — 2026-10-08 — NVIDIA NIM, instruções da IA e linhas do inspetor


### Adicionado (editor de código)
- **Provedores no Assistente**: OpenAI, **NVIDIA NIM** (`https://integrate.api.nvidia.com/v1`, chave `nvapi-...`), Ollama (grátis, no PC) ou outro compatível. Cada provedor guarda a sua chave (trocar e voltar não apaga nada); também aceita `OPENAI_API_KEY` / `NVIDIA_API_KEY`.
- **"Ver modelos"** em Configurações: lista os modelos da sua conta (e testa a chave), para escolher sem adivinhar o nome.
- **`docs/AGENTE.md`**: as instruções da IA (quem ela é, como a ferramenta funciona, o que cada ferramenta faz, como trabalhar, exemplos e limites). O servidor lê a cada conversa: editar o arquivo muda o comportamento na hora, no Assistente e no MCP.
- **Inspecionar** mostra o que está dentro: contorno tracejado de cada filho, as linhas das colunas/linhas de um grid e os `gap` hachurados (grid e flex), como o DevTools.

### Corrigido
- Respostas de modelos fora do padrão da OpenAI: argumentos de ferramenta já em objeto, raciocínio `<think>` (DeepSeek, Qwen) escondido da conversa e aviso quando o modelo "escreve" a ferramenta como texto em vez de usá-la.
- Erro de modelo sem suporte a ferramentas agora diz o que fazer ("escolha outro em Configurações").
- Teste `salvar-pasta.mjs` olhava a primeira mensagem da janela de Configurações, que agora tem também a seção de IA.

---

## [0.15.0] — 2026-10-08 — IA no editor: Assistente, MCP e Inspecionar

Versão de fechamento antes de estudar o código: as três últimas peças pedidas.


### Adicionado (editor de código)
- **Assistente de IA** (botão ✦ no topo): conversa dentro do editor que lê o design e faz alterações. Usa a **sua** chave da OpenAI, guardada só no servidor local (Configurações → Assistente de IA e MCP), ou qualquer servidor compatível (Ollama, LM Studio, de graça no seu PC). Mostra cada passo ("✓ Alterou “Botão”: radius") e tem "Parar".
- **MCP**: `http://localhost:5173/mcp` (Claude Code: `claude mcp add --transport http designer http://localhost:5173/mcp`) e `scripts/mcp.mjs` para quem usa stdio (Codex, Claude Desktop). Sem limite de chamadas: é tudo local. Protocolo implementado sem dependências em `server/mcp.js`.
- **11 ferramentas** para a IA (`src/agent/schema.js`): ler projeto, camada, código, seleção, procurar, selecionar; alterar, criar, apagar, mover e desfazer. A mesma lista vale para o Assistente e para o MCP.
- **Permissão antes de cada alteração** feita por IA: janela com quem pede e o quê ("Claude Code quer alterar “Card”: layout.gap"), com Permitir / Permitir tudo nesta sessão (por programa) / Recusar. Cada alteração é um passo do Ctrl+Z, e só propriedades conhecidas são aceitas.
- **Inspecionar** (tecla `I` ou o botão na barra): como o F12 do navegador. Passe o mouse para ver a etiqueta HTML e a classe do código exportado, o tamanho, o CSS aplicado (display, gap, padding, margem, fonte, cor) e o *box model* colorido (margem laranja, padding verde, conteúdo azul). Clique seleciona o elemento exato.
- Testes: `tests/agente.test.js` (protocolo MCP e regras de alteração) e a suíte `tests/e2e/agente-mcp.mjs` (inspetor, MCP por HTTP e stdio, permissão, Ctrl+Z, chave protegida e o Assistente com uma OpenAI falsa).

### Segurança
- A chave da API nunca é devolvida por nenhuma rota (`/api/status` deixou de devolver a configuração inteira). O `/mcp` segue as regras da API: só `localhost`, sem pedidos vindos de outros sites.

---

## [0.14.1] — 2026-10-08 — HTML exportado igual ao editor

Achado na revisão: na Vitrine, a seção "Planos" do HTML exportado desmontava (os itens saíam de dentro dos cards e os do plano Pro ficavam invisíveis), embora o editor mostrasse tudo certo.

### Corrigido
- **Etiquetas que o navegador "conserta" sozinho.** O editor desenha com `<div>`, mas o arquivo exportado é lido pelo navegador: um `<li>` direto dentro de outro `<li>` fecha o primeiro, um link dentro de outro link também. Agora o gerador confere cada etiqueta contra as dos pais (`htmlTagIn`) e, quando ela não cabe ali, usa a padrão. O painel avisa na seção **HTML** ("No código vira `<div>`: `<li>` precisa estar direto dentro de uma lista").
- **Estilos padrão do navegador no HTML e no PNG exportados:** `<ul>` com recuo de 40px, `<button>` com borda (4px a mais), links sublinhados e azuis. Um bloco de "reset" (`EXPORT_RESET`) zera isso antes das regras das camadas.
- **Tela com altura "Hug"** saía com altura fixa no HTML e cortava o que cresceu (o "Guia de estilo" no celular: 817px em vez de 1252px).
- **Tela fluida no celular:** o "Telas em 390px" deixava o site com no máximo 390px num celular maior (faixas dos lados); agora a tela fluida ocupa a janela em qualquer largura.
- **Vitrine:** os itens dos planos ficam numa lista `<ul>` dentro de cada card.


### Adicionado (editor de código)
- `tests/e2e/exportacao-fiel.mjs`: exporta cada tela, abre como site e compara **cada camada** com o editor (Desktop, Tablet e Celular, ±1,5 px). Conferido que ele falha com a correção desligada.
- `tests/exportacao.test.js` (7 testes) e a opção `ids` em `exportHtml`/`generateCode` (marca os elementos com o id da camada, para os testes).

---

## [0.14.0] — 2026-10-08 — Exemplo "Vitrine completa"


### Adicionado (editor de código)
- **Exemplo "Vitrine completa"** (`src/sample-vitrine.js`): uma landing page responsiva inteira, na página inicial (com miniatura) e em Arquivo → Exemplo. Usa auto layout (flex e grade), Tablet/Celular (grade 3 → 2 → 1, hero em coluna, menu que some, fontes menores), tela raiz de largura fluida, modo escuro, variáveis de tamanho e estilos de texto, estados com transição e cursor, três componentes com instâncias, ícones vetoriais, gradientes linear/radial/cônico, vidro, HTML semântico, limite de linhas, faixa com rolagem horizontal, protótipo (botão → "Obrigado" → volta), notas, comentários (um com resposta, um resolvido), grade de layout, seção do canvas e a 2ª página "Guia de estilo".
- `scripts/gerar-miniatura-vitrine.mjs` gera a miniatura (`assets/example-vitrine.png`).
- Testes: `vitrine.test.js` (a estrutura promete e entrega) e a suíte de navegador `vitrine.mjs` (abre pela página inicial, 3 → 2 → 1 colunas, modo escuro, código, apresentar).

### Documentação
- **README reescrito** para apresentar o produto (por que existe, um site de ponta a ponta com capturas reais, o que dá para fazer, como começar, o que ainda não tem). O conteúdo detalhado anterior virou o **[`docs/GUIA-COMPLETO.md`](docs/GUIA-COMPLETO.md)**.
- **Capturas novas** do projeto base em `docs/screenshots/` (geradas por `scripts/gerar-capturas.mjs`, reescrito para a Vitrine); as capturas antigas saíram.

### Alterado
- **A Vitrine é o único projeto de exemplo**: aparece na primeira abertura, na página inicial ("Projeto base para aprender") e em Arquivo → Abrir o projeto base. Os exemplos "Landing" e "App mobile" saíram do app; os documentos deles ficam só como dados de teste em `tests/fixtures/amostras.js`.
- Os post-its de nota viram só o ícone quando o zoom é menor que 50%, para não cobrir o design em telas grandes.

---

## [0.13.1] — 2026-10-08 — Layout mais limpo

### Alterado
- **Réguas começam escondidas**; **Ctrl+R** (ou Shift+R) liga e desliga, sem recarregar a página, e a escolha fica lembrada.
- **Largura da tela e modo de cor foram para a barra do topo**, em poucos ícones (só o modo ativo mostra o nome); o modo de cor é um botão único (sol/lua) com menu. No Desktop **nada flutua sobre o canvas**; em Tablet/Celular surge só uma faixa fina com o resumo e "Telas em 390px".
- **Listas de páginas e camadas** com linhas retas, sem cantos arredondados e sem o contorno lateral colorido.
- **Painel Design mais limpo**: títulos de seção discretos e sem caixinha de ícone, nomes do CSS em tom suave, e as seções pouco usadas (Exportar, HTML, Efeitos e Estados vazios, Grades de layout vazias) começam recolhidas.
- Incorporada a branch `layout-polido-v0.13` (topo de 40px, informações pelo ícone **i**, Nota sob demanda); a versão da página inicial agora vem de `src/version.js`.

---

## [0.13.0] — 2026-10-08 — Responsivo, modos de cor, variáveis, seletor de cor com paletas e notas visíveis

### Adicionado (responsivo)
- **Barra Desktop · Tablet · Celular** no topo do canvas. Tablet (≤ 1024px) e Celular (≤ 640px) mostram o design inteiro como ficaria naquela largura e o painel Design edita **só a diferença** (`node.bps`, em cascata: celular = base + tablet + celular). Módulo de dados em `model.js` (`bpView`, `editBp`, `BP_KEYS`) análogo ao dos estados.
- O CSS exportado ganha **`@media (max-width: …)`** com só o que muda em cada breakpoint (inclui o efeito de o layout do PAI mudar: um filho vira item de flex, por exemplo) e `display: none` para camadas ocultas por largura. **Largura fluida** numa tela da raiz: `width: 100%; max-width; min-height; margin: 0 auto`.
- No modo Tablet/Celular: o painel mostra só o que pode variar com a largura (esconde Nota, HTML, Estados, Exportar, Componente), com aviso e **Restaurar ao Desktop**; o olho do cabeçalho oculta **só naquela largura**; o canvas **só seleciona** (arrastar, redimensionar, apagar e atalhos de edição ficam desligados); **Telas em 390px/768px** ajusta a largura dos frames só no modo. Camadas com ajustes ganham um ícone na lista. Os ajustes sobrevivem a recarregar e entram no desfazer; o modo volta a Desktop ao abrir.

### Adicionado (modos de cor e variáveis)
- **Modos de cor** (`styles.modes`, `style.modes`): "Escuro automático" (inverte a luminosidade) ou modo em branco. Ver o modo no canvas, **editar o valor do estilo no modo ativo** (pela amostra em Recursos e pelo painel Design), renomear, "vale sozinho pela preferência do sistema" e excluir (botão direito no modo). O CSS gera `:root[data-theme="escuro"]` e `@media (prefers-color-scheme: dark)`.
- A **amostra de um estilo de cor** em Recursos agora **edita** o estilo (antes só dava para aplicar, renomear e excluir).
- **Variáveis de tamanho** (`styles.vars`): aba Recursos → Variáveis (criar, renomear, mudar o valor, excluir). O botão na legenda de `gap`, `padding`, `border-radius` e `font-size` liga o campo a uma variável (ou cria uma com o valor atual). O valor chega a todas as camadas ligadas; editar o campo à mão desliga; o CSS usa `var(--espaco-m)` e declara no `:root`.

### Adicionado (seletor de cor)
- Seletor reescrito (`ui/colorpicker.js`, `color.js`): campos **HEX/RGB/HSL** (setas ± 1, Shift ± 10), **barra de opacidade**, cor original clicável, **contraste WCAG** sobre branco e preto, **sugestões de harmonia** (complementar, análogas, tríade, tons) com "guardar na paleta", **recentes**, conta-gotas e as cores do projeto/paletas prontas recolhidas.
- **Paletas gerenciáveis dentro do seletor**: abas por paleta, **+ Nova** (já com a cor atual e o nome em edição), renomear (clique no nome ou duplo clique na aba), **+** guarda a cor atual, **×** tira a cor, duplicar, copiar como variáveis CSS e excluir **com confirmação ali mesmo**. O seletor se mantém inteiro na janela quando cresce.

### Adicionado (notas e comentários)
- **Notas visíveis**: post-it amarelo no canvas acima do canto superior direito da camada (a selecionada mostra a nota inteira), clique abre a nota no painel; **Exibir → Notas** liga/desliga. Campo da nota em estilo post-it. A nota também vira **comentário no CSS gerado** (`/* ... */`), além do HTML.
- **Editar o texto de um comentário ou resposta** depois de enviado (ícone de lápis; mostra "editado"); entra no desfazer.

### Adicionado (acabamentos da exportação)
- **Estados (hover, pressionado, foco) em vetores**: o HTML exportado ganha `.icone:hover path[data-vis] { fill; stroke… }` (cor sólida e contorno).
- **Filtros de cor no SVG exportado**: brilho, contraste, saturação, tons de cinza e matiz viram primitivas de `<filter>`.

### Testes
- `color.test.js`, `modes.test.js`, `responsivo.test.js` e mais casos em `html-nota.test.js`; suítes de navegador `responsivo.mjs`, `modos-variaveis.mjs` e `seletor-de-cor.mjs`; `comentarios.mjs` e `notas-paletas-painel.mjs` ampliadas.

---

## [0.12.0] — 2026-10-08 — Painel Design explicativo, notas, HTML semântico e paletas


### Adicionado (editor de código)
- **Painel Design que explica**: cada seção ganhou ícone, cabeçalho clicável que **recolhe/abre** (lembrado) e uma explicação curta em português simples; o botão **Explicações** (topo do painel) liga/desliga esses textos. Novo **cabeçalho da seleção** com ícone, nome, tipo, a etiqueta HTML (`<div>`) e atalhos para ocultar/travar.
- **Todos os campos com legenda + nome do CSS + dica rica**: posição (`left · top`), dimensões, modo de largura/altura (fixo/hug/fill), rotação, restrições, opacidade, mesclagem, cantos, fonte, peso, tamanho, altura da linha, espaçamento, alinhamento e caixa do texto, tipo de preenchimento, contorno (espessura, estilo, posição, extremidade, quina, lados) e sombras (deslocamento X/Y, desfoque, espalhar).
- **Empilhamento** (`z-index`): botões trazer para frente / avançar / recuar / enviar para trás na seção Posição.
- **Dicas bonitas em tudo**: todo `title` do app vira a mesma dica rica (barra de destaque, atalho como tecla, posição inteligente: à esquerda no painel direito, à direita no esquerdo, em cima na barra de ferramentas).
- **Nota na camada** (`node.note`): seção **Nota** (recolhida enquanto vazia), menu de contexto **Adicionar/Editar nota**, selo na lista de camadas (com a nota na dica) e **comentário `<!-- ... -->` no HTML gerado** (opção "Incluir no código"). Não é herdada por instâncias.
- **Seção HTML**: etiqueta da camada (`div`, `section`, `header`, `nav`, `button`, `a`, `h1`–`h6`, `p`, `ul`, `li`...; lista fechada e validada), `href` para links e descrição (`aria-label`, com `role="img"` em camadas sem filhos). Sincroniza com componentes (`tag`, `href`, `alt`).
- **Paletas de cor próprias** (`palettes.js`): aba Recursos → Paletas (criar vazia/da seleção/do projeto/colando cores, renomear, duplicar, excluir, aplicar com clique ou Shift+clique no contorno, **copiar como variáveis CSS**, **adicionar ao projeto como estilos de cor**) e grupo "paleta própria" no **seletor de cor** com **+** para guardar a cor atual e "Nova paleta com esta cor". Salvas no navegador, valem em todos os projetos, sincronizam entre abas.
- Testes: `palettes.test.js`, `html-nota.test.js` e a suíte de navegador `notas-paletas-painel.mjs`.

### Alterado
- Os testes de navegador que buscavam `[title=...]` passam a usar `aria-label` (o `title` nativo foi trocado pela dica rica).

---

## [0.11.0] — 2026-10-08 — CSS ampliado, estados interativos, comentários e testes de navegador

### Adicionado (comentários nas camadas)
- **Comentários**: anote o que precisa mudar direto na camada. Três jeitos: selecione **uma** camada e escreva na aba **Comentários** (ícone de balão no painel direito; o pino nasce no canto superior direito), use a ferramenta **Comentar (`C`)** e clique no **ponto exato** da camada, ou botão direito → **Comentar**. `Ctrl+Enter` envia.
- **Pinos no canvas** (gota com o número) acompanham a camada quando ela se move ou muda de tamanho; clicar num pino abre a conversa. Resolvidos somem do canvas (continuam na lista, filtro "Resolvidos").
- **Conversa**: responder, **Resolver/Reabrir**, apagar; clicar no card seleciona a camada e rola até ela. A lista mostra os comentários da **página aberta**. Selo com o número de **abertos** na aba e **um balão com a contagem** em cada camada comentada na lista de camadas.
- Ficam **dentro do projeto** (`doc.comments`, mesmo arquivo `.json`): entram no desfazer (`Ctrl+Z` desfaz criar/resolver/apagar), nas versões antigas e na pasta; apagar a camada leva os comentários dela (desfazer traz de volta). Projetos antigos abrem normalmente (sem lista).
- **Autor**: o nome definido em Configurações → "Seu nome nos comentários" (padrão "Eu"). Sem login: o mesmo formato serve para quando houver trabalho em equipe.
- Módulo puro `comments.js` (testado) e a suíte de navegador `comentarios.mjs`.

### Adicionado (mais CSS útil)
- **Gradiente cônico** (`conic-gradient(from Ndeg, ...)`): novo tipo de preenchimento, com o ângulo de início e as paradas. Em vetores e no SVG exportado vale só a cor da 1ª parada (o SVG não tem gradiente cônico).
- **Peso do espaço** (`flex-grow`): item "Preencher" no eixo principal de um flex ganha o campo "Peso do espaço" (1 e 3 dividem em 1/4 e 3/4; os limites min/max continuam valendo por cima). Sincroniza do principal para os filhos; o peso da raiz da instância é da própria instância.
- **Trilhas personalizadas no grid**: "Trilhas personalizadas (CSS)" para colunas e linhas (`240px 1fr 2fr`, `auto 1fr auto`, `repeat(auto-fit, minmax(200px, 1fr))`). Vazio usa os números de colunas/linhas; escolher no seletor visual ou nos números limpa as trilhas. O texto é **sanitizado** (`cleanTrackList`: sem `; { } : aspas`) para não fechar a regra no CSS exportado.
- Blocos recolhíveis do painel (Limites e proporção, Filtros de cor, Trilhas personalizadas) **lembram se estavam abertos** (antes fechavam sozinhos ao apagar o último valor).

### Adicionado (variáveis de CSS)
- **Estilos de cor viram variáveis de CSS** no código gerado: camadas ligadas a um estilo escrevem `background-color: var(--cor-primaria)` (em texto, `color: var(...)`) e o CSS começa com **um** bloco `:root { --cor-primaria: #7c5cff; }` com as variáveis usadas. Vale no painel Código, em "Copiar CSS", no HTML exportado e no PNG. Nomes repetidos ganham sufixo (`-2`); vetores (cor dentro do `<svg>`) e camadas sem estilo continuam com o valor direto. Mudar o estilo no editor muda a variável, como num design system de verdade.

### Adicionado (rolagem em frames)
- **"Conteúdo que sai"** (substitui o "Cortar conteúdo"): *Cortar*, *Mostrar*, *Rolar na vertical*, *Rolar na horizontal* ou *Rolar nos dois sentidos* (`overflow: hidden | visible | auto`, por eixo). A rolagem **funciona de verdade na apresentação e no HTML exportado** (listas, telas longas, carrosséis); no editor o conteúdo continua cortado para não aparecerem barras de rolagem no canvas. Projetos antigos continuam iguais (`clip` define cortar ou mostrar). Sincroniza com componentes.

### Adicionado (estados interativos)
- **Estados** (seção "Estados" do painel Design): **Normal · Hover · Pressionado · Foco**. Escolha um estado e o painel passa a editar SÓ as sobrescritas dele — preenchimento/cor, contorno, cantos, sombras, filtros, opacidade, mesclagem e **escala** (`transform: scale()`). O canvas mostra a camada selecionada naquele estado e uma bolinha marca os estados em uso; "Limpar este estado" apaga. Só o que difere do normal é guardado (voltar ao valor normal remove a sobrescrita) e um estado pode **remover** algo da base (ex.: tirar o contorno no hover).
- **Código gerado**: uma regra por estado só com o que muda (`.botao:hover`, `.botao:active`, `.botao:focus-visible`; o que sumiu vira `unset`) e `tabindex="0"` na camada com foco. Vale para o painel Código, copiar CSS e HTML exportado.
- **Transição** (`transition: all 200ms ease`): duração e curva (suave, entra e sai, desacelera, acelera, constante) e **cursor** (`pointer`, `text`, `grab`, `not-allowed`...). Aparecem no código exportado e na apresentação; no editor nada anima nem muda o cursor das ferramentas.
- **Limitação**: em vetores, estados de preenchimento/contorno valem no editor e na apresentação, mas **não no HTML exportado** (a cor fica dentro do `<svg>`; uma regra `:hover` na `<div>` não a alcança).
- **Modo Apresentar** aplica hover, pressionado (por cima do hover, como a cascata do CSS) e foco, com a transição.
- `states`, `transition` e `cursor` sincronizam do componente principal para as instâncias. Trocar de seleção sai do modo estado. Grupo, seção e linha não têm estados.

### Alterado (caneta e acessibilidade)
- **Caneta:** clicar, sem arrastar, num ponto que faz parte de um grupo selecionado passa a selecionar **só ele** (arrastar continua levando o grupo todo).
- **Dicas ricas:** o texto do `title` nativo agora vira `aria-label` (antes só sumia), então leitores de tela e seletores continuam achando o controle; os `<select>` com título também ganham `aria-label`.

### Testes
- Instalado o **Playwright** (dev) e rodadas as **16 suítes de navegador: todas passam** (279 verificações). Cinco suítes foram atualizadas porque a interface mudou de propósito: modo do auto layout em cartões (`.al-mode`), matriz de alinhamento (`.al-cell`), contorno por lado em ícones, `aria-label` no lugar de `title` e o novo item "Novo ícone" no menu Arquivo.

### Alterado (polimento do painel)
- "Efeitos" e "Item do layout" no mesmo padrão do resto: legendas em português com o nome da propriedade CSS e **dicas ricas** (`filter: blur()`, `backdrop-filter`, `position`, `grid-column`, `grid-row`, `justify-self`, `align-self`).
- Removido código morto: o ajudante `prop()` e o CSS da matriz antiga, das linhas `prop-*` e do seletor de cor nativo.

### Adicionado (CSS ampliado)
- **Limites de tamanho**: `min-width`, `max-width`, `min-height`, `max-height` (seção Tamanho → "Limites e proporção"; campo vazio = sem limite). Em medida **fixa** o valor é limitado na hora (e ao redimensionar com as alças); em **Hug/Fill** quem obedece é o navegador e o canvas mede de volta. O `min-width` do usuário substitui o `min-width: 0` que o item "fill" de um flex escreve sozinho. Texto com largura "hug" e largura máxima passa a **quebrar linha** (`white-space: pre-wrap`) ao chegar no limite.
- **Proporção** (`aspect-ratio`): presets (1:1, 4:3, 16:9, 3:2, 2:1, 3:4, 9:16) ou "usar o tamanho atual". Com as duas medidas fixas o editor mantém a proporção ao redimensionar; quando uma medida é Hug/Fill o CSS `aspect-ratio` entra no código e a medida fixa vira `auto` no outro eixo. Os limites vencem a proporção, e depois do corte o outro eixo segue a proporção de novo, como no CSS.
- Não valem para grupos (a caixa deles é recalculada dos filhos); a proporção também não vale para texto e linha.
- Os campos novos (`minW`, `maxW`, `minH`, `maxH`, `aspect`) **sincronizam do componente principal para as instâncias** e podem ser sobrescritos numa instância.
- Campo numérico "anulável" (`nullable` em `ui/dom.js`): apagar o texto remove o valor.
- **Imagem de fundo com controle de verdade**: ajuste (cobrir, conter, esticar ou **tamanho próprio** em % da camada), **posição** (matriz 3×3 + X/Y em %) e **repetição** (ladrilho, só na horizontal ou só na vertical; vale em "conter" e "tamanho próprio"). Sai como `background-size`, `background-position` e `background-repeat`. Projetos antigos continuam iguais (cover, centro, sem repetir).
- **Margem do item** (`margin`): horizontal/vertical ou por lado, para itens em fluxo de um flex/grid (seção "Item do layout"). Camadas livres/absolutas ignoram (a posição já é left/top). A margem do item é do **lugar** dele: não vem do componente principal para a raiz da instância (como x/y), mas a do **filho** dentro de uma instância sincroniza e pode ser sobrescrita.
- **Filtros de cor** (seção Efeitos, recolhido): `brightness`, `contrast`, `saturate`, `grayscale`, `hue-rotate`; só os que fogem do padrão entram no CSS (`filter: blur() brightness() ...`). Sincronizam com componentes e entram em copiar/colar propriedades (colar de uma camada sem filtros **limpa** os do destino). Não saem no SVG exportado (como o `backdrop-filter`).
- **Texto — truncar**: "Quando não cabe": *Quebrar linha* (padrão), *Uma linha com …* (`white-space: nowrap` + `text-overflow: ellipsis`) ou *Limitar linhas* (`-webkit-line-clamp` + `line-clamp`, de 1 a N linhas). Precisam de largura fixa ou máxima (o painel avisa). O alinhamento vertical por grid é desligado enquanto se trunca, e durante a edição o texto aparece inteiro. Dica no painel e no SVG: o SVG exportado mostra o texto completo (não trunca).
- **Texto — espaço entre palavras** (`word-spacing`), também em estilos de texto compartilhados e no SVG. `truncate`, `lines` e `wordSpacing` sincronizam do componente para as instâncias e entram em copiar/colar estilo.
- No **SVG exportado**: tamanho próprio e posição ficam **exatos** (o editor guarda o tamanho original da imagem ao escolhê-la) e a repetição vira `<pattern>`; em cobrir/conter a posição é aproximada em 3 alinhamentos (o SVG não tem posição em %). Repetir junto com "conter" não é exportado.


### Adicionado (editor de código)
- **Seletor de cor próprio** (no lugar do seletor feio do navegador): área de saturação/brilho, barra de matiz, campo HEX, conta-gotas e **grupos de cores**: "Neste projeto" (as mais usadas), "Estilos de cor" e paletas prontas (Neutros, Vivas, Suaves). Aplica ao vivo, grava o histórico ao soltar, fecha com Esc ou clicando fora e rola se a tela for baixa. Vale para preenchimento, contorno, gradiente, sombras e grades.
- **Contorno por lado em ÍCONES**: Todos · Cima · Direita · Baixo · Esquerda · Espessura por lado. Cada lado liga/desliga sozinho e dá para combinar (ex.: cima e baixo); de "Todos", o clique escolhe só aquele lado; com os quatro ligados volta a "Todos". Substitui a lista de opções, e cada ícone tem dica com o CSS (`border-top`...).

## [0.10.0] — 2026-10-07 — Seção, auto layout com cara de produto e caneta para ícones SVG


### Adicionado (editor de código)
- **Seção** (`Shift+S`, como no Figma): contêiner de organização do canvas. Só existe na raiz, guarda frames, tem o nome em destaque acima dela e leva as telas junto ao ser movida. Desenhar uma seção em volta de telas da raiz **adota** as que ficaram totalmente dentro. Clicar no nome ou no corpo seleciona e arrasta a seção. Telas podem entrar e sair arrastando. Painel Design mostra só Posição, Tamanho, Preenchimento e Exportar. Exportada como `<section>`; `Ctrl+Shift+G` desfaz a seção.
### Adicionado (caneta para criar ícones SVG)
- **Arquivo → Novo ícone (24×24)**: cria um frame de ícone no centro da vista, com a **grade de pixels de 1px**, enquadra com zoom grande, liga o **encaixe de 1px** e deixa a caneta pronta. Exporte pelo painel (SVG) como qualquer frame.
- **Barra da caneta** (aparece sozinha com a caneta ou na edição de pontos): **Encaixe** Livre/1/2/4/8 px — pontos grudam na grade contada do canto do frame — e os atalhos à vista.
- **Continuar um caminho**: com um vetor aberto selecionado, a caneta (P) clicando na **ponta** dele continua desenhando o mesmo vetor (clicar no início também vale). Clicar no outro extremo fecha.
- **Vários pontos**: arraste uma caixa no vazio, **Shift+clique** soma/tira, **Ctrl+A** seleciona todos. Mover, setas, canto/suave e Excluir valem para o grupo.
- **Alt+clique num ponto** converte canto ↔ suave (como o "converter ponto" do Illustrator). **Abrir aqui** corta um caminho fechado depois do ponto selecionado.
- **Extremidade e quina do traço** (reta/redonda/quadrada, pontuda/redonda/chanfrada) para vetores, no painel Contorno e no SVG exportado — o SVG antes ignorava a extremidade (saía "reta" mesmo com o editor mostrando redonda).

### Adicionado (caneta e SVG)
- **Alt+clique no traço agora segue a CURVA**: o ponto novo é inserido no lugar certo do trecho curvo e nasce com as alças corretas (divisão de Bézier, De Casteljau), então o desenho **não muda** ao adicionar pontos. Antes ele media na corda reta e entortava a curva.
- Com **Alt** pressionado, um pontinho rosa mostra no traço **onde** o clique vai adicionar o ponto.
- **Shift** trava em múltiplos de 45°: ao desenhar um segmento novo, ao arrastar um ponto e ao arrastar uma alça.
- **Setas movem o ponto selecionado** (Shift = 10 px) durante a edição de pontos.
- **Painel Vetor renovado**: botão Concluir edição; "Ponto N de M" com tipo **Canto / Suave**, **X / Y** numéricos (relativos ao pai, como a camada) e Excluir ponto; **Inverter** direção do caminho.
- **Código SVG (path `d`)** do vetor num bloco recolhível: **Copiar** e **Aplicar**. Cole o `d` de outro SVG (aceita M L H V C S Q T A Z, absolutos e relativos) para trocar a forma sem perder cor, contorno e nome. Texto sem caminho válido é recusado.

### Corrigido
- **Menu de contexto (botão direito) cortado em telas baixas**: os menus agora têm altura máxima (~70% da janela, sempre dentro dela) e rolam por dentro, então a última opção sempre dá para alcançar. Vale para todos os menus flutuantes (camadas, canvas, Arquivo, zoom).

### Alterado (polimento)
- A caixa **"CSS ao vivo"** agora começa **fechada** e abre/fecha com a setinha (a escolha fica lembrada). Segue não editável: é só uma curiosidade.
- **Painéis laterais mais delicados**: abas em pílula (sem sublinhado), seções com mais respiro e divisórias leves, campos e botões com cantos mais redondos, foco com halo suave, rolagem fina.
- **Lembrete "este projeto ainda não tem arquivo"** menor e mais suave, com ícone num selo; indicador de "Salvo" no topo virou uma pílula discreta com dica rica.

### Adicionado (Auto layout com cara de produto)
- **Auto layout redesenhado**: o modo virou 4 cartões (Livre · Linha · Coluna · Grade) com o CSS de cada um embaixo, um selo "CSS puro" e a caixa **"CSS ao vivo"**, que mostra as declarações reais que o frame gera agora (`display`, `gap`, `padding`, `justify-*`, `align-items`...) e muda junto com os controles.
- **Dicas ricas** (`tip` em `ui/dom.js`): ao passar o mouse, aparece um cartão com título, o CSS correspondente (colorido, em fonte mono) e uma frase em português explicando o que aquilo faz. Vale para os cartões de modo, a caixa de CSS ao vivo (cada propriedade), a matriz de alinhamento, gap, padding, wrap, colunas/linhas e alinhamentos. Substitui a dica nativa do navegador nesses controles.
- Cada legenda mostra o nome da propriedade CSS ao lado ("Espaço entre itens · gap").

### Adicionado (CSS Grid)
- **Seletor visual de grade** 6×6 no Auto layout em modo grid: passe o mouse para ver "colunas × linhas" e clique para aplicar as duas contagens de uma vez.
- **Células do grid no canvas**: com um frame em grid selecionado (ou um item dele), as células reais aparecem tracejadas, lidas do estilo calculado do navegador (valem para linhas automáticas e `gap`).
- **Espaço entre células unido**: um campo só para `gap`, com botão para separar em coluna/linha (separa sozinho se os valores forem diferentes).

### Alterado
- **Painel Design com o visual do Figma**: títulos de seção maiores, legendas pequenas em cima dos campos ("Alinhamento", "Posição", "Dimensões", "Opacidade", "Raio dos cantos", "Peso", "Espessura"... também em Texto, Preenchimento e Contorno), campos mais altos com cantos suaves e os botões de alinhar/distribuir em três "pílulas". O alinhamento deixou de ser uma barra fixa no topo e passou a fazer parte da seção Posição.
- Tela dentro de uma seção não é mais recolorida pela cor automática (branco sobre cinza claro é o esperado).

### Adicionado (continuação)
- Telas dentro de seções valem como "telas" no modo Apresentar e no painel Protótipo (`isBoard` em `model.js`).

---

## [0.9.1] — 2026-10-07 — Documentação do código

### Documentação
- **[Guia do código](docs/GUIA-DO-CODIGO.md)** para quem vai ler ou mexer no código: glossário, ordem de leitura, o caminho de um clique (desenhar um retângulo) pelos arquivos, tabela "quero mudar X → arquivo/função", regras do projeto e como manter a documentação.
- **[Referência](docs/REFERENCIA.md)** com as 496 funções e constantes, arquivo por arquivo, com parâmetros e link para a linha. É **gerada dos comentários** do próprio código por `scripts/gerar-referencia.mjs` (`npm run docs`), então não envelhece; `npm test` avisa se ela ficou desatualizada.
- Comentários nas 5 funções exportadas que ainda não tinham descrição (`createSaving`, `createHome`, `createIconsPanel`, `openModal`, `parseColor`).

---

## [0.9.0] — 2026-10-07 — CSS de verdade no painel: grid, contorno por lado, snap ao redimensionar

4º relato do teste real: "contorno só de um lado", "CSS Grid não exerce força", "opções de layout esquisitas", "não vejo a barreira do frame ao redimensionar", "painel meio feio".

### Corrigido
- **CSS Grid não alinhava os itens**: todo item de grid recebia `justify-self: start` / `align-self: start` fixos, e no CSS isso anula o `justify-items` / `align-items` do grid pai. Agora o item só escreve `*-self` quando você escolhe (ou quando o tamanho é "Fill" = `stretch`), então o alinhamento do grid vale de verdade.
- **Trocar de flex para grid** com `space-between` (que não existe no grid) caía num valor inválido; agora vira `start`. E `stretch` (que não existe em `justify-content`) vira `flex-start` ao voltar para flex.


### Adicionado (editor de código)
- **Snap ao redimensionar**: a borda que você puxa gruda (até 6 px de tela) nas bordas do frame pai, dos vizinhos e das guias da régua, com a linha rosa. `Ctrl` ou `Alt` desligam. Só bordas: centros não puxam, para não atrapalhar um tamanho livre.
- **Contorno por lado** em retângulos e frames: todos, só em cima, só embaixo, só esquerda, só direita, cima+baixo, esquerda+direita ou personalizado (espessura por lado). Vira `border-top/right/bottom/left` no CSS e linhas no SVG exportado.
- **Grid**: opção `stretch` em `justify-items`/`align-items`, `justify-self` por item e o botão "Itens preenchem as células".
- **Flex**: `stretch` e `baseline` em `align-items`, `stretch` em `align-self`.
- 19 verificações novas em `tests/e2e/css-polimento.mjs`.

### Alterado
- **Seção de layout com os nomes do CSS**: cada controle mostra a propriedade que gera (`display`, `gap`, `flex-wrap`, `justify-content`, `align-items`, `grid-template-columns`, `grid-template-rows`, `column-gap`/`row-gap`, `justify-items`…). Os seletores mostram o valor CSS de verdade (`flex-start`, `space-between`…). No item: `position: absolute`, `grid-column`/`grid-row` span, `justify-self`, `align-self`. Escolher `stretch` no item liga o tamanho "Fill" daquele eixo (são a mesma coisa no CSS).
- **Painel direito reorganizado** na ordem do Figma: a antiga seção "Camada" virou **Posição** (X/Y, constraints, rotação, espelhar), **Tamanho** (W/H, modo W/H fixo/hug/fill com rótulo, tamanhos prontos) e **Aparência** (opacidade, mistura, cantos, cortar conteúdo, máscara). "Criar componente" foi para o fim (componente principal/instância continua no topo). Desfoques com o nome da propriedade (`filter: blur`, `backdrop-filter`).

---

## [0.8.4] — 2026-10-07 — Arrastar para dentro de auto layout

3º relato do teste real (print): "o retângulo e a bordinha de redimensionar estão ligados, porém separados".

### Corrigido
- **Desenho e alças da seleção separados** depois de arrastar uma camada de fora para dentro de um frame com auto layout. Durante o arrasto em auto layout, o app desloca o desenho com CSS `translate` (o "fantasma" que segue o mouse) e nunca o limpava ao soltar; quando a camada não era redesenhada do zero, o deslocamento ficava para sempre. Agora é limpo ao soltar e quando a camada sai do auto layout no meio do arrasto.
- **Frame alto e vazio + `Shift+A` virava linha**: agora vira coluna (uma sidebar vazia), como já acontecia com um filho só.
- **Cinza sobre cinza ao arrastar**: a cor que o app escolheu sozinho (e que você nunca mexeu) se ajusta quando a camada vai para um fundo da mesma cor. Cor escolhida por você nunca é alterada.


### Adicionado (editor de código)
- 5 verificações em `tests/e2e/auto-layout-intencao.mjs` com o caso relatado.

---

## [0.8.3] — 2026-10-07 — Desenhar dentro de auto layout

2º relato do teste real: "a caixa de seleção fica num lugar e o retângulo em outro" ao desenhar dentro da sidebar.

### Corrigido
- **Forma desenhada dentro de um frame com auto layout ia para o FIM da fila** já durante o desenho, longe do mouse (a caixa de seleção e o retângulo apareciam em lugares diferentes). Agora ela fica sob o mouse enquanto você arrasta e, ao soltar, entra na fila **na posição onde foi desenhada**. Vale para retângulo, elipse, frame e linha; texto entra onde você clicou.
- **Nomes repetidos** ("Retângulo 4" duas vezes): o nome novo agora usa o maior número existente + 1.


### Adicionado (editor de código)
- 5 verificações em `tests/e2e/auto-layout-intencao.mjs` (desenhar entre itens, texto entre itens, nome único) e 1 teste unitário de nomes.

---

## [0.8.2] — 2026-10-07 — Auto layout que entende a intenção

Relatado no primeiro teste real: "desenhei um retângulo grande (sidebar) e um pequeno em cima; ao ligar o auto layout, o pequeno ia mudando de lugar".

### Corrigido
- **`Shift+A` com um retângulo de fundo e itens em cima** punha o fundo e os itens lado a lado (o item "pulava" e transbordava). Agora o retângulo de baixo **vira o frame** (cor, cantos, contorno, sombra) e os itens entram nele, no mesmo lugar.
- **`Shift+A` num grupo** embrulhava o grupo inteiro como um item só; agora o grupo vira o frame.
- **`Shift+A` num retângulo sozinho** o embrulhava num frame inútil; agora o retângulo vira um frame com auto layout (mesmo id; `Ctrl+Z` desfaz).
- A dedução do auto layout transformava o espaço livre em padding gigante (ex.: 520 px embaixo de um item no topo de uma sidebar), espremendo os itens seguintes; agora detecta conteúdo centralizado/no fim e mantém o espaço livre como espaço livre. Sidebar alta com um item vira coluna.
- Frame criado em volta de camadas soltas agora abraça o conteúdo (hug): nada transborda.
- **Formas nasciam invisíveis** (cinza sobre cinza, frame branco dentro de frame branco, texto preto sobre fundo escuro); agora nascem num tom que contrasta com o que está embaixo do cursor.


### Adicionado (editor de código)
- `tests/e2e/auto-layout-intencao.mjs` (16 verificações) reproduz o caso relatado.

---

## [0.8.1] — 2026-10-07 — SVG do Figma e do Illustrator


### Adicionado (editor de código)
- **Sombras do Figma** (o filtro que ele exporta, inclusive várias sombras com spread) e `<feDropShadow>` viram sombras de verdade ao importar SVG.
- **Nomes de fonte do Illustrator** ("Poppins-Bold", "OpenSans-SemiBoldItalic", "ArialMT") viram família + peso + itálico.
- O aviso da importação diz **o que** ficou de fora ("sombra interna", "máscara", "imagem"...) em vez de só quantos.
- `tests/fixtures/figma-export.svg` e `illustrator-export.svg` (estrutura igual à desses programas) com 8 verificações no navegador; 1 teste unitário de nomes de fonte.

### Corrigido
- `Esc` não fechava a página inicial com o foco na busca (achado e corrigido pelo Codex no teste em Windows).

---

## [0.8.0] — 2026-10-07 — SVG editável, ícones do Google e Google Fonts


### Adicionado (editor de código)
- **Importar SVG como vetores editáveis**: arrastar/abrir um `.svg` ou colar SVG como texto (Figma "Copiar como SVG", sites de ícones). Suporta `path` (M L H V C S Q T A Z, absolutos e relativos; arcos e quadráticas viram cúbicas), `rect` (cantos arredondados), `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text` simples, grupos, `transform`, `viewBox`, `<use>`, estilos herdados, `<style>` por classe/tag/id, cores com nome e gradientes. O que não é suportado é ignorado e contado num aviso.
- **Vetores com vários contornos e furos** (`contours` + `fillRule: 'evenodd'`), desenhados no canvas, na máscara e no SVG exportado.
- **Aba Ícones** com os **4.299 Material Symbols** do Google: busca (inglês e palavras comuns em português), estilo contorno/arredondado/reto, preenchido, cor e tamanho; insere como vetor (dentro do frame selecionado).
- **Google Fonts**: seletor com **1.908 fontes** + as do sistema, busca, categorias, prévia de cada fonte, teclado (↑/↓/Enter/Esc). Fontes baixadas sob demanda (ao abrir o projeto e ao usar); pesos limitados aos que a fonte tem; HTML exportado leva o `<link>`.
- `scripts/gerar-listas-google.mjs` (atualiza as listas em `src/data/`); testes `svgimport.test.js` (13), `fonts.test.js` (5) e `tests/e2e/svg-icones-fontes.mjs` (26 verificações); capturas 16 e 17.

### Corrigido
- Com 3 abas, o painel esquerdo ficava mais largo que o espaço e rolava para o lado ao focar um campo. Agora as abas são compactas e, em painéis estreitos, mostram só o texto.

---

## [0.7.0] — 2026-10-07 — Página inicial e polimentos


### Adicionado (editor de código)
- **Página inicial** com os seus projetos: "continuar de onde parou" (miniatura ao vivo e onde está salvo), projetos da pasta com **miniaturas**, busca (`/`), ordenação, menu ⋯ (abrir, renomear, duplicar, versões) e cards dos exemplos. Abre ao iniciar (configurável) e pelo logo do editor ou Arquivo → Página inicial.
- **Miniaturas**: geradas a partir do exportador SVG depois de salvar na pasta (no máximo 1 a cada 15 s) e servidas com política que bloqueia scripts.
- **Renomear e duplicar** projetos da pasta (versões e miniatura vão junto ao renomear).
- **Recentes** no menu Arquivo (os 5 últimos projetos da pasta).
- **Lembrete** "este projeto ainda não tem arquivo", uma vez por projeto, com botão Salvar na pasta.
- Configurações → **Ao abrir o app**: página inicial ou direto no editor.
- `tests/e2e/pagina-inicial.mjs` (33 verificações) e testes da API para miniatura e renomear.

### Alterado
- **Janelas do app no lugar de `confirm()`, `prompt()` e `alert()`** do navegador (trocar de projeto, conflito, substituir arquivo, excluir/renomear página, estilos de cor/texto). A pergunta de conflito ganhou 3 opções: substituir, salvar com outro nome ou cancelar.
- Trocar de projeto só pergunta quando algo se perderia; exemplos e projetos em branco não editados trocam direto.
- O logo do topo virou botão para a página inicial.
- Botões desabilitados ficam visivelmente apagados.

### Corrigido
- **Abrir um projeto pela janela Projetos (ou abrir uma versão antiga) substituía sem perguntar** um projeto que só existia no navegador, que se perdia.
- Com uma janela aberta (Configurações, Projetos...), `Delete`, `Ctrl+V` e outros atalhos do canvas ainda agiam nas camadas escondidas atrás dela.
- Em palcos estreitos (~1100 px de janela), o controle de zoom cobria o fim da barra de ferramentas.

---

## [0.6.0] — 2026-10-07 — Salvamento na pasta do computador


### Adicionado (editor de código)
- **Salvar numa pasta do computador.** O `server.js` ganhou uma API (`/api`) que grava os projetos como arquivos `.json` numa pasta escolhida por você. Com o projeto ligado a um arquivo, **cada mudança é gravada lá sozinha**.
  - `Ctrl+S` na 1ª vez pede o nome; `Ctrl+Shift+S` salva com outro nome; `Ctrl+O` abre da pasta.
  - **Versões antigas** de cada projeto (no máximo uma a cada 10 min, até 20 por padrão), que podem ser abertas na janela Projetos.
  - **Proteção contra conflito**: se o arquivo mudar fora do editor (outra aba, outro computador pelo Drive), o app para de gravar nele e pergunta antes de substituir.
  - Gravação atômica (arquivo temporário + renomear).
- **Janela Configurações** (engrenagem no topo, `Ctrl+,`): pasta de projetos (com instruções para Google Drive/OneDrive/Dropbox), auto-salvar na pasta, nº de versões, espaço usado no navegador, proteção contra limpeza automática, tema e roda do mouse.
- **Janela Projetos na pasta**: salvar como, lista com data e tamanho, abrir e versões.
- Indicador do topo mostra **onde** está salvo: *Salvo na pasta*, *Salvo no navegador*, *Só no navegador* (servidor desligado) ou *Conflito no arquivo*. Clicar nele abre as Configurações.
- **Acessibilidade**: menus por teclado (`↑`/`↓`/`Home`/`End`, `Esc` devolve o foco), janelas modais com foco preso e `role="dialog"`, `aria-label` em botões só com ícone, `aria-pressed` nas ferramentas, `aria-selected` nas abas, contorno de foco visível.
- Testes: `tests/api.test.js` (API numa pasta temporária: gravar/ler, conflito, versões, segurança) e `tests/e2e/salvar-pasta.mjs` (40 verificações no navegador).
- Capturas `13-configuracoes-salvamento` e `14-projetos-na-pasta`.

### Alterado
- **Cópia no navegador agora usa IndexedDB** em vez de `localStorage`: acaba o limite de ~5 MB (testado com projeto de 8 MB). Projetos antigos são **migrados sozinhos** na primeira abertura.
- Arquivo: "Abrir arquivo" virou **Importar arquivo .json** e "Salvar projeto" virou **Baixar cópia (.json)**; `Ctrl+S`/`Ctrl+O` passaram a usar a pasta (sem servidor, `Ctrl+S` continua baixando o `.json`).
- Trocar de projeto (novo, exemplo, importar) avisa quando o projeto atual só existe no navegador.
- A preferência "roda do mouse dá zoom" agora é lembrada.

### Corrigido
- Versões guardadas no mesmo segundo se sobrescreviam (achado pelo teste da API).
- Ao recarregar a página, o editor podia acusar "conflito" com o próprio arquivo (a gravação feita ao fechar a aba chegava à pasta, mas não à cópia do navegador).

### Segurança
- A API só aceita pedidos de `localhost` (cabeçalho `Host`, contra *DNS rebinding*), exige `Content-Type: application/json` e `Origin` local para gravar (um site aberto em outra aba não consegue mandar o servidor gravar), e só aceita nomes de arquivo `[a-z0-9._-].json`.

---

## [0.5.1] — 2026-10-07 — Correções do Windows e dos testes

### Corrigido
- **Tela em branco no Windows**: o servidor comparava caminhos com `/`, mas no Windows o separador é `\`; `/src/main.js` e o CSS davam 404. Achado numa revisão feita em Windows + Chrome.
- Suítes de navegador agora **saem com código ≠ 0 quando falham** (antes só imprimiam `FAIL`, e o CI poderia ficar verde).
- Arquivos temporários dos testes usam `os.tmpdir()` (funcionam no Windows).
- Servidor distingue arquivo inexistente (404) de erro interno (500, com log).

### Alterado
- Medição de desempenho separa o tempo do *handler* do app (p95 ≈ 7 ms com 400 camadas) da latência da automação.


### Adicionado (editor de código)
- `tests/server.test.js` (assets 200; `package.json`, `.git`, traversal 404), `npm run test:e2e` e `npm run test:all`.

---

## [0.5.0] — 2026-10-07

Documentação completa, capturas de tela e correções achadas ao fotografar o produto.


### Adicionado (editor de código)
- **Novo projeto de exemplo "app mobile"** (Arquivo → *Exemplo: app mobile*): tela de carteira digital que mostra **CSS Grid**, **componente com 4 instâncias** (texto/ícone sobrescritos), **estilos de cor e texto** ligados a camadas e **protótipo navegável** (Enviar → Sucesso → Voltar). O exemplo antigo virou *Exemplo: landing page*.
- **12 capturas de tela** do produto em `docs/screenshots/` e o script que as gera (`scripts/gerar-capturas.mjs`).
- `CONTRIBUTING.md` com a **convenção de commits** (Conventional Commits em português), estilo de código e checklist de PR.
- `docs/ARQUITETURA.md`: modelo de dados campo a campo, ciclo de uma mudança, algoritmos (gestos, instâncias, exportação) e guia para estender o editor.
- Teste unitário do novo exemplo (instâncias, estilos e destinos de interação).

### Corrigido
- **Seta do protótipo** fazia um laço atravessando o desenho quando o destino ficava à esquerda; agora sai e entra pelos lados certos (direita↔esquerda ou vertical).
- **Campo hex da cor da sombra** aparecia vazio (colapsava a 0 px) na seção Efeitos.
- **Painel Código** cortava linhas longas de CSS na lateral; agora quebram.
- **Etiqueta de tamanho** sobrepunha o número da medida ao segurar `Alt`.
- **Lista de atalhos** do app estava incompleta (faltavam `Ctrl+A`, `Ctrl+Alt+G`, `Ctrl+Alt+Enter`, zoom por teclado, `Ctrl+S/O`, `?`).

### Documentação
- **Todo o código-fonte comentado em português** (cabeçalho de cada arquivo, JSDoc nas funções e o *porquê* das decisões). Nenhuma linha de lógica foi alterada: o diff dos commits `docs(...)` contém só comentários.
- `README.md` reescrito: galeria com imagens, passo a passo para iniciantes, referência de funcionalidades, tabela de atalhos, desempenho medido e limitações.

---

## [0.4.0] — 2026-10-06 — Usabilidade e desempenho

### Desempenho
- Arrastar com **400 camadas**: de ~150 ms para ~20 ms por movimento (1000 camadas: de 350 ms para ~33 ms). Causas corrigidas: o painel de camadas se reconstruía a cada movimento e o índice interno era refeito mesmo quando só um valor mudava.


### Adicionado (editor de código)
- **Camadas**: começam recolhidas (abrem o caminho da seleção sozinhas), `Shift`+clique seleciona intervalo, `Alt`+clique na setinha abre/fecha tudo, busca por nome, menu da página (renomear, **duplicar**, excluir).
- **Seleção**: `Ctrl`+clique atravessa grupos, `Tab`/`Shift+Tab` percorrem camadas, **X/Y/W/H do conjunto** para várias camadas.
- **Medidas**: segurar `Alt` sobre outra camada mostra as distâncias.
- **Propriedades**: `Ctrl+Alt+C/V` copia/cola só a aparência; `Ctrl+V` com um frame selecionado cola **dentro** dele; `Ctrl+B/I/U` na edição de texto.
- **Auto layout**: matriz 3×3 de alinhamento, padding horizontal/vertical (ou por lado).
- **Texto**: MAIÚSCULAS/minúsculas e alinhamento vertical na caixa.
- Atalhos de cores já usadas no projeto, **grade de pixels** (≥ 800% de zoom), painéis **redimensionáveis** e **modo foco** (`Ctrl+\`), indicador *Salvo*, aviso amigável em erros inesperados, **exportar todos os frames**, desagrupar frames.

### Corrigido
- Padding aparecia como `[object HTMLDivElement]` no painel.

---

## [0.3.0] — 2026-10-06 — Protótipo e SVG


### Adicionado (editor de código)
- **Protótipo**: aba com interações (ao clicar / ao passar o mouse → navegar, voltar, abrir link), **transições** (dissolver e deslizar), ponto de partida do fluxo, **setas de fluxo** no canvas e modo **Apresentar** em tela cheia (`Ctrl+Alt+Enter`).
- **Exportação SVG vetorial** (formas, textos, gradientes, sombras, máscaras, vetores).
- `Ctrl+Alt+G` envolve a seleção em um frame.
- Testes de navegador (`tests/e2e/`) e unitários do SVG.

---

## [0.2.0] — 2026-10-06 — Layout, vetores e biblioteca


### Adicionado (editor de código)
- **CSS Grid** como modo de auto layout (colunas, linhas, gaps, `span` por item).
- **Constraints** dos filhos ao redimensionar frames; travar proporção; espelhar.
- **Vetores**: ferramentas **Linha**, **Polígono**, **Estrela** e **Caneta** (curvas de Bézier, edição de pontos e alças).
- **Componentes** com instâncias e sobrescritas; **estilos** compartilhados de cor e de texto (aba **Recursos**).
- **Máscara** (`clip-path`), **grades de layout**, presets de tamanho de frame (iPhone, Android, iPad, Desktop, A4, Story...).
- **Réguas** e **guias** arrastáveis, com *snap*.

### Corrigido
- Duplo clique não funcionava (alvo do evento com *pointer capture*): afetava editar texto e renomear frames.
- Objeto "pulava" ao ser arrastado de um frame para outro (as alças da seleção atrapalhavam a detecção do frame de destino).

---

## [0.1.0] — 2026-10-06 — Primeira versão


### Adicionado (editor de código)
- Editor local em JavaScript puro, com canvas em **HTML/CSS real**.
- Ferramentas Mover, Frame, Retângulo, Elipse, Texto, Imagem e Mão.
- **Auto layout em flexbox** (direção, gap, padding, justify, align, wrap) e tamanhos fixo/hug/fill.
- Camadas (arrastar para reordenar/aninhar), páginas, grupos, alinhar/distribuir, desfazer/refazer.
- Preenchimentos (sólido, gradientes, imagem), contorno, sombras, blur, `backdrop-filter`, `mix-blend-mode`.
- Aba **Código** (CSS/HTML real), exportação PNG/HTML e arquivo de projeto `.json`.
- Salvamento automático no navegador, tema claro/escuro, projeto de exemplo.
