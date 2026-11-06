import type { Plugin } from "vite";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

// Browser development uses the same native helper as the desktop application.
export function pdfA4DevPlugin(): Plugin {
  return {
    name: "paideia-pdf-a4-dev",
    apply: "serve",
    config() {
      // Generated comparison HTML must never reload the application mid-export.
      return { server: { watch: { ignored: ["**/tmp/pdfs/**", "**/output/pdf/**", "**/.tmp-pdf-a4-contract/**"] } } };
    },
    configureServer(server) {
      let active = false;
      server.middlewares.use("/__paideia_pdf_a4", async (request, response) => {
        const origin = request.headers.origin;
        const host = request.headers.host;
        if (request.method !== "POST" || (origin && origin !== `http://${host}`)) {
          response.writeHead(403).end("Requête refusée.");
          return;
        }
        if (active) {
          response.writeHead(409).end("Un export A4 est déjà en cours.");
          return;
        }
        active = true;
        const root = resolve(server.config.root);
        const temporaryRoot = join(root, "tmp", "pdfs");
        let output: string | undefined;
        try {
          let body = "";
          for await (const chunk of request) {
            body += chunk.toString();
            if (body.length > 16384) throw new Error("Requête trop volumineuse.");
          }
          const { sourcePath, profile = "review" } = JSON.parse(body);
          if (typeof sourcePath !== "string" || !isAbsolute(sourcePath)) throw new Error("Dossier de leçon invalide.");
          if (profile !== "review" && profile !== "learner") throw new Error("Profil PDF invalide.");
          if (!(await stat(sourcePath)).isDirectory()) throw new Error("L’essai A4 nécessite un dossier de leçon. Utilisez l’export actuel pour une archive.");
          const { mkdir } = await import("node:fs/promises");
          await mkdir(temporaryRoot, { recursive: true });
          output = await mkdtemp(join(temporaryRoot, "dev-a4-"));
          const executable = join(root, "src-tauri", "target", "debug", "paideia.exe");
          if (!(await stat(executable).catch(() => null))?.isFile()) throw new Error("Compiler PAIDEIA en mode développement avant de tester le PDF A4.");
          const manifest = join(output, "job.json");
          await writeFile(manifest, JSON.stringify({
            source: sourcePath, output, profile,
            webview: join(root, "src-tauri", "webview2-fixed-runtime")
          }));
          await new Promise<void>((resolveRun, reject) => {
            const child = spawn(executable, ["--pdf-a4-native", manifest], {
              cwd: root, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"]
            });
            let log = "";
            const collect = (chunk: Buffer) => { log = (log + chunk.toString()).slice(-6000); };
            child.stdout.on("data", collect);
            child.stderr.on("data", collect);
            child.once("error", reject);
            child.once("exit", async code => {
              if (code === 0) { resolveRun(); return; }
              const report = await readFile(join(output!, "result.json"), "utf8").then(JSON.parse).catch(() => null);
              reject(new Error(report?.error || log || "Échec de l’export PDF A4."));
            });
          });
          const bytes = await readFile(join(output, "essai-a4.pdf"));
          response.writeHead(200, { "Content-Type": "application/pdf", "Cache-Control": "no-store" });
          response.end(bytes);
        } catch (error) {
          response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          response.end(error instanceof Error ? error.message : String(error));
        } finally {
          active = false;
          // Only remove the temporary output created by this request.
          if (output && resolve(output).startsWith(resolve(temporaryRoot) + sep)) {
            await rm(output, { recursive: true, force: true }).catch(() => {});
          }
        }
      });
    }
  };
}
