import type { MatchingActivityData } from "../../../types/project";

export type MatchingActivityResult = { passed: boolean; score: number };
export type MatchingActivityProps = {
  authoringMode?: boolean;
  data: MatchingActivityData;
  onComplete?: (result: MatchingActivityResult) => void;
};
