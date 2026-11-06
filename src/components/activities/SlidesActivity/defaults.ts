export const SLIDES_NAVIGATION_DEFAULTS = {
  accentColor: "#F5F5F5",
  textColor: "#72809F",
  backgroundColor: "#ffffff",
  borderWidth: "1px",
  borderStyle: "solid",
  rounded: true,
  shadow: true
} as const;

type SlidesNavigationLegacyCandidate = {
  panelBackgroundColor?: string | null;
  panelBorderColor?: string | null;
  panelBorderWidth?: string | null;
  panelRounded?: boolean | null;
  buttonTextColor?: string | null;
};

export function hasLegacySlidesNavigationDefaults(value: SlidesNavigationLegacyCandidate) {
  return value.panelBackgroundColor === "#edf4ff"
    && value.panelBorderColor === "#123a7a"
    && value.panelBorderWidth === "2px"
    && value.panelRounded === false
    && (value.buttonTextColor == null || value.buttonTextColor === "#ffffff");
}
