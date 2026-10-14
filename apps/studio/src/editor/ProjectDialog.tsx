// Janela "Projeto": brief (para quem é e que tom usar), notas de decisão (o porquê das escolhas) e pessoas com acesso.
// Cada ação é uma ferramenta do MCP (set_project_brief, add_note, resolve_note, share_project...), as mesmas que um agente usa.
import { useCallback, useEffect, useState } from 'react';
import { tool } from '../lib/api';
import { canEdit } from '../lib/actions';
import { run, toast, useApp } from '../lib/app';
import { Modal } from './Dialogs';

type Tab = 'brief' | 'notes' | 'people';
interface Brief { summary?: string; audience?: string; tone?: string[]; values?: string[]; goals?: string; avoid?: string; notes?: string }
interface Note { id: string; kind: 'DECISION' | 'COMMENT'; body: string; resolved: boolean; at: string; by: string; byType: string; layerId: string | null }
interface Member { email: string; name: string; role: string }

const ROLE: Record<string, string> = { OWNER: 'Dono', EDITOR: 'Edita', COMMENTER: 'Comenta', VIEWER: 'Só vê' };

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
  const name = useApp((s) => s.doc?.name ?? 'Projeto');
  return (
    <Modal title={`Projeto · ${name}`} wide onClose={onClose}>
      <div className="tab-chips" role="tablist">
        {([['brief', 'Brief'], ['notes', 'Notas'], ['people', 'Pessoas']] as [Tab, string][]).map(([id, label]) => (
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
    if (out) toast('ok', 'Brief salvo. Os agentes leem isso ao abrir o projeto.');
  };
  const field = (key: keyof Brief, label: string, hint: string, rows = 2) => (
    <label className="small">{label}
      <textarea className="field" rows={rows} disabled={!editable} placeholder={hint} value={String(b[key] ?? '')} onChange={(e) => setB((x) => ({ ...x, [key]: e.target.value }))} />
    </label>
  );
  if (!loaded) return <p className="muted"><span className="spinner" /> Carregando…</p>;
  return (
    <div className="settings">
      <p className="hint">O brief diz o que é o projeto e para quem. Agentes de IA leem isso antes de desenhar, então escreva como se fosse para um designer novo no time.</p>
      {field('summary', 'O que é', 'Ex.: site de uma cafeteria de bairro com cardápio e contato')}
      {field('audience', 'Para quem', 'Ex.: moradores do bairro, 25–45 anos, vêm do celular')}
      <label className="small">Tom (separe por vírgula)<input className="field" disabled={!editable} placeholder="acolhedor, direto, bem-humorado" value={tone} onChange={(e) => setTone(e.target.value)} /></label>
      <label className="small">Valores (separe por vírgula)<input className="field" disabled={!editable} placeholder="artesanal, local, sustentável" value={values} onChange={(e) => setValues(e.target.value)} /></label>
      {field('goals', 'Metas', 'Ex.: fazer a pessoa pedir pelo WhatsApp')}
      {field('avoid', 'O que evitar', 'Ex.: cores neon, fotos de banco de imagem genéricas')}
      {field('notes', 'Outras observações', '')}
      {editable && <button className="btn primary" onClick={() => void save()}>Salvar brief</button>}
    </div>
  );
}

function NotesTab() {
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
      <p className="hint">Notas guardam o <b>porquê</b> das decisões (“usei azul porque o cliente pediu confiança”). Quem retomar o projeto depois, pessoa ou agente, lê aqui.</p>
      {editable && (
        <>
          <textarea className="field" rows={3} placeholder="Escreva uma nota…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as 'decision' | 'comment')}><option value="decision">Decisão</option><option value="comment">Comentário</option></select>
            <span className="grow" />
            <button className="btn primary" disabled={!text.trim()} onClick={() => void add()}>Adicionar nota</button>
          </div>
        </>
      )}
      {notes === null ? <p className="muted"><span className="spinner" /> Carregando…</p>
        : !notes.length ? <p className="faint">Ainda não há notas.</p>
          : <ul className="resource-list">{[...notes].reverse().map((n) => (
            <li key={n.id} style={{ opacity: n.resolved ? 0.55 : 1 }}>
              <div><b>{n.kind === 'DECISION' ? 'Decisão' : 'Comentário'} · {n.by}{n.byType === 'AGENT' ? ' (agente)' : ''}</b><span>{n.body}</span><span className="faint">{new Date(n.at).toLocaleString()}</span></div>
              {editable && <button className="btn ghost sm" onClick={() => void resolve(n)}>{n.resolved ? 'Reabrir' : 'Resolver'}</button>}
            </li>
          ))}</ul>}
    </div>
  );
}

function PeopleTab() {
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
    if (out) { setEmail(''); load(); toast('ok', 'Projeto compartilhado.'); }
  };
  const remove = async (m: Member) => { await run('unshare_project', { email: m.email }); load(); };
  return (
    <div className="settings">
      {auth?.mode !== 'accounts' && <p className="hint">Neste modo não há login, então só você usa o projeto. Para compartilhar, inicie o servidor com contas (o padrão) e crie as contas em Administração.</p>}
      {members === null ? <p className="muted"><span className="spinner" /> Carregando…</p>
        : <ul className="resource-list">{members.map((m) => (
          <li key={m.email}>
            <div><b>{m.name}</b><span className="faint">{m.email} · {ROLE[m.role] || m.role}</span></div>
            {owner && m.role !== 'OWNER' && <button className="btn ghost sm danger" onClick={() => void remove(m)}>Remover</button>}
          </li>
        ))}</ul>}
      {owner && auth?.mode === 'accounts' && (
        <div className="row wrap">
          <input className="field grow" type="email" placeholder="e-mail de uma conta existente" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="field" value={as} onChange={(e) => setAs(e.target.value as typeof as)}><option value="editor">Pode editar</option><option value="commenter">Pode comentar</option><option value="viewer">Só ver</option></select>
          <button className="btn primary" disabled={!email.trim()} onClick={() => void share()}>Compartilhar</button>
        </div>
      )}
    </div>
  );
}
