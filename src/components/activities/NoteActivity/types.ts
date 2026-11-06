import type { CSSProperties, ReactNode } from "react";
import type { NoteIconId } from "./noteIcons";

export type NoteActivityProps = {
  content: ReactNode;
  icon?: NoteIconId;
  iconColor?: string;
  rounded?: boolean;
  shadow?: boolean;
  showIcon?: boolean;
  style?: CSSProperties;
  title?: string;
};

export type NoteActivityEditorProps = {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  icon: NoteIconId;
  iconColor: string;
  iconMatchesBorder: boolean;
  onBackgroundColorChange: (value: string) => void;
  onBorderColorChange: (value: string) => void;
  onBorderStyleChange: (value: string) => void;
  onBorderWidthChange: (value: string) => void;
  onIconChange: (value: NoteIconId) => void;
  onIconColorChange: (value: string) => void;
  onIconMatchesBorderChange: (value: boolean) => void;
  onRoundedChange: (value: boolean) => void;
  onShadowChange: (value: boolean) => void;
  onShowIconChange: (value: boolean) => void;
  rounded: boolean;
  shadow: boolean;
  showIcon: boolean;
  showIconSettings?: boolean;
};
