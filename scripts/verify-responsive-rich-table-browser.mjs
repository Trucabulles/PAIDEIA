import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(process.cwd() + '/package.json');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync('src/app/responsiveRichTextTables.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const browserModule = `(()=>{const exports={};${compiled};window.wrapResponsiveRichTextTables=exports.wrapResponsiveRichTextTables;})()`;
const importedTable = `<table data-paideia-table-custom-size="true" style="--paideia-table-custom-width:84.4304%;--paideia-table-custom-offset:15.5696%"><colgroup><col width="190"><col width="230"><col width="230"><col width="230"></colgroup><thead><tr><th>Symptôme</th><th>Causes plausibles</th><th>Vérifications utiles</th><th>Résolution / orientation</th></tr></thead><tbody><tr><td>Aucun voyant, aucun ventilateur, aucun bruit</td><td>prise secteur, multiprise, câble, interrupteur du bloc, alimentation HS</td><td>tester la prise, vérifier le câble, l'interrupteur PSU</td><td>rétablir l'alimentation ou escalader</td></tr></tbody></table>`;

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent('<main class="preview-mode"><section class="linear-block block-type-rich-text" style="width:360px"><div class="rich-content"></div></section></main>');
  await page.addStyleTag({ content: fs.readFileSync('src/styles.css', 'utf8') });
  await page.addStyleTag({ content: fs.readFileSync('src/components/rich-text-table/RichTextTable.css', 'utf8') });
  await page.addScriptTag({ content: browserModule });
  await page.evaluate((html) => {
    document.querySelector('.rich-content').innerHTML = window.wrapResponsiveRichTextTables(html);
  }, importedTable);

  const geometry = await page.evaluate(() => {
    const wrapper = document.querySelector('.paideia-responsive-table-scroll');
    const table = wrapper.querySelector('table');
    const cells = Array.from(table.querySelectorAll('th,td'));
    return {
      wrapperWidth: wrapper.getBoundingClientRect().width,
      scrollWidth: wrapper.scrollWidth,
      tableWidth: table.getBoundingClientRect().width,
      minimumCellWidth: Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)),
      wrapperCount: document.querySelectorAll('.paideia-responsive-table-scroll').length,
      tabIndex: wrapper.tabIndex
    };
  });
  assert.equal(geometry.wrapperCount, 1);
  assert.equal(geometry.tabIndex, 0);
  assert.ok(geometry.scrollWidth > geometry.wrapperWidth + 100, JSON.stringify(geometry));
  assert.ok(geometry.tableWidth > geometry.wrapperWidth + 100, JSON.stringify(geometry));
  assert.ok(geometry.minimumCellWidth >= 143, JSON.stringify(geometry));

  await page.evaluate(() => {
    const scope = document.querySelector('.rich-content');
    scope.innerHTML = window.wrapResponsiveRichTextTables(scope.innerHTML);
  });
  assert.equal(await page.locator('.paideia-responsive-table-scroll').count(), 1);

  const layoutHtml = '<table data-paideia-layout="columns"><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
  assert.equal(await page.evaluate((html) => window.wrapResponsiveRichTextTables(html), layoutHtml), layoutHtml);
  console.log('PASS responsive imported Rich Text table in LMS-sized Edge viewport', geometry);
} finally {
  await browser?.close();
}
