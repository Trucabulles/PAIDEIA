export const RICH_TEXT_LINE_LEADING_BLOCK_SELECTOR =
  "p, div, li, h1, h2, h3, h4, h5, blockquote";

const UNIT_LESS_LINE_HEIGHT = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const TYPOGRAPHIC_NBSP_BEFORE = /[;:!?»%]/;

// Length alone cannot distinguish a word from an identifier. Keep alphabetic
// words intact; allow emergency wrapping for technical identifiers and very
// long alphanumeric runs, which must never escape an authored text field.
export function isEmergencyWrapToken(token: string) {
  token = token.replace(/[.,;:!?…]+$/u, '');
  if (token.length < 24) return false;
  return /^(?:https?:\/\/|www\.)\S+$/i.test(token) ||
    /^\d+$/.test(token) ||
    /^([a-z]{1,4})\1{5,}$/i.test(token) ||
    (token.length >= 48 && /\d/.test(token) && /[a-z]/i.test(token)) ||
    /^(?=[a-z0-9_-]*\d)(?=[a-z0-9_-]*[a-z])[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(token);
}

export function normalizeEmergencyTextWrapping(root: ParentNode) {
  const doc = root.ownerDocument;
  if (!doc) return false;
  let changed = false;
  for (const marker of Array.from(root.querySelectorAll<HTMLElement>('[data-paideia-emergency-wrap]'))) {
    if (!isEmergencyWrapToken(marker.textContent || '')) {
      marker.removeAttribute('data-paideia-emergency-wrap');
      changed = true;
    }
  }
  const nodes: Text[] = [];
  const walker = doc.createTreeWalker(root, 4);
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest('[data-paideia-emergency-wrap],script,style,textarea')) continue;
    const value = node.nodeValue || '';
    const matches = [...value.matchAll(/\S+/g)].filter(match => isEmergencyWrapToken(match[0]));
    if (!matches.length) continue;
    const fragment = doc.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      fragment.append(doc.createTextNode(value.slice(offset, match.index)));
      const span = doc.createElement('span');
      span.dataset.paideiaEmergencyWrap = 'true';
      span.textContent = match[0];
      fragment.append(span);
      offset = match.index! + match[0].length;
    }
    fragment.append(doc.createTextNode(value.slice(offset)));
    node.replaceWith(fragment);
    changed = true;
  }
  return changed;
}

export function normalizeAuthoredTextBreakOpportunities(root: ParentNode) {
  const document = root.nodeType === 9 ? root as Document : root.ownerDocument;
  if (!document) return false;
  const walker = document.createTreeWalker(root, 4);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }
  const fullText = textNodes.map((node) => node.nodeValue ?? "").join("");
  let offset = 0;
  let changed = false;
  textNodes.forEach((node) => {
    const value = node.nodeValue ?? "";
    let nextValue = "";
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (character !== "\u00A0" && character !== "\u202F") {
        nextValue += character;
        continue;
      }
      const absoluteIndex = offset + index;
      const previousCharacter = fullText[absoluteIndex - 1] ?? "";
      const nextCharacter = fullText[absoluteIndex + 1] ?? "";
      const preserveTypography = previousCharacter === "«" || TYPOGRAPHIC_NBSP_BEFORE.test(nextCharacter);
      nextValue += preserveTypography ? character : " ";
      if (!preserveTypography) changed = true;
    }
    if (nextValue !== value) node.nodeValue = nextValue;
    offset += value.length;
  });
  return normalizeEmergencyTextWrapping(root) || changed;
}

export function resolveRichTextLineLeading(ratio: number, _baseLineHeight: number) {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const safeBase = Number.isFinite(_baseLineHeight) && _baseLineHeight > 0 ? _baseLineHeight : 1.5;
  // RichBar values are literal unitless CSS line heights: one line, two lines,
  // half a line, a quarter of a line. Rendering must not remap authored intent.
  const effectiveLineHeight = safeRatio;
  const responsiveLineHeight = Math.max(1, effectiveLineHeight);
  return {
    effectiveLineHeight,
    offsetEm: (safeBase - effectiveLineHeight) / 2,
    responsiveOffsetEm: (safeBase - responsiveLineHeight) / 2,
    ratio: safeRatio
  };
}

export function clearRichTextLineLeadingMetadata(block: HTMLElement) {
  block.style.removeProperty("--paideia-line-leading-base");
  block.style.removeProperty("--paideia-line-leading-effective");
  block.style.removeProperty("--paideia-line-leading-rendered");
  block.style.removeProperty("--paideia-line-leading-responsive-rendered");
  block.style.removeProperty("--paideia-line-leading-offset");
  block.style.removeProperty("--paideia-line-leading-responsive-offset");
  block.removeAttribute("data-paideia-line-leading");
  block.removeAttribute("data-paideia-line-leading-ratio");
}

function richTextLineReferenceScale(block: HTMLElement, view: Window) {
  const blockFontSize = Number.parseFloat(view.getComputedStyle(block).fontSize);
  if (!Number.isFinite(blockFontSize) || blockFontSize <= 0) return 1;

  let referenceFontSize = 0;
  const walker = block.ownerDocument.createTreeWalker(block, 4);
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    const parent = text.parentElement;
    const textBlock = parent?.closest<HTMLElement>(RICH_TEXT_LINE_LEADING_BLOCK_SELECTOR);
    if (
      parent &&
      textBlock === block &&
      text.nodeValue?.replace(/[\u200B\u00A0]/g, "").trim()
    ) {
      const fontSize = Number.parseFloat(view.getComputedStyle(parent).fontSize);
      if (Number.isFinite(fontSize) && fontSize > referenceFontSize) {
        referenceFontSize = fontSize;
      }
    }
    current = walker.nextNode();
  }

  return referenceFontSize > 0 ? referenceFontSize / blockFontSize : 1;
}

export function normalizeRichTextLineLeadingElement(
  block: HTMLElement,
  view: Window = window
) {
  const inlineLineHeight = block.style.lineHeight.trim();
  const storedRatio = block.getAttribute("data-paideia-line-leading-ratio")?.trim() ?? "";
  const authoredValue = UNIT_LESS_LINE_HEIGHT.test(inlineLineHeight)
    ? inlineLineHeight
    : UNIT_LESS_LINE_HEIGHT.test(storedRatio)
      ? storedRatio
      : "";
  if (!authoredValue) return false;

  const ratio = Number.parseFloat(authoredValue);
  if (!Number.isFinite(ratio) || ratio <= 0) return false;

  let baseLineHeight = Number.parseFloat(
    block.style.getPropertyValue("--paideia-line-leading-base")
  );
  if (!Number.isFinite(baseLineHeight) || baseLineHeight <= 0) {
    const previousLineHeight = block.style.lineHeight;
    const previousLeading = block.getAttribute("data-paideia-line-leading");
    block.style.removeProperty("line-height");
    block.removeAttribute("data-paideia-line-leading");
    const computedStyle = view.getComputedStyle(block);
    const computedFontSize = Number.parseFloat(computedStyle.fontSize);
    const computedLineHeight = Number.parseFloat(computedStyle.lineHeight);
    baseLineHeight = computedFontSize > 0 && Number.isFinite(computedLineHeight)
      ? computedLineHeight / computedFontSize
      : 1.5;
    if (previousLineHeight) block.style.lineHeight = previousLineHeight;
    if (previousLeading !== null) block.setAttribute("data-paideia-line-leading", previousLeading);
  }

  const resolved = resolveRichTextLineLeading(ratio, baseLineHeight);
  // A block can inherit a large font size from an old inline wrapper while
  // its actual text carries a smaller local size. Base the line box on the
  // largest font really used by this block-line, not on that inherited shell.
  const referenceScale = richTextLineReferenceScale(block, view);
  const renderedLineHeightEm = resolved.effectiveLineHeight * referenceScale;
  const responsiveRenderedLineHeightEm = Math.max(1, resolved.effectiveLineHeight) * referenceScale;
  block.style.setProperty("--paideia-line-leading-base", `${baseLineHeight}`);
  block.style.setProperty("--paideia-line-leading-effective", `${resolved.effectiveLineHeight}`);
  block.style.setProperty("--paideia-line-leading-rendered", `${renderedLineHeightEm}em`);
  block.style.setProperty("--paideia-line-leading-responsive-rendered", `${responsiveRenderedLineHeightEm}em`);
  block.style.setProperty(
    "--paideia-line-leading-offset",
    `${((baseLineHeight - resolved.effectiveLineHeight) * referenceScale) / 2}em`
  );
  block.style.setProperty(
    "--paideia-line-leading-responsive-offset",
    `${((baseLineHeight - Math.max(1, resolved.effectiveLineHeight)) * referenceScale) / 2}em`
  );
  block.setAttribute("data-paideia-line-leading", "true");
  block.setAttribute("data-paideia-line-leading-ratio", `${resolved.ratio}`);
  return true;
}

export function normalizeRichTextLineLeading(
  root: ParentNode,
  view: Window = window
) {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(RICH_TEXT_LINE_LEADING_BLOCK_SELECTOR)
  );
  if (root instanceof HTMLElement && root.matches(RICH_TEXT_LINE_LEADING_BLOCK_SELECTOR)) {
    candidates.unshift(root);
  }
  candidates.forEach((block) => normalizeRichTextLineLeadingElement(block, view));
}
