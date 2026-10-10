# Roteiro de aceite humano

## Estado

Este roteiro ainda não foi executado por uma pessoa. Os E2Es automatizados passaram e houve uma inspeção visual pontual do editor no Chromium, mas isso não substitui uso exploratório e julgamento de usabilidade. Marque cada caso com resultado, navegador/versão, data e observações antes de considerar o Stylo pronto para uso geral.

| Resultado | Interpretação |
|---|---|
| `[ ]` | Não executado |
| `[x]` | Executado e aprovado pela pessoa que testou |
| `[!]` | Executado, com problema registrado |

## 0. O que mudou na versão estável: teste isto primeiro

Em ordem de importância. Marque o que passou e anote o que estranhou (o que não bate com o que está escrito aqui é bug ou texto confuso).

- [ ] **Não perder trabalho**: edite o projeto, **feche a aba sem salvar** e reabra; as edições devem estar lá. Depois desligue o servidor (`Ctrl+C` no terminal do `npm start`), edite, tente **abrir outro projeto da pasta**: deve avisar que o atual não foi salvo e **manter** o atual aberto.
- [ ] **Projeto de terceiros**: abra `tests/fixtures/projeto-hostil.json` (Arquivo → Importar arquivo .json…). Deve abrir com um aviso ("Abri o projeto com ajustes..."), sem erro, sem nada estranho no console (F12) e **sem requisição para `rastreador.invalid`** na aba Rede, exceto a do CSS da página, que é avisada. Exporte o HTML dela e confira que não há `<script>`.
- [ ] **Servidor só atende a própria página**: com o Stylo aberto, rode em outro terminal `curl -X PUT http://localhost:5173/api/agent/mcp -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d "{\"admin\":true}"`; deve responder **403**.
- [ ] **MCP continua funcionando** com o seu Claude Code e o seu Codex (conectar, listar ferramentas, criar uma camada, aprovar a janela de permissão). A origem exata só recusa páginas de outra porta; clientes sem `Origin` seguem aceitos.
- [ ] **Exportar site**: use "Exportar site completo (.zip)" com uma tela de largura fixa (900 px) e sem "Largura fluida": deve aparecer o aviso dizendo que ela vai rolar na horizontal no celular. Ligue a opção e confira.
- [ ] **PNG de camada de código**: crie uma camada "Código HTML" com `<br>`, uma imagem e `&copy;`, exporte PNG; deve gerar a imagem (antes dava "Não foi possível renderizar").
- [ ] **CSS da página responsivo no canvas**: escreva `@media (max-width: 500px) { .titulo { color: red } }` na aba Código → chip Página e crie uma tela de 400 px com uma camada "Título"; a regra deve valer **no canvas** mesmo com a janela grande (e não valer numa tela de 800 px).
- [ ] **Editor de código em tela cheia**: `Ctrl+Shift+M` (o F11 agora é do navegador).
- [ ] **Interface**: compare `docs/screenshots/identidade/antes-*` e `depois-*` e use o app por 15 minutos nos dois temas. O que ficou melhor? O que ficou pior ou apertado (texto de 11 px, foco do teclado)?
- [ ] **Marca**: escolha a paleta e o símbolo em `docs/estado/MARCA.md` (olhe as capturas `marca-*.png`).
- [ ] **Codex como colega**: `/codex:review` num diff pequeno e `/codex:rescue` numa tarefa trivial; confira se responde.

## 1. Primeiro uso e trabalho humano

- [ ] Abrir o Stylo sem instruções e verificar se a pessoa encontra como começar, abrir um exemplo e criar um projeto.
- [ ] Criar uma tela do zero usando ferramentas de desenho, texto, frames e auto layout; verificar se nomes e controles fazem sentido sem conhecer CSS.
- [ ] Editar a mesma tela pelo painel e pela aba Código; comparar o resultado no canvas e desfazer/refazer alterações.
- [ ] Salvar na pasta, recarregar, abrir o projeto e conferir camadas, estilos, comentários, assets e preferências relevantes.
- [ ] Testar salvar como, duplicar, renomear e exportar JSON; conferir mensagens de salvamento e conflitos.
- [ ] Observar se a hierarquia visual e as opções de design ajudam a sair de composições genéricas. Registrar onde o app induz repetição ou exige conhecimento prévio.

## 2. Projetos com várias páginas e exportação

- [ ] Criar pelo menos três pranchetas/páginas, ligar navegação entre elas e exportar o site completo em ZIP.
- [ ] Extrair o ZIP e abrir `index.html`; seguir links locais para as demais páginas e testar voltar/avançar.
- [ ] Abrir a exportação sem rede e com rede; registrar quais fontes e assets dependem de rede.
- [ ] Testar texto longo, imagens, SVG, formulários, links externos e navegação por teclado no site exportado.
- [ ] Confirmar com a pessoa que a saída é HTML estático: interações do modo Apresentar e JavaScript arbitrário não são exportados; não é um projeto React/Vite.
- [ ] Abrir a exportação em pelo menos dois navegadores desktop e um navegador móvel; anotar diferenças de fonte, animação e layout.

## 3. Responsividade e direção visual

- [ ] Revisar editor e exportação em 1440, 1024, 768, 390 e 320 px; verificar rolagem horizontal, texto cortado, controles inacessíveis e áreas de toque.
- [ ] Repetir em tema claro e escuro, com zoom do navegador a 100% e 200%.
- [ ] Testar páginas longas, grids, navegação, imagens, cabeçalhos fixos, sombras, blur, gradientes, `:hover`, `:focus-visible`, transições e `@keyframes`.
- [ ] Validar animações com `prefers-reduced-motion` ligado; conferir se a pessoa entende quando uma animação só existe no editor ou na exportação.
- [ ] Usar a reprodução Linear documentada como referência e avaliar tipografia, conteúdo, posição, movimento e versão mobile. A cópia atual é conhecida por cortar o mobile e omitir conteúdo; confirmar e registrar a prioridade da correção.
- [ ] Pedir a uma pessoa de design para avaliar consistência, contraste, escala tipográfica, espaçamento, ícones e sensação de produto profissional; separar gosto pessoal de defeito observável.

## 4. Acessibilidade e uso por teclado

- [ ] Percorrer a página inicial, editor, menus, diálogos, apresentação e exportação sem mouse, usando Tab, Shift+Tab, setas, Enter e Escape.
- [ ] Verificar foco visível, ordem de foco, retorno do foco após fechar diálogos, nomes acessíveis e estado selecionado das abas.
- [ ] Usar leitor de tela em pelo menos um sistema; conferir rótulos de ferramentas, painéis, camadas, comentários, erros e estado de salvamento.
- [ ] Testar alto contraste/cores de sistema e zoom de texto, além de movimento reduzido.

## 5. Salvamento, conflito e recuperação

- [ ] Em duas abas do mesmo navegador, editar o mesmo projeto em ambas, salvar alternadamente e conferir que o dado mais novo não é sobrescrito silenciosamente.
- [ ] Recuperar o rascunho de conflito, salvá-lo como cópia, fechar a aba original, abrir a cópia em outra aba e confirmar a identidade e o conteúdo.
- [ ] Fechar/reabrir o navegador, reiniciar o servidor e testar armazenamento indisponível ou cheio; confirmar mensagens e recuperação compreensíveis.
- [ ] Abrir cópias antigas e apagar uma cópia local; confirmar que o projeto ativo não pode ser removido por engano.

## 6. MCP e colaboração entre pessoas e agentes

- [ ] Conectar dois clientes MCP reais e confirmar nomes, presença, travas, permissões, cancelamento, encerramento e limpeza de sessões.
- [ ] Abrir duas abas de projeto, selecionar explicitamente cada editor e confirmar que leituras e gravações não atravessam documentos. Testar também o roteamento padrão à aba conectada mais recente.
- [ ] Simular duas pessoas e dois agentes em abas diferentes; editar enquanto uma chamada lenta está pendente e confirmar que a edição humana não se perde.
- [ ] Testar operações com acesso normal, aprovação recusada, aprovação concedida e Acesso de administrador; confirmar quais ações cada papel pode fazer.
- [ ] Verificar se comentários são suficientes para revisão. Não presumir que sejam chat: o produto ainda não oferece conversa direta entre agentes MCP.
- [ ] Testar a recuperação após o cliente ou servidor MCP cair e voltar. A expiração de sessão de 10 minutos precisa de validação com espera real.

## 7. Agentes, provedores e uso para vibe coding

- [ ] Pedir a um agente para criar um site de várias páginas a partir de um briefing com identidade visual, público e restrições; observar se ele consulta o documento, constrói em blocos, usa `get_image` e corrige o resultado.
- [ ] Repetir com um agente externo via MCP e com o Assistente interno; avaliar se as instruções e habilidades recebidas são claras e se o resultado evita padrões genéricos.
- [ ] Confirmar se um agente consegue trabalhar enquanto uma pessoa edita; registrar conflitos, latência, mensagens e ações de recuperação.
- [ ] Validar NVIDIA NIM, DeepSeek e Ollama com configurações reais, incluindo suporte a ferramentas, streaming, cancelamento e modelos sem chamadas de ferramenta. Não usar credenciais de produção sem um responsável.
- [ ] Testar API real de geração/edição de imagem; conferir custo, tempo, falhas, limite de tamanho, chave no servidor e recuperação de respostas atrasadas.

## 8. CSS, HTML, JavaScript e 3D

- [ ] Comparar efeitos CSS no canvas, Apresentar e HTML exportado: sombras, blur, máscaras, blend modes, filtros, gradientes, transformações, perspectiva, `preserve-3d` e animações.
- [ ] Testar HTML semântico e etiquetas permitidas com conteúdo real, incluindo links e controles de formulário.
- [ ] Confirmar que scripts importados e atributos de evento são removidos; verificar quais comportamentos exigem JavaScript próprio fora do Stylo.
- [ ] Confirmar que WebGL/canvas 3D não é um recurso visual de edição; CSS 3D não equivale a uma ferramenta de cena 3D.
- [ ] Fazer um teste exploratório com um site de referência independente e registrar conteúdo ausente, diferenças de fonte, responsividade, animação e acessibilidade.

## 9. Desempenho e validação

- [ ] Usar um computador de desempenho médio e um dispositivo móvel real para mover, selecionar e editar um projeto grande; observar travamentos, memória e aquecimento.
- [ ] Medir carga e navegação da exportação em rede lenta, cache frio e cache quente; comparar com `docs/benchmarks/carga-exportada.md`.
- [ ] Validar links locais, HTML, CSS e acessibilidade com ferramentas de navegador; conferir os avisos do Stylo e distinguir falsos positivos.
- [ ] Anotar versão do navegador, dispositivo, passos, resultado esperado/observado, captura e severidade para cada defeito encontrado.

## Registro de execução

| Pessoa | Data | Navegador/dispositivo | Seções executadas | Resultado e defeitos |
|---|---|---|---|---|
|  |  |  |  |  |
