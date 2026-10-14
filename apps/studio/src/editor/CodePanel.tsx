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
import { t } from '../lib/i18n';

type Tab = 'css' | 'html' | 'page';
interface Code { html: string; css: string; declarations: string }

const lintDecl = (text: string): Lint[] => (lintLayerCss(text, typeof CSS !== 'undefined' ? ((p: string, v: string) => CSS.supports(p, v)) : undefined) as Lint[]);

export function CodePanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const language = useApp((s) => s.language);
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

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast('ok', t(language, 'ui.code.codeCopied')); } catch { toast('error', t(language, 'ui.code.theBrowserBlockedCopying')); } };
  const pageCss = String((doc.styles as { pageCss?: string })?.pageCss ?? '');

  return (
    <div className="code-panel">
      <div className="code-head">
        <div className="tab-chips">
          {([['css', 'CSS'], ['html', 'HTML'], ['page', t(language, 'ui.code.page')]] as [Tab, string][]).map(([id, label]) => <button key={id} className={`tab-chip${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        <span className="spacer" />
        <button className="ibtn" title={t(language, 'ui.code.openTheLargeEditorCtrl')} onClick={() => app.set({ dock: tab })}><Icon name="code" size={15} /></button>
      </div>

      {tab !== 'page' && !node && <p className="muted pad">{t(language, 'ui.code.selectALayerToSee')}</p>}
      {tab !== 'page' && node && err && <p className="notice error">{err}</p>}

      {tab === 'css' && node && code && (
        <>
          <div className="code-sub">
            <span className="faint">{t(language, 'ui.code.layerDeclarationsFor')} <b>{node.name}</b></span>
            <label className="check"><input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} /><span>{t(language, 'ui.code.includeChildren')}</span></label>
          </div>
          {kids
            ? <CodeEditor value={code.css} language="css" readOnly minRows={10} extra={<button className="btn ghost sm" onClick={() => void copy(code.css)}><Icon name="copy" size={13} /> {t(language, 'ui.code.copy')}</button>} />
            : <CodeEditor value={code.declarations} language="css" lint={lintDecl} readOnly={!editable} minRows={8} applyLabel={t(language, 'ui.code.applyCss')} placeholder="width: 120px;" extra={<button className="btn ghost sm" onClick={() => void copy(code.declarations)}><Icon name="copy" size={13} /> {t(language, 'actions.copy')}</button>}
              onApply={async (text) => { const out = await run<{ mapped?: string[]; custom?: string[]; ignored?: string[] }>('set_layer_css', { id: node.id, css: text }); if (out) toast('ok', t(language, 'ui.code.applied', { mapped: out.mapped?.length ?? 0, custom: out.custom?.length ?? 0, ignored: out.ignored?.length ? t(language, 'ui.code.ignored', { count: out.ignored.length }) : '' })); }} />}
          {!kids && <p className="hint">{t(language, 'ui.code.whatTheDesignPanelUnderstands')}</p>}
        </>
      )}

      {tab === 'html' && node && code && (
        <>
          <div className="code-sub"><span className="faint">{t(language, 'ui.code.htmlFor')} <b>{node.name}</b></span></div>
          {node.type === 'html'
            ? <CodeEditor value={String(node.html ?? '')} language="html" readOnly={!editable} minRows={10} applyLabel={t(language, 'ui.code.applyHtml')} placeholder="<p>Olá</p>" onApply={async (text) => { await run('update_layer', { id: node.id, props: { html: text } }); }}
                extra={<button className="btn ghost sm" onClick={() => void copy(String(node.html ?? ''))}><Icon name="copy" size={13} /> {t(language, 'actions.copy')}</button>} />
            : <CodeEditor value={code.html} language="html" readOnly minRows={10} extra={<button className="btn ghost sm" onClick={() => void copy(code.html)}><Icon name="copy" size={13} /> {t(language, 'actions.copy')}</button>} />}
          <p className="hint">{node.type === 'html' ? (t(language, 'ui.code.htmlIsCleanedWhenDisplayed')) : (t(language, 'ui.code.tagIdClassesLinkAnd'))}</p>
        </>
      )}

      {tab === 'page' && (
        <>
          <p className="hint"><b>{t(language, 'ui.code.pageCss')}</b> {t(language, 'ui.code.rulesWithSelectorsMediaHover')}</p>
          <CodeEditor value={pageCss} language="css" readOnly={!editable} minRows={14} applyLabel={t(language, 'ui.code.applyPageCss')} placeholder={'.botao:hover { opacity: .9; }\n@media (max-width: 640px) { .titulo { font-size: 28px; } }'}
            onApply={async (text) => { await run('set_project_css', { css: text }); toast('ok', t(language, 'ui.code.pageCssApplied')); }} />
        </>
      )}
    </div>
  );
}
