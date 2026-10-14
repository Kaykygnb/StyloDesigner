import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { openProject, refreshDoc, toast, useApp } from '../lib/app';
import { t } from '../lib/i18n';
import { askText, confirmDialog } from '../ui/Dialog';

export function VersionsPanel() {
  const file = useApp((s) => s.file)!;
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [versions, setVersions] = useState<Array<{ id: string; modified: number; size: number; label?: string | null; revision?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = () => { setLoading(true); void api.projectVersions(file).then(setVersions).catch((e) => toast('error', String(e))).finally(() => setLoading(false)); };
  useEffect(load, [file]);
  const restore = async (id: string) => {
    if (!await confirmDialog(tr('versions.restoreQuestion'), tr('versions.restoreHint'), { okLabel: tr('versions.restore') })) return;
    setRestoring(id);
    try { await api.restoreProjectVersion(file, id); await refreshDoc(); load(); toast('ok', tr('versions.restored')); }
    catch (e) { toast('error', String(e)); }
    finally { setRestoring(null); }
  };
  const rename = async (v: typeof versions[number]) => { const label = await askText(tr('versions.nameTitle'), v.label || '', { okLabel: tr('assets.save') }); if (label === null) return; try { await api.labelProjectVersion(file, v.id, label.trim() || null); load(); toast('ok', tr('versions.nameSaved')); } catch (e) { toast('error', String(e)); } };
  const compare = async (v: typeof versions[number]) => { const other = versions.find((x) => x.id !== v.id); if (!other) { toast('error', tr('versions.needTwo')); return; } try { const result = await api.compareProjectVersions(file, v.id, other.id); toast('ok', result.same ? tr('versions.same') : tr('versions.differences', { items: result.changed.join(', ') || tr('versions.internal') })); } catch (e) { toast('error', String(e)); } };
  const duplicate = async (v: typeof versions[number]) => { const title = await askText(tr('versions.newProject'), `${v.label || tr('versions.copyDefault')}-${v.revision || ''}`.replace(/-$/, ''), { okLabel: tr('versions.duplicate') }); if (!title?.trim()) return; try { const out = await api.duplicateProjectVersion(file, v.id, title.trim()); toast('ok', tr('versions.duplicated')); await openProject(out.file); } catch (e) { toast('error', String(e)); } };
  return <div className="side-panel"><div className="row"><h4 className="grow">{tr('versions.title')}</h4><button className="btn ghost sm" onClick={load}>{tr('versions.refresh')}</button></div><p className="muted small">{tr('versions.hint')}</p>{loading ? <p className="muted">{tr('versions.loading')}</p> : !versions.length ? <p className="faint">{tr('versions.empty')}</p> : <ul className="resource-list">{versions.map((v) => <li key={v.id}><div><b>{v.label || new Date(v.modified).toLocaleString(language)}</b><span className="faint">{tr('versions.revision', { revision: v.revision ?? '—', size: Math.ceil(v.size / 1024) })}</span></div><div className="row"><button className="btn ghost sm" onClick={() => void rename(v)}>{tr('versions.name')}</button><button className="btn ghost sm" onClick={() => void compare(v)}>{tr('versions.compare')}</button><button className="btn ghost sm" onClick={() => void duplicate(v)}>{tr('versions.duplicate')}</button><button className="btn sm" disabled={!!restoring} onClick={() => void restore(v.id)}>{restoring === v.id ? tr('versions.restoring') : tr('versions.restore')}</button></div></li>)}</ul>}</div>;
}
