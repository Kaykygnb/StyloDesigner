// A entrada do painel: seus projetos, criar um novo e conectar um agente.
import { useMemo, useRef, useState } from 'react';
import { thumbUrl } from '../lib/api';
import { createProject, loadProjects, openProject, signedOut, toast, useApp } from '../lib/app';
import * as api from '../lib/api';
import { connectCommand } from '../editor/Panels';
import { AppearanceMenu } from '../ui/AppearanceMenu';
import { Icon } from '../ui/Icon';
import { WorkspacePanel } from './WorkspacePanel';
import { formatDate, t } from '../lib/i18n';

const pretty = (file: string) => file.replace(/\.json$/i, '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

function ago(ms: number, language: 'pt-BR' | 'en-US'): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (language === 'en-US') {
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} day${s >= 172800 ? 's' : ''} ago`;
    return formatDate(language, ms);
  }
  if (s < 60) return 'agora há pouco';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} dia${s >= 172800 ? 's' : ''}`;
  return formatDate(language, ms);
}

export function Home() {
  const projects = useApp((s) => s.projects);
  const error = useApp((s) => s.projectsError);
  const user = useApp((s) => s.user);
  const auth = useApp((s) => s.auth);
  const role = useApp((s) => s.role);
  const busy = useApp((s) => s.busy);
  const presence = useApp((s) => s.presence);
  const language = useApp((s) => s.language);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState<'projects' | 'library' | 'agents' | 'admin' | 'account'>('projects');
  const importInput = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => (projects ?? []).filter((p) => (p.name || pretty(p.file)).toLowerCase().includes(query.trim().toLowerCase())), [projects, query]);
  const cmd = connectCommand();
  const canAdmin = auth?.mode === 'local' || role === 'OWNER' || role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'ADMIN';
  const homeTabs = ([['projects', 'home.projects'], ['library', 'home.library'], ['agents', 'home.agents'], ...(canAdmin ? [['admin', 'home.admin'] as const] : []), ['account', 'home.account']] as const);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(false);
    await createProject(name);
    setName('');
  };

  const exportProject = async (file: string) => {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(file)}`);
      if (!response.ok) throw new Error('Não foi possível baixar o projeto.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file; a.click();
      URL.revokeObjectURL(url);
      toast('ok', 'Projeto exportado.');
    } catch (e) { toast('error', String(e)); }
  };
  const importProjectFile = async (file?: File) => {
    if (!file) return;
    try {
      const doc = JSON.parse(await file.text());
      if (!Array.isArray(doc?.pages)) throw new Error('O arquivo não contém páginas de projeto.');
      const created = await api.importProject(file.name.replace(/\.json$/i, ''), doc);
      await loadProjects();
      toast('ok', `Projeto importado como ${created.file}.`);
    } catch (e) { toast('error', String(e)); }
    finally { if (importInput.current) importInput.current.value = ''; }
  };

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand"><span className="logo">S</span> Stylo</div>
        <span className="spacer" />
        <nav className="home-nav" aria-label="Área de trabalho">
          {homeTabs.map(([id, key]) => <button key={id} className={`btn ghost${area === id ? ' active' : ''}`} onClick={() => setArea(id)}>{t(language, key)}</button>)}
        </nav>
        {presence && presence.agents.length > 0 && <span className="badge"><span className="dot" style={{ background: 'var(--ok)' }} /> {presence.agents.length} agente(s) conectado(s)</span>}
        <AppearanceMenu />
        {auth?.mode === 'accounts' && user && (
          <button className="btn ghost" onClick={async () => { await api.logout().catch(() => {}); await signedOut(); }} title={user.email}>Sair ({user.name})</button>
        )}
      </header>

      <main className="home-main">
        {area !== 'projects' ? <WorkspacePanel tab={area} /> : <>
        <div className="home-title">
          <div>
            <h1>Projetos</h1>
            <p className="muted">Seus sites e aplicativos. Abra um para editar, ou peça a um agente para criar.</p>
          </div>
          <span className="spacer" />
          <div className="search"><Icon name="search" size={15} /><input className="field" placeholder="Buscar projeto" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar projeto" /></div>
          <input ref={importInput} hidden type="file" accept="application/json,.json" onChange={(e) => void importProjectFile(e.target.files?.[0])} />
          <button className="btn" onClick={() => importInput.current?.click()} disabled={busy > 0}>Importar JSON</button>
          <button className="btn primary" onClick={() => setCreating(true)} disabled={busy > 0}><Icon name="plus" size={15} /> Novo projeto</button>
        </div>

        {creating && (
          <form className="new-project" onSubmit={submit}>
            <input autoFocus className="field" placeholder="Nome do projeto (ex.: Loja de plantas)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Nome do projeto" />
            <button className="btn primary" type="submit">Criar</button>
            <button className="btn" type="button" onClick={() => { setCreating(false); setName(''); }}>Cancelar</button>
          </form>
        )}

        {error && (
          <div className="notice error">Não consegui carregar os projetos: {error} <button className="btn sm" onClick={() => void loadProjects()}>Tentar de novo</button></div>
        )}

        {projects === null && !error && <div className="center-note"><span className="spinner" /> Carregando…</div>}

        {projects && !projects.length && !error && (
          <div className="empty-home">
            <h2>Comece o seu primeiro projeto</h2>
            <p className="muted">Crie um projeto em branco e monte as telas aqui, ou conecte um agente de IA e peça para ele montar.</p>
            <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Criar projeto</button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <ul className="cards">
            {shown.map((p) => (
              <li key={p.file}>
                <button className="card" onClick={() => void openProject(p.file)} aria-label={`Abrir ${p.name || pretty(p.file)}`}>
                  <div className="thumb">{p.thumb > 0 ? <img src={thumbUrl(p.file, p.thumb)} alt="" loading="lazy" /> : <Icon name="frame" size={28} />}</div>
                  <div className="card-body">
                    <b className="ellipsis">{p.name || pretty(p.file)}</b>
                    <span className="faint small">{ago(p.modified, language)}</span>
                  </div>
                </button>
                <button className="btn ghost sm" onClick={() => void exportProject(p.file)}>Exportar JSON</button>
              </li>
            ))}
            {!shown.length && <li className="muted pad">Nenhum projeto com esse nome.</li>}
          </ul>
        )}

        <section className="connect-card">
          <h3><Icon name="spark" size={16} /> Conectar um agente de IA</h3>
          <p className="muted">Qualquer agente que fale MCP (Claude Code, Codex, Cursor…) pode criar e editar projetos aqui. Rode este comando no computador onde o agente está:</p>
          <div className="codebox"><code>{cmd}</code><button className="btn ghost icon sm" title="Copiar" onClick={() => navigator.clipboard.writeText(cmd).then(() => toast('ok', 'Copiado.'), () => toast('error', 'Não consegui copiar.'))}><Icon name="copy" size={14} /></button></div>
        </section>
        </>}
      </main>
    </div>
  );
}
