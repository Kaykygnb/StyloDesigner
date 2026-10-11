# Stylo

Um "Figma" para **agentes de IA e pessoas** prototiparem e construírem sites e aplicativos juntos. O canvas é CSS de verdade; um servidor
fica ligado e qualquer agente (Claude Code, Codex, Cursor...) trabalha nele pelo **MCP**: cria o projeto, monta as telas, **vê** o resultado,
**audita** (responsivo, contraste, acessibilidade) e **exporta** — zip de HTML, projeto React (Vite) ou tokens do design (CSS/JSON/Tailwind).

Código na branch **`limpeza`** (a `main` é a versão antiga): `git clone -b limpeza https://github.com/Kaykygnb/StyloDesigner.git`

```bash
npm install
npx playwright install chromium     # para o agente "ver" e auditar o design
npm start                           # http://localhost:5173
claude mcp add --transport http stylo http://localhost:5173/mcp
```

## Documentação (leia nesta ordem)
0. **Agente de IA assumindo o projeto?** Comece por [`PROMPT-INICIAL.md`](PROMPT-INICIAL.md) (quem é a pessoa dona, como falar com ela, o que fazer e o que nunca fazer).
1. [`PASSAGEM.md`](PASSAGEM.md) — estado atual, como começar, **decisões que dependem do dono**, próximos passos e o que foi pulado.
2. [`contexto.md`](contexto.md) — o que a ferramenta é, vocabulário, arquitetura, mapa do código e receitas (nova ferramenta, plugin, provedor, exportação, migração).
3. [`decisoes.md`](decisoes.md) — diário de decisões: o que se decidiu e por quê (só se acrescenta no fim).
4. [`NOTICE`](NOTICE) — licenças de terceiros. [`LICENSE`](LICENSE) — hoje MIT; a licença definitiva está em decisão (`PASSAGEM.md`, D1).

Para consultar as capacidades por grupo e as melhorias propostas: [`FERRAMENTAS.md`](FERRAMENTAS.md).

Requer Node ≥ 22. Testes: `npm test` · tipos: `npm run typecheck`.
