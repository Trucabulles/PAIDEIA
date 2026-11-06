import type { AttachmentFile, PaideiaBlock } from "../../../types/project";

export type AttachmentActivityProps = {
  authoringMode?: boolean;
  block: PaideiaBlock;
  resolveAssetUrl: (assetRef: string) => string | null;
  onDownload?: (block: PaideiaBlock, file: AttachmentFile) => void;
};

export type AttachmentActivityEditorProps = {
  files: AttachmentFile[];
  backgroundColor: string;
  borderColor: string;
  rounded: boolean;
  onAdd: (file: File) => void;
  onReplace: (attachmentId: string, file: File) => void;
  onRemove: (attachmentId: string) => void;
  onBackgroundColorChange: (value: string) => void;
  onBorderColorChange: (value: string) => void;
  onRoundedChange: (value: boolean) => void;
};
