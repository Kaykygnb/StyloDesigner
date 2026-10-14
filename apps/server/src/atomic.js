// Gravação atômica de arquivos JSON de configuração (config, conta, chaves do agente e do modelo de imagem).
// Escreve num arquivo temporário e troca por `rename`: uma queda no meio nunca deixa o JSON truncado, e as gravações
// do MESMO arquivo entram numa fila (a ordem de chamada é a ordem de gravação), sem bloquear arquivos diferentes.
import { rename, rm, writeFile } from 'node:fs/promises';

const queues = new Map(); // caminho → última gravação enfileirada

/**
 * Grava `data` como JSON em `file` de forma atômica e serializada.
 * @param {string} file  caminho do arquivo
 * @param {unknown} data  qualquer valor serializável em JSON
 * @returns {Promise<void>} rejeita se a serialização ou a gravação falhar; o arquivo anterior fica intacto
 */
export async function writeJsonAtomic(file, data) {
  const text = JSON.stringify(data, null, 2); // erro de serialização (ex.: referência circular) sai antes de tocar no disco
  const previous = queues.get(file) || Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(tmp, text, { mode: 0o600 }); // chaves de API: só o dono lê (no Windows o modo é ignorado)
      await rename(tmp, file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  });
  queues.set(file, run);
  run.catch(() => {}).then(() => { if (queues.get(file) === run) queues.delete(file); });
  return run;
}
