import { rm } from 'node:fs/promises';

/** Prazo sempre liberado; não deixa rejeição tardia da operação sem consumidor. */
export async function withTimeout(promise, ms, description) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout: ${description}`)), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Confirma saída, inclusive se já ocorreu, antes de permitir remoção dos dados do servidor. */
export async function stopChild(child, timeoutMs = 5000) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  let onExit, onError;
  const exited = new Promise((resolve, reject) => {
    onExit = resolve; onError = reject;
    child.once('exit', onExit); child.once('error', onError);
  });
  try {
    child.kill('SIGTERM');
    try { await withTimeout(exited, timeoutMs, 'servidor não encerrou com SIGTERM'); }
    catch (error) {
      if (!error.message.startsWith('Timeout:')) throw error;
      child.kill('SIGKILL');
      await withTimeout(exited, timeoutMs, 'servidor não encerrou com SIGKILL');
    }
  } finally {
    child.off('exit', onExit); child.off('error', onError);
  }
}

/** Um hook por fixture: fecha todos os recursos e só apaga a pasta se o encerramento não falhar. */
export async function cleanupFixture({ clients = [], children = [], postgres = null, initializing = false, dir }) {
  const errors = initializing ? [new Error('Inicialização ainda em execução; não remover diretório.')] : [];
  const attempt = async (fn) => { try { await fn(); } catch (error) { errors.push(error); } };
  for (const client of [...clients].reverse()) await attempt(() => withTimeout(client.close(), 5000, 'cliente MCP não fechou'));
  for (const child of [...children].reverse()) await attempt(() => stopChild(child));
  if (postgres) await attempt(() => withTimeout(postgres.stop(), 10000, 'PostgreSQL não encerrou'));
  // Não remover dados ainda potencialmente usados; o erro de cleanup faz o teste falhar.
  if (errors.length) throw new AggregateError(errors, 'Falha ao encerrar fixture; diretório preservado.');
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
