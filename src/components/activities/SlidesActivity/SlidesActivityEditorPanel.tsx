import type {
  ActivityItem,
  ImageCrop,
  NativeImageAnnotationDocument
} from "../../../types/project";
import type { ReactNode } from "react";
import { CropIcon } from "../../app/AppIcons";
import { CroppedImage } from "../../app/CroppedImage";
import { NativeImageAnnotationAccessIcon } from "../../authoring";
import {
  assetDisplayName,
  firstItemImageAssetRef,
  isSupportedImageAsset
} from "../../../app/mediaAssets";
import { SlidesActivityEditor, type SlidesActivityAppearanceValue, type SlidesNavigationStyleValue } from "./SlidesActivityEditor";
import { SlidesItemEditor } from "./SlidesItemEditor";
import { useI18n } from "../../../i18n/react";

type SlidesActivityEditorPanelProps = {
  appearanceBackgroundPanel?: ReactNode;
  activeAnnotationItemId: string | null;
  activeCropItemId: string | null;
  annotationDocuments: Record<string, NativeImageAnnotationDocument>;
  blockImageRounded: boolean;
  collapsedItemIds: string[];
  draftImageCrop: ImageCrop | null;
  imageAccept: string;
  isCropMode: boolean;
  items: ActivityItem[];
  normalizeImageSize: (value?: string | null) => string;
  onAddItem: () => void;
  onAnnotationChange: (
    itemId: string,
    sourceAssetRef: string,
    document: NativeImageAnnotationDocument,
    renderedDataUrl?: string | null
  ) => Promise<void> | void;
  onApplyAnnotation: () => Promise<void> | void;
  onApplyAnnotationEnd: () => void;
  onApplyAnnotationStart: () => void;
  onApplyCrop: () => Promise<void> | void;
  onBeginAnnotation: (item: ActivityItem) => void;
  onBeginCrop: (item: ActivityItem) => void;
  onCancelAnnotation: () => void;
  onCancelCrop: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onRemoveItem: (itemId: string) => void;
  onStyleChange: (patch: Partial<SlidesNavigationStyleValue>) => void;
  onActivityAppearanceChange: (patch: Partial<SlidesActivityAppearanceValue>) => void;
  onToggleCollapse: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadItemAsset: (itemId: string, file: File) => void;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
  renderImageAltBadge: (item: ActivityItem) => ReactNode;
  style: SlidesNavigationStyleValue;
  activityAppearance: SlidesActivityAppearanceValue;
  tabs?: {
    activityLabel: string;
    appearanceLabel: string;
    sessionKey: string;
  };
  visiblePanel?: "activity" | "appearance" | "all";
};

export function SlidesActivityEditorPanel({
  appearanceBackgroundPanel,
  activeAnnotationItemId,
  activeCropItemId,
  annotationDocuments,
  blockImageRounded,
  collapsedItemIds,
  draftImageCrop,
  imageAccept,
  isCropMode,
  items,
  normalizeImageSize,
  onAddItem,
  onAnnotationChange,
  onApplyAnnotation,
  onApplyAnnotationEnd,
  onApplyAnnotationStart,
  onApplyCrop,
  onBeginAnnotation,
  onBeginCrop,
  onCancelAnnotation,
  onCancelCrop,
  onCropChange,
  onMoveItem,
  onRemoveItem,
  onStyleChange,
  onActivityAppearanceChange,
  onToggleCollapse,
  onUpdateItem,
  onUploadItemAsset,
  resolveAssetUrl,
  renderImageAltBadge,
  style,
  activityAppearance,
  tabs,
  visiblePanel
}: SlidesActivityEditorPanelProps) {
  const { t } = useI18n();

  return (
    <SlidesActivityEditor
      appearanceBackgroundPanel={appearanceBackgroundPanel}
      collapsedItemIds={collapsedItemIds}
      items={items}
      onAddItem={onAddItem}
      onMoveItem={onMoveItem}
      onRemoveItem={onRemoveItem}
      activityAppearance={activityAppearance}
      onActivityAppearanceChange={onActivityAppearanceChange}
      onStyleChange={onStyleChange}
      onToggleCollapse={onToggleCollapse}
      style={style}
      tabs={tabs}
      visiblePanel={visiblePanel}
      renderItemEditor={(item, index, label) => {
        const itemImageRef = firstItemImageAssetRef(item);
        const itemImageAsset = resolveAssetUrl(itemImageRef);
        const annotationSourceRef = item.imageAnnotationSourceAssetRef || itemImageRef;
        const annotationImageAsset = resolveAssetUrl(annotationSourceRef);
        const annotationDocument = annotationDocuments[item.id] ?? { version: 1, annotations: [] };
        const itemMediaName = item.mediaFileName || assetDisplayName(itemImageRef) || "";
        const isItemCropActive = activeCropItemId === item.id && isCropMode && Boolean(itemImageAsset);
        const isItemAnnotationActive = activeAnnotationItemId === item.id && Boolean(annotationImageAsset);

        return (
          <SlidesItemEditor
            annotationIcon={<NativeImageAnnotationAccessIcon />}
            annotationImageAsset={annotationImageAsset}
            annotationValue={annotationDocument}
            blockImageRounded={blockImageRounded}
            cropIcon={<CropIcon />}
            draftImageCrop={draftImageCrop}
            imageAccept={imageAccept}
            imageAsset={itemImageAsset}
            imageAltBadge={renderImageAltBadge(item)}
            index={index}
            isAnnotationActive={isItemAnnotationActive}
            isCropActive={isItemCropActive}
            item={item}
            label={label}
            mediaName={itemMediaName}
            normalizeImageSize={normalizeImageSize}
            onAnnotationChange={(document, renderedDataUrl) => {
              if (annotationSourceRef) {
                return onAnnotationChange(item.id, annotationSourceRef, document, renderedDataUrl);
              }
              return undefined;
            }}
            onApplyAnnotation={onApplyAnnotation}
            onApplyAnnotationEnd={onApplyAnnotationEnd}
            onApplyAnnotationStart={onApplyAnnotationStart}
            onApplyCrop={onApplyCrop}
            onBeginAnnotation={() => onBeginAnnotation(item)}
            onBeginCrop={() => onBeginCrop(item)}
            onCancelAnnotation={onCancelAnnotation}
            onCancelCrop={onCancelCrop}
            onCropChange={onCropChange}
            onRemoveImage={() =>
              onUpdateItem(item.id, {
                assetRefs: (item.assetRefs ?? []).filter((assetRef) => !isSupportedImageAsset(assetRef)),
                mediaFileName: null,
                imageCrop: null,
                imageAnnotationStateRef: null,
                imageAnnotationSourceAssetRef: null,
                imageAccessibility: null
              })
            }
            onUpdate={(patch) => onUpdateItem(item.id, patch)}
            onUpload={(file) => onUploadItemAsset(item.id, file)}
            preview={
              itemImageAsset ? (
                <CroppedImage alt={item.title || t("slides.slideNumber", { number: index + 1 })} className="media-thumbnail-image" crop={item.imageCrop} src={itemImageAsset} />
              ) : null
            }
          />
        );
      }}
    />
  );
}
