import type { CSSProperties } from "react";
import styles from "./QuoteActivity.module.css";
import type { QuoteActivityProps } from "./types";

function hasMeaningfulHtml(value?: string | null) {
  const text = (value ?? "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return text.length > 0;
}

export function QuoteActivity({
  accentColor,
  authorContent,
  authorHtml,
  content,
  imageAlt = "",
  imageLayout = "image-left",
  imageRole,
  imageRounded = false,
  imageSrc,
  imageWidth = "26%",
  rounded = false,
  shadow = false,
  showAuthor,
  showMarks = true,
  style
}: QuoteActivityProps) {
  const hasAuthorContent = Boolean(authorContent) || hasMeaningfulHtml(authorHtml);
  const shouldShowAuthor = hasAuthorContent && (showAuthor ?? true);
  const rootStyle: CSSProperties = {
    ...style,
    "--quote-accent": accentColor || "#123a7a",
    "--quote-image-width": imageWidth
  } as CSSProperties;
  const imageLayoutClass = imageLayout === "image-right"
    ? styles.quoteImageRight
    : imageLayout === "image-center"
      ? styles.quoteImageCenter
      : styles.quoteImageLeft;

  return (
    <figure
      className={`${styles.quote} ${imageLayoutClass} ${imageSrc ? "" : styles.quoteWithoutImage} ${shadow ? styles.quoteWithShadow : ""} ${shouldShowAuthor ? "" : styles.quoteWithoutAuthor} ${showMarks ? "" : styles.quoteWithoutMarks}`}
      style={{
        ...rootStyle,
        borderRadius: rounded ? "26px" : "0px"
      }}
    >
      {imageSrc ? (
        <img
          alt={imageAlt}
          className={`${styles.image} ${imageRounded ? styles.imageRounded : ""}`}
          role={imageRole}
          src={imageSrc}
        />
      ) : null}
      <figcaption className={styles.copy}>
        {showMarks ? <span aria-hidden="true" className={styles.openMark}>{"\u201c"}</span> : null}
        <div className={styles.body}>{content}</div>
        {shouldShowAuthor ? (
          <div className={styles.author}>
            {authorContent ?? <div dangerouslySetInnerHTML={{ __html: authorHtml ?? "" }} />}
          </div>
        ) : null}
        {showMarks ? <span aria-hidden="true" className={styles.closeMark}>{"\u201d"}</span> : null}
      </figcaption>
    </figure>
  );
}
