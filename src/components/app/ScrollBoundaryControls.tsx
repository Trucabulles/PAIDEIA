import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from "react";
import styles from "./ScrollBoundaryControls.module.css";

type ScrollBoundaryControlsProps = {
  targetRef: RefObject<HTMLElement | null>;
};

type ScrollControlBounds = {
  bottom: number;
  clientHeight: number;
  height: number;
  left: number;
  scrollHeight: number;
  scrollTop: number;
  top: number;
  width: number;
};

type ScrollDirection = "up" | "down";

const DEFAULT_SCROLLBAR_WIDTH = 17;
const MIN_SCROLLBAR_WIDTH = 14;
const MAX_SCROLLBAR_WIDTH = 20;
const SCROLL_STEP_PX = 32;
const HOLD_DELAY_MS = 320;
const HOLD_INTERVAL_MS = 48;
const MIN_THUMB_HEIGHT_PX = 36;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sameBounds(left: ScrollControlBounds | null, right: ScrollControlBounds | null) {
  return left?.bottom === right?.bottom
    && left?.clientHeight === right?.clientHeight
    && left?.height === right?.height
    && left?.left === right?.left
    && left?.scrollHeight === right?.scrollHeight
    && left?.scrollTop === right?.scrollTop
    && left?.top === right?.top
    && left?.width === right?.width;
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className={styles.icon} viewBox="0 0 12 8">
      <path
        d="M1.35 6.45 5.48 1.37a.67.67 0 0 1 1.04 0l4.13 5.08a.67.67 0 0 1-.52 1.09H1.87a.67.67 0 0 1-.52-1.09Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ScrollBoundaryControls({ targetRef }: ScrollBoundaryControlsProps) {
  const [bounds, setBounds] = useState<ScrollControlBounds | null>(null);
  const holdDelayRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const thumbDragRef = useRef<{
    pointerId: number;
    scrollRange: number;
    startScrollTop: number;
    startY: number;
    thumbTravel: number;
  } | null>(null);

  function stopContinuousScroll() {
    if (holdDelayRef.current !== null) {
      window.clearTimeout(holdDelayRef.current);
      holdDelayRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function scrollOneStep(direction: ScrollDirection) {
    targetRef.current?.scrollBy({
      top: direction === "up" ? -SCROLL_STEP_PX : SCROLL_STEP_PX,
      behavior: "auto"
    });
  }

  function startContinuousScroll(event: ReactPointerEvent<HTMLButtonElement>, direction: ScrollDirection) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    stopContinuousScroll();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrollOneStep(direction);
    holdDelayRef.current = window.setTimeout(() => {
      holdDelayRef.current = null;
      holdIntervalRef.current = window.setInterval(() => scrollOneStep(direction), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  }

  function scrollToBoundary(direction: ScrollDirection) {
    stopContinuousScroll();
    const target = targetRef.current;
    if (!target) {
      return;
    }
    target.scrollTo({
      top: direction === "up" ? 0 : target.scrollHeight,
      behavior: "auto"
    });
  }

  function handleTrackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    thumbHeight: number,
    thumbTravel: number,
    scrollRange: number
  ) {
    if (event.button !== 0 || thumbTravel <= 0 || scrollRange <= 0) {
      return;
    }
    event.preventDefault();
    const trackRect = event.currentTarget.getBoundingClientRect();
    const requestedThumbTop = clamp(
      event.clientY - trackRect.top - thumbHeight / 2,
      0,
      thumbTravel
    );
    targetRef.current?.scrollTo({
      top: requestedThumbTop / thumbTravel * scrollRange,
      behavior: "auto"
    });
  }

  function handleTrackWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    targetRef.current?.scrollBy({
      top: event.deltaY,
      left: event.deltaX,
      behavior: "auto"
    });
  }

  function startThumbDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    thumbTravel: number,
    scrollRange: number
  ) {
    const target = targetRef.current;
    if (event.button !== 0 || !target || thumbTravel <= 0 || scrollRange <= 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    thumbDragRef.current = {
      pointerId: event.pointerId,
      scrollRange,
      startScrollTop: target.scrollTop,
      startY: event.clientY,
      thumbTravel
    };
  }

  function moveThumb(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = thumbDragRef.current;
    const target = targetRef.current;
    if (!drag || !target || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    target.scrollTop = clamp(
      drag.startScrollTop + (event.clientY - drag.startY) / drag.thumbTravel * drag.scrollRange,
      0,
      drag.scrollRange
    );
  }

  function stopThumbDrag(event?: ReactPointerEvent<HTMLDivElement>) {
    if (event && thumbDragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    thumbDragRef.current = null;
  }

  useLayoutEffect(() => {
    const target = targetRef.current;
    if (!target) {
      setBounds(null);
      return;
    }

    const measure = () => {
      measureFrameRef.current = null;
      const rect = target.getBoundingClientRect();
      const canScroll = target.scrollHeight > target.clientHeight + 1;
      if (!canScroll || rect.height <= 0 || rect.width <= 0) {
        setBounds((current) => current === null ? current : null);
        return;
      }
      const measuredScrollbarWidth = target.offsetWidth - target.clientWidth;
      const width = clamp(
        measuredScrollbarWidth || DEFAULT_SCROLLBAR_WIDTH,
        MIN_SCROLLBAR_WIDTH,
        MAX_SCROLLBAR_WIDTH
      );
      const next = {
        bottom: Math.round(rect.bottom),
        clientHeight: target.clientHeight,
        height: width,
        left: Math.round(rect.right - width),
        scrollHeight: target.scrollHeight,
        scrollTop: target.scrollTop,
        top: Math.round(rect.top),
        width
      };
      setBounds((current) => sameBounds(current, next) ? current : next);
    };

    const scheduleMeasure = () => {
      if (measureFrameRef.current === null) {
        measureFrameRef.current = window.requestAnimationFrame(measure);
      }
    };

    measure();
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(target);
    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(target, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    target.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      target.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      if (measureFrameRef.current !== null) {
        window.cancelAnimationFrame(measureFrameRef.current);
        measureFrameRef.current = null;
      }
    };
  }, [targetRef]);

  useEffect(() => () => {
    stopContinuousScroll();
    thumbDragRef.current = null;
  }, []);

  if (!bounds) {
    return null;
  }

  const commonStyle = {
    left: bounds.left,
    width: bounds.width,
    height: bounds.height
  } satisfies CSSProperties;
  const trackTop = bounds.top + bounds.height;
  const trackHeight = Math.max(0, bounds.clientHeight - bounds.height * 2);
  const scrollRange = Math.max(0, bounds.scrollHeight - bounds.clientHeight);
  const thumbHeight = Math.min(
    trackHeight,
    Math.max(MIN_THUMB_HEIGHT_PX, trackHeight * bounds.clientHeight / bounds.scrollHeight)
  );
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const thumbTop = scrollRange > 0 ? bounds.scrollTop / scrollRange * thumbTravel : 0;

  const button = (direction: ScrollDirection, top: number) => (
    <button
      aria-hidden="true"
      className={`${styles.control} ${direction === "down" ? styles.down : ""}`}
      onClick={(event) => {
        if (event.detail === 0) {
          scrollOneStep(direction);
        }
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        scrollToBoundary(direction);
      }}
      onLostPointerCapture={stopContinuousScroll}
      onPointerCancel={stopContinuousScroll}
      onPointerDown={(event) => startContinuousScroll(event, direction)}
      onPointerLeave={stopContinuousScroll}
      onPointerUp={stopContinuousScroll}
      style={{ ...commonStyle, top }}
      tabIndex={-1}
      type="button"
    >
      <ArrowIcon />
    </button>
  );

  return createPortal(
    <>
      {button("up", bounds.top)}
      <div
        aria-hidden="true"
        className={styles.track}
        onPointerDown={(event) => handleTrackPointerDown(event, thumbHeight, thumbTravel, scrollRange)}
        onWheel={handleTrackWheel}
        style={{
          height: trackHeight,
          left: bounds.left,
          top: trackTop,
          width: bounds.width
        }}
      >
        <div
          className={styles.thumb}
          onLostPointerCapture={stopThumbDrag}
          onPointerCancel={stopThumbDrag}
          onPointerDown={(event) => startThumbDrag(event, thumbTravel, scrollRange)}
          onPointerMove={moveThumb}
          onPointerUp={stopThumbDrag}
          style={{ height: thumbHeight, top: thumbTop }}
        />
      </div>
      {button("down", bounds.bottom - bounds.height)}
    </>,
    document.body
  );
}
