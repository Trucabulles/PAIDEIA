export type NativeAnnotationTool =
  | "select"
  | "path"
  | "line"
  | "rect"
  | "ellipse"
  | "icon"
  | "text";

export type NativeAnnotationStrokeStyle = {
  color: string;
  opacity: number;
  width: number;
};

export type NativeAnnotationFillStyle = {
  color: string;
  opacity: number;
};

export type NativeAnnotationTextStyle = {
  backgroundColor: string;
  backgroundOpacity: number;
  color: string;
  fontSize: number;
};

export type NativeAnnotationPoint = {
  x: number;
  y: number;
};

type NativeAnnotationBase = {
  id: string;
  blurAmount: number;
  blurEnabled: boolean;
  createdAt: number;
  fill: NativeAnnotationFillStyle;
  stroke: NativeAnnotationStrokeStyle;
  text: NativeAnnotationTextStyle;
  updatedAt: number;
};

export type NativePathAnnotation = NativeAnnotationBase & {
  kind: "path";
  points: NativeAnnotationPoint[];
};

export type NativeLineAnnotation = NativeAnnotationBase & {
  kind: "line";
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

export type NativeRectAnnotation = NativeAnnotationBase & {
  kind: "rect";
  height: number;
  width: number;
  x: number;
  y: number;
};

export type NativeEllipseAnnotation = NativeAnnotationBase & {
  kind: "ellipse";
  height: number;
  width: number;
  x: number;
  y: number;
};

export type NativeTextAnnotation = NativeAnnotationBase & {
  content: string;
  kind: "text";
  height: number;
  width: number;
  x: number;
  y: number;
};

export type NativeIconAnnotation = NativeAnnotationBase & {
  height: number;
  iconFlipX?: boolean;
  iconFlipY?: boolean;
  iconRotation?: number;
  iconType: "arrow" | "arrow2" | "arrow3" | "star" | "position" | "bubble";
  kind: "icon";
  width: number;
  x: number;
  y: number;
};

export type NativeAnnotation =
  | NativePathAnnotation
  | NativeLineAnnotation
  | NativeRectAnnotation
  | NativeEllipseAnnotation
  | NativeIconAnnotation
  | NativeTextAnnotation;

export type NativeImageAnnotationDocument = {
  annotations: NativeAnnotation[];
  version: 1;
};

export const DEFAULT_NATIVE_STROKE: NativeAnnotationStrokeStyle = {
  color: "#123A7A",
  opacity: 100,
  width: 3
};

export const DEFAULT_NATIVE_FILL: NativeAnnotationFillStyle = {
  color: "#123A7A",
  opacity: 0
};

export const DEFAULT_NATIVE_TEXT: NativeAnnotationTextStyle = {
  backgroundColor: "#FFFFFF",
  backgroundOpacity: 0,
  color: "#123A7A",
  fontSize: 32
};

export function createEmptyNativeAnnotationDocument(): NativeImageAnnotationDocument {
  return {
    version: 1,
    annotations: []
  };
}
