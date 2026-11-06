import { strict as assert } from "node:assert";
import { lessonDurationContentSignature } from "../src/app/lessonDuration";
import type { PaideiaProject } from "../src/types/project";

function lesson(): PaideiaProject {
  return {
    id: "lesson",
    title: "Leçon",
    updatedAt: "2026-08-30T00:00:00Z",
    course: {
      modules: [{
        id: "module",
        title: "Module",
        chapters: [{
          id: "chapter",
          title: "Chapitre",
          pages: [{
            id: "page",
            title: "Page",
            blocks: [
              { id: "text", type: "text", title: "Texte", contentHtml: "Bonjour le monde." },
              { id: "video", type: "video", title: "Vidéo", assetRefs: ["assets/video.mp4"] }
            ]
          }]
        }]
      }]
    }
  } as PaideiaProject;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const original = lesson();
const signature = lessonDurationContentSignature(original);

const appearanceOnly = clone(original);
Object.assign(appearanceOnly.course.modules[0].chapters[0].pages[0].blocks[0], {
  sectionBackgroundColor: "#123456",
  sectionBackgroundHeight: "large",
  paddingTop: 80
});
appearanceOnly.updatedAt = "2026-08-30T01:00:00Z";
assert.equal(
  lessonDurationContentSignature(appearanceOnly),
  signature,
  "Les réglages d’apparence ne doivent pas invalider la durée."
);

const renamed = clone(original);
renamed.title = "Autre titre";
renamed.course.modules[0].chapters[0].title = "Autre chapitre";
assert.equal(
  lessonDurationContentSignature(renamed),
  signature,
  "Les métadonnées éditoriales sans effet temporel ne doivent pas invalider la durée."
);

const changedText = clone(original);
changedText.course.modules[0].chapters[0].pages[0].blocks[0].contentHtml = "Bonjour le vaste monde.";
assert.notEqual(
  lessonDurationContentSignature(changedText),
  signature,
  "Une variation du volume de texte visible doit invalider la durée."
);

const changedMedia = clone(original);
changedMedia.course.modules[0].chapters[0].pages[0].blocks[1].assetRefs = ["assets/autre-video.mp4"];
assert.notEqual(
  lessonDurationContentSignature(changedMedia),
  signature,
  "Une autre ressource temporelle doit invalider la durée."
);

const addedActivity = clone(original);
addedActivity.course.modules[0].chapters[0].pages[0].blocks.push({
  id: "tabs",
  type: "tabs",
  title: "Onglets",
  activityItems: [{ id: "tab-1", title: "Onglet", contentHtml: "Contenu supplémentaire" }]
} as never);
assert.notEqual(
  lessonDurationContentSignature(addedActivity),
  signature,
  "L’ajout d’une activité mesurable doit invalider la durée."
);

const reordered = clone(original);
reordered.course.modules[0].chapters[0].pages[0].blocks.reverse();
assert.equal(
  lessonDurationContentSignature(reordered),
  signature,
  "Un simple réordonnancement ne doit pas invalider la durée."
);

console.log("Lesson duration signature contract: OK");
