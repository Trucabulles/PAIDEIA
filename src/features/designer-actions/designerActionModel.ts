import type { DesignerBlockChange } from "../../types/project";
import type { DesignerHelpResponse } from "./designerHelpEngine";
import type { DesignerSlotId } from "./designerSlotRegistry";
import type { DesignerAddressForm, DesignerSocialResponse } from "./designerSocialRegistry";
export type { DesignerAddressForm, DesignerSocialResponse } from "./designerSocialRegistry";

export type ActivityHeight = "minimum" | "medium" | "large";
export type CaptionOutline = "none" | "thin" | "thick";
export type ActivitySpacing = "minimum" | "medium" | "maximum";
export type AppearanceActivityTarget = "all" | "title" | "type";
export type DesignerActivitySelection = {
  target: AppearanceActivityTarget;
  activityReference?: string;
  activityType?: string;
  activityTypes?: string[];
  excludedActivityTypes?: string[];
};
export type BackgroundIntensity = "none" | "light" | "medium" | "strong";
export type BackgroundAppearanceProperty = "color" | "overlay" | "overlay-color" | "blur" | "wide" | "rounded" | "height";
export type ActivityFrameBorderWidth = "1px" | "2px" | "4px" | "6px";
export type ActivityFrameBorderStyle = "none" | "solid" | "dashed" | "dotted";
export type SectionMarkerScheme = "arabic" | "roman" | "alpha";
export type SectionMarkerType = "none" | "outline" | "filled";
export type HeaderContentAlign = "left" | "center" | "right";
export type HeaderTextOutline = "none" | "thin" | "medium" | "thick";
export type HeaderTextOutlineColor = "light" | "dark";
export type DesignerActionScope = "lesson" | "chapter";
export type DesignerPreferenceAction = "use-feminine-session" | "remember-feminine" | "forget-address-form";

type DesignerActionOperationCore =
  | { kind: "set-lesson-text-color"; color: string }
  | { kind: "set-video-caption-color"; color: string }
  | { kind: "set-video-caption-background"; enabled: boolean }
  | { kind: "set-video-caption-outline"; outline: CaptionOutline }
  | { kind: "set-video-fullscreen"; enabled: boolean }
  | { kind: "reset-video-caption-color" }
  | { kind: "reset-video-caption-background" }
  | { kind: "reset-video-caption-outline" }
  | { kind: "reset-video-fullscreen" }
  | { kind: "reset-lesson-text-color" }
  | { kind: "set-text-activity-font-size"; sizePx: number; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "reset-text-activity-font-size"; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-font-family"; fontReference: string; fontFamily?: string; fontLabel?: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-spacing"; spacing: ActivitySpacing; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "reset-activity-spacing"; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-image"; assetRef: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "remove-activity-background-image"; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "reset-activity-background-property"; property: BackgroundAppearanceProperty; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-color"; color: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-overlay"; intensity: BackgroundIntensity; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-overlay-dark"; enabled: boolean; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-blur"; intensity: BackgroundIntensity; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-wide"; enabled: boolean; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-rounded"; enabled: boolean; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-background-height"; height: ActivityHeight; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "reset-activity-background"; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-frame-background-color"; color: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-frame-border-color"; color: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-situational-dialogue-color"; part: "banner" | "buttons"; color: string; target: "type"; activityType: "situational-dialogue" }
  | { kind: "set-activity-frame-accent-color"; color: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-frame-border-width"; width: ActivityFrameBorderWidth; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-frame-border-style"; style: ActivityFrameBorderStyle; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-frame-rounded"; enabled: boolean; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-activity-frame-shadow"; enabled: boolean; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "reset-activity-frame-appearance"; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-divider-color"; color: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-divider-width"; width: ActivityFrameBorderWidth; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-divider-style"; style: ActivityFrameBorderStyle; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-section-marker-scheme"; scheme: SectionMarkerScheme; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-section-marker-type"; markerType: SectionMarkerType; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-section-marker-text-color"; color: string; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "reset-divider-appearance"; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "reset-section-marker-appearance"; target: AppearanceActivityTarget; activityReference?: string; activityType?: string }
  | { kind: "set-header-background-color"; color: string }
  | { kind: "set-header-text-color"; color: string }
  | { kind: "set-header-background-blur"; intensity: BackgroundIntensity }
  | { kind: "set-header-background-overlay"; intensity: BackgroundIntensity }
  | { kind: "set-header-background-overlay-dark"; enabled: boolean }
  | { kind: "set-header-content-align"; align: HeaderContentAlign }
  | { kind: "set-header-text-outline"; outline: HeaderTextOutline }
  | { kind: "set-header-text-outline-color"; outlineColor: HeaderTextOutlineColor }
  | { kind: "reset-header-appearance" }
  | { kind: "copy-continue-button-style-to-course-exit" }
  | { kind: "copy-course-exit-button-style-to-continue" }
  | { kind: "set-continue-button-background"; color: string }
  | { kind: "set-continue-button-text-color"; color: string }
  | { kind: "set-continue-button-label"; label: string }
  | { kind: "reset-continue-button"; property: "background" | "text-color" | "label" | "all" };

export type DesignerActionOperation = DesignerActionOperationCore & {
  activityTypes?: string[];
  excludedActivityTypes?: string[];
};

export type DesignerActionIntent = {
  kind: "designer-command";
  scope: DesignerActionScope;
  chapterReference?: string;
  chapterResolution?: "title" | "ordinal";
  resolvedChapterIds?: string[];
  resolvedChapterTitles?: string[];
  operations: DesignerActionOperation[];
};

export type DesignerConversationDraft = {
  context: "help" | "activity-intent" | "activity-target" | "lesson-text" | "video" | "video-captions" | "text-activity-font-size" | "activity-font-family" | "activity-spacing" | "activity-background" | "activity-frame-appearance" | "divider-appearance" | "header-appearance" | "continue-button" | "assistant-preference";
  scope: DesignerActionScope;
  chapterReference?: string;
  chapterResolution?: "title" | "ordinal";
  operations: DesignerActionOperation[];
  pendingSlots: DesignerSlotId[];
  preferenceAction?: DesignerPreferenceAction;
  queuedCommands?: string[];
  candidateCommands?: string[];
  candidateSubjectIds?: string[];
  activityType?: string;
  activityLabel?: string;
};

export type DesignerConversationResult =
  | { status: "ready"; intent: DesignerActionIntent }
  | { status: "incomplete"; draft: DesignerConversationDraft; question: DesignerSlotId; control?: "color" | "image" | "font" }
  | { status: "ambiguous" }
  | { status: "unsupported" }
  | { status: "unavailable"; reason: "lesson-font-size" }
  | { status: "cancelled" }
  | { status: "forbidden" }
  | { status: "social"; response: DesignerSocialResponse }
  | { status: "help"; response: DesignerHelpResponse }
  | { status: "preference"; action: DesignerPreferenceAction };

export type DesignerActionTarget = DesignerBlockChange & {
  chapterTitle: string;
  pageTitle: string;
  blockTitle: string;
  previousValue: string;
  previousUnset?: boolean;
  previousDisplayValue?: string;
  displayValue?: string;
};

export type DesignerActionPreview = {
  intent: DesignerActionIntent;
  targets: DesignerActionTarget[];
  unchanged: DesignerActionTarget[];
  blockedReason?: "continue-styles-differ" | "course-exit-styles-differ" | "continue-style-missing" | "course-exit-missing";
  warning?: string;
};
