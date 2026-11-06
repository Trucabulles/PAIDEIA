export type AnnotationImageDimensions = { width: number; height: number };
export type AnnotationResolutionAccess = "blocked" | "warning" | "ready";

export const ANNOTATION_WORKSPACE_MAX_HEIGHT = 700;

export function annotationResolutionAccess({ width, height }: AnnotationImageDimensions): AnnotationResolutionAccess {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid annotation image dimensions");
  }
  if (width < 100 && height < 100) return "blocked";
  if (Math.min(width, height) < 400) return "warning";
  return "ready";
}

// This bound belongs only to the editor. Rasterization keeps native dimensions.
export function annotationWorkspaceMaxWidth({ width, height }: AnnotationImageDimensions): number {
  return ANNOTATION_WORKSPACE_MAX_HEIGHT * width / height;
}
