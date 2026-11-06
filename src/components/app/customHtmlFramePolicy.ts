// Politique du rendu interne. Pour réactiver les iframes distantes dans
// PAIDEIA, retirer l’appel à cette fonction dans CustomHtmlPreview.
export function applyCustomHtmlFramePolicy(html: string, assetBaseUrl: string | null | undefined, notice: string) {
  const localOrigins = [window.location.origin, new URL(assetBaseUrl || document.baseURI, document.baseURI).origin]
    .filter((origin, index, origins) => /^https?:\/\//.test(origin) && origins.indexOf(origin) === index);
  const sources = ["about:", "blob:", "data:", "file:", "asset:", "tauri:", ...localOrigins];
  const encodedNotice = JSON.stringify(notice).replace(/</g, "\\u003c");
  const policy = `<meta http-equiv="Content-Security-Policy" content="frame-src ${sources.join(" ")}">
<script>
(() => {
  const localOrigins = ${JSON.stringify(localOrigins)};
  const showBlockedFrames = () => {
    for (const frame of document.querySelectorAll("iframe[src]:not([srcdoc])")) {
      let url;
      try { url = new URL(frame.getAttribute("src"), document.baseURI); } catch { continue; }
      if (!/^https?:$/.test(url.protocol) || localOrigins.includes(url.origin)) continue;
      const notice = document.createElement("p");
      notice.textContent = ${encodedNotice};
      notice.setAttribute("role", "note");
      notice.style.cssText = "padding: 12px; border: 1px solid #c5d2e6; border-radius: 8px; background: #f4f7fc; color: #17345e;";
      frame.replaceWith(notice);
    }
  };
  // La CSP bloque la navigation avant que l’observateur puisse afficher l’avis.
  const observer = new MutationObserver(showBlockedFrames);
  observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcdoc", "href"] });
  document.addEventListener("DOMContentLoaded", showBlockedFrames, { once: true });
})();
</script>`;
  // Conserver le mode de rendu du document et poser la CSP avant son contenu.
  const prefix = html.match(/^\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\s+[^>]+>\s*)?(?:<html\b[^>]*>\s*)?(?:<head\b[^>]*>\s*)?/i)?.[0] ?? "";
  return prefix + policy + html.slice(prefix.length);
}
