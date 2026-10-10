/** Ponte entre pedidos do servidor e a aba do editor conectada por SSE. */
export function createEditorBridge({ getEditors, getEditorId = () => '', timeoutMs = 3 * 60 * 1000, cancelGraceMs = 5_000, nextId = (() => { let id = 0; return () => String(++id); })() }) {
  const pending = new Map();

  function settle(id, fn, value) {
    const call = pending.get(String(id));
    if (!call) return false;
    clearTimeout(call.timer);
    clearTimeout(call.graceTimer);
    call.signal?.removeEventListener('abort', call.cancel);
    pending.delete(String(id));
    fn(value);
    return true;
  }

  function callEditor(tool, args, client, signal, admin = false, editorId = '') {
    const editors = getEditors();
    const editor = editorId
      ? [...editors].find((target) => getEditorId(target) === editorId)
      : [...editors].pop();
    if (!editor) {
      const message = editorId
        ? `A aba selecionada no MCP (${editorId}) está desconectada. Use list_editors e select_editor para escolher outra.`
        : 'O editor não está aberto. Abra o editor no navegador e tente de novo.';
      return Promise.reject(new Error(message));
    }
    const id = nextId();
    return new Promise((resolve, reject) => {
      const sendCancel = (reason) => {
        const event = `event: cancel\ndata: ${JSON.stringify({ id, reason })}\n\n`;
        for (const target of new Set([editor, ...getEditors()])) { try { target.write(event); } catch { /* conexão fechada */ } }
      };
      const requestCancel = (reason) => {
        const call = pending.get(id);
        if (!call || call.cancelRequested) return;
        call.cancelRequested = reason;
        clearTimeout(call.timer);
        call.timedOut = reason === 'timeout';
        sendCancel(reason);
        call.graceTimer = setTimeout(() => {
          const message = reason === 'timeout'
            ? `O editor não confirmou o cancelamento de ${tool} após o timeout. A chamada foi encerrada; confira o estado do documento antes de repetir.`
            : `O editor não confirmou o cancelamento de ${tool}. A chamada foi encerrada; confira o estado do documento antes de repetir.`;
          settle(id, reject, new Error(message));
        }, cancelGraceMs);
      };
      const cancel = () => requestCancel('client');
      const timer = setTimeout(() => {
        requestCancel('timeout');
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, graceTimer: null, editor, cancel, signal, timedOut: false, cancelRequested: '', tool });
      if (!signal?.aborted) signal?.addEventListener('abort', cancel, { once: true });
      try { editor.write(`event: call\ndata: ${JSON.stringify({ id, tool, args, client, admin })}\n\n`); }
      catch (err) { settle(id, reject, err); }
      if (signal?.aborted) cancel();
    });
  }

  function reply(id, result) {
    const call = pending.get(String(id));
    if (!call) return false;
    if (call.timedOut) {
      settle(id, call.reject, new Error(`O editor confirmou o cancelamento de ${call.tool} após o timeout. Tente novamente.`));
      return true;
    }
    return settle(id, call.resolve, result ?? {});
  }

  function closeEditor(editor, error = new Error('O editor foi fechado durante a chamada. Reabra o editor e tente novamente.')) {
    for (const [id, call] of pending) if (call.editor === editor) settle(id, call.reject, error);
  }

  return { callEditor, reply, closeEditor, pendingCount: () => pending.size };
}
