import { useEffect, useState } from "react";
import { AuthoringButton, AuthoringFieldGrid, AuthoringFileButton, TrashIcon } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import styles from "./PointOfInterestActivity.module.css";
import type { PointOfInterestActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";
import { PointOfInterestMarkerMediaEditor } from "./PointOfInterestMarkerMediaEditor";
import { sanitizePointOfInterestMarkerLabel } from "./markerLabel";


function markerTextColor(backgroundColor?: string | null) {
  const value = (backgroundColor ?? "#123a7a").trim();
  const hex = value.startsWith("#") ? value.slice(1) : "";
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex.length === 6
        ? hex
        : null;

  if (!normalized || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "#ffffff";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance > 0.6 ? "#102752" : "#ffffff";
}

export function PointOfInterestActivityEditor({
  acceptImageTypes,
  blockId,
  clampPercent,
  draggedMarkerId,
  editorSessionKey,
  imageSrc,
  imageAltControl,
  optimizationAvailable,
  projectPath,
  subtitleGenerationConfiguration,
  markers,
  markerColor,
  markerLabel,
  onAddMarker,
  onImageSelect,
  onMarkerColorChange,
  onMarkerLabelChange,
  onMarkerPointerDown,
  onMarkerPointerUp,
  onRemoveMarker,
  onRemoveImage,
  onStageClick,
  onStagePointerMove,
  onStagePointerUp,
  onUpdateMarker,
  onUploadMarkerAsset,
  resolveAssetUrl,
  renderMarkerRichTextField,
  title
}: PointOfInterestActivityEditorProps) {
  const { t } = useI18n();
  const [expandedMarkerIds, setExpandedMarkerIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedMarkerIds(new Set());
  }, [editorSessionKey]);

  function toggleMarker(markerId: string) {
    setExpandedMarkerIds((current) => {
      const next = new Set(current);
      if (next.has(markerId)) {
        next.delete(markerId);
      } else {
        next.add(markerId);
      }
      return next;
    });
  }

  return (
    <div className={`inspector-span-2 interactive-editor-panel ${styles.editor}`}>
      <div className={`interactive-editor-header ${styles.editorHeader}`}>
        <span className="editor-label">{t("activity.point-of-interest")}</span>
        {imageSrc ? (
          <div className={styles.imageHeaderControls}>
            {imageAltControl}
            <button
              aria-label={t("media.removeImage")}
              className={styles.removeImageButton}
              onClick={onRemoveImage}
              title={t("media.removeImage")}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <div
        className="interactive-editor-stage"
        onClick={onStageClick}
        onPointerMove={(event) => {
          if (draggedMarkerId) {
            event.preventDefault();
            onStagePointerMove(event);
          }
        }}
        onPointerUp={onStagePointerUp}
      >
        {imageSrc ? (
          <img alt={title} className="interactive-editor-image" src={imageSrc} />
        ) : (
          <div className={`point-of-interest-placeholder ${styles.imagePlaceholder}`}>
            <AuthoringFileButton
              accept={acceptImageTypes}
              className={styles.addImageButton}
              onFileSelect={onImageSelect}
            >
              {t("imageGrid.addImage", undefined, "Ajouter une image")}
            </AuthoringFileButton>
          </div>
        )}
        {imageSrc ? markers.map((marker) => (
          <span
            className="point-of-interest-marker editor-marker"
            key={marker.id}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemoveMarker(marker.id);
            }}
            onPointerDown={(event) => onMarkerPointerDown(marker.id, event)}
            onPointerUp={onMarkerPointerUp}
            style={{
              left: `${clampPercent(marker.x)}%`,
              top: `${clampPercent(marker.y)}%`,
              backgroundColor: markerColor,
              color: markerTextColor(markerColor)
            }}
          >
            {marker.label || marker.order}
          </span>
        )) : null}
      </div>
      <AuthoringFieldGrid className={styles.panelSettingsGrid}>
        <label className={styles.markerColorField}>
          <span>{t("poi.markerColor", undefined, "Couleur marqueur")}</span>
          <ColorPickerField ariaLabel={t("poi.markerColor", undefined, "Couleur marqueur")} onChange={onMarkerColorChange} value={markerColor} />
        </label>
        <label
          className={styles.sharedMarkerLabelField}
          title={t("poi.labelExamples", undefined, "Exemples de libell? : * ? ! 1 10")}
        >
          <span>{t("poi.pointsLabel", undefined, "Libell\u00e9 des points")}</span>
          <input
            aria-label={t("poi.sharedMarkerLabel", undefined, "Libell\u00e9 commun des marqueurs")}
            className={styles.markerLabelInput}
            maxLength={2}
            onChange={(event) => onMarkerLabelChange(sanitizePointOfInterestMarkerLabel(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            title={t("poi.labelExamples", undefined, "Exemples de libell? : * ? ! 1 10")}
            value={markerLabel}
          />
        </label>
        <AuthoringButton disabled={!imageSrc} onClick={onAddMarker} variant="ghost">
          {t("poi.addMarker", undefined, "Ajouter un marqueur")}
        </AuthoringButton>
      </AuthoringFieldGrid>
      <div className="marker-editor-list">
        {markers.map((marker) => {
          const isExpanded = expandedMarkerIds.has(marker.id);
          return (
            <article className="marker-editor-card" key={marker.id}>
              <div className="marker-editor-card-header">
                <button
                  aria-expanded={isExpanded}
                  className={styles.markerToggle}
                  onClick={() => toggleMarker(marker.id)}
                  type="button"
                >
                  <span aria-hidden="true">{isExpanded ? "v" : ">"}</span>
                  <strong>{t("poi.markerNumber", { count: marker.order }, "Marqueur {count}")}</strong>
                </button>
                <button
                  aria-label={t("poi.deleteMarker", { count: marker.order }, "Supprimer le marqueur {count}")}
                  className="danger-pill compact compact-delete-button"
                  onClick={() => onRemoveMarker(marker.id)}
                  title={t("poi.deleteMarker", { count: marker.order }, "Supprimer le marqueur {count}")}
                  type="button"
                >
                  <TrashIcon />
                </button>
              </div>
              {isExpanded ? (
                <>
                  <div className={styles.markerFields}>
                    <label>
                      <span>{t("poi.pointLabelWithExamples", undefined, "Libell\u00e9 du point (exemples : * ? ! 1 10)")}</span>
                      <input
                        className={styles.markerLabelInput}
                        maxLength={2}
                        onChange={(event) => onUpdateMarker(marker.id, { label: sanitizePointOfInterestMarkerLabel(event.target.value) })}
                        value={marker.label}
                      />
                    </label>
                    {renderMarkerRichTextField({
                      className: `activity-item-rich-editor compact ${styles.markerPanelRichText}`,
                      field: "title",
                      html: marker.title || "",
                      label: t("poi.panelTitle", undefined, "Titre du panneau"),
                      marker,
                      placeholder: t("poi.panelTitle", undefined, "Titre du panneau")
                    })}
                  </div>
                  <PointOfInterestMarkerMediaEditor
                    blockId={blockId}
                    marker={marker}
                    onChange={(media) => onUpdateMarker(marker.id, { media })}
                    onUpload={(file, kind) => onUploadMarkerAsset(marker.id, file, kind)}
                    optimizationAvailable={optimizationAvailable}
                    projectPath={projectPath}
                    resolveAssetUrl={resolveAssetUrl}
                    subtitleGenerationConfiguration={subtitleGenerationConfiguration}
                  />
                  {renderMarkerRichTextField({
                    className: `activity-item-rich-editor ${styles.markerPanelRichText}`,
                    field: "contentHtml",
                    html: marker.contentHtml || "",
                    label: t("poi.panelText", undefined, "Texte du panneau"),
                    marker,
                    placeholder: t("editor.richTextPlaceholder", undefined, "Saisissez votre texte ici")
                  })}
                </>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
