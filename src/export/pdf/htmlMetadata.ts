import { decodeHtmlEntities } from "../../lib/htmlEntities";
export { decodeHtmlEntities } from "../../lib/htmlEntities";

function metaAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const source = tag.replace(/^<meta\b/i, "").replace(/\/?\s*>$/, "");
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(source))) {
    attributes[match[1].toLocaleLowerCase("en-US")] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

export function extractHtmlMetaDescription(html: string | null | undefined): string | null {
  if (!html?.trim()) {
    return null;
  }

  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const attributes = metaAttributes(tag);
    if (attributes.name?.toLocaleLowerCase("en-US") !== "description") {
      continue;
    }
    const description = decodeHtmlEntities(attributes.content ?? "").replace(/\s+/g, " ").trim();
    if (description) {
      return description;
    }
  }
  return null;
}
