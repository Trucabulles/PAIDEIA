import { CroppedImage } from "../../app/CroppedImage";
import { imageAltAttributes } from "../../../lib/imageAccessibility";
import { IMAGE_GRID_MAX_ITEMS } from "./defaults";
import styles from "./ImageGridActivity.module.css";
import type { ImageGridActivityProps } from "./types";
import { imageGridImageShouldContain } from "./imagePresentation";

function countClassName(count: number) {
  if (count === 3) return styles.count3;
  if (count === 4) return styles.count4;
  return count === 2 ? styles.count2 : "";
}

export function ImageGridActivity({
  authoringMode = false,
  getItemImageUrl,
  items,
  onImageOpen,
  renderRichContent,
  rounded,
  shadow
}: ImageGridActivityProps) {
  const visibleItems = items.slice(0, IMAGE_GRID_MAX_ITEMS);
  const columnCount = Math.max(1, visibleItems.length);
  const activityClassName = [
    styles.activity,
    countClassName(columnCount),
    rounded ? styles.rounded : "",
    shadow ? styles.shadow : ""
  ].filter(Boolean).join(" ");

  return (
    <section className={activityClassName}>
      <div className={styles.cards}>
        {visibleItems.map((item, index) => {
          const imageUrl = getItemImageUrl(item);
          const imageAlt = imageAltAttributes(item.imageAccessibility);
          const caption = authoringMode && renderRichContent
            ? renderRichContent(item.contentHtml || "<p></p>", styles.captionContent)
            : item.contentHtml
              ? <div dangerouslySetInnerHTML={{ __html: item.contentHtml }} />
              : null;

          return (
            <figure className={styles.card} key={item.id || `image-grid-${index}`}>
              <div className={styles.media}>
                {imageUrl ? (
                  <CroppedImage
                    alt={imageAlt.alt}
                    className={`${styles.image} ${imageGridImageShouldContain(item.mediaFileName) ? styles.containedImage : ""}`.trim()}
                    crop={item.imageCrop}
                    onClick={() => onImageOpen?.(imageUrl, item.title, rounded)}
                    rounded={rounded}
                    role={imageAlt.role}
                    src={imageUrl}
                  />
                ) : authoringMode ? <div aria-hidden="true" className={styles.placeholder} /> : null}
              </div>
              {caption ? <figcaption className={`${styles.caption} rich-content`}>{caption}</figcaption> : null}
            </figure>
          );
        })}
      </div>
    </section>
  );
}
