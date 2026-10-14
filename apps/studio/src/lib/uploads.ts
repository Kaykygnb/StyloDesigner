// Ler uma imagem escolhida pela pessoa (como data URL, que é o que a ferramenta add_asset recebe) e descobrir o tamanho dela.
export const MAX_IMAGE = 16 * 1024 * 1024;

export async function readImageFile(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Isso não parece uma imagem (PNG, JPG, WebP, GIF ou SVG).');
  if (file.size > MAX_IMAGE) throw new Error('A imagem passa de 16 MB: use uma menor.');
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    reader.readAsDataURL(file);
  });
  const size = await new Promise<{ w: number; h: number }>((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
    im.onerror = () => resolve({ w: 1, h: 1 });
    im.src = dataUrl;
  });
  return { dataUrl, ...size };
}
