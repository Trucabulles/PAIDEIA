import type { PaideiaChapter } from "../../../types/project";

export type SectionMarkerScheme = "arabic" | "roman" | "alpha";
export type SectionMarkerType = "none" | "outline" | "filled";

export function normalizeSectionMarkerScheme(value?: string | null): SectionMarkerScheme {
  return value === "roman" || value === "alpha" ? value : "arabic";
}

export function normalizeSectionMarkerType(value?: string | null): SectionMarkerType {
  return value === "none" || value === "filled" ? value : "outline";
}

export function alphabeticMarker(index: number): string {
  let value = Math.max(1, Math.trunc(index));
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function romanMarker(index: number): string {
  let value = Math.max(1, Math.trunc(index));
  const tokens: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let result = "";
  for (const [amount, token] of tokens) {
    while (value >= amount) { result += token; value -= amount; }
  }
  return result;
}

export function formatSectionMarker(index: number, scheme?: string | null): string {
  switch (normalizeSectionMarkerScheme(scheme)) {
    case "roman": return romanMarker(index);
    case "alpha": return alphabeticMarker(index);
    default: return String(Math.max(1, Math.trunc(index)));
  }
}

export function sectionMarkerFontSizeForLabelLength(length: number): string {
  if (length >= 7) return "0.9rem";
  if (length === 6) return "1.05rem";
  if (length === 5) return "1.25rem";
  if (length === 4) return "1.35rem";
  return "1.5rem";
}

type SectionMarkerSchemeOverride = {
  blockId: string;
  markerScheme: string;
};

function sectionMarkerLabelsInChapter(
  chapter: PaideiaChapter | null | undefined,
  override?: SectionMarkerSchemeOverride
): Map<string, string> {
  const labels = new Map<string, string>();
  if (!chapter) return labels;
  const counts: Record<SectionMarkerScheme, number> = { arabic: 0, roman: 0, alpha: 0 };
  for (const page of chapter.pages) {
    for (const block of page.blocks) {
      if (block.type !== "section-marker") continue;
      const scheme = normalizeSectionMarkerScheme(
        override?.blockId === block.id ? override.markerScheme : block.markerScheme
      );
      counts[scheme] += 1;
      labels.set(block.id, formatSectionMarker(counts[scheme], scheme));
    }
  }
  return labels;
}

export function sectionMarkerFontSizeInChapter(
  chapter: PaideiaChapter | null | undefined,
  override?: SectionMarkerSchemeOverride
): string {
  const longestLabelLength = Array.from(sectionMarkerLabelsInChapter(chapter, override).values())
    .reduce((maximum, label) => Math.max(maximum, Array.from(label).length), 0);
  return sectionMarkerFontSizeForLabelLength(longestLabelLength);
}

export function sectionMarkerLabelInChapter(
  chapter: PaideiaChapter | null | undefined,
  blockId: string,
  markerSchemeOverride?: string
): string {
  if (!chapter) return "1";
  return sectionMarkerLabelsInChapter(
    chapter,
    markerSchemeOverride === undefined ? undefined : { blockId, markerScheme: markerSchemeOverride }
  ).get(blockId) ?? "1";
}
