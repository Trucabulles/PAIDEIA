import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cleanKeyword, keywordKey, keywordSimilarityKey, uniqueKeywords } from "../../app/keywords";
import { useI18n } from "../../i18n/react";
import "./KeywordControls.css";

type KeywordPickerProps = {
  catalog: string[];
  keywords: string[];
  onChange: (keywords: string[]) => void;
  disabled?: boolean;
};

export function KeywordPicker({ catalog, keywords, onChange, disabled = false }: KeywordPickerProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const available = useMemo(() => catalog.filter((keyword) => !keywords.some((selected) => keywordKey(selected) === keywordKey(keyword))), [catalog, keywords]);
  const suggestions = useMemo(() => {
    const query = keywordSimilarityKey(draft);
    if (!query) return [];
    return available.filter((keyword) => keywordSimilarityKey(keyword).includes(query) || query.includes(keywordSimilarityKey(keyword))).slice(0, 7);
  }, [available, draft]);
  const add = (value: string) => {
    const cleaned = cleanKeyword(value);
    if (!cleaned || disabled) return;
    const existing = catalog.find((keyword) => keywordKey(keyword) === keywordKey(cleaned)
      || keywordSimilarityKey(keyword) === keywordSimilarityKey(cleaned));
    onChange(uniqueKeywords([...keywords, existing ?? cleaned]));
    setDraft("");
  };
  return <div className="keyword-picker">
    <div className="keyword-chips">
      {keywords.map((keyword) => <span className="keyword-chip" key={keyword}>
        {keyword}
        {!disabled && <button aria-label={t("keywords.remove", { keyword })} onClick={() => onChange(keywords.filter((item) => keywordKey(item) !== keywordKey(keyword)))} type="button">×</button>}
      </span>)}
      {keywords.length === 0 && <span className="keyword-empty">{t("keywords.noneAssigned")}</span>}
    </div>
    {!disabled && <>
      <div className="keyword-add-row">
        <input aria-label={t("keywords.addOne")} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(draft); } }} placeholder={t("keywords.input")} value={draft} />
        <button disabled={!draft.trim()} onClick={() => add(draft)} type="button">{t("observations.addAction")}</button>
      </div>
      {suggestions.length > 0 && <div className="keyword-suggestions" role="listbox">
        {suggestions.map((keyword) => <button key={keyword} onClick={() => add(keyword)} role="option" type="button">{keyword}</button>)}
      </div>}
      {draft.trim() && suggestions.length > 0 && !suggestions.some((item) => keywordKey(item) === keywordKey(draft)) &&
        <small>{t("keywords.similar", { keyword: cleanKeyword(draft) })}</small>}
    </>}
  </div>;
}

type LessonKeywordsDialogProps = {
  title: string;
  catalog: string[];
  keywords: string[];
  label: string;
  labels: string[];
  editable: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (keywords: string[], label: string) => void;
};

export function LessonKeywordsDialog({ title, catalog, keywords, label, labels, editable, busy, onClose, onSave }: LessonKeywordsDialogProps) {
  const { t } = useI18n();
  const [draftKeywords, setDraftKeywords] = useState(keywords);
  const [draftLabel, setDraftLabel] = useState(label);
  const [labelChoicesOpen, setLabelChoicesOpen] = useState(false);
  return <div className="paideia-modal-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} role="presentation">
    <section aria-label={t("keywords.lessonAria", { title })} aria-modal="true" className="paideia-modal keyword-dialog" role="dialog">
      <div className="keyword-dialog-scroll">
      <p className="modal-kicker">{t("keywords.lesson")}</p><h2>{t("keywords.labelsAndKeywords")}</h2><p>{title}</p>
      <span className="keyword-field-label">{t("keywords.libraryLabel")}</span>
      <button aria-expanded={labelChoicesOpen} className="keyword-label-current" disabled={busy} onClick={() => setLabelChoicesOpen((current) => !current)} type="button">{draftLabel || t("keywords.noLabel")}<span aria-hidden="true">⌄</span></button>
      {labelChoicesOpen && <div className="keyword-label-choices" role="listbox">
        {["", ...labels].map((item) => <button aria-selected={draftLabel === item} key={item || "none"} onClick={() => { setDraftLabel(item); setLabelChoicesOpen(false); }} role="option" type="button">{item || t("keywords.noLabel")}</button>)}
      </div>}
      <label className="keyword-field-label">{t("keywords.lessonKeywords")}</label>
      <KeywordPicker catalog={catalog} disabled={!editable || busy} keywords={draftKeywords} onChange={setDraftKeywords} />
      {!editable && <p>{t("keywords.lessonReadOnly")}</p>}
      <div className="modal-actions"><button className="ghost-pill" onClick={onClose} type="button">{t("common.cancel")}</button><button className="primary-pill" disabled={busy} onClick={() => onSave(draftKeywords, draftLabel)} type="button">{t("common.save")}</button></div>
      </div>
    </section>
  </div>;
}

type KeywordManagerProps = {
  catalog: string[];
  counts: Record<string, number>;
  pinnedKeywords: string[];
  onTogglePinned: (keyword: string) => void;
  busy: boolean;
  onAdd: (keywords: string[]) => void;
  onRename: (from: string, to: string, merge: boolean) => Promise<void>;
  onDelete: (keyword: string) => Promise<void>;
  onClose: () => void;
};

export function KeywordManager({ catalog, counts, pinnedKeywords, onTogglePinned, busy, onAdd, onRename, onDelete, onClose }: KeywordManagerProps) {
  const { t } = useI18n();
  const [paste, setPaste] = useState("");
  const [allowNearVariants, setAllowNearVariants] = useState(false);
  const [editing, setEditing] = useState<{ from: string; merge: boolean } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const pasted = uniqueKeywords(paste.split(/\r?\n/));
  const newItems = pasted.filter((item) => !catalog.some((existing) => keywordKey(existing) === keywordKey(item)));
  const nearItems = newItems.filter((item) => [...catalog, ...newItems].some((existing) =>
    keywordKey(existing) !== keywordKey(item) && keywordSimilarityKey(existing) === keywordSimilarityKey(item)));
  const canAdd = !busy && newItems.length > 0 && (nearItems.length === 0 || allowNearVariants);
  const applyAdd = () => {
    if (!canAdd) return;
    onAdd(newItems);
    setPaste("");
    setAllowNearVariants(false);
  };
  const applyRename = async () => {
    if (!editing || busy || !target.trim()) return;
    try { setError(""); await onRename(editing.from, target, editing.merge); setEditing(null); setTarget(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const applyDelete = async () => {
    if (!deleting || busy) return;
    try { setError(""); await onDelete(deleting); setDeleting(null); }
    catch (cause) { setDeleting(null); setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <div className="paideia-modal-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} role="presentation">
    <section aria-labelledby="keyword-manager-title" aria-modal="true" className={`paideia-modal keyword-dialog keyword-manager${editing ? " keyword-manager-editing" : ""}`} role="dialog">
      <div className="keyword-dialog-scroll">
      <p className="modal-kicker">{t("keywords.library")}</p><h2 id="keyword-manager-title">{t("keywords.title")}</h2>
      <div className="keyword-manager-intro">
      <p>{t("keywords.help")}</p>
      <p>{t("keywords.pinHelp")}</p>
      </div>
      <label className="keyword-field-label" htmlFor="keyword-paste">{t("keywords.paste")}</label>
      <textarea id="keyword-paste" onChange={(event) => setPaste(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); applyAdd(); } }} rows={5} value={paste} />
      {paste.trim() && <p>{t("keywords.pasteCount", { added: newItems.length, existing: pasted.length - newItems.length })}</p>}
      {nearItems.length > 0 && <div className="keyword-warning"><p>{t("keywords.similarVariants", { keywords: nearItems.join(", ") })}</p><label><input checked={allowNearVariants} onChange={(event) => setAllowNearVariants(event.target.checked)} type="checkbox" />{t("keywords.keepVariants")}</label></div>}
      <button disabled={!canAdd} onClick={applyAdd} type="button">{t("keywords.addToList")}</button>
      <div className="keyword-manager-list">
        {catalog.map((keyword) => <div className="keyword-manager-item" key={keywordKey(keyword)}>
          <button
            aria-label={t(pinnedKeywords.some((item) => keywordKey(item) === keywordKey(keyword)) ? "keywords.unpin" : "keywords.pin", { keyword })}
            aria-pressed={pinnedKeywords.some((item) => keywordKey(item) === keywordKey(keyword))}
            className="keyword-pin-toggle"
            disabled={busy}
            onClick={() => onTogglePinned(keyword)}
            title={t("keywords.pinTitle")}
            type="button"
          >{pinnedKeywords.some((item) => keywordKey(item) === keywordKey(keyword)) ? "★" : "☆"}</button>
          <strong>{keyword}</strong><span>{t(counts[keywordKey(keyword)] === 1 ? "library.lessonCount" : "library.lessonCountPlural", { count: counts[keywordKey(keyword)] ?? 0 })}</span>
          <button disabled={busy} onClick={() => { setEditing({ from: keyword, merge: false }); setTarget(keyword); setError(""); }} type="button">{t("common.rename")}</button>
          <button disabled={busy || catalog.length < 2} onClick={() => { setEditing({ from: keyword, merge: true }); setTarget(""); setError(""); }} type="button">{t("keywords.merge")}</button>
          <button disabled={busy} onClick={() => { setDeleting(keyword); setEditing(null); setError(""); }} type="button">{t("common.delete")}</button>
        </div>)}
        {catalog.length === 0 && <p>{t("keywords.empty")}</p>}
      </div>
      {editing && <div className="keyword-edit-box">
        <label className="keyword-field-label" htmlFor="keyword-target">{t(editing.merge ? "keywords.mergeInto" : "keywords.renameOne", { keyword: editing.from })}</label>
        {editing.merge ? <div className="keyword-merge-targets" id="keyword-target">{catalog.filter((item) => keywordKey(item) !== keywordKey(editing.from)).map((item) => <button aria-pressed={target === item} key={item} onClick={() => setTarget(item)} type="button">{item}</button>)}</div> : <input id="keyword-target" onChange={(event) => setTarget(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void applyRename(); } }} value={target} />}
        <div className="keyword-edit-actions"><button disabled={busy || !target.trim()} onClick={() => void applyRename()} type="button">{t("keywords.confirm")}</button><button onClick={() => setEditing(null)} type="button">{t("common.cancel")}</button></div>
      </div>}
      {error && <p className="keyword-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="primary-pill" onClick={onClose} type="button">{t("common.close")}</button></div>
      </div>
    </section>
    {deleting && createPortal(<div className="paideia-modal-backdrop" onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape" && !busy) setDeleting(null); }} role="presentation">
      <section aria-labelledby="keyword-delete-title" aria-modal="true" className="paideia-modal" role="alertdialog">
        <p className="modal-kicker">{t("keywords.title")}</p>
        <h2 id="keyword-delete-title">{t("keywords.deleteQuestion", { keyword: deleting })}</h2>
        <p>{t("keywords.deleteWarning", { count: counts[keywordKey(deleting)] ?? 0 })}</p>
        <div className="modal-actions">
          <button autoFocus className="ghost-pill" disabled={busy} onClick={() => setDeleting(null)} type="button">{t("common.cancel")}</button>
          <button className="danger-pill" disabled={busy} onClick={() => void applyDelete()} type="button">{t("common.delete")}</button>
        </div>
      </section>
    </div>, document.body)}
  </div>;
}
