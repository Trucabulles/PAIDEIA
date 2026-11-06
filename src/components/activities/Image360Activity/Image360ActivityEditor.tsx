import { useEffect, useMemo, useRef, useState } from "react";
import {
  AuthoringButton,
  AuthoringCheckbox,
  AuthoringFieldGrid,
  AuthoringFileButton,
} from "../../authoring";
import { normalizeImage360Hotspots } from "./defaults";
import { Image360Activity } from "./Image360Activity";
import styles from "./Image360Activity.module.css";
import type { Image360ActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";

function stripHtml(value: string | null | undefined) {
  return (
    value
      ?.replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function hasMeaningfulHtml(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  if (/<img\b/i.test(value)) {
    return true;
  }
  return Boolean(stripHtml(value));
}

function normalizeFieldHtml(value: string) {
  return hasMeaningfulHtml(value) ? value : "";
}

function isDefaultHotspotTitle(
  value: string | null | undefined,
  order: number,
) {
  return stripHtml(value) === `Point ${order}`;
}

export function Image360ActivityEditor({
  currentPitch,
  currentYaw,
  hotspots,
  imageAccept,
  imageName,
  imageSrc,
  imageAltBadge,
  initialPitch,
  initialYaw,
  onAddHotspot,
  onHotspotUpdate,
  onRemoveHotspot,
  onRemoveImage,
  onSetInitialView,
  onStartHotspotPick,
  onUploadImage,
  onZoomEnabledChange,
  renderHotspotRichTextField,
  zoomEnabled,
}: Image360ActivityEditorProps) {
  const { t } = useI18n();
  const orderedHotspots = useMemo(
    () => normalizeImage360Hotspots(hotspots),
    [hotspots],
  );
  const [activeHotspotId, setActiveHotspotId] = useState(
    orderedHotspots[0]?.id ?? "",
  );
  const activeHotspot =
    orderedHotspots.find((hotspot) => hotspot.id === activeHotspotId) ??
    orderedHotspots[0] ??
    null;
  const [ratioWarning, setRatioWarning] = useState("");
  const selectNewHotspotRef = useRef(false);
  const [previewYaw, setPreviewYaw] = useState(currentYaw);
  const [previewPitch, setPreviewPitch] = useState(currentPitch);

  useEffect(() => {
    setPreviewYaw(initialYaw);
    setPreviewPitch(initialPitch);
  }, [imageSrc, initialPitch, initialYaw]);

  useEffect(() => {
    if (!activeHotspotId && orderedHotspots[0]) {
      setActiveHotspotId(orderedHotspots[0].id);
    }
  }, [activeHotspotId, orderedHotspots]);

  useEffect(() => {
    if (!selectNewHotspotRef.current) {
      return;
    }

    const newestHotspot = orderedHotspots[orderedHotspots.length - 1];

    if (!newestHotspot) {
      return;
    }

    setActiveHotspotId(newestHotspot.id);
    onStartHotspotPick(newestHotspot.id);

    selectNewHotspotRef.current = false;
  }, [orderedHotspots, onStartHotspotPick]);

  useEffect(() => {
    if (!imageSrc) {
      setRatioWarning("");
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        setRatioWarning("");
        return;
      }
      const ratio = image.naturalWidth / image.naturalHeight;
      setRatioWarning(
        Math.abs(ratio - 2) > 0.08
          ? t("image360.ratioWarning", undefined, "Attention : l'image 360 devrait idéalement avoir un ratio 2:1.")
          : "",
      );
    };
    image.src = imageSrc;
  }, [imageSrc]);

  function addHotspot() {
    selectNewHotspotRef.current = true;
    onAddHotspot();
  }

  function renderHotspotRichField(
    field: "title" | "contentHtml",
    label: string,
    placeholder: string,
    className = styles.hotspotInlineField,
  ) {
    if (!activeHotspot) {
      return null;
    }
    const rawHtml =
      (activeHotspot[field] as string | null | undefined)?.trim() || "";
    const titleIsMock =
      field === "title" && isDefaultHotspotTitle(rawHtml, activeHotspot.order);
    const html = titleIsMock ? "" : rawHtml;
    const resolvedPlaceholder = titleIsMock
      ? t("image360.pointNumber", { count: activeHotspot.order }, "Point {count}")
      : placeholder;

    return renderHotspotRichTextField({
      className,
      field,
      hotspotId: activeHotspot.id,
      html,
      label,
      onCommit: (nextHtml) =>
        onHotspotUpdate(activeHotspot.id, {
          [field]: normalizeFieldHtml(nextHtml),
        }),
      placeholder: resolvedPlaceholder,
    });
  }

  return (
    <div className={`inspector-span-2 activity-style-panel ${styles.editor}`}>
      <section className={styles.editorSection}>
        <div className={styles.editorHeader}>
          <div>
            <span className="editor-label">{t("activity.image-360")}</span>
            <p className="field-hint">
              {t("image360.panoramaHint", undefined, "Utilisez uniquement une image panoramique équirectangulaire")}
            </p>
          </div>
          <AuthoringFileButton
            accept={imageAccept}
            onFileSelect={onUploadImage}
          >
            {t("image360.selectImage", undefined, "Sélectionner une image 360")}
          </AuthoringFileButton>
        </div>
        <div className={styles.imageMeta}>
          <strong>{imageName || t("image360.defaultImage", undefined, "Image par défaut")}</strong>
          {imageName ? imageAltBadge : null}
          {imageName ? (
            <AuthoringButton
              className={styles.paideiaButton}
              compact
              onClick={onRemoveImage}
              variant="danger"
            >
              {t("common.remove")}
            </AuthoringButton>
          ) : null}
        </div>
        {ratioWarning ? <p className={styles.warning}>{ratioWarning}</p> : null}
      </section>

      <section className={styles.editorSection}>
        <div className={styles.editorHeader}>
          <div>
            <span className="editor-label">{t("image360.viewNavigation", undefined, "Vue et navigation")}</span>
            <p className="field-hint">
              {t("image360.viewHint", undefined, "Orientez l'image puis définissez la vue actuelle comme point de départ.")}
            </p>
          </div>
          <AuthoringButton
            className={styles.paideiaButton}
            onClick={() => onSetInitialView(previewYaw, previewPitch)}
            variant="secondary"
          >
            {t("image360.setCurrentView", undefined, "Définir la vue actuelle")}
          </AuthoringButton>
        </div>
        <AuthoringFieldGrid className={styles.compactGrid}>
          <label>
            <span>{t("image360.initialYaw", undefined, "Coordonnées horizontales de départ")}</span>
            <input
              onChange={(event) =>
                onSetInitialView(Number(event.target.value), initialPitch)
              }
              type="number"
              value={Math.round(initialYaw)}
            />
          </label>
          <label>
            <span>{t("image360.initialPitch", undefined, "Coordonnées verticales de départ")}</span>
            <input
              onChange={(event) =>
                onSetInitialView(initialYaw, Number(event.target.value))
              }
              type="number"
              value={Math.round(initialPitch)}
            />
          </label>
          <AuthoringCheckbox
            checked={zoomEnabled}
            compact
            onChange={(event) => onZoomEnabledChange(event.target.checked)}
          >
            {t("image360.allowZoom", undefined, "Autoriser le zoom")}
          </AuthoringCheckbox>
        </AuthoringFieldGrid>
      </section>

      <section className={styles.editorSection}>
        <div className={styles.editorHeader}>
          <div>
            <span className="editor-label">{t("image360.hotspots", undefined, "Points interactifs")}</span>
            <p className="field-hint">
              {t("image360.hotspotHint", undefined, "Cliquez sur « ajouter un point » puis faites un clic droit dans l'image 360 pour placer un point. Les coordonnées horizontales et verticales permettent d'ajuster le placement.")}
            </p>
          </div>

          <AuthoringButton
            className={styles.paideiaButton}
            onClick={addHotspot}
            variant="secondary"
          >
            {t("image360.addPoint", undefined, "Ajouter un point")}
          </AuthoringButton>
        </div>

        {orderedHotspots.length ? (
          <>
            {activeHotspot ? (
              <div className={styles.hotspotPreview}>
                <Image360Activity
                  allowFullscreen={false}
                  backgroundColor="#ffffff"
                  borderColor="rgba(18, 58, 122, 0.14)"
                  borderStyle="solid"
                  borderWidth="1px"
                  fullWidth={false}
                  hotspots={orderedHotspots}
                  imageSrc={imageSrc}
                  initialPitch={initialPitch}
                  initialYaw={initialYaw}
                  onHotspotActivate={(hotspotId) => {
                    setActiveHotspotId(hotspotId);
                    onStartHotspotPick(hotspotId);
                  }}
                  onScenePointPick={(yaw, pitch) => {
                    onHotspotUpdate(activeHotspot.id, { yaw, pitch });
                    onStartHotspotPick(activeHotspot.id);
                  }}
                  onViewChange={(yaw, pitch) => {
                    setPreviewYaw(yaw);
                    setPreviewPitch(pitch);
                  }}
                  pickingMode
                  rounded
                  shadow={false}
                  zoomEnabled={zoomEnabled}
                />
              </div>
            ) : null}

            <div className={styles.hotspotEditorLayout}>
              <aside className={styles.hotspotList}>
                {orderedHotspots.map((hotspot) => (
                  <button
                    className={
                      hotspot.id === activeHotspot?.id
                        ? styles.activeHotspotRow
                        : ""
                    }
                    key={hotspot.id}
                    onClick={() => {
                      setActiveHotspotId(hotspot.id);
                      onStartHotspotPick(hotspot.id);
                    }}
                    type="button"
                  >
                    <strong>
                      {stripHtml(hotspot.title) || t("image360.pointNumber", { count: hotspot.order }, "Point {count}")}
                    </strong>
                  </button>
                ))}
              </aside>

              {activeHotspot ? (
                <div className={styles.hotspotForm}>
                  {renderHotspotRichField("title", t("image360.pointTitle", undefined, "Titre du point"), t("image360.pointTitle", undefined, "Titre du point"))}
                  {renderHotspotRichField(
                    "contentHtml",
                    t("editor.content", undefined, "Contenu"),
                    t("editor.richTextPlaceholder", undefined, "Saisissez votre texte ici"),
                    styles.hotspotContentField,
                  )}
                  <AuthoringFieldGrid className={styles.compactGrid}>
                    <label>
                      <span>{t("common.horizontal", undefined, "Horizontal")}</span>
                      <input
                        onChange={(event) =>
                          onHotspotUpdate(activeHotspot.id, {
                            yaw: Number(event.target.value),
                          })
                        }
                        type="number"
                        value={Math.round(activeHotspot.yaw)}
                      />
                    </label>
                    <label>
                      <span>{t("common.vertical", undefined, "Vertical")}</span>
                      <input
                        onChange={(event) =>
                          onHotspotUpdate(activeHotspot.id, {
                            pitch: Number(event.target.value),
                          })
                        }
                        type="number"
                        value={Math.round(activeHotspot.pitch)}
                      />
                    </label>
                  </AuthoringFieldGrid>
                  <div className={styles.editorActions}>
                    <AuthoringButton
                      className={styles.paideiaButton}
                      onClick={() => onRemoveHotspot(activeHotspot.id)}
                      variant="danger"
                    >
                      {t("image360.deletePoint", undefined, "Supprimer le point")}
                    </AuthoringButton>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="field-hint">
            {t("image360.noHotspot", undefined, "Aucun point interactif défini. L'activité restera une simple image 360.")}
          </p>
        )}
      </section>
    </div>
  );
}
