export type ContinueNavigationAction =
  | "none"
  | "complete-preview"
  | "next-chapter"
  | "reveal-next-block";

type ContinueNavigationContext = {
  hasNextBlock: boolean;
  hasNextChapter: boolean;
  isLastChapter: boolean;
  isPreviewMode: boolean;
};

export function resolveContinueNavigationAction({
  hasNextBlock,
  hasNextChapter,
  isLastChapter,
  isPreviewMode
}: ContinueNavigationContext): ContinueNavigationAction {
  if (!isPreviewMode) {
    return !hasNextBlock && hasNextChapter ? "next-chapter" : "none";
  }

  if (!hasNextBlock && isLastChapter) {
    return "complete-preview";
  }

  if (!hasNextBlock) {
    return hasNextChapter ? "next-chapter" : "none";
  }

  return "reveal-next-block";
}
