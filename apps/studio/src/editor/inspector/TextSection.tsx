// Texto: estilo compartilhado, fonte, peso, tamanho, altura de linha, espaçamentos, alinhamento, itálico, decoração e como o texto se comporta quando não cabe.
import { FONT_WEIGHTS } from '@stylo/core/model.js';
import { ensureFonts, nearestWeight, weightsOf } from '@stylo/core/fonts.ts';
import { run } from '../../lib/app';
import { askText } from '../../ui/Dialog';
import { Cap, Hint, IconBtn, Num, Row, Section, Seg, Sel } from '../../ui/Fields';
import { FontPicker } from '../../ui/FontPicker';
import type { Ctx } from './ctx';

const WHITE_SPACES: [string, string][] = [['', 'Normal (quebra na borda)'], ['nowrap', 'Uma linha (nowrap)'], ['pre-line', 'Respeita Enter (pre-line)'], ['pre', 'Exato (pre)']];
const WORD_BREAKS: [string, string][] = [['', 'Normal'], ['break-word', 'Quebra se precisar'], ['break-all', 'Quebra em qualquer letra'], ['keep-all', 'Nunca dentro da palavra']];
const TEXT_WRAPS: [string, string][] = [['', 'Normal'], ['balance', 'Equilibrado (balance)'], ['pretty', 'Sem sobras (pretty)']];

export function TextSection({ c }: { c: Ctx }) {
  const { n, doc, bp } = c;
  const off = c.readOnly;
  const family = String(n.fontFamily ?? 'Inter');
  const avail: number[] = weightsOf(family);
  const weights = (FONT_WEIGHTS as [number, string][]).filter(([w]) => avail.includes(w));
  const styles = (doc.styles?.texts ?? []) as { id: string; name: string }[];
  const projectFonts = (((doc as unknown as { fonts?: { family: string }[] }).fonts) ?? []).map((f) => f.family);
  const detach = { textStyleId: null };

  const saveStyle = async () => {
    const name = await askText('Nome do estilo de texto', `Texto ${styles.length + 1}`, { okLabel: 'Salvar', message: 'O estilo guarda fonte, tamanho e espaçamentos para reaproveitar.' });
    if (!name?.trim()) return;
    const made = await run<{ created?: { id: string }[] }>('create_text_styles', { styles: [{ name: name.trim(), fontFamily: n.fontFamily, fontSize: n.fontSize, fontWeight: n.fontWeight, lineHeight: n.lineHeight, letterSpacing: n.letterSpacing, textAlign: n.textAlign }] });
    const id = made?.created?.[0]?.id;
    if (id) await run('apply_text_style', { ids: c.ids, style_id: id });
  };

  return (
    <Section id="text" title="Texto">
      {!bp && (
        <Row>
          <Sel value={n.textStyleId ?? ''} options={[['', 'Sem estilo'], ...styles.map((t) => [t.id, t.name] as [string, string])]} disabled={off} title="Estilo de texto" onChange={(v) => void run('apply_text_style', { ids: c.ids, style_id: v || null })} />
          <IconBtn icon="plus" title="Criar um estilo de texto a partir desta camada" disabled={off} onClick={() => void saveStyle()} />
        </Row>
      )}
      {!bp && (
        <Cap label="Fonte" css="font-family">
          <FontPicker value={family} projectFonts={projectFonts} disabled={off} onChange={(f) => { ensureFonts([f]); void c.set({ fontFamily: f, fontWeight: nearestWeight(f, Number(n.fontWeight ?? 400)) }); }} />
        </Cap>
      )}
      <Row>
        <Cap label="Peso" css="font-weight"><Sel value={n.fontWeight ?? 400} options={(weights.length ? weights : (FONT_WEIGHTS as [number, string][])).map(([w, l]) => [w, `${l} (${w})`] as [number, string])} disabled={off} title="font-weight" onChange={(v) => void c.set({ fontWeight: Number(v) })} /></Cap>
        <Cap label="Tamanho" css="font-size"><Num label="Aa" value={n.fontSize ?? 16} min={1} decimals={1} disabled={off} title="font-size" mixed={c.mixed((x) => x.fontSize)} onCommit={(v) => void c.set({ fontSize: Math.max(1, v ?? 16) })} /></Cap>
      </Row>
      <Row>
        <Cap label="Altura da linha" css="line-height"><Num label="↕" value={n.lineHeight ?? 1.4} min={0} step={0.05} decimals={2} disabled={off} title="line-height (multiplicador)" onCommit={(v) => void c.set({ lineHeight: v ?? 1.4 })} /></Cap>
        <Cap label="Espaçamento" css="letter-spacing"><Num label="↔" value={n.letterSpacing ?? 0} step={0.1} decimals={2} disabled={off} title="letter-spacing (px)" onCommit={(v) => void c.set({ letterSpacing: v ?? 0 })} /></Cap>
      </Row>
      <Cap label="Alinhamento e estilo" css="text-align">
        <Row>
          <Seg value={n.textAlign ?? 'left'} title="Alinhamento do texto" options={[{ value: 'left', icon: 'textleft', title: 'Esquerda' }, { value: 'center', icon: 'textcenter', title: 'Centro' }, { value: 'right', icon: 'textright', title: 'Direita' }, { value: 'justify', icon: 'alignjustify', title: 'Justificado' }]} disabled={off} onChange={(v) => void c.set({ textAlign: v })} />
        </Row>
        {!bp && (
          <div className="btn-group">
            <IconBtn icon="italic" title="Itálico" on={n.fontStyle === 'italic'} disabled={off} onClick={() => void c.set({ fontStyle: n.fontStyle === 'italic' ? 'normal' : 'italic' })} />
            <IconBtn icon="underline" title="Sublinhado" on={n.textDecoration === 'underline'} disabled={off} onClick={() => void c.set({ textDecoration: n.textDecoration === 'underline' ? 'none' : 'underline' })} />
            <IconBtn icon="strike" title="Riscado" on={n.textDecoration === 'line-through'} disabled={off} onClick={() => void c.set({ textDecoration: n.textDecoration === 'line-through' ? 'none' : 'line-through' })} />
          </div>
        )}
      </Cap>
      <Row>
        <Cap label="Caixa das letras" css="text-transform"><Sel value={n.textTransform ?? 'none'} options={[['none', 'Normal'], ['uppercase', 'MAIÚSCULAS'], ['lowercase', 'minúsculas'], ['capitalize', 'Cada Palavra']]} disabled={off} title="text-transform" onChange={(v) => void c.set({ textTransform: v })} /></Cap>
      </Row>
      {n.sizeY === 'fixed' && !bp && (
        <Cap label="Alinhamento vertical" css="align-content">
          <Seg value={n.textVAlign ?? 'top'} title="Alinhamento vertical" options={[{ value: 'top', icon: 'vtop', title: 'Topo da caixa' }, { value: 'center', icon: 'vmiddle', title: 'Centralizar' }, { value: 'bottom', icon: 'vbottom', title: 'Embaixo' }]} disabled={off} onChange={(v) => void c.set({ textVAlign: v })} />
        </Cap>
      )}
      <Row>
        <Cap label="Espaço entre palavras" css="word-spacing"><Num label="␣" value={n.wordSpacing ?? 0} step={0.5} decimals={1} disabled={off} onCommit={(v) => void c.set({ wordSpacing: v || null })} /></Cap>
        <Cap label="Quando não cabe" css={n.truncate === 'clamp' ? 'line-clamp' : 'text-overflow'}>
          <Sel value={n.truncate ?? ''} options={[['', 'Quebrar linha'], ['ellipsis', 'Uma linha com …'], ['clamp', 'Limitar linhas']]} disabled={off} onChange={(v) => void c.set({ truncate: v || null, ...(v ? {} : { lines: null }) })} />
        </Cap>
      </Row>
      {n.truncate === 'clamp' && <Cap label="Máximo de linhas" css="line-clamp"><Num label="#" value={n.lines ?? 2} min={1} decimals={0} disabled={off} onCommit={(v) => void c.set({ lines: Math.max(1, Math.round(v ?? 2)) })} /></Cap>}
      {n.truncate && n.sizeX === 'hug' && !(Number(n.maxW) > 0) && <Hint>Para cortar o texto, defina uma largura fixa ou máxima (Tamanho → Limites e proporção).</Hint>}
      <Row>
        <Cap label="Espaços e quebras" css="white-space"><Sel value={n.whiteSpace ?? ''} options={WHITE_SPACES} disabled={off} onChange={(v) => void c.set({ whiteSpace: v || null })} /></Cap>
        <Cap label="Palavras longas" css="word-break"><Sel value={n.wordBreak ?? ''} options={WORD_BREAKS} disabled={off} onChange={(v) => void c.set({ wordBreak: v || null })} /></Cap>
      </Row>
      <Cap label="Equilíbrio das linhas" css="text-wrap"><Sel value={n.textWrap ?? ''} options={TEXT_WRAPS} disabled={off} onChange={(v) => void c.set({ textWrap: v || null })} /></Cap>
      {void detach}
    </Section>
  );
}
