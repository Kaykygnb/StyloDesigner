// Aba Protótipo: interações entre telas (clicar/passar o mouse → ir a outra tela, voltar ou abrir um link) e o botão Apresentar.
// As interações são uma propriedade da camada (update_layer.interactions); a tela inicial do fluxo é flowStart.
import { canEdit } from '../lib/actions';
import { app, run, toast, useApp } from '../lib/app';
import { t } from '../lib/i18n';
import { boardsOf, findNode, isBoard, pageOf, topLevel } from '../lib/doc';
import { Check, Cap, Hint, IconBtn, Row, Section, Sel, Txt } from '../ui/Fields';
import { Icon } from '../ui/Icon';

interface Interaction { trigger: string; action: string; target?: string; transition?: string; url?: string }

export function PrototypePanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const editable = canEdit();
  const language = useApp((s) => s.language);
  const tr = (key: string, values?: Record<string, string | number>) => t(language, key, values);
  const transitions: [string, string][] = [['instant', tr('prototype.instant')], ['dissolve', tr('prototype.dissolve')], ['slide-left', tr('prototype.slideLeft')], ['slide-right', tr('prototype.slideRight')], ['slide-up', tr('prototype.slideUp')], ['slide-down', tr('prototype.slideDown')]];
  const page = pageOf(doc, pageId);
  const ids = topLevel(page.children, selection);
  const n = ids.length === 1 ? findNode(page.children, ids[0]) : null;
  const frames = doc.pages.flatMap((p) => boardsOf(p).map((f) => ({ f, page: p })));
  const list = ((n?.interactions ?? []) as Interaction[]);
  const save = (next: Interaction[] | null) => { if (n) void run('update_layer', { id: n.id, props: { interactions: next } }); };
  const set = (i: number, patch: Partial<Interaction>) => save(list.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const setStart = async (on: boolean) => {
    if (!n) return;
    const updates = frames.filter(({ f }) => f.flowStart && f.id !== n.id).map(({ f }) => ({ id: f.id, props: { flowStart: null } }));
    if (on) updates.push({ id: n.id, props: { flowStart: true } as never });
    else updates.push({ id: n.id, props: { flowStart: null } });
    await run('update_layers', { updates });
  };

  return (
    <div className="side-panel proto-panel">
      <button className="btn primary block" onClick={() => { if (!frames.length) toast('error', tr('prototype.noFrame')); else app.set({ presenting: true }); }}><Icon name="play" size={13} /> {tr('prototype.present')}</button>
      <Hint>{tr('prototype.hint')}</Hint>
      {!n && <p className="muted small">{tr('prototype.selectLayer')}</p>}
      {n && isBoard(page.children, n) && (
        <Check label={tr('prototype.startPoint')} checked={!!n.flowStart} disabled={!editable} onChange={(v) => void setStart(v)} />
      )}
      {n && (
        <Section id="proto" title={tr('prototype.interactions')} right={editable ? <IconBtn icon="plus" title={tr('prototype.add')} onClick={() => save([...list, { trigger: 'click', action: 'navigate', target: '', transition: 'dissolve' }])} /> : undefined}>
          {!list.length && <Hint>{tr('prototype.empty')}</Hint>}
          {list.map((it, i) => (
            <div className="effect-card" key={i}>
              <Row>
                <Sel value={it.trigger ?? 'click'} options={[['click', tr('prototype.click')], ['hover', tr('prototype.hover')]]} disabled={!editable} title={tr('prototype.trigger')} onChange={(v) => set(i, { trigger: v })} />
                {editable && <IconBtn icon="minus" title={tr('prototype.remove')} onClick={() => save(list.filter((_, k) => k !== i))} />}
              </Row>
              <Sel value={it.action} options={[['navigate', tr('prototype.navigate')], ['back', tr('prototype.back')], ['url', tr('prototype.url')]]} disabled={!editable} title={tr('prototype.action')} onChange={(v) => set(i, { action: v })} />
              {it.action === 'url' && <Cap label={tr('prototype.address')}><Txt value={it.url ?? ''} placeholder="https://…" disabled={!editable} onCommit={(v) => set(i, { url: v })} /></Cap>}
              {it.action === 'navigate' && (
                <>
                  <Sel value={it.target ?? ''} options={[['', tr('prototype.chooseScreen')], ...frames.map(({ f, page: p }) => [f.id, `${f.name}${doc.pages.length > 1 ? ` (${p.name})` : ''}`] as [string, string])]} disabled={!editable} title={tr('prototype.destination')} onChange={(v) => set(i, { target: v })} />
                  <Sel value={it.transition ?? 'dissolve'} options={transitions} disabled={!editable} title={tr('prototype.transition')} onChange={(v) => set(i, { transition: v })} />
                </>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
