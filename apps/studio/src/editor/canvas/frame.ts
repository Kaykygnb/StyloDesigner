// Coordenadas entre a janela e as telas desenhadas dentro de iframes (o canvas mostra cada tela num iframe).

/** Onde o iframe de um documento está na janela e quanto ele está escalado (1 = sem escala). */
export function frameBox(view: Window | null | undefined): { left: number; top: number; k: number } {
  const fe = view?.frameElement as HTMLIFrameElement | null | undefined;
  if (!fe) return { left: 0, top: 0, k: 1 };
  const r = fe.getBoundingClientRect();
  return { left: r.left, top: r.top, k: fe.offsetWidth ? r.width / fe.offsetWidth : 1 };
}

/** Converte as coordenadas de um evento (da janela ou de dentro de um iframe) para a janela. */
export function toParent(e: { clientX: number; clientY: number; view?: Window | null }): { x: number; y: number } {
  const { left, top, k } = frameBox(e.view);
  return { x: left + e.clientX * k, y: top + e.clientY * k };
}
