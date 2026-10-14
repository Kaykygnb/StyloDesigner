// Entrar (modo com contas). Na primeira vez, cria a conta de quem administra esta instalação.
import { useState } from 'react';
import * as api from '../lib/api';
import { afterLogin, persistAccountPreferences, setLanguage, signedOut, useApp } from '../lib/app';
import { SUPPORTED_LANGUAGES, t } from '../lib/i18n';
import { Brand } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { InkStack } from '../ui/InkStack';

export function Login() {
  const auth = useApp((s) => s.auth);
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const first = !!auth && !auth.hasAccounts;
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
      if (first) await api.setup(email.trim(), name.trim(), password);
      else await api.login(email.trim(), password);
      const state = await api.authState();
      await afterLogin(state.user);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-field" aria-hidden="true"><i className="lf-c" /><i className="lf-m" /><i className="lf-y" /></div>
      <label className="login-language" title={t(language, 'ui.home.interfaceLanguage')}>
        <Icon name="globe" size={14} /><select aria-label={t(language, 'ui.home.interfaceLanguage')} value={language} onChange={(e) => { const next = e.target.value as typeof language; setLanguage(next); persistAccountPreferences({ language: next }); }}>{SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.short}</option>)}</select>
      </label>
      <div className="login-shell">
        <section className="login-story" aria-label={t(language, 'ui.login.aboutAria')}>
          <Brand size={34} className="big" />
          <h1>{t(language, 'ui.login.startWithABlankCanvas')}</h1>
          <p>{t(language, 'ui.login.createSitesExperiencesAndVisual')}</p>
          <ul className="login-feats">
            <li><Icon name="frame" size={14} /> {t(language, 'ui.login.featCanvas')}</li>
            <li><Icon name="code" size={14} /> {t(language, 'ui.login.featCode')}</li>
            <li><Icon name="spark" size={14} /> {t(language, 'ui.login.featCollab')}</li>
          </ul>
          <InkStack className="login-stack" />
          <div className="login-proof"><span className="dot ok" /> {t(language, 'ui.login.yourCreativeSpaceReadyWhen')}</div>
        </section>
        <Brand size={30} className="login-mobile-brand" />
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head"><span className="status-pill"><Icon name="lock" size={11} /> {t(language, 'ui.login.secure')}</span></div>
          <h2>{tr(first ? 'login.setupTitle' : 'login.signInTitle')}</h2>
          <p className="muted">{tr(first ? 'login.setupHint' : 'login.signInHint')}</p>
          {first && <label>{tr('login.name')}<input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
          <label>{tr('login.email')}<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus /></label>
          <label>{tr('login.password')}<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={first ? 'new-password' : 'current-password'} minLength={first ? 8 : undefined} required /></label>
          {first && <label>{tr('login.confirmPassword')}<input className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></label>}
          {first && <p className="faint small">{tr('login.passwordHint')}</p>}
          {error && <div className="notice error" role="alert">{error}</div>}
          <button className="btn primary block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} {tr(first ? 'login.createAndEnter' : 'login.signIn')}</button>
          <p className="login-footnote">{t(language, 'ui.login.signInToReturnTo')}</p>
        </form>
      </div>
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
      <div className="login-field" aria-hidden="true"><i className="lf-c" /><i className="lf-m" /><i className="lf-y" /></div>
      <label className="login-language" title={t(language, 'ui.home.interfaceLanguage')}>
        <Icon name="globe" size={14} /><select aria-label={t(language, 'ui.home.interfaceLanguage')} value={language} onChange={(e) => { const next = e.target.value as typeof language; setLanguage(next); persistAccountPreferences({ language: next }); }}>{SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.short}</option>)}</select>
      </label>
      <form className="login-card compact" onSubmit={submit} aria-busy={busy}>
        <Brand size={34} className="big" />
        <h1>{tr('login.changeTitle')}</h1>
        <p className="muted">{tr('login.changeHint', { email: user?.email || (t(language, 'ui.login.yourAccount')) })}</p>
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
