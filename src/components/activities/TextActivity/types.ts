import type { CSSProperties, ReactNode } from "react";

export type TextActivityProps = {
  contentHtml: string;
  displayTitle: string;
  displaySummary: string;
  style?: CSSProperties;
  renderRichContent?: (html: string, className?: string) => ReactNode;
};
