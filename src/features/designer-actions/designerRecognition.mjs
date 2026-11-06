// Shared by the runtime and the registry editor. Never apply to authored values.
export function normalizeRecognition(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
    .replace(/[’']/g, ' ').replace(/[^a-z0-9#(),]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function compileRecognitionPattern(pattern) { return new RegExp(pattern, 'iu'); }
