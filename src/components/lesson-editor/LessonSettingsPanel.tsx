import type { RefObject } from "react";
import gearOffIcon from "../../assets/gear-off.png";
import gearOnIcon from "../../assets/gear-on.png";
import {
  DEFAULT_COURSE_COVER_STYLE,
  clampCourseCoverHeight,
  courseCoverButtonPositionForTitlePosition,
  courseCoverTitleAlignForPosition,
  normalizeCourseCoverStyle,
  normalizeCourseCoverTitlePosition
} from "../../app/courseCoverConfig";
import { normalizeCourseAppearance } from "../../app/courseAppearanceConfig";
import {
  SCORM_ALLOWED_STATUS_PAIRS,
  SCORM_BLOCKING_TRACKING,
  SCORM_CERTIFICATION_TRACKING,
  SCORM_COMPLETION_TRACKING
} from "../../app/appConfig";
import { useI18n } from "../../i18n/react";
import { ColorPickerField } from "../color-picker/ColorPickerPopover";
import type {
  ChapterScormTracking,
  ChapterScormTrackingMode,
  CourseAppearance,
  CourseCoverStyle,
  LessonCustomFont,
  PaideiaProject
} from "../../types/project";

type BundledLessonFont = {
  id: string;
  family: string;
};

type SettingsSection = "cover" | "spacing" | "font" | "scorm";

type LessonSettingsPanelProps = {
  activeChapterHasLmsSender: boolean;
  activeChapterTracking: ChapterScormTracking;
  activitySpacing: number;
  bundledFonts: readonly BundledLessonFont[];
  busyAction: string | null;
  courseCoverHeight: number;
  courseImagePositioningAvailable: boolean;
  courseCoverOverlayOpacity: string;
  courseImageInputRef: RefObject<HTMLInputElement>;
  courseImageUrl: string | null;
  fontSectionOpen: boolean;
  lessonSettingsRef: RefObject<HTMLDivElement>;
  open: boolean;
  coverSectionOpen: boolean;
  project: PaideiaProject | null | undefined;
  projectFontInputRef: RefObject<HTMLInputElement>;
  scormSectionOpen: boolean;
  spacingSectionOpen: boolean;
  userFontInputRef: RefObject<HTMLInputElement>;
  userFonts: LessonCustomFont[];
  showCoverSection?: boolean;
  showTrigger?: boolean;
  onActivitySpacingChange: (value: number) => void;
  onActivitySpacingCommit: () => void;
  onChapterScormTrackingChange: (tracking: ChapterScormTracking) => void;
  onCourseCoverHeightChange: (value: number) => void;
  onCourseCoverOverlayOpacityChange: (value: string) => void;
  onCourseCoverOverlayOpacityCommit: () => void;
  onCourseCoverStyleChange: (patch: Partial<CourseCoverStyle>) => void;
  onCourseAppearanceChange: (patch: Partial<CourseAppearance>) => void;
  onHideChapterTitleBannerChange: (hidden: boolean) => void;
  onCourseImageRemove: () => void;
  onDeleteUserFontRequest: (font: LessonCustomFont) => void;
  onDeleteProjectFontRequest: (font: LessonCustomFont) => void;
  onSelectImportedFont: (fontId: string) => void;
  onOpenToggle: () => void;
  onSectionToggle: (section: SettingsSection) => void;
  onSelectBundledFont: (fontId: string) => void;
  onSelectUserFont: (fontId: string) => void;
};

export function LessonSettingsGearIcon() {
  return (
    <span className="paideia-gear-control" aria-hidden="true">
      <img alt="" className="paideia-gear-icon off" src={gearOffIcon} />
      <img alt="" className="paideia-gear-icon on" src={gearOnIcon} />
    </span>
  );
}

function chapterTrackingFromMode(mode: ChapterScormTrackingMode): ChapterScormTracking {
  switch (mode) {
    case "quiz-blocking":
      return { ...SCORM_BLOCKING_TRACKING };
    case "quiz-certification":
      return { ...SCORM_CERTIFICATION_TRACKING };
    case "advanced":
      return { ...SCORM_CERTIFICATION_TRACKING, mode: "advanced" };
    default:
      return { ...SCORM_COMPLETION_TRACKING };
  }
}

function applyTrackingPair(
  tracking: ChapterScormTracking,
  successStatus: ChapterScormTracking["successStatus"],
  failureStatus: ChapterScormTracking["failureStatus"]
): ChapterScormTracking {
  if (!SCORM_ALLOWED_STATUS_PAIRS.has(`${successStatus}:${failureStatus}`)) {
    return tracking;
  }
  return { ...tracking, successStatus, failureStatus };
}

export function LessonSettingsPanel({
  activeChapterHasLmsSender,
  activeChapterTracking,
  activitySpacing,
  bundledFonts,
  busyAction,
  courseCoverHeight,
  courseImagePositioningAvailable,
  courseCoverOverlayOpacity,
  courseImageInputRef,
  courseImageUrl,
  fontSectionOpen,
  lessonSettingsRef,
  open,
  coverSectionOpen,
  project,
  projectFontInputRef,
  scormSectionOpen,
  spacingSectionOpen,
  userFontInputRef,
  userFonts,
  showCoverSection = true,
  showTrigger = true,
  onActivitySpacingChange,
  onActivitySpacingCommit,
  onChapterScormTrackingChange,
  onCourseCoverHeightChange,
  onCourseCoverOverlayOpacityChange,
  onCourseCoverOverlayOpacityCommit,
  onCourseCoverStyleChange,
  onCourseAppearanceChange,
  onHideChapterTitleBannerChange,
  onCourseImageRemove,
  onDeleteUserFontRequest,
  onDeleteProjectFontRequest,
  onSelectImportedFont,
  onOpenToggle,
  onSectionToggle,
  onSelectBundledFont,
  onSelectUserFont
}: LessonSettingsPanelProps) {
  const { t } = useI18n();
  const courseAppearance = normalizeCourseAppearance(project?.courseAppearance);
  const courseCoverStyle = normalizeCourseCoverStyle(project?.courseCoverStyle);
  const courseAppearanceBusy = busyAction === "update-project-course-appearance";
  return (
    <div className="lesson-settings" id="lesson-settings-panel" ref={lessonSettingsRef}>
      {showTrigger ? <button
        aria-expanded={open}
        aria-controls="lesson-settings-panel-content"
        aria-label={t("lessonSettings.buttonAria", undefined, "Paramètres de la leçon")}
        className="lesson-settings-button"
        onClick={onOpenToggle}
        title={t("lessonSettings.buttonTitle", undefined, "Paramètres et personnalisation de la leçon")}
        type="button"
      >
        <LessonSettingsGearIcon />
      </button> : null}
      {open ? (
        <div className="lesson-settings-panel" id="lesson-settings-panel-content">
          <div className="lesson-settings-panel-scroll">
            {showCoverSection ? <div className={`lesson-settings-row lesson-cover-row ${coverSectionOpen ? "open" : "collapsed"}`}>
              <button aria-expanded={coverSectionOpen} className="lesson-cover-toggle" onClick={() => onSectionToggle("cover")} type="button">
                <span><strong>{t("lessonSettings.coverSection", undefined, "Bandeau de leçon")}</strong></span>
                <span aria-hidden="true" className="lesson-cover-chevron">⌄</span>
              </button>
              {coverSectionOpen ? (
                <div className="lesson-cover-controls">
                  <section className="lesson-cover-section">
                    <h4>{t("lessonSettings.courseImage", undefined, "Définir une image de cours")}</h4>
                    {courseImageUrl && project?.courseImageRef ? (
                      <div className="lesson-course-image-selected">
                        <div className="lesson-course-image-thumb">
                          <img alt="" src={courseImageUrl} />
                          <button
                            aria-label={t("lessonSettings.removeCourseImage", undefined, "Supprimer l'image de cours")}
                            className="asset-remove-badge"
                            disabled={busyAction === "course-image-remove"}
                            onClick={onCourseImageRemove}
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                        <strong>{project.courseImageRef.split(/[\\/]/).pop()}</strong>
                      </div>
                    ) : (
                      <button
                        className="ghost-pill compact"
                        disabled={busyAction === "course-image"}
                        onClick={() => courseImageInputRef.current?.click()}
                        type="button"
                      >
                        {t("common.choose", undefined, "Choisir")}
                      </button>
                    )}
                  </section>
                  <section className="lesson-cover-section">
                    <h4>{t("lessonSettings.height", undefined, "Hauteur")}</h4>
                    <label className="lesson-cover-select">
                      <select
                        aria-label={t("lessonSettings.coverHeightAria", undefined, "Hauteur du bandeau de leçon")}
                        disabled={busyAction === "update-project-course-cover"}
                        onChange={(event) => onCourseCoverHeightChange(clampCourseCoverHeight(Number(event.target.value)))}
                        value={courseCoverHeight}
                      >
                        <option value={300}>{t("lessonSettings.coverHeightSmall", undefined, "Petite · 300px")}</option>
                        <option value={400}>{t("lessonSettings.coverHeightMedium", undefined, "Moyenne · 400px")}</option>
                        <option value={500}>{t("lessonSettings.coverHeightLarge", undefined, "Grande · 500px")}</option>
                      </select>
                    </label>
                  </section>
                  {courseImagePositioningAvailable ? (
                    <section className="lesson-cover-section lesson-cover-position-hint">
                      {t("lessonSettings.courseImagePositionHint")}
                    </section>
                  ) : null}
                  <section className="lesson-cover-section">
                    <h4>{t("lessonSettings.gradient", undefined, "Dégradé")}</h4>
                    <div className="lesson-cover-gradient-grid">
                      <label className="lesson-cover-color lesson-cover-color-inline">
                        <span>{t("common.color", undefined, "Couleur")}</span>
                        <ColorPickerField
                          positioning="lesson-options"
                          allowTransparent
                          ariaLabel={t("lessonSettings.gradientColorAria", undefined, "Couleur du dégradé du bandeau")}
                          onChange={(overlayColor) => onCourseCoverStyleChange({ overlayColor })}
                          value={normalizeCourseCoverStyle(project?.courseCoverStyle).overlayColor ?? DEFAULT_COURSE_COVER_STYLE.overlayColor ?? "#123a7a"}
                        />
                      </label>
                      <label className="lesson-cover-number">
                        <span>{t("lessonSettings.opacity", undefined, "Opacité")}</span>
                        <input
                          aria-label={t("lessonSettings.opacity", undefined, "Opacité")}
                          disabled={busyAction === "update-project-course-cover"}
                          max={100}
                          min={0}
                          onBlur={onCourseCoverOverlayOpacityCommit}
                          onChange={(event) => {
                            if (/^\d{0,3}$/.test(event.target.value)) {
                              onCourseCoverOverlayOpacityChange(event.target.value);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              onCourseCoverOverlayOpacityCommit();
                              event.currentTarget.blur();
                            }
                          }}
                          step={1}
                          type="number"
                          value={courseCoverOverlayOpacity}
                        />
                      </label>
                      <label className="lesson-cover-select">
                        <span>{t("lessonSettings.position", undefined, "Position")}</span>
                        <select
                          disabled={busyAction === "update-project-course-cover"}
                          onChange={(event) => onCourseCoverStyleChange({ overlayPosition: event.target.value as CourseCoverStyle["overlayPosition"] })}
                          value={normalizeCourseCoverStyle(project?.courseCoverStyle).overlayPosition}
                        >
                          <option value="left">{t("lessonSettings.positionLeft", undefined, "Gauche")}</option>
                          <option value="center">{t("lessonSettings.positionBottomToTop", undefined, "Bas vers haut")}</option>
                          <option value="right">{t("lessonSettings.positionRight", undefined, "Droite")}</option>
                          <option value="full">{t("lessonSettings.positionFull", undefined, "Complet")}</option>
                        </select>
                      </label>
                      <label className="lesson-cover-select">
                        <span>{t("lessonSettings.spread", undefined, "Diffusion")}</span>
                        <select
                          disabled={busyAction === "update-project-course-cover"}
                          onChange={(event) => onCourseCoverStyleChange({ overlaySpread: event.target.value as CourseCoverStyle["overlaySpread"] })}
                          value={normalizeCourseCoverStyle(project?.courseCoverStyle).overlaySpread}
                        >
                          <option value="compact">{t("lessonSettings.spreadCompact", undefined, "Compacte")}</option>
                          <option value="normal">{t("lessonSettings.spreadNormal", undefined, "Normale")}</option>
                          <option value="wide">{t("lessonSettings.spreadWide", undefined, "Large")}</option>
                        </select>
                      </label>
                    </div>
                  </section>
                  <section className="lesson-cover-section">
                    <h4>{t("lessonSettings.textAndButton", undefined, "Texte et bouton")}</h4>
                    <div className="lesson-cover-control-grid lesson-cover-inline-row">
                      <label className="lesson-cover-select lesson-cover-select-inline">
                        <span>{t("lessonSettings.position", undefined, "Position")}</span>
                        <select
                          disabled={busyAction === "update-project-course-cover"}
                          onChange={(event) => {
                            const titlePosition = normalizeCourseCoverTitlePosition(event.target.value);
                            onCourseCoverStyleChange({
                              titlePosition,
                              titleAlign: courseCoverTitleAlignForPosition(titlePosition),
                              buttonPosition: courseCoverButtonPositionForTitlePosition(titlePosition)
                            });
                          }}
                          value={normalizeCourseCoverStyle(project?.courseCoverStyle).titlePosition}
                        >
                          <option value="left-bottom">{t("lessonSettings.positionLeft", undefined, "Gauche")}</option>
                          <option value="center-bottom">{t("lessonSettings.positionCenter", undefined, "Centre")}</option>
                          <option value="right-bottom">{t("lessonSettings.positionRight", undefined, "Droite")}</option>
                        </select>
                      </label>
                      <label className="lesson-cover-select lesson-cover-select-inline">
                        <span>{t("header.textContrastEnhancement")}</span>
                        <select
                          disabled={busyAction === "update-project-course-cover"}
                          onChange={(event) => onCourseCoverStyleChange({ titleOutline: event.target.value as CourseCoverStyle["titleOutline"] })}
                          value={courseCoverStyle.titleOutline}
                        >
                          <option value="none">{t("common.none")}</option>
                          <option value="thin">{t("header.textOutlineThin")}</option>
                          <option value="medium">{t("header.textOutlineMedium")}</option>
                          <option value="thick">{t("header.textOutlineThick")}</option>
                        </select>
                      </label>
                      <label className="lesson-cover-select lesson-cover-select-inline">
                        <span>{t("header.textOutlineColor")}</span>
                        <select
                          disabled={busyAction === "update-project-course-cover" || courseCoverStyle.titleOutline === "none"}
                          onChange={(event) => onCourseCoverStyleChange({ titleOutlineColor: event.target.value as CourseCoverStyle["titleOutlineColor"] })}
                          value={courseCoverStyle.titleOutlineColor}
                        >
                          <option value="light">{t("header.textOutlineLight")}</option>
                          <option value="dark">{t("header.textOutlineDark")}</option>
                        </select>
                      </label>
                    </div>
                  </section>
                </div>
              ) : null}
            </div> : null}

            <div className={`lesson-settings-row lesson-cover-row ${spacingSectionOpen ? "open" : "collapsed"}`}>
              <button aria-expanded={spacingSectionOpen} className="lesson-cover-toggle" onClick={() => onSectionToggle("spacing")} type="button">
                <span><strong>{t("lessonSettings.otherSettings", undefined, "Apparence de la leçon")}</strong></span>
                <span aria-hidden="true" className="lesson-cover-chevron">⌄</span>
              </button>
              {spacingSectionOpen ? (
                <div className="lesson-cover-controls">
                  <section className="lesson-cover-section lesson-spacing-section">
                    <div className="lesson-spacing-copy">
                      <h4>{t("lessonSettings.activitySpacing", undefined, "Espacement entre activités")}</h4>
                      <p className="lesson-settings-helper">{t("lessonSettings.activitySpacingDefault", undefined, "Défaut : 30px haut / bas")}</p>
                    </div>
                    <label className="lesson-spacing-control">
                      <input
                        aria-label={t("lessonSettings.activitySpacing", undefined, "Espacement entre activités")}
                        disabled={busyAction === "update-project-activity-spacing"}
                        max={60}
                        min={15}
                        onBlur={onActivitySpacingCommit}
                        onChange={(event) => onActivitySpacingChange(Number(event.target.value))}
                        onKeyUp={onActivitySpacingCommit}
                        onPointerUp={onActivitySpacingCommit}
                        step={1}
                        type="range"
                        value={activitySpacing}
                      />
                      <strong>{activitySpacing}px</strong>
                    </label>
                  </section>
                  <section className="lesson-cover-section lesson-appearance-section">
                    <h4>{t("lessonSettings.activityAppearance", undefined, "Aspect des activités")}</h4>
                    <label className="lesson-appearance-toggle">
                      <span>
                        <strong>{t("lessonSettings.roundedCorners", undefined, "Coins arrondis")}</strong>
                        <small>{t("lessonSettings.roundedCornersHelp", undefined, "Appliquer aux activités et aux images, sauf contrat spécifique.")}</small>
                      </span>
                      <input
                        checked={courseAppearance.roundedCorners}
                        disabled={courseAppearanceBusy}
                        onChange={(event) => onCourseAppearanceChange({ roundedCorners: event.target.checked })}
                        type="checkbox"
                      />
                    </label>
                    <label className="lesson-appearance-toggle">
                      <span>
                        <strong>{t("lessonSettings.shadows", undefined, "Ombres")}</strong>
                        <small>{t("lessonSettings.shadowsHelp", undefined, "Appliquer les ombres aux activités qui les prennent en charge.")}</small>
                      </span>
                      <input
                        checked={courseAppearance.shadows}
                        disabled={courseAppearanceBusy}
                        onChange={(event) => onCourseAppearanceChange({ shadows: event.target.checked })}
                        type="checkbox"
                      />
                    </label>
                    <label className="lesson-appearance-toggle">
                      <span>
                        <strong>{t("lessonSettings.hideChapterTitleBanner", undefined, "Masquer le bandeau du titre des chapitres")}</strong>
                        <small>{t("lessonSettings.hideChapterTitleBannerHelp", undefined, "Masquer ce bandeau uniquement dans l’aperçu LMS et le SCORM.")}</small>
                      </span>
                      <input
                        checked={project?.hideChapterTitleBanner === true}
                        disabled={busyAction === "update-project-chapter-title-banner"}
                        onChange={(event) => onHideChapterTitleBannerChange(event.target.checked)}
                        type="checkbox"
                      />
                    </label>
                  </section>
                  <section
                    aria-label={t("lessonSettings.textColor", undefined, "Couleur du texte")}
                    className="lesson-cover-section lesson-appearance-section"
                    role="radiogroup"
                  >
                    <h4>{t("lessonSettings.textColor", undefined, "Couleur du texte")}</h4>
                    <label className="lesson-appearance-radio">
                      <input
                        checked={courseAppearance.textColorMode === "default"}
                        disabled={courseAppearanceBusy}
                        name="course-text-color-mode"
                        onChange={() => onCourseAppearanceChange({ textColorMode: "default" })}
                        type="radio"
                      />
                      <span>
                        <strong>{t("lessonSettings.defaultColor", undefined, "Couleur par défaut")}</strong>
                        <small>{t("lessonSettings.defaultBlack", undefined, "Noir · #222222")}</small>
                      </span>
                    </label>
                    <label className="lesson-appearance-radio lesson-appearance-radio-custom">
                      <input
                        checked={courseAppearance.textColorMode === "custom"}
                        disabled={courseAppearanceBusy}
                        name="course-text-color-mode"
                        onChange={() => onCourseAppearanceChange({ textColorMode: "custom" })}
                        type="radio"
                      />
                      <span>
                        <strong>{t("lessonSettings.customColor", undefined, "Couleur personnalisée")}</strong>
                        <small>{courseAppearance.textColor}</small>
                      </span>
                      {courseAppearance.textColorMode === "custom" ? (
                        <ColorPickerField
                          positioning="lesson-options"
                          ariaLabel={t("lessonSettings.customTextColorAria", undefined, "Choisir la couleur personnalisée du texte")}
                          className="lesson-appearance-color-picker"
                          onChange={(textColor) => onCourseAppearanceChange({ textColor })}
                          value={courseAppearance.textColor}
                        />
                      ) : null}
                    </label>
                    <p className="lesson-settings-helper">{t("lessonSettings.localOverrideHelp", undefined, "Un réglage défini dans une activité reste prioritaire.")}</p>
                  </section>
                  <section className="lesson-cover-section lesson-appearance-section lesson-theme-colors-section">
                    <label className="lesson-theme-background">
                      <span>{t("lessonSettings.lessonBackground", undefined, "Fond de la leçon")}</span>
                      <ColorPickerField
                        positioning="lesson-options"
                        allowTransparent
                        ariaLabel={t("lessonSettings.lessonBackgroundAria", undefined, "Choisir la couleur de fond de la leçon")}
                        className="lesson-appearance-color-picker"
                        onChange={(backgroundColor) => onCourseAppearanceChange({ backgroundColor })}
                        value={courseAppearance.backgroundColor}
                      />
                    </label>
                    <h4>{t("lessonSettings.themeColors", undefined, "Couleurs du thème")}</h4>
                    <span>{t("lessonSettings.comingSoon", undefined, "En cours de construction")}</span>
                  </section>
                </div>
              ) : null}
            </div>

            <div className={`lesson-settings-row lesson-cover-row ${fontSectionOpen ? "open" : "collapsed"}`}>
              <button aria-expanded={fontSectionOpen} className="lesson-cover-toggle" onClick={() => onSectionToggle("font")} type="button">
                <span><strong>{t("lessonSettings.fontSection", undefined, "Police de la leçon")}</strong></span>
                <span aria-hidden="true" className="lesson-cover-chevron">⌄</span>
              </button>
              {fontSectionOpen ? (
                <div className="lesson-cover-controls">
                  <section className="lesson-cover-section">
                    <div className="lesson-font-catalog">
                      {bundledFonts.map((font) => {
                        const selected = (project?.customFont?.id === font.id || (project?.customFont?.source === "project" && font.id === `rich-project-${project.customFont.id}`));
                        return (
                          <button
                            aria-pressed={selected}
                            className={`lesson-font-card ${selected ? "selected" : ""}`}
                            disabled={["project-font", "project-font-import"].includes(busyAction ?? "")}
                            key={font.id}
                            onClick={() => onSelectBundledFont(font.id)}
                            type="button"
                          >
                            <strong>{font.family}</strong>
                            <span style={{ fontFamily: `"PaideiaPreview-${font.id}", sans-serif` }}>Lorem ipsum dolor sit amet</span>
                          </button>
                        );
                      })}
                      {userFonts.map((font) => {
                        const selected = project?.customFont?.source === "user" && project.customFont.id === font.id;
                        return (
                          <button
                            aria-pressed={selected}
                            className={`lesson-font-card ${selected ? "selected" : ""}`}
                            disabled={["project-font", "project-font-import"].includes(busyAction ?? "")}
                            key={`user-${font.id}`}
                            onClick={() => onSelectUserFont(font.id ?? "")}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              onDeleteUserFontRequest(font);
                            }}
                            type="button"
                          >
                            <strong>{font.fontFamily}</strong>
                            <span style={{ fontFamily: `"PaideiaUser-${font.id}", sans-serif` }}>Lorem ipsum dolor sit amet</span>
                            <small className="lesson-font-badge">{t("lessonSettings.fontBadgeBank", undefined, "importée · banque")}</small>
                          </button>
                        );
                      })}
                      {(project?.importedFonts ?? []).map(font => (
                        <button key={`project-${font.id}`} aria-pressed={(project?.customFont?.id === font.id || (project?.customFont?.source === "project" && font.id === `rich-project-${project.customFont.id}`))}
                          className={`lesson-font-card ${(project?.customFont?.id === font.id || (project?.customFont?.source === "project" && font.id === `rich-project-${project.customFont.id}`)) ? "selected" : ""}`}
                          disabled={busyAction === "project-font-remove" || ["project-font", "project-font-import"].includes(busyAction ?? "")}
                          onClick={() => onSelectImportedFont(font.id ?? "")}
                          onContextMenu={(event) => { event.preventDefault(); onDeleteProjectFontRequest(font); }} type="button">
                          <strong>{font.fontFamily}</strong>
                          <span style={{ fontFamily: `"PaideiaRichFont-${font.id}", sans-serif` }}>Lorem ipsum dolor sit amet</span>
                          <small className="lesson-font-badge">{t("lessonSettings.fontBadgeProject", undefined, "importée · projet")}</small>
                        </button>
                      ))}
                      {project?.customFont?.source === "project" && !(project.importedFonts ?? []).some(font => font.id === project.customFont?.id
                        || font.id === `rich-project-${project.customFont?.id}`) ? (
                        <button aria-pressed="true" className="lesson-font-card selected"
                          onContextMenu={(event) => { event.preventDefault(); onDeleteProjectFontRequest(project.customFont!); }} type="button">
                          <strong>{project.customFont.fontFamily}</strong>
                          <span style={{ fontFamily: "\"PaideiaCustomFont\", sans-serif" }}>Lorem ipsum dolor sit amet</span>
                          <small className="lesson-font-badge">{t("lessonSettings.fontBadgeProject", undefined, "importée · projet")}</small>
                        </button>
                      ) : null}
                    </div>
                    {project?.customFont?.assetRef ? (
                      <em className="lesson-font-preview" style={{ fontFamily: "\"PaideiaCustomFont\", Inter, Arial, sans-serif" }}>
                        Lorem ipsum dolor sit amet · {project.customFont.fontFamily}
                      </em>
                    ) : null}
                    {project?.customFont?.source === "user" || project?.customFont?.source === "project" ? (
                      <p className="lesson-font-license-warning">
                        {t("lessonSettings.fontLicenseWarning", undefined, "Attention : assurez-vous que la licence de cette police autorise son utilisation, sa conversion en WOFF2 et son intégration dans vos exports. Vous êtes responsable du respect des droits associés à la police importée.")}
                      </p>
                    ) : null}
                    <div className="lesson-settings-actions">
                      <button className="ghost-pill compact" disabled={["project-font", "project-font-import"].includes(busyAction ?? "")} onClick={() => projectFontInputRef.current?.click()} type="button">
                        {t("lessonSettings.importFontProject", undefined, "Importer pour ce projet")}
                      </button>
                      <button className="ghost-pill compact" disabled={busyAction === "user-font"} onClick={() => userFontInputRef.current?.click()} type="button">
                        {t("lessonSettings.addUserFont", undefined, "Ajouter à mes polices")}
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>

            <div className={`lesson-settings-row lesson-cover-row ${scormSectionOpen ? "open" : "collapsed"}`}>
              <button aria-expanded={scormSectionOpen} className="lesson-cover-toggle" onClick={() => onSectionToggle("scorm")} type="button">
                <span><strong>SCORM / LMS</strong></span>
                <span aria-hidden="true" className="lesson-cover-chevron">⌄</span>
              </button>
              {scormSectionOpen ? (
                <div className="lesson-cover-controls">
                  <section className="lesson-cover-section">
                    <h4>{t("lessonSettings.lmsBehavior", undefined, "Comportement LMS")}</h4>
                    <label className="lesson-cover-select">
                      <span>{t("lessonSettings.mode", undefined, "Mode")}</span>
                      <select
                        disabled={busyAction === "update-chapter-scorm-tracking"}
                        onChange={(event) => onChapterScormTrackingChange(chapterTrackingFromMode(event.target.value as ChapterScormTrackingMode))}
                        value={activeChapterTracking.mode}
                      >
                        <option value="completion">{t("lessonSettings.scormModeCompletion", undefined, "Consultation simple")}</option>
                        <option disabled={!activeChapterHasLmsSender} value="quiz-blocking">{t("lessonSettings.scormModeQuizBlocking", undefined, "Quiz validant")}</option>
                        <option disabled={!activeChapterHasLmsSender} value="quiz-certification">{t("lessonSettings.scormModeQuizCertification", undefined, "Quiz certificatif")}</option>
                        <option disabled={!activeChapterHasLmsSender} value="advanced">{t("lessonSettings.scormModeAdvanced", undefined, "Avancé")}</option>
                      </select>
                    </label>
                    {!activeChapterHasLmsSender ? (
                      <p className="lesson-settings-helper">{t("lessonSettings.lmsSenderHintPrefix", undefined, "Activez d'abord l'option")} <strong>{t("quiz.sendScoreToLms", undefined, "Envoyer le score au LMS")}</strong> {t("lessonSettings.lmsSenderHintSuffix", undefined, "dans une activité quiz pour utiliser les modes quiz.")}</p>
                    ) : null}
                    {activeChapterTracking.mode === "advanced" ? (
                      <div className="lesson-scorm-grid">
                        <label className="lesson-cover-select">
                          <span>{t("lessonSettings.successThreshold", undefined, "Si seuil atteint")}</span>
                          <select
                            disabled={busyAction === "update-chapter-scorm-tracking"}
                            onChange={(event) => onChapterScormTrackingChange(applyTrackingPair(activeChapterTracking, event.target.value as ChapterScormTracking["successStatus"], activeChapterTracking.failureStatus))}
                            value={activeChapterTracking.successStatus}
                          >
                            <option value="completed">completed</option>
                            <option value="passed">passed</option>
                          </select>
                        </label>
                        <label className="lesson-cover-select">
                          <span>{t("lessonSettings.failureThreshold", undefined, "Si seuil non atteint")}</span>
                          <select
                            disabled={busyAction === "update-chapter-scorm-tracking"}
                            onChange={(event) => onChapterScormTrackingChange(applyTrackingPair(activeChapterTracking, activeChapterTracking.successStatus, event.target.value as ChapterScormTracking["failureStatus"]))}
                            value={activeChapterTracking.failureStatus}
                          >
                            <option value="incomplete">incomplete</option>
                            <option value="failed">failed</option>
                          </select>
                        </label>
                      </div>
                    ) : (
                      <p className="lesson-settings-helper">
                        {t("lessonSettings.appliedPair", undefined, "Couple appliqué :")} <strong>{activeChapterTracking.successStatus} / {activeChapterTracking.failureStatus}</strong>
                      </p>
                    )}
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
