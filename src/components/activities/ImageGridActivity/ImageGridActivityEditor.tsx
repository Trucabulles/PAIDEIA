import { firstItemImageAssetRef } from "../../../app/mediaAssets";
import { useI18n } from "../../../i18n/react";
import { AuthoringButton, AuthoringCheckbox, AuthoringFieldGrid } from "../../authoring";
import { CroppedImage } from "../../app/CroppedImage";
import { ImageCropEditor } from "../../image-crop/ImageCropEditor";
import { ImageCropAction } from "../../image-crop/ImageCropAvailability";
import { IMAGE_GRID_MAX_ITEMS, imageGridItemCount } from "./defaults";
import styles from "./ImageGridActivity.module.css";
import { imageGridImageShouldContain } from "./imagePresentation";
import type { ImageGridActivityEditorProps } from "./types";

function countClassName(count: number) {
  if (count === 3) return styles.count3;
  if (count === 4) return styles.count4;
  return styles.count2;
}

export function ImageGridActivityEditor({
  activeCropItemId,
  columns,
  cropIcon,
  draftImageCrop,
  imageAccept,
  imageRounded,
  imageShadow,
  isCropMode,
  items,
  onAddItem,
  onApplyCrop,
  onBeginCrop,
  onCancelCrop,
  onColumnsChange,
  onCropChange,
  onImageRoundedChange,
  onImageShadowChange,
  onRemoveImage,
  onRemoveItem,
  onUploadImage,
  renderRichTextField,
  resolveAssetUrl
}: ImageGridActivityEditorProps) {
  const { t } = useI18n();
  const safeCount = imageGridItemCount(items, columns);

  return (
    <section className={`${styles.editor} inspector-span-2`}>
      <div className={styles.editorToolbar}>
        <label>
          <span>{t("imageGrid.columns")}</span>
          <select aria-label={t("imageGrid.columns")} onChange={(event) => {
            const nextCount = Number(event.target.value);

            if (nextCount > items.length) {
              for (let index = items.length; index < nextCount; index += 1) {
                onAddItem();
              }
            } else if (nextCount < items.length) {
              items.slice(nextCount).forEach((item) => onRemoveItem(item.id));
            }

            onColumnsChange(nextCount);
          }} value={safeCount}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <AuthoringFieldGrid className={styles.editorStyleControls}>
          <AuthoringCheckbox checked={imageRounded} compact onChange={(event) => onImageRoundedChange(event.target.checked)}>
            {t("editor.roundedCorners", undefined, "Coins arrondis")}
          </AuthoringCheckbox>
          <AuthoringCheckbox checked={imageShadow} compact onChange={(event) => onImageShadowChange(event.target.checked)}>
            {t("editor.shadow", undefined, "Ombre")}
          </AuthoringCheckbox>
        </AuthoringFieldGrid>
        <AuthoringButton disabled={items.length >= IMAGE_GRID_MAX_ITEMS} onClick={() => {
          onColumnsChange(Math.min(IMAGE_GRID_MAX_ITEMS, items.length + 1));
          onAddItem();
        }}>{t("imageGrid.addImage")}</AuthoringButton>
      </div>
      <div className={`${styles.editorCards} ${countClassName(Math.max(1, Math.min(items.length, IMAGE_GRID_MAX_ITEMS)))}`}>
        {items.slice(0, IMAGE_GRID_MAX_ITEMS).map((item, index) => {
          const imageUrl = resolveAssetUrl(firstItemImageAssetRef(item));
          const imageNumber = index + 1;
          const mediaClassName = [
            styles.editorMedia,
            imageRounded ? styles.editorMediaRounded : "",
            imageShadow ? styles.editorMediaShadow : ""
          ].filter(Boolean).join(" ");

          return (
            <article className={styles.editorCard} key={item.id}>
              <div className={styles.editorCardHead}>
                <strong>{t("imageGrid.imageNumber", { count: imageNumber })}</strong>
                {imageUrl ? (
                  <button
                    aria-label={t("imageGrid.deleteImage", { count: imageNumber })}
                    className={styles.editorDelete}
                    onClick={() => onRemoveImage(item.id)}
                    title={t("imageGrid.deleteImage", { count: imageNumber })}
                    type="button"
                  />
                ) : null}
              </div>
              <div className={mediaClassName}>
                {activeCropItemId === item.id && isCropMode && imageUrl ? (
                  <ImageCropEditor
                    alt=""
                    className="editor-crop-stage activity-item-crop-stage"
                    crop={draftImageCrop}
                    imageSrc={imageUrl}
                    onApply={onApplyCrop}
                    onCancel={onCancelCrop}
                    onCropChange={onCropChange}
                    rounded={imageRounded}
                  />
                ) : (
                  <>
                    <label className={styles.editorUpload}>
                      {imageUrl ? (
                        <CroppedImage alt="" className={`${styles.editorPreview} ${imageGridImageShouldContain(item.mediaFileName) ? styles.containedImage : ""}`.trim()} crop={item.imageCrop} rounded={imageRounded} src={imageUrl} />
                      ) : <span>{t("imageGrid.chooseImage")}</span>}
                      <input accept={imageAccept} onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadImage(item.id, file);
                        event.currentTarget.value = "";
                      }} type="file" />
                    </label>
                    {imageUrl ? (
                      <ImageCropAction assetRef={firstItemImageAssetRef(item)}><button aria-label={t("editor.cropImage")} className={`image-option-button ${styles.editorCrop}`} onClick={() => onBeginCrop(item)} title={t("editor.cropImage")} type="button">
                        {cropIcon}
                      </button></ImageCropAction>
                    ) : null}
                  </>
                )}
              </div>
              {renderRichTextField({
                item,
                field: "contentHtml",
                html: item.contentHtml || "<p></p>",
                className: styles.editorCaption,
                label: t("imageGrid.caption"),
                placeholder: t("imageGrid.captionPlaceholder")
              })}
            </article>
          );
        })}
      </div>
    </section>
  );
}
