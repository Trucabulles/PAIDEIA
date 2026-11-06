// Format selected text leaves rather than extracting a range across LI
export function clearListSelectionTypography(editor: HTMLElement, range: Range) {
  // Split only text-level ranges. Extracting across items lets the browser
  // split a list and insert an empty paragraph between its fragments.
  const runs: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) runs.push({ node, start, end });
  }
  for (const { node, start, end } of runs.reverse()) {
    if (end < node.length) node.splitText(end);
    const selected = start ? node.splitText(start) : node;
    let current: Node = selected;
    while (current.parentElement?.matches('span,strong,b,em,i,u,s,strike,font,a,mark,sub,sup')) {
      const parent = current.parentElement;
      const before = parent.cloneNode(false);
      const after = parent.cloneNode(false);
      while (parent.firstChild && parent.firstChild !== current) before.appendChild(parent.firstChild);
      while (current.nextSibling) after.appendChild(current.nextSibling);
      if (before.hasChildNodes()) parent.before(before);
      parent.before(current);
      if (after.hasChildNodes()) parent.before(after);
      parent.remove();
    }
  }
}

// boundaries: extractContents clones the boundary items and leaves empty LIs.
export function formatListSelection(
  editor: HTMLElement,
  range: Range,
  property: "font-family" | "font-size",
  value: string,
  fontId?: string,
): boolean {
  if (range.collapsed || !Array.from(editor.querySelectorAll("li")).some(item => range.intersectsNode(item))) return false;
  const runs: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) runs.push({ node, start, end });
  }
  for (const { node, start, end } of runs.reverse()) {
    if (end < node.length) node.splitText(end);
    const selected = start ? node.splitText(start) : node;
    const span = document.createElement("span");
    span.style.setProperty(property, value);
    if (fontId) span.dataset.paideiaFontId = fontId;
    selected.before(span);
    span.append(selected);
    if (property === "font-size") {
      span.closest<HTMLElement>("li")?.style.setProperty("--paideia-list-marker-size", value);
    }
  }
  return true;
}

export function formatRichTextSelection(
  editor: HTMLElement,
  range: Range,
  property: "color" | "background-color",
  value: string,
): boolean {
  if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return false;
  const runs: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.length || !range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) runs.push({ node, start, end });
  }
  for (const { node, start, end } of runs.reverse()) {
    if (end < node.length) node.splitText(end);
    const selected = start ? node.splitText(start) : node;
    if (property === "background-color" && value === "transparent") {
      removeSelectedTextHighlight(editor, selected);
      continue;
    }
    const span = document.createElement("span");
    span.style.setProperty(property, value);
    selected.before(span);
    span.append(selected);
  }
  return runs.length > 0;
}

const INLINE_HIGHLIGHT_ANCESTORS = "span, mark, font, b, strong, i, em, u, s, strike, a, sub, sup, small, code";

function removeSelectedTextHighlight(editor: HTMLElement, selected: Text): void {
  const ancestors: HTMLElement[] = [];
  let parent = selected.parentElement;
  while (parent && parent !== editor && parent.matches(INLINE_HIGHLIGHT_ANCESTORS)) {
    ancestors.push(parent);
    parent = parent.parentElement;
  }
  let outermostHighlight = -1;
  ancestors.forEach((ancestor, index) => {
    if (ancestor.tagName === "MARK" || ancestor.style.backgroundColor || ancestor.style.background) {
      outermostHighlight = index;
    }
  });
  if (outermostHighlight < 0) return;

  let current: Node = selected;
  for (const ancestor of ancestors.slice(0, outermostHighlight + 1)) {
    const before = ancestor.cloneNode(false) as HTMLElement;
    const after = ancestor.cloneNode(false) as HTMLElement;
    const middle = ancestor.tagName === "MARK"
      ? document.createElement("span")
      : ancestor.cloneNode(false) as HTMLElement;
    if (ancestor.tagName === "MARK") {
      for (const attribute of Array.from(ancestor.attributes)) middle.setAttribute(attribute.name, attribute.value);
    }
    middle.style.removeProperty("background-color");
    middle.style.removeProperty("background");
    while (ancestor.firstChild && ancestor.firstChild !== current) before.appendChild(ancestor.firstChild);
    while (current.nextSibling) after.appendChild(current.nextSibling);
    middle.appendChild(current);
    if (before.hasChildNodes()) {
      before.removeAttribute("id");
      ancestor.before(before);
    }
    ancestor.before(middle);
    if (after.hasChildNodes()) {
      after.removeAttribute("id");
      ancestor.before(after);
    }
    ancestor.remove();
    current = middle;
  }
}

// Older font commands produced OL > SPAN > LI. Move only these invalid
// inline wrappers inside each LI, retaining their attributes and typography.
// Empty LIs are deliberately retained: they may have been authored by the user.
export function repairListInlineWrappers(editor: HTMLElement): void {
  for (const list of Array.from(editor.querySelectorAll("ul, ol"))) {
    const unwrap = (wrapper: Element): void => {
      for (const child of Array.from(wrapper.children)) {
        if (child.matches("span, font, b, strong, i, em, u, s") && child.querySelector("li")) unwrap(child);
      }
      if (!wrapper.children.length || Array.from(wrapper.childNodes).some(node =>
        node instanceof Element ? node.tagName !== "LI" : Boolean(node.textContent?.trim()))) return;
      for (const item of Array.from(wrapper.children)) {
        const inline = wrapper.cloneNode(false) as Element;
        inline.removeAttribute("id");
        inline.append(...Array.from(item.childNodes));
        item.append(inline);
        wrapper.before(item);
      }
      wrapper.remove();
    };
    for (const child of Array.from(list.children)) {
      if (child.matches("span, font, b, strong, i, em, u, s") && child.querySelector("li")) unwrap(child);
    }
  }
}

export function synchronizeListMarkerWithAdjacentText(item: HTMLElement): void {
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode() as Text | null;
  while (textNode) {
    const text = textNode.nodeValue?.replace(/[\u200B\u00A0]/g, "").trim();
    const nestedList = textNode.parentElement?.closest("ul, ol");
    if (text && (!nestedList || nestedList === item.parentElement)) break;
    textNode = walker.nextNode() as Text | null;
  }
  if (!textNode?.parentElement) {
    item.style.removeProperty("--paideia-list-marker-color");
    item.style.removeProperty("--paideia-list-marker-size");
    item.style.removeProperty("--paideia-list-marker-weight");
    return;
  }

  const ancestors: HTMLElement[] = [];
  let current: HTMLElement | null = textNode.parentElement;
  while (current && item.contains(current)) {
    ancestors.push(current);
    if (current === item) break;
    current = current.parentElement;
  }
  const hasExplicitColor = ancestors.some((element) =>
    Boolean(element.style.color || (element.tagName === "FONT" && element.getAttribute("color")))
  );
  const hasExplicitSize = ancestors.some((element) =>
    Boolean(element.style.fontSize || (element.tagName === "FONT" && element.getAttribute("size")))
  );
  const hasExplicitWeight = ancestors.some((element) =>
    element.matches("strong, b") || Boolean(element.style.fontWeight)
  );
  const computed = window.getComputedStyle(textNode.parentElement);

  if (hasExplicitColor) item.style.setProperty("--paideia-list-marker-color", computed.color);
  else item.style.removeProperty("--paideia-list-marker-color");
  if (hasExplicitSize) item.style.setProperty("--paideia-list-marker-size", computed.fontSize);
  else item.style.removeProperty("--paideia-list-marker-size");
  if (hasExplicitWeight) {
    const numericWeight = Number.parseInt(computed.fontWeight, 10);
    const isBold = ancestors.some((element) => {
      const explicitWeight = element.style.fontWeight;
      const explicitNumericWeight = Number.parseInt(explicitWeight, 10);
      return element.matches("strong, b") || explicitWeight === "bold" ||
        (Number.isFinite(explicitNumericWeight) && explicitNumericWeight >= 600);
    }) || computed.fontWeight === "bold" || (Number.isFinite(numericWeight) && numericWeight >= 600);
    item.style.setProperty("--paideia-list-marker-weight", isBold ? "700" : "400");
  } else {
    item.style.removeProperty("--paideia-list-marker-weight");
  }
  if (!item.getAttribute("style")?.trim()) item.removeAttribute("style");
}
