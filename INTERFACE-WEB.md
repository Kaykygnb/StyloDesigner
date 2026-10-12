# Estrutura e direção visual do Stylo web

Planejamento iniciado em2026-10-12. Complementa [ACESSO-WEB.md](ACESSO-WEB.md).
Não descreve uma interface implementada nem autoriza alterar apps/web neste bloco.

## 1. O que a pessoa dona quer

- Substituir a experiência visual pouco polida do editor legado.
- Uma ferramenta profissional de design, utilizável manualmente e com agentes.
- Painel de login/gerenciamento e editor com estrutura coerente.
- Escolher uma cor principal pessoal, como destaque discreto da interface; essa escolha não
  recolore toda a aplicação nem modifica os projetos.

A direção abaixo é recomendação técnica e visual para discussão. Telas finais e alcance da
primeira versão ainda serão definidos com a pessoa dona.

## 2. Princípios de interface

A página criada ocupa o centro da atenção. A interface oferece hierarquia, legibilidade,
espaçamento consistente, controles previsíveis e estados claros, sem competir com o conteúdo.
Profissionalismo depende do conjunto: menus, campos, ícones, diálogos, carregamento, erros,
atalhos e salvamento; trocar somente a paleta não resolve a experiência.

Usar superfícies neutras e distinguir regiões com espaçamento/bordas discretas. Aumentar a
clareza tipográfica em relação a uma interface muito densa. Densidade de ferramentas deve
ser adequada a trabalho prolongado, com alvos clicáveis e foco visível. Ícones usam uma família
consistente e ações ambíguas recebem rótulo ou explicação acessível.

Sem escolher biblioteca visual ou fonte definitiva neste documento. Efeitos, animações,
arredondamentos e sombras precisam seguir um sistema e ajudar na orientação.

## 3. Três estruturas relacionadas

| Ambiente | Estrutura proposta | Prioridade |
|---|---|---|
| Acesso | Tela direta de configuração/login, nome da instalação e ajuda necessária | Entrar sem distrações |
| Painel | Barra lateral estável, título da área, ações e conteúdo | Encontrar e administrar trabalho |
| Editor | Barra superior, páginas/camadas à esquerda, página ao centro e propriedades à direita | Criar e revisar |

Mesma família de controles, tipografia, temas e preferências entre os ambientes. O painel não
fica como uma janela sobre o editor; tem navegação e endereço próprios. Projetos abrem seu
ambiente de edição com retorno claro ao painel. URL não concede permissão por si só.

## 4. Painel

Navegação: Projetos, Biblioteca, Conexões MCP; Minha conta e Administração conforme permissão.

Projetos é a entrada principal: pesquisa, ordenação, filtros pessoais/compartilhados, botão
Criar projeto e cartões com miniatura/nome/última alteração. Menus secundários guardam ações
menos frequentes. Visão em lista pode complementar cartões quando houver muitos projetos.
Não ocupar a tela inicial com números decorativos ou gráficos sem utilidade demonstrada.

Conexões MCP explicam acesso e permissões com linguagem humana. Configuração técnica fica
num passo guiado ou detalhe copiável. Administração e segurança não disputam espaço com o
trabalho cotidiano. Biblioteca informa tipo, alcance e créditos dos arquivos disponíveis.

Todo fluxo inclui estado vazio, carregamento, erro, ausência de permissão e sessão expirada.
Mensagens não substituem os dados antigos por uma tela vazia durante uma atualização simples.

## 5. Editor

### Barra superior

Nome do projeto/página, estado de salvamento, desfazer/refazer, acesso à visualização e exportação.
Presença e atividade entram discretamente. Acesso ao painel e configurações é previsível.
Não reunir todas as ferramentas num conjunto de botões permanente.

### Lado esquerdo

Páginas e árvore de camadas. Busca, seleção clara e ações contextuais. Inserção e biblioteca
podem abrir uma área específica sem permanecer todas expandidas. Diferenciar página/tela,
grupo, componente e instância de forma compreensível.

### Centro

Área de trabalho com zoom, deslocamento e contexto de largura/tela. Seleção e guias devem
ser legíveis sem confundir as cores da interface com o conteúdo. Elementos de seleção ficam
fora do documento e não aparecem em exportações ou capturas destinadas à revisão do design.

### Lado direito

Propriedades da seleção, com seções previsíveis e campos consistentes. Exemplos:

- Texto: conteúdo, fonte, peso, tamanho e espaçamento.
- Foto: arquivo, enquadramento, recorte e ajustes.
- Contêiner: fluxo, alinhamento, espaçamento e dimensões.
- Seleção múltipla: propriedades comuns, alinhar, distribuir e agrupar.
- Sem seleção: contexto da página/projeto, sem dezenas de controles desabilitados.

Responsivo e estados explicam onde a mudança vale. Uma edição mobile não deve parecer uma
edição global. Conteúdo técnico como HTML/CSS é acessível sob demanda, com área recolhível;
não precisa consumir a área de trabalho de toda pessoa.

### Agentes e revisão

Área recolhível para atividade, presença, aprovações e problemas encontrados. Uma mudança
do agente é atribuída a ele e pode ser conferida/desfeita dentro das regras do histórico.
Clicar num problema leva à camada. Não exigir chat integrado para conectar um cliente MCP.
Políticas de concorrência/histórico ainda precisam ser resolvidas antes de prometer edição
simultânea independente entre pessoa e agente.

## 6. Cor de destaque pessoal

### Alcance

Preferência da pessoa sobre a interface, não configuração do projeto ou da instalação inteira.
Duas pessoas no mesmo projeto podem ter destaques diferentes e produzir o mesmo arquivo.
Não misturar essa preferência com cor do avatar/presença de colaboradores.

Aplicar em ações principais, item ativo, interruptores ativos, indicadores de seleção da
interface e foco. Destaques suaves podem aparecer no fundo de itens ativos. Guias do canvas
precisam de avaliação própria sobre fundos diversos; não recolorir todas por consequência.

Manter neutros os fundos principais, painéis, tipografia e bordas comuns. Cores semânticas
de erro/aviso/sucesso preservam significado independente da escolha. Conteúdo, estilos de
marca, imagens, variáveis de design, renderização MCP e arquivos exportados não mudam.

### Escolha e temas

Proposta: Configurações → Aparência → tema Claro/Escuro/Sistema e Cor de destaque.
Oferecer paleta curta de opções verificadas e prévia com botão, campo focado e item ativo.
Cor personalizada por seletor/hexadecimal é proposta adicional, não condição para a versão inicial.
Permitir restaurar padrão. Escolha persiste; definir se segue a conta entre dispositivos ou
apenas este navegador. Recomendação: preferência por conta com cache local, quando houver contas.

A cor escolhida pode precisar de variantes por tema: cor de texto/ícone, fundo suave, botão,
hover e foco. Não aplicar o mesmo hexadecimal cegamente em todo lugar. Garantir contraste
adequado no elemento real; o sistema deve ajustar a variante ou explicar uma escolha inválida.
Não usar apenas cor para informar seleção, erro ou estado.

## 7. Sistema visual e implementação futura

Separar variáveis da interface das variáveis dos projetos. Categorias do sistema:

- Superfícies, texto, bordas e sombras.
- Destaque e seus estados/variantes.
- Cores semânticas.
- Tipografia, espaçamento, dimensões e densidade.
- Foco, interação, transições e movimento reduzido.

Componentes reutilizáveis: botão, campo, seletor, aba, menu, diálogo, cartão, lista, tooltip,
notificação e estados vazios/erro. Cada um contempla teclado, foco, hover, pressionado,
desabilitado e carregamento conforme seu papel.

Organizar por áreas pequenas: acesso, painel, projetos, biblioteca, conexões, administração,
editor e componentes comuns. Evitar reproduzir um arquivo central com todas as funções.
Tecnologia e integração seguem a decisão do editor novo; React+Vite é recomendação anterior,
ainda sem decisão final nesta conversa.

## 8. Como escolher a aparência antes de programar

1. Montar mapa das telas e tarefas prioritárias.
2. Criar proposta visual de Projetos, Conexões MCP e Editor com um projeto de exemplo.
3. Mostrar claro/escuro e pelo menos duas cores de destaque na mesma estrutura.
4. Revisar com a pessoa dona a hierarquia, legibilidade e espaço disponível para o trabalho.
5. Definir o sistema visual e o alcance da primeira versão.
6. Implementar e validar fluxos/teclado/permissões/contraste antes de substituir o legado.

Uma referência visual não comprova funcionalidades implementadas. Prototipagem não deve
alterar o editor atual sem autorização para o bloco correspondente.

## 9. Critérios específicos

- Painel e editor têm organização própria e aparência consistente.
- Ferramentas contextuais reduzem controles irrelevantes sem esconder ações essenciais.
- Tema e destaque persistem de acordo com a política definida.
- Alterar destaque não muda documento, estilos, exportações ou preferências de outra pessoa.
- Todas as combinações oferecidas têm foco e texto legíveis nos dois temas.
- Estados não dependem só de cor; interface funciona por teclado.
- Presença, salvamento e atividade mostram dados reais, sem indicar sucesso antes de confirmar.
- O design é revisado visualmente em navegador, inclusive diálogos/erros, antes de declarar polido.

## 10. Estado e limites desta revisão

Conferidos estrutura de main.js, página inicial home.js e variáveis de styles/app.css do legado.
Já existem temas claro/escuro e variáveis accent/primary; isso não comprova preferência pessoal
integrada ou consistência visual. A página inicial atual funciona como camada sobre o editor.
Não foi feita inspeção visual ao vivo nem captura de tela neste bloco: conclusões estruturais
vêm da leitura do código e do relato da pessoa dona. Nenhum arquivo em apps/web foi alterado.
Não rodou nova suíte/typecheck: este bloco é documentação. A última suíte de código permanece555
passando,0 falhas/pulados. Próximo passo sugerido é proposta visual para revisão, sem decisão
implícita de implementação, licença, hospedagem ou negócio.

## Estrutura funcional complementar

[EDITOR-WEB.md](EDITOR-WEB.md) mapeia capacidades para áreas do editor e detalha documento/layout, vínculos, estados, mídia, revisão, entrega e contratos de concorrência. Ainda é planejamento, sem implementação.
