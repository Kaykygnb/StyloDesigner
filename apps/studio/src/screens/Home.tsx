// A entrada do painel: seus projetos, criar um novo e conectar um agente.
import { useMemo, useRef, useState } from 'react';
import { thumbUrl } from '../lib/api';
import { createProject, loadProjects, openProject, persistAccountPreferences, setLanguage, signedOut, toast, useApp } from '../lib/app';
import * as api from '../lib/api';
import { AppearanceMenu } from '../ui/AppearanceMenu';
import { Icon } from '../ui/Icon';
import { WorkspacePanel } from './WorkspacePanel';
import { formatDate, SUPPORTED_LANGUAGES } from '../lib/i18n';

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

function fileSize(bytes: number, language: 'pt-BR' | 'en-US'): string {
  if (bytes < 1024) return `${bytes} B`;
  const value = bytes / 1024;
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${language === 'en-US' ? 'KB' : 'KB'}`;
}

export function Home() {
  const projects = useApp((s) => s.projects);
  const error = useApp((s) => s.projectsError);
  const user = useApp((s) => s.user);
  const auth = useApp((s) => s.auth);
  const busy = useApp((s) => s.busy);
  const presence = useApp((s) => s.presence);
  const language = useApp((s) => s.language);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState<'projects' | 'library' | 'agents' | 'admin' | 'account'>('projects');
  const importInput = useRef<HTMLInputElement>(null);
  const homeMain = useRef<HTMLElement>(null);

  const shown = useMemo(() => (projects ?? []).filter((p) => (p.name || pretty(p.file)).toLowerCase().includes(query.trim().toLowerCase())), [projects, query]);
  const en = language === 'en-US';
  const canAdmin = auth?.mode === 'local' || user?.role === 'OWNER' || user?.role === 'ADMIN';
  const homeTabs: Array<[typeof area, string, string]> = [
    ['projects', en ? 'Create' : 'Criar', 'home'],
    ['library', en ? 'Library' : 'Biblioteca', 'library'],
  ];
  const secondaryTabs: Array<[typeof area, string, string]> = [];
  if (canAdmin) secondaryTabs.push(['agents', en ? 'Agents' : 'Agentes', 'users'], ['admin', en ? 'Admin' : 'Administração', 'settings']);
  secondaryTabs.push(['account', en ? 'Account' : 'Conta', 'user']);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(false);
    await createProject(name);
    setName('');
  };
  const startFrom = (template: string) => { setName(template); setCreating(true); homeMain.current?.scrollTo({ top: 0, behavior: 'smooth' }); };

  const exportProject = async (file: string) => {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(file)}`);
      if (!response.ok) throw new Error(en ? 'The project could not be downloaded.' : 'Não foi possível baixar o projeto.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file; a.click();
      URL.revokeObjectURL(url);
      toast('ok', en ? 'Project exported.' : 'Projeto exportado.');
    } catch (e) { toast('error', String(e)); }
  };
  const importProjectFile = async (file?: File) => {
    if (!file) return;
    try {
      const doc = JSON.parse(await file.text());
      if (!Array.isArray(doc?.pages)) throw new Error(en ? 'This file does not contain project pages.' : 'O arquivo não contém páginas de projeto.');
      const created = await api.importProject(file.name.replace(/\.(stylo|json)$/i, ''), doc);
      await loadProjects();
      toast('ok', en ? `Project imported as ${created.file}.` : `Projeto importado como ${created.file}.`);
    } catch (e) { toast('error', String(e)); }
    finally { if (importInput.current) importInput.current.value = ''; }
  };

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand"><span className="logo">S</span> Stylo</div>
        <span className="spacer" />
        <nav className="home-nav" aria-label={en ? 'Workspace' : 'Área de trabalho'}>
          {homeTabs.map(([id, label, icon]) => <button key={id} aria-label={`${en ? 'Open' : 'Abrir'} ${label}`} className={`btn ghost${area === id ? ' active' : ''}`} onClick={() => setArea(id)}><Icon name={icon} size={14} /><span className="nav-label">{label}</span></button>)}
          <details className="home-more">
            <summary className="btn ghost" aria-label={en ? 'More workspace areas' : 'Mais áreas do workspace'}><Icon name="more" size={15} /><span className="nav-label">{en ? 'More' : 'Mais'}</span></summary>
            <div className="home-more-menu">
              {secondaryTabs.map(([id, label, icon]) => <button key={id} aria-label={label} className={`btn ghost${area === id ? ' active' : ''}`} onClick={(event) => { setArea(id); event.currentTarget.closest('details')?.removeAttribute('open'); }}><Icon name={icon} size={14} /><span>{label}</span></button>)}
            </div>
          </details>
        </nav>
        <label className="language-picker" title={en ? 'Interface language' : 'Idioma da interface'}>
          <Icon name="globe" size={14} />
          <select aria-label={en ? 'Interface language' : 'Idioma da interface'} value={language} onChange={(e) => { const next = e.target.value as typeof language; setLanguage(next); persistAccountPreferences({ language: next }); }}>
            {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.short} · {item.label}</option>)}
          </select>
        </label>
        {presence && presence.agents.length > 0 && <span className="badge"><span className="dot" style={{ background: 'var(--ok)' }} /> {presence.agents.length} {en ? 'agent(s) connected' : 'agente(s) conectado(s)'}</span>}
        <AppearanceMenu />
        {auth?.mode === 'accounts' && user && (
          <button className="btn ghost home-signout" onClick={async () => { try { await api.logout(); await signedOut(); } catch (error) { toast('error', error instanceof Error ? error.message : String(error)); } }} title={user.email}><Icon name="user" size={14} /><span>{en ? 'Sign out' : 'Sair'}</span><span className="logout-name">({user.name})</span></button>
        )}
      </header>

      <main className="home-main" ref={homeMain}>
        {area !== 'projects' ? <WorkspacePanel tab={area} /> : <>
        <div className="home-title">
          <div className="home-intro">
            <span className="home-greeting">{en ? `Hello, ${user?.name || 'creator'}.` : `Olá, ${user?.name || 'criador'}.`}</span>
            <span className="eyebrow">{en ? 'YOUR CREATIVE SPACE' : 'SEU ESPAÇO DE CRIAÇÃO'}</span>
            <h1>{en ? 'Make something brilliant.' : 'Vamos criar algo lindo?'}</h1>
            <p className="muted home-subtitle">{en ? 'Pick a starting point.' : 'Escolha por onde começar.'}</p>
            <div className="home-quick-actions"><button className="btn primary" aria-label={en ? 'New project' : 'Novo projeto'} onClick={() => setCreating(true)} disabled={busy > 0}><Icon name="plus" size={15} /> {en ? 'Create project' : 'Criar projeto'}</button><button className="btn ghost" onClick={() => setArea('library')}><Icon name="library" size={15} /> {en ? 'Open library' : 'Abrir biblioteca'}</button></div>
          </div>
          <span className="spacer" />
          <div className="search"><Icon name="search" size={15} /><input className="field" placeholder={en ? 'Search projects' : 'Buscar projeto'} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={en ? 'Search projects' : 'Buscar projeto'} />{query && <button type="button" className="search-clear" aria-label={en ? 'Clear search' : 'Limpar busca'} title={en ? 'Clear search' : 'Limpar busca'} onClick={() => setQuery('')}><Icon name="close" size={12} /></button>}</div>
          <input ref={importInput} hidden type="file" accept=".stylo,.json,application/json" onChange={(e) => void importProjectFile(e.target.files?.[0])} />
          <button className="btn" onClick={() => importInput.current?.click()} disabled={busy > 0}><Icon name="upload" size={14} /> {en ? 'Import project' : 'Importar projeto'}</button>
        </div>

        {creating && (
          <form className="new-project" onSubmit={submit}>
            <input autoFocus className="field" placeholder={en ? 'Project name (e.g. Plant shop)' : 'Nome do projeto (ex.: Loja de plantas)'} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={en ? 'Project name' : 'Nome do projeto'} />
            <button className="btn primary" type="submit">{en ? 'Create' : 'Criar'}</button>
            <button className="btn" type="button" onClick={() => { setCreating(false); setName(''); }}>{en ? 'Cancel' : 'Cancelar'}</button>
          </form>
        )}

        <section className="starter-strip" aria-labelledby="starter-title">
          <div className="starter-heading"><div><span className="eyebrow">{en ? 'START HERE' : 'COMECE AQUI'}</span><h2 id="starter-title">{en ? 'Choose your starting point.' : 'Escolha seu ponto de partida.'}</h2></div><button className="btn ghost sm" onClick={() => setArea('library')}>{en ? 'See all' : 'Ver tudo'}</button></div>
          <div className="starter-grid">
            {[
              en ? ['Editorial', 'Editorial portfolio', 'linear-gradient(135deg, #f7d7c4, #6b3e55)'] : ['Editorial', 'Portfólio editorial', 'linear-gradient(135deg, #f7d7c4, #6b3e55)'],
              en ? ['Studio', 'Product landing page', 'linear-gradient(135deg, #c5c0ff, #20203f)'] : ['Studio', 'Landing de produto', 'linear-gradient(135deg, #c5c0ff, #20203f)'],
              en ? ['Atelier', 'Brand & identity', 'linear-gradient(135deg, #ffe29a, #ef6f61)'] : ['Atelier', 'Marca & identidade', 'linear-gradient(135deg, #ffe29a, #ef6f61)'],
            ].map(([kind, title, background]) => <button key={title} className="starter-card" onClick={() => startFrom(title)}><span className="starter-art" style={{ background }}><i /><i /><i /></span><span className="starter-copy"><small>{kind}</small><b>{title}</b><em>{en ? 'Start now →' : 'Começar agora →'}</em></span></button>)}
          </div>
        </section>

        {error && (
          <div className="notice error">{en ? 'I could not load your projects:' : 'Não consegui carregar os projetos:'} {error} <button className="btn sm" onClick={() => void loadProjects()}>{en ? 'Try again' : 'Tentar de novo'}</button></div>
        )}

        {projects === null && !error && <div className="home-loading" aria-live="polite"><div className="loading-heading"><span /><span /></div><div className="loading-cards"><i /><i /><i /></div><p><span className="spinner" /> {en ? 'Loading your space…' : 'Carregando seu espaço…'}</p></div>}

        {projects && !projects.length && !error && (
          <div className="empty-home">
            <div className="empty-home-art"><span /><span /><span /></div>
            <h2>{en ? 'Start your first project' : 'Comece o seu primeiro projeto'}</h2>
            <p className="muted">{en ? 'A blank canvas, ready for your idea.' : 'Uma tela em branco, pronta para sua ideia.'}</p>
            <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> {en ? 'Create project' : 'Criar projeto'}</button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <section className="project-list-section" aria-labelledby="project-list-title">
          <div className="project-list-heading"><h2 id="project-list-title">{en ? 'Your projects' : 'Seus projetos'}</h2><span className="faint small">{projects.length} {en ? (projects.length === 1 ? 'project' : 'projects') : (projects.length === 1 ? 'projeto' : 'projetos')}</span></div>
          <ul className="cards">
            {shown.map((p) => (
              <li key={p.file}>
                <button className="card" onClick={() => void openProject(p.file)} aria-label={`${en ? 'Open' : 'Abrir'} ${p.name || pretty(p.file)}`}>
                  <div className="thumb">{p.thumb > 0 ? <img src={thumbUrl(p.file, p.thumb)} alt="" loading="lazy" /> : <Icon name="frame" size={28} />}</div>
                  <div className="card-body">
                    <b className="ellipsis">{p.name || pretty(p.file)}</b>
                    <span className="faint small project-meta"><span>{ago(p.modified, language)}</span><span>{fileSize(p.size, language)}</span></span>
                  </div>
                </button>
                <button className="btn ghost sm" aria-label={`${en ? 'Download a copy of' : 'Baixar uma cópia de'} ${p.name || pretty(p.file)}`} onClick={() => void exportProject(p.file)}>{en ? 'Download copy' : 'Baixar cópia'}</button>
              </li>
            ))}
            {!shown.length && <li className="muted pad">{en ? 'Nothing found.' : 'Nada encontrado.'} <button className="btn ghost sm" onClick={() => setQuery('')}>{en ? 'Clear search' : 'Limpar busca'}</button></li>}
          </ul>
          </section>
        )}

        {canAdmin && <section className="connect-card connection-invite">
          <div className="empty-art"><Icon name="spark" size={21} /></div>
          <div className="grow"><h3>{en ? 'Create with a creative partner' : 'Crie com um parceiro criativo'}</h3><p className="muted">{en ? 'Connect an AI tool when you want an extra pair of hands.' : 'Conecte uma ferramenta de IA quando quiser uma mão extra.'}</p></div>
          <button className="btn" onClick={() => setArea('agents')}>{en ? 'Open connections' : 'Abrir conexões'}</button>
        </section>}
        </>}
      </main>
    </div>
  );
}
