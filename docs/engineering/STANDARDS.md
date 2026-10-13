# Padrões de mudança

- TypeScript novo deve respeitar os workspaces e imports existentes.
- Lógica pura fica no core; efeitos são injetados por adapter.
- Nomes de ferramentas e propriedades públicas são estáveis; renomear exige migração/documentação.
- Mensagens para agentes devem explicar causa e próxima ação.
- Não enfraquecer teste para acomodar implementação.
- Toda mudança pública inclui teste focal e atualização de capacidade/contrato quando aplicável.
