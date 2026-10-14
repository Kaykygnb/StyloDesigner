import { Section, Check, Sel, Hint } from '../../ui/Fields';
import type { Ctx } from './ctx';
import { useApp, type Language } from '../../lib/app';
import { t } from '../../lib/i18n';

const kinds = (language: Language): [string, string][] => [
  ['video', t(language, 'media.video')], ['audio', t(language, 'media.audio')],
  ['model3d', t(language, 'media.model3d')], ['lottie', 'Lottie'],
];

/** Controles específicos da camada de mídia; não mistura configuração de mídia com código. */
export function MediaSection({ c }: { c: Ctx }) {
  const language = useApp((s) => s.language); // hooks sempre antes de qualquer return (senão o React quebra ao trocar de camada)
  if (c.n.type !== 'media') return null;
  const n = c.n;
  const set = (props: Record<string, unknown>) => void c.set(props);
  return (
    <Section id="media" title={t(language, 'media.title')}>
      <Sel label={t(language, 'media.type')} value={n.mediaKind || 'video'} options={kinds(language)} disabled={c.readOnly} onChange={(value) => set({ mediaKind: value })} />
      <Hint>{t(language, 'media.hint')}</Hint>
      <Check label={t(language, 'media.controls')} checked={n.mediaControls !== false} disabled={c.readOnly} onChange={(value) => set({ mediaControls: value })} />
      {n.mediaKind === 'model3d' && <>
        <Check label={t(language, 'media.modelAutoRotate')} checked={!!n.modelAutoRotate} disabled={c.readOnly} onChange={(value) => set({ modelAutoRotate: value || null })} />
        <Check label={t(language, 'media.modelScroll')} checked={!!n.modelScroll} disabled={c.readOnly} onChange={(value) => set({ modelScroll: value || null })} />
        <label className="small">{t(language, 'media.modelOrbit')}<input key={n.id + (n.modelOrbit || '')} className="field" defaultValue={n.modelOrbit || ''} disabled={c.readOnly} placeholder="45deg 75deg auto" onBlur={(e) => { const v = e.target.value.trim(); if (v !== (n.modelOrbit || '')) set({ modelOrbit: v || null }); }} /></label>
      </>}
      {(n.mediaKind === 'video' || n.mediaKind === 'audio') && <>
        <Check label={t(language, 'media.autoplay')} checked={!!n.mediaAutoplay} disabled={c.readOnly} onChange={(value) => set({ mediaAutoplay: value })} />
        <Check label={t(language, 'media.loop')} checked={!!n.mediaLoop} disabled={c.readOnly} onChange={(value) => set({ mediaLoop: value })} />
        <Check label={t(language, 'media.muted')} checked={!!n.mediaMuted} disabled={c.readOnly} onChange={(value) => set({ mediaMuted: value })} />
        {n.mediaKind === 'video' && <>
          <label className="small">{t(language, 'media.poster')}<input key={n.id + (n.mediaPoster || '')} className="field" defaultValue={n.mediaPoster || ''} disabled={c.readOnly} placeholder="https://… / assets/…" onBlur={(e) => { if (e.target.value !== (n.mediaPoster || '')) set({ mediaPoster: e.target.value || null }); }} /></label>
          <label className="small">{t(language, 'media.fallback')}<input key={n.id + (n.mediaFallback || '')} className="field" defaultValue={n.mediaFallback || ''} disabled={c.readOnly} placeholder={t(language, 'media.fallbackPlaceholder')} onBlur={(e) => { if (e.target.value !== (n.mediaFallback || '')) set({ mediaFallback: e.target.value || null }); }} /></label>
        </>}
      </>}
    </Section>
  );
}
