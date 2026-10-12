# Plano de evolução das ferramentas MCP

Aprovado pela pessoa dona em 2026-10-12. O foco é fechar o ciclo do agente: localizar, alterar,
conferir e entregar páginas de sites. Editor/página web em apps/web permanece congelado.
PDF, apresentações, geração de imagens, licença e decisões de negócio ficam fora deste plano.

## Protocolo por bloco

1. Implementar em módulos pequenos e validar erros antes de publicar alterações.
2. Conferir testes relevantes, tipos e uso real; suíte completa quando houver mudança em código.
3. Atualizar contexto.md, PASSAGEM.md, FERRAMENTAS.md e acrescentar em decisoes.md.
4. Commit em português, pull --rebase origin limpeza e push origin limpeza. Sem main, force ou PR.
5. Registrar o que não foi verificado; não confundir cliente oficial MCP com cada aplicativo real.

## Etapas e critérios de conclusão

| Etapa | Trabalho | Conclusão esperada | Estado |
|---|---|---|---|
| 0 | Registrar este plano e os critérios | Documentos e plano enviados à limpeza | Concluída — 8b9c61c |
| 1 | Manutenção de estilos, variáveis e modos | Listar sem resposta enorme; atualizar/renomear por ID; remover com tratamento explícito dos vínculos, sem referências quebradas ou alteração parcial; histórico e exportação coerentes | Concluída — 519 testes e MCP real |
| 2 | Organização de camadas e páginas | Alinhar/distribuir/agrupar/desagrupar/ordenar com regras claras para fluxo, pais e seleção; renomear/ordenar páginas; rejeitar operações sem efeito ou inválidas com orientação | Concluída — 537 testes e MCP real |
| 3 | Auditoria textual ampliada | Melhorar avisos de consistência e área de toque; usar medidas por largura quando necessário; apresentar camada, problema, sugestão e limites da conferência; respostas limitadas | Pendente |
| 4 | Entrega e tarefas completas | Conferir rotas ZIP e conteúdo entregue, registrar limitações; executar uma tarefa de construir → revisar → corrigir → exportar pelo MCP | Pendente |
| 5 | Validação por cliente | Verificar o que o ambiente permite em Codex/Claude Code e registrar individualmente; OpenCode/Kimi depois. Se faltar cliente/credencial, registrar bloqueio concreto e não inventar resultado | Pendente |

O alcance de cada bloco será ajustado com evidência do código, preservando a finalidade aprovada.
Diferenças técnicas e limitações serão registradas no diário; decisões de produto reservadas à
pessoa dona não serão tomadas por inferência.
