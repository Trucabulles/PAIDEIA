import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [component, css, app, resources] = await Promise.all([
  read("src/components/app/ScrollBoundaryControls.tsx"),
  read("src/components/app/ScrollBoundaryControls.module.css"),
  read("src/App.tsx"),
  read("src/components/resources/ResourcesScreen.tsx")
]);

assert.match(component, /const SCROLL_STEP_PX = 32/);
assert.match(component, /const HOLD_DELAY_MS = 320/);
assert.match(component, /setInterval\(\(\) => scrollOneStep\(direction\), HOLD_INTERVAL_MS\)/);
assert.match(component, /onPointerUp=\{stopContinuousScroll\}/);
assert.match(component, /onPointerCancel=\{stopContinuousScroll\}/);
assert.match(component, /onLostPointerCapture=\{stopContinuousScroll\}/);
assert.match(component, /onDoubleClick=[\s\S]*?scrollToBoundary\(direction\)/);
assert.match(component, /direction === "up" \? 0 : target\.scrollHeight/);
assert.match(component, /requestedThumbTop \/ thumbTravel \* scrollRange/);
assert.match(component, /target\.scrollTop = clamp\(/);
assert.match(component, /target\.addEventListener\("scroll", scheduleMeasure/);
assert.match(component, /onWheel=\{handleTrackWheel\}/);
assert.match(css, /width: 12px/);
assert.match(css, /height: 8px/);
assert.match(css, /\.thumb[\s\S]*?min-height: 36px/);
assert.match(css, /\.thumb[\s\S]*?width: 9px/);
assert.match(css, /background: #8b8b8b/);
assert.match(app, /isProjectWorkspaceActive && !isPreviewMode[\s\S]*?<ScrollBoundaryControls targetRef=\{authoringStageRef\}/);
assert.match(resources, /<ScrollBoundaryControls targetRef=\{viewportRef\}/);

console.log("Scroll boundary controls contract: click, hold and double-click are scoped to authoring and resources.");
