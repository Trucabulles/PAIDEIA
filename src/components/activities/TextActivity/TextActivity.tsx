import styles from "./TextActivity.module.css";
import type { TextActivityProps } from "./types";
import { wrapResponsiveRichTextTables } from "../../../app/responsiveRichTextTables";
import { normalizeRichInlineImageFormattingHtml } from "../../../app/richTextSanitizer";

export function TextActivity({
  contentHtml,
  displayTitle,
  displaySummary,
  style,
  renderRichContent
}: TextActivityProps) {
  const normalizedContentHtml = normalizeRichInlineImageFormattingHtml(contentHtml);
  const renderedContentHtml = renderRichContent ? normalizedContentHtml : wrapResponsiveRichTextTables(normalizedContentHtml);
  return (
    <div className={`visual-content ${styles.activity}`} style={style}>
      {contentHtml ? (
        renderRichContent ? (
          renderRichContent(normalizedContentHtml, "rich-content")
        ) : (
          <div className="rich-content" dangerouslySetInnerHTML={{ __html: renderedContentHtml }} />
        )
      ) : displaySummary ? (
        <>
          {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
          <p className="export-block-copy">{displaySummary}</p>
        </>
      ) : null}
    </div>
  );
}
