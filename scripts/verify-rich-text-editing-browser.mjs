import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync('src/App.tsx', 'utf8');
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map();
let keyHandler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    functions.set(node.name.text, node.getText(ast));
    if (node.name.text === 'InlineRichTextField') {
      function jsx(n) {
        if (ts.isJsxAttribute(n) && n.name.text === 'onKeyDown') keyHandler = n.initializer.expression.getText(ast);
        ts.forEachChild(n, jsx);
      }
      jsx(node);
    }
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(keyHandler, 'actual InlineRichTextField key handler');
function js(s) { return ts.transpileModule(s.replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText; }
const normalization = js(fs.readFileSync('src/app/richTextNormalization.ts', 'utf8'));
const sanitizer = js(fs.readFileSync('src/app/richTextSanitizer.ts', 'utf8').replace(/^import .*;$/gm, ''));
const selected = ['applyPendingInlineStyleToElement', 'applyRichTextOutlineOffStyle', 'removeRichTextOutlineStyle', 'insertStyledTextAtCaret', 'cleanEditorHtmlForRichTextSession', 'stripPendingStyleCaretMarkersFromHtml'];
const setup = `
const savedRangeRef={current:null},savedSelectionBookmarkRef={current:null},lastCollapsedSelectionBookmarkRef={current:null};
const RICH_TEXT_OUTLINE_COLOR_PROPERTY='--paideia-rich-outline-color';
function captureRichEditorSelectionBookmark(){return null;}
const onKeyDownOverride=undefined, onLiveInput=undefined, commitOnInput=false, preserveBlockStyleOnEnter=false;
const localHtmlRef={},initialHtmlRef={};function syncEmptyClass(){}
${normalization}
${sanitizer}
${js(selected.map(name => { assert.ok(functions.has(name), name); return functions.get(name); }).join('\n'))}
const keyHandler=${js('const handler='+keyHandler).replace(/^const handler\s*=\s*/, '').replace(/;\s*$/, '')};
function reset(html){document.body.innerHTML='<div id="editor" contenteditable="true"></div>';const e=document.querySelector('#editor');e.innerHTML=html;e.addEventListener('keydown',keyHandler);e.focus();return e;}
function caret(node,offset){const r=document.createRange();r.setStart(node,offset);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);}
`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => console.error(error));
  await page.addScriptTag({ content: setup });
  const typed = await page.evaluate(() => {
    const e=reset('<p><span style="font-weight:bold;font-style:italic">Début&nbsp;</span></p>');
    caret(e.querySelector('span').firstChild,6);
    for(const c of 'différents éléments') insertStyledTextAtCaret(e,c,{bold:true});
    const text=e.textContent;
    const spans=e.querySelectorAll('span').length;
    const last=e.querySelector('p').lastElementChild;
    const italic=getComputedStyle(last).fontStyle;
    document.execCommand('undo');const undone=e.textContent;
    document.execCommand('redo');const redone=e.textContent;
    const color=document.createElement('span');applyPendingInlineStyleToElement(color,{color:'#ff0000'});
    return {text,spans,italic,undone,redone,color:color.getAttribute('style')};
  });
  assert.equal(typed.text.replaceAll('\u00a0',' '),'Début différents éléments');
  assert.ok(typed.spans<=3,JSON.stringify(typed));
  assert.equal(typed.italic,'italic');
  assert.notEqual(typed.undone,typed.text);
  assert.equal(typed.redone,typed.text);
  assert.ok(!/font-weight|font-style|text-decoration/.test(typed.color));
  console.log('OK styled typing stays compact, preserves inherited italic; native undo/redo; color-only is color-only');
  for (const style of [{color:'#ff0000'},{bold:false},{underline:true},{fontSize:'24px'},{backgroundColor:'#ffff00'}]) {
    const result=await page.evaluate(style=>{
      const e=reset('<p><span style="font-weight:bold;font-style:italic">Début&nbsp;</span></p>');
      caret(e.querySelector('span').firstChild,6);
      for(const c of 'texte avec espace')insertStyledTextAtCaret(e,c,style);
      const n=getSelection().getRangeAt(0).startContainer;
      const element=n instanceof Element?n:n.parentElement;
      const s=getComputedStyle(element);
      return {text:e.textContent,spans:e.querySelectorAll('span').length,weight:s.fontWeight,italic:s.fontStyle,color:s.color,size:s.fontSize,html:e.innerHTML};
    },style);
    assert.equal(result.text.replaceAll('\u00a0',' '),'Début texte avec espace',JSON.stringify(style));
    assert.ok(result.spans<=5,JSON.stringify(result));
    assert.equal(result.italic,'italic');
    if(style.bold===false)assert.equal(result.weight,'400');
    else assert.equal(result.weight,'700');
    if(style.color)assert.equal(result.color,'rgb(255, 0, 0)');
    if(style.fontSize)assert.equal(result.size,'24px');
  }
  console.log('OK color, bold off, underline, size and highlight typing preserve text/spaces and remain compact');
  for (const shift of [true,false]) {
    await page.evaluate(()=>{const e=reset('<ul><li style="margin-inline-start:15em;color:blue" value="8">Alpha Beta</li></ul>');caret(e.querySelector('li').firstChild,5);});
    await page.keyboard.press(shift?'Shift+Enter':'Enter');
    const result=await page.evaluate(()=>[...document.querySelectorAll('li')].map(e=>({text:e.textContent,style:e.getAttribute('style'),value:e.getAttribute('value'),breaks:e.querySelectorAll('br').length})));
    if(shift){assert.equal(result.length,1);assert.ok(result[0].breaks>=1);}
    else {assert.equal(result.length,2);assert.equal(result[1].style,result[0].style);assert.equal(result[1].value,null);}
  }
  console.log('OK Enter preserves list indentation/style and numbering; Shift+Enter stays within item');
  const compacted=await page.evaluate(()=>{
    const a='<span style="font-weight:bold" data-paideia-outline="none">';
    const html='<p>'+a+'a'+a+'b</span></span>'+a+'c</span></p>';
    const clean=sanitizeRichTextHtml(html);
    const relative='<p><span style="font-size:2em">a<span style="font-size:2em">b</span></span></p>';
    const r=document.createElement('div');r.innerHTML=relative;compactRichTextSpans(r);
    return {clean,idempotent:sanitizeRichTextHtml(clean)===clean,relative:r.innerHTML};
  });
  assert.equal((compacted.clean.match(/<span/g)||[]).length,1);
  assert.ok(compacted.clean.includes('abc'));
  assert.ok(compacted.idempotent);
  assert.equal((compacted.relative.match(/<span/g)||[]).length,2);
  console.log('OK equivalent spans compacted; relative font sizes protected; cleanup idempotent');
  const appCss=fs.readFileSync('src/styles.css','utf8');
  const scormSource=fs.readFileSync('src-tauri/src/commands.rs','utf8');
  const cssStart=scormSource.indexOf('    :root {{ --blue:');
  const scormCss=scormSource.slice(cssStart,scormSource.indexOf('  </style>',cssStart)).replaceAll('{{','{').replaceAll('}}','}');
  const fixture='<p style="font-size:18px"><strong style="font-size:18px"><strong style="font-size:18px"><span style="font-size:18px"><span style="color:rgb(36,103,178);font-size:18px">HDMI (high definition multimedia interface)</span></span></strong></strong></p><p style="font-size:18px"><span style="background-color:transparent;text-align:justify">Interface numérique HDMI</span></p>';
  for(const surface of ['editor','preview','scorm']){
    await page.locator('style').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
    await page.addStyleTag({content:surface==='scorm'?scormCss:appCss});
    for(const activityType of ['rich-text','note','quote','image-text'])for(const width of [790,375])for(const content of [fixture,'HDMI<div>Interface numérique HDMI</div>','<p>HDMI</p><p>Interface numérique HDMI</p>']){
      await page.evaluate(({content,surface,width,activityType})=>{
        const e=reset(content);
        const wrapper=document.createElement('section');
        wrapper.className=surface==='scorm'&&activityType!=='rich-text'
          ? `block rich ${activityType}`
          : `linear-block block-type-${activityType}`;
        e.before(wrapper);wrapper.append(e);
        if(surface==='preview')wrapper.classList.add('preview-mode');
        e.className=surface==='scorm'&&activityType==='rich-text'
          ? 'block rich rich-text-content-inset'
          : `rich-content${surface==='scorm'?'':' inline-rich-text-field'}`;
        e.style.cssText=`width:${width}px;font-size:18px;line-height:1.5`;
        const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);const node=walker.nextNode();caret(node,node.length);
      },{content,surface,width,activityType});
      const before=await page.locator('#editor').evaluate(e=>e.getBoundingClientRect().height);
      await page.keyboard.press('Enter');
      const after=await page.locator('#editor').evaluate(e=>e.getBoundingClientRect().height);
      assert.ok(Math.abs(after-before-27)<0.1,`${surface} ${activityType} ${width}: Enter adds ${after-before}px instead of 27px`);
    }
    const margins=await page.evaluate(()=>{
      const e=document.querySelector('#editor');e.innerHTML='<p style="margin-bottom:12px">Auteur</p><table><tbody><tr><td><p>Cellule</p><p>Suite</p></td></tr></tbody></table>';
      const cellStyle=getComputedStyle(e.querySelector('td p'));
      return {author:getComputedStyle(e.firstElementChild).marginBottom,table:parseFloat(cellStyle.marginBottom)/parseFloat(cellStyle.fontSize)};
    });
    assert.equal(margins.author,'12px');
    assert.ok(Math.abs(margins.table-0.8)<0.001);
  }
  console.log('OK fresh Rich Text, Note, Quote and Image+Text: Enter adds 27px at 790/375px in editor/preview/SCORM; authored margins and tables preserved');
} finally { await browser.close(); }
