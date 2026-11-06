import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

declare global {
  interface Window { __PAIDEIA_SURFACE__?: "arion"; }
}

async function mountRequestedSurface() {
  let surface: string | null = window.__PAIDEIA_SURFACE__ ?? new URLSearchParams(window.location.search).get("surface");
  if (!surface && window.__TAURI_INTERNALS__?.invoke) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    if (getCurrentWindow().label === "arion") surface = "arion";
  }
  const Component = surface === "arion"
    ? (await import("./features/designer-actions/ArionDetachedWindow")).ArionDetachedWindow
    : (await import("./App")).default;
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Component />);
}

void mountRequestedSurface().catch((error) => {
  const root = document.getElementById("root");
  if (!root) return;
  root.textContent = `Échec du chargement de l’interface : ${error instanceof Error ? error.message : String(error)}`;
  root.style.padding = "24px";
  root.style.color = "#8b2f21";
  root.style.fontFamily = "system-ui, sans-serif";
});
