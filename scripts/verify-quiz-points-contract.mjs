import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, assessment, editor, bank, bankImport, workbook, commands, repository] = await Promise.all([
  read("src/App.tsx"),
  read("src/assessment/assessmentEngine.ts"),
  read("src/components/activities/QuizActivity/QuizActivityEditor.tsx"),
  read("src/components/resources/QuestionBank/QuestionBankManager.tsx"),
  read("src/components/activities/QuizActivity/quizBankImport.ts"),
  read("src/components/resources/resourceWorkbook.ts"),
  read("src-tauri/src/commands.rs"),
  read("src-tauri/src/repository.rs")
]);

assert.match(app, /points: Number\.isFinite\(Number\(question\.points\)\) \? Math\.max\(1, Number\(question\.points\)\) : 1/);
assert.match(assessment, /pointsMax = Math\.max\(1, Number\(question\.points\) \|\| 1\)/);
assert.match(editor, /min=\{1\}[\s\S]*?points: Math\.max\(1, Number\(event\.target\.value\) \|\| 1\)/);
assert.match(bank, /min=\{1\}[\s\S]*?points: Math\.max\(1, Number\(event\.target\.value\) \|\| 1\)/);
assert.match(bankImport, /points: Math\.max\(1, Number\(source\.points\) \|\| 1\)/);
assert.match(workbook, /Number\.isFinite\(importedPoints\) && importedPoints >= 1 \? importedPoints : 1/);
assert.equal((workbook.match(/id: "example_(?:qcu|qcm|true_false)"/g) ?? []).length, 3);
assert.match(workbook, /if \(status\.startsWith\("exemple"\)\)/);
assert.match(workbook, /labels\.push\(`Mot-clé \$\{index\}`\)/);
assert.match(workbook, /labels\.push\(`Synonyme \$\{index\}`\)/);
assert.doesNotMatch(bank, /disabled=\{!selectedBank\.questions\.length\}[^>]*onClick=\{\(\) => void exportCsv\(\)\}/);
assert.match(commands, /question\.points\.max\(1\.0\)/);
assert.match(commands, /Math\.max\(1, Number\(question\.getAttribute/);
assert.match(repository, /fn normalize_project_question_points/);
assert.match(repository, /question\.points < 1\.0/);

console.log("Quiz points contract: every question is worth at least one point in authoring, persistence, scoring and SCORM.");
