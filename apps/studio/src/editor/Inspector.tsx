// Propriedades da seleção (aba Design). Cada campo, ao confirmar, vira uma chamada de ferramenta (update_layer / update_layers /
// set_responsive / set_state); o painel só mostra o que o projeto tem. Várias camadas: mostra os valores da 1ª e grava em todas.
import { useEffect, useState } from 'react';
import { tool } from '../lib/api';
import { flatten, pageOf } from '../lib/doc';
import { setPanel, setTool, useApp } from '../lib/app';
import { openProjectDialog } from './ProjectDialog';
import { NoteComposer, NoteList, useProjectNotes } from './ProjectNotes';
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
import { t, tp } from '../lib/i18n';

type Brief = { summary?: string; audience?: string; tone?: string[] };

/** Nada selecionado: uma porta de entrada rápida para começar a criar. */
function Empty() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const language = useApp((s) => s.language);
  const file = useApp((s) => s.file);
  const notes = useProjectNotes();
  const [brief, setBrief] = useState<Brief | null>(null);
  useEffect(() => { void tool<{ brief: Brief }>('get_project_brief').then((o) => setBrief(o.brief || {})).catch(() => setBrief({})); }, [file]);
  const page = pageOf(doc, pageId);
  const all = flatten(page.children);
  const screens = page.children.length;
  const components = all.filter((n) => n.component).length;
  const flows = all.reduce((s, n) => s + (n.interactions?.length ?? 0), 0);
  const openComments = ((doc.comments ?? []) as { resolved?: boolean }[]).filter((c) => !c.resolved).length;
  const tr = (key: string, v?: Record<string, string | number>) => t(language, key, v);
  return (
    <div className="project-overview">
      <header className="empty-selection-hero">
        <div className="empty-selection-icon" aria-hidden="true"><Icon name="cursor" size={18} /></div>
        <div className="grow">
          <h3>{tr('canvas.createScreen')}</h3>
          <p>{tr('canvas.emptyHint')}</p>
        </div>
      </header>
      <div className="empty-actions" aria-label={tr('canvas.createScreen')}>
        <button className="empty-action" onClick={() => setTool('frame')}><Icon name="frame" size={16} /><span>{tr('tool.frame')}</span><kbd>F</kbd></button>
        <button className="empty-action" onClick={() => setTool('rect')}><Icon name="rect" size={16} /><span>{tr('tool.rect')}</span><kbd>R</kbd></button>
        <button className="empty-action" onClick={() => setTool('text')}><Icon name="text" size={16} /><span>{tr('tool.text')}</span><kbd>T</kbd></button>
        <button className="empty-action" onClick={() => setTool('pen')}><Icon name="pen" size={16} /><span>{tr('tool.pen')}</span></button>
      </div>

      <details className="project-glance">
        <summary><span><Icon name="spark" size={14} /> {doc.name || file}</span><span className="faint small">{page.name}</span></summary>
        <div className="po-stats">
          <div><b>{screens}</b><span>{tp(language, 'overview.screens', screens)}</span></div>
          <div><b>{components}</b><span>{tp(language, 'overview.components', components)}</span></div>
          <div><b>{flows}</b><span>{tp(language, 'overview.flows', flows)}</span></div>
        </div>
        <div className="po-card-head"><h4>{tr('overview.about')}</h4><button className="link-btn" onClick={() => openProjectDialog('brief')}>{brief?.summary ? tr('overview.edit') : tr('overview.describe')}</button></div>
        {brief === null ? <p className="faint small"><span className="spinner" /></p>
          : brief.summary ? <><p className="po-summary">{brief.summary}</p>{brief.audience && <p className="faint small">{tr('overview.for')} {brief.audience}</p>}{brief.tone?.length ? <div className="po-tags">{brief.tone.map((x) => <span key={x} className="chip">{x}</span>)}</div> : null}</>
            : <p className="faint small">{tr('overview.aboutEmpty')}</p>}
      </details>

      <section className="po-card po-notes-card">
        <div className="po-card-head"><h4>{tr('overview.decisions')}</h4><button className="link-btn" onClick={() => setPanel('comments')}>{tr('overview.seeAll')}</button></div>
        <NoteList notes={notes} limit={1} />
        <NoteComposer compact />
      </section>

      <button className="po-row" onClick={() => setPanel('comments')}>
        <Icon name="comment" size={15} /><span className="grow">{tr('overview.openComments')}</span><span className={`badge${openComments ? '' : ' muted'}`}>{openComments}</span>
      </button>
      <button className="po-row" onClick={() => setPanel('export')}>
        <Icon name="spark" size={15} /><span className="grow">{tr('overview.mapForAgent')}</span><Icon name="chevron" size={14} />
      </button>

      <p className="po-hint faint small"><Icon name="cursor" size={12} /> {tr('ui.inspector.clickALayerOnThe')}</p>
      <div className="tips">
        <div><kbd>F</kbd> {t(language, 'ui.inspector.frame')}</div><div><kbd>R</kbd> {t(language, 'ui.inspector.rectangle')}</div>
        <div><kbd>T</kbd> {t(language, 'ui.inspector.text')}</div><div><kbd>⇧</kbd>+<kbd>A</kbd> {t(language, 'ui.inspector.autoLayout')}</div>
        <div><kbd>C</kbd> {t(language, 'tool.comment')}</div><div><kbd>?</kbd> {t(language, 'ui.inspector.allShortcuts')}</div>
      </div>
    </div>
  );
}

export function Inspector() {
  const c = useInspector();
  const language = useApp((s) => s.language);
  const [advanced, setAdvanced] = useState(() => { try { return localStorage.getItem('stylo.insp.advanced') === '1'; } catch { return false; } });
  if (!c) return <Empty />;
  const { n } = c;
  const isText = n.type === 'text';
  const toggleAdvanced = () => { setAdvanced(!advanced); try { localStorage.setItem('stylo.insp.advanced', advanced ? '0' : '1'); } catch { /* sem armazenamento */ } };
  const isComponent = !!(n.component || n.instanceOf);
  return (
    <div className="inspector">
      <Header c={c} />
      <BpBanner c={c} />
      <NoteSection c={c} />
      {c.baseOnly && isComponent && <ComponentSection c={c} />}
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
      <BooleanSourcesSection c={c} />
      <VectorSection c={c} />
      <button type="button" className="insp-advanced" aria-expanded={advanced} onClick={toggleAdvanced}>
        <Icon name={advanced ? 'chevrondown' : 'chevron'} size={12} />
        <span className="grow">{t(language, advanced ? 'inspector.advanced.hide' : 'inspector.advanced.show')}</span>
        <span className="faint small">{t(language, 'inspector.advanced.what')}</span>
      </button>
      {advanced && <>
        {c.baseOnly && !isComponent && <ComponentSection c={c} />}
        <StatesSection c={c} />
        <BooleanSection c={c} />
        <GridsSection c={c} />
        <HtmlSection c={c} />
        <CssSection c={c} />
        <ExportSection c={c} />
      </>}
    </div>
  );
}
