/** Erro com status HTTP e mensagem que pode ser mostrada à pessoa. */
export function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, expose: true, ...extra });
}
