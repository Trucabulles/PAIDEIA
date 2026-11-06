import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SelectionCheckIcon } from "../../SelectionCheckIcon";
import { SelectionCrossIcon } from "../../SelectionCrossIcon";
import { AuthoringButton } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import { useI18n } from "../../../i18n/react";
import { translateActive } from "../../../i18n";
import styles from "./NativeImageAnnotationTool.module.css";
import { flattenNativeImageAnnotationsToDataUrl } from "./nativeRasterize";
import { annotationResolutionAccess, type AnnotationResolutionAccess } from "./annotationResolution";
import {
  centeredRepeatableGeometryRect,
  repeatableGeometryTemplateFromAnnotation,
  repeatableGeometryTemplatesFromDocument,
  type RepeatableGeometryKey,
  type RepeatableGeometryTemplate
} from "./annotationRepeatTemplate";
import {
  createEmptyNativeAnnotationDocument,
  DEFAULT_NATIVE_FILL,
  DEFAULT_NATIVE_STROKE,
  DEFAULT_NATIVE_TEXT,
  type NativeAnnotation,
  type NativeAnnotationFillStyle,
  type NativeAnnotationPoint,
  type NativeAnnotationStrokeStyle,
  type NativeAnnotationTextStyle,
  type NativeAnnotationTool,
  type NativeImageAnnotationDocument
} from "./nativeTypes";

// UI behavior and icon direction are aligned with TOAST UI Image Editor
// for product parity. TOAST UI Image Editor is MIT licensed by NHN Cloud;
// keep the local notice with this native tool if the legacy Toast activity is removed.
// See ./TOAST_UI_IMAGE_EDITOR_NOTICE.md.

type NativeImageAnnotationToolProps = {
  imageAlt: string;
  imageSrc: string | null;
  onApply?: () => Promise<void> | void;
  onApplyEnd?: () => void;
  onApplyStart?: () => void;
  onCancel?: () => void;
  onChange: (value: NativeImageAnnotationDocument, renderedDataUrl?: string | null) => Promise<void> | void;
  title?: string;
  value: NativeImageAnnotationDocument;
};

type RepeatableDraft = { repeatTemplate?: RepeatableGeometryTemplate };
type DrawingDraft =
  | { kind: "path"; id: string; points: NativeAnnotationPoint[] }
  | { kind: "line"; id: string; x1: number; x2: number; y1: number; y2: number }
  | ({ anchorX: number; anchorY: number; kind: "rect" | "ellipse" | "icon"; height: number; id: string; width: number; x: number; y: number } & RepeatableDraft)
  | { anchorX: number; anchorY: number; kind: "text"; height: number; id: string; width: number; x: number; y: number };

type ToolContext = "select" | "path" | "line" | "rect" | "ellipse" | "icon" | "text";
type ToolFamily = "select" | "draw" | "shape" | "icon" | "text";
type IconType = "arrow" | "arrow2" | "arrow3" | "star" | "position" | "bubble";
type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
type ImageDimensions = { width: number; height: number };
type VisualStyleFamily = "draw" | "shape" | "icon";
type VisualStyleSettings = {
  blurAmount: number;
  blurEnabled: boolean;
  fill: NativeAnnotationFillStyle;
  stroke: NativeAnnotationStrokeStyle;
};
type LineAnnotation = Extract<NativeAnnotation, { kind: "line" }>;
type IconAnnotation = Extract<NativeAnnotation, { kind: "icon" }>;
type ResizeableAnnotation = Extract<NativeAnnotation, { x: number; y: number; width: number; height: number }>;
type ResizeInteraction = {
  documentBefore: NativeImageAnnotationDocument;
  handle: ResizeHandle;
  original: ResizeableAnnotation;
};
type MoveInteraction = {
  documentBefore: NativeImageAnnotationDocument;
  original: ResizeableAnnotation;
  start: NativeAnnotationPoint;
};
type LineInteraction = {
  documentBefore: NativeImageAnnotationDocument;
  endpoint?: "start" | "end";
  original: LineAnnotation;
  start: NativeAnnotationPoint;
};
type RotationInteraction = {
  center: NativeAnnotationPoint;
  documentBefore: NativeImageAnnotationDocument;
  original: IconAnnotation;
  startAngle: number;
  startRotation: number;
};

const RESIZE_HANDLES: ResizeHandle[] = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
const MIN_RESIZE_PERCENT = 1;
const MAX_BLUR_LEVEL = 10;
const BLUR_EDGE_PADDING_PX = 150;
const SVG_EDGE_SAMPLE_PERCENT = 0.01;
const HISTORY_LIMIT = 20;

function blurLevel(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_BLUR_LEVEL, Math.round(value)));
}

function pushHistory(
  stack: NativeImageAnnotationDocument[],
  document: NativeImageAnnotationDocument
) {
  return [...stack, document].slice(-HISTORY_LIMIT);
}
const TEXT_DOUBLE_CLICK_DELAY_MS = 420;
const TEXT_DOUBLE_CLICK_DISTANCE_PX = 12;

function createDefaultVisualStyle(): VisualStyleSettings {
  return {
    blurEnabled: false,
    blurAmount: 6,
    stroke: { ...DEFAULT_NATIVE_STROKE },
    fill: { ...DEFAULT_NATIVE_FILL }
  };
}

function cloneTextStyle(style: NativeAnnotationTextStyle): NativeAnnotationTextStyle {
  return { ...style };
}

function createAnnotationId() {
  return `native_annotation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  };
}

function moveRect(x: number, y: number, width: number, height: number, dx: number, dy: number) {
  return {
    x: clampPercent(Math.max(0, Math.min(100 - width, x + dx))),
    y: clampPercent(Math.max(0, Math.min(100 - height, y + dy))),
    width,
    height
  };
}

function moveLine(line: LineAnnotation, dx: number, dy: number) {
  const minX = Math.min(line.x1, line.x2);
  const maxX = Math.max(line.x1, line.x2);
  const minY = Math.min(line.y1, line.y2);
  const maxY = Math.max(line.y1, line.y2);
  const clampedDx = Math.max(-minX, Math.min(100 - maxX, dx));
  const clampedDy = Math.max(-minY, Math.min(100 - maxY, dy));

  return {
    x1: clampPercent(line.x1 + clampedDx),
    y1: clampPercent(line.y1 + clampedDy),
    x2: clampPercent(line.x2 + clampedDx),
    y2: clampPercent(line.y2 + clampedDy)
  };
}

function resizeRect(
  rect: Pick<ResizeableAnnotation, "x" | "y" | "width" | "height">,
  handle: ResizeHandle,
  point: NativeAnnotationPoint,
  dimensions: ImageDimensions
) {
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  let crossedX = false;
  let crossedY = false;

  if (handle.length === 2) {
    const anchorX = west ? right : left;
    const anchorY = north ? bottom : top;
    const aspect = Math.max(0.05, (rect.width * dimensions.width) / Math.max(1, rect.height * dimensions.height));
    const requestedWidthPx = Math.abs(point.x - anchorX) / 100 * dimensions.width;
    const requestedHeightPx = Math.abs(point.y - anchorY) / 100 * dimensions.height;
    const widthFromHeightPx = requestedHeightPx * aspect;
    const nextWidthPx = Math.max(MIN_RESIZE_PERCENT / 100 * dimensions.width, requestedWidthPx, widthFromHeightPx);
    const nextHeightPx = nextWidthPx / aspect;
    const nextWidth = Math.min(100, nextWidthPx / Math.max(1, dimensions.width) * 100);
    const nextHeight = Math.min(100, nextHeightPx / Math.max(1, dimensions.height) * 100);
    crossedX = west ? point.x > anchorX : point.x < anchorX;
    crossedY = north ? point.y > anchorY : point.y < anchorY;
    const directionX = (west ? -1 : 1) * (crossedX ? -1 : 1);
    const directionY = (north ? -1 : 1) * (crossedY ? -1 : 1);
    left = directionX < 0 ? anchorX - nextWidth : anchorX;
    right = directionX < 0 ? anchorX : anchorX + nextWidth;
    top = directionY < 0 ? anchorY - nextHeight : anchorY;
    bottom = directionY < 0 ? anchorY : anchorY + nextHeight;
  } else {
    if (west) {
      left = Math.max(0, Math.min(100, point.x));
      crossedX = left > right;
    }
    if (east) {
      right = Math.max(0, Math.min(100, point.x));
      crossedX = right < left;
    }
    if (north) {
      top = Math.max(0, Math.min(100, point.y));
      crossedY = top > bottom;
    }
    if (south) {
      bottom = Math.max(0, Math.min(100, point.y));
      crossedY = bottom < top;
    }
  }

  const normalized = normalizeRect(left, top, right, bottom);
  return {
    x: clampPercent(Math.min(normalized.x, 100 - MIN_RESIZE_PERCENT)),
    y: clampPercent(Math.min(normalized.y, 100 - MIN_RESIZE_PERCENT)),
    width: Math.max(MIN_RESIZE_PERCENT, Math.min(normalized.width, 100 - normalized.x)),
    height: Math.max(MIN_RESIZE_PERCENT, Math.min(normalized.height, 100 - normalized.y)),
    crossedX,
    crossedY
  };
}

function normalizeRotation(degrees: number) {
  return ((Math.round(degrees) % 360) + 360) % 360;
}

function angleFromCenter(center: NativeAnnotationPoint, point: NativeAnnotationPoint) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function pixelSpaceTransform(
  bounds: Pick<ResizeableAnnotation, "x" | "y" | "width" | "height">,
  rotation: number,
  flipX: boolean,
  flipY: boolean,
  dimensions: ImageDimensions
) {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const sx = Math.max(1, dimensions.width) / 100;
  const sy = Math.max(1, dimensions.height) / 100;
  const flipScaleX = flipX ? -1 : 1;
  const flipScaleY = flipY ? -1 : 1;
  const a = cos * flipScaleX;
  const b = sin * flipScaleX * sx / sy;
  const c = -sin * flipScaleY * sy / sx;
  const d = cos * flipScaleY;
  const e = centerX - a * centerX - c * centerY;
  const f = centerY - b * centerX - d * centerY;
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

function transformPointInPixelSpace(
  point: NativeAnnotationPoint,
  center: NativeAnnotationPoint,
  rotation: number,
  flipX: boolean,
  flipY: boolean,
  dimensions: ImageDimensions
): NativeAnnotationPoint {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const sx = Math.max(1, dimensions.width) / 100;
  const sy = Math.max(1, dimensions.height) / 100;
  const dx = (point.x - center.x) * sx * (flipX ? -1 : 1);
  const dy = (point.y - center.y) * sy * (flipY ? -1 : 1);
  return {
    x: center.x + (dx * cos - dy * sin) / sx,
    y: center.y + (dx * sin + dy * cos) / sy
  };
}

function rotatedBoxGeometry(
  bounds: Pick<ResizeableAnnotation, "x" | "y" | "width" | "height">,
  rotation: number,
  flipX: boolean,
  flipY: boolean,
  dimensions: ImageDimensions
) {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const points = {
    nw: { x: bounds.x, y: bounds.y },
    ne: { x: bounds.x + bounds.width, y: bounds.y },
    sw: { x: bounds.x, y: bounds.y + bounds.height },
    se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    n: { x: bounds.x + bounds.width / 2, y: bounds.y },
    s: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    w: { x: bounds.x, y: bounds.y + bounds.height / 2 },
    e: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
  } satisfies Record<ResizeHandle, NativeAnnotationPoint>;
  return {
    center,
    handles: Object.fromEntries(
      RESIZE_HANDLES.map((handle) => [
        handle,
        transformPointInPixelSpace(points[handle], center, rotation, flipX, flipY, dimensions)
      ])
    ) as Record<ResizeHandle, NativeAnnotationPoint>,
    corners: (["nw", "ne", "se", "sw"] as const).map((handle) =>
      transformPointInPixelSpace(points[handle], center, rotation, flipX, flipY, dimensions)
    ),
    top: transformPointInPixelSpace(points.n, center, rotation, flipX, flipY, dimensions)
  };
}

function centeredSquareRect(
  center: NativeAnnotationPoint,
  point: NativeAnnotationPoint,
  dimensions: ImageDimensions,
  minimumSidePx = 48
) {
  const imageWidth = Math.max(1, dimensions.width);
  const imageHeight = Math.max(1, dimensions.height);
  const requestedWidthPx = Math.abs(point.x - center.x) / 100 * imageWidth * 2;
  const requestedHeightPx = Math.abs(point.y - center.y) / 100 * imageHeight * 2;
  const availableSidePx = Math.max(
    1,
    Math.min(
      center.x / 100 * imageWidth,
      (100 - center.x) / 100 * imageWidth,
      center.y / 100 * imageHeight,
      (100 - center.y) / 100 * imageHeight
    ) * 2
  );
  const sidePx = Math.min(availableSidePx, Math.max(Math.min(minimumSidePx, availableSidePx), requestedWidthPx, requestedHeightPx));
  const width = sidePx / imageWidth * 100;
  const height = sidePx / imageHeight * 100;
  return {
    x: clampPercent(center.x - width / 2),
    y: clampPercent(center.y - height / 2),
    width: Math.max(MIN_RESIZE_PERCENT, Math.min(width, 100)),
    height: Math.max(MIN_RESIZE_PERCENT, Math.min(height, 100))
  };
}

function centeredDefaultRect(
  center: NativeAnnotationPoint,
  dimensions: ImageDimensions,
  widthPx = 180,
  heightPx = 110
) {
  const imageWidth = Math.max(1, dimensions.width);
  const imageHeight = Math.max(1, dimensions.height);
  const width = Math.min(80, widthPx / imageWidth * 100);
  const height = Math.min(80, heightPx / imageHeight * 100);
  return {
    x: Math.max(0, Math.min(100 - width, center.x - width / 2)),
    y: Math.max(0, Math.min(100 - height, center.y - height / 2)),
    width: Math.max(MIN_RESIZE_PERCENT, width),
    height: Math.max(MIN_RESIZE_PERCENT, height)
  };
}

function rgba(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  if (expanded.length !== 6) {
    return hex;
  }
  if (opacity >= 100) {
    return `#${expanded}`;
  }
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

function annotationBounds(annotation: NativeAnnotation) {
  if (annotation.kind === "path") {
    const xs = annotation.points.map((point) => point.x);
    const ys = annotation.points.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  if (annotation.kind === "line") {
    return normalizeRect(annotation.x1, annotation.y1, annotation.x2, annotation.y2);
  }

  return {
    x: annotation.x,
    y: annotation.y,
    width: annotation.width,
    height: annotation.height
  };
}

function renderBlurEdgeTile({
  height,
  imageSrc,
  viewBox,
  width,
  x,
  y
}: {
  height: number;
  imageSrc: string;
  viewBox: string;
  width: number;
  x: number;
  y: number;
}) {
  if (width <= 0 || height <= 0) {
    return null;
  }
  return (
    <svg height={height} overflow="hidden" preserveAspectRatio="none" viewBox={viewBox} width={width} x={x} y={y}>
      <image height="100" href={imageSrc} preserveAspectRatio="none" width="100" x="0" y="0" />
    </svg>
  );
}

function renderShapeBitmapBlur(
  annotation: Extract<NativeAnnotation, { kind: "rect" | "ellipse" }>,
  imageSrc: string | null,
  imageDimensions: ImageDimensions
) {
  if (!imageSrc || annotation.blurEnabled !== true) {
    return null;
  }

  const clipId = `native-annotation-clip-${annotation.id}`;
  const filterId = `native-annotation-blur-${annotation.id}`;
  const blurAmount = Math.max(0.2, blurLevel(annotation.blurAmount));
  const padX = Math.max((BLUR_EDGE_PADDING_PX / Math.max(1, imageDimensions.width)) * 100, blurAmount * 3);
  const padY = Math.max((BLUR_EDGE_PADDING_PX / Math.max(1, imageDimensions.height)) * 100, blurAmount * 3);
  const filterX = -padX;
  const filterY = -padY;
  const filterWidth = 100 + padX * 2;
  const filterHeight = 100 + padY * 2;

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          {annotation.kind === "rect" ? (
            <rect height={annotation.height} width={annotation.width} x={annotation.x} y={annotation.y} />
          ) : (
            <ellipse
              cx={annotation.x + annotation.width / 2}
              cy={annotation.y + annotation.height / 2}
              rx={annotation.width / 2}
              ry={annotation.height / 2}
            />
          )}
        </clipPath>
        <filter
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height={filterHeight}
          id={filterId}
          primitiveUnits="userSpaceOnUse"
          width={filterWidth}
          x={filterX}
          y={filterY}
        >
          <feGaussianBlur edgeMode="duplicate" stdDeviation={blurAmount / 2} />
        </filter>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g filter={`url(#${filterId})`}>
          <image height="100" href={imageSrc} preserveAspectRatio="none" width="100" x="0" y="0" />
          {renderBlurEdgeTile({ height: 100, imageSrc, viewBox: `0 0 ${SVG_EDGE_SAMPLE_PERCENT} 100`, width: padX, x: -padX, y: 0 })}
          {renderBlurEdgeTile({ height: 100, imageSrc, viewBox: `${100 - SVG_EDGE_SAMPLE_PERCENT} 0 ${SVG_EDGE_SAMPLE_PERCENT} 100`, width: padX, x: 100, y: 0 })}
          {renderBlurEdgeTile({ height: padY, imageSrc, viewBox: `0 0 100 ${SVG_EDGE_SAMPLE_PERCENT}`, width: 100, x: 0, y: -padY })}
          {renderBlurEdgeTile({ height: padY, imageSrc, viewBox: `0 ${100 - SVG_EDGE_SAMPLE_PERCENT} 100 ${SVG_EDGE_SAMPLE_PERCENT}`, width: 100, x: 0, y: 100 })}
          {renderBlurEdgeTile({ height: padY, imageSrc, viewBox: `0 0 ${SVG_EDGE_SAMPLE_PERCENT} ${SVG_EDGE_SAMPLE_PERCENT}`, width: padX, x: -padX, y: -padY })}
          {renderBlurEdgeTile({ height: padY, imageSrc, viewBox: `${100 - SVG_EDGE_SAMPLE_PERCENT} 0 ${SVG_EDGE_SAMPLE_PERCENT} ${SVG_EDGE_SAMPLE_PERCENT}`, width: padX, x: 100, y: -padY })}
          {renderBlurEdgeTile({ height: padY, imageSrc, viewBox: `0 ${100 - SVG_EDGE_SAMPLE_PERCENT} ${SVG_EDGE_SAMPLE_PERCENT} ${SVG_EDGE_SAMPLE_PERCENT}`, width: padX, x: -padX, y: 100 })}
          {renderBlurEdgeTile({ height: padY, imageSrc, viewBox: `${100 - SVG_EDGE_SAMPLE_PERCENT} ${100 - SVG_EDGE_SAMPLE_PERCENT} ${SVG_EDGE_SAMPLE_PERCENT} ${SVG_EDGE_SAMPLE_PERCENT}`, width: padX, x: 100, y: 100 })}
        </g>
      </g>
    </>
  );
}

function renderAnnotationShape(
  annotation: NativeAnnotation,
  selected: boolean,
  imageSrc: string | null = null,
  imageDimensions: ImageDimensions = { width: 1, height: 1 }
) {
  const commonStroke = rgba(annotation.stroke.color, annotation.stroke.opacity);
  const commonFill = rgba(annotation.fill.color, annotation.fill.opacity);

  if (annotation.kind === "path") {
    const d = annotation.points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    return (
      <path
        d={d}
        fill="none"
        stroke={commonStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={annotation.stroke.width}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (annotation.kind === "line") {
    return (
      <line
        stroke={commonStroke}
        strokeLinecap="round"
        strokeWidth={annotation.stroke.width}
        vectorEffect="non-scaling-stroke"
        x1={annotation.x1}
        x2={annotation.x2}
        y1={annotation.y1}
        y2={annotation.y2}
      />
    );
  }

  if (annotation.kind === "rect") {
    return (
      <>
        {renderShapeBitmapBlur(annotation, imageSrc, imageDimensions)}
        <rect
          fill={commonFill}
          height={annotation.height}
          stroke={commonStroke}
          strokeWidth={annotation.stroke.width}
          vectorEffect="non-scaling-stroke"
          width={annotation.width}
          x={annotation.x}
          y={annotation.y}
        />
      </>
    );
  }

  if (annotation.kind === "ellipse") {
    return (
      <>
        {renderShapeBitmapBlur(annotation, imageSrc, imageDimensions)}
        <ellipse
          cx={annotation.x + annotation.width / 2}
          cy={annotation.y + annotation.height / 2}
          fill={commonFill}
          rx={annotation.width / 2}
          ry={annotation.height / 2}
          stroke={commonStroke}
          strokeWidth={annotation.stroke.width}
          vectorEffect="non-scaling-stroke"
        />
      </>
    );
  }

  if (annotation.kind === "icon") {
    const bounds = annotationBounds(annotation);
    const ratio = iconDisplayRatio(annotation.iconType);
    const ratioValue = ratio.width / ratio.height;
    const boundsRatio = bounds.height > 0 ? bounds.width / bounds.height : ratioValue;
    const iconWidth = boundsRatio > ratioValue ? bounds.height * ratioValue : bounds.width;
    const iconHeight = boundsRatio > ratioValue ? bounds.height : bounds.width / ratioValue;
    const iconX = bounds.x + (bounds.width - iconWidth) / 2;
    const iconY = bounds.y + (bounds.height - iconHeight) / 2;
    return (
      <svg
        aria-hidden="true"
        color={annotation.stroke.color}
        height={iconHeight}
        opacity={annotation.stroke.opacity / 100}
        overflow="visible"
        preserveAspectRatio={hasCustomIconDisplayRatio(annotation.iconType) ? "none" : "xMidYMid meet"}
        viewBox="0 0 32 32"
        width={iconWidth}
        x={iconX}
        y={iconY}
        transform={pixelSpaceTransform(bounds, annotation.iconRotation ?? 0, annotation.iconFlipX ?? false, annotation.iconFlipY ?? false, imageDimensions)}
      >
        {renderIconGlyph(annotation.iconType)}
      </svg>
    );
  }

  return null;
}

function renderAnnotationHitShape(annotation: NativeAnnotation) {
  if (annotation.kind === "path") {
    const d = annotation.points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    return (
      <path
        className={styles.annotationHitShape}
        d={d}
        fill="none"
        stroke="transparent"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={14}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  if (annotation.kind === "line") {
    return (
      <line
        className={styles.annotationHitShape}
        stroke="transparent"
        strokeLinecap="round"
        strokeWidth={14}
        vectorEffect="non-scaling-stroke"
        x1={annotation.x1}
        x2={annotation.x2}
        y1={annotation.y1}
        y2={annotation.y2}
      />
    );
  }

  return null;
}

function toolLabel(tool: ToolContext) {
  switch (tool) {
    case "select":
      return translateActive("annotation.tool.select");
    case "path":
      return translateActive("annotation.tool.freehand");
    case "line":
      return translateActive("annotation.tool.line");
    case "rect":
      return translateActive("annotation.tool.rectangle");
    case "ellipse":
      return translateActive("annotation.tool.ellipse");
    case "icon":
      return translateActive("annotation.tool.icon");
    case "text":
      return translateActive("annotation.tool.text");
  }
}

function toolFamilyLabel(family: ToolFamily) {
  switch (family) {
    case "select":
      return translateActive("annotation.family.select");
    case "draw":
      return translateActive("annotation.family.draw");
    case "shape":
      return translateActive("annotation.family.shapes");
    case "text":
      return translateActive("annotation.family.text");
    case "icon":
      return translateActive("annotation.family.icons");
  }
}

function toolToFamily(tool: ToolContext): ToolFamily {
  switch (tool) {
    case "path":
    case "line":
      return "draw";
    case "rect":
    case "ellipse":
      return "shape";
    case "icon":
      return "icon";
    case "text":
      return "text";
    case "select":
    default:
      return "select";
  }
}

function toolIcon(tool: ToolContext): ReactNode {
  switch (tool) {
    case "select":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 3v14l4.1-3.2 2.8 6.2 2.3-1.1-2.8-6.1 5.6-.4z" fill="currentColor" />
        </svg>
      );
    case "path":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3 15.7C3.2 9.4 4.6 6.2 7.3 6.2c4.5 0 2 11.6 5.9 11.6 3.2 0 1.2-8.8 4.7-8.8 3 0 1 6.8 3.8 6.8 1.1 0 1.8-1.3 2-4.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case "line":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 12h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "rect":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect fill="none" height="12" stroke="currentColor" strokeWidth="2" width="16" x="4" y="6" />
        </svg>
      );
    case "ellipse":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <ellipse cx="12" cy="12" fill="none" rx="8" ry="6" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "icon":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3.2l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "text":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 6h14M12 6v12M8 18h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
  }
}

function ToolButton({
  active,
  onClick,
  tool
}: {
  active: boolean;
  onClick: () => void;
  tool: ToolContext;
}) {
  return (
    <AuthoringButton
      active={active}
      aria-label={toolLabel(tool)}
      className={styles.toolButton}
      compact
      onClick={onClick}
      title={toolLabel(tool)}
      variant="ghost"
    >
      <span className={styles.toolButtonIcon}>{toolIcon(tool)}</span>
      <span className={styles.toolButtonLabel}>{tool === "path" ? translateActive("annotation.drawing") : toolLabel(tool)}</span>
    </AuthoringButton>
  );
}

function FamilyButton({
  active,
  family,
  onClick
}: {
  active: boolean;
  family: ToolFamily;
  onClick: () => void;
}) {
  const iconTool: ToolContext =
    family === "draw" ? "path" : family === "shape" ? "rect" : family === "icon" ? "icon" : family === "text" ? "text" : "select";

  return (
    <AuthoringButton
      active={active}
      aria-label={toolFamilyLabel(family)}
      className={styles.familyButton}
      compact
      onClick={onClick}
      title={toolFamilyLabel(family)}
      variant="ghost"
    >
      <span className={styles.toolButtonIcon}>{toolIcon(iconTool)}</span>
      <span className={styles.toolButtonLabel}>{toolFamilyLabel(family)}</span>
    </AuthoringButton>
  );
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path d="M8.5 8.1H3.8V3.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      <path d="M4.2 8.1C6.1 5.6 9 4.1 12.2 4.2c4.7.2 8.3 4 8.1 8.7-.2 4.6-4 8.2-8.7 8-2.4-.1-4.6-1.2-6.1-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path d="M15.5 8.1h4.7V3.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      <path d="M19.8 8.1c-1.9-2.5-4.8-4-8-3.9-4.7.2-8.3 4-8.1 8.7.2 4.6 4 8.2 8.7 8 2.4-.1 4.6-1.2 6.1-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

function SliderField({
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
  compact = false
}: {
  compact?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <label className={`${styles.sliderField} ${compact ? styles.sliderFieldCompact : ""}`}>
      <span className={styles.sliderLabel}>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        style={{ "--slider-progress": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties}
        type="range"
        value={value}
      />
      <strong>{value}</strong>
    </label>
  );
}

function ToggleField({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={styles.toggleField}>
      <span className={styles.sliderLabel}>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function ColorField({
  ariaLabel,
  label,
  onChange,
  value
}: {
  ariaLabel: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={styles.colorField}>
      <span className={styles.colorLabel}>{label}</span>
      <ColorPickerField ariaLabel={ariaLabel} onChange={onChange} value={value} />
    </label>
  );
}

function iconLabel(iconType: IconType) {
  switch (iconType) {
    case "arrow":
      return translateActive("annotation.icon.arrow");
    case "arrow2":
      return translateActive("annotation.icon.arrow2");
    case "arrow3":
      return translateActive("annotation.icon.arrow3");
    case "star":
      return translateActive("annotation.icon.star");
    case "position":
      return translateActive("annotation.icon.position");
    case "bubble":
      return translateActive("annotation.icon.bubble");
  }
}

function renderIconGlyph(iconType: IconType) {
  switch (iconType) {
    case "arrow":
      return <path d="M2.5 11.5v9h18v5.293L30.293 16 20.5 6.207V11.5h-18z" fill="currentColor" />;
    case "arrow2":
      return <path d="M21.793 18.5H2.5v-5h18.935l-7.6-8h5.872l10.5 10.5-10.5 10.5h-5.914l8-8z" fill="currentColor" />;
    case "arrow3":
      return <path d="M25.288 16.42L14.208 27.5H6.792l11.291-11.291L6.826 4.5h7.381l11.661 11.661-.58.258z" fill="currentColor" />;
    case "star":
      return <path d="M25.292 29.878l-1.775-10.346 7.517-7.327-10.388-1.51L16 1.282l-4.646 9.413-10.388 1.51 7.517 7.327-1.775 10.346L16 24.993l9.292 4.885z" fill="currentColor" />;
    case "position":
      return (
        <path
          d="M16 31.28C23.675 23.302 27.5 17.181 27.5 13c0-6.351-5.149-11.5-11.5-11.5S4.5 6.649 4.5 13c0 4.181 3.825 10.302 11.5 18.28zM16 17.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"
          fill="currentColor"
          fillRule="evenodd"
        />
      );
    case "bubble":
      return <path d="M22.207 24.5L16.5 30.207V24.5H8A6.5 6.5 0 0 1 1.5 18V9A6.5 6.5 0 0 1 8 2.5h16A6.5 6.5 0 0 1 30.5 9v9a6.5 6.5 0 0 1-6.5 6.5h-1.793z" fill="currentColor" />;
  }
}

function iconDisplayRatio(iconType: IconType) {
  void iconType;
  return { width: 32, height: 32 };
}

function hasCustomIconDisplayRatio(iconType: IconType) {
  const ratio = iconDisplayRatio(iconType);
  return ratio.width !== ratio.height;
}

function IconOptionButton({
  active,
  iconType,
  onClick
}: {
  active: boolean;
  iconType: IconType;
  onClick: () => void;
}) {
  return (
    <AuthoringButton active={active} className={styles.iconOptionButton} compact onClick={onClick} variant="ghost">
      <span className={styles.iconOptionGlyph}>
        <svg aria-hidden="true" viewBox="0 0 32 32">
          {renderIconGlyph(iconType)}
        </svg>
      </span>
      <span className={styles.iconOptionLabel}>{iconLabel(iconType)}</span>
    </AuthoringButton>
  );
}

export function NativeImageAnnotationTool(props: NativeImageAnnotationToolProps) {
  const { t } = useI18n();
  return props.imageSrc ? (
    <NativeImageAnnotationAccess key={props.imageSrc} {...props} imageSrc={props.imageSrc} />
  ) : <p>{t("annotation.emptyHint")}</p>;
}

function AnnotationResolutionDialog({ status, onClose, onContinue }: {
  status: "blocked" | "warning" | "error";
  onClose: () => void;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === "Tab") {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (buttons.length) {
          event.preventDefault();
          buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div className={`paideia-modal-backdrop ${styles.resolutionBackdrop}`} role="presentation">
      <section aria-labelledby={titleId} aria-describedby={messageId} aria-modal="true" className="paideia-modal" ref={dialogRef} role="dialog">
        <h2 id={titleId}>{t("annotation.title")}</h2>
        <p id={messageId}>{status === "blocked"
          ? t("annotation.imageTooSmall")
          : status === "warning"
            ? t("annotation.lowResolutionWarning")
            : t("annotation.imageLoadFailed")}</p>
        <div className="modal-actions">
          <button className="ghost-pill" onClick={onClose} type="button">{t(status === "warning" ? "common.cancel" : "common.close")}</button>
          {status === "warning" ? <button className="primary-pill" onClick={onContinue} type="button">{t("common.continue")}</button> : null}
        </div>
      </section>
    </div>, document.body
  );
}

function NativeImageAnnotationAccess(props: NativeImageAnnotationToolProps & { imageSrc: string }) {
  const { t } = useI18n();
  const [resolution, setResolution] = useState<{ status: AnnotationResolutionAccess; dimensions: ImageDimensions } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      try {
        setResolution({ status: annotationResolutionAccess(dimensions), dimensions });
      } catch {
        setLoadFailed(true);
      }
    };
    image.onerror = () => { if (!cancelled) setLoadFailed(true); };
    image.src = props.imageSrc;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [props.imageSrc]);

  if (closed) return null;
  if (resolution?.status === "ready") {
    return <NativeImageAnnotationEditor {...props} sourceDimensions={resolution.dimensions} />;
  }
  if (!loadFailed && !resolution) return <p role="status">{t("annotation.imageLoading")}</p>;
  return <AnnotationResolutionDialog
    status={loadFailed ? "error" : resolution!.status as "blocked" | "warning"}
    onClose={() => { setClosed(true); props.onCancel?.(); }}
    onContinue={() => setResolution((current) => current?.status === "warning" ? { ...current, status: "ready" } : current)}
  />;
}

function NativeImageAnnotationEditor({
  imageAlt,
  imageSrc,
  onApply,
  onApplyEnd,
  onApplyStart,
  onCancel,
  onChange,
  title = "Annotation d'image",
  value,
  sourceDimensions
}: NativeImageAnnotationToolProps & { sourceDimensions: ImageDimensions }) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const dialogTitleId = useId();
  const cancelHandlerRef = useRef<() => void>(() => {});
  const resetWarningOpenRef = useRef(false);
  const dimensionsRef = useRef<ImageDimensions>(sourceDimensions);
  const interactionDimensionsRef = useRef<ImageDimensions>({ width: 1, height: 1 });
  const resizeInteractionRef = useRef<ResizeInteraction | null>(null);
  const moveInteractionRef = useRef<MoveInteraction | null>(null);
  const lineInteractionRef = useRef<LineInteraction | null>(null);
  const rotationInteractionRef = useRef<RotationInteraction | null>(null);
  const applyInFlightRef = useRef(false);
  const workingDocumentRef = useRef<NativeImageAnnotationDocument>(value ?? createEmptyNativeAnnotationDocument());
  const initialDocumentRef = useRef<NativeImageAnnotationDocument>(value ?? createEmptyNativeAnnotationDocument());
  const repeatTemplatesRef = useRef(repeatableGeometryTemplatesFromDocument(value ?? createEmptyNativeAnnotationDocument()));
  const lastCreationClickRef = useRef<{ time: number; tool: NativeAnnotationTool; x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<NativeAnnotationTool>("path");
  const [activeFamily, setActiveFamily] = useState<ToolFamily>("draw");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DrawingDraft | null>(null);
  const [drawStyle, setDrawStyle] = useState<VisualStyleSettings>(() => createDefaultVisualStyle());
  const [shapeStyle, setShapeStyle] = useState<VisualStyleSettings>(() => createDefaultVisualStyle());
  const [iconStyle, setIconStyle] = useState<VisualStyleSettings>(() => createDefaultVisualStyle());
  const [textStyle, setTextStyle] = useState<NativeAnnotationTextStyle>(() => cloneTextStyle(DEFAULT_NATIVE_TEXT));
  const [activeIconType, setActiveIconType] = useState<IconType>("star");
  const [activeIconRotation, setActiveIconRotation] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [creationRequiresDoubleClickForTool, setCreationRequiresDoubleClickForTool] = useState<NativeAnnotationTool | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>(sourceDimensions);
  const [interactionDimensions, setInteractionDimensions] = useState<ImageDimensions>({ width: 1, height: 1 });
  const [resetWarningOpen, setResetWarningOpen] = useState(false);
  const [workingDocument, setWorkingDocument] = useState<NativeImageAnnotationDocument>(
    value ?? createEmptyNativeAnnotationDocument()
  );
  const [undoStack, setUndoStack] = useState<NativeImageAnnotationDocument[]>([]);
  const [redoStack, setRedoStack] = useState<NativeImageAnnotationDocument[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const nextDocument = value ?? createEmptyNativeAnnotationDocument();
    initialDocumentRef.current = nextDocument;
    repeatTemplatesRef.current = repeatableGeometryTemplatesFromDocument(nextDocument);
    workingDocumentRef.current = nextDocument;
    setWorkingDocument(nextDocument);
    setSelectedId(null);
    setEditingTextId(null);
    setCreationRequiresDoubleClickForTool(null);
    setDraft(null);
    resizeInteractionRef.current = null;
    moveInteractionRef.current = null;
    lineInteractionRef.current = null;
    rotationInteractionRef.current = null;
    lastCreationClickRef.current = null;
    setUndoStack([]);
    setRedoStack([]);
  }, [value, imageSrc]);

  useEffect(() => {
    setActiveFamily(toolToFamily(activeTool));
    if (creationRequiresDoubleClickForTool && activeTool !== creationRequiresDoubleClickForTool) {
      setCreationRequiresDoubleClickForTool(null);
      lastCreationClickRef.current = null;
    }
  }, [activeTool, creationRequiresDoubleClickForTool]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !imageSrc) {
      return;
    }

    const measure = () => updateInteractionDimensions();
    measure();

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measure);
    resizeObserver?.observe(stage);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [imageSrc]);

  const selectedAnnotation = useMemo(
    () => workingDocument.annotations.find((annotation) => annotation.id === selectedId) ?? null,
    [workingDocument.annotations, selectedId]
  );

  const editingText = useMemo(() => {
    const annotation = workingDocument.annotations.find(
      (candidate) => candidate.kind === "text" && candidate.id === editingTextId
    );
    return annotation?.kind === "text" ? annotation : null;
  }, [workingDocument.annotations, editingTextId]);

  function pointFromClient(clientX: number, clientY: number): NativeAnnotationPoint {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: clampPercent(((clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((clientY - rect.top) / rect.height) * 100)
    };
  }

  function pointFromEvent(event: ReactPointerEvent<Element>): NativeAnnotationPoint {
    return pointFromClient(event.clientX, event.clientY);
  }

  function toolCreatesSelectableObject(tool: NativeAnnotationTool) {
    return tool === "rect" || tool === "ellipse" || tool === "icon" || tool === "text";
  }

  function isManualCreationDoubleClick(event: ReactPointerEvent<Element>, tool: NativeAnnotationTool) {
    const now = window.performance.now();
    const previousClick = lastCreationClickRef.current;
    const distance = previousClick
      ? Math.hypot(event.clientX - previousClick.x, event.clientY - previousClick.y)
      : Number.POSITIVE_INFINITY;
    const isDoubleClick =
      previousClick !== null
      && previousClick.tool === tool
      && now - previousClick.time <= TEXT_DOUBLE_CLICK_DELAY_MS
      && distance <= TEXT_DOUBLE_CLICK_DISTANCE_PX;

    if (!isDoubleClick) {
      lastCreationClickRef.current = { time: now, tool, x: event.clientX, y: event.clientY };
      return false;
    }

    lastCreationClickRef.current = null;
    return true;
  }

  function visualFamilyFromContext(context: ToolContext): VisualStyleFamily {
    if (context === "rect" || context === "ellipse") {
      return "shape";
    }
    if (context === "icon") {
      return "icon";
    }
    return "draw";
  }

  function visualFamilyFromAnnotation(annotation: NativeAnnotation): VisualStyleFamily | null {
    if (annotation.kind === "text") {
      return null;
    }
    return visualFamilyFromContext(annotation.kind);
  }

  function familyFromAnnotation(annotation: NativeAnnotation): ToolFamily {
    return annotation.kind === "text" ? "text" : toolToFamily(annotation.kind);
  }

  function rememberRepeatableAnnotation(annotation: NativeAnnotation) {
    const template = repeatableGeometryTemplateFromAnnotation(annotation);
    if (template) repeatTemplatesRef.current[template.key] = template;
  }

  function repeatTemplateForActiveTool(): RepeatableGeometryTemplate | null {
    const key: RepeatableGeometryKey | null = activeTool === "rect" || activeTool === "ellipse"
      ? activeTool
      : activeTool === "icon"
        ? `icon:${activeIconType}`
        : null;
    return key ? repeatTemplatesRef.current[key] ?? null : null;
  }

  function selectAnnotation(annotation: NativeAnnotation, options?: { editText?: boolean }) {
    rememberRepeatableAnnotation(annotation);
    setSelectedId(annotation.id);
    setActiveTool(annotation.kind);
    setActiveFamily(familyFromAnnotation(annotation));
    if (annotation.kind === "icon") {
      setActiveIconType(annotation.iconType);
    }
    setEditingTextId(annotation.kind === "text" && options?.editText ? annotation.id : null);
  }

  function getVisualStyleForContext(context: ToolContext): VisualStyleSettings {
    const family = visualFamilyFromContext(context);
    if (family === "shape") {
      return shapeStyle;
    }
    if (family === "icon") {
      return iconStyle;
    }
    return drawStyle;
  }

  function updateVisualStyleForContext(
    context: ToolContext,
    mutator: (style: VisualStyleSettings) => VisualStyleSettings
  ) {
    const family = visualFamilyFromContext(context);
    if (family === "shape") {
      setShapeStyle((current) => mutator(current));
      return;
    }
    if (family === "icon") {
      setIconStyle((current) => mutator(current));
      return;
    }
    setDrawStyle((current) => mutator(current));
  }

  function shouldEditSelectedVisualStyle() {
    if (!selectedAnnotation || selectedAnnotation.kind === "text") {
      return false;
    }
    return activeTool === "select" || visualFamilyFromAnnotation(selectedAnnotation) === visualFamilyFromContext(currentContext);
  }

  function shouldEditSelectedTextStyle() {
    return selectedAnnotation?.kind === "text" && (activeTool === "select" || currentContext === "text");
  }

  function createBaseAnnotation(id: string, repeatTemplate?: RepeatableGeometryTemplate) {
    const now = Date.now();
    const visualStyle = getVisualStyleForContext(activeTool);
    return {
      id,
      createdAt: now,
      updatedAt: now,
      blurEnabled: repeatTemplate?.blurEnabled ?? visualStyle.blurEnabled,
      blurAmount: repeatTemplate?.blurAmount ?? visualStyle.blurAmount,
      stroke: { ...(repeatTemplate?.stroke ?? visualStyle.stroke) },
      fill: { ...(repeatTemplate?.fill ?? visualStyle.fill) },
      text: cloneTextStyle(repeatTemplate?.text ?? textStyle)
    };
  }

  function updateDocument(nextAnnotations: NativeAnnotation[], options?: { recordHistory?: boolean }) {
    const nextDocument = {
      version: 1,
      annotations: nextAnnotations
    } satisfies NativeImageAnnotationDocument;
    if (options?.recordHistory !== false) {
      setUndoStack((current) => pushHistory(current, workingDocument));
      setRedoStack([]);
    }
    workingDocumentRef.current = nextDocument;
    setWorkingDocument(nextDocument);
  }

  function updateSelectedAnnotation(mutator: (annotation: NativeAnnotation) => NativeAnnotation) {
    if (!selectedId) {
      return;
    }
    let nextSelected: NativeAnnotation | null = null;
    const nextAnnotations = workingDocument.annotations.map((annotation) => {
      if (annotation.id !== selectedId) return annotation;
      nextSelected = mutator({ ...annotation, updatedAt: Date.now() });
      return nextSelected;
    });
    if (nextSelected) rememberRepeatableAnnotation(nextSelected);
    updateDocument(nextAnnotations);
  }

  function beginMoveSelected(annotation: ResizeableAnnotation, event: ReactPointerEvent<Element>) {
    event.preventDefault();
    event.stopPropagation();
    selectAnnotation(annotation);
    moveInteractionRef.current = {
      documentBefore: workingDocument,
      original: annotation,
      start: pointFromEvent(event)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginResizeSelected(
    annotation: ResizeableAnnotation,
    handle: ResizeHandle,
    event: ReactPointerEvent<Element>
  ) {
    event.preventDefault();
    event.stopPropagation();
    selectAnnotation(annotation);
    resizeInteractionRef.current = {
      documentBefore: workingDocument,
      handle,
      original: annotation
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginRotateIcon(annotation: IconAnnotation, event: ReactPointerEvent<Element>) {
    event.preventDefault();
    event.stopPropagation();
    const bounds = annotationBounds(annotation);
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const point = pointFromEvent(event);
    selectAnnotation(annotation);
    rotationInteractionRef.current = {
      center,
      documentBefore: workingDocument,
      original: annotation,
      startAngle: angleFromCenter(center, point),
      startRotation: annotation.iconRotation ?? 0
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginMoveLine(annotation: LineAnnotation, event: ReactPointerEvent<Element>) {
    event.preventDefault();
    event.stopPropagation();
    selectAnnotation(annotation);
    lineInteractionRef.current = {
      documentBefore: workingDocument,
      original: annotation,
      start: pointFromEvent(event)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginLineEndpointMove(
    annotation: LineAnnotation,
    endpoint: "start" | "end",
    event: ReactPointerEvent<Element>
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(annotation.id);
    setEditingTextId(null);
    lineInteractionRef.current = {
      documentBefore: workingDocument,
      endpoint,
      original: annotation,
      start: pointFromEvent(event)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (!imageSrc) {
      return;
    }
    if (resizeInteractionRef.current || moveInteractionRef.current || lineInteractionRef.current || rotationInteractionRef.current) {
      return;
    }
    const point = pointFromEvent(event);
    const id = createAnnotationId();

    if (activeTool === "select") {
      if (event.target === event.currentTarget) {
        setSelectedId(null);
        setEditingTextId(null);
      }
      return;
    }

    if (selectedId && toolCreatesSelectableObject(activeTool)) {
      setSelectedId(null);
      setEditingTextId(null);
      setCreationRequiresDoubleClickForTool(activeTool);
      isManualCreationDoubleClick(event, activeTool);
      return;
    }

    if (activeTool === "text" && editingTextId) {
      setEditingTextId(null);
      setSelectedId(null);
      setCreationRequiresDoubleClickForTool("text");
      lastCreationClickRef.current = null;
      return;
    }

    let repeatTemplate: RepeatableGeometryTemplate | null = null;
    if (creationRequiresDoubleClickForTool === activeTool) {
      if (!isManualCreationDoubleClick(event, activeTool)) {
        setSelectedId(null);
        return;
      }

      setCreationRequiresDoubleClickForTool(null);
      repeatTemplate = repeatTemplateForActiveTool();
    }

    if (creationRequiresDoubleClickForTool && creationRequiresDoubleClickForTool !== activeTool) {
      setCreationRequiresDoubleClickForTool(null);
      lastCreationClickRef.current = null;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    if (activeTool === "path") {
      setDraft({ kind: "path", id, points: [point, point] });
      return;
    }
    if (activeTool === "line") {
      setDraft({ kind: "line", id, x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      return;
    }
    if (activeTool === "rect" || activeTool === "ellipse" || activeTool === "icon") {
      if (repeatTemplate) {
        setDraft({
          kind: activeTool,
          id,
          anchorX: point.x,
          anchorY: point.y,
          ...centeredRepeatableGeometryRect(point, repeatTemplate),
          repeatTemplate
        });
        return;
      }
      if (activeTool === "icon") {
        const initialIconRect = centeredSquareRect(point, point, interactionDimensionsRef.current);
        setDraft({
          kind: "icon",
          id,
          anchorX: point.x,
          anchorY: point.y,
          ...initialIconRect
        });
        return;
      }
      const initialShapeRect = centeredDefaultRect(point, interactionDimensionsRef.current);
      setDraft({ kind: activeTool, id, anchorX: point.x, anchorY: point.y, ...initialShapeRect });
      return;
    }
    setDraft({ kind: "text", id, anchorX: point.x, anchorY: point.y, x: point.x, y: point.y, width: 18, height: 10 });
  }

  function moveDrawing(event: ReactPointerEvent<Element>) {
    const point = pointFromEvent(event);
    const rotationInteraction = rotationInteractionRef.current;
    if (rotationInteraction) {
      const nextRotation = normalizeRotation(
        rotationInteraction.startRotation + angleFromCenter(rotationInteraction.center, point) - rotationInteraction.startAngle
      );
      updateDocument(
        workingDocument.annotations.map((annotation) =>
          annotation.id === rotationInteraction.original.id && annotation.kind === "icon"
            ? { ...annotation, iconRotation: nextRotation, updatedAt: Date.now() }
            : annotation
        ),
        { recordHistory: false }
      );
      setActiveIconRotation(nextRotation);
      return;
    }
    const lineInteraction = lineInteractionRef.current;
    if (lineInteraction) {
      const nextLine = lineInteraction.endpoint
        ? lineInteraction.endpoint === "start"
          ? { x1: point.x, y1: point.y, x2: lineInteraction.original.x2, y2: lineInteraction.original.y2 }
          : { x1: lineInteraction.original.x1, y1: lineInteraction.original.y1, x2: point.x, y2: point.y }
        : moveLine(
            lineInteraction.original,
            point.x - lineInteraction.start.x,
            point.y - lineInteraction.start.y
          );
      updateDocument(
        workingDocument.annotations.map((annotation) =>
          annotation.id === lineInteraction.original.id && annotation.kind === "line"
            ? { ...annotation, ...nextLine, updatedAt: Date.now() }
            : annotation
        ),
        { recordHistory: false }
      );
      return;
    }
    const resizeInteraction = resizeInteractionRef.current;
    if (resizeInteraction) {
      const nextRect = resizeRect(resizeInteraction.original, resizeInteraction.handle, point, interactionDimensionsRef.current);
      updateDocument(
        workingDocument.annotations.map((annotation) =>
          annotation.id === resizeInteraction.original.id && annotation.kind !== "path" && annotation.kind !== "line"
            ? {
                ...annotation,
                x: nextRect.x,
                y: nextRect.y,
                width: nextRect.width,
                height: nextRect.height,
                ...(annotation.kind === "icon"
                  ? {
                      iconFlipX: (resizeInteraction.original.kind === "icon" ? resizeInteraction.original.iconFlipX ?? false : false) !== nextRect.crossedX,
                      iconFlipY: (resizeInteraction.original.kind === "icon" ? resizeInteraction.original.iconFlipY ?? false : false) !== nextRect.crossedY
                    }
                  : null),
                updatedAt: Date.now()
              }
            : annotation
        ),
        { recordHistory: false }
      );
      return;
    }
    const moveInteraction = moveInteractionRef.current;
    if (moveInteraction) {
      const nextRect = moveRect(
        moveInteraction.original.x,
        moveInteraction.original.y,
        moveInteraction.original.width,
        moveInteraction.original.height,
        point.x - moveInteraction.start.x,
        point.y - moveInteraction.start.y
      );
      updateDocument(
        workingDocument.annotations.map((annotation) =>
          annotation.id === moveInteraction.original.id && annotation.kind !== "path" && annotation.kind !== "line"
            ? { ...annotation, ...nextRect, updatedAt: Date.now() }
            : annotation
        ),
        { recordHistory: false }
      );
      return;
    }
    if (!draft) {
      return;
    }
    if ("repeatTemplate" in draft && draft.repeatTemplate) {
      return;
    }
    if (draft.kind === "path") {
      setDraft((current) => current && current.kind === "path"
        ? { ...current, points: [...current.points, point] }
        : current);
      return;
    }
    if (draft.kind === "line") {
      setDraft({ ...draft, x2: point.x, y2: point.y });
      return;
    }
    const normalized = draft.kind === "icon"
      ? centeredSquareRect({ x: draft.anchorX, y: draft.anchorY }, point, interactionDimensionsRef.current)
      : normalizeRect(draft.anchorX, draft.anchorY, point.x, point.y);
    setDraft({ ...draft, ...normalized });
  }

  function endDrawing(event: ReactPointerEvent<Element>) {
    if (resizeInteractionRef.current || moveInteractionRef.current || lineInteractionRef.current || rotationInteractionRef.current) {
      const interactedId = resizeInteractionRef.current?.original.id
        ?? moveInteractionRef.current?.original.id
        ?? lineInteractionRef.current?.original.id
        ?? rotationInteractionRef.current?.original.id;
      const documentBefore =
        resizeInteractionRef.current?.documentBefore
        ?? moveInteractionRef.current?.documentBefore
        ?? lineInteractionRef.current?.documentBefore
        ?? rotationInteractionRef.current?.documentBefore;
      if (documentBefore) {
        setUndoStack((current) => pushHistory(current, documentBefore));
        setRedoStack([]);
      }
      const finalAnnotation = interactedId
        ? workingDocumentRef.current.annotations.find((annotation) => annotation.id === interactedId)
        : null;
      if (finalAnnotation) rememberRepeatableAnnotation(finalAnnotation);
      resizeInteractionRef.current = null;
      moveInteractionRef.current = null;
      lineInteractionRef.current = null;
      rotationInteractionRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (!draft) {
      return;
    }

    const base = createBaseAnnotation(draft.id, "repeatTemplate" in draft ? draft.repeatTemplate : undefined);
    let nextAnnotation: NativeAnnotation | null = null;

    if (draft.kind === "path") {
      if (draft.points.length > 1) {
        nextAnnotation = { ...base, kind: "path", points: draft.points };
      }
    } else if (draft.kind === "line") {
      if (Math.abs(draft.x2 - draft.x1) > 0.1 || Math.abs(draft.y2 - draft.y1) > 0.1) {
        nextAnnotation = { ...base, kind: "line", x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2 };
      }
    } else if (draft.kind === "rect") {
      if (draft.width > 0.1 && draft.height > 0.1) {
        nextAnnotation = { ...base, kind: "rect", x: draft.x, y: draft.y, width: draft.width, height: draft.height };
      }
    } else if (draft.kind === "ellipse") {
      if (draft.width > 0.1 && draft.height > 0.1) {
        nextAnnotation = { ...base, kind: "ellipse", x: draft.x, y: draft.y, width: draft.width, height: draft.height };
      }
    } else if (draft.kind === "icon") {
      if (draft.width > 0.1 && draft.height > 0.1) {
        nextAnnotation = {
          ...base,
          kind: "icon",
          iconType: draft.repeatTemplate?.iconType ?? activeIconType,
          iconRotation: draft.repeatTemplate?.iconRotation ?? activeIconRotation,
          iconFlipX: draft.repeatTemplate?.iconFlipX ?? false,
          iconFlipY: draft.repeatTemplate?.iconFlipY ?? false,
          x: draft.x,
          y: draft.y,
          width: draft.width,
          height: draft.height
        };
      }
    } else if (draft.width > 0.1 && draft.height > 0.1) {
      nextAnnotation = {
        ...base,
        kind: "text",
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
        content: "texte"
      };
    }

    if (nextAnnotation) {
      rememberRepeatableAnnotation(nextAnnotation);
      updateDocument([...workingDocument.annotations, nextAnnotation]);
      setSelectedId(nextAnnotation.id);
      if (nextAnnotation.kind === "text") {
        setEditingTextId(nextAnnotation.id);
      }
    }

    setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    updateDocument(workingDocument.annotations.filter((annotation) => annotation.id !== selectedId));
    setSelectedId(null);
    setEditingTextId(null);
  }

  function resetAll() {
    updateDocument([]);
    setSelectedId(null);
    setEditingTextId(null);
    setResetWarningOpen(false);
  }

  function undoLastChange() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) {
      return;
    }
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => pushHistory(current, workingDocument));
    workingDocumentRef.current = previous;
    setWorkingDocument(previous);
    setSelectedId(null);
    setEditingTextId(null);
    setDraft(null);
  }

  function redoLastChange() {
    const next = redoStack[redoStack.length - 1];
    if (!next) {
      return;
    }
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => pushHistory(current, workingDocument));
    workingDocumentRef.current = next;
    setWorkingDocument(next);
    setSelectedId(null);
    setEditingTextId(null);
    setDraft(null);
  }

  function updateImageDimensions(image: HTMLImageElement) {
    const nextDimensions = {
      width: image.naturalWidth || image.width || 1,
      height: image.naturalHeight || image.height || 1
    };
    dimensionsRef.current = nextDimensions;
    setImageDimensions(nextDimensions);
    window.requestAnimationFrame(() => updateInteractionDimensions());
  }

  function updateInteractionDimensions() {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const nextDimensions = { width: rect.width, height: rect.height };
    interactionDimensionsRef.current = nextDimensions;
    setInteractionDimensions((current) =>
      Math.abs(current.width - nextDimensions.width) < 0.5
        && Math.abs(current.height - nextDimensions.height) < 0.5
        ? current
        : nextDimensions
    );
  }

  function updateTextContent(annotationId: string, content: string) {
    const nextDocument = {
      version: 1,
      annotations: workingDocumentRef.current.annotations.map((annotation) =>
        annotation.id === annotationId && annotation.kind === "text"
          ? { ...annotation, content, updatedAt: Date.now() }
          : annotation
      )
    } satisfies NativeImageAnnotationDocument;
    workingDocumentRef.current = nextDocument;
    setWorkingDocument(nextDocument);
  }

  function annotationFromDraft(currentDraft: DrawingDraft): NativeAnnotation | null {
    const base = createBaseAnnotation(
      currentDraft.id,
      "repeatTemplate" in currentDraft ? currentDraft.repeatTemplate : undefined
    );
    if (currentDraft.kind === "path") {
      return currentDraft.points.length > 1 ? { ...base, kind: "path", points: currentDraft.points } : null;
    }
    if (currentDraft.kind === "line") {
      return Math.abs(currentDraft.x2 - currentDraft.x1) > 0.1 || Math.abs(currentDraft.y2 - currentDraft.y1) > 0.1
        ? { ...base, kind: "line", x1: currentDraft.x1, y1: currentDraft.y1, x2: currentDraft.x2, y2: currentDraft.y2 }
        : null;
    }
    if (currentDraft.kind === "rect") {
      return currentDraft.width > 0.1 && currentDraft.height > 0.1
        ? { ...base, kind: "rect", x: currentDraft.x, y: currentDraft.y, width: currentDraft.width, height: currentDraft.height }
        : null;
    }
    if (currentDraft.kind === "ellipse") {
      return currentDraft.width > 0.1 && currentDraft.height > 0.1
        ? { ...base, kind: "ellipse", x: currentDraft.x, y: currentDraft.y, width: currentDraft.width, height: currentDraft.height }
        : null;
    }
    if (currentDraft.kind === "icon") {
      return currentDraft.width > 0.1 && currentDraft.height > 0.1
        ? {
            ...base,
            kind: "icon",
            iconType: currentDraft.repeatTemplate?.iconType ?? activeIconType,
            iconRotation: currentDraft.repeatTemplate?.iconRotation ?? activeIconRotation,
            iconFlipX: currentDraft.repeatTemplate?.iconFlipX ?? false,
            iconFlipY: currentDraft.repeatTemplate?.iconFlipY ?? false,
            x: currentDraft.x,
            y: currentDraft.y,
            width: currentDraft.width,
            height: currentDraft.height
          }
        : null;
    }
    return currentDraft.width > 0.1 && currentDraft.height > 0.1
      ? {
          ...base,
          kind: "text",
          x: currentDraft.x,
          y: currentDraft.y,
          width: currentDraft.width,
          height: currentDraft.height,
          content: "texte"
        }
      : null;
  }

  function commitPendingDraft() {
    if (!draft) {
      return workingDocumentRef.current;
    }
    const nextAnnotation = annotationFromDraft(draft);
    const nextDocument = {
      version: 1,
      annotations: nextAnnotation
        ? [...workingDocumentRef.current.annotations, nextAnnotation]
        : workingDocumentRef.current.annotations
    } satisfies NativeImageAnnotationDocument;
    workingDocumentRef.current = nextDocument;
    setWorkingDocument(nextDocument);
    setDraft(null);
    if (nextAnnotation) {
      rememberRepeatableAnnotation(nextAnnotation);
      setSelectedId(nextAnnotation.id);
      setEditingTextId(nextAnnotation.kind === "text" ? nextAnnotation.id : null);
    }
    return nextDocument;
  }

  function handleRadii(sizePx: number) {
    return {
      rx: (sizePx / 2 / Math.max(1, interactionDimensions.width)) * 100,
      ry: (sizePx / 2 / Math.max(1, interactionDimensions.height)) * 100
    };
  }

  async function handleApply() {
    if (applyInFlightRef.current) {
      return;
    }
    applyInFlightRef.current = true;
    onApplyStart?.();
    setIsApplying(true);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    try {
      const nextDocument = commitPendingDraft();
      setEditingTextId(null);
      let renderedDataUrl = "";
      const imageElement = stageRef.current?.querySelector("img") ?? null;
      if (imageSrc && nextDocument.annotations.length) {
        try {
          renderedDataUrl = await flattenNativeImageAnnotationsToDataUrl({
            document: nextDocument,
            imageElement,
            imageSrc
          });
        } catch (error) {
          console.error("Impossible d'aplatir l'annotation native depuis l'editeur.", error);
        }
      }
      await onChange(nextDocument, renderedDataUrl || null);
      initialDocumentRef.current = nextDocument;
      await onApply?.();
    } finally {
      applyInFlightRef.current = false;
      setIsApplying(false);
      onApplyEnd?.();
    }
  }

  async function handleCancel() {
    const nextDocument = initialDocumentRef.current;
    workingDocumentRef.current = nextDocument;
    setWorkingDocument(nextDocument);
    setSelectedId(null);
    setEditingTextId(null);
    setDraft(null);
    onCancel?.();
  }

  cancelHandlerRef.current = () => { void handleCancel(); };
  resetWarningOpenRef.current = resetWarningOpen;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>(`.${styles.footerActionCancel}`)?.focus();
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (resetWarningOpenRef.current || document.querySelector('[data-paideia-color-popover="true"]')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelHandlerRef.current();
      } else if (event.key === "Tab") {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []);
        const index = focusable.indexOf(document.activeElement as HTMLElement);
        if (focusable.length && (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === focusable.length - 1))) {
          event.preventDefault();
          focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleModalKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleModalKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastChange();
        return;
      }
      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y")
        || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z")
      ) {
        event.preventDefault();
        redoLastChange();
        return;
      }
      if (!selectedId) {
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        event.preventDefault();
        deleteSelected();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, workingDocument, undoStack, redoStack]);

  const draftNode = useMemo(() => {
    if (!draft) {
      return null;
    }

    const base = createBaseAnnotation(draft.id, "repeatTemplate" in draft ? draft.repeatTemplate : undefined);
    if (draft.kind === "path") {
      return renderAnnotationShape({ ...base, kind: "path", points: draft.points }, false, undefined, imageDimensions);
    }
    if (draft.kind === "line") {
      return renderAnnotationShape({ ...base, kind: "line", x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2 }, false, undefined, imageDimensions);
    }
    if (draft.kind === "rect") {
      return renderAnnotationShape({ ...base, kind: "rect", x: draft.x, y: draft.y, width: draft.width, height: draft.height }, false, imageSrc, imageDimensions);
    }
    if (draft.kind === "ellipse") {
      return renderAnnotationShape({ ...base, kind: "ellipse", x: draft.x, y: draft.y, width: draft.width, height: draft.height }, false, imageSrc, imageDimensions);
    }
    if (draft.kind === "icon") {
      return renderAnnotationShape({
        ...base,
        kind: "icon",
        iconType: draft.repeatTemplate?.iconType ?? activeIconType,
        iconRotation: draft.repeatTemplate?.iconRotation ?? activeIconRotation,
        iconFlipX: draft.repeatTemplate?.iconFlipX ?? false,
        iconFlipY: draft.repeatTemplate?.iconFlipY ?? false,
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height
      }, false, undefined, imageDimensions);
    }
    return (
      <rect
        fill="rgba(255,255,255,0.1)"
        height={draft.height}
        stroke="#1d7ddc"
        strokeDasharray="5 4"
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
        width={draft.width}
        x={draft.x}
        y={draft.y}
      />
    );
  }, [activeIconRotation, activeIconType, activeTool, draft, drawStyle, iconStyle, imageDimensions, imageSrc, shapeStyle, textStyle]);

  const currentContext: ToolContext = selectedAnnotation
    ? selectedAnnotation.kind
    : activeTool;
  const visibleTools: ToolContext[] =
    activeFamily === "draw"
      ? ["path", "line"]
      : activeFamily === "shape"
        ? ["rect", "ellipse"]
        : activeFamily === "icon"
          ? ["icon"]
        : activeFamily === "text"
          ? ["text"]
          : ["select"];
  const showStrokeSettings = currentContext === "path" || currentContext === "line" || currentContext === "rect" || currentContext === "ellipse" || currentContext === "icon";
  const showFillSettings = currentContext === "rect" || currentContext === "ellipse";
  const showTextSettings = currentContext === "text";
  const activeVisualStyle = shouldEditSelectedVisualStyle() && selectedAnnotation && selectedAnnotation.kind !== "text"
    ? selectedAnnotation
    : getVisualStyleForContext(currentContext);
  const activeTextStyle = shouldEditSelectedTextStyle() && selectedAnnotation?.kind === "text"
    ? selectedAnnotation.text
    : textStyle;
  function handleStrokeColorChange(nextColor: string) {
    if (activeTool !== "select") {
      updateVisualStyleForContext(currentContext, (style) => ({
        ...style,
        stroke: {
          ...style.stroke,
          color: nextColor
        }
      }));
    }
    if (shouldEditSelectedVisualStyle()) {
      updateSelectedAnnotation((annotation) => ({
        ...annotation,
        stroke: {
          ...annotation.stroke,
          color: nextColor
        }
      }));
      return;
    }
  }

  function handleStrokeOpacityChange(nextOpacity: number) {
    if (activeTool !== "select") {
      updateVisualStyleForContext(currentContext, (style) => ({
        ...style,
        stroke: {
          ...style.stroke,
          opacity: nextOpacity
        }
      }));
    }
    if (shouldEditSelectedVisualStyle()) {
      updateSelectedAnnotation((annotation) => ({
        ...annotation,
        stroke: {
          ...annotation.stroke,
          opacity: nextOpacity
        }
      }));
      return;
    }
  }

  function handleStrokeWidthChange(nextWidth: number) {
    if (activeTool !== "select") {
      updateVisualStyleForContext(currentContext, (style) => ({
        ...style,
        stroke: {
          ...style.stroke,
          width: nextWidth
        }
      }));
    }
    if (shouldEditSelectedVisualStyle()) {
      updateSelectedAnnotation((annotation) => ({
        ...annotation,
        stroke: {
          ...annotation.stroke,
          width: nextWidth
        }
      }));
      return;
    }
  }

  function handleFillColorChange(nextColor: string) {
    if (activeTool !== "select") {
      updateVisualStyleForContext(currentContext, (style) => ({
        ...style,
        fill: {
          ...style.fill,
          color: nextColor
        }
      }));
    }
    if (shouldEditSelectedVisualStyle() && selectedAnnotation && (selectedAnnotation.kind === "rect" || selectedAnnotation.kind === "ellipse")) {
      updateSelectedAnnotation((annotation) => ({
        ...annotation,
        fill: {
          ...annotation.fill,
          color: nextColor
        }
      }));
      return;
    }
  }

  function handleFillOpacityChange(nextOpacity: number) {
    if (activeTool !== "select") {
      updateVisualStyleForContext(currentContext, (style) => ({
        ...style,
        fill: {
          ...style.fill,
          opacity: nextOpacity
        }
      }));
    }
    if (shouldEditSelectedVisualStyle() && selectedAnnotation && (selectedAnnotation.kind === "rect" || selectedAnnotation.kind === "ellipse")) {
      updateSelectedAnnotation((annotation) => ({
        ...annotation,
        fill: {
          ...annotation.fill,
          opacity: nextOpacity
        }
      }));
      return;
    }
  }

  function handleShapeBlurEnabledChange(nextEnabled: boolean) {
    if (activeTool !== "select") {
      updateVisualStyleForContext(currentContext, (style) => ({
        ...style,
        blurEnabled: nextEnabled
      }));
    }
    if (shouldEditSelectedVisualStyle() && selectedAnnotation && (selectedAnnotation.kind === "rect" || selectedAnnotation.kind === "ellipse")) {
      updateSelectedAnnotation((annotation) => ({
        ...annotation,
        blurEnabled: nextEnabled
      }));
    }
  }

  function handleShapeBlurAmountChange(nextAmount: number) {
    const normalizedAmount = blurLevel(nextAmount);
    if (activeTool !== "select") {
      updateVisualStyleForContext(currentContext, (style) => ({
        ...style,
        blurAmount: normalizedAmount
      }));
    }
    if (shouldEditSelectedVisualStyle() && selectedAnnotation && (selectedAnnotation.kind === "rect" || selectedAnnotation.kind === "ellipse")) {
      updateSelectedAnnotation((annotation) => ({
        ...annotation,
        blurAmount: normalizedAmount
      }));
    }
  }

  function handleTextColorChange(nextColor: string) {
    if (activeTool !== "select") {
      setTextStyle((current) => ({
        ...current,
        color: nextColor
      }));
    }
    if (shouldEditSelectedTextStyle()) {
      updateSelectedAnnotation((annotation) =>
        annotation.kind === "text"
          ? {
              ...annotation,
              text: {
                ...annotation.text,
                color: nextColor
              }
            }
          : annotation
      );
      return;
    }
  }

  function handleBackgroundColorChange(nextColor: string) {
    if (activeTool !== "select") {
      setTextStyle((current) => ({
        ...current,
        backgroundColor: nextColor
      }));
    }
    if (shouldEditSelectedTextStyle()) {
      updateSelectedAnnotation((annotation) =>
        annotation.kind === "text"
          ? {
              ...annotation,
              text: {
                ...annotation.text,
                backgroundColor: nextColor
              }
            }
          : annotation
      );
      return;
    }
  }

  function handleBackgroundOpacityChange(nextOpacity: number) {
    if (activeTool !== "select") {
      setTextStyle((current) => ({
        ...current,
        backgroundOpacity: nextOpacity
      }));
    }
    if (shouldEditSelectedTextStyle()) {
      updateSelectedAnnotation((annotation) =>
        annotation.kind === "text"
          ? {
              ...annotation,
              text: {
                ...annotation.text,
                backgroundOpacity: nextOpacity
              }
            }
          : annotation
      );
      return;
    }
  }

  function handleFontSizeChange(nextSize: number) {
    if (activeTool !== "select") {
      setTextStyle((current) => ({
        ...current,
        fontSize: nextSize
      }));
    }
    if (shouldEditSelectedTextStyle()) {
      updateSelectedAnnotation((annotation) =>
        annotation.kind === "text"
          ? {
              ...annotation,
              text: {
                ...annotation.text,
                fontSize: nextSize
              }
            }
          : annotation
      );
      return;
    }
  }

  function activateTool(tool: NativeAnnotationTool) {
    setActiveTool(tool);
    setSelectedId(null);
    setEditingTextId(null);
    setDraft(null);
    setCreationRequiresDoubleClickForTool(null);
    lastCreationClickRef.current = null;
  }

  function activateIconType(iconType: IconType) {
    setActiveIconType(iconType);
    setActiveIconRotation(0);
    setActiveTool("icon");
    setSelectedId(null);
    setEditingTextId(null);
    setDraft(null);
    setCreationRequiresDoubleClickForTool(null);
    lastCreationClickRef.current = null;
  }

  const imageAspectRatio = imageDimensions.width / Math.max(1, imageDimensions.height);
  const imageMaxWidthFromViewport = `calc(${(100 * imageAspectRatio).toFixed(4)}dvh - ${(400 * imageAspectRatio).toFixed(2)}px)`;
  return createPortal(
    <div className={styles.editorBackdrop} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onPointerMove={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} role="presentation">
      <section aria-labelledby={dialogTitleId} aria-modal="true" className={styles.editorDialog} ref={dialogRef} role="dialog">
        <div className={styles.shell}>
      <div className="interactive-editor-header">
        <span className="editor-label" id={dialogTitleId}>{title}</span>
        <AuthoringButton
          className={styles.headerResetButton}
          compact
          disabled={!workingDocument.annotations.length}
          onClick={() => setResetWarningOpen(true)}
          variant="danger"
        >
          {t("common.reset")}
        </AuthoringButton>
      </div>

      {imageSrc ? (
        <div className={styles.editorStage}>
          <div className={styles.imageWrap} ref={stageRef} style={{ maxWidth: `min(100%, ${Math.round(840 * imageAspectRatio)}px, ${(57 * imageAspectRatio).toFixed(4)}dvh, max(${Math.round(160 * imageAspectRatio)}px, ${imageMaxWidthFromViewport}))` }}>
            <img
              alt={imageAlt}
              className={styles.image}
              onLoad={(event) => updateImageDimensions(event.currentTarget)}
              src={imageSrc}
            />
            <svg
              className={`${styles.overlay} ${activeTool === "select" ? styles.isSelecting : ""} ${
                activeTool === "path" || activeTool === "line"
                  ? styles.drawCursor
                  : activeTool === "rect" || activeTool === "ellipse"
                    ? styles.shapeCursor
                      : activeTool === "text"
                      ? styles.textCursor
                      : ""
              }`}
              onPointerDown={beginDrawing}
              onPointerCancel={endDrawing}
              onPointerMove={moveDrawing}
              onPointerUp={endDrawing}
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              {workingDocument.annotations.map((annotation) => {
                if (annotation.kind === "text") {
                  return null;
                }
                const selected = annotation.id === selectedId;
                const bounds = annotationBounds(annotation);
                const showSelectionBox = selected && annotation.kind !== "path" && annotation.kind !== "line";
                const showResizeHandles = showSelectionBox;
                const lineHitRadii = handleRadii(20);
                const lineDotRadii = handleRadii(8);
                const rotateHitRadii = handleRadii(22);
                const rotateDotRadii = handleRadii(9);
                const rotateOffset = handleRadii(42);
                const rotatedGeometry = annotation.kind === "icon"
                  ? rotatedBoxGeometry(bounds, annotation.iconRotation ?? 0, annotation.iconFlipX ?? false, annotation.iconFlipY ?? false, imageDimensions)
                  : undefined;
                return (
                  <g
                    className={
                      annotation.kind !== "path"
                        ? `${styles.annotationObject} ${selected ? styles.annotationObjectSelected : ""}`
                        : undefined
                    }
                    key={annotation.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectAnnotation(annotation);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      selectAnnotation(annotation);
                      updateDocument(workingDocument.annotations.filter((candidate) => candidate.id !== annotation.id));
                    }}
                    onPointerDown={(event) => {
                      if (annotation.kind === "line") {
                        beginMoveLine(annotation, event);
                      } else if (annotation.kind !== "path") {
                        beginMoveSelected(annotation, event);
                      }
                    }}
                  >
                    {renderAnnotationHitShape(annotation)}
                    {renderAnnotationShape(annotation, selected, imageSrc, imageDimensions)}
                    {selected && annotation.kind === "line" ? (
                      <>
                        <g
                          className={`${styles.lineEndpointHandle} ${styles.lineEndpointStart}`}
                          onPointerDown={(event) => beginLineEndpointMove(annotation, "start", event)}
                        >
                          <ellipse className={styles.selectionHandleHitArea} cx={annotation.x1} cy={annotation.y1} rx={lineHitRadii.rx} ry={lineHitRadii.ry} />
                          <ellipse className={styles.selectionHandleDot} cx={annotation.x1} cy={annotation.y1} rx={lineDotRadii.rx} ry={lineDotRadii.ry} />
                        </g>
                        <g
                          className={`${styles.lineEndpointHandle} ${styles.lineEndpointEnd}`}
                          onPointerDown={(event) => beginLineEndpointMove(annotation, "end", event)}
                        >
                          <ellipse className={styles.selectionHandleHitArea} cx={annotation.x2} cy={annotation.y2} rx={lineHitRadii.rx} ry={lineHitRadii.ry} />
                          <ellipse className={styles.selectionHandleDot} cx={annotation.x2} cy={annotation.y2} rx={lineDotRadii.rx} ry={lineDotRadii.ry} />
                        </g>
                      </>
                    ) : null}
                    {showSelectionBox ? (
                      <>
                        {rotatedGeometry ? (
                          <polygon
                            className={styles.selectionBox}
                            points={rotatedGeometry.corners.map((point) => `${point.x},${point.y}`).join(" ")}
                          />
                        ) : (
                          <rect
                            className={styles.selectionBox}
                            height={Math.max(bounds.height, 1)}
                            width={Math.max(bounds.width, 1)}
                            x={bounds.x}
                            y={bounds.y}
                          />
                        )}
                        {showResizeHandles ? RESIZE_HANDLES.map((handle) => {
                          const hitRadii = handleRadii(18);
                          const dotRadii = handleRadii(8);
                          const handlePoint = rotatedGeometry?.handles[handle];
                          const x = handlePoint?.x ?? (handle.includes("w")
                            ? bounds.x
                            : handle.includes("e")
                              ? bounds.x + bounds.width
                              : bounds.x + bounds.width / 2);
                          const y = handlePoint?.y ?? (handle.includes("n")
                            ? bounds.y
                            : handle.includes("s")
                              ? bounds.y + bounds.height
                              : bounds.y + bounds.height / 2);
                          return (
                            <g
                              className={`${styles.selectionHandle} ${styles[`selectionHandle${handle.toUpperCase()}` as keyof typeof styles] ?? ""}`}
                              key={handle}
                              onPointerDown={(event) => beginResizeSelected(annotation, handle, event)}
                            >
                              <ellipse className={styles.selectionHandleHitArea} cx={x} cy={y} rx={hitRadii.rx} ry={hitRadii.ry} />
                              <ellipse className={styles.selectionHandleDot} cx={x} cy={y} rx={dotRadii.rx} ry={dotRadii.ry} />
                            </g>
                          );
                        }) : null}
                        {annotation.kind === "icon" ? (() => {
                          const geometry = rotatedGeometry ?? rotatedBoxGeometry(bounds, annotation.iconRotation ?? 0, annotation.iconFlipX ?? false, annotation.iconFlipY ?? false, imageDimensions);
                          const unrotatedHandle = {
                            x: geometry.center.x,
                            y: bounds.y - rotateOffset.ry * 2
                          };
                          const handle = transformPointInPixelSpace(
                            unrotatedHandle,
                            geometry.center,
                            annotation.iconRotation ?? 0,
                            annotation.iconFlipX ?? false,
                            annotation.iconFlipY ?? false,
                            imageDimensions
                          );
                          return (
                            <g
                              className={styles.rotationHandle}
                              onPointerDown={(event) => beginRotateIcon(annotation, event)}
                            >
                              <line
                                className={styles.rotationHandleStem}
                                x1={geometry.top.x}
                                x2={handle.x}
                                y1={geometry.top.y}
                                y2={handle.y}
                              />
                              <ellipse
                                className={`${styles.selectionHandleHitArea} ${styles.rotationHandleHitArea}`}
                                cx={handle.x}
                                cy={handle.y}
                                rx={rotateHitRadii.rx}
                                ry={rotateHitRadii.ry}
                              />
                              <ellipse className={styles.rotationHandleDot} cx={handle.x} cy={handle.y} rx={rotateDotRadii.rx} ry={rotateDotRadii.ry} />
                              <path
                                className={styles.rotationHandleIcon}
                                d={`M ${handle.x - rotateDotRadii.rx * 0.65} ${handle.y} A ${rotateDotRadii.rx * 0.65} ${rotateDotRadii.ry * 0.65} 0 1 1 ${handle.x + rotateDotRadii.rx * 0.2} ${handle.y + rotateDotRadii.ry * 0.55}`}
                              />
                            </g>
                          );
                        })() : null}
                      </>
                    ) : null}
                  </g>
                );
              })}
              {draftNode}
            </svg>
            {workingDocument.annotations.map((annotation) => {
              if (annotation.kind !== "text") {
                return null;
              }
              const selected = annotation.id === selectedId;
              const isEditing = annotation.id === editingTextId;
              return (
              <div
                className={`${styles.textEditorFrame} ${selected ? styles.textEditorFrameSelected : ""}`}
                key={annotation.id}
                onClick={(event) => {
                  event.stopPropagation();
                  selectAnnotation(annotation, { editText: true });
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectAnnotation(annotation);
                  updateDocument(workingDocumentRef.current.annotations.filter((candidate) => candidate.id !== annotation.id));
                }}
                onPointerCancel={endDrawing}
                onPointerDown={(event) => beginMoveSelected(annotation, event)}
                onPointerMove={moveDrawing}
                onPointerUp={endDrawing}
                style={{
                  left: `${annotation.x}%`,
                  top: `${annotation.y}%`,
                  width: `${annotation.width}%`,
                  height: `${annotation.height}%`,
                }}
              >
                {isEditing ? (
                  <textarea
                    autoFocus
                    className={styles.textEditor}
                    onBlur={(event) => updateTextContent(annotation.id, event.currentTarget.value)}
                    onChange={(event) => {
                      updateTextContent(annotation.id, event.target.value);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{
                      color: annotation.text.color,
                      backgroundColor: rgba(annotation.text.backgroundColor, annotation.text.backgroundOpacity),
                      fontSize: `${annotation.text.fontSize}px`
                    }}
                    value={annotation.content}
                  />
                ) : (
                  <div
                    className={styles.textDisplay}
                    style={{
                      color: annotation.text.color,
                      backgroundColor: rgba(annotation.text.backgroundColor, annotation.text.backgroundOpacity),
                      fontSize: `${annotation.text.fontSize}px`
                    }}
                  >
                    {annotation.content}
                  </div>
                )}
                {selected ? RESIZE_HANDLES.map((handle) => (
                  <button
                    aria-label={t("annotation.resizeTextHandle", { handle })}
                    className={`${styles.textEditorHandle} ${styles[`textEditorHandle${handle.toUpperCase()}` as keyof typeof styles] ?? ""}`}
                    key={handle}
                    onPointerDown={(event) => beginResizeSelected(annotation, handle, event)}
                    type="button"
                  />
                )) : null}
              </div>
              );
            })}
          </div>
          <div className={styles.toolbarShell}>
        <div className={styles.toolbarTopRow}>
          <div className={styles.toolsRow}>
            {activeFamily === "icon" ? (
              (["arrow", "arrow2", "arrow3", "star", "position", "bubble"] as const).map((iconType) => (
                <IconOptionButton
                  active={activeIconType === iconType}
                  iconType={iconType}
                  key={iconType}
                  onClick={() => activateIconType(iconType)}
                />
              ))
            ) : (
              visibleTools.map((tool) => (
                <ToolButton
                  active={activeTool === tool}
                  key={tool}
                  onClick={() => activateTool(tool)}
                  tool={tool}
                />
              ))
            )}
          </div>

          <div className={`${styles.contextGrid} ${showFillSettings ? styles.shapeContextGrid : ""}`}>
            {showStrokeSettings ? (
              <>
                <ColorField
                  ariaLabel={t("annotation.strokeColor")}
                  label={currentContext === "path" || currentContext === "line" ? t("annotation.drawing") : t("annotation.outline")}
                  onChange={handleStrokeColorChange}
                  value={activeVisualStyle.stroke.color}
                />
                <SliderField label={t("annotation.strokeOpacity")} max={100} min={0} onChange={handleStrokeOpacityChange} value={activeVisualStyle.stroke.opacity} />
                <SliderField label={t("annotation.thickness")} max={150} min={1} onChange={handleStrokeWidthChange} value={activeVisualStyle.stroke.width} />
              </>
            ) : null}

            {showFillSettings ? (
              <>
                <ColorField
                  ariaLabel={t("annotation.fillColor")}
                  label={t("annotation.background")}
                  onChange={handleFillColorChange}
                  value={activeVisualStyle.fill.color}
                />
                <SliderField label={t("annotation.backgroundOpacity")} max={100} min={0} onChange={handleFillOpacityChange} value={activeVisualStyle.fill.opacity} />
                <ToggleField checked={activeVisualStyle.blurEnabled} label={t("annotation.blur")} onChange={handleShapeBlurEnabledChange} />
                <SliderField compact label={t("annotation.intensity")} max={MAX_BLUR_LEVEL} min={1} onChange={handleShapeBlurAmountChange} value={blurLevel(activeVisualStyle.blurAmount)} />
              </>
            ) : null}

            {showTextSettings ? (
              <>
                <ColorField
                  ariaLabel={t("annotation.textColor")}
                  label={t("annotation.text")}
                  onChange={handleTextColorChange}
                  value={activeTextStyle.color}
                />
                <ColorField
                  ariaLabel={t("annotation.textBackgroundColor")}
                  label={t("annotation.textBackground")}
                  onChange={handleBackgroundColorChange}
                  value={activeTextStyle.backgroundColor}
                />
                <SliderField label={t("annotation.textSize")} max={72} min={12} onChange={handleFontSizeChange} value={activeTextStyle.fontSize} />
                <SliderField label={t("annotation.backgroundOpacity")} max={100} min={0} onChange={handleBackgroundOpacityChange} value={activeTextStyle.backgroundOpacity} />
              </>
            ) : null}
          </div>
        </div>

        <div className={styles.familyRow}>
          {(["draw", "shape", "icon", "text"] as const).map((family) => (
            <FamilyButton
              active={activeFamily === family}
              family={family}
              key={family}
              onClick={() => {
                setActiveFamily(family);
                if (family === "draw") {
                  activateTool("path");
                } else if (family === "shape") {
                  activateTool("rect");
                } else if (family === "icon") {
                  activateTool("icon");
                } else {
                  activateTool("text");
                }
              }}
            />
          ))}
        </div>
          </div>
          <div className={styles.utilityBar}>
            <div className={styles.utilityBarLeft}>
              <button
                aria-label={t("annotation.undo", undefined, "Annuler action")}
                className={`${styles.footerActionButton} ${styles.utilityActionButton}`}
                disabled={!undoStack.length}
                onClick={undoLastChange}
                title={t("annotation.undo", undefined, "Annuler action")}
                type="button"
              >
                <UndoIcon className={styles.footerActionIcon} />
              </button>
              <button
                aria-label={t("annotation.redo")}
                className={`${styles.footerActionButton} ${styles.utilityActionButton}`}
                disabled={!redoStack.length}
                onClick={redoLastChange}
                title={t("annotation.redo")}
                type="button"
              >
                <RedoIcon className={styles.footerActionIcon} />
              </button>
            </div>
            <div className={styles.utilityBarRight}>
              <button
                aria-label={t("annotation.cancelChanges")}
                className={`${styles.footerActionButton} ${styles.footerActionCancel}`}
                onClick={handleCancel}
                title={t("annotation.cancelChanges")}
                type="button"
              >
                <SelectionCrossIcon className={styles.footerActionIcon} />
              </button>
              <button
                aria-label={t("annotation.saveChanges", undefined, "Enregistrer les modifications")}
                aria-busy={isApplying}
                className={`${styles.footerActionButton} ${styles.footerActionApply}`}
                disabled={isApplying}
                onClick={handleApply}
                title={isApplying ? t("annotation.saving", undefined, "Enregistrement en cours") : t("annotation.saveChanges", undefined, "Enregistrer les modifications")}
                type="button"
              >
                <SelectionCheckIcon className={styles.footerActionIcon} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`point-of-interest-placeholder ${styles.placeholder}`}>
          <p className={styles.hint}>{t("annotation.emptyHint")}</p>
        </div>
      )}
      {resetWarningOpen ? createPortal(
        <div className={`paideia-modal-backdrop ${styles.resolutionBackdrop}`} role="presentation">
          <section aria-labelledby="annotation-reset-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("annotation.modalKicker")}</p>
            <h2 id="annotation-reset-title">{t("annotation.resetTitle", undefined, "Réinitialiser les annotations ?")}</h2>
            <p>{t("annotation.resetMessage", undefined, "Cette action supprimera toutes les annotations de cette image. Voulez-vous continuer ?")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={() => setResetWarningOpen(false)} type="button">
                {t("common.cancel", undefined, "Annuler")}
              </button>
              <button className="danger-pill" onClick={resetAll} type="button">
                {t("common.reset", undefined, "Réinitialiser")}
              </button>
            </div>
          </section>
        </div>, document.body
      ) : null}
        </div>
      </section>
    </div>, document.body
  );
}
