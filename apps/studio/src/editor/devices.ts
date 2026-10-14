// Os "tamanhos de aparelho" do projeto (breakpoints): os do projeto, ou tablet e celular por padrão.
import type { Doc } from '../lib/types';
import { tl } from '../lib/i18n';

export interface Breakpoint { id: string; name: string; preview: number }

const defaults = (): Breakpoint[] => [
  { id: 'tablet', name: tl('ui.device.tablet'), preview: 768 },
  { id: 'mobile', name: tl('ui.device.mobile'), preview: 390 },
];

export function breakpointsOf(doc: Doc): Breakpoint[] {
  const own = (doc as unknown as { breakpoints?: Breakpoint[] }).breakpoints;
  return own?.length ? own.map((b) => ({ id: b.id, name: b.name, preview: b.preview })) : defaults();
}
