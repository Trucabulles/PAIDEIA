import type { ActivityItem, PaideiaBlock } from "../../../types/project";
import type { ReactNode } from "react";

export type AccordionActivityProps = {
  block: PaideiaBlock;
  displaySummary: string;
  displayTitle: string;
  getItemImageUrl: (item: ActivityItem) => string | null;
  items: ActivityItem[];
  onImageOpen?: (src: string, alt: string) => void;
  renderItemContent?: (item: ActivityItem) => ReactNode;
  renderItemTitle?: (item: ActivityItem, onFinish: () => void) => ReactNode;
  onBeforePanelToggle?: () => void;
  onOpenIdsChange: (updater: (current: string[]) => string[]) => void;
  openIds: string[];
};
