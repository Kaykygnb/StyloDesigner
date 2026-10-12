// Ícones de traço (uma família só). Sem biblioteca: cada um é um conjunto curto de caminhos SVG.
import type { ReactElement } from 'react';

const PATHS: Record<string, ReactElement> = {
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><path d="M3 3l18 18" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a1 1 0 011-1h9" /></>,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />,
  frame: <path d="M7 3v18M17 3v18M3 7h18M3 17h18" />,
  text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  rect: <rect x="4" y="6" width="16" height="12" rx="1.5" />,
  ellipse: <ellipse cx="12" cy="12" rx="8" ry="6" />,
  line: <path d="M4 20L20 4" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-8 8" /></>,
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  chevrondown: <path d="M6 9l6 6 6-6" />,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>,
  tablet: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  alert: <path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2c2.8.2 5 2.4 5 5.3" /></>,
  folder: <path d="M3 6h6l2 2h10v11H3z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  group: <path d="M4 4h7v7H4zM13 13h7v7h-7z" />,
  check: <path d="M5 12l5 5 9-10" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  code: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  spark: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />,
  cursor: <path d="M5 3l14 7-6 2-2 6z" />,
  alignleft: <path d="M4 3v18M8 7h12M8 14h8" />,
  aligncenter: <path d="M12 3v18M5 7h14M7 14h10" />,
  alignright: <path d="M20 3v18M4 7h12M8 14h8" />,
  aligntop: <path d="M3 4h18M7 8v12M14 8v8" />,
  alignmiddle: <path d="M3 12h18M7 5v14M14 8v8" />,
  alignbottom: <path d="M3 20h18M7 4v12M14 8v8" />,
  home: <path d="M4 11l8-7 8 7v9H4z" />,
  link: <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />,
  copyx: <path d="M8 8h12v12H8zM4 16V4h12" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name] ?? PATHS.rect}
    </svg>
  );
}
