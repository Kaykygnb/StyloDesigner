# Jornadas exploratórias do Studio

Catálogo preparado a partir da interface implementada na beta, referência `5ba7bbf1405f08f671aae993ff135f13143fe966`. Isso fundamenta os roteiros, mas não prova que a versão disponibilizada ao Work tenha as mesmas capacidades, nem representa execução exploratória. Confirmar a versão implantada com o humano; registrar diferença, bloqueio ou ausência real de controles em vez de presumir sucesso.

Leia primeiro [WORK-GUIDE.md](WORK-GUIDE.md). O proprietário escolhe jornadas e variantes; é permitido explorar livremente dentro das permissões. Estados possíveis por sessão: `Não executada`, `Em execução`, `Concluída`, `Parcial`, `Bloqueada`. Os estados abaixo descrevem este catálogo inicial; resultados/estados das sessões ficam no relatório, sem transformar o catálogo em histórico duplicado. Concluída não significa produto aprovado.

Um projeto contém um documento de design com páginas e camadas; não pressupomos um fluxo separado chamado “novo documento”. Criar projeto e criar página/tela são roteiros distintos. Conta administradora e dono de projeto são papéis diferentes. Testar com dados descartáveis, em uma única sessão de edição quando a jornada envolver undo/redo.

## QA-JRN-001 — Primeiro acesso

- Objetivo: descobrir como entrar no Studio e compreender a tela inicial.
- Pré-condições: URL alcançável e modo local/accounts informado; autorização específica se a instalação de teste estiver vazia e pedir conta mestre.
- Passos sugeridos: abrir a URL; registrar redirecionamento/tela; localizar entrada ou projetos; se autorizado, preencher setup de teste; observar mensagens e próximo passo.
- Resultado esperado: caminho para Studio e estado coerente com o modo/contas existentes; modo local pode abrir sem login, accounts pode pedir entrada/setup.
- Critérios de avaliação: entendimento do produto e da ação inicial, rótulos e feedback; setup não deve ser confundido com cadastro público livre.
- Riscos: criar conta mestre altera instalação; não executar setup sem permissão ou reinicializar instalação existente.
- Estado de execução: Não executada.

## QA-JRN-002 — Login e sessão

- Objetivo: entrar, sair e compreender troca obrigatória de senha e recuperação de sessão.
- Pré-condições: modo accounts, conta descartável, permissão para login/logout e variantes de senha; não aplicável ao login em modo local.
- Passos sugeridos: entrar com conta de teste; se autorizado, errar senha uma vez; percorrer troca temporária quando apresentada, incluindo reload e saída; sair e entrar novamente; revogação/suspensão só com humano ou conta admin especificamente autorizados.
- Resultado esperado: erro de senha compreensível; senha obrigatória bloqueia acesso ao trabalho até a troca; sair exige novo login; conta/sessão inválida não mantém acesso autenticado. Não presumir recuperação por e-mail: não identificada nesta preparação.
- Critérios de avaliação: instruções, feedback, preservação do contexto e distinção entre erro de credencial e acesso/rede; nenhuma credencial no relatório.
- Riscos: bloquear conta, trocar senha real ou revogar sessão de outra pessoa; respeitar autorização por alvo.
- Estado de execução: Não executada.

## QA-JRN-003 — Criar e abrir projetos

- Objetivo: criar um projeto QA, encontrá-lo e abrir o editor.
- Pré-condições: conta/modo com acesso de criação e prefixo de nomes liberado.
- Passos sugeridos: procurar Novo projeto; fornecer nome QA único; criar; voltar a Projetos; buscar pelo nome e abrir novamente; observar lista vazia/carregamento quando disponíveis naturalmente.
- Resultado esperado: projeto listado e editor aberto no projeto escolhido; nomes/conteúdo de projetos reais preservados.
- Critérios de avaliação: descoberta da criação, feedback de espera, busca e contexto de projeto aberto.
- Riscos: colisão de nome ou confundir projeto QA com real; não apagar/substituir existentes.
- Estado de execução: Não executada.

## QA-JRN-004 — Documento, páginas e telas

- Objetivo: organizar conteúdo dentro do projeto.
- Pré-condições: projeto QA editável; editor aberto.
- Passos sugeridos: localizar Páginas; criar/renomear uma página; alternar páginas; escolher Nova tela e desenhar uma tela no canvas; observar relação entre tela, página e lista de camadas.
- Resultado esperado: nova página selecionável; tela criada no documento/página escolhidos; alternância mostra o conteúdo correspondente.
- Critérios de avaliação: compreensão de projeto/documento/página/tela; estado vazio, foco e confirmação da criação. A função “novo documento” não é pressuposta como botão separado.
- Riscos: remover página com conteúdo; remoção fica fora do roteiro salvo autorização específica em dados QA.
- Estado de execução: Não executada.

## QA-JRN-005 — Ferramentas visuais e recursos

- Objetivo: descobrir ferramentas de criação e acrescentar formas/texto.
- Pré-condições: tela QA editável; permissões de upload se escolher variante de imagem.
- Passos sugeridos: localizar retângulo, elipse e texto; desenhar/inserir exemplos pequenos e editar texto; observar ferramenta ativa; opcionalmente inserir imagem QA autorizada ou explorar ícones/recursos visíveis sem ativar providers.
- Resultado esperado: camadas correspondentes às ações e feedback de ferramenta/seleção; upload autorizado mostra imagem ou erro compreensível.
- Critérios de avaliação: rótulos, cursor/estado ativo, previsibilidade da criação; cancelamento e feedback quando houver.
- Riscos: provider externo pode precisar chave, rede, licença ou custo; não ativar integração nem usar material real sem autorização.
- Estado de execução: Não executada.

## QA-JRN-006 — Seleção, camadas e componentes

- Objetivo: manipular elementos e compreender reutilização quando os controles estiverem disponíveis.
- Pré-condições: duas camadas QA em tela editável; somente dados descartáveis.
- Passos sugeridos: selecionar pelo canvas e lista; mover/redimensionar; selecionar vários itens, agrupar/duplicar; renomear/ocultar uma camada; opcionalmente usar Criar componente, localizar recurso e inserir instância pela GUI.
- Resultado esperado: seleção e conteúdo correspondem entre canvas/lista; movimento/tamanho refletem a ação; componente/instância identificáveis quando a variante for executada.
- Critérios de avaliação: alvos de seleção, alças, feedback, descoberta do menu e distinção entre componente e instância; não confundir clonagem comum com instância.
- Riscos: edição em lote, remoção e instâncias podem afetar vários elementos; trabalhar apenas no projeto QA, registrar variante não alcançada.
- Estado de execução: Não executada.

## QA-JRN-007 — Propriedades

- Objetivo: alterar aparência e geometria com previsibilidade.
- Pré-condições: retângulo e texto QA selecionáveis; permissão de edição.
- Passos sugeridos: alterar posição/tamanho/preenchimento no inspector; editar conteúdo/tamanho de texto; confirmar entradas como a GUI permitir; mudar seleção e conferir valores.
- Resultado esperado: propriedades aplicadas à seleção e apresentadas de forma coerente no canvas/inspector; valores inválidos não provocam mudança inesperada silenciosa.
- Critérios de avaliação: nomes/unidades, vínculo com seleção, descoberta da confirmação e recuperação de entrada inválida.
- Riscos: mudanças amplas e valores extremos; usar valores pequenos e reversíveis, sem fuzzing.
- Estado de execução: Não executada.

## QA-JRN-008 — Navegação pelo editor

- Objetivo: orientar-se entre canvas, páginas, camadas e painéis.
- Pré-condições: projeto QA com conteúdo; viewport conhecido quando possível.
- Passos sugeridos: localizar zoom e mão; navegar pelo canvas; alternar página e painéis disponíveis; voltar aos projetos; experimentar preview Desktop/Celular e Aparência/idioma se estiverem disponíveis.
- Resultado esperado: contexto e seleção compreensíveis; navegação não altera inadvertidamente o conteúdo; preview de tamanho muda a visualização do design.
- Critérios de avaliação: hierarquia, localização das ações, orientação e retorno; distinguir preview do design de redimensionar a interface do aplicativo.
- Riscos: alteração de preferências da conta; só em conta QA e dentro do escopo autorizado.
- Estado de execução: Não executada.

## QA-JRN-009 — Salvamento e persistência

- Objetivo: verificar preservação de uma edição real.
- Pré-condições: projeto QA editável, rede disponível, nomes/textos de marcador definidos pelo testador.
- Passos sugeridos: criar/alterar pequeno texto marcador; observar feedback de processamento/gravação disponível; aguardar término; sair para Projetos, reabrir e recarregar; comparar o conteúdo com o marcador.
- Resultado esperado: trabalho reaparece após reabertura/reload na mesma conta/projeto; falha de gravação deve ser perceptível, sem declarar sucesso antes da conferência.
- Critérios de avaliação: compreensão de salvamento automático, feedback e confiança após reabertura; registrar tempos realmente observados, não inventar um botão Salvar.
- Riscos: reload durante escrita pode perder edição pendente; começar com marcador descartável e interromper se houver perda de dados reais.
- Estado de execução: Não executada.

## QA-JRN-010 — Undo e redo

- Objetivo: recuperar uma alteração recente e reaplicá-la.
- Pré-condições: projeto QA sem edição simultânea de outras pessoas/agentes.
- Passos sugeridos: alterar cor/posição de um elemento; usar Desfazer; conferir estado anterior; usar Refazer; conferir estado alterado; opcionalmente testar atalho visível compatível com seu sistema.
- Resultado esperado: transições coerentes entre os estados realmente observados; sem atingir trabalho de outra pessoa.
- Critérios de avaliação: descoberta dos controles, entendimento da ação desfeita e seleção após mudança.
- Riscos: histórico do documento compartilhado; não testar sobre conteúdo importante nem presumir undo de toda operação administrativa/importação.
- Estado de execução: Não executada.

## QA-JRN-011 — Exportação e importação

- Objetivo: obter arquivo de projeto e importar uma cópia QA; explorar exportações disponíveis.
- Pré-condições: conteúdo QA, permissão de download/upload, seletor de arquivos acessível; nome único para cópia.
- Passos sugeridos: baixar JSON pela lista/painel disponível; usar Importar JSON e dar nome QA diferente; abrir e comparar a cópia; se autorizado, usar exportação HTML/React do painel e observar download/avisos. Registrar ausência de capacidade de ler/abrir arquivos na ferramenta.
- Resultado esperado: projeto JSON exportável e cópia importada sem substituir original; exportação disponível produz arquivo ou erro/aviso compreensível. O painel tem ação de publicação de artefato/exportação; isso não demonstra hospedagem externa de um site.
- Critérios de avaliação: formatos compreensíveis, escolha de arquivo, sucesso/erro, nome e preservação de conteúdo básico. Importação geral de Figma/PSD não foi identificada; não incluí-la como capacidade.
- Riscos: arquivo externo desconhecido, duplicação de nomes, download/publicação fora do ambiente; usar somente arquivos QA autorizados, não executar código exportado.
- Estado de execução: Não executada.

## QA-JRN-012 — Administração e permissões

- Objetivo: distinguir conta, projeto e acesso às ações administrativas.
- Pré-condições: modo accounts; perfis QA provisionados pelo humano; autorização específica para toda mudança administrativa/compartilhamento. Sem isso, observar apenas o perfil disponível e marcar variantes parciais.
- Passos sugeridos: observar Minha conta, sessões e menus; comparar conta administrativa com editor; editor cria seu projeto QA e observa menus; se autorizado, dono compartilha projeto QA, altera papel ou revoga acesso enquanto membro o mantém aberto; tentar uma leitura/edição QA após cada alteração. Agentes/tokens, plugins e configuração: observação de tela, sem conectar Work ao MCP nem alterar chaves.
- Resultado esperado: ser dono de projeto não concede administração da instalação; papel atual determina acesso de leitura/escrita, inclusive após alteração; editor/viewer não obtém funções reservadas da conta admin. Troca de perfil deve usar sessões/contas QA autorizadas.
- Critérios de avaliação: explicação das permissões, visibilidade de controles e recusas compreensíveis; ausência de menu não prova sozinha autorização do servidor.
- Riscos: revogar/suspender outras contas, expor tokens, modificar instalação ou compartilhar dados reais; parar e pedir confirmação quando alvo/efeito não estiver autorizado.
- Estado de execução: Não executada.

## QA-JRN-013 — Responsividade e acessibilidade

- Objetivo: identificar dificuldades de interação e leitura em tamanhos/modos acessíveis ao testador.
- Pré-condições: capacidade de controlar viewport/zoom/teclado; registrar limitações se houver.
- Passos sugeridos: percorrer entrada, projetos e editor em 1440×900 e 390×844 quando possível; navegar por Tab/Shift+Tab, observar foco e alcançar ações; experimentar zoom; conferir rótulos, mensagens, legibilidade e áreas roláveis. Testar preview Celular do design separadamente do viewport do aplicativo.
- Resultado esperado: ações essenciais alcançáveis e conteúdo compreensível; foco identificável; rolagem intencional do canvas não confundida com overflow involuntário da interface.
- Critérios de avaliação: ordem de foco, foco preso/oculto, alvos, rótulos e leitura; medidas WCAG só com ferramenta/evidência real. Simulação de viewport não prova uso touch em aparelho real.
- Riscos: confundir limitação da ferramenta de teste com defeito de acessibilidade; não afirmar certificação de acessibilidade.
- Estado de execução: Não executada.

## QA-JRN-014 — Erros e recuperação

- Objetivo: compreender mensagens e recuperar uma tentativa que falhou.
- Pré-condições: dados QA e autorização para um cenário seguro (senha incorreta, JSON pequeno inválido ou falta de permissão); sem interrupção de infraestrutura por conta própria.
- Passos sugeridos: escolher um cenário autorizado; executar uma tentativa; registrar mensagem/estado; corrigir entrada ou usar Tentar de novo quando exibido; conferir retorno ao fluxo; se falha natural de rede ocorrer, registrar contexto sem desligar o servidor.
- Resultado esperado: erro compreensível, possibilidade de retomada apropriada e preservação de dados; causa incerta relatada como não determinada.
- Critérios de avaliação: mensagem acionável, consistência de estados e prevenção de repetição perigosa; diferenciação entre produto, acesso e ferramenta.
- Riscos: lockout, perda de trabalho e ataques involuntários por repetição/arquivos grandes; não fazer testes de carga, fuzzing ou exploração de vulnerabilidade.
- Estado de execução: Não executada.

## Fontes de implementação — somente para mantenedores após a exploração inicial

**Work: não abrir estas fontes antes da primeira exploração.** Esta seção fundamenta o catálogo documental, não é uma lista de resultados de QA. Os testes mencionados foram examinados por leitura; nenhum foi executado nesta preparação. A cobertura parcial de automação não certifica uma jornada inteira.

| Jornadas | Evidência na GUI/código | Automação relacionada ou limite |
|---|---|---|
| 001–002 | [Login.tsx](../../apps/studio/src/screens/Login.tsx), [app.ts](../../apps/studio/src/lib/app.ts) | [studio-login-fluxo.mjs](../../tests/e2e/studio-login-fluxo.mjs), [studio-admin-fluxo.mjs](../../tests/e2e/studio-admin-fluxo.mjs): entrada, setup, senha e sessões |
| 003 | [Home.tsx](../../apps/studio/src/screens/Home.tsx) | E2E de login contém criação/retorno a projetos |
| 004 | [LayersPanel.tsx](../../apps/studio/src/editor/LayersPanel.tsx), [actions.ts](../../apps/studio/src/lib/actions.ts), [Toolbar.tsx](../../apps/studio/src/editor/Toolbar.tsx) | [studio-ui.test.js](../../tests/studio-ui.test.js) contém criação de tela; não afirmar cobertura completa de páginas |
| 005–007 | Toolbar, [menus.ts](../../apps/studio/src/editor/menus.ts), [AssetsTab.tsx](../../apps/studio/src/editor/AssetsTab.tsx), [editing.ts](../../apps/studio/src/lib/editing.ts), [FillSection.tsx](../../apps/studio/src/editor/inspector/FillSection.tsx), [TextSection.tsx](../../apps/studio/src/editor/inspector/TextSection.tsx) | studio-ui cobre parte da criação/seleção/arraste/resize/cor/texto; componentes, recursos e demais propriedades exigem exploração própria |
| 008–010 | [TopBar.tsx](../../apps/studio/src/editor/TopBar.tsx), [app.ts](../../apps/studio/src/lib/app.ts), [actions.ts](../../apps/studio/src/lib/actions.ts) | studio-ui contém undo/redo, modos de preview e aparência; salvamento exploratório não executado |
| 011 | Home, [Panels.tsx](../../apps/studio/src/editor/Panels.tsx) | studio-ui verifica downloads por API; isso não prova usabilidade nem execução completa dos controles de importação/exportação |
| 012 | [WorkspacePanel.tsx](../../apps/studio/src/screens/WorkspacePanel.tsx), [ProjectDialog.tsx](../../apps/studio/src/editor/ProjectDialog.tsx), Home | E2E administrativo/login; [studio-api.test.js](../../tests/studio-api.test.js) cobre compartilhamento ativo por HTTP, não a exploração GUI dessa variante |
| 013 | Login, Home, Toolbar, TopBar | E2E login verifica largura 390 px em parte do fluxo; não comprova toda a interface, touch ou WCAG |
| 014 | Login/Home (mensagens/retry), Home/Panels (importação) | E2E login inclui senha incorreta; outros cenários dependem de ambiente e autorização |

Consulte a [matriz de regressão](../testing/REGRESSION-MATRIX.md) para o inventário de riscos de engenharia e o [modelo de relatório](REPORT-TEMPLATE.md) para registrar execução real.
