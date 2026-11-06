import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

function buildInputs(rootDir) {
  const inputs = [
    "src", "public", "index.html", "package.json", "package-lock.json",
    "vite.config.*", "tsconfig*.json",
    "src-tauri/src", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock",
    "src-tauri/build.rs", "src-tauri/tauri*.json", "src-tauri/capabilities",
    "src-tauri/permissions", "src-tauri/icons",
    "scripts/build.mjs", "scripts/paideia-build-metadata.mjs",
    "scripts/build-pdf-a4-runtime.mjs", "scripts/preview-pdf-a4.mjs",
    "scripts/pdf-a4-*.ts", "scripts/build-arion-documentation-index.mjs",
    "legal"
  ];
  // Include the resources actually declared by Tauri, including its selected
  // fixed runtime. Unused sibling runtimes and local diagnostics are not inputs.
  const config = JSON.parse(readFileSync(resolve(rootDir, "src-tauri/tauri.conf.json"), "utf8"));
  const resources = config.bundle?.resources ?? [];
  const paths = Array.isArray(resources) ? resources : Object.keys(resources);
  const fixedRuntime = config.bundle?.windows?.webviewInstallMode;
  if (fixedRuntime?.type === "fixedRuntime") paths.push(fixedRuntime.path);
  for (const resource of paths) {
    const input = relative(resolve(rootDir), resolve(rootDir, "src-tauri", resource)).replaceAll("\\", "/");
    if (input && !input.startsWith("../") && !isAbsolute(input)) inputs.push(input);
  }
  return inputs;
}

function gitOutput(rootDir, args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

export function paideiaBuildCommit(rootDir) {
  const explicitCommit = process.env.PAIDEIA_GIT_COMMIT?.trim();
  if (explicitCommit) return explicitCommit;

  try {
    const commit = gitOutput(rootDir, ["rev-parse", "--short=8", "HEAD"]);
    const inputs = buildInputs(rootDir);
    const trackedChanges = Boolean(gitOutput(rootDir, ["status", "--porcelain", "--untracked-files=no", "--", ...inputs]));
    const untrackedBuildInputs = Boolean(gitOutput(rootDir, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      ...inputs
    ]));
    return commit + (trackedChanges || untrackedBuildInputs ? "-d" : "");
  } catch {
    return "indisponible";
  }
}
