import type { ReactNode } from "react";
import type { ActivityItem, ImageCrop } from "../../../types/project";
import {
  assetDisplayName,
  firstItemImageAssetRef,
  isSupportedImageAsset
} from "../../../app/mediaAssets";
import { CropIcon } from "../../app/AppIcons";
import { CroppedImage } from "../../app/CroppedImage";
import { NativeImageAnnotationAccessIcon } from "../../authoring";
import { AccordionActivityEditor } from "./AccordionActivityEditor";
import type { AccordionRichTextFieldRenderParams } from "./AccordionItemEditor";

type AccordionStyleValue = {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  rounded: boolean;
  shadow: boolean;
};

type AccordionActivityEditorPanelProps = {
  activeAnnotationItemId: string | null;
  activeCropItemId: string | null;
  collapsedItemIds: string[];
  draftImageCrop: ImageCrop | null;
  imageAccept: string;
  isCropMode: boolean;
  items: ActivityItem[];
  onAddItem: () => void;
  onApplyCrop: () => Promise<void> | void;
  onBeginAnnotation: (item: ActivityItem) => void;
  onBeginCrop: (item: ActivityItem) => void;
  onCancelCrop: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onRemoveItem: (itemId: string) => void;
  onStyleChange: (patch: Partial<AccordionStyleValue>) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadImage: (itemId: string, file: File) => void;
  renderAnnotationEditor: (item: ActivityItem, alt: string) => ReactNode;
  renderImageAltBadge: (item: ActivityItem) => ReactNode;
  renderRichTextField: (params: AccordionRichTextFieldRenderParams) => ReactNode;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
  style: AccordionStyleValue;
};

export function AccordionActivityEditorPanel({
  activeAnnotationItemId,
  activeCropItemId,
  collapsedItemIds,
  draftImageCrop,
  imageAccept,
  isCropMode,
  items,
  onAddItem,
  onApplyCrop,
  onBeginAnnotation,
  onBeginCrop,
  onCancelCrop,
  onCropChange,
  onRemoveItem,
  onStyleChange,
  onToggleCollapse,
  onUpdateItem,
  onUploadImage,
  renderAnnotationEditor,
  renderImageAltBadge,
  renderRichTextField,
  resolveAssetUrl,
  style
}: AccordionActivityEditorPanelProps) {
  const getImageAsset = (item: ActivityItem) => resolveAssetUrl(firstItemImageAssetRef(item));

  return (
    <AccordionActivityEditor
      activeAnnotationItemId={activeAnnotationItemId}
      activeCropItemId={activeCropItemId}
      annotationIcon={<NativeImageAnnotationAccessIcon />}
      backgroundColor={style.backgroundColor || "#edf4ff"}
      borderColor={style.borderColor || "#d5dae3"}
      borderStyle={style.borderStyle || "solid"}
      borderWidth={style.borderWidth || "1px"}
      collapsedItemIds={collapsedItemIds}
      cropIcon={<CropIcon />}
      draftImageCrop={draftImageCrop}
      getImageAsset={getImageAsset}
      getImageName={(item) => item.mediaFileName || assetDisplayName(firstItemImageAssetRef(item)) || ""}
      imageAccept={imageAccept}
      isCropMode={isCropMode}
      items={items}
      onAddItem={onAddItem}
      onApplyCrop={onApplyCrop}
      onBackgroundColorChange={(backgroundColor) => onStyleChange({ backgroundColor })}
      onBeginAnnotation={onBeginAnnotation}
      onBeginCrop={onBeginCrop}
      onBorderColorChange={(borderColor) => onStyleChange({ borderColor })}
      onBorderStyleChange={(borderStyle) => onStyleChange({ borderStyle })}
      onBorderWidthChange={(borderWidth) => onStyleChange({ borderWidth })}
      onCancelCrop={onCancelCrop}
      onCropChange={onCropChange}
      onRemoveImage={(itemId) =>
        onUpdateItem(itemId, {
          assetRefs: (items.find((item) => item.id === itemId)?.assetRefs ?? []).filter(
            (assetRef) => !isSupportedImageAsset(assetRef)
          ),
          imageCrop: null,
          imageAnnotationSourceAssetRef: null,
          imageAnnotationStateRef: null,
          imageAccessibility: null,
          mediaFileName: null
        })
      }
      onRemoveItem={onRemoveItem}
      onRoundedChange={(rounded) => onStyleChange({ rounded })}
      onShadowChange={(shadow) => onStyleChange({ shadow })}
      onToggleCollapse={onToggleCollapse}
      onUpdateItem={onUpdateItem}
      onUploadImage={onUploadImage}
      renderAnnotationEditor={renderAnnotationEditor}
      renderImage={(item, alt) => (
        <CroppedImage alt={alt} className="media-thumbnail-image" crop={item.imageCrop} rounded={item.imageRounded ?? false} src={getImageAsset(item) ?? ""} />
      )}
      renderImageAltBadge={renderImageAltBadge}
      renderRichTextField={renderRichTextField}
      rounded={style.rounded ?? true}
      shadow={style.shadow ?? false}
    />
  );
}
