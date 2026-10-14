// Menu "Ver" da barra de cima: réguas, guias, encaixe e grades de layout num só lugar, com o atalho ao lado.
import { run, setGuides, setLayoutGrids, setRulers, setSnap, useApp } from '../lib/app';
import { pageOf } from '../lib/doc';
import { t } from '../lib/i18n';
import { Icon } from '../ui/Icon';
import { Popover } from '../ui/Popover';

const M = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

function Toggle({ icon, label, hint, kbd, on, disabled, onChange }: { icon: string; label: string; hint: string; kbd?: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`view-opt${on ? ' on' : ''}`} role="menuitemcheckbox" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}>
      <Icon name={icon} size={16} />
      <span className="view-opt-text"><b>{label}</b><span className="faint small">{hint}</span></span>
      {kbd && <kbd>{kbd}</kbd>}
      <span className="switch" aria-hidden="true"><span /></span>
    </button>
  );
}

export function ViewMenu() {
  const language = useApp((s) => s.language);
  const rulers = useApp((s) => s.rulers);
  const guides = useApp((s) => s.guides);
  const snap = useApp((s) => s.snap);
  const grids = useApp((s) => s.layoutGrids);
  const page = useApp((s) => (s.doc ? pageOf(s.doc, s.pageId) : null));
  const count = page?.guides?.length ?? 0;
  const tr = (key: string, v?: Record<string, string | number>) => t(language, key, v);
  return (
    <Popover label={tr('ui.view.title')} trigger={<><Icon name="view" size={16} /><span className="lbl">{tr('ui.view.short')}</span></>}>
      <div className="menu-pad view-menu">
        <h4>{tr('ui.view.title')}</h4>
        <Toggle icon="ruler" label={tr('ui.view.rulers')} hint={tr('ui.view.rulersHint')} kbd={`${M} R`} on={rulers} onChange={setRulers} />
        <Toggle icon="guide" label={tr('ui.view.guides')} hint={rulers ? tr('ui.view.guidesHint') : tr('ui.view.guidesNeedRulers')} on={guides && rulers} disabled={!rulers} onChange={setGuides} />
        <Toggle icon="magnet" label={tr('ui.view.snap')} hint={tr('ui.view.snapHint')} on={snap} onChange={setSnap} />
        <Toggle icon="grid" label={tr('ui.view.grids')} hint={tr('ui.view.gridsHint')} on={grids} onChange={setLayoutGrids} />
        {count > 0 && page && (
          <button className="btn ghost sm view-clear" onClick={() => void run('set_guides', { page_id: page.id, guides: [] })}>
            <Icon name="trash" size={14} /> {tr('ui.view.clearGuides', { count })}
          </button>
        )}
      </div>
    </Popover>
  );
}
