import type { CSSProperties, ReactNode } from "react";

export type QuoteActivityProps = {
  accentColor?: string | null;
  authorContent?: ReactNode;
  authorHtml?: string | null;
  content: ReactNode;
  imageAlt?: string;
  imageLayout?: "image-left" | "image-right" | "image-center";
  imageRole?: "presentation";
  imageRounded?: boolean;
  imageSrc?: string | null;
  imageWidth?: string;
  rounded?: boolean;
  shadow?: boolean;
  showAuthor?: boolean;
  showMarks?: boolean;
  style?: CSSProperties;
};

export type QuoteActivityEditorProps = {
  accentColor: string;
  authorField: ReactNode;
  showAuthor: boolean;
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  shadow: boolean;
  onAccentColorChange: (value: string) => void;
  onShowAuthorChange: (value: boolean) => void;
  onBackgroundColorChange: (value: string) => void;
  onBorderColorChange: (value: string) => void;
  onBorderStyleChange: (value: string) => void;
  onBorderWidthChange: (value: string) => void;
  onRoundedChange: (value: boolean) => void;
  onShadowChange: (value: boolean) => void;
  rounded: boolean;
};
