import type { ComponentProps } from "react";
import { PointOfInterestActivityEditorPanel } from "../activities/PointOfInterestActivity";
import { SituationalDialogueActivityEditorPanel } from "../activities/SituationalDialogueActivity";

export function PointOfInterestInlineBlockEditor(
  props: ComponentProps<typeof PointOfInterestActivityEditorPanel>
) {
  return <PointOfInterestActivityEditorPanel {...props} />;
}

export function SituationalDialogueInlineBlockEditor(
  props: ComponentProps<typeof SituationalDialogueActivityEditorPanel>
) {
  return <SituationalDialogueActivityEditorPanel {...props} />;
}
