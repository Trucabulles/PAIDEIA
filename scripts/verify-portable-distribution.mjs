import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rebasePortableLibraryPath } from "../src/app/libraryConfig.ts";

const [distribution, commands, main, packageJson, portableBuild, tauriConfig, standardBuild] = await Promise.all([
  readFile("src-tauri/src/distribution.rs", "utf8"),
  readFile("src-tauri/src/commands.rs", "utf8"),
  readFile("src-tauri/src/main.rs", "utf8"),
  readFile("package.json", "utf8").then(JSON.parse),
  readFile("scripts/build-paideia-portable.ps1", "utf8"),
  readFile("src-tauri/tauri.conf.json", "utf8").then(JSON.parse),
  readFile("scripts/build.mjs", "utf8")
]);

assert.match(distribution, /PORTABLE_MARKER_FILE:\s*&str\s*=\s*"portable\.mode"/);
for (const directory of ["config", "library", "resources", "logs", "webview"]) {
  assert.match(distribution, new RegExp(`join\\(\"${directory}\"\\)`));
}
assert.match(main, /window\.create\s*=\s*false/);
assert.match(main, /\.data_directory\(webview_root\.clone\(\)\)/);
assert.match(commands, /distribution::app_config_root/);
assert.match(commands, /distribution::current\(\)\.library_root/);
assert.match(commands, /distribution::current\(\)\.resources_root/);
assert.match(commands, /distribution::current\(\)\.logs_root/);
assert.equal(packageJson.scripts["tauri:build:portable"], "powershell -ExecutionPolicy Bypass -File ./scripts/build-paideia-portable.ps1");
assert.match(portableBuild, /build --no-bundle/);
assert.match(portableBuild, /portable\.mode/);
assert.doesNotMatch(portableBuild, /Copy-Item[^\n]*configuration-collaboration\.zip/);
assert.doesNotMatch(portableBuild, /build-collaboration-deployment-package\.mjs/);
assert.match(portableBuild, /Get-ChildItem[^\n]*configuration-collaboration\.zip/);
assert.ok(!tauriConfig.bundle.resources.includes("pdf-a4-runtime"));
assert.doesNotMatch(portableBuild, /\$pdfRuntimeRoot/);
assert.match(portableBuild, /Ancien dossier PDF externe présent/);
assert.ok(!tauriConfig.bundle.resources.includes("configuration-collaboration.zip"));
assert.doesNotMatch(standardBuild, /build-collaboration-deployment-package\.mjs/);

assert.equal(
  rebasePortableLibraryPath(
    "D:/Ancien/PAIDEIA-1.0-portable/data/library/projects/lecon-1",
    "E:/Outils/PAIDEIA/data/library"
  ),
  "E:/Outils/PAIDEIA/data/library/projects/lecon-1"
);
assert.equal(
  rebasePortableLibraryPath("D:/Formations/Partagees/lecon-1", "E:/Outils/PAIDEIA/data/library"),
  "D:/Formations/Partagees/lecon-1"
);

console.log("Distribution portable : stockage isolé et ressources embarquées vérifiés.");
