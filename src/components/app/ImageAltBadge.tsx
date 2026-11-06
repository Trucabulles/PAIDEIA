import type { ImageAccessibility } from "../../types/project";
import { imageAltStatus } from "../../lib/imageAccessibility";
import { useI18n } from "../../i18n/react";

export function ImageAltBadge({
  accessibility,
  className = "",
  onClick
}: {
  accessibility?: ImageAccessibility | null;
  className?: string;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const status = imageAltStatus(accessibility);
  const label = t(`imageAlt.status.${status}`);
  return (
    <button
      aria-label={t("imageAlt.badgeAria", { status: label })}
      className={`image-alt-badge ${status} ${className}`.trim()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      &lt;ALT&gt;
    </button>
  );
}
