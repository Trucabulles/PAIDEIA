export function richTextFallbackForField(field?: string | null) {
  return field === "quoteAuthorHtml" ? "" : "<p></p>";
}

export function hasRichTextEditor(blockType: string) {
  return ["rich-text", "quote", "list", "note", "image-text", "image-360", "media", "audio", "point-of-interest", "header"].includes(blockType);
}

export function hasInlineRichTextEditor(blockType: string) {
  return ["rich-text", "quote", "list", "note", "image-text", "image-360", "point-of-interest", "media", "audio", "header"].includes(blockType);
}

export function defaultRichTextContentHtml(blockType?: string | null) {
  return blockType === "header" ? "" : "<p></p>";
}
