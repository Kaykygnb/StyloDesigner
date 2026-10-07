/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  ui/proto.js — ABA "PROTÓTIPO" (INTERAÇÕES ENTRE TELAS)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { h, ico, selectField } from './dom.js';
import { TRANSITION_OPTIONS } from '../present.js';
import { isBoard, walk } from '../model.js';

/**
 * Cria a aba PROTÓTIPO: para a camada selecionada, lista suas INTERAÇÕES. Cada interação tem gatilho (clicar / passar o
 * mouse), ação (navegar para um frame / voltar / abrir link) e, ao navegar, o frame de destino e a transição.
 * Um frame da raiz pode ser marcado como ponto de partida do fluxo. O botão Apresentar abre o modo de apresentação.
 * Dados das interações: camada.interactions = [{ trigger, action, target, transition, url }] (ver present.js).
 */
export function createProtoPanel({ store, present, toast }) {
  const ui = store.ui;
  const el = h('div.proto-panel');

  /** Frames da raiz de todas as páginas: são os destinos possíveis de "Navegar para". */
  const rootFrames = () => store.state.doc.pages.flatMap((p) => p.children.flatMap((n) => (n.type === 'section' ? n.children : [n])).filter((n) => n.type === 'frame').map((f) => ({ f, page: p })));

  /** Reconstrói a aba para a camada selecionada (só roda com a aba aberta). */
  function render() {
    const n = store.selected()[0];
    const parts = [];
    parts.push(h('section.panel-section',
      h('button.btn.primary', { type: 'button', onclick: () => { if (!present.open(n?.id)) toast('Crie pelo menos um frame para apresentar.'); } },
        ico('play', 13), ' Apresentar (Ctrl+Alt+Enter)'),
      h('p.hint', 'Escolha uma camada, adicione uma interação e aponte para outro frame. Depois clique em Apresentar.')));

    if (!n) {
      el.replaceChildren(...parts, h('div.empty-state', h('p', 'Selecione uma camada para criar interações.')));
      return;
    }

    if (isBoard(n, store.parentOf(n.id))) {
      const input = h('input', { type: 'checkbox', checked: !!n.flowStart });
      input.addEventListener('change', () => {
        store.update(() => {
          for (const page of store.state.doc.pages) walk(page.children, (x) => { if (x.flowStart) delete x.flowStart; });
          if (input.checked) n.flowStart = true;
        }, { commit: true });
      });
      parts.push(h('section.panel-section', h('label.check', input, h('span.box', ico('check', 10)), h('span', 'Ponto de partida do fluxo'))));
    }

    const frames = rootFrames();
    const list = h('div.section-body');
    (n.interactions || []).forEach((it, i) => {
      const set = (k) => (v) => store.update(() => { n.interactions[i][k] = v; });
      const commit = () => store.commit();
      const sel = (options, k, title) => {
        const c = selectField({ options, get: () => it[k] ?? options[0][0], set: set(k), commit, title });
        c.update();
        return c.el;
      };
      const card = h('div.effect-card',
        h('div.effect-foot', sel([['click', 'Ao clicar'], ['hover', 'Ao passar o mouse']], 'trigger', 'Gatilho'),
          h('button.icon-btn.small', { type: 'button', title: 'Remover interação', onclick: () => { store.update(() => n.interactions.splice(i, 1), { commit: true }); } }, ico('x', 12))),
        sel([['navigate', 'Navegar para'], ['back', 'Voltar'], ['url', 'Abrir link']], 'action', 'Ação'));
      if (it.action === 'url') {
        const input = h('input.text', { placeholder: 'https://…', value: it.url || '' });
        input.addEventListener('input', () => set('url')(input.value));
        input.addEventListener('change', commit);
        card.append(h('label.field', input));
      } else if (it.action !== 'back') {
        card.append(
          sel([['', 'Escolha o frame…'], ...frames.map(({ f, page }) => [f.id, `${f.name}${store.state.doc.pages.length > 1 ? ` (${page.name})` : ''}`])], 'target', 'Destino'),
          sel(TRANSITION_OPTIONS, 'transition', 'Transição'));
      }
      list.append(card);
    });
    parts.push(h('section.panel-section',
      h('header.section-head', h('span', 'Interações'),
        h('button.icon-btn.small', {
          type: 'button', title: 'Adicionar interação',
          onclick: () => store.update(() => { (n.interactions ||= []).push({ trigger: 'click', action: 'navigate', target: '', transition: 'dissolve' }); }, { commit: true }),
        }, ico('plus', 14))),
      list));
    el.replaceChildren(...parts);
  }

  store.subscribe((reasons) => {
    if (ui.rightTab === 'proto' && ['doc', 'selection', 'history'].some((r) => reasons.has(r))) render();
  });
  return { el, render };
}
