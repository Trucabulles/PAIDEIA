import { PlyrVideoPlayer } from "./PlyrVideoPlayer";
import type { VideoActivityProps } from "./types";

export function VideoActivity({ title, summary, summaryNode, ...playerProps }: VideoActivityProps) {
  return (
    <>
      {title ? <h3 className="export-block-title">{title}</h3> : null}
      <PlyrVideoPlayer {...playerProps} maxDisplayHeight={580} />
      {summaryNode ?? null}
      {summary ? <p className="export-block-copy">{summary}</p> : null}
    </>
  );
}
