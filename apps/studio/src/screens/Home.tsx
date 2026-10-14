// A entrada do painel: seus projetos, criar um novo e conectar um agente.
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { thumbUrl } from '../lib/api';
import { createProject, loadProjects, type Language, openProject, persistAccountPreferences, setLanguage, signedOut, toast, useApp } from '../lib/app';
import * as api from '../lib/api';
import { AppearanceMenu } from '../ui/AppearanceMenu';
import { Icon } from '../ui/Icon';
import { formatRelativeTime, SUPPORTED_LANGUAGES, t, tp } from '../lib/i18n';

const pretty = (file: string) => file.replace(/\.json$/i, '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

// Biblioteca, conexões, administração e conta: carregadas só quando a pessoa abre uma dessas abas.
const WorkspacePanel = lazy(() => import('./WorkspacePanel').then((m) => ({ default: m.WorkspacePanel })));

function ago(ms: number, language: Language): string {
  return formatRelativeTime(language, new Date(ms).toISOString());
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const value = bytes / 1024;
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} KB`;
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
  const canAdmin = auth?.mode === 'local' || user?.role === 'OWNER' || user?.role === 'ADMIN';
  const homeTabs: Array<[typeof area, string, string]> = [
    ['projects', t(language, 'actions.create'), 'home'],
    ['library', t(language, 'home.library'), 'library'],
  ];
  const secondaryTabs: Array<[typeof area, string, string]> = [];
  if (canAdmin) secondaryTabs.push(['agents', t(language, 'tabs.agents'), 'users'], ['admin', t(language, 'ui.home.admin'), 'settings']);
  secondaryTabs.push(['account', t(language, 'ui.home.account'), 'user']);

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
      if (!response.ok) throw new Error(t(language, 'ui.home.theProjectCouldNotBe'));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file; a.click();
      URL.revokeObjectURL(url);
      toast('ok', t(language, 'ui.home.projectExported'));
    } catch (e) { toast('error', String(e)); }
  };
  const importProjectFile = async (file?: File) => {
    if (!file) return;
    try {
      const doc = JSON.parse(await file.text());
      if (!Array.isArray(doc?.pages)) throw new Error(t(language, 'ui.home.thisFileDoesNotContain'));
      const created = await api.importProject(file.name.replace(/\.(stylo|json)$/i, ''), doc);
      await loadProjects();
      toast('ok', t(language, 'ui.home.projectImported', { file: created.file }));
    } catch (e) { toast('error', String(e)); }
    finally { if (importInput.current) importInput.current.value = ''; }
  };

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand"><span className="logo">S</span> Stylo</div>
        <span className="spacer" />
        <nav className="home-nav" aria-label={t(language, 'ui.home.workspace')}>
          {homeTabs.map(([id, label, icon]) => <button key={id} aria-label={t(language, 'ui.home.openArea', { name: label })} className={`btn ghost${area === id ? ' active' : ''}`} onClick={() => setArea(id)}><Icon name={icon} size={14} /><span className="nav-label">{label}</span></button>)}
          <details className="home-more">
            <summary className="btn ghost" aria-label={t(language, 'ui.home.moreWorkspaceAreas')}><Icon name="more" size={15} /><span className="nav-label">{t(language, 'ui.home.more')}</span></summary>
            <div className="home-more-menu">
              {secondaryTabs.map(([id, label, icon]) => <button key={id} aria-label={label} className={`btn ghost${area === id ? ' active' : ''}`} onClick={(event) => { setArea(id); event.currentTarget.closest('details')?.removeAttribute('open'); }}><Icon name={icon} size={14} /><span>{label}</span></button>)}
            </div>
          </details>
        </nav>
        <label className="language-picker" title={t(language, 'ui.home.interfaceLanguage')}>
          <Icon name="globe" size={14} />
          <select aria-label={t(language, 'ui.home.interfaceLanguage')} value={language} onChange={(e) => { const next = e.target.value as typeof language; setLanguage(next); persistAccountPreferences({ language: next }); }}>
            {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.short} · {item.label}</option>)}
          </select>
        </label>
        {presence && presence.agents.length > 0 && <span className="badge"><span className="dot" style={{ background: 'var(--ok)' }} /> {tp(language, 'ui.home.agentsConnected', presence.agents.length)}</span>}
        <AppearanceMenu />
        {auth?.mode === 'accounts' && user && (
          <button className="btn ghost home-signout" onClick={async () => { try { await api.logout(); await signedOut(); } catch (error) { toast('error', error instanceof Error ? error.message : String(error)); } }} title={user.email}><Icon name="user" size={14} /><span>{t(language, 'login.signOut')}</span><span className="logout-name">({user.name})</span></button>
        )}
      </header>

      <main className="home-main" ref={homeMain}>
        {area !== 'projects' ? <Suspense fallback={<div className="center-note"><span className="spinner" /></div>}><WorkspacePanel tab={area} /></Suspense> : <>
        <div className="home-title">
          <div className="home-intro">
            <span className="home-greeting">{t(language, 'ui.home.greeting', { name: user?.name || t(language, 'ui.home.greetingFallback') })}</span>
            <span className="eyebrow">{t(language, 'ui.home.yourCreativeSpace')}</span>
            <h1>{t(language, 'ui.home.makeSomethingBrilliant')}</h1>
            <p className="muted home-subtitle">{t(language, 'ui.home.pickAStartingPoint')}</p>
            <div className="home-quick-actions"><button className="btn primary" aria-label={t(language, 'ui.home.newProject')} onClick={() => setCreating(true)} disabled={busy > 0}><Icon name="plus" size={15} /> {t(language, 'ui.home.createProject')}</button><button className="btn ghost" onClick={() => setArea('library')}><Icon name="library" size={15} /> {t(language, 'ui.home.openLibrary')}</button></div>
          </div>
          <span className="spacer" />
          <div className="search"><Icon name="search" size={15} /><input className="field" placeholder={t(language, 'ui.home.searchProjects')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t(language, 'ui.home.searchProjects')} />{query && <button type="button" className="search-clear" aria-label={t(language, 'ui.home.clearSearch')} title={t(language, 'ui.home.clearSearch')} onClick={() => setQuery('')}><Icon name="close" size={12} /></button>}</div>
          <input ref={importInput} hidden type="file" accept=".stylo,.json,application/json" onChange={(e) => void importProjectFile(e.target.files?.[0])} />
          <button className="btn" onClick={() => importInput.current?.click()} disabled={busy > 0}><Icon name="upload" size={14} /> {t(language, 'ui.home.importProject')}</button>
        </div>

        {creating && (
          <form className="new-project" onSubmit={submit}>
            <input autoFocus className="field" placeholder={t(language, 'ui.home.projectNameEGPlant')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={t(language, 'ui.home.projectName')} />
            <button className="btn primary" type="submit">{t(language, 'actions.create')}</button>
            <button className="btn" type="button" onClick={() => { setCreating(false); setName(''); }}>{t(language, 'agents.cancel')}</button>
          </form>
        )}

        <section className="starter-strip" aria-labelledby="starter-title">
          <div className="starter-heading"><div><span className="eyebrow">{t(language, 'ui.home.startHere')}</span><h2 id="starter-title">{t(language, 'ui.home.chooseYourStartingPoint')}</h2></div><button className="btn ghost sm" onClick={() => setArea('library')}>{t(language, 'ui.home.seeAll')}</button></div>
          <div className="starter-grid">
            {[
              ['Editorial', t(language, 'ui.home.starterEditorial'), 'linear-gradient(135deg, #f7d7c4, #6b3e55)'],
              ['Studio', t(language, 'ui.home.starterStudio'), 'linear-gradient(135deg, #c5c0ff, #20203f)'],
              ['Atelier', t(language, 'ui.home.starterAtelier'), 'linear-gradient(135deg, #ffe29a, #ef6f61)'],
            ].map(([kind, title, background]) => <button key={title} className="starter-card" onClick={() => startFrom(title)}><span className="starter-art" style={{ background }}><i /><i /><i /></span><span className="starter-copy"><small>{kind}</small><b>{title}</b><em>{t(language, 'ui.home.startNow')}</em></span></button>)}
          </div>
        </section>

        {error && (
          <div className="notice error">{t(language, 'ui.home.iCouldNotLoadYour')} {error} <button className="btn sm" onClick={() => void loadProjects()}>{t(language, 'ui.home.tryAgain')}</button></div>
        )}

        {projects === null && !error && <div className="home-loading" aria-live="polite"><div className="loading-heading"><span /><span /></div><div className="loading-cards"><i /><i /><i /></div><p><span className="spinner" /> {t(language, 'ui.home.loadingYourSpace')}</p></div>}

        {projects && !projects.length && !error && (
          <div className="empty-home">
            <div className="empty-home-art"><span /><span /><span /></div>
            <h2>{t(language, 'ui.home.startYourFirstProject')}</h2>
            <p className="muted">{t(language, 'ui.home.aBlankCanvasReadyFor')}</p>
            <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> {t(language, 'ui.home.createProject')}</button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <section className="project-list-section" aria-labelledby="project-list-title">
          <div className="project-list-heading"><h2 id="project-list-title">{t(language, 'ui.home.yourProjects')}</h2><span className="faint small">{tp(language, 'ui.home.projectsCount', projects.length)}</span></div>
          <ul className="cards">
            {shown.map((p) => (
              <li key={p.file}>
                <button className="card" onClick={() => void openProject(p.file)} aria-label={t(language, 'ui.home.openProjectNamed', { name: p.name || pretty(p.file) })}>
                  <div className="thumb">{p.thumb > 0 ? <img src={thumbUrl(p.file, p.thumb)} alt="" loading="lazy" /> : <Icon name="frame" size={28} />}</div>
                  <div className="card-body">
                    <b className="ellipsis">{p.name || pretty(p.file)}</b>
                    <span className="faint small project-meta"><span>{ago(p.modified, language)}</span><span>{fileSize(p.size)}</span></span>
                  </div>
                </button>
                <button className="btn ghost sm" aria-label={t(language, 'ui.home.downloadCopyOf', { name: p.name || pretty(p.file) })} onClick={() => void exportProject(p.file)}>{t(language, 'ui.home.downloadCopy')}</button>
              </li>
            ))}
            {!shown.length && <li className="muted pad">{t(language, 'ui.home.nothingFound')} <button className="btn ghost sm" onClick={() => setQuery('')}>{t(language, 'ui.home.clearSearch')}</button></li>}
          </ul>
          </section>
        )}

        {canAdmin && <section className="connect-card connection-invite">
          <div className="empty-art"><Icon name="spark" size={21} /></div>
          <div className="grow"><h3>{t(language, 'ui.home.createWithACreativePartner')}</h3><p className="muted">{t(language, 'ui.home.connectAnAiToolWhen')}</p></div>
          <button className="btn" onClick={() => setArea('agents')}>{t(language, 'ui.home.openConnections')}</button>
        </section>}
        </>}
      </main>
    </div>
  );
}
