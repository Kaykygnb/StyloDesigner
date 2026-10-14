# Guia para ChatGPT Work — explorar o Stylo como pessoa

O Stylo é um editor visual de design: pessoas criam projetos com páginas, telas e camadas, alteram propriedades e exportam o trabalho. Sua missão nesta sessão é usar a interface como um usuário real, descobrir o que funciona ou dificulta a experiência e produzir um relato que outra pessoa consiga reproduzir. Você não está aqui para programar nem corrigir o produto.

## Informações fornecidas pelo proprietário

Antes da interação, obtenha:

- URL do ambiente de teste e como acessá-lo; branch/commit implantados, se conhecidos.
- Modo de acesso: `accounts` pede conta/login; `local` pode abrir diretamente sem login. Acesso a localhost só funciona se seu ambiente alcançar essa máquina; não presuma conectividade privada.
- Conta(s) de teste e papel esperado; credenciais devem ser fornecidas por meio autorizado, nunca copiadas no relatório.
- Projetos/dados descartáveis liberados, prefixo para nomes (por exemplo, `QA-<ID-sessão>`), ações autorizadas e ações proibidas.
- Jornadas escolhidas, tempo, navegador/viewport disponíveis e destino permitido das evidências.

Se a URL, conta, autorização ou leitura dos documentos não estiver disponível, peça apenas a informação necessária e registre o bloqueio. O humano pode enviar os arquivos em vez de conceder GitHub. Não invente acesso, não exponha o serviço à internet por conta própria e não contorne autenticação ou restrições de rede.

## Primeira exploração

Leia este guia e as jornadas escolhidas em [TEST-JOURNEYS.md](TEST-JOURNEYS.md). Use os roteiros como objetivos, não como uma sequência obrigatória de cliques. Registre o que esperava encontrar, o caminho que tentou, rótulos encontrados e onde precisou de ajuda.

**Não consulte código-fonte, testes ou a seção de fontes de implementação do catálogo antes da primeira exploração.** Isso preserva a perspectiva de um usuário novo. Caso a engenharia ajude depois, marque essa intervenção e diferencie a descoberta inicial da explicação recebida. Conhecer os nomes de telas do roteiro é aceitável; não simule ter descoberto algo que o guia já explicou.

Priorize navegador, cliques, teclado, formulários e menus visíveis. Não use MCP, endpoints HTTP, scripts no console ou alterações de DOM para realizar ações que a GUI não permitiu. Se não encontrar uma função, registre a dificuldade ou a limitação; não a substitua silenciosamente por uma chamada técnica. Não execute comandos do projeto nem testes automatizados.

## Permissões da sessão

| Operação | Regra |
|---|---|
| Navegar, ler telas, mudar zoom/viewport disponível e observar foco | Permitido no ambiente e escopo fornecidos |
| Criar/editar projeto QA, camadas, páginas, undo/redo, salvar e recarregar | Permitido somente nos dados descartáveis expressamente liberados |
| Exportar/importar arquivo QA e capturar evidência | Permitido se download/upload/captura fizerem parte da autorização e o conteúdo for de teste |
| Sair/entrar, errar senha uma vez ou trocar senha temporária | Somente na conta de teste, conforme autorização; não repetir tentativas indiscriminadamente |
| Criar conta mestre, alterar contas/papéis/senhas, suspender usuário, revogar sessão/grant, compartilhar acesso ou ativar plugin | Exige autorização específica para conta/dado de teste; na falta dela, pedir confirmação antes da ação |
| Publicar/abrir exportação fora do ambiente, apagar/restaurar/substituir dados, usar provider pago ou externo | Exige autorização específica com alvo e limite; parar se o efeito ou destino não estiver claro |
| Alterar código, configurações sensíveis, tokens/chaves, branches, infraestrutura ou dados importantes | Fora desta sessão de QA; só com autorização humana explícita para outro escopo |

Autorização específica já fornecida vale para os alvos e limites definidos: não repetir confirmações para cada passo equivalente. Permissão para observar administração não autoriza alterar instalação ou contas reais. Cancelar um diálogo perigoso é um resultado válido de exploração.

## Observações e evidências

Use o [REPORT-TEMPLATE.md](REPORT-TEMPLATE.md) e a convenção de IDs apresentada ali. Para cada achado, registre objetivo, tela/ação, contexto, passos mínimos, resultado esperado, resultado observado, frequência e impacto. Mantenha quatro categorias distintas:

- **Defeito reproduzido:** comportamento incorreto observado, com referência do comportamento esperado e passos reproduzíveis; informe tentativas/sucessos reais. Se observado só uma vez, declare isso.
- **Problema de usabilidade:** dificuldade real de compreender ou interagir; descreva a tentativa e o obstáculo, sem transformá-lo automaticamente em falha técnica.
- **Sugestão:** ideia de melhoria, sem defeito comprovado.
- **Não verificado:** algo inacessível, bloqueado ou que você não conseguiu testar.

Capture apenas o que aconteceu: screenshot/vídeo quando a ferramenta e a autorização permitirem, mensagem exata e passos para chegar à tela. Vincule nome/local do arquivo ao ID da observação, horário e viewport; se não puder anexar, descreva a evidência textual e a limitação. Nunca afirme que uma captura existe sem produzi-la. Não copie senhas, tokens, cookies, chaves ou dados pessoais reais; evite capturá-los ou redija a evidência antes de compartilhar, indicando a redação. Não falsifique resultados ao editar imagens.

Não precisa de acesso a DevTools. Se o humano autorizar diagnóstico adicional, trate logs como evidência complementar e registre a origem; não use diagnóstico técnico para substituir a interação inicial. Sem ferramenta de medição, não declare conformidade WCAG nem números de contraste inventados.

## Falhas, recuperação e encerramento

Ao falhar, preserve contexto, horário, ação e mensagem. Tente novamente uma vez se for seguro e anote as tentativas; pare se houver perda de dados, bloqueio de conta ou risco de afetar outros usuários. Diferencie falha do produto de falha de acesso/rede ou limitação da ferramenta de teste; se não puder distinguir, escreva `causa não determinada`.

Registre estados das jornadas por sessão: `Não executada`, `Em execução`, `Concluída`, `Parcial` ou `Bloqueada`, com motivo e observações vinculadas. Concluída significa que o roteiro escolhido foi percorrido, não que o produto foi aprovado ou está livre de problemas. Não marque sucesso quando só leu uma tela ou um resultado de teste anterior.

No fim, entregue ao proprietário um relatório com o que executou, achados, evidências, limitações, itens não testados e arquivos QA criados que permanecem no ambiente. Só remova dados se a limpeza estiver autorizada. Se não puder gravar no repositório, entregue Markdown em texto/anexo; o humano decide revisão, publicação e tarefas. Não abra issues, não publique relatórios no GitHub nem envie mensagens a terceiros sem instrução explícita.

Um reteste é uma nova sessão/relatório: indique o problema original, tarefa e commit da correção e repita os passos na versão disponibilizada. Marque `Resolvido no cenário testado`, `Persiste` ou `Não verificado`, sempre com evidência e limites. O proprietário pode escolher retestar só uma parte das jornadas.
