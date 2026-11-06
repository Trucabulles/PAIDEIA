import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Window } from "happy-dom";
import { pathToFileURL } from "node:url";

const window = new Window();
for (const key of ["DOMParser", "document", "Node", "HTMLElement", "Element", "Text", "HTMLAnchorElement", "HTMLImageElement", "HTMLTableElement", "HTMLTableCellElement"]) {
  globalThis[key] = window[key];
}
// happy-dom's XML parser rejects valid CDATA. Emulate the browser's CDATA text node for this test.
const HappyDOMParser = window.DOMParser;
globalThis.DOMParser = class extends HappyDOMParser {
  parseFromString(value, type) {
    const source = type === "application/xml"
      ? value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match, content) => content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
      : value;
    return super.parseFromString(source, type);
  }
};
const compiled = await build({
  entryPoints: ["src/components/resources/QuestionBank/moodleQuestionBankImport.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: true,
  outfile: "tmp/moodle-question-bank-import-test.mjs"
});
const { parseMoodleQuestionBankXml } = await import(pathToFileURL(`${process.cwd()}/tmp/moodle-question-bank-import-test.mjs`).href);
await build({
  entryPoints: ["src/components/resources/QuestionBank/moodleQuestionBankExport.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: true,
  outfile: "tmp/moodle-question-bank-export-test.mjs"
});
const { exportMoodleQuestionBankXml } = await import(pathToFileURL(`${process.cwd()}/tmp/moodle-question-bank-export-test.mjs`).href);
await build({
  entryPoints: ["src/components/activities/QuizActivity/quizBankImport.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: true,
  outfile: "tmp/quiz-bank-copy-test.mjs"
});
const { copyQuestionBankQuestionToQuiz } = await import(pathToFileURL(`${process.cwd()}/tmp/quiz-bank-copy-test.mjs`).href);
await build({
  entryPoints: ["src/assessment/assessmentEngine.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: true,
  outfile: "tmp/quiz-partial-credit-test.mjs"
});
const { calculateQuizResult, withAdjustedAnswerCredit, withQuestionCreditMode } = await import(pathToFileURL(`${process.cwd()}/tmp/quiz-partial-credit-test.mjs`).href);

const example = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category"><category><text>$course$/top/Bloc 1</text></category></question>
  <question type="multichoice"><name><text>Même titre</text></name><questiontext format="html"><text><![CDATA[<p>Quel choix ?</p>]]></text></questiontext><defaultgrade>2</defaultgrade><single>true</single><penalty>0.3333333</penalty><shuffleanswers>true</shuffleanswers><generalfeedback format="html"><text>Explication commune</text></generalfeedback><answer fraction="100" format="html"><text>Paris</text><feedback format="html"><text>Oui</text></feedback></answer><answer fraction="0" format="html"><text>Londres</text><feedback format="html"><text>Non, Londres</text></feedback></answer></question>
  <question type="multichoice"><name><text>Même titre</text></name><questiontext format="html"><text>Deux réponses</text></questiontext><defaultgrade>1</defaultgrade><single>false</single><answer fraction="50"><text>Une</text></answer><answer fraction="50"><text>Deux</text></answer><answer fraction="0"><text>Trois</text></answer></question>
  <question type="category"><category><text>$course$/top/Bloc 2</text></category></question>
  <question type="truefalse"><name><text>Terre</text></name><questiontext format="html"><text>La Terre est plate.</text></questiontext><answer fraction="0"><text>true</text><feedback format="html"><text>Faux</text></feedback></answer><answer fraction="100"><text>false</text><feedback format="html"><text>Exact</text></feedback></answer></question>
</quiz>`;
const parsed = parseMoodleQuestionBankXml(example);
assert.equal(parsed.questions.length, 3);
assert.equal(parsed.categoryCount, 2);
assert.equal(parsed.partialCreditQuestions, 1);
assert.equal(parsed.ignoredPenaltyQuestions, 1);
assert.equal(parsed.shuffleAnswerQuestions, 1);
assert.notEqual(parsed.questions[0].id, parsed.questions[1].id);
assert.equal(parsed.questions[0].title, parsed.questions[1].title);
assert.equal(parsed.questions[0].category, "Bloc 1");
assert.equal(parsed.questions[2].category, "Bloc 2");
assert.equal(parsed.questions[0].points, 2);
assert.match(parsed.questions[0].answers[1].feedbackHtml, /Non, Londres/);
const copied = copyQuestionBankQuestionToQuiz("bank", parsed.questions[0]);
assert.match(copied.answers[1].feedbackHtml, /Non, Londres/);
assert.match(parsed.questions[0].generalFeedbackHtml, /Explication commune/);
assert.deepEqual(parsed.questions[1].answers.map((answer) => answer.correct), [true, true, false]);
assert.equal(parsed.questions[1].creditMode, "custom");
assert.deepEqual(parsed.questions[1].answers.map((answer) => answer.creditPercent), [50, 50, 0]);
const partial = copyQuestionBankQuestionToQuiz("bank", parsed.questions[1]);
partial.points = 10;
const quiz = { questions: [partial], settings: { passingScore: 50 } };
const score = (answerIds) => calculateQuizResult("quiz", quiz, { [partial.id]: answerIds }).scoreRaw;
assert.equal(score([partial.answers[0].id]), 5);
assert.equal(score([partial.answers[0].id, partial.answers[1].id]), 10);
const automatic = withQuestionCreditMode(partial, "equal");
assert.equal(calculateQuizResult("quiz", { questions: [automatic], settings: { passingScore: 50 } }, { [automatic.id]: [automatic.answers[0].id] }).scoreRaw, 5);
const adjusted = withQuestionCreditMode(partial, "custom");
adjusted.answers[2].creditPercent = -25;
assert.equal(calculateQuizResult("quiz", { questions: [adjusted], settings: { passingScore: 50 } }, { [adjusted.id]: [adjusted.answers[0].id, adjusted.answers[2].id] }).scoreRaw, 2.5);
assert.equal(calculateQuizResult("quiz", { questions: [adjusted], settings: { passingScore: 50 } }, { [adjusted.id]: [adjusted.answers[2].id] }).scoreRaw, 0);
const allOrNothing = withQuestionCreditMode(partial, "default");
assert.equal(calculateQuizResult("quiz", { questions: [allOrNothing], settings: { passingScore: 50 } }, { [allOrNothing.id]: [allOrNothing.answers[0].id] }).scoreRaw, 0);
const thirds = { ...automatic, answers: [...automatic.answers.slice(0, 2), { ...automatic.answers[2], correct: true }, { id: "wrong", textHtml: "<p>Faux</p>", correct: false }] };
assert.ok(Math.abs(calculateQuizResult("quiz", { questions: [thirds], settings: { passingScore: 50 } }, { [thirds.id]: [thirds.answers[0].id] }).scoreRaw - 10 / 3) < 1e-9);
assert.ok(Math.abs(calculateQuizResult("quiz", { questions: [thirds], settings: { passingScore: 50 } }, { [thirds.id]: [thirds.answers[0].id, thirds.answers[3].id] }).scoreRaw - 10 / 3) < 1e-9);
assert.deepEqual(withQuestionCreditMode(thirds, "custom").answers.map((answer) => answer.creditPercent), [33.3333, 33.3333, 33.3333, 0]);
const thirdsAdjusted = withQuestionCreditMode(thirds, "custom");
const bonus = withAdjustedAnswerCredit(thirdsAdjusted, thirdsAdjusted.answers[0].id, 80);
assert.deepEqual(bonus.answers.map((answer) => answer.creditPercent), [80, 10, 10, 0]);
assert.equal(calculateQuizResult("quiz", { questions: [bonus], settings: { passingScore: 50 } }, { [bonus.id]: [bonus.answers[0].id] }).scoreRaw, 8);
const proportional = { ...thirdsAdjusted, answers: thirdsAdjusted.answers.map((answer, index) => ({ ...answer, creditPercent: [50, 30, 20, -25][index] })) };
assert.deepEqual(withAdjustedAnswerCredit(proportional, proportional.answers[0].id, 80).answers.map((answer) => answer.creditPercent), [80, 12, 8, -25]);
assert.deepEqual(withAdjustedAnswerCredit(proportional, proportional.answers[0].id, 80.1234).answers.map((answer) => answer.creditPercent), [80.1234, 11.926, 7.9506, -25]);
assert.equal(withAdjustedAnswerCredit(automatic, automatic.answers[0].id, 80), null);
assert.equal(withAdjustedAnswerCredit(proportional, proportional.answers[0].id, 101), null);
const negativeXml = example.replace('<answer fraction="0"><text>Trois</text>', '<answer fraction="-25"><text>Trois</text>');
assert.equal(parseMoodleQuestionBankXml(negativeXml).questions[1].creditMode, "custom");
assert.equal(parseMoodleQuestionBankXml(negativeXml).questions[1].answers[2].creditPercent, -25);
assert.equal(parsed.questions[2].mode, "true-false");
assert.deepEqual(parsed.questions[2].answers.map((answer) => [answer.textHtml, answer.correct]), [["<p>Vrai</p>", false], ["<p>Faux</p>", true]]);
assert.throws(() => parseMoodleQuestionBankXml('<!DOCTYPE quiz [<!ENTITY x SYSTEM "file:///secret">]><quiz/>'), /DTD/);
const exportedXml = exportMoodleQuestionBankXml(parsed.questions);
assert.equal((exportedXml.match(/<penalty>0<\/penalty>/g) ?? []).length, 3);
assert.match(exportedXml, /<single>false<\/single>/);
assert.match(exportedXml, /<answer fraction="50" format="html">/);
const roundTrip = parseMoodleQuestionBankXml(exportedXml);
assert.equal(roundTrip.questions.length, 3);
assert.deepEqual(roundTrip.questions.map((question) => question.category), parsed.questions.map((question) => question.category));
assert.deepEqual(roundTrip.questions.map((question) => question.mode), parsed.questions.map((question) => question.mode));
assert.deepEqual(roundTrip.questions[1].answers.map((answer) => answer.creditPercent), [50, 50, 0]);
assert.match(roundTrip.questions[0].answers[1].feedbackHtml, /Non, Londres/);
assert.match(roundTrip.questions[0].generalFeedbackHtml, /Explication commune/);
const defaultQcmXml = exportMoodleQuestionBankXml([{ ...thirds, creditMode: "default" }]);
assert.equal((defaultQcmXml.match(/fraction="33\.3333"/g) ?? []).length, 3);
assert.deepEqual(parseMoodleQuestionBankXml(defaultQcmXml).questions[0].answers.map((answer) => answer.creditPercent), [33.3333, 33.3333, 33.3333, 0]);
const pluginXml = exportMoodleQuestionBankXml([{ ...thirds, creditMode: "default" }], "plugin");
assert.match(pluginXml, /<question type="multichoiceset">/);
assert.equal((pluginXml.match(/fraction="100"/g) ?? []).length, 3);
assert.equal(parseMoodleQuestionBankXml(pluginXml).questions[0].creditMode, null);
assert.deepEqual(parseMoodleQuestionBankXml(pluginXml).questions[0].answers.map((answer) => answer.correct), [true, true, true, false]);
assert.equal(parseMoodleQuestionBankXml(pluginXml).partialCreditQuestions, 0);
const mixedPluginXml = exportMoodleQuestionBankXml([{ ...thirds, creditMode: "default" }, parsed.questions[1]], "plugin");
assert.equal((mixedPluginXml.match(/<question type="multichoiceset">/g) ?? []).length, 1);
assert.equal((mixedPluginXml.match(/<question type="multichoice">/g) ?? []).length, 1);
assert.equal(parseMoodleQuestionBankXml(mixedPluginXml).questions[1].creditMode, "custom");
assert.throws(() => exportMoodleQuestionBankXml([{ ...parsed.questions[0], questionHtml: '<p><img src="data:image/png;base64,AA" /></p>' }]), /média intégré/);

if (process.argv[2]) {
  const real = parseMoodleQuestionBankXml(readFileSync(process.argv[2], "utf8"));
  assert.equal(real.questions.length, 151);
  assert.equal(real.categoryCount, 4);
  assert.deepEqual(
    Object.fromEntries([...new Set(real.questions.map((question) => question.category))].map((category) => [category, real.questions.filter((question) => question.category === category).length])),
    { "EVALUATION FINALE": 67, "QUESTIONS BLOC 1": 37, "QUESTIONS BLOC 2": 28, "QUESTIONS BLOC 3": 19 }
  );
  assert.equal(real.questions.filter((question) => question.mode === "single").length, 120);
  assert.equal(real.questions.filter((question) => question.mode === "multiple").length, 31);
  assert.equal(real.questions.filter((question) => question.mode === "multiple" && question.creditMode === "custom").length, 31);
  assert.ok(real.questions.some((question) => question.mode === "multiple" && question.answers.some((answer) => answer.creditPercent === 33.33333)));
  const realQcm = copyQuestionBankQuestionToQuiz("bank", real.questions.find((question) => question.mode === "multiple"));
  assert.equal(calculateQuizResult("quiz", { questions: [realQcm], settings: { passingScore: 0 } }, {
    [realQcm.id]: realQcm.answers.filter((answer) => answer.correct).map((answer) => answer.id)
  }).scoreRaw, realQcm.points);
  assert.equal(real.partialCreditQuestions, 31);
  assert.equal(real.ignoredPenaltyQuestions, 67);
  assert.equal(real.questions.filter((question) => question.answers.some((answer) => answer.feedbackHtml)).length, 29);
  assert.equal(real.questions.filter((question) => question.generalFeedbackHtml).length, 84);
  assert.equal(new Set(real.questions.map((question) => question.id)).size, 151);
  console.log(`Banque réelle : ${real.questions.length} questions, ${real.categoryCount} catégories, ${real.partialCreditQuestions} barèmes partiels, ${real.ignoredPenaltyQuestions} pénalités non reprises.`);
}
console.log("Import XML Moodle : catégories, doublons, réponses et feedbacks vérifiés.");
