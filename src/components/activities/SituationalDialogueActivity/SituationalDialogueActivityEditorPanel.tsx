import type { ReactNode } from "react";
import { useI18n } from "../../../i18n/react";
import type {
  ActivityItem,
  PaideiaBlock,
  SituationalDialogueResponse
} from "../../../types/project";
import { assetDisplayName, firstItemImageAssetRef } from "../../../app/mediaAssets";
import { CroppedImage } from "../../app/CroppedImage";
import { SituationalDialogueCharacterBankEditor } from "./SituationalDialogueCharacterBankEditor";
import { SituationalDialogueItemListEditor } from "./SituationalDialogueItemListEditor";
import { normalizeSituationalDialogueResponses } from "./SituationalDialogueItems";
import { resolveSituationalDialogueCharacterAssetRef } from "./SituationalDialoguePoseResolution";
import type {
  SituationalDialogueCharacterBankEditorProps,
  SituationalDialogueRichTextFieldRenderOptions
} from "./types";

type SituationalDialogueActivityEditorPanelProps = {
  block: PaideiaBlock;
  titleEditor: ReactNode;
  characterBankProps: SituationalDialogueCharacterBankEditorProps;
  collapsedItemIds: string[];
  imageAccept: string;
  items: ActivityItem[];
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
  renderRichTextEditor: (options: SituationalDialogueRichTextFieldRenderOptions) => ReactNode;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
};

export function SituationalDialogueActivityEditorPanel({
  block,
  titleEditor,
  characterBankProps,
  collapsedItemIds,
  imageAccept,
  items,
  onAddItem,
  onAddResponse,
  onAssignCharacter,
  onRemoveItem,
  onRemoveResponse,
  onToggleCollapse,
  onUpdateItem,
  onUpdateResponse,
  onUploadImage,
  renderRichTextEditor,
  resolveAssetUrl
}: SituationalDialogueActivityEditorPanelProps) {
  const { t } = useI18n();
  const resolveItemImageRef = (item: ActivityItem) =>
    firstItemImageAssetRef(item) ?? resolveSituationalDialogueCharacterAssetRef(block, item, null);

  return (
    <div className="inspector-span-2 activity-items-editor">
      <div className="interactive-editor-header">
        <span className="editor-label">{t("activity.situational-dialogue")}</span>
      </div>
      {titleEditor}
      <SituationalDialogueCharacterBankEditor {...characterBankProps} />
      <div className="activity-item-editor-list">
        <SituationalDialogueItemListEditor
          characters={characterBankProps.characters}
          collapsedItemIds={collapsedItemIds}
          getImageName={(item) => {
            const itemImageRef = resolveItemImageRef(item);
            return item.mediaFileName || assetDisplayName(itemImageRef) || "";
          }}
          getResponses={normalizeSituationalDialogueResponses}
          imageAccept={imageAccept}
          items={items}
          onAddItem={onAddItem}
          onAddResponse={onAddResponse}
          onAssignCharacter={onAssignCharacter}
          onRemoveItem={onRemoveItem}
          onRemoveResponse={onRemoveResponse}
          onToggleCollapse={onToggleCollapse}
          onUpdateItem={onUpdateItem}
          onUpdateResponse={onUpdateResponse}
          onUploadImage={onUploadImage}
          renderImagePreview={(item, { isIntroduction, isConclusion, sequenceNumber }) => {
            const itemImageAsset = resolveAssetUrl(resolveItemImageRef(item));
            return (
              <div className={`media-thumbnail activity-item-thumbnail ${itemImageAsset ? "" : "empty"}`}>
                {itemImageAsset ? (
                  <CroppedImage
                    alt={
                      item.characterName ||
                      item.title ||
                      (isIntroduction
                        ? t("situationalDialogue.introduction", undefined, "Introduction")
                        : isConclusion
                          ? t("situationalDialogue.conclusion", undefined, "Conclusion")
                          : t("situationalDialogue.sequenceNumber", { number: sequenceNumber }))
                    }
                    className="media-thumbnail-image"
                    crop={item.imageCrop}
                    src={itemImageAsset}
                  />
                ) : (
                  <span className="media-thumbnail-empty">{t("situationalDialogue.characterPreview", undefined, "Aperçu personnage")}</span>
                )}
              </div>
            );
          }}
          renderRichTextField={(options) => (
            <div className={`situational-dialogue-rich-field ${options.className ?? ""}`}>
              <div className="situational-dialogue-rich-field-head">
                <span>{options.label}</span>
              </div>
              {renderRichTextEditor(options)}
            </div>
          )}
        />
      </div>
    </div>
  );
}
