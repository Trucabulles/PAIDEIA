import { createElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CompleteBlank } from "../../../types/project";
import { CroppedImage } from "../../app/CroppedImage";
import { useI18n } from "../../../i18n/react";
import { completeAttemptsUnlimited, completeCoverBackgroundColor, completeDocumentExercise } from "./completeDefaults";
import { evaluateComplete } from "./completeEvaluation";
import styles from "./CompleteActivity.module.css";
import type { CompleteActivityProps } from "./completeTypes";

const HTML_VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
]);
const COMPLETE_PAGE_GAP = 32;

function reactStyleFromElement(element: HTMLElement): CSSProperties {
  const style: Record<string, string> = {};
  Array.from(element.style).forEach((property) => {
    const value = element.style.getPropertyValue(property);
    if (!value) return;
    if (property.startsWith("--")) {
      style[property] = value;
      return;
    }
    const reactProperty = property
      .replace(/^-webkit-/, "Webkit-")
      .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    style[reactProperty] = value;
  });
  return style as CSSProperties;
}

function richElementProps(element: HTMLElement, key: string): Record<string, unknown> {
  const props: Record<string, unknown> = { key };
  if (element.className) props.className = element.className;
  if (element.style.length) props.style = reactStyleFromElement(element);

  Array.from(element.attributes).forEach(({ name, value }) => {
    if (name.startsWith("data-paideia-") || name.startsWith("aria-")) props[name] = value;
  });

  const href = element.getAttribute("href");
  if (href) props.href = href;
  const title = element.getAttribute("title");
  if (title) props.title = title;
  const target = element.getAttribute("target");
  if (target) props.target = target;
  const rel = element.getAttribute("rel");
  if (rel) props.rel = rel;
  const start = element.getAttribute("start");
  if (start) props.start = Number(start);
  const value = element.getAttribute("value");
  if (value && element.tagName.toLowerCase() === "li") props.value = Number(value);
  const colSpan = element.getAttribute("colspan");
  if (colSpan) props.colSpan = Number(colSpan);
  const rowSpan = element.getAttribute("rowspan");
  if (rowSpan) props.rowSpan = Number(rowSpan);
  return props;
}

function stableChoiceHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function listChoices(blank?: CompleteBlank) {
  if (!blank) return [];
  const choices = Array.from(new Set([blank.answer, ...blank.variants].map((item) => item.trim()).filter(Boolean)));
  return choices.sort((left, right) => {
    const leftHash = stableChoiceHash(`${blank.id}:${left}`);
    const rightHash = stableChoiceHash(`${blank.id}:${right}`);
    return leftHash - rightHash || left.localeCompare(right);
  });
}

function CompleteBlankField({ blank, correct, id, label, onChange, readOnly = false, value }: { blank?: CompleteBlank; correct?: boolean; id: string; label: string; onChange: (id: string, value: string) => void; readOnly?: boolean; value: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    const fit = () => {
      const style = field.ownerDocument.defaultView!.getComputedStyle(field);
      const context = field.ownerDocument.createElement("canvas").getContext("2d");
      if (!context) return;
      context.font = style.font || [style.fontWeight, style.fontSize, style.fontFamily].join(" ");
      const spacing = parseFloat(style.letterSpacing) || 0;
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const borders = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
      field.style.width = Math.ceil(context.measureText(value || " ").width + Math.max(0, value.length - 1) * spacing + padding + borders + 3) + "px";
    };
    fit();
    field.ownerDocument.fonts?.ready.then(() => { if (field.isConnected) fit(); }).catch(() => undefined);
    field.ownerDocument.defaultView?.addEventListener("resize", fit);
    return () => field.ownerDocument.defaultView?.removeEventListener("resize", fit);
  }, [value]);
  const className = `${styles.blank} ${correct === undefined ? "" : correct ? styles.correct : styles.incorrect}`;
  return <input ref={inputRef} aria-label={label} className={className} onChange={(event) => onChange(id, event.target.value)} readOnly={readOnly} type="text" value={value} />;
}

function CompleteListField({ blank, correct, id, label, onChange, readOnly = false, value }: { blank?: CompleteBlank; correct?: boolean; id: string; label: string; onChange: (id: string, value: string) => void; readOnly?: boolean; value: string }) {
  const choices = listChoices(blank);
  const choiceSignature = choices.join("\u0000");
  const options = useMemo(() => [{ value: "", label: "—" }, ...choices.map((choice) => ({ value: choice, label: choice }))], [choiceSignature]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex];
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [menuWidth, setMenuWidth] = useState(96);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const fit = () => {
      const style = window.getComputedStyle(trigger);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const longestTextWidth = options.reduce((width, option) => Math.max(width, context.measureText(option.label).width), 0);
      setMenuWidth(Math.max(96, Math.min(440, Math.ceil(longestTextWidth + 48))));
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => undefined);
  }, [choiceSignature, selectedOption.label]);

  useLayoutEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = Math.min(280, options.length * 38 + 8);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
      const top = rect.bottom + 4 + estimatedHeight <= window.innerHeight - 8 || rect.top < estimatedHeight + 12
        ? rect.bottom + 4
        : rect.top - estimatedHeight - 4;
      setMenuPosition({ left, top });
    };
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !listboxRef.current?.contains(target)) setOpen(false);
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    document.addEventListener("pointerdown", closeFromOutside);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      document.removeEventListener("pointerdown", closeFromOutside);
    };
  }, [menuWidth, open, options.length]);

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  const choose = (nextIndex: number) => {
    const option = options[nextIndex];
    if (!option) return;
    onChange(id, option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex);
        setOpen(true);
      } else {
        const offset = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) => (current + offset + options.length) % options.length);
      }
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const className = `${styles.blank} ${styles.blankSelect} ${correct === undefined ? "" : correct ? styles.correct : styles.incorrect}`;
  return <span className={styles.blankSelectRoot}>
    <button
      aria-controls={open ? listboxId : undefined}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={label}
      className={className}
      disabled={readOnly}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={handleKeyDown}
      ref={triggerRef}
      role="combobox"
      style={{ width: "max-content" }}
      type="button"
    >
      <span className={styles.blankSelectValue}>{selectedOption.label}</span>
      {!readOnly ? <svg aria-hidden="true" className={styles.blankSelectChevron} viewBox="0 0 12 8"><path d="m1 1 5 5 5-5" /></svg> : null}
    </button>
    {open ? createPortal(
      <div
        aria-label={label}
        className={styles.blankSelectMenu}
        id={listboxId}
        ref={listboxRef}
        role="listbox"
        style={{ left: menuPosition.left, top: menuPosition.top, width: `${menuWidth}px` }}
      >
        {options.map((option, index) => <button
          aria-selected={option.value === value}
          className={`${styles.blankSelectOption} ${index === activeIndex ? styles.blankSelectOptionActive : ""}`}
          key={option.value || "empty"}
          onClick={() => choose(index)}
          onMouseEnter={() => setActiveIndex(index)}
          role="option"
          type="button"
        >{option.label}</button>)}
      </div>,
      document.body
    ) : null}
  </span>;
}

function OriginalResponseIndicator({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const separator = message.indexOf(" : ");
  const label = separator >= 0 ? message.slice(0, separator + 3) : message;
  const answer = separator >= 0 ? message.slice(separator + 3) : "";
  const tooltipId = useId();
  const pinnedRef = useRef(false);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const close = () => { pinnedRef.current = false; setOpen(false); };
  useEffect(() => {
    const group = buttonRef.current?.parentElement;
    const show = () => {
      const doc = buttonRef.current?.ownerDocument;
      doc?.dispatchEvent(new CustomEvent("paideia-complete-response-open", { detail: buttonRef.current }));
      setOpen(true);
    };
    const leave = () => { if (!pinnedRef.current) setOpen(false); };
    const pin = () => { show(); pinnedRef.current = true; };
    const closePrevious = (event: Event) => {
      if ((event as CustomEvent).detail !== buttonRef.current) close();
    };
    const doc = buttonRef.current?.ownerDocument;
    doc?.addEventListener("paideia-complete-response-open", closePrevious);
    group?.addEventListener("mouseenter", show);
    group?.addEventListener("mouseleave", leave);
    group?.addEventListener("click", pin);
    return () => { doc?.removeEventListener("paideia-complete-response-open", closePrevious); group?.removeEventListener("mouseenter", show); group?.removeEventListener("mouseleave", leave); group?.removeEventListener("click", pin); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const doc = buttonRef.current?.ownerDocument;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.parentElement?.contains(target) && !tooltipRef.current?.contains(target)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    doc?.addEventListener("click", outside);
    doc?.addEventListener("keydown", escape);
    return () => { doc?.removeEventListener("click", outside); doc?.removeEventListener("keydown", escape); };
  }, [open]);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const tooltip = tooltipRef.current;
    const view = button?.ownerDocument.defaultView;
    if (!button || !tooltip || !view) return;
    const reposition = () => {
      const rect = button.getBoundingClientRect();
      const height = tooltip.offsetHeight;
      const below = Math.max(0, view.innerHeight - rect.bottom - 8 - 16);
      const above = Math.max(0, rect.top - 8 - 16);
      const useBelow = height <= below || (height > above && below >= above);
      const left = Math.max(16, Math.min(rect.left, view.innerWidth - tooltip.offsetWidth - 16));
      const desiredTop = useBelow ? rect.bottom + 8 : rect.top - 8 - height;
      const top = Math.max(16, Math.min(desiredTop, view.innerHeight - height - 16));
      setPosition({ left, top });
    };
    reposition();
    view.addEventListener("resize", reposition);
    view.addEventListener("scroll", reposition, true);
    return () => { view.removeEventListener("resize", reposition); view.removeEventListener("scroll", reposition, true); };
  }, [open, message]);
  const ownerDocument = buttonRef.current?.ownerDocument;
  return <>
    <button ref={buttonRef} type="button" className="complete-response-eye" aria-label={message}
      aria-describedby={open ? tooltipId : undefined}


      onFocus={() => { buttonRef.current?.ownerDocument.dispatchEvent(new CustomEvent("paideia-complete-response-open", { detail: buttonRef.current })); setOpen(true); }} onBlur={() => { if (!pinnedRef.current) setOpen(false); }} onClick={() => { pinnedRef.current = true; setOpen(true); }}
      onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
    {open && ownerDocument ? createPortal(<span ref={tooltipRef} id={tooltipId} role="tooltip" className="complete-response-tooltip"
      style={position}><span className="complete-response-tooltip-label">{label}</span><span className="complete-response-tooltip-answer">{answer}</span></span>, ownerDocument.body) : null}
  </>;
}

function renderHtml(
  html: string,
  blanks: Map<string, CompleteBlank>,
  values: Record<string, string>,
  onChange: (id: string, value: string) => void,
  correct: Set<string> | null,
  responseLabel: string,
  readOnly = false,
  revealAnswers = false,
  originalResponseLabel = "Votre réponse",
  emptyResponseLabel = "Aucune réponse"
): ReactNode[] {
  const documentNode = new DOMParser().parseFromString(html || "<p></p>", "text/html");
  const visit = (node: ChildNode, key: string): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (!(node instanceof HTMLElement)) return null;
    const blankId = node.dataset.paideiaCompleteId;
    if (blankId) {
      const fieldProps = {
        blank: blanks.get(blankId),
        correct: revealAnswers ? true : correct?.has(blankId),
        id: blankId,
        label: responseLabel,
        onChange,
        readOnly,
        value: revealAnswers ? blanks.get(blankId)?.answer.trim() ?? "" : values[blankId] ?? ""
      };
      const field = node.dataset.paideiaCompleteKind === "list"
        ? <CompleteListField {...fieldProps} key={key} />
        : <CompleteBlankField {...fieldProps} key={key} />;
      return revealAnswers && correct && !correct.has(blankId)
        ? <span key={key} className="complete-corrected-response complete-error-response">{field}<OriginalResponseIndicator message={`${originalResponseLabel} : ${values[blankId]?.trim() ? values[blankId] : emptyResponseLabel}`} /></span>
        : readOnly && correct?.has(blankId) ? <span key={key} className="complete-corrected-response">{field}<span aria-hidden="true" className="complete-response-eye complete-response-correct"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10" /></svg></span></span> : field;
    }
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "img", "video", "audio", "iframe"].includes(tag)) return null;
    const props = richElementProps(node, key);

    // A blank RichText paragraph is serialized as e.g. <p><br></p>. React void
    // elements must never receive a children argument, even an empty array.
    if (HTML_VOID_TAGS.has(tag)) {
      return createElement(tag, props);
    }

    return createElement(tag, props, Array.from(node.childNodes).map((child, index) => visit(child, `${key}-${index}`)));
  };
  return Array.from(documentNode.body.childNodes).map((node, index) => visit(node, `${index}`));
}

function plainTextFromRichHtml(html: string) {
  const documentNode = new DOMParser().parseFromString(html || "", "text/html");
  return Array.from(documentNode.body.childNodes)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGeckoEngine() {
  return "MozAppearance" in document.documentElement.style;
}

function resetRichTextFit(content: HTMLDivElement | null) {
  if (!content) return;
  content.style.removeProperty("zoom");
  content.style.removeProperty("transform");
  content.style.removeProperty("transform-origin");
}

function fitRichTextToViewport(viewport: HTMLDivElement | null, content: HTMLDivElement | null) {
  if (!viewport || !content) return;
  const availableWidth = viewport.clientWidth;
  const availableHeight = viewport.clientHeight;
  if (!availableWidth || !availableHeight) return;

  if (isGeckoEngine()) {
    resetRichTextFit(content);
    const naturalWidth = content.scrollWidth;
    const naturalHeight = content.scrollHeight;
    const fits = (scale: number) => naturalWidth * scale <= availableWidth + 0.75
      && naturalHeight * scale <= availableHeight + 0.75;
    if (fits(1)) return;
    let low = 0.08;
    let high = 1;
    if (!fits(low)) return;
    for (let index = 0; index < 14; index += 1) {
      const probe = (low + high) / 2;
      if (fits(probe)) low = probe;
      else high = probe;
    }
    content.style.transformOrigin = "center center";
    content.style.transform = `scale(${low.toFixed(4)})`;
    return;
  }

  content.style.removeProperty("transform");
  content.style.removeProperty("transform-origin");
  const applyScale = (scale: number) => {
    const bounded = Math.max(0.08, Math.min(1, scale));
    if (bounded >= 0.9995) content.style.removeProperty("zoom");
    else content.style.setProperty("zoom", bounded.toFixed(4));
    const effectiveScale = bounded >= 0.9995 ? 1 : bounded;
    return content.scrollWidth * effectiveScale <= availableWidth + 0.75
      && content.scrollHeight * effectiveScale <= availableHeight + 0.75;
  };
  if (applyScale(1)) return;
  let low = 0.08;
  let high = 1;
  if (!applyScale(low)) return;
  for (let index = 0; index < 14; index += 1) {
    const probe = (low + high) / 2;
    if (applyScale(probe)) low = probe;
    else high = probe;
  }
  applyScale(low);
}

type CompleteAttemptSnapshot = {
  attempt: number;
  correctIds: string[];
  passed: boolean;
  responses: Record<string, string>;
  score: number;
};

export function CompleteActivity({ authoringMode = false, coverImageAlt = "", coverImageCrop, coverImageRounded = true, coverImageSrc, data, title, onComplete }: CompleteActivityProps) {
  const { t } = useI18n();
  const [finalReview, setFinalReview] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [attemptHistory, setAttemptHistory] = useState<CompleteAttemptSnapshot[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [stage, setStage] = useState<"cover" | "exercise" | "result" | "review" | "ending">(data.cover.enabled ? "cover" : "exercise");
  const [result, setResult] = useState<CompleteAttemptSnapshot | null>(null);
  const contentViewportRef = useRef<HTMLDivElement | null>(null);
  const contentFlowRef = useRef<HTMLDivElement | null>(null);
  const coverTitleViewportRef = useRef<HTMLDivElement | null>(null);
  const coverTitleContentRef = useRef<HTMLDivElement | null>(null);
  const coverDescriptionViewportRef = useRef<HTMLDivElement | null>(null);
  const coverDescriptionContentRef = useRef<HTMLDivElement | null>(null);
  const endingCopyViewportRef = useRef<HTMLDivElement | null>(null);
  const endingCopyContentRef = useRef<HTMLDivElement | null>(null);

  const documentExercise = useMemo(() => completeDocumentExercise(data), [data.exercises]);
  const blanks = useMemo(() => new Map(documentExercise.blanks.map((blank) => [blank.id, blank])), [documentExercise.blanks]);
  const documentHtml = documentExercise.contentHtml || "<p></p>";
  const attemptsUnlimited = completeAttemptsUnlimited(data);
  const currentAttempt = attemptHistory.length + 1;
  const isLastPage = pageIndex === pageCount - 1;
  const hasPassed = attemptHistory.some((item) => item.passed);
  const bestScore = attemptHistory.reduce((best, item) => Math.max(best, item.score), 0);
  const effectiveBestScore = result ? Math.max(bestScore, result.score) : bestScore;
  const limitedAttemptsExhausted = Boolean(!attemptsUnlimited && result && result.attempt >= data.maxAttempts);
  const canRestart = Boolean(result && (attemptsUnlimited || result.attempt < data.maxAttempts));
  const canContinue = Boolean(result && (attemptsUnlimited || hasPassed || limitedAttemptsExhausted));
  const revealAnswers = Boolean(data.revealAnswersOnFinalReview && stage === "review" && (attemptsUnlimited ? finalReview : hasPassed || limitedAttemptsExhausted));
  const correctIds = stage === "review" && result ? new Set(result.correctIds) : null;
  const displayedResponses = stage === "review" && result ? result.responses : responses;
  const folioTitle = useMemo(() => plainTextFromRichHtml(data.cover.titleHtml) || title?.trim() || "", [data.cover.titleHtml, title]);
  const hasCoverDescription = useMemo(() => Boolean(plainTextFromRichHtml(data.cover.descriptionHtml)), [data.cover.descriptionHtml]);
  const hasCoverImage = Boolean(coverImageSrc);
  const isMinimalCover = !hasCoverDescription && !hasCoverImage;
  const coverBackgroundColor = completeCoverBackgroundColor(data);

  useEffect(() => setStage(data.cover.enabled ? "cover" : "exercise"), [data.cover.enabled]);
  useEffect(() => setPageIndex((current) => Math.min(current, pageCount - 1)), [pageCount]);

  useLayoutEffect(() => {
    if (stage !== "cover") return;
    let scheduledFrame = 0;
    const fitCoverText = () => {
      scheduledFrame = 0;
      fitRichTextToViewport(coverTitleViewportRef.current, coverTitleContentRef.current);
      fitRichTextToViewport(coverDescriptionViewportRef.current, coverDescriptionContentRef.current);
    };
    const scheduleFit = () => {
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = window.requestAnimationFrame(fitCoverText);
    };
    scheduleFit();
    const observer = new ResizeObserver(scheduleFit);
    if (coverTitleViewportRef.current) observer.observe(coverTitleViewportRef.current);
    if (coverDescriptionViewportRef.current) observer.observe(coverDescriptionViewportRef.current);
    document.fonts?.ready.then(scheduleFit).catch(() => undefined);
    return () => {
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      observer.disconnect();
    };
  }, [stage, data.cover.titleHtml, data.cover.descriptionHtml, hasCoverDescription, hasCoverImage]);

  useLayoutEffect(() => {
    if (stage !== "ending") {
      resetRichTextFit(endingCopyContentRef.current);
      return;
    }
    const media = window.matchMedia("(max-width:700px) and (max-height:820px)");
    let scheduledFrame = 0;
    const fitEndingText = () => {
      scheduledFrame = 0;
      if (isGeckoEngine() || !media.matches) {
        resetRichTextFit(endingCopyContentRef.current);
        return;
      }
      fitRichTextToViewport(endingCopyViewportRef.current, endingCopyContentRef.current);
    };
    const scheduleFit = () => {
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = window.requestAnimationFrame(fitEndingText);
    };
    scheduleFit();
    window.addEventListener("resize", scheduleFit);
    return () => {
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      window.removeEventListener("resize", scheduleFit);
    };
  }, [stage, hasPassed, data.ending.successHtml, data.ending.failureHtml]);

  useLayoutEffect(() => {
    if (stage !== "exercise" && stage !== "review") return;
    const viewport = contentViewportRef.current;
    if (!viewport) return;

    const measureWidth = () => {
      const nextWidth = viewport.clientWidth;
      setPageWidth((current) => current === nextWidth ? current : nextWidth);
    };

    measureWidth();
    const observer = new ResizeObserver(measureWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [stage]);

  useLayoutEffect(() => {
    if ((stage !== "exercise" && stage !== "review") || !pageWidth) return;
    const flow = contentFlowRef.current;
    if (!flow) return;

    const frame = window.requestAnimationFrame(() => {
      const measuredWidth = flow.scrollWidth;
      const nextPageCount = Math.max(1, Math.ceil((measuredWidth - 1) / (pageWidth + COMPLETE_PAGE_GAP)));
      setPageCount((current) => current === nextPageCount ? current : nextPageCount);
      setPageIndex((current) => Math.min(current, nextPageCount - 1));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [documentHtml, displayedResponses, pageWidth, stage, data.orientation]);

  const validate = () => {
    const evaluation = evaluateComplete(data, responses);
    const snapshot: CompleteAttemptSnapshot = {
      attempt: currentAttempt,
      correctIds: [...evaluation.correctIds],
      passed: evaluation.passed,
      responses: { ...responses },
      score: evaluation.score
    };
    setAttemptHistory((current) => [...current, snapshot]);
    setResult(snapshot);
    setStage("result");
  };

  const restart = () => {
    if (!canRestart) return;
    setFinalReview(false);
    setResponses({});
    setResult(null);
    setPageIndex(0);
    setPageCount(1);
    setStage(data.cover.enabled ? "cover" : "exercise");
  };

  const resetToStart = () => {
    setResponses({});
    setFinalReview(false);
    setAttemptHistory([]);
    setResult(null);
    setPageIndex(0);
    setPageCount(1);
    setStage(data.cover.enabled ? "cover" : "exercise");
  };

  const finish = () => {
    if (!result) return;
    if (attemptsUnlimited && data.revealAnswersOnFinalReview && !finalReview) {
      setFinalReview(true);
      setPageIndex(0);
      setPageCount(1);
      setStage("review");
      return;
    }
    if (authoringMode) {
      resetToStart();
      return;
    }
    onComplete?.({
      score: finalScore,
      passed: hasPassed,
      bestScore: effectiveBestScore,
      lastScore: result.score,
      attemptsUsed: attemptHistory.length,
      unlimitedAttempts: attemptsUnlimited,
      scoreEligibleForLms: !attemptsUnlimited
    });
  };

  const attemptStatus = (attempt: number) => attemptsUnlimited
    ? t("complete.attemptSimple", { attempt }, "Essai {attempt}")
    : t("complete.attempt", { attempt, max: data.maxAttempts }, "Essai {attempt}/{max}");

  const renderFolioHeader = (status?: ReactNode) => (folioTitle || status ? <header className={styles.folioHeader}>
    {folioTitle ? <span className={styles.folioTitle}>{folioTitle}</span> : <span />}
    {status ? <span className={styles.folioStatus}>{status}</span> : null}
  </header> : null);
  const pageStep = pageWidth + COMPLETE_PAGE_GAP;
  const pageLabel = t("complete.page", { index: pageIndex + 1, total: pageCount }, "Page {index} / {total}");
  const pagedContent = <section aria-label={t("complete.page", { index: pageIndex + 1, total: pageCount }, "Page {index} sur {total}")} className={styles.folio}>
    {renderFolioHeader(stage === "exercise"
      ? attemptStatus(currentAttempt)
      : t("complete.review", undefined, "Relecture"))}
    <div className={styles.content}>
      <div className={styles.contentViewport} ref={contentViewportRef}>
        <div
          className={styles.contentFlow}
          ref={contentFlowRef}
          style={{
            columnGap: `${COMPLETE_PAGE_GAP}px`,
            columnWidth: pageWidth ? `${pageWidth}px` : undefined,
            transform: `translate3d(${-pageIndex * pageStep}px,0,0)`
          }}
        >
          {revealAnswers ? <p className="complete-correction-guide">{t("complete.correctionGuideIntro", undefined, "Le corrigé vous montre en vert les réponses attendues. Le symbole")} <span aria-hidden="true" className="complete-response-eye complete-response-example"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></span> {t("complete.correctionGuideEnd", undefined, "indique vos erreurs et vous permet de consulter votre réponse.")}</p> : null}
          {renderHtml(documentHtml, blanks, displayedResponses, (id, value) => setResponses((current) => ({ ...current, [id]: value })), correctIds, t("complete.response", undefined, "Réponse"), stage === "review", revealAnswers, t("quiz.yourAnswer", undefined, "Votre réponse"), t("quiz.noAnswer", undefined, "Aucune réponse"))}
        </div>
      </div>
    </div>
    {stage === "exercise" ? <nav className={styles.actions}><button disabled={pageIndex === 0} onClick={() => setPageIndex((current) => Math.max(0, current - 1))} type="button">{t("complete.previousPage", undefined, "Précédent")}</button><span className={styles.pageNumber}>{pageLabel}</span>{isLastPage ? <button onClick={validate} type="button">{t("complete.validateAttempt", undefined, "Valider votre tentative")}</button> : <button onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))} type="button">{t("complete.nextPage", undefined, "Suivant")}</button>}</nav> : <nav className={styles.actions}><button disabled={pageIndex === 0} onClick={() => setPageIndex((current) => Math.max(0, current - 1))} type="button">{t("complete.previousPage", undefined, "Précédent")}</button><span className={styles.pageNumber}>{pageLabel}</span>{isLastPage ? <button onClick={() => finalReview ? finish() : setStage("ending")} type="button">{finalReview ? t("common.continue", undefined, "Continuer") : t("complete.nextPage", undefined, "Suivant")}</button> : <button onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))} type="button">{t("complete.nextPage", undefined, "Suivant")}</button>}</nav>}
  </section>;

  const isFinalLimitedAttempt = Boolean(result && !attemptsUnlimited && result.attempt >= data.maxAttempts);
  const finalScore = result ? (attemptsUnlimited ? result.score : effectiveBestScore) : 0;
  const footerCanRestart = Boolean(canRestart && !attemptsUnlimited);
  const trainingCanRestart = Boolean(canRestart && attemptsUnlimited);
  const restartLabel = t("common.restart", undefined, "Recommencer");
  const successThresholdLabel = t("complete.successThreshold", undefined, "Seuil de réussite (%)")
    .replace(/\s*\(%\)\s*$/, "")
    .trim();

  return <section className={`${styles.activity} ${data.orientation === "landscape" ? styles.landscape : ""}`}>
    {stage === "cover" ? <section aria-label={t("complete.cover", undefined, "Couverture")} className={`${styles.folio} ${styles.cover} ${isMinimalCover ? styles.coverMinimal : ""}`} style={{ backgroundColor: coverBackgroundColor }}>
      <div className={styles.coverHeader}><div className={styles.coverTitleViewport} ref={coverTitleViewportRef}><div className={`${styles.coverTitle} rich-content`} dangerouslySetInnerHTML={{ __html: data.cover.titleHtml }} ref={coverTitleContentRef} /></div></div>
      {!isMinimalCover ? <div className={`${styles.coverBody} ${hasCoverDescription ? styles.coverBodyWithDescription : ""} ${hasCoverImage ? styles.coverBodyWithImage : styles.coverBodyWithoutImage}`}>
        {hasCoverDescription ? <div className={styles.coverDescriptionViewport} ref={coverDescriptionViewportRef}><div className={`${styles.coverDescription} rich-content`} dangerouslySetInnerHTML={{ __html: data.cover.descriptionHtml }} ref={coverDescriptionContentRef} /></div> : null}
        {coverImageSrc ? <CroppedImage alt={coverImageAlt} className={styles.coverImage} crop={coverImageCrop ?? null} rounded={coverImageRounded} src={coverImageSrc} /> : null}
      </div> : null}
      <nav className={`${styles.actions} ${styles.coverActions}`}><button onClick={() => { setPageIndex(0); setStage("exercise"); }} type="button">{t("complete.nextPage", undefined, "Suivant")}</button></nav>
    </section> : null}
    {stage === "exercise" || stage === "review" ? pagedContent : null}
    {stage === "result" && result ? <section className={`${styles.folio} ${styles.resultPage}`}>{renderFolioHeader(attemptStatus(result.attempt))}<div className={styles.resultCopy}><strong>{result.passed ? t("complete.success", undefined, "Réussite") : t("complete.attemptResult", undefined, "Résultat de la tentative")}</strong>{isFinalLimitedAttempt ? <><span>{t("complete.lastAttemptScore", { score: result.score }, "Dernière tentative : {score} %")}</span><span className={styles.secondaryScore}>{t("complete.bestScore", { score: effectiveBestScore }, "Meilleur score : {score} %")}</span></> : <span>{t("complete.score", { score: result.score }, "Score : {score} %")}</span>}<p>{t("complete.reviewNext", undefined, "Cliquez sur Suivant pour accéder à la relecture.")}</p></div><nav className={`${styles.actions} ${styles.coverActions}`}><button onClick={() => { setPageIndex(0); setPageCount(1); setStage("review"); }} type="button">{t("complete.nextPage", undefined, "Suivant")}</button></nav></section> : null}
    {stage === "ending" && result ? <section className={`${styles.folio} ${styles.endingPage}`}>{renderFolioHeader()}<div className={`${styles.endingBody} ${trainingCanRestart ? "" : styles.endingBodyNoTrainingRestart}`}><div className={styles.endingScoreBox}><span>{t("complete.score", { score: finalScore }, "Score : {score} %")}</span><span className={styles.endingThreshold}>({successThresholdLabel} {data.successThreshold} %)</span></div><div aria-hidden="true" className={styles.endingDecorationArea}><span className={styles.endingDecoration} /></div><div className={styles.endingCopyViewport} ref={endingCopyViewportRef}><div className={`${styles.endingCopy} rich-content`} dangerouslySetInnerHTML={{ __html: hasPassed ? data.ending.successHtml : data.ending.failureHtml }} ref={endingCopyContentRef} /></div>{trainingCanRestart ? <div className={styles.endingRestartArea}><button aria-label={restartLabel} className={styles.endingTrainingRestart} onClick={restart} type="button">↻</button></div> : null}</div><nav className={`${styles.actions} ${styles.coverActions} ${!footerCanRestart && canContinue ? styles.endingActionsContinueOnly : ""}`}>{footerCanRestart ? <button onClick={restart} type="button">{restartLabel}</button> : null}{canContinue ? <button onClick={finish} type="button">{t("common.continue", undefined, "Continuer")}</button> : null}</nav></section> : null}
  </section>;
}
