import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const project=path.resolve(process.argv[2] || '');
const apply=process.argv.includes('--apply');
assert.ok(fs.existsSync(path.join(project,'project.json')),'explicit project required');
const code=ts.transpileModule(fs.readFileSync('src/app/richTextNormalization.ts','utf8').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function contentFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?contentFiles(path.join(dir,e.name)):e.name.endsWith('.json')?[path.join(dir,e.name)]:[]);}
const files=[path.join(project,'project.json'),...contentFiles(path.join(project,'content'))];
const browser=await chromium.launch({channel:'msedge',headless:true});
const proposals=[];
try {
 const page=await browser.newPage();
 await page.setContent('<div class="rich-content" id="test" style="font-family:Arial;font-size:18px"></div>');
 await page.addStyleTag({content:fs.readFileSync('src/styles.css','utf8')});
 const marker=fs.readFileSync('public/fonts/Permanent_Marker/PermanentMarker-Regular.woff2').toString('base64');
 await page.addStyleTag({content:`@font-face{font-family:PaideiaRichFont-rich-bundled-permanent-marker;src:url(data:font/woff2;base64,${marker})}`});
 await page.evaluate(()=>document.fonts.load('20px PaideiaRichFont-rich-bundled-permanent-marker'));
 await page.addScriptTag({content:code});
 for(const file of files){
  const original=fs.readFileSync(file,'utf8'),value=JSON.parse(original),changes=[];
  async function walk(v,where=''){
   if(!v||typeof v!=='object'||v.type==='html-custom')return;
   for(const [key,html] of Object.entries(v)){
    if(key==='sourceRawHtml')continue;
    if(typeof html==='object'){await walk(html,where+'.'+key);continue;}
    if(typeof html!=='string'||!html.includes('<span')||!/(Html$|^title$|^frontText$)/.test(key))continue;
    const result=await page.evaluate(html=>{const t=document.createElement('template');t.innerHTML=html;const before=t.innerHTML;compactRichTextSpans(t.content);return {before,after:t.innerHTML};},html);
    // Avoid serialization-only edits. Only real structural simplification counts.
    if(result.before===result.after)continue;
    for(const width of [1090,375]){
     const verify=await page.evaluate(({before,after,width})=>{
      const e=document.querySelector('#test');e.style.width=width+'px';
      function snapshot(html){e.innerHTML=html;const rect=e.getBoundingClientRect();const chars=[];
       const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
       while(walker.nextNode()){const n=walker.currentNode,s=getComputedStyle(n.parentElement);for(let i=0;i<n.length;i++){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();chars.push([n.data[i],...[b.x-rect.x,b.y-rect.y,b.width,b.height].map(v=>Math.round(v*100)/100),s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle,s.color,s.textDecorationLine]);}}
       return {text:e.textContent,height:rect.height,chars,structure:[...e.querySelectorAll('*:not(span)')].map(n=>[n.tagName,[...n.attributes].map(a=>[a.name,a.value])])};
      }
      return {before:snapshot(before),after:snapshot(after)};
     },{before:html,after:result.after,width});
     const label=`${path.basename(file)} ${where}.${key} ${width}px`;
     assert.equal(verify.after.text,verify.before.text,label+' text');
     assert.equal(verify.after.height,verify.before.height,label+' height');
     assert.deepEqual(verify.after.structure,verify.before.structure,label+' structure');
     assert.equal(verify.after.chars.length,verify.before.chars.length);
     for(let i=0;i<verify.before.chars.length;i++){
      const a=verify.after.chars[i],b=verify.before.chars[i];
      assert.deepEqual([a[0],...a.slice(5)],[b[0],...b.slice(5)],label+' typography');
      // Removing artificial run boundaries changes subpixel glyph rounding.
      // Line positions/heights must stay exact; horizontal tolerance is <1px.
      assert.equal(a[2],b[2],label+' line position');assert.equal(a[4],b[4],label+' glyph height');
      assert.ok(Math.abs(a[1]-b[1])<1 && Math.abs(a[3]-b[3])<1,label+' glyph position '+i);
     }
    }
    const second=await page.evaluate(html=>{const t=document.createElement('template');t.innerHTML=html;compactRichTextSpans(t.content);return t.innerHTML;},result.after);
    assert.equal(second,result.after,'idempotent cleanup');
    changes.push({field:where+'.'+key,beforeBytes:Buffer.byteLength(html),afterBytes:Buffer.byteLength(result.after),beforeSpans:(html.match(/<span\b/g)||[]).length,afterSpans:(result.after.match(/<span\b/g)||[]).length});
    v[key]=result.after;
   }
  }
  await walk(value);
  if(changes.length)proposals.push({file,original,hash:digest(original),updated:JSON.stringify(value,null,2)+'\n',changes});
 }
 await page.close();
} finally {await browser.close();}
const report={project,applied:apply,files:proposals.map(({file,hash,changes})=>({file,hash,changes}))};
if(apply){
 // Verify all files before any write; the user must keep this project closed.
 for(const p of proposals)assert.equal(digest(fs.readFileSync(p.file,'utf8')),p.hash,'project changed since audit');
 const backup=path.resolve('artifacts/rich-text-cleanup-'+new Date().toISOString().replaceAll(':','-'));
 fs.mkdirSync(backup,{recursive:true});
 for(const p of proposals){const dest=path.join(backup,path.relative(project,p.file));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,p.original);}
 for(const p of proposals){fs.writeFileSync(p.file,p.updated);assert.equal(digest(fs.readFileSync(p.file,'utf8')),digest(p.updated));}
 report.backup=backup;
 fs.writeFileSync(path.join(backup,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report,null,2));
