import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n/react";
import styles from "./HeaderActivity.module.css";
import type { HeaderActivityProps } from "./types";

export function HeaderActivity({ authoringMode = false, contentNode, contentPosition, imagePositionY = 50, onImagePositionChange, style }: HeaderActivityProps) {
  const { t } = useI18n();
  const [positioning, setPositioning] = useState(false);
  const [position, setPosition] = useState(() => Math.min(100, Math.max(0, Number(imagePositionY) || 50)));
  const positionRef = useRef(position);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startPosition: number; height: number } | null>(null);

  useEffect(() => {
    if (!positioning) {
      const next = Math.min(100, Math.max(0, Number(imagePositionY) || 50));
      positionRef.current = next;
      setPosition(next);
    }
  }, [imagePositionY, positioning]);

  useEffect(() => {
    if (!positioning) {
      return;
    }

    function stopPositioning(event: PointerEvent) {
      if (event.target instanceof Node && bannerRef.current?.contains(event.target)) {
        return;
      }
      dragRef.current = null;
      setPositioning(false);
    }

    document.addEventListener("pointerdown", stopPositioning);
    return () => document.removeEventListener("pointerdown", stopPositioning);
  }, [positioning]);

  useLayoutEffect(() => {
    if (authoringMode) return;
    const banner = bannerRef.current;
    const viewport = copyRef.current;
    const content = viewport?.querySelector<HTMLElement>(".rich-content");
    if (!banner || !viewport || !content) return;
    const ownerWindow = banner.ownerDocument.defaultView ?? window;
    const ResizeObserverConstructor = ownerWindow.ResizeObserver ?? ResizeObserver;
    let frame = 0;
    const reset = () => {
      content.style.removeProperty("zoom");
      content.style.removeProperty("transform");
      content.style.removeProperty("transform-origin");
      viewport.style.removeProperty("max-height");
      viewport.style.removeProperty("overflow");
    };
    const fit = () => {
      frame = 0;
      reset();
      if (ownerWindow.innerWidth > 820) return;
      const bannerStyle = ownerWindow.getComputedStyle(banner);
      const availableHeight = Math.max(
        1,
        Number.parseFloat(bannerStyle.minHeight || "0")
          - Number.parseFloat(bannerStyle.paddingTop || "0")
          - Number.parseFloat(bannerStyle.paddingBottom || "0")
      );
      const availableWidth = viewport.clientWidth;
      if (!availableWidth || !availableHeight) return;
      viewport.style.maxHeight = `${availableHeight}px`;
      viewport.style.overflow = "hidden";
      const naturalWidth = content.scrollWidth;
      const naturalHeight = content.scrollHeight;
      const fits = (scale: number) => naturalWidth * scale <= availableWidth + 0.75
        && naturalHeight * scale <= availableHeight + 0.75;
      if (fits(1)) return;
      let low = 0.35;
      let high = 1;
      if (!fits(low)) return;
      for (let index = 0; index < 12; index += 1) {
        const probe = (low + high) / 2;
        if (fits(probe)) low = probe;
        else high = probe;
      }
      const origin = contentPosition === "right" ? "right" : contentPosition === "center" ? "center" : "left";
      if ("MozAppearance" in banner.ownerDocument.documentElement.style) {
        content.style.transformOrigin = `${origin} top`;
        content.style.transform = `scale(${low.toFixed(4)})`;
      } else {
        content.style.zoom = low.toFixed(4);
      }
    };
    const schedule = () => {
      if (frame) ownerWindow.cancelAnimationFrame(frame);
      frame = ownerWindow.requestAnimationFrame(fit);
    };
    schedule();
    const resizeObserver = new ResizeObserverConstructor(schedule);
    resizeObserver.observe(banner);
    resizeObserver.observe(viewport);
    const MutationObserverConstructor = ownerWindow.MutationObserver ?? MutationObserver;
    const mutationObserver = new MutationObserverConstructor(schedule);
    mutationObserver.observe(content, { childList: true, characterData: true, subtree: true });
    banner.ownerDocument.fonts?.ready.then(schedule).catch(() => undefined);
    ownerWindow.addEventListener("resize", schedule);
    return () => {
      if (frame) ownerWindow.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      ownerWindow.removeEventListener("resize", schedule);
      reset();
    };
  }, [authoringMode, contentNode, contentPosition, style]);

  const canPosition = authoringMode && Boolean(onImagePositionChange) && style["--header-background-image" as keyof CSSProperties] !== "none";
  const updatePosition = (next: number, commit = true) => {
    const clamped = Math.round(Math.min(100, Math.max(0, next)));
    positionRef.current = clamped;
    setPosition(clamped);
    if (commit) {
      onImagePositionChange?.(clamped);
    }
  };

  return (
    <div className={`header-block ${styles.activity}`}>
      <div
        aria-label={canPosition ? t("header.imageVerticalPosition") : undefined}
        aria-valuemax={canPosition && positioning ? 100 : undefined}
        aria-valuemin={canPosition && positioning ? 0 : undefined}
        aria-valuenow={canPosition && positioning ? position : undefined}
        className={`header-banner${canPosition && positioning ? ` ${styles.draggablePreview}` : ""}`}
        ref={bannerRef}
        onDoubleClick={canPosition ? (event) => {
          if ((event.target as HTMLElement).closest(".header-banner-copy")) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (positioning) {
            dragRef.current = null;
          }
          setPositioning((current) => !current);
        } : undefined}
        onKeyDown={canPosition && positioning ? (event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            updatePosition(position - 1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            updatePosition(position + 1);
          } else if (event.key === "Home") {
            event.preventDefault();
            updatePosition(0);
          } else if (event.key === "End") {
            event.preventDefault();
            updatePosition(100);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setPositioning(false);
          }
        } : undefined}
        onPointerDown={canPosition && positioning ? (event) => {
          const height = Math.max(1, event.currentTarget.getBoundingClientRect().height);
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startPosition: position, height };
        } : undefined}
        onPointerMove={canPosition && positioning ? (event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          updatePosition(drag.startPosition - ((event.clientY - drag.startY) / drag.height) * 100, false);
        } : undefined}
        onPointerUp={canPosition && positioning ? (event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          onImagePositionChange?.(positionRef.current);
        } : undefined}
        onPointerCancel={canPosition && positioning ? () => { dragRef.current = null; } : undefined}
        role={canPosition && positioning ? "slider" : undefined}
        style={{ ...style, "--header-background-position-y": `${position}%` } as CSSProperties}
        tabIndex={canPosition && positioning ? 0 : undefined}
        title={canPosition ? t("header.imagePositionHint") : undefined}
      >
        <div className={`header-banner-copy header-banner-copy-${contentPosition}`} ref={copyRef}>{contentNode}</div>
      </div>
    </div>
  );
}
