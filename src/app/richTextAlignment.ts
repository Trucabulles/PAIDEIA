const RICH_TEXT_ALIGNMENT_BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,blockquote,div,li,td,th,caption";
const RICH_TEXT_ALIGNMENT_BLOCK_TAGS = new Set(
  RICH_TEXT_ALIGNMENT_BLOCK_SELECTOR.split(",").map((tag) => tag.toUpperCase()),
);

export type RichTextAlignment = "left" | "center" | "right" | "justify";

export function richTextAlignmentForCommand(command: string): RichTextAlignment | null {
  if (command === "justifyLeft") return "left";
  if (command === "justifyCenter") return "center";
  if (command === "justifyRight") return "right";
  if (command === "justifyFull") return "justify";
  return null;
}

function rangeTouchesElement(range: Range, element: HTMLElement) {
  if (range.collapsed) {
    return element === range.startContainer || element.contains(range.startContainer);
  }
  try {
    return range.intersectsNode(element);
  } catch {
    return false;
  }
}

/**
 * Alignment belongs to paragraph-like blocks. Office and browser clipboard
 * HTML can also put `text-align` on inline spans/strong tags. Those competing
 * declarations make a later alignment command appear to do nothing, depending
 * on the exact caret and WebView DOM produced by execCommand.
 */
export function normalizeRichTextAlignmentOwners(root: ParentNode) {
  let normalized = 0;
  root.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    if (!element.style.getPropertyValue("text-align")) return;
    if (RICH_TEXT_ALIGNMENT_BLOCK_TAGS.has(element.tagName)) return;
    element.style.removeProperty("text-align");
    if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
    normalized += 1;
  });
  return normalized;
}

/**
 * Applies one explicit alignment to every semantic leaf block touched by the
 * selection. Descendant inline declarations are removed so the selected block
 * remains the single source of truth after paste, blur and reopen.
 */
export function applyRichTextAlignment(
  editor: HTMLElement,
  range: Range,
  alignment: RichTextAlignment,
) {
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return false;

  const blocks = Array.from(editor.querySelectorAll<HTMLElement>(RICH_TEXT_ALIGNMENT_BLOCK_SELECTOR))
    .filter((element) => rangeTouchesElement(range, element))
    .filter((element) => !element.querySelector(RICH_TEXT_ALIGNMENT_BLOCK_SELECTOR));

  for (const block of blocks) {
    block.querySelectorAll<HTMLElement>("[style]").forEach((descendant) => {
      descendant.style.removeProperty("text-align");
      if (!descendant.getAttribute("style")?.trim()) descendant.removeAttribute("style");
    });
    block.style.setProperty("text-align", alignment);
  }

  return blocks.length > 0;
}
