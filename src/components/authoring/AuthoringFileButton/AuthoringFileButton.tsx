import styles from "./AuthoringFileButton.module.css";
import type { AuthoringFileButtonProps, AuthoringFileButtonVariant } from "./types";

function variantClassName(variant: AuthoringFileButtonVariant) {
  switch (variant) {
    case "secondary":
      return "secondary-pill";
    case "media":
    default:
      return "media-picker-button";
  }
}

export function AuthoringFileButton({
  accept,
  children,
  className = "",
  disabled = false,
  multiple = false,
  onFileSelect,
  variant = "media"
}: AuthoringFileButtonProps) {
  const classNames = [styles.button, variantClassName(variant), className].filter(Boolean).join(" ");

  return (
    <label aria-disabled={disabled || undefined} className={classNames}>
      {children}
      <input
        accept={accept}
        disabled={disabled}
        multiple={multiple}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileSelect(file);
          }
          event.target.value = "";
        }}
        type="file"
      />
    </label>
  );
}
