import type { NoteIconId } from "../../../types/project";

export const NOTE_ICON_IDS: readonly NoteIconId[] = [
  "info-circle",
  "no-entry",
  "exclamation-circle",
  "prohibition",
  "warning-triangle",
  "check-circle",
  "check"
];

export type { NoteIconId } from "../../../types/project";

export const DEFAULT_NOTE_ICON: NoteIconId = "info-circle";

export function normalizeNoteIcon(value: string | null | undefined): NoteIconId {
  return NOTE_ICON_IDS.includes(value as NoteIconId) ? value as NoteIconId : DEFAULT_NOTE_ICON;
}

export function NoteIconSvg({ icon, className }: { icon: NoteIconId; className?: string }) {
  const circular = icon === "info-circle" || icon === "no-entry" || icon === "exclamation-circle" || icon === "prohibition" || icon === "check-circle";
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: icon === "warning-triangle" ? 1.25 : 2
  };
  return (
    <svg aria-hidden="true" className={className} viewBox={circular ? "-7 -7 38 38" : "0 0 24 24"} xmlns="http://www.w3.org/2000/svg">
      {icon === "info-circle" ? <><circle {...common} cx="12" cy="12" r="18" /><path {...common} d="M12 10.5v6M12 7.5h.01" transform="translate(-4.615 -4.615) scale(1.384615)" /></> : null}
      {icon === "no-entry" ? <><circle {...common} cx="12" cy="12" r="18" /><path {...common} d="M3 12h18" /></> : null}
      {icon === "exclamation-circle" ? <><circle {...common} cx="12" cy="12" r="18" /><path {...common} d="M12 7.5v6M12 16.5h.01" transform="translate(-4.615 -4.615) scale(1.384615)" /></> : null}
      {icon === "prohibition" ? <><circle {...common} cx="12" cy="12" r="18" /><path {...common} d="M-.7-.7l25.4 25.4" /></> : null}
      {icon === "warning-triangle" ? <><path {...common} d="M12 3.5 21 20H3L12 3.5Z" /><path {...common} d="M12 9v5M12 17h.01" /></> : null}
      {icon === "check-circle" ? <><circle {...common} cx="12" cy="12" r="18" /><path {...common} d="m7.8 12.2 2.7 2.8 5.8-6" transform="translate(-4.615 -4.615) scale(1.384615)" /></> : null}
      {icon === "check" ? <path {...common} d="m5 12.5 4.2 4.2L19 7" /> : null}
    </svg>
  );
}
