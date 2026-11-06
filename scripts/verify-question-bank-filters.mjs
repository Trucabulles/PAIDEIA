import assert from "node:assert/strict";
import {
  matchesQuestionFilters,
  questionCategories,
  questionTags,
  resolvedQuestionCategory,
  UNCATEGORIZED
} from "../src/lib/questionBankFilters.ts";

const questions = [
  { id: "network", title: "Réseau", questionHtml: "<p>Quelle est une adresse IP ?</p>", category: "Matériel/Réseau", tags: ["réseau", "IP"] },
  { id: "cpu", title: "CPU", questionHtml: "<p>Quel processeur ?</p>", category: "Matériel/CPU", tags: ["matériel"] },
  { id: "other", title: "Divers", questionHtml: "<p>Autre</p>", category: "", tags: [] }
];

assert.deepEqual(questionCategories(questions), ["Matériel/CPU", "Matériel/Réseau"]);
assert.deepEqual(questionTags(questions), ["IP", "matériel", "réseau"]);
assert.equal(matchesQuestionFilters(questions[0], { search: "RESEAU", category: "Matériel/Réseau", tag: "IP" }), true);
assert.equal(matchesQuestionFilters(questions[1], { search: "réseau" }), false);
assert.equal(matchesQuestionFilters(questions[2], { category: UNCATEGORIZED }), true);
assert.equal(matchesQuestionFilters(questions[0], { category: UNCATEGORIZED }), false);
assert.equal(resolvedQuestionCategory(questions, "Catégorie supprimée"), "");
assert.equal(questions.filter((question) => matchesQuestionFilters(question, { category: "Matériel/CPU" })).length, 1);

console.log("Filtres de banque de questions : OK");
