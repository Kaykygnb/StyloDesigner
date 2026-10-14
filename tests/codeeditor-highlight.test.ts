// Realce de sintaxe da aba Código: as regex não podem ser reaplicadas sobre as tags já geradas (bug `"tk-n">0px`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightCss, highlightHtml } from '../apps/studio/src/ui/CodeEditor.tsx';

const textoDe = (html: string) => html.replace(/<[^>]+>/g, '');

test('highlightCss: número com unidade vira uma tag só, sem aspas vazando', () => {
  const out = highlightCss('.a { left: 0px; }');
  assert.ok(out.includes('<i class="tk-n">0px</i>'), out);
  assert.ok(!out.includes('class=<i'), out);
});

test('highlightCss: cor hex, string e número não se aninham e o texto visível é o original', () => {
  const css = 'a { color: #123456; content: "x 1px"; width: 10.5%; margin: -2px 0; }';
  const out = highlightCss(css);
  assert.equal(textoDe(out), css);
  assert.ok(out.includes('<i class="tk-n">#123456</i>'), out);
  assert.ok(out.includes('<i class="tk-s">"x 1px"</i>'), out);
  assert.ok(out.includes('<i class="tk-n">10.5%</i>'), out);
  assert.ok(out.includes('<i class="tk-n">-2px</i>'), out);
  assert.ok(!/<i class="tk-n"><i /.test(out), 'tags tk-n aninhadas');
  // Cada <i> abre e fecha: nenhuma tag gerada é quebrada por outra.
  assert.equal((out.match(/<i /g) ?? []).length, (out.match(/<\/i>/g) ?? []).length);
});

test('highlightCss: escapa HTML do usuário sem quebrar tags e mantém propriedade/seletor', () => {
  const css = '.b > span { font: 12px "A<B"; }';
  const out = highlightCss(css);
  assert.equal(textoDe(out), css.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  assert.ok(out.includes('<i class="tk-p">font</i>'), out);
  assert.ok(highlightCss('.b span { }').includes('<i class="tk-sel">.b span {</i>'));
});

test('highlightHtml: tag, atributo e comentário sem a regex de atributo casar as tags geradas', () => {
  const html = '<div class="x" data-a="1">1px <!-- c --></div>';
  const out = highlightHtml(html);
  assert.equal(textoDe(out), html.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  assert.ok(out.includes('&lt;<i class="tk-k">div</i>'), out);
  assert.ok(out.includes('<i class="tk-p">class</i>=<i class="tk-s">"x"</i>'), out);
  assert.ok(out.includes('<i class="tk-c">&lt;!-- c --&gt;</i>'), out);
  assert.ok(!out.includes('"tk-k"</i>'), out);
});
