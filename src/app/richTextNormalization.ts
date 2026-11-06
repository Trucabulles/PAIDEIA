// Only neutral inline typography is eligible. Boxes, relative sizes, bookmarks,
// classes and unknown attributes may affect rendering or behavior and stay intact.
export function inlineTypographyKey(element: Element): string | null {
  if (!(element instanceof HTMLElement) || element.tagName !== "SPAN") return null;
  if (Array.from(element.attributes).some(({ name, value }) =>
    !["style", "data-paideia-outline", "data-paideia-font-id"].includes(name) && !(name === "class" && !value))) return null;
  const declarations: string[] = [];
  for (const property of Array.from(element.style)) {
    if (!/^(color|font-(family|size|weight|style)|text-decoration(-line|-style|-color)?|-webkit-text-stroke(-color|-width)?|paint-order|--paideia-rich-outline-color)$/.test(property)) return null;
    const value = element.style.getPropertyValue(property);
    if (/(?:[\d.](?:em|rem|ex|ch|%|vw|vh)\b)|\b(?:inherit|initial|unset|revert|var|calc)\b/i.test(value) && !property.startsWith("text-decoration")) return null;
    declarations.push(`${property}:${value}:${element.style.getPropertyPriority(property)}`);
  }
  return JSON.stringify([declarations.sort(), element.getAttribute("data-paideia-outline"), element.getAttribute("data-paideia-font-id")]);
}

// Operates on a detached fragment, never the live editing selection or undo DOM.
export function compactRichTextSpans(root: ParentNode): void {
  for (const span of Array.from(root.querySelectorAll("span")).reverse()) {
    const key = inlineTypographyKey(span);
    if (key === null) continue;
    if (span.parentElement?.tagName === "SPAN" && inlineTypographyKey(span.parentElement) === key) {
      span.replaceWith(...Array.from(span.childNodes));
    }
  }
  for (const span of Array.from(root.querySelectorAll("span"))) {
    const key = inlineTypographyKey(span);
    if (key === null) continue;
    while (span.nextSibling instanceof Element && inlineTypographyKey(span.nextSibling) === key) {
      const next = span.nextSibling;
      span.append(...Array.from(next.childNodes));
      next.remove();
    }
  }
  // Do not merge unrelated text nodes outside the spans we just simplified.
}
