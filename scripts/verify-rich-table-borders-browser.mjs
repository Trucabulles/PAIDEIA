import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const read = (file) => readFile(file, "utf8");
const editorCss = await read("src/components/rich-text-table/RichTextTable.css");
const appCss = await read("src/styles.css");
const nativeSource = await read("src-tauri/src/commands.rs");
const pdfSource = await read("src/export/pdf/renderLessonPdfHtml.ts");
const scormCss = nativeSource.slice(nativeSource.indexOf("    .paideia-rich-table-wrapper,.paideia-responsive-table-scroll {{"), nativeSource.indexOf("    .rich-inline-image {{ display:inline-block;"))
  .replaceAll("{{", "{").replaceAll("}}", "}");
const pdfCss = "table{border-collapse:collapse}td,th{border:1px solid #c5d0e5;padding:10px}" + pdfSource.slice(pdfSource.indexOf("/* Authored table and rich-image metadata"), pdfSource.indexOf(".tab-strip .tab-button"));
assert.ok(scormCss.includes("data-paideia-table-edge-left"));
assert.ok(pdfCss.includes("data-paideia-table-edge-left"));
const domModule = ts.transpileModule(await read("src/components/rich-text-table/tableDom.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({channel:"msedge",headless:true,args:["--no-proxy-server"]});
try {
  for (const [scope, css] of [["editor", appCss + editorCss], ["scorm", scormCss], ["pdf-a4", pdfCss]]) {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><style>${css}</style><main class="rich-content"><div class="inline-rich-text-field"></div></main><pre id="results"></pre><script>
      window.onerror = message => document.querySelector('#results').textContent = JSON.stringify({error:message});
      const exports = {}; ${domModule}
      const results = [];
      const plain = '<tr><th>A</th><th>B</th><th>C</th></tr><tr><td>D</td><td>E</td><td>F</td></tr><tr><td>G</td><td>H</td><td>I</td></tr>';
      const merged = '<tr><th rowspan="2">A</th><th colspan="2">B</th></tr><tr><td>C</td><td>D</td></tr><tr><td>E</td><td>F</td><td>G</td></tr>';
      for (const mode of ['grid','outer','inner','none']) for (const width of [1,2,3,4]) for (const [fixture, rows] of [['plain',plain],['merged',merged]]) {
        const host = document.querySelector('.inline-rich-text-field');
        host.innerHTML = '<table class="paideia-rich-table" data-paideia-table-border-mode="'+mode+'" data-paideia-table-border-width="'+width+'" style="--paideia-table-border-color:#125678"><tbody>'+rows+'</tbody></table>';
        const table = host.querySelector('table');
        exports.syncTableBorderEdges(table);
        results.push({mode,width,fixture,cells:Array.from(table.querySelectorAll('th,td')).map(cell => {
          const style = getComputedStyle(cell);
          return {text:cell.textContent, edges:['top','right','bottom','left'].map(side => cell.hasAttribute('data-paideia-table-edge-'+side)), colors:['Top','Right','Bottom','Left'].map(side => style['border'+side+'Color']), widths:['Top','Right','Bottom','Left'].map(side => style['border'+side+'Width'])};
        })});
      }
      document.querySelector('#results').textContent = JSON.stringify(results);
    </script>`);
    const result = JSON.parse(await page.locator('#results').textContent());
    assert.equal(result?.length, 32, scope + ": " + JSON.stringify(result));
    for (const {mode,width,fixture,cells} of result) {
      const expectedEdges = fixture === "merged" ? [[true,false,false,true],[true,true,false,false],[false,false,false,false],[false,true,false,false],[false,false,true,true],[false,false,true,false],[false,true,true,false]] : [[true,false,false,true],[true,false,false,false],[true,true,false,false],[false,false,false,true],[false,false,false,false],[false,true,false,false],[false,false,true,true],[false,false,true,false],[false,true,true,false]];
      cells.forEach((cell,index) => {
        const context = `${scope}/${fixture}/${mode}/${width}px/${cell.text}`;
        assert.deepEqual(cell.edges, expectedEdges[index], context + " fused edges");
        cell.edges.forEach((edge,side) => {
          const visible = mode === "grid" || (mode === "outer" && edge) || (mode === "inner" && !edge);
          assert.equal(cell.colors[side], visible ? "rgb(18, 86, 120)" : "rgba(0, 0, 0, 0)", context + " side " + side);
          assert.equal(cell.widths[side], width + "px", context + " width");
        });
      });
    }
    console.log(`PASS ${scope}: all four border modes, widths 1–4px, ordinary and merged cells`);
    await page.close();
  }
} finally {
  await browser.close();
}
