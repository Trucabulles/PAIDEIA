import type { ImageCrop } from "../../types/project";

export type CropHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
export type CropShape = "rectangle" | "ellipse";
export type CropPoint = { x: number; y: number };
export type ImageDimensions = { width: number; height: number };

const MIN_CROP_PIXELS = 12;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeCrop(crop?: ImageCrop | null): ImageCrop | null {
  if (!crop) {
    return null;
  }

  const x = clamp(crop.x, 0, 100);
  const y = clamp(crop.y, 0, 100);
  const width = clamp(crop.width, 0, 100 - x);
  const height = clamp(crop.height, 0, 100 - y);

  return width > 0.5 && height > 0.5
    ? {
        x,
        y,
        width,
        height,
        shape: crop.shape === "ellipse" ? "ellipse" : "rectangle"
      }
    : null;
}

export function createDefaultSquareCrop(
  dimensions: ImageDimensions,
  shape: CropShape = "rectangle"
): ImageCrop {
  const safeWidth = Math.max(1, dimensions.width);
  const safeHeight = Math.max(1, dimensions.height);
  const side = Math.min(safeWidth, safeHeight) * 0.7;
  const width = (side / safeWidth) * 100;
  const height = (side / safeHeight) * 100;

  return {
    x: (100 - width) / 2,
    y: (100 - height) / 2,
    width,
    height,
    shape
  };
}

export function moveCrop(crop: ImageCrop, dx: number, dy: number): ImageCrop {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, 100 - crop.width),
    y: clamp(crop.y + dy, 0, 100 - crop.height)
  };
}

function cropFromEdges(left: number, top: number, right: number, bottom: number): ImageCrop {
  const x = clamp(Math.min(left, right), 0, 100);
  const y = clamp(Math.min(top, bottom), 0, 100);

  return {
    x,
    y,
    width: clamp(Math.abs(right - left), 0, 100 - x),
    height: clamp(Math.abs(bottom - top), 0, 100 - y)
  };
}

function minimumPercent(dimensions: ImageDimensions) {
  return {
    x: (MIN_CROP_PIXELS / Math.max(1, dimensions.width)) * 100,
    y: (MIN_CROP_PIXELS / Math.max(1, dimensions.height)) * 100
  };
}

function squarePercentages(sidePixels: number, dimensions: ImageDimensions) {
  return {
    width: (sidePixels / Math.max(1, dimensions.width)) * 100,
    height: (sidePixels / Math.max(1, dimensions.height)) * 100
  };
}

export function drawCrop(
  start: CropPoint,
  end: CropPoint,
  dimensions: ImageDimensions,
  keepSquareRatio: boolean,
  shape: CropShape = "rectangle"
): ImageCrop {
  if (!keepSquareRatio) {
    return { ...cropFromEdges(start.x, start.y, end.x, end.y), shape };
  }

  const directionX = end.x >= start.x ? 1 : -1;
  const directionY = end.y >= start.y ? 1 : -1;
  const requestedWidth = (Math.abs(end.x - start.x) / 100) * dimensions.width;
  const requestedHeight = (Math.abs(end.y - start.y) / 100) * dimensions.height;
  const availableWidth = ((directionX > 0 ? 100 - start.x : start.x) / 100) * dimensions.width;
  const availableHeight = ((directionY > 0 ? 100 - start.y : start.y) / 100) * dimensions.height;
  const side = Math.min(Math.max(requestedWidth, requestedHeight), availableWidth, availableHeight);
  const square = squarePercentages(side, dimensions);
  const endX = start.x + directionX * square.width;
  const endY = start.y + directionY * square.height;

  return { ...cropFromEdges(start.x, start.y, endX, endY), shape };
}

function resizeFree(crop: ImageCrop, handle: CropHandle, point: CropPoint, dimensions: ImageDimensions) {
  const minimum = minimumPercent(dimensions);
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;

  if (handle.includes("w")) {
    left = clamp(point.x, 0, right - minimum.x);
  }

  if (handle.includes("e")) {
    right = clamp(point.x, left + minimum.x, 100);
  }

  if (handle.includes("n")) {
    top = clamp(point.y, 0, bottom - minimum.y);
  }

  if (handle.includes("s")) {
    bottom = clamp(point.y, top + minimum.y, 100);
  }

  return cropFromEdges(left, top, right, bottom);
}

function resizeSquareCorner(
  crop: ImageCrop,
  handle: CropHandle,
  point: CropPoint,
  dimensions: ImageDimensions
) {
  const west = handle.includes("w");
  const north = handle.includes("n");
  const anchorX = west ? crop.x + crop.width : crop.x;
  const anchorY = north ? crop.y + crop.height : crop.y;
  const requestedWidth = (Math.abs(point.x - anchorX) / 100) * dimensions.width;
  const requestedHeight = (Math.abs(point.y - anchorY) / 100) * dimensions.height;
  const availableWidth = ((west ? anchorX : 100 - anchorX) / 100) * dimensions.width;
  const availableHeight = ((north ? anchorY : 100 - anchorY) / 100) * dimensions.height;
  const maximumSide = Math.min(availableWidth, availableHeight);
  const side = Math.min(
    maximumSide,
    Math.max(Math.min(MIN_CROP_PIXELS, maximumSide), Math.max(requestedWidth, requestedHeight))
  );
  const square = squarePercentages(side, dimensions);

  return {
    x: west ? anchorX - square.width : anchorX,
    y: north ? anchorY - square.height : anchorY,
    width: square.width,
    height: square.height
  };
}

function resizeSquareSide(
  crop: ImageCrop,
  handle: CropHandle,
  point: CropPoint,
  dimensions: ImageDimensions
) {
  const horizontal = handle === "e" || handle === "w";
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  const anchorX = handle === "w" ? crop.x + crop.width : crop.x;
  const anchorY = handle === "n" ? crop.y + crop.height : crop.y;
  const requestedSide = horizontal
    ? (Math.abs(point.x - anchorX) / 100) * dimensions.width
    : (Math.abs(point.y - anchorY) / 100) * dimensions.height;

  let maximumSide: number;

  if (horizontal) {
    const horizontalRoom = ((handle === "w" ? anchorX : 100 - anchorX) / 100) * dimensions.width;
    const verticalRoom = (Math.min(centerY, 100 - centerY) * 2 / 100) * dimensions.height;
    maximumSide = Math.min(horizontalRoom, verticalRoom);
  } else {
    const verticalRoom = ((handle === "n" ? anchorY : 100 - anchorY) / 100) * dimensions.height;
    const horizontalRoom = (Math.min(centerX, 100 - centerX) * 2 / 100) * dimensions.width;
    maximumSide = Math.min(verticalRoom, horizontalRoom);
  }

  const square = squarePercentages(
    Math.min(maximumSide, Math.max(Math.min(MIN_CROP_PIXELS, maximumSide), requestedSide)),
    dimensions
  );

  if (horizontal) {
    return {
      x: handle === "w" ? anchorX - square.width : anchorX,
      y: centerY - square.height / 2,
      width: square.width,
      height: square.height
    };
  }

  return {
    x: centerX - square.width / 2,
    y: handle === "n" ? anchorY - square.height : anchorY,
    width: square.width,
    height: square.height
  };
}

export function resizeCrop(
  crop: ImageCrop,
  handle: CropHandle,
  point: CropPoint,
  dimensions: ImageDimensions,
  keepSquareRatio: boolean
): ImageCrop {
  const resized = !keepSquareRatio
    ? resizeFree(crop, handle, point, dimensions)
    : handle.length === 2
      ? resizeSquareCorner(crop, handle, point, dimensions)
      : resizeSquareSide(crop, handle, point, dimensions);

  return {
    ...resized,
    shape: crop.shape === "ellipse" ? "ellipse" : "rectangle"
  };
}
