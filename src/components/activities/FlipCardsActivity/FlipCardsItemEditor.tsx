import type { ReactNode } from "react";
import { TrashIcon } from "../../authoring";
import { ImageCropEditor } from "../../image-crop/ImageCropEditor";
import { ImageCropAction } from "../../image-crop/ImageCropAvailability";
import type { ActivityItem, ImageCrop } from "../../../types/project";
import { useI18n } from "../../../i18n/react";

export type FlipCardsRichTextFieldRenderParams = {
  className?: string;
  field: "contentHtml" | "frontText";
  html: string;
  item: ActivityItem;
  label: string;
  placeholder: string;
};

export type FlipCardFace = "front" | "back";

export type FlipCardsItemEditorProps = {
  activeCropItemId: string | null;
  blockImageRounded?: boolean | null;
  collapsedItemIds: string[];
  cropIcon: ReactNode;
  draftImageCrop: ImageCrop | null;
  getImageAsset: (item: ActivityItem, face: FlipCardFace) => string | null;
  getImageName: (item: ActivityItem, face: FlipCardFace) => string;
  imageAccept: string;
  isCropMode: boolean;
  items: ActivityItem[];
  onApplyCrop: () => Promise<void> | void;
  onBeginCrop: (item: ActivityItem, face: FlipCardFace) => void;
  onCancelCrop: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onRemoveItem: (itemId: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadImage: (itemId: string, face: FlipCardFace, file: File) => void;
  renderImage: (item: ActivityItem, face: FlipCardFace, alt: string) => ReactNode;
  renderImageAltBadge: (item: ActivityItem, face: FlipCardFace) => ReactNode;
  renderRichTextField: (params: FlipCardsRichTextFieldRenderParams) => ReactNode;
};

export function FlipCardsItemEditor({
  activeCropItemId,
  blockImageRounded,
  collapsedItemIds,
  cropIcon,
  draftImageCrop,
  getImageAsset,
  getImageName,
  imageAccept,
  isCropMode,
  items,
  onApplyCrop,
  onBeginCrop,
  onCancelCrop,
  onCropChange,
  onRemoveItem,
  onToggleCollapse,
  onUpdateItem,
  onUploadImage,
  renderImage,
  renderImageAltBadge,
  renderRichTextField
}: FlipCardsItemEditorProps) {
  const { t } = useI18n();
  return (
    <>
      {items.map((item, index) => {
        const frontImageAsset = getImageAsset(item, "front");
        const backImageAsset = getImageAsset(item, "back");
        const isCollapsed = collapsedItemIds.includes(item.id);
        const activeFace = activeCropItemId === `${item.id}:front` ? "front" : activeCropItemId === `${item.id}:back` ? "back" : null;
        const activeImageAsset = activeFace ? getImageAsset(item, activeFace) : null;

        return (
          <article className={`activity-item-editor-card ${isCollapsed ? "collapsed" : ""}`} key={item.id}>
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
              <strong>{t("flipCards.cardNumber", { count: index + 1 }, "Carte {count}")}</strong>
              <button
                aria-label={t("flipCards.deleteCard", { count: index + 1 }, "Supprimer la carte {count}")}
                className="danger-pill compact compact-delete-button"
                onClick={() => onRemoveItem(item.id)}
                title={t("flipCards.deleteCard", { count: index + 1 }, "Supprimer la carte {count}")}
                type="button"
              >
                <TrashIcon />
              </button>
            </div>
            {isCollapsed ? null : (
              <>
                <label>
                  <span className="editor-label">{t("flipCards.frontFace", undefined, "Face avant")}</span>
                  <select
                    onChange={(event) =>
                      onUpdateItem(item.id, { frontType: event.target.value as ActivityItem["frontType"] })
                    }
                    value={item.frontType ?? "text"}
                  >
                    <option value="text">{t("activity.rich-text")}</option>
                    <option value="image">{t("activity.image")}</option>
                  </select>
                </label>
                {(item.frontType ?? "text") === "image" ? (
                  <div className="activity-item-image-row">
                    {frontImageAsset ? (
                      <label className="media-thumbnail media-thumbnail-picker activity-item-thumbnail">
                        {renderImage(item, "front", item.title || t("flipCards.cardNumber", { count: index + 1 }, "Carte {count}"))}
                        <input
                          accept={imageAccept}
                          aria-label={t("flipCards.replaceCardImage", { count: index + 1 }, "Remplacer l'image de la carte {count}")}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              onUploadImage(item.id, "front", file);
                            }
                            event.target.value = "";
                          }}
                          type="file"
                        />
                      </label>
                    ) : (
                      <label className="inspector-file-field activity-item-image-picker">
                        <span>{t("flipCards.frontImage", undefined, "Image de face avant")}</span>
                        <input
                          accept={imageAccept}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              onUploadImage(item.id, "front", file);
                            }
                            event.target.value = "";
                          }}
                          type="file"
                        />
                      </label>
                    )}
                    <div className="media-config-meta">
                      <strong>{getImageName(item, "front") || t("editor.noFileSelected")}</strong>
                    </div>
                    {frontImageAsset ? renderImageAltBadge(item, "front") : null}
                    <ImageCropAction assetRef={item.frontImageAssetRef}><button
                      aria-pressed={activeFace === "front"}
                      className={`image-option-button ${activeFace === "front" ? "active" : ""}`}
                      disabled={!frontImageAsset}
                      onClick={() => onBeginCrop(item, "front")}
                      onPointerDown={(event) => event.stopPropagation()}
                      title={t("editor.cropImage")}
                      type="button"
                    >
                      {cropIcon}
                    </button></ImageCropAction>
                  </div>
                ) : (
                  renderRichTextField({
                    className: "activity-item-rich-editor",
                    field: "frontText",
                    html: item.frontText || "",
                    item,
                    label: t("flipCards.frontText", undefined, "Texte de face avant"),
                    placeholder: t("editor.richTextPlaceholder", undefined, "Saisissez votre texte ici")
                  })
                )}
                <label>
                  <span className="editor-label">{t("flipCards.backFace", undefined, "Face arrière")}</span>
                  <select
                    onChange={(event) => onUpdateItem(item.id, { backType: event.target.value as ActivityItem["backType"] })}
                    value={item.backType ?? "text"}
                  >
                    <option value="text">{t("activity.rich-text")}</option>
                    <option value="image">{t("activity.image")}</option>
                  </select>
                </label>
                {(item.backType ?? "text") === "image" ? (
                  <div className="activity-item-image-row">
                    {backImageAsset ? (
                      <label className="media-thumbnail media-thumbnail-picker activity-item-thumbnail">
                        {renderImage(item, "back", item.title || t("flipCards.cardNumber", { count: index + 1 }, "Carte {count}"))}
                        <input
                          accept={imageAccept}
                          aria-label={`${t("flipCards.replaceCardImage", { count: index + 1 })} — ${t("flipCards.backFace")}`}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) onUploadImage(item.id, "back", file);
                            event.target.value = "";
                          }}
                          type="file"
                        />
                      </label>
                    ) : (
                      <label className="inspector-file-field activity-item-image-picker">
                        <span>{`${t("activity.image")} — ${t("flipCards.backFace")}`}</span>
                        <input
                          accept={imageAccept}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) onUploadImage(item.id, "back", file);
                            event.target.value = "";
                          }}
                          type="file"
                        />
                      </label>
                    )}
                    <div className="media-config-meta">
                      <strong>{getImageName(item, "back") || t("editor.noFileSelected")}</strong>
                    </div>
                    {backImageAsset ? renderImageAltBadge(item, "back") : null}
                    <ImageCropAction assetRef={item.backImageAssetRef}><button
                      aria-pressed={activeFace === "back"}
                      className={`image-option-button ${activeFace === "back" ? "active" : ""}`}
                      disabled={!backImageAsset}
                      onClick={() => onBeginCrop(item, "back")}
                      onPointerDown={(event) => event.stopPropagation()}
                      title={t("editor.cropImage")}
                      type="button"
                    >
                      {cropIcon}
                    </button></ImageCropAction>
                  </div>
                ) : renderRichTextField({
                  className: "activity-item-rich-editor",
                  field: "contentHtml",
                  html: item.contentHtml || "",
                  item,
                  label: t("flipCards.backText", undefined, "Texte de face arrière"),
                  placeholder: t("editor.richTextPlaceholder", undefined, "Saisissez votre texte ici")
                })}
                {activeFace && activeImageAsset ? (
                  <ImageCropEditor
                    alt={item.title || t("flipCards.cardNumber", { count: index + 1 }, "Carte {count}")}
                    className="editor-crop-stage activity-item-crop-stage"
                    crop={draftImageCrop}
                    imageSrc={activeImageAsset}
                    onApply={onApplyCrop}
                    onCancel={onCancelCrop}
                    onCropChange={onCropChange}
                    rounded={item.imageRounded ?? blockImageRounded ?? undefined}
                  />
                ) : null}
              </>
            )}
          </article>
        );
      })}
    </>
  );
}
