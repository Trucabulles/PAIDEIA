import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { resolve } from "node:path";
import { paideiaBuildCommit } from "./paideia-build-metadata.mjs";

const rootDir = resolve(".");
process.env.VITE_PAIDEIA_GIT_COMMIT = paideiaBuildCommit(rootDir);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function verifyNoPackagedUserPaths(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await verifyNoPackagedUserPaths(path);
      continue;
    }
    if (![".css", ".html", ".js", ".json", ".map"].includes(extname(entry.name).toLowerCase())) {
      continue;
    }
    const content = (await readFile(path, "utf8")).replaceAll("\\\\", "/").replaceAll("\\", "/");
    if (/[A-Za-z]:\/+Users\/+/i.test(content)) {
      throw new Error(`Packaged user path detected in ${path}`);
    }
  }
}

await run(process.execPath, ["./scripts/build-third-party-notices.mjs"]);
await run(process.execPath, ["./scripts/verify-build-metadata.mjs"]);
await run(process.execPath, ["./scripts/verify-observations-ui.mjs"]);
await run(process.execPath, ["./scripts/verify-window-chrome.mjs"]);
await run(process.execPath, ["./scripts/verify-chapter-title-banner-option.mjs"]);
await run(process.execPath, ["./scripts/build-arion-documentation-index.mjs"]);
await run(process.execPath, ["./scripts/verify-arion-appearance-contract.mjs"]);
await run(process.execPath, ["./node_modules/typescript/bin/tsc"]);
await run(process.execPath, ["--experimental-strip-types", "./scripts/verify-editor-media-regressions.mjs"]);
await run(process.execPath, ["./node_modules/vite/bin/vite.js", "build"]);
await run(process.execPath, ["./scripts/build-pdf-a4-runtime.mjs"]);
await verifyNoPackagedUserPaths("dist");
