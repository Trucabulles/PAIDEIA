import { useState } from "react";
import {
  AuthoringButton,
  AuthoringCheckbox,
  AuthoringFieldGrid,
  AuthoringFileButton,
  TrashIcon
} from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { ImageCropEditor } from "../../image-crop/ImageCropEditor";
import { ImageCropAction } from "../../image-crop/ImageCropAvailability";
import { firstItemImageAssetRef } from "../../../app/mediaAssets";
import styles from "./TabsActivity.module.css";
import type { TabsActivityEditorProps, TabsRichTextFieldName } from "./types";
import type { ActivityItem } from "../../../types/project";
import { useI18n } from "../../../i18n/react";

function stripHtml(value: string | null | undefined) {
  return (
    value
      ?.replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

export function TabsActivityEditor({
  accentColor,
  activeAnnotationItemId,
  activeCropItemId,
  annotationIcon,
  backgroundColor,
  crop,
  cropIcon,
  getItemImageUrl,
  imageAccept,
  imageRounded,
  isCropMode,
  items,
  onAccentColorChange,
  onAddItem,
  onApplyCrop,
  onBackgroundColorChange,
  onBeginAnnotation,
  onBeginCrop,
  onCancelCrop,
  onCropChange,
  onDuplicateItem,
  onImageRoundedChange,
  onMoveItem,
  onRemoveItem,
  renderRichTextField,
  onRoundedChange,
  onShadowChange,
  onUpdateItem,
  onUploadItemImage,
  renderAnnotationEditor,
  renderImageAltBadge,
  rounded,
  shadow,
  visiblePanel = "all"
}: TabsActivityEditorProps) {
  const { t } = useI18n();
  const [activeItemId, setActiveItemId] = useState(items[0]?.id ?? "");
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? null;
  const activeImage = activeItem ? getItemImageUrl(activeItem) : null;
  const isActiveItemAnnotationOpen = Boolean(
    activeItem && activeAnnotationItemId === activeItem.id && activeImage
  );

  function renderInlineField(
    item: ActivityItem,
    field: TabsRichTextFieldName,
    label: string,
    placeholder: string,
    className = styles.inlineField
  ) {
    const html = (item[field] as string | null | undefined)?.trim() || "";
    return renderRichTextField({ item, field, html, label, className, placeholder });
  }

  return (
    <div className={`activity-style-panel ${styles.editor}`}>
      {visiblePanel !== "appearance" ? <>
      <div className={styles.editorHeader}>
        <div>
          <span className="editor-label">{t("activity.tabs")}</span>
          <p className="field-hint">{t("tabs.help", undefined, "Structure simple, image optionnelle et contenu rich text par onglet.")}</p>
        </div>
        <AuthoringButton className={styles.addTabButton} onClick={onAddItem} variant="secondary">
          {t("tabs.addTab", undefined, "Ajouter un onglet")}
        </AuthoringButton>
      </div>

      <div className={styles.editorLayout}>
        <aside className={styles.itemRail} aria-label={t("tabs.tabList", undefined, "Liste des onglets")}>
          {items.map((item, index) => {
            const isActive = item.id === activeItem?.id;
            return (
              <article className={`${styles.editorTabCard} ${isActive ? styles.selectedEditorTab : ""}`} key={item.id}>
                <button className={styles.editorTabMain} onClick={() => setActiveItemId(item.id)} type="button">
                  <strong>{stripHtml(item.title) || t("tabs.untitledTab", { count: index + 1 }, "Onglet {count} sans titre")}</strong>
                  <small>{stripHtml(item.contentTitle) || t("tabs.optionalContentTitle", undefined, "Titre contenu optionnel")}</small>
                </button>
                <div className={styles.editorTabActions}>
                  <AuthoringButton compact disabled={index === 0} onClick={() => onMoveItem(item.id, -1)}>
                    ↑
                  </AuthoringButton>
                  <AuthoringButton compact disabled={index === items.length - 1} onClick={() => onMoveItem(item.id, 1)}>
                    ↓
                  </AuthoringButton>
                  <AuthoringButton compact onClick={() => onDuplicateItem(item.id)}>
                    {t("common.copy")}
                  </AuthoringButton>
                  <AuthoringButton
                    aria-label={t("tabs.deleteTab", { count: index + 1 }, "Supprimer l'onglet {count}")}
                    className="compact-delete-button"
                    compact
                    disabled={items.length <= 2}
                    onClick={() => onRemoveItem(item.id)}
                    title={t("tabs.deleteTab", { count: index + 1 }, "Supprimer l'onglet {count}")}
                    variant="danger"
                  >
                    <TrashIcon />
                  </AuthoringButton>
                </div>
              </article>
            );
          })}
        </aside>

        {activeItem ? (
          <section className={styles.editorPanel}>
            <div className={styles.editorSection}>
              {renderInlineField(activeItem, "title", t("tabs.tabTitle", undefined, "Titre d'onglet"), t("tabs.tabTitlePlaceholder", undefined, "Titre de l'onglet"))}
            </div>

            <div className={styles.editorSection}>
              <div className={styles.imageHeader}>
                <span className={styles.fieldLabel}>{t("tabs.optionalImage", undefined, "Image optionnelle")}</span>
                <div className={styles.imageHeaderActions}>
                  <AuthoringCheckbox checked={imageRounded} compact onChange={(event) => onImageRoundedChange(event.target.checked)}>
                    {t("editor.imageCorners", undefined, "Coins image")}
                  </AuthoringCheckbox>
                </div>
              </div>
              {activeCropItemId === activeItem.id && isCropMode && activeImage ? (
                <div className={`${styles.cropWrapper} ${imageRounded ? styles.roundedCropWrapper : ""}`}>
                  <ImageCropEditor
                    alt={stripHtml(activeItem.title) || t("tabs.tabImage", undefined, "Image de l'onglet")}
                    className="editor-crop-stage activity-item-crop-stage"
                    crop={crop}
                    imageSrc={activeImage}
                    onApply={onApplyCrop}
                    onCancel={onCancelCrop}
                    onCropChange={onCropChange}
                    rounded={imageRounded}
                  />
                </div>
              ) : activeImage ? (
                <div className={styles.imagePreviewGroup}>
                <div className={styles.imagePreview}>
                  <button
                    aria-label={t("tabs.removeTabImage", undefined, "Supprimer l'image de l'onglet")}
                    className={styles.removeImageButton}
                    onClick={() =>
                      onUpdateItem(activeItem.id, {
                        assetRefs: (activeItem.assetRefs ?? []).filter((assetRef) => !/\.(png|jpe?g|gif|webp|svg)$/i.test(assetRef)),
                        mediaFileName: null,
                        imageCrop: null,
                        imageAnnotationStateRef: null,
                        imageAnnotationSourceAssetRef: null,
                        imageAccessibility: null
                      })
                    }
                    type="button"
                  >
                    ×
                  </button>
                  <img alt={stripHtml(activeItem.title) || t("tabs.tabImage", undefined, "Image de l'onglet")} src={activeImage} />
                </div>
                <div className={styles.imageActions}>
                  <ImageCropAction assetRef={firstItemImageAssetRef(activeItem)}><button
                    aria-label={t("editor.cropImage")}
                    className="image-option-button"
                    onClick={() => onBeginCrop(activeItem)}
                    title={t("editor.cropImage")}
                    type="button"
                  >
                    {cropIcon}
                  </button></ImageCropAction>
                  <button
                    aria-label={t("editor.annotateImage")}
                    aria-pressed={isActiveItemAnnotationOpen}
                    className="image-option-button"
                    onClick={() => onBeginAnnotation(activeItem)}
                    title={t("editor.annotateImage")}
                    type="button"
                  >
                    {annotationIcon}
                  </button>
                </div>
                {renderImageAltBadge(activeItem)}
                </div>
              ) : (
                <AuthoringFileButton
                  accept={imageAccept}
                  className={styles.emptyImagePicker}
                  onFileSelect={(file) => onUploadItemImage(activeItem.id, file)}
                >
                  {t("editor.chooseImage")}
                </AuthoringFileButton>
              )}
              {isActiveItemAnnotationOpen
                ? renderAnnotationEditor(activeItem, stripHtml(activeItem.title) || t("tabs.tabImage", undefined, "Image de l'onglet"))
                : null}
              {activeImage ? (
                <AuthoringFieldGrid className={styles.imageLayoutGrid}>
                  <label>
                    <span>{t("editor.imageLayout", undefined, "Disposition de l'image")}</span>
                    <select
                      onChange={(event) => onUpdateItem(activeItem.id, { mediaLayout: event.target.value })}
                      value={activeItem.mediaLayout ?? "image-left"}
                    >
                      <option value="image-left">{t("editor.imageLeft", undefined, "Image à gauche")}</option>
                      <option value="image-right">{t("editor.imageRight", undefined, "Image à droite")}</option>
                      <option value="image-center">{t("editor.imageBelow", undefined, "Image au-dessus")}</option>
                      <option value="image-below">{t("editor.imageUnder", undefined, "Image en dessous")}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t("editor.imageSize", undefined, "Taille de l'image")}</span>
                    <select
                      onChange={(event) => onUpdateItem(activeItem.id, { imageSize: event.target.value })}
                      value={activeItem.imageSize ?? "medium"}
                    >
                      <option value="small">{t("size.small", undefined, "Petite")}</option>
                      <option value="medium">{t("size.normal", undefined, "Normale")}</option>
                      <option value="large">{t("size.large", undefined, "Grande")}</option>
                    </select>
                  </label>
                </AuthoringFieldGrid>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      </> : null}

      {visiblePanel !== "activity" ? <section className={styles.appearanceSection} aria-label={t("editor.activityAppearance", undefined, "Apparence de l'activité")}>
        <span className={styles.appearanceTitle}>{t("editor.activityAppearance", undefined, "Apparence activité")}</span>
        <AuthoringFieldGrid className={styles.appearanceGrid}>
          <label>
            <span>{t("editor.accent", undefined, "Accent")}</span>
            <ColorPickerField ariaLabel={t("tabs.accentColor", undefined, "Couleur d'accent des onglets")} onChange={onAccentColorChange} value={accentColor} />
          </label>
          <label>
            <span>{t("editor.background", undefined, "Fond")}</span>
            <ColorPickerField allowTransparent ariaLabel={t("tabs.backgroundColor", undefined, "Couleur de fond de l'activité onglets")} onChange={onBackgroundColorChange} value={backgroundColor} />
          </label>
          <AuthoringCheckbox checked={rounded} compact onChange={(event) => onRoundedChange(event.target.checked)}>
            {t("editor.activityCorners", undefined, "Coins activité")}
          </AuthoringCheckbox>
          <AuthoringCheckbox checked={shadow} compact onChange={(event) => onShadowChange(event.target.checked)}>
            {t("editor.shadow", undefined, "Ombre")}
          </AuthoringCheckbox>
        </AuthoringFieldGrid>
      </section> : null}
    </div>
  );
}
