# Prompts prontos para outras IAs

Cole o bloco inteiro na IA indicada e traga a resposta. Eu trato a resposta como a de qualquer subagente: confiro antes de usar. Nenhuma delas precisa de acesso ao código, exceto a IA C.

## IA A — Marca e licenças (precisa de busca na web)
```
Você é um pesquisador cuidadoso. Não dê aconselhamento jurídico; reporte fatos com link e data de consulta.
Contexto: estou lançando no GitHub uma ferramenta gratuita e local de design chamada "Stylo" (editor onde o canvas é CSS real; usada por designers e por agentes de IA). Quero saber se o nome tem conflito.
Tarefas:
1. Procure o nome "Stylo" e variações ("Stylo Designer", "StyloDesigner") em: INPI (Brasil, classes 9 e 42), EUIPO, USPTO, WIPO Global Brand Database, GitHub, npm, PyPI, App Store, Google Play, Product Hunt e domínios .com/.dev/.app.
2. Liste produtos de software com nome igual ou muito parecido em design, desenvolvimento web ou IA. Para cada um: nome, dono, categoria, link, risco de confusão (baixo/médio/alto) com motivo em 1 frase.
3. Sugira 5 nomes alternativos curtos que estejam livres nesses mesmos lugares, com a evidência da checagem.
4. Licenças: o app carrega Google Fonts por CDN, usa Material Icons (google/material-design-icons) e permite fotos do Pexels e do Openverse. Para cada um, diga a licença, se exige atribuição em projeto de código aberto MIT e o texto mínimo de atribuição recomendado.
Formato: tabelas em Markdown + uma seção "Riscos" com no máximo 5 itens ordenados. Diga explicitamente o que você NÃO conseguiu verificar.
```

## IA B — Direção de marca e design (só direção, sem imagens genéricas)
```
Você é diretor de arte de ferramentas de produtividade. Responda em Markdown.
Produto: "Stylo", editor de design local e gratuito onde cada camada é HTML/CSS de verdade. Público: web designers, devs e quem valida o que agentes de IA constroem. A interface deve ser sóbria, densa e profissional, com identidade própria, e NÃO pode parecer gerada por IA.
Restrições obrigatórias: temas claro e escuro; contraste mínimo WCAG AA (4,5:1 texto, 3:1 componentes); um único acento de cor; sem gradiente roxo ou azul-padrão, sem brilhos/glow, sem cartões idênticos em fileira, sem ícones em quadrados arredondados com sombra colorida; raios de canto só 2, 4 e 6 px; tipografia com licença aberta (OFL ou Apache) disponível no Google Fonts.
Entregue 3 direções distintas. Para cada uma: nome da direção; ideia em 2 frases; paleta com hex para os dois temas (fundo, painel, borda, texto, texto secundário, acento, perigo, sucesso, aviso); par tipográfico (interface e código) com pesos usados; descrição precisa do logo em SVG (formas, proporções, construção geométrica, sem clichês de "raio", "pincel" ou "varinha"); como ficam o estado vazio e o foco do teclado; 3 referências de produtos reais (nome e o que observar).
Depois recomende UMA direção com o motivo e aponte o maior risco dela. Não calcule contraste de memória: indique os pares que eu devo medir.
```

## IA C — Revisão cruzada de segurança (cole o diff das etapas S3 e S4 depois que eu avisar)
```
Você é revisor de segurança de aplicações Node.js locais. Abaixo está um diff de um servidor HTTP que escuta apenas em 127.0.0.1 e expõe: API de projetos, API de agentes e um servidor MCP. Ameaça considerada: outra página web ou outro programa local tentando chamar a API; clientes MCP não confiáveis; arquivos .json de terceiros.
Revise SEM ver nenhuma explicação do autor. Liste apenas problemas que você consegue demonstrar com um pedido HTTP ou um arquivo concreto. Para cada um: severidade, arquivo:linha, passo a passo para reproduzir, correção em 1 frase. Depois liste 3 testes automatizados que faltam. Se não achar nada, diga o que verificou.
[COLE O DIFF AQUI]
```

## IA D — Mercado e posicionamento (precisa de busca na web)
```
Pesquise como um analista de produto, com links. Produto: "Stylo", editor de design gratuito e local (sem conta), onde o canvas é HTML/CSS real, com auto layout em flexbox/grid, responsivo por breakpoints, exportação de site multipágina, servidor MCP para Claude Code/Codex e assistente de IA próprio.
1. Compare com Figma, Penpot, Framer, Webflow, Onlook, Plasmic, Builder.io, Subframe e dois concorrentes que você achar: o que cada um faz melhor, preço, local ou nuvem, se tem MCP/agentes, se exporta código limpo.
2. Quais 5 recursos os usuários desses produtos mais pedem ou mais reclamam (cite fontes: fóruns, issues, avaliações)?
3. Que lacuna real um editor local com CSS de verdade e agentes preenche? Dê um veredito honesto: quem usaria, para quê, e o que impediria alguém de trocar de ferramenta.
4. Quais 5 funções tornariam a interface mais agradável de usar (atalhos, feedback, microinterações, onboarding), com exemplos reais de produtos.
Formato: tabela de comparação, depois "Veredito" em até 10 linhas, depois "5 apostas" ordenadas por impacto. Marque o que for inferência.
```
