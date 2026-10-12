# Roadmap e estado da v0.1.0 (alpha)

Este documento é a lista honesta do que **existe**, do que **falta** e do que **precisa ser testado**. Os dados do alpha são descartáveis: o formato pode mudar entre versões `0.x`.

## Estado

| Área | Situação |
|---|---|
| Servidor, MCP (HTTP e stdio), 120 ferramentas | Funciona; coberto por testes automáticos |
| Painel web (`/studio/`) | Funciona de ponta a ponta; revisado manualmente; interface ainda será refinada |
| Vetores (caneta, lápis, nós, booleanas, importar SVG) | Funciona |
| Exportação (site HTML, React + Vite, tokens) | Funciona |
| Contas, papéis, tokens de agente, administração | Funciona (e2e de administração) |
| Plugins (identidade, assets, acessibilidade, Tailwind, SEO, QR) | Funciona; provedores com chave nunca rodaram com chave real |
| Banco | PGlite (padrão) funciona; PostgreSQL **não validado** |

## O que falta implementar

**Painel**
- Menu **Arquivo** na barra do topo (renomear projeto, salvar como, abrir exemplo, baixar cópia).
- **Editor de breakpoints** (hoje os tamanhos Tablet/Celular são fixos) e **troca do modo de cor** com prévia ao vivo no canvas.
- Editor de código **grande embaixo do canvas**, com autocompletar e Emmet (hoje o código é editado na aba Código).
- **Pinos de comentário** desenhados sobre o canvas (os comentários existem e ficam na aba).
- Vetores: botão para o **Shape Builder**, para dividir/unir contornos e para a rede vetorial; editor visual de alças com teclado completo.
- **Editar foto pela interface** (recorte, filtros, fundo); hoje só pelo agente (`edit_image`).
- Botões para as ferramentas de **cor** (contraste, harmonias, escalas) e **QR Code**; hoje só pelo agente.
- Negrito/itálico/sublinhado (`Ctrl+B/I/U`) enquanto edita texto.
- Ajuste do zoom ao abrir o editor em telas muito pequenas (celular).

**Servidor e ferramentas**
- `generate_image_edit` (edição generativa de imagem) não está disponível pelo MCP do servidor.
- Unicidade do "ponto de partida do fluxo" só é garantida no cliente.

**Produto (fora do escopo da base)**
- Hospedagem pública, cobrança e versão paga.
- Aplicativo desktop (Electron).
- Licença definitiva (hoje MIT; será decidida).

## O que ainda precisa ser testado

- **PostgreSQL real** (`DATABASE_URL`): suportado no código, nunca rodado contra um Postgres de verdade; os testes usam PGlite. Migrar de PGlite para Postgres também não foi exercitado.
- **Provedores de assets com chave real** (Pexels, Pixabay, Poly Pizza). Openverse, Material, Lucide e Fontsource funcionam sem chave.
- **Clientes MCP** além do SDK oficial: Codex, Cursor, Kimi, OpenCode.
- **Acesso pela rede local com login**, em vários dispositivos, e uso por toque.
- **Projetos grandes** (milhares de camadas) e muitas telas abertas ao mesmo tempo.
- **Navegadores** além do Chromium/Chrome (Firefox e Safari).
- **Atalho `Ctrl+Alt+Enter`** com teclado real em Windows (em teclados com AltGr o sistema pode interceptar); o botão Apresentar funciona sempre.
- Fluxos longos de colaboração: pessoa e agente editando o mesmo projeto por horas.

## Decisões tomadas

- **Banco do alpha: PGlite.** Nada para instalar, funciona em qualquer sistema e serve para uma pessoa ou uma equipe pequena na rede local. PostgreSQL fica como opção documentada até ser validado.
- **Painel único.** O editor antigo em JavaScript puro foi removido; só existe o painel em `apps/studio`.
- **Painel de administração existe e deve existir:** no modo local cobre saúde, rede, backups, plugins e provedores; no modo com contas acrescenta usuários e agentes.
- **Modo padrão com contas e senha**; o modo sem login é só para testes e desenvolvimento.
- **O painel nunca altera o documento diretamente:** tudo passa pelas ferramentas MCP.

## Ideias para depois da alpha

- Validar PostgreSQL e documentar a migração de PGlite para Postgres.
- Teste de interface para a caneta e a edição de nós (hoje verificados por script manual).
- Prévia ao vivo dos modos de cor; biblioteca de componentes compartilhável entre projetos.
- Mais formatos de exportação (por exemplo Vue/Svelte) a partir do mesmo documento.
