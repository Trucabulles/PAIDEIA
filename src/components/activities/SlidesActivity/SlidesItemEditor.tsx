import { ImageCropEditor } from "../../image-crop/ImageCropEditor";
import { ImageCropAction } from "../../image-crop/ImageCropAvailability";
import { firstItemImageAssetRef } from "../../../app/mediaAssets";
import { AuthoringCheckbox, AuthoringFieldGrid, AuthoringFileButton, NativeImageAnnotationTool } from "../../authoring";
import type { SlidesItemEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";
import { defaultSlidesImageSize } from "./SlidesItems";
import styles from "./SlidesActivity.module.css";

export function SlidesItemEditor({
  item,
  label,
  imageAsset,
  annotationImageAsset,
  annotationValue,
  mediaName,
  isCropActive,
  isAnnotationActive,
  cropIcon,
  annotationIcon,
  preview,
  imageAltBadge,
  imageAccept,
  normalizeImageSize,
  blockImageRounded,
  draftImageCrop,
  onApplyCrop,
  onApplyAnnotation,
  onApplyAnnotationEnd,
  onApplyAnnotationStart,
  onCancelCrop,
  onCancelAnnotation,
  onCropChange,
  onUpload,
  onRemoveImage,
  onUpdate,
  onBeginCrop,
  onBeginAnnotation,
  onAnnotationChange
}: SlidesItemEditorProps) {
  const { t } = useI18n();
  const mediaLayout = ["image-left", "image-right", "image-center"].includes(item.mediaLayout ?? "")
    ? item.mediaLayout ?? "image-center"
    : "image-center";
  return (
    <>
      <div>
        <strong>{label}</strong>
      </div>
      <div className={styles.imageMediaRow}>
        {imageAsset ? (
          <div className="media-thumbnail activity-item-thumbnail slides-image-preview">
            {preview}
            <button
              aria-label={t("editor.removeImage")}
              className="media-thumbnail-remove"
              onClick={onRemoveImage}
              onPointerDown={(event) => event.stopPropagation()}
              title={t("editor.removeImage")}
              type="button"
            >
              ×
            </button>
          </div>
        ) : (
          <AuthoringFileButton
            accept={imageAccept}
            className={styles.compactImageUpload}
            onFileSelect={onUpload}
          >
            <span>{t("activity.image")}</span>
          </AuthoringFileButton>
        )}
        {imageAsset && mediaName ? (
          <strong className={styles.imageFileName} title={mediaName}>{mediaName}</strong>
        ) : null}
        {imageAsset ? (
          <>
            <ImageCropAction assetRef={firstItemImageAssetRef(item)}><button
              aria-label={t("editor.cropImage")}
              aria-pressed={isCropActive}
              className={`image-option-button ${styles.imageActionButton} ${isCropActive ? "active" : ""}`}
              onClick={onBeginCrop}
              onPointerDown={(event) => event.stopPropagation()}
              title={t("editor.cropImage")}
              type="button"
            >
              {cropIcon}
            </button></ImageCropAction>
            <button
              aria-label={t("editor.annotateImage")}
              aria-pressed={isAnnotationActive}
              className={`image-option-button ${styles.imageActionButton} ${isAnnotationActive ? "active" : ""}`}
              onClick={onBeginAnnotation}
              onPointerDown={(event) => event.stopPropagation()}
              title={t("editor.annotateImage")}
              type="button"
            >
              {annotationIcon}
            </button>
            <span className={styles.imageAltBadge}>{imageAltBadge}</span>
          </>
        ) : null}
      </div>
      <AuthoringFieldGrid>
        <label>
          <span>{t("editor.imageLayout")}</span>
          <select
            onChange={(event) => {
              const nextMediaLayout = event.target.value;
              const switchesBetweenCenteredAndSide =
                (mediaLayout === "image-center") !== (nextMediaLayout === "image-center");
              onUpdate({
                mediaLayout: nextMediaLayout,
                ...(switchesBetweenCenteredAndSide || !item.imageSize
                  ? { imageSize: defaultSlidesImageSize(nextMediaLayout) }
                  : {})
              });
            }}
            value={mediaLayout}
          >
            <option value="image-center">{t("editor.imageCenter")}</option>
            <option value="image-left">{t("editor.imageLeft")}</option>
            <option value="image-right">{t("editor.imageRight")}</option>
          </select>
        </label>
        {["image-left", "image-right"].includes(item.mediaLayout ?? "image-left") ? (
          <label>
            <span>{t("slides.imageProportion", undefined, "Proportion de l'image")}</span>
            <select
              onChange={(event) => onUpdate({ imageSize: event.target.value })}
              value={normalizeImageSize(item.imageSize)}
            >
              <option value="small">{t("size.small")}</option>
              <option value="medium">{t("size.normal")}</option>
              <option value="large">{t("size.large")}</option>
            </select>
          </label>
        ) : null}
        <AuthoringCheckbox
          checked={item.imageRounded ?? false}
          compact
          onChange={(event) => onUpdate({ imageRounded: event.target.checked })}
        >
          {t("editor.roundedCorners")}
        </AuthoringCheckbox>
      </AuthoringFieldGrid>
      {isCropActive && imageAsset ? (
        <ImageCropEditor
          alt={item.title || label}
          className="editor-crop-stage activity-item-crop-stage"
          crop={draftImageCrop}
          imageSrc={imageAsset}
          onApply={onApplyCrop}
          onCancel={onCancelCrop}
          onCropChange={onCropChange}
          rounded={blockImageRounded ?? undefined}
        />
      ) : null}
      {isAnnotationActive && annotationImageAsset ? (
        <NativeImageAnnotationTool
          imageAlt={item.title || label}
          imageSrc={annotationImageAsset}
          onApply={onApplyAnnotation}
          onApplyEnd={onApplyAnnotationEnd}
          onApplyStart={onApplyAnnotationStart}
          onCancel={onCancelAnnotation}
          onChange={onAnnotationChange}
          title={t("annotation.imageTitle")}
          value={annotationValue}
        />
      ) : null}
    </>
  );
}
