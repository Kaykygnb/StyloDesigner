// Janela "Projeto": brief (para quem é e que tom usar), notas de decisão (o porquê das escolhas) e pessoas com acesso.
// Cada ação é uma ferramenta do MCP (set_project_brief, add_note, resolve_note, share_project...), as mesmas que um agente usa.
import { useCallback, useEffect, useState } from 'react';
import { tool } from '../lib/api';
import { canEdit } from '../lib/actions';
import { run, toast, useApp } from '../lib/app';
import { Modal } from './Dialogs';
import { NoteComposer, NoteList, useProjectNotes } from './ProjectNotes';
import { RichText } from '../ui/RichText';
import { t, tl } from '../lib/i18n';

type Tab = 'brief' | 'notes' | 'people';
interface Brief { summary?: string; audience?: string; tone?: string[]; values?: string[]; goals?: string; avoid?: string; notes?: string }
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
      <div className="project-dialog-content">
      <div className="tab-chips project-tabs" role="tablist">
        {([['brief', t(language, 'ui.project.tabBrief')], ['notes', t(language, 'ui.project.tabNotes')], ['people', t(language, 'ui.project.tabPeople')]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab-chip${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'brief' && <BriefTab />}
      {tab === 'notes' && <NotesTab />}
      {tab === 'people' && <PeopleTab />}
      </div>
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
  const field = (key: keyof Brief, label: string, hint: string, rows = 2, className = '') => (
    <label className={`small project-field ${className}`}>{label}
      <textarea className="field" rows={rows} disabled={!editable} placeholder={hint} value={String(b[key] ?? '')} onChange={(e) => setB((x) => ({ ...x, [key]: e.target.value }))} />
    </label>
  );
  if (!loaded) return <p className="muted"><span className="spinner" /> {t(language, 'ui.project.loading')}</p>;
  return (
    <div className="settings project-brief-settings">
      <p className="hint project-brief-intro">{t(language, 'ui.project.briefHint')}</p>
      <div className="project-field-grid">
        {field('summary', t(language, 'ui.project.summary'), t(language, 'ui.project.summaryHint'), 2, 'project-field-wide')}
        {field('audience', t(language, 'ui.project.audience'), t(language, 'ui.project.audienceHint'), 2, 'project-field-wide')}
        <label className="small project-field">{t(language, 'ui.project.tone')}<input className="field" disabled={!editable} placeholder={t(language, 'ui.project.toneHint')} value={tone} onChange={(e) => setTone(e.target.value)} /></label>
        <label className="small project-field">{t(language, 'ui.project.values')}<input className="field" disabled={!editable} placeholder={t(language, 'ui.project.valuesHint')} value={values} onChange={(e) => setValues(e.target.value)} /></label>
        {field('goals', t(language, 'ui.project.goals'), t(language, 'ui.project.goalsHint'))}
        {field('avoid', t(language, 'ui.project.avoid'), t(language, 'ui.project.avoidHint'))}
        {field('notes', t(language, 'ui.project.otherNotes'), '', 2, 'project-field-wide')}
      </div>
      {editable && <div className="project-dialog-actions"><span className="faint small">{t(language, 'ui.project.tabBrief')}</span><button className="btn primary" onClick={() => void save()}>{t(language, 'ui.project.saveBrief')}</button></div>}
    </div>
  );
}

function NotesTab() {
  const language = useApp((s) => s.language);
  const notes = useProjectNotes();
  return (
    <div className="settings">
      <p className="hint"><RichText text={t(language, 'ui.project.notesHint')} /></p>
      <NoteComposer />
      <NoteList notes={notes} showResolved />
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
