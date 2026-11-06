import type { InputHTMLAttributes, ReactNode } from "react";

export type AuthoringCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  children: ReactNode;
  compact?: boolean;
  labelClassName?: string;
};
