import type { CSSProperties, ReactNode } from "react";
import type { Image360Hotspot } from "../../../types/project";

export type Image360HotspotRichTextFieldName = "title" | "contentHtml";

export type Image360HotspotRichTextFieldRenderParams = {
  className?: string;
  field: Image360HotspotRichTextFieldName;
  hotspotId: string;
  html: string;
  label: string;
  onCommit: (html: string) => void;
  placeholder: string;
};

export type Image360ActivityProps = {
  allowFullscreen: boolean;
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  contentNode?: ReactNode;
  fullWidth: boolean;
  hotspots: Image360Hotspot[];
  imageSrc: string;
  imageAlt?: string;
  imageDecorative?: boolean;
  initialPitch: number;
  initialYaw: number;
  onHotspotActivate?: (hotspotId: string) => void;
  onScenePointPick?: (yaw: number, pitch: number) => void;
  onViewChange?: (yaw: number, pitch: number) => void;
  pickingMode?: boolean;
  rounded: boolean;
  shadow: boolean;
  titleNode?: ReactNode;
  zoomEnabled: boolean;
};

export type Image360ActivityEditorProps = {
  allowFullscreen: boolean;
  currentPitch: number;
  currentYaw: number;
  hotspots: Image360Hotspot[];
  imageAccept: string;
  imageName: string;
  imageSrc: string;
  imageAltBadge?: ReactNode;
  initialPitch: number;
  initialYaw: number;
  onAddHotspot: () => void;
  onAllowFullscreenChange: (value: boolean) => void;
  onHotspotUpdate: (hotspotId: string, patch: Partial<Image360Hotspot>) => void;
  onRemoveHotspot: (hotspotId: string) => void;
  onRemoveImage: () => void;
  onSetInitialView: (yaw: number, pitch: number) => void;
  onStartHotspotPick: (hotspotId?: string) => void;
  onUploadImage: (file: File) => void;
  onZoomEnabledChange: (value: boolean) => void;
  renderHotspotRichTextField: (
    params: Image360HotspotRichTextFieldRenderParams,
  ) => ReactNode;
  zoomEnabled: boolean;
};

export type Image360CssVars = CSSProperties & {
  "--image360-background": string;
  "--image360-border-color": string;
  "--image360-border-style": string;
  "--image360-border-width": string;
  "--image360-radius": string;
};
