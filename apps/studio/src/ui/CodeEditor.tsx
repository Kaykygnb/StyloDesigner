// Editor de código simples e bom o bastante: números de linha, cores para CSS e HTML, Tab insere espaços, Ctrl+Enter aplica, Esc desfaz.
import { useEffect, useMemo, useRef, useState } from 'react';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlightCss(text: string): string {
  return esc(text)
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<i class="tk-c">$1</i>')
    .replace(/(^|[;{}\n])(\s*)([a-zA-Z-]+|--[\w-]+)(\s*:)/g, '$1$2<i class="tk-p">$3</i>$4')
    .replace(/(:\s*)([^;{}\n]+)/g, (m, a: string, v: string) => a + v
      .replace(/(#[0-9a-fA-F]{3,8}\b)/g, '<i class="tk-n">$1</i>')
      .replace(/(\b-?\d*\.?\d+(?:px|%|em|rem|vh|vw|deg|ms|s|fr)?\b)/g, '<i class="tk-n">$1</i>')
      .replace(/("[^"]*"|&#39;[^&]*&#39;|'[^']*')/g, '<i class="tk-s">$1</i>'))
    .replace(/(^|\n)(\s*)([^\n{};:]*\{)/g, '$1$2<i class="tk-sel">$3</i>')
    .replace(/(@[a-z-]+)/g, '<i class="tk-k">$1</i>');
}

export function highlightHtml(text: string): string {
  return esc(text)
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<i class="tk-c">$1</i>')
    .replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, '$1<i class="tk-k">$2</i>')
    .replace(/(\s)([a-zA-Z-:]+)(=)(&quot;|")(.*?)(&quot;|")/g, '$1<i class="tk-p">$2</i>$3<i class="tk-s">$4$5$6</i>');
}

export interface Lint { line: number; level: 'error' | 'warn'; msg: string }

export function CodeEditor({ value, onApply, language = 'css', lint, placeholder, readOnly, minRows = 8, applyLabel = 'Aplicar', fill, extra }: {
  value: string; onApply?: (text: string) => void | Promise<void>; language?: 'css' | 'html'; lint?: (text: string) => Lint[]; placeholder?: string;
  readOnly?: boolean; minRows?: number; applyLabel?: string; fill?: boolean; extra?: React.ReactNode;
}) {
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const pre = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const dirty = text !== value;
  const editing = useRef(false);
  useEffect(() => { if (!editing.current || !dirty) setText(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const issues = useMemo(() => (lint ? lint(text) : []), [lint, text]);
  const lines = text.split('\n').length;
  const html = useMemo(() => (language === 'css' ? highlightCss(text) : highlightHtml(text)) + '\n', [text, language]);
  const bad = new Map<number, Lint>();
  for (const i of issues) bad.set(i.line, i);

  const sync = () => {
    const a = area.current;
    if (!a) return;
    if (pre.current) { pre.current.scrollTop = a.scrollTop; pre.current.scrollLeft = a.scrollLeft; }
    if (gutter.current) gutter.current.scrollTop = a.scrollTop;
  };
  const apply = async () => {
    if (!onApply || !dirty || busy) return;
    setBusy(true);
    try { await onApply(text); editing.current = false; } finally { setBusy(false); }
  };

  return (
    <div className={`codeed${fill ? ' fill' : ''}`}>
      <div className="codeed-box" style={fill ? undefined : { height: `${Math.max(minRows, Math.min(24, lines + 1)) * 18 + 12}px` }}>
        <div className="codeed-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => <div key={i} className={bad.get(i + 1)?.level === 'error' ? 'err' : bad.get(i + 1) ? 'warn' : ''} title={bad.get(i + 1)?.msg}>{i + 1}</div>)}
        </div>
        <div className="codeed-stack">
          <pre ref={pre} className="codeed-hl" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
          <textarea
            ref={area} className="codeed-input" spellCheck={false} value={text} readOnly={readOnly} placeholder={placeholder} aria-label={language === 'css' ? 'Editor de CSS' : 'Editor de HTML'} wrap="off"
            onChange={(e) => { editing.current = true; setText(e.target.value); }} onScroll={sync}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const el = e.currentTarget; const s = el.selectionStart; const t = text.slice(0, s) + '  ' + text.slice(el.selectionEnd); setText(t); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); }
              else if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) { e.preventDefault(); void apply(); }
              else if (e.key === 'Escape') { editing.current = false; setText(value); e.currentTarget.blur(); }
            }}
          />
        </div>
      </div>
      <div className="codeed-foot">
        <span className={`codeed-status${issues.some((i) => i.level === 'error') ? ' err' : ''}`}>
          {issues.length ? `${issues.length} aviso(s): ${issues[0].msg}` : dirty ? 'Alterado — Ctrl+Enter aplica, Esc desfaz' : ''}
        </span>
        <span className="spacer" />
        {extra}
        {onApply && !readOnly && <button type="button" className="btn primary sm" disabled={!dirty || busy} onClick={() => void apply()}>{busy ? <span className="spinner" /> : null} {applyLabel}</button>}
      </div>
    </div>
  );
}
