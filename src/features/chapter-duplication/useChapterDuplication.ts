import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ChapterEntry } from "../../app/projectSelectors";
import type { TranslationParams } from "../../i18n";
import {
  createSnapshot,
  inspectChapterAssetDuplicates,
  pasteChapter,
  type ChapterAssetDuplicate,
  type ChapterAssetReuse
} from "../../lib/projectApi";
import type { PaideiaChapter, PaideiaProject, PaideiaWorkspaceState } from "../../types/project";

type Translator = (key: string, params?: TranslationParams, fallback?: string) => string;
type RunAction = (actionKey: string, work: () => Promise<void>) => Promise<void>;

export type ChapterClipboard = {
  sourceProjectPath: string;
  sourceProjectId: string;
  sourceProjectTitle: string;
  chapter: PaideiaChapter;
  copiedAt: number;
};

export type ChapterPasteTarget = {
  moduleId: string;
  index: number;
};

export type ChapterAssetConflict = {
  target: ChapterPasteTarget;
  duplicates: ChapterAssetDuplicate[];
  reusedSourceRefs: Set<string>;
};

export type ChapterOperationKind = "duplicate" | "paste";

type UseChapterDuplicationOptions = {
  currentProjectPath: string;
  project: PaideiaProject | null;
  runAction: RunAction;
  setWorkspaceState: Dispatch<SetStateAction<PaideiaWorkspaceState | null>>;
  t: Translator;
};

function cloneChapter(chapter: PaideiaChapter): PaideiaChapter {
  return structuredClone(chapter);
}

function chapterBelongsToProject(project: PaideiaProject, entry: ChapterEntry) {
  return project.course.modules.some(
    (module) => module.id === entry.module.id && module.chapters.some((chapter) => chapter.id === entry.chapter.id)
  );
}

export function useChapterDuplication({
  currentProjectPath,
  project,
  runAction,
  setWorkspaceState,
  t
}: UseChapterDuplicationOptions) {
  const [clipboard, setClipboard] = useState<ChapterClipboard | null>(null);
  const [copyConfirmation, setCopyConfirmation] = useState<ChapterEntry | null>(null);
  const [assetConflict, setAssetConflict] = useState<ChapterAssetConflict | null>(null);
  const [operationKind, setOperationKind] = useState<ChapterOperationKind | null>(null);
  const operationLockRef = useRef(false);

  useEffect(() => {
    setCopyConfirmation(null);
    setAssetConflict(null);
    operationLockRef.current = false;
    setOperationKind(null);
  }, [currentProjectPath]);

  function beginOperation(kind: ChapterOperationKind) {
    if (operationLockRef.current) {
      return false;
    }
    operationLockRef.current = true;
    setOperationKind(kind);
    return true;
  }

  function endOperation() {
    operationLockRef.current = false;
    setOperationKind(null);
  }

  function requestCopy(entry: ChapterEntry) {
    if (!project || !chapterBelongsToProject(project, entry)) return;
    setCopyConfirmation(entry);
  }

  function confirmCopy() {
    if (!copyConfirmation || !project || !chapterBelongsToProject(project, copyConfirmation)) {
      setCopyConfirmation(null);
      return;
    }
    setClipboard({
      sourceProjectPath: currentProjectPath,
      sourceProjectId: project.id,
      sourceProjectTitle: project.title,
      chapter: cloneChapter(copyConfirmation.chapter),
      copiedAt: Date.now()
    });
    setAssetConflict(null);
    setCopyConfirmation(null);
  }

  function cancelCopy() {
    setCopyConfirmation(null);
  }

  function cancelPendingPaste() {
    if (operationLockRef.current) {
      return;
    }
    setClipboard(null);
    setAssetConflict(null);
  }

  function cancelAssetConflict() {
    if (operationLockRef.current) {
      return;
    }
    setAssetConflict(null);
  }

  async function executePaste(
    source: ChapterClipboard,
    target: ChapterPasteTarget,
    assetReuse: ChapterAssetReuse[],
    consumeClipboard: boolean,
    actionKey: "duplicate-chapter" | "paste-chapter"
  ) {
    if (!project) return;
    await runAction(actionKey, async () => {
      await createSnapshot({
        projectPath: currentProjectPath,
        label: actionKey === "duplicate-chapter"
          ? t("snapshot.beforeChapterDuplicate", { title: source.chapter.title }, `Avant duplication du chapitre « ${source.chapter.title} »`)
          : t("snapshot.beforeChapterPaste", { title: source.chapter.title }, `Avant collage du chapitre « ${source.chapter.title} »`),
        versionTag: project?.currentVersion ?? "autosave"
      });
      const nextState = await pasteChapter({
        sourceProjectPath: source.sourceProjectPath,
        sourceProjectId: source.sourceProjectId,
        targetProjectPath: currentProjectPath,
        targetProjectId: project.id,
        targetModuleId: target.moduleId,
        targetIndex: target.index,
        chapter: source.chapter,
        assetReuse
      });
      setWorkspaceState(nextState);
      setAssetConflict(null);
      if (consumeClipboard) {
        setClipboard(null);
      }
    });
  }

  async function duplicate(entry: ChapterEntry) {
    if (!project || !chapterBelongsToProject(project, entry) || !beginOperation("duplicate")) {
      return;
    }
    const source: ChapterClipboard = {
      sourceProjectPath: currentProjectPath,
      sourceProjectId: project.id,
      sourceProjectTitle: project.title,
      chapter: cloneChapter(entry.chapter),
      copiedAt: Date.now()
    };
    const sourceIndex = entry.module.chapters.findIndex((chapter) => chapter.id === entry.chapter.id);
    try {
      await executePaste(
        source,
        { moduleId: entry.module.id, index: sourceIndex < 0 ? entry.module.chapters.length : sourceIndex + 1 },
        [],
        false,
        "duplicate-chapter"
      );
    } finally {
      endOperation();
    }
  }

  async function requestPaste(target: ChapterPasteTarget) {
    if (!clipboard || !beginOperation("paste")) {
      return;
    }
    try {
      const duplicates = await inspectChapterAssetDuplicates({
        sourceProjectPath: clipboard.sourceProjectPath,
        targetProjectPath: currentProjectPath,
        chapter: clipboard.chapter
      });
      if (duplicates.length > 0) {
        setAssetConflict({ target, duplicates, reusedSourceRefs: new Set() });
        return;
      }
      await executePaste(clipboard, target, [], true, "paste-chapter");
    } finally {
      endOperation();
    }
  }

  function toggleAssetReuse(sourceAssetRef: string) {
    setAssetConflict((current) => {
      if (!current) {
        return current;
      }
      const reusedSourceRefs = new Set(current.reusedSourceRefs);
      if (reusedSourceRefs.has(sourceAssetRef)) {
        reusedSourceRefs.delete(sourceAssetRef);
      } else {
        reusedSourceRefs.add(sourceAssetRef);
      }
      return { ...current, reusedSourceRefs };
    });
  }

  function toggleAllAssetReuse() {
    setAssetConflict((current) => {
      if (!current) {
        return current;
      }
      const allSelected = current.reusedSourceRefs.size === current.duplicates.length;
      return {
        ...current,
        reusedSourceRefs: allSelected
          ? new Set()
          : new Set(current.duplicates.map((duplicate) => duplicate.sourceAssetRef))
      };
    });
  }

  async function confirmAssetChoices() {
    if (!clipboard || !assetConflict || !beginOperation("paste")) {
      return;
    }
    const assetReuse = assetConflict.duplicates
      .filter((duplicate) => assetConflict.reusedSourceRefs.has(duplicate.sourceAssetRef))
      .map((duplicate) => ({
        sourceAssetRef: duplicate.sourceAssetRef,
        targetAssetRef: duplicate.existingAssetRef
      }));
    try {
      await executePaste(clipboard, assetConflict.target, assetReuse, true, "paste-chapter");
    } finally {
      endOperation();
    }
  }

  return {
    assetConflict,
    cancelAssetConflict,
    cancelCopy,
    cancelPendingPaste,
    clipboard,
    confirmAssetChoices,
    confirmCopy,
    copyConfirmation,
    duplicate,
    operationKind,
    operationPending: operationKind !== null,
    requestCopy,
    requestPaste,
    toggleAllAssetReuse,
    toggleAssetReuse
  };
}
