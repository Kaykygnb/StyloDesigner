/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  account.js — CONTA LOCAL NO NAVEGADOR (espelho do perfil guardado pelo servidor)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  A conta mora no servidor (GET/PUT /api/account, ver server/account.js). Este módulo:
 *    - carrega a conta ao abrir o app e MIGRA o nome antigo (prefs.author/authorColor, de antes da conta existir)
 *      quando a conta do servidor ainda está vazia;
 *    - mantém prefs.author e prefs.authorColor sincronizados a partir da conta, porque comentários (ui/comments.js)
 *      e presença (ui/presence.js) leem dali;
 *    - avisa quem estiver ouvindo (avatar do topo, página de Configurações) quando o perfil muda.
 *  Sem servidor, a conta funciona só com as preferências do navegador (nome e cor).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Cores de avatar (as mesmas do servidor e da presença). */
export const ACCOUNT_COLORS = ['#4c8dff', '#f7a541', '#c79bff', '#5cc98f', '#ff7a90', '#3ec5d6', '#e3c14b', '#9aa7ff'];

/** "Kayky Silva" → "KS"; "Ana" → "A"; vazio → "?". */
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * @param {{ prefs: object, savePrefs: () => void, server: boolean }} deps
 */
export function createAccount({ prefs, savePrefs, server }) {
  let data = {
    name: String(prefs.author || ''), email: '', role: '', avatar: '', language: 'pt-BR', createdAt: null,
    color: ACCOUNT_COLORS.includes(prefs.authorColor) ? prefs.authorColor : ACCOUNT_COLORS[0],
  };
  const listeners = new Set();

  /** Copia nome e cor para as preferências (lidas por comentários e presença). */
  function mirror() {
    if (prefs.author === data.name && prefs.authorColor === data.color) return false;
    prefs.author = data.name;
    prefs.authorColor = data.color;
    savePrefs();
    return true;
  }
  const emit = (nameChanged) => listeners.forEach((fn) => fn(data, nameChanged));

  async function put(patch) {
    const r = await fetch('/api/account', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const out = await r.json();
    if (!r.ok) throw new Error(out.error || 'Não consegui salvar a conta.');
    return out;
  }

  return {
    get data() { return data; },
    get server() { return server; },
    /** Carrega do servidor; se a conta estiver vazia e houver um nome antigo no navegador, migra. */
    async load() {
      if (!server) return data;
      try {
        let acc = await fetch('/api/account').then((r) => r.json());
        if (!acc.name && prefs.author) acc = await put({ name: prefs.author, ...(ACCOUNT_COLORS.includes(prefs.authorColor) ? { color: prefs.authorColor } : {}) });
        data = acc;
        emit(mirror());
      } catch { /* servidor sem a rota (versão antiga) ou fora do ar: fica com as preferências */ }
      return data;
    },
    /** Salva alguns campos. Lança Error com mensagem legível se o servidor recusar. */
    async save(patch) {
      if (server) data = await put(patch);
      else data = { ...data, ...patch };
      emit(mirror());
      return data;
    },
    /** fn(conta, nomeOuCorMudou) a cada mudança. Devolve a função para parar de ouvir. */
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/**
 * Avatar da conta: a imagem enviada ou as iniciais sobre a cor escolhida.
 * @param {(tag: string, ...args) => HTMLElement} h   helper de ui/dom.js
 */
export function avatarEl(h, acc, cls = '') {
  const el = h('span.acc-avatar' + cls, { style: `--c: ${acc.color || ACCOUNT_COLORS[0]}`, 'aria-hidden': 'true' });
  if (acc.avatar) el.append(h('img', { src: acc.avatar, alt: '' }));
  else el.textContent = initials(acc.name || 'Você');
  return el;
}

/**
 * Reduz uma imagem escolhida pela pessoa para caber no limite do servidor (quadrada, até 160 px).
 * @returns {Promise<string>} data URL (JPEG, ou PNG se for pequena o bastante e tiver transparência)
 */
export async function shrinkAvatar(file) {
  if (!/^image\//.test(file.type)) throw new Error('Escolha um arquivo de imagem.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('Não consegui abrir a imagem.')); i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(160, side);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    // recorta o centro (avatar quadrado) e reduz
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    const png = c.toDataURL('image/png');
    if (png.length < 120 * 1024) return png;
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
