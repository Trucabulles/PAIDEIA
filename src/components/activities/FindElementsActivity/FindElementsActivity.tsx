import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FindElementsZone } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import { evaluateFindElements } from "./findElementsEvaluation";
import { relativePoint, zoneCenter } from "./findElementsGeometry";
import styles from "./FindElementsActivity.module.css";
import type { FindElementsActivityProps, FindElementsMarker } from "./findElementsTypes";

type RuntimePhase = "intro" | "playing" | "review" | "completed";
type ReviewMode = "expected" | "compare";
type FeedbackInfo = { remaining: number; score: number };

function severityClass(zone: FindElementsZone) {
  return zone.severity === "faible" ? styles.severityFaible
    : zone.severity === "moyen" ? styles.severityMoyen
      : zone.severity === "important" ? styles.severityImportant
        : zone.severity === "critique" ? styles.severityCritique
          : "";
}

function htmlNode(html: string, className?: string) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function hasRichContent(html: string | null | undefined) {
  if (/<(?:audio|canvas|iframe|img|svg|table|video)\b/i.test(html ?? "")) return true;
  return (html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|#160);/gi, " ")
    .trim()
    .length > 0;
}

export function FindElementsActivity({
  authoringMode = false,
  data,
  imageAlt,
  imageSrc,
  onComplete,
  renderRichContent
}: FindElementsActivityProps) {
  const { t } = useI18n();
  const introTitle = t("activity.find-elements", undefined, "Chercher dans l'image");
  const introInstruction = t(
    "findElements.introHelp",
    undefined,
    "Cliquer sur l’image pour placer un point.\nFaire glisser un point pour le déplacer.\nClic droit pour supprimer un point."
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<RuntimePhase>("intro");
  const [attempt, setAttempt] = useState(1);
  const [markers, setMarkers] = useState<FindElementsMarker[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("expected");
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [draggedMarkerId, setDraggedMarkerId] = useState<string | null>(null);
  const [feedbackInfo, setFeedbackInfo] = useState<FeedbackInfo | null>(null);
  const [detailPanelPosition, setDetailPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const evaluation = useMemo(() => evaluateFindElements(data, markers), [data, markers]);
  const hasSeverity = data.zones.some((zone) => zone.severity !== "sans");
  const imageFrameStyle = {
    borderColor: data.imageAppearance.borderColor,
    borderStyle: data.imageAppearance.borderStyle,
    borderWidth: data.imageAppearance.borderWidth,
    boxShadow: data.imageAppearance.shadow ? "0 12px 30px rgba(15, 35, 76, .22)" : "none"
  };
  const selectedZone = selectedZoneId ? data.zones.find((zone) => zone.id === selectedZoneId) ?? null : null;
  const reviewMarkers = reviewMode === "expected"
    ? data.zones.map((zone) => {
        const found = markers.find((marker) => marker.status === "ok" && marker.zoneId === zone.id);
        return { id: `expected-${zone.id}`, zoneId: zone.id, status: "expected" as const, ...(found ? { x: found.x, y: found.y } : zoneCenter(zone)) };
      })
    : [
        ...markers,
        ...evaluation.missedZoneIds.map((zoneId) => {
          const zone = data.zones.find((candidate) => candidate.id === zoneId)!;
          return { id: `miss-${zoneId}`, zoneId, status: "miss" as const, ...zoneCenter(zone) };
        })
      ];
  const selectedMarker = selectedMarkerId
    ? (phase === "review" ? reviewMarkers : markers).find((marker) => marker.id === selectedMarkerId) ?? null
    : null;
  const detailAnchor = selectedMarker ?? (selectedZone ? zoneCenter(selectedZone) : null);
  const detailAnchorX = detailAnchor?.x ?? null;
  const detailAnchorY = detailAnchor?.y ?? null;
  const selectedZoneHasDescription = hasRichContent(selectedZone?.descriptionHtml);
  const selectedZoneHasRisk = hasRichContent(selectedZone?.riskHtml);
  const selectedZoneHasCorrection = hasRichContent(selectedZone?.correctionHtml);

  useLayoutEffect(() => {
    if (!selectedZoneId || detailAnchorX === null || detailAnchorY === null || !stageRef.current || !detailPanelRef.current) {
      setDetailPanelPosition(null);
      return;
    }
    const stage = stageRef.current;
    const panel = detailPanelRef.current;
    const updatePosition = () => {
      const stageRect = stage.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const anchorX = (detailAnchorX / 100) * stageRect.width;
      const anchorY = (detailAnchorY / 100) * stageRect.height;
      const gutter = 14;
      const offset = 20;
      const preferRight = stageRect.width - anchorX - offset >= panelWidth || stageRect.width - anchorX >= anchorX;
      const preferBelow = stageRect.height - anchorY - offset >= panelHeight || stageRect.height - anchorY >= anchorY;
      const unclampedLeft = preferRight ? anchorX + offset : anchorX - offset - panelWidth;
      const unclampedTop = preferBelow ? anchorY + offset : anchorY - offset - panelHeight;
      setDetailPanelPosition({
        left: Math.max(gutter, Math.min(unclampedLeft, Math.max(gutter, stageRect.width - panelWidth - gutter))),
        top: Math.max(gutter, Math.min(unclampedTop, Math.max(gutter, stageRect.height - panelHeight - gutter)))
      });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(stage);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [detailAnchorX, detailAnchorY, selectedZoneId]);

  const renderRich = (html: string, className?: string) => renderRichContent ? renderRichContent(html, className) : htmlNode(html, className);

  function start() {
    setPhase("playing");
    setSelectedZoneId(null);
    setFeedbackInfo(null);
  }

  function restart() {
    setAttempt(1);
    setMarkers([]);
    setReviewMode("expected");
    setSelectedMarkerId(null);
    setSelectedZoneId(null);
    setFeedbackInfo(null);
    setPhase("intro");
  }

  function updateMarkerPosition(markerId: string, event: { clientX: number; clientY: number }) {
    const stage = stageRef.current;
    if (!stage) return;
    const point = relativePoint(event, stage);
    setMarkers((current) => current.map((marker) => marker.id === markerId ? { ...marker, ...point } : marker));
  }

  function validate() {
    const nextEvaluation = evaluateFindElements(data, markers);
    if (nextEvaluation.score >= data.successThreshold || attempt >= data.maxAttempts) {
      const initialZone = data.zones.find((zone) => nextEvaluation.foundZoneIds.includes(zone.id)) ?? data.zones[0] ?? null;
      setMarkers(nextEvaluation.markers);
      setReviewMode("expected");
      setSelectedMarkerId(initialZone ? `expected-${initialZone.id}` : null);
      setSelectedZoneId(initialZone?.id ?? null);
      setFeedbackInfo(null);
      setPhase("review");
      return;
    }
    setMarkers((current) => current.map((marker) => ({ ...marker, status: "pending", zoneId: undefined })));
    const remaining = data.maxAttempts - attempt;
    setAttempt((current) => current + 1);
    setFeedbackInfo({ score: nextEvaluation.score, remaining });
  }

  function complete() {
    if (authoringMode) {
      restart();
      return;
    }
    setSelectedMarkerId(null);
    setSelectedZoneId(null);
    setPhase("completed");
    onComplete?.();
  }

  return (
    <section className={styles.activity}>
      {phase === "intro" ? (
        <div className={`${styles.stageShell} ${styles.introStage} ${!imageSrc ? styles.emptyStage : ""} ${data.imageAppearance.rounded ? "" : styles.stageSquare}`} style={imageFrameStyle}>
          {imageSrc ? <img alt={imageAlt || ""} className={styles.stageImage} draggable={false} onDragStart={(event) => event.preventDefault()} src={imageSrc} /> : <div className={styles.stagePlaceholder}>{t("findElements.addImageToConfigure", undefined, "Ajoutez une image pour configurer cette activité.")}</div>}
          <div className={styles.introShade} />
          <div className={styles.intro}>
            <h3>{introTitle}</h3>
            <div className={styles.introContent}>
              <p className={styles.instruction}>{introInstruction}</p>
            </div>
            <div className={styles.introFooter}>
              <span>{t("findElements.attemptCount", { attempt: 1, max: data.maxAttempts, count: data.zones.length }, "Essai {attempt}/{max} · Éléments à trouver : {count}")}</span>
              <button className={styles.primaryButton} disabled={!imageSrc} onClick={start} type="button">{t("common.start", undefined, "Commencer")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {phase !== "intro" ? (
        <>
          <div
            className={`${styles.stageShell}${phase === "playing" ? ` ${styles.playing}` : ""}${data.imageAppearance.rounded ? "" : ` ${styles.stageSquare}`}`}
            onClick={(event) => {
              if (phase !== "playing" || draggedMarkerId || (event.target as HTMLElement).closest("button")) return;
              const point = relativePoint(event, event.currentTarget);
              setMarkers((current) => [...current, { id: crypto.randomUUID?.() ?? `marker-${Date.now()}`, ...point, status: "pending" }]);
            }}
            onPointerMove={(event) => {
              if (phase === "playing" && draggedMarkerId) updateMarkerPosition(draggedMarkerId, event);
            }}
            onPointerUp={() => setDraggedMarkerId(null)}
            onPointerCancel={() => setDraggedMarkerId(null)}
            ref={stageRef}
            style={imageFrameStyle}
          >
            {imageSrc ? <img alt={imageAlt || ""} className={styles.stageImage} draggable={false} onDragStart={(event) => event.preventDefault()} src={imageSrc} /> : <div className={styles.stagePlaceholder}>{t("findElements.addImageToConfigure", undefined, "Ajoutez une image pour configurer cette activité.")}</div>}
            {(phase === "review" ? reviewMarkers : markers).map((marker) => {
              const zone = marker.zoneId ? data.zones.find((candidate) => candidate.id === marker.zoneId) : null;
              const markerClass = marker.status === "ok" ? styles.markerOk
                : marker.status === "bad" ? styles.markerBad
                  : marker.status === "miss" ? styles.markerMiss
                    : marker.status === "expected" && zone ? severityClass(zone) : "";
              return (
                <button
                  aria-label={zone?.title || (marker.status === "bad" ? t("findElements.incorrectSelection", undefined, "Réponse incorrecte") : t("findElements.marker", undefined, "Marqueur"))}
                  className={`${marker.status === "expected" ? styles.expectedMarker : styles.marker} ${markerClass} ${selectedMarkerId === marker.id ? styles.markerSelected : ""}`}
                  key={marker.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedMarkerId(marker.id);
                    setSelectedZoneId(marker.zoneId ?? null);
                  }}
                  onContextMenu={(event) => {
                    if (phase !== "playing") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setMarkers((current) => current.filter((candidate) => candidate.id !== marker.id));
                    setSelectedMarkerId((current) => current === marker.id ? null : current);
                    setSelectedZoneId((current) => current === marker.zoneId ? null : current);
                  }}
                  onPointerDown={(event) => {
                    if (phase !== "playing") return;
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setSelectedMarkerId(marker.id);
                    setDraggedMarkerId(marker.id);
                  }}
                  style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  type="button"
                />
              );
            })}
            {selectedZone ? (
              <aside
                className={styles.detailPanel}
                ref={detailPanelRef}
                style={detailPanelPosition ? { left: `${detailPanelPosition.left}px`, top: `${detailPanelPosition.top}px` } : { visibility: "hidden" }}
              >
                <button aria-label={t("common.close", undefined, "Fermer")} className={styles.detailClose} onClick={() => setSelectedZoneId(null)} type="button">×</button>
                {selectedZone.severity !== "sans" ? <span className={`${styles.severityBadge} ${severityClass(selectedZone)}`}>{t("findElements.severity", undefined, "Gravité")} : {t(`findElements.severity.${selectedZone.severity === "faible" ? "low" : selectedZone.severity === "moyen" ? "medium" : selectedZone.severity === "important" ? "high" : "critical"}`, undefined, selectedZone.severity)}</span> : null}
                <h4>{selectedZone.title}</h4>
                {selectedZoneHasDescription ? <><strong>{data.labels.description}</strong>{renderRich(selectedZone.descriptionHtml, "rich-content")}</> : null}
                {selectedZoneHasRisk ? <><strong>{data.labels.risk}</strong>{renderRich(selectedZone.riskHtml, "rich-content")}</> : null}
                {selectedZoneHasCorrection ? <><strong>{data.labels.correction}</strong>{renderRich(selectedZone.correctionHtml, "rich-content")}</> : null}
              </aside>
            ) : null}
            {feedbackInfo ? (
              <aside className={styles.feedbackInfo}>
                <div className={styles.feedbackInfoText}>
                  {t("findElements.provisionalScore", { score: feedbackInfo.score, remaining: feedbackInfo.remaining }, "Résultat : {score} % — Essais restants : {remaining}")}
                </div>
                <button className={styles.primaryButton} onClick={() => setFeedbackInfo(null)} type="button">{t("common.continue", undefined, "Continuer")}</button>
              </aside>
            ) : null}
            {phase === "completed" ? (
              <aside className={`${styles.completion} ${styles.completionOverlay}`}>
                <h3>{t("findElements.completed", undefined, "Activité terminée")}</h3>
                <p>{t("findElements.completedHelp", undefined, "Cette activité est terminée. Vous pouvez poursuivre votre parcours.")}</p>
                <div className={styles.completionActions}>
                  <button className={styles.secondaryButton} onClick={restart} type="button">{t("findElements.restart", undefined, "Recommencer l’activité")}</button>
                </div>
              </aside>
            ) : null}
          </div>
          {phase === "review" ? (
            <aside className={`${styles.feedback} ${styles.reviewPanel}`}>
              <h3>{t("findElements.result", undefined, "Résultat")}</h3>
              <div className={styles.summary}>
                <span className={styles.summaryItem}>{t("findElements.score", { score: evaluation.score }, "Résultat : {score} %")}</span>
                <span className={styles.summaryItem}>{t("findElements.found", { found: evaluation.foundZoneIds.length, total: data.zones.length }, "Éléments trouvés : {found}/{total}")}</span>
                <span className={styles.summaryItem}>{t("findElements.falseSelections", { count: evaluation.markers.filter((marker) => marker.status === "bad").length }, "Réponses incorrectes : {count}")}</span>
                <span className={styles.summaryItem}>{t("findElements.notFound", { count: evaluation.missedZoneIds.length }, "Éléments non trouvés : {count}")}</span>
              </div>
              <p className={styles.reviewInstruction}>
                {hasSeverity
                  ? t("findElements.reviewHelpWithSeverity", undefined, "Consultez la correction.\nLes couleurs indiquent le niveau de gravité.\nCliquez sur les points pour afficher les détails.\nComparez ensuite avec vos réponses.")
                  : t("findElements.reviewHelp", undefined, "Consultez la correction.\nCliquez sur les points pour afficher les détails.\nComparez ensuite avec vos réponses.")}
              </p>
              <div className={styles.reviewActions}>
                <button className={reviewMode === "expected" ? styles.primaryButton : styles.secondaryButton} onClick={() => setReviewMode("expected")} type="button">{t("findElements.viewExpected", undefined, "Voir la correction")}</button>
                <button className={reviewMode === "compare" ? styles.primaryButton : styles.secondaryButton} onClick={() => setReviewMode("compare")} type="button">{t("findElements.compareAnswers", undefined, "Comparer avec mes réponses")}</button>
                <button className={styles.secondaryButton} onClick={complete} type="button">{t("findElements.finishReview", undefined, "Terminer")}</button>
              </div>
            </aside>
          ) : null}
          {phase === "playing" ? (
            <div className={`${styles.reviewActions} ${styles.playingActions}`}>
              <span className={styles.summaryItem}>{t("findElements.attempt", { attempt, max: data.maxAttempts }, "Essai {attempt} / {max}")}</span>
              <button className={styles.primaryButton} disabled={!imageSrc} onClick={validate} type="button">{t("findElements.validateAttempt", undefined, "Valider")}</button>
            </div>
          ) : null}
        </>
      ) : null}

    </section>
  );
}
