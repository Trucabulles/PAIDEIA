import type { ComponentProps } from "react";
import { AudioActivityEditorPanel } from "../activities/AudioActivity";
import { Image360ActivityEditorPanel } from "../activities/Image360Activity";
import { VideoActivityEditorPanel } from "../activities/VideoActivity";

export function VideoInlineBlockEditor(
  props: ComponentProps<typeof VideoActivityEditorPanel>
) {
  return <VideoActivityEditorPanel {...props} />;
}

export function AudioInlineBlockEditor(
  props: ComponentProps<typeof AudioActivityEditorPanel>
) {
  return <AudioActivityEditorPanel {...props} />;
}

export function Image360InlineBlockEditor(
  props: ComponentProps<typeof Image360ActivityEditorPanel>
) {
  return <Image360ActivityEditorPanel {...props} />;
}
