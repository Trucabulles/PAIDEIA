import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { SituationalDialogueFraming } from "../../../types/project";
import styles from "./SituationalDialogueActivity.module.css";

type Framing = Pick<SituationalDialogueFraming, "x" | "y" | "zoom">;
const defaultFraming: Framing = { x: 0, y: 0, zoom: 1 };
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function DialogueCharacter({ src, alt, layout, framing = defaultFraming, onCommit, onStart }: {
  src: string;
  alt: string;
  layout: string;
  framing?: Framing;
  onCommit?: (framing: Framing) => void;
  onStart?: () => void;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const [positioning, setPositioning] = useState(false);
  const [draft, setDraft] = useState(framing);
  const draftRef = useRef(framing);
  const pendingZoom = useRef<number | undefined>(undefined);
  const dragRef = useRef<{
    pointer: number;
    x: number;
    y: number;
    width: number;
    height: number;
    limitX: number;
    limitY: number;
    start: Framing;
  } | null>(null);

  function update(next: Framing) {
    draftRef.current = next;
    setDraft(next);
  }

  const finishZoom = useCallback(() => {
    if (pendingZoom.current === undefined) return;
    window.clearTimeout(pendingZoom.current);
    pendingZoom.current = undefined;
    commitRef.current?.(draftRef.current);
  }, []);

  useEffect(() => {
    if (!dragRef.current && pendingZoom.current === undefined) update(framing);
  }, [framing.x, framing.y, framing.zoom]);

  useEffect(() => () => finishZoom(), [finishZoom]);

  useEffect(() => {
    if (!positioning) return;
    function stop() {
      finishZoom();
      if (dragRef.current) update(dragRef.current.start);
      dragRef.current = null;
      setPositioning(false);
    }
    function outside(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && !figureRef.current?.contains(event.target)) stop();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      stop();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [positioning, finishZoom]);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || !positioning || layout !== "compact-portrait") return;
    function wheel(event: WheelEvent) {
      if (!event.deltaY || event.ctrlKey || event.metaKey || dragRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const current = draftRef.current;
      const zoom = clamp(Math.round((current.zoom - Math.sign(event.deltaY) * 0.05) * 100) / 100, 0.65, 1.6);
      if (zoom === current.zoom) return;
      update({ ...current, zoom });
      window.clearTimeout(pendingZoom.current);
      pendingZoom.current = window.setTimeout(finishZoom, 240);
    }
    figure.addEventListener("wheel", wheel, { passive: false });
    return () => figure.removeEventListener("wheel", wheel);
  }, [layout, positioning, finishZoom]);

  function begin(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !imageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    finishZoom();
    const image = imageRef.current;
    const frame = event.currentTarget.getBoundingClientRect();
    const painted = image.getBoundingClientRect();
    const width = Math.max(1, image.offsetWidth);
    const height = Math.max(1, image.offsetHeight);
    const start = draftRef.current;
    dragRef.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width,
      height,
      limitX: Math.min(50, Math.max(Math.abs(painted.width - frame.width) / 2, frame.width * .18) * 100 / width),
      limitY: Math.min(50, Math.max(Math.abs(painted.height - frame.height) / 2, frame.height * .18) * 100 / height),
      start
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const x = clamp(drag.start.x + (event.clientX - drag.x) * 100 / drag.width, -drag.limitX, drag.limitX);
    const y = clamp(drag.start.y + (event.clientY - drag.y) * 100 / drag.height, -drag.limitY, drag.limitY);
    update({ ...draftRef.current, x, y });
  }

  function end(event: PointerEvent<HTMLElement>, canceled: boolean) {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    dragRef.current = null;
    if (canceled) {
      update(drag.start);
      return;
    }
    const next = draftRef.current;
    if (next.x !== drag.start.x || next.y !== drag.start.y) commitRef.current?.(next);
  }

  const framed = layout === "responses-below" || layout === "compact-portrait";
  return (
    <figure
      className={styles.character}
      ref={figureRef}
      data-dialogue-character-positionable={onCommit ? true : undefined}
      data-dialogue-framing-active={positioning ? true : undefined}
      onDoubleClick={onCommit ? event => {
        event.preventDefault();
        event.stopPropagation();
        if (positioning) finishZoom();
        else onStart?.();
        setPositioning(!positioning);
      } : undefined}
      onPointerDown={positioning ? begin : undefined}
      onPointerMove={positioning ? move : undefined}
      onPointerUp={positioning ? event => end(event, false) : undefined}
      onPointerCancel={positioning ? event => end(event, true) : undefined}
      onLostPointerCapture={positioning ? event => end(event, true) : undefined}
    >
      <span aria-hidden="true" className={styles.characterBackdrop} />
      <img
        ref={imageRef}
        alt={alt}
        src={src}
        draggable={false}
        style={framed ? { translate: String(draft.x) + "% " + String(draft.y) + "%", scale: String(draft.zoom) } : undefined}
        onLoad={event => {
          const image = event.currentTarget;
          const cropRatio = layout === "responses-below" ? 1 : 1.25;
          image.toggleAttribute("data-portrait-crop", image.naturalHeight > image.naturalWidth * cropRatio);
        }}
      />
    </figure>
  );
}
