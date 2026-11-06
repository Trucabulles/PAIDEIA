export type PreviewDeviceMode =
  | "desktop"
  | "mobile-portrait"
  | "mobile-landscape"
  | "tablet-portrait"
  | "tablet-landscape";

export type PreviewDeviceFamily = "desktop" | "mobile" | "tablet";

export type PreviewDeviceConfig = {
  mode: PreviewDeviceMode;
  family: PreviewDeviceFamily;
  labelKey: string;
  width: number | null;
  height: number | null;
};

export const PREVIEW_DEVICE_CONFIGS: Record<PreviewDeviceMode, PreviewDeviceConfig> = {
  desktop: {
    mode: "desktop",
    family: "desktop",
    labelKey: "preview.device.desktop",
    width: null,
    height: null
  },
  "mobile-portrait": {
    mode: "mobile-portrait",
    family: "mobile",
    labelKey: "preview.device.mobilePortrait",
    width: 400,
    height: 800
  },
  "mobile-landscape": {
    mode: "mobile-landscape",
    family: "mobile",
    labelKey: "preview.device.mobileLandscape",
    width: 800,
    height: 400
  },
  "tablet-portrait": {
    mode: "tablet-portrait",
    family: "tablet",
    labelKey: "preview.device.tabletPortrait",
    width: 768,
    height: 1024
  },
  "tablet-landscape": {
    mode: "tablet-landscape",
    family: "tablet",
    labelKey: "preview.device.tabletLandscape",
    width: 1024,
    height: 768
  }
};

export function getPreviewDeviceConfig(mode: PreviewDeviceMode) {
  return PREVIEW_DEVICE_CONFIGS[mode];
}

export function getNextPreviewDeviceMode(currentMode: PreviewDeviceMode, family: PreviewDeviceFamily): PreviewDeviceMode {
  if (family === "desktop") {
    return "desktop";
  }
  if (family === "mobile") {
    if (!currentMode.startsWith("mobile")) {
      return "mobile-portrait";
    }
    return currentMode === "mobile-portrait" ? "mobile-landscape" : "mobile-portrait";
  }
  if (!currentMode.startsWith("tablet")) {
    return "tablet-landscape";
  }
  return currentMode === "tablet-landscape" ? "tablet-portrait" : "tablet-landscape";
}
