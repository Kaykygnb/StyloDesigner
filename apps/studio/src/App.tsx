import { useEffect } from 'react';
import { boot, dismissToast, useApp } from './lib/app';
import { Editor } from './editor/Editor';
import { Home } from './screens/Home';
import { Login } from './screens/Login';
import { MenuHost } from './ui/ContextMenu';
import { DialogHost } from './ui/Dialog';
import { ImagePickerHost } from './ui/ImagePicker';

export function App() {
  const state = useApp((s) => s.boot);
  const error = useApp((s) => s.bootError);
  const user = useApp((s) => s.user);
  const auth = useApp((s) => s.auth);
  const screen = useApp((s) => s.screen);
  const toast = useApp((s) => s.toast);

  useEffect(() => { void boot(); }, []);

  let content;
  if (state === 'loading') content = <div className="center-note"><span className="spinner" /> Abrindo o Stylo…</div>;
  else if (state === 'error') {
    content = (
      <div className="center-note column">
        <h2>Não consegui falar com o servidor</h2>
        <p className="muted">{error}</p>
        <p className="faint small">Confira se o Stylo está rodando (npm start) e se o endereço desta página é o dele.</p>
        <button className="btn primary" onClick={() => location.reload()}>Tentar de novo</button>
      </div>
    );
  } else if (auth?.mode === 'accounts' && !user) content = <Login />;
  else content = screen === 'editor' ? <Editor /> : <Home />;

  return (
    <>
      {content}
      <MenuHost />
      <DialogHost />
      <ImagePickerHost />
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          <button onClick={dismissToast} aria-label="Fechar aviso">×</button>
        </div>
      )}
    </>
  );
}
