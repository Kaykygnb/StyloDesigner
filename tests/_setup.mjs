import { randomBytes } from 'node:crypto';

// Banco/blobs em memória.
process.env.DESIGNER_DB = 'memory';
process.env.STYLO_BLOB_DIR = 'memory';
process.env.STYLO_SECRET_KEY = randomBytes(32).toString('base64');
process.env.PEXELS_API_KEY = '';
process.env.PIXABAY_API_KEY = '';
