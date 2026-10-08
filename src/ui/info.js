import { h, ico, iconButton } from './dom.js';

let current = null;

/** Fecha a informação aberta; Escape devolve o foco ao botão que a abriu. */
export function closeInformation(restoreFocus = false) {
  current?.close(restoreFocus);
}

/** Ajuda de uma seção, acessível por clique ou teclado sem ocupar o painel. */
export function informationButton(title, text) {
  const button = h('button.section-info', {
    type: 'button', 'aria-label': `Informações sobre ${title}`, 'aria-expanded': 'false', 'aria-haspopup': 'dialog',
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); },
    onclick: () => {
      if (current?.button === button) { closeInformation(true); return; }
      closeInformation();
      const popup = h('div.inspector-info', { role: 'dialog', 'aria-label': `Informações sobre ${title}`, tabindex: -1 },
        h('div.inspector-info-head', h('strong', title), iconButton('x', 'Fechar informação', () => closeInformation(true), 'small')),
        h('p', text));
      const place = () => {
        const r = button.getBoundingClientRect();
        const w = popup.offsetWidth, hh = popup.offsetHeight;
        const x = r.left - w - 10 >= 8 ? r.left - w - 10 : r.right + 10;
        popup.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
        popup.style.top = `${Math.max(8, Math.min(r.top - 8, innerHeight - hh - 8))}px`;
      };
      const outside = e => { if (!popup.contains(e.target) && !button.contains(e.target)) closeInformation(); };
      const key = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeInformation(true); }
        else if (e.key === 'Tab') closeInformation(true);
      };
      const observer = new MutationObserver(() => { if (!button.isConnected) closeInformation(); });
      const close = restore => {
        popup.remove(); button.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', outside, true);
        window.removeEventListener('keydown', key, true);
        window.removeEventListener('resize', place);
        document.removeEventListener('scroll', place, true);
        observer.disconnect(); current = null;
        if (restore && button.isConnected) button.focus();
      };
      document.body.append(popup); button.setAttribute('aria-expanded', 'true');
      current = { button, close }; place(); popup.focus();
      document.addEventListener('pointerdown', outside, true);
      window.addEventListener('keydown', key, true);
      window.addEventListener('resize', place);
      document.addEventListener('scroll', place, true);
      observer.observe(document.body, { childList: true, subtree: true });
    },
  }, ico('info', 13));
  return button;
}
