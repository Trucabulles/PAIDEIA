import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { paideiaBuildCommit } from "./paideia-build-metadata.mjs";

const workspace = resolve(".");
const fixture = await mkdtemp(join(workspace, ".tmp-build-metadata-"));
const previousOverride = process.env.PAIDEIA_GIT_COMMIT;
delete process.env.PAIDEIA_GIT_COMMIT;
const git = (...args) => execFileSync("git", args, { cwd: fixture, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const write = async (file, content) => {
  const path = join(fixture, file);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, content);
};
try {
  git("init", "-b", "main");
  git("config", "user.name", "Build metadata fixture");
  git("config", "user.email", "build-fixture@example.invalid");
  await write("src/app.ts", "export const value = 1;\n");
  await write("docs/notes.md", "Documentation hors paquet\n");
  await write("src-tauri/asset-pack/resource.txt", "Bundled resource\n");
  await write("src-tauri/webview2-fixed-runtime/runtime.dll", "Active runtime\n");
  await write("src-tauri/tauri.conf.json", JSON.stringify({ bundle: {
    resources: ["asset-pack"],
    windows: { webviewInstallMode: { type: "fixedRuntime", path: "./webview2-fixed-runtime/" } }
  } }));
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-m", "Fixture baseline");
  const commit = git("rev-parse", "--short=8", "HEAD");
  assert.equal(paideiaBuildCommit(fixture), commit);

  await write("src-tauri/webview2-fixed-runtimeold149/runtime.dll", "Unused backup\n");
  await write("docs/notes.md", "Modified documentation hors paquet\n");
  assert.equal(paideiaBuildCommit(fixture), commit, "unused runtime and unpackaged documentation do not dirty the build");

  await write("src/app.ts", "export const value = 2;\n");
  assert.equal(paideiaBuildCommit(fixture), `${commit}-d`, "modified source is dirty");
  git("add", "src/app.ts");
  assert.equal(paideiaBuildCommit(fixture), `${commit}-d`, "staged source is still dirty until committed");
  git("restore", "--source=HEAD", "--staged", "--worktree", "src/app.ts");

  await write("src-tauri/src/new.rs", "fn new_source() {}\n");
  assert.equal(paideiaBuildCommit(fixture), `${commit}-d`, "new Rust source is dirty");
  await rm(join(fixture, "src-tauri/src/new.rs"));

  await write("src-tauri/asset-pack/resource.txt", "Modified bundled resource\n");
  assert.equal(paideiaBuildCommit(fixture), `${commit}-d`, "declared bundle resources are build inputs");
  git("restore", "src-tauri/asset-pack/resource.txt");

  await write("src-tauri/webview2-fixed-runtime/runtime.dll", "Modified active runtime\n");
  assert.equal(paideiaBuildCommit(fixture), `${commit}-d`, "selected fixed runtime is a build input");
  git("restore", "src-tauri/webview2-fixed-runtime/runtime.dll");
  assert.equal(paideiaBuildCommit(fixture), commit);
  console.log("Build metadata: real source/resource differences detected; unused runtime backups excluded.");
} finally {
  if (previousOverride === undefined) delete process.env.PAIDEIA_GIT_COMMIT;
  else process.env.PAIDEIA_GIT_COMMIT = previousOverride;
  if (!fixture.startsWith(workspace + sep + ".tmp-build-metadata-")) throw new Error("Cleanup outside owned fixture");
  await rm(fixture, { recursive: true, force: true });
}
