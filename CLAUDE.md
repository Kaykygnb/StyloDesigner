# Stylo — instruções para agentes (leia antes de editar)

Editor de design local em JavaScript puro (módulos ES, sem build, sem dependências de runtime) onde o canvas é DOM + CSS reais. Branch de trabalho: `feat/versao-estavel` (nunca commitar na `main`).

## Meta permanente (definida pela pessoa em 10/10/2026)
Deixar o Stylo o melhor possível: polido, estável, sem lixo, com identidade própria, pronto para uso padrão e à altura de uma ferramenta que valeria ~US$ 100/mês. Pensar como um time de engenheiros e designers e como um usuário humano (testar fluxos reais, estranhar o que for confuso). Economizar tokens: leituras pontuais, relatórios curtos, trabalho mecânico para o Codex (modelo e esforço por `docs/estado/CODEX.md`), `codex exec` ou OpenCode só quando fizer sentido, Jev para decidir dúvidas pequenas.
Autonomia: commits locais na branch de trabalho; **sem push, sem merge, sem apagar dados do usuário**; parar nos portões humanos do `PLANO-MESTRE.md` e registrar em `PENDENTE-HUMANO.md`.

## Time e papéis (definidos pela pessoa)
- **Claude (eu) = engenheiro sênior e dono do resultado**: decide, integra, confere e fala com a pessoa.
- **Codex = colega sênior e assistente direto** (plugin `codex@openai-codex`, ver `docs/estado/CODEX.md`): segunda opinião, revisão independente, tarefas mecânicas, deliberação de decisões difíceis; pode criar os próprios subagentes se o pedido disser. A palavra final é minha e a divergência relevante vai para `DECISOES.md`.
- **Subagentes Claude = plenos**: tarefas fechadas com pedido completo; eu confiro o diff, nunca o relato.
- **Jev decide as dúvidas pequenas, inclusive sobre o navegador**: perguntas pequenas em inglês, em lote. Ao usar o navegador (embutido para mim; Codex só se a pessoa permitir), decidir com o Jev se vale a pena (uma checagem visual, um fluxo real) ou se leitura de código/teste basta, para gastar menos.
- **Skills**: engenharia (`testes-primeiro`, `diagnosticar-bugs`, `desenhar-modulos`, `revisar-diff`, `pesquisar`...) para código; `design:design-impecavel` e `prototipar` para qualquer interface (anti "cara de IA"). Escolher pelo classificador do Jev (`classify-skills.mjs`).

## Ordem de leitura
1. `docs/estado/LEDGER.md` — o que já foi feito, como, como foi testado e o que falta. **Atualize ao fim de cada etapa.**
2. `docs/estado/PENDENTE-HUMANO.md` — perguntas abertas para a pessoa; não bloqueie nelas, siga com o que não depende delas.
3. `docs/estado/DECISOES.md` — decisões tomadas (inclui as do Jev) para não reabrir.
4. `docs/ARQUITETURA.md` e `docs/planos/PLANO-ETAPAS.md`.

## Regras de engenharia
- Teste que falha antes, correção mínima, `npm test` verde, depois a suíte E2E relacionada. Um commit por tema, mensagem em português, sem `--no-verify`.
- Núcleo puro (`model`, `css`, `store`, `components`) não toca no DOM; lógica nova entra aí com teste unitário.
- Sem dependências novas e sem build. Não apagar nem sobrescrever projetos do usuário: E2E sempre com servidor isolado (`DESIGNER_CONFIG` temporário, porta 5173).
- Mudanças em `server.js`, persistência e carregamento de `.json` exigem revisão do diff (`revisar-diff`) e vão em `PENDENTE-HUMANO.md` como "revisar".
- `docs/AGENTE.md` é lido pelo servidor em tempo de execução: não renomear nem apagar.
- `docs/REFERENCIA.md` é gerada (`npm run docs`) e testada: regenerar, nunca editar à mão.

## Regras de design (anti "cara de IA")
- Direção: sóbria, densa, identidade própria. Raios 2/4/6 px, sombras neutras e curtas, um único acento, escala tipográfica fixa. Nada de brilho colorido, gradiente decorativo ou cartões idênticos em fileira.
- Só tokens de `:root` em `src/styles/app.css`; sem literais novos de cor, raio, sombra ou tamanho de fonte.
- Toda mudança visual: captura antes/depois nos temas claro e escuro, contraste AA medido, foco visível por teclado.
- Use a skill `design:design-impecavel` em qualquer trabalho de interface.

## Como trabalhar
- Preferir o navegador embutido (barato) para verificar a interface; `get_page_text`/`read_page` antes de screenshots.
- Delegar com `decidir:planejar-subagentes`; perguntas ao Jev pequenas, em inglês, várias por vez. O Jev **julga**, não guarda estado: o estado fica no LEDGER.
- Máximo 4 subagentes em paralelo; nunca dois editando o mesmo arquivo.
