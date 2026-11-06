import type { ReactNode } from "react";

export type HtmlCustomActivityProps = {
  authoringMode?: boolean;
  hasContent: boolean;
  layout: string;
  previewNode: ReactNode;
};

export type HtmlCustomActivityEditorProps = {
  code: string;
  fileName?: string | null;
  htmlCodeScrollTop: number;
  importPending: boolean;
  lineCount: number;
  layout: string;
  onCodeChange: (value: string) => void;
  onFileSelect: (file: File) => void;
  onLayoutChange: (value: string) => void;
  onScrollTopChange: (value: number) => void;
  placeholder: string;
  title?: string | null;
};
