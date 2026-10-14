// A entrada do painel: seus projetos, criar um novo e conectar um agente.
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { thumbUrl } from '../lib/api';
import { createProject, loadProjects, type Language, openProject, persistAccountPreferences, setLanguage, signedOut, toast, useApp } from '../lib/app';
import * as api from '../lib/api';
import { AppearanceMenu } from '../ui/AppearanceMenu';
import { Brand } from '../ui/Brand';
import { openCommandPalette, useCommands } from '../ui/CommandPalette';
import { LayerStack } from '../ui/LayerStack';
import { Icon } from '../ui/Icon';
import { useTilt } from '../ui/useTilt';
import { formatRelativeTime, SUPPORTED_LANGUAGES, t, tp } from '../lib/i18n';

const pretty = (file: string) => file.replace(/\.json$/i, '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

// Biblioteca, conexões, administração e conta: carregadas só quando a pessoa abre uma dessas abas.
const WorkspacePanel = lazy(() => import('./WorkspacePanel').then((m) => ({ default: m.WorkspacePanel })));

function ago(ms: number, language: Language): string {
  return formatRelativeTime(language, new Date(ms).toISOString());
}

// Cartão de projeto: inclina em 3D e mostra marcas de corte (como numa prova de impressão) ao passar o ponteiro.
function ProjectCard({ file, thumb, name, meta, onOpen }: { file: string; thumb: number; name: string; meta: React.ReactNode; onOpen: () => void }) {
  const tilt = useTilt(5);
  const label = t(useApp((s) => s.language), 'ui.home.openProjectNamed', { name });
  return (
    <button className="card" style={tilt.style} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} onClick={onOpen} aria-label={label}>
      <div className="thumb">{thumb > 0 ? <img src={thumbUrl(file, thumb)} alt="" loading="lazy" /> : <span className="thumb-empty" aria-hidden="true"><i /><i /><i /></span>}</div>
      <div className="card-body">
        <b className="ellipsis">{name}</b>
        <span className="faint small project-meta">{meta}</span>
      </div>
      <span className="crop" aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
  );
}

// Pontos de partida: cada um com uma composição própria de tintas sobrepostas.
function StarterCard({ kind, title, variant, onStart }: { kind: string; title: string; variant: number; onStart: () => void }) {
  const tilt = useTilt(7);
  return (
    <button className="starter-card" style={tilt.style} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} onClick={onStart}>
      <span className={`starter-art sa-${variant}`} aria-hidden="true"><i /><i /><i /><b /></span>
      <span className="starter-copy"><small>{kind}</small><b>{title}</b><em>{t(useApp((s) => s.language), 'ui.home.startNow')}</em></span>
    </button>
  );
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
  const areas: Array<[typeof area, string, string]> = [
    ['projects', t(language, 'top.projects'), 'home'],
    ['library', t(language, 'home.library'), 'library'],
  ];
  if (canAdmin) areas.push(['agents', t(language, 'tabs.agents'), 'users'], ['admin', t(language, 'ui.home.admin'), 'settings']);
  areas.push(['account', t(language, 'ui.home.account'), 'user']);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(false);
    await createProject(name);
    setName('');
  };
  const startFrom = (template: string) => { setName(template); setCreating(true); homeMain.current?.scrollTo({ top: 0, behavior: 'smooth' }); };

  useCommands('home', () => [
    { id: 'home:new', group: t(language, 'ui.command.groupActions'), icon: 'plus', label: t(language, 'ui.home.newProject'), run: () => { setArea('projects'); setCreating(true); } },
    { id: 'home:import', group: t(language, 'ui.command.groupActions'), icon: 'upload', label: t(language, 'ui.home.importProject'), run: () => importInput.current?.click() },
    ...areas.map(([id, label, icon]) => ({ id: `home:area:${id}`, group: t(language, 'ui.command.groupAreas'), icon, label, run: () => setArea(id) })),
    ...(projects ?? []).map((p) => ({ id: `home:open:${p.file}`, group: t(language, 'ui.command.groupProjects'), icon: 'frame', label: p.name || pretty(p.file), keywords: p.file, run: () => void openProject(p.file) })),
  ]);

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
      <aside className="home-side">
        <Brand />
        <button className="side-search" onClick={openCommandPalette} aria-label={t(language, 'ui.command.open')}>
          <Icon name="search" size={14} /><span>{t(language, 'ui.command.open')}</span><kbd>Ctrl K</kbd>
        </button>
        <nav className="home-nav" aria-label={t(language, 'ui.home.workspace')}>
          {areas.map(([id, label, icon]) => (
            <button key={id} aria-current={area === id ? 'page' : undefined} className={`home-nav-btn${area === id ? ' on' : ''}`} onClick={() => setArea(id)}>
              <Icon name={icon} size={16} /><span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <span className="spacer" />
        {presence && presence.agents.length > 0 && <span className="side-presence"><span className="dot ok" /> {tp(language, 'ui.home.agentsConnected', presence.agents.length)}</span>}
        <div className="home-side-foot">
          <label className="language-picker" title={t(language, 'ui.home.interfaceLanguage')}>
            <Icon name="globe" size={14} />
            <select aria-label={t(language, 'ui.home.interfaceLanguage')} value={language} onChange={(e) => { const next = e.target.value as typeof language; setLanguage(next); persistAccountPreferences({ language: next }); }}>
              {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.short} · {item.label}</option>)}
            </select>
          </label>
          <AppearanceMenu />
          {auth?.mode === 'accounts' && user && (
            <button className="btn ghost home-signout" aria-label={`${t(language, 'login.signOut')} (${user.name})`} onClick={async () => { try { await api.logout(); await signedOut(); } catch (error) { toast('error', error instanceof Error ? error.message : String(error)); } }} title={user.email}><Icon name="user" size={14} /><span>{t(language, 'login.signOut')}</span><span className="logout-name">({user.name})</span></button>
          )}
        </div>
      </aside>

      <main className="home-main" ref={homeMain}>
        {area !== 'projects' ? <Suspense fallback={<div className="center-note"><span className="spinner" /></div>}><WorkspacePanel tab={area} /></Suspense> : <>
        <section className="home-hero">
          <div className="home-intro">
            <span className="home-greeting">{t(language, 'ui.home.greeting', { name: user?.name || t(language, 'ui.home.greetingFallback') })}</span>
            <h1>{t(language, 'ui.home.makeSomethingBrilliant')}</h1>
            <p className="home-subtitle">{t(language, 'ui.home.pickAStartingPoint')}</p>
            {creating ? (
              <form className="new-project" onSubmit={submit}>
                <input autoFocus className="field" placeholder={t(language, 'ui.home.projectNameEGPlant')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={t(language, 'ui.home.projectName')} onKeyDown={(e) => { if (e.key === 'Escape') { setCreating(false); setName(''); } }} />
                <button className="btn primary" type="submit">{t(language, 'actions.create')}</button>
                <button className="btn ghost" type="button" onClick={() => { setCreating(false); setName(''); }}>{t(language, 'agents.cancel')}</button>
              </form>
            ) : (
              <div className="home-quick-actions">
                <button className="btn primary lg" aria-label={t(language, 'ui.home.newProject')} onClick={() => setCreating(true)} disabled={busy > 0}><Icon name="plus" size={16} /> {t(language, 'ui.home.createProject')}</button>
                <button className="btn lg" onClick={() => importInput.current?.click()} disabled={busy > 0}><Icon name="upload" size={15} /> {t(language, 'ui.home.importProject')}</button>
              </div>
            )}
            <input ref={importInput} hidden type="file" accept=".stylo,.json,application/json" onChange={(e) => void importProjectFile(e.target.files?.[0])} />
          </div>
          <LayerStack className="home-stack" />
        </section>

        <section className="starter-strip" aria-labelledby="starter-title">
          <div className="section-heading"><h2 id="starter-title">{t(language, 'ui.home.chooseYourStartingPoint')}</h2><button className="btn ghost sm" onClick={() => setArea('library')}>{t(language, 'ui.home.seeAll')}</button></div>
          <div className="starter-grid">
            {[
              ['Editorial', t(language, 'ui.home.starterEditorial')],
              ['Studio', t(language, 'ui.home.starterStudio')],
              ['Atelier', t(language, 'ui.home.starterAtelier')],
            ].map(([kind, title], i) => <StarterCard key={title} kind={kind} title={title} variant={i} onStart={() => startFrom(title)} />)}
          </div>
        </section>

        {error && (
          <div className="notice error">{t(language, 'ui.home.iCouldNotLoadYour')} {error} <button className="btn sm" onClick={() => void loadProjects()}>{t(language, 'ui.home.tryAgain')}</button></div>
        )}

        {projects === null && !error && <div className="home-loading" aria-live="polite"><div className="loading-cards"><i /><i /><i /><i /></div><p><span className="spinner" /> {t(language, 'ui.home.loadingYourSpace')}</p></div>}

        {projects && !projects.length && !error && (
          <div className="empty-home">
            <div className="empty-home-art" aria-hidden="true"><span /><span /><span /></div>
            <h2>{t(language, 'ui.home.startYourFirstProject')}</h2>
            <p className="muted">{t(language, 'ui.home.aBlankCanvasReadyFor')}</p>
            <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> {t(language, 'ui.home.createProject')}</button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <section className="project-list-section" aria-labelledby="project-list-title">
            <div className="section-heading">
              <h2 id="project-list-title">{t(language, 'ui.home.yourProjects')} <span className="count">{projects.length}</span></h2>
              <div className="search"><Icon name="search" size={14} /><input className="field" placeholder={t(language, 'ui.home.searchProjects')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t(language, 'ui.home.searchProjects')} />{query && <button type="button" className="search-clear" aria-label={t(language, 'ui.home.clearSearch')} title={t(language, 'ui.home.clearSearch')} onClick={() => setQuery('')}><Icon name="close" size={12} /></button>}</div>
            </div>
            <ul className="cards">
              {shown.map((p) => (
                <li key={p.file}>
                  <ProjectCard file={p.file} thumb={p.thumb} name={p.name || pretty(p.file)} onOpen={() => void openProject(p.file)}
                    meta={<><span>{ago(p.modified, language)}</span><span>{fileSize(p.size)}</span></>} />
                  <button className="card-dl" aria-label={t(language, 'ui.home.downloadCopyOf', { name: p.name || pretty(p.file) })} title={t(language, 'ui.home.downloadCopy')} onClick={() => void exportProject(p.file)}><Icon name="download" size={14} /></button>
                </li>
              ))}
              {!shown.length && <li className="muted pad">{t(language, 'ui.home.nothingFound')} <button className="btn ghost sm" onClick={() => setQuery('')}>{t(language, 'ui.home.clearSearch')}</button></li>}
            </ul>
          </section>
        )}

        {canAdmin && <section className="connect-card connection-invite">
          <div className="connect-art" aria-hidden="true"><i /><i /><i /></div>
          <div className="grow"><h3>{t(language, 'ui.home.createWithACreativePartner')}</h3><p className="muted">{t(language, 'ui.home.connectAnAiToolWhen')}</p></div>
          <button className="btn" onClick={() => setArea('agents')}>{t(language, 'ui.home.openConnections')}</button>
        </section>}
        </>}
      </main>
    </div>
  );
}
