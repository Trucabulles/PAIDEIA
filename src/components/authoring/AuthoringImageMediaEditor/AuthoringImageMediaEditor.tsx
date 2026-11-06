import { ImageCropEditor } from "../../image-crop/ImageCropEditor";
import { ImageCropAction } from "../../image-crop/ImageCropAvailability";
import { useI18n } from "../../../i18n/react";
import { AuthoringCheckbox } from "../AuthoringCheckbox";
import { AuthoringFileButton } from "../AuthoringFileButton";
import styles from "./AuthoringImageMediaEditor.module.css";
import type { AuthoringImageMediaEditorProps } from "./types";

export function AuthoringImageMediaEditor({
  accept,
  annotationActive = false,
  annotationEditor,
  annotationIcon,
  crop,
  cropIcon,
  cropPreviewActive,
  compactActionControls = false,
  displayedMediaFileName,
  editorMediaLayout,
  imageAlt,
  imageAltBadge,
  imageAsset,
  imageAssetRef,
  imageRounded,
  imageSizeToken,
  isCropMode,
  showAppearanceControls = true,
  showLayoutSelector = true,
  showRoundedControl = true,
  showSizeForCenteredLayout = false,
  onApplyCrop,
  onToggleAnnotation,
  onCancelCrop,
  onCropChange,
  onImageRoundedChange,
  onImageSizeChange,
  onLayoutChange,
  onRemoveImage,
  onToggleCrop,
  onUpload
}: AuthoringImageMediaEditorProps) {
  const { t } = useI18n();
  const compactControls = compactActionControls && !annotationIcon && !showAppearanceControls;
  return (
    <div className={styles.root}>
      <div className="inspector-span-2 media-config-panel">
        <span className="editor-label">{t("activity.image")}</span>
        <div className={`media-config-row ${compactActionControls ? "media-config-row-compact-actions" : ""} ${annotationIcon && onToggleAnnotation ? styles.withAnnotation : ""}`}>
          {imageAsset ? (
            <div className={styles.previewPickerShell}>
              <AuthoringFileButton
                accept={accept}
                className={styles.previewPicker}
                onFileSelect={onUpload}
              >
                <img alt={imageAlt} className="media-thumbnail-image" src={imageAsset} />
              </AuthoringFileButton>
              <button
                aria-label={t("editor.removeImage")}
                className="media-thumbnail-remove"
                onClick={onRemoveImage}
                onPointerDown={(event) => event.stopPropagation()}
                type="button"
              >
                ×
              </button>
            </div>
          ) : (
            <AuthoringFileButton accept={accept} onFileSelect={onUpload}>
              <span>{t("editor.chooseFile")}</span>
            </AuthoringFileButton>
          )}
          <div className="media-config-meta">
            <strong>{displayedMediaFileName || t("editor.noFileSelected", undefined, "Aucun fichier n'a été sélectionné")}</strong>
          </div>
          {compactControls ? <div className={`${styles.actionButtons} ${styles.compactActionButtons}`}>
            {showRoundedControl ? <AuthoringCheckbox
              checked={imageRounded}
              compact
              onChange={(event) => onImageRoundedChange(event.target.checked)}
            >
              {t("editor.roundedCorners", undefined, "Coins arrondis")}
            </AuthoringCheckbox> : null}
            <ImageCropAction assetRef={imageAssetRef}><button
              aria-pressed={isCropMode}
              className={`image-option-button media-config-crop-button ${isCropMode ? "active" : ""}`}
              disabled={!imageAsset}
              onClick={onToggleCrop}
              onPointerDown={(event) => event.stopPropagation()}
              title={t("editor.cropImage", undefined, "Découper l'image")}
              type="button"
            >
              {cropIcon}
            </button></ImageCropAction>
            {imageAsset ? imageAltBadge : null}
          </div> : null}
          {!compactControls && !showAppearanceControls && showRoundedControl ? <AuthoringCheckbox
            checked={imageRounded}
            compact
            onChange={(event) => onImageRoundedChange(event.target.checked)}
          >
            {t("editor.roundedCorners", undefined, "Coins arrondis")}
          </AuthoringCheckbox> : null}
          {!compactControls && (annotationIcon && onToggleAnnotation ? (
            <div className={styles.actionButtons}>
              <ImageCropAction assetRef={imageAssetRef}><button
                aria-pressed={isCropMode}
                className={`image-option-button media-config-crop-button ${isCropMode ? "active" : ""}`}
                disabled={!imageAsset}
                onClick={onToggleCrop}
                onPointerDown={(event) => event.stopPropagation()}
                title={t("editor.cropImage", undefined, "Découper l'image")}
                type="button"
              >
                {cropIcon}
              </button></ImageCropAction>
              <button
                aria-pressed={annotationActive}
                className={`image-option-button media-config-crop-button ${annotationActive ? "active" : ""}`}
                disabled={!imageAsset}
                onClick={onToggleAnnotation}
                onPointerDown={(event) => event.stopPropagation()}
                title={t("editor.annotateImage", undefined, "Annoter l'image")}
                type="button"
              >
                {annotationIcon}
              </button>
            </div>
          ) : (
            <ImageCropAction assetRef={imageAssetRef}><button
              aria-pressed={isCropMode}
              className={`image-option-button media-config-crop-button ${isCropMode ? "active" : ""}`}
              disabled={!imageAsset}
              onClick={onToggleCrop}
              onPointerDown={(event) => event.stopPropagation()}
              title={t("editor.cropImage", undefined, "Découper l'image")}
              type="button"
            >
              {cropIcon}
            </button></ImageCropAction>
          ))}
          {!compactControls && imageAsset ? imageAltBadge : null}
        </div>
      </div>
      {showAppearanceControls ? <div className="inspector-span-2 media-options-row">
        {showAppearanceControls && (showLayoutSelector ? (
          <>
            <label className="image-layout-field">
              <span>{t("editor.imageLayout", undefined, "Disposition de l'image")}</span>
              <select onChange={(event) => onLayoutChange(event.target.value)} value={editorMediaLayout}>
                <option value="image-left">{t("editor.imageLeft")}</option>
                <option value="image-right">{t("editor.imageRight")}</option>
                <option value="image-center">{t("editor.imageCenter")}</option>
              </select>
            </label>
            {(["image-left", "image-right"].includes(editorMediaLayout) ||
              (showSizeForCenteredLayout && editorMediaLayout === "image-center")) ? (
              <label className="image-size-field">
                <span>{t("editor.imageSize", undefined, "Taille de l'image")}</span>
                <select onChange={(event) => onImageSizeChange(event.target.value)} value={imageSizeToken}>
                  <option value="small">{t("size.small", undefined, "Petite")}</option>
                  <option value="medium">{t("size.normal", undefined, "Normale")}</option>
                  <option value="large">{t("size.large", undefined, "Grande")}</option>
                </select>
              </label>
            ) : null}
          </>
        ) : (
          <label className="image-layout-field">
            <span>{t("editor.imageLayout", undefined, "Disposition de l'image")}</span>
            <select onChange={(event) => onLayoutChange(event.target.value)} value={editorMediaLayout}>
              <option value="image-center">{t("size.normal", undefined, "Normale")}</option>
              <option value="image-full">{t("editor.imageMaxWidth", undefined, "Largeur max de l'image")}</option>
              <option value="page-width">{t("editor.imagePageWidth", undefined, "Largeur de la page")}</option>
            </select>
          </label>
        ))}
        {showRoundedControl ? <AuthoringCheckbox
          checked={editorMediaLayout === "page-width" ? false : imageRounded}
          compact
          disabled={editorMediaLayout === "page-width"}
          onChange={(event) => onImageRoundedChange(event.target.checked)}
        >
          {t("editor.roundedCorners", undefined, "Coins arrondis")}
        </AuthoringCheckbox> : null}
      </div> : null}
      {cropPreviewActive && imageAsset ? (
        <div className="inspector-span-2">
          <ImageCropEditor
            alt={imageAlt}
            className="editor-crop-stage"
            crop={crop}
            imageSrc={imageAsset}
            onApply={onApplyCrop}
            onCancel={onCancelCrop}
            onCropChange={onCropChange}
            rounded={imageRounded}
          />
        </div>
      ) : null}
      {annotationEditor}
    </div>
  );
}
