export type RichTextRangeBoundaryMarkers = {
  start: Comment;
  end: Comment;
};

function richTextLinearLength(root: Node): number {
  if (root.nodeType === Node.TEXT_NODE) return root.nodeValue?.length ?? 0;
  if (root instanceof HTMLBRElement) return 1;
  return Array.from(root.childNodes).reduce(
    (total, child) => total + richTextLinearLength(child),
    0
  );
}

export function getRichTextLinearOffsetFromPoint(
  root: HTMLElement,
  node: Node,
  offset: number
) {
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
    return richTextLinearLength(range.cloneContents());
  } catch {
    return richTextLinearLength(root);
  }
}

export function getRichTextPointFromLinearOffset(root: HTMLElement, offset: number) {
  let remaining = Math.max(0, offset);
  let lastTextNode: Text | null = null;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) =>
        node.nodeType === Node.TEXT_NODE || node instanceof HTMLBRElement
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP
    }
  );

  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const textNode = current as Text;
      const textLength = textNode.nodeValue?.length ?? 0;
      lastTextNode = textNode;
      if (remaining <= textLength) return { node: textNode as Node, offset: remaining };
      remaining -= textLength;
    } else if (current instanceof HTMLBRElement) {
      const parent = current.parentNode;
      if (parent) {
        const index = Array.prototype.indexOf.call(parent.childNodes, current) as number;
        if (remaining === 0) return { node: parent, offset: index };
        if (remaining === 1) return { node: parent, offset: index + 1 };
      }
      remaining -= 1;
    }
    current = walker.nextNode();
  }

  if (lastTextNode) {
    return { node: lastTextNode as Node, offset: lastTextNode.nodeValue?.length ?? 0 };
  }
  return { node: root as Node, offset: root.childNodes.length };
}

export function markRichTextRangeBoundaries(range: Range): RichTextRangeBoundaryMarkers | null {
  if (range.collapsed) return null;

  const end = document.createComment("paideia-rich-selection-end");
  const endRange = range.cloneRange();
  endRange.collapse(false);
  endRange.insertNode(end);

  const start = document.createComment("paideia-rich-selection-start");
  const startRange = range.cloneRange();
  startRange.collapse(true);
  startRange.insertNode(start);

  return { start, end };
}

export function restoreRichTextRangeFromBoundaryMarkers(
  markers: RichTextRangeBoundaryMarkers
) {
  if (!markers.start.isConnected || !markers.end.isConnected) return null;

  try {
    const startParent = markers.start.parentNode;
    const endParent = markers.end.parentNode;
    const startNext = markers.start.nextSibling;
    const endPrevious = markers.end.previousSibling;
    const startIndex = startParent
      ? Array.prototype.indexOf.call(startParent.childNodes, markers.start) as number
      : -1;
    const endIndex = endParent
      ? Array.prototype.indexOf.call(endParent.childNodes, markers.end) as number
      : -1;
    if (!startParent || !endParent || startIndex < 0 || endIndex < 0) return null;

    // Rebuild the Range after removing the markers. Some DOM implementations
    // do not update a live Range correctly when a boundary comment disappears.
    markers.end.remove();
    markers.start.remove();
    const range = document.createRange();
    if (startNext?.isConnected) range.setStartBefore(startNext);
    else range.setStart(startParent, Math.min(startIndex, startParent.childNodes.length));
    if (endPrevious?.isConnected) range.setEndAfter(endPrevious);
    else {
      const adjustedEndIndex = startParent === endParent && startIndex < endIndex
        ? endIndex - 1
        : endIndex;
      range.setEnd(endParent, Math.min(adjustedEndIndex, endParent.childNodes.length));
    }
    return range;
  } catch {
    markers.start.remove();
    markers.end.remove();
    return null;
  }
}

export function discardRichTextRangeBoundaryMarkers(
  markers: RichTextRangeBoundaryMarkers | null
) {
  markers?.start.remove();
  markers?.end.remove();
}
