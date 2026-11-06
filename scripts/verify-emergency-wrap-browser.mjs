import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync('src/app/richTextLineLeading.ts', 'utf8');
const script = ts.transpileModule(source.replace(/^export /gm, ''), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage();
  await page.setContent('<div class="linear-block"><div class="course-intro-inline rich-content inline-rich-text-field" style="width:300px" contenteditable="true"></div></div>');
  await page.addStyleTag({content:fs.readFileSync('src/styles.css', 'utf8')});
  await page.addScriptTag({content:script});
  const result = await page.evaluate(() => {
    const editor = document.querySelector('[contenteditable]');
    const raw = 'anticonstitutionnellement ' + 'a'.repeat(150) + ' ' + '1'.repeat(150) + ' ' + ('64sdf'.repeat(40));
    editor.textContent = raw;
    normalizeEmergencyTextWrapping(editor);
    const marks = [...editor.querySelectorAll('[data-paideia-emergency-wrap]')];
    const wordRange = document.createRange();
    wordRange.setStart(editor.firstChild, 0);
    wordRange.setEnd(editor.firstChild, 'anticonstitutionnellement'.length);
    return {
      identical: editor.textContent === raw,
      fits: editor.scrollWidth <= editor.clientWidth + 1,
      wordLines: wordRange.getClientRects().length,
      wrapLines: marks.map(mark => mark.getClientRects().length),
      hyphens: marks.map(mark => getComputedStyle(mark).hyphens)
    };
  });
  assert.equal(result.identical, true);
  assert.equal(result.fits, true);
  assert.equal(result.wordLines, 1);
  assert.equal(result.wrapLines.length, 3, 'all technical long tokens receive a break opportunity');
  assert.ok(result.wrapLines.every(lines => lines > 1));
  assert.ok(result.hyphens.every(value => value === 'none'));
  console.log('Chromium: long artificial tokens fit; real word intact; text unchanged.');
} finally { await browser.close(); }
