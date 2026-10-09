/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/presence.js — QUEM ESTÁ NO PROJETO (pessoas e agentes) NA BARRA DO TOPO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  Avatares de quem está com o editor aberto (pelo seu perfil: nome e cor) e dos agentes conectados pelo MCP
 *  (Claude Code, Codex...). Clicar abre o painel "No projeto agora": cada agente com o que fez por último e as
 *  camadas que está travando, a atividade recente e o seu perfil (o nome também assina os comentários).
 *  Os dados vêm do servidor (server/presence.js), pelo evento SSE "presence" ou por GET /api/presence.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico } from './dom.js';
import { askText } from './menus.js';

/** Cores para escolher no perfil (as mesmas da presença no servidor). */
const COLORS = ['#4c8dff', '#f7a541', '#c79bff', '#5cc98f', '#ff7a90', '#3ec5d6', '#e3c14b', '#9aa7ff'];
const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();
const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'agora' : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`; };

/**
 * @param {{ store, prefs: object, savePrefs: () => void, onProfile: () => void, toast: (m: string) => void }} deps
 *        onProfile: o perfil mudou (a conexão com o servidor é refeita com o nome novo)
 */
export function createPresence({ store, prefs, savePrefs, onProfile, toast }) {
  let data = { people: [], agents: [], activity: [] };
  let popup = null;
  const stack = h('span.pr-stack');
  const el = h('button.pr-btn', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: () => (popup ? closePopup() : openPopup()) }, stack);

  /** Perfil desta pessoa (nome + cor). Sem nome ainda: "Você". */
  const profile = () => ({ name: String(prefs.author || '').trim() || 'Você', color: COLORS.includes(prefs.authorColor) ? prefs.authorColor : COLORS[0] });
  const avatar = (who, agent = false) => h(`span.pr-av${agent ? '.agent' : ''}`, { style: `--c: ${who.color}`, title: who.name, 'aria-hidden': 'true' }, initial(who.name));

  function render() {
    const me = profile();
    const others = data.people.filter((p) => !(p.name === me.name && p.color === me.color));
    const agents = data.agents;
    const shown = [...agents.map((a) => avatar(a, true)), ...others.map((p) => avatar(p)), avatar(me)].slice(-5);
    stack.replaceChildren(...shown);
    const n = agents.length + others.length;
    el.setAttribute('aria-label', `No projeto agora: você${others.length ? `, ${others.length} ${others.length === 1 ? 'pessoa' : 'pessoas'}` : ''}${agents.length ? `, ${agents.length} ${agents.length === 1 ? 'agente' : 'agentes'}` : ''}`);
    el.title = n ? 'Quem está no projeto agora' : 'Seu perfil e agentes conectados';
    el.classList.toggle('busy', agents.some((a) => a.active));
    if (popup) fillPopup();
  }

  function fillPopup() {
    const me = profile();
    const body = popup.querySelector('.pr-body');
    const row = (who, sub, tag, agent = false) => h('div.pr-row', avatar(who, agent), h('div.pr-who', h('strong', who.name), h('span', sub)), tag ? h('span.pr-tag', tag) : null);
    const others = data.people.filter((p) => !(p.name === me.name && p.color === me.color));
    body.replaceChildren(...[
      h('h4', 'No projeto agora'),
      row(me, 'você · este navegador', 'Perfil'),
      ...others.map((p) => row(p, `editor aberto · desde ${ago(p.since)}`, 'Pessoa')),
      ...data.agents.map((a) => row(a, `${a.active ? 'trabalhando' : `parado há ${ago(a.lastSeen)}`}${a.lastTool ? ` · ${a.lastTool}` : ''}${a.locks.length ? ` · 🔒 ${a.locks.map((id) => store.get(id)?.name || id).join(', ')}` : ''}`, 'Agente', true)),
      data.agents.length ? null : h('p.pr-empty', 'Nenhum agente conectado. Cada janela do Claude Code, Codex ou outro programa MCP aparece aqui com o próprio nome, e eles podem trabalhar juntos: quem altera uma camada a reserva por alguns segundos.'),
      data.activity.length ? h('h4', 'Atividade') : null,
      ...data.activity.slice(0, 8).map((a) => h('div.pr-act', h('span.pr-dot', { style: `--c: ${a.color}` }), h('span', h('b', a.who), ` ${a.text}`), h('time', ago(a.at)))),
    ].filter(Boolean));
  }

  function openPopup() {
    popup = h('div.pr-pop', { role: 'dialog', 'aria-label': 'No projeto agora' },
      h('div.pr-body'),
      h('div.pr-foot',
        h('button.btn.small', { type: 'button', onclick: editProfile }, ico('edit', 12), ' Editar meu perfil'),
        h('div.pr-colors', { role: 'group', 'aria-label': 'Minha cor' }, COLORS.map((c) => h('button.pr-color', {
          type: 'button', style: `--c: ${c}`, 'aria-label': `Cor ${c}`, 'aria-pressed': String(profile().color === c),
          onclick: () => { prefs.authorColor = c; savePrefs(); onProfile(); render(); popup?.querySelectorAll('.pr-color').forEach((b) => b.setAttribute('aria-pressed', String(b.style.getPropertyValue('--c').trim() === c))); },
        })))));
    document.body.append(popup);
    const r = el.getBoundingClientRect();
    popup.style.top = `${r.bottom + 8}px`;
    popup.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    el.setAttribute('aria-expanded', 'true');
    fillPopup();
    refresh();
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
    window.addEventListener('keydown', onKey, true);
  }
  const outside = (e) => { if (popup && !popup.contains(e.target) && !el.contains(e.target)) closePopup(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePopup(); el.focus(); } };
  function closePopup() {
    popup?.remove(); popup = null;
    el.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('keydown', onKey, true);
  }

  async function editProfile() {
    const name = await askText({ title: 'Seu perfil', label: 'Seu nome (aparece para os outros e assina os comentários)', value: String(prefs.author || ''), confirm: 'Salvar' });
    if (name == null) return;
    prefs.author = name.trim().slice(0, 40);
    savePrefs(); onProfile(); render();
    toast(`Perfil: ${profile().name}`);
  }

  async function refresh() {
    try { const r = await fetch('/api/presence'); if (r.ok) { data = await r.json(); render(); } } catch { /* sem servidor */ }
  }
  render();
  return {
    el,
    profile,
    /** Recebe o retrato do servidor (evento "presence"). */
    update(next) { if (next && Array.isArray(next.agents)) { data = next; render(); } },
    refresh,
  };
}
