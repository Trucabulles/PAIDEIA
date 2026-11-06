import type { ActivityItem } from "../../../types/project";
import { TimelineActivityEditor } from "./TimelineActivityEditor";
import { TimelineItemsEditor } from "./TimelineItemsEditor";

type TimelineActivityEditorPanelProps = {
  collapsedItemIds: string[];
  color: string;
  items: ActivityItem[];
  onColorChange: (value: string) => void;
  onRemoveItem: (itemId: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
};

export function TimelineActivityEditorPanel({
  collapsedItemIds,
  color,
  items,
  onColorChange,
  onRemoveItem,
  onToggleCollapse,
  onUpdateItem
}: TimelineActivityEditorPanelProps) {
  return (
    <>
      <div className="inspector-span-2">
        <TimelineActivityEditor color={color} onColorChange={onColorChange} />
      </div>
      <TimelineItemsEditor
        collapsedItemIds={collapsedItemIds}
        defaultColor={color}
        items={items}
        onRemoveItem={onRemoveItem}
        onToggleCollapse={onToggleCollapse}
        onUpdateItem={onUpdateItem}
      />
    </>
  );
}
