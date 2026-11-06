import styles from "./ImageTextActivity.module.css";
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
import { measureImageTextCroppedMedia } from "./ImageTextActivity.media.js";
import type { ImageTextActivityProps } from "./types";

export const imageTextActivityShellClassName = styles.shell;

export function ImageTextActivity({
  contentAlign,
  contentNode,
  displayTitle,
  imageNode,
  layout,
  contentWidth,
  imageSize,
  mediaGap,
  verticalAlign,
  contentTextColor
}: ImageTextActivityProps) {
  const activityRef = useRef<HTMLDivElement>(null);
  function measureCroppedImage() {
    measureImageTextCroppedMedia(activityRef.current);
  }
  useLayoutEffect(measureCroppedImage, [imageNode]);
  const width = Number.parseFloat(contentWidth ?? "");
  const style = {
    "--image-text-content-width": Number.isFinite(width) ? `${Math.min(100, Math.max(25, width))}%` : undefined,
    "--image-text-image-size": imageSize === undefined ? undefined : `${imageSize}%`,
    "--image-text-media-gap": /^\d+(?:\.\d+)?px$/.test(mediaGap ?? "") ? mediaGap : undefined,
    "--image-text-vertical-align": ["start", "center", "end"].includes(verticalAlign ?? "") ? verticalAlign : undefined,
    "--activity-content-text": contentTextColor
  } as CSSProperties;
  return (
    <div className={styles.frame} data-layout={layout}>
      <div className={styles.activity} data-layout={layout} style={style} ref={activityRef} onLoadCapture={measureCroppedImage}>
        {imageNode}
        <div className={styles.copy} style={{ textAlign: contentAlign }}>
          {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
          {contentNode}
        </div>
      </div>
    </div>
  );
}
