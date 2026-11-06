import type { PaideiaBlock } from "../types/project";
import { richTextFieldKey } from "./editorStateSafety";

type PendingText = { html: string; sequence: number; failed: boolean };

// Submitted text belongs to the field identity, not to a particular mounted
// editor. Navigation and old save replies must not discard the latest value.
export function createPendingInlineTextStore() {
  let snapshot: ReadonlyMap<string, PendingText> = new Map();
  let sequence = 0;
  const listeners = new Set<() => void>();
  const publish = (next: Map<string, PendingText>) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    get: (key: string) => snapshot.get(key),
    begin(key: string, html: string) {
      const ticket = { key, sequence: ++sequence };
      publish(new Map(snapshot).set(key, { html, sequence: ticket.sequence, failed: false }));
      return ticket;
    },
    settle(ticket: { key: string; sequence: number }, succeeded: boolean) {
      const pending = snapshot.get(ticket.key);
      if (!pending || pending.sequence !== ticket.sequence) return;
      const next = new Map(snapshot);
      if (succeeded) next.delete(ticket.key);
      else next.set(ticket.key, { ...pending, failed: true });
      publish(next);
    }
  };
}

export const pendingInlineText = createPendingInlineTextStore();

// Presentation only: do not put pending values into the workspace used to
// compare and persist changes, otherwise a save could mistake them for disk data.
export function blockWithPendingInlineText(
  block: PaideiaBlock, projectPath: string, pending: ReadonlyMap<string, PendingText>
): PaideiaBlock {
  if (!pending.size || !block.activityItems?.length) return block;
  let changed = false;
  const activityItems = block.activityItems.map(item => {
    let next = item;
    for (const field of ["title", "contentTitle", "contentHtml", "dateLabel"] as const) {
      const value = pending.get(richTextFieldKey(projectPath, block.id, item.id, field));
      if (!value) continue;
      next = { ...next, [field]: value.html };
      if (block.type === "tabs" && field === "contentHtml") next.contentTitle = null;
    }
    changed ||= next !== item;
    return next;
  });
  return changed ? { ...block, activityItems } : block;
}
