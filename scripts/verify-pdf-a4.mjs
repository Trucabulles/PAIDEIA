import { build } from "vite";
import { rm, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const directory=resolve(".tmp-pdf-a4-contract");
try {
  const native = await readFile("src-tauri/src/pdf_a4.rs", "utf8");
  const helper = await readFile("src-tauri/src/pdf_a4_native.rs", "utf8");
  assert.match(native, /--pdf-a4-native/);
  assert.doesNotMatch(native, /join\("node\.exe"\)|join\("runner\.mjs"\)/);
  assert.match(helper, /CallDevToolsProtocolMethod/);
  assert.match(helper, /FixedRuntime\s*\{\s*path: job\.webview\.clone\(\),?\s*\}/);
  assert.doesNotMatch(helper, /--remote-debugging-port|invoke_handler/);
  assert.match(helper, /Page\.printToPDF/);
  assert.match(helper, /asset_resolver\(\)[\s\S]*?\.get\(/);
  assert.doesNotMatch(native + helper, /pdf-a4-runtime|job\.runtime/);
  assert.match(native, /webview2-fixed-runtime/);
  await build({configFile:false,logLevel:"warn",build:{target:"esnext",ssr:resolve("scripts/pdf-a4-contract.ts"),outDir:directory,rollupOptions:{output:{entryFileNames:"contract.mjs"}}}});
  await import(pathToFileURL(resolve(directory,"contract.mjs")).href);
} finally {
  if (!directory.startsWith(resolve(".")+"\\")) throw new Error("Cleanup outside workspace");
  await rm(directory,{force:true,recursive:true});
}
