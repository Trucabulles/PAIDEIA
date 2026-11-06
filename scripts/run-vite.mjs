import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { paideiaBuildCommit } from "./paideia-build-metadata.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.env.VITE_PAIDEIA_GIT_COMMIT = paideiaBuildCommit(rootDir);

const child = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", ...process.argv.slice(2)], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
  shell: false
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
