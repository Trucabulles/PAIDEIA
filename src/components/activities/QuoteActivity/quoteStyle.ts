const QUOTE_IMAGE_SIZE_TOKENS = ["small", "medium", "large"] as const;

function normalizeQuoteImageSizeToken(value?: string | null) {
  const raw = value?.trim().toLowerCase() ?? "";
  if (QUOTE_IMAGE_SIZE_TOKENS.includes(raw as (typeof QUOTE_IMAGE_SIZE_TOKENS)[number])) {
    return raw as (typeof QUOTE_IMAGE_SIZE_TOKENS)[number];
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return "medium";
  }

  if (parsed <= 37.5) {
    return "small";
  }

  if (parsed <= 62.5) {
    return "medium";
  }

  return "large";
}

export function quoteImageWidth(blockLike: { imageSize?: string | null }) {
  const parsed = Number.parseFloat(blockLike.imageSize ?? "");
  if (Number.isFinite(parsed)) {
    return `${Math.min(36, Math.max(18, parsed))}%`;
  }

  switch (normalizeQuoteImageSizeToken(blockLike.imageSize)) {
    case "small":
      return "20%";
    case "large":
      return "26%";
    case "medium":
    default:
      return "22%";
  }
}

export function quoteAccentColor(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || normalized === "#ffffff" || normalized === "white" ? "#123a7a" : value ?? "#123a7a";
}

export function quoteBackgroundColor(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || normalized === "#edf4ff" ? "#ffffff" : value ?? "#ffffff";
}

export function quoteBorderWidth(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized ? "1px" : value ?? "1px";
}
