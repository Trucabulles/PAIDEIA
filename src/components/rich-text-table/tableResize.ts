/** Resize one outer column and retain the opposite edge's position. */
export function anchoredTableResize(
  side: "table-left" | "table-right",
  pointerDelta: number,
  tableWidth: number,
  edgeWidth: number,
  wrapperWidth: number,
  startOffset = (wrapperWidth - tableWidth) / 2,
) {
  const minimumEdgeWidth = Math.min(72, edgeWidth);
  const requestedGrowth = pointerDelta * (side === "table-left" ? -1 : 1);
  const growth = Math.max(
    minimumEdgeWidth - edgeWidth,
    Math.min(Math.max(0, side === "table-left" ? startOffset : wrapperWidth - startOffset - tableWidth), requestedGrowth),
  );
  return { tableWidth: tableWidth + growth, edgeWidth: edgeWidth + growth,
    offset: startOffset - (side === "table-left" ? growth : 0) };
}
