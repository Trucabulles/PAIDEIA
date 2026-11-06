const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

export const DEFAULT_DARK_TEXT_COLOR = "#222222";
export const DEFAULT_LIGHT_TEXT_COLOR = "#FFFFFF";

export function normalizeHexColor(value?: string | null): string | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}
function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color: string): number {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return 0.2126 * channelToLinear(red) + 0.7152 * channelToLinear(green) + 0.0722 * channelToLinear(blue);
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Keeps an inherited author color when it remains readable, otherwise chooses
 * the readable dark/light fallback. Inline Rich Text colors are not passed
 * through this function and therefore remain authoritative.
 */
export function resolveContrastingTextColor(
  preferredTextColor: string,
  backgroundColor?: string | null
): string {
  const preferred = normalizeHexColor(preferredTextColor) ?? DEFAULT_DARK_TEXT_COLOR;
  const background = normalizeHexColor(backgroundColor);
  if (!background || contrastRatio(preferred, background) >= 4.5) {
    return preferred;
  }

  return contrastRatio(DEFAULT_LIGHT_TEXT_COLOR, background) >= contrastRatio(DEFAULT_DARK_TEXT_COLOR, background)
    ? DEFAULT_LIGHT_TEXT_COLOR
    : DEFAULT_DARK_TEXT_COLOR;
}

/**
 * Keeps a configured course color in context unless it is nearly invisible
 * against the activity background. This preserves intentional colors such as
 * red on white while preventing black on black or white on white.
 */
export function resolveContextualTextColor(
  preferredTextColor: string,
  backgroundColor?: string | null
): string {
  const preferred = normalizeHexColor(preferredTextColor) ?? DEFAULT_DARK_TEXT_COLOR;
  const background = normalizeHexColor(backgroundColor);
  if (!background || contrastRatio(preferred, background) >= 1.5) {
    return preferred;
  }
  return resolveContrastingTextColor(preferred, background);
}
