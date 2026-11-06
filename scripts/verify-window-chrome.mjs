import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [chrome, controlsCss] = await Promise.all([
  readFile("src/components/app/AppChrome.tsx", "utf8"),
  readFile("src/components/window/windowControls.css", "utf8")
]);
const styles = await readFile("src/styles.css", "utf8");

// Scrollbars have a container as their mouse target: the entire open menu must be non-draggable.
assert.match(chrome, /target\.closest\("[^"\n]*\.floating-menu"\)/);
assert.match(chrome, /windowDragCandidateRef = useRef<\{ pointerId: number; x: number; y: number \} \| null>\(null\)/);
assert.match(chrome, /onPointerDown=\{\(event\) => \{\s*if \(event\.button !== 0 \|\| windowTargetIsInteractive\(event\.target\)\) return;/);
assert.match(chrome, /onPointerMove=\{\(event\) => \{[\s\S]*Math\.hypot\([\s\S]*< 4[\s\S]*getCurrentWindow\(\)\.startDragging\(\)/);
assert.match(chrome, /className="chrome-bars"[\s\S]*onDoubleClick=\{\(event\) => \{\s*if \(windowTargetIsInteractive\(event\.target\)\) return;\s*onChromeCompactToggle\(\);/);
assert.doesNotMatch(chrome, /onDoubleClick=\{\(event\) => \{[\s\S]{0,300}getCurrentWindow\(\)\.toggleMaximize\(\)/);

// Window commands belong to the collapsible header and disappear with it.
const topbarStart = chrome.indexOf("<header");
const topbarEnd = chrome.indexOf("</header>", topbarStart);
const controlsStart = chrome.indexOf('className="main-window-controls"');
assert.ok(topbarStart >= 0 && topbarEnd > topbarStart, "Bandeau supérieur introuvable");
assert.ok(controlsStart > topbarStart && controlsStart < topbarEnd, "Les commandes doivent appartenir au bandeau escamotable");
assert.doesNotMatch(chrome.slice(0, topbarStart), /main-window-controls/);
assert.match(styles, /\.main-window-controls \.paideia-window-controls \{[^}]*border: 0;[^}]*border-radius: 0;[^}]*background: transparent;/s);

// The window's own scrollbar sits at the right edge: keep its resize strip narrow.
assert.match(chrome, /!mainWindowIsMaximized && !infoMenuOpen && !snapshotMenuOpen/);
assert.match(controlsCss, /\.paideia-window-resize-SouthWest \{ width: 8px; height: 8px; \}/);
assert.match(controlsCss, /\.paideia-window-resize-West \{ top: 8px; bottom: 8px; width: 4px;/);

console.log("Window chrome: open menus do not drag or resize; edge resize hit areas are narrow.");
