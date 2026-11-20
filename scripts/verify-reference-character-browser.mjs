import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const directory = await mkdtemp(path.join(tmpdir(), "paideia-reference-character-"));
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RichTextReferenceTooltip } from './src/components/rich-text-toolbar/RichTextReferenceTooltip';
import { DialogueCharacter } from './src/components/activities/SituationalDialogueActivity/DialogueCharacter';
import { CharacterResourceManager } from './src/components/resources/CharacterResource/CharacterResourceManager';
import './src/components/rich-text-toolbar/RichTextToolbar.css';
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
const delay = () => new Promise(resolve => setTimeout(resolve, 40));
function check(value, message) { if (!value) throw Error(message); }
const host = document.createElement('div'); document.body.append(host);
const root = createRoot(host);
const result = document.createElement('pre'); result.id = 'result'; document.body.append(result);
async function run() {
  const trigger = document.createElement('span');
  trigger.textContent = 'Renvoi'; trigger.tabIndex = 0;
  trigger.style.cssText = 'position:fixed;left:300px;top:46vh';
  trigger.dataset.paideiaReferenceId = 'legacy';
  trigger.dataset.paideiaBookmarkTarget = 'reference-bank:bank:entry';
  document.body.append(trigger);
  const definition = '<p><span data-paideia-reference-id="nested" data-paideia-bookmark-target="reference-bank:bank:entry">Ancien renvoi imbriqué</span></p>' + '<p>Contenu long de la définition.</p>'.repeat(50);
  root.render(<RichTextReferenceTooltip project={{course:{modules:[]},referenceBanks:[{id:'bank',entries:[{id:'entry',term:'Renvoi',definitionHtml:definition}]}]}}/>);
  await delay(); trigger.focus(); await delay(); await delay();
  let tooltip = document.querySelector('[role=tooltip]');
  check(tooltip, 'Tooltip opens');
  check(!tooltip.querySelector('[data-paideia-reference-id]'), 'Definition cannot reopen its own nested reference');
  const rect = tooltip.getBoundingClientRect();
  check(rect.top >= 0 && rect.bottom <= innerHeight + 1, 'Long tooltip stays within viewport');
  const scroll = tooltip.querySelector('.paideia-reference-scroll');
  check(scroll.scrollHeight > scroll.clientHeight, 'Long definition is scrollable');
  scroll.scrollTop = scroll.scrollHeight; scroll.dispatchEvent(new Event('scroll')); await delay();
  check(tooltip.querySelector('.paideia-reference-scroll-hint').hidden, 'Chevron disappears at bottom');
  window.dispatchEvent(new Event('resize')); await delay();
  check(!errors.length, 'Tooltip has no React update loop: ' + errors.join(';'));
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); await delay();
  check(!document.querySelector('[role=tooltip]'), 'Escape closes tooltip'); trigger.remove();
  const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="240"><rect width="100" height="240" fill="navy"/></svg>');
  for (const layout of ['responses-below','compact-portrait']) {
    const commits = [];
    root.render(<DialogueCharacter key={layout} src={image} alt="Personnage" layout={layout} onCommit={value=>commits.push(value)} />);
    await delay();
    const figure = host.querySelector('figure');
    figure.dispatchEvent(new MouseEvent('dblclick',{ bubbles:true, cancelable:true })); await delay();
    document.body.dispatchEvent(new KeyboardEvent('keydown',{ key:'+',ctrlKey:true,bubbles:true,cancelable:true })); await delay();
    check(Number(host.querySelector('img').style.scale) === 1.05, layout + ' Ctrl+ zooms in');
    document.body.dispatchEvent(new KeyboardEvent('keydown',{ key:'-',ctrlKey:true,bubbles:true,cancelable:true })); await delay();
    check(Number(host.querySelector('img').style.scale) === 1, layout + ' Ctrl- zooms out');
    figure.dispatchEvent(new WheelEvent('wheel',{deltaY:-1,ctrlKey:true,bubbles:true,cancelable:true})); await delay();
    check(Number(host.querySelector('img').style.scale) === 1.05, layout + ' trackpad pinch zooms');
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await delay();
    check(commits.at(-1)?.zoom === 1.05, layout + ' commits zoom');
  }
  const pending = [{id:'pending', state:'neutral',file:new File(['image'],'portrait.png'),url:image,makeDefault:true}];
  const props = {characters:[],draft:{id:'',name:'Personnage',role:'',description:''},pendingPoses:pending,saveError:'',selectedCharacterId:'__draft__',formatCount:(count)=>String(count),onAddCharacter:()=>{},onBackToTiles:()=>{},onDeleteCharacterRequest:()=>{},onDuplicateCharacter:async()=>{},onDraftChange:()=>{},onRemovePendingPose:()=>{},onExportCharacters:async()=>{},onImportCharacters:async()=>{},onRenameCharacter:async()=>{},onSaveCharacter:async()=>{},onSelectCharacter:()=>{},onSetDefaultPose:()=>{},onUploadPose:()=>{},onUploadPreview:()=>{},resolvePoseUrl:()=>null,resolvePreviewUrl:()=>null};
  root.render(<CharacterResourceManager {...props} saveFeedbackState="idle"/>); await delay();
  check(host.querySelector('.resource-pose-default-preview img'), 'Pending image is visible before initial save');
  const bar = host.querySelector('.resource-character-topbar').getBoundingClientRect();
  const save = host.querySelector('.resource-character-save-area').getBoundingClientRect();
  check(Math.abs(bar.right - save.right) < 1, 'Save is aligned to the right');
  root.render(<CharacterResourceManager {...props} saveFeedbackState="saving"/>); await delay();
  check(host.querySelector('fieldset').disabled && host.querySelector('.character-resource-save-button').disabled, 'Saving locks form and save button');
  check(!errors.length, errors.join(';'));
  root.unmount(); result.textContent = 'PASS ' + innerWidth + 'x' + innerHeight;
}
run().catch(error => { result.textContent = 'FAIL ' + error.stack; });
`;

try {
  await build({
    stdin: { contents: fixture, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, outfile: path.join(directory, "fixture.js"), jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, external: ["/fonts/*"],
    loader: { ".svg": "dataurl" }, logLevel: "silent"
  });
  const html = path.join(directory, "fixture.html");
  await writeFile(html, '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="fixture.css"><script defer src="fixture.js"></script>');
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    let windowWidth = width;
    let windowHeight = height;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { stdout, stderr } = await promisify(execFile)("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
        "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
        "--allow-file-access-from-files", "--user-data-dir=" + path.join(directory, "profile-" + width),
        "--window-size=" + windowWidth + "," + windowHeight, "--virtual-time-budget=10000", "--dump-dom", pathToFileURL(html).href
      ], { timeout: 60000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
      const result = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1] ?? "Missing browser result " + stdout.slice(0, 500) + stderr.slice(0, 1500);
      assert.match(result, /^PASS /, result);
      const [, actualWidth, actualHeight] = result.match(/^PASS (\d+)x(\d+)/);
      if (Number(actualWidth) === width && Number(actualHeight) === height) {
        console.log(result);
        break;
      }
      assert.equal(attempt, 0, "Browser viewport must match the requested resolution");
      windowWidth += width - Number(actualWidth);
      windowHeight += height - Number(actualHeight);
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
