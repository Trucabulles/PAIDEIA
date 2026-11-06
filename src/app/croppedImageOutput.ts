export type CropOutputPlacement = {
  canvasHeight: number;
  canvasWidth: number;
  drawX: number;
  drawY: number;
};

export function resolveCropOutputPlacement(
  cropWidth: number,
  cropHeight: number,
  containInSquare: boolean
): CropOutputPlacement {
  const safeWidth = Math.max(1, Math.round(cropWidth));
  const safeHeight = Math.max(1, Math.round(cropHeight));
  if (!containInSquare) {
    return {
      canvasHeight: safeHeight,
      canvasWidth: safeWidth,
      drawX: 0,
      drawY: 0
    };
  }

  const side = Math.max(safeWidth, safeHeight);
  return {
    canvasHeight: side,
    canvasWidth: side,
    drawX: Math.floor((side - safeWidth) / 2),
    drawY: Math.floor((side - safeHeight) / 2)
  };
}
