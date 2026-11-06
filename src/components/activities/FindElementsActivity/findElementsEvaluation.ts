import type { FindElementsActivityData } from "../../../types/project";
import { pointInZone } from "./findElementsGeometry";
import type { FindElementsEvaluation, FindElementsMarker } from "./findElementsTypes";

export function evaluateFindElements(data: FindElementsActivityData, markers: FindElementsMarker[]): FindElementsEvaluation {
  const foundZoneIds = new Set<string>();
  const evaluatedMarkers = markers.map((marker) => {
    const zone = data.zones.find((candidate) => !foundZoneIds.has(candidate.id) && pointInZone(marker, candidate));
    if (!zone) return { ...marker, status: "bad" as const, zoneId: undefined };
    foundZoneIds.add(zone.id);
    return { ...marker, status: "ok" as const, zoneId: zone.id };
  });
  const missedZoneIds = data.zones.filter((zone) => !foundZoneIds.has(zone.id)).map((zone) => zone.id);
  return {
    score: data.zones.length ? Math.round((foundZoneIds.size / data.zones.length) * 100) : 0,
    foundZoneIds: [...foundZoneIds],
    missedZoneIds,
    markers: evaluatedMarkers
  };
}
