import type { ReactNode } from "react";
import type { ActivityItem, ImageCrop } from "../../../types/project";
import { firstItemImageAssetRef } from "../../../app/mediaAssets";
import { CropIcon } from "../../app/AppIcons";
import { NativeImageAnnotationAccessIcon } from "../../authoring";
import { TabsActivityEditor } from "./TabsActivityEditor";
import type { TabsRichTextFieldRenderParams } from "./types";

type TabsStyleValue = {
  accentColor: string;
  backgroundColor: string;
  borderStyle: string;
  borderWidth: string;
  imageRounded: boolean;
  rounded: boolean;
  shadow: boolean;
};

type TabsActivityEditorPanelProps = {
  activeAnnotationItemId: string | null;
  activeCropItemId: string | null;
  crop: ImageCrop | null;
  imageAccept: string;
  isCropMode: boolean;
  items: ActivityItem[];
  onAddItem: () => void;
  onApplyCrop: () => Promise<void> | void;
  onBeginAnnotation: (item: ActivityItem) => void;
  onBeginCrop: (item: ActivityItem) => void;
  onCancelCrop: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onDuplicateItem: (itemId: string) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onRemoveItem: (itemId: string) => void;
  onStyleChange: (patch: Partial<TabsStyleValue>) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadItemImage: (itemId: string, file: File) => void;
  renderAnnotationEditor: (item: ActivityItem, alt: string) => ReactNode;
  renderImageAltBadge: (item: ActivityItem) => ReactNode;
  renderRichTextField: (params: TabsRichTextFieldRenderParams) => ReactNode;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
  style: TabsStyleValue;
  visiblePanel?: "activity" | "appearance" | "all";
};

export function TabsActivityEditorPanel({
  activeAnnotationItemId,
  activeCropItemId,
  crop,
  imageAccept,
  isCropMode,
  items,
  onAddItem,
  onApplyCrop,
  onBeginAnnotation,
  onBeginCrop,
  onCancelCrop,
  onCropChange,
  onDuplicateItem,
  onMoveItem,
  onRemoveItem,
  onStyleChange,
  onUpdateItem,
  onUploadItemImage,
  renderAnnotationEditor,
  renderImageAltBadge,
  renderRichTextField,
  resolveAssetUrl,
  style,
  visiblePanel = "all"
}: TabsActivityEditorPanelProps) {
  return (
    <div className="inspector-span-2">
      <TabsActivityEditor
        accentColor={style.accentColor}
        activeAnnotationItemId={activeAnnotationItemId}
        activeCropItemId={activeCropItemId}
        annotationIcon={<NativeImageAnnotationAccessIcon />}
        backgroundColor={style.backgroundColor}
        crop={crop}
        cropIcon={<CropIcon />}
        getItemImageUrl={(item) => resolveAssetUrl(firstItemImageAssetRef(item))}
        imageAccept={imageAccept}
        imageRounded={style.imageRounded}
        isCropMode={isCropMode}
        items={items}
        onAccentColorChange={(accentColor) => onStyleChange({ accentColor })}
        onAddItem={onAddItem}
        onApplyCrop={onApplyCrop}
        onBackgroundColorChange={(backgroundColor) => onStyleChange({ backgroundColor })}
        onBeginAnnotation={onBeginAnnotation}
        onBeginCrop={onBeginCrop}
        onCancelCrop={onCancelCrop}
        onCropChange={onCropChange}
        onDuplicateItem={onDuplicateItem}
        onImageRoundedChange={(imageRounded) => onStyleChange({ imageRounded })}
        onMoveItem={onMoveItem}
        onRemoveItem={onRemoveItem}
        onRoundedChange={(rounded) => onStyleChange({ rounded })}
        onShadowChange={(shadow) => onStyleChange({ shadow })}
        onUpdateItem={onUpdateItem}
        onUploadItemImage={onUploadItemImage}
        renderAnnotationEditor={renderAnnotationEditor}
        renderImageAltBadge={renderImageAltBadge}
        renderRichTextField={renderRichTextField}
        rounded={style.rounded}
        shadow={style.shadow}
        visiblePanel={visiblePanel}
      />
    </div>
  );
}
