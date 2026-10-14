// Aba Código: o CSS e o HTML REAIS da seleção (os mesmos da exportação) e o CSS da página. Dá para editar: o que o painel Design entende
// vira campo da camada; o resto vai para o CSS livre (set_layer_css). A aba Página guarda o CSS global do projeto (set_project_css).
import { useCallback, useEffect, useState } from 'react';
import { lintLayerCss } from '@stylo/core/cssedit.ts';
import { canEdit } from '../lib/actions';
import { tool } from '../lib/api';
import { app, run, toast, useApp } from '../lib/app';
import { findNode, pageOf, topLevel } from '../lib/doc';
import { CodeEditor, type Lint } from '../ui/CodeEditor';
import { Icon } from '../ui/Icon';

type Tab = 'css' | 'html' | 'page';
interface Code { html: string; css: string; declarations: string }

const lintDecl = (text: string): Lint[] => (lintLayerCss(text, typeof CSS !== 'undefined' ? ((p: string, v: string) => CSS.supports(p, v)) : undefined) as Lint[]);

export function CodePanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const language = useApp((s) => s.language);
  const en = language === 'en-US';
  const [tab, setTab] = useState<Tab>('css');
  const [kids, setKids] = useState(true);
  const [code, setCode] = useState<Code | null>(null);
  const [err, setErr] = useState('');
  const editable = canEdit();
  const page = pageOf(doc, pageId);
  const ids = topLevel(page.children, selection);
  const node = ids.length === 1 ? findNode(page.children, ids[0]) : null;
  const rev = JSON.stringify(node ? [node, doc.styles?.pageCss] : null);

  const load = useCallback(async () => {
    if (!node) { setCode(null); return; }
    try { setCode(await tool<Code>('get_code', { id: node.id }, pageId ?? undefined)); setErr(''); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [node?.id, rev, pageId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast('ok', en ? 'Code copied.' : 'Código copiado.'); } catch { toast('error', en ? 'The browser blocked copying.' : 'O navegador bloqueou a cópia.'); } };
  const pageCss = String((doc.styles as { pageCss?: string })?.pageCss ?? '');

  return (
    <div className="code-panel">
      <div className="code-head">
        <div className="tab-chips">
          {([['css', 'CSS'], ['html', 'HTML'], ['page', en ? 'Page' : 'Página']] as [Tab, string][]).map(([id, label]) => <button key={id} className={`tab-chip${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        <span className="spacer" />
        <button className="ibtn" title={en ? 'Open the large editor (Ctrl+Shift+E)' : 'Abrir o editor grande (Ctrl+Shift+E)'} onClick={() => app.set({ dock: tab })}><Icon name="code" size={15} /></button>
      </div>

      {tab !== 'page' && !node && <p className="muted pad">{en ? 'Select a layer to see its code.' : 'Selecione uma camada para ver o código dela.'}</p>}
      {tab !== 'page' && node && err && <p className="notice error">{err}</p>}

      {tab === 'css' && node && code && (
        <>
          <div className="code-sub">
            <span className="faint">{en ? 'Layer declarations for' : 'Declarações da camada'} <b>{node.name}</b></span>
            <label className="check"><input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} /><span>{en ? 'Include children' : 'Incluir filhos'}</span></label>
          </div>
          {kids
            ? <CodeEditor value={code.css} language="css" readOnly minRows={10} extra={<button className="btn ghost sm" onClick={() => void copy(code.css)}><Icon name="copy" size={13} /> Copiar</button>} />
            : <CodeEditor value={code.declarations} language="css" lint={lintDecl} readOnly={!editable} minRows={8} applyLabel={en ? 'Apply CSS' : 'Aplicar CSS'} placeholder="width: 120px;" extra={<button className="btn ghost sm" onClick={() => void copy(code.declarations)}><Icon name="copy" size={13} /> {en ? 'Copy' : 'Copiar'}</button>}
              onApply={async (t) => { const out = await run<{ mapped?: string[]; custom?: string[]; ignored?: string[] }>('set_layer_css', { id: node.id, css: t }); if (out) toast('ok', `Aplicado: ${out.mapped?.length ?? 0} no painel Design, ${out.custom?.length ?? 0} no CSS livre${out.ignored?.length ? `, ${out.ignored.length} ignorado(s)` : ''}.`); }} />}
          {!kids && <p className="hint">{en ? 'What the Design panel understands (color, size, radius, shadow, type…) becomes a layer field; the rest goes to free CSS. Ctrl+Z undoes.' : 'O que o painel Design entende (cor, tamanho, raio, sombra, fonte…) vira campo da camada; o resto vai para o CSS livre. Ctrl+Z desfaz.'}</p>}
        </>
      )}

      {tab === 'html' && node && code && (
        <>
          <div className="code-sub"><span className="faint">{en ? 'HTML for' : 'HTML de'} <b>{node.name}</b></span></div>
          {node.type === 'html'
            ? <CodeEditor value={String(node.html ?? '')} language="html" readOnly={!editable} minRows={10} applyLabel={en ? 'Apply HTML' : 'Aplicar HTML'} placeholder="<p>Olá</p>" onApply={async (t) => { await run('update_layer', { id: node.id, props: { html: t } }); }}
                extra={<button className="btn ghost sm" onClick={() => void copy(String(node.html ?? ''))}><Icon name="copy" size={13} /> {en ? 'Copy' : 'Copiar'}</button>} />
            : <CodeEditor value={code.html} language="html" readOnly minRows={10} extra={<button className="btn ghost sm" onClick={() => void copy(code.html)}><Icon name="copy" size={13} /> {en ? 'Copy' : 'Copiar'}</button>} />}
          <p className="hint">{node.type === 'html' ? (en ? 'HTML is cleaned when displayed and exported (no <script> or on*).' : 'O HTML é limpo ao exibir e exportar (sem <script> nem on*).') : (en ? 'Tag, id, classes, link and description are edited in Design → HTML.' : 'Etiqueta, id, classes, link e descrição se editam em Design → HTML.')}</p>
        </>
      )}

      {tab === 'page' && (
        <>
          <p className="hint"><b>{en ? 'Page CSS.' : 'CSS da página.'}</b> {en ? 'Rules with selectors, @media, :hover and @keyframes for the whole project. Use exported HTML classes, your extra classes and ids. It applies in the canvas, exported HTML and presentation.' : 'Regras com seletores, @media, :hover e @keyframes para o projeto todo. Use as classes do HTML exportado, as suas classes extras e ids. Vale no canvas, no HTML exportado e na apresentação.'}</p>
          <CodeEditor value={pageCss} language="css" readOnly={!editable} minRows={14} applyLabel={en ? 'Apply page CSS' : 'Aplicar CSS da página'} placeholder={'.botao:hover { opacity: .9; }\n@media (max-width: 640px) { .titulo { font-size: 28px; } }'}
            onApply={async (t) => { await run('set_project_css', { css: t }); toast('ok', en ? 'Page CSS applied.' : 'CSS da página aplicado.'); }} />
        </>
      )}
    </div>
  );
}
