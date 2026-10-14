// Entrar (modo com contas). Na primeira vez, cria a conta de quem administra esta instalação.
import { useState } from 'react';
import * as api from '../lib/api';
import { afterLogin, signedOut, useApp } from '../lib/app';
import { t } from '../lib/i18n';

export function Login() {
  const auth = useApp((s) => s.auth);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const first = !!auth && !auth.hasAccounts;
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (first && password !== confirm) { setError(tr('login.passwordMismatch')); return; }
    setBusy(true);
    try {
      if (first) await api.setup(username.trim(), name.trim(), password, email.trim());
      else await api.login(identifier.trim(), password);
      const state = await api.authState();
      await afterLogin(state.user);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand big"><span className="logo">S</span> Stylo</div>
        <h1>{tr(first ? 'login.setupTitle' : 'login.signInTitle')}</h1>
        <p className="muted">{tr(first ? 'login.setupHint' : 'login.signInHint')}</p>
        {first && <label>{tr('login.name')}<input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
        {first && <label>{tr('login.username')}<input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus /></label>}
        {first && <label>{tr('login.emailOptional')}<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>}
        {!first && <label>{tr('login.identifier')}<input className="field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoFocus /></label>}
        <label>{tr('login.password')}<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={first ? 'new-password' : 'current-password'} minLength={first ? 8 : undefined} required /></label>
        {first && <label>{tr('login.confirmPassword')}<input className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></label>}
        {first && <p className="faint small">{tr('login.passwordHint')}</p>}
        {error && <div className="notice error" role="alert">{error}</div>}
        <button className="btn primary block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} {tr(first ? 'login.createAndEnter' : 'login.signIn')}</button>
      </form>
    </div>
  );
}

export function RequiredPasswordChange() {
  const user = useApp((s) => s.user);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError(tr('login.passwordMismatch')); return; }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      const state = await api.authState();
      await afterLogin(state.user);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const leave = async () => {
    setError(null);
    setBusy(true);
    try { await api.logout(); await signedOut(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit} aria-busy={busy}>
        <div className="brand big"><span className="logo">S</span> Stylo</div>
        <h1>{tr('login.changeTitle')}</h1>
        <p className="muted">{tr('login.changeHint', { email: user?.email || user?.username || (language === 'en-US' ? 'your account' : 'sua conta') })}</p>
        <label>{tr('login.temporaryPassword')}<input className="field" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required autoFocus /></label>
        <label>{tr('login.newPassword')}<input className="field" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <label>{tr('login.confirmNewPassword')}<input className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
        {error && <div className="notice error" role="alert">{error}</div>}
        <button className="btn primary block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} {tr('login.saveNewPassword')}</button>
        <button className="btn ghost block" type="button" disabled={busy} onClick={() => void leave()}>{tr('login.signOut')}</button>
      </form>
    </div>
  );
}
