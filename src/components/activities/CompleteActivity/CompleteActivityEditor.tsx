import { useEffect, useRef, useState } from "react";
import type { CompleteBlank, CompleteExercise } from "../../../types/project";
import { normalizePastedRichTextHtml } from "../../../app/richTextSanitizer";
import { useI18n } from "../../../i18n/react";
import { TrashIcon } from "../../authoring";
import { ColorPickerField } from "../../color-picker/ColorPickerPopover";
import {
  completeAttemptsUnlimited,
  completeBlankMarker,
  completeCoverBackgroundColor,
  completeCoverWithBackgroundColor,
  completeDocumentExercise,
  completeResponseKindsById,
  createCompleteBlank,
  type CompleteResponseKind
} from "./completeDefaults";
import styles from "./CompleteActivity.module.css";
import type { CompleteActivityEditorProps } from "./completeTypes";

function detachBlankMarker(marker: HTMLElement) {
  // Keep the span: typography may have been applied directly to the marker.
  marker.removeAttribute("data-paideia-complete-id");
  marker.removeAttribute("data-paideia-complete-kind");
  marker.removeAttribute("contenteditable");
}

function orderBlanksByAppearance(exercise: CompleteExercise): CompleteExercise {
  const documentNode = new DOMParser().parseFromString(exercise.contentHtml || "<p></p>", "text/html");
  const blanksById = new Map(exercise.blanks.map((blank) => [blank.id, blank]));
  const orderedBlanks: CompleteBlank[] = [];
  const usedIds = new Set<string>();

  documentNode.body.querySelectorAll<HTMLElement>("[data-paideia-complete-id]").forEach((marker, markerIndex) => {
    const markerId = marker.dataset.paideiaCompleteId ?? "";
    const configuredBlank = blanksById.get(markerId);

    // A stale marker without configuration must never survive as a phantom answer.
    if (!configuredBlank) {
      detachBlankMarker(marker);
      return;
    }

    // Duplicate markers become text; original fields retain their ids.
    if (usedIds.has(markerId)) {
      detachBlankMarker(marker);
      return;
    }

    usedIds.add(markerId);
    orderedBlanks.push(configuredBlank);
  });

  return {
    ...exercise,
    contentHtml: documentNode.body.innerHTML || "<p></p>",
    blanks: orderedBlanks
  };
}

function removeBlankFromDocument(exercise: CompleteExercise, blankId: string): CompleteExercise {
  const documentNode = new DOMParser().parseFromString(exercise.contentHtml || "<p></p>", "text/html");
  documentNode.body.querySelectorAll<HTMLElement>("[data-paideia-complete-id]").forEach((marker) => {
    if (marker.dataset.paideiaCompleteId === blankId) detachBlankMarker(marker);
  });
  return orderBlanksByAppearance({
    ...exercise,
    contentHtml: documentNode.body.innerHTML || "<p></p>",
    blanks: exercise.blanks.filter((blank) => blank.id !== blankId)
  });
}

function CompleteDocumentEditor({
  exercise,
  onBlankCreated,
  onChange,
  renderRichTextField
}: {
  exercise: CompleteExercise;
  onBlankCreated: (blankId: string) => void;
  onChange: (next: CompleteExercise) => void;
  renderRichTextField: CompleteActivityEditorProps["renderContentRichTextField"];
}) {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [selectionError, setSelectionError] = useState(false);

  const useSelection = (kind: CompleteResponseKind) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount !== 1) { setSelectionError(true); return; }
    const range = selection.getRangeAt(0);
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) { setSelectionError(true); return; }
    const answer = selection.toString();
    if (!answer.trim()) { setSelectionError(true); return; }

    const blank = createCompleteBlank(exercise.blanks.length + 1, answer);
    const wrapper = document.createElement("div");
    wrapper.appendChild(range.cloneContents());
    const marker = document.createRange().createContextualFragment(completeBlankMarker(blank.id, wrapper.innerHTML, kind));
    range.deleteContents();
    range.insertNode(marker);
    selection.removeAllRanges();

    const nextExercise = orderBlanksByAppearance({
      ...exercise,
      contentHtml: editor.innerHTML || "<p></p>",
      blanks: [...exercise.blanks, blank]
    });
    editor.innerHTML = nextExercise.contentHtml || "<p></p>";
    onChange(nextExercise);
    onBlankCreated(blank.id);
    setSelectionError(false);
  };

  const controls = <aside className={styles.selectionTools}>
    <div className={styles.selectionToolsSticky}>
      <button onMouseDown={(event) => event.preventDefault()} onClick={() => useSelection("text")} type="button">{t("complete.useSelectionAsAnswer", undefined, "Mot manquant")}</button>
      <button onMouseDown={(event) => event.preventDefault()} onClick={() => useSelection("list")} type="button">{t("complete.useSelectionAsList", undefined, "Liste")}</button>
      {selectionError ? <span className={styles.selectionHint}>{t("complete.selectTextFirst", undefined, "Sélectionnez d’abord le texte qui constitue la réponse.")}</span> : null}
    </div>
  </aside>;

  return <div className={styles.documentEditorWorkspace}
    onCopyCapture={(event) => {
      const editor = editorRef.current;
      const selection = editor?.ownerDocument.getSelection();
      if (!editor || !selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      const host = editor.ownerDocument.createElement("div");
      host.appendChild(range.cloneContents());
      const markers = host.querySelectorAll<HTMLElement>("[data-paideia-complete-id]");
      if (!markers.length) return;
      markers.forEach((marker) => {
        const original = Array.from(editor.querySelectorAll<HTMLElement>("[data-paideia-complete-id]")).find((node) => node.dataset.paideiaCompleteId === marker.dataset.paideiaCompleteId);
        if (original) {
          const computed = editor.ownerDocument.defaultView!.getComputedStyle(original);
          marker.style.fontFamily = computed.fontFamily;
          marker.style.fontSize = computed.fontSize;
          marker.style.fontWeight = computed.fontWeight;
          marker.style.fontStyle = computed.fontStyle;
          marker.style.lineHeight = computed.lineHeight;
        }
        detachBlankMarker(marker);
      });
      const contextElement = range.commonAncestorContainer instanceof HTMLElement ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      if (contextElement) {
        const computed = editor.ownerDocument.defaultView!.getComputedStyle(contextElement);
        const context = editor.ownerDocument.createElement("span");
        context.style.fontFamily = computed.fontFamily;
        context.style.fontSize = computed.fontSize;
        context.style.fontWeight = computed.fontWeight;
        context.style.fontStyle = computed.fontStyle;
        context.append(...Array.from(host.childNodes));
        host.appendChild(context);
      }
      event.clipboardData.setData("text/html", host.innerHTML);
      event.clipboardData.setData("text/plain", selection.toString());
      event.preventDefault();
    }}
    onPasteCapture={(event) => {
      const editor = editorRef.current;
      const html = event.clipboardData.getData("text/html");
      if (!editor || !editor.contains(event.target as Node) || !html.includes("data-paideia-complete-id")) return;
      const host = editor.ownerDocument.createElement("div");
      host.innerHTML = html;
      host.querySelectorAll<HTMLElement>("[data-paideia-complete-id]").forEach(detachBlankMarker);
      host.querySelectorAll("img,picture,svg,canvas").forEach((node) => node.remove());
      const sanitized = normalizePastedRichTextHtml(host.innerHTML);
      event.preventDefault();
      event.stopPropagation();
      editor.focus({ preventScroll: true });
      editor.ownerDocument.execCommand("insertHTML", false, sanitized);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }}>
    <div className={styles.documentEditorCanvas}>
      {renderRichTextField({
        className: `${styles.richEditor} ${styles.documentRichEditor} rich-content`,
        controls,
        exerciseId: exercise.id,
        html: exercise.contentHtml || "<p></p>",
        onCommit: (contentHtml) => onChange(orderBlanksByAppearance({ ...exercise, contentHtml })),
        onEditorChange: (editor) => { editorRef.current = editor; },
        placeholder: ""
      })}
    </div>
  </div>;
}

export function CompleteActivityEditor({ coverMediaEditor, data, onDataChange, renderContentRichTextField, renderCoverRichTextField }: CompleteActivityEditorProps) {
  const { t } = useI18n();
  const documentExercise = completeDocumentExercise(data);
  const responseKinds = completeResponseKindsById(documentExercise.contentHtml);
  const attemptsUnlimited = completeAttemptsUnlimited(data);
  const [openBlankId, setOpenBlankId] = useState<string | null>(null);
  const [lastLimitedAttempts, setLastLimitedAttempts] = useState(() => data.maxAttempts > 0 ? data.maxAttempts : 3);

  useEffect(() => {
    if (data.maxAttempts > 0) setLastLimitedAttempts(data.maxAttempts);
  }, [data.maxAttempts]);

  const updateDocument = (exercise: CompleteExercise) => {
    const normalized = orderBlanksByAppearance(exercise);
    onDataChange((current) => ({ ...current, exercises: [normalized] }));
  };
  const deleteBlank = (blankId: string) => {
    updateDocument(removeBlankFromDocument(documentExercise, blankId));
    setOpenBlankId((current) => current === blankId ? null : current);
  };

  return <section className={styles.editor}>
    <details className={styles.coverSettings}><summary>{t("complete.cover", undefined, "Couverture")}</summary><div className={styles.settingsGrid}>
      <label className={styles.checkbox}><input checked={data.cover.enabled} onChange={(event) => onDataChange((current) => ({ ...current, cover: { ...current.cover, enabled: event.target.checked } }))} type="checkbox" />{t("complete.showCover", undefined, "Afficher la couverture")}</label>
      <label><span>{t("editor.backgroundColor", undefined, "Couleur de fond")}</span><ColorPickerField ariaLabel={t("editor.backgroundColor", undefined, "Couleur de fond")} onChange={(backgroundColor) => onDataChange((current) => ({ ...current, cover: completeCoverWithBackgroundColor(current.cover, backgroundColor) }))} value={completeCoverBackgroundColor(data)} /></label>
      {renderCoverRichTextField({ field: "titleHtml", html: data.cover.titleHtml, label: t("complete.coverTitle", undefined, "Titre de la couverture"), placeholder: t("complete.coverTitle", undefined, "Titre de la couverture") })}
      {renderCoverRichTextField({ field: "descriptionHtml", html: data.cover.descriptionHtml, label: t("complete.coverDescription", undefined, "Texte explicatif"), placeholder: t("complete.coverDescription", undefined, "Texte explicatif") })}
    </div>{coverMediaEditor}</details>

    <details className={styles.settings}><summary>{t("complete.generalSettings", undefined, "Paramètres de l’activité")}</summary><div className={styles.settingsGrid}>
      <div className={styles.orientationField}>
        <span>{t("complete.orientation", undefined, "Orientation")}</span>
        <div className={styles.orientationSelector} role="group" aria-label={t("complete.orientation", undefined, "Orientation")}>
          {(["portrait", "landscape"] as const).map((orientation) => <button key={orientation} type="button" aria-pressed={(data.orientation ?? "portrait") === orientation} onClick={() => onDataChange((current) => ({ ...current, orientation }))}>
            {t(`complete.orientation.${orientation}`, undefined, orientation === "portrait" ? "Portrait" : "Paysage")}
          </button>)}
        </div>
      </div>
      <label className={`${styles.checkbox} ${styles.settingsWide}`}><input checked={attemptsUnlimited} onChange={(event) => onDataChange((current) => ({ ...current, maxAttempts: event.target.checked ? 0 : Math.max(1, Math.min(10, lastLimitedAttempts || 3)) }))} type="checkbox" />{t("complete.unlimitedAttempts", undefined, "Tentatives illimitées")}</label>
      {!attemptsUnlimited ? <label>{t("complete.maxAttempts", undefined, "Nombre maximal d’essais")}<input max="10" min="1" onChange={(event) => { const maxAttempts = Math.max(1, Math.min(10, Number(event.target.value) || 1)); setLastLimitedAttempts(maxAttempts); onDataChange((current) => ({ ...current, maxAttempts })); }} type="number" value={data.maxAttempts} /></label> : null}
      <label className={`${styles.checkbox} ${styles.settingsWide}`}><input checked={Boolean(data.revealAnswersOnFinalReview)} onChange={(event) => onDataChange((current) => ({ ...current, revealAnswersOnFinalReview: event.target.checked }))} type="checkbox" />{t("complete.revealAnswersOnFinalReview", undefined, "Dévoiler les réponses à la dernière relecture")}</label>
      <label>{t("complete.successThreshold", undefined, "Seuil de réussite (%)")}<input max="100" min="0" onChange={(event) => onDataChange((current) => ({ ...current, successThreshold: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }))} type="number" value={data.successThreshold} /></label>
    </div></details>

    <section className={styles.documentEditorSection}>
      <CompleteDocumentEditor exercise={documentExercise} onBlankCreated={setOpenBlankId} onChange={updateDocument} renderRichTextField={renderContentRichTextField} />
      <section className={styles.blankList}>
        <h4>{t("complete.expectedAnswers", undefined, "Réponses attendues")}</h4>
        {documentExercise.blanks.map((blank, blankIndex) => {
          const isOpen = openBlankId === blank.id;
          const isList = responseKinds.get(blank.id) === "list";
          const title = isList
            ? t("complete.list", { index: blankIndex + 1 }, "Liste {index}")
            : t("complete.blank", { index: blankIndex + 1 }, "Mot {index}");
          const deleteLabel = isList
            ? t("complete.deleteList", undefined, "Supprimer cette liste")
            : t("complete.deleteBlank", undefined, "Supprimer ce mot");
          return <section className={`${styles.blankCard} ${isOpen ? styles.blankCardOpen : ""}`} key={blank.id}>
            <div className={styles.blankSummary}>
              <button aria-expanded={isOpen} className={styles.blankToggle} onClick={() => setOpenBlankId((current) => current === blank.id ? null : blank.id)} type="button">
                <span aria-hidden="true" className={`${styles.blankChevron} ${isOpen ? styles.blankChevronOpen : ""}`}>›</span>
                <strong>{title}</strong>
                <span className={styles.blankPreview}>{blank.answer.trim() || "—"}</span>
              </button>
              <button aria-label={deleteLabel} className="danger-pill compact compact-delete-button" onClick={() => deleteBlank(blank.id)} title={deleteLabel} type="button"><TrashIcon /></button>
            </div>
            {isOpen ? <div className={styles.blankDetails}>
              <div className={styles.settingsGrid}>
                <label>{t("complete.answer", undefined, "Bonne réponse")}<input onChange={(event) => updateDocument({ ...documentExercise, blanks: documentExercise.blanks.map((item) => item.id === blank.id ? { ...item, answer: event.target.value } : item) })} value={blank.answer} /></label>
                <label>{isList ? t("complete.choices", undefined, "Choix proposés") : t("complete.variants", undefined, "Autres réponses acceptées")}<textarea onChange={(event) => updateDocument({ ...documentExercise, blanks: documentExercise.blanks.map((item) => item.id === blank.id ? { ...item, variants: event.target.value.split("\n") } : item) })} value={blank.variants.join("\n")} /></label>
                <label className={styles.checkbox}><input checked={blank.caseSensitive} onChange={(event) => updateDocument({ ...documentExercise, blanks: documentExercise.blanks.map((item) => item.id === blank.id ? { ...item, caseSensitive: event.target.checked } : item) })} type="checkbox" />{t("complete.caseSensitive", undefined, "Respecter la casse")}</label>
              </div>
            </div> : null}
          </section>;
        })}
      </section>
    </section>

    <details className={styles.endingSettings}><summary>{t("complete.ending", undefined, "Page de fin")}</summary><div className={styles.settingsGrid}>
      {renderCoverRichTextField({ field: "successHtml", html: data.ending.successHtml, label: t("complete.successMessage", undefined, "Message en cas de réussite"), placeholder: t("complete.successMessage", undefined, "Message en cas de réussite") })}
      {renderCoverRichTextField({ field: "failureHtml", html: data.ending.failureHtml, label: t("complete.failureMessage", undefined, "Message en cas d’échec"), placeholder: t("complete.failureMessage", undefined, "Message en cas d’échec") })}
    </div></details>
  </section>;
}
