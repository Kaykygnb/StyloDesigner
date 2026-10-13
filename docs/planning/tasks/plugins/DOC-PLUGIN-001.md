# DOC-PLUGIN-001 — Matriz de providers e licenças

- **Módulo:** plugins
- **Prioridade:** P2
- **Estado:** Proposto
- **Problema/evidência:** providers embutidos e providers com chave têm caminhos distintos; chaves reais e créditos não foram verificados nesta revisão.
- **Objetivo:** validar resultados, licença, crédito, falha e ausência de chave por provider.
- **Escopo:** asset search, library save/use e fontes.
- **Fora do escopo:** adicionar novos providers.
- **Dependências:** credenciais de teste e política de uso.
- **Riscos:** custo, rate limit e mudança externa.
- **Aceitação:** cada provider tem fixture ou teste live opt-in e o resultado nunca perde licença/crédito.
- **Testes obrigatórios:** provider sem chave, sucesso, falha, conteúdo inválido e biblioteca.
- **Regressão:** `npm test`.
- **Rollback:** desativar somente fixtures/credenciais de teste.
