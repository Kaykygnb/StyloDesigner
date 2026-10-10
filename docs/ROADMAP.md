# Planejamento do Stylo

O que já foi feito, o que está em andamento e o que vem depois. `[x]` = pronto e verificado; `[ ]` = a fazer. Os itens com número de issue estão abertos para contribuição: veja [como contribuir](../CONTRIBUTING.md).

As prioridades foram decididas com ajuda do [Jev](https://typesafe.ai) (decisões tipadas com probabilidade) e o trabalho foi feito em frentes paralelas: o Claude (Claude Code) e subagentes, e o Codex numa frente separada, sempre com revisão e a bateria completa de testes antes de juntar.

---

## Auditoria local em andamento — 9 de outubro de 2026

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

## Fase 0 — Base (até a v0.17)

- [x] Canvas que é HTML/CSS real: frames, formas, texto, imagens, caneta Bézier, grupos e máscaras
- [x] Auto layout em flexbox e CSS Grid, tamanho fixo/hug/fill, limites e proporção
- [x] Responsivo com `@media`, modos de cor (claro/escuro), estilos de cor e de texto, variáveis de tamanho
- [x] Estados (hover, pressionado, foco) com transição; protótipo com interações entre telas
- [x] Exportação de HTML e CSS fiéis ao editor; PNG e SVG
- [x] Projetos salvos numa pasta, com versões; página inicial com miniaturas
- [x] Comentários e notas; Inspecionar (estilo F12); réguas e guias
- [x] Assistente de IA (OpenAI, NVIDIA NIM, Ollama) e servidor MCP (Claude Code, Codex)

## Fase 1 — Base profissional (v1.0 "Stylo")

- [x] Novo nome e identidade: **Stylo**, logo própria, tokens de cor grafite + azul, IBM Plex Sans
- [x] Central de ajuda (primeiros passos, atalhos, problemas comuns, suporte com diagnóstico)
- [x] Configurações como página própria (sem modal), detalhes técnicos atrás do "i"
- [x] Conta local guardada pelo servidor (nome, e-mail, cargo, foto, cor) e avatar no topo
- [x] Painel Design redesenhado; seletor de estilo de cor; seletor de cor com paletas embaixo
- [x] Apresentar = navegador de verdade (iframe com o HTML exportado, larguras, voltar/avançar)
- [x] Breakpoints por projeto: presets (1280, 1024, 768, 640, 380) e personalizados
- [x] Biblioteca de componentes com miniaturas, usos, busca e arrastar; camadas com ícone de layout
- [x] CSS: `position: sticky`, `pointer-events`, `order`, `flex-shrink`, `white-space`, `word-break`, `text-wrap`, `skew` e **CSS livre** por camada
- [x] Código à mão: CSS da camada, CSS da página (`@media`, `:hover`, `@keyframes`) e camada "Código HTML" sanitizada
- [x] Mais HTML: atributos (id, classes, aria-label, role, target…) e etiquetas (figure, blockquote, time, code…)
- [x] Inspecionar com box model, CSS computado e regras que se aplicam
- [x] Caneta completa: edição de pontos, canto↔curva, tipos de alça, lápis, contorno (tracejado, pontas, quinas), booleanas
- [x] Ímã inteligente na caneta (guias, pontos e camadas) e réguas ligadas por padrão
- [x] Editor de código grande (embaixo do canvas, tela cheia, prévia ao vivo) com autocomplete de CSS/HTML e Emmet

## Fase 2 — Agente de verdade

- [x] Aba própria do Agente: conversas por projeto, troca de modelo, memória do projeto (`remember`)
- [x] Streaming: texto em tempo real, raciocínio recolhível, tempo limite e Parar
- [x] Menos raciocínio na NVIDIA NIM por família de modelo; "Testar modelo" (tempo e ferramentas)
- [x] Subagentes em paralelo (`delegate_task`) com travas por camada
- [x] Jev para o agente (`jev_choose`, `jev_score`, `jev_check`) com a chave guardada no servidor
- [x] MCP com vários agentes ao mesmo tempo: sessão e nome por conexão, presença e travas durante a operação + 10 s
- [ ] Mapear quais modelos da NIM aceitam ferramentas e respeitam "pensar menos" — [#6](https://github.com/Kaykygnb/StyloDesigner/issues/6)

## Fase 3 — Fotos e IA de foto

- [x] Fotos grátis na aba Recursos: Openverse (sem chave) e Pexels (com chave), crédito do autor na exportação
- [x] Editor de imagem local: recorte, ajustes, filtros, remover fundo (automático, varinha, pincel), tamanho e formato
- [x] IA generativa de foto: preencher área, trocar objeto, expandir (API de imagem do provedor)
- [x] Ferramentas do agente `edit_image` e `generate_image_edit`
- [ ] Testar a IA generativa com uma API real — [#5](https://github.com/Kaykygnb/StyloDesigner/issues/5)
- [ ] Remover fundo para fundos complexos (modelo no navegador) — [#7](https://github.com/Kaykygnb/StyloDesigner/issues/7)
- [ ] Girar imagem em ângulo livre — [#8](https://github.com/Kaykygnb/StyloDesigner/issues/8)
- [ ] Limitar o download da imagem gerada sem tamanho informado — [#2](https://github.com/Kaykygnb/StyloDesigner/issues/2)
- [ ] Assets privados por conta (uploads de cada pessoa e dos agentes dela) e grupos de assets

## Correções de qualidade já feitas

- [x] Conflito ao salvar detectado também em discos exFAT/FAT (compara o conteúdo, não só a data)
- [x] Painel Design volta a funcionar depois de editar o CSS à mão
- [x] Traço padrão visível no canvas escuro e em fundo branco
- [x] Baixador de fotos só aceita bitmaps (SVG poderia carregar script) e licenças com derivação permitida

## Próximos passos (a fazer)

### Editor e CSS
- [ ] Booleanas não destrutivas e com texto/grupos — [#9](https://github.com/Kaykygnb/StyloDesigner/issues/9)
- [x] `@media` do CSS da página no canvas pela largura da tela desenhada (container query) — [#10](https://github.com/Kaykygnb/StyloDesigner/issues/10)
- [ ] Fotos exportadas como `<img>` de verdade — [#11](https://github.com/Kaykygnb/StyloDesigner/issues/11)
- [ ] Limite de quina no contorno — [#3](https://github.com/Kaykygnb/StyloDesigner/issues/3)
- [ ] Unidades além de px (`%`, `rem`, `vw`, `calc()`) direto nos campos do painel
- [ ] Variantes de componente
- [ ] Mais de um preenchimento/contorno por camada

### Interface
- [ ] Revisar as telas novas no tema claro — [#15](https://github.com/Kaykygnb/StyloDesigner/issues/15)
- [ ] Menus sem caixa alta e limpeza do CSS antigo — [#4](https://github.com/Kaykygnb/StyloDesigner/issues/4)
- [x] Tela cheia do editor de código agora é Ctrl+Shift+M (F11 é do navegador) — [#14](https://github.com/Kaykygnb/StyloDesigner/issues/14)
- [ ] Interface em inglês (i18n) — [#12](https://github.com/Kaykygnb/StyloDesigner/issues/12)

### Colaboração
- [ ] Edição em tempo real entre pessoas — [#13](https://github.com/Kaykygnb/StyloDesigner/issues/13)
- [ ] Plugins / extensões próprias
- [ ] Roteamento MCP determinístico por projeto/aba, inclusive quando clientes não chamam `select_editor`

### Exportação e provedores de IA
- [ ] Exportação responsiva: remover a raiz fixa de 1440 px e validar larguras mobile/tablet
- [ ] Repetir o benchmark Linear depois das correções, comparando regiões dinâmicas separadamente
- [ ] Avaliar provedores OpenAI compatíveis: NVIDIA NIM, DeepSeek e Ollama

---

Tem uma ideia que não está aqui? Abra uma [sugestão](https://github.com/Kaykygnb/StyloDesigner/issues/new/choose).
