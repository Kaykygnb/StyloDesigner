// Janelas simples no visual do painel: perguntar um texto, confirmar. Substituem o prompt/confirm do navegador.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { app, useApp } from '../lib/app';

export interface DialogState {
  kind: 'text' | 'confirm';
  title: string;
  message?: string;
  value?: string;
  multiline?: boolean;
  secret?: boolean;
  okLabel?: string;
  danger?: boolean;
  resolve: (v: string | boolean | null) => void;
}

const open = <T,>(d: Omit<DialogState, 'resolve'>) => new Promise<T>((resolve) => app.set({ dialog: { ...d, resolve: resolve as DialogState['resolve'] } }));

/** Pergunta um texto; devolve null se a pessoa cancelar. */
export const askText = (title: string, value = '', opts: { message?: string; multiline?: boolean; secret?: boolean; okLabel?: string } = {}) =>
  open<string | null>({ kind: 'text', title, value, ...opts });
/** Pede confirmação; devolve true/false. */
export const confirmDialog = (title: string, message?: string, opts: { okLabel?: string; danger?: boolean } = {}) =>
  open<boolean>({ kind: 'confirm', title, message, ...opts }).then(Boolean);

export function DialogHost() {
  const dialog = useApp((s) => s.dialog);
  return dialog ? <DialogView key={dialog.title + dialog.kind} dialog={dialog} /> : null;
}

function DialogView({ dialog }: { dialog: DialogState }) {
  const [value, setValue] = useState(dialog.value ?? '');
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const finish = (v: string | boolean | null) => { app.set({ dialog: null }); dialog.resolve(v); };
  useEffect(() => { field.current?.focus(); field.current?.select(); }, []);
  const submit = () => finish(dialog.kind === 'text' ? value : true);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(dialog.kind === 'text' ? null : false); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={dialog.title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); finish(dialog.kind === 'text' ? null : false); }
          else if (e.key === 'Enter' && !(dialog.multiline && !e.ctrlKey && !e.metaKey)) { e.preventDefault(); submit(); }
        }}>
        <h3>{dialog.title}</h3>
        {dialog.message && <p className="muted small">{dialog.message}</p>}
        {dialog.kind === 'text' && (dialog.multiline
          ? <textarea ref={field} className="field" rows={5} value={value} onChange={(e) => setValue(e.target.value)} />
          : <input ref={field} className="field" type={dialog.secret ? 'password' : 'text'} autoComplete={dialog.secret ? 'current-password' : undefined} value={value} onChange={(e) => setValue(e.target.value)} />)}
        <div className="row modal-actions">
          <span className="grow" />
          <button className="btn" onClick={() => finish(dialog.kind === 'text' ? null : false)}>Cancelar</button>
          <button className={`btn ${dialog.danger ? 'danger-solid' : 'primary'}`} onClick={submit}>{dialog.okLabel ?? 'OK'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
