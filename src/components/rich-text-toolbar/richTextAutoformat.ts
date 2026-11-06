export const RICH_TEXT_SEPARATOR_ATTRIBUTE = "data-paideia-rich-separator";

export function decorateRichTextSeparatorsInHtml(html: string) {
  if (!html.includes("\u2500")) {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    if (!textNode.parentElement?.closest(`[${RICH_TEXT_SEPARATOR_ATTRIBUTE}]`)) {
      textNodes.push(textNode);
    }
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const value = textNode.nodeValue ?? "";
    if (!value.includes("\u2500")) {
      return;
    }

    const fragment = document.createDocumentFragment();
    value.split(/(\u2500+)/).forEach((part) => {
      if (!part) {
        return;
      }
      if (/^\u2500+$/.test(part)) {
        const separator = document.createElement("span");
        separator.setAttribute(RICH_TEXT_SEPARATOR_ATTRIBUTE, "true");
        separator.textContent = part;
        fragment.appendChild(separator);
        return;
      }
      fragment.appendChild(document.createTextNode(part));
    });
    textNode.replaceWith(fragment);
  });

  return container.innerHTML;
}

function textPointAtOffset(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let lastTextNode: Text | null = null;
  let node = walker.nextNode();

  while (node) {
    const textNode = node as Text;
    const length = textNode.nodeValue?.length ?? 0;
    // At an exact boundary, prefer the beginning of the following text node.
    // Otherwise a separator typed at the start of a new block is inserted at
    // the end of the previous line and inherits that line's formatting.
    if (remaining < length) {
      return { node: textNode, offset: remaining };
    }
    remaining -= length;
    lastTextNode = textNode;
    node = walker.nextNode();
  }

  return remaining === 0 && lastTextNode
    ? { node: lastTextNode, offset: lastTextNode.nodeValue?.length ?? 0 }
    : null;
}

export function replaceTripleHyphenBeforeCaret(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false;
  }

  const caretRange = selection.getRangeAt(0);
  if (caretRange.startContainer !== editor && !editor.contains(caretRange.startContainer)) {
    return false;
  }

  const prefixRange = document.createRange();
  prefixRange.setStart(editor, 0);
  prefixRange.setEnd(caretRange.startContainer, caretRange.startOffset);
  const prefixText = prefixRange.cloneContents().textContent ?? "";
  if (!prefixText.endsWith("---")) {
    return false;
  }

  const startPoint = textPointAtOffset(editor, prefixText.length - 3);
  if (!startPoint) {
    return false;
  }

  const replacementRange = document.createRange();
  replacementRange.setStart(startPoint.node, startPoint.offset);
  replacementRange.setEnd(caretRange.startContainer, caretRange.startOffset);
  if (replacementRange.toString() !== "---") {
    return false;
  }

  const separator = document.createElement("span");
  separator.setAttribute(RICH_TEXT_SEPARATOR_ATTRIBUTE, "true");
  separator.textContent = "\u2500";

  replacementRange.deleteContents();
  replacementRange.insertNode(separator);

  // Keep the caret in a text node belonging to the current formatting
  // context. A caret directly after the technical separator span can be
  // interpreted by WebView2 as belonging to the preceding inline/line.
  const caretNode = document.createTextNode("");
  separator.after(caretNode);

  const nextRange = document.createRange();
  nextRange.setStart(caretNode, 0);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
}
