// Preenchimento (ou "Cor do texto"): nenhum, cor sólida (com estilos de cor), gradiente linear/radial/cônico (com paradas) e imagem.
import { run, toast, useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import { colorGroups } from '../../lib/colors';
import { askText } from '../../ui/Dialog';
import { ColorRow } from '../../ui/ColorPicker';
import { Cap, IconBtn, Num, Row, Section, Sel } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { pickImage } from '../../ui/ImagePicker';
import type { Ctx } from './ctx';
import type { Fill } from '@stylo/core/types.ts';

type Stop = { color: string; opacity: number; pos: number };
/** CSS de uma faixa que mostra as paradas do gradiente (sempre a 90°, só para ver cores e posições). */
const barCss = (stops: Stop[]) => `linear-gradient(90deg, ${[...stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(', ')})`;

export function FillSection({ c }: { c: Ctx }) {
  const { n, doc } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const TYPES: [string, string][] = [['none', tr('inspector.fill.none')], ['solid', tr('inspector.fill.solid')], ['linear', tr('inspector.fill.linear')], ['radial', tr('inspector.fill.radial')], ['conic', tr('inspector.fill.conic')], ['image', tr('inspector.fill.image')]];
  const FITS: [string, string][] = [['cover', tr('inspector.fill.cover')], ['contain', tr('inspector.fill.contain')], ['fill', tr('inspector.fill.fill')], ['size', tr('inspector.fill.size')]];
  const REPEATS: [string, string][] = [['no-repeat', tr('inspector.fill.noRepeat')], ['repeat', tr('inspector.fill.repeat')], ['repeat-x', tr('inspector.fill.repeatX')], ['repeat-y', tr('inspector.fill.repeatY')]];
  const off = c.readOnly;
  const isText = n.type === 'text';
  const fill = (n.fill ?? { type: 'none' }) as Fill & { fit?: string; size?: number; posX?: number; posY?: number; repeat?: string; styleId?: string | null; gradientId?: string | null; natW?: number; natH?: number };
  const groups = colorGroups(doc);
  const styles = (doc.styles?.colors ?? []) as { id: string; name: string; color: string }[];
  const gradients = (doc.styles?.gradients ?? []) as { id: string; name: string }[];
  const stops = (fill.stops ?? []) as Stop[];
  const setFill = (patch: Record<string, unknown>) => void c.set({ fill: patch });

  const changeType = async (type: string) => {
    if (type === 'none') { await c.set({ fill: 'none' }); return; }
    await c.set({ fill: { type, styleId: null, gradientId: null } });
    if (type === 'image' && !fill.assetId) { const img = await pickImage(); if (img) await c.set({ fill: { type: 'image', assetId: img.assetId, natW: img.w, natH: img.h } }); }
  };
  const chooseImage = async () => { const img = await pickImage(); if (img) setFill({ type: 'image', assetId: img.assetId, natW: img.w, natH: img.h }); };
  const setStops = (next: Stop[]) => setFill({ stops: next, gradientId: null });
  const style = styles.find((s) => s.id === fill.styleId);

  const createStyle = async () => {
    const name = await askText(tr('inspector.fill.styleName'), `Cor ${styles.length + 1}`, { okLabel: tr('comments.save'), message: tr('inspector.fill.styleMessage') });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_color_styles', { colors: [{ name: name.trim(), color: fill.color }] });
    const id = made?.created?.[0]?.id;
    if (id) await c.set({ fill: { styleId: id } });
  };

  return (
    <Section id="fill" title={isText ? tr('inspector.fill.textColor') : tr('inspector.fill.title')}
      right={fill.type === 'none' && !off ? <IconBtn icon="plus" title={tr('inspector.fill.add')} size={14} onClick={() => void c.set({ fill: { type: 'solid', styleId: null } })} /> : undefined}>
      <Cap label={tr('inspector.fill.type')} css="background">
        <Sel value={fill.type} options={TYPES} disabled={off} title={tr('inspector.fill.typeHint')} mixed={c.mixed((x) => x.fill?.type)} onChange={(v) => void changeType(v)} />
      </Cap>

      {fill.type === 'solid' && (
        <>
          <div className="labeled">
            <span className="small">{tr('inspector.fill.color')}</span>
            <ColorRow color={fill.color} opacity={fill.opacity ?? 1} groups={groups} disabled={off} hideOpacity mixed={c.mixed((x) => x.fill?.color)}
              onChange={(hex, a) => void c.set({ fill: { type: 'solid', color: hex, opacity: a, styleId: null } })} />
          </div>
          <div className="row style-row">
            {style ? (
              <>
                <span className="style-pick linked" title={tr('inspector.fill.linkedStyle')}><span className="style-dot" style={{ background: style.color }} />{style.name}</span>
                <IconBtn icon="close" title={tr('inspector.fill.unlinkStyle')} disabled={off} onClick={() => setFill({ styleId: null })} />
              </>
            ) : (
              <>
                <Sel value="" options={[['', styles.length ? tr('inspector.fill.linkStyle') : tr('inspector.fill.noStyle')], ...styles.map((s) => [s.id, s.name] as [string, string])]} disabled={off || !styles.length} title={tr('inspector.fill.linkStyle')} onChange={(v) => { if (v) setFill({ styleId: v }); }} />
                <IconBtn icon="plus" title={tr('inspector.fill.createStyle')} disabled={off} onClick={() => void createStyle()} />
              </>
            )}
          </div>
        </>
      )}

      {(fill.type === 'linear' || fill.type === 'radial' || fill.type === 'conic') && (
        <>
          <div className="grad-bar" style={{ backgroundImage: barCss(stops) }} />
          {gradients.length > 0 && (
            <Sel value={fill.gradientId ?? ''} options={[['', tr('inspector.fill.ownGradient')], ...gradients.map((g) => [g.id, g.name] as [string, string])]} disabled={off} title={tr('inspector.fill.gradientStyle')}
              onChange={(v) => { if (v) setFill({ gradientId: v }); else setFill({ gradientId: null }); }} />
          )}
          {fill.type !== 'radial' && (
            <Row><Cap label={fill.type === 'conic' ? tr('inspector.fill.start') : tr('inspector.fill.angle')} css={fill.type === 'conic' ? 'from' : 'angle'}><Num label="°" value={fill.angle ?? 0} decimals={0} unit="°" disabled={off} onCommit={(v) => setFill({ angle: v ?? 0, gradientId: null })} /></Cap></Row>
          )}
          {stops.map((s, i) => (
            <div className="stop-row" key={i}>
              <Num value={s.pos} min={0} max={100} decimals={0} unit="%" disabled={off} title={tr('inspector.fill.colorPosition')} onCommit={(v) => setStops(stops.map((x, k) => (k === i ? { ...x, pos: v ?? 0 } : x)))} />
              <ColorRow color={s.color} opacity={s.opacity ?? 1} groups={groups} disabled={off} onChange={(hex, a) => setStops(stops.map((x, k) => (k === i ? { ...x, color: hex, opacity: a } : x)))} />
              {stops.length > 2 && <IconBtn icon="minus" title={tr('inspector.fill.removeColor')} disabled={off} onClick={() => setStops(stops.filter((_, k) => k !== i))} />}
            </div>
          ))}
          <button type="button" className="link-btn" disabled={off} onClick={() => { const last = stops[stops.length - 1]; setStops([...stops, { color: last?.color ?? '#000000', opacity: 1, pos: Math.min(100, (last?.pos ?? 0) + 10) }]); }}><Icon name="plus" size={12} /> {tr('inspector.fill.addColor')}</button>
        </>
      )}

      {fill.type === 'image' && (
        <>
          {fill.assetId && doc.assets?.[fill.assetId] && <div className="img-prev" style={{ backgroundImage: `url(${doc.assets[fill.assetId]})` }} />}
          <Row>
            <button type="button" className="btn grow" disabled={off} onClick={() => void chooseImage()}><Icon name="image" size={14} /> {tr('inspector.fill.changeImage')}</button>
          </Row>
          <Cap label={tr('inspector.fill.imageFit')} css="background-size">
            <Sel value={fill.fit ?? 'cover'} options={FITS} disabled={off} title={tr('inspector.fill.imageFit')} onChange={(v) => setFill({ fit: v })} />
          </Cap>
          {(fill.fit ?? 'cover') === 'size' && <Cap label={tr('inspector.fill.width')} css="background-size"><Num label="%" value={fill.size ?? 100} min={1} decimals={0} disabled={off} onCommit={(v) => setFill({ size: Math.max(1, v ?? 100) })} /></Cap>}
          <Cap label={tr('inspector.fill.position')} css="background-position">
            <Row wide>
              <div className="al-matrix">
                {[0, 50, 100].flatMap((py) => [0, 50, 100].map((px) => {
                  const on = (fill.posX ?? 50) === px && (fill.posY ?? 50) === py;
                  return <button key={`${px}${py}`} type="button" className={`al-cell${on ? ' on' : ''}`} aria-label={`${tr('inspector.fill.position')} ${px}% ${py}%`} disabled={off} onClick={() => setFill({ posX: px, posY: py })}><i /></button>;
                }))}
              </div>
              <div className="col">
                <Num label="X" value={fill.posX ?? 50} min={0} max={100} decimals={0} unit="%" disabled={off} onCommit={(v) => setFill({ posX: Math.max(0, Math.min(100, v ?? 50)) })} />
                <Num label="Y" value={fill.posY ?? 50} min={0} max={100} decimals={0} unit="%" disabled={off} onCommit={(v) => setFill({ posY: Math.max(0, Math.min(100, v ?? 50)) })} />
              </div>
            </Row>
          </Cap>
          {['contain', 'size'].includes(fill.fit ?? 'cover') && <Cap label={tr('inspector.fill.repeatLabel')} css="background-repeat"><Sel value={fill.repeat ?? 'no-repeat'} options={REPEATS} disabled={off} onChange={(v) => setFill({ repeat: v })} /></Cap>}
          {fill.assetId && !off && <button type="button" className="btn block" onClick={() => toast('ok', tr('inspector.fill.editPhotoHint'))}><Icon name="photo" size={14} /> {tr('inspector.fill.editPhoto')}</button>}
        </>
      )}
    </Section>
  );
}
