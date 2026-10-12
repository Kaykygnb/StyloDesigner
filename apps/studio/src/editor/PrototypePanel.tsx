// Aba Protótipo: interações entre telas (clicar/passar o mouse → ir a outra tela, voltar ou abrir um link) e o botão Apresentar.
// As interações são uma propriedade da camada (update_layer.interactions); a tela inicial do fluxo é flowStart.
import { canEdit } from '../lib/actions';
import { app, run, toast, useApp } from '../lib/app';
import { boardsOf, findNode, isBoard, pageOf, topLevel } from '../lib/doc';
import { Check, Cap, Hint, IconBtn, Row, Section, Sel, Txt } from '../ui/Fields';
import { Icon } from '../ui/Icon';

export const TRANSITIONS: [string, string][] = [['instant', 'Instantâneo'], ['dissolve', 'Dissolver'], ['slide-left', 'Deslizar ← (entra pela direita)'], ['slide-right', 'Deslizar → (entra pela esquerda)'], ['slide-up', 'Deslizar ↑'], ['slide-down', 'Deslizar ↓']];
interface Interaction { trigger: string; action: string; target?: string; transition?: string; url?: string }

export function PrototypePanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const editable = canEdit();
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
      <button className="btn primary block" onClick={() => { if (!frames.length) toast('error', 'Crie pelo menos um frame para apresentar.'); else app.set({ presenting: true }); }}><Icon name="play" size={13} /> Apresentar (Ctrl+Alt+Enter)</button>
      <Hint>Escolha uma camada, adicione uma interação e aponte para outra tela. Depois clique em Apresentar.</Hint>
      {!n && <p className="muted small">Selecione uma camada para criar interações.</p>}
      {n && isBoard(page.children, n) && (
        <Check label="Ponto de partida do fluxo" checked={!!n.flowStart} disabled={!editable} onChange={(v) => void setStart(v)} />
      )}
      {n && (
        <Section id="proto" title="Interações" right={editable ? <IconBtn icon="plus" title="Adicionar interação" onClick={() => save([...list, { trigger: 'click', action: 'navigate', target: '', transition: 'dissolve' }])} /> : undefined}>
          {!list.length && <Hint>Esta camada ainda não tem interações.</Hint>}
          {list.map((it, i) => (
            <div className="effect-card" key={i}>
              <Row>
                <Sel value={it.trigger ?? 'click'} options={[['click', 'Ao clicar'], ['hover', 'Ao passar o mouse']]} disabled={!editable} title="Gatilho" onChange={(v) => set(i, { trigger: v })} />
                {editable && <IconBtn icon="minus" title="Remover interação" onClick={() => save(list.filter((_, k) => k !== i))} />}
              </Row>
              <Sel value={it.action} options={[['navigate', 'Navegar para'], ['back', 'Voltar'], ['url', 'Abrir link']]} disabled={!editable} title="Ação" onChange={(v) => set(i, { action: v })} />
              {it.action === 'url' && <Cap label="Endereço"><Txt value={it.url ?? ''} placeholder="https://…" disabled={!editable} onCommit={(v) => set(i, { url: v })} /></Cap>}
              {it.action === 'navigate' && (
                <>
                  <Sel value={it.target ?? ''} options={[['', 'Escolha a tela…'], ...frames.map(({ f, page: p }) => [f.id, `${f.name}${doc.pages.length > 1 ? ` (${p.name})` : ''}`] as [string, string])]} disabled={!editable} title="Destino" onChange={(v) => set(i, { target: v })} />
                  <Sel value={it.transition ?? 'dissolve'} options={TRANSITIONS} disabled={!editable} title="Transição" onChange={(v) => set(i, { transition: v })} />
                </>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
