// Os seis idiomas da interface: todos têm as mesmas chaves, os mesmos {{marcadores}}, as formas de plural certas e usam a escrita certa.
import test from 'node:test';
import assert from 'node:assert/strict';
import ptBR from '../apps/studio/src/lib/locales/pt-BR';
import enUS from '../apps/studio/src/lib/locales/en-US';
import ruRU from '../apps/studio/src/lib/locales/ru-RU';
import jaJP from '../apps/studio/src/lib/locales/ja-JP';
import zhCN from '../apps/studio/src/lib/locales/zh-CN';
import koKR from '../apps/studio/src/lib/locales/ko-KR';
import { SUPPORTED_LANGUAGES, formatRelativeTime, isLanguageLoaded, loadLanguage, setActiveLanguage, t, tl, tp } from '../apps/studio/src/lib/i18n';

const locales = { 'pt-BR': ptBR, 'en-US': enUS, 'ru-RU': ruRU, 'ja-JP': jaJP, 'zh-CN': zhCN, 'ko-KR': koKR } as const;
const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
const tags = (text: string) => (text.match(/<\/?b>/g) ?? []).join('');

test('a lista de idiomas oferecidos bate com os dicionários', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES.map((l) => l.value).sort(), Object.keys(locales).sort());
  for (const lang of SUPPORTED_LANGUAGES) assert.ok(lang.label.length > 1 && lang.short.length === 2, lang.value);
});

for (const [lang, dict] of Object.entries(locales)) {
  test(`${lang}: mesmas chaves do inglês, sem texto vazio, mesmos marcadores e mesmas marcações <b>`, () => {
    const missing = Object.keys(enUS).filter((k) => !(k in dict));
    const extra = Object.keys(dict).filter((k) => !(k in enUS));
    assert.deepEqual(missing, [], `faltam em ${lang}`);
    assert.deepEqual(extra, [], `sobram em ${lang}`);
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${lang} ${key}: vazio`);
      // formas de plural têm quantidade de {{count}} diferente por idioma; os outros marcadores precisam bater
      const plural = enUS[key].includes('|');
      const a = placeholders(enUS[key]).split(',').filter((p) => !plural || p !== '{{count}}').join(',');
      const b = placeholders(value).split(',').filter((p) => !plural || p !== '{{count}}').join(',');
      assert.equal(b, a, `${lang} ${key}: marcadores diferentes\n  en: ${enUS[key]}\n  ${lang}: ${value}`);
      assert.equal(tags(value), tags(enUS[key]), `${lang} ${key}: marcação <b> diferente`);
    }
  });
}

test('plural: ru tem 3 formas, ja/zh/ko uma só, pt/en duas', async () => {
  await Promise.all((['ru-RU', 'ja-JP', 'zh-CN', 'ko-KR'] as const).map((l) => loadLanguage(l)));
  const pluralKeys = Object.keys(enUS).filter((k) => enUS[k].includes('|'));
  assert.ok(pluralKeys.length >= 5);
  for (const key of pluralKeys) {
    assert.equal(ptBR[key].split('|').length, 2, `pt ${key}`);
    assert.equal(ruRU[key].split('|').length, 3, `ru ${key}`);
    for (const dict of [jaJP, zhCN, koKR]) assert.equal(dict[key].split('|').length, 1, key);
  }
  // quem escolhe a forma é o idioma, não a mensagem
  assert.equal(tp('ru-RU', 'collab.people', 1), '1 человек');
  assert.equal(tp('ru-RU', 'collab.people', 2), '2 человека');
  assert.equal(tp('ru-RU', 'collab.people', 5), '5 человек');
  assert.equal(tp('ru-RU', 'collab.people', 21), '21 человек');
  assert.equal(tp('ru-RU', 'collab.people', 22), '22 человека');
  assert.equal(tp('ru-RU', 'collab.people', 11), '11 человек');
  assert.equal(tp('ja-JP', 'collab.people', 1), '1 人');
  assert.equal(tp('ja-JP', 'collab.people', 7), '7 人');
  assert.equal(tp('zh-CN', 'collab.people', 3), '3 人');
  assert.equal(tp('ko-KR', 'collab.people', 3), '3명');
  assert.equal(tp('en-US', 'collab.people', 1), '1 person');
  assert.equal(tp('en-US', 'collab.people', 0), '0 people');
  assert.equal(tp('pt-BR', 'collab.people', 2), '2 pessoas');
});

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const KANA = /[぀-ヿ]/g, HAN = /[㐀-鿿]/g, HANGUL = /[가-힯]/g, CYRILLIC = /[Ѐ-ӿ]/g, LATIN = /[A-Za-z]/g;

test('cada idioma usa a escrita certa (pega tradução esquecida em outra língua)', () => {
  const keys = Object.keys(enUS);
  const sample = (dict: Record<string, string>, re: RegExp) => keys.filter((k) => count(dict[k], re) > 0).length;
  // a grande maioria dos textos de cada idioma tem caracteres da escrita dele
  assert.ok(sample(ruRU, CYRILLIC) > keys.length * 0.9, 'ru: cirílico');
  assert.ok(sample(jaJP, KANA) > keys.length * 0.8, 'ja: kana');
  assert.ok(sample(zhCN, HAN) > keys.length * 0.9, 'zh: hanzi');
  assert.ok(sample(koKR, HANGUL) > keys.length * 0.9, 'ko: hangul');
  // e não misturam as escritas dos outros
  assert.equal(sample(zhCN, KANA), 0, 'zh sem kana');
  assert.equal(sample(zhCN, HANGUL), 0, 'zh sem hangul');
  assert.equal(sample(koKR, KANA), 0, 'ko sem kana');
  assert.equal(sample(jaJP, HANGUL), 0, 'ja sem hangul');
  assert.equal(sample(ruRU, HAN), 0, 'ru sem hanzi');
  // textos longos que sobraram idênticos ao inglês indicam tradução esquecida (curtos/técnicos podem ser iguais)
  for (const [lang, dict] of [['ru-RU', ruRU], ['ja-JP', jaJP], ['zh-CN', zhCN], ['ko-KR', koKR]] as const) {
    const same = keys.filter((k) => dict[k] === enUS[k] && count(enUS[k], LATIN) > 25 && !/^(https?:|display:|width:)/.test(enUS[k]));
    assert.deepEqual(same, [], `${lang}: textos longos iguais ao inglês`);
  }
});

test('t() usa o idioma pedido, cai para inglês e depois português, e tl() segue o idioma ativo', async () => {
  await Promise.all(['ru-RU', 'ja-JP', 'zh-CN', 'ko-KR'].map((l) => loadLanguage(l as never)));
  for (const l of ['ru-RU', 'ja-JP', 'zh-CN', 'ko-KR'] as const) assert.ok(isLanguageLoaded(l));
  assert.equal(t('ru-RU', 'top.present'), 'Показать');
  assert.equal(t('ja-JP', 'top.present'), 'プレゼン');
  assert.equal(t('zh-CN', 'top.present'), '演示');
  assert.equal(t('ko-KR', 'top.present'), '발표');
  assert.equal(t('ru-RU', 'inspector.component.instanceOf', { name: 'Кнопка' }), 'Экземпляр «Кнопка»');
  assert.equal(t('ja-JP', 'chave.que.nao.existe'), 'chave.que.nao.existe');
  setActiveLanguage('ko-KR');
  assert.equal(tl('top.present'), '발표');
  setActiveLanguage('pt-BR');
  assert.equal(tl('top.present'), 'Apresentar');
});

test('data relativa: ru/ja/zh/ko usam as regras do navegador', () => {
  const now = Date.parse('2026-01-02T12:00:00Z');
  for (const l of ['ru-RU', 'ja-JP', 'zh-CN', 'ko-KR'] as const) {
    assert.match(formatRelativeTime(l, '2026-01-02T11:58:00Z', now), /2/, l);
    assert.notEqual(formatRelativeTime(l, '2026-01-01T12:00:00Z', now), '', l);
    assert.notEqual(formatRelativeTime(l, '2026-01-02T11:59:50Z', now), '', l);
  }
  assert.equal(formatRelativeTime('pt-BR', '2026-01-02T11:58:00Z', now), 'há 2 min');
});
