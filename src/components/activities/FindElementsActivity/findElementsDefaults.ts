import type { FindElementsActivityData, FindElementsZone } from "../../../types/project";
import { translateActive } from "../../../i18n";

export const FIND_ELEMENTS_DEFAULTS: FindElementsActivityData = {
  imageAppearance: {
    borderColor: "#123a7a",
    borderStyle: "solid",
    borderWidth: "0px",
    rounded: true,
    shadow: false
  },
  maxAttempts: 3,
  successThreshold: 80,
  labels: {
    description: "Description",
    risk: "Risque",
    correction: "Correction"
  },
  zones: []
};

export function createDefaultFindElementsData(): FindElementsActivityData {
  return {
    ...structuredClone(FIND_ELEMENTS_DEFAULTS),
    labels: {
      description: translateActive("findElements.label.description"),
      risk: translateActive("findElements.label.risk"),
      correction: translateActive("findElements.label.correction")
    }
  };
}

export function createFindElementsZone(order: number, shape: FindElementsZone["shape"]): FindElementsZone {
  return {
    id: `find_elements_zone_${Date.now()}_${order}`,
    shape,
    title: `${translateActive("findElements.elementName")} ${order}`,
    severity: "sans",
    descriptionHtml: "<p></p>",
    riskHtml: "<p></p>",
    correctionHtml: "<p></p>",
    ...(shape === "rectangle"
      ? { x: 10, y: 10, width: 20, height: 20 }
      : { points: [{ x: 20, y: 20 }, { x: 40, y: 20 }, { x: 30, y: 40 }] })
  };
}

export function normalizeFindElementsData(value?: FindElementsActivityData | null): FindElementsActivityData {
  const source = value ?? FIND_ELEMENTS_DEFAULTS;
  return {
    imageAppearance: {
      borderColor: source.imageAppearance?.borderColor || FIND_ELEMENTS_DEFAULTS.imageAppearance.borderColor,
      borderStyle: ["solid", "dashed", "dotted"].includes(source.imageAppearance?.borderStyle ?? "") ? source.imageAppearance!.borderStyle : FIND_ELEMENTS_DEFAULTS.imageAppearance.borderStyle,
      borderWidth: ["0px", "1px", "2px", "4px"].includes(source.imageAppearance?.borderWidth ?? "") ? source.imageAppearance!.borderWidth : FIND_ELEMENTS_DEFAULTS.imageAppearance.borderWidth,
      rounded: source.imageAppearance?.rounded ?? FIND_ELEMENTS_DEFAULTS.imageAppearance.rounded,
      shadow: source.imageAppearance?.shadow ?? FIND_ELEMENTS_DEFAULTS.imageAppearance.shadow
    },
    maxAttempts: Math.max(1, Math.min(10, Math.round(Number(source.maxAttempts) || FIND_ELEMENTS_DEFAULTS.maxAttempts))),
    successThreshold: Math.max(0, Math.min(100, Math.round(Number(source.successThreshold) || FIND_ELEMENTS_DEFAULTS.successThreshold))),
    labels: {
      description: source.labels?.description?.trim() || FIND_ELEMENTS_DEFAULTS.labels.description,
      risk: source.labels?.risk?.trim() || FIND_ELEMENTS_DEFAULTS.labels.risk,
      correction: source.labels?.correction?.trim() || FIND_ELEMENTS_DEFAULTS.labels.correction
    },
    zones: (source.zones ?? []).map((zone, index) => ({
      id: zone.id || `find_elements_zone_${index + 1}`,
      shape: zone.shape === "polygon" ? "polygon" : "rectangle",
      title: zone.title ?? `${translateActive("findElements.elementName")} ${index + 1}`,
      severity: ["faible", "moyen", "important", "critique"].includes(zone.severity) ? zone.severity : "sans",
      descriptionHtml: zone.descriptionHtml || "<p></p>",
      riskHtml: zone.riskHtml || "<p></p>",
      correctionHtml: zone.correctionHtml || "<p></p>",
      x: Number.isFinite(zone.x) ? Math.max(0, Math.min(100, Number(zone.x))) : undefined,
      y: Number.isFinite(zone.y) ? Math.max(0, Math.min(100, Number(zone.y))) : undefined,
      width: Number.isFinite(zone.width) ? Math.max(0.5, Math.min(100, Number(zone.width))) : undefined,
      height: Number.isFinite(zone.height) ? Math.max(0.5, Math.min(100, Number(zone.height))) : undefined,
      points: zone.points?.map((point) => ({
        x: Math.max(0, Math.min(100, Number(point.x) || 0)),
        y: Math.max(0, Math.min(100, Number(point.y) || 0))
      }))
    }))
  };
}
