import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PaideiaProject } from "../../types/project";
import { collectRichTextBookmarks, RICH_REFERENCE_ATTR, RICH_REFERENCE_TARGET_ATTR } from "./richTextBookmarks";
import { useI18n } from "../../i18n/react";

type ActiveReference = {
  id: string;
  x: number;
  y: number;
  ownerDocument: Document;
  maxHeight?: number;
};

export function RichTextReferenceTooltip({ project }: { project: PaideiaProject | null | undefined }) {
  const { t } = useI18n();
  const bookmarks = useMemo(() => collectRichTextBookmarks(project), [project]);
  const [active, setActive] = useState<ActiveReference | null>(null);
  const activeRef = useRef<ActiveReference | null>(null);
  const tooltipRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const pinnedTriggerRef = useRef<HTMLElement | null>(null);
  const TOOLTIP_ID = "paideia-rich-reference-tooltip-active";

  const persistedBookmark = active ? bookmarks.find((item) => item.id === active.id) : null;
  const activeDocument = active?.ownerDocument ?? document;
  const liveBookmarkNode = active
    ? Array.from(activeDocument.querySelectorAll<HTMLElement>("[data-paideia-bookmark-id]")).find(
        (node) => node.getAttribute("data-paideia-bookmark-id") === active.id
      )
    : null;
  const bookmark = persistedBookmark ?? (liveBookmarkNode ? {
    label: liveBookmarkNode.getAttribute("data-paideia-bookmark-label") || t("richText.bookmark", undefined, "Balise"),
    html: liveBookmarkNode.innerHTML
  } : active ? (() => {
    const trigger = Array.from(activeDocument.querySelectorAll<HTMLElement>(`[${RICH_REFERENCE_ATTR}]`))
      .find((node) => node.getAttribute(RICH_REFERENCE_TARGET_ATTR) === active.id);
    const html = trigger?.getAttribute("data-paideia-reference-definition");
    return html ? { label: trigger?.getAttribute("data-paideia-bookmark-label") || "", html } : null;
  })() : null);

  useEffect(() => {
    const nodeFromTarget = (target: EventTarget | null) =>
      target && typeof target === "object" && "nodeType" in target ? target as Node : null;

    const triggerFor = (target: EventTarget | null) => {
      const node = nodeFromTarget(target);
      const element = node?.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node?.parentElement;
      return element?.closest<HTMLElement>(`[${RICH_REFERENCE_ATTR}]`) ?? null;
    };

    const clearTriggerAria = (trigger: HTMLElement | null | undefined) => {
      if (!trigger) return;
      trigger.setAttribute("aria-expanded", "false");
      if (trigger.getAttribute("aria-describedby") === TOOLTIP_ID) {
        trigger.removeAttribute("aria-describedby");
      }
    };

    const show = (trigger: HTMLElement) => {
      const id = trigger.getAttribute(RICH_REFERENCE_TARGET_ATTR) ?? "";
      const rect = trigger.getBoundingClientRect();
      const ownerDocument = trigger.ownerDocument;

      if (triggerRef.current && triggerRef.current !== trigger) {
        clearTriggerAria(triggerRef.current);
      }

      triggerRef.current = trigger;
      const nextActive = { id, x: Math.max(16, rect.left), y: rect.bottom + 8, ownerDocument };
      activeRef.current = nextActive;
      setActive(nextActive);
      trigger.setAttribute("aria-expanded", "true");
      trigger.setAttribute("aria-describedby", TOOLTIP_ID);
    };

    const hide = (trigger?: HTMLElement | null, preservePin = false) => {
      const currentTrigger = triggerRef.current;
      if (trigger && currentTrigger && trigger !== currentTrigger) return;
      clearTriggerAria(trigger ?? currentTrigger);
      triggerRef.current = null;
      activeRef.current = null;
      setActive(null);
      if (!preservePin) pinnedTriggerRef.current = null;
    };

    const pin = (trigger: HTMLElement) => {
      if (pinnedTriggerRef.current === trigger) {
        hide(trigger);
        return;
      }
      if (pinnedTriggerRef.current && pinnedTriggerRef.current !== trigger) {
        clearTriggerAria(pinnedTriggerRef.current);
      }
      pinnedTriggerRef.current = trigger;
      show(trigger);
    };

    const isInsideTooltip = (target: EventTarget | null) => {
      const node = nodeFromTarget(target);
      return Boolean(node && tooltipRef.current?.contains(node));
    };

    const over = (event: PointerEvent) => {
      if (pinnedTriggerRef.current) return;
      if (event.pointerType === "touch" || event.pointerType === "pen") return;
      const trigger = triggerFor(event.target);
      if (trigger) show(trigger);
    };

    const out = (event: PointerEvent) => {
      if (pinnedTriggerRef.current) return;
      if (event.pointerType === "touch" || event.pointerType === "pen") return;

      const trigger = triggerFor(event.target);
      const relatedTrigger = triggerFor(event.relatedTarget);
      if (trigger) {
        if (relatedTrigger === trigger || isInsideTooltip(event.relatedTarget)) return;
        hide(trigger);
        return;
      }

      if (isInsideTooltip(event.target)) {
        if (isInsideTooltip(event.relatedTarget) || relatedTrigger === triggerRef.current) return;
        hide();
      }
    };

    const focus = (event: FocusEvent) => {
      if (pinnedTriggerRef.current) return;
      const trigger = triggerFor(event.target);
      if (trigger) show(trigger);
    };

    const blur = (event: FocusEvent) => {
      if (pinnedTriggerRef.current) return;
      const trigger = triggerFor(event.target);
      if (!trigger) return;
      if (isInsideTooltip(event.relatedTarget)) return;
      hide(trigger);
    };

    const click = (event: MouseEvent) => {
      const trigger = triggerFor(event.target);
      if (trigger) {
        event.preventDefault();
        event.stopPropagation();
        pin(trigger);
        return;
      }

      if (isInsideTooltip(event.target)) return;
      if (activeRef.current) hide();
    };

    const key = (event: KeyboardEvent) => {
      const trigger = triggerFor(event.target);
      if (event.key === "Escape") {
        hide();
        return;
      }
      if (!trigger || (event.key !== "Enter" && event.key !== " ")) return;

      event.preventDefault();
      pin(trigger);
    };

    const boundDocuments = new Set<Document>();
    const frameLoadHandlers = new Map<HTMLIFrameElement, () => void>();

    const bindDocument = (doc: Document | null) => {
      if (!doc || boundDocuments.has(doc)) return;
      boundDocuments.add(doc);
      doc.addEventListener("pointerover", over);
      doc.addEventListener("pointerout", out);
      doc.addEventListener("focusin", focus);
      doc.addEventListener("focusout", blur);
      doc.addEventListener("click", click);
      doc.addEventListener("keydown", key);
    };

    const bindFrame = (frame: HTMLIFrameElement) => {
      if (!frameLoadHandlers.has(frame)) {
        const handleLoad = () => bindDocument(frame.contentDocument);
        frameLoadHandlers.set(frame, handleLoad);
        frame.addEventListener("load", handleLoad);
      }
      bindDocument(frame.contentDocument);
    };

    const bindPreviewFrames = () => {
      document.querySelectorAll<HTMLIFrameElement>(".preview-viewport-iframe").forEach(bindFrame);
    };

    bindDocument(document);
    bindPreviewFrames();

    const observer = new MutationObserver(bindPreviewFrames);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      hide();
      boundDocuments.forEach((doc) => {
        doc.removeEventListener("pointerover", over);
        doc.removeEventListener("pointerout", out);
        doc.removeEventListener("focusin", focus);
        doc.removeEventListener("focusout", blur);
        doc.removeEventListener("click", click);
        doc.removeEventListener("keydown", key);
      });
      frameLoadHandlers.forEach((handler, frame) => frame.removeEventListener("load", handler));
    };
  }, []);

  useLayoutEffect(() => {
    if (!active || !tooltipRef.current || !triggerRef.current) return;

    const GAP = 8;
    const VIEWPORT_MARGIN = 16;
    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const view = active.ownerDocument.defaultView ?? window;

    const naturalWidth = tooltip.offsetWidth;
    const naturalHeight = tooltip.scrollHeight;
    const availableBelow = Math.max(0, view.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN);
    const availableAbove = Math.max(0, rect.top - GAP - VIEWPORT_MARGIN);

    const x = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        view.innerWidth - naturalWidth - VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, rect.left)
      )
    );

    let y: number;
    let maxHeight: number | undefined;

    if (naturalHeight <= availableBelow) {
      y = rect.bottom + GAP;
    } else if (naturalHeight <= availableAbove) {
      y = rect.top - GAP - naturalHeight;
    } else if (availableAbove > availableBelow) {
      maxHeight = availableAbove;
      y = rect.top - GAP - Math.min(naturalHeight, availableAbove);
    } else {
      maxHeight = availableBelow;
      y = rect.bottom + GAP;
    }

    y = Math.max(VIEWPORT_MARGIN, y);

    setActive((current) => {
      if (!current) return current;
      const nextMaxHeight = maxHeight && maxHeight > 0 ? Math.floor(maxHeight) : undefined;
      const nextX = Math.round(x);
      const nextY = Math.round(y);
      if (current.x === nextX && current.y === nextY && current.maxHeight === nextMaxHeight) return current;
      return { ...current, x: nextX, y: nextY, maxHeight: nextMaxHeight };
    });
  }, [active?.id, active?.x, active?.y, active?.ownerDocument, bookmark?.html]);

  useEffect(() => {
    if (!active) return;
    const view = active.ownerDocument.defaultView ?? window;
    const reposition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setActive((current) => current ? {
        ...current,
        x: Math.max(16, rect.left),
        y: rect.bottom + 8,
        maxHeight: undefined
      } : current);
    };
    view.addEventListener("resize", reposition);
    view.addEventListener("scroll", reposition, true);
    return () => {
      view.removeEventListener("resize", reposition);
      view.removeEventListener("scroll", reposition, true);
    };
  }, [active?.id, active?.ownerDocument]);

  if (!active) return null;

  const tooltip = (
    <aside
      ref={tooltipRef}
      id={TOOLTIP_ID}
      className="paideia-rich-reference-tooltip"
      role="tooltip"
      style={{
        left: active.x,
        top: active.y,
        maxHeight: active.maxHeight,
        overflowY: active.maxHeight ? "auto" : undefined
      }}
    >
      {bookmark
        ? <div className="rich-content" dangerouslySetInnerHTML={{ __html: bookmark.html }} />
        : <p>{t("richText.brokenReference", undefined, "Renvoi cassé : balise introuvable.")}</p>}
    </aside>
  );

  return active.ownerDocument === document
    ? tooltip
    : createPortal(tooltip, active.ownerDocument.body);
}
