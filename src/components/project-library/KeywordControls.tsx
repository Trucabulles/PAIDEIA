import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cleanKeyword, keywordKey, keywordSimilarityKey, uniqueKeywords } from "../../app/keywords";
import "./KeywordControls.css";

type KeywordPickerProps = {
  catalog: string[];
  keywords: string[];
  onChange: (keywords: string[]) => void;
  disabled?: boolean;
};

export function KeywordPicker({ catalog, keywords, onChange, disabled = false }: KeywordPickerProps) {
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
        {!disabled && <button aria-label={`Retirer ${keyword}`} onClick={() => onChange(keywords.filter((item) => keywordKey(item) !== keywordKey(keyword)))} type="button">×</button>}
      </span>)}
      {keywords.length === 0 && <span className="keyword-empty">Aucun mot-clé affecté.</span>}
    </div>
    {!disabled && <>
      <div className="keyword-add-row">
        <input aria-label="Ajouter un mot-clé" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(draft); } }} placeholder="Saisir ou rechercher un mot-clé" value={draft} />
        <button disabled={!draft.trim()} onClick={() => add(draft)} type="button">Ajouter</button>
      </div>
      {suggestions.length > 0 && <div className="keyword-suggestions" role="listbox">
        {suggestions.map((keyword) => <button key={keyword} onClick={() => add(keyword)} role="option" type="button">{keyword}</button>)}
      </div>}
      {draft.trim() && suggestions.length > 0 && !suggestions.some((item) => keywordKey(item) === keywordKey(draft)) &&
        <small>Un terme proche existe déjà. Choisissez-le ou créez « {cleanKeyword(draft)} ».</small>}
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
  const [draftKeywords, setDraftKeywords] = useState(keywords);
  const [draftLabel, setDraftLabel] = useState(label);
  const [labelChoicesOpen, setLabelChoicesOpen] = useState(false);
  return <div className="paideia-modal-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} role="presentation">
    <section aria-label={`Labels et mots-clés de ${title}`} aria-modal="true" className="paideia-modal keyword-dialog" role="dialog">
      <div className="keyword-dialog-scroll">
      <p className="modal-kicker">Leçon</p><h2>Labels et mots-clés</h2><p>{title}</p>
      <span className="keyword-field-label">Label de bibliothèque</span>
      <button aria-expanded={labelChoicesOpen} className="keyword-label-current" disabled={busy} onClick={() => setLabelChoicesOpen((current) => !current)} type="button">{draftLabel || "Aucun label"}<span aria-hidden="true">⌄</span></button>
      {labelChoicesOpen && <div className="keyword-label-choices" role="listbox">
        {["", ...labels].map((item) => <button aria-selected={draftLabel === item} key={item || "none"} onClick={() => { setDraftLabel(item); setLabelChoicesOpen(false); }} role="option" type="button">{item || "Aucun label"}</button>)}
      </div>}
      <label className="keyword-field-label">Mots-clés de la leçon</label>
      <KeywordPicker catalog={catalog} disabled={!editable || busy} keywords={draftKeywords} onChange={setDraftKeywords} />
      {!editable && <p>Cette leçon ne peut pas être modifiée depuis la bibliothèque.</p>}
      <div className="modal-actions"><button className="ghost-pill" onClick={onClose} type="button">Annuler</button><button className="primary-pill" disabled={busy} onClick={() => onSave(draftKeywords, draftLabel)} type="button">Enregistrer</button></div>
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
      <p className="modal-kicker">Bibliothèque</p><h2 id="keyword-manager-title">Mots-clés</h2>
      <div className="keyword-manager-intro">
      <p>Préparez des mots-clés, puis affectez-les aux leçons. Le nombre indique les leçons qui utilisent chaque terme.</p>
      <p>L’étoile ancre le mot-clé dans la liste latérale, même s’il n’est pas encore utilisé.</p>
      </div>
      <label className="keyword-field-label" htmlFor="keyword-paste">Coller une liste — un mot-clé par ligne</label>
      <textarea id="keyword-paste" onChange={(event) => setPaste(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); applyAdd(); } }} rows={5} value={paste} />
      {paste.trim() && <p>{newItems.length} nouveau(x) mot(s)-clé(s) ; {pasted.length - newItems.length} déjà présent(s).</p>}
      {nearItems.length > 0 && <div className="keyword-warning"><p>Variantes proches à vérifier : {nearItems.join(", ")}.</p><label><input checked={allowNearVariants} onChange={(event) => setAllowNearVariants(event.target.checked)} type="checkbox" />Créer quand même ces variantes</label></div>}
      <button disabled={!canAdd} onClick={applyAdd} type="button">Ajouter à la liste</button>
      <div className="keyword-manager-list">
        {catalog.map((keyword) => <div className="keyword-manager-item" key={keywordKey(keyword)}>
          <button
            aria-label={`${pinnedKeywords.some((item) => keywordKey(item) === keywordKey(keyword)) ? "Désancrer" : "Ancrer"} le mot-clé ${keyword}`}
            aria-pressed={pinnedKeywords.some((item) => keywordKey(item) === keywordKey(keyword))}
            className="keyword-pin-toggle"
            disabled={busy}
            onClick={() => onTogglePinned(keyword)}
            title="Ancrer dans la liste des mots-clés"
            type="button"
          >{pinnedKeywords.some((item) => keywordKey(item) === keywordKey(keyword)) ? "★" : "☆"}</button>
          <strong>{keyword}</strong><span>{counts[keywordKey(keyword)] ?? 0} leçon(s)</span>
          <button disabled={busy} onClick={() => { setEditing({ from: keyword, merge: false }); setTarget(keyword); setError(""); }} type="button">Renommer</button>
          <button disabled={busy || catalog.length < 2} onClick={() => { setEditing({ from: keyword, merge: true }); setTarget(""); setError(""); }} type="button">Fusionner</button>
          <button disabled={busy} onClick={() => { setDeleting(keyword); setEditing(null); setError(""); }} type="button">Supprimer</button>
        </div>)}
        {catalog.length === 0 && <p>Aucun mot-clé.</p>}
      </div>
      {editing && <div className="keyword-edit-box">
        <label className="keyword-field-label" htmlFor="keyword-target">{editing.merge ? `Fusionner « ${editing.from} » dans` : `Renommer « ${editing.from} »`}</label>
        {editing.merge ? <div className="keyword-merge-targets" id="keyword-target">{catalog.filter((item) => keywordKey(item) !== keywordKey(editing.from)).map((item) => <button aria-pressed={target === item} key={item} onClick={() => setTarget(item)} type="button">{item}</button>)}</div> : <input id="keyword-target" onChange={(event) => setTarget(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void applyRename(); } }} value={target} />}
        <div className="keyword-edit-actions"><button disabled={busy || !target.trim()} onClick={() => void applyRename()} type="button">Confirmer</button><button onClick={() => setEditing(null)} type="button">Annuler</button></div>
      </div>}
      {error && <p className="keyword-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="primary-pill" onClick={onClose} type="button">Fermer</button></div>
      </div>
    </section>
    {deleting && createPortal(<div className="paideia-modal-backdrop" onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape" && !busy) setDeleting(null); }} role="presentation">
      <section aria-labelledby="keyword-delete-title" aria-modal="true" className="paideia-modal" role="alertdialog">
        <p className="modal-kicker">Mots-clés</p>
        <h2 id="keyword-delete-title">Supprimer « {deleting} » ?</h2>
        <p>Ce mot-clé sera retiré de la liste globale et des {counts[keywordKey(deleting)] ?? 0} leçon(s) qui l’utilisent.</p>
        <div className="modal-actions">
          <button autoFocus className="ghost-pill" disabled={busy} onClick={() => setDeleting(null)} type="button">Annuler</button>
          <button className="danger-pill" disabled={busy} onClick={() => void applyDelete()} type="button">Supprimer</button>
        </div>
      </section>
    </div>, document.body)}
  </div>;
}
