import type { ActivityItem } from "../../../types/project";

// Present legacy separate titles inside the composition. Storage is converted
// only when the author edits it, so opening a lesson never rewrites its data.
export function tabsCompositionHtml(item: Pick<ActivityItem, "contentTitle" | "contentHtml">): string {
  const title = item.contentTitle?.trim() ?? "";
  const hasTitle = Boolean(title.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim());
  return `${hasTitle ? `<h3>${title}</h3>` : ""}${item.contentHtml ?? ""}`;
}
