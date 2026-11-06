import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from "react";
import { ColorPickerField } from "../color-picker/ColorPickerPopover";
import { RichTextTableInsertControl } from "../rich-text-table/RichTextTableInsertControl";
import { useI18n } from "../../i18n/react";
import "./RichTextToolbar.css";
import selectAllIcon from "./select-all.svg";
import selectChevron from "./rich-select-chevron.svg";
import { RichTextFontPicker } from "./RichTextFontPicker";
import { RichTextOpacityPicker } from "./RichTextOpacityPicker";
import type { RichTextListMarker, RichTextToolbarProps } from "./RichTextToolbar.types";

export type { RichTextListMarker, RichTextToolbarFontOption, RichTextToolbarProfile, RichTextToolbarProps } from "./RichTextToolbar.types";

const RICH_TEXT_FONT_SIZES_PX = Array.from({ length: 91 }, (_, index) => index + 6);
const UNORDERED_LIST_MARKERS: ReadonlyArray<{ value: RichTextListMarker; preview: string }> = [
  { value: "disc", preview: "●" },
  { value: "circle", preview: "○" },
  { value: "square", preview: "■" },
  { value: "dash", preview: "—" },
  { value: "arrow", preview: "→" },
  { value: "check", preview: "✓" },
];
const ORDERED_LIST_MARKERS: ReadonlyArray<{ value: RichTextListMarker; preview: string }> = [
  { value: "decimal", preview: "1." },
  { value: "lower-alpha", preview: "a." },
  { value: "upper-alpha", preview: "A." },
  { value: "lower-roman", preview: "i." },
  { value: "upper-roman", preview: "I." },
];

function ListIcon({ ordered }: { ordered: boolean }) {
  return ordered ? (
    <span aria-hidden="true" className="list-icon numbered"><span data-number="1" /><span data-number="" /><span data-number="2" /></span>
  ) : (
    <span aria-hidden="true" className="list-icon bullets"><span /><span /><span /></span>
  );
}

function AlignIcon({ mode }: { mode: "left" | "center" | "right" | "justify" }) {
  return (
    <span aria-hidden="true" className={`align-icon ${mode}`}>
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function IndentIcon({ direction }: { direction: "in" | "out" }) {
  return (
    <span aria-hidden="true" className={`indent-icon ${direction}`}>
      <span className="indent-icon__arrow">{direction === "in" ? ">" : "<"}</span>
      <span />
      <span />
      <span />
    </span>
  );
}
export function RichTextToolbar({
  className = "",
  displayMode = "collapsible",
  profile = "full",
  blockFormat = "",
  fontFamily = "__default__",
  fontFamilies = [],
  fontSize = "",
  lineHeight = "",
  contextState,
  textColor,
  onBeforeCommand,
  onCaseTransform,
  onClearFormatting,
  onCommand,
  onFontFamily,
  onFontSize,
  onInsertInlineImage,
  onLineHeight,
  onLink,
  onSelectAll,
  onTextColorChange,
  onTextHighlightChange,
  onFieldFillChange,
  onFieldFillOpacityChange,
  onCreateBookmark,
  onInsertReference,
  highlightColor = "#fff19c",
  fieldFillColor = "transparent",
  fieldFillOpacity = 50,
  canCreateBookmark = true,
  canInsertReference = true,
  showReferenceControls = false,
  showInlineImage = true,
  showListControls = true,
  showLink = true,
  showOutline = false,
  showStrikethrough = true,
  showTable = false,
  onInsertTable
}: RichTextToolbarProps) {
  const { t } = useI18n();
  const colorPickerExclusiveGroup = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [openListPicker, setOpenListPicker] = useState<"unordered" | "ordered" | null>(null);
  const paragraphPickerRef = useRef<HTMLDetailsElement | null>(null);
  const isFullyExpanded = profile === "full" && displayMode === "expanded";
  const canToggleExpansion = profile === "full" && displayMode === "collapsible";
  const showAdvancedControls = profile === "full" && (isFullyExpanded || isExpanded);
  const showTitleControls = profile === "title";
  const showFormattingControls = showAdvancedControls || showTitleControls;
  const knownFontSizeValues = new Set(RICH_TEXT_FONT_SIZES_PX.map((size) => `${size}px`));
  const knownLineHeightValues = new Set(["0.25","0.5","0.75", "1", "1.15", "1.25", "1.5", "1.7", "2"]);
  const lessonFontOption = fontFamilies.find((font) => font.value === "__default__");
  const lessonFontLabel = lessonFontOption?.label?.trim() || t("richText.lessonFont", undefined, "Police de la leçon");
  const bundledFontOptions = fontFamilies.filter((font) => font.value !== "__default__" && font.group === "bundled");
  const projectFontOptions = fontFamilies.filter((font) => font.value !== "__default__" && font.group === "project");
  const userFontOptions = fontFamilies.filter((font) => font.value !== "__default__" && font.group === "user");
  const hasCurrentFontOption = fontFamilies.some((font) => font.value === fontFamily);
  const fontPickerGroups = [
    { label: "", options: [{ value: "__default__", label: lessonFontLabel, previewFamily: lessonFontOption?.previewFamily },
      ...(fontFamily && fontFamily !== "__default__" && !hasCurrentFontOption
        ? [{ value: fontFamily, label: t("richText.unavailableFont", undefined, "Police indisponible") }] : [])] },
    { label: t("richText.bundledFonts", undefined, "Polices PAIDEIA"), options: bundledFontOptions },
    { label: t("richText.projectFonts", undefined, "Polices du projet"), options: projectFontOptions },
    { label: t("richText.userFonts", undefined, "Mes polices"), options: userFontOptions },
  ];
  const activeState = contextState ?? {
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    outline: false,
    alignment: "",
    list: "",
    indented: false,
    inTable: false,
    dropCap: false,
    canToggleDropCap: false,
    dropCapCharacterSelected: false
  };
  const fontSizeDisabled = Boolean(activeState.dropCapCharacterSelected);

  useEffect(() => {
    setIsExpanded(false);
    setOpenListPicker(null);
    paragraphPickerRef.current?.removeAttribute("open");
  }, [displayMode, profile]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const picker = paragraphPickerRef.current;
      if (picker?.open && event.target instanceof Node && !picker.contains(event.target)) {
        picker.removeAttribute("open");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const picker = paragraphPickerRef.current;
      if (event.key !== "Escape" || !picker?.open) return;
      event.preventDefault();
      event.stopPropagation();
      picker.removeAttribute("open");
      if (event.target instanceof Node && picker.contains(event.target)) {
        picker.querySelector("summary")?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, []);

  useEffect(() => {
    if (!openListPicker) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(`[data-rich-list-picker="${openListPicker}"]`)) return;
      setOpenListPicker(null);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [openListPicker]);

  if (profile === "plain") {
    return null;
  }

  const preserveSelection = (event: ReactMouseEvent<HTMLElement>) => {
    // Keep the edited contentEditable focused while toolbar buttons are used.
    event.preventDefault();
    onBeforeCommand?.();
  };

  const rememberSelection = () => {
    // Native controls such as select/file need their own mousedown behavior.
    onBeforeCommand?.();
  };

  const blockLabel = (tag: string) => {
    if (tag === "P") return t("richText.paragraph", undefined, "Paragraphe");
    if (tag === "H1") return t("richText.headingPrincipal", undefined, "Titre principal");
    if (/^H[2-5]$/.test(tag)) return t("richText.headingLevel", { level: tag.slice(1) }, `Titre niveau ${tag.slice(1)}`);
    return tag || t("richText.format");
  };

  const handleInlineImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onBeforeCommand?.();
      onInsertInlineImage?.(file);
    }
  };

  return (
    <div className={`rich-toolbar ${className}`} data-rich-text-toolbar="true">
      <div className={`rich-toolbar-content ${showAdvancedControls ? "rich-toolbar-content--full" : profile === "full" ? "rich-toolbar-content--compact" : ""}`}>
        {showAdvancedControls ? (
          <>
            <div className="rich-toolbar-row rich-toolbar-row-top">
              <span className="rich-toolbar-group rich-toolbar-typography-group">
                <details className="rich-paragraph-picker" ref={paragraphPickerRef} onPointerDown={rememberSelection}>
                  <summary className="toolbar-select compact" aria-label={t("richText.format")}>
                    {blockLabel(blockFormat)}
                    <img alt="" aria-hidden="true" className="rich-select-chevron" src={selectChevron} />
                  </summary>
                  <div className="rich-paragraph-options">
                    {["P", "H1", "H2", "H3", "H4", "H5"].map(tag => (
                      <button key={tag} type="button" aria-pressed={blockFormat === tag} data-block-format={tag}
                        onMouseDown={preserveSelection}
                        onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                          onCommand("formatBlock", tag);
                        }}>
                        {blockLabel(tag)}
                      </button>
                    ))}
                    <span aria-hidden="true" className="rich-paragraph-options-separator" />
                    <button
                      type="button"
                      aria-pressed={Boolean(activeState.dropCap)}
                      className="rich-drop-cap-option"
                      disabled={!activeState.canToggleDropCap}
                      onMouseDown={preserveSelection}
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onCommand("toggleDropCap");
                      }}
                    >
                      {t("richText.dropCap", undefined, "Lettrine")}
                    </button>
                  </div>
                </details>
                <RichTextFontPicker value={fontFamily} label={t("richText.fontFamily", undefined, "Police")}
                  groups={fontPickerGroups} onBeforeCommand={onBeforeCommand} onChange={onFontFamily} />
                <select
                  aria-label={t("richText.size")}
                  className="toolbar-select"
                  disabled={fontSizeDisabled}
                  onChange={(event) => onFontSize(event.target.value)}
                  onMouseDown={rememberSelection}
                  onPointerDown={rememberSelection}
                  value={fontSize}
                >
                  <option value="" disabled>{t("richText.size", undefined, "Taille")}</option>
                  {fontSize && !knownFontSizeValues.has(fontSize) ? <option value={fontSize}>{fontSize}</option> : null}
                  {RICH_TEXT_FONT_SIZES_PX.map((size) => (
                    <option key={size} value={`${size}px`}>{size}px</option>
                  ))}
                </select>
                <label className="toolbar-line-height" onMouseDown={rememberSelection}>
                  <select
                    aria-label={t("richText.lineHeight", undefined, "Interligne")}
                    className="toolbar-select compact"
                    onChange={(event) => onLineHeight(event.target.value)}
                    onMouseDown={rememberSelection}
                    onPointerDown={rememberSelection}
                    value={lineHeight}
                  >
                    <option value="" disabled>{t("richText.lineHeight", undefined, "Interligne")}</option>
                    {lineHeight && !knownLineHeightValues.has(lineHeight) ? <option value={lineHeight}>{lineHeight.replace(".", ",")}</option> : null}
                    <option value="0.25">0,25</option>
					<option value="0.50">0,50</option>
					<option value="0.75">0,75</option>
                    <option value="1">1</option>
                    <option value="1.15">1,15</option>
                    <option value="1.25">1,25</option>
                    <option value="1.5">1,5</option>
                    <option value="1.7">1,7</option>
                    <option value="2">2</option>
                  </select>
                </label>
              </span>

              <span className="rich-toolbar-group rich-toolbar-insert-group">
                {showInlineImage ? (
                  <label aria-label={t("richText.insertSmallImage", undefined, "Insérer une petite image")} className="toolbar-button icon-only toolbar-file-button" onMouseDown={preserveSelection} title={t("richText.insertSmallImage", undefined, "Insérer une petite image")}>
                    <svg aria-hidden="true" focusable="false" height="24" viewBox="0 0 24 24" width="24">
                      <rect fill="none" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" width="18" x="3" y="4" />
                      <circle cx="8" cy="9" fill="currentColor" r="2" />
                      <path d="M4.5 18 10 12.5l3.5 3.5 2.5-2.5 3.5 4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    </svg>
                    <input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleInlineImageChange} type="file" />
                  </label>
                ) : null}
                <button aria-label={t("richText.insertLink", undefined, "Insérer un lien")} className="toolbar-button icon-only toolbar-link-button" style={showLink && !showTitleControls ? undefined : { display: "none" }} onMouseDown={preserveSelection} onClick={onLink} title={t("richText.insertLink", undefined, "Insérer un lien")} type="button">
                  <svg aria-hidden="true" className="toolbar-link-icon" focusable="false" viewBox="0 0 24 24"><path d="M9.5 14.5 14.5 9" /><path d="M8.25 16.75H6.75a4.5 4.5 0 0 1 0-9h3" /><path d="M15.75 7.25h1.5a4.5 4.5 0 0 1 0 9h-3" /></svg>
                </button>
                {showReferenceControls ? (
                  <>
                    <button aria-label={t("richText.toggleBookmark", undefined, "Créer ou supprimer une balise")} className="toolbar-button icon-only toolbar-bookmark-button" disabled={!canCreateBookmark} onMouseDown={preserveSelection} onClick={onCreateBookmark} title={t("richText.toggleBookmarkOnSelection", undefined, "Créer ou supprimer une balise sur la sélection")} type="button">
                      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
                    </button>
                    <button aria-label={t("richText.toggleReference", undefined, "Ajouter ou supprimer un renvoi vers une balise")} className="toolbar-button icon-only toolbar-reference-button" disabled={!canInsertReference} onMouseDown={preserveSelection} onClick={onInsertReference} title={t("richText.toggleReferenceOnSelection", undefined, "Ajouter ou supprimer un renvoi sur la sélection")} type="button">
                      <svg aria-hidden="true" className="toolbar-reference-icon" focusable="false" viewBox="0 0 24 24">
                        <path className="toolbar-reference-bookmark-shape" d="M6 3h12v18l-6-4-6 4z" />
                        <path className="toolbar-reference-arrow-shape" d="M2.5 12h6.8" />
                        <path className="toolbar-reference-arrow-shape" d="M8.9 9.6 12 12 8.9 14.4" />
                      </svg>
                    </button>
                  </>
                ) : null}
              </span>

            </div>

            <div className="rich-toolbar-row rich-toolbar-row-middle">
              <span className="rich-toolbar-group rich-toolbar-paragraph-group">
                <button aria-label={t("richText.alignLeft", undefined, "Aligner à gauche")} aria-pressed={activeState.alignment === "left"} className={`toolbar-button icon-only ${activeState.alignment === "left" ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("justifyLeft")} title={t("richText.alignLeft", undefined, "Aligner à gauche")} type="button"><AlignIcon mode="left" /></button>
                <button aria-label={t("richText.alignCenter", undefined, "Centrer")} aria-pressed={activeState.alignment === "center"} className={`toolbar-button icon-only ${activeState.alignment === "center" ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("justifyCenter")} title={t("richText.alignCenter", undefined, "Centrer")} type="button"><AlignIcon mode="center" /></button>
                <button aria-label={t("richText.alignRight", undefined, "Aligner à droite")} aria-pressed={activeState.alignment === "right"} className={`toolbar-button icon-only ${activeState.alignment === "right" ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("justifyRight")} title={t("richText.alignRight", undefined, "Aligner à droite")} type="button"><AlignIcon mode="right" /></button>
                <button aria-label={t("richText.justify", undefined, "Justifier")} aria-pressed={activeState.alignment === "justify"} className={`toolbar-button icon-only ${activeState.alignment === "justify" ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("justifyFull")} title={t("richText.justify", undefined, "Justifier")} type="button"><AlignIcon mode="justify" /></button>
                {showListControls ? (
                  <>
                    {([
                      {
                        kind: "unordered" as const,
                        command: "insertUnorderedList",
                        label: t("richText.bulletList", undefined, "Liste à puces"),
                        markers: UNORDERED_LIST_MARKERS,
                      },
                      {
                        kind: "ordered" as const,
                        command: "insertOrderedList",
                        label: t("richText.numberedList", undefined, "Liste numérotée"),
                        markers: ORDERED_LIST_MARKERS,
                      },
                    ]).map((listControl) => (
                      <span className={`rich-list-control ${activeState.list === listControl.kind ? "active" : ""}`} key={listControl.kind}>
                        <button
                          aria-label={listControl.label}
                          aria-pressed={activeState.list === listControl.kind}
                          className="rich-list-control__main"
                          onMouseDown={preserveSelection}
                          onClick={() => onCommand(listControl.command)}
                          title={listControl.label}
                          type="button"
                        >
                          <ListIcon ordered={listControl.kind === "ordered"} />
                        </button>
                        <details
                          className="rich-list-control__picker"
                          data-rich-list-picker={listControl.kind}
                          onPointerDown={rememberSelection}
                          open={openListPicker === listControl.kind}
                        >
                          <summary
                            aria-label={t("richText.chooseListMarker", { label: listControl.label })}
                            onClick={(event) => {
                              event.preventDefault();
                              setOpenListPicker((current) => current === listControl.kind ? null : listControl.kind);
                            }}
                            title={t("richText.chooseListMarker", { label: listControl.label })}
                          />
                          <div className={`rich-list-marker-options rich-list-marker-options--${listControl.kind}`} role="group" aria-label={listControl.label}>
                            {listControl.markers.map((marker) => (
                              <button
                                aria-label={`${listControl.label} ${marker.preview}`}
                                aria-pressed={activeState.list === listControl.kind && activeState.listMarker === marker.value}
                                key={marker.value}
                                onMouseDown={preserveSelection}
                                onClick={() => {
                                  onCommand("setListMarker", marker.value);
                                }}
                                title={`${listControl.label} ${marker.preview}`}
                                type="button"
                              >{marker.preview}</button>
                            ))}
                          </div>
                        </details>
                      </span>
                    ))}
                    <button aria-label={t("richText.outdent", undefined, "Diminuer le retrait")} className="toolbar-button icon-only" disabled={activeState.inTable} onMouseDown={preserveSelection} onClick={() => onCommand("outdent")} title={t("richText.outdent", undefined, "Diminuer le retrait")} type="button"><IndentIcon direction="out" /></button>
                    <button aria-label={t("richText.indent", undefined, "Augmenter le retrait")} aria-pressed={activeState.indented} className={`toolbar-button icon-only ${activeState.indented ? "active" : ""}`} disabled={activeState.inTable} onMouseDown={preserveSelection} onClick={() => onCommand("indent")} title={t("richText.indent", undefined, "Augmenter le retrait")} type="button"><IndentIcon direction="in" /></button>
                  </>
                ) : null}
              </span>
              {showTable && onInsertTable ? (
                <RichTextTableInsertControl
                  onBeforeOpen={onBeforeCommand}
                  onInsert={onInsertTable}
                />
              ) : (
                <span
                  className="rich-toolbar-group rich-toolbar-empty-group-case-group"
                  aria-hidden="true"
                />
              )}

              <span className="rich-toolbar-group rich-toolbar-case-group">
                <button aria-label={t("richText.uppercase")} className="toolbar-button" onMouseDown={preserveSelection} onClick={() => onCaseTransform("upper")} title={t("richText.uppercase")} type="button">MAJ</button>
                <button aria-label={t("richText.lowercase")} className="toolbar-button" onMouseDown={preserveSelection} onClick={() => onCaseTransform("lower")} title={t("richText.lowercase")} type="button">min</button>
                <button aria-label={t("richText.capitalize")} className="toolbar-button" onMouseDown={preserveSelection} onClick={() => onCaseTransform("capitalize")} title={t("richText.capitalize")} type="button">Abc</button>
              </span>
            </div>

            <div className="rich-toolbar-row rich-toolbar-row-bottom">
              <span className="rich-toolbar-group rich-toolbar-style-group">
                <button aria-label={t("richText.bold")} aria-pressed={activeState.bold} className={`toolbar-button ${activeState.bold ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("bold")} title={t("richText.bold")} type="button"><span className="toolbar-bolded">B</span></button>
                <button aria-label={t("richText.italic")} aria-pressed={activeState.italic} className={`toolbar-button ${activeState.italic ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("italic")} title={t("richText.italic")} type="button"><span className="toolbar-italicized">i</span></button>
                <button aria-label={t("richText.underline")} aria-pressed={activeState.underline} className={`toolbar-button ${activeState.underline ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("underline")} title={t("richText.underline")} type="button"><span className="toolbar-underlined">S</span></button>
                {showStrikethrough ? <button aria-label={t("richText.strikethrough")} aria-pressed={activeState.strikeThrough} className={`toolbar-button compact-text ${activeState.strikeThrough ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("strikeThrough")} title={t("richText.strikethrough")} type="button"><span className="toolbar-struck">abc</span></button> : null}
                {/*
                  Bouton Contour désactivé volontairement : le renforcement du
                  contraste sera traité comme une option d'apparence, hors RichBar.
                  Le bloc est conservé ici pour une éventuelle réactivation future.
                  {showOutline ? (
                    <button aria-label={t("richText.outline", undefined, "Contour")} aria-pressed={Boolean(activeState.outline)} className={`toolbar-button icon-only toolbar-outline-button ${activeState.outline ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("outline")} title={t("richText.outline", undefined, "Contour")} type="button"><span aria-hidden="true" className="toolbar-outline-glyph">A</span></button>
                  ) : null}
                */}
              </span>

              <span className="rich-toolbar-group rich-toolbar-colors-group">
                <span className="toolbar-color-label">{t("richText.color", undefined, "Couleur")}</span>
                <ColorPickerField
                  ariaLabel={t("richText.textColor", undefined, "Couleur du texte")}
                  exclusiveGroup={colorPickerExclusiveGroup}
                  onBeforeOpen={onBeforeCommand}
                  onChange={onTextColorChange}
                  rememberedColorKey="rich-text-text-color"
                  splitApply
                  value={textColor}
                  triggerVariant="font-color"
                />
                {showReferenceControls && onTextHighlightChange ? (
                  <ColorPickerField
                    allowTransparent
                    ariaLabel={t("richText.highlightColor", undefined, "Couleur de surlignage")}
                    exclusiveGroup={colorPickerExclusiveGroup}
                    onBeforeOpen={onBeforeCommand}
                    onChange={onTextHighlightChange}
                    rememberedColorKey="rich-text-highlight-color"
                    splitApply
                    triggerVariant="highlight"
                    value={highlightColor}
                  />
                ) : null}
                {showReferenceControls && onFieldFillChange ? (
                  <span className="toolbar-field-fill-controls">
                    <ColorPickerField
                      allowTransparent
                      ariaLabel={t("richText.fieldFillColor", undefined, "Couleur de fond du champ")}
                      exclusiveGroup={colorPickerExclusiveGroup}
                      onBeforeOpen={onBeforeCommand}
                      onChange={onFieldFillChange}
                      triggerVariant="field-fill"
                      value={fieldFillColor}
                    />
                    {onFieldFillOpacityChange ? (
                      <RichTextOpacityPicker label={t("lessonSettings.opacity", undefined, "Opacité")}
                        value={fieldFillOpacity} onBeforeCommand={onBeforeCommand} onChange={onFieldFillOpacityChange} />
                    ) : null}
                  </span>
                ) : null}
              </span>
              <span className="rich-toolbar-action-end">
                <span className="rich-toolbar-group rich-toolbar-empty-group-action-block"
                      aria-hidden="true"
                />

                <span className="rich-toolbar-group rich-toolbar-utility-group">
                  <button aria-label={t("richText.selectAll", undefined, "Sélectionner tout")} className="toolbar-button icon-only toolbar-selectall-button" onMouseDown={preserveSelection} onClick={onSelectAll} title={t("richText.selectAll", undefined, "Sélectionner tout")} type="button">
                    <img className="toolbar-selectall-icon" src={selectAllIcon} alt="" draggable={false} />
                  </button>
                  <button aria-label={t("richText.clearFormatting", undefined, "Effacer le formatage")} className="toolbar-button icon-only toolbar-clear-format-button" onMouseDown={preserveSelection} onClick={onClearFormatting} title={t("richText.clearFormatting", undefined, "Effacer le formatage")} type="button">
                    <svg aria-hidden="true" className="toolbar-clear-format-icon" focusable="false" viewBox="0 0 24 24">
                      <g transform="rotate(-42 12 12)">
                        <rect x="5" y="7" width="14" height="10" rx="2.2" fill="#E7A1B2" />
                        <rect x="14" y="7" width="5" height="10" rx="2.2" fill="#17284D" />
                        <line x1="14" y1="7.8" x2="14" y2="16.2" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.9" />
                      </g>
                    </svg>
                  </button>
                </span>
              </span>

            </div>
          </>
        ) : (
          <>
            <button aria-label={t("richText.bold")} aria-pressed={activeState.bold} className={`toolbar-button ${activeState.bold ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("bold")} title={t("richText.bold")} type="button"><span className="toolbar-bolded">B</span></button>
            <button aria-label={t("richText.italic")} aria-pressed={activeState.italic} className={`toolbar-button ${activeState.italic ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("italic")} title={t("richText.italic")} type="button"><span className="toolbar-italicized">i</span></button>
            {profile !== "title" ? <button aria-label={t("richText.underline")} aria-pressed={activeState.underline} className={`toolbar-button ${activeState.underline ? "active" : ""}`} onMouseDown={preserveSelection} onClick={() => onCommand("underline")} title={t("richText.underline")} type="button"><span className="toolbar-underlined">S</span></button> : null}
            {canToggleExpansion ? (
              <button aria-expanded={isExpanded} aria-label={isExpanded ? t("richText.collapseToolbar", undefined, "Réduire la barre d'outils") : t("richText.expandToolbar", undefined, "Agrandir la barre d'outils")} className={`toolbar-button icon-only toolbar-expand-toggle-inline ${isExpanded ? "expanded" : ""}`} onMouseDown={preserveSelection} onClick={() => setIsExpanded((current) => !current)} title={isExpanded ? t("richText.collapse", undefined, "Réduire") : t("richText.expand", undefined, "Agrandir")} type="button">
                <svg aria-hidden="true" className="toolbar-chevron-icon" viewBox="0 0 20 20">{isExpanded ? <><path d="M4 12l6-6 6 6" /><path d="M4 17l6-6 6 6" /></> : <><path d="M4 8l6 6 6-6" /><path d="M4 3l6 6 6-6" /></>}</svg>
              </button>
            ) : null}
            {profile === "restricted" ? (
              <select aria-label={t("richText.size")} className="toolbar-select" disabled={fontSizeDisabled} onChange={(event) => onFontSize(event.target.value)} onMouseDown={rememberSelection} onPointerDown={rememberSelection} value={fontSize}>
                <option value="" disabled>{t("richText.size", undefined, "Taille")}</option>
                {fontSize && !knownFontSizeValues.has(fontSize) ? <option value={fontSize}>{fontSize}</option> : null}
                {RICH_TEXT_FONT_SIZES_PX.map((size) => <option key={size} value={`${size}px`}>{size}px</option>)}
              </select>
            ) : null}
            {showFormattingControls && showTitleControls ? (
              <>
                <span className="rich-toolbar-group rich-toolbar-font-metrics-group">
                <RichTextFontPicker value={fontFamily} label={t("richText.fontFamily", undefined, "Police")}
                  groups={fontPickerGroups} onBeforeCommand={onBeforeCommand} onChange={onFontFamily} />
                  <select aria-label={t("richText.size")} className="toolbar-select" disabled={fontSizeDisabled} onChange={(event) => onFontSize(event.target.value)} onMouseDown={rememberSelection} onPointerDown={rememberSelection} value={fontSize}>
                    <option value="" disabled>{t("richText.size", undefined, "Taille")}</option>
                    {fontSize && !knownFontSizeValues.has(fontSize) ? <option value={fontSize}>{fontSize}</option> : null}
                    {RICH_TEXT_FONT_SIZES_PX.map((size) => <option key={size} value={`${size}px`}>{size}px</option>)}
                  </select>
                  <label className="toolbar-line-height" onMouseDown={rememberSelection}>
                    <select aria-label={t("richText.lineHeight", undefined, "Interligne")} className="toolbar-select compact" onChange={(event) => onLineHeight(event.target.value)} onMouseDown={rememberSelection} onPointerDown={rememberSelection} value={lineHeight}>
                      <option value="" disabled>{t("richText.lineHeight", undefined, "Interligne")}</option>
                      {lineHeight && !knownLineHeightValues.has(lineHeight) ? <option value={lineHeight}>{lineHeight.replace(".", ",")}</option> : null}
                      <option value="0.75">0,75</option><option value="1">1</option><option value="1.15">1,15</option><option value="1.25">1,25</option><option value="1.5">1,5</option><option value="1.7">1,7</option><option value="2">2</option>
                    </select>
                  </label>
                </span>
                <span className="rich-toolbar-group rich-toolbar-case-group">
                  <button aria-label={t("richText.uppercase")} className="toolbar-button" onMouseDown={preserveSelection} onClick={() => onCaseTransform("upper")} title={t("richText.uppercase")} type="button">MAJ</button>
                  <button aria-label={t("richText.lowercase")} className="toolbar-button" onMouseDown={preserveSelection} onClick={() => onCaseTransform("lower")} title={t("richText.lowercase")} type="button">min</button>
                  <button aria-label={t("richText.capitalize")} className="toolbar-button" onMouseDown={preserveSelection} onClick={() => onCaseTransform("capitalize")} title={t("richText.capitalize")} type="button">Abc</button>
                </span>
                <button aria-label={t("richText.clearFormatting", undefined, "Effacer le formatage")} className="toolbar-button icon-only toolbar-clear-format-button" onMouseDown={preserveSelection} onClick={onClearFormatting} title={t("richText.clearFormatting", undefined, "Effacer le formatage")} type="button">
                  <svg aria-hidden="true" className="toolbar-clear-format-icon" focusable="false" viewBox="0 0 24 24">
                      <g transform="rotate(-42 12 12)">
                        <rect x="5" y="7" width="14" height="10" rx="2.2" fill="#E7A1B2" />
                        <rect x="14" y="7" width="5" height="10" rx="2.2" fill="#17284D" />
                        <line x1="14" y1="7.8" x2="14" y2="16.2" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.9" />
                      </g>
                    </svg>
                </button>
                <span className="rich-toolbar-group rich-toolbar-colors-group">
                  <span className="toolbar-color-label">{t("richText.color", undefined, "Couleur")}</span>
                  <ColorPickerField ariaLabel={t("richText.textColor", undefined, "Couleur du texte")} exclusiveGroup={colorPickerExclusiveGroup} onBeforeOpen={onBeforeCommand} onChange={onTextColorChange} rememberedColorKey="rich-text-text-color" splitApply value={textColor} triggerVariant="font-color" />
                </span>
              </>
            ) : null}
          </>
        )}
      </div>
      {canToggleExpansion ? (
        <button
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t("richText.collapseToolbar", undefined, "Réduire la barre d'outils") : t("richText.expandToolbar", undefined, "Agrandir la barre d'outils")}
          className={`toolbar-expand-toggle ${isExpanded ? "expanded" : ""}`}
          onMouseDown={preserveSelection}
          onClick={() => setIsExpanded((current) => !current)}
          title={isExpanded ? t("richText.collapse", undefined, "Réduire") : t("richText.expand", undefined, "Agrandir")}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="toolbar-chevron-icon"
            viewBox="0 0 20 20"
          >
            {isExpanded ? (
              <>
                <path d="M4 12l6-6 6 6" />
                <path d="M4 17l6-6 6 6" />
              </>
            ) : (
              <>
                <path d="M4 8l6 6 6-6" />
                <path d="M4 3l6 6 6-6" />
              </>
            )}
          </svg>
        </button>
      ) : null}
    </div>
  );
}
