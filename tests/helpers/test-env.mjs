import { randomBytes } from 'node:crypto';

/** Servidores de teste usam recursos próprios mesmo quando executados sem o setup global. */
export function isolatedServerEnv(overrides, inheritedEnv = process.env) {
  if (!overrides?.DESIGNER_CONFIG) throw new Error('Fixture exige DESIGNER_CONFIG próprio.');
  return {
    ...inheritedEnv,
    DESIGNER_DB: 'memory',
    STYLO_BLOB_DIR: 'memory',
    STYLO_SECRET_KEY: randomBytes(32).toString('base64'),
    STYLO_AUTH: 'local',
    PEXELS_API_KEY: '',
    PIXABAY_API_KEY: '',
    ...overrides,
  };
}
