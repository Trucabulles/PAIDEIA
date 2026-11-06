import { useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { clampPercent } from "../../../app/mediaAssets";
import type { PointOfInterestMarker } from "../../../types/project";
import { PointOfInterestActivityEditor } from "./PointOfInterestActivityEditor";
import { sanitizePointOfInterestMarkerLabel } from "./markerLabel";

type PointOfInterestEditorValue = {
  pointOfInterestMarkers: PointOfInterestMarker[];
};

type PointOfInterestActivityEditorPanelProps = {
  acceptImageTypes: string;
  blockId: string;
  createMarker: (order: number) => PointOfInterestMarker;
  editorSessionKey: string;
  imageSrc: string | null;
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
  onImageSelect: (file: File) => void;
  onMarkersChange: (update: (markers: PointOfInterestMarker[]) => PointOfInterestMarker[]) => void;
  onRemoveImage: () => void;
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
  value: PointOfInterestEditorValue;
};

function toRoman(value: number) {
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let remaining = Math.max(1, Math.trunc(value));
  let result = "";
  numerals.forEach(([amount, numeral]) => {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  });
  return result;
}

function toAlphabetic(value: number, lowercase: boolean) {
  let remaining = Math.max(1, Math.trunc(value));
  let result = "";
  while (remaining > 0) {
    remaining -= 1;
    result = String.fromCharCode(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return lowercase ? result.toLowerCase() : result;
}

function markerLabelForOrder(seed: string, order: number) {
  if (/^\d+$/.test(seed)) {
    const start = Number.parseInt(seed, 10);
    return String(start + order - 1).padStart(seed.length, "0");
  }
  if (seed === "I" || seed === "i") {
    const roman = toRoman(order);
    return seed === "i" ? roman.toLowerCase() : roman;
  }
  if (/^[A-Za-z]$/.test(seed)) {
    const start = seed.toUpperCase().charCodeAt(0) - 64;
    return toAlphabetic(start + order - 1, seed === seed.toLowerCase());
  }
  return seed;
}

export function commonMarkerLabel(markers: PointOfInterestMarker[]) {
  if (markers.length === 0) {
    return "";
  }
  const firstLabel = markers[0].label || "";
  const allLabelsMatch = markers.every((marker) => (marker.label || "") === firstLabel);
  const allLabelsAreAutomatic = markers.every((marker) => marker.label === String(marker.order));
  const allLabelsFollowSequence = markers.every(
    (marker) => marker.label === markerLabelForOrder(firstLabel, marker.order)
  );
  if (allLabelsAreAutomatic) {
    return firstLabel;
  }
  return allLabelsMatch || allLabelsFollowSequence ? firstLabel : "";
}

export function PointOfInterestActivityEditorPanel({
  acceptImageTypes,
  blockId,
  createMarker,
  editorSessionKey,
  imageSrc,
  imageAltControl,
  optimizationAvailable,
  projectPath,
  subtitleGenerationConfiguration,
  onImageSelect,
  onMarkersChange,
  onRemoveImage,
  onUploadMarkerAsset,
  resolveAssetUrl,
  renderMarkerRichTextField,
  title,
  value
}: PointOfInterestActivityEditorPanelProps) {
  const [draggedMarkerId, setDraggedMarkerId] = useState<string | null>(null);
  const markerColor = value.pointOfInterestMarkers.find((marker) => marker.color)?.color ?? "#123a7a";
  const markerLabel = commonMarkerLabel(value.pointOfInterestMarkers);

  function updateMarker(markerId: string, patch: Partial<PointOfInterestMarker>) {
    const normalizedPatch = patch.label === undefined
      ? patch
      : { ...patch, label: sanitizePointOfInterestMarkerLabel(patch.label) };
    onMarkersChange((markers) =>
      markers.map((marker) => (marker.id === markerId ? { ...marker, ...normalizedPatch } : marker))
    );
  }

  function addMarker(x = 50, y = 50) {
    if (!imageSrc) {
      return;
    }
    onMarkersChange((markers) => {
      const nextOrder = markers.length + 1;
      const currentColor = markers.find((marker) => marker.color)?.color ?? "#123a7a";
      const sharedLabel = commonMarkerLabel(markers);
      const normalizedMarkers = sharedLabel
        ? markers.map((marker) => ({
            ...marker,
            label: markerLabelForOrder(sharedLabel, marker.order)
          }))
        : markers;
      return [
        ...normalizedMarkers,
        {
          ...createMarker(nextOrder),
          x: clampPercent(x),
          y: clampPercent(y),
          color: currentColor,
          label: sharedLabel ? markerLabelForOrder(sharedLabel, nextOrder) : String(nextOrder)
        }
      ];
    });
  }

  function removeMarker(markerId: string) {
    onMarkersChange((markers) => {
      const sharedLabel = commonMarkerLabel(markers);
      return markers
        .filter((marker) => marker.id !== markerId)
        .map((marker, index) => {
          const nextOrder = index + 1;
          const hadAutomaticLabel = !marker.label || marker.label === String(marker.order);
          return {
            ...marker,
            order: nextOrder,
            label: sharedLabel
              ? markerLabelForOrder(sharedLabel, nextOrder)
              : hadAutomaticLabel
                ? String(nextOrder)
                : marker.label
          };
        });
    });
  }

  function handleStageClick(event: MouseEvent<HTMLDivElement>) {
    if (!imageSrc) {
      return;
    }
    if (
      event.target !== event.currentTarget &&
      !(event.target as HTMLElement).classList.contains("interactive-editor-image")
    ) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    addMarker(x, y);
  }

  function handleStagePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggedMarkerId) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    updateMarker(draggedMarkerId, {
      x: clampPercent(x),
      y: clampPercent(y)
    });
  }

  return (
    <PointOfInterestActivityEditor
      acceptImageTypes={acceptImageTypes}
      blockId={blockId}
      clampPercent={clampPercent}
      draggedMarkerId={draggedMarkerId}
      editorSessionKey={editorSessionKey}
      imageSrc={imageSrc}
      imageAltControl={imageAltControl}
      optimizationAvailable={optimizationAvailable}
      projectPath={projectPath}
      subtitleGenerationConfiguration={subtitleGenerationConfiguration}
      markerColor={markerColor}
      markerLabel={markerLabel}
      markers={value.pointOfInterestMarkers}
      onAddMarker={() => addMarker()}
      onImageSelect={onImageSelect}
      onMarkerColorChange={(color) =>
        onMarkersChange((markers) => markers.map((marker) => ({ ...marker, color })))
      }
      onMarkerLabelChange={(label) =>
        onMarkersChange((markers) =>
          markers.map((marker) => ({
            ...marker,
            label: markerLabelForOrder(sanitizePointOfInterestMarkerLabel(label), marker.order)
          }))
        )
      }
      onMarkerPointerDown={(markerId, event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setDraggedMarkerId(markerId);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onMarkerPointerUp={(event) => {
        event.stopPropagation();
        setDraggedMarkerId(null);
      }}
      onRemoveMarker={removeMarker}
      onRemoveImage={onRemoveImage}
      onStageClick={handleStageClick}
      onStagePointerMove={handleStagePointerMove}
      onStagePointerUp={() => setDraggedMarkerId(null)}
      onUpdateMarker={updateMarker}
      onUploadMarkerAsset={onUploadMarkerAsset}
      resolveAssetUrl={resolveAssetUrl}
      renderMarkerRichTextField={renderMarkerRichTextField}
      title={title}
    />
  );
}
