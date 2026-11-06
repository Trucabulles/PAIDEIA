import { compactRichTextSpans } from "./richTextNormalization";
import { normalizeRichTextDropCaps } from "./richTextDropCap";
import { normalizeRichTextAlignmentOwners } from "./richTextAlignment";

const RICH_TEXT_TAGS = new Set([
  "a", "b", "blockquote", "br", "caption", "center", "code", "col", "colgroup",
  "div", "em", "font", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
  "li", "mark", "ol", "p", "pre", "s", "span", "strike", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul"
]);

const DROP_WITH_CONTENT = new Set([
  "applet", "audio", "base", "button", "canvas", "embed", "form", "iframe", "input",
  "link", "math", "meta", "object", "script", "select", "style", "svg", "template",
  "textarea", "video"
]);

const RICH_INLINE_IMAGE_SAFE_FORMATTING_TAGS = new Set([
  "b", "big", "em", "font", "i", "mark", "s", "small", "span", "strike",
  "strong", "sub", "sup", "u"
]);

const GENERIC_ATTRIBUTES = new Set([
  "class", "contenteditable", "dir", "lang", "role", "style", "tabindex", "title",
  "data-rich-original-text"
]);

const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "title"]),
  img: new Set(["src", "alt", "width", "height", "title"]),
  ol: new Set(["start", "type", "reversed"]),
  li: new Set(["value"]),
  col: new Set(["span", "width"]),
  colgroup: new Set(["span", "width"]),
  td: new Set(["colspan", "rowspan", "headers"]),
  th: new Set(["colspan", "rowspan", "headers", "scope"]),
  font: new Set(["color", "face", "size"])
};

const SAFE_STYLE_PROPERTIES = new Set([
  "--paideia-table-custom-width", "--paideia-table-custom-offset", "--paideia-table-border-width",
  "-webkit-text-stroke", "-webkit-text-stroke-color", "-webkit-text-stroke-width",
  "--paideia-rich-outline-color", "--paideia-table-border-color", "--paideia-line-leading-base", "--paideia-line-leading-effective", "--paideia-line-leading-rendered", "--paideia-line-leading-responsive-rendered", "--paideia-line-leading-offset", "--paideia-line-leading-responsive-offset", "--paideia-list-marker-color",
  "--paideia-list-marker-size", "--paideia-list-marker-weight", "background", "background-color", "border", "border-bottom",
  "border-bottom-color", "border-bottom-style", "border-bottom-width", "border-collapse",
  "border-color", "border-left", "border-left-color", "border-left-style", "border-left-width",
  "border-radius", "border-right", "border-right-color", "border-right-style",
  "border-right-width", "border-style", "border-top", "border-top-color", "border-top-style",
  "border-top-width", "border-width", "color", "font-family", "font-size", "font-style",
  "font-weight", "height", "line-height", "margin", "margin-block", "margin-block-end",
  "margin-block-start", "margin-bottom", "margin-inline-start", "margin-left", "margin-right",
  "margin-top", "opacity", "padding", "padding-bottom", "padding-left", "padding-right",
  "padding-top", "paint-order", "text-align", "text-decoration", "text-decoration-color",
  "text-decoration-line", "text-decoration-style", "vertical-align", "width"
]);

function isAllowedHttpLink(value: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeStyle(element: HTMLElement) {
  const properties = Array.from(element.style);
  properties.forEach((property) => {
    const value = element.style.getPropertyValue(property);
    if (
      !SAFE_STYLE_PROPERTIES.has(property.toLowerCase()) ||
      /url\s*\(|@import|expression\s*\(/i.test(value)
    ) {
      element.style.removeProperty(property);
    }
  });
  if (!element.getAttribute("style")?.trim()) {
    element.removeAttribute("style");
  }
}

/**
 * Imported or pasted HTML can leave a managed image inside typographic markup,
 * for example `<strong><span><img>Text</span></strong>`. Hoist only through
 * formatting elements so the image regains PAIDEIA's direct paragraph-child
 * contract while the surrounding text keeps every authored style.
 *
 * Functional containers such as links are intentionally left untouched.
 */
export function normalizeRichInlineImageFormatting(root: ParentNode) {
  let normalized = 0;
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img.rich-inline-image"));
  for (const image of images) {
    if (image.closest(".paideia-rich-image-float")) continue;
    const paragraph = image.closest("p");
    if (!paragraph || image.parentElement === paragraph) continue;

    const formattingAncestors: HTMLElement[] = [];
    let parent = image.parentElement;
    while (parent && parent !== paragraph) {
      if (!RICH_INLINE_IMAGE_SAFE_FORMATTING_TAGS.has(parent.tagName.toLowerCase())) {
        formattingAncestors.length = 0;
        break;
      }
      formattingAncestors.push(parent);
      parent = parent.parentElement;
    }
    if (parent !== paragraph || !formattingAncestors.length) continue;

    for (const formatting of formattingAncestors) {
      const before = formatting.cloneNode(false) as HTMLElement;
      const after = formatting.cloneNode(false) as HTMLElement;
      while (formatting.firstChild && formatting.firstChild !== image) {
        before.append(formatting.firstChild);
      }
      while (image.nextSibling) {
        after.append(image.nextSibling);
      }
      if (before.hasChildNodes()) formatting.before(before);
      formatting.before(image);
      if (after.hasChildNodes()) formatting.before(after);
      formatting.remove();
    }
    normalized += 1;
  }
  return normalized;
}

export function normalizeRichInlineImageFormattingHtml(html: string) {
  if (!html || !/rich-inline-image/i.test(html)) return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  normalizeRichInlineImageFormatting(template.content);
  return template.innerHTML;
}

export function sanitizeRichTextHtml(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html || "<p></p>";

  Array.from(template.content.querySelectorAll("*")).forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) {
      element.remove();
      return;
    }
    if (!RICH_TEXT_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const isAllowed =
        GENERIC_ATTRIBUTES.has(name) ||
        name.startsWith("aria-") ||
        name.startsWith("data-paideia-") ||
        TAG_ATTRIBUTES[tag]?.has(name);
      if (!isAllowed || name.startsWith("on") || name === "srcdoc") {
        element.removeAttribute(attribute.name);
      }
    });

    if (element instanceof HTMLAnchorElement) {
      const href = element.getAttribute("href");
      if (!href || !isAllowedHttpLink(href)) {
        element.removeAttribute("href");
      }
    }
    if (element instanceof HTMLElement && element.hasAttribute("style")) {
      sanitizeStyle(element);
    }
    if (element.getAttribute("contenteditable")?.toLowerCase() !== "false") {
      element.removeAttribute("contenteditable");
    }
  });

  normalizeRichInlineImageFormatting(template.content);
  normalizeRichTextDropCaps(template.content);
  normalizeRichTextAlignmentOwners(template.content);
  compactRichTextSpans(template.content);
  return template.innerHTML || "<p></p>";
}

const PASTED_BLOCK_TAGS = new Set([
  "BLOCKQUOTE", "CENTER", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "HR",
  "OL", "P", "PRE", "TABLE", "UL"
]);

function isPaideiaClipboardClass(value: string) {
  return value.split(/\s+/).filter(Boolean).every((name) =>
    name.startsWith("paideia-") || name === "rich-inline-image"
  );
}

/**
 * Converts arbitrary office/browser clipboard HTML into a stable Rich Text
 * fragment. Foreign classes and editor-only attributes must not influence the
 * WebView contenteditable engine after insertion. Root inline runs are wrapped
 * in paragraphs so Enter and cross-paragraph formatting retain real blocks.
 */
export function normalizePastedRichTextHtml(html: string) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichTextHtml(html);

  Array.from(template.content.querySelectorAll<HTMLElement>("*")).forEach((element) => {
    const className = element.getAttribute("class");
    if (className && !isPaideiaClipboardClass(className)) element.removeAttribute("class");
    if (element.getAttribute("dir")?.toLowerCase() === "auto") element.removeAttribute("dir");
  });

  const normalized = document.createDocumentFragment();
  let paragraph: HTMLParagraphElement | null = null;
  const flushParagraph = () => {
    if (!paragraph) return;
    if (!paragraph.hasChildNodes()) paragraph.append(document.createElement("br"));
    normalized.append(paragraph);
    paragraph = null;
  };

  for (const node of Array.from(template.content.childNodes)) {
    const isBlock = node instanceof Element && PASTED_BLOCK_TAGS.has(node.tagName);
    if (isBlock) {
      flushParagraph();
      normalized.append(node);
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
    paragraph ??= document.createElement("p");
    paragraph.append(node);
  }
  flushParagraph();
  template.content.replaceChildren(normalized);

  for (const span of Array.from(template.content.querySelectorAll("span"))) {
    if (!span.attributes.length) span.replaceWith(...Array.from(span.childNodes));
  }
  compactRichTextSpans(template.content);
  return template.innerHTML || "<p></p>";
}
