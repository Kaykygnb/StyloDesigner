# Auditoria do estado atual

Snapshot e escopo no [índice](README.md). Investigação de código por Codex e três agentes auxiliares; revisão independente do pacote documental. Não houve auditoria visual, acesso a VPS, dados reais ou implementação estrutural. Referências de linha pertencem ao snapshot; testes identificados são evidência do escopo que exercitam, não certificação de todo o módulo.

Nesta rodada: `tests/config-autorizacao.test.js` reexecutado, **1/1 aprovado**; guard de origem reproduzido isoladamente com contexto sintético. A suíte **622/622 sem falhas/skips** foi executada na rodada anterior, base desta investigação; não foi repetida para alterações exclusivamente documentais.

## Inventário

| Capacidade | Estado e implementação | Evidência de teste e limite |
|---|---|---|
| Conta OWNER inicial e login | Implementado: [auth routes:55](../../../apps/server/src/routes/auth.ts#L55), [auth service:51](../../../apps/server/src/services/auth.ts#L51); tela [Login:25](../../../apps/studio/src/screens/Login.tsx#L25) | [servicos:19](../../../tests/servicos.test.ts#L19), [contas HTTP:49](../../../tests/contas-http.test.js#L49), E2E admin; setup sequencial, não proteção contra corrida/primeiro visitante |
| RBAC da instalação | Implementado: [identity:19](../../../apps/server/src/http/identity.ts#L19), [schema:14](../../../packages/db/prisma/schema.prisma#L14); OWNER/ADMIN administram, seis roles globais existem | [config autorização](../../../tests/config-autorizacao.test.js), E2E login; role global não concede membership de projeto |
| Usuários, senha temporária, suspensão | Implementado: [auth routes:77](../../../apps/server/src/routes/auth.ts#L77), [auth service:108](../../../apps/server/src/services/auth.ts#L108), [WorkspacePanel:572](../../../apps/studio/src/screens/WorkspacePanel.tsx#L572) | contas HTTP, servicos, [E2E login](../../../tests/e2e/studio-login-fluxo.mjs); cobertura não demonstra proteção do OWNER em todas as ações |
| Convites | Parcial: criação de conta/senha temporária e compartilhamento com conta existente | [sharing:18](../../../apps/server/src/services/sharing.ts#L18); não identificado convite por token/e-mail com aceite/expiração |
| Sessões humanas | Implementado: próprias/globais, revogar, hash SHA256, 30 dias; [auth routes:45](../../../apps/server/src/routes/auth.ts#L45), [auth service:68](../../../apps/server/src/services/auth.ts#L68) | contas HTTP e E2E login; mudança normal de senha não revoga todas as outras sessões |
| Papéis/acesso aos projetos | Implementado: proprietário/membership, EDITOR escreve; [projects:52](../../../apps/server/src/services/projects.ts#L52), [sharing:12](../../../apps/server/src/services/sharing.ts#L12) | servicos, workspace, [Studio API:165](../../../tests/studio-api.test.js#L165); instância ADMIN não tem leitura universal automática |
| Revalidação e concorrência | Implementado: [workspace:154](../../../apps/server/src/workspace/index.ts#L154), [Studio caller:42](../../../apps/server/src/studio/studio-calls.ts#L42), locks/revisões; DOC-SERVER-003/004 | Studio API/workspace; verificação no começo da chamada, não cancelamento garantido de efeito já iniciado |
| Agentes/tokens/scopes | Implementado: [agents:26](../../../apps/server/src/services/agents.ts#L26), [auth routes:119](../../../apps/server/src/routes/auth.ts#L119); criar/aprovar/revogar/rotacionar, token uma vez, scopes read/comment/write/export | servicos, contas HTTP, [MCP contas](../../../tests/mcp-contas.test.js); não encontrado prazo do token/allowlist individual de ferramentas |
| Grants por projeto | Implementado: [agents:80](../../../apps/server/src/services/agents.ts#L80), [workspace:123](../../../apps/server/src/workspace/index.ts#L123); grant binário + acesso do dono | workspace; não há scopes por grant; criação de projeto dá grant ao agente criador |
| Canal SSE/presença | Implementado, [events:35](../../../apps/server/src/events.ts#L35), system:108; 32 conexões, broadcast/presença | contas HTTP verifica conexão/lista/fechamento, não ACL de todas as notificações; binding/filtragem/revogação em investigação ADM-RISK-09 |
| Sessões MCP | Implementado transporte/sessões, 64/10min; [gateway:24](../../../apps/server/src/mcp/gateway.ts#L24) | SDK/HTTP cru/contas; não comprova identidade imutável/revogação quando bearer é omitido em sessão existente |
| Painel administrativo | Implementado, amplo: [Home:46](../../../apps/studio/src/screens/Home.tsx#L46), [WorkspacePanel](../../../apps/studio/src/screens/WorkspacePanel.tsx); usuários/sessões/agentes/integrações/backup/rede | [E2E admin](../../../tests/e2e/studio-admin-fluxo.mjs), E2E login; não é exploração GUI de todos os controles |
| Atividade/auditoria | Parcial: [operations](../../../apps/server/src/services/operations.ts), eventos auth e [atividade admin:56](../../../apps/server/src/routes/system.ts#L56) | atividade em MCP/contas; não identificada trilha abrangente de mudanças de papel/chaves/políticas/reset/restore |
| Configuração global | Implementado: [system:83](../../../apps/server/src/routes/system.ts#L83), [system:123](../../../apps/server/src/routes/system.ts#L123); adminOf antes do efeito | config-autorizacao 1/1 nesta rodada: anônimo401/membro403, OWNER/ADMIN persistem, recusa não muta, resposta oculta Pexels; aprovação beta com ressalva |
| Plugins/provedores/segredos | Implementado com limites: [plugins routes](../../../apps/server/src/routes/plugins.ts), [library:120](../../../apps/server/src/routes/library.ts#L120), [secrets:16](../../../apps/server/src/services/secrets.ts#L16) | biblioteca HTTP/E2E plugins; segredos por usuário cifrados AES-GCM; Pexels global em config JSON, mascarar resposta não equivale a cifrar arquivo |
| Backup/restore | Parcial: [backups:37](../../../apps/server/src/services/backups.ts#L37), [system:70](../../../apps/server/src/routes/system.ts#L70), UI existente | [backups](../../../tests/backups.test.ts) usa arquivo/checkpoint simulado; não prova integridade round-trip DB/blobs/chave. DOC-DB-001 já cobre prova real |
| PostgreSQL/migrações | Implementado/testado adapter: [client](../../../packages/db/src/client.ts), [PostgreSQL integração](../../../tests/postgres-integracao.test.js) | teste descartável real, reinício/outage; backup PG exige pg_dump/pg_restore externo, não GUI completo |
| Saúde/rede/conexões | Implementado: [system:29](../../../apps/server/src/routes/system.ts#L29), :43, :106; SSE não é sessão MCP | contas HTTP/PG/E2E admin; health sem identidade retorna detalhes em falha; contagens/migrações não são health público mínimo |
| Limites e abuso | Parcial: [guards:14](../../../apps/server/src/http/guards.ts#L14), gateway, renderer, eventos; login 8/5min por e-mail | segurança API e renderer; não encontrada quota completa por usuário/disco/provedor; rate limit login é memória de processo |
| Política agentPolicy | Implementada para cliente sem token em modo local: [gateway:63](../../../apps/server/src/mcp/gateway.ts#L63); accounts exige bearer no initialize mesmo se configuração diz open | Não afirmar que open habilita init anônimo em accounts; coerência GUI/política é insumo operacional |
| Multi-organização/infraestrutura | Não identificado: schema sem tenant/org; nenhum controlador SO/firewall/VPS | Não tratar como falta a implementar no MVP; infraestrutura pertence ao operador externo |

## Riscos e bloqueios identificados

| ID | Natureza e alcance | Referência / encaminhamento |
|---|---|---|
| ADM-RISK-01 | **Achado estático prioritário, não exploração reproduzida:** ADMIN pode alcançar reset/suspensão/rebaixamento de OWNER existente; bloqueio de promover para OWNER não protege alvo OWNER | [auth routes:90](../../../apps/server/src/routes/auth.ts#L90), [auth service:150](../../../apps/server/src/services/auth.ts#L150); DOC-SERVER-006 |
| ADM-RISK-02 | **Achado estático prioritário:** POST MCP com SID só reautentica se bearer presente; bearer diferente pode substituir agente; GET/DELETE não reautenticam. Revogação instantânea em todos esses caminhos não comprovada | [gateway:135](../../../apps/server/src/mcp/gateway.ts#L135); DOC-SERVER-007, sem redesenhar MCP |
| ADM-RISK-03 | **Bloqueio funcional reproduzido:** Host público e Origin HTTPS rejeitados. Proxy/TLS comum não torna aplicação compatível automaticamente | [guards:33](../../../apps/server/src/http/guards.ts#L33), [app:39](../../../apps/server/src/app.ts#L39); DOC-SERVER-008 |
| ADM-RISK-04 | **Risco estático:** setup aberto enquanto count=0, count/create separados; primeiro visitante/corrida podem apropriar bootstrap. Accounts padrão não fecha essa janela | auth service:54 e main:108; DOC-SERVER-008, bootstrap antes de exposição |
| ADM-RISK-05 | **Comportamento amplo existente, não autoelevação comprovada:** agente write do dono compartilha/revoga colaboradores; suspensão do delegante não revoga explicitamente seus agentes | [workspace:338](../../../apps/server/src/workspace/index.ts#L338), agents:34, [workspace teste:191](../../../tests/workspace.test.ts#L191); DOC-SERVER-006/007 |
| ADM-RISK-06 | **Risco operacional estático:** backup DB não inclui automaticamente blobs separados, configuração e chave; trocar chave pode inutilizar segredos antigos; recuperação fora de banda não identificada | backups, secrets:23/58, main:131; DOC-DB-001 e decisões da ADR, não promessa de backup completo |
| ADM-RISK-07 | **Lacuna estática:** trilha incompleta de mudanças sensíveis; health devolve err.message e cookie sem Secure. Exposição de segredo/exploração não reproduzidas | system:40, identity:15; DOC-ADMIN-002/DOC-SERVER-008 |
| ADM-RISK-09 | **Achado estático, sem reprodução de vazamento:** SSE /agent/events não chama userOf, aceita identidade/projeto por query; broadcastProject envia aos clientes sem ACL, revogação humana não fecha automaticamente o canal | [system:108](../../../apps/server/src/routes/system.ts#L108), [events:21](../../../apps/server/src/events.ts#L21), :35; DOC-SERVER-007. Não confundir revalidação do workspace com autorização desse canal |
| ADM-RISK-08 | **Risco UX por leitura, não falha GUI observada:** Promise.all de nove consultas pode bloquear todas; restore/reset/exclusão/revogação sem confirmação contextual; política otimista sem reversão visível em erro | WorkspacePanel:100/213/587/650/663/706; insumos DOC-STUDIO-003, não nova tarefa obrigatória por sugestão visual |

Riscos hipotéticos como fuga entre futuros tenants, abuso distribuído e crescimento de carga não foram reproduzidos; avaliar antes de prometer escala multi-instância. Nenhuma vulnerabilidade nova foi declarada reproduzida neste pacote.

## Reprodução segura do bloqueio de origem

Executada pelo agente de operação em processo descartável; sem servidor/DB/dados ou edição:

```bash
node --import tsx --input-type=module <<'JS'
import { localOnly } from './apps/server/src/http/guards.ts';
const guard = localOnly(5173, { requireJson: true });
for (const [label, host, origin] of [
  ['public-host-https-origin', 'stylo.example.com', 'https://stylo.example.com'],
  ['localhost-https-origin', 'localhost:5173', 'https://localhost:5173'],
  ['localhost-http-origin-control', 'localhost:5173', 'http://localhost:5173'],
]) {
  const headers = {host, origin, 'content-type': 'application/json'};
  try { await guard({req: {method: 'POST', header: key => headers[key]}}, async () => {}); console.log(label, 'allowed'); }
  catch (error) { console.log(label, error.status); }
}
JS
```

Resultados: `403`, `403`, `allowed`, respectivamente. É incompatibilidade funcional de implantação, não teste de invasão. Não desligar o guard para contornar o problema.
