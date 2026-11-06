import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.basename(process.cwd()) === "src-tauri" ? path.resolve(process.cwd(), "..") : process.cwd();
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const toolbarCss = `file:///${path.join(root, "src", "components", "rich-text-toolbar", "RichTextToolbar.css").replaceAll("\\\\", "/")}`;
const runDirectory = await mkdtemp(path.join(tmpdir(), "paideia-rich-image-layout-"));
const commandsSource = await readFile(path.join(root, "src-tauri", "src", "commands.rs"), "utf8");
const legacyNormalizer = commandsSource.match(/^  function setupLegacyRichInlineImages\(root\)\{.*\}$/m)?.[0]?.trim();
assert.ok(legacyNormalizer, "SCORM legacy image normalizer is present in the generated runtime source");

const compactZoomRuntime = commandsSource.match(/^  function setupImageZoom\(\)\{.*\}$/m)?.[0]?.trim();
assert.ok(compactZoomRuntime, "SCORM image zoom runtime is present");

const scormCss = `
  .scorm .rich-inline-image { display:inline-block; max-width:min(100%,300px); max-height:300px; height:auto; object-fit:contain; vertical-align:middle; }
  .scorm .paideia-rich-image-float[data-paideia-rich-image-wrap="left"],.scorm .paideia-rich-image-float[data-paideia-rich-image-wrap="right"] { display:block; max-width:100%; margin-block:0; }
  .scorm .paideia-rich-image-float[data-paideia-rich-image-wrap="left"] { float:left; margin-inline:0 1em; }
  .scorm .paideia-rich-image-float[data-paideia-rich-image-wrap="right"] { float:right; margin-inline:1em 0; }
  .scorm .paideia-rich-image-float .rich-inline-image { display:block; }
  .scorm .rich-content { display:flow-root; container-type:inline-size; }
  @container (max-width:520px) { .scorm .paideia-rich-image-float[data-paideia-rich-image-wrap="left"],.scorm .paideia-rich-image-float[data-paideia-rich-image-wrap="right"] { float:none; width:fit-content; margin-inline:auto; } }
  .scorm img:not(.rich-inline-image), .scorm video { display:block; width:100%; max-height:620px; object-fit:cover; border-radius:0; background:transparent; }
`;

function image({ width = 180, height = 140, scorm = false } = {}) {
  const style = scorm ? ` style="width:${width}px!important;height:auto!important"` : "";
  return `<img class="rich-inline-image" width="${width}" height="${height}"${style} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='%23123478'/%3E%3C/svg%3E">`;
}

function wrappedFixture(scope, placement) {
  const copy = "Ce premier paragraphe reste volontairement assez long pour commencer à côté de l’image, puis reprendre toute la largeur disponible une fois que le bas de l’image est atteint. Il vérifie le flux réel du texte et non seulement l’alignement visuel de l’image. Ce complément assure que le paragraphe descend réellement sous l’image sans ajouter de marge ou de rupture artificielle. ";
  return `<section class="${scope}" data-scope="${scope}" data-placement="${placement}"><div class="rich-content"><span class="paideia-rich-image-float" data-paideia-rich-image-wrap="${placement}" contenteditable="false">${image({ scorm: scope.startsWith("scorm-") })}</span><p>${copy.repeat(3)}</p></div></section>`;
}

function pageContent() {
  const alignments = (scorm = false) => ["left", "center", "right", "justify"].map((align) => `<p data-align="${align}" style="text-align:${align}">${image({ width: 100, height: 50, scorm })}</p>`).join("");
  return `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${toolbarCss}"><style>
    * { box-sizing:border-box; } body { margin:0; font:18px/1.5 Arial; color:#182747; }
    .alignment, .preview, .scorm { width:min(760px, calc(100vw - 30px)); margin:16px auto; }
    .alignment p, .rich-content p { margin:0 0 14px; }
    ${scormCss}
  </style>
  <div class="alignment rich-content">${alignments()}</div>
  <div class="preview">${wrappedFixture("preview-left", "left")}${wrappedFixture("preview-right", "right")}</div>
  <div class="scorm">${wrappedFixture("scorm-left", "left")}${wrappedFixture("scorm-right", "right")}</div>
  <div class="scorm scorm-alignment rich-content">${alignments(true)}</div>
  <div class="legacy rich-content"><p><strong><span style="font-weight:normal">${image({ width: 120, height: 80, scorm: true })}Le </span>chipset</strong> conserve son formatage.</p></div>
  <div class="rich-content" id="zoom-fixture">
    ${image().replace("<img ", '<img id="enabled-zoom" alt="Exemple" data-paideia-inline-rounded="true" data-paideia-inline-zoom="true" ')}
    ${image().replace("<img ", '<img id="disabled-zoom" ')}
  </div>
  <pre id="result"></pre>
  <script>
    ${legacyNormalizer}
    setupLegacyRichInlineImages(document);
    const round = (value) => Math.round(value);
    const rect = (element) => { const value = element.getBoundingClientRect(); return { left:round(value.left), right:round(value.right), top:round(value.top), bottom:round(value.bottom), width:round(value.width) }; };
    const textRects = (element) => { const range = document.createRange(); range.selectNodeContents(element); return [...range.getClientRects()].map((value) => ({ left:round(value.left), right:round(value.right), top:round(value.top), bottom:round(value.bottom) })); };
    const wrapped = Object.fromEntries([...document.querySelectorAll('[data-scope]')].map((scope) => { const content = scope.querySelector('.rich-content'); const float = scope.querySelector('.paideia-rich-image-float'); const paragraph = scope.querySelector('p'); return [scope.dataset.scope, { content:rect(content), float:rect(float), image:rect(float.querySelector('img')), paragraph:rect(paragraph), textRects:textRects(paragraph), floatStyle:getComputedStyle(float).float }]; }));
    const alignmentFor = (selector) => Object.fromEntries([...document.querySelectorAll(selector)].map((paragraph) => { const image = paragraph.querySelector('img'); return [paragraph.dataset.align, { left:round(image.getBoundingClientRect().left), width:round(image.getBoundingClientRect().width), align:getComputedStyle(paragraph).textAlign, parent:image.parentElement.tagName }]; }));
    const legacy = document.querySelector('.legacy');
    const opened = [];
    const openImageLightbox = (src, alt, rounded) => opened.push({ hasSource: Boolean(src), alt, rounded });
    const imageLightbox = () => null;
    ${compactZoomRuntime}
    setupImageZoom();
    const enabled = document.querySelector('#enabled-zoom');
    const disabled = document.querySelector('#disabled-zoom');
    enabled.click();
    disabled.click();
    enabled.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    const zoom = { opened, enabledRadius: getComputedStyle(enabled).borderRadius, disabledRadius: getComputedStyle(disabled).borderRadius };
    document.querySelector('#result').textContent = JSON.stringify({ zoom, wrapped, alignment:alignmentFor('.alignment p'), scormAlignment:alignmentFor('.scorm-alignment p'), legacy:{ text:legacy.textContent, imageParent:legacy.querySelector('img').parentElement.tagName, formattingPreserved:Boolean(legacy.querySelector('p > img + strong > span')) } });
  </script>`;
}

async function inspect(width, height) {
  const pagePath = path.join(runDirectory, `layout-${width}x${height}.html`);
  await writeFile(pagePath, pageContent());
  const html = execFileSync(edge, ["--headless", "--disable-gpu", "--no-first-run", `--window-size=${width},${height}`, "--dump-dom", `file:///${pagePath.replaceAll("\\", "/")}`], { encoding: "utf8" });
  return JSON.parse(html.match(/<pre id="result">([^<]+)<\/pre>/)?.[1] ?? "{}");
}

function assertDesktopWrapping(result) {
  for (const scope of ["preview-left", "preview-right", "scorm-left", "scorm-right"]) {
    const item = result.wrapped[scope];
    assert.notEqual(item.floatStyle, "none", `${scope} remains floated on desktop`);
    assert.equal(item.image.width, 180, `${scope} retains its configured image width`);
    assert.ok(item.textRects.length > 2, `${scope} paragraph spans several visual lines`);
    assert.equal(item.textRects.at(-1).left, item.content.left, `${scope} text recovers the full line width below the image`);
    if (scope.endsWith("left")) {
      assert.ok(item.textRects[0].left >= item.image.right + 10, `${scope} text begins to the right of the image`);
    } else {
      assert.ok(item.textRects[0].right <= item.image.left - 10, `${scope} text begins to the left of the image`);
    }
  }
}

function assertMobileStacking(result) {
  for (const scope of ["preview-left", "preview-right", "scorm-left", "scorm-right"]) {
    const item = result.wrapped[scope];
    assert.equal(item.floatStyle, "none", `${scope} is stacked on a narrow viewport`);
    assert.ok(item.paragraph.top >= item.image.bottom, `${scope} text begins below the image on a narrow viewport`);
    assert.ok(Math.abs((item.image.left + item.image.right) / 2 - (item.content.left + item.content.right) / 2) <= 1, `${scope} image is centered on a narrow viewport`);
  }
}

try {
  const desktop = await inspect(900, 900);
  const tablet = await inspect(768, 1024);
  const landscape = await inspect(844, 390);
  const mobile = await inspect(390, 844);

  assert.equal(desktop.alignment.left.align, "left");
  assert.equal(desktop.alignment.center.align, "center");
  assert.equal(desktop.alignment.right.align, "right");
  assert.equal(desktop.alignment.justify.align, "justify");
  assert.equal(desktop.alignment.left.parent, "P");
  assert.equal(desktop.alignment.center.parent, "P");
  assert.equal(desktop.alignment.right.parent, "P");
  assert.equal(desktop.alignment.justify.parent, "P");
  assert.ok(desktop.alignment.left.left < desktop.alignment.center.left && desktop.alignment.center.left < desktop.alignment.right.left, "inline image follows paragraph alignment");
  for (const align of ["left", "center", "right", "justify"]) {
    assert.equal(desktop.scormAlignment[align].width, 100, `SCORM ${align} inline image retains its configured width`);
    assert.equal(desktop.scormAlignment[align].align, align, `SCORM ${align} inline image retains paragraph alignment`);
  }
  assert.ok(desktop.scormAlignment.left.left < desktop.scormAlignment.center.left && desktop.scormAlignment.center.left < desktop.scormAlignment.right.left, "SCORM inline image follows paragraph alignment");
  assert.equal(desktop.legacy.imageParent, "P", "SCORM normalizes an imported image nested in typographic markup");
  assert.equal(desktop.legacy.text, "Le chipset conserve son formatage.");
  assert.equal(desktop.legacy.formattingPreserved, true, "SCORM preserves the text formatting around the normalized image");
  assert.deepEqual(desktop.zoom, {
    opened: [
      { hasSource: true, alt: "Exemple", rounded: true },
      { hasSource: true, alt: "Exemple", rounded: true }
    ],
    enabledRadius: "12px",
    disabledRadius: "0px"
  }, "zoom responds to click and keyboard only on the opted-in image, and rounding is independent");
  assertDesktopWrapping(desktop);
  assertDesktopWrapping(tablet);
  assertDesktopWrapping(landscape);
  assertMobileStacking(mobile);
  console.log("RichText inline images retain paragraph alignment and wrap consistently in LMS preview and SCORM across desktop, tablet, landscape and mobile Chromium viewports.");
} finally {
  await rm(runDirectory, { force: true, recursive: true });
}
