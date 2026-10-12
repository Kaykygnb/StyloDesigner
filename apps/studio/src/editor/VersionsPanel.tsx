import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { refreshDoc, toast, useApp } from '../lib/app';
import { confirmDialog } from '../ui/Dialog';

export function VersionsPanel() {
  const file = useApp((s) => s.file)!;
  const [versions, setVersions] = useState<Array<{ id: string; modified: number; size: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = () => { setLoading(true); void api.projectVersions(file).then(setVersions).catch((e) => toast('error', String(e))).finally(() => setLoading(false)); };
  useEffect(load, [file]);
  const restore = async (id: string) => {
    if (!await confirmDialog('Restaurar esta versão?', 'A versão atual será preservada no histórico antes da restauração.', { okLabel: 'Restaurar' })) return;
    setRestoring(id);
    try { await api.restoreProjectVersion(file, id); await refreshDoc(); load(); toast('ok', 'Versão restaurada.'); }
    catch (e) { toast('error', String(e)); }
    finally { setRestoring(null); }
  };
  return <div className="side-panel"><div className="row"><h4 className="grow">Histórico do projeto</h4><button className="btn ghost sm" onClick={load}>Atualizar</button></div><p className="muted small">Versões anteriores são criadas automaticamente pelo servidor e podem ser restauradas sem apagar o estado atual.</p>{loading ? <p className="muted">Carregando…</p> : !versions.length ? <p className="faint">Ainda não há versões anteriores.</p> : <ul className="resource-list">{versions.map((v) => <li key={v.id}><div><b>{new Date(v.modified).toLocaleString('pt-BR')}</b><span className="faint">{Math.ceil(v.size / 1024)} KB · {v.id}</span></div><button className="btn sm" disabled={!!restoring} onClick={() => void restore(v.id)}>{restoring === v.id ? 'Restaurando…' : 'Restaurar'}</button></li>)}</ul>}</div>;
}
