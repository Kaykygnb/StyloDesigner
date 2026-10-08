/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  comments.js — COMENTÁRIOS NAS CAMADAS   (módulo puro: sem DOM, testado em tests/features.test.js)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Um comentário é uma anotação presa a UMA camada, com um ponto relativo à caixa dela (rx, ry de 0 a 1:
 *  1,0 = canto superior direito). Como é relativo, o "pino" acompanha a camada quando ela se move ou muda de tamanho.
 *
 *  Onde ficam: em `doc.comments` (lista), DENTRO do mesmo arquivo do projeto. Por isso viajam com o .json, entram
 *  nas versões antigas e no desfazer. Documentos antigos não têm a lista (todas as funções toleram isso).
 *
 *  Formato:
 *    { id, nodeId, rx, ry, text, author, at (data ISO), resolved, replies: [{ id, text, author, at }] }
 *
 *  Sem login: o autor é o nome definido nas Configurações. Quando existir trabalho em equipe, o mesmo formato serve.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { uid, walk } from './model.js';

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** Todos os comentários do documento (lista vazia se o projeto é antigo e não tem). */
export const commentsOf = (doc) => doc.comments || [];

/**
 * Cria um comentário numa camada e o põe no documento. Texto vazio não cria nada.
 * @param {object} doc
 * @param {{nodeId: string, rx?: number, ry?: number, text: string, author?: string}} o
 * @returns {object|null} o comentário criado (ou null se o texto estava vazio)
 */
export function addComment(doc, { nodeId, rx = 1, ry = 0, text, author }) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const c = { id: uid(), nodeId, rx: clamp01(rx), ry: clamp01(ry), text: t, author: author || 'Eu', at: new Date().toISOString(), resolved: false, replies: [] };
  (doc.comments ||= []).push(c);
  return c;
}

/** Responde a um comentário. Texto vazio não cria nada. @returns {object|null} a resposta criada */
export function addReply(comment, { text, author }) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const r = { id: uid(), text: t, author: author || 'Eu', at: new Date().toISOString() };
  (comment.replies ||= []).push(r);
  return r;
}

/** Marca (ou reabre) um comentário como resolvido. */
export function setResolved(comment, resolved) {
  comment.resolved = !!resolved;
}

/** Apaga um comentário pelo id. @returns {boolean} true se existia */
export function removeComment(doc, id) {
  const before = commentsOf(doc).length;
  doc.comments = commentsOf(doc).filter((c) => c.id !== id);
  return doc.comments.length !== before;
}

/** Comentários de uma camada (todos, resolvidos ou não). */
export const forNode = (doc, nodeId) => commentsOf(doc).filter((c) => c.nodeId === nodeId);

/** Quantos comentários ABERTOS (não resolvidos) há no documento, ou numa camada se `nodeId` for dado. */
export const openCount = (doc, nodeId) => commentsOf(doc).filter((c) => !c.resolved && (!nodeId || c.nodeId === nodeId)).length;

/**
 * Remove os comentários cujas camadas não existem mais (a camada foi apagada). Roda a cada commit. Como o desfazer
 * restaura a foto anterior do documento (que ainda tem o comentário), apagar uma camada e desfazer traz tudo de volta.
 * @returns {boolean} true se removeu algo
 */
export function pruneComments(doc) {
  const list = commentsOf(doc);
  if (!list.length) return false;
  const ids = new Set();
  for (const page of doc.pages || []) walk(page.children, (n) => { ids.add(n.id); });
  const kept = list.filter((c) => ids.has(c.nodeId));
  if (kept.length === list.length) return false;
  doc.comments = kept;
  return true;
}

/**
 * "há 5 min", "há 3 h", "ontem", "12/10" — o tempo desde `iso`, curto e em português.
 * @param {string} iso  data ISO
 * @param {number} [now]  agora em ms (para testar)
 */
export function timeAgo(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `há ${hr} h`;
  const d = Math.round(hr / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  const dt = new Date(t);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}
