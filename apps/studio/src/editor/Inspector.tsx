// Propriedades da seleção (aba Design). Cada campo, ao confirmar, vira uma chamada de ferramenta (update_layer / update_layers /
// set_responsive / set_state); o painel só mostra o que o projeto tem. Várias camadas: mostra os valores da 1ª e grava em todas.
import { pageOf } from '../lib/doc';
import { useApp } from '../lib/app';
import { AppearanceSection } from './inspector/AppearanceSection';
import { AutoLayoutSection, FlowItemSection } from './inspector/AutoLayoutSection';
import { EffectsSection } from './inspector/EffectsSection';
import { FillSection } from './inspector/FillSection';
import { BpBanner, Header } from './inspector/Header';
import { BooleanSection, BooleanSourcesSection, ComponentSection, CssSection, ExportSection, GridsSection, HtmlSection, NoteSection, StatesSection, VectorSection } from './inspector/MoreSections';
import { PositionSection } from './inspector/PositionSection';
import { SizeSection } from './inspector/SizeSection';
import { StrokeSection } from './inspector/StrokeSection';
import { TextSection } from './inspector/TextSection';
import { MediaSection } from './inspector/MediaSection';
import { useInspector } from './inspector/ctx';
import { Icon } from '../ui/Icon';

function Empty() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const language = useApp((s) => s.language);
  const en = language === 'en-US';
  const page = pageOf(doc, pageId);
  const count = (list: typeof page.children): number => list.reduce((s, n) => s + 1 + count(n.children ?? []), 0);
  return (
    <div className="empty-state">
      <div className="empty-art"><span className="empty-spark spark-a" /><span className="empty-spark spark-b" /><Icon name="settings" size={26} /></div>
      <h3>{en ? 'Nothing selected' : 'Nada selecionado'}</h3>
      <p>{en ? 'Click a layer on the canvas or in the list to edit its properties.' : 'Clique numa camada no canvas ou na lista para editar as propriedades dela.'}</p>
      <p className="faint small">{page.name} · {count(page.children)} {en ? 'layers' : 'camadas'}</p>
      <div className="tips">
        <div><kbd>F</kbd> {en ? 'frame' : 'frame'}</div><div><kbd>R</kbd> {en ? 'rectangle' : 'retângulo'}</div>
        <div><kbd>E</kbd> {en ? 'ellipse' : 'elipse'}</div><div><kbd>T</kbd> {en ? 'text' : 'texto'}</div>
        <div><kbd>⇧</kbd>+<kbd>A</kbd> {en ? 'auto layout' : 'auto layout'}</div><div><kbd>?</kbd> {en ? 'all shortcuts' : 'todos os atalhos'}</div>
      </div>
    </div>
  );
}

export function Inspector() {
  const c = useInspector();
  if (!c) return <Empty />;
  const { n } = c;
  const isText = n.type === 'text';
  return (
    <div className="inspector">
      <Header c={c} />
      <BpBanner c={c} />
      {c.baseOnly && <ComponentSection c={c} />}
      <PositionSection c={c} />
      <SizeSection c={c} />
      {isText && <TextSection c={c} />}
      <MediaSection c={c} />
      {n.type === 'frame' && !c.editState && <AutoLayoutSection c={c} />}
      {!c.editState && <FlowItemSection c={c} />}
      <AppearanceSection c={c} />
      {n.type !== 'group' && <FillSection c={c} />}
      {n.type !== 'group' && <StrokeSection c={c} />}
      {n.type !== 'group' && <EffectsSection c={c} />}
      <StatesSection c={c} />
      <BooleanSection c={c} />
      <BooleanSourcesSection c={c} />
      <VectorSection c={c} />
      <GridsSection c={c} />
      <HtmlSection c={c} />
      <NoteSection c={c} />
      <CssSection c={c} />
      <ExportSection c={c} />
    </div>
  );
}
