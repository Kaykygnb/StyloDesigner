// Janela "Projeto": brief (para quem é e que tom usar), notas de decisão (o porquê das escolhas) e pessoas com acesso.
// Cada ação é uma ferramenta do MCP (set_project_brief, add_note, resolve_note, share_project...), as mesmas que um agente usa.
import { useCallback, useEffect, useState } from 'react';
import { tool } from '../lib/api';
import { canEdit } from '../lib/actions';
import { run, toast, useApp } from '../lib/app';
import { Modal } from './Dialogs';
import { RichText } from '../ui/RichText';
import { t, tl } from '../lib/i18n';

type Tab = 'brief' | 'notes' | 'people';
interface Brief { summary?: string; audience?: string; tone?: string[]; values?: string[]; goals?: string; avoid?: string; notes?: string }
interface Note { id: string; kind: 'DECISION' | 'COMMENT'; body: string; resolved: boolean; at: string; by: string; byType: string; layerId: string | null }
interface Member { email: string; name: string; role: string }

const ROLE_KEY: Record<string, string> = { OWNER: 'ui.project.role.owner', EDITOR: 'ui.project.role.edit', COMMENTER: 'ui.project.role.comment', VIEWER: 'ui.project.role.view' };

export const openProjectDialog = (tab: Tab = 'brief') => window.dispatchEvent(new CustomEvent('stylo:project', { detail: tab }));

export function ProjectDialog() {
  const [open, setOpen] = useState<Tab | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen(((e as CustomEvent).detail as Tab) || 'brief');
    window.addEventListener('stylo:project', on);
    return () => window.removeEventListener('stylo:project', on);
  }, []);
  if (!open) return null;
  return <Body start={open} onClose={() => setOpen(null)} />;
}

function Body({ start, onClose }: { start: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(start);
  const language = useApp((s) => s.language);
  const name = useApp((s) => s.doc?.name ?? t(s.language, 'ui.project.defaultName'));
  return (
    <Modal title={t(language, 'ui.project.title', { name })} wide onClose={onClose}>
      <div className="tab-chips" role="tablist">
        {([['brief', t(language, 'ui.project.tabBrief')], ['notes', t(language, 'ui.project.tabNotes')], ['people', t(language, 'ui.project.tabPeople')]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab-chip${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'brief' && <BriefTab />}
      {tab === 'notes' && <NotesTab />}
      {tab === 'people' && <PeopleTab />}
    </Modal>
  );
}

function BriefTab() {
  const language = useApp((s) => s.language);
  const editable = canEdit();
  const [b, setB] = useState<Brief>({});
  const [tone, setTone] = useState('');
  const [values, setValues] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void tool<{ brief: Brief }>('get_project_brief').then((out) => {
      setB(out.brief || {}); setTone((out.brief?.tone || []).join(', ')); setValues((out.brief?.values || []).join(', ')); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);
  const list = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean);
  const save = async () => {
    const out = await run('set_project_brief', { summary: b.summary ?? '', audience: b.audience ?? '', tone: list(tone), values: list(values), goals: b.goals ?? '', avoid: b.avoid ?? '', notes: b.notes ?? '' });
    if (out) toast('ok', t(language, 'ui.project.briefSaved'));
  };
  const field = (key: keyof Brief, label: string, hint: string, rows = 2) => (
    <label className="small">{label}
      <textarea className="field" rows={rows} disabled={!editable} placeholder={hint} value={String(b[key] ?? '')} onChange={(e) => setB((x) => ({ ...x, [key]: e.target.value }))} />
    </label>
  );
  if (!loaded) return <p className="muted"><span className="spinner" /> {t(language, 'ui.project.loading')}</p>;
  return (
    <div className="settings">
      <p className="hint">{t(language, 'ui.project.briefHint')}</p>
      {field('summary', t(language, 'ui.project.summary'), t(language, 'ui.project.summaryHint'))}
      {field('audience', t(language, 'ui.project.audience'), t(language, 'ui.project.audienceHint'))}
      <label className="small">{t(language, 'ui.project.tone')}<input className="field" disabled={!editable} placeholder={t(language, 'ui.project.toneHint')} value={tone} onChange={(e) => setTone(e.target.value)} /></label>
      <label className="small">{t(language, 'ui.project.values')}<input className="field" disabled={!editable} placeholder={t(language, 'ui.project.valuesHint')} value={values} onChange={(e) => setValues(e.target.value)} /></label>
      {field('goals', t(language, 'ui.project.goals'), t(language, 'ui.project.goalsHint'))}
      {field('avoid', t(language, 'ui.project.avoid'), t(language, 'ui.project.avoidHint'))}
      {field('notes', t(language, 'ui.project.otherNotes'), '')}
      {editable && <button className="btn primary" onClick={() => void save()}>{t(language, 'ui.project.saveBrief')}</button>}
    </div>
  );
}

function NotesTab() {
  const language = useApp((s) => s.language);
  const editable = canEdit();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'decision' | 'comment'>('decision');
  const load = useCallback(() => { void tool<{ notes: Note[] }>('list_notes').then((o) => setNotes(o.notes)).catch(() => setNotes([])); }, []);
  useEffect(load, [load]);
  const add = async () => {
    if (!text.trim()) return;
    const out = await run('add_note', { text: text.trim(), kind });
    if (out) { setText(''); load(); }
  };
  const resolve = async (n: Note) => { await run('resolve_note', { id: n.id, resolved: !n.resolved }); load(); };
  return (
    <div className="settings">
      <p className="hint"><RichText text={t(language, 'ui.project.notesHint')} /></p>
      {editable && (
        <>
          <textarea className="field" rows={3} placeholder={t(language, 'ui.project.writeNote')} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as 'decision' | 'comment')}><option value="decision">{t(language, 'ui.project.decision')}</option><option value="comment">{t(language, 'ui.project.comment')}</option></select>
            <span className="grow" />
            <button className="btn primary" disabled={!text.trim()} onClick={() => void add()}>{t(language, 'ui.project.addNote')}</button>
          </div>
        </>
      )}
      {notes === null ? <p className="muted"><span className="spinner" /> {t(language, 'ui.project.loading')}</p>
        : !notes.length ? <p className="faint">{t(language, 'ui.project.noNotes')}</p>
          : <ul className="resource-list">{[...notes].reverse().map((n) => (
            <li key={n.id} style={{ opacity: n.resolved ? 0.55 : 1 }}>
              <div><b>{t(language, n.byType === 'AGENT' ? 'ui.project.byAgent' : 'ui.project.by', { kind: t(language, n.kind === 'DECISION' ? 'ui.project.decision' : 'ui.project.comment'), by: n.by })}</b><span>{n.body}</span><span className="faint">{new Date(n.at).toLocaleString(language)}</span></div>
              {editable && <button className="btn ghost sm" onClick={() => void resolve(n)}>{n.resolved ? t(language, 'ui.project.reopen') : t(language, 'ui.project.resolve')}</button>}
            </li>
          ))}</ul>}
    </div>
  );
}

function PeopleTab() {
  const language = useApp((s) => s.language);
  const auth = useApp((s) => s.auth);
  const role = useApp((s) => s.role);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [as, setAs] = useState<'editor' | 'commenter' | 'viewer'>('editor');
  const load = useCallback(() => { void tool<{ members: Member[] }>('list_members').then((o) => setMembers(o.members)).catch(() => setMembers([])); }, []);
  useEffect(load, [load]);
  const owner = role === 'OWNER' || role === 'ADMIN';
  const share = async () => {
    if (!email.trim()) return;
    const out = await run('share_project', { email: email.trim(), role: as });
    if (out) { setEmail(''); load(); toast('ok', t(language, 'ui.project.shared')); }
  };
  const remove = async (m: Member) => { await run('unshare_project', { email: m.email }); load(); };
  return (
    <div className="settings">
      {auth?.mode !== 'accounts' && <p className="hint">{t(language, 'ui.project.noLogin')}</p>}
      {members === null ? <p className="muted"><span className="spinner" /> {t(language, 'ui.project.loading')}</p>
        : <ul className="resource-list">{members.map((m) => (
          <li key={m.email}>
            <div><b>{m.name}</b><span className="faint">{m.email} · {ROLE_KEY[m.role] ? t(language, ROLE_KEY[m.role]) : m.role}</span></div>
            {owner && m.role !== 'OWNER' && <button className="btn ghost sm danger" onClick={() => void remove(m)}>{t(language, 'ui.project.remove')}</button>}
          </li>
        ))}</ul>}
      {owner && auth?.mode === 'accounts' && (
        <div className="row wrap">
          <input className="field grow" type="email" placeholder={t(language, 'ui.project.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="field" value={as} onChange={(e) => setAs(e.target.value as typeof as)}><option value="editor">{t(language, 'ui.project.canEdit')}</option><option value="commenter">{t(language, 'ui.project.canComment')}</option><option value="viewer">{t(language, 'ui.project.canView')}</option></select>
          <button className="btn primary" disabled={!email.trim()} onClick={() => void share()}>{t(language, 'ui.project.share')}</button>
        </div>
      )}
    </div>
  );
}
