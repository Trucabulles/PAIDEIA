import type { ReactNode } from "react";
import type { ActivityItem, ImageCrop } from "../../../types/project";
import { assetDisplayName } from "../../../app/mediaAssets";
import { CropIcon } from "../../app/AppIcons";
import { CroppedImage } from "../../app/CroppedImage";
import { FlipCardsActivityEditor } from "./FlipCardsActivityEditor";
import type { FlipCardFace, FlipCardsRichTextFieldRenderParams } from "./FlipCardsItemEditor";
import { FlipCardsStyleEditor } from "./FlipCardsStyleEditor";

type FlipCardsEditorStyle = {
  frontBackgroundColor: string;
  backBackgroundColor: string;
  frontBorderColor: string;
  backBorderColor: string;
  borderStyle: string;
  borderWidth: string;
};

type FlipCardsActivityEditorPanelProps = {
  activeCropItemId: string | null;
  blockImageRounded: boolean;
  collapsedItemIds: string[];
  draftImageCrop: ImageCrop | null;
  imageAccept: string;
  isCropMode: boolean;
  items: ActivityItem[];
  onAddItem: () => void;
  onApplyCrop: () => Promise<void> | void;
  onBeginCrop: (item: ActivityItem, face: FlipCardFace) => void;
  onCancelCrop: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onRemoveItem: (itemId: string) => void;
  onStyleChange: (patch: Partial<FlipCardsEditorStyle>) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadImage: (itemId: string, face: FlipCardFace, file: File) => void;
  renderRichTextField: (params: FlipCardsRichTextFieldRenderParams) => ReactNode;
  renderImageAltBadge: (item: ActivityItem, face: FlipCardFace) => ReactNode;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
  style: FlipCardsEditorStyle;
};

export function FlipCardsActivityEditorPanel({
  activeCropItemId,
  blockImageRounded,
  collapsedItemIds,
  draftImageCrop,
  imageAccept,
  isCropMode,
  items,
  onAddItem,
  onApplyCrop,
  onBeginCrop,
  onCancelCrop,
  onCropChange,
  onRemoveItem,
  onStyleChange,
  onToggleCollapse,
  onUpdateItem,
  onUploadImage,
  renderRichTextField,
  renderImageAltBadge,
  resolveAssetUrl,
  style
}: FlipCardsActivityEditorPanelProps) {
  const getImageRef = (item: ActivityItem, face: FlipCardFace) =>
    face === "front" ? item.frontImageAssetRef : item.backImageAssetRef;
  const getImageAsset = (item: ActivityItem, face: FlipCardFace) => resolveAssetUrl(getImageRef(item, face));

  return (
    <>
      <FlipCardsStyleEditor
        frontBackgroundColor={style.frontBackgroundColor}
        backBackgroundColor={style.backBackgroundColor}
        frontBorderColor={style.frontBorderColor}
        backBorderColor={style.backBorderColor}
        borderStyle={style.borderStyle}
        borderWidth={style.borderWidth}
        onFrontBackgroundColorChange={(frontBackgroundColor) => onStyleChange({ frontBackgroundColor })}
        onBackBackgroundColorChange={(backBackgroundColor) => onStyleChange({ backBackgroundColor })}
        onFrontBorderColorChange={(frontBorderColor) => onStyleChange({ frontBorderColor })}
        onBackBorderColorChange={(backBorderColor) => onStyleChange({ backBorderColor })}
        onBorderStyleChange={(borderStyle) => onStyleChange({ borderStyle })}
        onBorderWidthChange={(borderWidth) => onStyleChange({ borderWidth })}
      />
      <FlipCardsActivityEditor
        activeCropItemId={activeCropItemId}
        blockImageRounded={blockImageRounded}
        collapsedItemIds={collapsedItemIds}
        cropIcon={<CropIcon />}
        draftImageCrop={draftImageCrop}
        getImageAsset={getImageAsset}
        getImageName={(item, face) =>
          (face === "front" ? item.frontImageFileName : item.backImageFileName)
          || assetDisplayName(getImageRef(item, face))
          || ""
        }
        imageAccept={imageAccept}
        isCropMode={isCropMode}
        items={items}
        onAddItem={onAddItem}
        onApplyCrop={onApplyCrop}
        onBeginCrop={onBeginCrop}
        onCancelCrop={onCancelCrop}
        onCropChange={onCropChange}
        onRemoveItem={onRemoveItem}
        onToggleCollapse={onToggleCollapse}
        onUpdateItem={onUpdateItem}
        onUploadImage={onUploadImage}
        renderImage={(item, face, alt) => (
          <CroppedImage
            alt={alt}
            className="media-thumbnail-image"
            crop={face === "front" ? item.frontImageCrop : item.backImageCrop}
            src={getImageAsset(item, face) ?? ""}
          />
        )}
        renderImageAltBadge={renderImageAltBadge}
        renderRichTextField={renderRichTextField}
      />
    </>
  );
}
