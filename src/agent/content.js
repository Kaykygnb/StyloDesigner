/** Limites para conteúdo de código devolvido ao agente: resposta moderada por padrão, nunca acima de 1 MiB. */
export const DEFAULT_AGENT_CONTENT_BYTES = 256 * 1024;
export const MAX_AGENT_CONTENT_BYTES = 1024 * 1024;

export const agentContentLimit = (value) => {
  const requested = Math.trunc(Number(value) || DEFAULT_AGENT_CONTENT_BYTES);
  return Math.min(Math.max(requested, 1024), MAX_AGENT_CONTENT_BYTES);
};

/**
 * Retorna uma parte UTF-8 segura de um texto. `offset` e `nextOffset` são posições em bytes e nunca cortam um
 * caractere multibyte. O chamador usa `nextOffset` na chamada seguinte até `complete` ser true.
 */
export function boundedUtf8Chunk(value, { offset = 0, maxBytes = DEFAULT_AGENT_CONTENT_BYTES } = {}) {
  const text = String(value ?? '');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const start = Number(offset);
  if (!Number.isSafeInteger(start) || start < 0 || start > bytes.length) throw new Error('offset precisa apontar para uma posição válida do conteúdo.');
  if (start > 0 && start < bytes.length && (bytes[start] & 0xc0) === 0x80) throw new Error('offset precisa ficar entre caracteres UTF-8. Use nextOffset da resposta anterior.');
  const limit = agentContentLimit(maxBytes);

  const index = new TextDecoder().decode(bytes.subarray(0, start)).length;
  let content = '';
  let used = 0;
  let nextOffset = start;
  for (const char of text.slice(index)) {
    const size = encoder.encode(char).length;
    if (used + size > limit && content) break;
    if (size > limit) throw new Error('maxBytes é pequeno demais para incluir o próximo caractere.');
    content += char;
    used += size;
    nextOffset += size;
  }
  return { content, chunkBytes: used, offset: start, nextOffset, totalBytes: bytes.length, complete: nextOffset === bytes.length };
}
