import { removeRichTextDropCap } from "./richTextDropCap";

// Apply semantic styles without letting formatBlock restructure lists/tables.
export function applyRichParagraphStyle(editor: HTMLElement, range: Range, tag: string) {
  const selector = "p,h1,h2,h3,h4,h5,blockquote,div,li,td,th";
  const touched = (node: HTMLElement) => {
    if (range.collapsed) return node === range.startContainer || node.contains(range.startContainer);
    const contents = document.createRange();
    contents.selectNodeContents(node);
    return range.compareBoundaryPoints(Range.END_TO_START, contents) < 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, contents) > 0;
  };
  const blocks = Array.from(editor.querySelectorAll<HTMLElement>(selector))
    .filter(node => touched(node) && !node.querySelector(selector));
  for (const block of blocks) {
    if (tag.toLowerCase() !== "p") removeRichTextDropCap(block);
    const replacement = document.createElement(tag);
    if (block.matches("li,td,th")) {
      replacement.append(...Array.from(block.childNodes));
      block.append(replacement);
    } else {
      for (const attribute of Array.from(block.attributes)) replacement.setAttribute(attribute.name, attribute.value);
      replacement.append(...Array.from(block.childNodes));
      block.replaceWith(replacement);
    }
    // A newly applied paragraph style owns its size, even when re-applied.
    for (const node of [replacement, ...Array.from(replacement.querySelectorAll<HTMLElement>("*"))]) {
      node.style.removeProperty("font-size");
      node.removeAttribute("size");
    }
    const item = replacement.closest<HTMLElement>("li");
    item?.style.removeProperty("font-size");
    item?.style.removeProperty("--paideia-list-marker-size");
  }
  return blocks.length > 0;
}
