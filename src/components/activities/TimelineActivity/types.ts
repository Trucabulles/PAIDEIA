import type { CSSProperties, ReactNode } from "react";
import type { ActivityItem, PaideiaBlock } from "../../../types/project";
import type { RichTextToolbarProfile } from "../../rich-text-toolbar/RichTextToolbar";

export type TimelineInlineField = "dateLabel" | "title" | "contentHtml";

export type TimelineItemFieldRenderer = (
  block: PaideiaBlock,
  item: ActivityItem,
  field: TimelineInlineField,
  html: string,
  className: string,
  profile: RichTextToolbarProfile
) => ReactNode;

export type TimelineActivityProps = {
  block: PaideiaBlock;
  displayTitle: string;
  displaySummary: string;
  items: ActivityItem[];
  normalizeHtml: (html: string) => string;
  renderItemField?: TimelineItemFieldRenderer;
  onItemAdd?: (block: PaideiaBlock) => void;
};

export type TimelineActivityEditorProps = {
  color: string;
  onColorChange: (value: string) => void;
};

export type TimelineItemEditorProps = {
  color: string;
  onColorChange: (value: string) => void;
};

export type TimelineCssProperties = CSSProperties & {
  "--timeline-accent"?: string;
  "--timeline-item-accent"?: string;
};
