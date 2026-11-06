import { useRef, useState, type CSSProperties, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { CroppedImage } from "../../app/CroppedImage";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { ImageCropEditor } from "../../image-crop/ImageCropEditor";
import { ImageCropAction } from "../../image-crop/ImageCropAvailability";
import { TrashIcon } from "../../authoring";
import { useI18n } from "../../../i18n/react";
import type { ActivityItem, CardSortActivityData, ImageCrop } from "../../../types/project";
import { cardSortCategoryLabelText, createDefaultCardSortItem } from "./cardSortDefaults";
import styles from "./CardSortActivity.module.css";

type RichField = "contentHtml" | "cardFeedbackCorrectHtml" | "cardFeedbackIncorrectHtml";

export type CardSortActivityEditorProps = {
  activeCropItemId: string | null;
  cropIcon: ReactNode;
  data: CardSortActivityData;
  draftImageCrop: ImageCrop | null;
  imageAccept: string;
  items: ActivityItem[];
  onApplyCrop: () => Promise<void> | void;
  onBeginCrop: (item: ActivityItem, face?: "front" | "back") => void;
  onCancelCrop: () => void;
  onCropChange: Dispatch<SetStateAction<ImageCrop | null>>;
  onDataChange: (updater: (current: CardSortActivityData) => CardSortActivityData) => void;
  onItemsChange: (items: ActivityItem[]) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadImage: (itemId: string, file: File) => void;
  renderImage: (item: ActivityItem, alt: string) => ReactNode;
  renderImageAltBadge: (item: ActivityItem) => ReactNode;
  renderGlobalRichTextField: (params: { field: "successFeedbackHtml" | "failureFeedbackHtml"; html: string; label: string; placeholder: string }) => ReactNode;
  renderCategoryRichTextField: (params: { categoryId: string; html: string; label: string; placeholder: string }) => ReactNode;
  renderRichTextField: (params: { className?: string; field: RichField; html: string; item: ActivityItem; label: string; placeholder: string }) => ReactNode;
  resolveAssetUrl: (assetRef: string) => string;
};

function CardSortImageIcon() {
  return <svg aria-hidden="true" className={styles.editorImagePickerIcon} viewBox="0 0 24 24">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="9" r="1.75" />
    <path d="m5.5 17 4.4-4.4 3.1 3.1 2.2-2.2 3.3 3.5" />
  </svg>;
}

export function CardSortActivityEditor({ activeCropItemId, cropIcon, data, draftImageCrop, imageAccept, items, onApplyCrop, onBeginCrop, onCancelCrop, onCropChange, onDataChange, onItemsChange, onUpdateItem, onUploadImage, renderCategoryRichTextField, renderGlobalRichTextField, renderImageAltBadge, renderRichTextField, resolveAssetUrl }: CardSortActivityEditorProps) {
  const { t } = useI18n();
  const [openCards, setOpenCards] = useState<string[]>([]);
  const cardTextBeforeInputRef = useRef<Record<string, string>>({});
  const feedbackMode = data.interactionMode === "feedback";
  const canAddCategory = data.categories.length < 4;

  const addCategory = () => {
    if (!canAddCategory) return;
    const label = t("cardSort.defaultCategory", { index: data.categories.length + 1 }, "Catégorie {index}");
    onDataChange((current) => ({
      ...current,
      categories: [...current.categories, {
        id: `category_${Date.now()}`,
        label,
        labelHtml: `<p>${label}</p>`,
        borderColor: "#244585"
      }]
    }));
  };

  const removeCategory = (categoryId: string) => {
    if (data.categories.length <= 2) return;
    const fallbackId = data.categories.find((category) => category.id !== categoryId)?.id ?? "";
    onItemsChange(items.map((item) => item.correctCategoryId === categoryId ? { ...item, correctCategoryId: fallbackId } : item));
    onDataChange((current) => ({ ...current, categories: current.categories.filter((category) => category.id !== categoryId) }));
  };

  const addCard = () => {
    const order = items.length + 1;
    const next = createDefaultCardSortItem(
      order,
      data.categories[0]?.id,
      t("cardSort.card", { index: order }, "Carte {index}")
    );
    onItemsChange([...items, next]);
    setOpenCards((current) => [...current, next.id]);
  };

  const removeCard = (itemId: string) => {
    onItemsChange(items.filter((candidate) => candidate.id !== itemId));
    setOpenCards((current) => current.filter((id) => id !== itemId));
  };

  const editableTarget = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    return element?.closest<HTMLElement>('[contenteditable="true"]') ?? null;
  };

  const rememberCardTextBeforeInput = (itemId: string, event: FormEvent<HTMLDivElement>) => {
    const editable = editableTarget(event.target);
    if (!editable) return;
    cardTextBeforeInputRef.current[itemId] = editable.innerHTML;
  };

  const keepCardTextInsideCard = (itemId: string, event: FormEvent<HTMLDivElement>) => {
    const editable = editableTarget(event.target);
    if (!editable) return;
    const overflows = editable.scrollHeight > editable.clientHeight + 1 || editable.scrollWidth > editable.clientWidth + 1;
    if (!overflows) {
      cardTextBeforeInputRef.current[itemId] = editable.innerHTML;
      return;
    }
    const previousHtml = cardTextBeforeInputRef.current[itemId];
    if (previousHtml == null) return;
    event.preventDefault();
    event.stopPropagation();
    editable.innerHTML = previousHtml;
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  return <section className={styles.editor}>
    <details className={styles.editorSection}>
      <summary>{t("cardSort.settings", undefined, "Paramètres de l’activité")}</summary>
      <div className="inspector-grid">
        <label className="inspector-span-2">
          <span className="editor-label">{t("cardSort.interactionMode", undefined, "Mode de fonctionnement")}</span>
          <select onChange={(event) => onDataChange((current) => ({ ...current, interactionMode: event.target.value === "feedback" ? "feedback" : "direct" }))} value={data.interactionMode}>
            <option value="direct">{t("cardSort.interactionModeDirect", undefined, "Fonctionnement de base")}</option>
            <option value="feedback">{t("cardSort.interactionModeFeedback", undefined, "Fonctionnement par feedback")}</option>
          </select>
        </label>
      </div>
    </details>

    <details className={styles.editorSection}>
      <summary>{t("cardSort.categories", undefined, "Catégories")}</summary>
      <div className={styles.categorySectionBody}>
        <div className={styles.categorySectionMeta}>
          <span className={styles.categoryLimitNote}>{t("cardSort.categoryLimit", undefined, "2 à 4 catégories")}</span>
          <button className="ghost-pill" disabled={!canAddCategory} onClick={addCategory} type="button">{t("cardSort.addCategory", undefined, "Ajouter une catégorie")}</button>
        </div>
        <div className={styles.categoryEditorList}>{data.categories.map((category, index) => <div className={styles.categoryEditorRow} key={category.id}>
          <div className={styles.categoryRichTextField}>{renderCategoryRichTextField({ categoryId: category.id, html: category.labelHtml, label: t("cardSort.category", { index: index + 1 }, "Catégorie {index}"), placeholder: t("cardSort.defaultCategory", { index: index + 1 }, "Catégorie {index}") })}</div>
          <label className={styles.categoryColorControl}>
            <span>{t("cardSort.categoryDropAreaColor", undefined, "Couleur de la zone de dépôt")}</span>
            <ColorPickerField ariaLabel={t("cardSort.categoryDropAreaColor", undefined, "Couleur de la zone de dépôt")} className={styles.categoryColorPicker} onChange={(borderColor) => onDataChange((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, borderColor } : item) }))} value={category.borderColor} />
          </label>
          <button aria-label={t("cardSort.deleteCategory", undefined, "Supprimer la catégorie")} className="danger-pill compact compact-delete-button" disabled={data.categories.length <= 2} onClick={() => removeCategory(category.id)} type="button"><TrashIcon /></button>
        </div>)}</div>
      </div>
    </details>

    <section className={`${styles.editorSection} ${styles.cardsSection}`}>
      <div className="interactive-editor-header">
        <strong>{t("cardSort.cards", undefined, "Cartes")}</strong>
        <button className="ghost-pill" onClick={addCard} type="button">{t("cardSort.addCard", undefined, "Ajouter une carte")}</button>
      </div>

      <div className={styles.editorCardList}>{items.map((item, index) => {
        const isOpen = openCards.includes(item.id);
        const imageAssetRef = item.frontImageAssetRef || "";
        const imageAsset = imageAssetRef ? resolveAssetUrl(imageAssetRef) : "";
        const cropActive = activeCropItemId === `${item.id}:front`;
        const previewStyle = {
          "--card-sort-bg": item.cardBackgroundColor || data.cardAppearance.backgroundColor,
          "--card-sort-border": data.cardAppearance.borderColor,
          "--card-sort-border-width": data.cardAppearance.borderWidth,
          "--card-sort-border-style": data.cardAppearance.borderStyle,
          "--card-sort-radius": data.cardAppearance.rounded ? "18px" : "0px"
        } as CSSProperties;

        return <article className={styles.editorCardItem} key={item.id}>
          <div className={styles.editorCardHeader}>
            <button aria-expanded={isOpen} className={styles.editorCardToggle} onClick={() => setOpenCards((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} type="button">
              <span aria-hidden="true" className={styles.editorChevron}>{isOpen ? "⌄" : "›"}</span>
              <strong>{t("cardSort.card", { index: index + 1 }, "Carte {index}")}</strong>
            </button>
            <button aria-label={t("cardSort.deleteCard", undefined, "Supprimer la carte")} className="danger-pill compact compact-delete-button" onClick={() => removeCard(item.id)} type="button"><TrashIcon /></button>
          </div>

          {isOpen ? <div className={styles.editorCardBody}>
            <div className={styles.editorCardWorkspace}>
              <div className={styles.editorCardVisualColumn}>
                <div className={`${styles.editorCardControls} ${imageAsset ? styles.editorCardControlsWithImage : ""}`}>
                  {!imageAsset ? <>
                    <div className={styles.editorControlGroup}>
                      <span className={styles.editorControlLabel}>{t("cardSort.cardColor", undefined, "Couleur fond")}</span>
                      <ColorPickerField allowTransparent ariaLabel={t("cardSort.cardColor", undefined, "Couleur fond")} onChange={(cardBackgroundColor) => onUpdateItem(item.id, { cardBackgroundColor: cardBackgroundColor === "transparent" ? null : cardBackgroundColor })} value={item.cardBackgroundColor || "transparent"} />
                    </div>
                    <label
                      aria-label={t("cardSort.addImage", undefined, "Ajouter une image")}
                      className={`${styles.editorImagePickerButton} image-option-button`}
                      title={t("cardSort.addImage", undefined, "Ajouter une image")}
                    >
                      <CardSortImageIcon />
                      <input accept={imageAccept} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadImage(item.id, file); event.target.value = ""; }} type="file" />
                    </label>
                  </> : <div className={styles.editorImageActions}>
                    <ImageCropAction assetRef={imageAssetRef}><button aria-label={t("editor.cropImage", undefined, "Recadrer l’image")} aria-pressed={cropActive} className={`image-option-button ${styles.editorCropButton} ${cropActive ? "active" : ""}`} onClick={() => onBeginCrop(item, "front")} type="button">{cropIcon}</button></ImageCropAction>
                    <button
                      aria-label={t("cardSort.removeImage", undefined, "Supprimer l’image")}
                      className={styles.editorImageRemoveButton}
                      onClick={() => onUpdateItem(item.id, { assetRefs: (item.assetRefs ?? []).filter((assetRef) => assetRef !== item.frontImageAssetRef), frontImageAssetRef: null, frontImageFileName: null, frontImageCrop: null, frontImageAccessibility: null })}
                      title={t("cardSort.removeImage", undefined, "Supprimer l’image")}
                      type="button"
                    ><svg aria-hidden="true" className={styles.editorImageRemoveIcon} viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17" /></svg></button>
                  </div>}
                </div>

                <div className={styles.editorCardPreviewFrame}>
                  <div className={styles.editorCardPreview} style={previewStyle}>
                    {imageAsset ? <CroppedImage alt={item.frontImageAccessibility?.decorative ? "" : item.frontImageAccessibility?.altText || item.title} className={styles.editorCardImage} crop={item.frontImageCrop} role={item.frontImageAccessibility?.decorative ? "presentation" : undefined} src={imageAsset} /> : null}
                    <div
                      className={styles.editorCardRichTextZone}
                      onBeforeInputCapture={(event) => rememberCardTextBeforeInput(item.id, event)}
                      onInputCapture={(event) => keepCardTextInsideCard(item.id, event)}
                    >{renderRichTextField({ className: styles.editorCardRichField, field: "contentHtml", html: item.contentHtml, item, label: "", placeholder: t("editor.richTextPlaceholder", undefined, "Saisissez votre texte ici") })}</div>
                  </div>
                </div>
              </div>

              <div className={styles.editorCardLogicColumn}>
                <label className={`${styles.editorLogicField} ${styles.editorTextField}`}>
                  <span>{t("cardSort.correctCategory", undefined, "Catégorie correcte")}</span>
                  <select onChange={(event) => onUpdateItem(item.id, { correctCategoryId: event.target.value })} value={item.correctCategoryId || data.categories[0]?.id}>{data.categories.map((category) => <option key={category.id} value={category.id}>{cardSortCategoryLabelText(category.labelHtml) || category.label}</option>)}</select>
                </label>

                {feedbackMode ? <div className={styles.editorCardFeedbackFields}>
                  <div className={styles.editorFeedbackBlock}>
                    <span className={styles.editorFeedbackHeading}>{t("cardSort.correctFeedback", undefined, "Si le classement est correct")}</span>
                    <div className={`${styles.editorFeedbackField} ${styles.editorRichTextSurface}`}>{renderRichTextField({ className: styles.editorFeedbackField, field: "cardFeedbackCorrectHtml", html: item.cardFeedbackCorrectHtml || "<p></p>", item, label: "", placeholder: t("cardSort.correctFeedbackPlaceholder", undefined, "Expliquez ou complétez la bonne réponse") })}</div>
                  </div>
                  <div className={styles.editorFeedbackBlock}>
                    <span className={styles.editorFeedbackHeading}>{t("cardSort.incorrectFeedback", undefined, "Si le classement est incorrect")}</span>
                    <div className={`${styles.editorFeedbackField} ${styles.editorRichTextSurface}`}>{renderRichTextField({ className: styles.editorFeedbackField, field: "cardFeedbackIncorrectHtml", html: item.cardFeedbackIncorrectHtml || "<p></p>", item, label: "", placeholder: t("cardSort.incorrectFeedbackPlaceholder", undefined, "Expliquez pourquoi ce classement n’est pas adapté") })}</div>
                  </div>
                </div> : null}

                {imageAsset ? <div className={styles.editorAltRow}><span className={styles.editorAltBadge}>{renderImageAltBadge(item)}</span></div> : null}
              </div>
            </div>

            {cropActive && imageAsset ? <div className={styles.editorCropStage}><ImageCropEditor alt={item.title} className="editor-crop-stage activity-item-crop-stage" crop={draftImageCrop} imageSrc={imageAsset} onApply={onApplyCrop} onCancel={onCancelCrop} onCropChange={(crop) => onCropChange(crop)} rounded /></div> : null}
          </div> : null}
        </article>;
      })}</div>
    </section>

    {!feedbackMode ? <section className={`${styles.editorSection} ${styles.globalFeedbackSection}`}>
      <strong>{t("cardSort.pedagogicalFeedback", undefined, "Feedback pédagogique")}</strong>
      <div className={styles.globalFeedbackField}>
        <span className={styles.globalFeedbackLabel}>{t("cardSort.finalFeedback", undefined, "À la fin de l’activité")}</span>
        <div className={styles.editorRichTextSurface}>{renderGlobalRichTextField({ field: "successFeedbackHtml", html: data.successFeedbackHtml, label: "", placeholder: t("cardSort.finalFeedbackPlaceholder", undefined, "Message pédagogique affiché lorsque toutes les cartes sont correctement classées") })}</div>
      </div>
    </section> : null}
  </section>;
}
