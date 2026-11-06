import { useIndividualBank } from "./useIndividualBank";
import { ResourceSortControl, ResourceNoResults, useResourceTiles } from "./ResourceCatalogControls";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { LibraryProjectEntry, ReferenceBankResource } from "../../types/project";
import { useI18n } from "../../i18n/react";
import { exportReferenceBankXlsx, importReferenceBankXlsx, plainTextToRichHtml, richHtmlToPlainText } from "./resourceWorkbook";
import "./AssistantResource/AssistantResourceManager.css";
import styles from "./QuestionBank/QuestionBankManager.module.css";
import { CreateResourceButton } from "./CreateResourceButton";
import { bankNameFromFile, exportBankPackage, uniqueBankName } from "./resourceBankPackage";
import { useResourceBankTransfer } from "./useResourceBankTransfer";
import { BackIcon, SaveIcon, CheckIcon, SpinnerIcon, ErrorIcon, ImportIcon, ExportIcon, PlusIcon, TrashIcon } from "./QuestionBank/QuestionBankManager";

type Props = {
  renderDefinition: (props: { bankId: string; entryId: string; html: string; onCommit: (html: string) => void }) => ReactNode;
  banks: ReferenceBankResource[];
  pendingProjectPaths?: string[];
  collections: string[];
  lessonProjects: LibraryProjectEntry[];
  canAssignLesson?: (lesson: LibraryProjectEntry) => boolean;
  onBanksChange: (banks: ReferenceBankResource[]) => void;
  onDelete: (bankId: string) => Promise<void>;
  onExportXlsx: (fileName: string, bytes: number[]) => Promise<void>;
  onExportArchive: (fileName: string, bytes: number[]) => Promise<void>;
  onImportBanks: (banks: ReferenceBankResource[]) => Promise<void>;
  onExportPdf: (fileName: string, bytes: number[]) => Promise<void>;
  onSave: (bankId: string) => Promise<void>;
  onTileImageUpload: (bankId: string, file: File) => Promise<void>;
  resolveTileImageSrc: (ref?: string | null) => string | null;
  saveFeedbackState: "idle" | "saving" | "saved" | "error";
};

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeFileName(value: string) {
  return value.replace(/[/\\?%*:|"<>]/g, "-").trim() || "balises-renvois";
}

export function ReferenceBankResourceManager(props: Props) {
  const { t } = useI18n();
  const individual = useIndividualBank("references", props.banks, props.onBanksChange);
  function openIndividual(bank: ReferenceBankResource) { individual.open(bank, loaded => setSelectedId(loaded.id)); }
  const [selectedId, setSelectedId] = useState("");
  const importRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const imageBankIdRef = useRef("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState("");
  const selected = props.banks.find((bank) => bank.id === selectedId) ?? null;
  const sorted = useResourceTiles(props.banks);
  const bulk = useResourceBankTransfer({
    banks: props.banks,
    extensions: ["xlsx"],
    onImport: async (files) => {
      const names = new Set(props.banks.map((bank) => bank.name.toLocaleLowerCase("fr")));
      const imported: ReferenceBankResource[] = [];
      for (const file of files) {
        const entries = (await importReferenceBankXlsx(file)).map((entry) => ({
          ...entry,
          id: id("reference_entry")
        }));
        imported.push({
          id: id("reference_bank"),
          name: uniqueBankName(bankNameFromFile(file.name), names),
          revision: 1,
          entries,
          projectPaths: [],
          collectionIds: []
        });
      }
      await props.onImportBanks([...props.banks, ...imported]);
    },
    onExport: async (ids) => {
      const selected = await Promise.all(props.banks.filter((bank) => ids.includes(bank.id)).map(individual.load));
      const files = await Promise.all(selected.map(async (bank) => ({
        name: bank.name,
        bytes: new Uint8Array(await (await exportReferenceBankXlsx(bank.entries)).arrayBuffer())
      })));
      await props.onExportArchive("balises-renvois-paideia.zip", await exportBankPackage(files));
    }
  });

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".reference-bank-menu, .reference-bank-menu-toggle")) return;
      setMenuId(null);
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, []);

  async function withFeedback(action: () => Promise<void>) {
    setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }

  const imageInput = <input ref={imageRef} accept="image/png,image/jpeg,image/webp" hidden type="file" onChange={(event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const bankId = imageBankIdRef.current;
    setMenuId(null);
    if (file && bankId) void withFeedback(() => props.onTileImageUpload(bankId, file));
  }} />;

  const deleteDialog = deleteId ? <div className="paideia-modal-backdrop" onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); if (!deleting) setDeleteId(null); }
  }}>
    <section className="paideia-modal" role="dialog" aria-modal="true" aria-labelledby="reference-bank-delete-title">
      <h2 id="reference-bank-delete-title">{t("common.delete")} — {props.banks.find((bank) => bank.id === deleteId)?.name}</h2>
      {error ? <p role="alert">{error}</p> : null}
      <div className="modal-actions">
        <button autoFocus className="ghost-pill" disabled={deleting} onClick={() => setDeleteId(null)} type="button">{t("common.cancel")}</button>
        <button className={styles.dangerButton} disabled={deleting} onClick={() => {
          setDeleting(true);
          void withFeedback(async () => { await props.onDelete(deleteId); setDeleteId(null); }).finally(() => setDeleting(false));
        }} type="button"><span className={styles.buttonIcon}><TrashIcon /></span>{t("common.delete")}</button>
      </div>
    </section>
  </div> : null;

  function update(patch: Partial<ReferenceBankResource>) {
    if (!selected) return;
    props.onBanksChange(props.banks.map((bank) => bank.id === selected.id ? { ...bank, ...patch, revision: bank.revision + 1 } : bank));
  }

  function addBank() {
    const bank: ReferenceBankResource = {
      id: id("reference_bank"), name: t("references.newBank"), revision: 1, entries: [], projectPaths: [], collectionIds: []
    };
    props.onBanksChange([...props.banks, bank]);
    openIndividual(bank);
  }

  async function duplicateBank(bank: ReferenceBankResource) {
    bank = await individual.load(bank);
    const copy = { ...bank, id: id("reference_bank"), name: `${bank.name} — ${t("common.copy")}`, revision: 1,
      tileImageRef: null, projectPaths: [], collectionIds: [], entries: bank.entries.map((entry) => ({ ...entry, id: id("reference_entry") })) };
    props.onBanksChange([...props.banks, copy]);
    setSelectedId(copy.id);
  }

  async function importXlsx(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected) return;
    await withFeedback(async () => update({ entries: await importReferenceBankXlsx(file, selected.entries) }));
  }

  async function exportXlsx(bank: ReferenceBankResource) {
    bank = await individual.load(bank);
    const blob = await exportReferenceBankXlsx(bank.entries);
    await props.onExportXlsx(`${safeFileName(bank.name)}.xlsx`, Array.from(new Uint8Array(await blob.arrayBuffer())));
  }

  async function exportPdf(bank: ReferenceBankResource) {
    bank = await individual.load(bank);
    const { generateResourcePdf } = await import("../../export/pdf/generateResourcePdf");
    const bytes = await generateResourcePdf("references", bank.name, bank.entries);
    await props.onExportPdf(`${safeFileName(bank.name)}.pdf`, Array.from(bytes));
  }

  async function confirmRename() {
    const bank = props.banks.find((item) => item.id === renameId);
    const name = renameName.trim();
    if (!bank || !name || renaming) return;
    if (name === bank.name) { setRenameId(null); return; }
    const previousBanks = props.banks;
    props.onBanksChange(previousBanks.map((item) => item.id === bank.id ? { ...item, name, revision: item.revision + 1 } : item));
    setRenaming(true);
    setError("");
    try {
      await props.onSave(bank.id);
      setRenameId(null);
    } catch (cause) {
      props.onBanksChange(previousBanks);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRenaming(false);
    }
  }

  function projectPathsForCollections(collectionIds: string[]) {
    return props.lessonProjects.filter((lesson) => lesson.collection && collectionIds.includes(lesson.collection)
      && (props.canAssignLesson?.(lesson) ?? true)).map((lesson) => lesson.archivePath);
  }

  if (!selected) {
    return <section className={styles.panel}>
      {imageInput}
      {deleteDialog}
      {renameId ? <div className="paideia-modal-backdrop" role="presentation"><section className="paideia-modal" role="dialog" aria-modal="true" aria-labelledby="reference-bank-rename-title">
        <h2 id="reference-bank-rename-title">{t("common.rename")}</h2>
        <label className="modal-field">{t("references.bankName")}<input autoFocus disabled={renaming} value={renameName} onChange={(event) => setRenameName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void confirmRename(); }} /></label>
        {error ? <p role="alert">{error}</p> : null}
        <div className="modal-actions"><button className="ghost-pill" disabled={renaming} onClick={() => setRenameId(null)} type="button">{t("common.cancel")}</button><button className="primary-pill" disabled={renaming || !renameName.trim()} onClick={() => void confirmRename()} type="button">{t("common.save")}</button></div>
      </section></div> : null}
      {error && !deleteId && !renameId ? <p role="alert">{error}</p> : null}
      <div className="resource-bank-title-row">
        <p className="assistant-resource-count">{t(props.banks.length > 1 ? "references.bankCountPlural" : "references.bankCount", { count: props.banks.length })}</p>
        <CreateResourceButton label={t("references.addBank")} onClick={addBank} />
        {bulk.selectAll}
        {bulk.actions}
        <ResourceSortControl />
      </div>
      {bulk.error}
        {individual.notice}
      <div className="resource-portal-grid">
        {sorted.map((bank) => {
          const image = props.resolveTileImageSrc(bank.tileImageRef);
          return <article className="resource-portal-card" key={bank.id}>
            {bulk.checkbox(bank)}
            <button className="resource-portal-open" onClick={() => openIndividual(bank)} type="button">
              <span className={`resource-portal-cover ${image ? "" : "resource-portal-cover-empty"}`}>
                {image ? <img alt="" className="resource-portal-image" src={image} /> : null}
              </span>
              <span className="resource-portal-body"><span className="resource-portal-title">{bank.name}</span><span className="resource-portal-subtitle">{t((bank.contentCount ?? bank.entries.length) === 1 ? "assistant.entryCount" : "assistant.entryCountPlural", { count: bank.contentCount ?? bank.entries.length })}</span></span>
            </button>
            <button aria-label={`${t("common.settings")} — ${bank.name}`} aria-expanded={menuId === bank.id} className={`library-card-menu-toggle reference-bank-menu-toggle ${styles.tileMenuToggle}`} onClick={() => setMenuId(menuId === bank.id ? null : bank.id)} type="button">...</button>
            {menuId === bank.id ? <div className={`library-card-menu reference-bank-menu ${styles.tileMenu}`}>
              <button onClick={() => { setMenuId(null); openIndividual(bank); }} type="button">{t("common.configure")}</button>
              <button onClick={() => { setError(""); setMenuId(null); setRenameId(bank.id); setRenameName(bank.name); }} type="button">{t("common.rename")}</button>
              <button onClick={() => { setMenuId(null); void withFeedback(() => exportXlsx(bank)); }} type="button">{t("references.export")}</button>
              <button onClick={() => { setMenuId(null); void withFeedback(() => exportPdf(bank)); }} type="button">{t("library.generatePdf")}</button>
              <button onClick={() => { imageBankIdRef.current = bank.id; imageRef.current?.click(); }} type="button">{t("editor.chooseImage")}</button>
              <button onClick={() => { setMenuId(null); void duplicateBank(bank).catch(individual.report); }} type="button">{t("common.duplicate")}</button>
              <button className={`danger ${styles.menuDangerAction}`} onClick={() => { setError(""); setMenuId(null); setDeleteId(bank.id); }} type="button"><span className={styles.buttonIcon}><TrashIcon /></span>{t("common.delete")}</button>
            </div> : null}
          </article>;
        })}
      </div>
      <ResourceNoResults count={sorted.length} />
    </section>;
  }

  const state = props.saveFeedbackState;
  const saveClass = state === "saving" ? styles.saveButton_saving : state === "saved" ? styles.saveButton_saved : state === "error" ? styles.saveButton_error : "";
  return <section className={styles.panel}>
    {imageInput}
    {error ? <p role="alert">{error}</p> : null}
    <div className={styles.topBar}>
      <button className={styles.backButton} onClick={() => setSelectedId("")} type="button"><span className={styles.buttonIcon}><BackIcon /></span>{t("resources.backToTiles")}</button>
      <div className={styles.saveArea}><button className={`resource-save-button active ${styles.saveButton} ${saveClass}`} disabled={state === "saving"} onClick={() => void withFeedback(() => props.onSave(selected.id))} type="button">
        <span className={`${styles.buttonIcon} ${state === "saving" ? styles.savingIcon : ""}`}>{state === "saving" ? <SpinnerIcon /> : state === "saved" ? <CheckIcon /> : state === "error" ? <ErrorIcon /> : <SaveIcon />}</span>{t("common.save")}
      </button>
      {Boolean(props.pendingProjectPaths?.some((path) => selected.projectPaths.includes(path))) ? <span role="status">{t("references.pendingUpdates", { count: props.pendingProjectPaths?.filter((path) => selected.projectPaths.includes(path)).length })}</span> : null}
      </div>
    </div>
    <div className={styles.editor}>
      <section className={`${styles.card} ${styles.bankOverview}`}>
        <div className={styles.bankOverviewMain}>
          <span className={styles.eyebrow}>{t("common.name")}</span>
          <label className={styles.bankNameField}><input aria-label={t("references.bankName")} value={selected.name} onChange={(event) => update({ name: event.target.value })} /></label>
        </div>
        <div className={styles.bankCount}><strong>{selected.entries.length}</strong><span>{t("references.entryCount", { count: selected.entries.length })}</span></div>
      </section>
      <section className="assistant-resource-card assistant-resource-associations-card">
        <div className="assistant-resource-card-head"><h3>{t("assistant.associations")}</h3></div>
        <div className="assistant-resource-associations">
          <div className="assistant-resource-association-panel"><h4>{t("references.lessons")}</h4><div className="assistant-resource-selection-list">
            {props.lessonProjects.map((lesson) => <label className={`assistant-resource-option-row ${props.canAssignLesson?.(lesson) === false ? "reference-bank-assignment-unavailable" : ""}`} key={lesson.archivePath} title={props.canAssignLesson?.(lesson) === false ? t("references.ownerOnlyUpdate") : undefined}><input className="assistant-resource-option-control" disabled={props.canAssignLesson?.(lesson) === false} checked={selected.projectPaths.includes(lesson.archivePath)} type="checkbox" onChange={(event) => {
              if (props.canAssignLesson?.(lesson) === false) return;
              update({ projectPaths: event.target.checked ? [...new Set([...selected.projectPaths, lesson.archivePath])] : selected.projectPaths.filter((path) => path !== lesson.archivePath) });
            }} /><span className="assistant-resource-option-label">{lesson.title}</span></label>)}
          </div></div>
          <div className="assistant-resource-association-panel"><h4>{t("references.collections")}</h4><div className="assistant-resource-selection-list">
            {props.collections.map((collection) => <label className="assistant-resource-option-row" key={collection}><input className="assistant-resource-option-control" checked={selected.collectionIds.includes(collection)} type="checkbox" onChange={(event) => { const collectionIds = event.target.checked ? [...new Set([...selected.collectionIds, collection])] : selected.collectionIds.filter((item) => item !== collection); const oldInherited = projectPathsForCollections(selected.collectionIds); const direct = selected.projectPaths.filter((path) => !oldInherited.includes(path)); update({ collectionIds, projectPaths: [...new Set([...direct, ...projectPathsForCollections(collectionIds)])] }); }} /><span className="assistant-resource-option-label">{collection}</span></label>)}
            {!props.collections.length ? <p className="assistant-resource-hint">{t("library.noCollection")}</p> : null}
          </div></div>
        </div>
      </section>
      <section className="assistant-resource-card assistant-resource-glossary-card">
      <div className="assistant-resource-glossary-toolbar">
        <div className="assistant-resource-glossary-title"><h3>{t("references.definition")}</h3><span className="assistant-resource-count-pill">{selected.entries.length}</span></div>
        <div className="assistant-resource-toolbar-actions">
        <div className="assistant-resource-secondary-actions">
        <input ref={importRef} accept=".xlsx" hidden type="file" onChange={(event) => void importXlsx(event)} />
        <button className="assistant-resource-button assistant-resource-secondary-button" onClick={() => importRef.current?.click()} type="button"><span className="assistant-resource-button-icon"><ImportIcon /></span>{t("common.import")} XLSX</button>
        <button className="assistant-resource-button assistant-resource-secondary-button" onClick={() => void withFeedback(() => exportXlsx(selected))} type="button"><span className="assistant-resource-button-icon"><ExportIcon /></span>{t("references.export")} XLSX</button>
        <button className="assistant-resource-button assistant-resource-secondary-button" onClick={() => void withFeedback(() => exportPdf(selected))} type="button"><span className="assistant-resource-button-icon"><ExportIcon /></span>{t("library.generatePdf")}</button>
        </div>
        <button className="assistant-resource-button assistant-resource-primary-button" onClick={() => {
          const entryId = id("reference_entry");
          update({ entries: [...selected.entries, { id: entryId, term: "", definitionHtml: "<p></p>" }] });
          setExpandedId(entryId);
        }} type="button"><span className="assistant-resource-button-icon"><PlusIcon /></span>{t("references.addEntry")}</button>
        </div>
      </div>
      <div className="assistant-resource-entry-list">
        {selected.entries.map((entry) => <article className={`assistant-resource-entry ${expandedId === entry.id ? "expanded" : "collapsed"}`} key={entry.id}>
          <div className="assistant-resource-entry-head">
            <button aria-label={`${t("common.configure")} — ${entry.term || t("references.definition")}`} aria-expanded={expandedId === entry.id} className="assistant-resource-entry-toggle" onClick={() => setExpandedId(expandedId === entry.id ? "" : entry.id)} type="button"><span className={`assistant-resource-entry-chevron ${expandedId === entry.id ? "" : "collapsed"}`} /></button>
            <div className="assistant-resource-entry-summary"><strong>{entry.term || t("references.definition")}</strong></div>
            <button aria-label={`${t("common.delete")} — ${entry.term}`} className="assistant-resource-icon-danger-button" onClick={() => update({ entries: selected.entries.filter((item) => item.id !== entry.id) })} type="button"><TrashIcon /></button>
          </div>
          {expandedId === entry.id ? <div className="assistant-resource-entry-body">
            <div className="assistant-resource-form-grid">
              <label><span>{t("references.term")}</span><input value={entry.term} onChange={(event) => update({ entries: selected.entries.map((item) => item.id === entry.id ? { ...item, term: event.target.value } : item) })} /></label>
              <div><span className="assistant-resource-eyebrow">{t("references.definition")}</span>{props.renderDefinition({ bankId: selected.id, entryId: entry.id, html: entry.definitionHtml, onCommit: (definitionHtml) => {
                // Use the latest bank instead of an old editor-render closure.
                const latest = props.banks.find((bank) => bank.id === selected.id);
                if (latest) props.onBanksChange(props.banks.map((bank) => bank.id === latest.id ? { ...bank, revision: bank.revision + 1, entries: bank.entries.map((item) => item.id === entry.id ? { ...item, definitionHtml } : item) } : bank));
              } })}</div>
            </div>
          </div> : null}
        </article>)}
      </div>
      </section>
    </div>
  </section>;
}
