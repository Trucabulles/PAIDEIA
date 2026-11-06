import type { ReactNode } from "react";
import type { QuizActivityData, QuizAnswer, QuizQuestion } from "../../../assessment";
import type { QuestionBankResource } from "../../../types/project";
import { QuizActivityEditor } from "./QuizActivityEditor";
import { createDefaultQuizQuestion } from "./quizDefaults";
import { questionCreditMode } from "../../../assessment/assessmentEngine";
import type { QuizRichTextFieldParams } from "./types";

type QuizActivityEditorPanelProps = {
  automaticTitle: string;
  quiz: QuizActivityData;
  questionBanks: QuestionBankResource[];
  onImportQuestionsFromBank: (bankId: string, questionIds: string[]) => Promise<void>;
  onQuizChange: (updater: (quiz: QuizActivityData) => QuizActivityData) => void;
  onToggleSendScoreToLms: (checked: boolean) => void;
  renderRichTextField: (params: QuizRichTextFieldParams) => ReactNode;
};

export function QuizActivityEditorPanel({
  automaticTitle,
  quiz,
  questionBanks,
  onImportQuestionsFromBank,
  onQuizChange,
  onToggleSendScoreToLms,
  renderRichTextField
}: QuizActivityEditorPanelProps) {
  function updateQuestion(questionId: string, patch: Partial<QuizQuestion>) {
    onQuizChange((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      )
    }));
  }

  function updateAnswer(questionId: string, answerId: string, patch: Partial<QuizAnswer>) {
    onQuizChange((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answers: question.answers.map((answer) =>
                answer.id === answerId ? { ...answer, ...patch } : answer
              )
            }
          : question
      )
    }));
  }

  function addQuestion() {
    onQuizChange((current) => ({
      ...current,
      questions: [...current.questions, createDefaultQuizQuestion("single")]
    }));
  }

  function removeQuestion(questionId: string) {
    onQuizChange((current) => ({
      ...current,
      questions:
        current.questions.length <= 1
          ? current.questions
          : current.questions.filter((question) => question.id !== questionId)
    }));
  }

  function duplicateQuestion(questionId: string) {
    onQuizChange((current) => {
      const index = current.questions.findIndex((question) => question.id === questionId);
      if (index < 0) {
        return current;
      }
      const source = current.questions[index];
      const copy: QuizQuestion = {
        ...source,
        id: `question_${Date.now()}`,
        answers: source.answers.map((answer, answerIndex) => ({
          ...answer,
          id: `answer_${Date.now()}_${answerIndex + 1}`
        }))
      };
      const questions = [...current.questions];
      questions.splice(index + 1, 0, copy);
      return { ...current, questions };
    });
  }

  function moveQuestion(questionId: string, direction: -1 | 1) {
    onQuizChange((current) => {
      const index = current.questions.findIndex((question) => question.id === questionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.questions.length) {
        return current;
      }
      const questions = [...current.questions];
      const [question] = questions.splice(index, 1);
      questions.splice(nextIndex, 0, question);
      return { ...current, questions };
    });
  }

  function addAnswer(questionId: string) {
    onQuizChange((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answers: [
                ...question.answers,
                { id: `answer_${Date.now()}`, textHtml: "<p></p>", correct: false, creditPercent: questionCreditMode(question) === "custom" ? 0 : null }
              ]
            }
          : question
      )
    }));
  }

  function removeAnswer(questionId: string, answerId: string) {
    onQuizChange((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId && question.answers.length > 2 && questionCreditMode(question) !== "custom"
          ? { ...question, answers: question.answers.filter((answer) => answer.id !== answerId) }
          : question
      )
    }));
  }

  function moveAnswer(questionId: string, answerId: string, direction: -1 | 1) {
    onQuizChange((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }
        const index = question.answers.findIndex((answer) => answer.id === answerId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= question.answers.length) {
          return question;
        }
        const answers = [...question.answers];
        const [answer] = answers.splice(index, 1);
        answers.splice(nextIndex, 0, answer);
        return { ...question, answers };
      })
    }));
  }

  function setAnswerCorrect(questionId: string, answerId: string, correct: boolean) {
    onQuizChange((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }
        if (questionCreditMode(question) === "custom") return question;
        const answers = question.answers.map((answer) => {
          if (question.mode === "multiple") {
            return answer.id === answerId ? { ...answer, correct } : answer;
          }
          return { ...answer, correct: answer.id === answerId };
        });
        return { ...question, answers };
      })
    }));
  }

  function updateQuiz(patch: Partial<QuizActivityData>) {
    onQuizChange((current) => ({
      ...current,
      ...patch,
      settings: patch.settings ? { ...current.settings, ...patch.settings } : current.settings
    }));
  }

  return (
    <div className="inspector-span-2">
      <QuizActivityEditor
        automaticTitle={automaticTitle}
        quiz={quiz}
        questionBanks={questionBanks}
        onAddAnswer={addAnswer}
        onAddQuestion={addQuestion}
        onDuplicateQuestion={duplicateQuestion}
        onImportQuestionsFromBank={onImportQuestionsFromBank}
        onMoveAnswer={moveAnswer}
        onMoveQuestion={moveQuestion}
        onRemoveAnswer={removeAnswer}
        onRemoveQuestion={removeQuestion}
        onSetAnswerCorrect={setAnswerCorrect}
        onToggleSendScoreToLms={onToggleSendScoreToLms}
        onUpdateAnswer={updateAnswer}
        onUpdateQuestion={updateQuestion}
        onUpdateQuiz={updateQuiz}
        renderRichTextField={renderRichTextField}
      />
    </div>
  );
}
