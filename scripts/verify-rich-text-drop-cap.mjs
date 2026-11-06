import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";

const window = new Window();
globalThis.document = window.document;
globalThis.Node = window.Node;
globalThis.Text = window.Text;
globalThis.Element = window.Element;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLParagraphElement = window.HTMLParagraphElement;
globalThis.HTMLSpanElement = window.HTMLSpanElement;
globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
globalThis.HTMLImageElement = window.HTMLImageElement;
globalThis.Range = window.Range;

async function importSource(path) {
  const output = await build({ entryPoints: [path], bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`);
}

const {
  normalizeRichTextDropCaps,
  removeRichTextDropCap,
  richTextDropCapState,
  toggleRichTextDropCap
} = await importSource("src/app/richTextDropCap.ts");
const { applyRichParagraphStyle } = await importSource("src/app/richTextParagraphStyle.ts");
const { sanitizeRichTextHtml } = await importSource("src/app/richTextSanitizer.ts");
const toolbarSource = await readFile("src/components/rich-text-toolbar/RichTextToolbar.tsx", "utf8");
const appSource = await readFile("src/App.tsx", "utf8");
assert.match(toolbarSource, /onCommand\("toggleDropCap"\)/, "the paragraph menu exposes the drop-cap command");
assert.match(toolbarSource, /t\("richText\.dropCap", undefined, "Lettrine"\)/, "the menu label is translated");
assert.doesNotMatch(toolbarSource, /✓\s*Lettrine/, "the menu does not prefix Lettrine with a tick");
assert.match(toolbarSource, /disabled=\{fontSizeDisabled\}/, "the size control is disabled while the drop-cap character is selected");
assert.match(appSource, /command === "toggleDropCap"/, "the editor handles the toolbar command");

function fixture(html) {
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.innerHTML = html;
  document.body.append(editor);
  return editor;
}

function caretIn(node, offset = 0) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  return range;
}

const formatted = fixture('<p><strong><span style="color:#8d271c">École</span> commence ici.</strong></p>');
const formattedText = formatted.querySelector("span").firstChild;
const enabled = toggleRichTextDropCap(formatted, caretIn(formattedText, 3));
assert.equal(enabled?.active, true);
assert.equal(enabled?.marker?.textContent, "É", "the first grapheme becomes the drop cap");
assert.equal(enabled?.marker?.parentElement?.style.color, "#8d271c", "existing typography remains inherited");
assert.equal(formatted.querySelector("p")?.dataset.paideiaDropCap, "true");
assert.equal(
  richTextDropCapState(formatted, caretIn(enabled.marker.firstChild, 1)).characterSelected,
  true,
  "the fixed-size control state follows the selected drop-cap character"
);
enabled.marker.style.fontSize = "72px";
enabled.marker.style.color = "#244585";
enabled.marker.style.fontWeight = "700";
const saved = sanitizeRichTextHtml(formatted.innerHTML);
assert.match(saved, /data-paideia-drop-cap="true"/);
assert.match(saved, /class="paideia-rich-drop-cap"/);
assert.match(saved, /font-size:\s*72px/);

const disabled = toggleRichTextDropCap(formatted, caretIn(enabled.marker.firstChild, 1));
assert.equal(disabled?.active, false);
assert.equal(formatted.querySelector("[data-paideia-drop-cap]"), null);
assert.equal(formatted.querySelector(".paideia-rich-drop-cap"), null);
const retainedTypography = [...formatted.querySelectorAll("span")].find((span) => span.style.fontSize === "72px");
assert.ok(retainedTypography, "removing the layout keeps the character typography");
assert.equal(retainedTypography.textContent, "É");

const composed = fixture("<p>Á propos.</p>");
const composedResult = toggleRichTextDropCap(composed, caretIn(composed.querySelector("p").firstChild, 2));
assert.equal(composedResult?.marker?.textContent, "Á", "a composed Unicode grapheme is never split");

const moved = fixture('<p data-paideia-drop-cap="true"><span class="paideia-rich-drop-cap" style="font-size:64px;color:#123456">A</span>lpha</p>');
moved.querySelector("p").insertBefore(document.createTextNode("Z"), moved.querySelector("p").firstChild);
assert.equal(normalizeRichTextDropCaps(moved), 1);
const movedMarker = moved.querySelector(".paideia-rich-drop-cap");
assert.equal(movedMarker.textContent, "Z", "the layout follows a newly inserted first character");
assert.equal(movedMarker.style.fontSize, "64px", "direct drop-cap typography follows the new first character");
assert.equal(moved.textContent, "ZAlpha");

const heading = fixture("<h2>Titre</h2>");
const headingRange = caretIn(heading.querySelector("h2").firstChild, 1);
assert.equal(richTextDropCapState(heading, headingRange).canToggle, false, "headings cannot receive a drop cap");
assert.equal(toggleRichTextDropCap(heading, headingRange), null);

const converted = fixture('<p data-paideia-drop-cap="true"><span class="paideia-rich-drop-cap">L</span>ettre</p>');
const convertedRange = caretIn(converted.querySelector(".paideia-rich-drop-cap").firstChild, 1);
assert.equal(applyRichParagraphStyle(converted, convertedRange, "h2"), true);
assert.equal(converted.querySelector("h2")?.textContent, "Lettre");
assert.equal(converted.querySelector("[data-paideia-drop-cap]"), null);
assert.equal(converted.querySelector(".paideia-rich-drop-cap"), null, "converting to a heading removes only the layout marker");

const blocked = fixture('<p><img src="x.png" alt="">Texte</p>');
const blockedRange = document.createRange();
blockedRange.selectNodeContents(blocked.querySelector("p"));
assert.equal(richTextDropCapState(blocked, blockedRange).canToggle, false, "a leading structural element makes the option unavailable");

const erased = fixture('<p data-paideia-drop-cap="true"><span class="paideia-rich-drop-cap" style="color:#8d271c">L</span>ettrine</p>');
const erasedMarker = erased.querySelector(".paideia-rich-drop-cap");
const erasedRange = document.createRange();
erasedRange.selectNodeContents(erasedMarker);
removeRichTextDropCap(erased.querySelector("p"), { preserveMarkerWrapper: true });
assert.equal(erasedRange.toString(), "L", "the eraser keeps its live selection attached to the first letter");
assert.equal(erasedRange.startContainer.isConnected, true, "the selected character stays connected during formatting cleanup");
assert.equal(erased.querySelector("p").textContent, "Lettrine", "removing the layout never inserts a line break");
assert.equal(erased.querySelector("p").childNodes[0].nodeName, "SPAN", "the neutral wrapper survives until the eraser unwraps it");
erased.querySelector("span").replaceWith(...erased.querySelector("span").childNodes);
assert.equal(erased.querySelector("p").innerHTML, "Lettrine", "the final eraser cleanup restores one continuous paragraph");

console.log("RichText drop caps: graphemes, typography, reversal, editing and heading conversion verified.");
