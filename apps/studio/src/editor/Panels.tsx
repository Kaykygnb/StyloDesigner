// Painéis da direita além das propriedades: problemas do design, agentes conectados e exportação.
import { useEffect, useState } from 'react';
import { importProject, projectActivity, projectPresence, projectPublishing, publishProject, reactZipUrl, siteZipUrl, tool } from '../lib/api';
import { openProject, runChecks, selectAndReveal, toast, useApp } from '../lib/app';
import { askText } from '../ui/Dialog';
import { findNode, pageOf } from '../lib/doc';
import { Icon } from '../ui/Icon';
import { formatDate, t, tp } from '../lib/i18n';

export function connectCommand() {
  return `claude mcp add --transport http stylo ${location.origin}/mcp`;
}

async function copy(text: string, language: Parameters<typeof t>[0] = 'pt-BR') {
  try { await navigator.clipboard.writeText(text); toast('ok', t(language, 'common.copied')); }
  catch { toast('error', t(language, 'common.copyError')); }
}

// ---------------------------------------------------------------- problemas (check_design)
export function IssuesPanel() {
  const issues = useApp((s) => s.issues);
  const running = useApp((s) => s.issuesRunning);
  const note = useApp((s) => s.issuesNote);
  const language = useApp((s) => s.language);
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const page = pageOf(doc, pageId);

  const go = (id: string) => { if (findNode(page.children, id)) { selectAndReveal([id]); } else toast('error', t(language, 'ui.panels.layerGone')); };

  return (
    <div className="side-panel">
      <div className="row">
        <h4 className="grow">{t(language, 'issues.title')}</h4>
        <button className="btn primary sm" onClick={() => void runChecks()} disabled={running}>{running ? <span className="spinner" /> : null} {t(language, issues ? 'issues.again' : 'issues.run')}</button>
      </div>
      <p className="muted small">{t(language, 'issues.hint')}</p>
      {note && <p className="notice">{note}</p>}
      {issues && !issues.length && <div className="notice ok"><Icon name="check" size={14} /> {t(language, 'issues.none')}</div>}
      <ul className="issues">
        {issues?.map((i, n) => (
          <li key={n} className={i.severity} onClick={() => go(i.layerId)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go(i.layerId); }}>
            <div className="row"><span className={`badge ${i.severity === 'erro' ? 'error' : 'warn'}`}>{i.severity === 'erro' ? t(language, 'issues.error') : t(language, 'issues.warning')}</span><b className="ellipsis">{i.layerName}</b></div>
            <p>{i.message}</p>
            <p className="faint small"><b>{t(language, 'issues.fix')}</b> {i.fix}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- agentes
export function AgentsPanel() {
  const presence = useApp((s) => s.presence);
  const live = useApp((s) => s.live);
  const file = useApp((s) => s.file);
  const [history, setHistory] = useState<Array<{ id: number; at: string; who: string; tool: string; summary: string; ok: boolean }>>([]);
  const [contextAgents, setContextAgents] = useState<Array<{ id: string; name: string; active?: boolean; lastTool?: string | null; locks?: string[] }>>([]);
  const [contextPeople, setContextPeople] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [activityFilter, setActivityFilter] = useState('all');
  const language = useApp((s) => s.language);
  useEffect(() => {
    if (!file) return;
    void projectActivity(file).then(setHistory).catch(() => setHistory([]));
    void projectPresence(file).then((x) => { setContextAgents(x.agents); setContextPeople(x.people); }).catch(() => { setContextAgents([]); setContextPeople([]); });
  }, [file, presence?.activity.length, presence?.people.length, presence?.agents.length]);
  useEffect(() => {
    if (!presence) return;
    setContextPeople(presence.people);
    setContextAgents(presence.agents);
  }, [presence]);
  const cmd = connectCommand();
  return (
    <div className="side-panel">
      <h4>{t(language, 'collab.connectAgent')}</h4>
      <p className="muted small">{t(language, 'collab.connectHint')}</p>
      <div className="codebox"><code>{cmd}</code><button className="btn ghost icon sm" title={t(language, 'actions.copy')} onClick={() => void copy(cmd, language)}><Icon name="copy" size={14} /></button></div>
      <p className="faint small">{t(language, 'collab.connectAfter')}</p>

      <h4>{t(language, 'collab.whoHere')} {live ? '' : <span className="badge warn">{t(language, 'collab.offline')}</span>}</h4>
      <p className="faint small">{t(language, 'collab.thisProject')}</p>
      <ul className="people">
        {contextPeople.map((p) => <li key={p.id}><span className="dot" style={{ background: p.color }} />{p.name}<span className="faint"> · {tp(language, 'collab.people', 1)}</span></li>)}
        {contextAgents.map((a) => <li key={a.id}><span className="dot" style={{ opacity: a.active ? 1 : 0.4 }} />{a.name}<span className="faint"> · {a.active ? (a.lastTool ? `${t(language, 'collab.used')} ${a.lastTool}` : t(language, 'collab.active')) : t(language, 'collab.idle')}{a.locks?.length ? ` · ${tp(language, 'collab.lockCount', a.locks.length)}` : ''}</span></li>)}
        {!contextAgents.length && !contextPeople.length && <li className="faint">{t(language, 'collab.noOne')}</li>}
      </ul>

      <h4>{t(language, 'collab.recentActivity')}</h4>
      <ul className="activity">
        {presence?.activity.map((a, i) => <li key={i}><span className="dot" style={{ background: a.color }} /><span><b>{a.who}</b> {a.text}</span></li>)}
        {!presence?.activity.length && <li className="faint">{t(language, 'collab.nothingYet')}</li>}
      </ul>
      <h4>{t(language, 'collab.persisted')}</h4>
      <select className="field" aria-label={t(language, 'collab.persisted')} value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}><option value="all">{t(language, 'collab.allOperations')}</option>{[...new Set(history.map((a) => a.who))].map((who) => <option key={`who:${who}`} value={`who:${who}`}>{t(language, 'collab.actor')}: {who}</option>)}{[...new Set(history.map((a) => a.tool))].map((tool) => <option key={`tool:${tool}`} value={`tool:${tool}`}>{t(language, 'collab.tool')}: {tool}</option>)}</select>
      <ul className="activity">
        {history.filter((a) => activityFilter === 'all' || activityFilter === `who:${a.who}` || activityFilter === `tool:${a.tool}`).map((a) => <li key={a.id}><span className={`badge ${a.ok ? 'ok' : 'error'}`}>{a.ok ? t(language, 'common.ok') : t(language, 'common.error')}</span><span><b>{a.who}</b> · {a.summary || a.tool}<span className="faint"> · {formatDate(language, a.at, { dateStyle: 'short', timeStyle: 'short' })}</span></span></li>)}
        {!history.filter((a) => activityFilter === 'all' || activityFilter === `who:${a.who}` || activityFilter === `tool:${a.tool}`).length && <li className="faint">{t(language, 'collab.noMatch')}</li>}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- exportar
export function ExportPanel() {
  const file = useApp((s) => s.file)!;
  const doc = useApp((s) => s.doc);
  const [tokens, setTokens] = useState<{ path: string; content: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishes, setPublishes] = useState<Array<{ id: string; format: string; status: string; createdAt: string; warnings?: string[]; download?: string; label?: string | null }>>([]);
  const [publishWarnings, setPublishWarnings] = useState<string[]>([]);
  const [publishLabel, setPublishLabel] = useState('');
  const language = useApp((s) => s.language);
  useEffect(() => { void projectPublishing(file).then(setPublishes).catch(() => setPublishes([])); }, [file]);
  const publish = async (format: 'html' | 'react') => {
    setBusy(true);
    try { const result = await publishProject(file, format, publishLabel); setPublishWarnings(result.warnings || []); setPublishes((x) => [{ id: result.id, format: result.format, status: result.status || (result.warnings?.length ? 'READY_WITH_WARNINGS' : 'READY'), warnings: result.warnings, createdAt: new Date().toISOString(), download: result.download, label: result.label }, ...x]); setPublishLabel(''); toast('ok', t(language, 'export.published', { format: format === 'html' ? 'HTML' : 'React' })); window.open(result.download, '_blank', 'noopener,noreferrer'); }
    catch (e) { toast('error', String(e)); } finally { setBusy(false); }
  };
  const getTokens = async (format: 'css' | 'json' | 'tailwind') => {
    setBusy(true);
    try { setTokens((await tool<{ files: { path: string; content: string }[] }>('export_tokens', { format })).files); }
    catch (e) { toast('error', e instanceof Error ? e.message : String(e)); setTokens(null); } finally { setBusy(false); }
  };
  const downloadProject = () => {
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${(file || 'projeto').replace(/\.json$/i, '')}.stylo`; a.click(); URL.revokeObjectURL(url);
  };
  const importProjectFile = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.stylo,.json,application/json';
    input.onchange = () => { const file = input.files?.[0]; if (!file) return; void file.text().then(async (text) => { let doc: any; try { doc = JSON.parse(text); } catch { throw new Error(t(language, 'export.invalidJson')); } const title = await askText(t(language, 'export.importName'), String(doc.name || file.name.replace(/\.(stylo|json)$/i, '')), { okLabel: t(language, 'export.import') }); if (!title?.trim()) return; const out = await importProject(title.trim(), doc); toast('ok', t(language, 'export.imported')); await openProject(out.file); }).catch((e) => toast('error', e instanceof Error ? e.message : String(e))); };
    input.click();
  };
  return (
    <div className="side-panel">
      <div className="export-hero"><h4>{t(language, 'export.title')}</h4><p className="muted small">{t(language, 'export.hint')}</p></div>
      <div className="export-card"><label className="field-label">{t(language, 'export.label')}<input className="field" value={publishLabel} onChange={(e) => setPublishLabel(e.target.value)} placeholder={t(language, 'export.placeholder')} maxLength={120} /></label><div className="row"><button className="btn primary" disabled={busy} onClick={() => void publish('html')}>{t(language, 'export.html')}</button><button className="btn" disabled={busy} onClick={() => void publish('react')}>{t(language, 'export.react')}</button></div></div>
      <div className="export-downloads"><a className="btn primary block" href={siteZipUrl(file)} download><Icon name="download" size={15} /> {t(language, 'export.siteZip')}</a><a className="btn block" href={reactZipUrl(file)} download><Icon name="download" size={15} /> {t(language, 'export.reactZip')}</a><button className="btn block" onClick={downloadProject}><Icon name="download" size={15} /> {t(language, 'export.document')}</button><button className="btn block" onClick={importProjectFile}><Icon name="upload" size={15} /> {t(language, 'export.import')}</button></div>
      <h4>{t(language, 'export.recent')}</h4>
      {publishWarnings.length > 0 && <div className="notice warn"><b>{t(language, 'export.warningTitle')}</b><ul>{publishWarnings.slice(0, 8).map((warning, index) => <li key={index}>{warning}</li>)}</ul>{publishWarnings.length > 8 && <span className="faint">{t(language, 'export.moreWarnings', { count: publishWarnings.length - 8 })}</span>}</div>}
      <ul className="activity">{publishes.map((p) => <li key={p.id}><span className={`badge ${p.status === 'READY_WITH_WARNINGS' ? 'warn' : 'ok'}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{t(language, `export.status.${p.status}`)}</span><span>{p.format.toUpperCase()}{p.label && !p.label.startsWith('Publicação ') ? ` · ${p.label}` : ''} · {formatDate(language, p.createdAt, { dateStyle: 'short', timeStyle: 'short' })}{p.download ? <> · <a href={p.download} download>{t(language, 'export.download')}</a></> : null}{p.warnings?.length ? <details><summary className="faint small">{t(language, 'export.warnings', { count: p.warnings.length })}</summary><ul className="faint small">{p.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details> : null}</span></li>)}{!publishes.length && <li className="faint">{t(language, 'export.noPublishes')}</li>}</ul>
      <h4>{t(language, 'export.tokens')}</h4>
      <p className="muted small">{t(language, 'export.tokensHint')}</p>
      <div className="row">
        <button className="btn sm" disabled={busy} onClick={() => void getTokens('css')}>CSS</button>
        <button className="btn sm" disabled={busy} onClick={() => void getTokens('json')}>JSON</button>
        <button className="btn sm" disabled={busy} onClick={() => void getTokens('tailwind')}>Tailwind</button>
      </div>
      {tokens?.map((f) => (
        <div key={f.path}>
          <div className="row"><b className="small grow">{f.path}</b><button className="btn ghost sm" onClick={() => void copy(f.content, language)}><Icon name="copy" size={13} /> {t(language, 'actions.copy')}</button></div>
          <pre className="code">{f.content}</pre>
        </div>
      ))}
    </div>
  );
}
