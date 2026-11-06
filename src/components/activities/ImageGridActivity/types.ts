import type { ReactNode } from "react";
import type { ActivityItem, ImageCrop } from "../../../types/project";

export type ImageGridRichTextFieldRenderParams = {
  item: ActivityItem;
  field: "contentHtml";
  html: string;
  className: string;
  label: string;
  placeholder: string;
};

export type ImageGridActivityProps = {
  authoringMode?: boolean;
  getItemImageUrl: (item: ActivityItem) => string | null;
  items: ActivityItem[];
  onImageOpen?: (src: string, alt: string, rounded: boolean) => void;
  renderRichContent?: (html: string, className?: string) => ReactNode;
  rounded: boolean;
  shadow: boolean;
};

export type ImageGridActivityEditorProps = {
  activeCropItemId: string | null;
  columns: number;
  cropIcon: ReactNode;
  draftImageCrop: ImageCrop | null;
  imageAccept: string;
  imageRounded: boolean;
  imageShadow: boolean;
  isCropMode: boolean;
  items: ActivityItem[];
  onAddItem: () => void;
  onApplyCrop: () => Promise<void> | void;
  onBeginCrop: (item: ActivityItem) => void;
  onCancelCrop: () => void;
  onColumnsChange: (columns: number) => void;
  onCropChange: (crop: ImageCrop) => void;
  onImageRoundedChange: (value: boolean) => void;
  onImageShadowChange: (value: boolean) => void;
  onRemoveImage: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onUploadImage: (itemId: string, file: File) => void;
  renderRichTextField: (params: ImageGridRichTextFieldRenderParams) => ReactNode;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
};
