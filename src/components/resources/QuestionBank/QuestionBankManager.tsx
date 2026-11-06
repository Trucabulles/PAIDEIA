import { useIndividualBank } from "../useIndividualBank";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { QuestionBankQuestion, QuestionBankResource, QuizQuestionMode } from "../../../types/project";
import { questionCreditMode, questionCreditStatus, withAdjustedAnswerCredit, withQuestionCreditMode } from "../../../assessment/assessmentEngine";
import { exportQuestionBankXlsx, importQuestionBankXlsx } from "../resourceWorkbook";
import { importMoodleQuestionBankXml } from "./moodleQuestionBankImport";
import { exportMoodleQuestionBankXml } from "./moodleQuestionBankExport";
import type { MoodleAllOrNothingExport } from "./moodleQuestionBankExport";
import styles from "./QuestionBankManager.module.css";
import { useI18n } from "../../../i18n/react";
import type { QuestionBankManagerProps } from "./types";
import { ResourceSortControl, ResourceNoResults, useResourceTiles } from "../ResourceCatalogControls";
import { useEscapeNavigation } from "../../../hooks/useEscapeNavigation";
import { CreateResourceButton } from "../CreateResourceButton";
import { bankNameFromFile, exportBankPackage, uniqueBankName } from "../resourceBankPackage";
import { useResourceBankTransfer } from "../useResourceBankTransfer";
import { matchesQuestionFilters, questionCategories, questionTags, resolvedQuestionCategory, UNCATEGORIZED } from "../../../lib/questionBankFilters";

type ImportStatus = {
  kind: "success" | "error";
  title: string;
  message: string;
};

export function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}


export function SpinnerIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function ErrorIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v5M12 16.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function ImportIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 20V10m0 0 4 4m-4-4-4 4M5 6h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function stripHtml(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const stripped = value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  if (!stripped) {
    return "";
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = stripped;
  return textarea.value.replace(/\s+/g, " ").trim();
}

function splitList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(values: string[] | undefined) {
  return (values ?? []).join("|");
}

function createBank(index: number): QuestionBankResource {
  return {
    id: uniqueId("question_bank"),
    name: `Banque ${index}`,
    questions: []
  };
}

function createQuestion(index: number): QuestionBankQuestion {
  return {
    id: uniqueId("bank_question"),
    title: "",
    category: "",
    tags: [],
    mode: "single",
    questionHtml: "<p></p>",
    answers: [
      { id: uniqueId("answer"), textHtml: "<p></p>", correct: true },
      { id: uniqueId("answer"), textHtml: "<p></p>", correct: false }
    ],
    feedbackCorrectHtml: "",
    feedbackIncorrectHtml: "",
    points: 1,
    sourceBankId: null,
    sourceQuestionId: null
  };
}

function normalizeQuestionForMode(
  question: QuestionBankQuestion,
  mode: QuizQuestionMode,
  labels: { trueLabel: string; falseLabel: string }
): QuestionBankQuestion {
  if (mode === "true-false") {
    return {
      ...question,
      mode,
      answers: [
        { ...question.answers[0], id: question.answers[0]?.id ?? uniqueId("answer"), textHtml: `<p>${labels.trueLabel}</p>`, correct: true, creditPercent: null },
        { ...question.answers[1], id: question.answers[1]?.id ?? uniqueId("answer"), textHtml: `<p>${labels.falseLabel}</p>`, correct: false, creditPercent: null }
      ]
    };
  }
  const answers = question.answers.length >= 2
    ? question.answers
    : [
        ...question.answers,
        { id: uniqueId("answer"), textHtml: "<p></p>", correct: false }
      ];
  return { ...question, mode, creditMode: mode === "multiple" ? question.creditMode : null, answers: mode === "multiple" ? answers : answers.map((answer) => ({ ...answer, creditPercent: null })) };
}

function modeLabel(mode: QuizQuestionMode, trueFalseLabel: string) {
  if (mode === "multiple") {
    return "QCM";
  }
  if (mode === "true-false") {
    return trueFalseLabel;
  }
  return "QCU";
}

export function QuestionBankManager({
  banks,
  onBanksChange,
  onDeleteBank,
  onExportFile,
  onExportArchive,
  onSave,
  saveFeedbackState = "idle",
  onTileImageUpload,
  renderRichTextField,
  resolveTileImageSrc
}: QuestionBankManagerProps) {
  const { t } = useI18n();
  const individual = useIndividualBank("questions", banks, onBanksChange);
  const visibleBanks = useResourceTiles(banks);
  function selectBank(bank: QuestionBankResource) {
    setCollapsedQuestionIds(bank.questions.map(question => question.id));
    setQuestionSearch("");
    setQuestionCategory("");
    setQuestionTag("");
    setSelectedBankId(bank.id);
  }
  function openIndividual(bank: QuestionBankResource) { individual.open(bank, selectBank); }
  const [selectedBankId, setSelectedBankId] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [collapsedQuestionIds, setCollapsedQuestionIds] = useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionCategory, setQuestionCategory] = useState("");
  const [questionTag, setQuestionTag] = useState("");
  const [deleteBankId, setDeleteBankId] = useState<string | null>(null);
  const [renameBankId, setRenameBankId] = useState<string | null>(null);
  const [renameBankName, setRenameBankName] = useState("");
  const [renameBankError, setRenameBankError] = useState("");
  const [renameBankSaving, setRenameBankSaving] = useState(false);
  const [deleteAllQuestionsOpen, setDeleteAllQuestionsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [exportConfirmationBankId, setExportConfirmationBankId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "moodle-xml">("xlsx");
  const [moodleAllOrNothing, setMoodleAllOrNothing] = useState<MoodleAllOrNothingExport>("standard");
  const [exportError, setExportError] = useState("");
  const [exportPending, setExportPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const suppressTileOpenRef = useRef(false);
  const suppressTileOpenTimeoutRef = useRef<number | null>(null);
  const selectedBank = banks.find((bank) => bank.id === selectedBankId) ?? null;
  const bankQuestions = selectedBank?.questions ?? [];
  const activeQuestionCategory = useMemo(() => resolvedQuestionCategory(bankQuestions, questionCategory), [bankQuestions, questionCategory]);
  const bankTags = useMemo(() => questionTags(bankQuestions), [bankQuestions]);
  const activeQuestionTag = bankTags.includes(questionTag) ? questionTag : "";
  const visibleQuestions = useMemo(() => bankQuestions.map((question, index) => ({ question, index }))
    .filter(({ question }) => matchesQuestionFilters(question, { category: activeQuestionCategory, tag: activeQuestionTag, search: questionSearch })), [bankQuestions, activeQuestionCategory, activeQuestionTag, questionSearch]);
  const bankCategories = useMemo(() => questionCategories(bankQuestions), [bankQuestions]);
  const hasUncategorizedQuestions = useMemo(() => bankQuestions.some((question) => !question.category?.trim()), [bankQuestions]);
  const questionLabels = useMemo(() => new Map(bankQuestions.map((question, index) => [question.id, stripHtml(question.questionHtml) || `Question ${index + 1}`])), [bankQuestions]);
  useEscapeNavigation(Boolean(selectedBankId), () => setSelectedBankId(""));
  const deleteBankTarget = banks.find((bank) => bank.id === deleteBankId) ?? null;
  const renameBankTarget = banks.find((bank) => bank.id === renameBankId) ?? null;
  const exportConfirmationBank = banks.find((bank) => bank.id === exportConfirmationBankId) ?? null;

  const armTileOpenSuppression = () => {
    suppressTileOpenRef.current = true;
    if (suppressTileOpenTimeoutRef.current !== null) {
      window.clearTimeout(suppressTileOpenTimeoutRef.current);
    }
    suppressTileOpenTimeoutRef.current = window.setTimeout(() => {
      suppressTileOpenRef.current = false;
      suppressTileOpenTimeoutRef.current = null;
    }, 500);
  };

  useEffect(() => {
    if (!actionMenuId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(`.${styles.tileMenu}, .${styles.tileMenuToggle}`)
      ) {
        return;
      }
      setActionMenuId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [actionMenuId]);

  useEffect(() => {
    return () => {
      if (suppressTileOpenTimeoutRef.current !== null) {
        window.clearTimeout(suppressTileOpenTimeoutRef.current);
      }
    };
  }, []);

  const bulk = useResourceBankTransfer({
    banks,
    extensions: ["xlsx", "xml"],
    onImport: async (files) => {
      const names = new Set(banks.map((bank) => bank.name.toLocaleLowerCase("fr")));
      const imported: QuestionBankResource[] = [];
      for (const file of files) {
        const questions = file.name.toLowerCase().endsWith(".xml")
          ? (await importMoodleQuestionBankXml(file)).questions
          : await importQuestionBankXlsx(file);
        imported.push({ id: uniqueId("question_bank"), name: uniqueBankName(bankNameFromFile(file.name), names), questions });
      }
      const next = [...banks, ...imported];
      updateBanks(next);
      try { await saveBanks(next, imported.map(bank => bank.id)); } catch (error) { updateBanks(banks); throw error; }
    },
    onExport: async (ids) => {
      const selected = await Promise.all(banks.filter((bank) => ids.includes(bank.id)).map(individual.load));
      const files = await Promise.all(selected.map(async (bank) => ({
        name: bank.name,
        bytes: new Uint8Array(await (await exportQuestionBankXlsx(bank.questions)).arrayBuffer())
      })));
      await onExportArchive("banques-questions-paideia.zip", await exportBankPackage(files));
    }
  });

  function updateBanks(nextBanks: QuestionBankResource[]) {
    onBanksChange(nextBanks);
    return nextBanks;
  }

  async function saveBanks(banksToSave = banks, bankIds = selectedBankId ? [selectedBankId] : undefined) {
    await onSave(banksToSave, bankIds);
  }

  function addBank() {
    const bank = createBank(banks.length + 1);
    updateBanks([...banks, bank]);
    openIndividual(bank);
  }

  async function duplicateBank(bank: QuestionBankResource) {
    bank = await individual.load(bank);
    const copy: QuestionBankResource = {
      ...bank,
      id: uniqueId("question_bank"),
      name: `${bank.name} — ${t("common.copy")}`,
      tileImageRef: null,
      questions: bank.questions.map((question) => ({
        ...question,
        id: uniqueId("bank_question"),
        sourceBankId: null,
        sourceQuestionId: null,
        answers: question.answers.map((answer) => ({ ...answer, id: uniqueId("answer") }))
      }))
    };
    updateBanks([...banks, copy]);
    selectBank(copy);
  }

  function updateBank(id: string, patch: Partial<QuestionBankResource>) {
    return updateBanks(banks.map((bank) => (bank.id === id ? { ...bank, ...patch } : bank)));
  }

  async function confirmRenameBank() {
    if (!renameBankTarget || !renameBankName.trim() || renameBankSaving) return;
    const previousBanks = banks;
    const nextBanks = updateBank(renameBankTarget.id, { name: renameBankName.trim() });
    setRenameBankSaving(true);
    setRenameBankError("");
    try {
      await saveBanks(nextBanks, [renameBankTarget.id]);
      setRenameBankId(null);
    } catch (error) {
      updateBanks(previousBanks);
      setRenameBankError(error instanceof Error ? error.message : String(error));
    } finally {
      setRenameBankSaving(false);
    }
  }

  async function removeBank(id: string) {
    await onDeleteBank(id);
    setDeleteBankId(null);
    setActionMenuId(null);
    if (selectedBankId === id) {
      setSelectedBankId("");
    }
  }

  function updateQuestion(questionId: string, patch: Partial<QuestionBankQuestion>) {
    if (!selectedBank) {
      return;
    }
    updateBank(selectedBank.id, {
      questions: selectedBank.questions.map((question) => (question.id === questionId ? { ...question, ...patch } : question))
    });
  }

  function addQuestion() {
    if (!selectedBank) {
      return;
    }
    const question = createQuestion(selectedBank.questions.length + 1);
    updateBank(selectedBank.id, {
      questions: [...selectedBank.questions, question]
    });
    setCollapsedQuestionIds((current) => current.filter((id) => id !== question.id));
  }

  function deleteQuestion(questionId: string) {
    if (!selectedBank) {
      return;
    }
    updateBank(selectedBank.id, {
      questions: selectedBank.questions.filter((question) => question.id !== questionId)
    });
    setCollapsedQuestionIds((current) => current.filter((id) => id !== questionId));
  }

  function deleteAllQuestions() {
    if (!selectedBank) {
      return;
    }
    updateBank(selectedBank.id, { questions: [] });
    setCollapsedQuestionIds([]);
    setDeleteAllQuestionsOpen(false);
  }

  function toggleQuestionCollapse(questionId: string) {
    setCollapsedQuestionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]
    );
  }

  function updateAnswer(questionId: string, answerId: string, patch: Partial<QuestionBankQuestion["answers"][number]>) {
    const question = selectedBank?.questions.find((candidate) => candidate.id === questionId);
    if (!question) {
      return;
    }
    updateQuestion(questionId, {
      answers: question.answers.map((answer) => (answer.id === answerId ? { ...answer, ...patch } : answer))
    });
  }

  function addAnswer(questionId: string) {
    const question = selectedBank?.questions.find((candidate) => candidate.id === questionId);
    if (!question || question.mode === "true-false") {
      return;
    }
    updateQuestion(questionId, {
      answers: [...question.answers, { id: uniqueId("answer"), textHtml: "<p></p>", correct: false, creditPercent: questionCreditMode(question) === "custom" ? 0 : null }]
    });
  }

  function deleteAnswer(questionId: string, answerId: string) {
    const question = selectedBank?.questions.find((candidate) => candidate.id === questionId);
    if (!question || question.mode === "true-false" || question.answers.length <= 2) {
      return;
    }
    updateQuestion(questionId, {
      answers: question.answers.filter((answer) => answer.id !== answerId)
    });
  }

  function setAnswerCorrect(questionId: string, answerId: string, correct: boolean) {
    const question = selectedBank?.questions.find((candidate) => candidate.id === questionId);
    if (!question) {
      return;
    }
    if (questionCreditMode(question) === "custom") return;
    const answers = question.answers.map((answer) => {
      if (question.mode === "multiple") {
        return answer.id === answerId ? { ...answer, correct } : answer;
      }
      return { ...answer, correct: answer.id === answerId ? correct : false };
    });
    if ((question.mode === "single" || question.mode === "true-false") && !answers.some((answer) => answer.correct)) {
      const index = answers.findIndex((answer) => answer.id === answerId);
      if (index >= 0) {
        answers[index] = { ...answers[index], correct: true };
      }
    }
    updateQuestion(questionId, { answers });
  }

  async function importQuestions(event: ChangeEvent<HTMLInputElement>) {
    if (!selectedBank) {
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    let questions: QuestionBankQuestion[];
    let importDetails = "";
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "xlsx") {
        questions = await importQuestionBankXlsx(file);
      } else if (extension === "xml") {
        const imported = await importMoodleQuestionBankXml(file);
        questions = imported.questions;
        const warnings = [
          imported.categoryCount ? `${imported.categoryCount} catégorie(s) conservée(s).` : "",
          imported.partialCreditQuestions ? `${imported.partialCreditQuestions} QCM avec barème par réponse conservé.` : "",
          imported.ignoredPenaltyQuestions ? `${imported.ignoredPenaltyQuestions} pénalité(s) Moodle non reprises.` : "",
          imported.shuffleAnswerQuestions ? "Le mélange Moodle des réponses reste un réglage de l'activité qui utilise la banque." : ""
        ].filter(Boolean);
        importDetails = warnings.join(" ");
      } else {
        throw new Error("Format non pris en charge. Choisissez un fichier XLSX ou un export XML Moodle.");
      }
    } catch (error) {
      setImportStatus({
        kind: "error",
        title: t("questionBank.importRefusedTitle").replace(/CSV/gi, "XLSX/XML"),
        message: error instanceof Error ? error.message : t("questionBank.importRefusedMessage").replace(/CSV/gi, "XLSX/XML")
      });
      return;
    }

    const nextBanks = updateBank(selectedBank.id, {
      questions
    });
    setCollapsedQuestionIds(questions.map((question) => question.id));

    try {
      await saveBanks(nextBanks);
      setImportStatus({
        kind: "success",
        title: t("questionBank.importSuccessTitle").replace(/CSV/gi, "XLSX/XML"),
        message: `${questions.length > 1 ? t("questionBank.importedCountPlural", { count: questions.length }) : t("questionBank.importedCount", { count: questions.length })} La banque ouverte a été remplacée. ${importDetails}`.trim()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportStatus({
        kind: "error",
        title: t("questionBank.importSaveErrorTitle"),
        message: message || t("questionBank.importSaveErrorMessage")
      });
    }
  }

  async function requestExport(bank: QuestionBankResource) {
    bank = await individual.load(bank);
    setExportFormat("xlsx");
    setMoodleAllOrNothing("standard");
    setExportError("");
    setExportConfirmationBankId(bank.id);
  }

  async function confirmExport() {
    if (!exportConfirmationBank || exportPending) return;
    setExportPending(true);
    setExportError("");
    try {
      const name = exportConfirmationBank.name.trim() || "banque-questions";
      if (exportFormat === "xlsx") {
        const workbook = await exportQuestionBankXlsx(exportConfirmationBank.questions);
        await onExportFile(`${name}.xlsx`, Array.from(new Uint8Array(await workbook.arrayBuffer())), "xlsx");
      } else {
        const xml = exportMoodleQuestionBankXml(exportConfirmationBank.questions, moodleAllOrNothing);
        await onExportFile(`${name}.xml`, Array.from(new TextEncoder().encode(xml)), "moodle-xml");
      }
      setExportConfirmationBankId(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setExportPending(false);
    }
  }

  function renderExportConfirmation() {
    if (!exportConfirmationBank) return null;
    const allOrNothingQcmCount = exportConfirmationBank.questions.filter((question) => question.mode === "multiple" && questionCreditMode(question) === "default").length;
    return <div className="paideia-modal-backdrop" role="presentation">
      <section aria-labelledby="question-bank-export-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <p className="modal-kicker">{t("questionBank.kicker", undefined, "Banque de questions")}</p>
        <h2 id="question-bank-export-title">{t("questionBank.exportFormatTitle")}</h2>
        <div className={`${styles.exportFormatOptions} ${styles.exportFormatPrimary}`}>
          <label><input checked={exportFormat === "xlsx"} disabled={exportPending} onChange={() => setExportFormat("xlsx")} type="radio" name="question-bank-export-format" /><span>XLSX</span></label>
          <label><input checked={exportFormat === "moodle-xml"} disabled={exportPending || exportConfirmationBank.questions.length === 0} onChange={() => setExportFormat("moodle-xml")} type="radio" name="question-bank-export-format" /><span>XML Moodle</span></label>
        </div>
        {exportFormat === "xlsx" ? <p>{t("questionBank.exportXlsxWarning")}</p> : <>
          <p>{t("questionBank.exportXmlWarning")}</p>
          {allOrNothingQcmCount ? <fieldset className={`${styles.exportFormatOptions} ${styles.moodleScoringOptions}`} disabled={exportPending}>
            <legend>{t("questionBank.exportAllOrNothingChoice", { count: allOrNothingQcmCount })}</legend>
            <label><input checked={moodleAllOrNothing === "standard"} onChange={() => setMoodleAllOrNothing("standard")} type="radio" name="question-bank-moodle-scoring" /><span>{t("questionBank.exportAllOrNothingStandard")}</span></label>
            <label><input checked={moodleAllOrNothing === "plugin"} onChange={() => setMoodleAllOrNothing("plugin")} type="radio" name="question-bank-moodle-scoring" /><span>{t("questionBank.exportAllOrNothingPlugin")}</span></label>
          </fieldset> : null}
        </>}
        {exportError ? <p role="alert">{exportError}</p> : null}
        <div className="modal-actions">
          <button className="ghost-pill" disabled={exportPending} onClick={() => setExportConfirmationBankId(null)} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" disabled={exportPending} onClick={() => void confirmExport()} type="button">
            {exportPending ? t("common.exporting") : t("questionBank.exportFormatTitle")}
          </button>
        </div>
      </section>
    </div>;
  }

  function renderDeleteBankConfirmation() {
    if (!deleteBankTarget) return null;
    return <div className="paideia-modal-backdrop" role="presentation">
      <section aria-labelledby="question-bank-delete-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <p className="modal-kicker">{t("questionBank.deleteBankKicker")}</p>
        <h2 id="question-bank-delete-title">{t("questionBank.confirmDeleteNamed", { name: deleteBankTarget.name })}</h2>
        <p>{t("questionBank.deleteBankMessage")}</p>
        <div className="modal-actions">
          <button className="ghost-pill" onClick={() => setDeleteBankId(null)} type="button">{t("common.cancel")}</button>
          <button className="danger-pill" onClick={() => void removeBank(deleteBankTarget.id)} type="button">{t("common.delete")}</button>
        </div>
      </section>
    </div>;
  }

  if (!selectedBank) {
    return (
      <section className={styles.panel}>
        <div className="resource-bank-title-row">
          <p className={styles.count}>{t(banks.length === 1 ? "references.bankCount" : "references.bankCountPlural", { count: banks.length })}</p>
          <CreateResourceButton label={t("questionBank.addBank", undefined, "Ajouter une banque")} onClick={addBank} />
          {bulk.selectAll}
          {bulk.actions}
          <ResourceSortControl />
        </div>
        {bulk.error}
        {individual.notice}
        <ResourceNoResults count={visibleBanks.length} />
        <div className="resource-portal-grid">
          {visibleBanks.map((bank) => {
            const tileImageSrc = resolveTileImageSrc(bank.tileImageRef);
            return (
              <article className="resource-portal-card" key={bank.id}>
                {bulk.checkbox(bank)}
                <button
                  className="resource-portal-open"
                  onClick={() => {
                    if (suppressTileOpenRef.current) {
                      suppressTileOpenRef.current = false;
                      return;
                    }
                    openIndividual(bank);
                  }}
                  type="button"
                >
                  <span className={`resource-portal-cover ${tileImageSrc ? "" : "resource-portal-cover-empty"}`}>
                    {tileImageSrc ? (
                      <img alt="" className="resource-portal-image" src={tileImageSrc} />
                    ) : null}
                  </span>
                  <span className="resource-portal-body">
                    <span className="resource-portal-title">{bank.name}</span>
                    <span className="resource-portal-subtitle">{t((bank.contentCount ?? bank.questions.length) === 1 ? "questionBank.questionCount" : "questionBank.questionCountPlural", { count: bank.contentCount ?? bank.questions.length })}</span>
                  </span>
                </button>
                <button
                  aria-label={t("common.optionsFor", { name: bank.name })}
                  className={`library-card-menu-toggle ${styles.tileMenuToggle}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActionMenuId((current) => (current === bank.id ? null : bank.id));
                  }}
                  type="button"
                >
                  ...
                </button>
                {actionMenuId === bank.id ? (
                  <div
                    className={`library-card-menu ${styles.tileMenu}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setActionMenuId(null);
                        openIndividual(bank);
                      }}
                      type="button"
                    >
                      {t("common.configure", undefined, "Configurer")}
                    </button>
                    <button
                      onClick={() => {
                        setActionMenuId(null);
                        setRenameBankId(bank.id);
                        setRenameBankName(bank.name);
                        setRenameBankError("");
                      }}
                      type="button"
                    >
                      {t("common.rename", undefined, "Renommer")}
                    </button>
                    <button
                      onClick={() => {
                        setActionMenuId(null);
                        void requestExport(bank).catch(individual.report);
                      }}
                      type="button"
                    >
                      {t("questionBank.exportFormatTitle")}
                    </button>
                    <button onClick={() => { setActionMenuId(null); void duplicateBank(bank).catch(individual.report); }} type="button">{t("common.duplicate")}</button>
                    <label
                      className="library-card-menu-file-option"
                      onPointerDown={(event) => {
                        armTileOpenSuppression();
                        event.stopPropagation();
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t("editor.chooseImage")}
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        onClick={(event) => {
                          armTileOpenSuppression();
                          event.stopPropagation();
                        }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          armTileOpenSuppression();
                          event.target.value = "";
                          if (!file) {
                            return;
                          }
                          void onTileImageUpload(bank.id, file).finally(() => setActionMenuId(null));
                        }}
                        type="file"
                      />
                    </label>
                    <button
                      className={`danger ${styles.menuDangerAction}`}
                      onClick={() => {
                        setActionMenuId(null);
                        setDeleteBankId(bank.id);
                      }}
                      type="button"
                    >
                      <span className={styles.buttonIcon}><TrashIcon /></span>
                      {t("questionBank.deleteBank", undefined, "Supprimer la banque")}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {renameBankTarget ? <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="question-bank-rename-title" aria-modal="true" className="paideia-modal" role="dialog">
            <p className="modal-kicker">{t("questionBank.kicker", undefined, "Banque de questions")}</p>
            <h2 id="question-bank-rename-title">{t("common.rename", undefined, "Renommer")}</h2>
            <label className={styles.bankNameField}>
              <span>{t("common.name", undefined, "Nom")}</span>
              <input autoFocus disabled={renameBankSaving} onChange={(event) => setRenameBankName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void confirmRenameBank(); }} value={renameBankName} />
            </label>
            {renameBankError ? <p role="alert">{renameBankError}</p> : null}
            <div className="modal-actions">
              <button className="ghost-pill" disabled={renameBankSaving} onClick={() => setRenameBankId(null)} type="button">{t("common.cancel")}</button>
              <button className="primary-pill" disabled={renameBankSaving || !renameBankName.trim()} onClick={() => void confirmRenameBank()} type="button">{t("common.save")}</button>
            </div>
          </section>
        </div> : null}
        {renderExportConfirmation()}
        {renderDeleteBankConfirmation()}
      </section>
    );
  }

  const saveButtonStateClass = saveFeedbackState === "saving"
    ? styles.saveButton_saving
    : saveFeedbackState === "saved"
      ? styles.saveButton_saved
      : saveFeedbackState === "error"
        ? styles.saveButton_error
        : "";

  return (
    <section className={styles.panel}>
      <div className={styles.topBar}>
        <button className={styles.backButton} onClick={() => setSelectedBankId("")} type="button">
          <span className={styles.buttonIcon}><BackIcon /></span>
          {t("resources.backToTiles", undefined, "Retour aux tuiles")}
        </button>
        <div className={styles.saveArea}>
          <button
            className={`resource-save-button active ${styles.saveButton} ${saveButtonStateClass}`}
            disabled={saveFeedbackState === "saving"}
            onClick={() => void saveBanks().catch(() => undefined)}
            type="button"
          >
            <span className={`${styles.buttonIcon} ${saveFeedbackState === "saving" ? styles.savingIcon : ""}`}>
              {saveFeedbackState === "saving"
                ? <SpinnerIcon />
                : saveFeedbackState === "saved"
                  ? <CheckIcon />
                  : saveFeedbackState === "error"
                    ? <ErrorIcon />
                    : <SaveIcon />}
            </span>
            <span>{t("common.save")}</span>
          </button>
        </div>
      </div>

      <div className={styles.editor}>
        <section className={`${styles.card} ${styles.bankOverview}`}>
          <div className={styles.bankOverviewMain}>
            <span className={styles.eyebrow}>{t("common.name", undefined, "Nom")}</span>
            <label className={styles.bankNameField}>
              <input
                aria-label={t("common.name", undefined, "Nom")}
                onChange={(event) => updateBank(selectedBank.id, { name: event.target.value })}
                value={selectedBank.name}
              />
            </label>
          </div>
          <div
            className={styles.bankCount}
            aria-label={`${selectedBank.questions.length} ${selectedBank.questions.length > 1 ? t("quiz.questionsPlural", undefined, "Questions") : t("quiz.question", undefined, "Question")}`}
          >
            <strong>{selectedBank.questions.length}</strong>
            <span>
              {selectedBank.questions.length > 1
                ? t("quiz.questionsPlural", undefined, "Questions")
                : t("quiz.question", undefined, "Question")}
            </span>
          </div>
        </section>

        <section className={`${styles.card} ${styles.questionSection}`}>
          <div className={styles.questionToolbar}>
            <div className={styles.sectionHeading}>
              <h2>{t("resources.questions")}</h2>
            </div>
            <div className={styles.toolbarActions}>
              <div className={styles.secondaryActions}>
                <button className={styles.secondaryButton} onClick={() => fileInputRef.current?.click()} type="button">
                  <span className={styles.buttonIcon}><ImportIcon /></span>
                  {t("common.import")}
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={() => requestExport(selectedBank)}
                  type="button"
                >
                  <span className={styles.buttonIcon}><ExportIcon /></span>
                  {t("questionBank.exportFormatTitle")}
                </button>
              </div>
              <button className={styles.secondaryButton} onClick={addQuestion} type="button">
                <span className={styles.buttonIcon}><PlusIcon /></span>
                {t("questionBank.addQuestion", undefined, "Ajouter une question")}
              </button>
              <button
                className={styles.dangerButton}
                disabled={!selectedBank.questions.length}
                onClick={() => setDeleteAllQuestionsOpen(true)}
                type="button"
              >
                <span className={styles.buttonIcon}><TrashIcon /></span>
                {t("questionBank.deleteAllQuestions", undefined, "Supprimer toutes les questions")}
              </button>
            </div>
            <input accept=".xlsx,.xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/xml,text/xml" hidden onChange={importQuestions} ref={fileInputRef} type="file" />
          </div>

          {selectedBank.questions.length > 0 ? <div className={styles.questionFilters}>
            <label>
              <span>{t("questionBank.searchQuestions")}</span>
              <input aria-label={t("questionBank.searchQuestions")} onChange={(event) => setQuestionSearch(event.target.value)} placeholder={t("questionBank.searchQuestions")} type="search" value={questionSearch} />
            </label>
            <label>
              <span>{t("questionBank.category")}</span>
              <select onChange={(event) => setQuestionCategory(event.target.value)} value={activeQuestionCategory}>
                <option value="">{t("questionBank.allCategories")}</option>
                {bankCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                {hasUncategorizedQuestions ? <option value={UNCATEGORIZED}>{t("questionBank.withoutCategory")}</option> : null}
              </select>
            </label>
            {bankTags.length > 0 ? <label>
              <span>{t("questionBank.tags")}</span>
              <select onChange={(event) => setQuestionTag(event.target.value)} value={activeQuestionTag}>
                <option value="">{t("questionBank.allTags")}</option>
                {bankTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label> : null}
            <span className={styles.questionFilterCount}>{t("questionBank.shownQuestions", { shown: visibleQuestions.length, total: selectedBank.questions.length })}</span>
          </div> : null}

          <div className={styles.questionList}>
            {selectedBank.questions.length > 0 && visibleQuestions.length === 0 ? <p className={styles.questionFilterEmpty}>{t("questionBank.noFilterResults")}</p> : null}
            {visibleQuestions.map(({ question, index }) => {
              const isCollapsed = collapsedQuestionIds.includes(question.id);
              const questionLabel = questionLabels.get(question.id) || `Question ${index + 1}`;
              return (
                <article className={`${styles.question} ${isCollapsed ? styles.collapsed : styles.expanded}`} key={question.id}>
                  <div className={styles.questionHead}>
                    <button
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? t("questionBank.expandQuestion", { name: questionLabel }) : t("questionBank.collapseQuestion", { name: questionLabel })}
                      className={styles.toggle}
                      onClick={() => toggleQuestionCollapse(question.id)}
                      type="button"
                    >
                      <span className={`${styles.chevron} ${isCollapsed ? styles.collapsed : ""}`} />
                    </button>
                    <div className={styles.questionSummary}>
                      <strong className={styles.questionTitle} title={questionLabel}>{questionLabel}</strong>
                      <div className={styles.questionMeta}>
                        <span className={styles.metaType}>{modeLabel(question.mode, t("quiz.trueFalse", undefined, "Vrai / Faux"))}</span>
                        <span>{question.points} {question.points > 1 ? t("quiz.pointsPlural") : t("quiz.pointSingular")}</span>
                        {question.category ? <span className={styles.metaCategory}>{question.category}</span> : null}
                      </div>
                    </div>
                    <button
                      aria-label={`${t("common.delete")} — ${questionLabel}`}
                      className={styles.iconDangerButton}
                      onClick={() => deleteQuestion(question.id)}
                      title={t("common.delete")}
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  {isCollapsed ? null : (
                    <div className={styles.questionBody}>
                      <div className={`${styles.formGrid} ${styles.settingsGrid}`}>
                        <label>
                          <span>{t("common.name", undefined, "Nom")}</span>
                          <input onChange={(event) => updateQuestion(question.id, { title: event.target.value })} value={question.title ?? ""} />
                        </label>
                        <label>
                          <span>{t("questionBank.type")}</span>
                          <select
                            onChange={(event) =>
                              updateQuestion(question.id, normalizeQuestionForMode(question, event.target.value as QuizQuestionMode, {
                                trueLabel: t("quiz.true", undefined, "Vrai"),
                                falseLabel: t("quiz.false", undefined, "Faux")
                              }))
                            }
                            value={question.mode}
                          >
                            <option value="single">QCU</option>
                            <option value="multiple">QCM</option>
                            <option value="true-false">{t("quiz.trueFalse")}</option>
                          </select>
                        </label>
                        <label>
                          <span>{t("questionBank.points")}</span>
                          <input
                            min={1}
                            onChange={(event) => updateQuestion(question.id, { points: Math.max(1, Number(event.target.value) || 1) })}
                            type="number"
                            value={question.points}
                          />
                        </label>
                        <label>
                          <span>{t("questionBank.category")}</span>
                          <input onChange={(event) => updateQuestion(question.id, { category: event.target.value })} value={question.category ?? ""} />
                        </label>
                        <label>
                          <span>{t("questionBank.tags")}</span>
                          <input onBlur={(event) => updateQuestion(question.id, { tags: splitList(event.target.value) })} defaultValue={listToText(question.tags)} />
                        </label>
                      </div>

                      <div className={styles.field}>
                        <span>{t("quiz.question", undefined, "Question")}</span>
                        {renderRichTextField({
                          bankId: selectedBank.id,
                          questionId: question.id,
                          field: "questionHtml",
                          html: question.questionHtml,
                          label: t("quiz.question", undefined, "Question"),
                          onCommit: (html) => updateQuestion(question.id, { questionHtml: html }),
                          placeholder: t("questionBank.questionPlaceholder", undefined, "Saisissez la question"),
                          className: styles.richEditor
                        })}
                      </div>

                      <section className={styles.answers}>
                        <div className={styles.subsectionHeader}>
                          <div>
                            <span className={styles.sectionLabel}>{t("quiz.answers", undefined, "Réponses")}</span>
                            <p>{question.answers.length} {question.answers.length > 1 ? t("quiz.answers", undefined, "réponses") : t("quiz.answer", undefined, "réponse")}</p>
                          </div>
                          <button className={styles.secondaryButton} disabled={question.mode === "true-false"} onClick={() => addAnswer(question.id)} type="button">
                            <span className={styles.buttonIcon}><PlusIcon /></span>
                            {t("quiz.addAnswer", undefined, "Ajouter une réponse")}
                          </button>
                        </div>
                        {question.mode === "multiple" ? <div className={styles.creditSettings}>
                          <label className={styles.creditField}>
                            <span>{t("quiz.creditScoring")}</span>
                            <select value={questionCreditMode(question) === "default" ? "default" : "partial"} onChange={(event) => {
                              const next = withQuestionCreditMode(question, event.target.value === "partial" ? "equal" : "default");
                              updateQuestion(question.id, { creditMode: next.creditMode, answers: next.answers });
                            }}>
                              <option value="default">{t("quiz.creditAllOrNothing")}</option>
                              <option value="partial">{t("quiz.creditPartial")}</option>
                            </select>
                          </label>
                          {questionCreditMode(question) !== "default" ? <>
                            <p className={styles.creditHint}>{questionCreditMode(question) === "equal"
                              ? t("quiz.creditEqualHint", { count: question.answers.filter((answer) => answer.correct).length })
                              : questionCreditStatus(question) === "active" ? t("quiz.creditCustomHint") : t("quiz.creditIncomplete")}</p>
                            <button className={styles.secondaryButton} onClick={() => {
                              const next = withQuestionCreditMode(question, questionCreditMode(question) === "equal" ? "custom" : "equal");
                              updateQuestion(question.id, { creditMode: next.creditMode, answers: next.answers });
                            }} type="button">{t(questionCreditMode(question) === "equal" ? "quiz.creditCustomize" : "quiz.creditResetEqual")}</button>
                          </> : null}
                        </div> : null}
                        {question.answers.map((answer, answerIndex) => (
                          <div className={styles.answer} key={answer.id}>
                            <label className={styles.correctChoice}>
                              <input
                                checked={answer.correct}
                                disabled={questionCreditMode(question) === "custom"}
                                onChange={(event) => setAnswerCorrect(question.id, answer.id, event.target.checked)}
                                type={question.mode === "multiple" ? "checkbox" : "radio"}
                              />
                              {t("quiz.correctAnswer", undefined, "Bonne réponse")}
                            </label>
                            <div className={styles.answerContent}>
                              {question.mode === "true-false" ? (
                                <strong>{answerIndex === 0 ? t("quiz.true", undefined, "Vrai") : t("quiz.false", undefined, "Faux")}</strong>
                              ) : (
                                renderRichTextField({
                                  bankId: selectedBank.id,
                                  questionId: question.id,
                                  answerId: answer.id,
                                  field: "answerTextHtml",
                                  html: answer.textHtml,
                                  label: t("quiz.answerNumber", { count: answerIndex + 1 }, "Réponse {count}"),
                                  onCommit: (html) => updateAnswer(question.id, answer.id, { textHtml: html }),
                                  placeholder: t("quiz.answerText", undefined, "Texte de réponse"),
                                  className: styles.richEditor
                                })
                              )}
                              {question.mode === "multiple" && questionCreditMode(question) === "custom" ? <label className={styles.creditField}>
                                <span>{t("quiz.creditPercent")}</span>
                                <input
                                  key={`${answer.id}-${answer.creditPercent ?? "empty"}`}
                                  defaultValue={answer.creditPercent ?? ""}
                                  max={100}
                                  min={-100}
                                  onBlur={(event) => {
                                    const value = event.currentTarget.value.trim();
                                    const next = value ? withAdjustedAnswerCredit(question, answer.id, Number(value)) : null;
                                    if (next) updateQuestion(question.id, { answers: next.answers });
                                    else event.currentTarget.value = String(answer.creditPercent ?? "");
                                  }}
                                  step="any"
                                  type="number"
                                />
                              </label> : null}
                              <div className={styles.answerFeedback}>
                                <span>{t("situationalDialogue.feedback")}</span>
                                {renderRichTextField({
                                  bankId: selectedBank.id,
                                  questionId: question.id,
                                  answerId: answer.id,
                                  field: "answerFeedbackHtml",
                                  html: answer.feedbackHtml ?? "",
                                  label: `${t("situationalDialogue.feedback")} — ${t("quiz.answerNumber", { count: answerIndex + 1 }, "Réponse {count}")}`,
                                  onCommit: (html) => updateAnswer(question.id, answer.id, { feedbackHtml: html }),
                                  placeholder: t("situationalDialogue.feedbackPlaceholder"),
                                  className: styles.richEditor
                                })}
                              </div>
                            </div>
                            <button
                              aria-label={`${t("common.delete")} — ${t("quiz.answerNumber", { count: answerIndex + 1 }, "Réponse {count}")}`}
                              className={styles.iconDangerButton}
                              disabled={question.mode === "true-false" || question.answers.length <= 2 || questionCreditMode(question) === "custom"}
                              onClick={() => deleteAnswer(question.id, answer.id)}
                              title={t("common.delete")}
                              type="button"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                      </section>

                      <div className={styles.field}>
                        <span>{t("situationalDialogue.generalFeedback")}</span>
                        {renderRichTextField({
                          bankId: selectedBank.id,
                          questionId: question.id,
                          field: "generalFeedbackHtml",
                          html: question.generalFeedbackHtml ?? "",
                          label: t("situationalDialogue.generalFeedback"),
                          onCommit: (html) => updateQuestion(question.id, { generalFeedbackHtml: html }),
                          placeholder: t("situationalDialogue.feedbackPlaceholder"),
                          className: styles.richEditor
                        })}
                      </div>
                      <div className={styles.field}>
                        <span>{t("quiz.correctFeedback")}</span>
                        {renderRichTextField({
                          bankId: selectedBank.id,
                          questionId: question.id,
                          field: "feedbackCorrectHtml",
                          html: question.feedbackCorrectHtml ?? "",
                          label: t("quiz.correctFeedback"),
                          onCommit: (html) => updateQuestion(question.id, { feedbackCorrectHtml: html }),
                          placeholder: t("quiz.correctFeedbackPlaceholder"),
                          className: styles.richEditor
                        })}
                      </div>
                      <div className={styles.field}>
                        <span>{t("quiz.incorrectFeedback")}</span>
                        {renderRichTextField({
                          bankId: selectedBank.id,
                          questionId: question.id,
                          field: "feedbackIncorrectHtml",
                          html: question.feedbackIncorrectHtml ?? "",
                          label: t("quiz.incorrectFeedback"),
                          onCommit: (html) => updateQuestion(question.id, { feedbackIncorrectHtml: html }),
                          placeholder: t("quiz.incorrectFeedbackPlaceholder"),
                          className: styles.richEditor
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {selectedBank.questions.length === 0 ? (
              <p className={styles.empty}>{t("questionBank.emptyEditor").replace(/CSV/gi, "XLSX/XML")}</p>
            ) : null}
          </div>
        </section>
      </div>

      {renderDeleteBankConfirmation()}

      {deleteAllQuestionsOpen ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="question-bank-delete-all-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("questionBank.kicker", undefined, "Banque de questions")}</p>
            <h2 id="question-bank-delete-all-title">{t("questionBank.confirmDeleteAllQuestions")}</h2>
            <p>{t("questionBank.deleteAllMessage")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={() => setDeleteAllQuestionsOpen(false)} type="button">{t("common.cancel")}</button>
              <button className="danger-pill" onClick={deleteAllQuestions} type="button">{t("common.delete")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {importStatus ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section aria-labelledby="question-bank-import-status-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <p className="modal-kicker">{t("common.import")}</p>
            <h2 id="question-bank-import-status-title">{importStatus.title}</h2>
            <p>{importStatus.message}</p>
            <div className="modal-actions">
              <button className="primary-pill" onClick={() => setImportStatus(null)} type="button">{t("common.ok")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {renderExportConfirmation()}
    </section>
  );
}
