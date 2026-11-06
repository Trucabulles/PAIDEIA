import { useMemo, useRef, useState } from "react";
import { AuthoringFileButton, TrashIcon } from "../../authoring";
import { useI18n } from "../../../i18n/react";
import type { FindElementsPoint, FindElementsZone } from "../../../types/project";
import { createFindElementsZone } from "./findElementsDefaults";
import { clampPercent, insertVertexOnSegment, polygonBounds, relativePoint, zoneCenter } from "./findElementsGeometry";
import styles from "./FindElementsActivity.module.css";
import type { FindElementsActivityEditorProps } from "./findElementsTypes";

type DrawingMode = "select" | "polygon";
type DragState =
  | { kind: "move"; zoneId: string; start: FindElementsPoint; origin: FindElementsZone }
  | { kind: "vertex"; zoneId: string; index: number }
  | { kind: "resize"; zoneId: string; corner: "nw" | "ne" | "sw" | "se"; origin: FindElementsZone }
  | null;

function movePolygon(zone: FindElementsZone, dx: number, dy: number) {
  const points = zone.points ?? [];
  const bounds = polygonBounds(points);
  const safeDx = Math.max(-bounds.x, Math.min(100 - (bounds.x + bounds.width), dx));
  const safeDy = Math.max(-bounds.y, Math.min(100 - (bounds.y + bounds.height), dy));
  return { ...zone, points: points.map((point) => ({ x: point.x + safeDx, y: point.y + safeDy })) };
}

export function FindElementsActivityEditor({
  acceptImageTypes,
  data,
  imageAlt,
  imageAltControl,
  imageSrc,
  onDataChange,
  onImageSelect,
  onRemoveImage,
  renderZoneRichTextField
}: FindElementsActivityEditorProps) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<DrawingMode>("select");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(data.zones[0]?.id ?? null);
  const [expandedZoneIds, setExpandedZoneIds] = useState<string[]>([]);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [polygonDraft, setPolygonDraft] = useState<FindElementsPoint[]>([]);
  const dragRef = useRef<DragState>(null);
  const suppressStageClickRef = useRef(false);
  const selectedZone = useMemo(() => data.zones.find((zone) => zone.id === selectedZoneId) ?? null, [data.zones, selectedZoneId]);
  const deleteZone = deleteZoneId ? data.zones.find((zone) => zone.id === deleteZoneId) ?? null : null;

  const updateZone = (zoneId: string, updater: (zone: FindElementsZone) => FindElementsZone) => {
    onDataChange((current) => ({ ...current, zones: current.zones.map((zone) => zone.id === zoneId ? updater(zone) : zone) }));
  };
  const addZone = (zone: FindElementsZone) => {
    onDataChange((current) => ({ ...current, zones: [...current.zones, zone] }));
    setSelectedZoneId(zone.id);
    setExpandedZoneIds((current) => [...current, zone.id]);
  };
  const openZoneEditor = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setExpandedZoneIds((current) => current.includes(zoneId) ? current : [...current, zoneId]);
  };
  const confirmDeleteZone = () => {
    if (!deleteZone) return;
    onDataChange((current) => ({ ...current, zones: current.zones.filter((zone) => zone.id !== deleteZone.id) }));
    setExpandedZoneIds((current) => current.filter((id) => id !== deleteZone.id));
    setSelectedZoneId((current) => current === deleteZone.id ? null : current);
    setDeleteZoneId(null);
  };
  const pointFrom = (event: { clientX: number; clientY: number }) => stageRef.current ? relativePoint(event, stageRef.current) : { x: 0, y: 0 };

  const finishPolygon = () => {
    if (polygonDraft.length < 3) return;
    const zone = createFindElementsZone(data.zones.length + 1, "polygon");
    addZone({ ...zone, points: polygonDraft });
    setPolygonDraft([]);
  };

  const toggleDrawingMode = () => {
    setPolygonDraft([]);
    setMode((current) => current === "polygon" ? "select" : "polygon");
  };

  function onStageClick(event: React.MouseEvent<HTMLDivElement>) {
    if (suppressStageClickRef.current) {
      suppressStageClickRef.current = false;
      return;
    }
    if (!imageSrc || (event.target as Element).closest("[data-zone-control]")) return;
    const point = pointFrom(event);
    if (mode === "polygon") {
      if (polygonDraft.length >= 3 && Math.hypot(point.x - polygonDraft[0].x, point.y - polygonDraft[0].y) < 2.5) {
        finishPolygon();
      } else setPolygonDraft((current) => [...current, point]);
    } else if (mode === "select") setSelectedZoneId(null);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFrom(event);
    if (drag.kind === "move") {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      updateZone(drag.zoneId, (zone) => zone.shape === "polygon"
        ? movePolygon(drag.origin, dx, dy)
        : {
            ...drag.origin,
            x: clampPercent((drag.origin.x ?? 0) + dx),
            y: clampPercent((drag.origin.y ?? 0) + dy)
          });
    } else if (drag.kind === "vertex") {
      updateZone(drag.zoneId, (zone) => ({ ...zone, points: (zone.points ?? []).map((vertex, index) => index === drag.index ? point : vertex) }));
    } else if (drag.kind === "resize") {
      updateZone(drag.zoneId, (zone) => {
        const x = drag.origin.x ?? 0; const y = drag.origin.y ?? 0;
        const right = x + (drag.origin.width ?? 0); const bottom = y + (drag.origin.height ?? 0);
        const nextLeft = drag.corner.includes("w") ? Math.min(point.x, right - .5) : x;
        const nextTop = drag.corner.includes("n") ? Math.min(point.y, bottom - .5) : y;
        const nextRight = drag.corner.includes("e") ? Math.max(point.x, x + .5) : right;
        const nextBottom = drag.corner.includes("s") ? Math.max(point.y, y + .5) : bottom;
        return { ...zone, x: clampPercent(nextLeft), y: clampPercent(nextTop), width: Math.max(.5, clampPercent(nextRight) - clampPercent(nextLeft)), height: Math.max(.5, clampPercent(nextBottom) - clampPercent(nextTop)) };
      });
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) {
      suppressStageClickRef.current = true;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return <section className={styles.editor}>
    <details className={styles.generalSettings}>
      <summary>{t("findElements.generalSettings", undefined, "Paramètres généraux")}</summary>
      <div className={styles.editorSettings}>
        <label>{t("findElements.maxAttempts", undefined, "Nombre d’essais")}<input min="1" max="10" onChange={(event) => onDataChange((current) => ({ ...current, maxAttempts: Math.max(1, Math.min(10, Number(event.target.value) || 1)) }))} type="number" value={data.maxAttempts} /></label>
        <label>{t("findElements.successThreshold", undefined, "Seuil de réussite (%)")}<input min="0" max="100" onChange={(event) => onDataChange((current) => ({ ...current, successThreshold: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }))} type="number" value={data.successThreshold} /></label>
      </div>
      <div className={styles.labelFields}>
        {(["description", "risk", "correction"] as const).map((field) => <label key={field}>{t(`findElements.label.${field}`, undefined, field === "description" ? "Libellé description" : field === "risk" ? "Libellé risque" : "Libellé correction")}<input onChange={(event) => onDataChange((current) => ({ ...current, labels: { ...current.labels, [field]: event.target.value } }))} value={data.labels[field]} /></label>)}
      </div>
    </details>
    <section className={styles.editorWorkspace}>
      <div className={styles.editorHeader}>
        <span className={`editor-label ${styles.editorHeaderTitle}`}>{t("activity.find-elements")}</span>
        <div className={styles.editorHeaderActions}>
          <div className={styles.editorToolbar}>
            <button
              aria-pressed={mode === "polygon"}
              className={`${styles.modeButton} ${mode === "polygon" ? styles.modeButtonActive : ""}`}
              disabled={!imageSrc}
              onClick={toggleDrawingMode}
              type="button"
            >
              {t("findElements.drawSelection", undefined, "Dessiner une sélection")}
            </button>
            {mode === "polygon" && polygonDraft.length >= 3 ? <button className={styles.secondaryButton} onClick={finishPolygon} type="button">{t("findElements.closePolygon", undefined, "Fermer le polygone")}</button> : null}
          </div>
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
      </div>
      <div className={`${styles.editorStage} ${!imageSrc ? styles.editorStageEmpty : ""}`} onClick={onStageClick} onDoubleClick={() => { if (mode === "polygon") finishPolygon(); }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} ref={stageRef}>
      {imageSrc ? <img alt={imageAlt} className={styles.editorStageImage} draggable={false} onDragStart={(event) => event.preventDefault()} src={imageSrc} /> : <AuthoringFileButton accept={acceptImageTypes} onFileSelect={onImageSelect}>{t("imageGrid.addImage", undefined, "Ajouter une image")}</AuthoringFileButton>}
      {imageSrc && data.zones.filter((zone) => zone.shape === "rectangle").map((zone) => <div data-zone-control className={`${styles.zoneRectangle} ${zone.id === selectedZoneId ? styles.zoneRectangleSelected : ""}`} key={zone.id} onPointerDown={(event) => { event.stopPropagation(); if (mode !== "select") return; const point = pointFrom(event); dragRef.current = { kind: "move", zoneId: zone.id, start: point, origin: zone }; stageRef.current?.setPointerCapture(event.pointerId); openZoneEditor(zone.id); }} style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}>
        {zone.id === selectedZoneId ? (["nw", "ne", "sw", "se"] as const).map((corner) => <span data-zone-control className={`${styles.resizeHandle} ${styles[`resize${corner.toUpperCase()}`]}`} key={corner} onPointerDown={(event) => { event.stopPropagation(); dragRef.current = { kind: "resize", zoneId: zone.id, corner, origin: zone }; stageRef.current?.setPointerCapture(event.pointerId); }} />) : null}
      </div>)}
      {imageSrc ? <svg className={styles.polygonSvg} viewBox="0 0 100 100" preserveAspectRatio="none">{data.zones.filter((zone) => zone.shape === "polygon").map((zone) => { const points = (zone.points ?? []).map((point) => `${point.x},${point.y}`).join(" "); return <g data-zone-control key={zone.id}><polygon className={`${styles.polygon} ${zone.id === selectedZoneId ? styles.polygonSelected : ""}`} onPointerDown={(event) => { event.stopPropagation(); if (mode !== "select") return; const point = pointFrom(event); dragRef.current = { kind: "move", zoneId: zone.id, start: point, origin: zone }; stageRef.current?.setPointerCapture(event.pointerId); openZoneEditor(zone.id); }} points={points} />{zone.id === selectedZoneId ? (zone.points ?? []).map((point, index, pointsArray) => { const next = pointsArray[(index + 1) % pointsArray.length]; return <line className={styles.segmentHit} data-zone-control key={`s${index}`} onPointerDown={(event) => { event.stopPropagation(); const insert = pointFrom(event); updateZone(zone.id, (current) => ({ ...current, points: insertVertexOnSegment(current.points ?? [], index, insert) })); }} x1={point.x} x2={next.x} y1={point.y} y2={next.y} />; }) : null}</g>; })}{polygonDraft.length ? <polyline className={styles.polygonDraft} fill="none" points={polygonDraft.map((point) => `${point.x},${point.y}`).join(" ")} /> : null}</svg> : null}
      {imageSrc && selectedZone?.shape === "polygon" ? (selectedZone.points ?? []).map((point, index, pointsArray) => <span className={styles.polygonVertexHandle} data-zone-control key={`vertex-${selectedZone.id}-${index}`} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); if (pointsArray.length <= 3) return; updateZone(selectedZone.id, (current) => ({ ...current, points: (current.points ?? []).filter((_, vertexIndex) => vertexIndex !== index) })); }} onPointerDown={(event) => { event.stopPropagation(); dragRef.current = { kind: "vertex", zoneId: selectedZone.id, index }; stageRef.current?.setPointerCapture(event.pointerId); }} style={{ left: `${point.x}%`, top: `${point.y}%` }} />) : null}
      {imageSrc && polygonDraft.length ? polygonDraft.map((point, index) => <span aria-hidden="true" className={styles.polygonDraftVertexHandle} key={`draft-vertex-${index}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />) : null}
      {imageSrc ? data.zones.map((zone) => { const center = zoneCenter(zone); return <span className={styles.zoneLabel} key={`label-${zone.id}`} style={{ left: `${center.x}%`, top: `${center.y}%` }}>{zone.title}</span>; }) : null}
      </div>
      <section className={styles.zoneEditors}>
      <h3>{t("findElements.elements", undefined, "Éléments")}</h3>
      {data.zones.map((zone, index) => (
        <details
          className={styles.zoneEditorCard}
          key={zone.id}
          onToggle={(event) => {
            const isOpen = event.currentTarget.open;
            setExpandedZoneIds((current) => isOpen
              ? current.includes(zone.id) ? current : [...current, zone.id]
              : current.filter((id) => id !== zone.id));
            if (isOpen) openZoneEditor(zone.id);
            else if (selectedZoneId === zone.id) setSelectedZoneId(null);
          }}
          open={expandedZoneIds.includes(zone.id)}
        >
          <summary>
            <span>{index + 1}. {zone.title}</span>
            <button aria-label={t("findElements.deleteElement", undefined, "Supprimer l’élément")} className="danger-pill compact compact-delete-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setDeleteZoneId(zone.id); }} title={t("findElements.deleteElement", undefined, "Supprimer l’élément")} type="button"><TrashIcon /></button>
          </summary>
          <div className={styles.zoneFields}>
            <label>{t("findElements.elementName", undefined, "Nom de l’élément")}<input onChange={(event) => updateZone(zone.id, (current) => ({ ...current, title: event.target.value }))} value={zone.title} /></label>
            <label>{t("findElements.severity", undefined, "Gravité")}<select onChange={(event) => updateZone(zone.id, (current) => ({ ...current, severity: event.target.value as FindElementsZone["severity"] }))} value={zone.severity}><option value="sans">{t("findElements.severity.none", undefined, "Sans gravité")}</option><option value="faible">{t("findElements.severity.low", undefined, "Faible")}</option><option value="moyen">{t("findElements.severity.medium", undefined, "Moyen")}</option><option value="important">{t("findElements.severity.high", undefined, "Important")}</option><option value="critique">{t("findElements.severity.critical", undefined, "Critique")}</option></select></label>
            {renderZoneRichTextField({ zone, field: "descriptionHtml", html: zone.descriptionHtml, label: data.labels.description, placeholder: t("findElements.describeElement", undefined, "Décrivez l’élément…") })}
            {renderZoneRichTextField({ zone, field: "riskHtml", html: zone.riskHtml, label: data.labels.risk, placeholder: t("findElements.describeRisk", undefined, "Décrivez le risque…") })}
            {renderZoneRichTextField({ zone, field: "correctionHtml", html: zone.correctionHtml, label: data.labels.correction, placeholder: t("findElements.describeCorrection", undefined, "Décrivez la correction…") })}
          </div>
        </details>
      ))}
      </section>
    </section>
    {deleteZone ? (
      <div className="paideia-modal-backdrop" role="presentation">
        <section aria-labelledby="find-elements-delete-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
          <p className="modal-kicker">{t("findElements.deleteKicker", undefined, "Suppression d’un élément")}</p>
          <h2 id="find-elements-delete-title">{t("findElements.confirmDelete", undefined, "Confirmer la suppression")}</h2>
          <p>{t("findElements.deleteHelp", undefined, "Cette action supprimera définitivement l’élément sélectionné et sa zone sur l’image.")}</p>
          <strong>{deleteZone.title}</strong>
          <div className="modal-actions">
            <button className="ghost-pill" onClick={() => setDeleteZoneId(null)} type="button">{t("common.cancel", undefined, "Annuler")}</button>
            <button className="danger-pill" onClick={confirmDeleteZone} type="button">{t("common.delete", undefined, "Supprimer")}</button>
          </div>
        </section>
      </div>
    ) : null}
  </section>;
}
