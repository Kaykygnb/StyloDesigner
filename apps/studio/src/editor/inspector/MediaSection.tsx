import { Section, Check, Sel, Hint } from '../../ui/Fields';
import type { Ctx } from './ctx';
import { useApp } from '../../lib/app';
import { t } from '../../lib/i18n';

const kinds = (language: 'pt-BR' | 'en-US'): [string, string][] => [
  ['video', t(language, 'media.video')], ['audio', t(language, 'media.audio')],
  ['model3d', t(language, 'media.model3d')], ['lottie', 'Lottie'],
];

/** Controles específicos da camada de mídia; não mistura configuração de mídia com código. */
export function MediaSection({ c }: { c: Ctx }) {
  if (c.n.type !== 'media') return null;
  const language = useApp((s) => s.language);
  const n = c.n;
  const set = (props: Record<string, unknown>) => void c.set(props);
  return (
    <Section id="media" title={t(language, 'media.title')}>
      <Sel label={t(language, 'media.type')} value={n.mediaKind || 'video'} options={kinds(language)} disabled={c.readOnly} onChange={(value) => set({ mediaKind: value })} />
      <Hint>{t(language, 'media.hint')}</Hint>
      <Check label={t(language, 'media.controls')} checked={n.mediaControls !== false} disabled={c.readOnly} onChange={(value) => set({ mediaControls: value })} />
      {(n.mediaKind === 'video' || n.mediaKind === 'audio') && <>
        <Check label={t(language, 'media.autoplay')} checked={!!n.mediaAutoplay} disabled={c.readOnly} onChange={(value) => set({ mediaAutoplay: value })} />
        <Check label={t(language, 'media.loop')} checked={!!n.mediaLoop} disabled={c.readOnly} onChange={(value) => set({ mediaLoop: value })} />
        <Check label={t(language, 'media.muted')} checked={!!n.mediaMuted} disabled={c.readOnly} onChange={(value) => set({ mediaMuted: value })} />
        {n.mediaKind === 'video' && <>
          <label className="small">{t(language, 'media.poster')}<input className="field" value={n.mediaPoster || ''} disabled={c.readOnly} placeholder="https://… ou assets/…" onChange={(e) => set({ mediaPoster: e.target.value || null })} /></label>
          <label className="small">{t(language, 'media.fallback')}<input className="field" value={n.mediaFallback || ''} disabled={c.readOnly} placeholder={t(language, 'media.fallbackPlaceholder')} onChange={(e) => set({ mediaFallback: e.target.value || null })} /></label>
        </>}
      </>}
    </Section>
  );
}
