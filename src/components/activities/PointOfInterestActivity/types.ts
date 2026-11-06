import type { MouseEvent, PointerEvent, ReactNode } from "react";
import type { PointOfInterestMarker } from "../../../types/project";

export type PointOfInterestActivityProps = {
  activeMarker: PointOfInterestMarker | null;
  clampPercent: (value: number) => number;
  contentNode?: ReactNode;
  displayTitle: string;
  hasImageAsset: boolean;
  imageAsset: string | null;
  imageAlt?: string;
  imageRole?: "presentation";
  markerPopupHeight?: string | null;
  markerPopupWidth?: string | null;
  markers: PointOfInterestMarker[];
  onMarkerClose: () => void;
  onMarkerToggle: (markerId: string) => void;
  onImageOpen?: (src: string, alt: string) => void;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
  richContent: string;
  title: string;
};

export type PointOfInterestActivityEditorProps = {
  blockId: string;
  acceptImageTypes: string;
  clampPercent: (value: number) => number;
  draggedMarkerId: string | null;
  editorSessionKey: string;
  imageSrc: string | null;
  markers: PointOfInterestMarker[];
  markerColor: string;
  markerLabel: string;
  imageAltControl?: ReactNode;
  optimizationAvailable: boolean;
  projectPath: string;
  subtitleGenerationConfiguration: {
    ready: boolean;
    enginePath: string;
    smallModelPath: string;
    mediumModelPath: string;
    smallAvailable: boolean;
    mediumAvailable: boolean;
    defaultLanguage: string;
  };
  onAddMarker: () => void;
  onImageSelect: (file: File) => void;
  onMarkerColorChange: (value: string) => void;
  onMarkerLabelChange: (value: string) => void;
  onMarkerPointerDown: (markerId: string, event: PointerEvent<HTMLSpanElement>) => void;
  onMarkerPointerUp: (event: PointerEvent<HTMLSpanElement>) => void;
  onRemoveMarker: (markerId: string) => void;
  onRemoveImage: () => void;
  onStageClick: (event: MouseEvent<HTMLDivElement>) => void;
  onStagePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onStagePointerUp: () => void;
  onUpdateMarker: (markerId: string, patch: Partial<PointOfInterestMarker>) => void;
  onUploadMarkerAsset: (markerId: string, file: File, kind: "image" | "video" | "audio" | "subtitle") => Promise<string>;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
  renderMarkerRichTextField: (params: {
    className?: string;
    field: "title" | "contentHtml";
    html: string;
    label: string;
    marker: PointOfInterestMarker;
    placeholder: string;
  }) => ReactNode;
  title: string;
};
