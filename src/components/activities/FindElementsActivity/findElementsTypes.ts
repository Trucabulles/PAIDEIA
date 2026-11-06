import type { ReactNode } from "react";
import type {
  FindElementsActivityData,
  FindElementsPoint,
  FindElementsSeverity,
  FindElementsZone
} from "../../../types/project";

export type FindElementsMarkerStatus = "pending" | "ok" | "bad" | "miss" | "expected";

export type FindElementsMarker = {
  id: string;
  x: number;
  y: number;
  status: FindElementsMarkerStatus;
  zoneId?: string;
};

export type FindElementsEvaluation = {
  score: number;
  foundZoneIds: string[];
  missedZoneIds: string[];
  markers: Array<FindElementsMarker & { zoneId?: string }>;
};

export type FindElementsActivityProps = {
  authoringMode?: boolean;
  data: FindElementsActivityData;
  imageAlt?: string;
  imageSrc: string | null;
  instructionHtml: string;
  onComplete?: () => void;
  renderRichContent?: (html: string, className?: string) => ReactNode;
  title: string;
};

export type FindElementsActivityEditorProps = {
  acceptImageTypes: string;
  data: FindElementsActivityData;
  imageAlt: string;
  imageAltControl?: ReactNode;
  imageSrc: string | null;
  instructionHtml: string;
  onDataChange: (updater: (current: FindElementsActivityData) => FindElementsActivityData) => void;
  onImageSelect: (file: File) => void;
  onInstructionChange: (value: string) => void;
  onRemoveImage: () => void;
  onTitleChange: (value: string) => void;
  renderZoneRichTextField: (params: {
    className?: string;
    field: "descriptionHtml" | "riskHtml" | "correctionHtml";
    html: string;
    label: string;
    placeholder: string;
    zone: FindElementsZone;
  }) => ReactNode;
  title: string;
};

export type FindElementsZoneStyle = {
  severity: FindElementsSeverity;
  selected?: boolean;
};

export type FindElementsZoneDraft = {
  shape: "rectangle" | "polygon";
  points: FindElementsPoint[];
};
