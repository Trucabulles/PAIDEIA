import type { CSSProperties, ReactNode } from "react";
import type { ActivityItem, ImageCrop, PaideiaBlock } from "../../../types/project";

export type TabsRichTextFieldName = "title" | "contentTitle" | "contentHtml";

export type TabsRichTextFieldRenderParams = {
  item: ActivityItem;
  field: TabsRichTextFieldName;
  html: string;
  label: string;
  className?: string;
  placeholder: string;
  onFinish?: () => void;
};

export type TabsActivityProps = {
  authoringMode?: boolean;
  block: PaideiaBlock;
  contentTextColor?: string;
  displaySummary: string;
  displayTitle: string;
  getItemImageUrl: (item: ActivityItem) => string | null;
  items: ActivityItem[];
  onImageOpen?: (src: string, alt: string) => void;
  renderItemField?: (params: TabsRichTextFieldRenderParams) => ReactNode;
  onBeforeTabChange?: () => void;
};

export type TabsActivityEditorProps = {
  accentColor: string;
  activeAnnotationItemId: string | null;
  activeCropItemId: string | null;
  annotationIcon: ReactNode;
  backgroundColor: string;
  crop: ImageCrop | null;
  cropIcon: ReactNode;
  getItemImageUrl: (item: ActivityItem) => string | null;
  imageAccept: string;
  imageRounded: boolean;
  isCropMode: boolean;
  items: ActivityItem[];
  onAccentColorChange: (value: string) => void;
  onAddItem: () => void;
  onApplyCrop: () => Promise<void> | void;
  onBackgroundColorChange: (value: string) => void;
  onBeginAnnotation: (item: ActivityItem) => void;
  onBeginCrop: (item: ActivityItem) => void;
  onCancelCrop: () => void;
  onCropChange: (crop: ImageCrop) => void;
  onDuplicateItem: (itemId: string) => void;
  onImageRoundedChange: (value: boolean) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onRemoveItem: (itemId: string) => void;
  renderRichTextField: (params: TabsRichTextFieldRenderParams) => ReactNode;
  onRoundedChange: (value: boolean) => void;
  onShadowChange: (value: boolean) => void;
  onUpdateItem: (itemId: string, patch: Partial<ActivityItem>) => void;
  onUploadItemImage: (itemId: string, file: File) => void;
  renderAnnotationEditor: (item: ActivityItem, alt: string) => ReactNode;
  renderImageAltBadge: (item: ActivityItem) => ReactNode;
  rounded: boolean;
  shadow: boolean;
  visiblePanel?: "activity" | "appearance" | "all";
};

export type TabsCssVars = CSSProperties & {
  "--tabs-accent"?: string;
  "--tabs-background"?: string;
  "--tabs-content-text"?: string;
  "--tabs-image-size"?: string;
  "--tabs-radius"?: string;
  "--tabs-visible-count"?: number;
};
