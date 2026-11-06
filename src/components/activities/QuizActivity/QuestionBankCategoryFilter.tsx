import type { QuestionBankQuestion } from "../../../types/project";
import { useI18n } from "../../../i18n/react";
import { questionCategories, resolvedQuestionCategory, UNCATEGORIZED } from "../../../lib/questionBankFilters";

type Props = {
  questions: QuestionBankQuestion[];
  value: string;
  onChange: (value: string) => void;
};

export function QuestionBankCategoryFilter({ questions, value, onChange }: Props) {
  const { t } = useI18n();
  const categories = questionCategories(questions);
  const uncategorizedCount = questions.filter((question) => !question.category?.trim()).length;
  const currentValue = resolvedQuestionCategory(questions, value);

  return <label>
    <span>{t("questionBank.category")}</span>
    <select onChange={(event) => onChange(event.target.value)} value={currentValue}>
      <option value="">{t("questionBank.allCategories")} ({questions.length})</option>
      {categories.map((category) => <option key={category} value={category}>
        {category} ({questions.filter((question) => question.category?.trim() === category).length})
      </option>)}
      {uncategorizedCount > 0 ? <option value={UNCATEGORIZED}>{t("questionBank.withoutCategory")} ({uncategorizedCount})</option> : null}
    </select>
  </label>;
}
