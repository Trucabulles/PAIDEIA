import styles from "./ImageActivity.module.css";
import type { ImageActivityProps } from "./types";

export function ImageActivity({
  contentAlign,
  contentNode,
  displayTitle,
  imageNode,
  layout,
  style
}: ImageActivityProps) {
  return (
    <div className={`standalone-image-activity image-layout ${layout} ${styles.activity}`} style={style}>
      {imageNode}
      <div className="image-copy" style={{ textAlign: contentAlign }}>
        {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
        {contentNode}
      </div>
    </div>
  );
}
