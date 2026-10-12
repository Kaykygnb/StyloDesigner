import { useEffect, useState } from 'react';
import { run, select, useApp } from '../lib/app';
import { findNode, pageOf } from '../lib/doc';
import { t } from '../lib/i18n';

type Code = { html: string; css: string };

export function InspectPanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const boxes = useApp((s) => s.worldBoxes);
  const language = useApp((s) => s.language);
  const page = pageOf(doc, pageId);
  const node = selection.length === 1 ? findNode(page.children, selection[0]) : null;
  const [code, setCode] = useState<Code | null>(null);
  useEffect(() => { setCode(null); if (node) void run<Code>('get_code', { id: node.id }).then((v) => setCode(v ?? null)); }, [node?.id]);
  if (!node) return <div className="side-panel"><h4>{t(language, 'inspect.title')}</h4><p className="muted small">{t(language, 'inspect.hint')}</p></div>;
  const box = boxes[node.id];
  return <div className="side-panel inspect-panel">
    <div className="row"><h4 className="grow">{t(language, 'inspect.title')}</h4><button className="btn sm" onClick={() => select([])}>{t(language, 'inspect.clear')}</button></div>
    <p className="faint small">{node.name} · {node.type}</p>
    <dl className="inspect-grid"><dt>{t(language, 'inspect.position')}</dt><dd>{box ? `${Math.round(box.x)}, ${Math.round(box.y)}` : '—'}</dd><dt>{t(language, 'inspect.size')}</dt><dd>{box ? `${Math.round(box.w)} × ${Math.round(box.h)} px` : '—'}</dd><dt>{t(language, 'inspect.visible')}</dt><dd>{node.visible === false ? t(language, 'inspect.no') : t(language, 'inspect.yes')}</dd><dt>{t(language, 'inspect.locked')}</dt><dd>{node.locked ? t(language, 'inspect.yes') : t(language, 'inspect.no')}</dd></dl>
    {code && <><h4>{t(language, 'inspect.html')}</h4><pre className="code">{code.html}</pre><h4>{t(language, 'inspect.css')}</h4><pre className="code">{code.css}</pre></>}
  </div>;
}
