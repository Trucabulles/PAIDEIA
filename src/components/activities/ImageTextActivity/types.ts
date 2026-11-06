import type { CSSProperties, ReactNode } from "react";

export type ImageTextActivityProps = {
  contentAlign: CSSProperties["textAlign"];
  contentNode: ReactNode;
  displayTitle: string;
  imageNode: ReactNode;
  layout: string;
  contentWidth?: string | null;
  imageSize?: number;
  mediaGap?: string | null;
  verticalAlign?: string | null;
  contentTextColor?: string;
};
