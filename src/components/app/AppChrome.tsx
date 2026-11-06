import { useEffect, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import paideiaBandeau from "../../assets/paideia-bandeau.png";
import {
  APP_BUILD_COMMIT,
  APP_VERSION
} from "../../app/appConfig";
import {
  MAX_ACTIVITY_FAVORITES_LIMIT,
  MAX_RECENT_LESSONS
} from "../../app/libraryConfig";
import type { HamburgerPanel, ProjectTab } from "../../app/appStateTypes";
import { formatDateTime } from "../../app/textSearch";
import type { PaideiaWorkspaceState } from "../../types/project";
import type { FfmpegConfigurationStatus, WhisperConfigurationStatus } from "../../lib/projectApi";
import {
  EU_LANGUAGE_CATALOG,
  OTHER_LANGUAGE_CATALOG,
  REGIONAL_LANGUAGE_CATALOG,
  appLanguageLabel,
  type AppLanguage
} from "../../i18n";
import {
  PreviewResponsiveSwitcher,
  type PreviewDeviceMode
} from "../resources/preview";
import { WindowControls, WindowResizeHandles } from "../window/WindowControls";

type AppChromeProps = {
  activityFavoritesLimit: number;
  appLanguage: AppLanguage;
  chromeCompact: boolean;
  courseImageAccept: string;
  currentProjectPath: string;
  embeddedWebview2RuntimeVersion: string | null;
  ffmpegConfigurationStatus: FfmpegConfigurationStatus | null;
  ffmpegPath: string;
  whisperConfigurationStatus: WhisperConfigurationStatus | null;
  whisperCliPath: string;
  whisperSmallModelPath: string;
  whisperMediumModelPath: string;
  hamburgerPanel: HamburgerPanel;
  importDestinationRoot: string;
  incrementalSaveEnabled: boolean;
  incrementalSaveMinutes: number;
  mediaToolValidationBusy: "ffmpeg" | "whisper-engine" | "whisper-small" | "whisper-medium" | null;
  infoMenuOpen: boolean;
  infoMenuRef: RefObject<HTMLDivElement>;
  inlineRichTextActive: boolean;
  isHomeScreen: boolean;
  isProjectLibraryScreen: boolean;
  isProjectWorkspaceActive: boolean;
  canEditProject: boolean;
  isResourcesScreen: boolean;
  paideiaFileInputRef: RefObject<HTMLInputElement>;
  courseImageInputRef: RefObject<HTMLInputElement>;
  projectFontInputRef: RefObject<HTMLInputElement>;
  userFontInputRef: RefObject<HTMLInputElement>;
  previewDeviceMode: PreviewDeviceMode;
  previewMode: boolean;
  previewTools?: ReactNode;
  projectTabs: ProjectTab[];
  recentLessonPaths: string[];
  recentLessonTitles: Record<string, string>;
  snapshotMenuOpen: boolean;
  snapshotMenuRef: RefObject<HTMLDivElement>;
  snapshots: PaideiaWorkspaceState["snapshots"];
  workspaceChromeActive: boolean;
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>, fallback?: string) => string;
  onActivityFavoritesLimitChange: (value: number) => void;
  onAppLanguageChange: (value: AppLanguage) => void;
  onChooseLibraryRoot: () => void;
  onChooseFfmpeg: () => void;
  onChooseWhisperComponent: (kind: "engine" | "small" | "medium") => void;
  onChoosePaideiaArchive: () => void;
  onChooseScorm: () => void;
  onChangelogOpen: () => void;
  onChromeCompactToggle: () => void;
  onChromeRevealChange: (value: boolean) => void;
  onClearMediaToolConfiguration: () => void;
  onClearWhisperConfiguration: () => void;
  onCourseImageUpload: (file: File | null) => void;
  onCreateLesson: () => void;
  onCreateSnapshot: () => void;
  manualSnapshotPending: boolean;
  onHamburgerPanelChange: Dispatch<SetStateAction<HamburgerPanel>>;
  onHome: () => void;
  onIncrementalSaveEnabledChange: (value: boolean) => void;
  onIncrementalSaveMinutesChange: (value: number) => void;
  onInfoMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  onLibraryOpenChange: (value: boolean) => void;
  onLicenseOpen: () => void;
  onThirdPartyOpen: () => void;
  onUserGuideOpen: () => void;
  onOpenPaideiaFile: (file: File) => void;
  onOpenRecentLesson: (path: string) => void;
  onPreviewDeviceModeChange: (mode: PreviewDeviceMode) => void;
  onPreviewToggle: () => void;
  onProjectFontUpload: (file: File | null) => void;
  onProjectLibrary: () => void;
  onProjectTabClose: (tab: ProjectTab) => void;
  onProjectTabSwitch: (tab: ProjectTab) => void;
  onResources: () => void;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
  onSnapshotMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  onUserFontUpload: (file: File | null) => void;
  projectTabIsDirty: (tab: ProjectTab) => boolean;
};

type AddOnsPanelProps = Pick<
  AppChromeProps,
  | "ffmpegConfigurationStatus"
  | "ffmpegPath"
  | "mediaToolValidationBusy"
  | "onChooseFfmpeg"
  | "onChooseWhisperComponent"
  | "onClearMediaToolConfiguration"
  | "onClearWhisperConfiguration"
  | "whisperConfigurationStatus"
  | "whisperCliPath"
  | "whisperSmallModelPath"
  | "whisperMediumModelPath"
  | "t"
>;

function formatModelSize(sizeBytes?: number | null) {
  if (!sizeBytes) return "";
  return `${(sizeBytes / (1024 * 1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 2 })} GB`;
}

type AppLanguagePickerProps = Pick<AppChromeProps, "appLanguage" | "onAppLanguageChange" | "t">;

function AppLanguagePicker({ appLanguage, onAppLanguageChange, t }: AppLanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = "app-language-options";
  const languageCollator = new Intl.Collator(appLanguage, { sensitivity: "base" });
  const localizedLanguageNames = new Intl.DisplayNames([appLanguage], { type: "language" });
  const sortLanguageCatalog = <T extends { code: AppLanguage }>(catalog: readonly T[]) =>
    [...catalog].sort((left, right) => languageCollator.compare(
      localizedLanguageNames.of(left.code) ?? appLanguageLabel(left.code, appLanguage),
      localizedLanguageNames.of(right.code) ?? appLanguageLabel(right.code, appLanguage)
    ));
  const languageGroups = [
    { label: t("menu.officialEuLanguages"), languages: sortLanguageCatalog(EU_LANGUAGE_CATALOG) },
    { label: t("menu.regionalLanguages"), languages: sortLanguageCatalog(REGIONAL_LANGUAGE_CATALOG) },
    { label: t("menu.otherLanguages"), languages: sortLanguageCatalog(OTHER_LANGUAGE_CATALOG) }
  ];

  useEffect(() => {
    if (!open) return;
    const selectedOption = rootRef.current?.querySelector<HTMLButtonElement>("[role='option'][aria-selected='true']");
    selectedOption?.focus();

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const focusRelativeOption = (current: HTMLElement, offset: number) => {
    const options = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? []);
    const currentIndex = options.indexOf(current as HTMLButtonElement);
    const nextIndex = Math.min(Math.max(currentIndex + offset, 0), options.length - 1);
    options[nextIndex]?.focus();
  };

  return (
    <div className="app-language-picker" ref={rootRef}>
      <button
        aria-label={t("menu.language")}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="app-language-picker-trigger"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="app-language-picker-value">{appLanguageLabel(appLanguage, appLanguage)}</span>
        <span aria-hidden="true" className="app-language-picker-chevron">⌄</span>
      </button>
      {open ? (
        <div
          aria-label={t("menu.language")}
          className="app-language-picker-list"
          id={listId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              focusRelativeOption(event.target as HTMLElement, 1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusRelativeOption(event.target as HTMLElement, -1);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              const options = rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']");
              options?.[event.key === "Home" ? 0 : options.length - 1]?.focus();
            }
          }}
          role="listbox"
        >
          {languageGroups.map((group) => (
            <div aria-label={group.label} className="app-language-picker-group" key={group.label} role="group">
              <p>{group.label}</p>
              {group.languages.map(({ code }) => (
                <button
                  aria-selected={code === appLanguage}
                  className="app-language-picker-option"
                  key={code}
                  onClick={() => {
                    onAppLanguageChange(code);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  role="option"
                  type="button"
                >
                  {appLanguageLabel(code, appLanguage)}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AddOnsPanel({
  ffmpegConfigurationStatus,
  ffmpegPath,
  mediaToolValidationBusy,
  onChooseFfmpeg,
  onChooseWhisperComponent,
  onClearMediaToolConfiguration,
  onClearWhisperConfiguration,
  whisperConfigurationStatus,
  whisperCliPath,
  whisperSmallModelPath,
  whisperMediumModelPath,
  t
}: AddOnsPanelProps) {
  return (
    <div className="hamburger-panel settings-panel">
      <div className="settings-group settings-group--structural add-ons-settings-group">
        <div className="media-tools-settings-group">
          <div className="media-tools-settings-heading">
            <span>{t("menu.ffmpegTools", undefined, "Outils vidéo FFmpeg")}</span>
            <strong className={`media-tools-status ${ffmpegConfigurationStatus?.videoOptimizationReady ? "ready" : "not-ready"}`}>
              {ffmpegConfigurationStatus?.videoOptimizationReady
                ? t("menu.ffmpegReady", undefined, "Prêt")
                : ffmpegConfigurationStatus?.ready
                  ? t("menu.ffmpegIncompatible", undefined, "Incompatible")
                  : t("menu.ffmpegNotReady", undefined, "Non configuré")}
            </strong>
          </div>
          <p className="settings-help-text">
            {t("menu.ffmpegRecommendation", undefined, "Version recommandée : FFmpeg 8.1.x (8.1.2 validée). Installation locale externe à PAIDEIA.")}
          </p>
          <div className="media-tool-setting">
            <div className="media-tool-setting-row">
              <strong>FFmpeg</strong>
              <button
                className="settings-secondary-button"
                disabled={mediaToolValidationBusy !== null}
                onClick={onChooseFfmpeg}
                type="button"
              >
                {mediaToolValidationBusy === "ffmpeg"
                  ? t("menu.ffmpegChecking", undefined, "Vérification…")
                  : t("menu.browse", undefined, "Parcourir")}
              </button>
            </div>
            <p className="settings-path" title={ffmpegPath || ffmpegConfigurationStatus?.ffmpeg.path}>
              {ffmpegPath
                || ffmpegConfigurationStatus?.ffmpeg.path
                || t("menu.noExecutableSelected", undefined, "Aucun exécutable sélectionné")}
            </p>
            {ffmpegConfigurationStatus?.ffmpeg.valid && ffmpegConfigurationStatus.ffmpeg.version ? (
              <p className="media-tool-validation valid">✓ {ffmpegConfigurationStatus.ffmpeg.version}</p>
            ) : ffmpegConfigurationStatus?.ffmpeg.error && ffmpegConfigurationStatus.ffmpeg.path ? (
              <p className="media-tool-validation invalid">! {ffmpegConfigurationStatus.ffmpeg.error}</p>
            ) : null}
            {ffmpegConfigurationStatus?.ffmpeg.valid && !ffmpegConfigurationStatus.ffprobe.valid ? (
              <p className="media-tool-validation invalid">
                ! {t("menu.ffmpegIncomplete", undefined, "Installation FFmpeg incomplète.")}
              </p>
            ) : null}
          </div>
          {ffmpegConfigurationStatus?.ready && !ffmpegConfigurationStatus.videoOptimizationReady && ffmpegConfigurationStatus.videoOptimizationError ? (
            <p className="media-tool-validation invalid">! {ffmpegConfigurationStatus.videoOptimizationError}</p>
          ) : null}
          {ffmpegPath || ffmpegConfigurationStatus?.ffmpeg.path ? (
            <button className="settings-danger-button" onClick={onClearMediaToolConfiguration} type="button">
              {t("menu.clearFfmpegConfiguration", undefined, "Supprimer FFMPEG")}
            </button>
          ) : null}
        </div>
        <div className="media-tools-settings-group">
          <div className="media-tools-settings-heading">
            <span>{t("menu.whisperTools", undefined, "Transcription locale Whisper")}</span>
            <strong className={`media-tools-status ${whisperConfigurationStatus?.ready ? "ready" : "not-ready"}`}>
              {whisperConfigurationStatus?.ready
                ? t("menu.ffmpegReady", undefined, "Prêt")
                : t("menu.ffmpegNotReady", undefined, "Non configuré")}
            </strong>
          </div>
          <p className="settings-help-text">
            {t("menu.whisperManualHelp", undefined, "Sélectionnez manuellement le moteur et au moins un modèle installés sur cet ordinateur. PAIDEIA ne se connecte à aucun service externe.")}
          </p>
          {([
            ["engine", t("menu.whisperEngine", undefined, "Moteur Whisper"), whisperCliPath, whisperConfigurationStatus?.engine],
            ["small", t("menu.whisperSmallModel", undefined, "Modèle Small"), whisperSmallModelPath, whisperConfigurationStatus?.smallModel],
            ["medium", t("menu.whisperMediumModel", undefined, "Modèle Medium"), whisperMediumModelPath, whisperConfigurationStatus?.mediumModel]
          ] as const).map(([kind, label, path, validation]) => {
            const displayedPath = validation && !validation.valid && validation.path
              ? validation.path
              : path || validation?.path || "";
            return (
              <div className="media-tool-setting" key={kind}>
                <div className="media-tool-setting-row">
                  <strong>{label}</strong>
                  <button
                    className="settings-secondary-button"
                    disabled={mediaToolValidationBusy !== null}
                    onClick={() => onChooseWhisperComponent(kind)}
                    type="button"
                  >
                    {mediaToolValidationBusy === `whisper-${kind}`
                      ? t("menu.ffmpegChecking", undefined, "Vérification…")
                      : t("menu.browse", undefined, "Parcourir")}
                  </button>
                </div>
                <p className="settings-path" title={displayedPath}>
                  {displayedPath || t("editor.noFileSelected", undefined, "Aucun fichier sélectionné")}
                </p>
                {validation?.valid ? (
                  <p className="media-tool-validation valid">
                    ✓ {validation.version || formatModelSize(validation.sizeBytes) || t("menu.ffmpegReady", undefined, "Prêt")}
                  </p>
                ) : validation?.error && validation.path ? (
                  <p className="media-tool-validation invalid">! {validation.error}</p>
                ) : null}
              </div>
            );
          })}
          {!whisperConfigurationStatus?.ffmpegReady ? (
            <p className="media-tool-validation invalid">
              ! {t("menu.whisperFfmpegRequired", undefined, "Configurez également FFmpeg pour extraire la piste audio des vidéos.")}
            </p>
          ) : null}
          {whisperCliPath || whisperSmallModelPath || whisperMediumModelPath ? (
            <button className="settings-danger-button" onClick={onClearWhisperConfiguration} type="button">
              {t("menu.clearWhisperConfiguration", undefined, "Supprimer Whisper")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppChrome({
  activityFavoritesLimit,
  appLanguage,
  chromeCompact,
  courseImageAccept,
  currentProjectPath,
  embeddedWebview2RuntimeVersion,
  ffmpegConfigurationStatus,
  ffmpegPath,
  whisperConfigurationStatus,
  whisperCliPath,
  whisperSmallModelPath,
  whisperMediumModelPath,
  hamburgerPanel,
  importDestinationRoot,
  incrementalSaveEnabled,
  incrementalSaveMinutes,
  mediaToolValidationBusy,
  infoMenuOpen,
  infoMenuRef,
  inlineRichTextActive,
  isHomeScreen,
  isProjectLibraryScreen,
  isProjectWorkspaceActive,
  canEditProject,
  isResourcesScreen,
  paideiaFileInputRef,
  courseImageInputRef,
  projectFontInputRef,
  userFontInputRef,
  previewDeviceMode,
  previewMode,
  previewTools,
  projectTabs,
  recentLessonPaths,
  recentLessonTitles,
  snapshotMenuOpen,
  snapshotMenuRef,
  snapshots,
  workspaceChromeActive,
  t,
  onActivityFavoritesLimitChange,
  onAppLanguageChange,
  onChooseLibraryRoot,
  onChooseFfmpeg,
  onChooseWhisperComponent,
  onChoosePaideiaArchive,
  onChooseScorm,
  onChangelogOpen,
  onChromeCompactToggle,
  onChromeRevealChange,
  onClearMediaToolConfiguration,
  onClearWhisperConfiguration,
  onCourseImageUpload,
  onCreateLesson,
  onCreateSnapshot,
  manualSnapshotPending,
  onHamburgerPanelChange,
  onHome,
  onIncrementalSaveEnabledChange,
  onIncrementalSaveMinutesChange,
  onInfoMenuOpenChange,
  onLibraryOpenChange,
  onLicenseOpen,
  onThirdPartyOpen,
  onUserGuideOpen,
  onOpenPaideiaFile,
  onOpenRecentLesson,
  onPreviewDeviceModeChange,
  onPreviewToggle,
  onProjectFontUpload,
  onProjectLibrary,
  onProjectTabClose,
  onProjectTabSwitch,
  onResources,
  onRestoreSnapshot,
  onSnapshotMenuOpenChange,
  onUserFontUpload,
  projectTabIsDirty
}: AppChromeProps) {
  const desktopWindowAvailable = isTauri();
  const [mainWindowIsMaximized, setMainWindowIsMaximized] = useState(true);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [snapshotRestoreDialog, setSnapshotRestoreDialog] = useState<{
    snapshotId: string;
    status: "confirm" | "running" | "success" | "error";
    error?: string;
  } | null>(null);
  const windowDragCandidateRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const snapshotToRestore = snapshotRestoreDialog
    ? snapshots.find((snapshot) => snapshot.id === snapshotRestoreDialog.snapshotId) ?? null
    : null;

  const confirmSnapshotRestore = async () => {
    if (!snapshotRestoreDialog || snapshotRestoreDialog.status !== "confirm") {
      return;
    }
    const snapshotId = snapshotRestoreDialog.snapshotId;
    setSnapshotRestoreDialog({ snapshotId, status: "running" });
    try {
      await onRestoreSnapshot(snapshotId);
      setSnapshotRestoreDialog({ snapshotId, status: "success" });
    } catch (error) {
      setSnapshotRestoreDialog({
        snapshotId,
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  useEffect(() => {
    setSelectedSnapshotId((current) => (
      current && snapshots.some((snapshot) => snapshot.id === current) ? current : null
    ));
  }, [currentProjectPath, snapshots]);

  useEffect(() => {
    if (!desktopWindowAvailable) return;
    const mainWindow = getCurrentWindow();
    const refreshMaximizedState = () => void mainWindow.isMaximized().then(setMainWindowIsMaximized);
    refreshMaximizedState();
    const unlisten = mainWindow.onResized(refreshMaximizedState);
    return () => { void unlisten.then((stop) => stop()); };
  }, [desktopWindowAvailable]);

  const windowTargetIsInteractive = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("button, input, select, textarea, a, [role='button'], .floating-menu"));

  return (
    <>
      {desktopWindowAvailable && !mainWindowIsMaximized && !infoMenuOpen && !snapshotMenuOpen ? (
        <WindowResizeHandles onResizeStart={(direction) => void getCurrentWindow().startResizeDragging(direction)} />
      ) : null}
      {workspaceChromeActive && chromeCompact ? (
        <div
          className="chrome-hover-zone"
          onPointerEnter={() => {
            if (!inlineRichTextActive) {
              onChromeRevealChange(true);
            }
          }}
        />
      ) : null}
      <div
        className="chrome-bars"
        onDoubleClick={(event) => {
          if (windowTargetIsInteractive(event.target)) return;
          onChromeCompactToggle();
        }}
        onPointerEnter={() => {
          if (chromeCompact && !inlineRichTextActive) {
            onChromeRevealChange(true);
          }
        }}
        onPointerLeave={() => {
          if (chromeCompact && !infoMenuOpen) {
            onChromeRevealChange(false);
          }
        }}
      >
        <header
          className={`topbar${desktopWindowAvailable ? " main-window-topbar" : ""}`}
          onPointerDown={(event) => {
            if (event.button !== 0 || windowTargetIsInteractive(event.target)) return;
            windowDragCandidateRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const candidate = windowDragCandidateRef.current;
            if (!candidate || candidate.pointerId !== event.pointerId) return;
            if ((event.buttons & 1) === 0) {
              windowDragCandidateRef.current = null;
              return;
            }
            if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) < 4) return;
            windowDragCandidateRef.current = null;
            event.preventDefault();
            void getCurrentWindow().startDragging();
          }}
          onPointerCancel={() => {
            windowDragCandidateRef.current = null;
          }}
          onPointerUp={() => {
            windowDragCandidateRef.current = null;
          }}
        >
          <div className="topbar-left">
            <div className="menu-anchor" ref={infoMenuRef}>
              <button
                className="ghost-icon-button"
                onClick={() => {
                  onInfoMenuOpenChange((current) => {
                    const next = !current;
                    if (!next) {
                      onHamburgerPanelChange(null);
                    }
                    return next;
                  });
                  onLibraryOpenChange(false);
                  onSnapshotMenuOpenChange(false);
                }}
                type="button"
              >
                <span aria-hidden="true" className="hamburger-icon">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="sr-only">{t("menu.srLabel")}</span>
              </button>
              {infoMenuOpen ? (
                <section className="floating-menu info-menu">
                  <button
                    className={`menu-action ${hamburgerPanel === "projects" ? "active" : ""}`}
                    onClick={() => onHamburgerPanelChange((current) => (current === "projects" ? null : "projects"))}
                    type="button"
                  >
                    {t("menu.projects")}
                  </button>
                  {hamburgerPanel === "projects" ? (
                    <div className="hamburger-panel">
                      <button className="menu-action" onClick={onCreateLesson} type="button">{t("menu.newLesson")}</button>
                      <button className="menu-action" onClick={onChoosePaideiaArchive} type="button">
                        {t("menu.importPaideia")}
                      </button>
                      <button className="menu-action" onClick={onChooseScorm} type="button">{t("menu.importScorm")}</button>
                      <div className="menu-divider" />
                      <p className="menu-kicker">{t("menu.recentLessons")}</p>
                      {recentLessonPaths.length ? (
                        recentLessonPaths.slice(0, MAX_RECENT_LESSONS).map((lessonPath) => {
                          const fallbackName = lessonPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? lessonPath;
                          const lessonTitle = recentLessonTitles[lessonPath]?.trim() || fallbackName;
                          return (
                            <button
                              aria-label={`${lessonTitle} — ${lessonPath}`}
                              className="recent-project-button"
                              key={lessonPath}
                              onClick={() => onOpenRecentLesson(lessonPath)}
                              title={lessonPath}
                              type="button"
                            >
                              {lessonTitle}
                            </button>
                          );
                        })
                      ) : <p className="muted">{t("menu.noRecentLessons")}</p>}
                    </div>
                  ) : null}
                  <button
                    className={`menu-action ${hamburgerPanel === "settings" ? "active" : ""}`}
                    onClick={() => onHamburgerPanelChange((current) => (current === "settings" ? null : "settings"))}
                    type="button"
                  >
                    {t("menu.customSettings")}
                  </button>
                  {hamburgerPanel === "settings" ? (
                    <div className="hamburger-panel settings-panel">
                      <div className="settings-group">
                        <span>{t("menu.libraryLocation")}</span>
                        <button className="settings-secondary-button" onClick={onChooseLibraryRoot} type="button">{t("menu.change")}</button>
                        <p className="settings-path" title={importDestinationRoot}>{importDestinationRoot}</p>
                      </div>
                      <div className="settings-group">
                        <div className="settings-range">
                          <span>{t("menu.language")}</span>
                          <AppLanguagePicker
                            appLanguage={appLanguage}
                            onAppLanguageChange={onAppLanguageChange}
                            t={t}
                          />
                        </div>
                      </div>
                      <div className="settings-group compact-settings-group">
                        <label className="settings-switch">
                          <span>{t("menu.autosave")}</span>
                          <input
                            checked={incrementalSaveEnabled}
                            onChange={(event) => onIncrementalSaveEnabledChange(event.target.checked)}
                            type="checkbox"
                          />
                        </label>
                        <label className="settings-range">
                          <span>{t("menu.autosaveFrequency", { minutes: incrementalSaveMinutes })}</span>
                          <input
                            max={60}
                            min={15}
                            onChange={(event) => onIncrementalSaveMinutesChange(Math.max(15, Number(event.target.value)))}
                            type="range"
                            value={incrementalSaveMinutes}
                          />
                        </label>
                      </div>
                      <div className="settings-group">
                        <label className="settings-range">
                          <span>{t("menu.favoriteActivitiesCount", { count: activityFavoritesLimit })}</span>
                          <input
                            max={MAX_ACTIVITY_FAVORITES_LIMIT}
                            min={0}
                            onChange={(event) => onActivityFavoritesLimitChange(Number(event.target.value))}
                            type="range"
                            value={activityFavoritesLimit}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <button
                    className={`menu-action ${hamburgerPanel === "add-ons" ? "active" : ""}`}
                    onClick={() => onHamburgerPanelChange((current) => (current === "add-ons" ? null : "add-ons"))}
                    type="button"
                  >
                    {t("menu.addOns", undefined, "Modules complémentaires")}
                  </button>
                  {hamburgerPanel === "add-ons" ? (
                    <AddOnsPanel
                      ffmpegConfigurationStatus={ffmpegConfigurationStatus}
                      ffmpegPath={ffmpegPath}
                      mediaToolValidationBusy={mediaToolValidationBusy}
                      onChooseFfmpeg={onChooseFfmpeg}
                      onChooseWhisperComponent={onChooseWhisperComponent}
                      onClearMediaToolConfiguration={onClearMediaToolConfiguration}
                      onClearWhisperConfiguration={onClearWhisperConfiguration}
                      t={t}
                      whisperCliPath={whisperCliPath}
                      whisperConfigurationStatus={whisperConfigurationStatus}
                      whisperMediumModelPath={whisperMediumModelPath}
                      whisperSmallModelPath={whisperSmallModelPath}
                    />
                  ) : null}
                  <button
                    className={`menu-action ${hamburgerPanel === "info" ? "active" : ""}`}
                    onClick={() => onHamburgerPanelChange((current) => (current === "info" ? null : "info"))}
                    type="button"
                  >
                    {t("menu.info")}
                  </button>
                  {hamburgerPanel === "info" ? (
                    <div className="hamburger-panel">
                      <img alt={t("topbar.brandAlt")} className="info-menu-logo" src={paideiaBandeau} />
                      <button className="info-menu-guide-button" onClick={onUserGuideOpen} type="button">
                        {t("menu.userGuide")}
                      </button>
                      <div aria-hidden="true" className="info-menu-section-divider" />
                      <div className="info-menu-grid">
                        <strong className="info-menu-build-id">
                          PAIDEIA {APP_VERSION} <span className="info-menu-build-commit">· {APP_BUILD_COMMIT} · Public</span>
                        </strong>
                        <button className="info-menu-changelog-button" onClick={onChangelogOpen} type="button">
                          {t("menu.changelog")}
                        </button>
                        <span hidden>{t("menu.website")}</span><strong hidden>paideia.trucabulles.fr</strong>
                        <span>{t("menu.license")}</span>
                        <button className="info-menu-license-button" onClick={onLicenseOpen} type="button">
                          {t("menu.viewLicense")}
                        </button>
                        <span>{t("thirdParty.label", undefined, "Composants tiers")}</span>
                        <button className="info-menu-license-button" onClick={onThirdPartyOpen} type="button">
                          {t("thirdParty.view", undefined, "Consulter la liste")}
                        </button>
                      </div>
                      {embeddedWebview2RuntimeVersion ? (
                        <p className="info-menu-runtime-note"><em>{t("menu.webviewRuntime", { version: embeddedWebview2RuntimeVersion })}</em></p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
            <button aria-label={t("topbar.homeAria")} className="brand-home-button" onClick={onHome} type="button">
              <img alt={t("topbar.brandAlt")} className="topbar-brand-image" draggable={false} src={paideiaBandeau} />
            </button>
          </div>

          <div className="topbar-library-actions">
            <button className={`ghost-pill ${!isResourcesScreen && (isProjectLibraryScreen || isProjectWorkspaceActive) ? "active" : ""}`} onClick={onProjectLibrary} type="button">
              {t("topbar.lessons")}
            </button>
            <button className={`ghost-pill ${isResourcesScreen ? "active" : ""}`} onClick={onResources} type="button">
              {t("topbar.resources")}
            </button>
          </div>

          <div className="topbar-actions">
            {isProjectWorkspaceActive && canEditProject ? (
              <>
                <div className="menu-anchor" ref={snapshotMenuRef}>
                  <button
                    className="ghost-pill topbar-snapshots-button"
                    onClick={() => {
                      onSnapshotMenuOpenChange((current) => !current);
                      onInfoMenuOpenChange(false);
                      onHamburgerPanelChange(null);
                    }}
                    type="button"
                  >
                    {t("topbar.snapshots")}
                  </button>
                  {snapshotMenuOpen ? (
                    <section className="floating-menu snapshot-menu">
                      <div className="menu-heading">
                        <h3>{t("topbar.snapshots")}</h3>
                        <button
                          className="snapshot-create-button"
                          disabled={manualSnapshotPending}
                          onClick={onCreateSnapshot}
                          type="button"
                        >{t("topbar.createSnapshotNow")}</button>
                      </div>
                      {snapshots.length ? snapshots.map((snapshot) => (
                        <div
                          className={`snapshot-row ${selectedSnapshotId === snapshot.id ? "selected" : ""}`}
                          key={snapshot.id}
                        >
                          <button
                            aria-pressed={selectedSnapshotId === snapshot.id}
                            className="snapshot-row-selection"
                            onClick={() => setSelectedSnapshotId(snapshot.id)}
                            type="button"
                          >
                            <strong>{snapshot.label}</strong>
                            <span>{formatDateTime(snapshot.createdAt, appLanguage)}</span>
                          </button>
                          <button
                            className="snapshot-restore-button"
                            onClick={() => {
                              setSelectedSnapshotId(snapshot.id);
                              onSnapshotMenuOpenChange(false);
                              setSnapshotRestoreDialog({ snapshotId: snapshot.id, status: "confirm" });
                            }}
                            type="button"
                          >
                            {t("topbar.restore")}
                          </button>
                        </div>
                      )) : <p className="muted">{t("topbar.noSnapshots")}</p>}
                    </section>
                  ) : null}
                </div>
                <button className="primary-pill" onClick={onPreviewToggle} type="button">
                  {previewMode ? t("topbar.backToEditing") : t("topbar.lmsPreview")}
                </button>
              </>
            ) : null}
            <input
              accept=".paideia"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file) {
                  onOpenPaideiaFile(file);
                }
              }}
              ref={paideiaFileInputRef}
              type="file"
            />
            <input
              accept={courseImageAccept}
              hidden
              onChange={(event) => onCourseImageUpload(event.target.files?.[0] ?? null)}
              ref={courseImageInputRef}
              type="file"
            />
            <input
              accept=".ttf,.otf,.woff,.woff2,.zip,.7z,font/ttf,font/otf,font/woff,font/woff2,application/zip,application/x-7z-compressed"
              hidden
              onChange={(event) => onProjectFontUpload(event.target.files?.[0] ?? null)}
              ref={projectFontInputRef}
              type="file"
            />
            <input
              accept=".ttf,.otf,.woff,.woff2,.zip,.7z,font/ttf,font/otf,font/woff,font/woff2,application/zip,application/x-7z-compressed"
              hidden
              onChange={(event) => onUserFontUpload(event.target.files?.[0] ?? null)}
              ref={userFontInputRef}
              type="file"
            />
          </div>
          {desktopWindowAvailable ? (
            <div className="main-window-controls">
              <WindowControls
                closeLabel="Fermer PAIDEIA"
                isMaximized={mainWindowIsMaximized}
                onClose={() => void getCurrentWindow().close()}
                onMinimize={() => void getCurrentWindow().minimize()}
                onToggleMaximize={() => void getCurrentWindow().toggleMaximize()}
              />
            </div>
          ) : null}
        </header>

        {projectTabs.length && !isHomeScreen ? (
          <nav className="project-tabs" aria-label={t("topbar.openLessonsAria")}>
            <div className="project-tabs-list">
              {projectTabs.map((tab) => {
                const tabTitle = tab.title || t("topbar.defaultLessonTitle");
                return (
                  <div
                    className={`project-tab ${tab.path === currentProjectPath ? "active" : ""} ${projectTabIsDirty(tab) ? "dirty" : ""}`}
                    key={tab.path}
                  >
                    <button onClick={() => onProjectTabSwitch(tab)} title={tabTitle} type="button">{tabTitle}</button>
                    <button
                      aria-label={t("topbar.closeLessonAria", { title: tab.title || t("topbar.defaultLessonTitle") })}
                      className="project-tab-close"
                      onClick={() => onProjectTabClose(tab)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            {isProjectWorkspaceActive && previewMode ? (
              <div className="project-tabs-tools">
                <PreviewResponsiveSwitcher mode={previewDeviceMode} onChange={onPreviewDeviceModeChange} />
                {previewTools}
              </div>
            ) : null}
          </nav>
        ) : null}
      </div>
      {snapshotRestoreDialog ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section
            aria-labelledby="snapshot-restore-title"
            aria-live={snapshotRestoreDialog.status === "running" ? "polite" : undefined}
            aria-modal="true"
            className="paideia-modal snapshot-restore-modal"
            role="dialog"
          >
            <p className="modal-kicker">{t("snapshot.restoreKicker", undefined, "Instantané")}</p>
            <h2 id="snapshot-restore-title">
              {snapshotRestoreDialog.status === "confirm"
                ? t("snapshot.restoreConfirmTitle", undefined, "Restaurer cet instantané ?")
                : snapshotRestoreDialog.status === "running"
                  ? t("snapshot.restoreRunningTitle", undefined, "Restauration en cours…")
                  : snapshotRestoreDialog.status === "success"
                    ? t("snapshot.restoreSuccessTitle", undefined, "Instantané restauré")
                    : t("snapshot.restoreErrorTitle", undefined, "La restauration a échoué")}
            </h2>
            {snapshotToRestore ? (
              <div className="snapshot-restore-target">
                <strong>{snapshotToRestore.label}</strong>
                <span>{formatDateTime(snapshotToRestore.createdAt, appLanguage)}</span>
              </div>
            ) : null}
            {snapshotRestoreDialog.status === "confirm" ? (
              <p>{t(
                "snapshot.restoreConfirmMessage",
                undefined,
                "Le contenu et les fichiers associés seront restaurés. Un instantané de l’état actuel sera créé auparavant."
              )}</p>
            ) : null}
            {snapshotRestoreDialog.status === "running" ? (
              <p>{t("snapshot.restoreRunningMessage", undefined, "PAIDEIA vérifie et restaure le contenu et les fichiers associés.")}</p>
            ) : null}
            {snapshotRestoreDialog.status === "success" ? (
              <p>{t(
                "snapshot.restoreSuccessMessage",
                undefined,
                "Le point sélectionné a été restauré. L’état précédent reste disponible dans les instantanés."
              )}</p>
            ) : null}
            {snapshotRestoreDialog.status === "error" ? (
              <p className="snapshot-restore-error">{snapshotRestoreDialog.error}</p>
            ) : null}
            <div className="modal-actions">
              {snapshotRestoreDialog.status === "confirm" ? (
                <>
                  <button className="ghost-pill" onClick={() => setSnapshotRestoreDialog(null)} type="button">
                    {t("common.cancel")}
                  </button>
                  <button autoFocus className="primary-pill" onClick={() => void confirmSnapshotRestore()} type="button">
                    {t("topbar.restore")}
                  </button>
                </>
              ) : null}
              {snapshotRestoreDialog.status === "success" || snapshotRestoreDialog.status === "error" ? (
                <button autoFocus className="primary-pill" onClick={() => setSnapshotRestoreDialog(null)} type="button">
                  {t("common.close")}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
