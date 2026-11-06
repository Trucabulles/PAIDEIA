import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { CroppedImage } from "../../app/CroppedImage";
import { useI18n } from "../../../i18n/react";
import type { ActivityItem } from "../../../types/project";
import { cardSortCategoryLabelText } from "./cardSortDefaults";
import type { CardSortActivityProps } from "./cardSortTypes";
import styles from "./CardSortActivity.module.css";

type CardSortCSSProperties = CSSProperties & Record<`--${string}`, string | number>;

type CardRect = { left: number; top: number; width: number; height: number };
type CardTransition = {
  itemId: string;
  categoryId: string;
  categoryLabel: string;
  correct: boolean;
  source: CardRect;
  target: CardRect;
  phase: "placing" | "waiting" | "resolving" | "returning" | "cancelling";
  fromFeedback: boolean;
  startDx: number;
  startDy: number;
};

type CardDrag = {
  itemId: string;
  pointerId: number;
  source: CardRect;
  currentDx: number;
  currentDy: number;
};

type CardFeedbackState = {
  itemId: string;
  correct: boolean;
  final: boolean;
};

type PointerIntent = {
  element: HTMLElement;
  itemId: string;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  source: CardRect;
  startX: number;
  startY: number;
};

const RESERVE_VISIBLE_DEPTH = 5;
const ACCEPTED_VISIBLE_DEPTH = 4;
const POINTER_DRAG_THRESHOLD = 5;

function hasRichText(html?: string | null) {
  return Boolean((html ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
}

function cardVisualVariation(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return {
    reserveX: (unsigned % 17) - 8,
    reserveY: ((unsigned >>> 5) % 13) - 6,
    reserveRotation: (((unsigned >>> 10) % 61) - 30) / 10
  };
}

function rectOf(element: HTMLElement): CardRect {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function CardSortActivity({ authoringMode = false, data, getItemImageUrl, items, onComplete }: CardSortActivityProps) {
  const { t } = useI18n();
  const itemSignature = items.map((item) => item.id).join("|");
  const [queue, setQueue] = useState<string[]>(() => items.map((item) => item.id));
  const [acceptedByCategory, setAcceptedByCategory] = useState<Record<string, string[]>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const [transition, setTransition] = useState<CardTransition | null>(null);
  const [cardFeedback, setCardFeedback] = useState<CardFeedbackState | null>(null);
  const [completed, setCompleted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const topCardRef = useRef<HTMLElement | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const finalContinueRef = useRef<HTMLButtonElement | null>(null);
  const pointerIntentRef = useRef<PointerIntent | null>(null);
  const dragRef = useRef<CardDrag | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPositionRef = useRef<{ dx: number; dy: number } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setQueue(items.map((item) => item.id));
    setAcceptedByCategory({});
    setSelectedCardId(null);
    setDrag(null);
    dragRef.current = null;
    pointerIntentRef.current = null;
    setTransition(null);
    setCardFeedback(null);
    setCompleted(false);
    setAnnouncement("");
  }, [itemSignature]);

  useEffect(() => () => {
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
  }, []);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const remainingItems = queue.map((id) => itemById.get(id)).filter((item): item is ActivityItem => Boolean(item));
  const visibleReserveItems = remainingItems.slice(0, RESERVE_VISIBLE_DEPTH);
  const topItem = remainingItems[0] ?? null;
  const feedbackMode = data.interactionMode === "feedback";
  const interactionLocked = Boolean(transition) || Boolean(drag) || completed;

  const resetToStart = () => {
    setQueue(items.map((item) => item.id));
    setAcceptedByCategory({});
    setSelectedCardId(null);
    setDrag(null);
    dragRef.current = null;
    pointerIntentRef.current = null;
    setTransition(null);
    setCardFeedback(null);
    setCompleted(false);
    setAnnouncement("");
  };

  const dismissIntermediateFeedback = () => {
    setCardFeedback((current) => current?.final ? current : null);
  };

  const cardStyle = (item: ActivityItem, visualIndex: number, visualCount: number) => {
    const variation = cardVisualVariation(item.id);
    return {
      "--card-sort-bg": item.cardBackgroundColor || data.cardAppearance.backgroundColor,
      "--card-sort-border": data.cardAppearance.borderColor,
      "--card-sort-border-width": data.cardAppearance.borderWidth,
      "--card-sort-border-style": data.cardAppearance.borderStyle,
      "--card-sort-radius": data.cardAppearance.rounded ? "18px" : "0px",
      "--card-sort-stack-x": `${variation.reserveX}px`,
      "--card-sort-stack-y": `${variation.reserveY}px`,
      "--card-sort-stack-rotate": `${variation.reserveRotation}deg`,
      "--card-sort-stack-z": String(Math.max(1, visualCount - visualIndex))
    } as CardSortCSSProperties;
  };

  const ghostStyle = (state: CardTransition) => {
    const dx = state.target.left - state.source.left;
    const dy = state.target.top - state.source.top;
    return {
      left: `${state.source.left}px`,
      top: `${state.source.top}px`,
      width: `${state.source.width}px`,
      height: `${state.source.height}px`,
      "--card-sort-dx": `${dx}px`,
      "--card-sort-dy": `${dy}px`,
      "--card-sort-start-dx": `${state.startDx}px`,
      "--card-sort-start-dy": `${state.startDy}px`,
      "--card-sort-bg": itemById.get(state.itemId)?.cardBackgroundColor || data.cardAppearance.backgroundColor,
      "--card-sort-border": data.cardAppearance.borderColor,
      "--card-sort-border-width": data.cardAppearance.borderWidth,
      "--card-sort-border-style": data.cardAppearance.borderStyle,
      "--card-sort-radius": data.cardAppearance.rounded ? "18px" : "0px"
    } as CardSortCSSProperties;
  };

  const dragGhostStyle = (state: CardDrag) => ({
    left: `${state.source.left}px`,
    top: `${state.source.top}px`,
    width: `${state.source.width}px`,
    height: `${state.source.height}px`,
    "--card-sort-current-dx": `${state.currentDx}px`,
    "--card-sort-current-dy": `${state.currentDy}px`,
    "--card-sort-bg": itemById.get(state.itemId)?.cardBackgroundColor || data.cardAppearance.backgroundColor,
    "--card-sort-border": data.cardAppearance.borderColor,
    "--card-sort-border-width": data.cardAppearance.borderWidth,
    "--card-sort-border-style": data.cardAppearance.borderStyle,
    "--card-sort-radius": data.cardAppearance.rounded ? "18px" : "0px"
  } as CardSortCSSProperties);

  const acceptedCardStyle = (item: ActivityItem, categoryId: string, visualIndex: number, visualCount: number) => {
    const variation = cardVisualVariation(`${categoryId}:${item.id}:accepted`);
    return {
      ...cardStyle(item, visualIndex, visualCount),
      "--card-sort-accepted-x": `${variation.reserveX}px`,
      "--card-sort-accepted-y": `${variation.reserveY}px`,
      "--card-sort-accepted-rotate": `${variation.reserveRotation}deg`,
      "--card-sort-accepted-z": String(2 + visualIndex)
    } as CardSortCSSProperties;
  };

  const finalizeTransition = (state: CardTransition) => {
    const nextQueue = state.correct
      ? queue.slice(1)
      : [...queue.slice(1), state.itemId];
    setQueue(nextQueue);
    if (state.correct) {
      setAcceptedByCategory((current) => ({
        ...current,
        [state.categoryId]: [...(current[state.categoryId] ?? []), state.itemId]
      }));
    }
    setSelectedCardId(null);
    setTransition(null);

    if (state.correct && nextQueue.length === 0) {
      setCompleted(true);
      setAnnouncement(t("cardSort.completedAnnouncement", undefined, "Toutes les cartes sont correctement classées."));
      window.requestAnimationFrame(() => finalContinueRef.current?.focus({ preventScroll: true }));
      return;
    }

    window.requestAnimationFrame(() => topCardRef.current?.focus({ preventScroll: true }));
  };

  const placeCard = (
    cardId: string,
    categoryId: string,
    pointerMotion?: { source: CardRect; startDx: number; startDy: number }
  ) => {
    if (!cardId || Boolean(transition) || completed || cardId !== queue[0]) return;
    const card = itemById.get(cardId);
    const category = data.categories.find((item) => item.id === categoryId);
    const sourceElement = topCardRef.current;
    const targetElement = categoryRefs.current[categoryId];
    if (!card || !category || !sourceElement || !targetElement) return;

    const correct = card.correctCategoryId === categoryId;
    const categoryLabel = cardSortCategoryLabelText(category.labelHtml) || category.label;
    const next: CardTransition = {
      itemId: card.id,
      categoryId,
      categoryLabel,
      correct,
      source: pointerMotion?.source ?? rectOf(sourceElement),
      target: rectOf(targetElement),
      phase: feedbackMode || !correct ? "placing" : "resolving",
      fromFeedback: false,
      startDx: pointerMotion?.startDx ?? 0,
      startDy: pointerMotion?.startDy ?? 0
    };

    setSelectedCardId(null);
    setDrag(null);
    dragRef.current = null;
    setTransition(next);
    setAnnouncement(
      correct
        ? t("cardSort.correctPlacementAnnouncement", { card: card.title, category: categoryLabel }, `${card.title} est correctement classée dans ${categoryLabel}.`)
        : t("cardSort.incorrectPlacementAnnouncement", { card: card.title, category: categoryLabel }, `${card.title} ne va pas dans ${categoryLabel}.`)
    );

    if (feedbackMode) {
      window.setTimeout(() => {
        setCardFeedback({ itemId: card.id, correct, final: correct && queue.length === 1 });
        if (correct) {
          finalizeTransition(next);
        } else {
          setTransition((current) => current?.itemId === card.id
            ? { ...current, phase: "returning", fromFeedback: true }
            : current);
        }
      }, 300);
    }
  };

  const returnCancelledDrag = (state: CardDrag) => {
    setDrag(null);
    dragRef.current = null;
    setTransition({
      itemId: state.itemId,
      categoryId: "",
      categoryLabel: "",
      correct: false,
      source: state.source,
      target: state.source,
      phase: "cancelling",
      fromFeedback: false,
      startDx: state.currentDx,
      startDy: state.currentDy
    });
  };

  const categoryAtPoint = (clientX: number, clientY: number) => data.categories.find((category) => {
    const element = categoryRefs.current[category.id];
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  });

  const beginPointerIntent = (event: ReactPointerEvent<HTMLElement>, itemId: string, selectable: boolean) => {
    if (!selectable || (event.pointerType === "mouse" && event.button !== 0)) return;
    dismissIntermediateFeedback();
    const element = event.currentTarget;
    const source = rectOf(element);
    pointerIntentRef.current = {
      element,
      itemId,
      offsetX: event.clientX - source.left,
      offsetY: event.clientY - source.top,
      pointerId: event.pointerId,
      source,
      startX: event.clientX,
      startY: event.clientY
    };
    try { element.setPointerCapture(event.pointerId); } catch { /* capture indisponible */ }
  };

  const movePointerCard = (event: ReactPointerEvent<HTMLElement>) => {
    const intent = pointerIntentRef.current;
    if (!intent || intent.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - intent.startX, event.clientY - intent.startY);
    let current = dragRef.current;
    if (!current && distance < POINTER_DRAG_THRESHOLD) return;
    event.preventDefault();
    const position = {
      dx: event.clientX - intent.offsetX - intent.source.left,
      dy: event.clientY - intent.offsetY - intent.source.top
    };
    if (!current) {
      current = {
        itemId: intent.itemId,
        pointerId: intent.pointerId,
        source: intent.source,
        currentDx: position.dx,
        currentDy: position.dy
      };
      suppressClickRef.current = true;
      setSelectedCardId(null);
      dragRef.current = current;
      setDrag(current);
      return;
    }
    pendingDragPositionRef.current = position;
    if (dragFrameRef.current !== null) return;
    const pointerId = event.pointerId;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingDragPositionRef.current;
      pendingDragPositionRef.current = null;
      if (!pending) return;
      setDrag((value) => {
        if (!value || value.pointerId !== pointerId) return value;
        const next = { ...value, currentDx: pending.dx, currentDy: pending.dy };
        dragRef.current = next;
        return next;
      });
    });
  };

  const endPointerCard = (event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
    const intent = pointerIntentRef.current;
    if (!intent || intent.pointerId !== event.pointerId) return;
    pointerIntentRef.current = null;
    try { intent.element.releasePointerCapture(event.pointerId); } catch { /* capture deja liberee */ }
    const current = dragRef.current;
    if (!current) return;
    event.preventDefault();
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    const finalState = {
      ...current,
      currentDx: event.clientX - intent.offsetX - intent.source.left,
      currentDy: event.clientY - intent.offsetY - intent.source.top
    };
    dragRef.current = finalState;
    if (cancelled) {
      returnCancelledDrag(finalState);
      return;
    }
    const category = categoryAtPoint(event.clientX, event.clientY);
    if (!category) {
      returnCancelledDrag(finalState);
      return;
    }
    placeCard(finalState.itemId, category.id, {
      source: finalState.source,
      startDx: finalState.currentDx,
      startDy: finalState.currentDy
    });
  };

  const activateWithKeyboard = (event: KeyboardEvent, action: () => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  };

  const renderCardContents = (item: ActivityItem) => {
    const image = getItemImageUrl(item);
    return <>
      {image ? <CroppedImage alt={item.frontImageAccessibility?.decorative ? "" : item.frontImageAccessibility?.altText || item.title} className={styles.image} crop={item.frontImageCrop} role={item.frontImageAccessibility?.decorative ? "presentation" : undefined} src={image} /> : null}
      {hasRichText(item.contentHtml) ? <div className={styles.cardText} dangerouslySetInnerHTML={{ __html: item.contentHtml }} /> : null}
    </>;
  };

  const renderReserveCard = (item: ActivityItem, index: number, count: number) => {
    const isTop = index === 0;
    const selectable = isTop && !interactionLocked;
    const select = () => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (selectable) {
        dismissIntermediateFeedback();
        setSelectedCardId((current) => current === item.id ? null : item.id);
      }
    };
    const hiddenSource = transition?.itemId === item.id || drag?.itemId === item.id;
    return <article
      aria-hidden={!isTop ? true : undefined}
      aria-pressed={selectable ? selectedCardId === item.id : undefined}
      className={`${styles.card} ${styles.reserveCard} ${selectedCardId === item.id ? styles.cardSelected : ""} ${hiddenSource ? styles.cardTransitionSourceHidden : ""}`}
      draggable={false}
      key={item.id}
      onClick={select}
      onDragStart={(event) => event.preventDefault()}
      onKeyDown={(event) => activateWithKeyboard(event, select)}
      onPointerCancel={(event) => endPointerCard(event, true)}
      onPointerDown={(event) => beginPointerIntent(event, item.id, selectable)}
      onPointerMove={movePointerCard}
      onPointerUp={(event) => endPointerCard(event)}
      ref={isTop ? topCardRef : undefined}
      role={selectable ? "button" : undefined}
      style={cardStyle(item, index, count)}
      tabIndex={selectable ? 0 : -1}
    >{renderCardContents(item)}</article>;
  };

  const activeMotion = transition ?? drag;
  const ghostItem = activeMotion ? itemById.get(activeMotion.itemId) ?? null : null;
  const ghostClass = transition
    ? transition.phase === "placing"
      ? styles.cardGhostToTarget
      : transition.phase === "waiting"
        ? styles.cardGhostWaiting
        : transition.phase === "returning"
          ? styles.cardGhostReturning
          : transition.phase === "cancelling"
            ? styles.cardGhostCancelling
          : transition.correct
            ? transition.fromFeedback ? styles.cardGhostAcceptFromTarget : styles.cardGhostAcceptDirect
            : ""
    : "";
  const feedbackItem = cardFeedback ? itemById.get(cardFeedback.itemId) ?? null : null;
  const activeFeedbackHtml = cardFeedback && feedbackItem
    ? (cardFeedback.correct ? feedbackItem.cardFeedbackCorrectHtml : feedbackItem.cardFeedbackIncorrectHtml)
    : null;

  const finishActivity = () => {
    if (!completed) return;
    if (authoringMode) {
      resetToStart();
      return;
    }
    onComplete?.({ score: 100, passed: true });
  };

  return <section className={styles.activity}>
    <span aria-live="polite" className={styles.srOnly}>{announcement}</span>

    <div className={styles.reserve}>
      <div className={styles.reserveStack}>
        {visibleReserveItems.map((item, index) => renderReserveCard(item, index, visibleReserveItems.length))}
      </div>
      <div className={styles.remainingCount}>
        {t(
          remainingItems.length === 1 ? "cardSort.remainingOne" : "cardSort.remainingMany",
          { count: remainingItems.length },
          remainingItems.length === 1 ? "1 carte restante" : `${remainingItems.length} cartes restantes`
        )}
      </div>
    </div>

    <div className={styles.categories} data-card-sort-category-count={data.categories.length}>
      {data.categories.map((category) => {
        const categoryLabel = cardSortCategoryLabelText(category.labelHtml) || category.label;
        const acceptedItems = (acceptedByCategory[category.id] ?? [])
          .map((itemId) => itemById.get(itemId))
          .filter((item): item is ActivityItem => Boolean(item));
        const visibleAcceptedItems = acceptedItems.slice(-ACCEPTED_VISIBLE_DEPTH);
        const placeSelectedCard = () => selectedCardId && placeCard(selectedCardId, category.id);
        return <section
          aria-label={selectedCardId
            ? t("cardSort.dropInCategory", { category: categoryLabel }, `Déposer la carte sélectionnée dans ${categoryLabel}`)
            : categoryLabel}
          className={styles.category}
          key={category.id}
          onClick={placeSelectedCard}
          onKeyDown={(event) => activateWithKeyboard(event, placeSelectedCard)}
          data-card-sort-category-id={category.id}
          role={selectedCardId && !interactionLocked ? "button" : undefined}
          tabIndex={selectedCardId && !interactionLocked ? 0 : -1}
        >
          <div className={styles.categoryPile} ref={(element) => { categoryRefs.current[category.id] = element; }} style={{ "--card-sort-category-border": category.borderColor, "--card-sort-radius": data.cardAppearance.rounded ? "18px" : "0px" } as CardSortCSSProperties}>
            <div className={styles.destinationCard}>
              <span>{t("cardSort.dropHere", undefined, "Déposez une carte ici")}</span>
            </div>
            {visibleAcceptedItems.map((item, index) => <article
              aria-hidden="true"
              className={`${styles.card} ${styles.acceptedCard}`}
              key={item.id}
              style={acceptedCardStyle(item, category.id, index, visibleAcceptedItems.length)}
            >{renderCardContents(item)}</article>)}
          </div>
          <div className={`${styles.categoryLabel} rich-content`} dangerouslySetInnerHTML={{ __html: category.labelHtml }} style={{ "--card-sort-category-border": category.borderColor } as CardSortCSSProperties} />
        </section>;
      })}
    </div>

    {cardFeedback ? <section aria-live="polite" className={styles.cardFeedbackPanel}>
      <strong className={cardFeedback.correct ? styles.feedbackCorrectLabel : styles.feedbackIncorrectLabel}>
        {cardFeedback.correct
          ? t("cardSort.correctPlacement", undefined, "Classement correct")
          : t("cardSort.incorrectPlacement", undefined, "Classement incorrect")}
      </strong>
      {hasRichText(activeFeedbackHtml) ? <div className={styles.cardFeedbackContent} dangerouslySetInnerHTML={{ __html: activeFeedbackHtml || "" }} /> : null}
      {cardFeedback.final ? <button onClick={finishActivity} ref={finalContinueRef} type="button">
        {t("common.continue", undefined, "Continuer")}
      </button> : null}
    </section> : null}

    {activeMotion && ghostItem && transition?.phase !== "waiting" ? <article
      aria-hidden="true"
      className={`${styles.card} ${styles.cardGhost} ${drag ? styles.cardGhostDragging : ghostClass}`}
      onAnimationEnd={() => {
        if (!transition) return;
        if (transition.phase === "placing" && !feedbackMode && !transition.correct) {
          setTransition((current) => current?.itemId === transition.itemId
            ? { ...current, phase: "returning" }
            : current);
          return;
        }
        if (transition.phase === "returning") {
          finalizeTransition(transition);
          return;
        }
        if (transition.phase === "cancelling") {
          setTransition(null);
          setSelectedCardId(null);
          window.requestAnimationFrame(() => topCardRef.current?.focus({ preventScroll: true }));
          return;
        }
        if (transition.phase === "resolving") finalizeTransition(transition);
      }}
      style={drag ? dragGhostStyle(drag) : ghostStyle(transition!)}
    >{renderCardContents(ghostItem)}</article> : null}

    {completed && !feedbackMode ? <section className={styles.standardFinalFeedback}>
        <div className={styles.pedagogicalFeedback} dangerouslySetInnerHTML={{ __html: data.successFeedbackHtml }} />
        <button className={styles.resultNextButton} onClick={finishActivity} ref={finalContinueRef} type="button">
          {t("common.continue", undefined, "Continuer")}
        </button>
    </section> : null}
  </section>;
}
