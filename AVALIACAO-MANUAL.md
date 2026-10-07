# Avaliação manual — Projeto Designer

Data: 2026-10-06
Ambiente: Windows, Node.js v24.19.0, Chrome, execução local com `npm start`.

## Nota

**8/10 na experiência funcional exercitada neste ambiente.** A tela em branco foi corrigida e os principais fluxos do editor passaram nos testes de navegador. A nota considera a ampla cobertura funcional verificada e desconta limitações ainda não avaliadas, como outros navegadores, dispositivos móveis, acessibilidade e uso prolongado com projetos grandes.

## Problemas reproduzidos

### P1 — Servidor não entrega os módulos e estilos no Windows

**Impacto:** o HTML abre, mas o JavaScript que monta a interface e a folha de estilos recebem 404. O usuário vê uma página totalmente branca e não consegue usar o editor.

**Reprodução original:**

1. No Windows, execute `npm start`.
2. Abra `http://localhost:5173/`.
3. A página principal responde 200, mas `/src/main.js` e `/src/styles/app.css` respondem 404.

**Causa:** em `server.js`, `path.resolve`/`path.join` usam separadores nativos do Windows. `rel` ficava com `\`, enquanto a checagem da allowlist exigia prefixos com `/` (`rel.startsWith(a + '/')`). A página raiz passava porque seu caminho relativo não inclui um diretório.

**Correção aplicada:** `server.js` normaliza os separadores antes de validar a allowlist, mantendo a proteção contra traversal. Um teste HTTP automatizado verifica os módulos e estilos servidos, arquivos privados bloqueados e caminhos de traversal rejeitados.

**Status:** corrigido e verificado no Windows. `GET /src/main.js` e `GET /src/styles/app.css` retornam 200.

## Avaliação dos fluxos

- Inicialização via `npm start`: **aprovada**; HTML, JavaScript e CSS carregam no navegador.
- Desenho, seleção, propriedades, exportação, persistência, protótipo, componentes, vetores, painéis e atalhos: **aprovados** nos nove cenários E2E.
- `npm test`: **31 passaram, 0 falharam**, incluindo regressão HTTP do servidor.
- `npm run test:e2e`: **9 cenários passaram, 0 falharam**, executados no Chrome em Windows.
- Desempenho: com 400 camadas, o handler de `pointermove` mediu p95 de **11,8 ms** na execução integrada final; seleção de 50 camadas refletiu corretamente na lista.

## Melhorias recomendadas

1. **Matriz de navegadores e plataformas:** os fluxos E2E foram executados em Chrome no Windows; repetir em Chromium/Linux e Firefox/WebKit.
2. **Acessibilidade e responsividade:** revisar navegação por leitor de tela, contraste e telas móveis/tablets.
3. **Projetos maiores e uso prolongado:** ampliar cenários para arquivos grandes, muitas páginas e restauração após reiniciar o navegador.
4. ~~Diagnóstico do servidor~~ — resolvido: arquivo inexistente responde 404; qualquer outra falha responde 500 e é logada.

## Evidências

- Antes da correção: `GET /` 200; `GET /src/main.js` e `GET /src/styles/app.css` 404.
- Após a correção: assets 200; traversal e arquivos privados bloqueados.
- `npm test`: 31/31 aprovados; `npm run test:e2e`: 9/9 cenários aprovados.
- Desempenho observado em Chrome/Windows: 400 camadas, handler p95 11,8 ms na execução integrada final.
