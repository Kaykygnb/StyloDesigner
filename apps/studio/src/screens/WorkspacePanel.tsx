import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { toast, useApp } from "../lib/app";
import { askText } from "../ui/Dialog";

type Tab = "library" | "agents" | "admin" | "account";

export function WorkspacePanel({ tab }: { tab: Tab }) {
  const user = useApp((s) => s.user);
  const [assets, setAssets] = useState<api.LibraryAsset[]>([]);
  const [agents, setAgents] = useState<api.AgentInfo[]>([]);
  const [users, setUsers] = useState<api.PublicUser[]>([]);
  const [policy, setPolicy] = useState("closed");
  const [scopes, setScopes] = useState<Record<string, string[]>>({});
  const [newToken, setNewToken] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [catalog, setCatalog] = useState<{
    plugins: api.PluginInfo[];
    providers: api.ProviderInfo[];
  } | null>(null);
  const [accountName, setAccountName] = useState(user?.name || "");
  const [accountColor, setAccountColor] = useState(user?.color || "#6d5dfc");
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      createdAt: string;
      expiresAt: string;
      current: boolean;
    }>
  >([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === "library") {
      setLoading(true);
      void api
        .libraryList()
        .then((x) => setAssets(x.assets))
        .catch((e) => toast("error", String(e)))
        .finally(() => setLoading(false));
    }
    if (tab === "agents") {
      setLoading(true);
      void api
        .agentsList()
        .then((rows) => {
          setAgents(rows);
          setScopes(Object.fromEntries(rows.map((a) => [a.id, a.scopes])));
        })
        .catch((e) => toast("error", String(e)))
        .finally(() => setLoading(false));
    }
    if (tab === "admin") {
      setLoading(true);
      void Promise.all([
        api.usersList(),
        api.agentConfig(),
        api.pluginsCatalog(),
      ])
        .then(([u, c, p]) => {
          setUsers(u);
          setPolicy(c.agentPolicy || "closed");
          setCatalog(p);
        })
        .catch((e) => toast("error", String(e)))
        .finally(() => setLoading(false));
    }
    if (tab === "account") {
      void api
        .sessionsList()
        .then(setSessions)
        .catch(() => setSessions([]));
    }
  }, [tab]);

  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const a = await api.libraryUpload(file);
      setAssets((x) => [a, ...x]);
      toast("ok", "Arquivo salvo na biblioteca.");
    } catch (e) {
      toast("error", String(e));
    }
  };
  const create = async () => {
    const name = await askText("Novo agente MCP", "", {
      message: "Dê um nome curto para identificar esta conexão.",
      okLabel: "Criar",
    });
    if (!name?.trim()) return;
    try {
      const a = await api.createAgent(name.trim());
      setAgents((x) => [...x, a.agent]);
      setScopes((x) => ({ ...x, [a.agent.id]: a.agent.scopes }));
      setNewToken(a.token);
    } catch (e) {
      toast("error", String(e));
    }
  };
  const grantProject = async (agent: api.AgentInfo) => {
    const file = await askText("Projeto autorizado", "", {
      message:
        "Informe o nome do arquivo do projeto, por exemplo meu-site.json.",
      okLabel: "Autorizar",
    });
    if (!file?.trim()) return;
    try {
      await api.grantAgentProject(agent.id, file.trim());
      toast("ok", "Agente autorizado no projeto.");
    } catch (e) {
      toast("error", String(e));
    }
  };
  const rotate = async (agent: api.AgentInfo) => { try { const result = await api.rotateAgent(agent.id); setNewToken(result.token); toast('ok', `Token de ${agent.name} rotacionado.`); } catch (e) { toast('error', String(e)); } };
  const createUser = async () => {
    const email = await askText("E-mail do usuário", "", {
      okLabel: "Próximo",
    });
    if (!email) return;
    const name = await askText("Nome do usuário", "", { okLabel: "Criar" });
    if (!name) return;
    try {
      const created = await api.createUser(email, name);
      setUsers((x) => [...x, created.user]);
      setTemporaryPassword(created.temporaryPassword || null);
    } catch (e) {
      toast("error", String(e));
    }
  };
  const editUser = async (u: api.PublicUser) => {
    const name = await askText("Nome do usuário", u.name, {
      okLabel: "Salvar",
    });
    if (!name) return;
    try {
      const updated = await api.updateUser(u.id, { name });
      setUsers((x) => x.map((v) => (v.id === u.id ? updated : v)));
      toast("ok", "Usuário atualizado.");
    } catch (e) {
      toast("error", String(e));
    }
  };
  const resetUser = async (u: api.PublicUser) => {
    try {
      const result = await api.resetUserPassword(u.id);
      setTemporaryPassword(result.temporaryPassword);
      toast("ok", "Senha temporária gerada.");
    } catch (e) {
      toast("error", String(e));
    }
  };
  const setRole = async (u: api.PublicUser, role: api.PublicUser["role"]) => { try { const updated = await api.updateUser(u.id, { role }); setUsers((x) => x.map((v) => v.id === u.id ? updated : v)); toast('ok', 'Função atualizada.'); } catch (e) { toast('error', String(e)); } };
  const toggleSuspended = async (u: api.PublicUser) => { try { const updated = await api.setUserSuspended(u.id, !u.suspended); setUsers((x) => x.map((v) => v.id === u.id ? updated : v)); toast('ok', updated.suspended ? 'Usuário suspenso.' : 'Usuário reativado.'); } catch (e) { toast('error', String(e)); } };

  if (tab === "account")
    return (
      <section className="workspace-section">
        <h1>Minha conta</h1>
        <p className="muted">Perfil usado para acessar esta instalação.</p>
        <div className="account-card">
          <div className="row">
            <span className="avatar" style={{ background: accountColor }}>
              {(accountName || user?.name || "?").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{user?.email || "Sem login configurado"}</b>
              {user?.role && (
                <span className="faint">
                  {user.role === "OWNER" ? "Administrador" : "Membro"}
                </span>
              )}
            </div>
          </div>
          <label className="small">
            Nome
            <input
              className="field"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </label>
          <label className="small">
            Cor do perfil
            <input
              className="field"
              type="color"
              value={accountColor}
              onChange={(e) => setAccountColor(e.target.value)}
            />
          </label>
          <button
            className="btn primary"
            onClick={() =>
              void api
                .updateMe({ name: accountName, color: accountColor })
                .then(() => toast("ok", "Perfil salvo."))
                .catch((e) => toast("error", String(e)))
            }
          >
            Salvar perfil
          </button>
        </div>
        <div className="account-card">
          <b>Trocar senha</b>
          <label className="small">
            Senha atual
            <input
              className="field"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="small">
            Nova senha
            <input
              className="field"
              type="password"
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
            />
          </label>
          <button
            className="btn"
            onClick={() =>
              void api
                .changePassword(currentPassword, nextPassword)
                .then(() => {
                  setCurrentPassword("");
                  setNextPassword("");
                  toast("ok", "Senha alterada.");
                })
                .catch((e) => toast("error", String(e)))
            }
          >
            Alterar senha
          </button>
        </div>
        <div className="account-card">
          <div className="workspace-head">
            <b>Sessões ativas</b>
            <button
              className="btn ghost sm"
              onClick={() => void api.sessionsList().then(setSessions)}
            >
              Atualizar
            </button>
          </div>
          <ul className="resource-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <b>{s.current ? "Esta sessão" : "Outra sessão"}</b>
                  <span className="faint">
                    Iniciada em {new Date(s.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                {!s.current && (
                  <button
                    className="btn sm"
                    onClick={() =>
                      void api.revokeSession(s.id).then(() => {
                        setSessions((x) => x.filter((v) => v.id !== s.id));
                        toast("ok", "Sessão revogada.");
                      })
                    }
                  >
                    Revogar
                  </button>
                )}
              </li>
            ))}
            {!sessions.length && (
              <li className="muted">Nenhuma sessão ativa encontrada.</li>
            )}
          </ul>
        </div>
      </section>
    );
  if (tab === "agents")
    return (
      <section className="workspace-section">
        <div className="workspace-head">
          <div>
            <h1>Conexões MCP</h1>
            <p className="muted">Agentes autorizados, permissões e estado.</p>
          </div>
          <button className="btn primary" onClick={() => void create()}>
            Novo agente
          </button>
        </div>
        {newToken && (
          <div className="account-card">
            <b>Token criado — copie agora</b>
            <p className="hint">
              Ele não é salvo em texto e não será mostrado novamente.
            </p>
            <div className="codebox">
              <code>{newToken}</code>
              <button
                className="btn ghost sm"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(newToken)
                    .then(() => toast("ok", "Token copiado."))
                }
              >
                Copiar
              </button>
            </div>
            <button className="btn sm" onClick={() => setNewToken(null)}>
              Fechar
            </button>
          </div>
        )}
        {loading ? (
          <p className="muted">Carregando…</p>
        ) : (
          <>
            <McpGuide />
            <div className="account-card">
              <b>Como conectar</b>
              <p className="faint">Use o token como Bearer no endpoint MCP.</p>
              <pre className="code">
                Claude Code: claude mcp add --transport http stylo{" "}
                {location.origin}/mcp --header "Authorization: Bearer TOKEN"
                {`\n`}Codex / Quine / OpenCog: URL {location.origin}/mcp ·
                transporte HTTP · Bearer TOKEN
              </pre>
            </div>
            <ul className="resource-list">
              {agents.map((a) => (
                <li key={a.id}>
                  <div>
                    <b>{a.name}</b>
                    <span className="faint">
                      {a.status}
                      {a.lastSeenAt
                        ? ` · visto ${new Date(a.lastSeenAt).toLocaleString()}`
                        : ""}
                    </span>
                    <div className="row wrap">
                      {["read", "comment", "write", "export"].map((scope) => (
                        <label className="check small" key={scope}>
                          <input
                            type="checkbox"
                            checked={scopes[a.id]?.includes(scope) ?? false}
                            onChange={(e) =>
                              setScopes((x) => ({
                                ...x,
                                [a.id]: e.target.checked
                                  ? [...(x[a.id] || []), scope]
                                  : (x[a.id] || []).filter((v) => v !== scope),
                              }))
                            }
                          />
                          {scope}
                        </label>
                      ))}
                      <button
                        className="btn ghost sm"
                        onClick={() =>
                          void api
                            .updateAgent(a.id, scopes[a.id] || [])
                            .then(() => toast("ok", "Permissões salvas."))
                            .catch((e) => toast("error", String(e)))
                        }
                      >
                        Salvar
                      </button>
                      <button
                        className="btn ghost sm"
                        onClick={() => void grantProject(a)}
                      >
                        Autorizar projeto
                      </button>
                      <button
                        className="btn ghost sm"
                        onClick={() => void rotate(a)}
                      >
                        Rotacionar token
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn sm"
                    onClick={() =>
                      void (
                        a.status === "REVOKED"
                          ? api.approveAgent(a.id)
                          : api.revokeAgent(a.id)
                      )
                        .then(() =>
                          setAgents((x) =>
                            x.map((v) =>
                              v.id === a.id
                                ? {
                                    ...v,
                                    status:
                                      v.status === "REVOKED"
                                        ? "ACTIVE"
                                        : "REVOKED",
                                  }
                                : v,
                            ),
                          ),
                        )
                        .catch((e) => toast("error", String(e)))
                    }
                  >
                    {a.status === "REVOKED" ? "Aprovar" : "Revogar"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    );
  if (tab === "admin")
    return (
      <section className="workspace-section">
        <div className="workspace-head">
          <div>
            <h1>Administração</h1>
            <p className="muted">Contas, acesso MCP, permissões e plugins.</p>
          </div>
        </div>
        {temporaryPassword && (
          <div className="account-card">
            <b>Senha temporária — copie agora</b>
            <p className="hint">
              Ela só é mostrada uma vez. O usuário deve trocar depois.
            </p>
            <div className="codebox">
              <code>{temporaryPassword}</code>
              <button
                className="btn ghost sm"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(temporaryPassword)
                    .then(() => toast("ok", "Senha copiada."))
                }
              >
                Copiar
              </button>
            </div>
            <button
              className="btn sm"
              onClick={() => setTemporaryPassword(null)}
            >
              Fechar
            </button>
          </div>
        )}
        <div className="account-card">
          <div className="row">
            <b>Política de agentes</b>
            <select
              className="field"
              value={policy}
              onChange={(e) => {
                const v = e.target.value as "open" | "approval" | "closed";
                setPolicy(v);
                void api
                  .updateAgentConfig({ agentPolicy: v })
                  .catch((x) => toast("error", String(x)));
              }}
            >
              <option value="closed">Fechado</option>
              <option value="approval">Exigir aprovação</option>
              <option value="open">Aberto</option>
            </select>
          </div>
          <p className="hint">
            Fechado: somente agentes cadastrados e aprovados têm acesso.
          </p>
        </div>
        <div className="account-card">
          <div className="workspace-head">
            <b>Usuários</b>
            <button
              className="btn primary sm"
              onClick={() => void createUser()}
            >
              Novo usuário
            </button>
          </div>
          <ul className="resource-list">
            {users.map((u) => (
              <li key={u.id}>
                <div>
                  <b>{u.name}</b>
                  <span className="faint">
                    {u.email} · {u.role} · {u.suspended ? "suspenso" : u.mustChangePassword ? "troca de senha pendente" : "ativo"}
                  </span>
                </div>
                <div className="row">
                  {u.id !== user?.id && <select className="field" value={u.role} onChange={(e) => void setRole(u, e.target.value as api.PublicUser["role"])}><option value="VIEWER">Viewer</option><option value="COMMENTER">Commenter</option><option value="EDITOR">Editor</option><option value="ADMIN">Admin</option><option value="MEMBER">Membro</option></select>}
                  <button
                    className="btn ghost sm"
                    onClick={() => void editUser(u)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => void resetUser(u)}
                  >
                    Resetar senha
                  </button>
                  {u.id !== user?.id && (
                    <button className="btn ghost sm" onClick={() => void toggleSuspended(u)}>{u.suspended ? "Reativar" : "Suspender"}</button>
                  )}
                  {u.id !== user?.id && (
                    <button
                      className="btn ghost sm"
                      onClick={() =>
                        void api
                          .revokeUserSessions(u.id)
                          .then(() => toast("ok", "Sessões revogadas."))
                          .catch((e) => toast("error", String(e)))
                      }
                    >
                      Revogar sessões
                    </button>
                  )}
                  {u.id !== user?.id && u.role !== "OWNER" && (
                    <button
                      className="btn sm"
                      onClick={() =>
                        void api
                          .deleteUser(u.id)
                          .then(() =>
                            setUsers((x) => x.filter((v) => v.id !== u.id)),
                          )
                          .catch((e) => toast("error", String(e)))
                      }
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <AssetSourceAdmin />
        <div className="account-card">
          <b>Plugins e provedores ativos</b>
          {catalog?.plugins.map((p) => (
            <div className="plugin-admin" key={p.id}>
              <b>{p.name}</b>
              <span className="faint">
                {p.id} · {p.tools.length} ferramentas
              </span>
              <span className="faint">{p.description}</span>
            </div>
          ))}
          <hr />
          {catalog?.providers.map((p) => (
            <div className="plugin-admin" key={p.id}>
              <b>{p.name}</b>
              <span className="faint">
                {p.kinds.join(", ")} ·{" "}
                {p.ready ? "pronto" : "precisa configuração"}
              </span>
              <span className="faint">Licença: {p.licenseSummary}</span>
            </div>
          ))}
          <p className="hint">
            Plugin com código: registre em{" "}
            <code>packages/plugins/src/&lt;plugin&gt;/index.ts</code> e adicione
            ao catálogo embutido. Fonte de assets sem código: use{" "}
            <code>asset_source_add</code>, informando URL, campos e licença.
          </p>
        </div>
      </section>
    );
  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <section className="workspace-section">
      <div className="workspace-head">
        <div>
          <h1>Biblioteca</h1>
          <p className="muted">
            Arquivos da sua conta disponíveis para inserir nos projetos.
          </p>
        </div>
        <>
          <input
            ref={input}
            hidden
            type="file"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <button
            className="btn primary"
            onClick={() => input.current?.click()}
          >
            Enviar arquivo
          </button>
        </>
      </div>
      <input
        className="field"
        placeholder="Buscar na biblioteca"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? (
        <p className="muted">Carregando…</p>
      ) : (
        <ul className="resource-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <div>
                <b>{a.name}</b>
                <span className="faint">
                  {a.mime} · {Math.ceil(a.size / 1024)} KB · origem:{" "}
                  {a.source || "upload"}
                </span>
                <span className="faint">
                  licença: {a.license?.name || "informada pela conta"}
                  {a.credit ? ` · crédito: ${a.credit}` : ""}
                </span>
              </div>
              <button
                className="btn ghost sm"
                onClick={() =>
                  void api
                    .libraryRemove(a.id)
                    .then(() =>
                      setAssets((x) => x.filter((v) => v.id !== a.id)),
                    )
                    .catch((e) => toast("error", String(e)))
                }
              >
                Remover
              </button>
            </li>
          ))}
          {!filtered.length && (
            <li className="muted">Nenhum arquivo encontrado.</li>
          )}
        </ul>
      )}
    </section>
  );
}

function McpGuide() {
  const [client, setClient] = useState('Claude Code');
  const [token, setToken] = useState('TOKEN');
  const endpoint = `${location.origin}/mcp`;
  const command = client === 'Claude Code' ? `claude mcp add --transport http stylo ${endpoint} --header "Authorization: Bearer ${token}"` : '';
  const json = JSON.stringify({ mcpServers: { stylo: { url: endpoint, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
  const value = client === 'Claude Code' ? command : json;
  return <div className="account-card"><div className="workspace-head"><b>Guia de conexão</b><select className="field" value={client} onChange={(e) => setClient(e.target.value)}><option>Claude Code</option><option>Claude Desktop</option><option>Codex</option><option>Cursor</option><option>Windsurf</option><option>OpenCode</option><option>Quine</option><option>OpenCog</option><option>Cliente MCP genérico</option></select></div><label className="small">Token Bearer<input className="field" value={token} onChange={(e) => setToken(e.target.value)} /></label><p className="hint">Endpoint: <code>{endpoint}</code> · transporte HTTP.</p><div className="codebox"><pre className="code">{value}</pre><button className="btn ghost sm" onClick={() => void navigator.clipboard.writeText(value).then(() => toast('ok', 'Configuração copiada.'))}>Copiar</button></div></div>;
}

function AssetSourceAdmin() {
  const [sources, setSources] = useState<Array<{ id?: string; name: string; searchUrl: string; resultsPath: string; fields: { id: string; title: string; download: string }; license: { name: string; commercial: boolean; attribution: string } }>>([]);
  const [name, setName] = useState('');
  const [searchUrl, setSearchUrl] = useState('https://exemplo.test/search?q={consulta}&page={pagina}');
  const [resultsPath, setResultsPath] = useState('results');
  const [license, setLicense] = useState('CC0');
  useEffect(() => { void api.assetSources().then((x) => setSources(x.sources as typeof sources)).catch(() => setSources([])); }, []);
  const add = async () => { try { const source = { name, searchUrl, kinds: ['image'], resultsPath, fields: { id: 'id', title: 'title', download: 'download' }, license: { name: license, commercial: true, attribution: 'optional' } }; const saved = await api.addAssetSource(source) as typeof sources[number]; setSources((x) => [...x.filter((v) => v.name !== saved.name), saved]); setName(''); toast('ok', 'Fonte de assets cadastrada.'); } catch (e) { toast('error', String(e)); } };
  const remove = async (sourceName: string) => { try { await api.removeAssetSource(sourceName); setSources((x) => x.filter((v) => v.name !== sourceName)); toast('ok', 'Fonte removida.'); } catch (e) { toast('error', String(e)); } };
  return <div className="account-card"><b>Fontes declarativas de assets</b><p className="hint">Cadastre uma API JSON sem enviar código executável. A licença é obrigatória.</p><div className="row wrap"><input className="field" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} /><input className="field" placeholder="URL com {consulta}" value={searchUrl} onChange={(e) => setSearchUrl(e.target.value)} /><input className="field" placeholder="resultsPath" value={resultsPath} onChange={(e) => setResultsPath(e.target.value)} /><input className="field" placeholder="Licença" value={license} onChange={(e) => setLicense(e.target.value)} /><button className="btn primary sm" disabled={!name.trim()} onClick={() => void add()}>Cadastrar fonte</button></div><ul className="resource-list">{sources.map((s) => <li key={s.name}><div><b>{s.name}</b><span className="faint">{s.searchUrl} · licença {s.license.name}</span></div><button className="btn ghost sm" onClick={() => void remove(s.name)}>Remover</button></li>)}{!sources.length && <li className="faint">Nenhuma fonte personalizada.</li>}</ul></div>;
}
