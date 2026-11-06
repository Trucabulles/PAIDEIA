import styles from "./HtmlCustomActivity.module.css";
import type { HtmlCustomActivityProps } from "./types";
import { useI18n } from "../../../i18n/react";
import { defaultCustomHtmlContent } from "./htmlCustomContent";

export function HtmlCustomActivity({ authoringMode = false, hasContent, layout, previewNode }: HtmlCustomActivityProps) {
  const { t } = useI18n();
  if (hasContent) {
    return <>{previewNode}</>;
  }

  if (authoringMode) {
    const codeLines = defaultCustomHtmlContent().split("\n");
    return (
      <div className={`custom-html-block custom-html-placeholder ${layout === "full-width" ? "full-width" : ""} ${styles.activity}`}>
        <div aria-hidden="true" className={styles.mockEditor}>
          <div className={styles.mockGutter}>
            {codeLines.map((_, index) => <span key={`line-${index + 1}`}>{index + 1}</span>)}
          </div>
          <div className={styles.mockPane}>
            <pre className={styles.mockCode}>{codeLines.join("\n")}</pre>
            <p className={styles.hint}>
              {t("htmlCustom.insertHint", undefined, "Cliquer sur le crayon pour insérer ou importer du HTML")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`custom-html-block custom-html-placeholder ${layout === "full-width" ? "full-width" : ""} ${styles.activity}`}>
      {t("htmlCustom.insertHint", undefined, "Cliquer sur le crayon pour insérer ou importer du HTML")}
    </div>
  );
}
