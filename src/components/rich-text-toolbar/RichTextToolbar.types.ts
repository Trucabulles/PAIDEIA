export type RichTextToolbarProfile = "full" | "restricted" | "title" | "plain";
export type RichTextToolbarDisplayMode = "expanded" | "collapsible";
export type RichTextListMarker =
  | "disc"
  | "circle"
  | "square"
  | "dash"
  | "arrow"
  | "check"
  | "decimal"
  | "lower-alpha"
  | "upper-alpha"
  | "lower-roman"
  | "upper-roman";

export type RichTextToolbarFontOption = {
  previewFamily?: string;
  value: string;
  label: string;
  group: "bundled" | "project" | "user";
};

export type RichTextToolbarContextState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  outline?: boolean;
  alignment: "" | "left" | "center" | "right" | "justify";
  list: "" | "unordered" | "ordered";
  listMarker?: RichTextListMarker | "";
  indented: boolean;
  inTable: boolean;
  dropCap?: boolean;
  canToggleDropCap?: boolean;
  dropCapCharacterSelected?: boolean;
};

export type RichTextToolbarProps = {
  className?: string;
  displayMode?: RichTextToolbarDisplayMode;
  profile?: RichTextToolbarProfile;
  blockFormat?: string;
  fontFamily?: string;
  fontFamilies?: RichTextToolbarFontOption[];
  fontSize?: string;
  lineHeight?: string;
  contextState?: RichTextToolbarContextState;
  textColor: string;
  onBeforeCommand?: () => void;
  onCaseTransform: (mode: "upper" | "lower" | "capitalize") => void;
  onClearFormatting: () => void;
  onCommand: (command: string, value?: string) => void;
  onFontFamily: (fontFamily: string) => void;
  onFontSize: (fontSizePx: string) => void;
  onInsertInlineImage?: (file: File) => void;
  onLineHeight: (lineHeight: string) => void;
  onLink: () => void;
  onSelectAll: () => void;
  onTextColorChange: (value: string) => void;
  onTextHighlightChange?: (value: string) => void;
  onFieldFillChange?: (value: string) => void;
  onFieldFillOpacityChange?: (value: number) => void;
  onCreateBookmark?: () => void;
  onInsertReference?: () => void;
  highlightColor?: string;
  fieldFillColor?: string;
  fieldFillOpacity?: number;
  canCreateBookmark?: boolean;
  canInsertReference?: boolean;
  showReferenceControls?: boolean;
  showInlineImage?: boolean;
  showListControls?: boolean;
  showLink?: boolean;
  showOutline?: boolean;
  showStrikethrough?: boolean;
  showTable?: boolean;
  onInsertTable?: (rows: number, columns: number) => void;
};
