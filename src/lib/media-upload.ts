export const MAX_IMAGE_SIDE = 1600;
export const IMMUTABLE_CACHE_SECONDS = 31536000;

export function fitImage(width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error('Ukuran gambar tidak valid.');
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function isCompressible(type: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type);
}

export function chooseSmaller(original: File, candidate: File) {
  return candidate.size < original.size ? candidate : original;
}

export async function compressUpload(original: File): Promise<File> {
  if (!isCompressible(original.type)) return original;
  const bitmap = await createImageBitmap(original, { imageOrientation: 'from-image' });
  try {
    const size = fitImage(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: original.type !== 'image/jpeg' });
    if (!context) throw new Error('Gambar tidak dapat diproses.');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, original.type, 0.82));
    if (!blob || blob.type !== original.type) return original;
    return chooseSmaller(original, new File([blob], original.name, { type: original.type, lastModified: original.lastModified }));
  } finally {
    bitmap.close();
  }
}