import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [observationsCss, appCss, windowControlsCss, observationsHook, observationsUi, observationsPdf, observationsBackend, englishLocale] = await Promise.all([
  readFile("src/features/observations/observations.css", "utf8"),
  readFile("src/styles.css", "utf8"),
  readFile("src/components/window/windowControls.css", "utf8"),
  readFile("src/features/observations/useObservations.ts", "utf8"),
  readFile("src/features/observations/ObservationUi.tsx", "utf8"),
  readFile("src/features/observations/exportObservationsPdf.ts", "utf8"),
  readFile("src-tauri/src/observations.rs", "utf8"),
  readFile("src/locales/en.json", "utf8").then(JSON.parse)
]);

const zIndex = (source, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{[^}]*?z-index\\s*:\\s*(\\d+)`, "s"));
  assert.ok(match, `z-index introuvable pour ${selector}`);
  return Number(match[1]);
};

const drawer = zIndex(observationsCss, ".observations-drawer");
const dialog = zIndex(observationsCss, ".observations-purge-modal");
const mainControls = zIndex(appCss, ".main-window-controls");
const resizeHandles = zIndex(windowControlsCss, ".paideia-window-resize");

assert.ok(drawer > mainControls, "Le tiroir Observations doit intercepter les clics avant les contrôles de fenêtre.");
assert.ok(drawer > resizeHandles, "Le tiroir Observations doit recouvrir les poignées de redimensionnement.");
assert.ok(dialog > drawer, "Les confirmations Observations doivent rester au-dessus du tiroir.");
assert.match(observationsUi, /aria-label=\{t\("common\.close"\)\} onClick=\{\(\) => controller\.setPanelOpen\(false\)\}/);
assert.match(observationsHook, /message\.includes\("Bibliothèque collaborative indisponible"\)\) return t\("collaboration\.libraryUnavailable"\)/);
assert.match(observationsHook, /error: error \? localizedError\(error\) : ""/);
assert.match(observationsUi, /const showAuthors = controller\.state\.collaborative \|\| controller\.state\.threads\.some/);
assert.match(observationsUi, /showAuthors && message\.authorDisplayName \? <strong>/,
  "Une note doit afficher le nom d’auteur enregistré lorsqu’il existe.");
assert.match(observationsPdf, /heading: `\$\{message\.authorDisplayName \?/,
  "Le PDF doit conserver le nom d’auteur enregistré, même après révocation.");
assert.doesNotMatch(observationsBackend, /std::env::var\("USERNAME"\)|std::env::var\("USER"\)/,
  "Les observations ne doivent pas collecter le nom de session du système.");
assert.match(observationsBackend, /legacy_local_identity_id[\s\S]{0,500}context\.identity\.display_name/,
  "Une ancienne note locale doit prendre l’identité connectée après partage.");
assert.match(englishLocale["collaboration.libraryUnavailable"], /^Collaborative library unavailable\.$/);

console.log("Observations : tiroir et confirmations au-dessus des contrôles de fenêtre vérifiés.");
