import assert from "node:assert/strict";
import fs from "node:fs/promises";
import process from "node:process";
import { createServer } from "vite";
import { transform } from "esbuild";

const vite = await createServer({
  appType: "custom",
  configFile: false,
  logLevel: "error",
  root: process.cwd(),
  server: { middlewareMode: true }
});

try {
  const { localizeProjectGeneratedContent } = await vite.ssrLoadModule("/src/app/projectLanguage.ts");
  const { SUPPORTED_APP_LANGUAGES, translate } = await vite.ssrLoadModule("/src/i18n/index.ts");
  const project = {
    id: "project_1",
    slug: "language-test",
    title: "Cours auteur",
    description: "",
    createdAt: "2026-09-05T00:00:00Z",
    updatedAt: "2026-09-05T00:00:00Z",
    createdBy: "local-user",
    defaultLocale: "fr",
    locales: ["fr"],
    status: "draft",
    currentVersion: "v0.1",
    rootCourseId: "course_1",
    course: {
      id: "course_1",
      title: "Cours auteur",
      modules: [{
        id: "module_1",
        title: "Module auteur",
        chapters: [{
          id: "chapter_1",
          title: "Nouveau chapitre",
          pages: [{
            id: "page_1",
            title: "Nouveau chapitre",
            blocks: [
              { id: "continue", type: "continue", title: "", summary: "Continuer", trackingKey: "continue-1" },
              { id: "exit", type: "course-exit", title: "", summary: "Sortir de la leçon", trackingKey: "exit-1" },
              { id: "custom", type: "continue", title: "", summary: "Continuer plus tard", trackingKey: "continue-2" },
              {
                id: "slides",
                type: "slides",
                title: "Diaporama",
                summary: "",
                trackingKey: "slides-1",
                activityItems: [{ id: "slide_1", title: "Diapo 1", contentHtml: "<p></p>", assetRefs: [] }]
              }
            ]
          }]
        }]
      }]
    }
  };

  const english = localizeProjectGeneratedContent(project, "en");
  const blocks = english.course.modules[0].chapters[0].pages[0].blocks;
  assert.equal(english.defaultLocale, "en");
  assert.deepEqual(english.locales, ["en"]);
  assert.equal(english.course.modules[0].chapters[0].title, "New chapter");
  assert.equal(english.course.modules[0].chapters[0].pages[0].title, "New chapter");
  assert.equal(blocks[0].summary, "Continue");
  assert.equal(blocks[1].summary, "Exit lesson");
  assert.equal(blocks[2].summary, "Continuer plus tard", "author text must never be translated");
  assert.equal(blocks[3].activityItems[0].title, "Slide 1");
  assert.equal(english.title, "Cours auteur");
  assert.equal(english.course.modules[0].title, "Module auteur");
  assert.equal(project.defaultLocale, "fr", "localization never mutates the input");
  assert.equal(localizeProjectGeneratedContent(english, "en"), english, "unchanged localization returns the original project");
  const bank = { id: "large-bank", entries: [{ contentHtml: "data:image/png;base64," + "A".repeat(1_000_000) }] };
  const withBanks = { ...project, referenceBanks: [bank] };
  const translatedWithBanks = localizeProjectGeneratedContent(withBanks, "en");
  assert.equal(translatedWithBanks.referenceBanks, withBanks.referenceBanks, "banks are not copied or traversed");
  assert.equal(translatedWithBanks.referenceBanks[0], bank);

  const frenchAgain = localizeProjectGeneratedContent(english, "fr");
  const roundTripBlocks = frenchAgain.course.modules[0].chapters[0].pages[0].blocks;
  assert.equal(frenchAgain.course.modules[0].chapters[0].title, "Nouveau chapitre");
  assert.equal(frenchAgain.course.modules[0].chapters[0].pages[0].title, "Nouveau chapitre");
  assert.equal(roundTripBlocks[0].summary, "Continuer");
  assert.equal(roundTripBlocks[1].summary, "Sortir de la leçon");
  assert.equal(roundTripBlocks[2].summary, "Continuer plus tard");

  // A project reopened after changing the interface language still contains
  // the previous language on disk. Exercise every source/target combination.
  for (const source of SUPPORTED_APP_LANGUAGES) {
    const saved = JSON.stringify(localizeProjectGeneratedContent(project, source));
    for (const target of SUPPORTED_APP_LANGUAGES) {
      const reopened = localizeProjectGeneratedContent(JSON.parse(saved), target);
      const chapter = reopened.course.modules[0].chapters[0];
      const reopenedBlocks = chapter.pages[0].blocks;
      assert.equal(chapter.title, translate(target, "lesson.newChapter"));
      assert.equal(reopenedBlocks[0].summary, translate(target, "activity.continue"));
      assert.equal(reopenedBlocks[1].summary, translate(target, "activity.course-exit"));
      assert.equal(reopenedBlocks[3].activityItems[0].title, translate(target, "slides.slideNumber", { number: 1 }));
      assert.equal(reopenedBlocks[2].summary, "Continuer plus tard");
    }
  }

  const appSource = await fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(appSource, /onAppLanguageChange=\{\(language\) => void handleAppLanguageChange\(language\)\}/);
  assert.match(appSource, /updateProjectLanguage\(/);
  assert.match(appSource, /localizeProjectGeneratedContent\(project, nextLanguage\)/);
  assert.match(appSource, /loadLocalizedWorkspace\(openedProjectPath(?:, readOnly)?\)/);
  assert.match(appSource, /loadLocalizedWorkspace\(tab.path\)/);
  assert.match(appSource, /tab.path === currentProjectPath && isProjectWorkspaceActive/);

  // Exercise the actual font-loading effect with delayed replies and StrictMode
  // remounts. No duplicated read, stale cross-project response or early ready flag.
  const effectStart = appSource.indexOf("  const projectFontsRequestRef = useRef<");
  const effectEnd = appSource.indexOf("\n  useEffect(() => {", appSource.indexOf("  useEffect(() => {", effectStart) + 20);
  const effect = (await transform(appSource.slice(effectStart, effectEnd), { loader: "tsx", format: "cjs" })).code;
  const evaluateEffect = new Function("useRef", "useEffect", "currentProjectPath", "project", "isTauriRuntimeAvailable", "projectRichTextFontsLoadedPath", "setProjectRichTextFonts", "setProjectRichTextFontsLoadedPath", "listProjectRichTextFonts", effect);
  const holder = { current: null }, requests = [], applied = [];
  function mount(path) {
    let cleanup;
    evaluateEffect(() => holder, (setup) => { cleanup = setup(); }, path, { id: path }, () => true, "",
      (fonts) => applied.push({ path, fonts }), (loadedPath) => applied.push({ path, loadedPath }),
      (requestedPath) => new Promise((resolve, reject) => requests.push({ path: requestedPath, resolve, reject })));
    return cleanup;
  }
  const firstCleanup = mount("A"); firstCleanup();
  const secondCleanup = mount("A");
  assert.equal(requests.length, 1, "effect remount shares pending font read");
  assert.equal(applied.some(x => x.loadedPath === "A"), false, "fonts are not ready before their response");
  secondCleanup();
  const thirdCleanup = mount("B");
  requests[0].resolve([{ id: "stale-font" }]);
  await new Promise(setImmediate);
  assert.equal(applied.some(x => x.loadedPath === "A" || x.fonts?.[0]?.id === "stale-font"), false);
  requests[1].resolve([{ id: "current-font" }]);
  await new Promise(setImmediate);
  assert.equal(applied.at(-1).loadedPath, "B");
  assert.equal(applied.find(x => x.fonts)?.fonts[0].id, "current-font");
  thirdCleanup();
  assert.match(appSource, /\}, \[importDestinationRoot, isLibraryRootReady\]\);/);

  console.log("Project language: generated defaults follow the selected language and author text is preserved.");
} finally {
  await vite.close();
}
