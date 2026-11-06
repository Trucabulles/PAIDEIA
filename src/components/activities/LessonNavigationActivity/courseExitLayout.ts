export const COURSE_EXIT_LAYOUTS = [
  "button-only",
  "text-left-button-right",
  "button-left-text-right",
  "text-top-button-bottom"
] as const;

export type CourseExitLayout = (typeof COURSE_EXIT_LAYOUTS)[number];

export function normalizeCourseExitLayout(value?: string | null): CourseExitLayout {
  return COURSE_EXIT_LAYOUTS.includes(value as CourseExitLayout)
    ? value as CourseExitLayout
    : "button-only";
}

export function courseExitLayoutHasText(value?: string | null): boolean {
  return normalizeCourseExitLayout(value) !== "button-only";
}
