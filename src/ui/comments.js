/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/comments.js — PAINEL "COMENTÁRIOS" (aba do painel direito)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Escrever comentários nas camadas, responder, resolver e apagar. A lógica de dados vive em comments.js (puro);
 *  aqui só a tela. Os "pinos" no canvas são desenhados pelo overlay.js (e o clique neles abre a conversa aqui).
 *
 *  Como se comenta:
 *    - selecione UMA camada e escreva na caixa (o pino nasce no canto superior direito dela); ou
 *    - use a ferramenta Comentar (C) e clique no ponto exato da camada; ou
 *    - botão direito na camada → Comentar.
 *  Ctrl+Enter envia. Só aparecem os comentários das camadas da PÁGINA aberta.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { addComment, addReply, commentsOf, editText, removeComment, setResolved, timeAgo } from '../comments.js';

/** Primeira letra (maiúscula) do nome, para o "avatar". */
const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();

/**
 * Cria o painel de comentários.
 * @param {{store, canvas, prefs: object, toast: (m: string) => void}} deps
 * @returns {{el: HTMLElement, render: () => void}}
 */
export function createCommentsPanel({ store, canvas, prefs, toast }) {
  const ui = store.ui;
  const el = h('div.comments-panel');
  let sig = '';
  // textos digitados: sobrevivem aos redesenhos do painel (que acontecem a cada mudança do documento)
  let composerText = '';
  const replyText = new Map(); // id do comentário → rascunho da resposta
  let replyOpen = null; // id do comentário com a caixa de resposta aberta
  let editing = null; // id do comentário (ou da resposta) cujo texto está sendo editado
  const editText_ = new Map(); // id → rascunho do texto editado

  /** Comentário ou resposta pelo id, no documento de agora (os objetos antigos ficam velhos depois de desfazer). */
  const findItem = (id) => {
    for (const c of commentsOf(store.state.doc)) {
      if (c.id === id) return c;
      const r = (c.replies || []).find((x) => x.id === id);
      if (r) return r;
    }
    return null;
  };
  const author = () => String(prefs.author || '').trim() || 'Eu';

  /** Para onde vai o comentário novo: o ponto escolhido com a ferramenta, ou a camada selecionada (canto superior direito). */
  function target() {
    if (ui.commentDraft && store.get(ui.commentDraft.nodeId)) return ui.commentDraft;
    const id = ui.selection.length === 1 ? ui.selection[0] : null;
    return id && store.get(id) ? { nodeId: id, rx: 1, ry: 0 } : null;
  }

  /** Muda o documento (um passo de desfazer) e redesenha tudo que mostra comentários. */
  function change(fn) {
    store.update(fn, { commit: true, structural: false });
    sig = '';
    render();
    store.emit('overlay');
  }

  /** Envia o comentário novo. */
  function send() {
    const t = target();
    const text = composerText.trim();
    if (!t || !text) return;
    let created = null;
    change(() => { created = addComment(store.state.doc, { ...t, text, author: author() }); });
    composerText = '';
    ui.commentDraft = null;
    ui.activeComment = created?.id || null;
    sig = '';
    render();
    store.emit('overlay');
  }

  /** Seleciona a camada do comentário, rola até ela e destaca o pino. */
  function goTo(c) {
    ui.activeComment = c.id;
    store.setSelection([c.nodeId]);
    canvas.ensureVisible(c.nodeId);
    sig = '';
    render();
    store.emit('overlay');
  }

  /** Caixa de texto com enviar (compositor de comentário novo ou de resposta). */
  function composer({ placeholder, text, onText, onSend, onEsc, disabled, label, autofocus }) {
    const ta = h('textarea.cm-input', { rows: 3, placeholder, value: text, disabled, spellcheck: true, 'aria-label': placeholder });
    const btn = h('button.btn.primary.small', { type: 'button', disabled: disabled || !text.trim(), onclick: onSend }, ico('check', 13), ` ${label}`);
    ta.addEventListener('input', () => { onText(ta.value); btn.disabled = disabled || !ta.value.trim(); });
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onSend(); }
      if (e.key === 'Escape' && onEsc) { e.preventDefault(); e.stopPropagation(); onEsc(); }
    });
    if (autofocus) setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
    return h('div.cm-composer', ta, h('div.cm-composer-foot', h('span.cm-hint', 'Ctrl+Enter envia'), btn));
  }

  /** Um comentário (com respostas e ações). `n` = número do pino no canvas. */
  function thread(c, n) {
    const node = store.get(c.nodeId);
    const card = h('article.cm-thread' + (c.resolved ? '.resolved' : '') + (ui.activeComment === c.id ? '.active' : ''), { dataset: { comment: c.id } });
    /** Texto do comentário/resposta: com o botão de editar, ou a caixa de edição aberta. */
    const body = (item, owner) => {
      if (editing === item.id) {
        return composer({
          placeholder: 'Editar…', text: editText_.get(item.id) ?? item.text, label: 'Salvar', autofocus: true,
          onText: (v) => editText_.set(item.id, v),
          onSend: () => { const v = editText_.get(item.id) ?? item.text; editing = null; editText_.delete(item.id); change(() => { const live = findItem(item.id); if (live) editText(live, v); }); },
          onEsc: () => { editing = null; editText_.delete(item.id); sig = ''; render(); },
        });
      }
      return h('div.cm-body',
        h('p.cm-text', item.text),
        h('button.cm-edit', { type: 'button', title: 'Editar o texto', 'aria-label': 'Editar o texto', onclick: (e) => { e.stopPropagation(); editing = item.id; sig = ''; render(); } }, ico('pen', 11)));
    };
    const when = (item) => h('span.cm-time', timeAgo(item.at), item.editedAt ? ' · editado' : '');
    const head = h('div.cm-head',
      h('span.cm-avatar', initial(c.author)),
      h('div.cm-who', h('strong', c.author), when(c)),
      h('span.cm-num', `#${n}`));
    const where = h('button.cm-target', { type: 'button', title: 'Ir para a camada', onclick: () => goTo(c) }, ico('layers', 11), ` ${node?.name || 'camada'}`);
    card.append(head, where, body(c));
    for (const r of c.replies || []) {
      card.append(h('div.cm-reply',
        h('div.cm-head', h('span.cm-avatar.small', initial(r.author)), h('div.cm-who', h('strong', r.author), when(r))),
        body(r)));
    }
    if (replyOpen === c.id) {
      card.append(composer({
        placeholder: 'Responder…', text: replyText.get(c.id) || '', label: 'Responder', autofocus: true,
        onText: (v) => replyText.set(c.id, v),
        onSend: () => {
          const text = (replyText.get(c.id) || '').trim();
          if (!text) return;
          change(() => { addReply(commentsOf(store.state.doc).find((x) => x.id === c.id), { text, author: author() }); });
          replyText.delete(c.id);
          replyOpen = null;
          sig = '';
          render();
        },
      }));
    }
    card.append(h('div.cm-actions',
      h('button.btn.small.ghost', { type: 'button', onclick: () => { replyOpen = replyOpen === c.id ? null : c.id; sig = ''; render(); } }, ico('comment', 12), ' Responder'),
      h('button.btn.small.ghost', {
        type: 'button',
        onclick: () => change(() => { setResolved(commentsOf(store.state.doc).find((x) => x.id === c.id), !c.resolved); }),
      }, ico('check', 12), c.resolved ? ' Reabrir' : ' Resolver'),
      h('button.icon-btn.small', { type: 'button', title: 'Apagar comentário', 'aria-label': 'Apagar comentário', onclick: () => change(() => removeComment(store.state.doc, c.id)) }, ico('trash', 13))));
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, textarea')) return; // os botões têm as próprias ações
      goTo(c);
    });
    return card;
  }

  /** Redesenha o painel (pula se nada que ele mostra mudou). */
  function render() {
    // pedido de foco (ferramenta Comentar, menu de contexto): consome o pedido e força UM redesenho com a caixa focada.
    // (O pedido NÃO entra na assinatura abaixo: senão o redesenho seguinte reconstruiria a caixa e tiraria o foco.)
    let focus = false;
    if (ui.focusComment) { ui.focusComment = false; focus = true; sig = ''; }
    const doc = store.state.doc;
    const all = commentsOf(doc).filter((c) => store.get(c.nodeId)); // só desta página
    const t = target();
    const filter = ui.commentFilter || 'open';
    const open = all.filter((c) => !c.resolved).length;
    const next = JSON.stringify([all, filter, t && [t.nodeId, store.get(t.nodeId)?.name], ui.activeComment, replyOpen, editing, author()]);
    if (next === sig) return;
    sig = next;

    const tName = t ? store.get(t.nodeId)?.name : null;
    const compose = composer({
      placeholder: t ? `Comentar em “${tName}”…` : 'Selecione uma camada (ou use a ferramenta Comentar, C) para comentar',
      text: composerText, label: 'Comentar', disabled: !t, autofocus: focus && !!t,
      onText: (v) => { composerText = v; },
      onSend: send,
      onEsc: () => { composerText = ''; ui.commentDraft = null; sig = ''; render(); store.emit('overlay'); },
    });
    const chips = h('div.cm-filter', [['open', `Abertos (${open})`], ['resolved', `Resolvidos (${all.length - open})`], ['all', 'Todos']].map(([k, label]) =>
      h('button.tab-chip' + (filter === k ? '.on' : ''), { type: 'button', onclick: () => { ui.commentFilter = k; sig = ''; render(); store.emit('overlay'); } }, label)));
    const shown = all.filter((c) => filter === 'all' || (filter === 'open' ? !c.resolved : c.resolved));
    const list = shown.length
      ? shown.map((c) => thread(c, all.indexOf(c) + 1))
      : [h('div.empty-state', h('h3', filter === 'resolved' ? 'Nenhum comentário resolvido' : all.length ? 'Tudo resolvido' : 'Nenhum comentário ainda'),
        h('p', all.length ? 'Mude o filtro para ver os outros.' : 'Anote o que precisa mudar direto na camada: selecione-a e escreva acima, ou use a ferramenta Comentar (C).'))];
    el.replaceChildren(
      h('section.panel-section', h('header.section-head', h('span', 'Comentários'), h('span.cm-count', `${open} aberto${open === 1 ? '' : 's'}`)), compose),
      h('section.panel-section', chips, h('div.cm-list', list)));
  }

  render();
  return { el, render, send, goTo };
}
