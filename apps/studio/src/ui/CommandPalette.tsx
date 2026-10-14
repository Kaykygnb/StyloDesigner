// Paleta de comandos (Ctrl+K / ⌘K): procure qualquer ação, ferramenta, painel ou projeto pelo nome.
// Cada tela registra os comandos que fazem sentido nela com useCommands; a paleta junta tudo ao abrir.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createStore, useStore } from '../lib/store';
import { app, setTheme, useApp } from '../lib/app';
import { t } from '../lib/i18n';
import { Icon } from './Icon';

export interface Command { id: string; label: string; group: string; icon?: string; hint?: string; keywords?: string; run: () => void }

const providers = new Map<string, () => Command[]>();
const palette = createStore<{ open: boolean }>({ open: false });

export const openCommandPalette = () => palette.set({ open: true });
const closePalette = () => palette.set({ open: false });

/** Registra os comandos de uma tela enquanto ela estiver montada. A função é lida só quando a paleta abre. */
export function useCommands(id: string, list: () => Command[]) {
  const latest = useRef(list);
  latest.current = list;
  useEffect(() => {
    providers.set(id, () => latest.current());
    return () => { providers.delete(id); };
  }, [id]);
}

/** Tira acentos e caixa, para "camera" achar "Câmera". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function score(cmd: Command, q: string): number {
  if (!q) return 1;
  const label = fold(cmd.label);
  const hay = `${label} ${fold(cmd.group)} ${fold(cmd.keywords ?? '')}`;
  if (label.startsWith(q)) return 4;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 3;
  if (hay.includes(q)) return 2;
  // letras na ordem, com buracos ("nvprj" acha "Novo projeto")
  let i = 0;
  for (const ch of label) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
}

export function CommandPaletteHost() {
  const open = useStore(palette, (s) => s.open);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        palette.set({ open: !palette.get().open });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return open ? <Palette /> : null;
}

function Palette() {
  const language = useApp((s) => s.language);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const restore = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);

  const all = useMemo<Command[]>(() => {
    const theme = app.get().theme;
    const base: Command[] = [
      { id: 'theme', group: t(language, 'inspector.appearance.title'), icon: theme === 'dark' ? 'sun' : 'moon', label: theme === 'dark' ? t(language, 'ui.appearance.light') : t(language, 'ui.appearance.dark'), keywords: 'tema theme', run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    ];
    return [...Array.from(providers.values()).flatMap((p) => p()), ...base];
  }, [language]);

  const q = fold(query.trim());
  const shown = useMemo(() => all.map((c) => [c, score(c, q)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([c]) => c), [all, q]);
  useEffect(() => setIndex(0), [q]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: 'nearest' }); }, [index]);
  useEffect(() => () => { restore.current?.focus?.({ preventScroll: true }); }, []);

  const runAt = (i: number) => { const cmd = shown[i]; if (!cmd) return; closePalette(); restore.current = null; cmd.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(index); }
  };

  let lastGroup = '';
  return createPortal(
    <div className="cmdk-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closePalette(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label={t(language, 'ui.command.title')} onKeyDown={onKey}>
        <div className="cmdk-search">
          <Icon name="search" size={16} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(language, 'ui.command.placeholder')}
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={shown[index] ? `palette-${index}` : undefined} aria-label={t(language, 'ui.command.title')} />
          <kbd>Esc</kbd>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {shown.map((cmd, i) => {
            const head = cmd.group !== lastGroup ? cmd.group : null;
            lastGroup = cmd.group;
            return [
              head ? <li key={`g:${head}:${i}`} className="cmdk-group" role="presentation">{head}</li> : null,
              <li key={cmd.id} id={`palette-${i}`} data-i={i} role="option" aria-selected={i === index} className={`cmdk-item${i === index ? ' on' : ''}`}
                onMouseMove={() => { if (i !== index) setIndex(i); }} onClick={() => runAt(i)}>
                <span className="cmdk-icon">{cmd.icon ? <Icon name={cmd.icon} size={15} /> : null}</span>
                <span className="cmdk-label">{cmd.label}</span>
                {cmd.hint && <kbd>{cmd.hint}</kbd>}
              </li>,
            ];
          })}
          {!shown.length && <li className="cmdk-empty">{t(language, 'ui.command.empty')}</li>}
        </ul>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {t(language, 'ui.command.navigate')}</span><span><kbd>Enter</kbd> {t(language, 'ui.command.run')}</span></div>
      </div>
    </div>,
    document.body,
  );
}
