const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function readImageAsDataUrl(file, maxBytes = DEFAULT_MAX_IMAGE_BYTES) {
  if (!IMAGE_TYPES.has(file.type) || file.size > maxBytes) {
    throw new Error('INVALID_IMAGE');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}
