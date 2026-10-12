// Painéis da direita além das propriedades: problemas do design, agentes conectados e exportação.
import { useEffect, useState } from 'react';
import { projectActivity, projectPresence, projectPublishing, publishProject, reactZipUrl, siteZipUrl, tool } from '../lib/api';
import { runChecks, select, toast, useApp } from '../lib/app';
import { findNode, pageOf } from '../lib/doc';
import { Icon } from '../ui/Icon';

export function connectCommand() {
  return `claude mcp add --transport http stylo ${location.origin}/mcp`;
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast('ok', 'Copiado.'); }
  catch { toast('error', 'Não consegui copiar. Selecione o texto e copie com Ctrl+C.'); }
}

// ---------------------------------------------------------------- problemas (check_design)
export function IssuesPanel() {
  const issues = useApp((s) => s.issues);
  const running = useApp((s) => s.issuesRunning);
  const note = useApp((s) => s.issuesNote);
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const page = pageOf(doc, pageId);

  const go = (id: string) => { if (findNode(page.children, id)) { select([id]); } else toast('error', 'Essa camada não está nesta página (ou foi apagada).'); };

  return (
    <div className="side-panel">
      <div className="row">
        <h4 className="grow">Conferir o design</h4>
        <button className="btn primary sm" onClick={() => void runChecks()} disabled={running}>{running ? <span className="spinner" /> : null} {issues ? 'Conferir de novo' : 'Conferir agora'}</button>
      </div>
      <p className="muted small">Procura o que sai da tela em tablet e celular, contraste fraco, texto pequeno demais, imagens sem descrição e títulos fora de ordem.</p>
      {note && <p className="notice">{note}</p>}
      {issues && !issues.length && <div className="notice ok"><Icon name="check" size={14} /> Nenhum problema encontrado nesta página.</div>}
      <ul className="issues">
        {issues?.map((i, n) => (
          <li key={n} className={i.severity} onClick={() => go(i.layerId)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go(i.layerId); }}>
            <div className="row"><span className={`badge ${i.severity === 'erro' ? 'error' : 'warn'}`}>{i.severity === 'erro' ? 'Erro' : 'Aviso'}</span><b className="ellipsis">{i.layerName}</b></div>
            <p>{i.message}</p>
            <p className="faint small"><b>Como resolver:</b> {i.fix}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- agentes
export function AgentsPanel() {
  const presence = useApp((s) => s.presence);
  const live = useApp((s) => s.live);
  const file = useApp((s) => s.file);
  const [history, setHistory] = useState<Array<{ id: number; at: string; who: string; tool: string; summary: string; ok: boolean }>>([]);
  const [contextAgents, setContextAgents] = useState<Array<{ id: string; name: string; active?: boolean; lastTool?: string | null; locks?: string[] }>>([]);
  useEffect(() => { if (!file) return; void projectActivity(file).then(setHistory).catch(() => setHistory([])); void projectPresence(file).then((x) => setContextAgents(x.agents)).catch(() => setContextAgents([])); }, [file, presence?.activity.length]);
  const cmd = connectCommand();
  return (
    <div className="side-panel">
      <h4>Conectar um agente</h4>
      <p className="muted small">Qualquer agente de IA que fale MCP (Claude Code, Codex, Cursor…) trabalha neste mesmo projeto, ao mesmo tempo que você.</p>
      <div className="codebox"><code>{cmd}</code><button className="btn ghost icon sm" title="Copiar" onClick={() => void copy(cmd)}><Icon name="copy" size={14} /></button></div>
      <p className="faint small">Depois de conectar, peça algo como “monte uma página inicial para a minha loja”. O agente aparece aqui, e o que ele faz aparece na tela.</p>

      <h4>Quem está aqui {live ? '' : <span className="badge warn">sem conexão ao vivo</span>}</h4>
      <p className="faint small">Neste projeto</p>
      <ul className="people">
        {contextAgents.map((a) => <li key={a.id}><span className="dot" style={{ opacity: a.active ? 1 : 0.4 }} />{a.name}<span className="faint"> · {a.active ? (a.lastTool ? `usou ${a.lastTool}` : 'ativo') : 'parado'}{a.locks?.length ? ` · ${a.locks.length} trava(s)` : ''}</span></li>)}
        {!contextAgents.length && <li className="faint">Nenhum agente neste projeto.</li>}
      </ul>
      <ul className="people">
        {presence?.people.map((p) => <li key={p.id}><span className="dot" style={{ background: p.color }} />{p.name}<span className="faint"> · pessoa</span></li>)}
        {presence?.agents.map((a) => <li key={a.id}><span className="dot" style={{ background: a.color, opacity: a.active ? 1 : 0.4 }} />{a.name}<span className="faint"> · agente{a.active && a.lastTool ? ` · usou ${a.lastTool}` : a.active ? '' : ' · parado'}</span></li>)}
        {!presence?.people.length && !presence?.agents.length && <li className="faint">Ninguém conectado ainda.</li>}
      </ul>

      <h4>Atividade recente</h4>
      <ul className="activity">
        {presence?.activity.map((a, i) => <li key={i}><span className="dot" style={{ background: a.color }} /><span><b>{a.who}</b> {a.text}</span></li>)}
        {!presence?.activity.length && <li className="faint">Nada ainda.</li>}
      </ul>
      <h4>Histórico persistido do projeto</h4>
      <ul className="activity">
        {history.map((a) => <li key={a.id}><span className={`badge ${a.ok ? 'ok' : 'error'}`}>{a.ok ? 'OK' : 'Erro'}</span><span><b>{a.who}</b> · {a.summary || a.tool}<span className="faint"> · {new Date(a.at).toLocaleString('pt-BR')}</span></span></li>)}
        {!history.length && <li className="faint">Ainda não há operações persistidas.</li>}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- exportar
export function ExportPanel() {
  const file = useApp((s) => s.file)!;
  const [tokens, setTokens] = useState<{ path: string; content: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishes, setPublishes] = useState<Array<{ id: string; format: string; status: string; createdAt: string }>>([]);
  useEffect(() => { void projectPublishing(file).then(setPublishes).catch(() => setPublishes([])); }, [file]);
  const publish = async (format: 'html' | 'react') => {
    setBusy(true);
    try { const result = await publishProject(file, format); setPublishes((x) => [{ id: result.id, format: result.format, status: 'READY', createdAt: new Date().toISOString() }, ...x]); toast('ok', `${format === 'html' ? 'HTML' : 'React'} publicado.`); window.open(result.download, '_blank', 'noopener,noreferrer'); }
    catch (e) { toast('error', String(e)); } finally { setBusy(false); }
  };
  const getTokens = async (format: 'css' | 'json' | 'tailwind') => {
    setBusy(true);
    try { setTokens((await tool<{ files: { path: string; content: string }[] }>('export_tokens', { format })).files); }
    catch (e) { toast('error', e instanceof Error ? e.message : String(e)); setTokens(null); } finally { setBusy(false); }
  };
  return (
    <div className="side-panel">
      <h4>Exportar o site</h4>
      <p className="muted small">Cada tela vira uma página. Imagens e fontes saem como arquivos, junto com os créditos.</p>
      <div className="row"><button className="btn primary" disabled={busy} onClick={() => void publish('html')}>Publicar HTML</button><button className="btn" disabled={busy} onClick={() => void publish('react')}>Publicar React</button></div>
      <a className="btn primary block" href={siteZipUrl(file)} download><Icon name="download" size={15} /> Site em HTML (.zip)</a>
      <a className="btn block" href={reactZipUrl(file)} download><Icon name="download" size={15} /> Projeto React (.zip)</a>
      <h4>Publicações recentes</h4>
      <ul className="activity">{publishes.map((p) => <li key={p.id}><span className="badge ok">{p.status}</span><span>{p.format.toUpperCase()} · {new Date(p.createdAt).toLocaleString('pt-BR')}</span></li>)}{!publishes.length && <li className="faint">Ainda não há publicações.</li>}</ul>
      <h4>Tokens do design</h4>
      <p className="muted small">Cores, textos, sombras e tamanhos do projeto, para usar em outro código.</p>
      <div className="row">
        <button className="btn sm" disabled={busy} onClick={() => void getTokens('css')}>CSS</button>
        <button className="btn sm" disabled={busy} onClick={() => void getTokens('json')}>JSON</button>
        <button className="btn sm" disabled={busy} onClick={() => void getTokens('tailwind')}>Tailwind</button>
      </div>
      {tokens?.map((f) => (
        <div key={f.path}>
          <div className="row"><b className="small grow">{f.path}</b><button className="btn ghost sm" onClick={() => void copy(f.content)}><Icon name="copy" size={13} /> Copiar</button></div>
          <pre className="code">{f.content}</pre>
        </div>
      ))}
    </div>
  );
}
