import type { ReactNode } from "react";
import type { ActivityItem, ImageCrop, NativeImageAnnotationDocument, PaideiaBlock } from "../../../types/project";
import type { RichTextToolbarProfile } from "../../rich-text-toolbar/RichTextToolbar";

export type SlidesInlineField = "title" | "contentHtml";

export type SlidesItemFieldRenderer = (
  block: PaideiaBlock,
  item: ActivityItem,
  field: SlidesInlineField,
  html: string,
  className: string,
  profile: RichTextToolbarProfile
) => ReactNode;

export type SlidesActivityProps = {
  block: PaideiaBlock;
  displayTitle: string;
  displaySummary: string;
  items: ActivityItem[];
  activeIndex: number;
  normalizeHtml: (html: string) => string;
  stripHtml: (html: string) => string;
  imageSizeToPercent: (value?: string | null) => number;
  getItemImageUrl: (item: ActivityItem) => string | null;
  renderItemImage: (
    item: ActivityItem,
    options: {
      alt: string;
      className: string;
      rounded: boolean;
      onClick: () => void;
    }
  ) => ReactNode;
  renderItemField?: SlidesItemFieldRenderer;
  onActiveIndexChange: (index: number) => void;
  onImageOpen?: (src: string, alt: string, rounded: boolean) => void;
  onItemAdd?: (block: PaideiaBlock) => void;
};

export type SlidesItemEditorProps = {
  item: ActivityItem;
  index: number;
  blockImageRounded?: boolean | null;
  draftImageCrop: ImageCrop | null;
  label: string;
  imageAsset: string | null;
  annotationImageAsset: string | null;
  annotationValue: NativeImageAnnotationDocument;
  mediaName: string;
  isCropActive: boolean;
  isAnnotationActive: boolean;
  cropIcon: ReactNode;
  annotationIcon: ReactNode;
  preview: ReactNode;
  imageAltBadge?: ReactNode;
  imageAccept: string;
  normalizeImageSize: (value?: string | null) => string;
  onApplyCrop: () => Promise<void> | void;
  onApplyAnnotation: () => Promise<void> | void;
  onApplyAnnotationEnd: () => void;
  onApplyAnnotationStart: () => void;
  onCancelCrop: () => void;
  onCancelAnnotation: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onUpload: (file: File) => void;
  onRemoveImage: () => void;
  onUpdate: (patch: Partial<ActivityItem>) => void;
  onBeginCrop: () => void;
  onBeginAnnotation: () => void;
  onAnnotationChange: (document: NativeImageAnnotationDocument, renderedDataUrl?: string | null) => Promise<void> | void;
};
