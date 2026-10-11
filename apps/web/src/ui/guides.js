import { h, ico } from './dom.js';
import { openModal } from './menus.js';

/** Trava só o arrasto no canvas; as posições continuam editáveis pela janela. */
export function setGuidesLocked(store, locked) {
  store.ui.guidesLocked = locked;
  try { localStorage.setItem('pd.guidesLocked', locked ? '1' : '0'); } catch { /* preferência opcional */ }
  store.emit('overlay');
}

/** Edição precisa das guias da página, usando o mesmo histórico dos arrastos na régua. */
export function openGuides({ store, commands, canvas }) {
  const list = h('div.guide-list');
  const count = h('p.muted', { role: 'status' });
  const axis = h('select.select', { 'aria-label': 'Direção da nova guia' },
    h('option', { value: 'x' }, 'Vertical · X'), h('option', { value: 'y' }, 'Horizontal · Y'));
  const position = h('input.text.mono', { type: 'number', step: 1, value: 0, 'aria-label': 'Posição da nova guia em px' });
  const message = h('p.set-msg.error', { role: 'status' });
  const valid = (input) => input.value.trim() !== '' && Number.isFinite(Number(input.value));
  const reveal = () => {
    store.ui.showGuides = true;
    if (!store.ui.showRulers) store.toggleRulers();
    store.emit('overlay');
  };
  const add = () => {
    if (!valid(position)) { message.textContent = 'Digite uma posição em pixels.'; position.focus(); return; }
    message.textContent = '';
    commands.addGuide(axis.value, Number(position.value));
    reveal();
    position.select();
  };
  position.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } });
  const selectionGuides = (centers) => {
    const box = canvas?.unionAabb(store.ui.selection);
    if (!box) return;
    const values = centers
      ? [['x', box.x + box.w / 2], ['y', box.y + box.h / 2]]
      : [['x', box.x], ['x', box.x + box.w], ['y', box.y], ['y', box.y + box.h]];
    const seen = new Set((store.page().guides || []).map((g) => `${g.axis}:${g.pos}`));
    const next = values.map(([axis, pos]) => ({ axis, pos: Math.round(pos) })).filter((g) => {
      const key = `${g.axis}:${g.pos}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (next.length) store.update((page) => { (page.guides ||= []).push(...next); }, { commit: true });
    reveal();
  };
  const selected = !!canvas?.unionAabb(store.ui.selection);
  const lock = h('input', { type: 'checkbox', checked: !!store.ui.guidesLocked, onchange: () => setGuidesLocked(store, lock.checked) });
  const clear = h('button.btn', { type: 'button', onclick: () => store.update((page) => { page.guides = []; }, { commit: true }) }, 'Remover todas');
  const body = h('div.guides-panel',
    h('p.muted', 'Guias da página atual. As posições são medidas em pixels a partir da origem do canvas e não aparecem no código exportado.'),
    h('div.guide-create', h('label', 'Direção', axis), h('label', 'Posição (px)', position),
      h('button.btn.primary', { type: 'button', onclick: add }, ico('plus', 14), ' Adicionar')),
    message,
    h('div.guide-presets',
      h('button.btn', { type: 'button', disabled: !selected, onclick: () => selectionGuides(false) }, 'Bordas da seleção'),
      h('button.btn', { type: 'button', disabled: !selected, onclick: () => selectionGuides(true) }, 'Centro da seleção')),
    count, list,
    h('div.guide-actions', h('label.check', lock, h('span.box', ico('check', 10)), h('span', 'Travar guias no canvas')), clear),
    h('p.hint', 'Arraste uma guia para reposicionar. Para removê-la no canvas, leve-a de volta à régua. Ao voltar ao canvas, Ctrl+Z desfaz as alterações.'));
  function render() {
    const guides = store.page().guides || [];
    const focused = list.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    clear.disabled = !guides.length;
    signature = JSON.stringify([store.page().id, guides]);
    count.textContent = `${guides.length} guia${guides.length === 1 ? '' : 's'} · ${store.page().name}`;
    list.replaceChildren(...guides.map((guide, i) => {
      const label = `${guide.axis === 'x' ? 'Vertical · X' : 'Horizontal · Y'} · guia ${i + 1}`;
      const field = h('input.text.mono', { type: 'number', step: 1, value: guide.pos, 'aria-label': `Posição da guia ${i + 1} em px` });
      field.addEventListener('change', () => {
        if (!valid(field)) { field.value = guide.pos; return; }
        const pos = Math.round(Number(field.value));
        if (pos !== guide.pos) store.update(() => { guide.pos = pos; }, { commit: true });
      });
      field.addEventListener('keydown', (event) => { if (event.key === 'Enter') field.blur(); });
      return h('div.guide-row', h('span', label), field, h('span.muted', 'px'),
        h('button.icon-btn', { type: 'button', 'aria-label': `Remover guia ${i + 1}`, onclick: () => {
          commands.removeGuide(i);
          render();
          (list.querySelectorAll('button')[Math.min(i, (store.page().guides || []).length - 1)] || position).focus();
        } }, ico('x', 14)));
    }));
    if (!guides.length) list.append(h('p.guide-empty', 'Nenhuma guia nesta página. Adicione uma posição acima ou arraste a partir das réguas.'));
    if (focused) [...list.querySelectorAll('[aria-label]')].find((el) => el.getAttribute('aria-label') === focused)?.focus({ preventScroll: true });
  }
  let signature = '';
  const unsubscribe = store.subscribe(() => {
    const next = JSON.stringify([store.page().id, store.page().guides]);
    if (signature !== next) { signature = next; render(); }
  });
  const modal = openModal({ title: 'Guias da página', body, cls: 'narrow', onClose: unsubscribe });
  signature = JSON.stringify([store.page().id, store.page().guides]);
  render();
  return modal;
}
