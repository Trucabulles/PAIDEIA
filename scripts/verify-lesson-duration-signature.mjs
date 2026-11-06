import { rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { build } from "vite";

const outputDirectory = resolve(".tmp-lesson-duration-signature-contract");

try {
  await build({
    configFile: false,
    logLevel: "warn",
    build: {
      ssr: resolve("scripts/lesson-duration-signature-contract.ts"),
      outDir: outputDirectory,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: "contract.mjs",
          format: "es"
        }
      }
    }
  });
  await import(`${pathToFileURL(resolve(outputDirectory, "contract.mjs")).href}?v=${Date.now()}`);
} finally {
  await rm(outputDirectory, { force: true, recursive: true });
}
