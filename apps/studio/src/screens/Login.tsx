// Entrar (modo com contas). Na primeira vez, cria a conta de quem administra esta instalação.
import { useState } from 'react';
import * as api from '../lib/api';
import { afterLogin, useApp } from '../lib/app';

export function Login() {
  const auth = useApp((s) => s.auth);
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
    if (first && password !== confirm) { setError('As senhas não são iguais.'); return; }
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
      <form className="login-card" onSubmit={submit}>
        <div className="brand big"><span className="logo">S</span> Stylo</div>
        <h1>{first ? 'Configurar o seu Stylo' : 'Entrar'}</h1>
        <p className="muted">{first ? 'Esta conta vai administrar esta instalação: ela decide quem mais pode entrar e quais agentes podem trabalhar.' : 'Use a conta que o administrador criou para você.'}</p>
        {first && <label>Seu nome<input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
        <label>E-mail<input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus /></label>
        <label>Senha<input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={first ? 'new-password' : 'current-password'} minLength={first ? 8 : undefined} required /></label>
        {first && <label>Repita a senha<input className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></label>}
        {first && <p className="faint small">A senha precisa ter pelo menos 8 caracteres.</p>}
        {error && <div className="notice error" role="alert">{error}</div>}
        <button className="btn primary block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} {first ? 'Criar conta e entrar' : 'Entrar'}</button>
      </form>
    </div>
  );
}
