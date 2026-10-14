// Barra de status inferior: contexto do documento à esquerda, sinais e zoom à direita.
import { runChecks, setPanel, setZoom, useApp } from '../lib/app';
import { pageOf } from '../lib/doc';
import { t } from '../lib/i18n';
import { Icon } from '../ui/Icon';

export function StatusBar() {
  const doc = useApp((s) => s.doc);
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const zoom = useApp((s) => s.zoom);
  const live = useApp((s) => s.live);
  const liveStatus = useApp((s) => s.liveStatus);
  const issues = useApp((s) => s.issues);
  const comments = useApp((s) => (s.doc?.comments as { resolved?: boolean }[] | undefined)?.filter((c) => !c.resolved).length ?? 0);
  const language = useApp((s) => s.language);
  if (!doc) return null;
  const pageIndex = doc.pages.findIndex((p) => p.id === pageId);
  const page = pageOf(doc, pageId);

  return (
    <footer className="statusbar">
      <span className="sb-item" title={t(language, 'ui.editor.pageOf', { current: pageIndex + 1, total: doc.pages.length })}>
        <Icon name="rows" size={12} /> {page?.name || page?.id}{doc.pages.length > 1 ? <span className="faint"> · {pageIndex + 1}/{doc.pages.length}</span> : null}
      </span>
      {selection.length > 0 && <span className="sb-item" title={t(language, 'tabs.design')}>
        <Icon name="cursor" size={12} /> {selection.length}{selection.length > 1 ? ` ${t(language, 'ui.editor.selectedLayers')}` : selection.length === 1 ? ` ${t(language, 'ui.editor.selectedLayer')}` : ''}
      </span>}
      <span className="spacer" />
      {comments > 0 && <button className="sb-item sb-btn" title={t(language, 'tabs.comments')} onClick={() => setPanel('comments')}><Icon name="comment" size={12} /> {comments}</button>}
      <button className={`sb-item sb-btn${issues?.length ? ' sb-warn' : ''}`} title={t(language, 'ui.topbar.check')} onClick={() => { setPanel('issues'); if (!issues) void runChecks(); }}>
        <Icon name={issues && !issues.length ? 'check' : 'alert'} size={12} /> {issues ? (issues.length || t(language, 'ui.status.allGood')) : t(language, 'top.check')}
      </button>
      <button className={`sb-item sb-btn${live ? ' sb-live' : ''}`} title={t(language, 'tabs.agents')} onClick={() => setPanel('agents')}>
        <span className={`dot${live ? ' ok' : ''}`} /> {live ? t(language, 'collab.live') : liveStatus === 'reconnecting' ? t(language, 'collab.reconnecting') : t(language, 'collab.offline')}
      </button>
      <span className="sb-zoom" role="group" aria-label={t(language, 'ui.editor.zoom')}>
        <button className="sb-zoom-btn" onClick={() => setZoom(zoom / 1.25)} aria-label="−"><Icon name="minus" size={11} /></button>
        <button className="sb-zoom-value" onClick={() => setZoom(1)} title={t(language, 'ui.editor.zoomReset')}>{Math.round(zoom * 100)}%</button>
        <button className="sb-zoom-btn" onClick={() => setZoom(zoom * 1.25)} aria-label="+"><Icon name="plus" size={11} /></button>
        <button className="sb-zoom-btn" onClick={() => window.dispatchEvent(new Event('stylo:fit'))} aria-label={t(language, 'ui.canvas.fitAll')} title={t(language, 'ui.canvas.fitAll')}><Icon name="fit" size={11} /></button>
      </span>
    </footer>
  );
}
