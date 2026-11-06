import { useState, type ReactNode } from "react";
import { useI18n } from "../../../i18n/react";
import type { MatchingActivityData, MatchingPair } from "../../../types/project";
import { createDefaultMatchingPair } from "./matchingDefaults";
import styles from "./MatchingActivity.module.css";

export type MatchingRichField = "leftHtml" | "rightHtml" | "successFeedbackHtml" | "failureFeedbackHtml";
export const MATCHING_CARD_MAX_WIDTH_PX = 390;
export const MATCHING_CARD_MAX_LINES = 3;
export function isMatchingCardRichField(field: MatchingRichField) { return field === "leftHtml" || field === "rightHtml"; }

type RichTextParams = {
  className?: string;
  field: MatchingRichField;
  html: string;
  pair?: MatchingPair;
  label: string;
  placeholder: string;
  showInlineImage?: boolean;
};

type Props = {
  data: MatchingActivityData;
  onChange: (updater: (current: MatchingActivityData) => MatchingActivityData) => void;
  renderRichTextField: (params: RichTextParams) => ReactNode;
};

function TrashIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg>; }

export function MatchingActivityEditor({ data, onChange, renderRichTextField }: Props) {
  const { t } = useI18n();
  const [openPairs, setOpenPairs] = useState<string[]>([]);
  const attemptsUnlimited = data.maxAttempts === 0;
  const showAttemptFeedback = (data as MatchingActivityData & { showAttemptFeedback?: boolean }).showAttemptFeedback ?? true;

  return <section className={styles.editor}>
    <details className={styles.editorSection}>
      <summary>{t("matching.settings", undefined, "Paramètres de l’activité")}</summary>
      <div className={styles.editorGrid}>
        <label className={`${styles.editorCheckboxLabel} ${styles.editorSpanFull}`}><input checked={attemptsUnlimited} onChange={(event) => onChange((current) => ({ ...current, maxAttempts: event.target.checked ? 0 : 3, successThreshold: 100 }))} type="checkbox" /> <span>{t("matching.unlimitedAttempts", undefined, "Tentatives illimitées")}</span></label>
        {!attemptsUnlimited ? <label>{t("matching.maxAttempts", undefined, "Nombre maximal d’essais")}<input max="10" min="1" onChange={(event) => onChange((current) => ({ ...current, maxAttempts: Math.max(1, Math.min(10, Number(event.target.value) || 1)), successThreshold: 100 }))} type="number" value={data.maxAttempts} /></label> : null}
        <label className={`${styles.editorCheckboxLabel} ${styles.editorSpanFull}`}><input checked={showAttemptFeedback} onChange={(event) => onChange((current) => ({ ...current, showAttemptFeedback: event.target.checked, successThreshold: 100 } as MatchingActivityData))} type="checkbox" /> <span>{t("matching.showAttemptFeedback", undefined, "Activer le feedback après la tentative")}</span></label>
      </div>
    </details>

    <section className={styles.editorSection}>
      <header className={styles.editorHeader}><strong>{t("matching.pairs", undefined, "Paires")}</strong><button disabled={data.pairs.length >= 10} onClick={() => onChange((current) => ({ ...current, pairs: [...current.pairs, createDefaultMatchingPair(current.pairs.length + 1)] }))} type="button">{t("matching.addPair", undefined, "Ajouter une paire")}</button></header>
      <span className={styles.editorHint}>{t("matching.pairLimit", undefined, "2 à 10 paires")}</span>
      {data.pairs.map((pair, index) => {
        const open = openPairs.includes(pair.id);
        return <article className={styles.pairEditor} key={pair.id}><header>
          <button aria-expanded={open} className={styles.pairToggle} onClick={() => setOpenPairs((current) => open ? current.filter((id) => id !== pair.id) : [...current, pair.id])} type="button"><span>{open ? "⌄" : "›"}</span><strong>{t("matching.pair", { index: index + 1 }, "Paire {index}")}</strong></button>
          <button aria-label={t("matching.deletePair", undefined, "Supprimer la paire")} className={styles.deleteButton} disabled={data.pairs.length <= 2} onClick={() => onChange((current) => ({ ...current, pairs: current.pairs.filter((item) => item.id !== pair.id) }))} type="button"><TrashIcon /></button>
        </header>{open ? <div className={styles.pairBody}>
          <div className={styles.cardRichField}>{renderRichTextField({ className: styles.cardRichField, field: "leftHtml", html: pair.leftHtml, pair, label: t("matching.leftElement", undefined, "Élément de gauche"), placeholder: t("matching.leftPlaceholder", undefined, "Saisissez l’élément"), showInlineImage: false })}</div>
          <div className={styles.cardRichField}>{renderRichTextField({ className: styles.cardRichField, field: "rightHtml", html: pair.rightHtml, pair, label: t("matching.rightElement", undefined, "Élément de droite"), placeholder: t("matching.rightPlaceholder", undefined, "Saisissez la correspondance"), showInlineImage: false })}</div>
        </div> : null}</article>;
      })}
    </section>

    <details className={styles.editorSection}><summary>{t("matching.feedback", undefined, "Feedback pédagogique")}</summary><div className={styles.pairBody}>{renderRichTextField({ className: styles.feedbackRichField, field: "successFeedbackHtml", html: data.successFeedbackHtml, label: t("matching.successFeedback", undefined, "Après réussite"), placeholder: "" })}{renderRichTextField({ className: styles.feedbackRichField, field: "failureFeedbackHtml", html: data.failureFeedbackHtml, label: t("matching.failureFeedback", undefined, "Après échec"), placeholder: "" })}</div></details>
  </section>;
}
