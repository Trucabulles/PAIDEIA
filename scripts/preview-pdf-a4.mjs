// Read-only lesson input. Writes only to this worktree's output and temporary
// directories. No lesson save, duration log, collaboration or editor invocation.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { Window } from "happy-dom";

const productionResources = process.env.PAIDEIA_PDF_A4_RESOURCES;
const root = productionResources ? path.resolve(productionResources) : path.resolve(import.meta.dirname, "..");
const source = process.argv[2];
const learnerProfile = process.argv.includes("--learner");
if (!source) throw new Error("Usage: node scripts/preview-pdf-a4.mjs <lesson directory> [output directory]");
const output = path.resolve(process.argv[3] ?? path.join(root, "output/pdf"));
const temporaryRoot = process.env.PAIDEIA_PDF_A4_TMP || path.join(root,"tmp/pdfs");
await mkdir(temporaryRoot,{recursive:true});
const scratch = await mkdtemp(path.join(temporaryRoot, "paideia-pdf-a4-"));
const browser = new Window();
for (const name of ["document", "Node", "Element", "HTMLElement", "HTMLAnchorElement", "HTMLImageElement", "HTMLSpanElement", "HTMLParagraphElement", "Text"]) globalThis[name] = browser[name];
let edge;
let socket;
let htmlServer;
const pending = new Map();
let id = 0;
async function cdp(method, params={}) {
  const requestId = ++id;
  return await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(`Print host timeout: ${method}`));},60000);
    pending.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
    socket.send(JSON.stringify({id:requestId,method,params}));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

try {
  await mkdir(output,{recursive:true});
  let trial;
  let bundle;
  if (productionResources) {
    trial = await import(pathToFileURL(path.join(root,"entry.mjs")).href);
    bundle = await readFile(path.join(root,"trial.js"),"utf8");
  } else {
    const { build } = await import("vite");
    await build({root,configFile:false,logLevel:"warn",build:{ssr:path.join(root,"scripts/pdf-a4-trial-entry.ts"),outDir:path.join(scratch,"ssr"),rollupOptions:{output:{entryFileNames:"entry.mjs"}}}});
    trial = await import(pathToFileURL(path.join(scratch,"ssr/entry.mjs")).href);
    await build({root,configFile:false,logLevel:"warn",define:{"process.env.NODE_ENV":JSON.stringify("production")},build:{outDir:path.join(scratch,"browser"),lib:{entry:path.join(root,"scripts/pdf-a4-browser.ts"),name:"PdfTrial",formats:["iife"],fileName:()=>"trial.js"}}});
    bundle = await readFile(path.join(scratch,"browser/trial.js"),"utf8");
  }
  const project = JSON.parse(await readFile(path.join(source,"project.json"),"utf8"));
  project.course = JSON.parse(await readFile(path.join(source,"content/course.json"),"utf8"));
  // Optional coverage selection changes this in-memory fixture only.
  if(process.argv[4] && !process.argv[4].startsWith("--")) {
    const remaining=new Set(process.argv[4].split(","));
    project.course.modules=project.course.modules.map(module=>({...module,chapters:module.chapters.map(chapter=>({...chapter,pages:chapter.pages.map(page=>({...page,blocks:page.blocks.filter(block=>{const requested=remaining.has(block.id) ? block.id : block.type;if(!remaining.has(requested))return false;remaining.delete(requested);return true;})})).filter(page=>page.blocks.length)})).filter(chapter=>chapter.pages.length)})).filter(module=>module.chapters.length);
    assert.equal(remaining.size,0,`fixture types missing: ${[...remaining].join(",")}`);
    project.title+=" — vérification des activités";
  }
  const htmlEntries = {};
  const allBlocks = project.course.modules.flatMap(m=>m.chapters).flatMap(c=>c.pages).flatMap(p=>p.blocks);
  for(const block of allBlocks) if(block.htmlEntryFile) {
    try { htmlEntries[block.id]=await readFile(path.join(source,"assets",block.htmlEntryFile.replace(/^assets\//,"")),"utf8"); } catch { /* same documentary fallback as production */ }
  }
  const raw = {};
  const omittedVideos = [];
  for (const ref of trial.collectProjectPdfFileRefs(project)) {
    const normalized = ref.replace(/^assets\//,"");
    if (learnerProfile && /\.(?:m4v|mov|mp4|webm)$/i.test(normalized)) continue;
    if (!/\.(png|jpe?g|gif|webp|mp4|webm|mp3|wav|ogg)$/i.test(normalized)) continue;
    const resolved = path.resolve(source,"assets",normalized);
    assert.ok(resolved.startsWith(path.resolve(source,"assets")+path.sep),"asset stays in source assets");
    try {
      const extension=path.extname(normalized).slice(1).replace("jpg","jpeg");
      const kind = /^(mp4|webm)$/.test(extension) ? "video" : /^(mp3|wav|ogg)$/.test(extension) ? "audio" : "image";
      // Never base64-encode a multi-GB video just to obtain a PDF thumbnail.
      if (kind === "video" && (await stat(resolved)).size > 100 * 1024 * 1024) {
        omittedVideos.push(ref);
        console.warn(`Video preview omitted (over 100 MiB): ${ref}`);
        continue;
      }
      const bytes=await readFile(resolved);
      raw[ref]=`data:${kind}/${extension === "mp3" ? "mpeg" : extension};base64,${bytes.toString("base64")}`;
    } catch { console.warn(`Absent: ${ref}`); }
  }
  const mediaDurations = {};
  const fontFiles = ["Regular","Bold","Italic","BoldItalic"];
  const fonts = Object.fromEntries(await Promise.all(fontFiles.map(async (variant,index)=>[["regular","bold","italic","bolditalic"][index]+".ttf",(await readFile(path.join(root,`public/fonts/Atkinson_Hyperlegible/AtkinsonHyperlegible-${variant}.ttf`))).toString("base64")])));
  let fontCss="";
  for(const variant of ["Regular","Bold","Italic","BoldItalic"]) {
    const bytes=await readFile(path.join(root,`public/fonts/Inter/Inter-${variant}.woff2`));
    fontCss+=`@font-face{font-family:Inter;src:url(data:font/woff2;base64,${bytes.toString("base64")});font-weight:${variant.includes("Bold")?700:400};font-style:${variant.includes("Italic")?"italic":"normal"};}`;
  }
  for (const [family, file, weight, style] of [
    ["Spectral", "Spectral-Regular", 400, "normal"],
    ["Spectral", "Spectral-Italic", 400, "italic"],
    ["Spectral", "Spectral-Bold", 700, "normal"],
    ["Spectral", "Spectral-BoldItalic", 700, "italic"],
    ["Bellefair", "Bellefair-Regular", 400, "normal"]
  ]) {
    const bytes = await readFile(path.join(root, `public/fonts/${family}/${file}.woff2`));
    fontCss += `@font-face{font-family:${family};src:url(data:font/woff2;base64,${bytes.toString("base64")});font-weight:${weight};font-style:${style};}`;
  }
  const edgeCandidates = [
    process.env.PAIDEIA_PDF_A4_WEBVIEW,
    path.join(root, "src-tauri/webview2-fixed-runtime/msedgewebview2.exe")
  ].filter(Boolean);
  const edgePath = (await Promise.all(edgeCandidates.map(async candidate => (await stat(candidate).catch(()=>null))?.isFile() ? candidate : null))).find(Boolean);
  if (!edgePath) throw new Error("Le moteur WebView2 embarqué est introuvable pour l'export PDF A4.");
  const hostPath = process.env.PAIDEIA_PDF_A4_HOST || path.join(root,"src-tauri/target/debug/paideia.exe");
  if (!(await stat(hostPath).catch(()=>null))?.isFile()) throw new Error("L'hôte d'impression PAIDEIA est introuvable.");
  let hostLog="";
  let hostFailure;
  edge=spawn(hostPath,["--pdf-a4-host",path.join(scratch,"profile"),path.dirname(edgePath)],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
  edge.on("error",error=>{hostFailure=error;});
  edge.stderr.on("data",chunk=>{hostLog=(hostLog+chunk.toString()).slice(-4000);});
  const fontsRoot = path.join(source,"assets/fonts");
  for (const directory of await readdir(fontsRoot,{withFileTypes:true}).catch(()=>[])) {
    if (!directory.isDirectory()) continue;
    for (const file of await readdir(path.join(fontsRoot,directory.name))) {
      if (!/\.(woff2?|ttf|otf)$/i.test(file)) continue;
      const bytes = await readFile(path.join(fontsRoot,directory.name,file));
      fontCss += `@font-face{font-family:${JSON.stringify(`PaideiaRichFont-${directory.name}`)};src:url(data:font/${path.extname(file).slice(1)};base64,${bytes.toString("base64")});font-weight:${/bold/i.test(file)?700:/medium/i.test(file)?500:400};font-style:${/italic/i.test(file)?"italic":"normal"};}`;
    }
  }
  if (project.customFont?.assetRef) {
    for (const face of project.customFont.faces?.length ? project.customFont.faces : [{assetRef:project.customFont.assetRef,weight:400,style:"normal"}]) {
      const file = path.resolve(source,"assets",face.assetRef.replace(/^assets\//,""));
      assert.ok(file.startsWith(path.resolve(source,"assets")+path.sep));
      const bytes = await readFile(file);
      fontCss += `@font-face{font-family:PaideiaLesson;src:url(data:font/${path.extname(file).slice(1)};base64,${bytes.toString("base64")});font-weight:${face.weight};font-style:${face.style};}body{font-family:PaideiaLesson,Inter,sans-serif!important}`;
    }
  }
  let tabs;
  for(let attempt=0;attempt<200;attempt++) {
    if(hostFailure || edge.exitCode!==null) throw new Error(`L'hôte d'impression PAIDEIA s'est arrêté : ${hostFailure?.message || hostLog || edge.exitCode}`);
    try {
      const portFile=await readFile(path.join(scratch,"profile/EBWebView/DevToolsActivePort"),"utf8")
        .catch(()=>readFile(path.join(scratch,"profile/DevToolsActivePort"),"utf8"));
      const port=portFile.split("\n")[0];
      const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json();
      if(targets.some(target=>target.type==="page")) {tabs=targets;break;}
    } catch { /* The port file can precede the listening endpoint. */ }
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(tabs,"L'hôte d'impression PAIDEIA ne répond pas.");
  socket=new WebSocket(tabs.find(t=>t.type==="page").webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
  socket.addEventListener("message",event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p?.reject(new Error(message.error.message)):p?.resolve(message.result);}});
  await cdp("Page.enable");
  console.log("Print host ready; loading rendering functions.");
  await evaluate(bundle);
  console.log("Rendering functions loaded.");
  for (const [ref,data] of Object.entries(raw)) {
    const kind = data.startsWith("data:video/") ? "video" : data.startsWith("data:audio/") ? "audio" : null;
    if (!kind) continue;
    console.log(`Preparing ${kind}: ${ref}`);
    // CDP messages must stay small even for a 100 MB media file. Decode chunks
    // into a Blob rather than sending one enormous JavaScript expression.
    await evaluate("window._pdfMediaChunks=[];true");
    const base64 = data.slice(data.indexOf(",") + 1);
    for (let offset = 0; offset < base64.length; offset += 400000) {
      await evaluate(`window._pdfMediaChunks.push(Uint8Array.from(atob(${JSON.stringify(base64.slice(offset, offset + 400000))}),c=>c.charCodeAt(0)));true`);
    }
    await evaluate(`window._pdfMediaUrl=URL.createObjectURL(new Blob(window._pdfMediaChunks,{type:${JSON.stringify(data.slice(5,data.indexOf(";")))}}));window._pdfMediaChunks=null;true`);
    const duration = await evaluate(`PdfTrial.mediaDuration(window._pdfMediaUrl,${JSON.stringify(kind)})`);
    if (duration) mediaDurations[ref] = duration;
    if (kind === "video") {
      const snapshot = await evaluate(`PdfTrial.videoSnapshot(window._pdfMediaUrl)`);
      if (snapshot) raw[ref] = snapshot;
      else { delete raw[ref]; omittedVideos.push(ref); }
    } else delete raw[ref];
    await evaluate("URL.revokeObjectURL(window._pdfMediaUrl);delete window._pdfMediaUrl;true");
  }
  const subtitleHtmlByBlockId = {};
  for (const block of allBlocks.filter(b => ["video", "media"].includes(b.type))) {
    const lines = [];
    for (const ref of block.subtitleRefs ?? []) {
      const file = path.resolve(source,"assets",ref.replace(/^assets\//,""));
      assert.ok(file.startsWith(path.resolve(source,"assets")+path.sep),"subtitle stays in source assets");
      try {
        const sourceText = (await readFile(file,"utf8")).replace(/^\uFEFF/,"");
        lines.push(...sourceText.split(/\r?\n/).filter(line=>line.trim() && !/^WEBVTT(?:\s.*)?$/i.test(line.trim()) && !/^\d+$/.test(line.trim()) && !/^(?:\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->/.test(line.trim())));
      } catch { console.warn(`Subtitle unavailable: ${ref}`); }
    }
    if (lines.length) subtitleHtmlByBlockId[block.id] = `<p>${lines.map(line=>String(line.trim()).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")).join(" ")}</p>`;
  }
  const model = trial.buildLessonPdfModel(project,{language:"fr",profile:learnerProfile?"learner":"review",htmlEntryContentByBlockId:htmlEntries,mediaDurationByRef:mediaDurations,subtitleHtmlByBlockId});
  // The PDF keeps review content when a video preview is skipped or fails.
  for (const block of allBlocks.filter(b => ["video", "media"].includes(b.type))) {
    const activity = model.chapters.flatMap(c => c.activities).find(a => a.id === block.id);
    if (!activity) continue;
    const videoRefs = trial.collectProjectPdfFileRefs({...project,course:{modules:[{chapters:[{pages:[{blocks:[block]}]}]}]}}).filter(ref => /\.(mp4|webm)$/i.test(ref));
    const escape = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    if (videoRefs.some(ref => omittedVideos.includes(ref))) {
      activity.sections.push({kind:"rich-text",html:`<p><strong>Vidéo :</strong> ${videoRefs.map(ref=>escape(path.basename(ref))).join(", ")}</p><p>Aperçu non disponible.</p>`});
    }
    if (!learnerProfile && subtitleHtmlByBlockId[block.id]) activity.sections.push({kind:"rich-text",label:"Transcription",html:subtitleHtmlByBlockId[block.id]});
  }
  console.log("Preparing printable assets.");
  await evaluate("window._pdfRaw={};true");
  for(const [ref,data] of Object.entries(raw)) await evaluate(`window._pdfRaw[${JSON.stringify(ref)}]=${JSON.stringify(data)};true`);
  const refs = await evaluate(`(async()=>{window._pdfAssets=await PdfTrial.preparePdfAssets(${JSON.stringify(model)},window._pdfRaw);return Object.keys(window._pdfAssets);})()`);
  const assets = {};
  for(const ref of refs) {
    const length=await evaluate(`window._pdfAssets[${JSON.stringify(ref)}].length`);
    let value="";
    for(let offset=0;offset<length;offset+=500000) value+=await evaluate(`window._pdfAssets[${JSON.stringify(ref)}].slice(${offset},${offset+500000})`);
    assets[ref]=value;
  }
  const htmlBlocks = learnerProfile ? [] : allBlocks.filter(block => block.type === "html-custom" && htmlEntries[block.id]);
  if (htmlBlocks.length) {
    const token = randomUUID();
    const packages = new Map(htmlBlocks.map(block=>[block.id,path.resolve(source,"assets",block.htmlAssetRoot.replace(/^assets\//,""))]));
    const mime = {".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2"};
    htmlServer = createServer(async (request,response)=>{
      try {
        const parts = decodeURIComponent(new URL(request.url,"http://localhost").pathname).split("/");
        if(parts[1]!==token || !packages.has(parts[2])) throw new Error("Unknown package");
        const base = packages.get(parts[2]);
        const file = path.resolve(base,parts.slice(3).join("/"));
        if(!file.startsWith(base+path.sep)) throw new Error("Outside package");
        const bytes = await readFile(file);
        response.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()] || "application/octet-stream","Content-Security-Policy":"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; object-src 'none'; sandbox allow-scripts allow-same-origin"});response.end(bytes);
      } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve=>htmlServer.listen(0,"127.0.0.1",resolve));
    await cdp("Emulation.setDeviceMetricsOverride",{width:1090,height:680,deviceScaleFactor:1,mobile:false});
    for(const block of htmlBlocks) {
      console.log(`Capturing HTML initial view: ${block.id}`);
      const entry = path.relative(packages.get(block.id),path.resolve(source,"assets",block.htmlEntryFile.replace(/^assets\//,""))).split(path.sep).map(encodeURIComponent).join("/");
      const url = `http://127.0.0.1:${htmlServer.address().port}/${token}/${block.id}/${entry}`;
      await cdp("Page.navigate",{url});
      for(let attempt=0;attempt<100;attempt++) { if(await evaluate(`location.href===${JSON.stringify(url)} && document.readyState==='complete'`))break;await new Promise(r=>setTimeout(r,50)); }
      // Hidden WebViews may suspend animation frames. Font/image readiness is
      // followed by a bounded layout settle, independent of window visibility.
      await evaluate("Promise.race([Promise.all([document.fonts.ready,...[...document.images].map(i=>i.decode().catch(()=>{}))]),new Promise(r=>setTimeout(r,3000))]).then(()=>new Promise(r=>setTimeout(r,100)))");
      const screenshot = await cdp("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
      assets[`pdf-html-first-view/${block.id}`] = `data:image/png;base64,${screenshot.data}`;
    }
    await new Promise(resolve=>htmlServer.close(resolve));htmlServer=undefined;
    await cdp("Emulation.clearDeviceMetricsOverride");
  }
  console.log("Assets prepared; generating current PDF.");
  if (process.argv.includes("--reference")) {
    const definition=trial.renderLessonPdfDocument(model,assets);
    const pdfMake=createRequire(import.meta.url)("pdfmake/build/pdfmake.js");
    pdfMake.addVirtualFileSystem(fonts);
    pdfMake.addFonts({PaideiaDocument:{normal:"regular.ttf",bold:"bold.ttf",italics:"italic.ttf",bolditalics:"bolditalic.ttf"}});
    await writeFile(path.join(output,"reference-actuelle.pdf"),await pdfMake.createPdf(definition).getBuffer());
  }
  const html=trial.renderLessonPdfHtml(model,project,assets,fontCss);
  await writeFile(path.join(output,"essai-a4.html"),html);
  console.log("HTML saved; loading print page.");
  await cdp("Page.navigate",{url:pathToFileURL(path.join(output,"essai-a4.html")).href});
  while (!(await evaluate(`location.href===${JSON.stringify(pathToFileURL(path.join(output,"essai-a4.html")).href)}`))) await new Promise(r=>setTimeout(r,50));
  console.log("Print page navigated; waiting for fonts and images.");
  await evaluate(`(async()=>{while(document.readyState!=='complete')await new Promise(r=>setTimeout(r,50));await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return true;})()`);
  await evaluate(bundle);
  console.log("Print page ready; validating layout.");
  const paragraphChecks=await evaluate(`(()=>{
    const host=document.createElement('div');host.style.position='absolute';host.style.width='400px';host.style.top='-10000px';
    host.innerHTML='<div class="rich" id="clean"><p>A</p><p><br></p><p>B</p></div><div class="rich" id="artifacts"><p>A</p><p><br></p><p></p><p><span></span></p><p>B</p></div><div class="rich" id="two"><p>A</p><p><br><br></p><p>B</p></div><div class="rich" id="inline"><p>A<br>B</p></div>';
    document.body.append(host);
    const gap=id=>{const ps=host.querySelectorAll('#'+id+' p');return ps[ps.length-1].getBoundingClientRect().top-ps[0].getBoundingClientRect().bottom;};
    const result={clean:gap('clean'),withEmptyShells:gap('artifacts'),two:gap('two'),singleLine:host.querySelector('#clean p').getBoundingClientRect().height,inlineHeight:host.querySelector('#inline p').getBoundingClientRect().height};host.remove();return result;
  })()`);
  assert.ok(Math.abs(paragraphChecks.clean-paragraphChecks.singleLine)<1,"one explicit blank paragraph adds exactly one line");
  assert.ok(Math.abs(paragraphChecks.clean-paragraphChecks.withEmptyShells)<1,"empty HTML shells do not add blank lines");
  assert.ok(Math.abs(paragraphChecks.two-paragraphChecks.clean-paragraphChecks.singleLine)<1,"a second explicit break adds exactly one line");
  assert.ok(Math.abs(paragraphChecks.inlineHeight-2*paragraphChecks.singleLine)<1,"inline break retains two lines without paragraph margins");
  const diagnostics = await evaluate(`(()=>{PdfTrial.prepareLessonPdfHtmlForPrint(document);return {width:document.body.getBoundingClientRect().width,activities:document.querySelectorAll('.activity').length,brokenImages:[...document.images].filter(i=>!i.naturalWidth).length,overflow:[...document.querySelectorAll('.rich,table,.composition,.note-panel')].filter(e=>e.getBoundingClientRect().right>document.body.getBoundingClientRect().right+2).map(e=>e.tagName),defaultFont:getComputedStyle(document.body).fontSize};})()`);
  assert.equal(diagnostics.brokenImages,0,"all printable images decoded");
  assert.equal(diagnostics.overflow.length,0,"no content overflows A4 width");
  const printed=await cdp("Page.printToPDF",{transferMode:"ReturnAsStream",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:"<span></span>",footerTemplate:'<div style="font-size:8px;text-align:center;width:100%;color:#64748b"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
  const chunks=[];
  for(;;) {
    const chunk=await cdp("IO.read",{handle:printed.stream,size:400000});
    chunks.push(Buffer.from(chunk.data,chunk.base64Encoded?"base64":"utf8"));
    if(chunk.eof)break;
  }
  await cdp("IO.close",{handle:printed.stream});
  await writeFile(path.join(output,"essai-a4.pdf"),Buffer.concat(chunks));
  await writeFile(path.join(output,"verification.json"),JSON.stringify({source,diagnostics,paragraphChecks,printZoom:trial.PDF_HTML_PRINT_ZOOM,defaultFontPoints:18*trial.PDF_HTML_PRINT_ZOOM*.75},null,2));
  console.log(JSON.stringify(diagnostics));
  console.log(`Comparison: ${output}`);
} finally {
  htmlServer?.close();
  if(socket?.readyState===WebSocket.OPEN) { try{await cdp("Browser.close");}catch{} socket.close(); }
  edge?.kill();
  await browser.happyDOM.close();
  // Isolated profile is temporary, never the user's WebView/Edge cache.
  assert.ok(path.resolve(scratch).startsWith(path.resolve(temporaryRoot)+path.sep),"cleanup stays in temporary directory");
  await rm(scratch,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
