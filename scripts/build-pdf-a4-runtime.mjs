import { build } from "vite";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "src-tauri", "target");
await mkdir(target, { recursive: true });
const work = await mkdtemp(path.join(target, "pdf-a4-build-"));
if (!work.startsWith(`${target}${path.sep}`)) throw new Error("Dossier de préparation PDF invalide.");
const output = path.join(work, "output");
try {
  await build({
    root, configFile: false, publicDir: false, logLevel: "warn",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      outDir: output,
      lib: { entry: path.join(root, "scripts/pdf-a4-native-entry.ts"), name: "PaideiaPdf", formats: ["iife"], fileName: () => "print.js" }
    }
  });
  const script = await readFile(path.join(output, "print.js"), "utf8");
  for (const entry of await readdir(path.join(output, "assets"), { withFileTypes: true }).catch(error =>
    error.code === "ENOENT" ? [] : Promise.reject(error)
  )) {
    if (!entry.isFile() || script.includes(entry.name)) throw new Error(`Ressource PDF à vérifier : ${entry.name}`);
  }
  // Rust embeds this compiled browser code; no external script interpreter is shipped.
  await mkdir(path.join(target, "pdf-a4"), { recursive: true });
  await writeFile(path.join(target, "pdf-a4", "print.js"), script);
  console.log("Générateur PDF intégré préparé : code et polices de PAIDEIA, sans runtime PDF externe.");
} finally {
  await rm(work, { recursive: true, force: true });
}
