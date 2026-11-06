import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createArionConversationSession } from "../src/features/designer-actions/arionConversationSession.ts";
import {
  createArionExecutionIntent,
  createArionIntentAuthority,
  designerPreviewMatchesCurrent
} from "../src/features/designer-actions/arionIntentAuthority.ts";
import { resolveArionSurfaceCommand } from "../src/features/designer-actions/arionWindowBridge.ts";

const session = createArionConversationSession();
assert.equal(session.getSnapshot().mode, "auto");
session.setMode("help");
assert.equal(session.getSnapshot().mode, "help");
let notifications = 0;
const unsubscribe = session.subscribe(() => { notifications += 1; });

assert.deepEqual(session.getSnapshot(), { command: "", history: [], documentationChoices: [], mode: "help" });
session.setCommand("Bonjour Arion");
session.setHistory((history) => [...history, { role: "user", text: "Bonjour Arion" }]);
session.setHistory((history) => [...history, { role: "arion", text: "Bonjour" }]);
session.setDocumentationChoices([{ id: "documentation:test", command: "Aide : test" }]);

assert.equal(session.getSnapshot().command, "Bonjour Arion");
assert.deepEqual(session.getSnapshot().history.map((entry) => entry.role), ["user", "arion"]);
assert.equal(session.getSnapshot().documentationChoices[0]?.id, "documentation:test");
assert.equal(notifications, 4);

session.replaceSnapshot({ command: "dock", history: [], documentationChoices: [], mode: "actions" });
assert.equal(session.getSnapshot().command, "dock");
assert.equal(session.getSnapshot().mode, "actions");
assert.equal(notifications, 5);

assert.equal(resolveArionSurfaceCommand("Détache-toi"), "detach");
assert.equal(resolveArionSurfaceCommand("/undock"), "detach");
assert.equal(resolveArionSurfaceCommand("Mets Arion sur le second écran"), "detach");
assert.equal(resolveArionSurfaceCommand("Mets Arion sur mon second écran"), "detach");
assert.equal(resolveArionSurfaceCommand("Réintègre-toi"), "dock");
assert.equal(resolveArionSurfaceCommand("Réintègre-toi dans PAIDEIA"), "dock");
assert.equal(resolveArionSurfaceCommand("/dock"), "dock");
assert.equal(resolveArionSurfaceCommand("change la couleur"), null);

unsubscribe();
session.setCommand((command) => `${command} !`);
assert.equal(session.getSnapshot().command, "dock !");
assert.equal(notifications, 5);

console.log("Arion : session de conversation autonome vérifiée.");

const preview = {
  intent: { kind: "designer-command", scope: "lesson", operations: [] },
  targets: [{
    chapterTitle: "Chapitre 1", pageTitle: "Page 1", blockTitle: "Texte",
    pageId: "page-1", blockId: "block-1", property: "contentWidth", value: "wide",
    previousValue: "standard"
  }],
  unchanged: []
};
const authority = createArionIntentAuthority();
const intent = createArionExecutionIntent("apply", {
  sessionId: "session-1", contextEpoch: 4, projectPath: "C:/projet"
}, preview);
const context = { sessionId: "session-1", contextEpoch: 4, projectPath: "C:/projet", canWrite: true };

assert.deepEqual(authority.validate(intent, context), { valid: true });
assert.equal(designerPreviewMatchesCurrent(preview, preview), true);
assert.equal(designerPreviewMatchesCurrent(preview, {
  ...preview,
  targets: [{ ...preview.targets[0], previousValue: "large" }]
}), false);
assert.equal(authority.validate(intent, { ...context, contextEpoch: 5 }).reason, "context");
assert.equal(authority.validate(intent, { ...context, projectPath: "C:/autre" }).reason, "project");
assert.equal(authority.validate(intent, { ...context, canWrite: false }).reason, "read-only");
assert.deepEqual(authority.authorize(intent, context, preview), { valid: true });
assert.equal(authority.claim(intent.intentId), false);
assert.equal(authority.validate(intent, context).reason, "duplicate");

console.log("Arion : autorité, contexte, valeurs et idempotence vérifiés.");

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const detachedSource = readFileSync(new URL("../src/features/designer-actions/ArionDetachedWindow.tsx", import.meta.url), "utf8");
const bridgeSource = readFileSync(new URL("../src/features/designer-actions/useArionWindowBridge.ts", import.meta.url), "utf8");
const rustWindowSource = readFileSync(new URL("../src-tauri/src/arion_window.rs", import.meta.url), "utf8");
const rustMainSource = readFileSync(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const arionCapability = JSON.parse(readFileSync(new URL("../src-tauri/capabilities/arion.json", import.meta.url), "utf8"));
assert.match(mainSource, /await import\("\.\/App"\)/u, "The main application must be loaded dynamically");
assert.match(mainSource, /await import\("\.\/features\/designer-actions\/ArionDetachedWindow"\)/u, "The detached surface must have a dedicated entry");
assert.doesNotMatch(detachedSource, /from ["']\.\.\/\.\.\/App/u, "The detached surface must never mount App.tsx");
assert.match(bridgeSource, /payload\.sessionId !== options\.sessionId/u, "Detached events must be scoped to the active Arion session");
assert.match(bridgeSource, /5000/u, "Detachment must wait for an explicit initialization acknowledgement");
assert.doesNotMatch(detachedSource, /invokeCommand/u, "The detached surface must not invoke project commands directly");
assert.match(rustWindowSource, /get_webview_window\(ARION_WINDOW_LABEL\)/u, "Repeated detachment must reuse the unique Arion window");
assert.match(rustWindowSource, /__PAIDEIA_SURFACE__/u, "The Arion entry must be selected before frontend startup");
assert.match(rustMainSource, /WindowEvent::Destroyed[\s\S]{0,120}label == "main"[\s\S]{0,180}close_arion_window/u, "Destroying the main window must also destroy detached Arion");
assert.doesNotMatch(rustMainSource, /WindowEvent::CloseRequested[\s\S]{0,240}app\.exit/u, "The native close request of the main window must not be intercepted");
assert.match(rustWindowSource, /window\.destroy\(\)/u, "A detached window with a failed WebView must still be force-closable");
assert.match(rustWindowSource, /window\.unminimize\(\)/u, "The launcher must restore a minimized detached window before focusing it");
assert.match(rustWindowSource, /ARION_MIN_WIDTH:\s*f64\s*=\s*650\.0/u, "Detached Arion must keep enough width for its header and window controls");
assert.match(rustWindowSource, /ARION_MIN_HEIGHT:\s*f64\s*=\s*600\.0/u, "Detached Arion must keep enough height for its conversation and composer");
assert.match(rustWindowSource, /\.min_inner_size\(ARION_MIN_WIDTH, ARION_MIN_HEIGHT\)/u, "The minimum Arion size must be enforced by the native window");
assert.match(detachedSource, /windowControls=\{\{/u, "The detached surface must expose conventional window controls without changing the anchored panel");
assert.match(appSource, /onContextMenu=\{\(event\) => \{[\s\S]{0,280}arionSurface === "detached" \? arionWindowBridge\.dock\(\) : arionWindowBridge\.detach\(\)/u, "Arion portrait right-click must directly toggle dock state without a menu");
assert.deepEqual(arionCapability.windows, ["arion"]);
assert.deepEqual(arionCapability.permissions, ["core:default", "core:window:allow-is-maximized", "core:window:allow-minimize", "core:window:allow-start-dragging", "core:window:allow-start-resize-dragging", "core:window:allow-toggle-maximize"]);
console.log("Arion : entrée détachée, acquittement, session unique et permissions minimales vérifiés.");
