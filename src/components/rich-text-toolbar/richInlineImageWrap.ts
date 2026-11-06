import type { RichInlineImageWrap } from "./richInlineImage";

const WRAPPER_CLASS = "paideia-rich-image-float";
const WRAPPER_SELECTOR = `.${WRAPPER_CLASS}[data-paideia-rich-image-wrap]`;
const ROOT_BLOCK_SELECTOR = "p, div, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table, hr";
const SAFE_FORMATTING_SELECTOR = "span, strong, b, em, i, u, s, strike, mark, small, big, sub, sup, font";

function wrapperFor(image: HTMLImageElement): HTMLElement | null {
  const parent = image.parentElement;
  return parent?.matches(WRAPPER_SELECTOR) ? parent : null;
}

export function getRichInlineImageWrap(image: HTMLImageElement): RichInlineImageWrap {
  const value = wrapperFor(image)?.getAttribute("data-paideia-rich-image-wrap");
  return value === "left" || value === "right" ? value : "inline";
}

function hasContent(fragment: DocumentFragment): boolean {
  function nodeHasContent(node: Node): boolean {
    // Whitespace is authored content, but an empty formatting shell created by
    // a Range split is not. Otherwise a leading imported image would create an
    // empty paragraph before itself.
    if (node.nodeType === 3) return true;
    if (!(node instanceof Element)) return true;
    if (!node.matches(SAFE_FORMATTING_SELECTOR)) return true;
    return Array.from(node.childNodes).some(nodeHasContent);
  }

  return Array.from(fragment.childNodes).some(nodeHasContent);
}

/**
 * RichText can temporarily contain a run of inline nodes at its root after a
 * browser insertion. Give that run a semantic paragraph before manipulating an
 * image inside it, so wrapping never depends on incidental browser DOM shape.
 */
export function normalizeRichInlineImageParagraph(image: HTMLImageElement, editor: HTMLElement): HTMLParagraphElement | null {
  if (image.parentElement !== editor) {
    const paragraph = image.closest("p");
    return paragraph instanceof HTMLParagraphElement && paragraph.parentElement === editor ? paragraph : null;
  }

  const children = Array.from(editor.childNodes);
  const imageIndex = children.indexOf(image);
  if (imageIndex < 0) return null;
  const isBlock = (node: Node) => node instanceof Element && node.matches(ROOT_BLOCK_SELECTOR);
  let first = imageIndex;
  let last = imageIndex;
  while (first > 0 && !isBlock(children[first - 1])) first -= 1;
  while (last + 1 < children.length && !isBlock(children[last + 1])) last += 1;

  const paragraph = editor.ownerDocument.createElement("p");
  editor.insertBefore(paragraph, children[first]);
  children.slice(first, last + 1).forEach((node) => paragraph.appendChild(node));
  return paragraph;
}

function paragraphFor(image: HTMLImageElement, editor: HTMLElement): HTMLParagraphElement | null {
  const paragraph = normalizeRichInlineImageParagraph(image, editor) ?? image.closest("p");
  if (!(paragraph instanceof HTMLParagraphElement)) return null;
  if (paragraph.parentElement !== editor) return null;
  if (!editor.contains(paragraph)) return null;

  // Pasted text may wrap an image in typographic elements. Range splitting
  // preserves those elements around the text. Functional wrappers such as a
  // link remain unsupported because extracting the image would change meaning.
  let parent = image.parentElement;
  while (parent && parent !== paragraph) {
    if (!parent.matches(SAFE_FORMATTING_SELECTOR)) return null;
    parent = parent.parentElement;
  }
  return parent === paragraph ? paragraph : null;
}

/** Keep the image and its asset identity; only change its position in the editable DOM. */
export function setRichInlineImageWrap(image: HTMLImageElement, editor: HTMLElement, wrap: RichInlineImageWrap): boolean {
  const wrapper = wrapperFor(image);
  if (wrap === "inline") {
    if (!wrapper) return true;
    const placement = wrapper.dataset.paideiaRichImagePlacement;
    const previous = wrapper.previousSibling;
    const next = wrapper.nextSibling;
    if (placement === "split" && previous instanceof HTMLParagraphElement && next instanceof HTMLParagraphElement) {
      previous.appendChild(image);
      previous.append(...Array.from(next.childNodes));
      next.remove();
    } else if (placement === "end" && previous instanceof HTMLParagraphElement) {
      previous.appendChild(image);
    } else if (next instanceof HTMLParagraphElement) {
      next.prepend(image);
    } else if (previous instanceof HTMLParagraphElement) {
      previous.appendChild(image);
    } else {
      wrapper.before(image);
    }
    wrapper.remove();
    return true;
  }

  if (wrapper) {
    wrapper.dataset.paideiaRichImageWrap = wrap;
    return true;
  }

  const paragraph = paragraphFor(image, editor);
  if (!paragraph) return false;

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(paragraph);
  beforeRange.setEndBefore(image);
  const before = beforeRange.cloneContents();
  const afterRange = document.createRange();
  afterRange.selectNodeContents(paragraph);
  afterRange.setStartAfter(image);
  const after = afterRange.cloneContents();
  const hasBefore = hasContent(before);
  const hasAfter = hasContent(after);
  const floated = document.createElement("span");
  floated.className = WRAPPER_CLASS;
  floated.dataset.paideiaRichImageWrap = wrap;
  floated.dataset.paideiaRichImagePlacement = hasBefore ? (hasAfter ? "split" : "end") : "start";
  floated.contentEditable = "false";
  floated.appendChild(image);

  if (hasBefore && hasAfter) {
    const tail = paragraph.cloneNode(false) as HTMLParagraphElement;
    tail.removeAttribute("id");
    paragraph.replaceChildren(before);
    tail.appendChild(after);
    paragraph.after(floated, tail);
  } else if (hasBefore) {
    paragraph.replaceChildren(before);
    paragraph.after(floated);
  } else {
    paragraph.replaceChildren(after);
    paragraph.before(floated);
  }
  return true;
}

export function focusPositionAfterRichInlineImage(image: HTMLImageElement, editor: HTMLElement): Range {
  const range = document.createRange();
  const wrapper = wrapperFor(image);
  const next = wrapper?.nextElementSibling;
  if (next && editor.contains(next)) {
    range.selectNodeContents(next);
    range.collapse(true);
  } else if (wrapper) {
    range.setStartAfter(wrapper);
    range.collapse(true);
  } else {
    range.setStartAfter(image);
    range.collapse(true);
  }
  return range;
}
