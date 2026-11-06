import type { PaideiaProject } from "../../types/project";
import { translateActive } from "../../i18n";

export const RICH_BOOKMARK_ATTR = "data-paideia-bookmark-id";
export const RICH_REFERENCE_ATTR = "data-paideia-reference-id";
export const RICH_REFERENCE_TARGET_ATTR = "data-paideia-bookmark-target";
export const RICH_FIELD_FILL_ATTR = "data-paideia-rich-field-fill";
export const RICH_FIELD_FILL_OPACITY_ATTR = "data-paideia-rich-field-fill-opacity";
export const DEFAULT_RICH_FIELD_FILL_OPACITY = 50;

export type RichTextBookmarkOption = {
  id: string;
  label: string;
  excerpt: string;
  html: string;
  chapterTitle: string;
  blockTitle: string;
  sourceType?: "lesson" | "reference-bank";
  bankId?: string;
  entryId?: string;
  definitionHtml?: string;
};

export function normalizeReferenceTerm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/((?:\p{L}\.)+\p{L})\.(?=\s*$)/gu, "$1")
    .replace(/(?<=\p{L})\.(?=\p{L})/gu, "")
    .replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function parseHtml(value: string) {
  const document = new DOMParser().parseFromString(`<body>${value || ""}</body>`, "text/html");
  return document.body;
}

export function collectRichTextBookmarks(project: PaideiaProject | null | undefined): RichTextBookmarkOption[] {
  if (!project) return [];
  const result: RichTextBookmarkOption[] = [];
  const seen = new Set<string>();
  for (const module of project.course.modules) {
    for (const chapter of module.chapters) {
      for (const page of chapter.pages) {
        for (const block of page.blocks) {
          const root = parseHtml(block.contentHtml ?? "");
          root.querySelectorAll<HTMLElement>(`[${RICH_BOOKMARK_ATTR}]`).forEach((node) => {
            const id = node.getAttribute(RICH_BOOKMARK_ATTR)?.trim() ?? "";
            if (!id || seen.has(id)) return;
            seen.add(id);
            const excerpt = (node.textContent ?? "").replace(/\s+/g, " ").trim();
            result.push({
              id,
              label: node.getAttribute("data-paideia-bookmark-label")?.trim() || excerpt.slice(0, 80) || translateActive("richText.bookmark"),
              excerpt,
              html: node.innerHTML,
              chapterTitle: chapter.title,
              blockTitle: block.title
            });
          });
        }
      }
    }
  }
  for (const bank of project.referenceBanks ?? []) {
    for (const entry of bank.entries) {
      const text = parseHtml(entry.definitionHtml).textContent?.replace(/\s+/g, " ").trim() ?? "";
      result.push({
        id: `reference-bank:${bank.id}:${entry.id}`,
        label: entry.term,
        excerpt: text,
        html: entry.definitionHtml,
        chapterTitle: bank.name,
        blockTitle: bank.name,
        sourceType: "reference-bank",
        bankId: bank.id,
        entryId: entry.id,
        definitionHtml: entry.definitionHtml
      });
    }
  }
  return result;
}

export function collectRichTextBookmarksFromEditor(editor: HTMLElement | null): RichTextBookmarkOption[] {
  if (!editor) return [];
  return Array.from(editor.querySelectorAll<HTMLElement>(`[${RICH_BOOKMARK_ATTR}]`)).map((node) => {
    const excerpt = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    return {
      id: node.getAttribute(RICH_BOOKMARK_ATTR)?.trim() ?? "",
      label: node.getAttribute("data-paideia-bookmark-label")?.trim() || excerpt.slice(0, 80) || translateActive("richText.bookmark"),
      excerpt,
      html: node.innerHTML,
      chapterTitle: translateActive("richText.currentField"),
      blockTitle: ""
    };
  }).filter((item) => Boolean(item.id));
}

export function nextRichTextMarkerId(prefix: "bookmark" | "reference") {
  const uuid = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function closestElement(node: Node | null) {
  return node?.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node?.parentElement ?? null;
}

export function validRichTextMarkerRange(editor: HTMLElement, range: Range | null) {
  if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer) || !range.toString().trim()) return false;
  const startBlock = closestElement(range.startContainer)?.closest("p,li,h1,h2,h3,h4,h5,blockquote,div");
  const endBlock = closestElement(range.endContainer)?.closest("p,li,h1,h2,h3,h4,h5,blockquote,div");
  if (!startBlock || startBlock !== endBlock) return false;
  const fragment = range.cloneContents();
  return !fragment.querySelector(`img,table,[${RICH_BOOKMARK_ATTR}],[${RICH_REFERENCE_ATTR}]`);
}

export function insertRichTextBookmark(editor: HTMLElement, range: Range, label: string) {
  const span = document.createElement("span");
  span.setAttribute(RICH_BOOKMARK_ATTR, nextRichTextMarkerId("bookmark"));
  span.setAttribute("data-paideia-bookmark-label", label.trim() || range.toString().trim().slice(0, 80));
  span.className = "paideia-rich-bookmark";
  span.appendChild(range.extractContents());
  range.insertNode(span);
  return span;
}

export function insertRichTextReference(
  editor: HTMLElement,
  range: Range,
  bookmarkId: string,
  bookmarkLabel?: string,
  bookmarkPreview?: string,
  resource?: { bankId: string; entryId: string; definitionHtml: string }
) {
  const span = document.createElement("span");
  span.setAttribute(RICH_REFERENCE_ATTR, nextRichTextMarkerId("reference"));
  span.setAttribute(RICH_REFERENCE_TARGET_ATTR, bookmarkId);
  if (bookmarkLabel) span.setAttribute("data-paideia-bookmark-label", bookmarkLabel);
  if (bookmarkPreview) span.setAttribute("data-paideia-bookmark-preview", bookmarkPreview);
  if (resource) {
    span.setAttribute("data-paideia-reference-bank-id", resource.bankId);
    span.setAttribute("data-paideia-reference-entry-id", resource.entryId);
    span.setAttribute("data-paideia-reference-definition", resource.definitionHtml);
  }
  span.setAttribute("role", "button");
  span.setAttribute("tabindex", "0");
  span.className = "paideia-rich-reference";
  span.appendChild(range.extractContents());
  range.insertNode(span);
  return span;
}

export function richFieldFillColor(editor: HTMLElement) {
  const wrapper = editor.querySelector<HTMLElement>(`:scope > [${RICH_FIELD_FILL_ATTR}]`);
  return wrapper?.getAttribute(RICH_FIELD_FILL_ATTR) || "transparent";
}

export function richFieldFillOpacity(editor: HTMLElement) {
  const wrapper = editor.querySelector<HTMLElement>(`:scope > [${RICH_FIELD_FILL_ATTR}]`);
  const stored = Number(wrapper?.getAttribute(RICH_FIELD_FILL_OPACITY_ATTR));
  return Number.isFinite(stored) ? clampRichFieldFillOpacity(stored) : DEFAULT_RICH_FIELD_FILL_OPACITY;
}

export function applyRichFieldFill(editor: HTMLElement, color: string, opacity = richFieldFillOpacity(editor)) {
  let wrapper = editor.querySelector<HTMLElement>(`:scope > [${RICH_FIELD_FILL_ATTR}]`);
  if (!color || color === "transparent") {
    if (wrapper) {
      while (wrapper.firstChild) editor.insertBefore(wrapper.firstChild, wrapper);
      wrapper.remove();
    }
    return;
  }
  if (!wrapper) {
    wrapper = document.createElement("div");
    while (editor.firstChild) wrapper.appendChild(editor.firstChild);
    editor.appendChild(wrapper);
  }
  wrapper.classList.add("paideia-rich-field-fill");
  wrapper.setAttribute(RICH_FIELD_FILL_ATTR, color);
  applyRichFieldFillPresentation(wrapper, color, opacity);
}

export function applyRichFieldFillOpacity(editor: HTMLElement, opacity: number) {
  const wrapper = editor.querySelector<HTMLElement>(`:scope > [${RICH_FIELD_FILL_ATTR}]`);
  if (!wrapper) return;
  const color = wrapper.getAttribute(RICH_FIELD_FILL_ATTR) || "transparent";
  applyRichFieldFillPresentation(wrapper, color, opacity);
}

function applyRichFieldFillPresentation(wrapper: HTMLElement, color: string, opacity: number) {
  const normalizedOpacity = clampRichFieldFillOpacity(opacity);
  wrapper.setAttribute(RICH_FIELD_FILL_OPACITY_ATTR, String(normalizedOpacity));
  wrapper.style.backgroundColor = colorWithOpacity(color, normalizedOpacity);
  wrapper.style.color = normalizedOpacity === 0 ? "" : contrastingInheritedTextColor(color);
}

function clampRichFieldFillOpacity(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function colorWithOpacity(color: string, opacity: number) {
  const alpha = clampRichFieldFillOpacity(opacity) / 100;
  const normalized = color.trim();
  const hex = normalized.replace(/^#/, "");
  const expanded = hex.length === 3 ? hex.split("").map((part) => `${part}${part}`).join("") : hex;
  if (/^[0-9a-f]{6}$/i.test(expanded)) {
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return `color-mix(in srgb, ${normalized} ${clampRichFieldFillOpacity(opacity)}%, transparent)`;
}

function contrastingInheritedTextColor(color: string) {
  const normalized = color.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return "#222222";
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance < 0.5 ? "#ffffff" : "#222222";
}

function richTextMarkerFromRangePoint(
  editor: HTMLElement,
  node: Node,
  offset: number,
  attribute: string
) {
  let candidate: Node = node;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    const childIndex = Math.max(0, Math.min(offset, element.childNodes.length));
    candidate = element.childNodes[childIndex] ?? element.childNodes[childIndex - 1] ?? element;
  }

  const element = candidate.nodeType === Node.ELEMENT_NODE
    ? candidate as HTMLElement
    : candidate.parentElement;
  const marker = element?.closest<HTMLElement>(`[${attribute}]`) ?? null;
  return marker && editor.contains(marker) ? marker : null;
}

function richTextMarkerForRange(editor: HTMLElement, range: Range | null, attribute: string) {
  if (!range || !editor.contains(range.commonAncestorContainer)) return null;
  const startMarker = richTextMarkerFromRangePoint(editor, range.startContainer, range.startOffset, attribute);
  const endMarker = richTextMarkerFromRangePoint(editor, range.endContainer, range.endOffset, attribute);
  return startMarker && startMarker === endMarker ? startMarker : null;
}

export function richTextBookmarkForRange(editor: HTMLElement, range: Range | null) {
  return richTextMarkerForRange(editor, range, RICH_BOOKMARK_ATTR);
}

export function richTextReferenceForRange(editor: HTMLElement, range: Range | null) {
  return richTextMarkerForRange(editor, range, RICH_REFERENCE_ATTR);
}

export function richTextReferencesInRange(editor: HTMLElement, range: Range | null): HTMLElement[] {
  if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) return [];
  const start = range.cloneRange();
  start.collapse(true);
  const end = range.cloneRange();
  end.collapse(false);
  return Array.from(editor.querySelectorAll<HTMLElement>(`[${RICH_REFERENCE_ATTR}]`)).filter((marker) => {
    const markerStart = editor.ownerDocument.createRange();
    markerStart.selectNode(marker);
    const markerEnd = markerStart.cloneRange();
    markerStart.collapse(true);
    markerEnd.collapse(false);
    // Strict overlap: an adjacent marker merely touching a boundary is not
    // removed. Partial selections inside a marker remove that whole marker.
    return start.compareBoundaryPoints(Range.START_TO_START, markerEnd) < 0
      && end.compareBoundaryPoints(Range.START_TO_START, markerStart) > 0;
  });
}

export function unwrapRichTextMarker(marker: HTMLElement) {
  const parent = marker.parentNode;
  if (!parent) return;
  while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
  marker.remove();
}

export function removeRichTextReferencesToBookmark(root: HTMLElement, bookmarkId: string) {
  if (!bookmarkId) return 0;
  const references = Array.from(
    root.querySelectorAll<HTMLElement>(`[${RICH_REFERENCE_TARGET_ATTR}]`)
  ).filter((node) => node.getAttribute(RICH_REFERENCE_TARGET_ATTR) === bookmarkId);
  references.forEach(unwrapRichTextMarker);
  return references.length;
}
