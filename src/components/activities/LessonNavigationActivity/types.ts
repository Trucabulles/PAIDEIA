import type { CSSProperties, ReactNode } from "react";
import type { CourseExitLayout } from "./courseExitLayout";

export type LessonNavigationActivityType = "continue" | "course-exit";

export type LessonNavigationActivityProps = {
  activityType: LessonNavigationActivityType;
  content?: ReactNode;
  label: string;
  layout?: CourseExitLayout;
  onActivate?: () => void;
  style?: CSSProperties;
};

export type LessonNavigationActivityEditorProps = {
  activityType: LessonNavigationActivityType;
  backgroundColor: string;
  label: string;
  layout?: CourseExitLayout;
  onBackgroundColorChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onLayoutChange?: (value: CourseExitLayout) => void;
  onTextColorChange: (value: string) => void;
  previewLabel: string;
  richTextField?: ReactNode;
  showLayout?: boolean;
  textColor: string;
};
