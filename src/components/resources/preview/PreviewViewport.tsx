import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import aframeRuntimeModuleUrl from "./previewAframeRuntime.ts?worker&url";
import { useI18n } from "../../../i18n/react";
import "./PreviewResponsiveSwitcher.css";

type PreviewViewportProps = {
  width: number;
  height: number;
  children: ReactNode;
  lessonStyle?: CSSProperties;
  chapterMenuActive?: boolean;
};

function ensureFrameDocument(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument;
  if (!doc) {
    return null;
  }

  if (!doc.getElementById("paideia-preview-viewport-root")) {
    doc.open();
    doc.write(
      "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"></head><body><div id=\"paideia-preview-viewport-root\"></div></body></html>"
    );
    doc.close();
  }

  return doc;
}

function syncFrameHead(doc: Document) {
  let baseNode = doc.head.querySelector("base[data-paideia-preview-base='true']") as HTMLBaseElement | null;
  if (!baseNode) {
    baseNode = doc.createElement("base");
    baseNode.setAttribute("data-paideia-preview-base", "true");
    doc.head.prepend(baseNode);
  }
  baseNode.href = document.baseURI;

  const sourceNodes = [
    ...Array.from(document.head.querySelectorAll("style, link[rel='stylesheet']")),
    ...Array.from(document.querySelectorAll("style[data-paideia-preview-source-style='true']"))
  ];
  doc.head.querySelectorAll("[data-paideia-preview-clone='true']").forEach((node) => node.remove());

  sourceNodes.forEach((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute("data-paideia-preview-clone", "true");
    doc.head.appendChild(clone);
  });

  const bridgeStyle = doc.createElement("style");
  bridgeStyle.setAttribute("data-paideia-preview-clone", "true");
  bridgeStyle.textContent = `
    html, body {
      margin: 0;
      min-height: 100%;
      background: #fff;
    }
    body {
      overflow-x: hidden;
      overflow-y: auto;
    }
    #paideia-preview-viewport-root {
      min-height: 100%;
    }
  `;
  doc.head.appendChild(bridgeStyle);
}

function ensureFrameRuntime(doc: Document) {
  if (
    (
      doc.defaultView as
        | (Window & {
            __PAIDEIA_PREVIEW_RUNTIME_READY?: boolean;
            Plyr?: unknown;
            __PAIDEIA_PLYR_ICON_URL?: string;
            AFRAME?: unknown;
          })
        | null
    )?.__PAIDEIA_PREVIEW_RUNTIME_READY === true
  ) {
    return Promise.resolve();
  }

  const existingScript = doc.getElementById("paideia-preview-aframe-runtime") as HTMLScriptElement | null;
  if (existingScript) {
    if (existingScript.dataset.ready === "true") {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Impossible de charger le runtime A-Frame dans l'iframe de preview.")), {
        once: true
      });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = doc.createElement("script");
    script.id = "paideia-preview-aframe-runtime";
    script.type = "module";
    script.src = aframeRuntimeModuleUrl;
    script.async = false;
    script.addEventListener(
      "load",
      () => {
        script.dataset.ready = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => reject(new Error("Impossible de charger le runtime A-Frame dans l'iframe de preview.")),
      { once: true }
    );
    doc.head.appendChild(script);
  });
}

export function PreviewViewport({ width, height, children, lessonStyle, chapterMenuActive = false }: PreviewViewportProps) {
  const { t } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);
  const [runtimeReady, setRuntimeReady] = useState(false);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) {
      return;
    }

    let headSyncFrame: number | null = null;

    const scheduleHeadSync = () => {
      if (headSyncFrame !== null) {
        return;
      }
      headSyncFrame = window.requestAnimationFrame(() => {
        headSyncFrame = null;
        const doc = frame.contentDocument;
        if (doc?.head) {
          syncFrameHead(doc);
        }
      });
    };

    const setupFrame = () => {
      const doc = ensureFrameDocument(frame);
      if (!doc) {
        return;
      }
      syncFrameHead(doc);
      setRuntimeReady(false);
      ensureFrameRuntime(doc)
        .then(() => {
          setMountNode(doc.getElementById("paideia-preview-viewport-root"));
          setRuntimeReady(true);
        })
        .catch(() => {
          setMountNode(doc.getElementById("paideia-preview-viewport-root"));
          setRuntimeReady(true);
        });
    };

    setupFrame();
    frame.addEventListener("load", setupFrame);
    const headObserver = new MutationObserver(scheduleHeadSync);
    headObserver.observe(document.head, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    document.querySelectorAll("style[data-paideia-preview-source-style='true']").forEach((styleNode) => {
      headObserver.observe(styleNode, {
        characterData: true,
        childList: true,
        subtree: true
      });
    });
    return () => {
      frame.removeEventListener("load", setupFrame);
      headObserver.disconnect();
      if (headSyncFrame !== null) {
        window.cancelAnimationFrame(headSyncFrame);
      }
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const computeScale = () => {
      const rect = shell.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth ?? document.documentElement.clientWidth;
      const workspaceShell = shell.closest(".workspace-shell");
      const workspaceRect =
        workspaceShell instanceof HTMLElement ? workspaceShell.getBoundingClientRect() : document.documentElement.getBoundingClientRect();
      const visibleBottom = workspaceRect.bottom;
      const availableWidth = Math.max(0, shell.clientWidth - 32);
      const visibleHeight = Math.max(0, visibleBottom - rect.top - 16);
      const measuredHeight = Math.max(0, shell.clientHeight - 32);
      const availableHeight = Math.max(0, Math.min(measuredHeight, visibleHeight - 16));
      const boundedWidth = Math.max(0, Math.min(availableWidth, viewportWidth - Math.max(0, rect.left * 2) - 16));
      const nextScale = Math.min(1, boundedWidth / width, availableHeight / height);
      setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    computeScale();
    const observer = "ResizeObserver" in window ? new ResizeObserver(computeScale) : null;
    observer?.observe(shell);
    if (shell.parentElement) {
      observer?.observe(shell.parentElement);
    }
    const workspaceShell = shell.closest(".workspace-shell");
    if (workspaceShell instanceof HTMLElement) {
      observer?.observe(workspaceShell);
    }
    window.addEventListener("resize", computeScale);
    window.visualViewport?.addEventListener("resize", computeScale);
    window.visualViewport?.addEventListener("scroll", computeScale);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", computeScale);
      window.visualViewport?.removeEventListener("resize", computeScale);
      window.visualViewport?.removeEventListener("scroll", computeScale);
    };
  }, [height, width]);

  const frameStyle = useMemo(
    () =>
      ({
        width: `${width * scale}px`,
        height: `${height * scale}px`
      }) as CSSProperties,
    [height, scale, width]
  );

  const iframeStyle = useMemo(
    () =>
      ({
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${scale})`
      }) as CSSProperties,
    [height, scale, width]
  );

  return (
    <div className="preview-viewport-shell" ref={shellRef}>
      <div className="preview-viewport-stage">
        <div className="preview-viewport-box" style={frameStyle}>
          <iframe className="preview-viewport-iframe" ref={iframeRef} scrolling="auto" style={iframeStyle} title={t("preview.responsiveLmsTitle")} />
        </div>
      </div>
      {mountNode && runtimeReady
        ? createPortal(
            <div className="linear-shell preview-mode workspace-shell preview-responsive-document" style={lessonStyle}>
            <main className={`authoring-stage ${chapterMenuActive ? "chapter-menu-active" : ""}`}>{children}</main>
            </div>,
            mountNode
          )
        : null}
    </div>
  );
}
