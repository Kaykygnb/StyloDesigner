# Como contribuir

Obrigado por querer ajudar! Este guia mostra como rodar o projeto, como escrever código e comentários no estilo daqui e, principalmente, **como escrever mensagens de commit**.

## Índice

1. [Preparando o ambiente](#1-preparando-o-ambiente)
2. [Fluxo de trabalho](#2-fluxo-de-trabalho)
3. [Convenção de commits](#3-convenção-de-commits)
4. [Estilo de código e comentários](#4-estilo-de-código-e-comentários)
5. [Testes](#5-testes)
6. [Checklist antes de abrir um Pull Request](#6-checklist-antes-de-abrir-um-pull-request)

---

## 1. Preparando o ambiente

Você precisa do **Node.js 18+**. Não há dependências para instalar.

```bash
git clone https://github.com/Kaykygnb/projetodesigner2.git
cd projetodesigner2
npm start        # http://localhost:5173
npm test         # testes unitários (sem navegador)
```

Para entender o código antes de mexer, comece pelo [Guia do código](docs/GUIA-DO-CODIGO.md) e depois leia [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) (inclui a seção **"Como estender"** com passo a passo para adicionar propriedades, tipos de camada, atalhos e painéis).

## 2. Fluxo de trabalho

1. Crie uma branch a partir da `main`, com um nome que diga o que faz: `feat/boolean-ops`, `fix/seta-prototipo`, `docs/atalhos`.
2. Faça mudanças **pequenas e focadas**: um assunto por commit.
3. Rode `npm test` (e, se mexeu em interação, os testes de navegador em `tests/e2e/`).
4. Abra um Pull Request descrevendo **o que mudou, por quê** e, se houver mudança visual, **anexe uma captura de tela**.

## 3. Convenção de commits

Seguimos o **[Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/)**, em português. O objetivo é que qualquer pessoa entenda, só lendo o histórico, **o que mudou e por quê**.

### Formato

```text
tipo(escopo): resumo curto no presente

Corpo explicando o que mudou (e por quê, quando não for óbvio).

- Lista do que mudou, arquivo por arquivo quando ajudar.
- Cada item descreve uma mudança concreta.

Verificação: como você confirmou que funciona.

Rodapé (opcional): BREAKING CHANGE, referências a issues, coautores.
```

### Tipos

| Tipo | Use para | Exemplo |
|---|---|---|
| `feat` | Funcionalidade nova para o usuário | `feat(sample): novo exemplo "app mobile"` |
| `fix` | Correção de defeito | `fix(overlay): seta do protótipo escolhe o lado certo` |
| `perf` | Melhoria de desempenho sem mudar o comportamento | `perf(layers): só reconstrói a lista quando a estrutura muda` |
| `refactor` | Reorganização interna sem mudar comportamento | `refactor(tools): extrai a lógica de snap` |
| `docs` | Documentação e comentários | `docs(core): documenta modelo, CSS e store` |
| `test` | Criar ou ajustar testes | `test(css): cobre itens de grid` |
| `style` | Só CSS/visual sem lógica (espaçamento, cor) | `style(ui): aumenta o contraste das alças` |
| `build` / `ci` | Scripts, empacotamento, automações | `ci: roda npm test no GitHub Actions` |
| `chore` | Manutenção que não cabe nos outros | `chore(release): 0.5.0` |

### Escopo (opcional, mas recomendado)
Diz **onde**: `core`, `model`, `css`, `store`, `storage`, `saving`, `server`, `a11y`, `svgimport`, `fonts`, `icons`, `home`, `canvas`, `overlay`, `tools`, `commands`, `pen`, `rulers`, `present`, `svg`, `export`, `sample`, `ui`, `layers`, `props`, `help`, `screenshots`, `readme`...

### Regras do resumo (primeira linha)
- No **presente**, descrevendo o que o commit faz: `corrige`, `adiciona`, `documenta` (e não "corrigido", "adicionei").
- **Até ~72 caracteres**, sem ponto final.
- Em minúsculas depois dos dois-pontos (exceto nomes próprios).
- Diga o **efeito**, não o arquivo: ❌ `fix: muda overlay.js` → ✅ `fix(overlay): seta do protótipo escolhe o lado certo`.

### Corpo: "O que mudou"
Todo commit que não seja trivial deve ter corpo. Padrão que usamos:

```text
fix(ui): campo hex da sombra não colapsa mais

O que mudou (src/styles/app.css):
- .effect-foot agora quebra linha e a linha de cor ocupa a largura toda.
  Antes, com o checkbox "Interna" e o botão de remover na mesma linha, o campo
  hex da cor da sombra encolhia até 0px e ficava vazio.
- .hex ganhou largura mínima de 52px, por segurança.
```

Boas práticas:
- Explique o **problema** (o que estava errado) e a **solução** (o que mudou).
- Se a mudança é só de comentários/documentação, **diga isso** e garanta que nenhuma linha de código mudou (ex.: `git diff` mostrando só comentários).
- Se mudou comportamento visível, cite como verificou (teste, captura de tela).

### Mudanças que quebram compatibilidade
Use `!` depois do tipo/escopo **e** um rodapé `BREAKING CHANGE:` explicando o impacto:

```text
feat(model)!: guarda o contorno como lista

BREAKING CHANGE: `node.stroke` deixa de ser um objeto e passa a ser um array.
Projetos .json antigos são migrados automaticamente ao abrir.
```

### Não faça
- ❌ Mensagens vagas: `ajustes`, `correções`, `wip`, `update`.
- ❌ Misturar assuntos num commit (uma correção de bug + um recurso novo + reformatação).
- ❌ Reescrever o histórico de `main` depois de publicado.

> **Nota sobre o histórico:** os primeiros commits do projeto (anteriores a esta convenção) têm mensagens em formato livre. O [`CHANGELOG.md`](CHANGELOG.md) descreve com precisão o que cada fase trouxe. A partir do commit `docs(core): documenta modelo...` o padrão acima é seguido.

## 4. Estilo de código e comentários

**Código**
- JavaScript puro, módulos ES, **sem dependências** e **sem etapa de build**.
- Toda alteração do documento passa por `store.update(fn)`; ao final de um gesto, um `store.commit()`. Nunca mude uma camada "por fora".
- Lógica que não precisa de DOM fica em módulos **puros** (`model.js`, `css.js`, `components.js`, `svg.js`) e ganha teste.
- Operações que mexem em várias camadas ou na árvore vão para `commands.js`, não direto no atalho de teclado.
- Use `structural: false` em `store.update` **só** quando mudar valores (não inserir/remover/reordenar camadas).

**Comentários** (o projeto é pesadamente comentado de propósito)
- Em **português**.
- Comente o **porquê**, não o óbvio: ❌ `// soma 1 ao contador` → ✅ `// limite de 6px de tela para o snap não "puxar" cedo demais`.
- Todo arquivo começa com um **cabeçalho** (o que é, por que existe, quem usa).
- Toda função exportada tem **JSDoc** (`@param`, `@returns`) quando ajuda a entender.
- Decisões não óbvias (ex.: "usa `outline` e não `border`") ganham um comentário com o motivo.

## 5. Testes

| Tipo | Onde | Como rodar |
|---|---|---|
| **Unitários** (rápidos, sem navegador) | `tests/*.test.js` | `npm test` |
| **Navegador** (opcionais) | `tests/e2e/*.mjs` | veja [`tests/e2e/README.md`](tests/e2e/README.md) |

- Corrigiu um bug? Escreva primeiro o teste que falha, depois a correção.
- Adicionou lógica pura? Teste unitário. Mudou interação (mouse/teclado/painel)? Considere um teste em `tests/e2e/`.
- Mudou o visual? Regenere as capturas com `node scripts/gerar-capturas.mjs` e confira uma a uma.

## 6. Checklist antes de abrir um Pull Request

- [ ] `npm test` passa.
- [ ] Os testes de navegador relacionados passam (se mexeu em interação).
- [ ] Os commits seguem a [convenção](#3-convenção-de-commits) e cada um trata de **um** assunto.
- [ ] Código novo está **comentado** (cabeçalho, JSDoc, decisões não óbvias).
- [ ] Documentação atualizada: comentário `/** ... */` das funções novas/alteradas + `npm run docs` (regenera `docs/REFERENCIA.md`), README (funcionalidade/atalho), `docs/ARQUITETURA.md` (se mudou a estrutura), `CHANGELOG.md`.
- [ ] Atalho novo? Está em `ui/menus.js` (`SHORTCUTS`) e na tabela do README.
- [ ] Mudança visual? Captura de tela no PR.
