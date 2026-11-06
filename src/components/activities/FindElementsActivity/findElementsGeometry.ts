import type { FindElementsPoint, FindElementsZone } from "../../../types/project";

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function pointInRectangle(point: FindElementsPoint, zone: FindElementsZone) {
  const x = zone.x ?? 0;
  const y = zone.y ?? 0;
  const width = zone.width ?? 0;
  const height = zone.height ?? 0;
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

export function pointInPolygon(point: FindElementsPoint, points: FindElementsPoint[]) {
  if (points.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    const intersects =
      (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 0.000001) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInZone(point: FindElementsPoint, zone: FindElementsZone) {
  return zone.shape === "polygon"
    ? pointInPolygon(point, zone.points ?? [])
    : pointInRectangle(point, zone);
}

export function polygonBounds(points: FindElementsPoint[]) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function zoneCenter(zone: FindElementsZone): FindElementsPoint {
  if (zone.shape !== "polygon") {
    return { x: (zone.x ?? 0) + (zone.width ?? 0) / 2, y: (zone.y ?? 0) + (zone.height ?? 0) / 2 };
  }
  const points = zone.points ?? [];
  const average = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  const candidate = points.length ? { x: average.x / points.length, y: average.y / points.length } : { x: 50, y: 50 };
  if (pointInPolygon(candidate, points)) return candidate;
  const bounds = polygonBounds(points);
  for (let row = 1; row < 18; row += 1) {
    for (let column = 1; column < 18; column += 1) {
      const point = { x: bounds.x + (bounds.width * column) / 18, y: bounds.y + (bounds.height * row) / 18 };
      if (pointInPolygon(point, points)) return point;
    }
  }
  return candidate;
}

export function insertVertexOnSegment(points: FindElementsPoint[], index: number, point: FindElementsPoint) {
  return [...points.slice(0, index + 1), point, ...points.slice(index + 1)];
}

export function relativePoint(event: { clientX: number; clientY: number }, element: Element): FindElementsPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((event.clientY - rect.top) / rect.height) * 100)
  };
}
