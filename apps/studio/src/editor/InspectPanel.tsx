import { useEffect, useState } from 'react';
import { run, select, useApp } from '../lib/app';
import { findNode, pageOf } from '../lib/doc';

type Code = { html: string; css: string };

export function InspectPanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const selection = useApp((s) => s.selection);
  const boxes = useApp((s) => s.worldBoxes);
  const page = pageOf(doc, pageId);
  const node = selection.length === 1 ? findNode(page.children, selection[0]) : null;
  const [code, setCode] = useState<Code | null>(null);
  useEffect(() => { setCode(null); if (node) void run<Code>('get_code', { id: node.id }).then((v) => setCode(v ?? null)); }, [node?.id]);
  if (!node) return <div className="side-panel"><h4>Inspecionar</h4><p className="muted small">Ative I ou clique em Inspecionar e selecione uma camada.</p></div>;
  const box = boxes[node.id];
  return <div className="side-panel inspect-panel">
    <div className="row"><h4 className="grow">Inspecionar</h4><button className="btn sm" onClick={() => select([])}>Limpar</button></div>
    <p className="faint small">{node.name} · {node.type}</p>
    <dl className="inspect-grid"><dt>Posição</dt><dd>{box ? `${Math.round(box.x)}, ${Math.round(box.y)}` : '—'}</dd><dt>Tamanho</dt><dd>{box ? `${Math.round(box.w)} × ${Math.round(box.h)} px` : '—'}</dd><dt>Visível</dt><dd>{node.visible === false ? 'não' : 'sim'}</dd><dt>Travada</dt><dd>{node.locked ? 'sim' : 'não'}</dd></dl>
    {code && <><h4>HTML</h4><pre className="code">{code.html}</pre><h4>CSS</h4><pre className="code">{code.css}</pre></>}
  </div>;
}
