import { useLayoutEffect, useRef } from "react";

type ActivitySectionBackgroundLayerProps = {
  wide: boolean;
};

export function ActivitySectionBackgroundLayer({
  wide
}: ActivitySectionBackgroundLayerProps) {
  const layerRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const root = layer?.closest<HTMLElement>(".linear-block");
    if (!layer || !root) {
      return;
    }

    let disposed = false;
    let animationFrame = 0;

    const measure = () => {
      if (disposed) {
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportLeft = viewport?.offsetLeft ?? 0;

      if (wide) {
        root.style.setProperty(
          "--activity-section-bleed-left",
          `${Math.round(viewportLeft - rootRect.left)}px`
        );
        root.style.setProperty("--activity-section-bleed-width", `${Math.ceil(viewportWidth)}px`);
      } else {
        root.style.removeProperty("--activity-section-bleed-left");
        root.style.removeProperty("--activity-section-bleed-width");
      }
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("scroll", scheduleMeasure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(root);
    if (root.parentElement) {
      observer?.observe(root.parentElement);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("scroll", scheduleMeasure);
      observer?.disconnect();
      root.style.removeProperty("--activity-section-bleed-left");
      root.style.removeProperty("--activity-section-bleed-width");
    };
  }, [wide]);

  return <span aria-hidden="true" className="activity-section-background" ref={layerRef} />;
}
