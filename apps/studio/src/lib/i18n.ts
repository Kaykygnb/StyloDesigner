import type { Language } from './app';
import ptBR from './locales/pt-BR';
import enUS from './locales/en-US';

/** Idiomas da interface. O nome de cada um aparece na própria língua, para quem não lê o idioma atual achar o seu. */
export const SUPPORTED_LANGUAGES: Array<{ value: Language; label: string; short: string }> = [
  { value: 'pt-BR', label: 'Português (Brasil)', short: 'PT' },
  { value: 'en-US', label: 'English (US)', short: 'EN' },
  { value: 'ru-RU', label: 'Русский', short: 'RU' },
  { value: 'ja-JP', label: '日本語', short: 'JA' },
  { value: 'zh-CN', label: '简体中文', short: 'ZH' },
  { value: 'ko-KR', label: '한국어', short: 'KO' },
];

/** Languages available for the generated site's metadata. Kept separate from
 * the application UI language so adding a publishing locale does not require
 * translating the whole editor first. */
export const SITE_LANGUAGES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'ko-KR', label: '한국어' },
] as const;

export type Interpolation = Record<string, string | number>;
type Dictionary = Record<string, string>;

/** Português e inglês vêm junto com o painel; os outros idiomas só são baixados quando alguém os escolhe. */
const dictionaries: Partial<Record<Language, Dictionary>> = { 'pt-BR': ptBR, 'en-US': enUS };
const loaders: Partial<Record<Language, () => Promise<{ default: Dictionary }>>> = {
  'ru-RU': () => import('./locales/ru-RU'),
  'ja-JP': () => import('./locales/ja-JP'),
  'zh-CN': () => import('./locales/zh-CN'),
  'ko-KR': () => import('./locales/ko-KR'),
};

export const isLanguageLoaded = (language: Language) => !!dictionaries[language];

/** Baixa o dicionário do idioma (se ainda não estiver na memória). Chame antes de trocar o idioma da tela. */
export async function loadLanguage(language: Language): Promise<void> {
  if (dictionaries[language]) return;
  const load = loaders[language];
  if (!load) return;
  dictionaries[language] = (await load()).default;
}

/** Idioma da tela, para código que não é componente (avisos, menus, atalhos). Quem muda o idioma atualiza isto. */
let activeLanguage: Language = 'pt-BR';
export const setActiveLanguage = (language: Language) => { activeLanguage = language; };
export const getActiveLanguage = () => activeLanguage;

/** Texto da chave no idioma; se faltar, inglês, depois português, por fim a própria chave. */
function lookup(language: Language, key: string): string {
  return dictionaries[language]?.[key] ?? enUS[key] ?? ptBR[key] ?? key;
}
const fill = (raw: string, values: Interpolation) => raw.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] === undefined ? `{{${name}}}` : String(values[name]));

export function t(language: Language, key: string, values: Interpolation = {}): string {
  return fill(lookup(language, key), values);
}

/** `t` no idioma atual da tela, para fora dos componentes. */
export const tl = (key: string, values: Interpolation = {}) => t(activeLanguage, key, values);

export function formatRelativeTime(language: Language, iso: string, now = Date.now()): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  // português e inglês mantêm o texto curto de sempre; os demais idiomas usam as regras do próprio navegador
  if (language !== 'pt-BR' && language !== 'en-US') {
    const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
    if (seconds < 45) return rtf.format(0, 'second');
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 7) return rtf.format(-days, 'day');
    return formatDate(language, time, { day: '2-digit', month: '2-digit' });
  }
  const en = language === 'en-US';
  if (seconds < 45) return en ? 'now' : 'agora';
  if (minutes < 60) return en ? `${minutes} min ago` : `há ${minutes} min`;
  if (hours < 24) return en ? `${hours} hr ago` : `há ${hours} h`;
  if (days === 1) return en ? 'yesterday' : 'ontem';
  if (days < 7) return en ? `${days} days ago` : `há ${days} dias`;
  return formatDate(language, time, { day: '2-digit', month: '2-digit' });
}

/** Ordem das formas de plural escritas na mensagem (separadas por `|`), por idioma. Sem entrada: singular|plural. */
const PLURAL_FORMS: Partial<Record<Language, Intl.LDMLPluralRule[]>> = {
  'ru-RU': ['one', 'few', 'many'],
  'ja-JP': ['other'],
  'zh-CN': ['other'],
  'ko-KR': ['other'],
};
const pluralRules = new Map<Language, Intl.PluralRules>();
function pluralIndex(language: Language, count: number): number {
  const forms = PLURAL_FORMS[language];
  if (!forms) return count === 1 ? 0 : 1;
  if (!pluralRules.has(language)) pluralRules.set(language, new Intl.PluralRules(language));
  const index = forms.indexOf(pluralRules.get(language)!.select(count));
  return index >= 0 ? index : forms.length - 1; // "other" do russo (frações) usa a última forma
}

/** Mensagem com formas de plural separadas por `|` (pt/en: `um|vários`; ru: `um|poucos|muitos`; ja/zh/ko: uma só). */
export function tp(language: Language, key: string, count: number, values: Interpolation = {}): string {
  const parts = lookup(language, key).split('|');
  const selected = parts[Math.min(pluralIndex(language, count), parts.length - 1)];
  return fill(selected, { count, ...values });
}

export function formatDate(language: Language, value: number | string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(language, options).format(new Date(value));
}

export function formatNumber(language: Language, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(language, options).format(value);
}
