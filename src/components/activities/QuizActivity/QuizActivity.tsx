import { useEffect, useMemo, useRef, useState } from "react";
import { calculateQuizResult, isQuizQuestionCorrect, questionCreditPercent, questionCreditStatus, type QuizResponseMap } from "../../../assessment";
import { SelectionCheckIcon } from "../../SelectionCheckIcon";
import { SelectionCrossIcon } from "../../SelectionCrossIcon";
import { useI18n } from "../../../i18n/react";
import styles from "./QuizActivity.module.css";
import type { QuizActivityProps } from "./types";

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

function hasQuizFeedback(value: string | null | undefined) {
  return stripHtml(value).length > 0;
}

function startLeadWithoutRepeatedTitle(html: string, title: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const first = container.firstElementChild;
  if (
    first &&
    /^(?:H[1-6]|P|DIV)$/.test(first.tagName) &&
    first.textContent?.replace(/\s+/g, " ").trim().toLocaleLowerCase() === title.replace(/\s+/g, " ").trim().toLocaleLowerCase()
  ) {
    first.remove();
    return container.innerHTML;
  }
  return html;
}

function shuffled<T>(values: T[]) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function answerHintForMode(mode: string, t: (key: string, params?: Record<string, string | number>, fallback?: string) => string) {
  return mode === "multiple"
    ? t("quiz.answerHintMultiple", undefined, "Plusieurs réponses peuvent être correctes.")
    : t("quiz.answerHintSingle", undefined, "Une seule réponse est attendue.");
}

function hasPassingThreshold(passingScore: number) {
  return Math.max(0, Number(passingScore) || 0) > 0;
}

function answerControlShape(mode: string) {
  return mode === "multiple" ? "square" : "circle";
}

function buildPresentedQuestions(quiz: QuizActivityProps["quiz"]) {
  const orderedQuestions = quiz.settings.shuffleQuestions || quiz.settings.limitQuestions
    ? shuffled(quiz.questions)
    : [...quiz.questions];
  if (!quiz.settings.limitQuestions) {
    return orderedQuestions;
  }
  const limit = Math.max(1, Math.min(orderedQuestions.length, Number(quiz.settings.questionLimit) || orderedQuestions.length));
  return orderedQuestions.slice(0, limit);
}

export function QuizActivity({ automaticTitle, authoringMode = false, blockId, quiz, onComplete, onStart, started: externallyStarted = false }: QuizActivityProps) {
  const { t } = useI18n();
  const activityRef = useRef<HTMLElement | null>(null);
  const resolvedAutomaticTitle = automaticTitle || t("activity.quiz", undefined, "Quiz");
  const storedQuizTitle = stripHtml(quiz.titleHtml);
  const quizTitle = quiz.titleMode === "custom" && storedQuizTitle ? storedQuizTitle : resolvedAutomaticTitle;
  const startLeadHtml = startLeadWithoutRepeatedTitle(quiz.startLeadHtml, quizTitle);
  const startTitleId = `${blockId}-quiz-start-title`;
  const maxAttempts = Number(quiz.settings.maxAttempts) === 0 ? 0 : Math.max(1, Number(quiz.settings.maxAttempts) || 1);
  const unlimitedAttempts = maxAttempts === 0;
  const requiresStart = true;
  const quizResetKey = useMemo(
    () => JSON.stringify({
      introHtml: quiz.introHtml,
      startLeadHtml: quiz.startLeadHtml,
      titleHtml: quiz.titleHtml,
      questions: quiz.questions,
      settings: quiz.settings
    }),
    [quiz.introHtml, quiz.startLeadHtml, quiz.titleHtml, quiz.questions, quiz.settings]
  );
  const [presentedQuestions, setPresentedQuestions] = useState(() => buildPresentedQuestions(quiz));
  const [started, setStarted] = useState(() => !requiresStart || externallyStarted);
  const [activeIndex, setActiveIndex] = useState(0);
  const [responses, setResponses] = useState<QuizResponseMap>({});
  const [validatedQuestions, setValidatedQuestions] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    setPresentedQuestions(buildPresentedQuestions(quiz));
    setStarted(externallyStarted);
    setActiveIndex(0);
    setResponses({});
    setValidatedQuestions({});
    setCompleted(false);
    setAttemptCount(0);
    setReviewOpen(false);
  }, [quizResetKey, externallyStarted]);

  const question = presentedQuestions[activeIndex] ?? null;
  const result = useMemo(() => calculateQuizResult(blockId, quiz, responses, presentedQuestions), [blockId, quiz, responses, presentedQuestions]);
  const answerOrder = useMemo(
    () =>
      Object.fromEntries(
        presentedQuestions.map((item) => [
          item.id,
          quiz.settings.shuffleAnswers ? shuffled(item.answers) : item.answers
        ])
      ),
    [presentedQuestions, quiz.settings.shuffleAnswers]
  );

  function focusQuizControl(selector: string) {
    window.setTimeout(() => {
      activityRef.current?.querySelector<HTMLElement>(selector)?.focus();
    }, 0);
  }

  function handleAnswerKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    questionId: string,
    answerId: string,
    checked: boolean,
    single: boolean
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      updateResponse(questionId, answerId, single ? true : !checked, single);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    const inputs = Array.from(
      event.currentTarget.closest(`.${styles.answers}`)?.querySelectorAll<HTMLInputElement>(`.${styles.answerInput}:not(:disabled)`) ?? []
    );
    const currentIndex = inputs.indexOf(event.currentTarget);
    if (currentIndex < 0 || inputs.length < 2) {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextInput = inputs[(currentIndex + direction + inputs.length) % inputs.length];
    nextInput.focus();
    if (single) {
      nextInput.click();
    }
  }

  function updateResponse(questionId: string, answerId: string, checked: boolean, single: boolean) {
    setResponses((current) => {
      if (single) {
        return { ...current, [questionId]: checked ? [answerId] : [] };
      }
      const currentValues = current[questionId] ?? [];
      const nextValues = checked
        ? [...currentValues, answerId]
        : currentValues.filter((value) => value !== answerId);
      return { ...current, [questionId]: nextValues };
    });
  }

  function validateCurrentQuestion() {
    if (!question) {
      return;
    }
    if (!quiz.settings.showFeedback) {
      continueQuiz();
      return;
    }
    setValidatedQuestions((current) => ({ ...current, [question.id]: true }));
    focusQuizControl(`.${styles.actions} button`);
  }

  function continueQuiz() {
    if (activeIndex + 1 >= presentedQuestions.length) {
      setAttemptCount((current) => current + 1);
      setCompleted(true);
      focusQuizControl(`.${styles.resultActions} button`);
      return;
    }
    setActiveIndex((current) => current + 1);
    focusQuizControl(`.${styles.answerInput}:not(:disabled)`);
  }

  function retryQuiz() {
    setActiveIndex(0);
    setPresentedQuestions(buildPresentedQuestions(quiz));
    setResponses({});
    setValidatedQuestions({});
    setCompleted(false);
    setReviewOpen(false);
    focusQuizControl(`.${styles.answerInput}:not(:disabled)`);
  }

  function resetQuizToStart() {
    setPresentedQuestions(buildPresentedQuestions(quiz));
    setStarted(false);
    setActiveIndex(0);
    setResponses({});
    setValidatedQuestions({});
    setCompleted(false);
    setAttemptCount(0);
    setReviewOpen(false);
  }

  function startQuiz() {
    onStart?.();
    setStarted(true);
    focusQuizControl(`.${styles.answerInput}:not(:disabled)`);
  }

  function releaseQuiz() {
    if (authoringMode) {
      resetQuizToStart();
      return;
    }
    onComplete?.(result);
  }

  function canReview() {
    if (quiz.settings.reviewMode === "after-pass") {
      return result.passed;
    }
    if (quiz.settings.reviewMode === "after-attempts") {
      return attemptCount >= Math.max(1, quiz.settings.reviewAfterAttempts || 1);
    }
    return false;
  }

  if (!presentedQuestions.length) {
    return (
      <section className={styles.activity} ref={activityRef}>
        <div className={styles.header} />
      </section>
    );
  }

  if (!started) {
    return (
      <section className={styles.activity} ref={activityRef}>
        <section aria-labelledby={startTitleId} className={styles.startPanel}>
          <div className={styles.startContent}>
            <div className={styles.startHeader}>
              <h3 className={styles.startKicker} id={startTitleId}>{quizTitle}</h3>
            </div>
            <div className={styles.startLead} dangerouslySetInnerHTML={{ __html: startLeadHtml }} />
            <dl className={styles.startMeta} aria-label={t("quiz.settingsAria", undefined, "Paramètres du quiz")}>
              <div className={styles.startMetaItem}>
                <dt className="sr-only">{t("quiz.questionCount", undefined, "Nombre de questions")}</dt>
                <dd><strong>{presentedQuestions.length}</strong> {presentedQuestions.length > 1 ? t("quiz.questionsPlural", undefined, "questions") : t("quiz.questionSingular", undefined, "question")}</dd>
              </div>
              <div className={styles.startMetaItem}>
                <dt className="sr-only">{t("quiz.maxScore", undefined, "Score maximal")}</dt>
                <dd><strong>{result.scoreMax}</strong> {result.scoreMax > 1 ? t("quiz.pointsPlural", undefined, "points") : t("quiz.pointSingular", undefined, "point")}</dd>
              </div>
              {hasPassingThreshold(quiz.settings.passingScore) ? (
                <div className={styles.startMetaItem}>
                  <dt className="sr-only">{t("quiz.passingScore", undefined, "Score de réussite (%)")}</dt>
                  <dd><strong>{quiz.settings.passingScore} %</strong> {t("quiz.required", undefined, "requis")}</dd>
                </div>
              ) : null}
              {!unlimitedAttempts ? (
                <div className={styles.startMetaItem}>
                  <dt className="sr-only">{t("quiz.maxAttempts", undefined, "Nombre de tentatives autorisées")}</dt>
                  <dd><strong>{maxAttempts}</strong> {maxAttempts > 1 ? t("quiz.attemptsPlural", undefined, "tentatives") : t("quiz.attemptSingular", undefined, "tentative")}</dd>
                </div>
              ) : null}
            </dl>
            {quiz.settings.gateChapterUntilPassed || !unlimitedAttempts ? (
              <p className={styles.startRequirement}>{t("quiz.requiredToContinue", undefined, "Cette évaluation est requise pour pouvoir continuer votre parcours.")}</p>
            ) : null}
            <div className={styles.startActions}>
              <button aria-label={t("quiz.startAccessible", undefined, "Commencer le quiz")} className={styles.primaryButton} onClick={startQuiz} type="button">
                {t("common.start", undefined, "Commencer")}
              </button>
            </div>
          </div>
        </section>
      </section>
    );
  }

  if (completed && reviewOpen) {
    return (
      <section className={styles.activity} data-quiz-result={result.passed ? "passed" : "failed"} ref={activityRef}>
        <section className={styles.reviewPanel} aria-live="polite">
          <h3>{t("quiz.review", undefined, "Relecture")}</h3>
          {presentedQuestions.map((reviewQuestion, index) => {
            const selectedAnswerIds = responses[reviewQuestion.id] ?? [];
            const questionResult = result.questions.find((item) => item.questionId === reviewQuestion.id);
            const correctAnswers = reviewQuestion.answers.filter((answer) => answer.correct);
            const selectedAnswers = reviewQuestion.answers.filter((answer) => selectedAnswerIds.includes(answer.id));
            const specificFeedbackHtml = questionResult?.correct
              ? reviewQuestion.feedbackCorrectHtml || ""
              : reviewQuestion.feedbackIncorrectHtml || "";
            const generalFeedbackHtml = reviewQuestion.generalFeedbackHtml || "";
            const showSpecificFeedback = hasQuizFeedback(specificFeedbackHtml);
            const showGeneralFeedback = hasQuizFeedback(generalFeedbackHtml);
            return (
              <article className={styles.reviewQuestion} key={reviewQuestion.id}>
                <div className={styles.questionMeta}>{t("quiz.questionProgress", { current: index + 1, total: presentedQuestions.length })}</div>
                <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: reviewQuestion.questionHtml }} />
                <dl className={styles.reviewAnswers}>
                  <div>
                    <dt>{t("quiz.yourAnswer", undefined, "Votre réponse")}</dt>
                    <dd>{selectedAnswers.length ? selectedAnswers.map((answer) => stripHtml(answer.textHtml)).join(", ") : t("quiz.noAnswer", undefined, "Aucune réponse")}</dd>
                  </div>
                  {quiz.settings.showCorrectAnswer ? (
                    <div>
                      <dt>{t("quiz.correctAnswer")}</dt>
                      <dd>{correctAnswers.map((answer) => stripHtml(answer.textHtml)).join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
                {selectedAnswers.filter((answer) => hasQuizFeedback(answer.feedbackHtml || "")).map((answer) => (
                  <div className={styles.reviewChoiceFeedback} key={answer.id}>
                    <strong>{stripHtml(answer.textHtml)}</strong>
                    <div dangerouslySetInnerHTML={{ __html: answer.feedbackHtml || "" }} />
                  </div>
                ))}
                {questionCreditStatus(reviewQuestion) === "active" ? <p className={styles.creditResult}>
                  {t("quiz.creditResult", { percent: Number(questionCreditPercent(reviewQuestion, selectedAnswerIds).toFixed(2)) })}
                </p> : null}
                {showSpecificFeedback ? (
                  <div
                    className={questionResult?.correct ? styles.feedbackCorrect : styles.feedbackIncorrect}
                    dangerouslySetInnerHTML={{ __html: specificFeedbackHtml }}
                  />
                ) : null}
                {showGeneralFeedback ? (
                  <div className={styles.generalFeedbackSection}>
                    <p className={styles.generalFeedbackLabel}>{t("quiz.keyTakeaway", undefined, "À retenir :")}</p>
                    <div dangerouslySetInnerHTML={{ __html: generalFeedbackHtml }} />
                  </div>
                ) : null}
              </article>
            );
          })}
          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={() => setReviewOpen(false)} type="button">
              {t("quiz.finishReview", undefined, "Terminer la relecture")}
            </button>
          </div>
        </section>
      </section>
    );
  }

  if (completed) {
    const attemptsExhausted = !unlimitedAttempts && attemptCount >= maxAttempts;
    const canRetry = !result.passed && (unlimitedAttempts || !attemptsExhausted);
    const correctQuestionCount = result.questions.filter((item) => item.correct).length;
    const hasPartialCredit = presentedQuestions.some((item) => questionCreditStatus(item) === "active");
    const canRelease =
      authoringMode ||
      result.passed ||
      attemptsExhausted ||
      (unlimitedAttempts && !quiz.settings.gateChapterUntilPassed);
    const reviewUnlocked = result.passed || attemptsExhausted || (unlimitedAttempts && !quiz.settings.gateChapterUntilPassed);
    const resultMessage = result.passed
      ? t("quiz.resultPassed", undefined, "Vous avez répondu avec succès à ce questionnaire")
      : t("quiz.resultFailed", undefined, "Vous n'avez pas atteint le seuil de réussite de ce questionnaire");
    return (
      <section className={styles.activity} data-quiz-result={result.passed ? "passed" : "failed"} ref={activityRef}>
        <div className={styles.resultPanel} aria-live="polite">
          <span className={styles.startKicker}>{quizTitle}</span>
          <strong>{resultMessage}</strong>
          <span>{hasPartialCredit
            ? t("quiz.resultPoints", { earned: Number(result.scoreRaw.toFixed(2)), total: result.scoreMax, percent: result.scorePercent })
            : t("quiz.resultScore", { correct: correctQuestionCount, total: presentedQuestions.length, percent: result.scorePercent }, "Votre résultat : {correct} questions correctes / {total} ({percent} %)")}</span>
          {!result.passed && attemptsExhausted ? (
            <span>
              {quiz.settings.sendScoreToLms
                ? t("quiz.finalFailureScoreSent", undefined, "Vous n’avez pas atteint le seuil de réussite et vous avez utilisé toutes vos tentatives. Vous pouvez poursuivre le cours. Votre résultat a été transmis.")
                : t("quiz.finalFailureCanContinue", undefined, "Vous n’avez pas atteint le seuil de réussite et vous avez utilisé toutes vos tentatives. Vous pouvez poursuivre le cours.")}
            </span>
          ) : null}
          <div className={styles.resultActions}>
            {canRetry ? (
              <button className={styles.secondaryButton} onClick={retryQuiz} type="button">
                {t("quiz.retry", undefined, "Recommencer")}
              </button>
            ) : null}
            {canReview() && reviewUnlocked ? (
              <button className={styles.secondaryButton} onClick={() => setReviewOpen(true)} type="button">
                {t("quiz.reviewAnswers", undefined, "Relire mes réponses")}
              </button>
            ) : null}
            {canRelease ? (
              <button className={styles.primaryButton} onClick={releaseQuiz} type="button">
                {t("common.continue", undefined, "Continuer")}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (!question) {
    return null;
  }

  const isValidated = Boolean(validatedQuestions[question.id]);
  const selected = responses[question.id] ?? [];
  const isSingle = question.mode === "single" || question.mode === "true-false";
  const correct = isQuizQuestionCorrect(question, selected);
  const partialCreditActive = questionCreditStatus(question) === "active";
  const selectedName = `${blockId}-${question.id}`;
  const feedbackHtml = correct ? question.feedbackCorrectHtml || "" : question.feedbackIncorrectHtml || "";
  const showFeedbackPanel = isValidated && quiz.settings.showFeedback && hasQuizFeedback(feedbackHtml);

  return (
    <section className={styles.activity} ref={activityRef}>
      <article className={styles.questionCard}>
        <div className={styles.questionMeta}>
          {t("quiz.questionProgress", { current: activeIndex + 1, total: presentedQuestions.length }, "Question {current} / {total}")}
        </div>
        <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: question.questionHtml }} />
        <p className={styles.answerHint}>{answerHintForMode(question.mode, t)}</p>
        <div className={styles.answers}>
          {(answerOrder[question.id] ?? question.answers).map((answer) => {
            const checked = selected.includes(answer.id);
            const selectedCorrect = partialCreditActive ? answer.correct : correct;
            const controlShapeClassName =
              answerControlShape(question.mode) === "square"
                ? styles.answerControlSquare
                : styles.answerControlCircle;
            const controlStateClassName =
              isValidated && checked
                ? selectedCorrect
                  ? styles.answerControlCorrect
                  : styles.answerControlIncorrect
                : checked
                  ? styles.answerControlSelected
                  : "";
            const selectedStateClassName =
              isValidated && checked
                ? selectedCorrect
                  ? styles.correctAnswer
                  : styles.incorrectAnswer
                : "";
            return (
              <label
                className={`${styles.answer} ${selectedStateClassName}`}
                key={answer.id}
              >
                <input
                  className={styles.answerInput}
                  checked={checked}
                  disabled={isValidated}
                  name={selectedName}
                  onChange={(event) => updateResponse(question.id, answer.id, event.target.checked, isSingle)}
                  onKeyDown={(event) => handleAnswerKeyDown(event, question.id, answer.id, checked, isSingle)}
                  type={isSingle ? "radio" : "checkbox"}
                />
                <span
                  aria-hidden="true"
                  className={`${styles.answerControl} ${controlShapeClassName} ${controlStateClassName}`}
                >
                  {isValidated && checked ? (
                    selectedCorrect ? (
                      <SelectionCheckIcon className={styles.answerControlIcon} />
                    ) : (
                      <SelectionCrossIcon className={styles.answerControlIcon} />
                    )
                  ) : !isValidated && checked && answerControlShape(question.mode) === "square" ? (
                    <SelectionCheckIcon className={styles.answerControlIcon} />
                  ) : (
                    <span className={styles.answerControlIndicator} />
                  )}
                </span>
                <span
                  className={styles.answerText}
                  dangerouslySetInnerHTML={{ __html: answer.textHtml }}
                />
                {isValidated && quiz.settings.showFeedback && checked && hasQuizFeedback(answer.feedbackHtml || "") ? (
                  <span className={styles.answerFeedback} dangerouslySetInnerHTML={{ __html: answer.feedbackHtml || "" }} />
                ) : null}
              </label>
            );
          })}
        </div>

        {isValidated && partialCreditActive ? <p className={styles.creditResult}>
          {t("quiz.creditResult", { percent: Number(questionCreditPercent(question, selected).toFixed(2)) })}
        </p> : null}

        {showFeedbackPanel ? (
          <div
            aria-live="polite"
            className={correct ? styles.feedbackCorrect : styles.feedbackIncorrect}
            dangerouslySetInnerHTML={{ __html: feedbackHtml }}
          />
        ) : null}

        <div className={styles.actions}>
          {isValidated ? (
            <button className={styles.primaryButton} onClick={continueQuiz} type="button">
              {activeIndex + 1 >= presentedQuestions.length
                ? t("quiz.showResult", undefined, "Voir le résultat")
                : t("common.continue", undefined, "Continuer")}
            </button>
          ) : (
            <button className={styles.primaryButton} disabled={!selected.length} onClick={validateCurrentQuestion} type="button">
              {t("common.validate", undefined, "Valider")}
            </button>
          )}
        </div>
      </article>
    </section>
  );
}
