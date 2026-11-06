import type { ReactNode } from "react";

export type AuthoringMediaAssetPickerProps = {
  accept: string;
  emptyLabel: string;
  fileName: string;
  imageAlt: string;
  imageSrc: string | null;
  label: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  pickerLabel: string;
  removeLabel: string;
  showRemove?: boolean;
  trailingControl?: ReactNode;
};
