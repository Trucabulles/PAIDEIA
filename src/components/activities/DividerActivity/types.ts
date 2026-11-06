import type { CSSProperties } from "react";

export type DividerActivityProps = {
  style?: CSSProperties;
};

export type DividerActivityEditorProps = {
  color: string;
  onColorChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onWidthChange: (value: string) => void;
  style: string;
  width: string;
};
