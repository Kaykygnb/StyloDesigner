# Padrões

## Observados

- **Monólito modular**: workspaces separam responsabilidades sem separar deploy.
- **Runner/registry**: schemas e handlers são registrados no core; plugins adicionam ferramentas por registro.
- **Ports and adapters**: `RunnerDependencies`, workspace, renderer, fetch de imagem e vendor isolam efeitos externos.
- **Command + undo**: comandos e store concentram mutações reversíveis.
- **Session store**: Studio mantém estado de sessão e atualiza por eventos/refresh.
- **Lock por alvo**: presença reserva camada ou documento antes de escrita concorrente.
- **Bounded responses**: busca, inspeção e exportação limitam bytes/itens e usam paginação.

## Recomendações

- Manter interfaces dos adapters pequenas e injetáveis.
- Fazer cada nova ferramenta declarar schema, leitura/escrita, escopo, alvo de lock e estratégia de resposta.
- Preferir testes na interface do runner a testes que atravessam detalhes privados.
- Não adicionar uma camada de serviço apenas como passagem entre rota e runner.
