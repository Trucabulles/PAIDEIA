import { useIndividualBank } from "../useIndividualBank";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResourceSortControl, ResourceNoResults, useResourceTiles } from "../ResourceCatalogControls";
import type { ChangeEvent, ReactNode } from "react";
import type { GlossaryAssistantEntry, GlossaryAssistantResource, LibraryProjectEntry } from "../../../types/project";
import "./AssistantResourceManager.css";
import { useI18n } from "../../../i18n/react";
import { translateActive } from "../../../i18n";
import { exportAssistantXlsx, importAssistantXlsx } from "../resourceWorkbook";
import { useEscapeNavigation } from "../../../hooks/useEscapeNavigation";
import { CreateResourceButton } from "../CreateResourceButton";
import { bankNameFromFile, exportBankPackage, uniqueBankName } from "../resourceBankPackage";
import { useResourceBankTransfer } from "../useResourceBankTransfer";

type AssistantResourceManagerProps = {
  assistants: GlossaryAssistantResource[];
  collections: string[];
  lessonProjects: LibraryProjectEntry[];
  onAssistantsChange: (assistants: GlossaryAssistantResource[]) => void;
  onAvatarUpload: (assistantId: string, file: File) => void;
  resolveAvatarSrc: (avatarRef?: string | null) => string;
  renderDefinitionField: (options: {
    assistantId: string;
    entry: GlossaryAssistantEntry;
    html: string;
    onCommit: (html: string) => void;
    placeholder: string;
  }) => ReactNode;
  onDeleteAssistant: (assistantId: string) => Promise<void>;
  onExportXlsx: (fileName: string, fileBytes: number[]) => Promise<void>;
  onExportArchive: (fileName: string, fileBytes: number[]) => Promise<void>;
  onExportPdf: (fileName: string, fileBytes: number[]) => Promise<void>;
  onSave: (bankIds?: string[], metadataOnlyIds?: string[]) => Promise<void>;
  saveFeedbackState?: "idle" | "saving" | "saved" | "error";
};

type PendingAssociationConflict = {
  label: string;
  affectedAssistantNames: string[];
  apply: () => void;
};

type ImportStatus = {
  title: string;
  message: string;
  kind: "success" | "error";
};

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v5M12 16.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 20V10m0 0 4 4m-4-4-4 4M5 6h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="m6.5 17 4-4 2.5 2.5 2-2 2.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

const DEFAULT_FALLBACKS = [
  translateActive("assistant.fallbackNotFound"),
  translateActive("assistant.fallbackUnknown"),
  translateActive("assistant.fallbackTryAnother"),
  translateActive("assistant.fallbackNoDefinition")
];

function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createAssistant(index: number): GlossaryAssistantResource {
  return {
    id: uniqueId("assistant"),
    name: `Assistant ${index}`,
    avatarRef: null,
    entries: [],
    fallbackResponses: [...DEFAULT_FALLBACKS],
    caseInsensitive: true,
    ignoreAccents: true,
    fuzzyEnabled: true,
    fuzzyThreshold: 1,
    assistantEnabled: true,
    alwaysVisible: false,
    position: "bottom-left",
    shortcut: "Maj+<",
    lessonIds: [],
    collectionIds: [],
    projectPaths: []
  };
}

function createEntry(index: number): GlossaryAssistantEntry {
  return {
    id: uniqueId("entry"),
    term: "",
    aliases: [],
    contentHtml: "<p></p>",
    related: [],
    fuzzy: true
  };
}

function splitList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(values: string[]) {
  return values.join("|");
}

function sortAssistantEntries(entries: GlossaryAssistantEntry[]) {
  return [...entries].sort((left, right) => left.term.localeCompare(right.term, "fr", { sensitivity: "base" }));
}

const ASSISTANT_COLLAPSED_ENTRY_IDS_KEY = "paideia.assistant-collapsed-entry-ids";

function readCollapsedEntryIdsByAssistant(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(ASSISTANT_COLLAPSED_ENTRY_IDS_KEY) ?? "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeCollapsedEntryIdsByAssistant(value: Record<string, string[]>) {
  localStorage.setItem(ASSISTANT_COLLAPSED_ENTRY_IDS_KEY, JSON.stringify(value));
}

export function AssistantResourceManager({
  assistants,
  collections,
  lessonProjects,
  onAssistantsChange,
  onAvatarUpload,
  resolveAvatarSrc,
  renderDefinitionField,
  onDeleteAssistant,
  onExportXlsx,
  onExportArchive,
  onExportPdf,
  onSave,
  saveFeedbackState = "idle"
}: AssistantResourceManagerProps) {
  const { t } = useI18n();
  const individual = useIndividualBank("assistants", assistants, onAssistantsChange);
  function selectAssistant(bank: GlossaryAssistantResource) {
    const ids = new Set(bank.entries.map(entry => entry.id));
    const saved = (readCollapsedEntryIdsByAssistant()[bank.id] ?? []).filter(id => ids.has(id));
    setCollapsedEntryIds(saved.length ? saved : [...ids]);
    setSelectedAssistantId(bank.id);
  }
  function openIndividual(bank: GlossaryAssistantResource) { individual.open(bank, selectAssistant); }
  const [selectedAssistantId, setSelectedAssistantId] = useState("");
  const pendingAssociationIds = useRef(new Set<string>());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [deleteAssistantId, setDeleteAssistantId] = useState<string | null>(null);
  const [renameAssistantId, setRenameAssistantId] = useState<string | null>(null);
  const [renameAssistantName, setRenameAssistantName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [isDeleteAllEntriesDialogOpen, setIsDeleteAllEntriesDialogOpen] = useState(false);
  const [pendingAssociationConflict, setPendingAssociationConflict] = useState<PendingAssociationConflict | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [exportAssistantId, setExportAssistantId] = useState<string | null>(null);
  const [collapsedEntryIds, setCollapsedEntryIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedAssistant = assistants.find((assistant) => assistant.id === selectedAssistantId) ?? null;
  useEscapeNavigation(Boolean(selectedAssistantId), () => setSelectedAssistantId(""));
  const deleteAssistantTarget = assistants.find((assistant) => assistant.id === deleteAssistantId) ?? null;
  const renameAssistantTarget = assistants.find((assistant) => assistant.id === renameAssistantId) ?? null;
  const exportAssistantTarget = assistants.find((assistant) => assistant.id === exportAssistantId) ?? null;
  const selectedAssistantAvatarSrc = selectedAssistant ? resolveAvatarSrc(selectedAssistant.avatarRef) : "";
  const selectedAssistantEntriesKey = selectedAssistant
    ? selectedAssistant.entries.map((entry) => entry.id).join("|")
    : "";

  const sortedAssistants = useResourceTiles(assistants);

  useEffect(() => {
    if (!actionMenuId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".resource-character-menu, .resource-character-menu-toggle")
      ) {
        return;
      }
      setActionMenuId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [actionMenuId]);

  useEffect(() => {
    if (!selectedAssistant) {
      setCollapsedEntryIds([]);
      return;
    }

    const collapsedByAssistant = readCollapsedEntryIdsByAssistant();
    const savedCollapsedIds = collapsedByAssistant[selectedAssistant.id] ?? [];
    const validCollapsedIds = savedCollapsedIds.filter((entryId) =>
      selectedAssistant.entries.some((entry) => entry.id === entryId)
    );

    setCollapsedEntryIds(
      validCollapsedIds.length ? validCollapsedIds : selectedAssistant.entries.map((entry) => entry.id)
    );
  }, [selectedAssistantId, selectedAssistantEntriesKey]);

  useEffect(() => {
    if (!selectedAssistant) {
      return;
    }

    const collapsedByAssistant = readCollapsedEntryIdsByAssistant();
    if (collapsedEntryIds.length) {
      collapsedByAssistant[selectedAssistant.id] = collapsedEntryIds;
    } else {
      delete collapsedByAssistant[selectedAssistant.id];
    }
    writeCollapsedEntryIdsByAssistant(collapsedByAssistant);
  }, [collapsedEntryIds, selectedAssistantId, selectedAssistant]);

  function updateAssistant(id: string, patch: Partial<GlossaryAssistantResource>) {
    onAssistantsChange(
      assistants.map((assistant) => {
        if (assistant.id !== id) {
          return assistant;
        }
        const next = { ...assistant, ...patch };
        return { ...next, entries: sortAssistantEntries(next.entries) };
      })
    );
  }

  function updateEntry(entryId: string, patch: Partial<GlossaryAssistantEntry>) {
    if (!selectedAssistant) {
      return;
    }
    updateAssistant(selectedAssistant.id, {
      entries: selectedAssistant.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry))
    });
  }

  function addAssistant() {
    const assistant = createAssistant(assistants.length + 1);
    onAssistantsChange([...assistants, assistant]);
    openIndividual(assistant);
  }

  async function duplicateAssistant(assistant: GlossaryAssistantResource) {
    assistant = await individual.load(assistant);
    const copy: GlossaryAssistantResource = {
      ...assistant,
      id: uniqueId("assistant"),
      name: `${assistant.name} — ${t("common.copy")}`,
      avatarRef: null,
      entries: assistant.entries.map((entry) => ({
        ...entry,
        id: uniqueId("entry"),
        aliases: [...entry.aliases],
        related: [...entry.related]
      })),
      fallbackResponses: [...assistant.fallbackResponses],
      lessonIds: [],
      collectionIds: [],
      projectPaths: []
    };
    onAssistantsChange([...assistants, copy]);
    selectAssistant(copy);
  }

  async function deleteAssistant(id: string) {
    const assistant = assistants.find((candidate) => candidate.id === id);
    if (!assistant) {
      return;
    }
    const collapsedByAssistant = readCollapsedEntryIdsByAssistant();
    delete collapsedByAssistant[id];
    writeCollapsedEntryIdsByAssistant(collapsedByAssistant);
    await onDeleteAssistant(id);
    setActionMenuId(null);
    setDeleteAssistantId(null);
    if (selectedAssistantId === id) {
      setSelectedAssistantId("");
    }
  }

  function addEntry() {
    if (!selectedAssistant) {
      return;
    }
    const entry = createEntry(selectedAssistant.entries.length + 1);
    updateAssistant(selectedAssistant.id, {
      entries: [...selectedAssistant.entries, entry]
    });
    setCollapsedEntryIds((current) => current.filter((entryId) => entryId !== entry.id));
  }

  function deleteEntry(entryId: string) {
    if (!selectedAssistant) {
      return;
    }
    updateAssistant(selectedAssistant.id, {
      entries: selectedAssistant.entries.filter((entry) => entry.id !== entryId)
    });
    setCollapsedEntryIds((current) => current.filter((id) => id !== entryId));
  }

  function deleteAllEntries() {
    if (!selectedAssistant) {
      return;
    }
    updateAssistant(selectedAssistant.id, {
      entries: []
    });
    setCollapsedEntryIds([]);
    setIsDeleteAllEntriesDialogOpen(false);
  }

  function toggleEntryCollapse(entryId: string) {
    setCollapsedEntryIds((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId]
    );
  }

  function toggleValue(list: string[], value: string, enabled: boolean) {
    if (enabled) {
      return list.includes(value) ? list : [...list, value];
    }
    return list.filter((item) => item !== value);
  }

  function projectPathsForCollections(collectionIds: string[]) {
    return lessonProjects
      .filter((entry) => entry.collection && collectionIds.includes(entry.collection))
      .map((entry) => entry.archivePath);
  }

  function assistantUsesProjectPath(assistant: GlossaryAssistantResource, projectPath: string) {
    if ((assistant.projectPaths ?? []).includes(projectPath)) {
      return true;
    }
    return assistant.collectionIds.some((collectionId) => projectPathsForCollections([collectionId]).includes(projectPath));
  }

  function applyAssistantAssociationPatch(
    selectedPatch: Partial<GlossaryAssistantResource>,
    reservedProjectPaths: string[]
  ) {
    if (!selectedAssistant) {
      return;
    }
    const reservedSet = new Set(reservedProjectPaths);
    for (const bank of assistants) {
      if (bank.id !== selectedAssistant.id && (bank.projectPaths ?? []).some(path => reservedSet.has(path))) pendingAssociationIds.current.add(bank.id);
    }
    onAssistantsChange(
      assistants.map((assistant) => {
        if (assistant.id === selectedAssistant.id) {
          const next = { ...assistant, ...selectedPatch };
          return { ...next, entries: sortAssistantEntries(next.entries) };
        }
        const nextCollectionIds = assistant.collectionIds.filter(
          (collectionId) => !projectPathsForCollections([collectionId]).some((projectPath) => reservedSet.has(projectPath))
        );
        const nextProjectPaths = (assistant.projectPaths ?? []).filter((projectPath) => !reservedSet.has(projectPath));
        return {
          ...assistant,
          collectionIds: nextCollectionIds,
          projectPaths: nextProjectPaths
        };
      })
    );
  }

  async function saveWithFeedback() {
    const dependencies = Array.from(pendingAssociationIds.current);
    await onSave(selectedAssistantId ? [selectedAssistantId, ...dependencies] : undefined, dependencies);
    pendingAssociationIds.current.clear();
  }

  function requestExclusiveAssociation(
    label: string,
    selectedPatch: Partial<GlossaryAssistantResource>,
    reservedProjectPaths: string[]
  ) {
    if (!selectedAssistant) {
      return;
    }
    const affectedAssistantNames = assistants
      .filter(
        (assistant) =>
          assistant.id !== selectedAssistant.id &&
          reservedProjectPaths.some((projectPath) => assistantUsesProjectPath(assistant, projectPath))
      )
      .map((assistant) => assistant.name);

    if (!affectedAssistantNames.length) {
      applyAssistantAssociationPatch(selectedPatch, reservedProjectPaths);
      return;
    }

    setPendingAssociationConflict({
      label,
      affectedAssistantNames,
      apply: () => {
        applyAssistantAssociationPatch(selectedPatch, reservedProjectPaths);
        setPendingAssociationConflict(null);
      }
    });
  }

  function updateAssistantProjects(projectPaths: string[]) {
    if (!selectedAssistant) {
      return;
    }
    updateAssistant(selectedAssistant.id, {
      projectPaths: Array.from(new Set(projectPaths))
    });
  }

  function enableAssistantProject(lessonTitle: string, projectPath: string) {
    if (!selectedAssistant) {
      return;
    }
    requestExclusiveAssociation(
      lessonTitle,
      {
        projectPaths: toggleValue(selectedAssistant.projectPaths ?? [], projectPath, true)
      },
      [projectPath]
    );
  }

  function updateAssistantCollections(collectionIds: string[]) {
    if (!selectedAssistant) {
      return;
    }
    const oldCollectionPaths = projectPathsForCollections(selectedAssistant.collectionIds);
    const directProjectPaths = (selectedAssistant.projectPaths ?? []).filter(
      (projectPath) => !oldCollectionPaths.includes(projectPath)
    );
    updateAssistant(selectedAssistant.id, {
      collectionIds,
      projectPaths: Array.from(new Set([...directProjectPaths, ...projectPathsForCollections(collectionIds)]))
    });
  }

  function enableAssistantCollection(collection: string) {
    if (!selectedAssistant) {
      return;
    }
    const nextCollectionIds = toggleValue(selectedAssistant.collectionIds, collection, true);
    const oldCollectionPaths = projectPathsForCollections(selectedAssistant.collectionIds);
    const directProjectPaths = (selectedAssistant.projectPaths ?? []).filter(
      (projectPath) => !oldCollectionPaths.includes(projectPath)
    );
    requestExclusiveAssociation(
      collection,
      {
        collectionIds: nextCollectionIds,
        projectPaths: Array.from(new Set([...directProjectPaths, ...projectPathsForCollections(nextCollectionIds)]))
      },
      projectPathsForCollections([collection])
    );
  }

  async function importXlsx(event: ChangeEvent<HTMLInputElement>) {
    if (!selectedAssistant) {
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      const entries = await importAssistantXlsx(file);
      const nextAssistants = assistants.map((assistant) => {
        if (assistant.id !== selectedAssistant.id) {
          return assistant;
        }
        return {
          ...assistant,
          entries: sortAssistantEntries(entries)
        };
      });
      onAssistantsChange(nextAssistants);
      setCollapsedEntryIds(entries.map((entry) => entry.id));
      await saveWithFeedback();
      setImportStatus({
        kind: "success",
        title: t("assistant.importSuccessTitle"),
        message: t("assistant.saveSuccess")
      });
    } catch (error) {
      setImportStatus({
        kind: "error",
        title: t("assistant.importErrorTitle"),
        message: error instanceof Error ? error.message : t("assistant.importErrorMessage")
      });
    }
  }

  async function exportXlsx(assistant: GlossaryAssistantResource) {
    assistant = await individual.load(assistant);
    const workbook = await exportAssistantXlsx(assistant.entries);
    await onExportXlsx(
      `${assistant.name.trim() || "assistant"}-glossaire.xlsx`,
      Array.from(new Uint8Array(await workbook.arrayBuffer()))
    );
  }

  async function exportPdf(assistant: GlossaryAssistantResource) {
    assistant = await individual.load(assistant);
    const { generateResourcePdf } = await import("../../../export/pdf/generateResourcePdf");
    const bytes = await generateResourcePdf("glossary", assistant.name, assistant.entries);
    await onExportPdf(`${assistant.name.trim() || "glossaire"}.pdf`, Array.from(bytes));
  }

  async function requestExport(assistant: GlossaryAssistantResource) {
    assistant = await individual.load(assistant);
    if (assistant.entries.length) setExportAssistantId(assistant.id);
    else void exportXlsx(assistant);
  }

  async function confirmRename() {
    const assistant = renameAssistantTarget;
    const name = renameAssistantName.trim();
    if (!assistant || !name || renameSaving) return;
    if (name === assistant.name) { setRenameAssistantId(null); return; }
    const previousAssistants = assistants;
    updateAssistant(assistant.id, { name });
    setRenameSaving(true);
    setRenameError("");
    try {
      await onSave([assistant.id]);
      setRenameAssistantId(null);
    } catch (error) {
      onAssistantsChange(previousAssistants);
      setRenameError(error instanceof Error ? error.message : String(error));
    } finally {
      setRenameSaving(false);
    }
  }

  const exportDialog = exportAssistantTarget ? (
    <div className="paideia-modal-backdrop" role="presentation">
      <section aria-labelledby="assistant-xlsx-export-title" aria-modal="true" className="paideia-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <p className="modal-kicker">{t("resources.assistant", undefined, "Glossaire")}</p>
        <h2 id="assistant-xlsx-export-title">{t("questionBank.exportCsv").replace(/CSV/gi, "XLSX")}</h2>
        <p>{t("resources.xlsxPlainTextWarning", undefined, "Le fichier XLSX contiendra les entrées du glossaire sous forme de texte lisible. Les couleurs, polices et autres mises en forme enrichies ne seront pas conservées lors d’une réimportation.")}</p>
        <div className="modal-actions">
          <button className="ghost-pill" onClick={() => setExportAssistantId(null)} type="button">{t("common.cancel")}</button>
          <button className="primary-pill" onClick={() => { setExportAssistantId(null); void exportXlsx(exportAssistantTarget); }} type="button">{t("questionBank.exportCsv").replace(/CSV/gi, "XLSX")}</button>
        </div>
      </section>
    </div>
  ) : null;

  const bulk = useResourceBankTransfer({
    banks: assistants,
    extensions: ["xlsx"],
    onImport: async (files) => {
      const names = new Set(assistants.map((assistant) => assistant.name.toLocaleLowerCase("fr")));
      const imported: GlossaryAssistantResource[] = [];
      for (const file of files) {
        const entries = await importAssistantXlsx(file);
        imported.push({
          ...createAssistant(assistants.length + imported.length + 1),
          name: uniqueBankName(bankNameFromFile(file.name), names),
          entries: sortAssistantEntries(entries)
        });
      }
      const next = [...assistants, ...imported];
      onAssistantsChange(next);
      try { await onSave(imported.map(bank => bank.id)); } catch (error) { onAssistantsChange(assistants); throw error; }
    },
    onExport: async (ids) => {
      const selected = await Promise.all(assistants.filter((assistant) => ids.includes(assistant.id)).map(individual.load));
      const files = await Promise.all(selected.map(async (assistant) => ({
        name: assistant.name,
        bytes: new Uint8Array(await (await exportAssistantXlsx(assistant.entries)).arrayBuffer())
      })));
      await onExportArchive("glossaires-paideia.zip", await exportBankPackage(files));
    }
  });

  if (!selectedAssistant) {
    return (
      <section className="assistant-resource-panel">
        {exportDialog}
        <div className="resource-bank-title-row">
          <p className="assistant-resource-count">{t(assistants.length > 1 ? "assistant.countPlural" : "assistant.count", { count: assistants.length })}</p>
          <CreateResourceButton label={t("assistant.addAssistant", undefined, "Ajouter un glossaire")} onClick={addAssistant} />
          {bulk.selectAll}
          {bulk.actions}
          <ResourceSortControl />
        </div>
        {bulk.error}
        {individual.notice}
        <ResourceNoResults count={sortedAssistants.length} />
        <div className="resource-portal-grid">
          {sortedAssistants.map((assistant) => {
            const avatarSrc = resolveAvatarSrc(assistant.avatarRef);

            return (
              <article className="resource-portal-card" key={assistant.id}>
                {bulk.checkbox(assistant)}
                <button
                  className="resource-portal-open"
                  onClick={() => openIndividual(assistant)}
                  type="button"
                >
                  <span className={`resource-portal-cover ${avatarSrc ? "" : "resource-portal-cover-empty"}`}>
                    {avatarSrc ? (
                      <img alt="" className="resource-portal-image" src={avatarSrc} />
                    ) : null}
                  </span>
                  <span className="resource-portal-body">
                    <span className="resource-portal-title">{assistant.name}</span>
                    <span className="resource-portal-subtitle">{t((assistant.contentCount ?? assistant.entries.length) === 1 ? "assistant.entryCount" : "assistant.entryCountPlural", { count: assistant.contentCount ?? assistant.entries.length })}</span>
                  </span>
                </button>
                <button
                  className="library-card-menu-toggle resource-character-menu-toggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActionMenuId((current) => (current === assistant.id ? null : assistant.id));
                  }}
                  type="button"
                >
                  ...
                </button>
                {actionMenuId === assistant.id ? (
                  <div className="library-card-menu resource-character-menu">
                    <button
                      onClick={() => {
                        setActionMenuId(null);
                        openIndividual(assistant);
                      }}
                      type="button"
                    >
                      {t("common.configure", undefined, "Configurer")}
                    </button>
                    <button onClick={() => { setActionMenuId(null); setRenameError(""); setRenameAssistantId(assistant.id); setRenameAssistantName(assistant.name); }} type="button">{t("common.rename")}</button>
                    <button onClick={() => { setActionMenuId(null); void requestExport(assistant).catch(individual.report); }} type="button">{t("references.export")}</button>
                    <button onClick={() => { setActionMenuId(null); void exportPdf(assistant); }} type="button">{t("library.generatePdf")}</button>
                    <button onClick={() => { setActionMenuId(null); void duplicateAssistant(assistant).catch(individual.report); }} type="button">{t("common.duplicate")}</button>
                    <button
                      className="danger"
                      onClick={() => {
                        setActionMenuId(null);
                        setDeleteAssistantId(assistant.id);
                      }}
                      type="button"
                    >
                      <span className="assistant-resource-button-icon"><TrashIcon /></span>
                      {t("common.delete")}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {renameAssistantTarget ? <div className="paideia-modal-backdrop" role="presentation"><section className="paideia-modal" role="dialog" aria-modal="true" aria-labelledby="assistant-rename-title">
          <h2 id="assistant-rename-title">{t("common.rename")}</h2>
          <label className="modal-field">{t("common.name")}<input autoFocus disabled={renameSaving} value={renameAssistantName} onChange={(event) => setRenameAssistantName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void confirmRename(); }} /></label>
          {renameError ? <p role="alert">{renameError}</p> : null}
          <div className="modal-actions"><button className="ghost-pill" disabled={renameSaving} onClick={() => setRenameAssistantId(null)} type="button">{t("common.cancel")}</button><button className="primary-pill" disabled={renameSaving || !renameAssistantName.trim()} onClick={() => void confirmRename()} type="button">{t("common.save")}</button></div>
        </section></div> : null}
        {deleteAssistantTarget ? (
          <div className="paideia-modal-backdrop" role="presentation">
            <section
              aria-labelledby="delete-assistant-title"
              aria-modal="true"
              className="paideia-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <p className="modal-kicker">{t("assistant.deleteTitle")}</p>
              <h2 id="delete-assistant-title">{t("assistant.confirmDeleteNamed", { name: deleteAssistantTarget.name })}</h2>
              <p>{t("assistant.deleteProjectMessage")}</p>
              <div className="modal-actions">
                <button className="ghost-pill" onClick={() => setDeleteAssistantId(null)} type="button">
                  {t("common.cancel")}
                </button>
                <button className="danger-pill" onClick={() => void deleteAssistant(deleteAssistantTarget.id)} type="button">
                  {t("common.delete")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    );
  }

  const saveButtonStateClass = saveFeedbackState === "saving"
    ? "is-saving"
    : saveFeedbackState === "saved"
      ? "is-saved"
      : saveFeedbackState === "error"
        ? "is-error"
        : "";

  return (
    <section className="assistant-resource-panel">
      <div className="assistant-resource-topbar">
        <button className="assistant-resource-button assistant-resource-back-button" onClick={() => setSelectedAssistantId("")} type="button">
          <span className="assistant-resource-button-icon"><BackIcon /></span>
          {t("resources.backToTiles", undefined, "Retour aux tuiles")}
        </button>
        <div className="assistant-resource-save-area">
          <button
            className={`resource-save-button active assistant-resource-button assistant-resource-save-button ${saveButtonStateClass}`}
            disabled={saveFeedbackState === "saving"}
            onClick={() => void saveWithFeedback().catch(() => undefined)}
            type="button"
          >
            <span className={`assistant-resource-button-icon ${saveFeedbackState === "saving" ? "is-spinning" : ""}`}>
              {saveFeedbackState === "saving"
                ? <SpinnerIcon />
                : saveFeedbackState === "saved"
                  ? <CheckIcon />
                  : saveFeedbackState === "error"
                    ? <ErrorIcon />
                    : <SaveIcon />}
            </span>
            {t("common.save")}
          </button>
        </div>
      </div>

      <div className="assistant-resource-editor">
        <section className="assistant-resource-card assistant-resource-overview">
          <div className="assistant-resource-overview-avatar">
            <span className="assistant-resource-eyebrow">{t("assistant.avatar")}</span>
            <div className="assistant-resource-avatar-row assistant-resource-avatar-row-large">
              {selectedAssistantAvatarSrc ? (
                <img alt="" src={selectedAssistantAvatarSrc} />
              ) : (
                <span className="assistant-resource-avatar-empty">{t("assistant.noAvatar")}</span>
              )}
              <label className="assistant-resource-button assistant-resource-image-button">
                <span className="assistant-resource-image-button-content">
                  <span className="assistant-resource-button-icon"><ImageIcon /></span>
                  <span className="assistant-resource-image-button-label">{t("editor.chooseImage")}</span>
                </span>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    if (file) {
                      onAvatarUpload(selectedAssistant.id, file);
                    }
                  }}
                  type="file"
                />
              </label>
            </div>
          </div>
          <div className="assistant-resource-overview-fields">
            <label>
              <span>{t("common.name", undefined, "Nom")}</span>
              <input
                onChange={(event) => updateAssistant(selectedAssistant.id, { name: event.target.value })}
                value={selectedAssistant.name}
              />
            </label>
            <label>
              <span>{t("assistant.position")}</span>
              <select
                onChange={(event) =>
                  updateAssistant(selectedAssistant.id, {
                    position: event.target.value === "bottom-right" ? "bottom-right" : "bottom-left"
                  })
                }
                value={selectedAssistant.position}
              >
                <option value="bottom-left">{t("assistant.bottomLeft")}</option>
                <option value="bottom-right">{t("assistant.bottomRight")}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="assistant-resource-card assistant-resource-settings-card">
          <div className="assistant-resource-card-head">
            <div>
              <h3>{t("common.settings")}</h3>
            </div>
          </div>
          <div className="assistant-resource-check-grid">
            <label className="assistant-resource-option-row">
              <input
                className="assistant-resource-option-control"
                checked={selectedAssistant.alwaysVisible}
                onChange={(event) => updateAssistant(selectedAssistant.id, { alwaysVisible: event.target.checked })}
                type="checkbox"
              />
              <span className="assistant-resource-option-label">{t("assistant.alwaysVisible")}</span>
            </label>
            <label className="assistant-resource-option-row">
              <input
                className="assistant-resource-option-control"
                checked={selectedAssistant.caseInsensitive}
                onChange={(event) => updateAssistant(selectedAssistant.id, { caseInsensitive: event.target.checked })}
                type="checkbox"
              />
              <span className="assistant-resource-option-label">{t("assistant.caseInsensitive")}</span>
            </label>
            <label className="assistant-resource-option-row">
              <input
                className="assistant-resource-option-control"
                checked={selectedAssistant.ignoreAccents}
                onChange={(event) => updateAssistant(selectedAssistant.id, { ignoreAccents: event.target.checked })}
                type="checkbox"
              />
              <span className="assistant-resource-option-label">{t("assistant.ignoreAccents")}</span>
            </label>
            <label className="assistant-resource-option-row">
              <input
                className="assistant-resource-option-control"
                checked={selectedAssistant.fuzzyEnabled}
                onChange={(event) => updateAssistant(selectedAssistant.id, { fuzzyEnabled: event.target.checked })}
                type="checkbox"
              />
              <span className="assistant-resource-option-label">{t("assistant.spellingTolerance")}</span>
            </label>
          </div>
          <p className="assistant-resource-shortcut-hint">{t("assistant.keyboardShortcut")}</p>
        </section>

        <section className="assistant-resource-card assistant-resource-associations-card">
          <div className="assistant-resource-card-head">
            <h3>{t("assistant.associations")}</h3>
          </div>
          <div className="assistant-resource-associations">
            <div className="assistant-resource-association-panel">
              <h4>{t("resource.assistant.lessons", undefined, "Leçons")}</h4>
              <div className="assistant-resource-selection-list">
                {lessonProjects.map((lesson) => (
                  <label className="assistant-resource-option-row" key={lesson.archivePath}>
                    <input
                      className="assistant-resource-option-control"
                      checked={(selectedAssistant.projectPaths ?? []).includes(lesson.archivePath)}
                      onChange={(event) =>
                        event.target.checked
                          ? enableAssistantProject(lesson.title, lesson.archivePath)
                          : updateAssistantProjects(
                              toggleValue(selectedAssistant.projectPaths ?? [], lesson.archivePath, false)
                            )
                      }
                      type="checkbox"
                    />
                    <span className="assistant-resource-option-label">{lesson.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="assistant-resource-association-panel">
              <h4>{t("library.collections")}</h4>
              <div className="assistant-resource-selection-list">
                {collections.length ? (
                  collections.map((collection) => (
                    <label className="assistant-resource-option-row" key={collection}>
                      <input
                        className="assistant-resource-option-control"
                        checked={selectedAssistant.collectionIds.includes(collection)}
                        onChange={(event) =>
                          event.target.checked
                            ? enableAssistantCollection(collection)
                            : updateAssistantCollections(toggleValue(selectedAssistant.collectionIds, collection, false))
                        }
                        type="checkbox"
                      />
                      <span className="assistant-resource-option-label">{collection}</span>
                    </label>
                  ))
                ) : (
                  <p className="assistant-resource-hint">{t("library.noCollection")}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="assistant-resource-card assistant-resource-glossary-card">
          <div className="assistant-resource-glossary-toolbar">
            <div className="assistant-resource-glossary-title">
              <h3>{t("assistant.glossaryEntries")}</h3>
              <span className="assistant-resource-count-pill">{selectedAssistant.entries.length}</span>
            </div>
            <div className="assistant-resource-toolbar-actions">
              <div className="assistant-resource-secondary-actions">
                <button className="assistant-resource-button assistant-resource-secondary-button" onClick={() => fileInputRef.current?.click()} type="button">
                  <span className="assistant-resource-button-icon"><ImportIcon /></span>
                  {t("questionBank.importCsv").replace(/CSV/gi, "XLSX")}
                </button>
                <button
                  className="assistant-resource-button assistant-resource-secondary-button"
                  onClick={() => requestExport(selectedAssistant)}
                  type="button"
                >
                  <span className="assistant-resource-button-icon"><ExportIcon /></span>
                  {t("questionBank.exportCsv").replace(/CSV/gi, "XLSX")}
                </button>
                <button className="assistant-resource-button assistant-resource-secondary-button" onClick={() => void exportPdf(selectedAssistant)} type="button">{t("library.generatePdf")}</button>
              </div>
              <button className="assistant-resource-button assistant-resource-primary-button" onClick={addEntry} type="button">
                <span className="assistant-resource-button-icon"><PlusIcon /></span>
                {t("resource.assistant.addEntry", undefined, "Ajouter une entrée")}
              </button>
              <button
                className="assistant-resource-button assistant-resource-danger-button"
                disabled={selectedAssistant.entries.length === 0}
                onClick={() => setIsDeleteAllEntriesDialogOpen(true)}
                type="button"
              >
                <span className="assistant-resource-button-icon"><TrashIcon /></span>
                {t("assistant.deleteAllEntries")}
              </button>
            </div>
            <input accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={importXlsx} ref={fileInputRef} type="file" />
          </div>

          <div className="assistant-resource-entry-list">
            {selectedAssistant.entries.map((entry, index) => {
              const isCollapsed = collapsedEntryIds.includes(entry.id);
              const entryLabel = entry.term.trim() || t("assistant.entryNumber", { count: index + 1 });

              return (
                <article className={`assistant-resource-entry ${isCollapsed ? "collapsed" : "expanded"}`} key={entry.id}>
                  <div className="assistant-resource-entry-head">
                    <button
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? t("assistant.expandEntry", { name: entryLabel }) : t("assistant.collapseEntry", { name: entryLabel })}
                      className="assistant-resource-entry-toggle"
                      onClick={() => toggleEntryCollapse(entry.id)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`assistant-resource-entry-chevron ${isCollapsed ? "collapsed" : "expanded"}`}
                      />
                    </button>
                    <div className="assistant-resource-entry-summary">
                      <strong>{entryLabel}</strong>
                    </div>
                    <button
                      aria-label={`${t("common.delete")} ${entryLabel}`}
                      className="assistant-resource-icon-danger-button"
                      onClick={() => deleteEntry(entry.id)}
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  {isCollapsed ? null : (
                    <div className="assistant-resource-entry-body">
                      <div className="assistant-resource-form-grid">
                        <label>
                          <span>{t("assistant.term", undefined, "Terme")}</span>
                          <input
                            onChange={(event) => updateEntry(entry.id, { term: event.target.value })}
                            placeholder={t("assistant.termPlaceholder", undefined, "Terme du glossaire")}
                            value={entry.term}
                          />
                        </label>
                        <label>
                          <span>{t("assistant.synonyms")}</span>
                          <input
                            onBlur={(event) => updateEntry(entry.id, { aliases: splitList(event.target.value) })}
                            placeholder={t("assistant.pipeSeparated")}
                            defaultValue={listToText(entry.aliases)}
                          />
                        </label>
                        <label>
                          <span>{t("assistant.relatedTerms")}</span>
                          <input
                            onBlur={(event) => updateEntry(entry.id, { related: splitList(event.target.value) })}
                            placeholder={t("assistant.pipeSeparated")}
                            defaultValue={listToText(entry.related)}
                          />
                        </label>
                        <label>
                          <span>{t("assistant.allowSmallTypos")}</span>
                          <select
                            onChange={(event) => updateEntry(entry.id, { fuzzy: event.target.value === "true" })}
                            value={entry.fuzzy ? "true" : "false"}
                          >
                            <option value="true">{t("common.yes")}</option>
                            <option value="false">{t("common.no")}</option>
                          </select>
                        </label>
                        <div className="assistant-resource-wide assistant-resource-definition-field">
                          <span>{t("assistant.definition")}</span>
                          {renderDefinitionField({
                            assistantId: selectedAssistant.id,
                            entry,
                            html: entry.contentHtml,
                            onCommit: (html) => updateEntry(entry.id, { contentHtml: html }),
                            placeholder: t("assistant.definitionPlaceholder")
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {selectedAssistant.entries.length === 0 ? (
              <p className="assistant-resource-empty">{t("assistant.emptyEntries")}</p>
            ) : null}
          </div>
        </section>
      </div>
      {pendingAssociationConflict ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section
            aria-labelledby="assistant-association-conflict-title"
            aria-modal="true"
            className="paideia-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <p className="modal-kicker">{t("assistant.associationKicker")}</p>
            <h2 id="assistant-association-conflict-title">{t("assistant.replaceAssociationTitle")}</h2>
            <p>{t("assistant.associationConflictMessage", {
              label: pendingAssociationConflict.label,
              names: pendingAssociationConflict.affectedAssistantNames.join(", ")
            })}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={() => setPendingAssociationConflict(null)} type="button">
                {t("common.cancel")}
              </button>
              <button className="danger-pill" onClick={pendingAssociationConflict.apply} type="button">
                {t("common.replace")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {importStatus ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section
            aria-labelledby="assistant-xlsx-import-status-title"
            aria-modal="true"
            className="paideia-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <p className="modal-kicker">{(importStatus.kind === "success" ? t("questionBank.importCsv") : t("questionBank.importCsvError")).replace(/CSV/gi, "XLSX")}</p>
            <h2 id="assistant-xlsx-import-status-title">{importStatus.title}</h2>
            <p>{importStatus.message}</p>
            <div className="modal-actions">
              <button className="ghost-pill active" onClick={() => setImportStatus(null)} type="button">
                {t("common.ok")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {exportDialog}
      {isDeleteAllEntriesDialogOpen ? (
        <div className="paideia-modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-all-assistant-entries-title"
            aria-modal="true"
            className="paideia-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <p className="modal-kicker">{t("assistant.deleteGlossaryKicker")}</p>
            <h2 id="delete-all-assistant-entries-title">{t("assistant.deleteAllEntriesQuestion")}</h2>
            <p>{t("assistant.deleteAllEntriesMessage")}</p>
            <div className="modal-actions">
              <button className="ghost-pill" onClick={() => setIsDeleteAllEntriesDialogOpen(false)} type="button">
                {t("common.cancel")}
              </button>
              <button className="danger-pill" onClick={deleteAllEntries} type="button">
                {t("assistant.deleteAllEntries")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
