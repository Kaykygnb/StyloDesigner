// Minha conta: um cartão de perfil com a cor da pessoa no alto e, ao lado, um índice que acompanha a rolagem.
// Quatro blocos com o mesmo formato (ícone, título, explicação de uma linha, conteúdo): Perfil, Segurança, Sessões e Histórico.
import { useEffect, useRef, useState } from 'react';
import * as api from '../../lib/api';
import { app, toast, useApp } from '../../lib/app';
import { Icon } from '../../ui/Icon';
import { formatDate, formatRelativeTime, t } from '../../lib/i18n';

type SessionRow = Awaited<ReturnType<typeof api.sessionsList>>[number];
const SECTIONS = [
  { id: 'conta-perfil', icon: 'user', title: 'ui.account.profile', hint: 'ui.account.profileHint' },
  { id: 'conta-seguranca', icon: 'shield', title: 'ui.account.security', hint: 'ui.account.securityHint' },
  { id: 'conta-sessoes', icon: 'monitor', title: 'ui.account.sessions', hint: 'ui.account.sessionsHint' },
  { id: 'conta-historico', icon: 'history', title: 'ui.account.history', hint: 'ui.account.historyHint' },
] as const;

/** 0 a 4: comprimento e variedade de caracteres. Só orienta; quem decide a regra é o servidor. */
function strength(password: string): number {
  if (!password) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length < 8) return 1;
  return Math.min(4, 1 + (password.length >= 12 ? 1 : 0) + (variety >= 2 ? 1 : 0) + (variety >= 3 ? 1 : 0));
}

export function AccountArea() {
  const user = useApp((s) => s.user);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [color, setColor] = useState(user?.color || '#6d5dfc');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; email: string; kind: string; createdAt: string }>>([]);
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([api.sessionsList(), api.authEvents()]).then(([s, e]) => { setSessions(s); setEvents(e); }).catch(() => { setSessions([]); setEvents([]); });
  }, []);

  // o índice ao lado marca a seção que está na tela
  useEffect(() => {
    const cards = SECTIONS.map((s) => document.getElementById(s.id)).filter((x): x is HTMLElement => !!x);
    if (!cards.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveId(visible.target.id);
    }, { rootMargin: '-20% 0px -60% 0px' });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  const dirty = name !== (user?.name || '') || email !== (user?.email || '') || color !== (user?.color || '#6d5dfc') || avatar !== (user?.avatar || '');
  const saveProfile = () => {
    setSaving(true);
    void api.updateMe({ name, email, color, avatar: avatar || null })
      .then((updated) => { app.set({ user: updated }); setEmail(updated.email); toast('ok', tr('account.profileSaved')); })
      .catch((e) => toast('error', String(e)))
      .finally(() => setSaving(false));
  };
  const resetProfile = () => { setName(user?.name || ''); setEmail(user?.email || ''); setColor(user?.color || '#6d5dfc'); setAvatar(user?.avatar || ''); };
  const pickAvatar = (file?: File) => {
    if (!file) return;
    if (file.size > 160 * 1024) { toast('error', tr('ui.workspace.avatarTooBig')); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  const changePassword = () => void api.changePassword(currentPassword, nextPassword)
    .then(() => { setCurrentPassword(''); setNextPassword(''); toast('ok', tr('account.passwordChanged')); })
    .catch((e) => toast('error', String(e)));
  const exportData = () => void api.accountExport().then((data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'stylo-conta.json'; a.click();
    URL.revokeObjectURL(url);
    toast('ok', tr('account.dataExported'));
  }).catch((e) => toast('error', String(e)));

  const level = strength(nextPassword);
  const head = (i: number, actions?: React.ReactNode) => {
    const s = SECTIONS[i];
    return <div className="card-head"><span className="card-icon"><Icon name={s.icon} size={16} /></span><div><h2>{tr(s.title)}</h2><p className="faint small">{tr(s.hint)}</p></div>{actions && <div className="card-head-actions">{actions}</div>}</div>;
  };

  return (
    <section className="workspace-section account-area">
      <header className="area-head">
        <div>
          <h1>{tr('account.title')}</h1>
          <p className="muted">{tr('account.subtitle')}</p>
        </div>
      </header>
      <div className="account-layout">
        <nav className="account-nav" aria-label={tr('ui.account.sections')}>
          {SECTIONS.map((s) => <button key={s.id} type="button" aria-current={activeId === s.id ? 'true' : undefined} onClick={() => { setActiveId(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Icon name={s.icon} size={15} />{tr(s.title)}</button>)}
        </nav>
        <div className="account-body">
          <div className="account-card profile-card" id={SECTIONS[0].id} style={{ '--profile': color } as React.CSSProperties}>
            <div className="profile-banner" aria-hidden="true"><i /><i /><i /></div>
            <div className="profile-top">
              <button className="avatar avatar-lg" type="button" title={tr('account.changeAvatar')} aria-label={tr('account.changeAvatar')} style={{ background: color }} onClick={() => avatarInput.current?.click()}>{avatar ? <img src={avatar} alt="" /> : (name || user?.name || '?').slice(0, 1).toUpperCase()}<span className="avatar-edit" aria-hidden="true"><Icon name="image" size={12} /></span></button>
              <div className="profile-name">
                <b>{name || user?.name || tr('account.noLogin')}</b>
                <span className="faint">{user?.email || tr('account.noLogin')}{user?.role && <span className="chip-tag">{tr(`role.${user.role}`) || user.role}</span>}</span>
              </div>
            </div>
            <input ref={avatarInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { pickAvatar(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            <div className="form-grid">
              <label className="small">{tr('account.name')}<input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="small">{tr('account.email')}<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="small color-field">{tr('account.profileColor')}<span className="color-field-row"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><code>{color.toUpperCase()}</code></span></label>
            </div>
            <p className="hint">{tr('account.avatarHint')}</p>
            <div className={`card-actions${dirty ? ' dirty' : ''}`}>
              {dirty && <span className="unsaved"><i aria-hidden="true" />{tr('ui.account.unsaved')}</span>}
              {dirty && <button className="btn ghost" onClick={resetProfile}>{tr('library.cancel')}</button>}
              <button className="btn primary" disabled={!dirty || saving} onClick={saveProfile}>{tr('account.saveProfile')}</button>
            </div>
          </div>

          <div className="account-card" id={SECTIONS[1].id}>
            {head(1)}
            <div className="form-grid">
              <label className="small">{tr('account.currentPassword')}<input className="field" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
              <label className="small">{tr('account.newPassword')}
                <span className="password-field"><input className="field" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} /><button type="button" className="btn ghost sm icon" aria-pressed={showPassword} aria-label={tr('ui.account.showPassword')} title={tr('ui.account.showPassword')} onClick={() => setShowPassword((v) => !v)}><Icon name={showPassword ? 'eyeoff' : 'eye'} size={14} /></button></span>
                {nextPassword && <span className="strength" data-level={level}><i /><i /><i /><i /><em>{tr(`ui.account.strength${level}`)}</em></span>}
              </label>
            </div>
            <div className="card-actions"><button className="btn" disabled={!currentPassword || !nextPassword} onClick={changePassword}>{tr('account.updatePassword')}</button></div>
          </div>

          <div className="account-card" id={SECTIONS[2].id}>
            {head(2, <>
              <button className="btn ghost sm" onClick={() => void api.sessionsList().then(setSessions)}>{tr('actions.refresh')}</button>
              {sessions.length > 1 && <button className="btn ghost sm danger" onClick={() => void api.revokeAllSessions().then(() => { toast('ok', tr('account.sessionsEnded')); window.location.reload(); }).catch((e) => toast('error', String(e)))}>{tr('account.endAll')}</button>}
            </>)}
            <ul className="session-list">
              {[...sessions].sort((a, b) => Number(!!b.current) - Number(!!a.current)).map((s) => (
                <li key={s.id} className={s.current ? 'current' : ''}>
                  <span className="session-icon"><Icon name="monitor" size={16} /></span>
                  <span className="grow">
                    <b>{s.current ? tr('account.thisSession') : tr('account.otherSession')}{s.current && <span className="status-pill ok"><i className="live-dot" aria-hidden="true" />{tr('ui.account.now')}</span>}</b>
                    <span className="faint small" title={formatDate(language, s.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}>{tr('account.startedAt')} {formatRelativeTime(language, s.createdAt)}</span>
                  </span>
                  {!s.current && <button className="btn sm" onClick={() => void api.revokeSession(s.id).then(() => { setSessions((x) => x.filter((v) => v.id !== s.id)); toast('ok', tr('ui.workspace.sessionRevoked')); })}>{tr('account.revoke')}</button>}
                </li>
              ))}
              {!sessions.length && <li className="muted">{tr('account.noSessions')}</li>}
            </ul>
          </div>

          <div className="account-card" id={SECTIONS[3].id}>
            {head(3, <>
              <button className="btn ghost sm" onClick={() => void api.authEvents().then(setEvents)}>{tr('actions.refresh')}</button>
              <button className="btn ghost sm" onClick={exportData}><Icon name="download" size={13} />{tr('account.exportData')}</button>
            </>)}
            <ol className="timeline">
              {events.map((e) => <li key={e.id} className={e.kind === 'login' ? 'in' : 'out'}>
                <span className="timeline-dot"><Icon name={e.kind === 'login' ? 'login' : 'logout'} size={12} /></span>
                <span className="grow"><b>{e.kind === 'login' ? tr('account.login') : tr('account.logout')}</b><span className="faint small">{e.email}</span></span>
                <time className="faint small" dateTime={e.createdAt} title={formatDate(language, e.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}>{formatRelativeTime(language, e.createdAt)}</time>
              </li>)}
              {!events.length && <li className="faint">{tr('account.noEvents')}</li>}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
