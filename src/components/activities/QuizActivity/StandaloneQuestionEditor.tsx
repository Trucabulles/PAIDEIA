import { useState, type ReactNode } from "react";
import type { QuizActivityData, QuizQuestionMode } from "../../../assessment";
import { questionCreditMode, questionCreditStatus, withAdjustedAnswerCredit, withQuestionCreditMode } from "../../../assessment/assessmentEngine";
import type { QuestionBankResource } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import { AuthoringButton, AuthoringCheckbox } from "../../authoring";
import { copyQuestionBankQuestionToQuiz } from "./quizBankImport";
import type { QuizRichTextFieldParams } from "./types";
import styles from "./QuizActivity.module.css";
import { QuestionBankCategoryFilter } from "./QuestionBankCategoryFilter";
import { matchesQuestionFilters, resolvedQuestionCategory } from "../../../lib/questionBankFilters";

type Props = {
  mode: QuizQuestionMode;
  quiz: QuizActivityData;
  questionBanks: QuestionBankResource[];
  onQuizChange: (updater: (quiz: QuizActivityData) => QuizActivityData) => void;
  renderRichTextField: (params: QuizRichTextFieldParams) => ReactNode;
};

export function StandaloneQuestionEditor({ mode, quiz, questionBanks, onQuizChange, renderRichTextField }: Props) {
  const { t } = useI18n();
  const [entryMode, setEntryMode] = useState<"write" | "bank">("write");
  const [bankId, setBankId] = useState(questionBanks[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const bank = questionBanks.find((item) => item.id === bankId) ?? questionBanks[0];
  const modeQuestions = bank?.questions.filter((item) => item.mode === mode) ?? [];
  const activeCategory = resolvedQuestionCategory(modeQuestions, category);
  const compatibleQuestions = modeQuestions.filter((item) => matchesQuestionFilters(item, { category: activeCategory }));
  const [questionId, setQuestionId] = useState("");
  const question = quiz.questions[0];
  if (!question) return null;

  const updateQuestion = (patch: Partial<typeof question>) => onQuizChange((current) => ({
    ...current, questions: [{ ...current.questions[0], ...patch }]
  }));
  const setAnswers = (answers: typeof question.answers) => {
    const validAnswers = answers.some((answer) => answer.correct)
      ? answers
      : answers.map((answer, index) => ({ ...answer, correct: index === 0 }));
    updateQuestion({ answers: validAnswers });
  };
  const updateSettings = (patch: Partial<typeof quiz.settings>) => onQuizChange((current) => ({
    ...current, settings: { ...current.settings, ...patch, gateChapterUntilPassed: false, sendScoreToLms: false }
  }));
  const rich = (ownerId: string, field: string, html: string, label: string, placeholder: string) => renderRichTextField({
    ownerId, field, html, label, placeholder, className: styles.richField, wrapperClassName: styles.quizRichWrapper
  });

  return <div className={styles.editorPanel}>
    <div className={styles.editorQuestionActions}>
      <AuthoringButton onClick={() => setEntryMode("write")}>{t("standaloneQuestion.write", undefined, "Saisir une question")}</AuthoringButton>
      <AuthoringButton onClick={() => setEntryMode("bank")}>{t("standaloneQuestion.import", undefined, "Importer depuis une banque de questions")}</AuthoringButton>
    </div>
    {entryMode === "bank" ? <section className={styles.bankImportPanel}>
      <label>{t("quiz.bank", undefined, "Banque")}
        <select value={bank?.id ?? ""} onChange={(event) => { setBankId(event.target.value); setCategory(""); setQuestionId(""); }}>
          {questionBanks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {bank ? <QuestionBankCategoryFilter questions={modeQuestions} value={activeCategory} onChange={(value) => { setCategory(value); setQuestionId(""); }} /> : null}
      <label>{t("quiz.question", undefined, "Question")}
        <select value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
          <option value="">{t("standaloneQuestion.choose", undefined, "Choisir une question")}</option>
          {compatibleQuestions.map((item) => <option key={item.id} value={item.id}>{item.title || item.questionHtml.replace(/<[^>]+>/g, " ").trim()}</option>)}
        </select>
      </label>
      {questionBanks.length === 0 ? <p>{t("questionBank.noUserBank")}</p> : modeQuestions.length === 0 ? <p>{t("standaloneQuestion.emptyBank", undefined, "Aucune question de ce type dans cette banque.")}</p> : compatibleQuestions.length === 0 ? <p>{t("questionBank.noFilterResults")}</p> : null}
      <AuthoringButton disabled={!questionId} onClick={() => {
        const source = compatibleQuestions.find((item) => item.id === questionId);
        if (!bank || !source) return;
        onQuizChange((current) => ({ ...current, questions: [copyQuestionBankQuestionToQuiz(bank.id, source)] }));
        setEntryMode("write");
      }}>{t("standaloneQuestion.importOne", undefined, "Importer cette question")}</AuthoringButton>
    </section> : <div className={styles.questionEditor}>
      {rich(question.id, "questionHtml", question.questionHtml, t("quiz.question", undefined, "Question"), t("questionBank.questionPlaceholder", undefined, "Saisissez la question"))}
      <div className={styles.answersEditor}>
        <span className="editor-label">{t("quiz.answers", undefined, "Réponses")}</span>
        {mode === "multiple" ? <div className={styles.creditSettings}>
          <label className={styles.creditField}>
            <span>{t("quiz.creditScoring")}</span>
            <select value={questionCreditMode(question) === "default" ? "default" : "partial"} onChange={(event) => {
              const next = withQuestionCreditMode(question, event.target.value === "partial" ? "equal" : "default");
              updateQuestion({ creditMode: next.creditMode, answers: next.answers });
            }}>
              <option value="default">{t("quiz.creditAllOrNothing")}</option>
              <option value="partial">{t("quiz.creditPartial")}</option>
            </select>
          </label>
          {questionCreditMode(question) !== "default" ? <>
            <p className={styles.creditHint}>{questionCreditMode(question) === "equal"
              ? t("quiz.creditEqualHint", { count: question.answers.filter((answer) => answer.correct).length })
              : questionCreditStatus(question) === "active" ? t("quiz.creditCustomHint") : t("quiz.creditIncomplete")}</p>
            <AuthoringButton onClick={() => {
              const next = withQuestionCreditMode(question, questionCreditMode(question) === "equal" ? "custom" : "equal");
              updateQuestion({ creditMode: next.creditMode, answers: next.answers });
            }}>{t(questionCreditMode(question) === "equal" ? "quiz.creditCustomize" : "quiz.creditResetEqual")}</AuthoringButton>
          </> : null}
        </div> : null}
        {question.answers.map((answer, index) => <article className={styles.answerEditor} key={answer.id}>
          <label className={styles.correctToggle}>
            <input checked={answer.correct} disabled={questionCreditMode(question) === "custom"} onChange={(event) => setAnswers(question.answers.map((item) => ({ ...item, correct: mode === "multiple" ? item.id === answer.id ? event.target.checked : item.correct : item.id === answer.id })))} type={mode === "multiple" ? "checkbox" : "radio"} />
            <span>{t("quiz.correctAnswer", undefined, "Bonne réponse")}</span>
          </label>
          {mode === "true-false" ? <div className={styles.fixedAnswerText}>{index === 0 ? t("quiz.true", undefined, "Vrai") : t("quiz.false", undefined, "Faux")}</div> : <>
            {rich(answer.id, "textHtml", answer.textHtml, t("quiz.answerNumber", { count: index + 1 }, `Réponse ${index + 1}`), t("quiz.answerText", undefined, "Réponse"))}
            {question.answers.length > 2 ? <AuthoringButton disabled={questionCreditMode(question) === "custom"} onClick={() => setAnswers(question.answers.filter((item) => item.id !== answer.id))}>{t("common.delete", undefined, "Supprimer")}</AuthoringButton> : null}
          </>}
          {mode === "multiple" && questionCreditMode(question) === "custom" ? <label className={styles.creditField}>
            <span>{t("quiz.creditPercent")}</span>
            <input
              key={`${answer.id}-${answer.creditPercent ?? "empty"}`}
              defaultValue={answer.creditPercent ?? ""}
              max={100}
              min={-100}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                const next = value ? withAdjustedAnswerCredit(question, answer.id, Number(value)) : null;
                if (next) updateQuestion({ answers: next.answers });
                else event.currentTarget.value = String(answer.creditPercent ?? "");
              }}
              step="any"
              type="number"
            />
          </label> : null}
          {rich(answer.id, "feedbackHtml", answer.feedbackHtml || "", t("cardSort.feedbackTitle"), t("quiz.incorrectFeedbackPlaceholder"))}
        </article>)}
        {mode !== "true-false" ? <AuthoringButton onClick={() => updateQuestion({ answers: [...question.answers, { id: `answer_${Date.now()}`, textHtml: "<p></p>", correct: false, creditPercent: questionCreditMode(question) === "custom" ? 0 : null }] })}>{t("quiz.addAnswer", undefined, "Ajouter une réponse")}</AuthoringButton> : null}
      </div>
      {rich(question.id, "feedbackCorrectHtml", question.feedbackCorrectHtml || "", t("quiz.correctFeedback", undefined, "Feedback si la réponse est correcte"), "")}
      {rich(question.id, "feedbackIncorrectHtml", question.feedbackIncorrectHtml || "", t("quiz.incorrectFeedback", undefined, "Feedback si la réponse est incorrecte"), "")}
    </div>}
    <label>{t("quiz.maxAttempts", undefined, "Nombre de tentatives autorisées")}
      <input min={0} onChange={(event) => updateSettings({ maxAttempts: Math.max(0, Number(event.target.value) || 0) })} type="number" value={quiz.settings.maxAttempts} />
      <small>{t("standaloneQuestion.unlimited", undefined, "0 = sans limite")}</small>
    </label>
    <AuthoringCheckbox checked={quiz.settings.showCorrectness !== false} onChange={(event) => updateSettings({ showCorrectness: event.target.checked })}>{t("standaloneQuestion.showCorrectness", undefined, "Afficher si la réponse est correcte ou incorrecte")}</AuthoringCheckbox>
    <AuthoringCheckbox checked={quiz.settings.showCorrectAnswer} onChange={(event) => updateSettings({ showCorrectAnswer: event.target.checked })}>{t("quiz.showCorrectAnswer", undefined, "Afficher la bonne réponse")}</AuthoringCheckbox>
    <AuthoringCheckbox checked={quiz.settings.showFeedback} onChange={(event) => updateSettings({ showFeedback: event.target.checked })}>{t("quiz.showFeedback", undefined, "Afficher les feedbacks")}</AuthoringCheckbox>
  </div>;
}
