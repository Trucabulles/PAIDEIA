import type { ReactNode } from "react";
import type { Image360Hotspot } from "../../../types/project";
import { createDefaultImage360Hotspot, normalizeImage360Hotspots } from "./defaults";
import { Image360ActivityEditor } from "./Image360ActivityEditor";
import type { Image360HotspotRichTextFieldRenderParams } from "./types";

type Image360EditorValue = {
  image360AllowFullscreen: boolean;
  image360Hotspots: Image360Hotspot[];
  image360InitialPitch: number;
  image360InitialYaw: number;
  image360ZoomEnabled: boolean;
};

type Image360ActivityEditorPanelProps = {
  currentPitch: number;
  currentYaw: number;
  imageAccept: string;
  imageName: string;
  imageSrc: string;
  imageAltBadge?: ReactNode;
  onChange: (updater: (current: Image360EditorValue) => Image360EditorValue) => void;
  onRemoveImage: () => void;
  onStartHotspotPick: (hotspotId?: string) => void;
  onUploadImage: (file: File) => void;
  renderHotspotRichTextField: (params: Image360HotspotRichTextFieldRenderParams) => ReactNode;
  value: Image360EditorValue;
};

export function Image360ActivityEditorPanel({
  currentPitch,
  currentYaw,
  imageAccept,
  imageName,
  imageSrc,
  imageAltBadge,
  onChange,
  onRemoveImage,
  onStartHotspotPick,
  onUploadImage,
  renderHotspotRichTextField,
  value
}: Image360ActivityEditorPanelProps) {
  function addHotspot() {
    onChange((current) => ({
      ...current,
      image360Hotspots: [
        ...normalizeImage360Hotspots(current.image360Hotspots),
        createDefaultImage360Hotspot(
          current.image360Hotspots.length + 1,
          currentYaw,
          currentPitch
        )
      ]
    }));
  }

  function updateHotspot(hotspotId: string, patch: Partial<Image360Hotspot>) {
    onChange((current) => ({
      ...current,
      image360Hotspots: normalizeImage360Hotspots(current.image360Hotspots).map((hotspot) =>
        hotspot.id === hotspotId ? { ...hotspot, ...patch } : hotspot
      )
    }));
  }

  function removeHotspot(hotspotId: string) {
    onChange((current) => ({
      ...current,
      image360Hotspots: normalizeImage360Hotspots(current.image360Hotspots).filter(
        (hotspot) => hotspot.id !== hotspotId
      )
    }));
  }

  return (
    <Image360ActivityEditor
      allowFullscreen={value.image360AllowFullscreen}
      currentPitch={currentPitch}
      currentYaw={currentYaw}
      hotspots={value.image360Hotspots}
      imageAccept={imageAccept}
      imageName={imageName}
      imageSrc={imageSrc}
      imageAltBadge={imageAltBadge}
      initialPitch={value.image360InitialPitch}
      initialYaw={value.image360InitialYaw}
      onAddHotspot={addHotspot}
      onAllowFullscreenChange={(image360AllowFullscreen) =>
        onChange((current) => ({ ...current, image360AllowFullscreen }))
      }
      onHotspotUpdate={updateHotspot}
      onRemoveHotspot={removeHotspot}
      onRemoveImage={onRemoveImage}
      onSetInitialView={(image360InitialYaw, image360InitialPitch) =>
        onChange((current) => ({ ...current, image360InitialYaw, image360InitialPitch }))
      }
      onStartHotspotPick={onStartHotspotPick}
      onUploadImage={onUploadImage}
      onZoomEnabledChange={(image360ZoomEnabled) =>
        onChange((current) => ({ ...current, image360ZoomEnabled }))
      }
      renderHotspotRichTextField={renderHotspotRichTextField}
      zoomEnabled={value.image360ZoomEnabled}
    />
  );
}
