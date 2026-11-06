import fs from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage();
  await page.setContent('<div contenteditable="true" id="editor"></div>');
  const source = fs.readFileSync('src/app/richTextListFormatting.ts','utf8').replace(/^export /gm,'');
  await page.addScriptTag({content:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText});
  const result = await page.evaluate(() => {
    const editor = document.querySelector('#editor');
    editor.innerHTML='<ul><li><h1><b>1</b></h1></li><li><h1><b>2</b></h1></li><li><h1>3</h1></li></ul>';
    editor.focus();
    const range=document.createRange();
    range.setStart(editor.querySelector('b').firstChild,0);
    range.setEnd(editor.querySelectorAll('b')[1].firstChild,1);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    clearListSelectionTypography(editor,range);
    return {html:editor.innerHTML, lists:editor.querySelectorAll('ul').length,items:editor.querySelectorAll('li').length,text:editor.textContent,bold:editor.querySelectorAll('b').length};
  });
  assert.equal(result.lists,1);
  assert.equal(result.items,3);
  assert.equal(result.text,'123');
  assert.equal(result.bold,0);
  assert.ok(!result.html.includes('<br>'));
  console.log('Selected list headings clear inline styles without splitting lists or inserting paragraphs.');
} finally { await browser.close(); }
