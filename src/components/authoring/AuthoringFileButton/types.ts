import type { ReactNode } from "react";

export type AuthoringFileButtonVariant = "media" | "secondary";

export type AuthoringFileButtonProps = {
  accept?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
  onFileSelect: (file: File) => void;
  variant?: AuthoringFileButtonVariant;
};
