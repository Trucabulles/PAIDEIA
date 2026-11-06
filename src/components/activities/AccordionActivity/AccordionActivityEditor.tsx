import { AccordionItemEditor, type AccordionItemEditorProps } from "./AccordionItemEditor";
import { useI18n } from "../../../i18n/react";

export type AccordionActivityEditorProps = AccordionItemEditorProps & {
  onAddItem: () => void;
};

export function AccordionActivityEditor({ onAddItem, ...itemEditorProps }: AccordionActivityEditorProps) {
  const { t } = useI18n();
  return (
    <div className="inspector-span-2 activity-items-editor">
      <div className="interactive-editor-header">
        <span className="editor-label">{t("accordion.panels", undefined, "Panneaux de l'accordéon")}</span>
        <button className="ghost-pill" onClick={onAddItem} type="button">
          {t("editor.addItem", undefined, "Ajouter un élément")}
        </button>
      </div>
      <div className="activity-item-editor-list">
        <AccordionItemEditor {...itemEditorProps} />
      </div>
    </div>
  );
}
