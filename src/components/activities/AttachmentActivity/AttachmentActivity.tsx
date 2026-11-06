import type { CSSProperties } from "react";
import styles from "./AttachmentActivity.module.css";
import { attachmentIconTone, attachmentKindLabel, formatAttachmentSize } from "./attachmentUtils";
import type { AttachmentActivityProps } from "./types";
import { useI18n } from "../../../i18n/react";

export function AttachmentActivity({
  authoringMode = false,
  block,
  resolveAssetUrl,
  onDownload
}: AttachmentActivityProps) {
  const { t } = useI18n();
  const activityStyle = {
    "--attachment-border": block.panelBorderColor ?? "#123a7a",
    "--attachment-background": block.panelBackgroundColor ?? "#edf4ff",
    "--attachment-radius": block.panelRounded ? "22px" : "0px"
  } as CSSProperties;

  if (!(block.attachmentFiles ?? []).length) {
    if (!authoringMode) {
      return <div className={styles.empty}>{t("attachment.emptyEditor", undefined, "Ajoutez un fichier dans l’éditeur.")}</div>;
    }

    return (
      <div className={styles.activity} style={activityStyle}>
        <div className={styles.list}>
          <div className={`${styles.card} ${styles.placeholder}`}>
            <span aria-hidden="true" className={`${styles.icon} ${styles.icon_generic}`}>
              <span>?</span>
            </span>
            <span className={styles.copy}>
              <strong>{t("attachment.emptyEditor", undefined, "Ajoutez un fichier dans l’éditeur.")}</strong>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.activity} style={activityStyle}>
      <div className={styles.list}>
        {(block.attachmentFiles ?? []).map((file) => {
          const href = resolveAssetUrl(file.assetRef);
          const sizeLabel = formatAttachmentSize(file.sizeBytes);
          const iconTone = attachmentIconTone(file.extension);
          const content = (
            <>
              <span
                aria-hidden="true"
                className={`${styles.icon} ${styles[`icon_${iconTone}`]}`}
              >
                <span>{attachmentKindLabel(file.extension)}</span>
              </span>
              <span className={styles.copy}>
                <strong title={file.displayName}>{file.displayName}</strong>
                <small>
                  {file.extension ? file.extension.toUpperCase() : t("attachment.file", undefined, "FICHIER")}
                  {sizeLabel ? ` · ${sizeLabel}` : ""}
                </small>
              </span>
              <span aria-hidden="true" className={styles.downloadMark}>↓</span>
            </>
          );
          return onDownload ? (
            <button
              className={styles.card}
              key={file.id}
              onClick={(event) => {
                event.stopPropagation();
                onDownload(block, file);
              }}
              type="button"
            >
              {content}
            </button>
          ) : (
            <a className={styles.card} href={href ?? "#"} key={file.id}>
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
