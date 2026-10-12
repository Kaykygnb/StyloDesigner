// Escolher uma imagem: as que já estão no projeto, ou uma nova do computador. Devolve o id do asset (e o tamanho original).
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { app, run, toast, useApp } from '../lib/app';
import { readImageFile } from '../lib/uploads';
import { Icon } from './Icon';

export interface PickedImage { assetId: string; w: number; h: number }

export const pickImage = () => new Promise<PickedImage | null>((resolve) => app.set({ picker: { resolve } }));

export function ImagePickerHost() {
  const picker = useApp((s) => s.picker);
  const doc = useApp((s) => s.doc);
  const file = useRef<HTMLInputElement>(null);
  if (!picker || !doc) return null;
  const finish = (v: PickedImage | null) => { app.set({ picker: null }); picker.resolve(v); };
  const assets = Object.entries((doc.assets ?? {}) as Record<string, string>).filter(([, src]) => typeof src === 'string' && src.startsWith('data:image/'));

  const choose = async (id: string, src: string) => {
    const size = await new Promise<{ w: number; h: number }>((resolve) => { const im = new Image(); im.onload = () => resolve({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); im.onerror = () => resolve({ w: 1, h: 1 }); im.src = src; });
    finish({ assetId: id, ...size });
  };
  const upload = async (f: File) => {
    try {
      const { dataUrl, w, h } = await readImageFile(f);
      const out = await run<{ asset_id?: string; asset?: { id: string }; id?: string }>('add_asset', { name: f.name.replace(/\.[^.]+$/, ''), data_url: dataUrl });
      const assetId = out?.asset_id ?? out?.asset?.id ?? out?.id;
      if (assetId) finish({ assetId, w, h }); else toast('error', 'Não consegui guardar a imagem no projeto.');
    } catch (e) { toast('error', e instanceof Error ? e.message : 'Não consegui ler a imagem.'); }
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null); }}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Escolher imagem" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } }}>
        <div className="row"><h3 className="grow">Escolher imagem</h3><button className="btn ghost icon" aria-label="Fechar" onClick={() => finish(null)}><Icon name="close" size={16} /></button></div>
        <button className="btn primary" onClick={() => file.current?.click()}><Icon name="plus" size={14} /> Enviar do computador</button>
        <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        <div className="cap"><span>Imagens deste projeto</span></div>
        {assets.length ? (
          <div className="asset-grid">
            {assets.map(([id, src]) => <button key={id} type="button" className="asset-thumb" title="Usar esta imagem" onClick={() => void choose(id, src)}><img src={src} alt="" /></button>)}
          </div>
        ) : <p className="muted small">Este projeto ainda não tem imagens. Envie uma do computador ou procure fotos na aba Recursos.</p>}
      </div>
    </div>,
    document.body,
  );
}
