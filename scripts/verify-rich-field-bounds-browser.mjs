import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'msedge', headless:true});
try {
  const page = await browser.newPage({viewport:{width:1500,height:1000}});
  await page.setContent('<div class="rich-content inline-rich-text-field" contenteditable="true" style="width:760px;margin:100px"></div>');
  await page.addStyleTag({content:fs.readFileSync('src/styles.css','utf8')});
  for (const name of ['richTextLineLeading', 'richTextParagraphStyle', 'richTextFieldBounds']) {
    const source = fs.readFileSync(`src/app/${name}.ts`, 'utf8').replace(/^export /gm, '');
    await page.addScriptTag({content:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText});
  }
  const result = await page.evaluate(async () => {
    const editor = document.querySelector('[contenteditable]');
    const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const overflow = () => {
      const box = editor.getBoundingClientRect();
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let amount = 0;
      while(walker.nextNode()) {
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        for(const rect of range.getClientRects()) amount = Math.max(amount, box.top - rect.top, rect.bottom - box.bottom);
      }
      return amount;
    };
    editor.innerHTML = '<ul>' + [1,2,3].map(n => `<li><h5 style="line-height:.25">${n}</h5></li>`).join('') + '</ul>';
    normalizeRichTextLineLeading(editor);
    const before = overflow();
    const html = editor.innerHTML;
    const stop = observeRichTextFieldBounds(editor);
    await tick();
    const after = overflow();
    const unchanged = html === editor.innerHTML;
    const cases = [];
    for(const heading of ['h1','h2','h3','h4','h5','p']) {
      const range = document.createRange(); range.selectNodeContents(editor);
      applyRichParagraphStyle(editor, range, heading);
      normalizeRichTextLineLeading(editor);
      await tick();
      cases.push({heading, overflow:overflow(), height:editor.getBoundingClientRect().height});
    }
    const firstHeight = editor.getBoundingClientRect().height;
    await tick(); await tick();
    const stable = firstHeight === editor.getBoundingClientRect().height;
    editor.style.width = '160px';
    editor.querySelector('p').textContent = 'Une ligne de texte qui passe sur plusieurs lignes';
    await tick();
    const narrowOverflow = overflow();
    editor.innerHTML = '<p>Texte normal</p>';
    await tick();
    const cleared = editor.style.paddingTop === '' && editor.style.paddingBottom === '';
    stop();
    return {before,after,unchanged,cases,stable,narrowOverflow,cleared};
  });
  assert.ok(result.before > 1, JSON.stringify(result));
  assert.ok(result.after <= 1, JSON.stringify(result));
  assert.equal(result.unchanged,true);
  assert.equal(result.stable,true);
  assert.ok(result.narrowOverflow <= 1, JSON.stringify(result));
  assert.equal(result.cleared,true);
  for(const entry of result.cases) assert.ok(entry.overflow <= 1, JSON.stringify(entry));
  console.log('Editor contains glyphs after H1–H5/paragraph changes at .25 leading; content unchanged; stable height.');
} finally { await browser.close(); }
