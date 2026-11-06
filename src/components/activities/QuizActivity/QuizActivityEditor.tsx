import { loadResourceBank } from "../../../lib/resourceBankApi";
import type { QuestionBankResource } from "../../../types/project";
import { useEffect, useId, useState } from "react";
import { AuthoringButton, AuthoringCheckbox, AuthoringFieldGrid } from "../../authoring";
import type { QuizQuestionMode, QuizReviewMode } from "../../../assessment";
import { questionCreditMode, questionCreditStatus, withAdjustedAnswerCredit, withQuestionCreditMode } from "../../../assessment/assessmentEngine";
import styles from "./QuizActivity.module.css";
import type { QuizActivityEditorProps } from "./types";
import { useI18n } from "../../../i18n/react";
import { QuestionBankCategoryFilter } from "./QuestionBankCategoryFilter";
import { matchesQuestionFilters, resolvedQuestionCategory } from "../../../lib/questionBankFilters";

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

function editableTextFromHtml(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const container = document.createElement("div");
  container.innerHTML = value;
  return (container.textContent ?? "").replace(/\u00a0/g, " ");
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function questionModeLabel(mode: QuizQuestionMode) {
  if (mode === "multiple") {
    return "QCM";
  }
  if (mode === "true-false") {
    return "Vrai / Faux";
  }
  return "QCU";
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 13h8l1-13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function QuizActivityEditor({
  automaticTitle,
  quiz,
  questionBanks,
  onAddAnswer,
  onAddQuestion,
  onDuplicateQuestion,
  onImportQuestionsFromBank,
  onMoveAnswer,
  onMoveQuestion,
  onRemoveAnswer,
  onRemoveQuestion,
  onSetAnswerCorrect,
  onToggleSendScoreToLms,
  onUpdateAnswer,
  onUpdateQuestion,
  onUpdateQuiz,
  renderRichTextField
}: QuizActivityEditorProps) {
  const { t } = useI18n();
  const [activeQuestionId, setActiveQuestionId] = useState(quiz.questions[0]?.id ?? "");
  const [isBankImportOpen, setIsBankImportOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [loadedImportBank, setLoadedImportBank] = useState<QuestionBankResource | null>(null);
  const [bankLoadError, setBankLoadError] = useState("");
  useEffect(() => {
    const bank = questionBanks.find(bank => bank.id === selectedBankId) ?? questionBanks[0];
    if (!isBankImportOpen || !bank) return;
    let cancelled = false;
    setLoadedImportBank(null); setBankLoadError("");
    void loadResourceBank("questions", bank).then(loaded => { if (!cancelled) setLoadedImportBank(loaded); })
      .catch(error => { if (!cancelled) setBankLoadError(String(error)); });
    return () => { cancelled = true; };
  }, [isBankImportOpen, selectedBankId, questionBanks]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const lmsScoreDescriptionId = useId();
  const gateDescriptionId = useId();
  const lmsScoreDescription = t(
    "quiz.sendScoreToLmsDescription",
    undefined,
    "Permet d’utiliser le score du quiz pour la progression dans le LMS. Un seul quiz par leçon peut envoyer un score au LMS."
  );
  const gateDescription = t(
    "quiz.gateFiniteAttemptsHint",
    undefined,
    "Cette option s’applique uniquement lorsque les tentatives sont illimitées. Avec une limite, la suite reste bloquée jusqu’à la réussite ou l’épuisement des tentatives."
  );
  const storedQuizTitle = stripHtml(quiz.titleHtml);
  const editableQuizTitle = editableTextFromHtml(quiz.titleHtml);
  const quizTitle = quiz.titleMode === "custom" && storedQuizTitle ? editableQuizTitle : automaticTitle;
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<string[]>([]);
  const activeQuestion = quiz.questions.find((question) => question.id === activeQuestionId) ?? quiz.questions[0] ?? null;
  const isTrueFalse = activeQuestion?.mode === "true-false";
  const totalPoints = quiz.questions.reduce((total, question) => total + Math.max(1, Number(question.points) || 1), 0);
  const selectedBank = (loadedImportBank && loadedImportBank.id === (selectedBankId || questionBanks[0]?.id) ? loadedImportBank : null) ?? questionBanks.find((bank) => bank.id === selectedBankId) ?? questionBanks[0] ?? null;
  const selectedBankQuestions = selectedBank?.questions ?? [];
  const activeCategory = resolvedQuestionCategory(selectedBankQuestions, selectedCategory);
  const visibleBankQuestions = selectedBankQuestions.filter((question) => matchesQuestionFilters(question, { category: activeCategory }));
  const allSelected = visibleBankQuestions.length > 0 && visibleBankQuestions.every((question) => selectedBankQuestionIds.includes(question.id));
  const unlimitedAttempts = Number(quiz.settings.maxAttempts) === 0;

  function openBankImport() {
    setSelectedBankId((current) => current || questionBanks[0]?.id || "");
    setSelectedBankQuestionIds([]);
    setSelectedCategory("");
    setIsBankImportOpen(true);
  }

  function selectImportBank(bankId: string) {
    setSelectedBankId(bankId);
    setSelectedBankQuestionIds([]);
    setSelectedCategory("");
  }

  function toggleBankQuestion(questionId: string, selected: boolean) {
    setSelectedBankQuestionIds((current) =>
      selected ? [...current, questionId] : current.filter((candidate) => candidate !== questionId)
    );
  }

  function toggleAllBankQuestions() {
    const visibleIds = new Set(visibleBankQuestions.map((question) => question.id));
    setSelectedBankQuestionIds((current) => allSelected
      ? current.filter((id) => !visibleIds.has(id))
      : Array.from(new Set([...current, ...visibleIds])));
  }

  async function importSelectedQuestions() {
    if (!selectedBank || selectedBankQuestionIds.length === 0) {
      return;
    }
    await onImportQuestionsFromBank(selectedBank.id, selectedBankQuestionIds);
    setSelectedBankQuestionIds([]);
  }

  function updateMode(mode: QuizQuestionMode) {
    if (!activeQuestion) {
      return;
    }
    if (mode === "true-false") {
      onUpdateQuestion(activeQuestion.id, {
        mode,
        answers: [
          { id: activeQuestion.answers[0]?.id ?? `answer_${Date.now()}_true`, textHtml: "<p>Vrai</p>", correct: true },
          { id: activeQuestion.answers[1]?.id ?? `answer_${Date.now()}_false`, textHtml: "<p>Faux</p>", correct: false }
        ]
      });
      return;
    }
    const answers = activeQuestion.answers.length >= 2
      ? activeQuestion.answers
      : [
          ...activeQuestion.answers,
          { id: `answer_${Date.now()}_2`, textHtml: `<p>${t("quiz.answer", undefined, "Réponse")}</p>`, correct: false }
        ];
    onUpdateQuestion(activeQuestion.id, { mode, creditMode: mode === "multiple" ? activeQuestion.creditMode : null, answers: mode === "multiple" ? answers : answers.map((answer) => ({ ...answer, creditPercent: null })) });
  }

  function renderSettingsPanel() {
    return (
      <section className={styles.settingsPanel}>
        <span className="editor-label">{t("common.settings", undefined, "Paramètres")}</span>
        <AuthoringFieldGrid>
          <AuthoringCheckbox checked={quiz.settings.shuffleAnswers} compact onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, shuffleAnswers: event.target.checked } })}>
            {t("quiz.shuffleAnswers")}
          </AuthoringCheckbox>
          <AuthoringCheckbox checked={quiz.settings.shuffleQuestions} compact onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, shuffleQuestions: event.target.checked } })}>
            {t("quiz.shuffleQuestions")}
          </AuthoringCheckbox>
          <AuthoringCheckbox
            checked={quiz.settings.limitQuestions}
            compact
            onChange={(event) =>
              onUpdateQuiz({
                settings: {
                  ...quiz.settings,
                  limitQuestions: event.target.checked,
                  questionLimit: event.target.checked
                    ? Math.max(1, Math.min(quiz.questions.length, Number(quiz.settings.questionLimit) || quiz.questions.length))
                    : quiz.settings.questionLimit
                }
              })
            }
          >
            {t("quiz.limitPresentedQuestions")}
          </AuthoringCheckbox>
          {quiz.settings.limitQuestions ? (
            <label>
              <span>{t("quiz.presentedQuestions", undefined, "Questions présentées")}</span>
              <input
                max={quiz.questions.length}
                min={1}
                onChange={(event) =>
                  onUpdateQuiz({
                    settings: {
                      ...quiz.settings,
                      questionLimit: Math.max(1, Math.min(quiz.questions.length, Number(event.target.value) || 1))
                    }
                  })
                }
                step={1}
                type="number"
                value={Math.max(1, Math.min(quiz.questions.length, Number(quiz.settings.questionLimit) || quiz.questions.length))}
              />
            </label>
          ) : null}
          <AuthoringCheckbox checked={quiz.settings.showFeedback} compact onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, showFeedback: event.target.checked } })}>
            {t("quiz.showFeedback", undefined, "Afficher les feedbacks")}
          </AuthoringCheckbox>
          <AuthoringCheckbox checked={quiz.settings.showCorrectAnswer} compact onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, showCorrectAnswer: event.target.checked } })}>
            {t("quiz.showCorrectAnswer")}
          </AuthoringCheckbox>
          {quiz.settings.showCorrectAnswer && unlimitedAttempts && !quiz.settings.gateChapterUntilPassed ? (
            <p className={styles.gateAttemptsHint} role="status">
              {t(
                "quiz.showCorrectNonBlockingWarning",
                undefined,
                "La bonne réponse pourra être révélée alors qu’une nouvelle tentative reste disponible, ce qui facilitera l’essai suivant."
              )}
            </p>
          ) : null}
          <div className={styles.settingsHelpControlGroup}>
            <AuthoringCheckbox
              aria-describedby={!unlimitedAttempts ? gateDescriptionId : undefined}
              checked={quiz.settings.gateChapterUntilPassed}
              compact
              disabled={!unlimitedAttempts}
              labelClassName={!unlimitedAttempts ? styles.settingsHelpControl : undefined}
              onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, gateChapterUntilPassed: event.target.checked } })}
            >
              {t("quiz.gateUntilPassed")}
            </AuthoringCheckbox>
            {!unlimitedAttempts ? (
              <>
                <button
                  aria-label={gateDescription}
                  className={styles.lmsScoreHelp}
                  type="button"
                >
                  ?
                </button>
                <span className={styles.lmsScoreTooltip} id={gateDescriptionId} role="tooltip">
                  {gateDescription}
                </span>
              </>
            ) : null}
          </div>
          <AuthoringCheckbox
            checked={unlimitedAttempts}
            compact
            onChange={(event) =>
              onUpdateQuiz({
                settings: {
                  ...quiz.settings,
                  maxAttempts: event.target.checked ? 0 : 1,
                  allowRetry: event.target.checked || (quiz.settings.maxAttempts ?? 1) > 1
                }
              })
            }
          >
            {t("quiz.unlimitedAttempts", undefined, "Ne pas imposer de limite de tentatives")}
          </AuthoringCheckbox>
          <label>
            <span>{t("quiz.maxAttempts", undefined, "Nombre de tentatives autorisées")}</span>
            <input
              disabled={unlimitedAttempts}
              min={1}
              onChange={(event) =>
                onUpdateQuiz({
                  settings: {
                    ...quiz.settings,
                    maxAttempts: Math.max(1, Number(event.target.value) || 1),
                    allowRetry: Math.max(1, Number(event.target.value) || 1) > 1
                  }
                })
              }
              step={1}
              type="number"
              value={unlimitedAttempts ? "" : Math.max(1, Number(quiz.settings.maxAttempts) || 1)}
            />
          </label>
          <label>
            <span>{t("quiz.passingScore")}</span>
            <input
              max={100}
              min={0}
              onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, passingScore: Number(event.target.value) || 0 } })}
              type="number"
              value={quiz.settings.passingScore}
            />
          </label>
          <label>
            <span>{t("quiz.reviewWithFeedback", undefined, "Relecture avec feedback")}</span>
            <select
              onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, reviewMode: event.target.value as QuizReviewMode } })}
              value={quiz.settings.reviewMode}
            >
              <option value="disabled">{t("common.never", undefined, "Jamais")}</option>
              <option value="after-pass">{t("quiz.afterPass")}</option>
              <option value="after-attempts">{t("quiz.afterAttempts")}</option>
            </select>
          </label>
          {quiz.settings.reviewMode === "after-attempts" ? (
            <label>
              <span>{t("quiz.attemptsBeforeReview", undefined, "Essais avant relecture")}</span>
              <input
                min={1}
                onChange={(event) => onUpdateQuiz({ settings: { ...quiz.settings, reviewAfterAttempts: Math.max(1, Number(event.target.value) || 1) } })}
                step={1}
                type="number"
                value={quiz.settings.reviewAfterAttempts}
              />
            </label>
          ) : null}
        </AuthoringFieldGrid>
      </section>
    );
  }

  return (
    <div className={`activity-style-panel ${styles.editor}`}>
      <div className={styles.editorHeader}>
        <div>
          <input
            aria-label={t("activity.quiz", undefined, "Quiz")}
            className={styles.technicalTitleInput}
            maxLength={120}
            onBlur={(event) => {
              if (!event.currentTarget.value.trim()) {
                onUpdateQuiz({ titleHtml: "<p></p>", titleMode: "auto" });
              }
            }}
            onChange={(event) => {
              const title = event.target.value;
              onUpdateQuiz({
                titleHtml: title.trim() ? `<p>${escapeHtmlText(title)}</p>` : "<p></p>",
                titleMode: title.trim() ? "custom" : "auto"
              });
            }}
            size={Math.max(4, Math.min(60, quizTitle.length))}
            spellCheck
            type="text"
            value={quizTitle}
          />
          <p className="field-hint">{t("quiz.editorHelp")}</p>
        </div>
        <div className={styles.lmsScoreControlGroup}>
          <AuthoringCheckbox
            aria-describedby={lmsScoreDescriptionId}
            checked={quiz.settings.sendScoreToLms}
            compact
            labelClassName={styles.lmsScoreControl}
            onChange={(event) => onToggleSendScoreToLms(event.target.checked)}
          >
            {t("quiz.sendScoreToLms", undefined, "Envoyer le score au LMS")}
          </AuthoringCheckbox>
          <button
            aria-label={lmsScoreDescription}
            className={styles.lmsScoreHelp}
            type="button"
          >
            ?
          </button>
          <span className={styles.lmsScoreTooltip} id={lmsScoreDescriptionId} role="tooltip">
            {lmsScoreDescription}
          </span>
        </div>
      </div>

      <section className={styles.quizGlobalFields}>
        {renderRichTextField({
          ownerId: "quiz",
          field: "startLeadHtml",
          html: quiz.startLeadHtml,
          label: t("quiz.startPanelText"),
          placeholder: t("quiz.startPlaceholder", undefined, "Vous allez maintenant tester vos connaissances."),
          className: styles.richField,
          wrapperClassName: `${styles.quizRichWrapper} ${styles.quizStartLeadWrapper}`
        })}
      </section>

      {renderSettingsPanel()}

      <div className={styles.editorQuestionActions}>
        <AuthoringButton className={styles.editorSecondaryButton} onClick={openBankImport} variant="secondary">
          {t("quiz.addFromBank", undefined, "Ajouter depuis la banque")}
        </AuthoringButton>
        <AuthoringButton className={styles.editorSecondaryButton} onClick={onAddQuestion} variant="secondary">
          {t("quiz.addQuestion", undefined, "Ajouter une question")}
        </AuthoringButton>
      </div>

      {isBankImportOpen ? (
        <section className={styles.bankImportPanel} aria-label={t("quiz.importFromQuestionBank", undefined, "Import depuis la banque de questions")}>
          <div className={styles.bankImportHeader}>
            <div>
              <span className="editor-label">{t("resources.questions")}</span>
              <p className="field-hint">{t("quiz.importCopyHint")}</p>
            </div>
            <AuthoringButton className={styles.editorNeutralButton} compact onClick={() => setIsBankImportOpen(false)}>
              {t("common.close")}
            </AuthoringButton>
          </div>
          {bankLoadError ? <p role="alert">{bankLoadError}</p> : null}
          {questionBanks.length > 0 ? (
            <>
              <AuthoringFieldGrid>
                <label>
                  <span>{t("quiz.bank", undefined, "Banque")}</span>
                  <select value={selectedBank?.id ?? ""} onChange={(event) => selectImportBank(event.target.value)}>
                    {questionBanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name || t("questionBank.unnamed")} ({bank.contentCount ?? bank.questions.length})
                      </option>
                    ))}
                  </select>
                </label>
              </AuthoringFieldGrid>
              {selectedBank ? <div className={styles.bankCategoryFilter}>
                <QuestionBankCategoryFilter onChange={setSelectedCategory} questions={selectedBankQuestions} value={activeCategory} />
              </div> : null}
              {selectedBankQuestions.length > 0 ? (
                <>
                  <div className={styles.bankImportActions}>
                    <AuthoringButton className={styles.editorNeutralButton} compact onClick={toggleAllBankQuestions}>
                      {t(allSelected ? "common.deselectAll" : "common.selectAll")}
                    </AuthoringButton>
                    <span>{t("questionBank.selectedQuestions", { count: selectedBankQuestionIds.length })}</span>
                    <AuthoringButton
                      className={styles.editorSecondaryButton}
                      compact
                      disabled={selectedBankQuestionIds.length === 0}
                      onClick={() => void importSelectedQuestions()}
                      variant="secondary"
                    >
                      {t("quiz.importSelection", undefined, "Importer la sélection")}
                    </AuthoringButton>
                  </div>
                  <div className={styles.bankImportList}>
                    {visibleBankQuestions.map((question, index) => {
                      const questionLabel = stripHtml(question.questionHtml) || question.title || t("quiz.questionNumber", { count: index + 1 });
                      return (
                        <label className={styles.bankImportQuestion} key={question.id}>
                          <input
                            checked={selectedBankQuestionIds.includes(question.id)}
                            onChange={(event) => toggleBankQuestion(question.id, event.target.checked)}
                            type="checkbox"
                          />
                          <span>
                            <strong>{questionLabel}</strong>
                            <small>
                              {questionModeLabel(question.mode)} · {question.points} {t(question.points > 1 ? "quiz.pointsPlural" : "quiz.pointSingular")}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {visibleBankQuestions.length === 0 ? <p className="field-hint">{t("questionBank.noFilterResults")}</p> : null}
                </>
              ) : (
                  <p className="field-hint" role={selectedBank?.contentLoaded === false ? "status" : undefined}>{selectedBank?.contentLoaded === false ? (bankLoadError ? "" : t("pdf.loading")) : t("questionBank.emptyBank")}</p>
              )}
            </>
          ) : (
            <p className="field-hint">{t("questionBank.noUserBank")}</p>
          )}
        </section>
      ) : null}

      <div className={styles.editorLayout}>
        <aside className={styles.questionRail} aria-label={t("quiz.questionnaireQuestions", undefined, "Questions du questionnaire")}>
          <div className={styles.questionRailList}>
            {quiz.questions.map((question, index) => (
              <article className={`${styles.questionRailItem} ${question.id === activeQuestion?.id ? styles.selectedQuestion : ""}`} key={question.id}>
                <button onClick={() => setActiveQuestionId(question.id)} type="button">
                  <strong>{t("quiz.questionNumber", { count: index + 1 })}</strong>
                  <span>{stripHtml(question.questionHtml) || t("quiz.questionWithoutText")}</span>
                </button>
                <div className={styles.railActions}>
                  <AuthoringButton className={styles.editorIconButton} compact disabled={index === 0} onClick={() => onMoveQuestion(question.id, -1)}>↑</AuthoringButton>
                  <AuthoringButton className={styles.editorIconButton} compact disabled={index === quiz.questions.length - 1} onClick={() => onMoveQuestion(question.id, 1)}>↓</AuthoringButton>
                  <AuthoringButton className={styles.editorNeutralButton} compact onClick={() => onDuplicateQuestion(question.id)}>{t("common.copy")}</AuthoringButton>
                <AuthoringButton
                  aria-label={t("quiz.deleteQuestion", { count: index + 1 })}
                  className={`${styles.editorDangerButton} ${styles.editorDangerIconButton}`}
                  compact
                  disabled={quiz.questions.length <= 1}
                  onClick={() => onRemoveQuestion(question.id)}
                  title={t("quiz.deleteQuestion", { count: index + 1 })}
                  variant="danger"
                >
                  <TrashIcon />
                </AuthoringButton>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.totalPoints} aria-live="polite">
            {t("quiz.totalPoints")} <strong>{totalPoints}</strong> {totalPoints > 1 ? t("quiz.pointsPlural") : t("quiz.pointSingular")}
          </div>
        </aside>

        <section className={styles.editorPanel}>
          {activeQuestion ? (
            <div className={styles.questionEditor}>
              <AuthoringFieldGrid>
                <label>
                  <span>{t("quiz.questionType", undefined, "Type de question")}</span>
                  <select value={activeQuestion.mode} onChange={(event) => updateMode(event.target.value as QuizQuestionMode)}>
                    <option value="single">{t("quiz.singleChoice")}</option>
                    <option value="multiple">{t("quiz.multipleChoice")}</option>
                    <option value="true-false">{t("quiz.trueFalse")}</option>
                  </select>
                </label>
                <label>
                  <span>{t("quiz.questionPoints", undefined, "Points de cette question")}</span>
                  <input
                    min={1}
                    onChange={(event) => onUpdateQuestion(activeQuestion.id, { points: Math.max(1, Number(event.target.value) || 1) })}
                    step={1}
                    type="number"
                    value={activeQuestion.points}
                  />
                </label>
              </AuthoringFieldGrid>

              {renderRichTextField({
                ownerId: activeQuestion.id,
                field: "questionHtml",
                html: activeQuestion.questionHtml,
                label: t("quiz.question", undefined, "Question"),
                placeholder: t("questionBank.questionPlaceholder", undefined, "Saisissez la question"),
                className: styles.richField,
                wrapperClassName: styles.quizRichWrapper
              })}

              <div className={styles.answersEditor}>
                <div className={styles.answersHeader}>
                  <span className="editor-label">{t("quiz.answers", undefined, "Réponses")}</span>
                  <AuthoringButton className={styles.editorSecondaryButton} disabled={isTrueFalse} onClick={() => onAddAnswer(activeQuestion.id)} variant="secondary">
                    {t("quiz.addAnswer", undefined, "Ajouter une réponse")}
                  </AuthoringButton>
                </div>
                {activeQuestion.mode === "multiple" ? <div className={styles.creditSettings}>
                  <label className={styles.creditField}>
                    <span>{t("quiz.creditScoring")}</span>
                    <select value={questionCreditMode(activeQuestion) === "default" ? "default" : "partial"} onChange={(event) => {
                      const next = withQuestionCreditMode(activeQuestion, event.target.value === "partial" ? "equal" : "default");
                      onUpdateQuestion(activeQuestion.id, { creditMode: next.creditMode, answers: next.answers });
                    }}>
                      <option value="default">{t("quiz.creditAllOrNothing")}</option>
                      <option value="partial">{t("quiz.creditPartial")}</option>
                    </select>
                  </label>
                  {questionCreditMode(activeQuestion) !== "default" ? <>
                    <p className={styles.creditHint}>{questionCreditMode(activeQuestion) === "equal"
                      ? t("quiz.creditEqualHint", { count: activeQuestion.answers.filter((answer) => answer.correct).length })
                      : questionCreditStatus(activeQuestion) === "active" ? t("quiz.creditCustomHint") : t("quiz.creditIncomplete")}</p>
                    <AuthoringButton className={styles.editorSecondaryButton} onClick={() => {
                      const next = withQuestionCreditMode(activeQuestion, questionCreditMode(activeQuestion) === "equal" ? "custom" : "equal");
                      onUpdateQuestion(activeQuestion.id, { creditMode: next.creditMode, answers: next.answers });
                    }} variant="secondary">{t(questionCreditMode(activeQuestion) === "equal" ? "quiz.creditCustomize" : "quiz.creditResetEqual")}</AuthoringButton>
                  </> : null}
                </div> : null}
                {activeQuestion.answers.map((answer, index) => (
                  <article className={styles.answerEditor} key={answer.id}>
                    <div className={styles.answerEditorHeader}>
                      <label className={styles.correctToggle}>
                        <input
                          checked={answer.correct}
                          disabled={questionCreditMode(activeQuestion) === "custom"}
                          onChange={(event) => onSetAnswerCorrect(activeQuestion.id, answer.id, event.target.checked)}
                          type={activeQuestion.mode === "multiple" ? "checkbox" : "radio"}
                        />
                        <span>{t("quiz.correctAnswer")}</span>
                      </label>
                      <div className={styles.answerActions}>
                        <AuthoringButton className={styles.editorIconButton} compact disabled={index === 0 || isTrueFalse} onClick={() => onMoveAnswer(activeQuestion.id, answer.id, -1)}>↑</AuthoringButton>
                        <AuthoringButton className={styles.editorIconButton} compact disabled={index === activeQuestion.answers.length - 1 || isTrueFalse} onClick={() => onMoveAnswer(activeQuestion.id, answer.id, 1)}>↓</AuthoringButton>
                        <AuthoringButton
                          aria-label={t("quiz.deleteAnswer", { count: index + 1 })}
                          className={`${styles.editorDangerButton} ${styles.editorDangerIconButton}`}
                          compact
                          disabled={activeQuestion.answers.length <= 2 || isTrueFalse || questionCreditMode(activeQuestion) === "custom"}
                          onClick={() => onRemoveAnswer(activeQuestion.id, answer.id)}
                          title={t("quiz.deleteAnswer", { count: index + 1 })}
                          variant="danger"
                        >
                          <TrashIcon />
                        </AuthoringButton>
                      </div>
                    </div>
                    {isTrueFalse ? (
                      <div className={styles.fixedAnswerText}>{index === 0 ? t("quiz.true") : t("quiz.false")}</div>
                    ) : (
                      renderRichTextField({
                        ownerId: answer.id,
                        field: "textHtml",
                        html: answer.textHtml,
                        label: t("quiz.answerNumber", { count: index + 1 }, "Réponse {count}"),
                        placeholder: t("quiz.answerText"),
                        className: styles.answerRichField,
                        wrapperClassName: styles.quizRichWrapper
                      })
                    )}
                    {activeQuestion.mode === "multiple" && questionCreditMode(activeQuestion) === "custom" ? <label className={styles.creditField}>
                      <span>{t("quiz.creditPercent")}</span>
                      <input
                        key={`${answer.id}-${answer.creditPercent ?? "empty"}`}
                        defaultValue={answer.creditPercent ?? ""}
                        max={100}
                        min={-100}
                        onBlur={(event) => {
                          const value = event.currentTarget.value.trim();
                          const next = value ? withAdjustedAnswerCredit(activeQuestion, answer.id, Number(value)) : null;
                          if (next) onUpdateQuestion(activeQuestion.id, { answers: next.answers });
                          else event.currentTarget.value = String(answer.creditPercent ?? "");
                        }}
                        step="any"
                        type="number"
                      />
                    </label> : null}
                    {renderRichTextField({
                      ownerId: answer.id,
                      field: "feedbackHtml",
                      html: answer.feedbackHtml || "",
                      label: t("cardSort.feedbackTitle"),
                      placeholder: t("quiz.incorrectFeedbackPlaceholder"),
                      className: styles.richField,
                      wrapperClassName: styles.quizRichWrapper
                    })}
                  </article>
                ))}
              </div>

              {renderRichTextField({
                ownerId: activeQuestion.id,
                field: "feedbackCorrectHtml",
                html: activeQuestion.feedbackCorrectHtml || "",
                label: t("quiz.correctFeedback"),
                placeholder: t("quiz.correctFeedbackPlaceholder"),
                className: styles.richField,
                wrapperClassName: styles.quizRichWrapper
              })}
              {renderRichTextField({
                ownerId: activeQuestion.id,
                field: "feedbackIncorrectHtml",
                html: activeQuestion.feedbackIncorrectHtml || "",
                label: t("quiz.incorrectFeedback"),
                placeholder: t("quiz.incorrectFeedbackPlaceholder"),
                className: styles.richField,
                wrapperClassName: styles.quizRichWrapper
              })}
              {renderRichTextField({
                ownerId: activeQuestion.id,
                field: "generalFeedbackHtml",
                html: activeQuestion.generalFeedbackHtml || "",
                label: t("quiz.globalFeedback"),
                placeholder: t("quiz.globalFeedbackPlaceholder"),
                className: styles.richField,
                wrapperClassName: styles.quizRichWrapper
              })}
            </div>
          ) : null}

        </section>
      </div>

    </div>
  );
}
