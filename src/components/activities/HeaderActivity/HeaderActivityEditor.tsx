import { AuthoringFieldGrid, AuthoringFileButton } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import styles from "./HeaderActivity.module.css";
import type { HeaderActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";

export function HeaderActivityEditor({
  backgroundColor,
  backgroundBlur,
  backgroundOverlay,
  backgroundOverlayDark,
  contentPosition,
  textOutline,
  textOutlineColor,
  hasImage,
  imageAccept,
  imageName,
  imageSrc,
  onBackgroundColorChange,
  onBackgroundBlurChange,
  onBackgroundOverlayChange,
  onBackgroundOverlayDarkChange,
  onContentPositionChange,
  onTextOutlineChange,
  onTextOutlineColorChange,
  onHeightChange,
  onImageUpload,
  onRemoveImage,
}: HeaderActivityEditorProps) {
  const { t } = useI18n();
  const overlayOptions = [
    { label: t("common.none"), value: 0 },
    { label: t("common.light"), value: 0.25 },
    { label: t("common.medium"), value: 0.5 },
    { label: t("common.strong"), value: 0.75 }
  ];
  const blurOptions = [
    { label: t("common.none"), value: 0 },
    { label: t("common.light"), value: 4 },
    { label: t("common.medium"), value: 8 },
    { label: t("common.strong"), value: 12 }
  ];
  const textOutlineOptions = [
    { label: t("common.none"), value: "none" },
    { label: t("header.textOutlineThin"), value: "thin" },
    { label: t("header.textOutlineMedium"), value: "medium" },
    { label: t("header.textOutlineThick"), value: "thick" }
  ] as const;

  return (
    <div className={`inspector-span-2 activity-style-panel header-style-panel ${styles.editor}`}>
      <span className="editor-label">{t("activity.header")}</span>
      <fieldset className={styles.optionGroup}>
        <legend>{t("header.imageOptions")}</legend>
        <div className={styles.topControls}>
          <div className={styles.fileField}>
            <span>{t("header.backgroundImage", undefined, "Image de fond")}</span>
            {imageSrc ? (
              <div className={styles.filePreviewRow}>
                <div className={styles.filePreviewThumb}>
                  <img alt={imageName || t("header.backgroundImage", undefined, "Image de fond")} className={styles.filePreviewImage} src={imageSrc} />
                  <button
                    aria-label={t("header.removeBackgroundImage", undefined, "Supprimer l'image de fond")}
                    className={styles.filePreviewRemove}
                    onClick={onRemoveImage}
                    onPointerDown={(event) => event.stopPropagation()}
                    type="button"
                  >
                    x
                  </button>
                </div>
                <strong className={styles.filePreviewName}>{imageName}</strong>
              </div>
            ) : (
              <AuthoringFileButton accept={imageAccept} onFileSelect={onImageUpload}>
                {t("editor.chooseFile")}
              </AuthoringFileButton>
            )}
          </div>
          <div className={styles.colorControls}>
            <label>
              <span>{t("editor.backgroundColor", undefined, "Couleur de fond")}</span>
              <ColorPickerField allowTransparent ariaLabel={t("editor.backgroundColor", undefined, "Couleur de fond")} onChange={onBackgroundColorChange} value={backgroundColor} />
            </label>
          </div>
        </div>
        <AuthoringFieldGrid className="header-style-grid">
          <label>
            <span>{t("situationalDialogue.backgroundBlur")}</span>
            <select onChange={(event) => onBackgroundBlurChange(Number(event.target.value))} value={String(backgroundBlur)}>
              {blurOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className={styles.overlayControl}>
            <span>{t("situationalDialogue.backgroundOverlay")}</span>
            <select onChange={(event) => onBackgroundOverlayChange(Number(event.target.value))} value={String(backgroundOverlay)}>
              {overlayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className={styles.darkOverlay}>
              <input
                checked={backgroundOverlayDark}
                onChange={(event) => onBackgroundOverlayDarkChange(event.target.checked)}
                type="checkbox"
              />
              <span>{t("activityBackground.darkOverlay", undefined, "Voile sombre")}</span>
            </label>
          </div>
        </AuthoringFieldGrid>
        <p className={`field-hint ${styles.imagePositionHint}`}>{t("header.imagePositionHint", undefined, "Le repositionnement se fait depuis la vue complète de la leçon : double-cliquez sur l'image, puis faites-la glisser verticalement.")}</p>
      </fieldset>

      <fieldset className={styles.optionGroup}>
        <legend>{t("header.textOptions")}</legend>
        <AuthoringFieldGrid className="header-style-grid header-text-position-grid">
          <label>
            <span>{t("header.textBlockPosition")}</span>
            <select onChange={(event) => onContentPositionChange(event.target.value as "left" | "center" | "right")} value={contentPosition}>
              <option value="left">{t("richText.alignLeft")}</option>
              <option value="center">{t("richText.alignCenter")}</option>
              <option value="right">{t("richText.alignRight")}</option>
            </select>
          </label>
        </AuthoringFieldGrid>

        <div className={styles.textReadability}>
          <span className={styles.subsectionTitle}>{t("header.textReadability")}</span>
        <AuthoringFieldGrid className="header-style-grid">
          <label>
            <span>{t("header.textContrastEnhancement")}</span>
            <select onChange={(event) => onTextOutlineChange(event.target.value as typeof textOutline)} value={textOutline}>
              {textOutlineOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>{t("header.textOutlineColor")}</span>
            <select disabled={textOutline === "none"} onChange={(event) => onTextOutlineColorChange(event.target.value as "light" | "dark")} value={textOutlineColor}>
              <option value="light">{t("header.textOutlineLight")}</option>
              <option value="dark">{t("header.textOutlineDark")}</option>
            </select>
          </label>
        </AuthoringFieldGrid>
        </div>
      </fieldset>
    </div>
  );
}
