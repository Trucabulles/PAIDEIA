export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type HsvColor = { h: number; s: number; v: number };
export function rgbToHsv({ r, g, b }: RgbColor, previousHue = 0): HsvColor {
  const channels = [r, g, b].map(value => value / 255);
  const max = Math.max(...channels), min = Math.min(...channels), delta = max - min;
  let h = previousHue;
  if (delta) {
    const [red, green, blue] = channels;
    h = max === red ? 60 * ((green - blue) / delta % 6)
      : max === green ? 60 * ((blue - red) / delta + 2) : 60 * ((red - green) / delta + 4);
    h = (h + 360) % 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}
export function hsvToHex({ h, s, v }: HsvColor): string {
  const hue = ((h % 360) + 360) % 360 / 60;
  const value = Math.max(0, Math.min(1, v));
  const c = value * Math.max(0, Math.min(1, s));
  const x = c * (1 - Math.abs(hue % 2 - 1)), m = value - c;
  const rgb = hue < 1 ? [c, x, 0] : hue < 2 ? [x, c, 0] : hue < 3 ? [0, c, x]
    : hue < 4 ? [0, x, c] : hue < 5 ? [x, 0, c] : [c, 0, x];
  return rgbToHex(...rgb.map(channel => Math.round((channel + m) * 255)) as [number, number, number])!;
}

export function isValidHex(value: string) {
  return /^#?[0-9a-f]{6}$/i.test(value.trim());
}

export function normalizeHex(value: string) {
  const trimmed = value.trim();
  if (!isValidHex(trimmed)) {
    return null;
  }
  return `#${trimmed.replace(/^#/, "").toUpperCase()}`;
}

export function isValidRgbValue(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

export function hexToRgb(value: string): RgbColor | null {
  const normalized = normalizeHex(value);
  if (!normalized) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  if (![r, g, b].every(isValidRgbValue)) {
    return null;
  }
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
