import type { ButtonHTMLAttributes, ReactNode } from "react";

export type AuthoringButtonVariant = "ghost" | "primary" | "secondary" | "danger";

export type AuthoringButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
  compact?: boolean;
  dark?: boolean;
  variant?: AuthoringButtonVariant;
};
