/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  server/account.js — CONTA LOCAL (o seu perfil neste computador)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  O Stylo roda na SUA máquina, então a "conta" não tem senha: é só um perfil guardado pelo servidor num
 *  arquivo JSON ao lado da configuração (designer.account.json). Ele assina comentários, aparece na presença
 *  ("quem está no projeto") e no avatar do topo.
 *    { name, email, role, color, avatar (data URL de imagem ou ""), language, createdAt, updatedAt }
 *  Este módulo só VALIDA e LIMITA os campos (o servidor lê/grava o arquivo). Funções puras: dá para testar.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Cores de avatar aceitas (as mesmas da presença e do editor). */
export const ACCOUNT_COLORS = ['#4c8dff', '#f7a541', '#c79bff', '#5cc98f', '#ff7a90', '#3ec5d6', '#e3c14b', '#9aa7ff'];
/** Idiomas oferecidos (a interface hoje é só pt-BR; guardamos a escolha para o futuro). */
export const ACCOUNT_LANGUAGES = ['pt-BR', 'en', 'es'];
/** Tamanho máximo da imagem do avatar (o data URL inteiro), ~200 KB. */
export const MAX_AVATAR = 200 * 1024;

/** Conta vazia (antes de a pessoa preencher qualquer coisa). */
export const emptyAccount = () => ({ name: '', email: '', role: '', color: ACCOUNT_COLORS[0], avatar: '', language: 'pt-BR', createdAt: null, updatedAt: null });

/** Texto de uma linha, sem caracteres de controle, cortado em `max`. */
const line = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/**
 * Aplica `patch` (vindo do navegador) sobre a conta `current`. Campos desconhecidos são ignorados.
 * Lança Error com mensagem legível quando um valor é inválido (o servidor responde 400 com ela).
 */
export function mergeAccount(current, patch = {}) {
  const next = { ...emptyAccount(), ...current };
  if (patch.name !== undefined) next.name = line(patch.name, 60);
  if (patch.role !== undefined) next.role = line(patch.role, 60);
  if (patch.email !== undefined) {
    const email = line(patch.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
    next.email = email;
  }
  if (patch.color !== undefined) {
    const c = String(patch.color).toLowerCase();
    if (!ACCOUNT_COLORS.includes(c)) throw new Error('Cor inválida.');
    next.color = c;
  }
  if (patch.language !== undefined) {
    if (!ACCOUNT_LANGUAGES.includes(patch.language)) throw new Error('Idioma inválido.');
    next.language = patch.language;
  }
  if (patch.avatar !== undefined) {
    const a = String(patch.avatar || '');
    if (a && !/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(a)) throw new Error('Use uma imagem PNG, JPG, WebP ou GIF.');
    if (a.length > MAX_AVATAR) throw new Error('Imagem grande demais (limite de 200 KB).');
    next.avatar = a;
  }
  const now = new Date().toISOString();
  if (!next.createdAt) next.createdAt = now;
  next.updatedAt = now;
  return next;
}

/** Lê uma conta salva (pode estar velha ou corrompida): devolve sempre um objeto completo e válido. */
export function normalizeAccount(saved) {
  const base = emptyAccount();
  if (!saved || typeof saved !== 'object') return base;
  let acc = base;
  // campo a campo: um valor ruim (editado à mão) não apaga os outros
  for (const k of ['name', 'email', 'role', 'color', 'avatar', 'language']) {
    if (saved[k] === undefined) continue;
    try { acc = mergeAccount(acc, { [k]: saved[k] }); } catch { /* ignora só este campo */ }
  }
  return { ...acc, createdAt: typeof saved.createdAt === 'string' ? saved.createdAt : null, updatedAt: typeof saved.updatedAt === 'string' ? saved.updatedAt : null };
}
