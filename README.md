# Stylo

**Stylo é um "Figma" para agentes de IA e pessoas desenharem sites e aplicativos juntos.** O desenho é CSS de verdade: cada camada vira HTML/CSS, frames com layout viram `flex`/`grid`, e o que aparece no editor é exatamente o que sai na exportação.

Um servidor local fica ligado. Pessoas editam num **painel web**; agentes (Claude Code, Codex, Cursor...) conectam pelo **MCP** e usam as **mesmas ferramentas** do painel: criam telas, enxergam o resultado (imagem), conferem problemas e exportam.

> **Versão `v0.1.0` (alpha).** Funciona de ponta a ponta no seu computador, mas é um alpha: há lacunas (veja [O que falta](#o-que-falta)) e a interface ainda será refinada. Não é pronto para hospedagem pública.

---

## Sumário

1. [Começar](#começar)
2. [Usar o painel](#usar-o-painel)
3. [Conectar um agente (MCP)](#conectar-um-agente-mcp)
4. [O que já funciona](#o-que-já-funciona)
5. [O que falta](#o-que-falta)
6. [O que ainda precisa ser testado](#o-que-ainda-precisa-ser-testado)
7. [Banco de dados: PGlite ou PostgreSQL](#banco-de-dados-pglite-ou-postgresql)
8. [Painel de administração](#painel-de-administração)
9. [Configuração](#configuração)
10. [Arquitetura](#arquitetura)
11. [Desenvolvimento e testes](#desenvolvimento-e-testes)
12. [Licença](#licença)

---

## Começar

Requer **Node.js 22 ou mais novo**.

```bash
git clone https://github.com/Kaykygnb/StyloDesigner.git
cd StyloDesigner
npm install
npm start
```

Abra **http://localhost:5173/studio/** (a raiz `/` já redireciona para lá).

- O banco é criado sozinho na pasta `designer.db/` (PGlite, sem instalar nada).
- O modo padrão é **local, sem login**. Para exigir contas e senha: `STYLO_AUTH=accounts npm start`.
- **Chromium (opcional, mas recomendado):** medidas reais, a imagem da tela (`get_image`), a auditoria de vazamento e a edição de fotos usam um navegador. Se você já tem um, aponte: `STYLO_CHROMIUM_PATH=/caminho/chrome`. Se não, `npx playwright install chromium`. Sem navegador, essas ferramentas avisam e o resto funciona.
- Por padrão o servidor escuta na rede local (`0.0.0.0`). Para ficar só neste computador: `STYLO_HOST=127.0.0.1`.

Para uma versão compilada do painel: `npm run build` (sem isso, o painel é compilado na hora, o que é suficiente para uso local).

## Usar o painel

- **Projetos:** criar, buscar, importar/exportar JSON, miniaturas. Há um comando pronto para conectar um agente.
- **Canvas:** zoom e movimento livres (`Ctrl`+roda, `Espaço`+arrastar), réguas e guias, encaixe magnético (Ctrl desliga), medidas com `Alt`, seleção por caixa, giro, alças de tamanho, arrastar para dentro/fora de frames e reordenar em layouts flex.
- **Ferramentas (barra inferior):** mover, mão, frame, seção, retângulo, elipse, linha, polígono, estrela, texto, **caneta** (`P`: clique = ponto, arrastar = curva, clicar no primeiro ponto fecha, Enter termina), **lápis** (traço livre), editar nós (`N`), comentar, inspecionar e imagem. Clique simples cria no tamanho padrão; arrastar desenha. Com um vetor selecionado aparece uma barra com inverter direção, simplificar, arredondar cantos e converter contorno em forma; com duas ou mais camadas, as operações booleanas.
- **Esquerda:** camadas (busca, renomear, esconder, travar, arrastar para reordenar), páginas, **Recursos** (fotos, imagens do projeto, componentes, estilos, variáveis, modos de cor, paletas) e **Ícones** (Material e Lucide).
- **Direita:** **Design** (posição, tamanho, auto layout flex/grid, aparência, preenchimento com cor/gradiente/imagem, contorno, sombras e filtros, texto, restrições, responsivo por breakpoint, estados hover/foco/ativo, interações), **Protótipo**, **Código** (CSS/HTML reais da seleção, editáveis), **Comentários**, **Inspecionar**, **Problemas** (conferência do design), **Agentes** (quem está conectado e o que fez), **Histórico** (versões, comparar, duplicar, restaurar) e **Exportar**.
- **Topo:** desfazer/refazer, Desktop/Tablet/Celular, Conferir, Apresentar (protótipo clicável), Publicar e Exportar. Tema claro/escuro, cor de destaque e idioma (pt-BR/en-US) são preferências suas e não entram no projeto.
- **Atalhos:** pressione `?` no editor. Principais: `V F R E L T P N C I H`, `Ctrl+Z/Shift+Z`, `Ctrl+D`, `Ctrl+G`, `Ctrl+C/V`, `0–9` (opacidade), `Shift+A` (auto layout), `Shift+1/2/0` (zoom), `Ctrl+Alt+Enter` (apresentar).
- **Botão direito:** menu completo na camada ou no canvas (copiar/colar, duplicar, agrupar, componente, máscara, ordem, travar, espelhar, copiar CSS...).

## Conectar um agente (MCP)

Com o servidor rodando, no Claude Code:

```bash
claude mcp add --transport http stylo http://localhost:5173/mcp
```

Outros clientes que falem MCP por HTTP também funcionam (o fluxo foi validado com o cliente oficial do SDK MCP; **não foi validado individualmente em Codex, Cursor, Kimi ou OpenCode**). Em modo `accounts`, cadastre o agente em **Administração → Agentes** e use o token Bearer gerado. As instruções entregues ao agente estão em `apps/server/src/instrucoes-agente.txt`.

Fluxo recomendado: **buscar → ler só o trecho necessário → ajustar → conferir**. Exemplos: `find_layers` (busca compacta), `inspect_layout` (medidas reais em texto), `get_image` (imagem da tela), `check_design` (problemas), `update_layers` (até 100 camadas num passo de desfazer).

### Ferramentas (120 anunciadas)

| Grupo | Ferramentas |
|---|---|
| Projeto e páginas | abrir/criar/salvar projeto, páginas, brief, notas, comentários, atividade, desfazer/refazer |
| Criar e editar camadas | `build_layout`, `create_layer`, `update_layer(s)`, `move_layer(s)`, `delete_layers`, duplicar, agrupar, alinhar/distribuir, reordenar, `find_layers`, `get_layer`, `set_responsive`, `set_state`, `set_layer_css`, `set_project_css` |
| Ver e conferir | `get_image`, `inspect_layout`, `check_design`, `get_code` |
| Vetores e SVG | `import_svg`, `audit_svg`, `create_vector_network`, `edit_vector_node`, `edit_vector_shape`, `reverse_vector`, `split_vector_contour`, `join_vector_contours`, `simplify_vector`, `offset_path`, `stroke_to_path`, `set_path_effect`, `interpolate_vectors`, `shape_builder`, booleanas |
| Identidade e tokens | estilos de cor/texto/sombra/gradiente, modos de cor, variáveis, componentes, `export_tokens` (CSS/JSON/Tailwind) |
| Plugins | identidade (paletas, contraste, harmonias, escalas, pares de fontes, brief), assets (Openverse, Pexels, Pixabay, Poly Pizza, Material, Lucide, Fontsource, biblioteca da conta, fontes próprias), acessibilidade, Tailwind, SEO/metadados, QR Code |
| Exportar | site HTML (.zip), projeto React + Vite (.zip), tokens |

As ferramentas alteram o **documento de design**; elas não criam backend, pagamento ou login do site exportado.

## O que já funciona

Verificado por testes automáticos (`npm test`: 600+ testes) e por revisão manual no navegador:

- Criar/abrir/importar/exportar projetos; salvar no banco; versões e restauração; miniaturas.
- Editor visual completo (canvas, camadas, propriedades, auto layout flex/grid, responsivo por breakpoint, estados, componentes, máscaras, booleanas).
- Caneta, lápis, edição de nós e barra de vetor; importar SVG.
- Painel de código (ver e editar CSS/HTML reais), CSS da página, comentários com respostas, protótipo e modo Apresentar.
- Colaboração ao vivo: o que um agente altera aparece sozinho no painel; bloqueios por camada evitam que dois editem o mesmo item.
- Exportação: site HTML, React/Vite e tokens.
- Contas, papéis, tokens de agentes com escopos, biblioteca de arquivos da conta, plugins (ativar/desativar/diagnosticar), backups do banco, painel de administração.
- Interface em português e inglês.

## O que falta

Itens conhecidos que **ainda não existem** (ou estão incompletos) neste alpha:

- Barra do topo: menu **Arquivo** (renomear, salvar como, abrir exemplo), **editor de breakpoints** e **troca do modo de cor** com prévia ao vivo.
- Editor de código grande embaixo do canvas (hoje o código é editado na aba **Código**); sem autocompletar nem Emmet.
- **Pinos de comentário** desenhados no canvas (os comentários existem e ficam na aba).
- Edição vetorial: sem botão para o **Shape Builder** nem para dividir/unir contornos na barra (as ferramentas MCP existem); sem editor visual de alças com teclado completo.
- Editar foto pela interface ("Editar foto…" ainda é só placeholder; `edit_image` existe pelo MCP).
- `generate_image_edit` (edição generativa) não está disponível pelo MCP do servidor.
- QR Code e ferramentas de cor só pelo agente, sem botão no editor.
- Negrito/itálico/sublinhado (`Ctrl+B/I/U`) enquanto edita texto.
- Layout para celular do próprio painel: funciona, mas é secundário; o foco é desktop.
- Hospedagem pública, cobrança, app desktop (Electron): fora do escopo da base.

## O que ainda precisa ser testado

- **PostgreSQL de verdade** (`DATABASE_URL`): suportado no código, mas **nunca rodado contra um Postgres real**; os testes usam PGlite.
- **Provedores com chave real** (Pexels, Pixabay, Poly Pizza): o código existe, mas nunca foi executado com chave verdadeira. Openverse, Material, Lucide e Fontsource funcionam sem chave.
- **Clientes MCP** além do SDK oficial (Codex, Cursor, Kimi, OpenCode).
- **Acesso pela rede local com login** em vários dispositivos, e telas pequenas/toque.
- Projetos grandes (milhares de camadas) e desempenho do painel com muitas telas.
- Navegadores além do Chromium/Chrome.

## Banco de dados: PGlite ou PostgreSQL

Decisão para o alpha: **PGlite continua sendo o padrão.** É um Postgres completo rodando dentro do Node: nada para instalar, os dados ficam na pasta `designer.db/`, serve para uma pessoa (e uma equipe pequena na rede local) e roda em qualquer sistema.

**PostgreSQL** (`DATABASE_URL=postgres://...`) fica como opção para quem quiser um servidor compartilhado, backup externo ou volume maior. Ele usa o mesmo esquema (Prisma, mesmas migrações), então migrar é possível, mas isso **ainda não foi testado** (veja acima). Recomendação: manter PGlite no alpha e validar o Postgres antes de prometê-lo na beta.

Os dados do alpha devem ser tratados como **descartáveis**: o formato pode mudar entre versões `0.x`. Antes de migrações o servidor copia o banco para `designer.db.before-migrations-*` (pasta ignorada pelo git; pode apagar quando quiser). **Administração → Backups** cria cópias manuais.

## Painel de administração

Existe e **deve existir**, com escopos diferentes por modo:

- **Modo local (padrão):** útil para quem usa sozinho: saúde do servidor e do banco, endereços da rede local com QR Code, atividade global, backups, plugins e provedores de assets (ativar, diagnosticar, chaves), biblioteca. Contas ficam ocultas porque não há login.
- **Modo `accounts`:** acrescenta usuários (criar, papéis OWNER/ADMIN/EDITOR/COMMENTER/VIEWER, senha temporária, suspender, revogar sessões), agentes MCP (tokens, escopos, aprovação, revogação, atividade) e o guia de conexão por cliente.

Foi verificado por teste de ponta a ponta (`npm run test:e2e`, que precisa de um servidor em `STYLO_AUTH=accounts` em `APP_URL`).

## Configuração

Variáveis de ambiente:

| Variável | Para quê |
|---|---|
| `PORT` | Porta do servidor (padrão `5173`). |
| `STYLO_HOST` | `127.0.0.1` para escutar só neste computador; senão `0.0.0.0`. |
| `STYLO_AUTH` | `local` (sem login, padrão) ou `accounts` (contas e senha). |
| `DESIGNER_DB_DIR` | Pasta do PGlite (padrão `designer.db`; `memory` para testes). |
| `DATABASE_URL` | Usa PostgreSQL em vez do PGlite (não testado). |
| `DESIGNER_CONFIG` | Arquivo de configuração (padrão `designer.config.json`). |
| `STYLO_SECRET_KEY` | Chave (base64, 32 bytes) que protege segredos guardados; se ausente, é criada em `designer.secret`. |
| `STYLO_BLOB_DIR` | Onde ficam os arquivos enviados (padrão `designer.blobs/`). |
| `STYLO_LIBRARY_QUOTA_MB` | Limite da biblioteca por conta (padrão 2048). |
| `STYLO_CHROMIUM_PATH` | Navegador para imagens e medidas. |
| `PEXELS_API_KEY` | Chave opcional do Pexels. |
| `STYLO_DEV` | `1` força o painel em modo desenvolvimento (Vite) mesmo havendo `dist`. |

`designer.db/`, `designer.secret`, `designer.blobs/` e `designer.config.json` ficam no `.gitignore`: **nunca os envie ao GitHub**.

## Arquitetura

Monorepo npm (workspaces):

```
apps/server     Hono + MCP: API, MCP (HTTP e stdio), presença ao vivo, contas, entrega do painel
apps/studio     Painel web (React 19 + TypeScript + Vite), servido em /studio/
packages/core   Documento, comandos, CSS/HTML/SVG, exportação, auditorias e as ferramentas MCP
packages/db     Prisma + PGlite/Postgres (esquema e migrações)
packages/plugins Plugins embutidos (identidade, assets, acessibilidade, Tailwind, SEO, QR)
tests/          Testes (node:test) e o e2e do painel de administração
```

Princípios: **o painel nunca altera o documento diretamente** — toda ação é uma chamada de ferramenta do MCP (`/api/studio/call`), então pessoa e agente produzem o mesmo resultado; o canvas é o HTML exportado num `iframe` sem scripts (`sandbox="allow-same-origin"`); o que entra (HTML/CSS) nunca é confiável; plugins só calculam e sugerem.

## Desenvolvimento e testes

```bash
npm run typecheck   # tipos de todos os pacotes
npm test            # suíte completa (inclui um teste de interface com Chromium; é pulado se não houver navegador)
npm run test:e2e    # administração, contra um servidor em STYLO_AUTH=accounts
npm run build       # compila o painel para produção
```

Dica para testar o painel por script: o mouse **nativo** do Playwright apertado sobre o `iframe` derruba o Chromium automatizado; simule arrastos com eventos enviados por script, como em `tests/studio-ui.test.js`.

## Licença

MIT (ver `LICENSE` e `NOTICE`, com as licenças de terceiros). A licença definitiva do projeto ainda será decidida.
