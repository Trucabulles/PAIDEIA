import { FlipCardsItemEditor, type FlipCardsItemEditorProps } from "./FlipCardsItemEditor";
import { useI18n } from "../../../i18n/react";

export type FlipCardsActivityEditorProps = FlipCardsItemEditorProps & {
  onAddItem: () => void;
};

export function FlipCardsActivityEditor({ onAddItem, ...itemEditorProps }: FlipCardsActivityEditorProps) {
  const { t } = useI18n();
  return (
    <div className="inspector-span-2 activity-items-editor">
      <div className="interactive-editor-header">
        <span className="editor-label">{t("activity.flip-cards")}</span>
        <button className="ghost-pill" onClick={onAddItem} type="button">
          {t("editor.addItem", undefined, "Ajouter un élément")}
        </button>
      </div>
      <div className="activity-item-editor-list">
        <FlipCardsItemEditor {...itemEditorProps} />
      </div>
    </div>
  );
}
