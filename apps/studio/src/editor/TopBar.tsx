// Barra superior do editor: projeto à esquerda, tamanho de tela no meio e, à direita, comandos, desfazer, ver, agentes,
// apresentar e exportar. Conferir e histórico ficam no menu de painéis, na barra de status e no Ctrl K.
import { canEdit, redo, undo } from '../lib/actions';
import { app, closeProject, dismissSyncNotice, setDevice, setPanel, useApp } from '../lib/app';
import { AppearanceMenu } from '../ui/AppearanceMenu';
import { LogoMark } from '../ui/Brand';
import { openCommandPalette } from '../ui/CommandPalette';
import { Icon } from '../ui/Icon';
import { breakpointsOf } from './devices';
import { openProjectDialog } from './ProjectDialog';
import { ViewMenu } from './ViewMenu';
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
  const syncNotice = useApp((s) => s.syncNotice);
  const editable = canEdit();
  const bps = breakpointsOf(doc);
  const here = (presence?.agents.filter((a) => a.active).length ?? 0) + (presence?.people.length ?? 0);
  return (
    <header className="topbar">
      <button className="topbar-home" onClick={closeProject} title={t(language, 'top.projects')} aria-label={t(language, 'top.projects')}><LogoMark size={22} /></button>
      <button className="project-title project-title-btn" title={t(language, 'ui.topbar.project')} onClick={() => openProjectDialog()}>
        <b className="ellipsis">{doc.name || file}</b>
        <span className={`faint small project-status ${busy > 0 ? 'is-busy' : live ? 'is-live' : 'is-off'}`}>{busy > 0 ? <><span className="spinner" /> {t(language, 'collab.syncing')}</> : live ? t(language, 'collab.saved') : liveStatus === 'reconnecting' ? <><span className="spinner" /> {t(language, 'collab.reconnecting')}</> : t(language, 'collab.offline')}</span>
      </button>
      {syncNotice ? <button className="notice ok sync-notice" title={t(language, 'collab.dismissChange')} onClick={dismissSyncNotice}>
        {t(language, 'collab.changedBy')} <b>{syncNotice.by}</b> · {t(language, 'collab.dismissChange')}
      </button> : null}

      <span className="sep" />
      <button className="btn ghost icon" aria-label={t(language, 'top.undo')} title={t(language, 'top.undo')} disabled={!editable} onClick={() => void undo()}><Icon name="undo" size={16} /></button>
      <button className="btn ghost icon" aria-label={t(language, 'top.redo')} title={t(language, 'top.redo')} disabled={!editable} onClick={() => void redo()}><Icon name="redo" size={16} /></button>

      <div className="spacer" />
      <div className="segmented devices" role="group" aria-label={t(language, 'ui.topbar.screenSize')}>
        <button className={device === 'desktop' ? 'on' : ''} aria-label="Desktop" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} title="Desktop"><Icon name="monitor" size={16} />{device === 'desktop' && <span>Desktop</span>}</button>
        {bps.map((b) => (
          <button key={b.id} className={device === b.id ? 'on' : ''} aria-label={b.name} aria-pressed={device === b.id} onClick={() => setDevice(b.id)} title={`${b.name} · ${b.preview}px`}>
            <Icon name={b.preview <= 480 ? 'phone' : 'tablet'} size={16} />{device === b.id && <span>{b.name} <i className="faint">{b.preview}</i></span>}
          </button>
        ))}
      </div>
      <div className="spacer" />

      <button className="btn ghost icon" onClick={openCommandPalette} aria-label={t(language, 'ui.command.open')} title={`${t(language, 'ui.command.open')} (Ctrl K)`}><Icon name="search" size={16} /></button>
      <ViewMenu />
      <button className={`btn ghost${panel === 'agents' ? ' active' : ''}`} title={t(language, 'ui.topbar.agents')} onClick={() => setPanel('agents')}>
        <Icon name="users" size={16} /><span className="lbl">{t(language, 'top.agents')}</span>{here > 1 ? <span className="badge">{here}</span> : null}
      </button>
      <span className="sep" />
      <button className="btn ghost icon" aria-label={t(language, 'ui.topbar.present')} title={t(language, 'ui.topbar.present')} onClick={() => app.set({ presenting: true })}>
        <Icon name="play" size={15} />
      </button>
      <button className="btn primary" onClick={() => setPanel('export')}><Icon name="download" size={15} /> {t(language, 'top.export')}</button>
      <AppearanceMenu />
    </header>
  );
}
