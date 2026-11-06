import assert from "node:assert/strict";
import { build } from "esbuild";
import { Window } from "happy-dom";

const window = new Window();
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
globalThis.HTMLParagraphElement = window.HTMLParagraphElement;
globalThis.HTMLImageElement = window.HTMLImageElement;

async function importSource(path) {
  const output = await build({ entryPoints: [path], bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`);
}

const { focusPositionAfterRichInlineImage, getRichInlineImageWrap, normalizeRichInlineImageParagraph, setRichInlineImageWrap } = await importSource(
  "src/components/rich-text-toolbar/richInlineImageWrap.ts"
);
const { normalizeRichInlineImageFormattingHtml, sanitizeRichTextHtml } = await importSource("src/app/richTextSanitizer.ts");

function fixture(html) {
  const editor = document.createElement("div");
  editor.className = "inline-rich-text-field";
  editor.contentEditable = "true";
  editor.innerHTML = html;
  document.body.appendChild(editor);
  return { editor, image: editor.querySelector("img") };
}

for (const [name, html, placement] of [
  ["start", '<p><img class="rich-inline-image" data-paideia-image-id="one" src="x.png">Texte long ensuite.</p><p>Deuxième paragraphe.</p>', "start"],
  ["middle", '<p>Avant <img class="rich-inline-image" data-paideia-image-id="one" src="x.png"> après <em>formaté</em>.</p>', "split"],
  ["end", '<p>Texte avant <img class="rich-inline-image" data-paideia-image-id="one" src="x.png"></p><p>Suite.</p>', "end"]
]) {
  const { editor, image } = fixture(html);
  const originalText = editor.textContent;
  assert.equal(setRichInlineImageWrap(image, editor, "left"), true, `${name}: wrapping succeeds`);
  const wrapper = editor.querySelector(".paideia-rich-image-float");
  assert.equal(wrapper?.dataset.paideiaRichImagePlacement, placement);
  assert.equal(wrapper?.contains(image), true);
  assert.equal(editor.textContent, originalText, `${name}: no text lost`);
  assert.equal(getRichInlineImageWrap(image), "left");
  assert.equal(setRichInlineImageWrap(image, editor, "right"), true);
  assert.equal(getRichInlineImageWrap(image), "right");
  const saved = sanitizeRichTextHtml(editor.innerHTML);
  assert.match(saved, /data-paideia-rich-image-wrap="right"/);
  const reopened = fixture(saved);
  assert.equal(getRichInlineImageWrap(reopened.image), "right", `${name}: survives reopen`);
  assert.equal(reopened.editor.textContent, originalText);
  assert.ok(focusPositionAfterRichInlineImage(image, editor).collapsed);
  assert.equal(setRichInlineImageWrap(image, editor, "inline"), true);
  assert.equal(editor.querySelector(".paideia-rich-image-float"), null);
  assert.equal(editor.textContent, originalText, `${name}: reverse preserves text`);
  assert.equal(editor.querySelectorAll("img").length, 1);
  assert.equal(image.dataset.paideiaImageId, "one");
  editor.remove();
  reopened.editor.remove();

  const toDelete = fixture(html);
  const textBeforeDeletion = toDelete.editor.textContent;
  assert.equal(setRichInlineImageWrap(toDelete.image, toDelete.editor, "left"), true);
  assert.equal(setRichInlineImageWrap(toDelete.image, toDelete.editor, "inline"), true);
  toDelete.image.remove();
  assert.equal(toDelete.editor.textContent, textBeforeDeletion, `${name}: deletion retains the text`);
  assert.equal(toDelete.editor.querySelector(".paideia-rich-image-float"), null);
  assert.equal(toDelete.editor.querySelector("img"), null);
  toDelete.editor.remove();
}

const rootInserted = fixture('<img class="rich-inline-image" data-paideia-image-id="root" src="x.png">Texte saisi après insertion.');
assert.equal(rootInserted.image.parentElement, rootInserted.editor, "fixture reproduces a root-level browser insertion");
assert.equal(normalizeRichInlineImageParagraph(rootInserted.image, rootInserted.editor)?.tagName, "P");
assert.equal(rootInserted.image.parentElement?.tagName, "P", "root-level image is normalized into a paragraph");
assert.equal(setRichInlineImageWrap(rootInserted.image, rootInserted.editor, "left"), true, "normalized insertion can be wrapped");
assert.equal(rootInserted.editor.textContent, "Texte saisi après insertion.", "normalization preserves typed text");
assert.equal(setRichInlineImageWrap(rootInserted.image, rootInserted.editor, "inline"), true);
assert.equal(rootInserted.editor.querySelector(".paideia-rich-image-float"), null);
rootInserted.editor.remove();

const importedHtml = '<p style="text-align:justify;font-size:18px"><strong><span style="font-weight:normal"><img class="rich-inline-image" data-paideia-image-id="imported" src="x.png">Le </span>chipset</strong> reste formaté après un collage Rise.</p><p>Deuxième paragraphe.</p>';
const normalizedImportedHtml = normalizeRichInlineImageFormattingHtml(importedHtml);
assert.match(normalizedImportedHtml, /^<p[^>]*><img[^>]*><strong><span[^>]*>Le <\/span>chipset<\/strong>/);
assert.equal(sanitizeRichTextHtml(importedHtml), normalizedImportedHtml, "the regular Rich Text sanitizer canonicalizes imported images");

const middleImportedHtml = '<p><strong>Avant <span style="color:#123456">milieu <img class="rich-inline-image" src="x.png">suite</span> fin</strong></p>';
const middleImportedFixture = fixture(middleImportedHtml);
const middleImportedText = middleImportedFixture.editor.textContent;
middleImportedFixture.editor.remove();
const normalizedMiddleImportedHtml = normalizeRichInlineImageFormattingHtml(middleImportedHtml);
const normalizedMiddleImported = fixture(normalizedMiddleImportedHtml);
assert.equal(normalizedMiddleImported.image.parentElement?.tagName, "P", "nested middle image becomes a direct paragraph child");
assert.equal(normalizedMiddleImported.editor.textContent, middleImportedText, "text around a middle image is preserved");
assert.match(normalizedMiddleImportedHtml, /<strong>Avant <span[^>]*>milieu <\/span><\/strong><img/);
assert.match(normalizedMiddleImportedHtml, /<img[^>]*><strong><span[^>]*>suite<\/span> fin<\/strong>/);
normalizedMiddleImported.editor.remove();

const linkedImportedHtml = '<p>Avant <a href="https://example.com"><span><img class="rich-inline-image" src="x.png"></span></a> après</p>';
assert.equal(
  normalizeRichInlineImageFormattingHtml(linkedImportedHtml),
  linkedImportedHtml,
  "normalization does not extract an image from a functional link"
);

const importedFormatting = fixture(importedHtml);
const importedText = importedFormatting.editor.textContent;
assert.equal(
  setRichInlineImageWrap(importedFormatting.image, importedFormatting.editor, "left"),
  true,
  "image nested in pasted typographic markup can be wrapped"
);
const importedWrapper = importedFormatting.editor.querySelector(".paideia-rich-image-float");
assert.equal(importedWrapper?.dataset.paideiaRichImagePlacement, "start", "empty formatting shells do not create a false split");
assert.equal(importedFormatting.editor.firstElementChild, importedWrapper, "no empty paragraph is inserted before a leading image");
assert.equal(importedFormatting.editor.textContent, importedText, "pasted text is preserved");
assert.match(
  importedFormatting.editor.innerHTML,
  /<p[^>]*><strong><span[^>]*>Le <\/span>chipset<\/strong> reste formaté/,
  "formatting around the pasted text is preserved"
);
assert.equal(setRichInlineImageWrap(importedFormatting.image, importedFormatting.editor, "inline"), true);
assert.equal(importedFormatting.editor.querySelector(".paideia-rich-image-float"), null);
assert.equal(importedFormatting.editor.textContent, importedText, "reverting to inline keeps imported text intact");
assert.equal(importedFormatting.editor.querySelectorAll("img").length, 1);
importedFormatting.editor.remove();

const unsupported = fixture('<h2>Avant <img class="rich-inline-image" src="x.png"> après</h2>');
const before = unsupported.editor.innerHTML;
assert.equal(setRichInlineImageWrap(unsupported.image, unsupported.editor, "left"), false);
assert.equal(unsupported.editor.innerHTML, before, "unsupported structure is unchanged");
unsupported.editor.remove();

const linked = fixture('<p>Avant <a href="https://example.com"><img class="rich-inline-image" src="x.png"></a> après</p>');
const linkedBefore = linked.editor.innerHTML;
assert.equal(setRichInlineImageWrap(linked.image, linked.editor, "right"), false);
assert.equal(linked.editor.innerHTML, linkedBefore, "linked image stays intact");
linked.editor.remove();

console.log("RichText image wrapping: placement, reversal, preservation and reopen verified.");
