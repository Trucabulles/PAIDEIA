import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import {
  AuthoringButton,
  AuthoringCheckbox,
  AuthoringFieldGrid,
  AuthoringFileButton
} from "../../authoring";
import styles from "./AttachmentActivity.module.css";
import {
  ATTACHMENT_FILE_ACCEPT,
  attachmentIconTone,
  attachmentKindLabel,
  formatAttachmentSize
} from "./attachmentUtils";
import type { AttachmentActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";

export function AttachmentActivityEditor({
  files,
  backgroundColor,
  borderColor,
  rounded,
  onAdd,
  onReplace,
  onRemove,
  onBackgroundColorChange,
  onBorderColorChange,
  onRoundedChange
}: AttachmentActivityEditorProps) {
  const { t } = useI18n();
  return (
    <div className={`activity-style-panel ${styles.editorPanel}`}>
      <div className={styles.editorHeading}>
        <div>
          <span className="editor-label">{t("attachment.downloadableFiles", undefined, "Fichiers téléchargeables")}</span>
          <p className="field-hint">{t("attachment.supportedFilesHint", undefined, "PDF, documents bureautiques et archives ZIP.")}</p>
        </div>
        <AuthoringFileButton
          accept={ATTACHMENT_FILE_ACCEPT}
          className={styles.fileButton}
          onFileSelect={onAdd}
        >
          <span>{t("attachment.addFile", undefined, "Ajouter un fichier")}</span>
        </AuthoringFileButton>
      </div>

      <div className={styles.editorList}>
        {files.length ? (
          files.map((file) => {
            const sizeLabel = formatAttachmentSize(file.sizeBytes);
            const iconTone = attachmentIconTone(file.extension);
            return (
              <article className={styles.editorItem} key={file.id}>
                <span
                  aria-hidden="true"
                  className={`${styles.icon} ${styles.editorIcon} ${styles[`icon_${iconTone}`]}`}
                >
                  <span>{attachmentKindLabel(file.extension)}</span>
                </span>
                <div className={styles.editorCopy}>
                  <strong title={file.displayName}>{file.displayName}</strong>
                  <small>
                    {file.extension ? file.extension.toUpperCase() : "FICHIER"}
                    {sizeLabel ? ` · ${sizeLabel}` : ""}
                  </small>
                </div>
                <div className={styles.editorActions}>
                  <AuthoringFileButton
                    accept={ATTACHMENT_FILE_ACCEPT}
                    className={styles.fileButton}
                    onFileSelect={(replacement) => onReplace(file.id, replacement)}
                    variant="secondary"
                  >
                    {t("common.replace", undefined, "Remplacer")}
                  </AuthoringFileButton>
                  <AuthoringButton onClick={() => onRemove(file.id)} variant="danger">
                    {t("common.delete")}
                  </AuthoringButton>
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.editorEmpty}>{t("attachment.noFileAdded", undefined, "Aucun fichier ajouté.")}</div>
        )}
      </div>

      <AuthoringFieldGrid className={styles.styleGrid}>
        <label>
          <span>{t("editor.backgroundColor", undefined, "Couleur de fond")}</span>
          <ColorPickerField
            allowTransparent
            ariaLabel={t("attachment.fileBackgroundColor", undefined, "Couleur de fond des fichiers")}
            onChange={onBackgroundColorChange}
            value={backgroundColor}
          />
        </label>
        <label>
          <span>{t("editor.borderColor", undefined, "Couleur de bordure")}</span>
          <ColorPickerField
            ariaLabel={t("attachment.fileBorderColor", undefined, "Couleur de bordure des fichiers")}
            onChange={onBorderColorChange}
            value={borderColor}
          />
        </label>
        <AuthoringCheckbox
          checked={rounded}
          compact
          onChange={(event) => onRoundedChange(event.target.checked)}
        >
          {t("editor.roundedCorners")}
        </AuthoringCheckbox>
      </AuthoringFieldGrid>
    </div>
  );
}
