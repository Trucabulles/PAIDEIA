import type {
  NativeAnnotation,
  NativeAnnotationFillStyle,
  NativeAnnotationPoint,
  NativeAnnotationStrokeStyle,
  NativeAnnotationTextStyle,
  NativeImageAnnotationDocument
} from "./nativeTypes";

type RepeatableAnnotation = Extract<NativeAnnotation, { kind: "rect" | "ellipse" | "icon" }>;
type IconType = Extract<RepeatableAnnotation, { kind: "icon" }>["iconType"];

export type RepeatableGeometryKey = "rect" | "ellipse" | `icon:${IconType}`;

export type RepeatableGeometryTemplate = {
  blurAmount: number;
  blurEnabled: boolean;
  fill: NativeAnnotationFillStyle;
  height: number;
  iconFlipX?: boolean;
  iconFlipY?: boolean;
  iconRotation?: number;
  iconType?: IconType;
  key: RepeatableGeometryKey;
  kind: RepeatableAnnotation["kind"];
  stroke: NativeAnnotationStrokeStyle;
  text: NativeAnnotationTextStyle;
  updatedAt: number;
  width: number;
};

export function repeatableGeometryTemplateFromAnnotation(
  annotation: NativeAnnotation
): RepeatableGeometryTemplate | null {
  if (annotation.kind !== "rect" && annotation.kind !== "ellipse" && annotation.kind !== "icon") {
    return null;
  }
  return {
    blurAmount: annotation.blurAmount,
    blurEnabled: annotation.blurEnabled,
    fill: { ...annotation.fill },
    height: annotation.height,
    ...(annotation.kind === "icon" ? {
      iconFlipX: annotation.iconFlipX ?? false,
      iconFlipY: annotation.iconFlipY ?? false,
      iconRotation: annotation.iconRotation ?? 0,
      iconType: annotation.iconType
    } : null),
    key: annotation.kind === "icon" ? `icon:${annotation.iconType}` : annotation.kind,
    kind: annotation.kind,
    stroke: { ...annotation.stroke },
    text: { ...annotation.text },
    updatedAt: annotation.updatedAt,
    width: annotation.width
  };
}

export function repeatableGeometryTemplatesFromDocument(document: NativeImageAnnotationDocument) {
  const templates: Partial<Record<RepeatableGeometryKey, RepeatableGeometryTemplate>> = {};
  for (const annotation of document.annotations) {
    const template = repeatableGeometryTemplateFromAnnotation(annotation);
    if (!template || (templates[template.key]?.updatedAt ?? -1) > template.updatedAt) continue;
    templates[template.key] = template;
  }
  return templates;
}

export function centeredRepeatableGeometryRect(
  center: NativeAnnotationPoint,
  template: Pick<RepeatableGeometryTemplate, "height" | "width">
) {
  const width = Math.max(0, Math.min(100, template.width));
  const height = Math.max(0, Math.min(100, template.height));
  return {
    x: Math.max(0, Math.min(100 - width, center.x - width / 2)),
    y: Math.max(0, Math.min(100 - height, center.y - height / 2)),
    width,
    height
  };
}
