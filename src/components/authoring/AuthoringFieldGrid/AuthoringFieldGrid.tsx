import styles from "./AuthoringFieldGrid.module.css";
import type { AuthoringFieldGridProps } from "./types";

export function AuthoringFieldGrid({ children, className = "", ...gridProps }: AuthoringFieldGridProps) {
  const classNames = [styles.grid, "style-grid", className].filter(Boolean).join(" ");

  return (
    <div className={classNames} {...gridProps}>
      {children}
    </div>
  );
}
