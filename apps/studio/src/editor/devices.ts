// Os "tamanhos de aparelho" do projeto (breakpoints): os do projeto, ou tablet e celular por padrão.
import type { Doc } from '../lib/types';

export interface Breakpoint { id: string; name: string; preview: number }

const DEFAULTS: Breakpoint[] = [
  { id: 'tablet', name: 'Tablet', preview: 768 },
  { id: 'mobile', name: 'Celular', preview: 390 },
];

export function breakpointsOf(doc: Doc): Breakpoint[] {
  const own = (doc as unknown as { breakpoints?: Breakpoint[] }).breakpoints;
  return own?.length ? own.map((b) => ({ id: b.id, name: b.name, preview: b.preview })) : DEFAULTS;
}
