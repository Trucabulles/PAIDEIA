import { useId } from "react";
import classicPreview from "../../../assets/situational-dialogue-classic.webp";
import compactPortraitPreview from "../../../assets/situational-dialogue-compact-portrait.webp";
import responsesBelowPreview from "../../../assets/situational-dialogue-responses-below.webp";
import { normalizeHexColor } from "../../../app/textContrast";
import { useI18n } from "../../../i18n/react";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import "../../lesson-editor/ActivityBackgroundAppearance.css";
import styles from "./SituationalDialogueActivity.module.css";

const inlineTags = new Set(["b", "strong", "i", "em", "u", "s", "span"]);
const titleStyles = ["color", "font-family", "font-size", "font-style", "font-weight", "line-height", "text-decoration", "text-decoration-line", "text-decoration-color"];
const lineTags = new Set(["div", "p", "br", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"]);

export function dialogueTitleHtml(html: string) {
  const source = document.createElement("template");
  source.innerHTML = html;
  const result = document.createElement("div");
  function append(node: Node, parent: HTMLElement) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append((node.textContent ?? "").replace(/\s+/g, " "));
      return;
    }
    if (!(node instanceof Element) || /^(script|style|template|svg|math)$/.test(node.localName)) return;
    const tag = node.localName;
    if (lineTags.has(tag)) parent.append(" ");
    const child = document.createElement(inlineTags.has(tag) ? tag : "span");
    if (node instanceof HTMLElement) {
      for (const property of titleStyles) {
        const value = node.style.getPropertyValue(property);
        if (value) child.style.setProperty(property, value);
      }
    }
    const fontId = node.getAttribute("data-paideia-font-id");
    if (fontId) child.setAttribute("data-paideia-font-id", fontId);
    if (!inlineTags.has(tag) && !child.style.length && !fontId) {
      for (const item of node.childNodes) append(item, parent);
    } else {
      for (const item of node.childNodes) append(item, child);
      parent.append(child);
    }
    if (lineTags.has(tag)) parent.append(" ");
  }
  for (const child of source.content.childNodes) append(child, result);
  return result.textContent?.trim() ? result.innerHTML.trim() : "";
}

export function DialogueAppearance({ layout, color, bannerColor, onChange }: {
  layout: string;
  color: string;
  bannerColor?: string;
  onChange: (patch: { mediaLayout?: string; buttonBackgroundColor?: string; situationalDialogueBannerColor?: string }) => void;
}) {
  const { t } = useI18n();
  const modelHeadingId = useId();
  const colorsHeadingId = useId();
  const buttonsLabel = t("situationalDialogue.buttons");
  const bannerLabel = t("situationalDialogue.bannerColor");
  const models = [
    ["classic", t("situationalDialogue.classicLayout", undefined, "Classique"), classicPreview],
    ["responses-below", t("situationalDialogue.responsesBelowLayout", undefined, "Réponses en bas"), responsesBelowPreview],
    ["compact-portrait", t("situationalDialogue.compactPortraitLayout", undefined, "Portrait compact"), compactPortraitPreview]
  ];
  return (
    <div className={styles.appearancePanels}>
      <section className="activity-background-appearance" aria-labelledby={modelHeadingId}>
        <header className="activity-background-appearance__header">
          <span className="editor-label" id={modelHeadingId}>
            {t("situationalDialogue.layout", undefined, "Modèle")}
          </span>
        </header>
        <div className={styles.layoutChoices} role="radiogroup" aria-labelledby={modelHeadingId}>
          {models.map(([id, label, preview]) => (
            <label className={styles.layoutChoice} key={id}>
              <img alt="" className={styles.layoutThumbnail} src={preview} />
              <span className={styles.layoutOption}>
                <input
                  type="radio"
                  name={modelHeadingId}
                  checked={layout === id}
                  onChange={() => onChange({ mediaLayout: id })}
                />
                <strong>{label}</strong>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="activity-background-appearance" aria-labelledby={colorsHeadingId}>
        <header className="activity-background-appearance__header">
          <span className="editor-label" id={colorsHeadingId}>
            {t("color.colors")}
          </span>
          <button
            className={`ghost-pill ${styles.themeColorsButton}`}
            disabled={!color && !bannerColor}
            onClick={() => onChange({ buttonBackgroundColor: "", situationalDialogueBannerColor: "" })}
            type="button"
          >
            {t("lessonSettings.defaultColor")}
          </button>
        </header>
        <div className="activity-background-appearance__control">
          <span>{buttonsLabel}</span>
          <ColorPickerField
            ariaLabel={buttonsLabel}
            onChange={buttonBackgroundColor => onChange({ buttonBackgroundColor })}
            value={normalizeHexColor(color) ?? "#123a7a"}
          />
        </div>
        <div className="activity-background-appearance__control">
          <span>{bannerLabel}</span>
          <ColorPickerField
            ariaLabel={bannerLabel}
            onChange={situationalDialogueBannerColor => onChange({ situationalDialogueBannerColor })}
            value={normalizeHexColor(bannerColor) ?? "#f1f5fc"}
          />
        </div>
      </section>
    </div>
  );
}
