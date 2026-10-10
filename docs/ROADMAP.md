# Planejamento do Stylo

O que já foi feito, o que está em andamento e o que vem depois. `[x]` = pronto e verificado; `[ ]` = a fazer. Os itens com número de issue estão abertos para contribuição: veja [como contribuir](../CONTRIBUTING.md).

As prioridades foram decididas com ajuda do [Jev](https://typesafe.ai) (decisões tipadas com probabilidade) e o trabalho foi feito em frentes paralelas: o Claude (Claude Code) e subagentes, e o Codex numa frente separada, sempre com revisão e a bateria completa de testes antes de juntar.

---

## Estado atual

O registro detalhado da auditoria de 9 de outubro de 2026 (MCP, colaboração, exportação, benchmark Linear) está no [CHANGELOG](../CHANGELOG.md#auditoria-local--9-de-outubro-de-2026). O andamento da versão estável (etapas, testes e decisões) está em [`docs/estado/`](estado/LEDGER.md).

---

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
