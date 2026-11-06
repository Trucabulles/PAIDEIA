import type { PaideiaBlock } from "../../types/project";

function comparableAssetRef(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^assets\//i, "")
    .toLocaleLowerCase("en-US");
}

export function isActivityBackgroundAssetRef(block: PaideiaBlock, ref: string | null | undefined): boolean {
  const backgroundRef = comparableAssetRef(block.sectionBackgroundImageRef);
  return Boolean(backgroundRef && comparableAssetRef(ref) === backgroundRef);
}

export function pdfContentAssetRefs(block: PaideiaBlock): string[] {
  return (block.assetRefs ?? []).filter((ref) => !isActivityBackgroundAssetRef(block, ref));
}
