import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(process.cwd() + '/package.json');
const ts = require('typescript');
import path from 'node:path';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const harness = `
 import React from 'react';
 import {createRoot} from 'react-dom/client';
 import {RichTextTableController} from './src/components/rich-text-table/RichTextTableController.tsx';
 import {createPaideiaTable} from './src/components/rich-text-table/tableDom.ts';
 import {RichTextTableInsertControl} from './src/components/rich-text-table/RichTextTableInsertControl.tsx';
 const editor=document.getElementById('editor');const {wrapper,table}=createPaideiaTable(3,3);editor.append(wrapper);window.changes=0;
 createRoot(document.getElementById('root')).render(React.createElement(RichTextTableController,{getEditor:()=>editor,onChange:()=>window.changes++}));
 const insertion=document.createElement('div');insertion.style.marginLeft='400px';document.body.prepend(insertion);
 createRoot(insertion).render(React.createElement(RichTextTableInsertControl,{onInsert:(rows,cols)=>{editor.replaceChildren(createPaideiaTable(rows,cols).wrapper);editor.dispatchEvent(new Event('input',{bubbles:true}));}}));
 `;
const modules=[],ids=new Map(),css=[];
function pack(file,source) {
 if(ids.has(file))return ids.get(file);
 const id=modules.length;ids.set(file,id);modules.push('');
 const ext=path.extname(file);
 if(ext==='.css'){css.push(fs.readFileSync(file,'utf8'));modules[id]='module.exports={}';return id;}
 if(['.png','.svg','.woff2'].includes(ext)){modules[id]='module.exports=""';return id;}
 if(ext==='.json'){modules[id]='module.exports='+fs.readFileSync(file,'utf8');return id;}
 let code=ts.transpileModule(source??fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const local=createRequire(file);
 code=code.replace(/require\(["']([^"']+)["']\)/g,(_,name)=>{
 let resolved;
 try{resolved=local.resolve(name);}catch(error){const base=path.resolve(path.dirname(file),name);resolved=['.ts','.tsx','/index.ts','/index.tsx'].map(e=>base+e).find(f=>fs.existsSync(f));if(!resolved)throw error;}
 return '__require('+pack(resolved)+')';
 }).replaceAll('import.meta.env','({})');
 modules[id]=code;return id;
}
const entry=pack(root+'/harness.tsx',harness);
const packed='(()=>{const process={env:{NODE_ENV:"development"}};const m=['+modules.map(m=>'function(module,exports,__require){'+m+'}').join(',')+'];const cache={};function __require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};m[id](module,module.exports,__require);return module.exports;}__require('+entry+');})()';
let browser;
try {
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',err=>console.error('PAGE',err.message));
 await page.setContent('<div id="editor" class="inline-rich-text-field" contenteditable="true" style="width:800px;margin:80px auto"></div><div id="root"></div>');
 await page.addStyleTag({content:fs.readFileSync(root+'/src/styles.css','utf8')});
 for(const content of css)await page.addStyleTag({content});
 await page.addScriptTag({content:packed});
 await page.waitForSelector('td');
 await page.waitForTimeout(700);
 const geometry=()=>page.evaluate(()=>{const t=document.querySelector('table').getBoundingClientRect(),w=document.querySelector('.paideia-rich-table-wrapper').getBoundingClientRect();return {left:t.left,right:t.right,width:t.width,center:t.left+t.width/2,expected:w.left+w.width/2,height:t.height};});
 const centered=async(label)=>{const g=await geometry();if(label==='initial')assert.ok(Math.abs(g.center-g.expected)<1);console.log('OK '+label,JSON.stringify(g));return g;};
 const drag=async(x,y,dx,dy)=>{
 const start=await geometry();
 const side=dy===0 && Math.abs(x-start.left)<6 ? 'left' : dy===0 && Math.abs(x-start.right)<6 ? 'right' : null;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});
 if(side){const during=await geometry();const opposite=side==='left'?'right':'left';assert.ok(Math.abs(during[opposite]-start[opposite])<1,'opposite edge must stay fixed during drag');assert.ok(Math.abs(during[side]-start[side]-dx)<1,'dragged edge follows pointer');console.log('OK anchored opposite edge during '+side+' drag');}
 await page.mouse.up();
 if(side){const after=await geometry();const opposite=side==='left'?'right':'left';assert.ok(Math.abs(after[opposite]-start[opposite])<1,'opposite edge stays fixed after release');assert.ok(Math.abs(after[side]-start[side]-dx)<1,'no recentering after release');console.log('OK no recentering after '+side+' release');}
 assert.equal(await page.locator('[data-rich-table-resizing]').count(),0);
 };
 await centered('initial');
 const widths=()=>page.locator('tr').first().locator('td').evaluateAll(cells=>cells.map(c=>c.getBoundingClientRect().width));
 const initialWidths=await widths();
 let cell=await page.locator('tr').first().locator('td').last().boundingBox();
 await drag(cell.x+cell.width-1,cell.y+cell.height/2,-40,0);
 await centered('shrink right edge');
 const rightWidths=await widths();
 assert.ok(Math.abs(rightWidths[0]-initialWidths[0])<1);
 assert.ok(Math.abs(rightWidths[1]-initialWidths[1])<1);
 assert.ok(Math.abs(rightWidths[2]-initialWidths[2]+40)<1);
 cell=await page.locator('td').first().boundingBox();
 await drag(cell.x+1,cell.y+cell.height/2,25,0);
 const before=await centered('shrink left edge');
 const leftWidths=await widths();
 assert.ok(Math.abs(leftWidths[0]-rightWidths[0]+25)<1);
 assert.ok(Math.abs(leftWidths[1]-rightWidths[1])<1);
 assert.ok(Math.abs(leftWidths[2]-rightWidths[2])<1);
 cell=await page.locator('td').first().boundingBox();
 await drag(cell.x+cell.width-1,cell.y+cell.height/2,20,0);
 const internal=await centered('internal column');assert.ok(Math.abs(internal.width-before.width)<1);
 cell=await page.locator('td').first().boundingBox();
 await drag(cell.x+cell.width/2,cell.y+cell.height-1,0,30);
 const row=await centered('row height');assert.ok(row.height>internal.height+20);assert.ok(Math.abs(row.width-internal.width)<1);
 const html=await page.locator('#editor').innerHTML();
 await page.evaluate(html=>{document.querySelector('#editor').innerHTML=html;},html);
 const reloaded=await centered('HTML reload');assert.ok(Math.abs(reloaded.left-row.left)<1);assert.ok(Math.abs(reloaded.width-row.width)<1);
 const commands=fs.readFileSync(root+'/src-tauri/src/commands.rs','utf8');
 const style=commands.match(/    \.rich-content \.paideia-rich-table\[data-paideia-table-custom-size="true"\].*/)[0].replaceAll('{{','{').replaceAll('}}','}');
 await page.evaluate(()=>document.querySelector('#editor').classList.add('rich-content'));
 await page.addStyleTag({content:style});
 const exported=await centered('SCORM custom-width CSS');assert.ok(Math.abs(exported.left-row.left)<1);assert.ok(Math.abs(exported.width-row.width)<1);
 assert.ok(await page.evaluate(()=>window.changes)>=4);
 await page.getByRole('button',{name:'Insérer un tableau',exact:true}).click();
 assert.equal(await page.getByRole('gridcell').count(),64);
 await page.getByRole('gridcell',{name:'Créer un tableau de 8 lignes et 8 colonnes',exact:true}).click();
 assert.equal(await page.locator('td').count(),64);
 const eight=await geometry();assert.ok(Math.abs(eight.center-eight.expected)<1);
 const launcher=page.getByRole('button',{name:'Commandes du tableau',exact:true});
 await launcher.click();
 assert.equal(await launcher.getAttribute('aria-expanded'),'true');
 await page.getByRole('menuitem',{name:'Insérer',exact:true}).click();
 const rowsBeforeMenuCommand=await page.locator('tr').count();
 await page.getByRole('menuitem',{name:'Ajouter une ligne en dessous',exact:true}).click();
 assert.equal(await page.locator('tr').count(),rowsBeforeMenuCommand+1);
 assert.equal(await page.locator('.rich-table-context-menu').count(),1,'table menu stays open after a command');
 assert.equal(await launcher.getAttribute('aria-expanded'),'true');
 assert.ok(await launcher.evaluate((button)=>Number(getComputedStyle(button).zIndex)>Number(getComputedStyle(document.querySelector('.rich-table-context-menu')).zIndex)),'launcher stays above the open menu');
 await page.getByRole('menuitem',{name:'Supprimer',exact:true}).click();
 await page.getByRole('menuitem',{name:'Supprimer la ligne',exact:true}).click();
 assert.equal(await page.locator('tr').count(),rowsBeforeMenuCommand);
 assert.equal(await page.locator('.rich-table-context-menu').count(),1,'table menu stays open after deleting a row');
 await launcher.click();
 assert.equal(await page.locator('.rich-table-context-menu').count(),0,'second launcher click closes the table menu');
 const clean=()=>page.locator('table').evaluate(t=>{const c=t.cloneNode(true);c.querySelectorAll('.paideia-rich-table-cell-selected').forEach(e=>e.classList.remove('paideia-rich-table-cell-selected'));c.querySelectorAll('[class=""]').forEach(e=>e.removeAttribute('class'));return c.outerHTML;});
 for(const label of ['Scinder verticalement','Scinder horizontalement']) {
   const prior=await clean();
   await page.locator('td').first().click();
   await page.keyboard.press('Shift+F10');
   await page.getByRole('menuitem',{name:label,exact:true}).click();
   const after=await clean();assert.notEqual(after,prior);
   const g=await geometry();assert.ok(Math.abs(g.left-eight.left)<1);assert.ok(Math.abs(g.width-eight.width)<1);
   await page.locator('td').first().click();
   await page.keyboard.press('Control+z');
   assert.equal(await clean(),prior);
   await page.locator('td').first().click();await page.keyboard.press('Control+y');
   assert.equal(await clean(),after);
   console.log('OK real menu '+label+' and undo/redo; table position unchanged');
 }
 const splitHtml=await page.locator('#editor').innerHTML();
 await page.evaluate(html=>{document.querySelector('#editor').innerHTML=html;},splitHtml);
 assert.equal(await page.locator('td').count(),66);
 const splitReloaded=await geometry();assert.ok(Math.abs(splitReloaded.width-eight.width)<1);
 console.log('OK 8x8 picker and split HTML reload');
 await page.getByRole('button',{name:'Insérer un tableau',exact:true}).click();
 await page.getByRole('gridcell',{name:'Créer un tableau de 8 lignes et 8 colonnes',exact:true}).click();
 await page.evaluate(()=>{
   const cell=document.querySelector('td'); const range=document.createRange();range.selectNodeContents(cell.querySelector('p'));range.collapse(true);
   window.getSelection().removeAllRanges();window.getSelection().addRange(range);
   const data=new DataTransfer();data.setData('text/plain',Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>`${r}:${c}`).join('\t')).join('\n'));
   cell.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
 });
 assert.equal(await page.locator('td').count(),81);
 assert.equal(await page.locator('td').last().textContent(),'8:8');
 await page.locator('td').last().click();await page.keyboard.press('Tab');
 assert.equal(await page.locator('tr').count(),10);
 assert.equal(await page.locator('td').count(),90);
 console.log('OK paste and Tab extend beyond creation limit');
 console.log('PASS table browser interactions');
} finally {await browser?.close();}
