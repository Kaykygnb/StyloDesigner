# Plano A — Estabilidade

Só correções e verificações. Nenhuma mudança visual.

1. **Zoom não reajusta ao redimensionar a janela** enquanto o projeto está "novo" (`view.fresh`): abrir o editor numa janela pequena e ampliá-la deixa o conteúdo em ~2% até `Shift+1`. Não ocorre com a janela já grande. Baixa prioridade; reproduzir e, se confirmado, refazer o ajuste no `resize` (`src/main.js`).
2. [#14](https://github.com/Kaykygnb/StyloDesigner/issues/14) F11 no editor de código não deve pôr o navegador em tela cheia.
3. [#10](https://github.com/Kaykygnb/StyloDesigner/issues/10) `@media` da página no canvas deve seguir a largura da tela desenhada.
4. Exportação responsiva: remover a raiz fixa de 1440 px e validar 390/768/1440 sem overflow (pendência do benchmark Linear).
5. [#2](https://github.com/Kaykygnb/StyloDesigner/issues/2) Limitar o download de imagem gerada sem tamanho informado (segurança).
6. Desempenho: `desempenho.mjs` oscilou perto do limite (16,6 ms vs 16). Tornar a medição robusta (mediana de N execuções), sem afrouxar o limite.
7. Roteamento MCP por documento/aba (risco aberto de colaboração): só documentar o comportamento atual na ajuda, sem reescrever agora.

Fora de escopo: colaboração em tempo real (#13), i18n (#12), IA de foto (#5–#8).
Aceite: cada item com teste que falha antes e passa depois; suíte completa verde.
