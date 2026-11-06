import type { CSSProperties, ReactNode } from "react";

export type HeaderActivityProps = {
  authoringMode?: boolean;
  contentPosition: "left" | "center" | "right";
  contentNode: ReactNode;
  onImagePositionChange?: (value: number) => void;
  imagePositionY?: number | null;
  style: CSSProperties;
};

export type HeaderActivityEditorProps = {
  backgroundColor: string;
  height: string;
  hasImage: boolean;
  imageAccept: string;
  imageName: string;
  imageSrc: string | null;
  backgroundBlur: number;
  backgroundOverlay: number;
  backgroundOverlayDark: boolean;
  contentPosition: "left" | "center" | "right";
  textOutline: "none" | "thin" | "medium" | "thick";
  textOutlineColor: "light" | "dark";
  onBackgroundColorChange: (value: string) => void;
  onBackgroundBlurChange: (value: number) => void;
  onBackgroundOverlayChange: (value: number) => void;
  onBackgroundOverlayDarkChange: (value: boolean) => void;
  onContentPositionChange: (value: "left" | "center" | "right") => void;
  onTextOutlineChange: (value: "none" | "thin" | "medium" | "thick") => void;
  onTextOutlineColorChange: (value: "light" | "dark") => void;
  onHeightChange: (value: string) => void;
  onRemoveImage: () => void;
  onImageUpload: (file: File) => void;
  previewContentHtml: string;
  previewStyle: CSSProperties;
};
