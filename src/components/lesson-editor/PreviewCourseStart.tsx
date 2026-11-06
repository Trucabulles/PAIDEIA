import { useLayoutEffect, useRef } from "react";
import {
  courseCoverCssVars,
  normalizeCourseCoverStyle
} from "../../app/courseCoverConfig";
import type { ChapterEntry, ChapterProgress } from "../../app/projectSelectors";
import type { PaideiaProject } from "../../types/project";
import { useI18n } from "../../i18n/react";

type PreviewCourseStartProps = {
  chapterEntries: ChapterEntry[];
  chapterProgress: ChapterProgress[];
  courseCoverTitleHtml: string;
  courseImageUrl: string | null;
  courseIntroHtml: string;
  onStartChapter: (entry?: ChapterEntry) => void;
  project: PaideiaProject | null | undefined;
};

function resetCourseCoverTitleFit(content: HTMLDivElement | null) {
  if (!content) return;
  content.style.removeProperty("zoom");
  content.style.removeProperty("transform");
  content.style.removeProperty("transform-origin");
}

function fitCourseCoverTitle(viewport: HTMLDivElement | null, content: HTMLDivElement | null, horizontalOrigin: "left" | "center" | "right") {
  if (!viewport || !content) return;
  resetCourseCoverTitleFit(content);
  const availableWidth = viewport.clientWidth;
  const availableHeight = viewport.clientHeight;
  if (!availableWidth || !availableHeight) return;

  const ownerDocument = viewport.ownerDocument;
  const isGecko = "MozAppearance" in ownerDocument.documentElement.style;
  if (isGecko) {
    const naturalWidth = content.scrollWidth;
    const naturalHeight = content.scrollHeight;
    const fits = (scale: number) => naturalWidth * scale <= availableWidth + 0.75
      && naturalHeight * scale <= availableHeight + 0.75;
    if (fits(1)) return;
    let low = 0.08;
    let high = 1;
    if (!fits(low)) return;
    for (let index = 0; index < 14; index += 1) {
      const probe = (low + high) / 2;
      if (fits(probe)) low = probe;
      else high = probe;
    }
    content.style.transformOrigin = `${horizontalOrigin} top`;
    content.style.transform = `scale(${low.toFixed(4)})`;
    return;
  }

  const applyScale = (scale: number) => {
    const bounded = Math.max(0.08, Math.min(1, scale));
    if (bounded >= 0.9995) content.style.removeProperty("zoom");
    else content.style.setProperty("zoom", bounded.toFixed(4));
    const effectiveScale = bounded >= 0.9995 ? 1 : bounded;
    return content.scrollWidth * effectiveScale <= availableWidth + 0.75
      && content.scrollHeight * effectiveScale <= availableHeight + 0.75;
  };
  if (applyScale(1)) return;
  let low = 0.08;
  let high = 1;
  if (!applyScale(low)) return;
  for (let index = 0; index < 14; index += 1) {
    const probe = (low + high) / 2;
    if (applyScale(probe)) low = probe;
    else high = probe;
  }
  applyScale(low);
}

export function PreviewCourseStart({
  chapterEntries,
  chapterProgress,
  courseCoverTitleHtml,
  courseImageUrl,
  courseIntroHtml,
  onStartChapter,
  project
}: PreviewCourseStartProps) {
  const { t } = useI18n();
  const coverStyle = normalizeCourseCoverStyle(project?.courseCoverStyle);
  const titleViewportRef = useRef<HTMLDivElement | null>(null);
  const titleContentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const viewport = titleViewportRef.current;
    const content = titleContentRef.current;
    if (!viewport || !content) return;
    const ownerWindow = viewport.ownerDocument.defaultView;
    const ResizeObserverConstructor = ownerWindow?.ResizeObserver ?? ResizeObserver;
    const titlePosition = coverStyle.titlePosition ?? "left-bottom";
    const horizontalOrigin = titlePosition === "right-bottom"
      ? "right"
      : ["center", "center-bottom"].includes(titlePosition)
        ? "center"
        : "left";
    let scheduledFrame = 0;
    const fit = () => {
      scheduledFrame = 0;
      fitCourseCoverTitle(viewport, content, horizontalOrigin);
    };
    const scheduleFit = () => {
      if (scheduledFrame) ownerWindow?.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = (ownerWindow ?? window).requestAnimationFrame(fit);
    };
    scheduleFit();
    const observer = new ResizeObserverConstructor(scheduleFit);
    observer.observe(viewport);
    viewport.ownerDocument.fonts?.ready.then(scheduleFit).catch(() => undefined);
    ownerWindow?.addEventListener("resize", scheduleFit);
    return () => {
      if (scheduledFrame) ownerWindow?.cancelAnimationFrame(scheduledFrame);
      observer.disconnect();
      ownerWindow?.removeEventListener("resize", scheduleFit);
      resetCourseCoverTitleFit(content);
    };
  }, [courseCoverTitleHtml, coverStyle.heightPx, coverStyle.titlePosition]);

  return (
    <>
      <section
        className={`course-preview-cover ${courseImageUrl ? "" : "course-preview-cover-fallback"}`}
        data-button-position={coverStyle.buttonPosition}
        data-overlay-position={coverStyle.overlayPosition}
        data-title-align={coverStyle.titleAlign}
        data-title-position={coverStyle.titlePosition}
        style={courseCoverCssVars(project)}
      >
        {courseImageUrl ? <img alt={project?.title ?? t("lesson.courseImage", undefined, "Image de cours")} src={courseImageUrl} /> : null}
        <div className="course-preview-cover-panel">
          <div className="course-cover-title-wrapper course-cover-title-fit-viewport" ref={titleViewportRef}>
            <div
              className="course-cover-title-rich rich-content"
              dangerouslySetInnerHTML={{ __html: courseCoverTitleHtml }}
              ref={titleContentRef}
            />
          </div>
          <button className="course-start-card" onClick={() => onStartChapter()} type="button">
            {t("lesson.startLesson", undefined, "Commencer la leçon")}
          </button>
        </div>
      </section>
      {courseIntroHtml ? (
        <section
          className="preview-course-intro rich-content"
          dangerouslySetInnerHTML={{ __html: courseIntroHtml }}
        />
      ) : null}
      <section className="preview-chapter-picker">
        {chapterEntries.map((entry, index) => {
          const progress = chapterProgress.find(item => item.chapterId === entry.chapter.id);
          const percent = progress?.percent ?? 0;
          return (
            <button key={entry.chapter.id} onClick={() => onStartChapter(entry)} type="button">
              <span>{entry.chapter.title}</span>
              <small className="preview-chapter-meta">
                <span>{t("lesson.chapterProgress", { index: index + 1, total: chapterEntries.length }, "Chapitre {index} / {total}")}</span>
                <span className={`preview-chapter-progress-chip${percent >= 100 ? " complete" : ""}`}>
                  {percent >= 100
                    ? `✓ ${t("scorm.completed", undefined, "Terminé")}`
                    : t("preview.percentComplete", { percent }, "{percent} % terminé")}
                </span>
              </small>
            </button>
          );
        })}
      </section>
    </>
  );
}
