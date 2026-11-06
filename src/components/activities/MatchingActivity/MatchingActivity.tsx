import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "../../../i18n/react";
import type { MatchingPair } from "../../../types/project";
import { evaluateMatching, type MatchingEvaluation } from "./matchingEvaluation";
import type { MatchingActivityProps } from "./matchingTypes";
import styles from "./MatchingActivity.module.css";

type Side = "left" | "right";
type PieceSelection = { id: string; side: Side };
type MatchingCSSProperties = CSSProperties & Record<`--${string}`, string | number>;
type DragState = PieceSelection & {
  backgroundColor: string;
  html: string;
  height: number;
  left: number;
  moved: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  top: number;
  width: number;
  x: number;
  y: number;
};

const AUTO_VALIDATE_DELAY_MS = 320;
const DRAG_THRESHOLD_PX = 5;
const CONNECTOR_SNAP_DISTANCE_PX = 58;
const CONNECTOR_DEPTH_PX = 32;
const CONNECTOR_HALF_HEIGHT_PX = 25;
const CONNECTOR_TIP_HALF_HEIGHT_PX = 10;
const CONNECTOR_FILLET_PX = 4;
const MATCHING_TEXT_FIT_SCALES = [1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72] as const;
const MATCHING_MAX_TEXT_LINES = 3;

function shuffle<T>(values: T[]) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function createAttemptOrders(pairs: MatchingPair[]) {
  const leftIds = pairs.map((pair) => pair.leftId);
  const rightIds = pairs.map((pair) => pair.rightId);
  const expectedRightByLeft = new Map(pairs.map((pair) => [pair.leftId, pair.rightId]));

  if (pairs.length < 2) return { leftOrder: leftIds, rightOrder: rightIds };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const leftOrder = shuffle(leftIds);
    const rightOrder = shuffle(rightIds);
    const hasAccidentalMatch = leftOrder.some((leftId, index) => expectedRightByLeft.get(leftId) === rightOrder[index]);
    if (!hasAccidentalMatch) return { leftOrder, rightOrder };
  }

  const leftOrder = shuffle(leftIds);
  const rightOrder = leftOrder.map((leftId, index) => {
    const expected = expectedRightByLeft.get(leftId)!;
    const candidatePair = pairs.find((pair) => pair.rightId === expected)!;
    const candidateIndex = pairs.indexOf(candidatePair);
    return rightIds[(candidateIndex + 1 + index) % rightIds.length];
  });

  if (leftOrder.some((leftId, index) => expectedRightByLeft.get(leftId) === rightOrder[index])) {
    return {
      leftOrder,
      rightOrder: leftOrder.map((leftId) => {
        const expectedIndex = rightIds.indexOf(expectedRightByLeft.get(leftId)!);
        return rightIds[(expectedIndex + 1) % rightIds.length];
      })
    };
  }

  return { leftOrder, rightOrder };
}

function swapIntoRow(order: string[], id: string, rowIndex: number) {
  const sourceIndex = order.indexOf(id);
  if (sourceIndex < 0 || sourceIndex === rowIndex) return order;
  const next = [...order];
  [next[sourceIndex], next[rowIndex]] = [next[rowIndex], next[sourceIndex]];
  return next;
}

function plainText(html: string) {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g, " ").trim() || "";
}

type Point = { x: number; y: number };

function pointToward(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ratio = Math.min(1, distance / length);
  return { x: from.x + dx * ratio, y: from.y + dy * ratio };
}

function roundedPolygonPath(points: Point[], radii: number[]) {
  const corners = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const radius = Math.max(0, radii[index] ?? 0);
    return {
      point,
      radius,
      incoming: pointToward(point, previous, radius),
      outgoing: pointToward(point, next, radius)
    };
  });

  const commands: string[] = [`M ${corners[0].incoming.x} ${corners[0].incoming.y}`];
  corners.forEach((corner, index) => {
    if (corner.radius > 0) {
      commands.push(`Q ${corner.point.x} ${corner.point.y} ${corner.outgoing.x} ${corner.outgoing.y}`);
    } else {
      commands.push(`L ${corner.point.x} ${corner.point.y}`);
    }
    const nextCorner = corners[(index + 1) % corners.length];
    commands.push(`L ${nextCorner.incoming.x} ${nextCorner.incoming.y}`);
  });
  commands.push("Z");
  return commands.join(" ");
}

function buildPiecePath(side: Side, width: number, height: number, rounded: boolean) {
  const outerRadius = rounded ? 14 : 0;
  const centerY = height / 2;
  const joinTop = centerY - CONNECTOR_HALF_HEIGHT_PX;
  const joinBottom = centerY + CONNECTOR_HALF_HEIGHT_PX;
  const tipTop = centerY - CONNECTOR_TIP_HALF_HEIGHT_PX;
  const tipBottom = centerY + CONNECTOR_TIP_HALF_HEIGHT_PX;

  if (side === "left") {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: joinTop },
      { x: width + CONNECTOR_DEPTH_PX, y: tipTop },
      { x: width + CONNECTOR_DEPTH_PX, y: tipBottom },
      { x: width, y: joinBottom },
      { x: width, y: height },
      { x: 0, y: height }
    ];
    return roundedPolygonPath(points, [
      outerRadius,
      0,
      CONNECTOR_FILLET_PX,
      CONNECTOR_FILLET_PX,
      CONNECTOR_FILLET_PX,
      CONNECTOR_FILLET_PX,
      0,
      outerRadius
    ]);
  }

  const points: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
    { x: 0, y: joinBottom },
    { x: CONNECTOR_DEPTH_PX, y: tipBottom },
    { x: CONNECTOR_DEPTH_PX, y: tipTop },
    { x: 0, y: joinTop }
  ];
  return roundedPolygonPath(points, [
    0,
    outerRadius,
    outerRadius,
    0,
    CONNECTOR_FILLET_PX,
    CONNECTOR_FILLET_PX,
    CONNECTOR_FILLET_PX,
    CONNECTOR_FILLET_PX
  ]);
}

function PieceShape({ height, rounded, side, width }: { height: number; rounded: boolean; side: Side; width: number }) {
  const svgWidth = side === "left" ? width + CONNECTOR_DEPTH_PX : width;
  const path = buildPiecePath(side, width, height, rounded);
  return <svg
    aria-hidden="true"
    className={styles.pieceShape}
    focusable="false"
    shapeRendering="geometricPrecision"
    style={{ height, width: svgWidth }}
    viewBox={`0 0 ${svgWidth} ${height}`}
  >
    <path className={styles.pieceShapeFill} d={path} />
    <path className={styles.pieceShapeStroke} d={path} />
  </svg>;
}

function targetForDrag(root: HTMLElement | null, drag: DragState, clientX: number, clientY: number): PieceSelection | null {
  if (!root || typeof document === "undefined") return null;

  const direct = document.elementFromPoint(clientX, clientY)?.closest("[data-matching-piece-id]") as HTMLElement | null;
  const directId = direct?.dataset.matchingPieceId;
  const directSide = direct?.dataset.matchingPieceSide as Side | undefined;
  if (directId && directSide && directSide !== drag.side && root.contains(direct)) {
    return { id: directId, side: directSide };
  }

  const deltaX = clientX - drag.startX;
  const deltaY = clientY - drag.startY;
  const ghostLeft = drag.left + deltaX;
  const ghostTop = drag.top + deltaY;
  const sourceConnectorX = drag.side === "left"
    ? ghostLeft + drag.width
    : ghostLeft;
  const sourceConnectorY = ghostTop + drag.height / 2;
  const oppositeSide: Side = drag.side === "left" ? "right" : "left";

  let best: { selection: PieceSelection; distance: number } | null = null;
  for (const candidate of root.querySelectorAll<HTMLElement>(`[data-matching-piece-side="${oppositeSide}"]`)) {
    const candidateId = candidate.dataset.matchingPieceId;
    if (!candidateId) continue;
    const rect = candidate.getBoundingClientRect();
    const targetConnectorX = oppositeSide === "right"
      ? rect.left
      : rect.right;
    const targetConnectorY = rect.top + rect.height / 2;
    const distance = Math.hypot(sourceConnectorX - targetConnectorX, sourceConnectorY - targetConnectorY);
    if (distance <= CONNECTOR_SNAP_DISTANCE_PX && (!best || distance < best.distance)) {
      best = { selection: { id: candidateId, side: oppositeSide }, distance };
    }
  }

  return best?.selection ?? null;
}

function matchingFontTargets(content: HTMLElement) {
  const targets = [content, ...Array.from(content.querySelectorAll<HTMLElement>("*"))];
  targets.forEach((target) => {
    if (target.dataset.matchingOriginalFontSize === undefined) {
      target.dataset.matchingOriginalFontSize = target.style.fontSize || "__empty__";
    }
  });
  return targets;
}

function restoreMatchingAuthorFontSizes(targets: HTMLElement[]) {
  targets.forEach((target) => {
    const original = target.dataset.matchingOriginalFontSize;
    if (original === undefined) return;
    if (original === "__empty__") target.style.removeProperty("font-size");
    else target.style.fontSize = original;
  });
}

function matchingRenderedLineCount(content: HTMLElement) {
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const lineTops: number[] = [];
  let node = walker.nextNode();

  while (node) {
    if (node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      Array.from(range.getClientRects()).forEach((rect) => {
        if (rect.width <= 0.5 || rect.height <= 0.5) return;
        if (!lineTops.some((top) => Math.abs(top - rect.top) < 2)) lineTops.push(rect.top);
      });
    }
    node = walker.nextNode();
  }

  return lineTops.length;
}

function matchingContentFits(content: HTMLElement) {
  return content.scrollWidth <= content.clientWidth + 1
    && matchingRenderedLineCount(content) <= MATCHING_MAX_TEXT_LINES;
}

function applyMatchingSharedTextFit(pieces: HTMLElement[]) {
  const contents = pieces
    .map((piece) => piece.querySelector<HTMLElement>("[data-matching-piece-content]"))
    .filter((content): content is HTMLElement => Boolean(content));

  const targets = contents.flatMap((content) => matchingFontTargets(content));
  restoreMatchingAuthorFontSizes(targets);

  const baseSizes = targets.map((target) => {
    const size = Number.parseFloat(window.getComputedStyle(target).fontSize);
    return Number.isFinite(size) && size > 0 ? size : 16;
  });

  let chosenScale = MATCHING_TEXT_FIT_SCALES[MATCHING_TEXT_FIT_SCALES.length - 1];

  for (const scale of MATCHING_TEXT_FIT_SCALES) {
    targets.forEach((target, index) => {
      target.style.fontSize = `${baseSizes[index] * scale}px`;
    });
    if (contents.every(matchingContentFits)) {
      chosenScale = scale;
      break;
    }
  }

  targets.forEach((target, index) => {
    target.style.fontSize = `${baseSizes[index] * chosenScale}px`;
  });
}

export function MatchingActivity({ authoringMode = false, data, onComplete }: MatchingActivityProps) {
  const { t } = useI18n();
  const initialOrdersRef = useRef(createAttemptOrders(data.pairs));
  const activityRef = useRef<HTMLElement | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [leftOrder, setLeftOrder] = useState(initialOrdersRef.current.leftOrder);
  const [rightOrder, setRightOrder] = useState(initialOrdersRef.current.rightOrder);
  const [associations, setAssociations] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<PieceSelection | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<PieceSelection | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [commonPieceHeight, setCommonPieceHeight] = useState(80);
  const [commonPieceWidth, setCommonPieceWidth] = useState(390);
  const [isCompleting, setIsCompleting] = useState(false);
  const [result, setResult] = useState<MatchingEvaluation | null>(null);
  const autoValidateTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);

  const pairsByLeft = useMemo(() => new Map(data.pairs.map((pair) => [pair.leftId, pair])), [data.pairs]);
  const pairsByRight = useMemo(() => new Map(data.pairs.map((pair) => [pair.rightId, pair])), [data.pairs]);
  const rowIndexByLeft = useMemo(() => new Map(leftOrder.map((id, index) => [id, index])), [leftOrder]);
  const rowIndexByRight = useMemo(() => new Map(rightOrder.map((id, index) => [id, index])), [rightOrder]);
  const associationByRight = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(associations).forEach(([leftId, rightId]) => map.set(rightId, leftId));
    return map;
  }, [associations]);
  const attemptsUnlimited = data.maxAttempts === 0;
  const showAttemptFeedback = (data as typeof data & { showAttemptFeedback?: boolean }).showAttemptFeedback ?? true;
  const canRetry = Boolean(result && !result.passed && (attemptsUnlimited || attempt < data.maxAttempts));
  const appearance = data.labelAppearance;

  useEffect(() => {
    if (!result) return;
    const frame = window.requestAnimationFrame(() => {
      (canRetry ? retryButtonRef.current : continueButtonRef.current)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [canRetry, result]);

  useEffect(() => () => {
    if (autoValidateTimerRef.current !== null) window.clearTimeout(autoValidateTimerRef.current);
  }, []);

  useEffect(() => {
    const root = activityRef.current;
    if (!root) return;

    let frame = 0;
    let observedWidth = root.clientWidth;

    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const pieces = Array.from(root.querySelectorAll<HTMLElement>("[data-matching-piece-id]"));
        applyMatchingSharedTextFit(pieces);

        let nextHeight = 80;
        pieces.forEach((piece) => {
          const content = piece.querySelector<HTMLElement>("[data-matching-piece-content]");
          if (!content) return;
          const computed = window.getComputedStyle(piece);
          const verticalPadding =
            (Number.parseFloat(computed.paddingTop) || 0) +
            (Number.parseFloat(computed.paddingBottom) || 0);
          nextHeight = Math.max(nextHeight, Math.ceil(content.scrollHeight + verticalPadding));
        });

        if (nextHeight % 2 !== 0) nextHeight += 1;
        const nextWidth = pieces[0] ? Math.round(pieces[0].getBoundingClientRect().width) : 390;
        setCommonPieceHeight((current) => current === nextHeight ? current : nextHeight);
        setCommonPieceWidth((current) => current === nextWidth ? current : nextWidth);
      });
    };

    measure();

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          const nextWidth = root.clientWidth;
          if (nextWidth === observedWidth) return;
          observedWidth = nextWidth;
          measure();
        })
      : null;

    observer?.observe(root);
    if (!observer) window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", measure);
    };
  }, [data.pairs, leftOrder, rightOrder]);

  useEffect(() => {
    if (autoValidateTimerRef.current !== null) {
      window.clearTimeout(autoValidateTimerRef.current);
      autoValidateTimerRef.current = null;
    }

    if (drag?.moved || result || Object.keys(associations).length !== data.pairs.length) {
      setIsCompleting(false);
      return;
    }

    setIsCompleting(true);
    autoValidateTimerRef.current = window.setTimeout(() => {
      setResult(evaluateMatching(data.pairs, associations, 100));
      setIsCompleting(false);
      autoValidateTimerRef.current = null;
    }, AUTO_VALIDATE_DELAY_MS);
  }, [associations, data.pairs, drag?.moved, result]);

  const labelStyle = () => ({
    "--matching-bg": appearance.backgroundColor,
    "--matching-border": appearance.borderColor,
    "--matching-border-width": appearance.borderWidth,
    "--matching-border-style": appearance.borderStyle,
    "--matching-radius": appearance.rounded ? "14px" : "2px"
  } as MatchingCSSProperties);

  const getPiece = (selection: PieceSelection) => {
    const pair = selection.side === "left" ? pairsByLeft.get(selection.id) : pairsByRight.get(selection.id);
    if (!pair) return null;
    return selection.side === "left"
      ? { html: pair.leftHtml }
      : { html: pair.rightHtml };
  };

  const connectPieces = (first: PieceSelection, second: PieceSelection) => {
    if (result || isCompleting || first.side === second.side || first.id === second.id) return;

    const leftId = first.side === "left" ? first.id : second.id;
    const rightId = first.side === "right" ? first.id : second.id;
    const targetRow = second.side === "left" ? rowIndexByLeft.get(second.id) : rowIndexByRight.get(second.id);
    if (targetRow === undefined) return;

    if (first.side === "left") setLeftOrder((current) => swapIntoRow(current, leftId, targetRow));
    else setRightOrder((current) => swapIntoRow(current, rightId, targetRow));

    setAssociations((current) => {
      const next = { ...current };
      delete next[leftId];
      const previousLeftForRight = Object.entries(next).find(([, candidateRight]) => candidateRight === rightId)?.[0];
      if (previousLeftForRight) delete next[previousLeftForRight];
      next[leftId] = rightId;
      return next;
    });

    setSelected(null);
    setHoveredTarget(null);
  };

  const activatePiece = (selection: PieceSelection) => {
    if (result || isCompleting) return;
    if (!selected) {
      setSelected(selection);
      return;
    }
    if (selected.id === selection.id && selected.side === selection.side) {
      setSelected(null);
      return;
    }
    if (selected.side === selection.side) {
      setSelected(selection);
      return;
    }
    connectPieces(selected, selection);
  };

  const beginPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>, selection: PieceSelection) => {
    if (result || isCompleting || event.button !== 0) return;
    const piece = getPiece(selection);
    if (!piece) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      ...selection,
      backgroundColor: appearance.backgroundColor,
      height: rect.height,
      html: piece.html,
      left: rect.left,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      top: rect.top,
      width: rect.width,
      x: event.clientX,
      y: event.clientY
    });
  };

  const movePointerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId || result || isCompleting) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    const moved = drag.moved || distance >= DRAG_THRESHOLD_PX;

    if (moved && !drag.moved) suppressClickRef.current = true;

    const target = moved ? targetForDrag(activityRef.current, drag, event.clientX, event.clientY) : null;

    setHoveredTarget(target);
    setDrag((current) => current ? { ...current, moved, x: event.clientX, y: event.clientY } : current);
    if (moved) event.preventDefault();
  };

  const endPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = drag.moved ? targetForDrag(activityRef.current, drag, event.clientX, event.clientY) : null;
    if (target) connectPieces(drag, target);
    setDrag(null);
    setHoveredTarget(null);
  };

  const cancelPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag(null);
    setHoveredTarget(null);
  };

  const handleClick = (selection: PieceSelection) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    activatePiece(selection);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, selection: PieceSelection) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activatePiece(selection);
    }
    if (event.key === "Escape") setSelected(null);
  };

  const restart = () => {
    const orders = createAttemptOrders(data.pairs);
    setAttempt((current) => current + 1);
    setAssociations({});
    setSelected(null);
    setHoveredTarget(null);
    setDrag(null);
    setLeftOrder(orders.leftOrder);
    setRightOrder(orders.rightOrder);
    setResult(null);
    setIsCompleting(false);
  };

  const resetToStart = () => {
    const orders = createAttemptOrders(data.pairs);
    setAttempt(1);
    setAssociations({});
    setSelected(null);
    setHoveredTarget(null);
    setDrag(null);
    setLeftOrder(orders.leftOrder);
    setRightOrder(orders.rightOrder);
    setResult(null);
    setIsCompleting(false);
  };

  const finish = () => {
    if (!result) return;
    if (authoringMode) {
      resetToStart();
      return;
    }
    onComplete?.({ passed: result.passed, score: result.score });
  };

  const pieceState = (selection: PieceSelection) => {
    const rightId = selection.side === "left" ? associations[selection.id] : selection.id;
    const leftId = selection.side === "left" ? selection.id : associationByRight.get(selection.id);
    const associated = Boolean(leftId && rightId && associations[leftId] === rightId);
    const correct = Boolean(result && leftId && rightId && pairsByLeft.get(leftId)?.rightId === rightId);
    return { associated, correct, leftId, rightId };
  };

  const renderPiece = (selection: PieceSelection, rowIndex: number, pairedOnRow: boolean) => {
    const piece = getPiece(selection);
    if (!piece) return null;
    const state = pieceState(selection);
    const isSelected = selected?.id === selection.id && selected.side === selection.side;
    const isHovered = hoveredTarget?.id === selection.id && hoveredTarget.side === selection.side;
    const isDragOrigin = drag?.id === selection.id && drag.side === selection.side && drag.moved;
    const expectedPair = selection.side === "left" ? pairsByLeft.get(selection.id) : pairsByRight.get(selection.id);
    const ariaText = plainText(piece.html);
    const columnLabel = selection.side === "left"
      ? t("matching.leftColumn", undefined, "Éléments à relier")
      : t("matching.rightColumn", undefined, "Correspondances");

    return <button
      aria-label={`${columnLabel} : ${ariaText}`}
      aria-pressed={isSelected}
      className={[
        styles.piece,
        selection.side === "left" ? styles.leftPiece : styles.rightPiece,
        isSelected ? styles.selected : "",
        isHovered ? styles.dropTarget : "",
        isDragOrigin ? styles.dragOrigin : "",
        pairedOnRow ? styles.pairedPiece : "",
        pairedOnRow && selection.side === "left" ? styles.pairedLeft : "",
        pairedOnRow && selection.side === "right" ? styles.pairedRight : ""
      ].filter(Boolean).join(" ")}
      data-border-style={appearance.borderStyle}
      data-matching-piece-id={selection.id}
      data-matching-piece-side={selection.side}
      data-matching-row={rowIndex}
      disabled={Boolean(result) || isCompleting}
      key={selection.id}
      onClick={() => handleClick(selection)}
      onKeyDown={(event) => handleKeyDown(event, selection)}
      onPointerCancel={cancelPointerDrag}
      onPointerDown={(event) => beginPointerDrag(event, selection)}
      onPointerMove={movePointerDrag}
      onPointerUp={endPointerDrag}
      style={labelStyle()}
      type="button"
    ><PieceShape height={commonPieceHeight} rounded={appearance.rounded} side={selection.side} width={commonPieceWidth} /><span className={styles.pieceContent} data-matching-piece-content dangerouslySetInnerHTML={{ __html: piece.html }} /></button>;
  };

  return <section
    className={styles.activity}
    ref={activityRef}
    style={{ "--matching-piece-height": `${commonPieceHeight}px` } as MatchingCSSProperties}
  >
    <div className={styles.srOnly}>{t("matching.keyboardHelp", undefined, "Sélectionnez un élément puis un élément de l’autre colonne pour les associer. Les associations restent modifiables jusqu’à la dernière paire.")}</div>
    <div className={styles.attempt}>{attemptsUnlimited
      ? t("matching.attemptSimple", { attempt }, "Essai {attempt}")
      : t("matching.attempt", { attempt, max: data.maxAttempts }, "Essai {attempt}/{max}")}</div>

    <div className={styles.board}>
      {leftOrder.map((leftId, rowIndex) => {
        const rightId = rightOrder[rowIndex];
        const pairedOnRow = associations[leftId] === rightId;
        const pair = pairsByLeft.get(leftId);
        const rowCorrect = Boolean(result && pair && result.correctPairIds.includes(pair.id));
        const draggingThisPair = Boolean(drag?.moved && (
          (drag.side === "left" && drag.id === leftId) ||
          (drag.side === "right" && drag.id === rightId)
        ));
        const dissociateIncorrect = Boolean(result && showAttemptFeedback && !rowCorrect);
        const visuallyPaired = pairedOnRow && !draggingThisPair && !dissociateIncorrect;
        return <div className={`${styles.row} ${visuallyPaired ? styles.pairedRow : ""}`} key={`matching-row-${rowIndex}`}>
          {renderPiece({ id: leftId, side: "left" }, rowIndex, visuallyPaired)}
          {renderPiece({ id: rightId, side: "right" }, rowIndex, visuallyPaired)}
          {result && showAttemptFeedback ? <span
            aria-label={rowCorrect
              ? t("matching.correctPair", undefined, "Bonne correspondance")
              : t("matching.incorrectPair", undefined, "Mauvaise correspondance")}
            className={`${styles.reviewMarker} ${rowCorrect ? styles.reviewMarkerCorrect : styles.reviewMarkerIncorrect}`}
            role="img"
          >
            {rowCorrect
              ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 12.5 10 16.5 18 8.5" /></svg>
              : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 7 17 17M17 7 7 17" /></svg>}
          </span> : null}
        </div>;
      })}
    </div>

    {drag?.moved ? <div
      aria-hidden="true"
      className={`${styles.piece} ${drag.side === "left" ? styles.leftPiece : styles.rightPiece} ${styles.dragGhost}`}
      data-border-style={appearance.borderStyle}
      style={{
        ...labelStyle(),
        height: drag.height,
        left: drag.left + (drag.x - drag.startX),
        top: drag.top + (drag.y - drag.startY),
        width: drag.width
      }}
    ><PieceShape height={drag.height} rounded={appearance.rounded} side={drag.side} width={drag.width} /><span className={styles.pieceContent} data-matching-piece-content dangerouslySetInnerHTML={{ __html: drag.html }} /></div> : null}

    {result ? <>
      <div className={styles.srOnly} aria-live="polite">
        {t("matching.reviewSummary", { found: result.correctPairIds.length, total: data.pairs.length }, "{found} correspondance(s) correcte(s) sur {total}.")}
      </div>
      <section aria-live="polite" className={styles.result}>
        <h3>{t("matching.feedbackTitle", undefined, "Feedback")}</h3>
        <div className={styles.feedback} dangerouslySetInnerHTML={{ __html: result.passed ? data.successFeedbackHtml : data.failureFeedbackHtml }} />
        {canRetry ? <button onClick={restart} ref={retryButtonRef} type="button">{t("matching.retry", undefined, "Recommencer")}</button> : <button onClick={finish} ref={continueButtonRef} type="button">{t("matching.continue", undefined, "Continuer")}</button>}
      </section>
    </> : null}
  </section>;
}
