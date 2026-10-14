import { lazy, Suspense, useEffect } from 'react';
import { boot, dismissToast, useApp } from './lib/app';
import { t } from './lib/i18n';
import { Home } from './screens/Home';
import { Login, RequiredPasswordChange } from './screens/Login';
import { MenuHost } from './ui/ContextMenu';
import { DialogHost } from './ui/Dialog';
import { ImagePickerHost } from './ui/ImagePicker';

// O editor é a parte pesada: só é carregado quando alguém abre um projeto.
const Editor = lazy(() => import('./editor/Editor').then((m) => ({ default: m.Editor })));

export function App() {
  const state = useApp((s) => s.boot);
  const error = useApp((s) => s.bootError);
  const user = useApp((s) => s.user);
  const auth = useApp((s) => s.auth);
  const screen = useApp((s) => s.screen);
  const toast = useApp((s) => s.toast);
  const language = useApp((s) => s.language);

  useEffect(() => { void boot(); }, []);

  let content;
  if (state === 'loading') content = <div className="center-note"><span className="spinner" /> {t(language, 'ui.app.opening')}</div>;
  else if (state === 'error') {
    content = (
      <div className="center-note column">
        <h2>{t(language, 'ui.app.serverUnreachable')}</h2>
        <p className="muted">{error}</p>
        <p className="faint small">{t(language, 'ui.app.checkRunning')}</p>
        <button className="btn primary" onClick={() => location.reload()}>{t(language, 'ui.app.retry')}</button>
      </div>
    );
  } else if (auth?.mode === 'accounts' && !user) content = <Login />;
  else if (user?.mustChangePassword) content = <RequiredPasswordChange />;
  else content = screen === 'editor' ? <Suspense fallback={<div className="center-note"><span className="spinner" /></div>}><Editor /></Suspense> : <Home />;

  return (
    <>
      {content}
      <MenuHost />
      <DialogHost />
      <ImagePickerHost />
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          <button onClick={dismissToast} aria-label={t(language, 'ui.app.closeNotice')}>×</button>
        </div>
      )}
    </>
  );
}
