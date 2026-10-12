/** Orçamento do JSON formatado emitido pelo MCP, sem seu envelope. */
import type { ToolArgs } from './types.ts';
export const responseBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2)).length;
export function shortName(value: unknown, limit: number) {
  const chars: string[] = [];
  for (const char of String(value ?? '')) { chars.push(char); if (chars.length > limit) break; }
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : chars.join('');
}
export function boundPagedItems(result: ToolArgs, maxBytes: number, error: string, key = 'layers') {
  const out: ToolArgs = { ...result, [key]: [...result[key]] };
  if (out.notice && responseBytes(out) > maxBytes) out.notice = 'O projeto mudou durante a sessão. Releia os dados antes de alterar.';
  while (responseBytes(out) > maxBytes && out[key].length) {
    out[key].pop();
    out.count = out[key].length;
    out.hasMore = out.offset + out.count < out.total;
    out.nextOffset = out.hasMore ? out.offset + out.count : null;
  }
  if (responseBytes(out) > maxBytes || (!out[key].length && result[key].length)) throw new Error(error);
  return out;
}

export function boundPagedLayers(result: ToolArgs, maxBytes: number, error: string) {
  return boundPagedItems(result, maxBytes, error);
}
