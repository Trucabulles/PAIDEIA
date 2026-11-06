import { useEffect, useState } from "react";
import { isQuizQuestionCorrect, questionCreditPercent, questionCreditStatus } from "../../../assessment";
import type { QuizActivityData, QuizQuestionMode } from "../../../assessment";
import { SelectionCheckIcon } from "../../SelectionCheckIcon";
import { SelectionCrossIcon } from "../../SelectionCrossIcon";
import { useI18n } from "../../../i18n/react";
import styles from "./QuizActivity.module.css";

type Props = {
  blockId: string;
  quiz: QuizActivityData;
  mode: QuizQuestionMode;
  progress?: { current: number; total: number };
  onContinue?: () => void;
};

export function StandaloneQuestion({ blockId, quiz, mode, progress, onContinue }: Props) {
  const { t } = useI18n();
  const question = quiz.questions[0];
  const [selected, setSelected] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [validated, setValidated] = useState(false);
  useEffect(() => {
    setSelected([]);
    setAttempts(0);
    setValidated(false);
  }, [blockId, question?.id]);
  if (!question) return null;
  const correct = isQuizQuestionCorrect(question, selected);
  const partialCreditActive = questionCreditStatus(question) === "active";
  const maxAttempts = Math.max(0, Number(quiz.settings.maxAttempts) || 0);
  const canRetry = validated && !correct && (maxAttempts === 0 || attempts < maxAttempts);
  const showCorrectness = quiz.settings.showCorrectness !== false;
  const feedback = (correct ? question.feedbackCorrectHtml : question.feedbackIncorrectHtml) || question.generalFeedbackHtml;

  return (
    <section className={styles.activity} data-standalone-question={mode}>
      <article className={styles.questionCard}>
        {progress ? <div className={styles.questionMeta}>{t("quiz.questionProgress", progress, "Question {current} / {total}")}</div> : null}
        <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: question.questionHtml }} />
        <p className={styles.answerHint}>{mode === "multiple" ? t("quiz.answerHintMultiple", undefined, "Plusieurs réponses peuvent être correctes.") : t("quiz.answerHintSingle", undefined, "Une seule réponse est attendue.")}</p>
        <div className={styles.answers}>
          {question.answers.map((answer) => {
            const checked = selected.includes(answer.id);
            const showSelectionResult = validated && checked && showCorrectness;
            const selectedCorrect = partialCreditActive ? answer.correct : correct;
            const controlState = showSelectionResult
              ? selectedCorrect ? styles.answerControlCorrect : styles.answerControlIncorrect
              : checked ? styles.answerControlSelected : "";
            return <label className={`${styles.answer} ${showSelectionResult ? selectedCorrect ? styles.correctAnswer : styles.incorrectAnswer : ""}`} key={answer.id}>
              <input
                className={styles.answerInput}
                checked={checked}
                disabled={validated}
                name={`${blockId}-${question.id}`}
                onChange={(event) => setSelected((current) => mode === "multiple"
                  ? event.target.checked ? [...current, answer.id] : current.filter((id) => id !== answer.id)
                  : [answer.id])}
                type={mode === "multiple" ? "checkbox" : "radio"}
              />
              <span aria-hidden="true" className={`${styles.answerControl} ${mode === "multiple" ? styles.answerControlSquare : styles.answerControlCircle} ${controlState}`}>
                {showSelectionResult ? (
                  selectedCorrect ? <SelectionCheckIcon className={styles.answerControlIcon} /> : <SelectionCrossIcon className={styles.answerControlIcon} />
                ) : checked && mode === "multiple" ? (
                  <SelectionCheckIcon className={styles.answerControlIcon} />
                ) : <span className={styles.answerControlIndicator} />}
              </span>
              <span className={styles.answerText} dangerouslySetInnerHTML={{ __html: answer.textHtml }} />
              {validated && quiz.settings.showFeedback && checked && answer.feedbackHtml?.trim() ? (
                <span className={styles.answerFeedback} dangerouslySetInnerHTML={{ __html: answer.feedbackHtml }} />
              ) : null}
            </label>;
          })}
        </div>
        {validated && partialCreditActive ? <p className={styles.creditResult}>
          {t("quiz.creditResult", { percent: Number(questionCreditPercent(question, selected).toFixed(2)) })}
        </p> : null}
        {validated && showCorrectness ? <span className="sr-only" role="status">{correct ? t("quiz.correctAnswer", undefined, "Réponse correcte") : t("quiz.incorrectAnswer", undefined, "Réponse incorrecte")}</span> : null}
        {validated && quiz.settings.showCorrectAnswer ? (
          <div className={styles.feedbackCorrect}>
            <strong>{t("quiz.correctAnswer", undefined, "Bonne réponse")}</strong>
            <ul>{question.answers.filter((answer) => answer.correct).map((answer) => <li key={answer.id} dangerouslySetInnerHTML={{ __html: answer.textHtml }} />)}</ul>
          </div>
        ) : null}
        {validated && quiz.settings.showFeedback && feedback?.trim() ? (
          <div className={correct ? styles.feedbackCorrect : styles.feedbackIncorrect} dangerouslySetInnerHTML={{ __html: feedback }} />
        ) : null}
        <div className={styles.actions}>
          {!validated ? <button className={styles.primaryButton} disabled={selected.length === 0} onClick={() => { setAttempts((value) => value + 1); setValidated(true); }} type="button">{t("common.validate", undefined, "Valider")}</button> : null}
          {canRetry ? <button className={styles.primaryButton} onClick={() => { setValidated(false); setSelected([]); }} type="button">{t("quiz.retry", undefined, "Réessayer")}</button> : null}
          {validated && onContinue ? <button className={styles.primaryButton} onClick={onContinue} type="button">{t("common.continue", undefined, "Continuer")}</button> : null}
        </div>
      </article>
    </section>
  );
}
