import { BREAKPOINTS, DEFAULT_BREAKPOINTS, setBreakpoints } from './model.js';

/** Escopo estritamente síncrono: nenhum projeto deixa seus breakpoints ativos para outro. */
export function withDocumentBreakpoints<T>(doc: { breakpoints?: unknown }, task: () => T & (T extends PromiseLike<unknown> ? never : unknown)): T {
  const previous = BREAKPOINTS.map((breakpoint) => ({ ...breakpoint }));
  try {
    const list = Array.isArray(doc?.breakpoints) && doc.breakpoints.length ? doc.breakpoints : DEFAULT_BREAKPOINTS;
    setBreakpoints(list);
    const result = task();
    if (result && typeof (result as any).then === 'function') throw new Error('O escopo de breakpoints aceita somente operações síncronas.');
    return result;
  } finally {
    BREAKPOINTS.splice(0, BREAKPOINTS.length, ...previous);
  }
}
