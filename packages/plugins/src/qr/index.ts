import QRCode from 'qrcode';
import { z } from 'zod';
import { definePlugin } from '@stylo/core/plugin.ts';
import { defineTool } from '@stylo/core/tools/schema.ts';

export const qr = definePlugin({
  id: 'qr',
  name: 'QR Code',
  description: 'Gera QR Codes offline para URLs, textos e dados de integração.',
  category: 'utility',
  version: '1.0.0', author: 'Stylo', license: 'MIT', repository: 'https://github.com/soldair/node-qrcode',
  permissions: ['read'], dependencies: [], exportCompatibility: ['SVG', 'PNG'],
  tools: [{
    def: defineTool({
      name: 'generate_qr_code', write: false, needs: 'read',
      description: 'Gera um QR Code em SVG ou PNG a partir de texto ou URL, sem enviar o conteúdo para a rede.',
      input: z.object({
        value: z.string().min(1).max(4096),
        format: z.enum(['svg', 'png']).default('svg'),
        size: z.number().int().min(64).max(2048).default(512),
        margin: z.number().int().min(0).max(32).default(2),
        dark: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
        light: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
      }),
    }),
    run: async (args) => {
      const options = { width: args.size, margin: args.margin, color: { dark: args.dark, light: args.light } };
      if (args.format === 'png') return { format: 'png', mime: 'image/png', dataUrl: await QRCode.toDataURL(args.value, options) };
      return { format: 'svg', mime: 'image/svg+xml', content: await QRCode.toString(args.value, { ...options, type: 'svg' }) };
    },
  }],
});
