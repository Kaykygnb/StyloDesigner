/**
 * config.ts — CONFIGURAÇÃO DO SERVIDOR (arquivo JSON ao lado do app, fora do git)
 *
 * Guarda só preferências e chaves: nº de versões guardadas, chave do Pexels, modelo de imagem, política de agentes.
 * Os DADOS (projetos, contas, agentes) moram no banco. Gravação atômica; arquivo corrompido vira uma cópia
 * `.corrompido-<data>` (para recuperar chaves) e o servidor segue com o padrão.
 */

import { copyFile, readFile } from 'node:fs/promises';
import { writeJsonAtomic } from './atomic.js';

export interface Config {
  keepVersions: number;
  pexels?: { apiKey?: string };
  imageai?: Record<string, unknown>;
  agent?: { keys?: Record<string, string> };
  mcp?: { agentPolicy?: 'open' | 'approval' | 'closed' };
  [extra: string]: unknown;
}

export const DEFAULT_CONFIG: Config = { keepVersions: 20 };

export async function loadConfig(file: string): Promise<Config> {
  let text: string;
  try { text = await readFile(file, 'utf8'); } catch { return { ...DEFAULT_CONFIG }; } // ainda não existe: padrão
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(text) };
  } catch {
    const backup = `${file}.corrompido-${Date.now()}`;
    await copyFile(file, backup).catch(() => {});
    console.warn(`  Aviso: a configuração estava corrompida. Cópia guardada em ${backup}; usando o padrão.`);
    return { ...DEFAULT_CONFIG };
  }
}

/** Mantém a configuração atual em memória e a grava no arquivo a cada mudança. */
export function createConfigStore(file: string, initial: Config) {
  let current = initial;
  return {
    get: () => current,
    /** Troca a configuração inteira (já validada por quem chama) e grava. */
    async set(next: Config) {
      await writeJsonAtomic(file, next);
      current = next;
    },
    file,
  };
}

export type ConfigStore = ReturnType<typeof createConfigStore>;
