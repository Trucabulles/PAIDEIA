import { AuthoringFileButton } from "../AuthoringFileButton";
import styles from "./AuthoringMediaAssetPicker.module.css";
import type { AuthoringMediaAssetPickerProps } from "./types";
import { useI18n } from "../../../i18n/react";

export function AuthoringMediaAssetPicker({
  accept,
  emptyLabel,
  fileName,
  imageAlt,
  imageSrc,
  label,
  onFileSelect,
  onRemove,
  pickerLabel,
  removeLabel,
  showRemove = true,
  trailingControl
}: AuthoringMediaAssetPickerProps) {
  const { t } = useI18n();
  return (
    <div className={`inspector-span-2 media-config-panel ${styles.picker}`}>
      <span className="editor-label">{label}</span>
      <div className="media-config-row">
        {imageSrc && showRemove ? (
          <div className={styles.previewPickerShell}>
            <AuthoringFileButton
              accept={accept}
              className={styles.previewPicker}
              onFileSelect={onFileSelect}
            >
              <img alt={imageAlt} className="media-thumbnail-image" src={imageSrc} />
            </AuthoringFileButton>
            <button
              aria-label={removeLabel}
              className="media-thumbnail-remove"
              onClick={onRemove}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              ×
            </button>
          </div>
        ) : (
          <AuthoringFileButton accept={accept} onFileSelect={onFileSelect}>
            {pickerLabel}
          </AuthoringFileButton>
        )}
        <div className="media-config-meta">
          <strong>{fileName || t("media.noFileSelected", undefined, "Aucun fichier n’a été sélectionné")}</strong>
        </div>
        {imageSrc && showRemove ? trailingControl : <div className="media-thumbnail-accessibility">
          <div className={`media-thumbnail ${imageSrc ? "" : "empty"}`}>
            {imageSrc ? (
              <>
                <img alt={imageAlt} className="media-thumbnail-image" src={imageSrc} />
              </>
            ) : (
              <span className="media-thumbnail-empty">{emptyLabel}</span>
            )}
          </div>
          {imageSrc ? trailingControl : null}
        </div>}
      </div>
    </div>
  );
}
