// Barra superior do editor: voltar aos projetos, tamanho de aparelho, desfazer/refazer, conferir e exportar.
import { canEdit, redo, undo } from '../lib/actions';
import { app, closeProject, dismissSyncNotice, runChecks, setDevice, setPanel, useApp } from '../lib/app';
import { publishProject } from '../lib/api';
import { toast } from '../lib/app';
import { AppearanceMenu } from '../ui/AppearanceMenu';
import { Icon } from '../ui/Icon';
import { breakpointsOf } from './devices';
import { openProjectDialog } from './ProjectDialog';
import { t } from '../lib/i18n';

export function TopBar() {
  const doc = useApp((s) => s.doc)!;
  const file = useApp((s) => s.file)!;
  const busy = useApp((s) => s.busy);
  const device = useApp((s) => s.device);
  const panel = useApp((s) => s.panel);
  const presence = useApp((s) => s.presence);
  const live = useApp((s) => s.live);
  const liveStatus = useApp((s) => s.liveStatus);
  const language = useApp((s) => s.language);
  const issues = useApp((s) => s.issues);
  const syncNotice = useApp((s) => s.syncNotice);
  const editable = canEdit();
  const bps = breakpointsOf(doc);
  const here = (presence?.agents.filter((a) => a.active).length ?? 0) + (presence?.people.length ?? 0);
  const publish = async (format: 'html' | 'react') => {
    try {
      const result = await publishProject(file, format);
      toast('ok', t(language, 'ui.topbar.published', { format: format === 'html' ? 'HTML' : 'React', kb: Math.ceil((result.bytes ?? 0) / 1024) }));
      window.open(result.download, '_blank', 'noopener,noreferrer');
    } catch (e) { toast('error', String(e)); }
  };

  return (
    <header className="topbar">
      <button className="btn ghost" onClick={closeProject} title={t(language, 'top.projects')}><Icon name="home" size={16} /><span className="lbl">{t(language, 'top.projects')}</span></button>
      <span className="sep" />
      <button className="project-title project-title-btn" title={t(language, 'ui.topbar.project')} onClick={() => openProjectDialog()}>
        <b className="ellipsis">{doc.name || file}</b>
        <span className="faint small">{busy > 0 ? <><span className="spinner" /> {t(language, 'collab.syncing')}</> : live ? t(language, 'collab.live') : liveStatus === 'reconnecting' ? <><span className="spinner" /> {t(language, 'collab.reconnecting')}</> : t(language, 'collab.offline')}</span>
      </button>
      {syncNotice ? <button className="notice ok sync-notice" title={t(language, 'collab.dismissChange')} onClick={dismissSyncNotice}>
        {t(language, 'collab.changedBy')} <b>{syncNotice.by}</b> · {t(language, 'collab.dismissChange')}
      </button> : null}

      <div className="spacer" />
      <div className="segmented devices" role="group" aria-label={t(language, 'ui.topbar.screenSize')}>
        <button className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')} title="Desktop"><Icon name="monitor" size={16} /><span>Desktop</span></button>
        {bps.map((b) => (
          <button key={b.id} className={device === b.id ? 'on' : ''} onClick={() => setDevice(b.id)} title={`${b.name} (${b.preview}px)`}>
            <Icon name={b.preview <= 480 ? 'phone' : 'tablet'} size={16} /><span>{b.name}</span>
          </button>
        ))}
      </div>
      <div className="spacer" />

      <button className="btn ghost icon" aria-label={t(language, 'top.undo')} title={t(language, 'top.undo')} disabled={!editable} onClick={() => void undo()}><Icon name="undo" size={16} /></button>
      <button className="btn ghost icon" aria-label={t(language, 'top.redo')} title={t(language, 'top.redo')} disabled={!editable} onClick={() => void redo()}><Icon name="redo" size={16} /></button>
      <span className="sep" />
      <button className={`btn ghost${panel === 'issues' ? ' active' : ''}`} title={t(language, 'ui.topbar.check')} onClick={() => { setPanel('issues'); if (!issues) void runChecks(); }}>
        <Icon name="alert" size={16} /><span className="lbl">{t(language, 'top.check')}</span>{issues?.length ? <span className={`badge ${issues.some((i) => i.severity === 'erro') ? 'error' : 'warn'}`}>{issues.length}</span> : null}
      </button>
      <button className={`btn ghost${panel === 'agents' ? ' active' : ''}`} title={t(language, 'ui.topbar.agents')} onClick={() => setPanel('agents')}>
        <Icon name="users" size={16} /><span className="lbl">{t(language, 'top.agents')}</span>{here > 1 ? <span className="badge">{here}</span> : null}
      </button>
      <button className={`btn ghost${panel === 'versions' ? ' active' : ''}`} title={t(language, 'ui.topbar.history')} onClick={() => setPanel('versions')}>
        <Icon name="history" size={15} /><span className="lbl">{t(language, 'top.history')}</span>
      </button>
      <button className="btn ghost" title={t(language, 'ui.topbar.present')} onClick={() => app.set({ presenting: true })}>
        <Icon name="play" size={15} /><span className="lbl">{t(language, 'top.present')}</span>
      </button>
      <button className="btn ghost" title={`${t(language, 'top.publish')} HTML`} onClick={() => void publish('html')}><Icon name="upload" size={15} /><span className="lbl">{t(language, 'top.publish')}</span></button>
      <button className="btn ghost icon" aria-label={t(language, 'top.publishReact')} title={t(language, 'top.publishReact')} onClick={() => void publish('react')}><Icon name="code" size={15} /></button>
      <button className="btn primary" onClick={() => setPanel('export')}><Icon name="download" size={15} /> {t(language, 'top.export')}</button>
      <AppearanceMenu />
    </header>
  );
}
