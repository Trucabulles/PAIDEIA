import type { CSSProperties, ReactNode } from "react";
import type { ActivityItem, PaideiaBlock } from "../../../types/project";

export type FlipCardsActivityProps = {
  block: PaideiaBlock;
  displaySummary: string;
  displayTitle: string;
  flippedIds: string[];
  getItemImageUrl: (item: ActivityItem, face: "front" | "back") => string | null;
  items: ActivityItem[];
  onFlippedIdsChange: (updater: (current: string[]) => string[]) => void;
  renderFaceImage: (item: ActivityItem, face: "front" | "back", fallbackAlt: string) => ReactNode;
};

export type FlipCardsStyleEditorProps = {
  frontBackgroundColor: string;
  backBackgroundColor: string;
  frontBorderColor: string;
  backBorderColor: string;
  borderStyle: string;
  borderWidth: string;
  onFrontBackgroundColorChange: (value: string) => void;
  onBackBackgroundColorChange: (value: string) => void;
  onFrontBorderColorChange: (value: string) => void;
  onBackBorderColorChange: (value: string) => void;
  onBorderStyleChange: (value: string) => void;
  onBorderWidthChange: (value: string) => void;
};

export type FlipCardCssVars = CSSProperties & {
  "--flip-card-front-bg": string;
  "--flip-card-back-bg": string;
  "--flip-card-front-border-color": string;
  "--flip-card-back-border-color": string;
  "--flip-card-border-width": string;
  "--flip-card-border-style": string;
  "--flip-card-text-color": string;
  "--flip-card-back-text-color": string;
};
