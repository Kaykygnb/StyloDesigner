// Notas do projeto (decisões e observações) guardadas no servidor: as mesmas que um agente lê com list_notes e grava com add_note.
// Usadas na aba Notas, na visão do projeto (nada selecionado) e na janela Projeto.
import { useCallback, useEffect, useState } from 'react';
import { tool } from '../lib/api';
import { canEdit } from '../lib/actions';
import { run, useApp } from '../lib/app';
import { formatRelativeTime, t } from '../lib/i18n';
import { Icon } from '../ui/Icon';

export interface ProjectNote { id: string; kind: 'DECISION' | 'COMMENT'; body: string; resolved: boolean; at: string; by: string; byType: string; layerId: string | null }

const CHANGED = 'stylo:notes-changed';
const changed = () => window.dispatchEvent(new Event(CHANGED));

/** Lista de notas do projeto aberto, recarregada quando alguém (nesta aba) grava ou resolve uma. */
export function useProjectNotes() {
  const file = useApp((s) => s.file);
  const [notes, setNotes] = useState<ProjectNote[] | null>(null);
  const load = useCallback(() => { void tool<{ notes: ProjectNote[] }>('list_notes').then((o) => setNotes(o.notes)).catch(() => setNotes([])); }, []);
  useEffect(() => { load(); window.addEventListener(CHANGED, load); return () => window.removeEventListener(CHANGED, load); }, [load, file]);
  return notes;
}

export async function addProjectNote(text: string, kind: 'decision' | 'comment' = 'decision') {
  const out = await run('add_note', { text: text.trim(), kind });
  if (out) changed();
  return !!out;
}

async function toggleNote(n: ProjectNote) {
  await run('resolve_note', { id: n.id, resolved: !n.resolved });
  changed();
}

/** Campo para anotar uma decisão (Enter grava, Shift+Enter quebra a linha). */
export function NoteComposer({ compact = false }: { compact?: boolean }) {
  const language = useApp((s) => s.language);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'decision' | 'comment'>('decision');
  const [busy, setBusy] = useState(false);
  if (!canEdit()) return null;
  const save = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try { if (await addProjectNote(text, kind)) setText(''); } finally { setBusy(false); }
  };
  return (
    <div className={`note-composer${compact ? ' compact' : ''}`}>
      <textarea className="field" rows={compact ? 2 : 3} placeholder={t(language, 'notes.placeholder')} value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void save(); } }} />
      <div className="row">
        {!compact && (
          <div className="segmented" role="group" aria-label={t(language, 'notes.kind')}>
            <button className={kind === 'decision' ? 'on' : ''} aria-pressed={kind === 'decision'} onClick={() => setKind('decision')}>{t(language, 'ui.project.decision')}</button>
            <button className={kind === 'comment' ? 'on' : ''} aria-pressed={kind === 'comment'} onClick={() => setKind('comment')}>{t(language, 'notes.observation')}</button>
          </div>
        )}
        <span className="grow" />
        <button className="btn primary sm" disabled={!text.trim() || busy} onClick={() => void save()}><Icon name="plus" size={13} /> {t(language, 'notes.add')}</button>
      </div>
    </div>
  );
}

/** Cartões das notas. `limit` mostra só as mais recentes em aberto. */
export function NoteList({ notes, limit, showResolved = false }: { notes: ProjectNote[] | null; limit?: number; showResolved?: boolean }) {
  const language = useApp((s) => s.language);
  const editable = canEdit();
  if (notes === null) return <p className="muted small"><span className="spinner" /> {t(language, 'ui.project.loading')}</p>;
  let list = [...notes].reverse().filter((n) => showResolved || !n.resolved);
  if (limit) list = list.slice(0, limit);
  if (!list.length) return <p className="faint small note-empty">{t(language, 'notes.empty')}</p>;
  return (
    <ul className="note-list">
      {list.map((n) => (
        <li key={n.id} className={`note-card ${n.kind === 'DECISION' ? 'is-decision' : 'is-comment'}${n.resolved ? ' is-resolved' : ''}`}>
          <span className="note-kind">{n.kind === 'DECISION' ? t(language, 'ui.project.decision') : t(language, 'notes.observation')}</span>
          <p>{n.body}</p>
          <footer>
            <span className="faint small">{n.byType === 'AGENT' && <Icon name="spark" size={11} />} {n.by} · {formatRelativeTime(language, n.at)}</span>
            {editable && <button className="link-btn" onClick={() => void toggleNote(n)}>{n.resolved ? t(language, 'ui.project.reopen') : t(language, 'notes.done')}</button>}
          </footer>
        </li>
      ))}
    </ul>
  );
}
