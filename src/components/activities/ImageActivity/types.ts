import type { CSSProperties, ReactNode } from "react";

export type ImageActivityProps = {
  contentAlign: CSSProperties["textAlign"];
  contentNode: ReactNode;
  displayTitle: string;
  imageNode: ReactNode;
  layout: string;
  style?: CSSProperties;
};
