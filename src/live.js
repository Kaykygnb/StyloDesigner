/**
 * live.js — LIGAÇÃO AO VIVO DO EDITOR COM O SERVIDOR (presença e "o projeto mudou")
 *
 * Quem executa as ferramentas MCP agora é o servidor (server/workspace). O editor só ouve dois avisos por
 * Server-Sent Events em /api/agent/events:
 *   presence  quem está no projeto (pessoas e agentes) e o que fizeram por último
 *   project   um arquivo de projeto foi gravado (por um agente, outra aba ou outra pessoa)
 * Se o servidor cair, o EventSource reconecta sozinho.
 */

/** Identificador desta aba (igual enquanto ela existir): a presença não duplica a pessoa ao reconectar. */
export function editorId() {
  let id = '';
  try { id = sessionStorage.getItem('stylo.tab') || ''; } catch { /* sem sessionStorage */ }
  if (!id) {
    id = `t${Math.random().toString(36).slice(2, 10)}`;
    try { sessionStorage.setItem('stylo.tab', id); } catch { /* idem */ }
  }
  return id;
}

/**
 * @param {object} deps
 * @param {() => {name: string, color: string}} [deps.profile]  quem está nesta aba
 * @param {(data: object) => void} [deps.onPresence]  retrato de quem está no projeto
 * @param {(event: {file: string, modified: number, contentHash: string, by: string}) => void} [deps.onProject]  arquivo gravado
 * @returns {{ close: () => void, reconnect: () => void }}
 */
export function connectLive({ profile = () => ({ name: 'Pessoa', color: '' }), onPresence = () => {}, onProject = () => {} }) {
  if (typeof EventSource === 'undefined') return { close() {}, reconnect() {} };
  let es = null;
  const parse = (fn) => (ev) => { try { fn(JSON.parse(ev.data)); } catch { /* evento inválido */ } };
  function connect() {
    es?.close();
    const p = profile();
    const q = new URLSearchParams({ id: editorId(), user: p.name || 'Pessoa', color: p.color || '' });
    es = new EventSource(`/api/agent/events?${q}`);
    es.addEventListener('presence', parse(onPresence));
    es.addEventListener('project', parse(onProject));
  }
  connect();
  return { close() { es?.close(); }, reconnect: connect };
}
