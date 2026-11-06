import type { PaideiaBlock, PaideiaChapter, PaideiaWorkspaceState } from "../types/project";

export function richTextFieldKey(projectPath: string, blockId: string, itemId?: string | null, field?: string | null) {
  return JSON.stringify([projectPath, blockId, itemId ?? null, field ?? null]);
}

function equal(left: unknown, right: unknown) {
  return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Rebase a live draft on a refreshed persisted value. Local edits win conflicts;
// untouched fields accept the refresh, including assets on another item.
export function rebaseEditorDraft<T>(base: T, draft: T, incoming: T): T {
  if (equal(base, draft)) return incoming;
  if (equal(base, incoming) || equal(draft, incoming)) return draft;
  if (Array.isArray(base) && Array.isArray(draft) && Array.isArray(incoming)) {
    const identified = (values: unknown[]) => values.every(value => record(value) && typeof value.id === "string")
      && new Set(values.map(value => (value as { id: string }).id)).size === values.length;
    if (identified(base) && identified(draft) && identified(incoming)) {
      const previous = new Map(base.map(value => [value.id, value]));
      const local = new Map(draft.map(value => [value.id, value]));
      const remote = new Map(incoming.map(value => [value.id, value]));
      const locallyReordered = !equal(base.map(value => value.id), draft.map(value => value.id));
      const order = locallyReordered ? [...local.keys(), ...remote.keys()] : [...remote.keys(), ...local.keys()];
      const result = [];
      for (const id of new Set(order)) {
        if (!local.has(id) && previous.has(id)) continue; // deleted in the draft
        if (!remote.has(id) && equal(previous.get(id), local.get(id))) continue;
        result.push(local.has(id)
          ? rebaseEditorDraft(previous.get(id), local.get(id), remote.get(id))
          : remote.get(id));
      }
      return result as T;
    }
    return draft;
  }
  if (record(base) && record(draft) && record(incoming)) {
    const result: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(draft), ...Object.keys(incoming)])) {
      const value = rebaseEditorDraft(base[key], draft[key], incoming[key]);
      if (value !== undefined) result[key] = value;
    }
    return result as T;
  }
  return draft;
}

// A text save returns an entire workspace. Only merge the saved block into the
// live workspace: an old reply must not remove newly created blocks or revive
// deleted ones, nor replace unrelated edits or the current lesson.
export function mergeInlineBlockSave(
  current: PaideiaWorkspaceState,
  saved: PaideiaWorkspaceState,
  before: PaideiaBlock
): PaideiaWorkspaceState {
  if (current.project.id !== saved.project.id) return current;
  const savedBlock = saved.project.course.modules.flatMap(module => module.chapters)
    .flatMap(chapter => chapter.pages).flatMap(page => page.blocks).find(block => block.id === before.id);
  if (!savedBlock) return current;
  const knownEvents = new Set(current.auditEvents.map(event => event.id));
  return {
    ...current,
    auditEvents: [...current.auditEvents, ...saved.auditEvents.filter(event => !knownEvents.has(event.id))],
    project: {
      ...current.project,
      updatedAt: current.project.updatedAt > saved.project.updatedAt ? current.project.updatedAt : saved.project.updatedAt,
      course: {
        ...current.project.course,
        modules: current.project.course.modules.map(module => ({
          ...module,
          chapters: module.chapters.map(chapter => ({
            ...chapter,
            pages: chapter.pages.map(page => ({
              ...page,
              blocks: page.blocks.map(block => block.id === before.id ? rebaseEditorDraft(before, block, savedBlock) : block)
            }))
          }))
        }))
      }
    }
  };
}

// A plain title save must not replace pages, blocks, other chapter properties,
// or a newer local title with the complete workspace returned by the backend.
export function mergeChapterTitleSave(
  current: PaideiaWorkspaceState,
  saved: PaideiaWorkspaceState,
  before: Pick<PaideiaChapter, "id" | "title">,
  moduleId: string
): PaideiaWorkspaceState {
  if (current.project.id !== saved.project.id) return current;
  const incoming = saved.project.course.modules.find(module => module.id === moduleId)?.chapters.find(chapter => chapter.id === before.id);
  if (!incoming) return current;
  const events = new Set(current.auditEvents.map(event => event.id));
  return { ...current,
    auditEvents: [...current.auditEvents, ...saved.auditEvents.filter(event => !events.has(event.id))],
    project: { ...current.project,
      updatedAt: current.project.updatedAt > saved.project.updatedAt ? current.project.updatedAt : saved.project.updatedAt,
      course: { ...current.project.course, modules: current.project.course.modules.map(module => module.id !== moduleId ? module : ({ ...module,
        chapters: module.chapters.map(chapter => chapter.id === before.id && chapter.title === before.title
          ? { ...chapter, title: incoming.title } : chapter)
      })) }
    }
  };
}
