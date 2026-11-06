import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SelectionRadio } from "../../SelectionRadio";
import type { ActivityItem, SituationalDialogueCharacter, SituationalDialogueResponse } from "../../../types/project";
import type { SituationalDialogueActivityProps } from "./types";
import { useI18n } from "../../../i18n/react";
import "./SituationalDialogueActivity.css";
import styles from "./SituationalDialogueActivity.module.css";

type SituationalDialogueLayoutStyle = CSSProperties & {
  "--situational-dialogue-stable-min-height"?: string;
  "--situational-dialogue-bleed-left"?: string;
  "--situational-dialogue-bleed-width"?: string;
};

function hasNodeContent(node: ActivityItem | null | undefined) {
  return Boolean((node?.contentHtml ?? "").replace(/<[^>]*>/g, "").trim());
}

function isPlaceholderCharacterName(value?: string | null) {
  return /^personnage\s+\d+$/i.test((value ?? "").trim());
}

function findSituationalDialogueCharacter(characters: SituationalDialogueCharacter[], item: ActivityItem | null | undefined) {
  if (!characters.length) {
    return null;
  }
  const byId = item?.characterId ? characters.find((character) => character.id === item.characterId) : null;
  if (byId) {
    return byId;
  }
  const itemName = item?.characterName?.trim().toLowerCase();
  if (itemName) {
    const byName = characters.find((character) => character.name.trim().toLowerCase() === itemName);
    if (byName) {
      return byName;
    }
  }
  return characters[0] ?? null;
}

export function SituationalDialogueActivity({
  authoringMode = false,
  displayTitle,
  displaySummary,
  items,
  activeNode,
  activeNodeIndex,
  responses,
  pendingResponse,
  selectedResponse,
  characterImage,
  situationalDialogueCharacters,
  hasCustomBackground,
  hasBackgroundImage,
  backgroundPositionY = 50,
  rounded,
  wide,
  style,
  normalizeHtml,
  onActiveNodeChange,
  onPendingResponseChange,
  onSelectedResponseChange,
  onComplete,
  onBackgroundPositionChange
}: SituationalDialogueActivityProps) {
  const { t } = useI18n();
  const blockRef = useRef<HTMLDivElement | null>(null);
  const measurementRef = useRef<HTMLDivElement | null>(null);
  const normalizedBackgroundPosition = Number.isFinite(backgroundPositionY)
    ? Math.min(100, Math.max(0, Number(backgroundPositionY)))
    : 50;
  const [backgroundPositioning, setBackgroundPositioning] = useState(false);
  const [backgroundPosition, setBackgroundPosition] = useState(normalizedBackgroundPosition);
  const backgroundPositionRef = useRef(normalizedBackgroundPosition);
  const backgroundDragRef = useRef<{ pointerId: number; startY: number; startPosition: number; height: number } | null>(null);
  const [stableStageHeight, setStableStageHeight] = useState(0);
  const canPositionBackground = authoringMode && hasBackgroundImage && Boolean(onBackgroundPositionChange);
  const blockClassName = [
    styles.block,
    hasCustomBackground ? styles.hasCustomBackground : "",
    hasBackgroundImage ? styles.hasBackgroundImage : "",
    rounded ? "" : styles.square,
    wide ? styles.wide : ""
  ]
    .filter(Boolean)
    .join(" ");
  const stageClassName = [
    styles.stage,
    characterImage ? styles.hasCharacter : styles.noCharacter
  ]
    .filter(Boolean)
    .join(" ");
  const SituationalDialogueStyle = {
    ...style,
    "--situational-dialogue-bg-position-y": `${backgroundPosition}%`,
    ...(stableStageHeight > 0
      ? { "--situational-dialogue-stable-min-height": `${stableStageHeight}px` }
      : {})
  } as SituationalDialogueLayoutStyle;

  useEffect(() => {
    if (!backgroundPositioning) {
      backgroundPositionRef.current = normalizedBackgroundPosition;
      setBackgroundPosition(normalizedBackgroundPosition);
    }
  }, [backgroundPositioning, normalizedBackgroundPosition]);

  useEffect(() => {
    if (!backgroundPositioning) {
      return;
    }

    function stopBackgroundPositioning(event: PointerEvent) {
      if (event.target instanceof Node && blockRef.current?.contains(event.target)) {
        return;
      }
      backgroundDragRef.current = null;
      setBackgroundPositioning(false);
    }

    document.addEventListener("pointerdown", stopBackgroundPositioning);
    return () => document.removeEventListener("pointerdown", stopBackgroundPositioning);
  }, [backgroundPositioning]);

  const updateBackgroundPosition = (next: number, commit = true) => {
    const clamped = Math.round(Math.min(100, Math.max(0, next)));
    backgroundPositionRef.current = clamped;
    setBackgroundPosition(clamped);
    if (commit) {
      onBackgroundPositionChange?.(clamped);
    }
  };

  useLayoutEffect(() => {
    const root = blockRef.current;
    if (!wide || !root) {
      root?.style.removeProperty("--situational-dialogue-bleed-left");
      root?.style.removeProperty("--situational-dialogue-bleed-width");
      return;
    }

    const measureBleed = () => {
      const rect = root.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      root.style.setProperty("--situational-dialogue-bleed-left", `${Math.round(-rect.left)}px`);
      root.style.setProperty("--situational-dialogue-bleed-width", `${Math.ceil(viewportWidth)}px`);
    };

    measureBleed();
    window.addEventListener("resize", measureBleed);
    window.visualViewport?.addEventListener("resize", measureBleed);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureBleed) : null;
    observer?.observe(root);
    return () => {
      window.removeEventListener("resize", measureBleed);
      window.visualViewport?.removeEventListener("resize", measureBleed);
      observer?.disconnect();
      root.style.removeProperty("--situational-dialogue-bleed-left");
      root.style.removeProperty("--situational-dialogue-bleed-width");
    };
  }, [wide]);

  useLayoutEffect(() => {
    const measure = () => {
      const root = measurementRef.current;
      if (!root) {
        return;
      }
      const heights = Array.from(root.querySelectorAll<HTMLElement>("[data-situational-dialogue-measure-stage]"))
        .map((node) => Math.ceil(node.getBoundingClientRect().height))
        .filter((height) => height > 0);
      const nextHeight = Math.max(0, ...heights);
      if (!nextHeight) {
        return;
      }
      setStableStageHeight((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
    };

    measure();
    if (typeof ResizeObserver === "undefined" || !measurementRef.current) {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    measurementRef.current
      .querySelectorAll<HTMLElement>("[data-situational-dialogue-measure-stage]")
      .forEach((node) => observer.observe(node));
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [characterImage, displaySummary, displayTitle, items, normalizeHtml, situationalDialogueCharacters]);

  const goToNextNode = (response?: SituationalDialogueResponse | null) => {
    const explicitTarget = response?.nextNodeId
      ? items.find((item) => item.id === response.nextNodeId)
      : null;
    const nextNode = explicitTarget ?? items[activeNodeIndex + 1] ?? null;
    if (nextNode) {
      onActiveNodeChange(nextNode.id);
      onSelectedResponseChange("");
      onPendingResponseChange("");
      return;
    }
    onComplete?.();
  };

  const restart = () => {
    const firstNode =
      items.find((item) => item.nodeType === "introduction") ??
      items.find((item) => item.nodeType !== "conclusion") ??
      items[0] ??
      null;
    if (!firstNode) {
      return;
    }
    onActiveNodeChange(firstNode.id);
    onSelectedResponseChange("");
    onPendingResponseChange("");
  };

  const activeCharacter = findSituationalDialogueCharacter(situationalDialogueCharacters, activeNode);
  const nodeCharacterLabel = (activeNode?.characterName ?? "").trim();
  const characterLabel =
    nodeCharacterLabel && !isPlaceholderCharacterName(nodeCharacterLabel)
      ? nodeCharacterLabel
      : activeCharacter?.name && !isPlaceholderCharacterName(activeCharacter.name)
        ? activeCharacter.name.trim()
        : "";
  const characterRole = activeNode?.characterRole?.trim() || activeCharacter?.role?.trim() || "";
  const characterAltText = activeCharacter?.description?.trim() ?? "";
  const showCharacterCaption = activeCharacter?.showNameRole ?? true;
  const hasCharacterCaption = showCharacterCaption && Boolean(characterLabel || characterRole);

  const renderCharacter = () =>
    characterImage ? (
      <figure className={styles.character}>
        <span aria-hidden="true" className={styles.characterBackdrop} />
        <img alt={characterAltText} src={characterImage} />
        {hasCharacterCaption ? (
          <figcaption>
            {characterLabel ? <strong>{characterLabel}</strong> : null}
            {characterRole ? <span>{characterRole}</span> : null}
          </figcaption>
        ) : null}
      </figure>
    ) : null;

  const renderDecision = (
    node: ActivityItem,
    nodeResponses: SituationalDialogueResponse[],
    responseState: SituationalDialogueResponse | null
  ) => {
    if (node.nodeType === "introduction") {
      return (
        <div className={`${styles.actions} ${styles.feedbackActions} ${styles.startActions}`}>
          <button className="primary-pill" onClick={() => goToNextNode()} type="button">
            {t("common.start")}
          </button>
        </div>
      );
    }

    if (node.nodeType === "conclusion") {
      return (
        <div className={`${styles.actions} ${styles.feedbackActions} ${styles.startActions}`}>
          <button className="primary-pill" onClick={restart} type="button">
            {t("common.restart", undefined, "Recommencer")}
          </button>
        </div>
      );
    }

    if (responseState) {
      return (
        <div className={styles.feedback} data-response-action={responseState.action ?? "continue"}>
          <div className={styles.feedbackHead}>
            <span className={styles.feedbackBadge}>
              {responseState.action === "tryAgain" ? t("situationalDialogue.toCorrect", undefined, "À corriger") : t("situationalDialogue.toRemember", undefined, "À retenir")}
            </span>
          </div>
          <p className={styles.feedbackSummary}>
            {responseState.action === "tryAgain" ? "" : ""}
          </p>
          <div
            className="rich-content"
            dangerouslySetInnerHTML={{
              __html: normalizeHtml(responseState.feedbackHtml || "<p></p>")
            }}
          />
          <div className={`${styles.actions} ${styles.feedbackActions}`}>
            {responseState.action === "tryAgain" ? (
              <button
                className="ghost-pill"
                onClick={() => {
                  onSelectedResponseChange("");
                  onPendingResponseChange("");
                }}
                type="button"
              >
                {t("situationalDialogue.tryAgain", undefined, "Essayer encore")}
              </button>
            ) : (
              <button className="primary-pill" onClick={() => goToNextNode(responseState)} type="button">
                {t("common.continue", undefined, "Continuer")}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (nodeResponses.length) {
      return (
        <div className={styles.choiceGroup}>
          <div className={styles.choiceList}>
            {nodeResponses.map((response) => {
              const isPending = pendingResponse?.id === response.id;
              return (
                <div className={`${styles.choice} ${isPending ? styles.selected : ""}`} key={response.id}>
                  <button
                    aria-pressed={isPending}
                    className={styles.choiceRadio}
                    onClick={() => onPendingResponseChange(response.id)}
                    type="button"
                  >
                    <SelectionRadio selected={isPending} />
                  </button>
                  <button
                    className={styles.choiceLabel}
                    onClick={() => onPendingResponseChange(response.id)}
                    type="button"
                  >
                    <span dangerouslySetInnerHTML={{ __html: normalizeHtml(response.label || "") }} />
                  </button>
                  <span
                    aria-hidden="true"
                    className={styles.choiceValidate}
                    onClick={() => {
                      if (isPending) {
                        onSelectedResponseChange(response.id);
                      }
                    }}
                  >
                    ✓
                  </span>
                </div>
              );
            })}
          </div>
          <div className={styles.choiceActions}>
            <button
              className="primary-pill"
              disabled={!pendingResponse}
              onClick={() => {
                if (pendingResponse) {
                  onSelectedResponseChange(pendingResponse.id);
                }
              }}
              type="button"
            >
              {t("common.validate", undefined, "Valider")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.actions}>
        <button className="primary-pill" onClick={() => goToNextNode(null)} type="button">
          {t("common.continue", undefined, "Continuer")}
        </button>
      </div>
    );
  };

  const renderStage = (
    node: ActivityItem,
    nodeResponses: SituationalDialogueResponse[],
    responseState: SituationalDialogueResponse | null,
    measure = false
  ) => {
    const shouldShowContentCard =
      node.nodeType === "introduction" || node.nodeType === "conclusion"
        ? hasNodeContent(node)
        : true;
    const rightClassName = [
      styles.right,
      shouldShowContentCard ? "" : styles.noCardGap
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <article className={stageClassName} data-situational-dialogue-measure-stage={measure ? "true" : undefined}>
        {renderCharacter()}
        <div className={rightClassName}>
          {shouldShowContentCard ? (
          <div className={styles.card}>
            <div
              className={`rich-content ${styles.content}`}
              dangerouslySetInnerHTML={{
                __html: normalizeHtml(node.contentHtml || "<p></p>")
              }}
            />
          </div>
          ) : null}
          <div className={styles.decision}>{renderDecision(node, nodeResponses, responseState)}</div>
        </div>
      </article>
    );
  };

  const measurementStates = items.flatMap((item) => {
    const itemResponses = item.responses ?? [];
    return [
      { item, response: null },
      ...itemResponses.map((response) => ({ item, response }))
    ];
  });

  return (
    <div
      className={`${blockClassName}${backgroundPositioning ? ` ${styles.backgroundPositioningRoot}` : ""}`}
      onDoubleClick={canPositionBackground ? (event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, label, textarea, select, summary, [contenteditable='true'], [role='button'], [role='radio']")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (backgroundPositioning) {
          backgroundDragRef.current = null;
        }
        setBackgroundPositioning((current) => !current);
      } : undefined}
      onPointerDown={backgroundPositioning ? (event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, label, textarea, select, summary, [contenteditable='true'], [role='button'], [role='radio']")) {
          backgroundDragRef.current = null;
          setBackgroundPositioning(false);
          return;
        }
        const height = Math.max(1, event.currentTarget.getBoundingClientRect().height);
        event.currentTarget.setPointerCapture(event.pointerId);
        backgroundDragRef.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startPosition: backgroundPosition,
          height
        };
        event.stopPropagation();
      } : undefined}
      onPointerMove={backgroundPositioning ? (event) => {
        const drag = backgroundDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        updateBackgroundPosition(
          drag.startPosition - ((event.clientY - drag.startY) / drag.height) * 100,
          false
        );
      } : undefined}
      onPointerUp={backgroundPositioning ? (event) => {
        if (backgroundDragRef.current?.pointerId !== event.pointerId) return;
        backgroundDragRef.current = null;
        onBackgroundPositionChange?.(backgroundPositionRef.current);
      } : undefined}
      onPointerCancel={backgroundPositioning ? () => {
        backgroundDragRef.current = null;
      } : undefined}
      ref={blockRef}
      style={SituationalDialogueStyle}
    >
      <span aria-hidden="true" className={styles.backgroundLayer} />
      {displayTitle ? <h3 className="export-block-title">{displayTitle}</h3> : null}
      {displaySummary ? <p className="export-block-copy">{displaySummary}</p> : null}
      {activeNode ? renderStage(activeNode, responses, selectedResponse) : (
        <p className="export-block-copy">{t("situationalDialogue.emptyEditor", undefined, "Ajoutez une situation dans l’éditeur.")}</p>
      )}
      <div aria-hidden="true" className={styles.measurement} ref={measurementRef}>
        {measurementStates.map(({ item, response }, index) => (
          <div key={`${item.id}-${response?.id ?? "default"}-${index}`}>
            {renderStage(item, item.responses ?? [], response, true)}
          </div>
        ))}
      </div>
    </div>
  );
}
