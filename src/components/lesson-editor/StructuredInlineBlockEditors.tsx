import type { ReactNode } from "react";
import type { BlockFormState } from "../../app/appStateTypes";
import type { ActivityItem, PaideiaBlock } from "../../types/project";
import { QuoteActivityEditorPanel } from "../activities/QuoteActivity";
import { TimelineActivityEditorPanel } from "../activities/TimelineActivity";

type StructuredInlineBlockEditorsProps = {
  block: PaideiaBlock;
  collapsedItemIds: string[];
  items: ActivityItem[];
  onChange: (patch: Partial<BlockFormState>) => void;
  onRemoveItem: (itemId: string) => void;
  onTimelineColorChange: (value: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  quoteAuthorField: ReactNode;
  value: BlockFormState;
};

export function StructuredInlineBlockEditors({
  block,
  collapsedItemIds,
  items,
  onChange,
  onRemoveItem,
  onTimelineColorChange,
  onToggleCollapse,
  onUpdateItem,
  quoteAuthorField,
  value
}: StructuredInlineBlockEditorsProps) {
  return (
    <>
      {block.type === "quote" ? (
        <QuoteActivityEditorPanel
          authorField={quoteAuthorField}
          onChange={onChange}
          value={value}
        />
      ) : null}
      {block.type === "timeline" ? (
        <TimelineActivityEditorPanel
          collapsedItemIds={collapsedItemIds}
          color={value.panelBorderColor}
          items={items}
          onColorChange={onTimelineColorChange}
          onRemoveItem={onRemoveItem}
          onToggleCollapse={onToggleCollapse}
          onUpdateItem={onUpdateItem}
        />
      ) : null}
    </>
  );
}
