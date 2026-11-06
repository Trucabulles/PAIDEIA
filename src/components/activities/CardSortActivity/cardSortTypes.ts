import type { ActivityItem, CardSortActivityData } from "../../../types/project";

export type CardSortActivityResult = { score: number; passed: boolean };

export type CardSortActivityProps = {
  authoringMode?: boolean;
  data: CardSortActivityData;
  items: ActivityItem[];
  getItemImageUrl: (item: ActivityItem) => string | null;
  onComplete?: (result: CardSortActivityResult) => void;
};
