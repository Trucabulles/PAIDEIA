import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.basename(process.cwd()) === "src-tauri" ? path.resolve(process.cwd(), "..") : process.cwd();
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const runDirectory = await mkdtemp(path.join(tmpdir(), "paideia-drop-cap-layout-"));
const toolbarCss = await readFile(path.join(root, "src", "components", "rich-text-toolbar", "RichTextToolbar.css"), "utf8");
const commandsSource = await readFile(path.join(root, "src-tauri", "src", "commands.rs"), "utf8");
assert.match(toolbarCss, /@supports \(initial-letter:\s*3\)[\s\S]*initial-letter:\s*3;/);
assert.match(toolbarCss, /@supports not \(initial-letter:\s*3\)[\s\S]*font-size:\s*3lh\s*!important;[\s\S]*line-height:\s*1;/);
assert.match(commandsSource, /@supports \(initial-letter:3\)[\s\S]*initial-letter:3;/);
assert.match(commandsSource, /@supports not \(initial-letter:3\)[\s\S]*font-size:3lh !important; line-height:1;/);

const sample = "a lettrine doit occuper exactement trois lignes du paragraphe. Le texte commence à sa droite pendant ces trois lignes, puis reprend toute la largeur disponible à partir de la quatrième ligne. Cette phrase prolonge volontairement le contenu afin de vérifier le retour régulier à la largeur normale.";

function pageContent() {
  return `<!doctype html><meta charset="utf-8"><style>
    * { box-sizing:border-box; }
    body { margin:0; font:18px/1.5 Arial,sans-serif; color:#182747; }
    section { width:min(620px,calc(100vw - 30px)); margin:24px auto; }
    p { margin:0 0 18px; display:flow-root; }
    .native p::first-letter { initial-letter:3; margin-inline-end:.12em; }
    .native .paideia-rich-drop-cap { float:none; font-size:inherit!important; line-height:inherit; }
    .fallback .paideia-rich-drop-cap { float:left; font-size:3lh!important; line-height:1; margin-inline-end:.12em; margin-block-start:0; }
  </style>
  <section class="native" data-scope="native"><p data-paideia-drop-cap="true"><strong><span style="color:#8d271c"><span class="paideia-rich-drop-cap" style="font-size:72px">L</span>${sample}</span></strong></p></section>
  <section class="fallback" data-scope="fallback"><p data-paideia-drop-cap="true"><span class="paideia-rich-drop-cap" style="font-size:96px;color:#244585;font-weight:700">L</span>${sample}</p></section>
  <pre id="result"></pre>
  <script>
    const round=(value)=>Math.round(value*100)/100;
    const rect=(node)=>{const value=typeof node.getBoundingClientRect==='function'?node.getBoundingClientRect():node;return {left:round(value.left),right:round(value.right),top:round(value.top),bottom:round(value.bottom),width:round(value.width),height:round(value.height)}};
    const textLines=(paragraph,marker)=>{const range=document.createRange();range.setStartAfter(marker);range.setEndAfter(paragraph.lastChild);const grouped=[];for(const item of range.getClientRects()){const value=rect(item),line=grouped.find(existing=>Math.abs(existing.top-value.top)<1);if(line){line.left=Math.min(line.left,value.left);line.right=Math.max(line.right,value.right);line.bottom=Math.max(line.bottom,value.bottom);}else grouped.push(value);}return grouped.sort((a,b)=>a.top-b.top);};
    const inspect=(section)=>{const paragraph=section.querySelector('p'),marker=section.querySelector('.paideia-rich-drop-cap'),style=getComputedStyle(marker);return {paragraph:rect(paragraph),marker:rect(marker),lines:textLines(paragraph,marker),fontSize:style.fontSize,float:style.float,lineHeight:style.lineHeight,color:style.color,supportsInitialLetter:CSS.supports('initial-letter','3')}};
    try { document.querySelector('#result').textContent=JSON.stringify(Object.fromEntries([...document.querySelectorAll('[data-scope]')].map((section)=>[section.dataset.scope,inspect(section)]))); }
    catch(error) { document.querySelector('#result').textContent=JSON.stringify({error:String(error),stack:error.stack}); }
  </script>`;
}

async function inspect(width, height) {
  const pagePath = path.join(runDirectory, `layout-${width}x${height}.html`);
  await writeFile(pagePath, pageContent());
  const html = execFileSync(edge, ["--headless", "--disable-gpu", "--no-first-run", `--window-size=${width},${height}`, "--dump-dom", `file:///${pagePath.replaceAll("\\", "/")}`], { encoding: "utf8" });
  const serialized = html.match(/<pre id="result">([^<]+)<\/pre>/)?.[1];
  if (!serialized) throw new Error(`Chromium did not serialize layout measurements:\n${html.slice(-1500)}`);
  return JSON.parse(serialized);
}

function verify(name, result) {
  if (result.error) throw new Error(`${name}: ${result.error}\n${result.stack ?? ""}`);
  if (process.env.PAIDEIA_LAYOUT_DEBUG === "1") console.log(name, JSON.stringify(result));
  assert.equal(result.native.supportsInitialLetter, true, `${name}: Chromium exposes native initial-letter support`);
  assert.equal(result.native.float, "none", `${name}: Chromium uses native initial-letter rather than a float`);
  assert.equal(result.native.fontSize, "18px", `${name}: authored character size is neutralized while the three-line layout is active`);
  assert.equal(result.fallback.float, "left", `${name}: Gecko-compatible fallback uses a float`);
  assert.equal(result.fallback.fontSize, "81px", `${name}: fallback height is three 27px paragraph lines`);
  assert.equal(result.native.color, "rgb(141, 39, 28)", `${name}: native color remains independent`);
  assert.equal(result.fallback.color, "rgb(36, 69, 133)", `${name}: fallback color remains independent`);
  for (const [scope, item] of Object.entries(result)) {
    assert.ok(item.lines.length >= 5, `${name}/${scope}: the fixture spans enough lines to test wrapping`);
    const inset = item.lines.filter((line) => line.left > item.paragraph.left + 8);
    assert.equal(inset.length, 3, `${name}/${scope}: exactly three text lines wrap beside the drop cap`);
    assert.ok(item.lines[3].left <= item.paragraph.left + 1, `${name}/${scope}: the fourth line recovers full paragraph width`);
    assert.ok(item.paragraph.bottom >= item.marker.bottom - 1, `${name}/${scope}: the paragraph contains the drop cap`);
  }
}

try {
  verify("Chromium desktop", await inspect(900, 900));
  verify("Chromium mobile", await inspect(390, 844));
  console.log("RichText drop caps occupy exactly three lines in native Chromium and in the Gecko-compatible float fallback.");
} finally {
  await rm(runDirectory, { force: true, recursive: true });
}
