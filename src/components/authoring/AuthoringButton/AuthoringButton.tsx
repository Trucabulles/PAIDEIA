import styles from "./AuthoringButton.module.css";
import type { AuthoringButtonProps, AuthoringButtonVariant } from "./types";

function variantClassName(variant: AuthoringButtonVariant) {
  switch (variant) {
    case "primary":
      return "primary-pill";
    case "secondary":
      return "secondary-pill";
    case "danger":
      return "danger-pill";
    case "ghost":
    default:
      return "ghost-pill";
  }
}

export function AuthoringButton({
  active = false,
  children,
  className = "",
  compact = false,
  dark = false,
  type = "button",
  variant = "ghost",
  ...buttonProps
}: AuthoringButtonProps) {
  const classNames = [
    styles.button,
    variantClassName(variant),
    compact ? "compact" : "",
    active ? "active" : "",
    dark ? "dark" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classNames} type={type} {...buttonProps}>
      {children}
    </button>
  );
}
