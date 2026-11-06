import type { Content } from "pdfmake/interfaces";
import { translateActive } from "../../i18n";
import { decodeHtmlEntities } from "./htmlMetadata";

type HtmlTextNode = { kind: "text"; value: string };
type HtmlElementNode = {
  kind: "element";
  tag: string;
  attributes: Record<string, string>;
  children: HtmlNode[];
};
type HtmlNode = HtmlTextNode | HtmlElementNode;

type PdfInline = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: "underline" | "lineThrough";
  color?: string;
  link?: string;
  fontSize?: number;
  background?: string;
};

type InlineStyle = Omit<PdfInline, "text">;

const COLORED_MARKERS: Readonly<Record<string, string>> = {
  "\u{1F534}": "#d3473c",
  "\u{1F7E0}": "#f57926",
  "\u{1F7E1}": "#f8db5a",
  "\u{1F7E2}": "#5dbe6a",
  "\u{1F535}": "#2563eb",
  "\u{1F7E3}": "#9333ea",
  "\u{1F7E4}": "#92400e",
  "\u26AB": "#111827",
  "\u26AA": "#ffffff"
};
const COLORED_MARKER_PATTERN = /(\u{1F534}|\u{1F7E0}|\u{1F7E1}|\u{1F7E2}|\u{1F535}|\u{1F7E3}|\u{1F7E4}|\u26AB|\u26AA)/u;

function supportedInlineRuns(value: string, inherited: InlineStyle): PdfInline[] {
  const runs: PdfInline[] = [];
  for (const part of value.split(COLORED_MARKER_PATTERN)) {
    const markerColor = COLORED_MARKERS[part];
    if (markerColor) {
      // U+2022 is present in the embedded PDF fonts, unlike several emoji and
      // geometric-symbol glyphs. Enlarged and colored, it remains a real
      // vector text marker in every activity without producing a tofu box.
      runs.push({ ...inherited, text: "\u2022", color: markerColor, fontSize: 16 });
      continue;
    }
    const cleaned = part
      .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
      .replace(/\uFE0F/g, "");
    if (cleaned) {
      runs.push({ text: cleaned, ...inherited });
    }
  }
  return runs;
}

export function pdfSafeInlineRuns(value: string): PdfInline[] {
  return supportedInlineRuns(value, {});
}

const VOID_TAGS = new Set(["br", "col", "hr", "img", "input", "meta", "link", "source", "track", "wbr"]);
const BLOCK_TAGS = new Set(["article", "aside", "blockquote", "center", "div", "footer", "header", "main", "nav", "p", "section"]);

type CssStyle = InlineStyle & {
  alignment?: "left" | "right" | "center" | "justify";
  backgroundColor?: string;
};

function cssColor(value: string): string | undefined {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (!normalized || normalized === "transparent" || normalized === "none") {
    return undefined;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(normalized) || /^[a-z]+$/i.test(normalized)) {
    return normalized;
  }
  const rgb = normalized.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (!rgb || (rgb[4] != null && Number(rgb[4]) === 0)) {
    return undefined;
  }
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, "0")).join("")}`;
}

function attributesFromTag(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const body = source.replace(/^<\/?\s*[a-z0-9:-]+/i, "").replace(/\/?\s*>$/, "");
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    attributes[match[1].toLocaleLowerCase("en-US")] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function parseHtml(html: string): HtmlElementNode {
  const root: HtmlElementNode = { kind: "element", tag: "root", attributes: {}, children: [] };
  const stack: HtmlElementNode[] = [root];
  const sanitized = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const tokenPattern = /<[^>]+>|[^<]+/g;
  let token: RegExpExecArray | null;

  while ((token = tokenPattern.exec(sanitized))) {
    const value = token[0];
    if (!value.startsWith("<")) {
      stack[stack.length - 1]?.children.push({ kind: "text", value: decodeHtmlEntities(value) });
      continue;
    }
    const closing = value.match(/^<\/\s*([a-z0-9:-]+)/i);
    if (closing) {
      const tag = closing[1].toLocaleLowerCase("en-US");
      const matchingIndex = stack.map((node) => node.tag).lastIndexOf(tag);
      if (matchingIndex > 0) {
        stack.splice(matchingIndex);
      }
      continue;
    }
    const opening = value.match(/^<\s*([a-z0-9:-]+)/i);
    if (!opening) {
      continue;
    }
    const tag = opening[1].toLocaleLowerCase("en-US");
    const node: HtmlElementNode = {
      kind: "element",
      tag,
      attributes: attributesFromTag(value),
      children: []
    };
    stack[stack.length - 1]?.children.push(node);
    if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(value)) {
      stack.push(node);
    }
  }
  return root;
}

function styleFromCss(style: string | undefined): CssStyle {
  const result: CssStyle = {};
  for (const declaration of style?.split(";") ?? []) {
    const [rawProperty, ...rawValue] = declaration.split(":");
    const property = rawProperty?.trim().toLocaleLowerCase("en-US");
    const value = rawValue.join(":").trim();
    if (!property || !value) {
      continue;
    }
    if (property === "color" && cssColor(value)) {
      result.color = cssColor(value);
    } else if ((property === "background" || property === "background-color") && cssColor(value)) {
      result.backgroundColor = cssColor(value);
      result.background = cssColor(value);
    } else if (property === "font-weight" && (value === "bold" || Number.parseInt(value, 10) >= 600)) {
      result.bold = true;
    } else if (property === "font-style" && value === "italic") {
      result.italics = true;
    } else if (property === "text-decoration" && value.includes("underline")) {
      result.decoration = "underline";
    } else if (property === "text-decoration" && value.includes("line-through")) {
      result.decoration = "lineThrough";
    } else if (property === "text-align" && ["center", "justify", "left", "right"].includes(value)) {
      result.alignment = value as CssStyle["alignment"];
    } else if (property === "font-size") {
      const size = Number.parseFloat(value);
      if (Number.isFinite(size)) {
        result.fontSize = Math.max(7, Math.min(36, /px$/i.test(value) ? size * 0.75 : size));
      }
    }
  }
  return result;
}

function inlineStyle(node: HtmlElementNode, inherited: InlineStyle): InlineStyle {
  const style: InlineStyle = { ...inherited, ...styleFromCss(node.attributes.style) };
  if (node.tag === "font" && node.attributes.color && cssColor(node.attributes.color)) {
    style.color = cssColor(node.attributes.color);
  }
  if (node.tag === "strong" || node.tag === "b") {
    style.bold = true;
  }
  if (node.tag === "em" || node.tag === "i") {
    style.italics = true;
  }
  if (node.tag === "u") {
    style.decoration = "underline";
  }
  if (node.tag === "s" || node.tag === "strike" || node.tag === "del") {
    style.decoration = "lineThrough";
  }
  if (node.tag === "a" && /^(?:https?:|mailto:)/i.test(node.attributes.href ?? "")) {
    style.link = node.attributes.href;
    style.color = style.color ?? "#1d4ed8";
    style.decoration = style.decoration ?? "underline";
  }
  return style;
}

function normalizeText(value: string, preserveWhitespace: boolean): string {
  return preserveWhitespace ? value : value.replace(/\s+/g, " ");
}

export type RichHtmlToPdfOptions = {
  referenceLabel?: string;
  bookmarkFallback?: string;
  ignoreFieldBackgrounds?: boolean;
};

function inlineRuns(nodes: HtmlNode[], inherited: InlineStyle = {}, preserveWhitespace = false, options: RichHtmlToPdfOptions = {}): PdfInline[] {
  const runs: PdfInline[] = [];
  for (const node of nodes) {
    if (node.kind === "text") {
      const text = normalizeText(node.value, preserveWhitespace);
      if (text) {
        runs.push(...supportedInlineRuns(text, inherited));
      }
      continue;
    }
    if (node.tag === "br") {
      runs.push({ text: "\n", ...inherited });
      continue;
    }
    if (node.tag === "img") {
      const alt = node.attributes.alt?.trim();
      if (alt) {
        runs.push({ text: `[${alt}]`, italics: true, color: "#475569" });
      }
      continue;
    }
    runs.push(...inlineRuns(
      node.children,
      inlineStyle(node, inherited),
      preserveWhitespace || node.tag === "pre" || node.tag === "code",
      options
    ));
    if (node.attributes["data-paideia-reference-id"] && node.attributes["data-paideia-bookmark-preview"]) {
      const label = node.attributes["data-paideia-bookmark-label"] || options.bookmarkFallback || translateActive("richText.bookmark");
      runs.push({
        text: ` [${options.referenceLabel ?? "Renvoi"} \u2014 ${label} : ${node.attributes["data-paideia-bookmark-preview"]}]`,
        italics: true,
        color: "#475569",
        fontSize: 8.5
      });
    }
  }
  return runs;
}

function trimmedRuns(nodes: HtmlNode[], options: RichHtmlToPdfOptions = {}): PdfInline[] {
  const runs = inlineRuns(nodes, {}, false, options);
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, "");
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, "");
  }
  return runs.filter((run) => run.text.length > 0);
}

function listItemContent(node: HtmlElementNode, options: RichHtmlToPdfOptions): Content {
  const nestedLists = node.children.filter(
    (child): child is HtmlElementNode => child.kind === "element" && (child.tag === "ul" || child.tag === "ol")
  );
  const direct = node.children.filter((child) => !nestedLists.includes(child as HtmlElementNode));
  const stack: Content[] = [];
  const text = trimmedRuns(direct, options);
  if (text.length) {
    stack.push({ text });
  }
  for (const nested of nestedLists) {
    stack.push(listContent(nested, options));
  }
  return stack.length === 1 ? stack[0] : { stack };
}

function listContent(node: HtmlElementNode, options: RichHtmlToPdfOptions): Content {
  const items = node.children
    .filter((child): child is HtmlElementNode => child.kind === "element" && child.tag === "li")
    .map((item) => listItemContent(item, options));
  const marker = node.attributes["data-paideia-list-marker"];
  if (node.tag === "ol") {
    const orderedType = ["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"].includes(marker)
      ? marker as "decimal" | "lower-alpha" | "upper-alpha" | "lower-roman" | "upper-roman"
      : "decimal";
    const start = Number.parseInt(node.attributes.start || "", 10);
    return {
      ol: items,
      type: orderedType,
      ...(Number.isFinite(start) && start > 0 ? { start } : {}),
      margin: [0, 2, 0, 6]
    };
  }
  if (["dash", "arrow", "check"].includes(marker)) {
    const markerText = marker === "dash" ? "—" : marker === "arrow" ? "→" : "✓";
    return {
      stack: items.map((item) => ({
        columns: [
          { text: markerText, width: 16 },
          { stack: [item], width: "*" }
        ],
        columnGap: 4,
        margin: [0, 0, 0, 2]
      })),
      margin: [0, 2, 0, 6]
    };
  }
  const unorderedType = ["disc", "circle", "square"].includes(marker)
    ? marker as "disc" | "circle" | "square"
    : "disc";
  return { ul: items, type: unorderedType, margin: [0, 2, 0, 6] };
}

function descendantElements(node: HtmlElementNode, tag: string): HtmlElementNode[] {
  const matches: HtmlElementNode[] = [];
  for (const child of node.children) {
    if (child.kind !== "element") {
      continue;
    }
    if (child.tag === tag) {
      matches.push(child);
    } else {
      matches.push(...descendantElements(child, tag));
    }
  }
  return matches;
}

function cellContent(node: HtmlElementNode, options: RichHtmlToPdfOptions): Content {
  const stack = nodesContent(node.children, options);
  return stack.length ? { stack } : { text: "" };
}

function compactTableTypography(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(compactTableTypography);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.fontSize === "number") {
    record.fontSize = Math.min(record.fontSize, 8.5);
  }
  Object.values(record).forEach(compactTableTypography);
}

function percentageWidth(node: HtmlElementNode): number | null {
  const match = node.attributes.style?.match(/(?:^|;)\s*width\s*:\s*([\d.]+)%/i);
  const parsed = Number.parseFloat(match?.[1] ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function directTableRows(table: HtmlElementNode): HtmlElementNode[] {
  const rows: HtmlElementNode[] = [];
  const visit = (node: HtmlElementNode): void => {
    for (const child of node.children) {
      if (child.kind !== "element") {
        continue;
      }
      if (child.tag === "tr") {
        rows.push(child);
      } else if (child.tag !== "table") {
        visit(child);
      }
    }
  };
  visit(table);
  return rows;
}

function tableContent(node: HtmlElementNode, options: RichHtmlToPdfOptions): Content {
  const rows = directTableRows(node);
  const tableClasses = new Set((node.attributes.class ?? "").split(/\s+/).filter(Boolean));
  const isPaideiaTable = tableClasses.has("paideia-rich-table");
  const isStripedTable = tableClasses.has("paideia-rich-table--striped");
  const isBorderlessTable = tableClasses.has("paideia-rich-table--borderless");
  const borderMode = node.attributes["data-paideia-table-border-mode"]
    ?? (isBorderlessTable ? "none" : "grid");
  const parsedBorderWidth = Number.parseFloat(node.attributes["data-paideia-table-border-width"] ?? "1");
  const tableBorderWidth = Number.isFinite(parsedBorderWidth)
    ? Math.min(4, Math.max(1, parsedBorderWidth))
    : 1;
  const explicitBorderColor = node.attributes.style?.match(
    /--paideia-table-border-color\s*:\s*([^;]+)/i
  )?.[1]?.trim();
  const columnCount = Math.max(1, ...rows.map((row) => row.children.filter(
    (child) => child.kind === "element" && (child.tag === "td" || child.tag === "th")
  ).reduce((count, child) => count + Math.max(1, Number.parseInt((child as HtmlElementNode).attributes.colspan ?? "1", 10) || 1), 0)));
  const compact = columnCount >= 4;
  const body: Array<Array<Record<string, unknown>>> = [];
  rows.forEach((row, rowIndex) => {
    const targetRow = body[rowIndex] ?? (body[rowIndex] = []);
    let columnIndex = 0;
    row.children
      .filter((child): child is HtmlElementNode => child.kind === "element" && (child.tag === "td" || child.tag === "th"))
      .forEach((cell) => {
        while (targetRow[columnIndex]) {
          columnIndex += 1;
        }
        const colSpan = Math.max(1, Number.parseInt(cell.attributes.colspan ?? "1", 10) || 1);
        const rowSpan = Math.max(1, Number.parseInt(cell.attributes.rowspan ?? "1", 10) || 1);
        const style = styleFromCss(cell.attributes.style);
        const content = cellContent(cell, options);
        if (compact) {
          compactTableTypography(content);
        }
        const semanticFill = cell.tag === "th"
          ? (isPaideiaTable ? "#eaf0fa" : undefined)
          : (isStripedTable && rowIndex % 2 === 1 ? "#f4f7fb" : undefined);
        const cellValue = {
          ...content as object,
          bold: cell.tag === "th" || undefined,
          alignment: style.alignment,
          color: style.color,
          fillColor: style.backgroundColor ?? semanticFill,
          colSpan,
          rowSpan,
          margin: compact ? [2, 2, 2, 2] : [5, 4, 5, 4]
        } as Record<string, unknown>;
        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
          const spanRow = body[rowIndex + rowOffset] ?? (body[rowIndex + rowOffset] = []);
          for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
            const spanColumn = columnIndex + columnOffset;
            spanRow[spanColumn] = rowOffset === 0 && columnOffset === 0 ? cellValue : {};
          }
        }
        columnIndex += colSpan;
      });
  });
  const normalizedColumnCount = Math.max(columnCount, ...body.map((row) => row.length));
  body.forEach((row) => {
    while (row.length < normalizedColumnCount) {
      row.push({});
    }
  });
  const hasBorders = (isPaideiaTable && borderMode !== "none")
    || Boolean(node.attributes.border && node.attributes.border !== "0")
    || /(?:^|;)\s*border(?:-[^:]*)?\s*:\s*(?!0|none)/i.test(node.attributes.style ?? "")
    || rows.some((row) => descendantElements(row, "td").concat(descendantElements(row, "th")).some(
      (cell) => /(?:^|;)\s*border(?:-[^:]*)?\s*:\s*(?!0|none)/i.test(cell.attributes.style ?? "")
    ));
  const firstRowCells = rows[0]?.children.filter(
    (child): child is HtmlElementNode => child.kind === "element" && (child.tag === "td" || child.tag === "th")
  ) ?? [];
  const headerRows = firstRowCells.some((cell) => cell.tag === "th")
    || (firstRowCells.length > 0 && firstRowCells.every((cell) => descendantElements(cell, "strong").length > 0))
    ? 1
    : 0;
  const columns = descendantElements(node, "col").slice(0, columnCount);
  const numericWidths = columns.map((column) => Number.parseFloat(column.attributes.width ?? ""));
  const widthTotal = numericWidths.reduce((total, width) => total + (Number.isFinite(width) ? width : 0), 0);
  const styledWidths = firstRowCells.map(percentageWidth);
  const styledTotal = styledWidths.reduce<number>((total, width) => total + (width ?? 0), 0);
  const missingStyledWidths = styledWidths.filter((width) => width == null).length;
  const completedStyledWidths = styledWidths.length === columnCount
    && missingStyledWidths <= 1
    && styledTotal > 0
    ? styledWidths.map((width) => width ?? Math.max(1, 100 - styledTotal))
    : [];
  const widths = numericWidths.length === columnCount && widthTotal > 0
    ? numericWidths.map((width) => `${Math.max(1, width / widthTotal * 100).toFixed(2)}%`)
    : completedStyledWidths.length === columnCount
      ? completedStyledWidths.map((width) => `${Math.max(1, width).toFixed(2)}%`)
    : Array.from({ length: columnCount }, () => "*");
  const hasCellBackgrounds = body.some((row) => row.some((cell) => Boolean(cell.fillColor)));
  const lineColor = explicitBorderColor || (hasCellBackgrounds ? "#ffffff" : "#94a3b8");
  const borderLayout = hasBorders || hasCellBackgrounds ? {
    hLineColor: lineColor,
    vLineColor: lineColor,
    hLineWidth: (index: number) => {
      if (borderMode === "none") return 0;
      if (borderMode === "outer") return index === 0 || index === body.length ? tableBorderWidth : 0;
      if (borderMode === "inner") return index === 0 || index === body.length ? 0 : tableBorderWidth;
      return tableBorderWidth;
    },
    vLineWidth: (index: number) => {
      if (borderMode === "none") return 0;
      if (borderMode === "outer") return index === 0 || index === normalizedColumnCount ? tableBorderWidth : 0;
      if (borderMode === "inner") return index === 0 || index === normalizedColumnCount ? 0 : tableBorderWidth;
      return tableBorderWidth;
    }
  } : "noBorders";
  const renderedTable = {
    table: {
      widths,
      body,
      headerRows,
      dontBreakRows: true,
      keepWithHeaderRows: headerRows
    },
    layout: borderLayout,
    margin: [0, 4, 0, 8]
  } as Content;
  const caption = node.children.find(
    (child): child is HtmlElementNode => child.kind === "element" && child.tag === "caption"
  );
  if (!caption) {
    return renderedTable;
  }
  return {
    stack: [
      { text: trimmedRuns(caption.children, options), bold: true, margin: [0, 0, 0, 4] },
      renderedTable
    ]
  } as Content;
}

function blockContent(node: HtmlElementNode, options: RichHtmlToPdfOptions): Content[] {
  if (node.tag === "table") {
    return directTableRows(node).length ? [tableContent(node, options)] : [];
  }
  if (node.tag === "ul" || node.tag === "ol") {
    return [listContent(node, options)];
  }
  if (node.tag === "hr") {
    return [{ canvas: [{ type: "line", x1: 0, y1: 1, x2: 515, y2: 1, lineWidth: 0.7, lineColor: "#94a3b8" }], margin: [0, 5, 0, 5] }];
  }
  const headingMatch = node.tag.match(/^h([1-6])$/);
  const text = trimmedRuns(node.children, options);
  if (headingMatch) {
    const level = Number.parseInt(headingMatch[1], 10);
    return text.length ? [{ text, bold: true, fontSize: Math.max(12, 20 - level * 1.5), margin: [0, 7, 0, 3] }] : [];
  }
  if (node.tag === "pre") {
    return text.length ? [{ text, fontSize: 9, color: "#334155", margin: [8, 4, 8, 7] }] : [];
  }
  if (BLOCK_TAGS.has(node.tag)) {
    const attributeAlignment = node.attributes.align?.toLocaleLowerCase("en-US");
    const alignment = (node.tag === "center" ? "center" : styleFromCss(node.attributes.style).alignment
      ?? (["left", "right", "center", "justify"].includes(attributeAlignment) ? attributeAlignment : undefined)) as
      "left" | "right" | "center" | "justify" | undefined;
    const nested = nodesContent(node.children, options);
    if (!nested.length) {
      return [];
    }
    const hasStructuredChild = node.children.some(isBlockNode);
    const classNames = new Set((node.attributes.class ?? "").split(/\s+/).filter(Boolean));
    const isFieldBackground = Boolean(node.attributes["data-paideia-rich-field-fill"])
      || classNames.has("paideia-rich-field-fill")
      || classNames.has("rise-native-content");
    const fieldFill = options.ignoreFieldBackgrounds && isFieldBackground
      ? undefined
      : node.attributes["data-paideia-rich-field-fill"] || styleFromCss(node.attributes.style).backgroundColor;
    if (fieldFill) {
      return [{
        table: { widths: ["*"], body: [[{ stack: nested, fillColor: fieldFill, margin: [10, 8, 10, 8] }]] },
        layout: "noBorders",
        margin: [0, 0, 0, 6]
      } as Content];
    }
    if (nested.length === 1 && text.length && !hasStructuredChild) {
      return [{ text, alignment, margin: node.tag === "blockquote" ? [12, 4, 0, 7] : [0, 0, 0, 6] }];
    }
    return [{ stack: nested, alignment, margin: node.tag === "blockquote" ? [12, 4, 0, 7] : [0, 0, 0, 6] }];
  }
  return text.length ? [{ text, margin: [0, 0, 0, 4] }] : [];
}

function isBlockNode(node: HtmlNode): node is HtmlElementNode {
  return node.kind === "element" && (
    BLOCK_TAGS.has(node.tag)
    || node.tag === "ul"
    || node.tag === "ol"
    || node.tag === "table"
    || node.tag === "hr"
    || node.tag === "pre"
    || /^h[1-6]$/.test(node.tag)
  );
}

function nodesContent(nodes: HtmlNode[], options: RichHtmlToPdfOptions): Content[] {
  const content: Content[] = [];
  let inlineNodes: HtmlNode[] = [];
  const flushInline = () => {
    const text = trimmedRuns(inlineNodes, options);
    if (text.length) {
      content.push({ text, margin: [0, 0, 0, 4] });
    }
    inlineNodes = [];
  };
  for (const node of nodes) {
    if (isBlockNode(node)) {
      flushInline();
      content.push(...blockContent(node, options));
    } else {
      inlineNodes.push(node);
    }
  }
  flushInline();
  return content;
}

export function richHtmlToPdf(html: string | null | undefined, options: RichHtmlToPdfOptions = {}): Content[] {
  if (!html?.trim()) {
    return [];
  }
  const root = parseHtml(html);
  return nodesContent(root.children, options);
}
