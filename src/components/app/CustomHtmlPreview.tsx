import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logDevEvent } from "../../lib/projectApi";
import { useI18n } from "../../i18n/react";

const CUSTOM_HTML_SANDBOX_URL = new URL("html-sandbox.html", document.baseURI).toString();

function injectHtmlBaseUrl(html: string, baseUrl?: string | null) {
  if (!baseUrl || /<base\b/i.test(html)) {
    return html;
  }
  const base = `<base href="${baseUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (head) => `${head}${base}`);
  }
  return `${base}${html}`;
}

function buildDirectHtmlSandboxDocument(html: string, blockId: string, baseUrl?: string | null) {
  const bridge = `<script data-paideia-direct-sandbox>
(() => {
  if (window.__paideiaDirectSandboxReady) return;
  window.__paideiaDirectSandboxReady = true;
  const blockId = ${JSON.stringify(blockId)};
  let lastHeight = 0;
  let raf = 0;
  const post = (type, details = {}) => {
    window.parent.postMessage({
      source: "paideia-html-sandbox",
      type,
      blockId,
      ...details
    }, "*");
  };
  const report = () => {
    raf = 0;
    // The root scroll height is at least the iframe viewport height. Using it
    // alongside the body would keep a previously tall frame from shrinking.
    const bodyHeight = document.body
      ? Math.max(document.body.scrollHeight, document.body.offsetHeight, Math.ceil(document.body.getBoundingClientRect().height))
      : 0;
    const rootHeight = document.body ? 0 : (document.documentElement ? document.documentElement.scrollHeight : 0);
    const height = Math.max(bodyHeight, rootHeight, 680);
    if (height !== lastHeight) {
      lastHeight = height;
      post("resize", { height });
    }
  };
  const schedule = () => {
    if (!raf) raf = window.requestAnimationFrame(report);
  };
  window.addEventListener("load", () => {
    schedule();
    post("content-load");
  });
  window.addEventListener("resize", schedule);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);
  }
  schedule();
  setTimeout(schedule, 250);
  setTimeout(schedule, 1000);
})();
<\/script>`;

  const htmlWithBase = injectHtmlBaseUrl(html, baseUrl);
  if (htmlWithBase.includes("data-paideia-direct-sandbox")) {
    return htmlWithBase;
  }
  if (/<\/body>/i.test(htmlWithBase)) {
    return htmlWithBase.replace(/<\/body>/i, `${bridge}</body>`);
  }
  return `${htmlWithBase}${bridge}`;
}

type CustomHtmlPreviewProps = {
  assetBaseUrl?: string | null;
  blockId: string;
  enableViewportUnload?: boolean;
  requireManualExternalIframeActivation?: boolean;
  html: string;
  layout: string;
  title: string;
};

export const CustomHtmlPreview = memo(function CustomHtmlPreview({
  assetBaseUrl,
  blockId,
  enableViewportUnload = false,
  requireManualExternalIframeActivation = false,
  html,
  layout,
  title
}: CustomHtmlPreviewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const loadStartRef = useRef(performance.now());
  const suspendedHeightRef = useRef(680);
  const viewportUnloadTimerRef = useRef<number | null>(null);
  const hasExternalIframe = useMemo(() => /<iframe\b[^>]*\bsrc=["']https?:\/\//i.test(html), [html]);
  // Imported local packages use the same direct sandbox as pasted HTML. Their
  // relative resources resolve through the base URL injected into the document.
  const usesNestedSandbox = hasExternalIframe;
  const directSandboxDocument = useMemo(
    () =>
      usesNestedSandbox
        ? undefined
        : buildDirectHtmlSandboxDocument(html, blockId, assetBaseUrl),
    [assetBaseUrl, blockId, html, usesNestedSandbox]
  );
  const shouldUnloadOffscreen = enableViewportUnload && hasExternalIframe;
  const [isViewportActive, setIsViewportActive] = useState(!shouldUnloadOffscreen);
  const [isExternalIframeActivated, setIsExternalIframeActivated] = useState(
    !requireManualExternalIframeActivation || !hasExternalIframe
  );
  const [isDragSuspended, setIsDragSuspended] = useState(false);
  // Dragging only shields the iframe from pointer input. Destroying it here
  // caused expensive reloads and delayed editor refreshes after mutations.
  const shouldActivateSandbox = isViewportActive && isExternalIframeActivated;

  useEffect(() => {
    loadStartRef.current = performance.now();
  }, [html]);

  const postToSandbox = useCallback((type: "update" | "set-active") => {
    if (!usesNestedSandbox) {
      return;
    }
    const contentWindow = frameRef.current?.contentWindow;
    if (!contentWindow) {
      return;
    }
    contentWindow.postMessage(
      {
        source: "paideia-html-host",
        type,
        blockId,
        html,
        assetBaseUrl,
        title,
        active: shouldActivateSandbox
      },
      "*"
    );
  }, [assetBaseUrl, blockId, html, shouldActivateSandbox, title, usesNestedSandbox]);

  useEffect(() => {
    setIsExternalIframeActivated(!requireManualExternalIframeActivation || !hasExternalIframe);
  }, [blockId, hasExternalIframe, html, requireManualExternalIframeActivation]);

  useEffect(() => {
    const handleExternalIframeSuspension = (event: Event) => {
      const suspended = Boolean((event as CustomEvent<{ suspended?: boolean }>).detail?.suspended);
      const container = containerRef.current;
      if (suspended && container) {
        suspendedHeightRef.current = Math.max(680, Math.round(container.getBoundingClientRect().height));
      }
      setIsDragSuspended(suspended);
    };

    window.addEventListener("paideia:set-external-iframe-suspended", handleExternalIframeSuspension);
    return () =>
      window.removeEventListener("paideia:set-external-iframe-suspended", handleExternalIframeSuspension);
  }, []);

  useEffect(() => {
    postToSandbox("update");
  }, [blockId, html, postToSandbox, shouldActivateSandbox, title]);

  useEffect(() => {
    const ownerWindow = frameRef.current?.ownerDocument.defaultView ?? window;
    const handleSandboxMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) {
        return;
      }
      const message = event.data;
      if (message?.source !== "paideia-html-sandbox" || message.blockId !== blockId) {
        return;
      }
      if (message.type === "ready") {
        postToSandbox("update");
        return;
      }
      if (message.type === "resize") {
        const height = Math.max(680, Math.ceil(Number(message.height) || 0));
        suspendedHeightRef.current = height;
        if (frameRef.current) {
          frameRef.current.style.height = `${height}px`;
        }
        return;
      }
      if (message.type === "content-load") {
        void logDevEvent("info", "custom-html.sandbox.content-loaded", {
          blockId,
          hasExternalIframe,
          htmlLength: html.length,
          loadAfterMs: Math.round(performance.now() - loadStartRef.current),
          title
        });
      }
    };

    ownerWindow.addEventListener("message", handleSandboxMessage);
    return () => ownerWindow.removeEventListener("message", handleSandboxMessage);
  }, [blockId, hasExternalIframe, html.length, postToSandbox, title]);

  useEffect(() => {
    if (!hasExternalIframe) {
      return;
    }
    return () => {
      void logDevEvent("info", "custom-html.iframe.component-unmounted", {
        blockId,
        htmlLength: html.length,
        title
      });
    };
  }, [blockId, hasExternalIframe, html.length, title]);

  useEffect(() => {
    if (!shouldUnloadOffscreen) {
      setIsViewportActive(true);
      return;
    }

    const container = containerRef.current;
    if (!container || !("IntersectionObserver" in window)) {
      setIsViewportActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (document.documentElement.classList.contains("paideia-pointer-drag-active")) {
          return;
        }
        const isNearViewport = entries.some((entry) => entry.isIntersecting);
        if (viewportUnloadTimerRef.current !== null) {
          window.clearTimeout(viewportUnloadTimerRef.current);
          viewportUnloadTimerRef.current = null;
        }

        if (isNearViewport) {
          setIsViewportActive((current) => {
            if (current) {
              return current;
            }
            loadStartRef.current = performance.now();
            void logDevEvent("info", "custom-html.iframe.viewport-mounted", {
              blockId,
              htmlLength: html.length,
              title
            });
            return true;
          });
          return;
        }

        viewportUnloadTimerRef.current = window.setTimeout(() => {
          if (document.documentElement.classList.contains("paideia-pointer-drag-active")) {
            return;
          }
          suspendedHeightRef.current = Math.max(680, Math.round(container.getBoundingClientRect().height));
          setIsViewportActive((current) => {
            if (!current) {
              return current;
            }
            void logDevEvent("info", "custom-html.iframe.viewport-unmounted", {
              blockId,
              htmlLength: html.length,
              title
            });
            return false;
          });
          viewportUnloadTimerRef.current = null;
        }, 900);
      },
      {
        root: null,
        rootMargin: "900px 0px",
        threshold: 0.01
      }
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (viewportUnloadTimerRef.current !== null) {
        window.clearTimeout(viewportUnloadTimerRef.current);
        viewportUnloadTimerRef.current = null;
      }
    };
  }, [blockId, html.length, shouldUnloadOffscreen, title]);

  return (
    <div className={`custom-html-block ${layout === "full-width" ? "full-width" : ""}`} ref={containerRef}>
      <iframe
        className="custom-html-frame custom-html-sandbox-host"
        onLoad={() => {
          if (usesNestedSandbox) {
            postToSandbox("update");
          }
        }}
        ref={frameRef}
        sandbox={
          usesNestedSandbox
            ? "allow-presentation allow-scripts"
            : "allow-forms allow-modals allow-popups allow-pointer-lock allow-presentation allow-same-origin allow-scripts"
        }
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
        allowFullScreen
        scrolling="no"
        src={usesNestedSandbox ? CUSTOM_HTML_SANDBOX_URL : undefined}
        srcDoc={directSandboxDocument}
        style={{ height: `${suspendedHeightRef.current}px` }}
        title={title || t("htmlCustom.title")}
      />
      {!shouldActivateSandbox || isDragSuspended ? (
        <div
          className="custom-html-frame-suspended custom-html-sandbox-overlay"
          style={{ height: `${suspendedHeightRef.current}px` }}
        >
          {hasExternalIframe && requireManualExternalIframeActivation && !isExternalIframeActivated ? (
            <button
              className="custom-html-frame-resume"
              onClick={() => {
                loadStartRef.current = performance.now();
                setIsExternalIframeActivated(true);
              }}
              type="button"
            >
              {t("htmlCustom.loadInteractiveContent")}
            </button>
          ) : isDragSuspended ? (
            t("htmlCustom.dragProtected")
          ) : (
            t("htmlCustom.offscreenPaused")
          )}
        </div>
      ) : null}
    </div>
  );
});
