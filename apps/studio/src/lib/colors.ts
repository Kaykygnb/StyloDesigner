// As cores que o projeto já usa, para oferecer no seletor de cor.
import { tl } from './i18n';
import type { ColorGroup } from '../ui/ColorPicker';
import type { Doc, LayerNode } from './types';

/** As cores sólidas mais usadas no projeto (preenchimentos e contornos), da mais para a menos usada. */
export function docTopColors(doc: Doc, max = 14): string[] {
  const count = new Map<string, number>();
  const bump = (c?: string) => { if (c) count.set(c.toUpperCase(), (count.get(c.toUpperCase()) ?? 0) + 1); };
  const walk = (list: LayerNode[]) => list.forEach((n) => {
    if (n.fill?.type === 'solid') bump(n.fill.color);
    if (n.stroke) bump(n.stroke.color);
    if (n.children) walk(n.children);
  });
  doc.pages.forEach((p) => walk(p.children));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c);
}

export const colorGroups = (doc: Doc): ColorGroup[] => [
  { title: tl('ui.color.docColors'), colors: docTopColors(doc, 16) },
  { title: tl('ui.color.colorStyles'), colors: ((doc.styles?.colors ?? []) as { color?: string }[]).map((c) => c.color ?? '').filter(Boolean) },
];
