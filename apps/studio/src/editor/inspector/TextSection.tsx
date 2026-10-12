// Texto: estilo compartilhado, fonte, peso, tamanho, altura de linha, espaçamentos, alinhamento, itálico, decoração e como o texto se comporta quando não cabe.
import { FONT_WEIGHTS } from '@stylo/core/model.js';
import { ensureFonts, nearestWeight, weightsOf } from '@stylo/core/fonts.ts';
import { run, useApp } from '../../lib/app';
import { t } from '../../lib/i18n';
import { askText } from '../../ui/Dialog';
import { Cap, Hint, IconBtn, Num, Row, Section, Seg, Sel } from '../../ui/Fields';
import { FontPicker } from '../../ui/FontPicker';
import type { Ctx } from './ctx';

export function TextSection({ c }: { c: Ctx }) {
  const { n, doc, bp } = c;
  const language = useApp((s) => s.language);
  const tr = (key: string) => t(language, key);
  const WHITE_SPACES: [string, string][] = [['', tr('inspector.text.normal')], ['nowrap', 'nowrap'], ['pre-line', 'pre-line'], ['pre', 'pre']];
  const WORD_BREAKS: [string, string][] = [['', tr('inspector.text.normal')], ['break-word', language === 'en-US' ? 'Break if needed' : 'Quebra se precisar'], ['break-all', language === 'en-US' ? 'Break at any letter' : 'Quebra em qualquer letra'], ['keep-all', language === 'en-US' ? 'Never inside a word' : 'Nunca dentro da palavra']];
  const TEXT_WRAPS: [string, string][] = [['', tr('inspector.text.normal')], ['balance', language === 'en-US' ? 'Balanced (balance)' : 'Equilibrado (balance)'], ['pretty', language === 'en-US' ? 'Avoid orphans (pretty)' : 'Sem sobras (pretty)']];
  const off = c.readOnly;
  const family = String(n.fontFamily ?? 'Inter');
  const avail: number[] = weightsOf(family);
  const weights = (FONT_WEIGHTS as [number, string][]).filter(([w]) => avail.includes(w));
  const styles = (doc.styles?.texts ?? []) as { id: string; name: string }[];
  const projectFonts = (((doc as unknown as { fonts?: { family: string }[] }).fonts) ?? []).map((f) => f.family);
  const detach = { textStyleId: null };

  const saveStyle = async () => {
    const name = await askText(tr('inspector.text.styleName'), `Texto ${styles.length + 1}`, { okLabel: tr('comments.save'), message: tr('inspector.text.styleMessage') });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_text_styles', { styles: [{ name: name.trim(), fontFamily: n.fontFamily, fontSize: n.fontSize, fontWeight: n.fontWeight, lineHeight: n.lineHeight, letterSpacing: n.letterSpacing, textAlign: n.textAlign }] });
    const id = made?.created?.[0]?.id;
    if (id) await run('apply_text_style', { ids: c.ids, style_id: id });
  };

  return (
    <Section id="text" title={tr('inspector.text.title')}>
      {!bp && (
        <Row>
          <Sel value={n.textStyleId ?? ''} options={[['', tr('inspector.text.noStyle')], ...styles.map((t) => [t.id, t.name] as [string, string])]} disabled={off} title={tr('inspector.text.style')} onChange={(v) => void run('apply_text_style', { ids: c.ids, style_id: v || null })} />
          <IconBtn icon="plus" title={tr('inspector.text.createStyle')} disabled={off} onClick={() => void saveStyle()} />
        </Row>
      )}
      {!bp && (
        <Cap label={tr('inspector.text.font')} css="font-family">
          <FontPicker value={family} projectFonts={projectFonts} disabled={off} onChange={(f) => { ensureFonts([f]); void c.set({ fontFamily: f, fontWeight: nearestWeight(f, Number(n.fontWeight ?? 400)) }); }} />
        </Cap>
      )}
      <Row>
        <Cap label={tr('inspector.text.weight')} css="font-weight"><Sel value={n.fontWeight ?? 400} options={(weights.length ? weights : (FONT_WEIGHTS as [number, string][])).map(([w, l]) => [w, `${l} (${w})`] as [number, string])} disabled={off} title="font-weight" onChange={(v) => void c.set({ fontWeight: Number(v) })} /></Cap>
        <Cap label={tr('inspector.text.size')} css="font-size"><Num label="Aa" value={n.fontSize ?? 16} min={1} decimals={1} disabled={off} title="font-size" mixed={c.mixed((x) => x.fontSize)} onCommit={(v) => void c.set({ fontSize: Math.max(1, v ?? 16) })} /></Cap>
      </Row>
      <Row>
        <Cap label={tr('inspector.text.lineHeight')} css="line-height"><Num label="↕" value={n.lineHeight ?? 1.4} min={0} step={0.05} decimals={2} disabled={off} title="line-height (multiplicador)" onCommit={(v) => void c.set({ lineHeight: v ?? 1.4 })} /></Cap>
        <Cap label={tr('inspector.text.spacing')} css="letter-spacing"><Num label="↔" value={n.letterSpacing ?? 0} step={0.1} decimals={2} disabled={off} title="letter-spacing (px)" onCommit={(v) => void c.set({ letterSpacing: v ?? 0 })} /></Cap>
      </Row>
      <Cap label={tr('inspector.text.alignStyle')} css="text-align">
        <Row>
          <Seg value={n.textAlign ?? 'left'} title={tr('inspector.text.align')} options={[{ value: 'left', icon: 'textleft', title: tr('inspector.text.left') }, { value: 'center', icon: 'textcenter', title: tr('inspector.text.center') }, { value: 'right', icon: 'textright', title: tr('inspector.text.right') }, { value: 'justify', icon: 'alignjustify', title: tr('inspector.text.justify') }]} disabled={off} onChange={(v) => void c.set({ textAlign: v })} />
        </Row>
        {!bp && (
          <div className="btn-group">
            <IconBtn icon="italic" title={tr('inspector.text.italic')} on={n.fontStyle === 'italic'} disabled={off} onClick={() => void c.set({ fontStyle: n.fontStyle === 'italic' ? 'normal' : 'italic' })} />
            <IconBtn icon="underline" title={tr('inspector.text.underline')} on={n.textDecoration === 'underline'} disabled={off} onClick={() => void c.set({ textDecoration: n.textDecoration === 'underline' ? 'none' : 'underline' })} />
            <IconBtn icon="strike" title={tr('inspector.text.strike')} on={n.textDecoration === 'line-through'} disabled={off} onClick={() => void c.set({ textDecoration: n.textDecoration === 'line-through' ? 'none' : 'line-through' })} />
          </div>
        )}
      </Cap>
      <Row>
        <Cap label={tr('inspector.text.transform')} css="text-transform"><Sel value={n.textTransform ?? 'none'} options={[['none', tr('inspector.text.normal')], ['uppercase', tr('inspector.text.uppercase')], ['lowercase', tr('inspector.text.lowercase')], ['capitalize', tr('inspector.text.capitalize')]]} disabled={off} title="text-transform" onChange={(v) => void c.set({ textTransform: v })} /></Cap>
      </Row>
      {n.sizeY === 'fixed' && !bp && (
        <Cap label={tr('inspector.text.vertical')} css="align-content">
          <Seg value={n.textVAlign ?? 'top'} title={tr('inspector.text.vertical')} options={[{ value: 'top', icon: 'vtop', title: tr('inspector.text.top') }, { value: 'center', icon: 'vmiddle', title: tr('inspector.text.center') }, { value: 'bottom', icon: 'vbottom', title: tr('inspector.text.bottom') }]} disabled={off} onChange={(v) => void c.set({ textVAlign: v })} />
        </Cap>
      )}
      <Row>
        <Cap label={tr('inspector.text.wordSpacing')} css="word-spacing"><Num label="␣" value={n.wordSpacing ?? 0} step={0.5} decimals={1} disabled={off} onCommit={(v) => void c.set({ wordSpacing: v || null })} /></Cap>
        <Cap label={tr('inspector.text.overflow')} css={n.truncate === 'clamp' ? 'line-clamp' : 'text-overflow'}>
          <Sel value={n.truncate ?? ''} options={[['', tr('inspector.text.wrapLine')], ['ellipsis', tr('inspector.text.ellipsis')], ['clamp', tr('inspector.text.clamp')]]} disabled={off} onChange={(v) => void c.set({ truncate: v || null, ...(v ? {} : { lines: null }) })} />
        </Cap>
      </Row>
      {n.truncate === 'clamp' && <Cap label={tr('inspector.text.maxLines')} css="line-clamp"><Num label="#" value={n.lines ?? 2} min={1} decimals={0} disabled={off} onCommit={(v) => void c.set({ lines: Math.max(1, Math.round(v ?? 2)) })} /></Cap>}
      {n.truncate && n.sizeX === 'hug' && !(Number(n.maxW) > 0) && <Hint>{tr('inspector.text.widthHint')}</Hint>}
      <Row>
        <Cap label={tr('inspector.text.whiteSpace')} css="white-space"><Sel value={n.whiteSpace ?? ''} options={WHITE_SPACES} disabled={off} onChange={(v) => void c.set({ whiteSpace: v || null })} /></Cap>
        <Cap label={tr('inspector.text.wordBreak')} css="word-break"><Sel value={n.wordBreak ?? ''} options={WORD_BREAKS} disabled={off} onChange={(v) => void c.set({ wordBreak: v || null })} /></Cap>
      </Row>
      <Cap label={tr('inspector.text.wrap')} css="text-wrap"><Sel value={n.textWrap ?? ''} options={TEXT_WRAPS} disabled={off} onChange={(v) => void c.set({ textWrap: v || null })} /></Cap>
      {void detach}
    </Section>
  );
}
