import { useLayoutEffect, useRef } from "react";

type NavigationButtonLabelProps = {
  label: string;
};

function fitLabel(label: HTMLSpanElement) {
  const button = label.closest("button");
  if (!button) return;

  label.style.removeProperty("font-size");
  const composedCourseExit = button.closest<HTMLElement>("[data-course-exit-layout]");
  if (composedCourseExit && composedCourseExit.dataset.courseExitLayout !== "button-only") {
    return;
  }
  const buttonStyle = window.getComputedStyle(button);
  const baseFontSize = Number.parseFloat(buttonStyle.fontSize);
  const horizontalPadding = Number.parseFloat(buttonStyle.paddingLeft) + Number.parseFloat(buttonStyle.paddingRight);
  const availableWidth = Math.max(1, button.clientWidth - horizontalPadding);
  const naturalWidth = label.scrollWidth;

  if (!Number.isFinite(baseFontSize) || baseFontSize <= 0 || naturalWidth <= availableWidth) return;

  const fittedFontSize = Math.max(1, baseFontSize * (availableWidth / naturalWidth));
  label.style.fontSize = `${fittedFontSize.toFixed(3)}px`;
}

export function NavigationButtonLabel({ label }: NavigationButtonLabelProps) {
  const labelRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const labelElement = labelRef.current;
    const button = labelElement?.closest("button");
    if (!labelElement || !button) return;

    let frame = 0;
    const scheduleFit = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => fitLabel(labelElement));
    };

    scheduleFit();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleFit) : null;
    observer?.observe(button);
    window.addEventListener("resize", scheduleFit);
    void document.fonts?.ready.then(scheduleFit).catch(() => undefined);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleFit);
    };
  }, [label]);

  return <span className="navigation-button-label" ref={labelRef}>{label}</span>;
}
