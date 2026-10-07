# Relatório de erros e melhorias — Projeto Designer

**Revisão:** 6 de outubro de 2026
**Ambiente verificado:** Windows, Node.js 24.19.0, Chrome, servidor local
**Escopo:** inicialização, entrega de arquivos, fluxos principais do editor, erros do navegador e desempenho com projeto sintético.

## Erros encontrados

### 1. Tela em branco no Windows — corrigido

**Severidade:** alta (impedia usar o editor neste ambiente).

O servidor respondia `200` para `/`, mas `404` para `/src/main.js` e `/src/styles/app.css`. Sem o JavaScript e o CSS, o navegador mostrava uma página em branco.

**Causa:** a validação da lista de arquivos permitidos comparava caminhos com `/`, mas no Windows o caminho relativo usava `\`. A página inicial não revelava o problema porque seu caminho não incluía uma subpasta.

**Correção:** normalizar os separadores do caminho relativo antes da validação e manter a rejeição de caminhos fora da pasta servida. Foi acrescentado um teste HTTP que verifica o carregamento dos assets e bloqueia acesso a `package.json`, `.git` e caminhos de traversal.

### 2. Testes E2E podiam terminar com sucesso apesar de falhas — corrigido

Os cenários imprimiam `FAIL`, mas nem todos propagavam a falha para o código de saída do processo. Isso podia fazer o terminal ou uma integração de CI parecerem verdes mesmo quando uma verificação falhava.

**Correção:** os cenários agora definem código de saída não zero quando há asserções falhas ou erros no navegador. Um runner executa os nove cenários e propaga o resultado geral.

### 3. Medição anterior de desempenho misturava custos diferentes — corrigido

A medição original cronometrava cada movimento do mouse pela API de automação. Esse tempo inclui a ida e volta do Playwright e não representa somente o processamento do editor.

**Correção:** o cenário passou a medir separadamente o tempo do handler de `pointermove` e a latência de automação. O critério de desempenho agora é aplicado ao handler do app.

### 4. Caminhos temporários dos testes não eram portáveis — corrigido

Alguns cenários usavam caminhos temporários específicos de Unix, incompatíveis com a execução no Windows.

**Correção:** os arquivos temporários agora usam diretório temporário e caminhos da plataforma via APIs do Node.js.

## Melhorias recomendadas

Estas são oportunidades para próximas revisões; não foram reproduzidas como falhas nos cenários executados.

1. **Compatibilidade:** rodar os fluxos de navegador em Firefox, WebKit e Chromium/Linux. A execução desta revisão cobriu Chrome no Windows.
2. **Acessibilidade:** verificar uso por teclado sem mouse, nomes acessíveis, foco, contraste e leitores de tela.
3. **Responsividade:** avaliar painéis e canvas em celular, tablet e janelas estreitas.
4. **Escala e persistência:** testar projetos maiores, muitas páginas e restauração de projetos após reiniciar o navegador.
5. **Diagnóstico do servidor:** adicionar um teste que simule erro de leitura/permissão e confirme a resposta `500` e o registro no console; o servidor já distingue esses erros de arquivos inexistentes.

## Verificações executadas

- `npm run test:all`: **31 testes unitários/HTTP aprovados** e **9 cenários E2E aprovados**.
- A interface carregou; os fluxos cobriram desenho, seleção, atalhos, propriedades, camadas e painéis, salvamento, protótipo, vetores, componentes, Grid e exportação.
- Teste HTTP: `/`, `/src/main.js` e `/src/styles/app.css` responderam `200`; arquivos privados e traversal foram rejeitados.
- Desempenho com 400 camadas: handler de movimento p95 de **11,8 ms** na execução integrada final; a seleção de 50 camadas apareceu corretamente na lista.
- Os cenários executados não registraram erros inesperados no console do navegador.

Os testes automatizados exercitam a interface real no Chrome, com interações de mouse e teclado. Eles não substituem testes com pessoas, leitores de tela ou a matriz de navegadores e dispositivos recomendada acima.
