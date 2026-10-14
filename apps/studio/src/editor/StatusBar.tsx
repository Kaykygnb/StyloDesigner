// Barra de status inferior: contexto do documento à esquerda, sinais e zoom à direita.
import { setZoom, useApp } from '../lib/app';
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
      <span className="sb-item" title={t(language, 'ui.editor.pageOf')}>
        <Icon name="rows" size={12} />
        {t(language, 'ui.editor.pageOf', { current: pageIndex + 1, total: doc.pages.length })}
      </span>
      {page && <span className="sb-item faint">{page.name || page.id}</span>}
      <span className="sb-item" title={t(language, 'tabs.design')}>
        <Icon name="cursor" size={12} /> {selection.length || ''}{selection.length > 1 ? ` ${t(language, 'ui.editor.selectedLayers')}` : selection.length === 1 ? ` ${t(language, 'ui.editor.selectedLayer')}` : ''}
      </span>
      <span className="spacer" />
      {comments > 0 && <span className="sb-item" title={t(language, 'tabs.comments')}><Icon name="comment" size={12} /> {comments}</span>}
      {issues && issues.length > 0 && <span className="sb-item sb-warn" title={t(language, 'tabs.issues')}><Icon name="alert" size={12} /> {issues.length}</span>}
      <span className={`sb-item${live ? ' sb-live' : ''}`} title={t(language, 'tabs.agents')}>
        <span className={`dot${live ? ' ok' : ''}`} /> {live ? t(language, 'collab.live') : liveStatus === 'reconnecting' ? t(language, 'collab.reconnecting') : t(language, 'collab.offline')}
      </span>
      <span className="sb-zoom" role="group" aria-label={t(language, 'ui.editor.zoom')}>
        <button className="sb-zoom-btn" onClick={() => setZoom(zoom / 1.25)} aria-label="−"><Icon name="minus" size={11} /></button>
        <button className="sb-zoom-value" onClick={() => setZoom(1)} title={t(language, 'ui.editor.zoomReset')}>{Math.round(zoom * 100)}%</button>
        <button className="sb-zoom-btn" onClick={() => setZoom(zoom * 1.25)} aria-label="+"><Icon name="plus" size={11} /></button>
        <button className="sb-zoom-btn" onClick={() => window.dispatchEvent(new Event('stylo:fit'))} aria-label={t(language, 'ui.canvas.fitAll')} title={t(language, 'ui.canvas.fitAll')}><Icon name="fit" size={11} /></button>
      </span>
    </footer>
  );
}
