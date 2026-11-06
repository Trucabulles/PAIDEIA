import { normalizeHex } from './colorUtils';
import { SYSTEM_COLOR_PALETTE } from './colorPalette';

export const PALETTES_KEY = 'paideia.custom-color-palettes';
export const LEGACY_COLORS_KEY = 'paideia.custom-colors';
export type CustomPalette = { id: string; name: string; colors: string[] };
export type CustomPalettes = { version: 1; activePaletteId: string; palettes: CustomPalette[] };
const colorsFrom = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map(item => typeof item === 'string' ? normalizeHex(item) : null).filter((item): item is string => Boolean(item)))] : [];
export function normalizePalettes(value: unknown, defaultPaletteName = 'Ma palette'): CustomPalettes {
  const safeDefaultName = defaultPaletteName.trim().slice(0, 40) || 'Ma palette';
  const source = value as Partial<CustomPalettes> | null;
  const palettes: CustomPalette[] = [];
  const sourcePalettes = Array.isArray(value) ? [{ id: 'default', name: safeDefaultName, colors: value }]
    : Array.isArray(source?.palettes) ? source.palettes : [];
  for (const raw of sourcePalettes) {
    if (!raw || typeof raw !== 'object') continue;
    const colors = colorsFrom(raw.colors);
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : safeDefaultName;
    const baseId = typeof raw.id === 'string' && raw.id ? raw.id : `palette-${palettes.length}`;
    for (let offset = 0; offset < Math.max(1, colors.length); offset += 7) {
      let id = offset ? `${baseId}-${offset / 7 + 1}` : baseId;
      while (palettes.some(palette => palette.id === id)) id += '-copy';
      palettes.push({ id, name: offset ? `${name} ${offset / 7 + 1}` : name, colors: colors.slice(offset, offset + 7) });
    }
  }
  if (!palettes.length) palettes.push({ id: 'default', name: safeDefaultName, colors: [] });
  const activePaletteId = palettes.some(p => p.id === source?.activePaletteId) ? source!.activePaletteId! : palettes[0].id;
  return { version: 1, activePaletteId, palettes };
}
export function loadPalettes(storage: Pick<Storage, 'getItem'>, defaultPaletteName = 'Ma palette'): CustomPalettes {
  for (const key of [PALETTES_KEY, LEGACY_COLORS_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (raw) return normalizePalettes(JSON.parse(raw), defaultPaletteName);
    } catch { /* Fall back to the untouched legacy palette. */ }
  }
  return normalizePalettes(null, defaultPaletteName);
}
export function isSystemColor(color: string) {
  return SYSTEM_COLOR_PALETTE.some(family => family.base === color || family.shades.includes(color));
}
export function addPaletteColor(state: CustomPalettes, value: string): CustomPalettes {
  const color = normalizeHex(value);
  const palette = state.palettes.find(p => p.id === state.activePaletteId)!;
  if (!color || isSystemColor(color) || palette.colors.includes(color) || palette.colors.length >= 7) return state;
  return { ...state, palettes: state.palettes.map(p => p === palette ? { ...p, colors: [...p.colors, color] } : p) };
}
