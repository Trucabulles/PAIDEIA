import { decode } from "html-entities";

export function decodeHtmlEntities(value: string): string {
  return decode(value, { level: "all", scope: "body" });
}
