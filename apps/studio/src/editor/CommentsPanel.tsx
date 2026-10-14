// Aba Comentários: conversas presas a camadas (pino no canvas). Criar, responder, editar, resolver/reabrir e apagar = ferramentas
// add_comment / manage_comment: agentes e pessoas veem e respondem no mesmo lugar.
import { useState } from 'react';
import { canEdit } from '../lib/actions';
import { app, run, selectAndReveal, useApp } from '../lib/app';
import { findNode, flatten, pageOf } from '../lib/doc';
import { askText, confirmDialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { formatRelativeTime, t } from '../lib/i18n';

interface Reply { id: string; text: string; author: string; at: string; editedAt?: string }
interface Comment { id: string; nodeId: string; rx: number; ry: number; text: string; author: string; at: string; editedAt?: string; resolved: boolean; replies: Reply[] }

export function CommentsPanel() {
  const doc = useApp((s) => s.doc)!;
  const pageId = useApp((s) => s.pageId);
  const draft = useApp((s) => s.commentDraft);
  const active = useApp((s) => s.activeComment);
  const language = useApp((s) => s.language);
  const editable = canEdit();
  const [showResolved, setShowResolved] = useState(false);
  const [text, setText] = useState('');
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const page = pageOf(doc, pageId);
  const here = new Set(flatten(page.children).map((n) => n.id));
  const all = ((doc.comments ?? []) as Comment[]).filter((c) => here.has(c.nodeId));
  const open = all.filter((c) => !c.resolved);
  const done = all.filter((c) => c.resolved);
  const nodeName = (id: string) => findNode(page.children, id)?.name ?? '?';

  const send = async () => {
    if (!draft || !text.trim()) return;
    await run('add_comment', { id: draft.nodeId, text: text.trim(), rx: draft.rx, ry: draft.ry });
    setText('');
    app.set({ commentDraft: null });
  };
  const go = (c: Comment) => { selectAndReveal([c.nodeId]); app.set({ activeComment: c.id }); };
  const act = (c: Comment, action: string, extra: Record<string, unknown> = {}) => run('manage_comment', { comment_id: c.id, action, ...extra });

  const card = (c: Comment) => (
    <article key={c.id} className={`comment${active === c.id ? ' active' : ''}${c.resolved ? ' resolved' : ''}`} onClick={() => go(c)}>
      <header>
        <span className="avatar">{c.author.slice(0, 1).toUpperCase()}</span>
        <div className="grow"><b>{c.author}</b><div className="faint small">{formatRelativeTime(language, c.at)}{c.editedAt ? ` · ${t(language, 'comments.edited')}` : ''} · {t(language, 'comments.on')} <i>{nodeName(c.nodeId)}</i></div></div>
      </header>
      <p className="comment-text">{c.text}</p>
      {c.replies.map((r) => (
        <div className="reply" key={r.id}>
          <b>{r.author}</b> <span className="faint small">{formatRelativeTime(language, r.at)}{r.editedAt ? ` · ${t(language, 'comments.edited')}` : ''}</span>
          <p>{r.text}</p>
          {editable && <button className="link-btn" onClick={(e) => { e.stopPropagation(); void askText(t(language, 'comments.editReply'), r.text, { multiline: true, okLabel: t(language, 'comments.save') }).then((value) => { if (value?.trim() && value !== r.text) void act(c, 'edit', { reply_id: r.id, text: value.trim() }); }); }}>{t(language, 'comments.edit')}</button>}
        </div>
      ))}
      {replying === c.id ? (
        <div className="reply-box" onClick={(e) => e.stopPropagation()}>
          <textarea className="field" rows={2} autoFocus placeholder={t(language, 'comments.replyPlaceholder')} value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setReplying(null); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { void act(c, 'reply', { text: replyText }).then(() => { setReplying(null); setReplyText(''); }); } }} />
          <div className="row"><span className="spacer" /><button className="btn sm" onClick={() => setReplying(null)}>{t(language, 'comments.cancel')}</button><button className="btn primary sm" disabled={!replyText.trim()} onClick={() => void act(c, 'reply', { text: replyText }).then(() => { setReplying(null); setReplyText(''); })}>{t(language, 'comments.reply')}</button></div>
        </div>
      ) : (
        <div className="comment-actions" onClick={(e) => e.stopPropagation()}>
          {editable && <button className="link-btn" onClick={() => { setReplying(c.id); setReplyText(''); }}>{t(language, 'comments.reply')}</button>}
          {editable && <button className="link-btn" onClick={() => void act(c, c.resolved ? 'reopen' : 'resolve')}>{c.resolved ? t(language, 'comments.reopen') : t(language, 'comments.resolve')}</button>}
          {editable && <button className="link-btn" onClick={() => void askText(t(language, 'comments.edit'), c.text, { multiline: true, okLabel: t(language, 'comments.save') }).then((value) => { if (value?.trim() && value !== c.text) void act(c, 'edit', { text: value.trim() }); })}>{t(language, 'comments.edit')}</button>}
          {editable && <button className="link-btn danger" onClick={() => void confirmDialog(t(language, 'comments.deleteTitle'), t(language, 'comments.deleteHint'), { okLabel: t(language, 'comments.delete'), danger: true }).then((ok) => { if (ok) void act(c, 'delete'); })}>{t(language, 'comments.delete')}</button>}
        </div>
      )}
    </article>
  );

  return (
    <div className="side-panel comments-panel">
      <div className="row"><h4 className="grow">{t(language, 'comments.title')}</h4>
        <button className="btn sm" title={t(language, 'comments.comment')} onClick={() => app.set({ tool: 'comment' })}><Icon name="comment" size={13} /> {t(language, 'comments.new')}</button></div>
      {draft && (
        <div className="comment draft">
          <div className="faint small">{t(language, 'comments.commentingOn')} <b>{nodeName(draft.nodeId)}</b></div>
          <textarea className="field" rows={3} autoFocus placeholder={t(language, 'comments.placeholder')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') app.set({ commentDraft: null }); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); }} />
          <div className="row"><span className="spacer" /><button className="btn sm" onClick={() => app.set({ commentDraft: null })}>{t(language, 'comments.cancel')}</button><button className="btn primary sm" disabled={!text.trim()} onClick={() => void send()}>{t(language, 'comments.comment')}</button></div>
        </div>
      )}
      {!all.length && !draft && <p className="muted small">{t(language, 'comments.empty')}</p>}
      {open.map(card)}
      {done.length > 0 && <button className="link-btn" onClick={() => setShowResolved(!showResolved)}>{showResolved ? t(language, 'comments.hide') : t(language, 'comments.show')} {done.length} {t(language, 'comments.resolved')}</button>}
      {showResolved && done.map(card)}
    </div>
  );
}
