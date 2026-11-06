import type { QuizActivityData } from "../../../assessment";
import type { QuestionBankResource } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import { AuthoringButton, AuthoringCheckbox } from "../../authoring";
import { copyQuestionBankQuestionToQuiz } from "./quizBankImport";
import styles from "./QuizActivity.module.css";
import { QuestionBankCategoryFilter } from "./QuestionBankCategoryFilter";
import { matchesQuestionFilters, questionCategories, UNCATEGORIZED } from "../../../lib/questionBankFilters";

type Props = {
  quiz: QuizActivityData;
  questionBanks: QuestionBankResource[];
  onQuizChange: (updater: (quiz: QuizActivityData) => QuizActivityData) => void;
};

export function RandomQuestionsEditor({ quiz, questionBanks, onQuizChange }: Props) {
  const { t } = useI18n();
  const sourceId = quiz.questions[0]?.sourceBankId ?? questionBanks[0]?.id ?? "";
  const source = questionBanks.find((bank) => bank.id === sourceId);
  const currentSourceIds = new Set(quiz.questions.map((question) => question.sourceQuestionId).filter(Boolean));
  const allSourceIds = source?.questions.map((question) => question.id) ?? [];
  const category = allSourceIds.length > 0 && currentSourceIds.size === allSourceIds.length && allSourceIds.every((id) => currentSourceIds.has(id))
    ? ""
    : source ? [...questionCategories(source.questions), UNCATEGORIZED].find((candidate) => {
      const pool = source.questions.filter((question) => matchesQuestionFilters(question, { category: candidate }));
      return pool.length > 0 && pool.length === currentSourceIds.size && pool.every((question) => currentSourceIds.has(question.id));
    }) ?? "" : "";
  const updateSettings = (patch: Partial<typeof quiz.settings>) => onQuizChange((current) => ({
    ...current,
    settings: { ...current.settings, ...patch, passingScore: 0, gateChapterUntilPassed: false, sendScoreToLms: false }
  }));
  const selectPool = (bankId: string, selectedCategory = "") => {
    const bank = questionBanks.find((item) => item.id === bankId);
    if (!bank) return;
    const pool = bank.questions.filter((question) => matchesQuestionFilters(question, { category: selectedCategory }));
    onQuizChange((current) => ({
      ...current,
      questions: pool.map((question) => copyQuestionBankQuestionToQuiz(bank.id, question)),
      settings: {
        ...current.settings,
        limitQuestions: true,
        questionLimit: Math.max(1, Math.min(current.settings.questionLimit || 1, pool.length)),
        passingScore: 0,
        gateChapterUntilPassed: false,
        sendScoreToLms: false
      }
    }));
  };

  return <div className={styles.editorPanel}>
    <label>{t("quiz.bank", undefined, "Banque")}
      <select value={sourceId} onChange={(event) => selectPool(event.target.value)}>
        {!sourceId ? <option value="">{t("standaloneQuestion.choose", undefined, "Choisir une banque")}</option> : null}
        {questionBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name} ({bank.questions.length})</option>)}
      </select>
    </label>
    {source ? <QuestionBankCategoryFilter questions={source.questions} value={category} onChange={(value) => selectPool(source.id, value)} /> : null}
    {questionBanks.length === 0 ? <p>{t("questionBank.noUserBank")}</p> : null}
    {source && quiz.questions.length === 0 ? <AuthoringButton onClick={() => selectPool(source.id)}>{t("standaloneQuestion.import", undefined, "Utiliser cette banque")}</AuthoringButton> : null}
    {quiz.questions.length > 0 ? <p>{quiz.questions.length} {t("quiz.questionsPlural", undefined, "questions")} — {source?.name ?? t("quiz.bank", undefined, "Banque")}</p> : null}
    <label>{t("quiz.questionCount", undefined, "Nombre de questions")}
      <input min={1} max={Math.max(1, quiz.questions.length)} type="number" value={quiz.settings.questionLimit}
        onChange={(event) => updateSettings({ questionLimit: Math.max(1, Math.min(quiz.questions.length || 1, Number(event.target.value) || 1)) })} />
    </label>
    <AuthoringCheckbox checked={quiz.settings.shuffleQuestions} onChange={(event) => updateSettings({ shuffleQuestions: event.target.checked })}>{t("quiz.shuffleQuestions", undefined, "Mélanger les questions présentées")}</AuthoringCheckbox>
    <AuthoringCheckbox checked={quiz.settings.shuffleAnswers} onChange={(event) => updateSettings({ shuffleAnswers: event.target.checked })}>{t("quiz.shuffleAnswers", undefined, "Mélanger les réponses")}</AuthoringCheckbox>
    <label>{t("quiz.maxAttempts", undefined, "Nombre de tentatives autorisées")}
      <input min={0} type="number" value={quiz.settings.maxAttempts} onChange={(event) => updateSettings({ maxAttempts: Math.max(0, Number(event.target.value) || 0) })} />
      <small>{t("standaloneQuestion.unlimited", undefined, "0 = sans limite")}</small>
    </label>
    <AuthoringCheckbox checked={quiz.settings.showCorrectness !== false} onChange={(event) => updateSettings({ showCorrectness: event.target.checked })}>{t("standaloneQuestion.showCorrectness", undefined, "Afficher si la réponse est correcte ou incorrecte")}</AuthoringCheckbox>
    <AuthoringCheckbox checked={quiz.settings.showCorrectAnswer} onChange={(event) => updateSettings({ showCorrectAnswer: event.target.checked })}>{t("quiz.showCorrectAnswer", undefined, "Afficher la bonne réponse")}</AuthoringCheckbox>
    <AuthoringCheckbox checked={quiz.settings.showFeedback} onChange={(event) => updateSettings({ showFeedback: event.target.checked })}>{t("quiz.showFeedback", undefined, "Afficher les feedbacks")}</AuthoringCheckbox>
  </div>;
}
