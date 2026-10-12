# Editor Stylo — estrutura adaptada às capacidades da ferramenta

Planejamento de2026-10-12. Complementa [ACESSO-WEB.md](ACESSO-WEB.md),
[INTERFACE-WEB.md](INTERFACE-WEB.md) e [FERRAMENTAS.md](FERRAMENTAS.md).
Direção solicitada: criar manualmente e por agente, com uma experiência profissional que
represente as capacidades e a estrutura real do Stylo. Não é implementação em apps/web.

## 1. Papel do editor

O editor é a interface visual do mesmo projeto usado pelo MCP. Precisa permitir montar,
organizar, reutilizar, ajustar, conferir e entregar. Não deve ser um desenho isolado que
exporta algo diferente nem um formulário com91 botões de ferramentas.

Cada capacidade deve ter um destino na experiência: ação direta, propriedade contextual,
painel especializado, comando de busca ou gerenciamento fora do editor. Algumas capacidades
anunciadas estão indisponíveis; não oferecer botões que pareçam funcionais nesses casos.

## 2. Estrutura do documento e vocabulário

| Conceito atual | Como explicar na interface | Consequência |
|---|---|---|
| Projeto | Arquivo de trabalho com recursos e páginas | Unidade de acesso, gravação e compartilhamento |
| Página do documento | Espaço que organiza telas/camadas | Não é necessariamente uma página do site exportado |
| Tela/prancheta | Frame na raiz ou em seção raiz | Cada tela visível pode virar uma página HTML |
| Frame/contêiner | Caixa com aparência e layout | Pode organizar filhos em fluxo ou posição livre |
| Grupo | Agrupamento de camadas | Não equivale a frame com fundo/layout |
| Seção | Organização estrutural de telas | Não tratar como qualquer contêiner de elementos |
| Componente principal | Estrutura reutilizável | Alterações podem propagar às instâncias |
| Instância | Uso de um componente | Não é uma cópia independente irrestrita |
| Recurso de design | Cor, texto, efeito, gradiente, variável ou modo | Pode estar vinculado a várias camadas |

Nomes públicos finais ainda precisam ser revisados. Recomenda-se distinguir “espaço de
trabalho” e “tela do site” se a palavra página continuar ambígua. Não renomear o modelo ou
migrar documentos só para resolver o texto da interface neste planejamento.

## 3. Organização geral

- **Topo:** projeto, contexto atual, salvamento, desfazer/refazer, visualizar e exportar.
- **Esquerda:** páginas/espaços e árvore; abas ou acesso a Inserir e Recursos.
- **Centro:** telas/camadas, zoom, deslocamento, seleção e guias.
- **Direita:** propriedades, estados/responsivo e informações da seleção.
- **Áreas recolhíveis:** problemas, atividade/aprovações e código, abertas conforme a tarefa.

Preservar área de trabalho: não abrir biblioteca, comentários, código e atividade todos ao
mesmo tempo por padrão. Ajustes de largura dos painéis e ocultação são úteis, sem prejudicar
atalhos ou foco. Área técnica é opcional para o uso cotidiano.

## 4. Inserção e construção

Inserir texto, contêiner/frame, retângulo, elipse, linha, vetor, imagem, ícone e instância.
Escolha de fluxo horizontal/vertical/grid pertence ao contêiner. Indicar o pai/destino e a
posição de inserção, evitando que a ação coloque conteúdo na tela errada.

Estruturas completas criadas por build_layout também precisam aparecer naturalmente na
árvore e ser editáveis. Modelos/presets visuais são proposta de conveniência, não catálogo
já disponível. Camadas HTML e mídia que chegam por outros caminhos devem ser reconhecidas,
sem afirmar que create_layer suporta todos esses tipos.

Interação direta proposta: selecionar, multisselecionar, mover/redimensionar quando permitido,
duplicar, apagar, ordenar, renomear e arrastar na árvore. Inserção de texto permite editar
conteúdo diretamente, com confirmação/cancelamento claros. Desenho/edição de curvas vetoriais
merece alcance próprio: aceitar path/SVG não comprova editor vetorial completo pelo servidor.

## 5. Propriedades contextuais

| Seção | Conteúdo |
|---|---|
| Geral | Nome, visibilidade, trava, nota, posição/tamanho quando aplicáveis |
| Dimensões | Fixo, conteúdo(hug), preencher(fill), mínimos/máximos e proporção |
| Layout do pai | Livre, horizontal, vertical ou grid; padding, gaps, alinhamento, quebra e colunas |
| Item no fluxo | Margens, crescimento, alinhamento próprio, spans e posição absoluta quando aceita |
| Aparência | Cor/imagem/gradiente, opacidade, contorno, raio, sombra, blur e recorte |
| Texto | Conteúdo, fonte/peso/itálico/tamanho, altura de linha, espaçamento, alinhamento e truncamento |
| Semântica | Tag permitida, link e descrição de imagem; rótulos explicam efeito real |
| Mídia | Controles, repetição, autoplay/mudo e dados do arquivo quando suportados |
| Avançado | CSS/HTML e comportamento disponível, com limites explícitos |

Não mostrar todas as seções para todo tipo. Valores diferentes numa seleção múltipla recebem
estado “Misto”, não um valor inventado; editar um campo altera apenas o que foi escolhido.
Tipos/unidades têm rótulos e limites. Atualizar vários elementos usa alteração atômica quando
aplicável. Campos vinculados exibem o recurso e ação explícita de trocar/desligar o vínculo.

## 6. Fluxo versus posição livre

Em layout livre, posição e alinhamento geométrico fazem sentido. Em flex/grid, a posição vem
do fluxo: arrastar normalmente deve significar reordenar, ou oferecer ação explícita para
sair do fluxo. Não persistir x/y como se controlassem um item que o CSS posiciona pelo pai.

Agrupar/alinha/distribuir possuem restrições reais de pais, fluxo, instância, rotação e
sobrescritas. O editor deve explicar por que uma ação não se aplica e oferecer o caminho
adequado, como ajustar gap/layout do pai. Não executar comandos legados mais permissivos
para contornar validações do servidor. Agrupar não pode alterar ordem visual silenciosamente;
desagrupar não pode descartar fundo, efeitos ou responsivo.

Operações por gesto precisam manter uma intenção clara no histórico: um arrasto ou ajuste
contínuo não deve virar dezenas de passos. Prévia local durante o gesto é proposta; confirmar
no servidor, tratar recusa/conflito e cancelar com Escape. Esse contrato ainda não existe
como caminho unificado para o editor novo.

## 7. Responsivo, estados e modos

Mostrar permanentemente o contexto editado: **Base/Desktop**, breakpoint com largura ou estado.
Largura de prévia arbitrária serve para conferir; não criar automaticamente um breakpoint
só porque a janela foi redimensionada.

Propriedade sobrescrita deve ser identificável, com valor herdado e ação de restaurar herança.
Campos não variáveis ficam indisponíveis nesse contexto com explicação. CSS manual pode
sobrepor modelo: indicar a origem quando houver informação, sem prometer rastreamento completo
que ainda não foi implementado. Não gravar medidas do navegador sobre a geometria base.

Estados hover/active/focus e modos de cor são conceitos distintos de breakpoints. Tema do
Stylo e cor de destaque pessoal também são distintos dos modos/cores do projeto. A prévia de
estados precisa de comportamento próprio; renderizações MCP estáticas não comprovam interação.

## 8. Recursos e componentes

Painel Recursos com cor, texto, efeito, gradiente, variável e modo; criar, localizar, renomear,
alterar e remover com informação de uso. Mostrar diferenças entre valor literal e vinculado.
Remover recurso em uso exige escolha explícita e aviso sobre perder modos; CSS manual não é
reescrito automaticamente. Referências fornecidas pelo serviço não devem ser apresentadas
como rastreamento completo de toda folha CSS.

Componentes: biblioteca, inserir instância, identificar principal e ir até ele. Não permitir
alteração estrutural de instância por um caminho que o MCP recusa. Variações e separação da
instância são pendências: detachInstance existir no núcleo não garante operação comum autorizada.
Não mostrar gestão completa de variantes como capacidade pronta.

## 9. Imagens, arquivos e identidade

Biblioteca permite enviar/reutilizar, pesquisar fontes disponíveis e inserir arquivos com
créditos/licença. Mostrar provedor indisponível/chave ausente; configuração de chaves pertence
ao painel, sem expor segredos no editor. Fontes hospedadas e fallback precisam ser distinguíveis.

Editor contextual de foto: original, prévia, recorte/proporção, giro/espelho, filtros/ajustes,
redução/formato e restaurar. Aplicar/cancelar devem evitar gravação a cada movimento do slider;
trabalho demorado mostra andamento/recusa de fila. Limites vêm do serviço. Remoção de fundo
simples não deve ser apresentada como recorte inteligente. generate_image_edit indisponível
não vira recurso de geração funcional.

Mídia vídeo/áudio/3D/Lottie precisa de identificação e fallback quando não houver prévia.
Imagem estática no editor/auditoria não comprova reprodução. Assistentes de identidade
(contraste, escala, harmonia, pares de fontes, escala tipográfica/espaçamento) sugerem resultados;
a pessoa aplica quando quiser. Brief do projeto guarda objetivo/contexto acessível ao agente.

## 10. Revisão, colaboração e entrega

Painel Problemas mostra regra, camada, largura, gravidade, sugestão e o que não foi verificado.
Clicar localiza o elemento e o contexto. Alteração pode marcar relatório antigo como desatualizado;
rodar auditoria novamente, sem apresentar problema resolvido antes da conferência.
Auditoria não certifica estética/acessibilidade completa; inspeção geométrica não detecta tudo.

Comentários da camada, notas/decisões do projeto e atividade são diferentes: preservar cada
contexto. Responder/resolver comentários tem lacunas MCP; não prometer recurso comum completo.
Aprovação de agente apresenta resumo compreensível da intenção/alcance e permite recusar;
aprovar entrada não equivale a liberar todas as escritas. Revogação e permissões devem valer
também em sessões abertas.

Visualização/Apresentar não é exportação. Protótipos navigate/back/url e transições não devem
ser anunciados como aplicação funcional exportada. JavaScript de projeto segue decisãoD11;
não executar código do projeto no processo do editor para facilitar a prévia.

Entrega: HTML, React e tokens nos formatos existentes. Mostrar arquivos/avisos, baixar ZIP,
explicar links, largura fixa, fontes e interações não exportadas. Não oferecer PDF/slides como
formato pronto. Código HTML/CSS acessível sob demanda, com alterações pelo contrato comum;
get_code somente leitura não é editor de código completo.

## 11. Mapa das capacidades para a interface

| Capacidades atuais | Destino |
|---|---|
| list/open/new/save_project | Painel de projetos e salvamento; não botão manual obrigatório para cada gravação |
| get_document/get_layer/find_layers/get_selection/select_layers | Árvore, busca, propriedades e seleção |
| create_layer/build_layout/move/delete/duplicate | Inserir, árvore e interação direta |
| create/switch/delete/rename/reorder_page | Organização de páginas/espaços |
| align/distribute/group/ungroup/reorder_layer | Seleção múltipla, menus e árvore |
| update_layer/update_layers | Campos e ajustes atômicos |
| set_responsive/set_state | Contexto de largura/estado e sobrescritas |
| create_*_styles/apply_text_style/add_color_mode/set_style_color | Recursos e propriedades vinculadas |
| create_size_variables/bind_variable/list/update/delete_design_resource | Recursos, vínculos e manutenção |
| create_component/create_instance | Principal e biblioteca de componentes |
| list/add/insert_asset/search/insert_icon/list_fonts | Inserir e arquivos do projeto |
| asset_providers/search_assets/library_*/add_font/asset_source_* | Biblioteca; fontes/chaves avançadas em gerenciamento |
| edit_image | Edição contextual de foto |
| font_pairs/color_scale/color_contrast/color_harmony/color_text_on/design_scale | Assistentes opcionais de identidade |
| get/set_project_brief | Contexto do projeto |
| get_image/inspect_layout/check_design | Prévia e revisão, com limitações de cada serviço |
| get_code/get/set_project_css | Área avançada de código |
| add_interaction | Protótipo no contexto da camada |
| add/get_comments/add/list/resolve_note | Comentários e contexto do projeto |
| get_activity/who_is_here/list_members/share/unshare_project | Atividade/presença e compartilhamento |
| undo/redo | Histórico comum conforme política definida |
| export_html/export_site/export_zip/export_tokens | Entrega |
| generate_image_edit | Indisponível; não apresentar como ação pronta |

Agrupamentos abreviam nomes na tabela; schemas e FERRAMENTAS.md são a referência técnica.
Não mapear toda consulta MCP paginada diretamente para o transporte do canvas: o navegador
precisa de snapshot e atualizações adequadas, sem despejar documentos inteiros no agente.

## 12. Contratos necessários antes da implementação

Servidor mantém a versão confirmada; editor e MCP devem passar por validação/autorização/
histórico comuns. O caminho web de operações precisa ser definido: não assumir que uma rota
existente aceita todas as ferramentas. Schemas auxiliam, mas não substituem design de interação.

Requisitos: snapshot autorizado, eventos filtrados, revisão/controle de concorrência, operação
identificada e tratamento de repetição/reconexão. Resposta atrasada não deve sobrescrever texto
que a pessoa está editando. Falha de salvar deve ficar visível; não confirmar antes de persistir.

**Limites atuais críticos:** seleção, página ativa e histórico são compartilhados no store do
projeto. Proposta para editor novo: seleção/zoom/painéis/contexto de visualização por sessão;
definir como operações MCP que usam página ativa serão contextualizadas sem corrida. Desfazer
não pode apagar trabalho de outra pessoa sem política explícita. Requer mudanças/validação,
não é capacidade presente. Travas de lote não equivalem a colaboração simultânea completa.

Proposta de módulos pequenos: shell, documento/sincronização, canvas/interações, páginas/camadas,
inspector, recursos/componentes, biblioteca/fotos, revisão, colaboração, protótipo, código e entrega.
Controles/temas são compartilhados com o painel. Tecnologia/escopo final seguem aprovação do
editor; não reescrever arquivos legados grandes apenas para começar a aparência nova.

## 13. Sequência proposta e aceite

1. Fechar vocabulário e fluxos; desenhar editor vazio, texto/foto/layout, seleção múltipla e revisão.
2. Definir operação web comum, estados por sessão e política de histórico/conflitos.
3. Construção manual, camadas, propriedades, salvar e exportar.
4. Responsivo, recursos/componentes e biblioteca/fotos.
5. Agente, aprovações, auditoria e áreas avançadas existentes.
6. Refinar interação/teclado/temas e validar jornadas completas antes de substituir o legado.

A primeira entrega precisa de recorte explícito, mas arquitetura deve representar todos os
conceitos existentes. Função adiada permanece identificada, sem apagar dados de documentos
criados pelo agente. Abrir um projeto com mídia/CSS/estados não suportados visualmente deve
preservá-los e informar o limite, não simplificar o arquivo ao salvar.

Critérios: criar manualmente e pelo MCP produz o mesmo modelo; alterações rejeitadas não
persistem parcialmente; seleção/contexto não pula por atividade externa; layouts não são
convertidos em coordenadas fixas; vínculos e sobrescritas ficam claros; destaque pessoal não
altera projeto/exportação; arquivo avançado sobrevive ao abrir/salvar; sem perda silenciosa
em conflito; fluxo construir→conferir→corrigir→exportar validado em navegador e MCP.

## 14. O que foi conferido neste bloco

Leitura do mapa, schemas núcleo/organização/recursos, propriedades aceitas e plugins de assets/
identidade. Inventário distingue modelo, ferramentas e experiência web futura. Não houve
inspeção visual ao vivo, teste de editor, código em apps/web ou teste novo de integração.
Última suíte anterior555/555 e tipos limpos não comprova este editor planejado.

## Arquitetura técnica fechada

[ARQUITETURA-EDITOR.md](ARQUITETURA-EDITOR.md) resolve as escolhas técnicas após delegação da pessoa dona: React/TypeScript/Vite, canvas DOM isolado, contexto por sessão, operações comuns, revisão/fila por projeto, conflitos explícitos e undo conservador por sessão. Sobrepõe as alternativas técnicas anteriores; comportamento ainda precisa ser implementado. Negócio e política de acesso permanecem decisões separadas.
