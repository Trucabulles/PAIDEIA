import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const directory = await mkdtemp(path.join(tmpdir(), "paideia-caption-visibility-"));
const moduleCss = await readFile(path.join(root, "src/components/activities/VideoActivity/VideoActivity.module.css"), "utf8");
const appCss = moduleCss.replace(/:global\(([^\r\n]*)\)(?=\s*[,\{\r\n])/g, "$1");
const commands = await readFile(path.join(root, "src-tauri/src/commands.rs"), "utf8");
const start = commands.indexOf("    .paideia-video-player .plyr {{");
const end = commands.indexOf("    .block.image-360 {{", start);
assert.ok(start >= 0 && end > start, "SCORM video styles are present");
const scormCss = commands.slice(start, end).replaceAll("{{", "{").replaceAll("}}", "}").replaceAll('\\"', '"');
const plyrCssUrl = pathToFileURL(path.join(root, "node_modules/plyr/dist/plyr.css")).href;
const plyrScriptUrl = pathToFileURL(path.join(root, "node_modules/plyr/dist/plyr.min.js")).href;

try {
  const fixture = path.join(directory, "captions.html");
  await writeFile(fixture, `<!doctype html><meta charset="utf-8">
    <link rel="stylesheet" href="${plyrCssUrl}">
    <style>${appCss}\n${scormCss}
      section { width:700px; max-width:100%; }
    </style>
    <script src="${plyrScriptUrl}"></script>
    <pre id="result"></pre>
    <script>
      const results = [];
      for (const scope of ['playerFrame', 'paideia-video-player']) {
        for (const fullscreen of [false, true]) {
          for (const background of [true, false]) {
            const host = document.createElement('section');
            host.className = scope;
            host.style.setProperty('--video-caption-background', background ? 'rgba(0, 0, 0, 0.8)' : 'transparent');
            host.innerHTML = '<video></video>';
            document.body.append(host);
            const player = new Plyr(host.querySelector('video'), { controls:['play', 'progress', 'captions'], loadSprite:false, storage:{enabled:false} });
            const container = player.elements.container;
            container.classList.add('plyr--captions-active');
            if (fullscreen) container.classList.add('plyr--fullscreen-active');
            const captions = player.elements.captions;
            const video = host.querySelector('video');
            const controls = host.querySelector('.plyr__controls');
            const measure = () => ({
              display:getComputedStyle(captions).display,
              width:captions.getBoundingClientRect().width,
              height:captions.getBoundingClientRect().height,
              background:getComputedStyle(captions).backgroundColor,
              padding:getComputedStyle(captions).padding,
              controlsDisplay:getComputedStyle(controls).display,
              videoHeight:video.getBoundingClientRect().height
            });
            const states = {};
            captions.replaceChildren();
            states.initial = measure();
            captions.innerHTML = '<span class="plyr__caption">Un sous-titre</span>';
            states.text = measure();
            // Plyr keeps an empty caption span when the active cue ends.
            captions.innerHTML = '<span class="plyr__caption"></span>';
            states.gap = measure();
            captions.innerHTML = '<span class="plyr__caption"><i>Première ligne</i>\\nDeuxième ligne</span>';
            states.nextText = measure();
            container.classList.remove('plyr--captions-active');
            states.disabled = measure();
            container.classList.add('plyr--captions-active');
            states.enabled = measure();
            captions.innerHTML = '<span class="plyr__caption"></span>';
            states.seekGap = measure();
            results.push({scope,fullscreen,background,states});
            player.destroy();
            host.remove();
          }
        }
      }
      document.querySelector('#result').textContent = JSON.stringify(results);
    </script>`);
  const output = execFileSync(edge, [
    "--headless", "--disable-gpu", "--no-first-run",
    `--user-data-dir=${path.join(directory, "profile")}`,
    "--window-size=1000,900", "--dump-dom", pathToFileURL(fixture).href
  ], { encoding:"utf8", timeout:30000, stdio:["ignore", "pipe", "pipe"] });
  const results = JSON.parse(output.match(/<pre id="result">([^<]+)<\/pre>/)?.[1] ?? "null");
  assert.equal(results?.length, 8, "both renderers, fullscreen modes and background settings are tested");
  for (const {scope, fullscreen, background, states} of results) {
    const label = `${scope}, fullscreen=${fullscreen}, background=${background}`;
    for (const state of ["initial", "gap", "seekGap", "disabled"]) {
      assert.equal(states[state].display, "none", `${label}: ${state} hides the entire caption panel`);
      assert.equal(states[state].width, 0, `${label}: ${state} leaves no background width`);
      assert.equal(states[state].height, 0, `${label}: ${state} leaves no background height`);
    }
    for (const state of ["text", "nextText", "enabled"]) {
      assert.equal(states[state].display, "block", `${label}: ${state} remains visible`);
      assert.ok(states[state].width > 0 && states[state].height > 0, `${label}: ${state} has a text panel`);
      assert.equal(states[state].background, background ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0)", `${label}: the background option is preserved`);
    }
    for (const state of Object.values(states)) {
      assert.equal(state.videoHeight, states.initial.videoHeight, `${label}: caption changes do not alter the video geometry`);
      assert.equal(state.controlsDisplay, states.initial.controlsDisplay, `${label}: controls remain unchanged`);
    }
  }
  console.log("Video caption visibility: startup, cue gaps, text return, caption toggle, fullscreen layout and background options OK in app and SCORM CSS.");
} finally {
  assert.equal(path.dirname(directory), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith("paideia-caption-visibility-"));
  await rm(directory, { recursive:true, force:true });
}
