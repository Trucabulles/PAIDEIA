import type { ReactNode } from "react";
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
import type { ActivityItem, ImageCrop } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import styles from "./AccordionActivity.module.css";

export type AccordionRichTextFieldRenderParams = {
  className?: string;
  field: "title" | "contentHtml";
  html: string;
  item: ActivityItem;
  label: string;
  placeholder: string;
};

export type AccordionItemEditorProps = {
  activeAnnotationItemId: string | null;
  activeCropItemId: string | null;
  annotationIcon: ReactNode;
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  collapsedItemIds: string[];
  cropIcon: ReactNode;
  draftImageCrop: ImageCrop | null;
  getImageAsset: (item: ActivityItem) => string | null;
  getImageName: (item: ActivityItem) => string;
  imageAccept: string;
  isCropMode: boolean;
  items: ActivityItem[];
  onApplyCrop: () => Promise<void> | void;
  onBackgroundColorChange: (value: string) => void;
  onBeginAnnotation: (item: ActivityItem) => void;
  onBeginCrop: (item: ActivityItem) => void;
  onBorderColorChange: (value: string) => void;
  onBorderStyleChange: (value: string) => void;
  onBorderWidthChange: (value: string) => void;
  onCancelCrop: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onRemoveImage: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRoundedChange: (value: boolean) => void;
  onShadowChange: (value: boolean) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadImage: (itemId: string, file: File) => void;
  renderImage: (item: ActivityItem, alt: string) => ReactNode;
  renderImageAltBadge: (item: ActivityItem) => ReactNode;
  renderAnnotationEditor: (item: ActivityItem, alt: string) => ReactNode;
  renderRichTextField: (params: AccordionRichTextFieldRenderParams) => ReactNode;
  rounded: boolean;
  shadow: boolean;
};

export function AccordionItemEditor({
  activeAnnotationItemId,
  activeCropItemId,
  annotationIcon,
  backgroundColor,
  borderColor,
  borderStyle,
  borderWidth,
  collapsedItemIds,
  cropIcon,
  draftImageCrop,
  getImageAsset,
  getImageName,
  imageAccept,
  isCropMode,
  items,
  onApplyCrop,
  onBackgroundColorChange,
  onBeginAnnotation,
  onBeginCrop,
  onBorderColorChange,
  onBorderStyleChange,
  onBorderWidthChange,
  onCancelCrop,
  onCropChange,
  onRemoveImage,
  onRemoveItem,
  onRoundedChange,
  onShadowChange,
  onToggleCollapse,
  onUpdateItem,
  onUploadImage,
  renderImage,
  renderImageAltBadge,
  renderAnnotationEditor,
  renderRichTextField,
  rounded,
  shadow
}: AccordionItemEditorProps) {
  const { t } = useI18n();
  return (
    <div className={styles.editor}>
      {items.map((item, index) => {
        const isCollapsed = collapsedItemIds.includes(item.id);
        const itemImageAsset = getImageAsset(item);
        const itemMediaName = getImageName(item);
        const isItemCropActive = activeCropItemId === item.id && isCropMode && Boolean(itemImageAsset);
        const isItemAnnotationActive = activeAnnotationItemId === item.id && Boolean(itemImageAsset);

        return (
          <article className={`activity-item-editor-card ${styles.itemCard} ${isCollapsed ? "collapsed" : ""}`} key={item.id}>
            <div className="marker-editor-card-header activity-item-card-header">
              <button
                aria-expanded={!isCollapsed}
                aria-label={t(isCollapsed ? "richText.expand" : "common.collapse")}
                className="activity-item-collapse-button"
                onClick={() => onToggleCollapse(item.id)}
                type="button"
              >
                {isCollapsed ? "›" : "⌄"}
              </button>
              <strong>{t("accordion.panelNumber", { count: index + 1 }, "Panneau {count}")}</strong>
              <button
                aria-label={t("accordion.deletePanel", { count: index + 1 }, "Supprimer le panneau {count}")}
                className="danger-pill compact compact-delete-button"
                onClick={() => onRemoveItem(item.id)}
                title={t("accordion.deletePanel", { count: index + 1 }, "Supprimer le panneau {count}")}
                type="button"
              >
                <TrashIcon />
              </button>
            </div>
            {isCollapsed ? null : (
              <div className={styles.itemContent}>
                {renderRichTextField({
                  className: "activity-item-rich-editor",
                  field: "title",
                  html: item.title || "",
                  item,
                  label: t("accordion.panelTitle", undefined, "Titre du panneau"),
                  placeholder: t("accordion.panelNumber", { count: index + 1 }, "Panneau {count}")
                })}
                <section className={styles.imageTools} aria-label={t("accordion.panelImageNumber", { count: index + 1 }, "Image du panneau {count}")}>
                  <div className={styles.imageHeader}>
                    <span className="editor-label">{t("accordion.panelImage", undefined, "Image du panneau")}</span>
                    <div className={styles.imageActions}>
                      <AuthoringCheckbox
                        checked={item.imageRounded ?? false}
                        compact
                        onChange={(event) => onUpdateItem(item.id, { imageRounded: event.target.checked })}
                      >
                        {t("editor.imageCorners", undefined, "Coins image")}
                      </AuthoringCheckbox>
                      {!itemImageAsset ? (
                        <AuthoringFileButton accept={imageAccept} onFileSelect={(file) => onUploadImage(item.id, file)}>
                          {t("editor.chooseImage")}
                        </AuthoringFileButton>
                      ) : null}
                      <ImageCropAction assetRef={firstItemImageAssetRef(item)}><AuthoringButton
                        aria-pressed={isItemCropActive}
                        className={styles.cropButton}
                        compact
                        disabled={!itemImageAsset}
                        onClick={() => onBeginCrop(item)}
                        title={t("editor.cropImage")}
                      >
                        {cropIcon}
                      </AuthoringButton></ImageCropAction>
                      <AuthoringButton
                        aria-pressed={isItemAnnotationActive}
                        className={styles.cropButton}
                        compact
                        disabled={!itemImageAsset}
                        onClick={() => onBeginAnnotation(item)}
                        title={t("editor.annotateImage")}
                      >
                        {annotationIcon}
                      </AuthoringButton>
                    </div>
                  </div>
                  {itemImageAsset ? (
                    <div className={styles.imagePreviewRow}>
                      <div className={styles.imagePreview}>
                        {renderImage(item, item.title || t("accordion.panelNumber", { count: index + 1 }, "Panneau {count}"))}
                        <button
                          aria-label={t("accordion.deletePanelImage", { count: index + 1 }, "Supprimer l'image du panneau {count}")}
                          className={styles.removeImageButton}
                          onClick={() => onRemoveImage(item.id)}
                          onPointerDown={(event) => event.stopPropagation()}
                          title={t("editor.removeImage")}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                      <strong className={styles.imagePreviewName}>{itemMediaName}</strong>
                      {renderImageAltBadge(item)}
                    </div>
                  ) : null}
                  {isItemCropActive && itemImageAsset ? (
                    <div className={styles.cropWrapper}>
                      <ImageCropEditor
                        alt={item.title || t("accordion.panelNumber", { count: index + 1 }, "Panneau {count}")}
                        className="editor-crop-stage activity-item-crop-stage"
                        crop={draftImageCrop}
                        imageSrc={itemImageAsset}
                        onApply={onApplyCrop}
                        onCancel={onCancelCrop}
                        onCropChange={onCropChange}
                        rounded={item.imageRounded ?? undefined}
                      />
                    </div>
                  ) : null}
                  {isItemAnnotationActive && itemImageAsset
                    ? renderAnnotationEditor(item, item.title || t("accordion.panelNumber", { count: index + 1 }, "Panneau {count}"))
                    : null}
                </section>
              </div>
            )}
          </article>
        );
      })}

      <section className={styles.appearanceSection} aria-label={t("accordion.appearanceAria", undefined, "Apparence de l'activité accordéon")}>
        <span className={styles.appearanceTitle}>{t("editor.activityAppearance", undefined, "Apparence activité")}</span>
        <AuthoringFieldGrid className={styles.appearanceGrid}>
          <label>
            <span>{t("accordion.tabBackground", undefined, "Fond onglet")}</span>
            <ColorPickerField allowTransparent ariaLabel={t("accordion.tabBackgroundColor", undefined, "Couleur de fond des onglets de l'accordéon")} onChange={onBackgroundColorChange} value={backgroundColor} />
          </label>
          <label>
            <span>{t("accordion.lineButton", undefined, "Ligne / bouton")}</span>
            <ColorPickerField ariaLabel={t("accordion.lineColor", undefined, "Couleur des lignes de l'accordéon")} onChange={onBorderColorChange} value={borderColor} />
          </label>
          <label>
            <span>{t("sectionMarker.width")}</span>
            <select onChange={(event) => onBorderWidthChange(event.target.value)} value={borderWidth}>
              <option value="0px">{t("lineWidth.none", undefined, "Aucune")}</option>
              <option value="1px">{t("lineWidth.thin")}</option>
              <option value="2px">{t("lineWidth.normal")}</option>
              <option value="3px">{t("lineWidth.strong", undefined, "Forte")}</option>
            </select>
          </label>
          <label>
            <span>{t("sectionMarker.lineStyle")}</span>
            <select onChange={(event) => onBorderStyleChange(event.target.value)} value={borderStyle}>
              <option value="solid">{t("lineStyle.solid")}</option>
              <option value="dashed">{t("lineStyle.dashed")}</option>
              <option value="dotted">{t("lineStyle.dotted")}</option>
            </select>
          </label>
          <AuthoringCheckbox checked={rounded} compact onChange={(event) => onRoundedChange(event.target.checked)}>
            {t("editor.activityCorners", undefined, "Coins activité")}
          </AuthoringCheckbox>
          <AuthoringCheckbox checked={shadow} compact onChange={(event) => onShadowChange(event.target.checked)}>
            {t("editor.shadow", undefined, "Ombre")}
          </AuthoringCheckbox>
        </AuthoringFieldGrid>
      </section>
    </div>
  );
}
