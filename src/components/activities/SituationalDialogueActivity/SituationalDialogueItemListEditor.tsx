import type { ReactNode } from "react";
import { useI18n } from "../../../i18n/react";
import type { ActivityItem, SituationalDialogueCharacter, SituationalDialogueResponse } from "../../../types/project";
import type { SituationalDialogueRichTextFieldRenderOptions } from "./types";
import { SituationalDialogueItemEditor } from "./SituationalDialogueItemEditor";
import styles from "./SituationalDialogueItemListEditor.module.css";

type SituationalDialogueItemListEditorProps = {
  items: ActivityItem[];
  characters: SituationalDialogueCharacter[];
  collapsedItemIds: string[];
  imageAccept: string;
  getImageName: (item: ActivityItem) => string;
  getResponses: (item: ActivityItem) => SituationalDialogueResponse[];
  renderImagePreview: (
    item: ActivityItem,
    context: {
      isIntroduction: boolean;
      isConclusion: boolean;
      sequenceNumber: number;
    }
  ) => ReactNode;
  renderRichTextField: (options: SituationalDialogueRichTextFieldRenderOptions) => ReactNode;
  onAddItem: () => void;
  onAddResponse: (itemId: string) => void;
  onAssignCharacter: (itemId: string, characterId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveResponse: (itemId: string, responseId: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUpdateResponse: (
    itemId: string,
    responseId: string,
    patch: Partial<SituationalDialogueResponse>
  ) => void;
  onUploadImage: (itemId: string, file: File) => void;
};

function isIntroductionItem(item: ActivityItem) {
  return item.nodeType === "introduction";
}

function isConclusionItem(item: ActivityItem) {
  return item.nodeType === "conclusion";
}

function sequenceNumberFor(items: ActivityItem[], item: ActivityItem) {
  if (isIntroductionItem(item) || isConclusionItem(item)) {
    return 0;
  }

  return (
    items
      .filter((entry) => !isIntroductionItem(entry) && !isConclusionItem(entry))
      .findIndex((entry) => entry.id === item.id) + 1
  );
}

export function SituationalDialogueItemListEditor({
  items,
  characters,
  collapsedItemIds,
  imageAccept,
  getImageName,
  getResponses,
  renderImagePreview,
  renderRichTextField,
  onAddItem,
  onAddResponse,
  onAssignCharacter,
  onRemoveItem,
  onRemoveResponse,
  onToggleCollapse,
  onUpdateItem,
  onUpdateResponse,
  onUploadImage
}: SituationalDialogueItemListEditorProps) {
  const { t } = useI18n();
  return (
    <>
      {items.map((item) => {
        const isIntroduction = isIntroductionItem(item);
        const isConclusion = isConclusionItem(item);
        const sequenceNumber = sequenceNumberFor(items, item);
        const label = isIntroduction
          ? t("situationalDialogue.introduction", undefined, "Introduction")
          : isConclusion
            ? t("situationalDialogue.conclusion", undefined, "Conclusion")
            : t("situationalDialogue.sequenceNumber", { number: sequenceNumber });
        const isCollapsed = collapsedItemIds.includes(item.id);

        return (
          <div className={styles.itemWithInsertionPoint} key={item.id}>
          {isConclusion ? (
            <div className={styles.addSequenceAction}>
              <button
                className={`ghost-pill ${styles.addSequenceButton}`}
                onClick={onAddItem}
                type="button"
              >
                <span aria-hidden="true">＋</span>
                <span>{t("situationalDialogue.addSequence", undefined, "Ajouter une séquence")}</span>
              </button>
            </div>
          ) : null}
          <article
            className={`activity-item-editor-card ${styles.card} ${isCollapsed ? "collapsed" : ""}`}
          >
            <div className="marker-editor-card-header activity-item-card-header">
              <button
                aria-expanded={!isCollapsed}
                aria-label={t(
                  isCollapsed ? "situationalDialogue.expandItemAria" : "situationalDialogue.collapseItemAria",
                  { label: label.toLowerCase() },
                  isCollapsed ? "Déplier {label}" : "Replier {label}",
                )}
                className="activity-item-collapse-button"
                onClick={() => onToggleCollapse(item.id)}
                type="button"
              >
                {isCollapsed ? "›" : "⌄"}
              </button>
              <strong>{label} </strong>
              <button
                className="ghost-pill compact"
                disabled={isIntroduction || isConclusion}
                onClick={() => onRemoveItem(item.id)}
                type="button"
              >
                {t("common.delete")}
              </button>
            </div>
            {isCollapsed ? null : (
              <SituationalDialogueItemEditor
                characters={characters}
                imageAccept={imageAccept}
                imageName={getImageName(item)}
                imagePreview={renderImagePreview(item, {
                  isIntroduction,
                  isConclusion,
                  sequenceNumber
                })}
                isConclusion={isConclusion}
                isIntroduction={isIntroduction}
                item={item}
                onAddResponse={() => onAddResponse(item.id)}
                onAssignCharacter={(characterId) => onAssignCharacter(item.id, characterId)}
                onRemoveResponse={(responseId) => onRemoveResponse(item.id, responseId)}
                onUpdateItem={(patch) => onUpdateItem(item.id, patch)}
                onUpdateResponse={(responseId, patch) =>
                  onUpdateResponse(item.id, responseId, patch)
                }
                onUploadImage={(file) => onUploadImage(item.id, file)}
                renderRichTextField={renderRichTextField}
                responses={getResponses(item)}
                sequenceNumber={sequenceNumber}
              />
            )}
          </article>
          </div>
        );
      })}
    </>
  );
}
