// Propriedades da seleção. Cada campo, ao confirmar, vira uma chamada de ferramenta (update_layer / update_layers / set_responsive).
import { GOOGLE, SYSTEM_FONTS } from '@stylo/core/fonts.ts';
import { align, canEdit, distribute, duplicateSelection, groupSelection, removeSelection, setProps, ungroupSelection } from '../lib/actions';
import { useApp } from '../lib/app';
import { inFlow, pageOf, parentOf, findNode, TYPE_LABEL } from '../lib/doc';
import type { LayerNode } from '../lib/types';
import { ColorField, Labeled, NumField, Section, SelectField, Segmented, TextField } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { breakpointsOf } from './devices';

const SIZE_MODES = [{ value: 'fixed', label: 'Fixo' }, { value: 'hug', label: 'Conteúdo' }, { value: 'fill', label: 'Preencher' }];
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }));
const JUSTIFY = [
  { value: 'flex-start', label: 'Início' }, { value: 'center', label: 'Centro' }, { value: 'flex-end', label: 'Fim' },
  { value: 'space-between', label: 'Espaço entre' }, { value: 'space-around', label: 'Espaço ao redor' }, { value: 'space-evenly', label: 'Espaço igual' },
];
const ALIGN = [{ value: 'flex-start', label: 'Início' }, { value: 'center', label: 'Centro' }, { value: 'flex-end', label: 'Fim' }, { value: 'stretch', label: 'Esticar' }];
const TAGS = ['div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'ul', 'ol', 'li', 'label', 'form'].map((t) => ({ value: t, label: `<${t}>` }));
const FONT_NAMES = [...SYSTEM_FONTS, ...Array.from(GOOGLE.keys())];

const solidColor = (n: LayerNode): string | undefined => (n.fill && n.fill.type === 'solid' ? n.fill.color : undefined);

export function Inspector() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const device = useApp((s) => s.device);
  const page = pageOf(doc, pageId);
  const nodes = selection.map((id) => findNode(page.children, id)).filter((n): n is LayerNode => !!n);
  const editable = canEdit();

  if (!nodes.length) return <EmptySelection />;

  const node = nodes[0];
  const multi = nodes.length > 1;
  const ids = nodes.map((n) => n.id);
  const set = (props: Record<string, unknown>) => void setProps(ids, props);
  const parent = parentOf(page.children, node.id);
  const flow = inFlow(parent, node);
  const isText = node.type === 'text';
  const isFrame = node.type === 'frame';
  const layout = node.layout;
  const bp = device === 'desktop' ? null : breakpointsOf(doc).find((b) => b.id === device);
  const hostedFonts = ((doc as unknown as { fonts?: { family: string }[] }).fonts ?? []).map((f) => f.family);
  const padding = Array.isArray(layout?.padding) ? layout!.padding[0] : (layout?.padding as unknown as number | undefined);

  return (
    <div className="inspector" aria-label="Propriedades">
      {bp && <div className="notice">Editando para <b>{bp.name}</b> ({bp.preview}px): as mudanças valem só neste tamanho.</div>}
      {!editable && <div className="notice">Você só pode ler este projeto.</div>}

      <div className="insp-title">
        <span className="type-chip"><Icon name={iconFor(node)} size={14} /> {multi ? `${nodes.length} camadas` : TYPE_LABEL[node.type] ?? node.type}</span>
        <span className="spacer" />
        <button className="btn ghost icon sm" title="Duplicar (Ctrl+D)" disabled={!editable} onClick={() => void duplicateSelection()}><Icon name="copy" size={15} /></button>
        <button className="btn ghost icon sm" title="Agrupar (Ctrl+G)" disabled={!editable || !multi} onClick={() => void groupSelection()}><Icon name="group" size={15} /></button>
        {node.type === 'group' && <button className="btn ghost sm" disabled={!editable} onClick={() => void ungroupSelection()}>Desagrupar</button>}
        <button className="btn ghost icon sm danger" title="Excluir (Delete)" disabled={!editable} onClick={() => void removeSelection()}><Icon name="trash" size={15} /></button>
      </div>
      {!multi && <div className="insp-name"><TextField value={node.name} disabled={!editable} onCommit={(name) => set({ name })} /></div>}

      {!flow && editable && (
        <div className="align-bar" aria-label="Alinhar">
          {([['left', 'alignleft', 'Alinhar à esquerda'], ['hcenter', 'aligncenter', 'Centralizar na horizontal'], ['right', 'alignright', 'Alinhar à direita'],
            ['top', 'aligntop', 'Alinhar ao topo'], ['vcenter', 'alignmiddle', 'Centralizar na vertical'], ['bottom', 'alignbottom', 'Alinhar à base']] as const).map(([k, icon, title]) => (
            <button key={k} className="btn ghost icon sm" title={title} onClick={() => void align(k)}><Icon name={icon} size={15} /></button>
          ))}
          {nodes.length >= 3 && <>
            <span className="sep" />
            <button className="btn ghost sm" title="Distribuir na horizontal" onClick={() => void distribute('h')}>↔ Distribuir</button>
            <button className="btn ghost sm" title="Distribuir na vertical" onClick={() => void distribute('v')}>↕ Distribuir</button>
          </>}
        </div>
      )}

      {!multi && (
        <Section title="Posição e tamanho">
          <div className="grid2">
            <NumField label="X" value={node.x} disabled={!editable || flow} onCommit={(x) => set({ x })} />
            <NumField label="Y" value={node.y} disabled={!editable || flow} onCommit={(y) => set({ y })} />
            <NumField label="L" value={node.w} min={1} disabled={!editable || node.sizeX === 'fill'} onCommit={(w) => set({ w })} />
            <NumField label="A" value={node.h} min={1} disabled={!editable || node.sizeY === 'fill'} onCommit={(h) => set({ h })} />
          </div>
          <div className="grid2">
            <Labeled label="Largura"><SelectField value={node.sizeX} options={SIZE_MODES} disabled={!editable} onCommit={(sizeX) => set({ sizeX })} /></Labeled>
            <Labeled label="Altura"><SelectField value={node.sizeY} options={SIZE_MODES} disabled={!editable} onCommit={(sizeY) => set({ sizeY })} /></Labeled>
          </div>
          {flow && <p className="hint faint">Esta camada está dentro de um layout automático: quem a posiciona é a caixa em volta.</p>}
        </Section>
      )}

      {isFrame && layout && (
        <Section title="Layout">
          <Segmented
            value={layout.mode} disabled={!editable}
            options={[{ value: 'none', label: 'Livre', title: 'Camadas soltas, posicionadas por X e Y' }, { value: 'row', label: 'Linha →', title: 'Em linha' }, { value: 'column', label: 'Coluna ↓', title: 'Em coluna' }, { value: 'grid', label: 'Grade', title: 'Grade' }]}
            onCommit={(mode) => set({ layout: { mode } })}
          />
          {layout.mode !== 'none' && (
            <>
              <div className="grid2">
                <NumField label="Espaço" value={layout.gap} min={0} disabled={!editable} onCommit={(gap) => set({ layout: { gap } })} />
                <NumField label="Margem" value={padding} min={0} disabled={!editable} onCommit={(p) => set({ layout: { padding: p } })} />
              </div>
              {layout.mode === 'grid' && <div className="grid2"><NumField label="Colunas" value={layout.cols} min={1} disabled={!editable} onCommit={(cols) => set({ layout: { cols } })} /><NumField label="Linhas" value={layout.rows} min={1} disabled={!editable} onCommit={(rows) => set({ layout: { rows } })} /></div>}
              {layout.mode !== 'grid' && (
                <div className="grid2">
                  <Labeled label="Distribuir"><SelectField value={layout.justify} options={JUSTIFY} disabled={!editable} onCommit={(justify) => set({ layout: { justify } })} /></Labeled>
                  <Labeled label="Alinhar"><SelectField value={layout.align} options={ALIGN} disabled={!editable} onCommit={(a) => set({ layout: { align: a } })} /></Labeled>
                </div>
              )}
              {layout.mode !== 'grid' && (
                <label className="check"><input type="checkbox" checked={!!layout.wrap} disabled={!editable} onChange={(e) => set({ layout: { wrap: e.target.checked } })} /> Quebrar linha quando faltar espaço</label>
              )}
            </>
          )}
        </Section>
      )}

      <Section title="Aparência">
        <Labeled label={isText ? 'Cor do texto' : 'Preenchimento'} wide>
          {node.fill && node.fill.type !== 'solid' && node.fill.type !== 'none' ? (
            <span className="badge">{node.fill.type === 'image' ? 'Imagem' : 'Gradiente'}</span>
          ) : (
            <ColorField value={solidColor(node)} disabled={!editable} onCommit={(fill) => set({ fill })} onClear={isText ? undefined : () => set({ fill: 'none' })} />
          )}
        </Labeled>
        <div className="grid2">
          <NumField label="Opac." value={Math.round((node.opacity ?? 1) * 100)} min={0} max={100} suffix="%" disabled={!editable} onCommit={(v) => set({ opacity: v / 100 })} />
          {!isText && <NumField label="Raio" value={Array.isArray(node.radius) ? node.radius[0] : 0} min={0} disabled={!editable} onCommit={(radius) => set({ radius })} />}
        </div>
        {!isText && (
          <>
            <Labeled label="Contorno" wide>
              <ColorField value={node.stroke?.color} disabled={!editable} onCommit={(color) => set({ stroke: { color, width: node.stroke?.width || 1 } })} onClear={() => set({ stroke: null })} />
            </Labeled>
            {node.stroke && <NumField label="Espessura" value={node.stroke.width} min={0} disabled={!editable} onCommit={(width) => set({ stroke: { width } })} />}
          </>
        )}
      </Section>

      {isText && !multi && (
        <Section title="Texto">
          <TextField multiline value={String(node.text ?? '')} disabled={!editable} onCommit={(text) => set({ text })} />
          <Labeled label="Fonte" wide>
            <input className="field" list="font-names" defaultValue={node.fontFamily} key={node.fontFamily} disabled={!editable} spellCheck={false}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== node.fontFamily) set({ fontFamily: v }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            <datalist id="font-names">{[...hostedFonts, ...FONT_NAMES].map((f) => <option key={f} value={f} />)}</datalist>
          </Labeled>
          <div className="grid2">
            <NumField label="Tamanho" value={node.fontSize} min={1} disabled={!editable} onCommit={(fontSize) => set({ fontSize })} />
            <Labeled label="Peso"><SelectField value={String(node.fontWeight ?? 400)} options={WEIGHTS} disabled={!editable} onCommit={(w) => set({ fontWeight: Number(w) })} /></Labeled>
            <NumField label="Altura" value={node.lineHeight} min={0.5} step={0.1} disabled={!editable} onCommit={(lineHeight) => set({ lineHeight })} />
            <NumField label="Espaço" value={node.letterSpacing} step={0.1} disabled={!editable} onCommit={(letterSpacing) => set({ letterSpacing })} />
          </div>
          <Segmented value={node.textAlign as 'left' | 'center' | 'right' | 'justify' | undefined} disabled={!editable}
            options={[{ value: 'left', label: 'Esq.' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Dir.' }, { value: 'justify', label: 'Justif.' }]}
            onCommit={(textAlign) => set({ textAlign })} />
          {node.sizeX === 'hug' && <p className="hint faint">Este texto não quebra linha (largura pelo conteúdo). Para um parágrafo, use largura <b>Preencher</b>.</p>}
        </Section>
      )}

      {!multi && (
        <Section title="Semântica e acessibilidade" open={false}>
          <Labeled label="Etiqueta HTML" wide><SelectField value={node.tag ?? 'div'} options={TAGS} disabled={!editable} onCommit={(tag) => set({ tag })} /></Labeled>
          {node.tag === 'a' && <Labeled label="Endereço (href)" wide><TextField value={String(node.href ?? '')} placeholder="https://… ou outra-tela.html" disabled={!editable} onCommit={(href) => set({ href })} /></Labeled>}
          {(node.fill?.type === 'image' || node.type === 'media') && <Labeled label="Descrição da imagem (alt)" wide><TextField value={String(node.alt ?? '')} disabled={!editable} onCommit={(alt) => set({ alt })} /></Labeled>}
          <label className="check"><input type="checkbox" checked={node.visible !== false} disabled={!editable} onChange={(e) => set({ visible: e.target.checked })} /> Visível</label>
          <label className="check"><input type="checkbox" checked={!!node.locked} disabled={!editable} onChange={(e) => set({ locked: e.target.checked })} /> Travada (não pode ser movida)</label>
        </Section>
      )}
    </div>
  );
}

function iconFor(n: LayerNode) {
  return ({ frame: 'frame', text: 'text', rect: 'rect', ellipse: 'ellipse', line: 'line', group: 'group', media: 'image' } as Record<string, string>)[n.type] ?? (n.fill?.type === 'image' ? 'image' : 'rect');
}

function EmptySelection() {
  const doc = useApp((s) => s.doc)!;
  const device = useApp((s) => s.device);
  return (
    <div className="inspector empty">
      <h4>Nada selecionado</h4>
      <p className="muted">Clique numa camada na tela ou na lista à esquerda para ver e editar as propriedades dela.</p>
      <ul className="tips muted">
        <li><b>Duplo clique</b> num texto edita direto na tela.</li>
        <li><b>Arraste</b> uma camada solta para movê-la; use as alças para mudar o tamanho.</li>
        <li><b>Ctrl+Z</b> desfaz; <b>Delete</b> apaga; <b>Ctrl+D</b> duplica.</li>
        <li>Use <b>Tablet</b> e <b>Celular</b> no topo para ajustar o responsivo.</li>
      </ul>
      <p className="faint">{doc.pages.length} página(s) · tamanho atual: {device === 'desktop' ? 'Desktop' : breakpointsOf(doc).find((b) => b.id === device)?.name}</p>
    </div>
  );
}
