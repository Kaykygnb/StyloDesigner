// Barra superior do editor: voltar aos projetos, tamanho de aparelho, desfazer/refazer, conferir e exportar.
import { canEdit, redo, undo } from '../lib/actions';
import { app, closeProject, runChecks, setDevice, setPanel, useApp } from '../lib/app';
import { publishProject } from '../lib/api';
import { toast } from '../lib/app';
import { AppearanceMenu } from '../ui/AppearanceMenu';
import { Icon } from '../ui/Icon';
import { breakpointsOf } from './devices';

export function TopBar() {
  const doc = useApp((s) => s.doc)!;
  const file = useApp((s) => s.file)!;
  const busy = useApp((s) => s.busy);
  const device = useApp((s) => s.device);
  const panel = useApp((s) => s.panel);
  const presence = useApp((s) => s.presence);
  const live = useApp((s) => s.live);
  const issues = useApp((s) => s.issues);
  const editable = canEdit();
  const bps = breakpointsOf(doc);
  const here = (presence?.agents.filter((a) => a.active).length ?? 0) + (presence?.people.length ?? 0);
  const publish = async (format: 'html' | 'react') => {
    try {
      const result = await publishProject(file, format);
      toast('ok', `${format === 'html' ? 'HTML' : 'React'} publicado (${Math.ceil(result.bytes / 1024)} KB).`);
      window.open(result.download, '_blank', 'noopener,noreferrer');
    } catch (e) { toast('error', String(e)); }
  };

  return (
    <header className="topbar">
      <button className="btn ghost" onClick={closeProject} title="Voltar aos projetos"><Icon name="home" size={16} /> Projetos</button>
      <span className="sep" />
      <div className="project-title">
        <b className="ellipsis">{doc.name || file}</b>
        <span className="faint small">{busy > 0 ? <><span className="spinner" /> Salvando…</> : live ? 'Salvo no servidor' : 'Sem conexão ao vivo'}</span>
      </div>

      <div className="spacer" />
      <div className="segmented devices" role="group" aria-label="Tamanho da tela">
        <button className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')} title="Desktop"><Icon name="monitor" size={16} /><span>Desktop</span></button>
        {bps.map((b) => (
          <button key={b.id} className={device === b.id ? 'on' : ''} onClick={() => setDevice(b.id)} title={`${b.name} (${b.preview}px)`}>
            <Icon name={b.preview <= 480 ? 'phone' : 'tablet'} size={16} /><span>{b.name}</span>
          </button>
        ))}
      </div>
      <div className="spacer" />

      <button className="btn ghost icon" title="Desfazer (Ctrl+Z)" disabled={!editable} onClick={() => void undo()}><Icon name="undo" size={16} /></button>
      <button className="btn ghost icon" title="Refazer (Ctrl+Shift+Z)" disabled={!editable} onClick={() => void redo()}><Icon name="redo" size={16} /></button>
      <span className="sep" />
      <button className={`btn ghost${panel === 'issues' ? ' active' : ''}`} title="Conferir o design" onClick={() => { setPanel('issues'); if (!issues) void runChecks(); }}>
        <Icon name="alert" size={16} /> Conferir{issues?.length ? <span className={`badge ${issues.some((i) => i.severity === 'erro') ? 'error' : 'warn'}`}>{issues.length}</span> : null}
      </button>
      <button className={`btn ghost${panel === 'agents' ? ' active' : ''}`} title="Agentes e atividade" onClick={() => setPanel('agents')}>
        <Icon name="users" size={16} /> Agentes{here > 1 ? <span className="badge">{here}</span> : null}
      </button>
      <button className={`btn ghost${panel === 'versions' ? ' active' : ''}`} title="Histórico de versões" onClick={() => setPanel('versions')}>
        <Icon name="history" size={15} /> Histórico
      </button>
      <button className="btn ghost" title="Apresentar protótipo (Ctrl+Alt+Enter)" onClick={() => app.set({ presenting: true })}>
        <Icon name="play" size={15} /> Apresentar
      </button>
      <button className="btn ghost" title="Publicar HTML" onClick={() => void publish('html')}><Icon name="upload" size={15} /> Publicar</button>
      <button className="btn ghost icon" title="Publicar React" onClick={() => void publish('react')}><Icon name="code" size={15} /></button>
      <button className="btn primary" onClick={() => setPanel('export')}><Icon name="download" size={15} /> Exportar</button>
      <AppearanceMenu />
    </header>
  );
}
