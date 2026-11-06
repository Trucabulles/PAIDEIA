// Development/verification tool only. The delivered application runs this
// workflow natively and does not include Node or this script.
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (!args[0]) throw new Error("Usage: node scripts/preview-pdf-a4-native.mjs <lesson directory> <output directory> [--learner] [--debug]");
const output = path.resolve(args[1] || path.join(root, "output/pdf-native"));
const manifest = path.join(output, "job.json");
await mkdir(output, { recursive: true });
await writeFile(manifest, JSON.stringify({
  source: path.resolve(args[0]), output,
  webview: path.join(root, "src-tauri/webview2-fixed-runtime"),
  profile: args.includes("--learner") ? "learner" : "review"
}));
try {
  const executable = path.join(root, "src-tauri/target", args.includes("--debug") ? "debug" : "release", "paideia.exe");
  await new Promise((resolve, reject) => {
    const child = spawn(executable, ["--pdf-a4-native", manifest], { windowsHide: true, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", async code => {
      if (code === 0) { resolve(); return; }
      const report = await readFile(path.join(output, "result.json"), "utf8").then(JSON.parse).catch(() => null);
      reject(new Error(report?.error || `Native PDF helper exited with code ${code}`));
    });
  });
  console.log(await readFile(path.join(output, "verification.json"), "utf8"));
  console.log(`PDF natif : ${path.join(output, "essai-a4.pdf")}`);
} finally {
  await rm(manifest, { force: true });
  const profile = path.join(output, "profile");
  if (!profile.startsWith(output + path.sep)) throw new Error("Profil PDF hors de son dossier temporaire.");
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
