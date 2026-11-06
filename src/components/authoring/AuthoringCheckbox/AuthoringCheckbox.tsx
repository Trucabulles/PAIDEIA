import styles from "./AuthoringCheckbox.module.css";
import type { AuthoringCheckboxProps } from "./types";

export function AuthoringCheckbox({
  children,
  className = "",
  compact = false,
  labelClassName = "",
  ...inputProps
}: AuthoringCheckboxProps) {
  const labelClassNames = [
    styles.checkbox,
    "checkbox-line",
    compact ? "compact" : "",
    labelClassName
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={labelClassNames}>
      <input className={className} type="checkbox" {...inputProps} />
      <span>{children}</span>
    </label>
  );
}
