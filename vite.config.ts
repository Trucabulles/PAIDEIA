import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { pdfA4DevPlugin } from "./scripts/pdf-a4-dev-plugin";

function sanitizeToastUiCss(): Plugin {
  return {
    name: "sanitize-toast-ui-css",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/");
      const isToastCss =
        normalizedId.includes("/node_modules/tui-image-editor/") ||
        normalizedId.includes("/node_modules/tui-color-picker/");

      if (!isToastCss || !normalizedId.includes(".css")) {
        return null;
      }

      const sanitizedCode = code
        .replace(/\*display\s*:\s*inline\s*;/g, "display: inline;")
        .replace(/backbround-color/g, "background-color");

      return sanitizedCode === code ? null : { code: sanitizedCode, map: null };
    }
  };
}

export default defineConfig({
  plugins: [sanitizeToastUiCss(), react(), pdfA4DevPlugin()],
  server: {
    port: 1420,
    strictPort: true
  }
});
