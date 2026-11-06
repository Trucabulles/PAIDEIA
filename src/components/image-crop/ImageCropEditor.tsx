import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ImageCrop } from "../../types/project";
import { useI18n } from "../../i18n/react";
import {
  createDefaultSquareCrop,
  drawCrop,
  moveCrop,
  normalizeCrop,
  resizeCrop
} from "./cropGeometry";
import type { CropHandle, CropPoint, CropShape, ImageDimensions } from "./cropGeometry";
import "./ImageCropEditor.css";

const HANDLES: CropHandle[] = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];

type CropInteraction =
  | { mode: "draw"; start: CropPoint }
  | { mode: "move"; start: CropPoint; crop: ImageCrop }
  | { mode: "resize"; handle: CropHandle; crop: ImageCrop };

type ImageCropEditorProps = {
  alt: string;
  className?: string;
  crop: ImageCrop | null;
  imageSrc: string;
  onApply: () => Promise<void> | void;
  onCancel: () => void;
  onCropChange: (crop: ImageCrop) => void;
  rounded?: boolean;
};

export function ImageCropEditor({
  alt,
  className = "",
  crop,
  imageSrc,
  onApply,
  onCancel,
  onCropChange,
  rounded = false
}: ImageCropEditorProps) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<CropInteraction | null>(null);
  const dimensionsRef = useRef<ImageDimensions>({ width: 1, height: 1 });
  const [freeRatio, setFreeRatio] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  async function applyCrop() {
    if (isApplying) {
      return;
    }
    setIsApplying(true);
    try {
      await onApply();
    } finally {
      setIsApplying(false);
    }
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLElement>): CropPoint {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    };
  }

  function initializeCrop(image: HTMLImageElement) {
    dimensionsRef.current = {
      width: image.naturalWidth || image.width || 1,
      height: image.naturalHeight || image.height || 1
    };

    if (!normalizeCrop(crop)) {
      onCropChange(createDefaultSquareCrop(dimensionsRef.current, "rectangle"));
    }
  }

  useEffect(() => {
    const image = stageRef.current?.querySelector("img");
    if (image?.complete && image.naturalWidth > 0) {
      initializeCrop(image);
    }
  }, [imageSrc]);

  function beginDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".image-crop-editor__selection, .image-crop-editor__controls")) {
      return;
    }

    const start = pointFromEvent(event);
    interactionRef.current = { mode: "draw", start };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginMove(event: ReactPointerEvent<HTMLDivElement>) {
    const normalized = normalizeCrop(crop);
    if (!normalized) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = { mode: "move", start: pointFromEvent(event), crop: normalized };
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function beginResize(handle: CropHandle, event: ReactPointerEvent<HTMLButtonElement>) {
    const normalized = normalizeCrop(crop);
    if (!normalized) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = { mode: "resize", handle, crop: normalized };
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function moveSelection(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    const point = pointFromEvent(event);

    if (interaction.mode === "draw") {
      onCropChange(
        drawCrop(
          interaction.start,
          point,
          dimensionsRef.current,
          !freeRatio,
          crop?.shape === "ellipse" ? "ellipse" : "rectangle"
        )
      );
      return;
    }

    if (interaction.mode === "move") {
      onCropChange(
        moveCrop(
          interaction.crop,
          point.x - interaction.start.x,
          point.y - interaction.start.y
        )
      );
      return;
    }

    onCropChange(
      resizeCrop(
        interaction.crop,
        interaction.handle,
        point,
        dimensionsRef.current,
        !freeRatio
      )
    );
  }

  function endInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const normalizedCrop = normalizeCrop(crop);
  const shape: CropShape = normalizedCrop?.shape === "ellipse" ? "ellipse" : "rectangle";

  function selectShape(nextShape: CropShape) {
    const nextCrop = normalizeCrop(crop) ?? createDefaultSquareCrop(dimensionsRef.current, nextShape);
    onCropChange({
      ...nextCrop,
      shape: nextShape
    });
  }

  return (
    <div className={`image-crop-editor-shell ${className}`.trim()}>
      <div className="image-crop-editor__controls">
        <div
          aria-label={t("imageCrop.shape", undefined, "Forme du crop")}
          className="image-crop-editor__shape-options"
          role="group"
        >
          <button
            aria-pressed={shape === "rectangle"}
            className={shape === "rectangle" ? "active" : ""}
            onClick={() => selectShape("rectangle")}
            type="button"
          >
            {t("imageCrop.rectangle", undefined, "Rectangle")}
          </button>

          <button
            aria-pressed={shape === "ellipse"}
            className={shape === "ellipse" ? "active" : ""}
            onClick={() => selectShape("ellipse")}
            type="button"
          >
            {t("imageCrop.ellipse", undefined, "Ellipse")}
          </button>
        </div>

        <label className="image-crop-editor__ratio">
          <input
            checked={freeRatio}
            onChange={(event) => setFreeRatio(event.target.checked)}
            type="checkbox"
          />
          {t("imageCrop.square", undefined, "Carré")}
        </label>

          <button
            aria-label={t("imageCrop.apply", undefined, "Appliquer le crop")}
            className="image-crop-editor__action apply"
            disabled={isApplying}
            onClick={() => void applyCrop()}
            type="button"
          >
            {isApplying ? "…" : "✓"}
          </button>

        <button
            aria-label={t("imageCrop.cancel", undefined, "Annuler le crop")}
            className="image-crop-editor__action cancel"
            disabled={isApplying}
            onClick={onCancel}
          type="button"
        >
          ×
        </button>
      </div>

      <div
        className={`image-crop-editor${rounded ? " rounded-media" : ""}`}
        onPointerCancel={endInteraction}
        onPointerDown={beginDraw}
        onPointerMove={moveSelection}
        onPointerUp={endInteraction}
        ref={stageRef}
      >
        <img
          alt={alt}
          className="image-crop-editor__image"
          onLoad={(event) => initializeCrop(event.currentTarget)}
          src={imageSrc}
        />

        {normalizedCrop ? (
          <div
            className={`image-crop-editor__selection ${shape}`}
            onPointerDown={beginMove}
            style={{
              left: `${normalizedCrop.x}%`,
              top: `${normalizedCrop.y}%`,
              width: `${normalizedCrop.width}%`,
              height: `${normalizedCrop.height}%`
            }}
          >
            {HANDLES.map((handle) => (
              <button
                aria-label={t("imageCrop.resizeHandle", { handle }, "Redimensionner le crop {handle}")}
                className={`image-crop-editor__handle ${handle}`}
                key={handle}
                onPointerDown={(event) => beginResize(handle, event)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
