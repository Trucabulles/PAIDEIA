export const RICH_TEXT_DROP_CAP_ATTRIBUTE = "data-paideia-drop-cap";
export const RICH_TEXT_DROP_CAP_CLASS = "paideia-rich-drop-cap";

type DropCapTarget = {
  grapheme: string;
  index: number;
  node: Text;
};

function firstGrapheme(value: string) {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (locale?: string | string[], options?: { granularity: "grapheme" }) => {
      segment(input: string): Iterable<{ segment: string }>;
    };
  }).Segmenter;
  if (Segmenter) {
    const segment = new Segmenter(undefined, { granularity: "grapheme" }).segment(value)[Symbol.iterator]().next();
    if (!segment.done) return segment.value.segment;
  }
  return Array.from(value)[0] ?? "";
}

function firstDropCapTarget(paragraph: HTMLParagraphElement): DropCapTarget | null {
  const blockedTags = new Set(["BR", "HR", "IMG", "TABLE", "VIDEO", "AUDIO", "IFRAME", "CANVAS", "SVG"]);
  const visit = (node: Node): DropCapTarget | "blocked" | null => {
    if (node instanceof Text) {
      const index = node.data.search(/\S/u);
      if (index < 0) return null;
      const grapheme = firstGrapheme(node.data.slice(index));
      return grapheme ? { grapheme, index, node } : null;
    }
    if (!(node instanceof Element)) return null;
    if (blockedTags.has(node.tagName) || node.getAttribute("contenteditable") === "false") return "blocked";
    for (const child of Array.from(node.childNodes)) {
      const result = visit(child);
      if (result) return result;
    }
    return null;
  };

  for (const child of Array.from(paragraph.childNodes)) {
    const result = visit(child);
    if (result === "blocked") return null;
    if (result) return result;
  }
  return null;
}

function unwrapIfNeutral(span: HTMLSpanElement) {
  if (span.attributes.length === 0) span.replaceWith(...Array.from(span.childNodes));
}

export function removeRichTextDropCap(
  paragraph: HTMLElement,
  options: { preserveMarkerWrapper?: boolean } = {}
) {
  paragraph.removeAttribute(RICH_TEXT_DROP_CAP_ATTRIBUTE);
  paragraph.querySelectorAll<HTMLSpanElement>(`.${RICH_TEXT_DROP_CAP_CLASS}`).forEach((span) => {
    span.classList.remove(RICH_TEXT_DROP_CAP_CLASS);
    if (!span.className.trim()) span.removeAttribute("class");
    // Keep a live eraser selection anchored to the character. The neutral
    // wrapper is unwrapped by the eraser after removeFormat has completed.
    if (!options.preserveMarkerWrapper) unwrapIfNeutral(span);
  });
}

function markerTemplate(paragraph: HTMLParagraphElement) {
  const existing = paragraph.querySelector<HTMLSpanElement>(`.${RICH_TEXT_DROP_CAP_CLASS}`);
  if (!existing) return paragraph.ownerDocument.createElement("span");
  const template = existing.cloneNode(false) as HTMLSpanElement;
  removeRichTextDropCap(paragraph);
  return template;
}

function installRichTextDropCap(paragraph: HTMLParagraphElement, template?: HTMLSpanElement) {
  const target = firstDropCapTarget(paragraph);
  if (!target) {
    removeRichTextDropCap(paragraph);
    return null;
  }

  let characterNode = target.node;
  if (target.index > 0) characterNode = characterNode.splitText(target.index);
  if (target.grapheme.length < characterNode.data.length) characterNode.splitText(target.grapheme.length);

  const marker = template ?? paragraph.ownerDocument.createElement("span");
  marker.classList.add(RICH_TEXT_DROP_CAP_CLASS);
  characterNode.before(marker);
  marker.append(characterNode);
  paragraph.setAttribute(RICH_TEXT_DROP_CAP_ATTRIBUTE, "true");
  return marker;
}

export function richTextDropCapParagraphForRange(editor: HTMLElement, range: Range) {
  const paragraphFor = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement;
    const paragraph = element?.closest("p");
    return paragraph instanceof HTMLParagraphElement && editor.contains(paragraph) ? paragraph : null;
  };
  const start = paragraphFor(range.startContainer);
  const end = paragraphFor(range.endContainer);
  return start && start === end ? start : null;
}

export function richTextDropCapState(editor: HTMLElement, range: Range) {
  const paragraph = richTextDropCapParagraphForRange(editor, range);
  const marker = paragraph?.querySelector<HTMLSpanElement>(`.${RICH_TEXT_DROP_CAP_CLASS}`) ?? null;
  const rangeElement = (node: Node) => node instanceof Element ? node : node.parentElement;
  const touchesMarker = Boolean(marker && (
    marker.contains(range.startContainer) ||
    marker.contains(range.endContainer) ||
    (!range.collapsed && typeof range.intersectsNode === "function" && range.intersectsNode(marker)) ||
    rangeElement(range.startContainer)?.closest(`.${RICH_TEXT_DROP_CAP_CLASS}`) === marker
  ));
  return {
    active: Boolean(paragraph?.getAttribute(RICH_TEXT_DROP_CAP_ATTRIBUTE) === "true"),
    canToggle: Boolean(paragraph && firstDropCapTarget(paragraph)),
    characterSelected: touchesMarker,
    paragraph
  };
}

export function toggleRichTextDropCap(editor: HTMLElement, range: Range) {
  const state = richTextDropCapState(editor, range);
  if (!state.paragraph || !state.canToggle) return null;
  if (state.active) {
    removeRichTextDropCap(state.paragraph);
    return { active: false, marker: null as HTMLSpanElement | null, paragraph: state.paragraph };
  }
  const marker = installRichTextDropCap(state.paragraph);
  return marker ? { active: true, marker, paragraph: state.paragraph } : null;
}

export function normalizeRichTextDropCaps(root: ParentNode) {
  let normalized = 0;
  root.querySelectorAll<HTMLElement>(`.${RICH_TEXT_DROP_CAP_CLASS}`).forEach((marker) => {
    const paragraph = marker.closest("p");
    if (paragraph) paragraph.setAttribute(RICH_TEXT_DROP_CAP_ATTRIBUTE, "true");
    else {
      marker.classList.remove(RICH_TEXT_DROP_CAP_CLASS);
      if (!marker.className.trim()) marker.removeAttribute("class");
      if (marker instanceof HTMLSpanElement) unwrapIfNeutral(marker);
      normalized += 1;
    }
  });

  root.querySelectorAll<HTMLParagraphElement>(`p[${RICH_TEXT_DROP_CAP_ATTRIBUTE}="true"]`).forEach((paragraph) => {
    const target = firstDropCapTarget(paragraph);
    const marker = paragraph.querySelector<HTMLSpanElement>(`.${RICH_TEXT_DROP_CAP_CLASS}`);
    const isCanonical = Boolean(
      target && marker && marker.contains(target.node) && marker.textContent === target.grapheme
    );
    if (isCanonical) return;
    const template = markerTemplate(paragraph);
    if (installRichTextDropCap(paragraph, template)) normalized += 1;
  });
  return normalized;
}
