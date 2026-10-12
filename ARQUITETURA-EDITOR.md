# Arquitetura decidida para o editor web

2026-10-12. A pessoa dona delegou resolver as questões técnicas pelo que beneficia a ferramenta.
Este documento fecha a direção de implementação de [EDITOR-WEB.md](EDITOR-WEB.md).
**Arquitetura decidida não significa código implementado.** Este bloco altera somente documentos.

> **Atualização 2026-10-12:** existe uma **primeira implementação** em `apps/studio` (branch `agente/painel-web`). Seguiu: React + TypeScript + Vite, canvas em DOM isolado (`iframe` sem scripts),
> as MESMAS ferramentas do MCP para qualquer mudança, tema/destaque fora do documento. **Ainda não implementa** a fila/revisão obrigatória por sessão, a idempotência, o desfazer por sessão nem o
> contexto de página/seleção no servidor (a aba mantém seleção e página localmente e restabelece a página antes de cada ferramenta). Veja `decisoes.md` (2026-10-12, "Painel web").

## 1. Decisões centrais

| Questão | Escolha técnica | Motivo |
|---|---|---|
| Interface nova | React + TypeScript + Vite, módulos pequenos | Componentes consistentes e tipos alinhados ao núcleo |
| Área de criação | DOM/HTML/CSS, overlays separados | Fidelidade ao modelo web/exportação; não recriar layout num bitmap |
| Documento confirmado | Uma autoridade no workspace do servidor | Pessoa/agente não mantêm versões concorrentes autoritativas |
| Operações | Mesmo caminho de validação/autorização para web e MCP | Impede comportamento manual que contorne regras do agente |
| Contexto visual | Separado por sessão | Seleção/página/zoom de uma sessão não deslocam outra |
| Concorrência inicial | Escritas serializadas por projeto e revisão obrigatória | Evita sobrescrita silenciosa sem implementar CRDT agora |
| Desfazer inicial | Última transação elegível, da mesma sessão | Não restaura snapshot antigo sobre trabalho alheio |
| Gesto | Prévia local e uma confirmação no final | Resposta rápida e histórico legível |
| Personalização | Tema e destaque por pessoa, fora do documento | Não modifica projeto, exportação ou outros usuários |

Tecnologia e contratos são decisões técnicas delegadas. Políticas de entrada, identidade do
login, direitos administrativos sobre conteúdo, licença/cobrança/hospedagem continuam reservadas
à pessoa dona. Não ligar acesso de rede nem iniciar substituição de apps/web neste bloco.

## 2. Estado dividido em três camadas

**Documento:** páginas, camadas, estilos, componentes, arquivos referenciados, breakpoints,
comentários e demais dados persistidos do projeto. Mantido pelo servidor.

**Sessão:** projeto/página de trabalho, seleção, contexto de breakpoint/estado/modo, operação
em andamento e identidade autorizada. No web, zoom, painéis e ferramenta ativa são locais;
contexto necessário ao comando acompanha a requisição. MCP possui seu próprio contexto.
Identidade vem da sessão autenticada, nunca de actorId livre enviado pelo navegador.

**Preferências:** tema, destaque e organização pessoal da interface. Persistência por conta
quando houver contas; cache local para inicialização. Sem usar campos de cor do avatar ou
styles do projeto. Instalação sem conta precisa de política de compatibilidade, não migrar
preferências pessoais para o documento.

Documento não guarda seleção/página ativa de todos como uma única verdade. Uma página apagada
invalida contextos que apontavam para ela e aciona fallback explícito. Excluir camada remove IDs
inválidos da seleção afetada sem selecionar automaticamente a criação de outro agente.

## 3. Contrato comum de operações

Introduzir uma camada de aplicação no workspace, consumida pelos transportes web e MCP.
Não chamar o endpoint MCP a partir de cada slider como atalho de arquitetura. Também não usar
PUT do documento inteiro como caminho normal de edição do navegador.

Envelope conceitual: operationId, projectId, expectedRevision, contexto pageId quando necessário,
nome de operação e argumentos validados. Retorno: situação, nova revisão, resultado compacto,
IDs afetados e avisos. Nome/path das rotas serão definidos na implementação; não são endpoints existentes.

Revisão do documento muda apenas após transação confirmada. Seleção/zoom/presença não avançam
revisão do documento. operationId é único dentro do alcance de pessoa/sessão/projeto; repetição
com mesmos argumentos consulta o resultado conhecido, não executa de novo. Mesmo ID com payload
diferente é erro. Não devolver resultado antigo se a pessoa perdeu acesso ao projeto.

Revalidar permissões, papel, existência e revisão ao executar, inclusive após aprovação.
Adaptadores de comandos recebem contexto explícito. **Não trocar pageId/selection globais e
restaurar ao redor de uma função assíncrona:** outras sessões poderiam observar o estado temporário.
Migrar dependências de comandos para contexto de sessão ou fachada própria, preservando IDs e modelo.

MCP mantém ferramentas existentes; leituras devolvem revisão quando aplicável, com ajuste do
orçamento. Na migração, validar compatibility de clientes e definir como leituras/abertura ancoram
a revisão usada na escrita. Uma sessão que ainda não tem revisão pode ancorá-la na primeira
operação para preservar criação inicial; se houve mudança desde a âncora, deve reler antes de escrever.
Contexto MCP não usa página global de outra sessão. Ferramentas dependentes de seleção recebem
seleção daquela sessão. Chamadas sobre projeto trocado não terminam gravando no novo projeto.

## 4. Transação, persistência e eventos

Uma fila de confirmação por projeto coordena web, MCP, plugins, undo e gravações/importações
externas. Leituras podem usar snapshots; não segurar fila durante aprovação humana, download,
processamento de foto ou medição no Chromium.

Fluxo: validar intenção → aprovar quando aplicável → preparar resultado fora da fila se demorado
→ entrar na fila → revalidar acesso/revisão → aplicar em rascunho → persistir com controle de
versão → publicar documento/revisão/evento. Falha não publica atualização parcial confirmada.
Conflito após preparação preserva a edição mais nova e recusa o resultado atrasado.

Um lote é uma transação; falha em um item não confirma os outros. Todo caminho mutante deve
participar, inclusive plugins e HTTP de importação. Hash/controle de versão do banco continua
necessário se outro processo gravar; a fila só resolve concorrência dentro da instância.

Preparação de arquivos não autoriza remover blobs anteriores: preservar referências usadas,
histórico e possíveis efeitos compartilhados. Limpeza de órfãos é tarefa separada. Snapshots
precisam cobrir todo estado persistido alterado, inclusive assets/fonts/brief, não apenas os
campos que o undo legado captura. Não registrar segredos como parte do histórico.

Eventos são filtrados por permissão e carregam revisão/operationId. Na primeira versão,
notificação de revisão e refetch autorizado são suficientes; patches detalhados são otimização
posterior. Reconectar ou perder sequência exige snapshot atual, nunca aplicar eventos fora de
ordem sobre documento velho. Remover acesso encerra streams e invalida sessões relacionadas.

## 5. Conflitos e prévia local

Não mesclar automaticamente edições antigas na primeira versão. Revisão divergente retorna
conflito com explicação e preserva rascunho local. Oferecer atualizar e reaplicar/revisar; sem
reenvio silencioso de operação destrutiva. Mesmo alterações em elementos diferentes podem
exigir revisão no início: custo aceitável para evitar perda de dados.

Arrasto/resize/slider usa prévia transitória com cancelar; confirmar uma operação ao soltar.
Alteração externa durante gesto não some: sinalizar e impedir confirmação contra revisão antiga.
Texto mantém rascunho separado do documento recebido. Ao perder acesso, remover conteúdo
privado e descartar possibilidade de envio; retenção de rascunho sensível não é automática.

Mostrar estados distintos: prévia local, aguardando aprovação, enviando, confirmado/salvo,
conflito e falha. Servidor indisponível não equivale a edição offline garantida. Não construir
fila offline persistente de escritas na versão inicial.

## 6. Desfazer e refazer sem apagar trabalho alheio

Histórico de transações do projeto, com autoria e sessão. Comando desfazer só é elegível se a
última transação documental reversível pertence à sessão que solicita e nenhuma alteração
posterior invalidou a revisão. Alteração de outra sessão bloqueia o desfazer, mesmo do mesmo
usuário. Mostrar motivo e caminho para revisão manual; não oferecer snapshotrestore antigo.

Desfazer/refazer são novas confirmações com controle de revisão, não decremento global do
índice do store. Redo pertence à mesma sessão e é invalidado por qualquer escrita incompatível
posterior. Presença/seleção não invalidam redo. Uma transação concluída de forma parcialmente
externa ou irreversível deve informar que não tem reversão suportada.

Restauração de versão é ação separada, explicitamente destrutiva sobre a versão atual e sujeita
às permissões apropriadas; não é o Ctrl+Z cotidiano. Não desenvolver undo seletivo por patches
na primeira versão: é possível depois com análise de dependências e testes específicos.
Persistência do histórico entre reinícios é parte do contrato a implementar; não prometer
recuperação durável com a pilha de snapshots em memória atual.

## 7. Estrutura visual e propriedades

Manter topo/esquerda/centro/direita e áreas recolhíveis de EDITOR-WEB.md. Fluxo de layout governa
a interação: em flex/grid, mover reordena; posição absoluta exige ação explícita. Propriedades
múltiplas usam Misto e alteração somente dos campos tocados. Vínculos, herança e sobrescritas
ficam visíveis. Restaurar herança é operação explícita, não gravar medida calculada como literal.

Navegador mede para exibição/gestos; servidor mede para tarefas MCP e revisão. Resultados de
layout são derivados por revisão/largura/contexto, sem sobrescrever geometria base na leitura.
Migrar o enriquecimento de medidas atual antes de declarar esse requisito pronto. Fontes e CSS
manual podem mudar resultado: informar origem/limites e preservar código não editado.

Conteúdo do projeto é não confiável: sanitização e renderização isolada, sem scripts/acesso ao
DOM da interface, cookies ou tokens. Definir estratégia de iframe/overlay para fidelidade e
seleção; caminho DOM é decidido, detalhes de isolamento devem ser prototipados e testados.
Prévia interativa possui isolamento próprio e não dá ao projeto privilégio do painel.

## 8. Tema e destaque

Implementar Claro/Escuro/Sistema e paleta curta de destaques com contraste conferido. Persistir
por pessoa com cache local; botão restaurar padrão. Cor hexadecimal livre fica para etapa
posterior após validar geração de variantes e contraste. Cores semânticas e presença continuam
independentes. Sem estado de aparência nas exportações ou renderização do projeto.

Usar variáveis semânticas para botão, foco, item ativo e realce suave; variantes por tema,
estados por componente e movimento reduzido. Sistema de componentes próprio organizado por
função, reaproveitando primitivas acessíveis quando apropriado; biblioteca final não precisa
ser escolhida antes de testar as interações. Não reusar o CSS legado inteiro como fundação nova.

## 9. Migração e implementação em blocos

1. Provar contrato de operação/revisão/persistência com duas sessões antes de redesenhar tudo.
2. Separar contexto de sessão e implementar histórico conservador comum web/MCP.
3. Prototipar canvas DOM isolado, seleção, gesto e inspector de texto/layout/foto.
4. Construir componentes/temas/destaque e shell novo em módulos TypeScript.
5. Integrar construção, recursos, responsivo, revisão/agente, biblioteca e entrega existentes.
6. Validar documentos avançados e jornadas reais; substituir entrada do legado só quando aceite passar.

Começar pelo núcleo técnico reduz o risco de uma interface bonita sobre operações inconsistentes.
Preservar documentos e capacidades avançadas que a UI não suporta ainda. Sem migração destrutiva
ou remoção do legado por suposição. Escopo de telas/entregas e autorização para o bloco de
implementação continuam explícitos; este documento resolve arquitetura, não afirma que o editor foi refeito.

## 10. Verificações obrigatórias para a futura implementação

- Duas sessões mantêm seleção/página/contexto próprios, incluindo comandos MCP e plugins.
- Revisão antiga é recusada, idempotência não duplica criação nem devolve dados após revogação.
- Aprovação lenta/foto/download não bloqueiam confirmação de outra sessão nem sobrescrevem mudança.
- Falha de persistência/lote não publica operação parcial; retorno salvo tem evidência de confirmação.
- Undo/redo não remove trabalho de outra sessão, cobre campos persistidos e trata arquivos.
- Medição/refetch/eventos não alteram base nem apagam rascunho local.
- Conteúdo hostil não alcança DOM da aplicação/credenciais; exportação mantém sanitização.
- Abrir/salvar conserva recursos avançados; tema/destaque não mudam documento/exportação.

## 11. Evidência e limites deste bloco

Conferidos workspace/index.ts, store.js, executor e package web. Confirmado contexto/store
compartilhado, undo por snapshot e gravação externa que recarrega documento. Solução acima
resolve o desenho técnico; não alterou esses comportamentos em código. Sem testes novos,
navegação visual ou mudanças em apps/web. Última suíte anterior555 passando/tipos limpos
não comprova os novos contratos. Decisões de negócio de ACESSO-WEB.md seguem pendentes.
