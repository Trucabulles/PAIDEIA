import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source=fs.readFileSync('src-tauri/src/commands.rs','utf8');
const decode=s=>s.replaceAll('{{','{').replaceAll('}}','}');
const css=decode(source.slice(source.indexOf('    .progress-nav {{'),source.indexOf('  </style>')));
const markup=source.match(/r#"(<aside class="progress-nav collapsed"[\s\S]*?<\/aside>)"#/)[1].replace('{}','Test lesson').replace('{}','<a href="#chapter-2" data-paideia-nav-chapter="chapter-2">Second chapter</a>');
function fn(name){const start=source.indexOf('    function '+name+'(');return decode(source.slice(start,source.indexOf('\n    function ',start+10)));}
const setupStart=source.indexOf('      var progressNav = document.getElementById');
const setup=decode(source.slice(setupStart,source.indexOf('      document.querySelectorAll("[data-paideia-nav-chapter]").forEach(function(link)',setupStart)));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const width of [1280,375]) {
  const page=await browser.newPage({viewport:{width,height:800}});
  page.on('pageerror',error=>console.error(error.message));
  await page.setContent(`<style>:root{--blue:#123a7a;--line:#ddd}${css}</style><body class="scorm-export chapter-active">${markup}<main style="padding-top:100px"><section id="chapter-1" class="chapter">First</section><section id="chapter-2" class="chapter">Second</section></main></body>`);
  await page.evaluate(()=>{window.chapterPercentValue=e=>e.id==='chapter-1'?25:75;window.updateCourseView=()=>{};window.location.hash='chapter-1';});
  await page.addScriptTag({content:fn('updateChapterCapsule')+setup+'\nupdateChapterCapsule();'});
  const toggle=page.locator('#progress-toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#chapter-capsule-label').textContent(),'Chapitre 1/2 · 25%');
  const closed=await page.locator('#progress-nav').boundingBox();
  assert.equal(Math.round(closed.height),44);assert.ok(closed.x>=10 && closed.x+closed.width<=width);
  assert.equal(await page.locator('#progress-home').isVisible(),false);
  const before=await page.locator('main').boundingBox();
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#progress-home').isVisible(),true);
  assert.deepEqual(await page.locator('main').boundingBox(),before);
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>{window.location.hash='chapter-2';updateChapterCapsule();});
  assert.equal(await page.locator('#chapter-capsule-label').textContent(),'Chapitre 2/2 · 75%');
  await toggle.click();await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  console.log(`OK ${width}px: capsule, chapter progress, toggle, Escape, no content shift`);
  await page.close();
 }
} finally {await browser.close();}
